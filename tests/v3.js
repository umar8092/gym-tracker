// "Main Event" UI: fight-card home screen in every state, dashboard tape, theme switch, images, nav on phone and laptop.
const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const { signIn } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const FRI = new Date('2026-10-16T10:00:00'), SAT = new Date('2026-10-17T10:00:00');
  const day = (base, n) => { const d = new Date(base); d.setDate(d.getDate() - n); return ymd(d); };
  let id = 0; const lg = (base, n, e, m, reps, kg) => ({ id: 's' + ++id, d: day(base, n), m, e, reps, kg, ts: new Date(day(base, n) + 'T10:00:00').getTime() + id, u: 1, dirty: false });
  async function open(vw, vh, base, hash, seed, scheme = 'dark') {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, colorScheme: scheme, reducedMotion: 'reduce' }), page = await ctx.newPage();
    page.on('pageerror', e => fails.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) fails.push('console ' + m.text()); });
    await page.clock.install({ time: base });
    await signIn(page, 'umar', seed); await page.goto(URL + hash); await page.waitForTimeout(500); return page;
  }
  const profile = { startKg: 92, goalKg: 75, startDate: '2026-09-01' }, weights = [28, 14, 7, 0].map((n, i) => ({ d: day(FRI, n), kg: 92 - i * 0.6, u: 1, dirty: false }));
  const armsLogs = [14, 7].flatMap(n => [0, 1, 2].map(() => lg(FRI, n, 'barbell-curl', 'arms', n === 7 ? 11 : 10, 30)));

  // 1. a planned day: arms night. Main event first, undercard below, tale of the tape, fight week.
  let p = await open(390, 844, FRI, '#/', { logs: armsLogs, weights, profile });
  ok((await p.locator('.ticker').textContent()).includes('Arms night') && (await p.locator('.ticker').textContent()).includes('6 bouts'), 'ticker names the muscle and counts the bouts');
  ok((await p.locator('.main-event .badge').textContent()).trim() === 'Main event' && (await p.locator('.main-event h1').textContent()).includes('Barbell curl'), 'the first exercise is the main event');
  ok((await p.locator('.main-event .vs').textContent()).includes('You') && (await p.locator('.main-event .facts').textContent()).includes('11 × 30'), 'main event shows the opponent: last time\'s best round');
  ok((await p.locator('.bout').count()) === 5, 'undercard lists the other five bouts');
  ok((await p.locator('a.btn.primary', { hasText: 'Enter the ring' }).getAttribute('href')) === '#/m/arms', 'enter the ring opens today\'s workout');
  ok((await p.locator('.tape').textContent()).includes('90.2'), 'tale of the tape shows current weight');
  ok((await p.locator('.fweek .wd').count()) === 5 && (await p.locator('.fweek .wd.missed').count()) === 4, 'fight week: five tiles, four no shows');
  ok((await p.locator('.note.catch').textContent()).includes('no shows this week'), 'no-show note lists the owed muscles');
  const imgs = await p.evaluate(async () => { await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))); return [...document.images].map(i => i.naturalWidth); });
  ok(imgs.length >= 3 && imgs.every(w => w > 0), 'exercise portraits load (' + imgs.length + ' images)');
  ok(await p.locator('.tabs').evaluate(e => getComputedStyle(e).position) === 'fixed', 'phone: tab bar is fixed to the bottom');
  await p.context().close();

  // 2. laptop: top bar, two columns
  p = await open(1440, 900, FRI, '#/', { logs: armsLogs, weights, profile });
  ok(await p.locator('.tabs').evaluate(e => getComputedStyle(e).position) === 'sticky' && (await p.locator('#me').textContent()) === 'umar', 'laptop: sticky top bar with the user name');
  const cols = await p.evaluate(() => { const a = document.querySelector('.t-main').getBoundingClientRect(), s = document.querySelector('.side').getBoundingClientRect(); return [a.right <= s.left + 1, s.width > 380]; });
  ok(cols[0] && cols[1], 'laptop: the card and the side column sit next to each other');
  await p.context().close();

  // 3. done today
  p = await open(390, 844, FRI, '#/', { logs: armsLogs.concat([lg(FRI, 0, 'barbell-curl', 'arms', 12, 30), lg(FRI, 0, 'barbell-curl', 'arms', 12, 30)]), weights, profile });
  ok((await p.locator('.main-event').textContent()).includes('Fight over') && (await p.locator('.bout .res').first().textContent()).trim() === 'Won', 'done today: fight over, the bout is won against last time');
  await p.context().close();

  // 4. rest day names the next card
  p = await open(390, 844, SAT, '#/', { logs: [], weights, profile });
  ok((await p.locator('.main-event').textContent()).includes('Next card: Monday, Chest'), 'rest day shows the next card');
  ok(await p.locator('a', { hasText: 'Train anyway' }).count() === 1, 'rest day still offers to train anyway');
  await p.context().close();

  // 5. every exercise hidden
  p = await open(390, 844, FRI, '#/', { logs: [], weights, profile, hidden: Object.fromEntries(['barbell-curl', 'hammer-curl', 'close-grip-bench', 'overhead-triceps-extension', 'lying-triceps-extension', 'cable-pushdown'].map(k => [k, true])) });
  ok((await p.locator('.main-event').textContent()).includes('switched off'), 'empty card explains that all exercises are switched off');
  await p.context().close();

  // 6. dashboard: tape + record, fight words, theme switch
  p = await open(1440, 900, FRI, '#/progress', { logs: armsLogs, weights, profile });
  ok((await p.locator('.dash.over .tape').textContent()).includes('Record W–L–D') && (await p.locator('.d-week .wd').count()) === 5, 'dashboard: tale of the tape with the record, and the fight week');
  await p.goto(URL + '#/plan'); await p.waitForTimeout(300);
  const before = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await p.locator('[data-act="theme"]').click();
  const after = await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]);
  ok(before === 'dark' && after[0] === 'light' && after[1] !== 'rgb(10, 10, 11)', 'dark is the default and the theme switch gives the light version');
  await p.context().close();

  // 7. log a round: wording
  p = await open(390, 844, FRI, '#/m/arms', { logs: armsLogs, weights, profile });
  ok((await p.locator('section.ex').first().locator('[data-act="log"]').textContent()).trim() === 'Log round 1', 'logger button says Log round 1');
  await p.locator('section.ex').first().locator('[data-act="log"]').click(); await p.waitForTimeout(200);
  ok((await p.locator('section.ex').first().locator('.sn').first().textContent()).trim() === 'Round 1', 'logged rounds are numbered');
  ok((await p.locator('#rest-t').textContent()).startsWith('Rest'), 'rest timer starts after the round');
  await p.context().close();

  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nv3 UI tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
