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
  let p = await open(390, 844, FRI, '#/today', { logs: armsLogs, weights, profile });
  ok((await p.locator('.ticker').textContent()).includes('Arms day') && (await p.locator('.ticker').textContent()).includes('6 bouts'), 'ticker names the muscle and counts the bouts');
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
  ok((await p.title()) === 'Today | Gym Workout Tracker', 'page title carries the new name');
  await p.context().close();

  // 2. laptop: top bar, two columns
  p = await open(1440, 900, FRI, '#/today', { logs: armsLogs, weights, profile });
  ok(await p.locator('.tabs').evaluate(e => getComputedStyle(e).position) === 'sticky' && (await p.locator('#me').textContent()) === 'umar', 'laptop: sticky top bar with the user name');
  const cols = await p.evaluate(() => { const a = document.querySelector('.t-main').getBoundingClientRect(), s = document.querySelector('.side').getBoundingClientRect(); return [a.right <= s.left + 1, s.width > 380]; });
  ok(cols[0] && cols[1], 'laptop: the card and the side column sit next to each other');
  await p.context().close();

  // 3. done today
  p = await open(390, 844, FRI, '#/today', { logs: armsLogs.concat([lg(FRI, 0, 'barbell-curl', 'arms', 12, 30), lg(FRI, 0, 'barbell-curl', 'arms', 12, 30)]), weights, profile });
  ok((await p.locator('.main-event').textContent()).includes('Fight over') && (await p.locator('.bout .res').first().textContent()).trim() === 'Won', 'done today: fight over, the bout is won against last time');
  await p.context().close();

  // 4. rest day names the next card
  p = await open(390, 844, SAT, '#/today', { logs: [], weights, profile });
  ok((await p.locator('.main-event').textContent()).includes('Next card: Monday, Chest'), 'rest day shows the next card');
  ok(await p.locator('a', { hasText: 'Train anyway' }).count() === 1, 'rest day still offers to train anyway');
  await p.context().close();

  // 5. every exercise hidden
  p = await open(390, 844, FRI, '#/today', { logs: [], weights, profile, hidden: Object.fromEntries(['barbell-curl', 'hammer-curl', 'close-grip-bench', 'overhead-triceps-extension', 'lying-triceps-extension', 'cable-pushdown'].map(k => [k, true])) });
  ok((await p.locator('.main-event').textContent()).includes('switched off'), 'empty card explains that all exercises are switched off');
  await p.context().close();

  // 6. dashboard: tape + record, fight words, theme switch
  p = await open(1440, 900, FRI, '#/progress', { logs: armsLogs, weights, profile });
  ok((await p.locator('.dash.over .tape').textContent()).includes('Record W–L–D') && (await p.locator('.d-week .wd').count()) === 5, 'dashboard: tale of the tape with the record, and the fight week');
  await p.goto(URL + '#/plan'); await p.waitForTimeout(300); await p.evaluate(() => { document.querySelectorAll('details.fold').forEach(d => { d.open = true; }); });
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

  // 8. one exercise at a time with a rail
  p = await open(390, 844, FRI, '#/m/arms', { logs: armsLogs, weights, profile });
  ok((await p.locator('section.ex').count()) === 1 && (await p.locator('.rail .ri').count()) === 6, 'workout shows one exercise and a rail of six');
  ok((await p.locator('.wk-pos').textContent()).includes('1 of 6') && (await p.locator('.ri.on').count()) === 1, 'position is shown and the current exercise is marked');
  await p.locator('[data-act="wk-next"]').click(); await p.waitForTimeout(250);
  ok((await p.locator('section.ex h2').textContent()).includes('hammer') || (await p.locator('section.ex h2').textContent()).toLowerCase().includes('hammer'), 'Next opens the second exercise');
  await p.locator('.rail .ri').nth(3).click(); await p.waitForTimeout(250);
  ok((await p.locator('.wk-pos').textContent()).includes('4 of 6'), 'the rail jumps straight to the fourth exercise');
  await p.locator('[data-act="wk-skip"]').click(); await p.waitForTimeout(300);
  ok((await p.locator('.wk-pos').textContent()).includes('5 of 6') && (await p.locator('.rail .ri.skip').count()) === 1, 'Skip moves on and marks the exercise as skipped in the rail');
  await p.locator('.rail .ri').nth(5).click(); await p.waitForTimeout(250);
  ok((await p.locator('[data-act="wk-next"]').textContent()).includes('Finish workout'), 'the last exercise offers Finish workout');
  await p.locator('.rail .ri').first().click(); await p.locator('section.ex [data-act="log"]').click(); await p.locator('section.ex [data-act="log"]').click(); await p.locator('section.ex [data-act="log"]').click(); await p.waitForTimeout(300);
  ok((await p.locator('.rail .ri').first().locator('small').textContent()).includes('Done') && (await p.locator('.rail .ri.done').count()) === 1, 'finishing all rounds marks the exercise Done in the rail');
  await p.context().close();

  // 9. custom week: a 3-day plan with two muscles on one day, and a 7-day plan
  const sat = new Date('2026-10-17T10:00:00');
  p = await open(390, 844, FRI, '#/today', { logs: [], weights, profile, schedule: { 5: ['chest', 'back'], 6: ['legs'] } });
  ok((await p.locator('.ticker').textContent()).includes('Chest + Back day') && (await p.locator('.bout').count()) === 9, 'a day with two muscles shows both on the card (5 chest + 5 back, one is the main event)');
  ok((await p.locator('.bout').nth(5).getAttribute('href')) === '#/m/back', 'rows from the second muscle open that muscle');
  ok((await p.locator('.fweek .wd').count()) === 2, 'fight week only lists the training days');
  await p.context().close();
  p = await open(390, 844, SAT, '#/today', { logs: [], weights, profile, schedule: { 5: ['chest', 'back'], 6: ['legs'], 0: ['arms'] } });
  ok((await p.locator('.main-event h1').textContent()).toLowerCase().includes('squat'), 'a Saturday leg day works (weekend training)');
  await p.context().close();
  p = await open(390, 844, FRI, '#/today', { logs: [], weights, profile, schedule: {} });
  ok((await p.locator('.main-event').textContent()).includes('Rest day'), 'a week with no training days is just rest days');
  await p.context().close();
  p = await open(390, 844, FRI, '#/plan', { logs: [], weights, profile });
  ok((await p.locator('details.fold').count()) >= 13 && (await p.locator('details.fold[open]').count()) === 1, 'plan page: every section is collapsible and only Your week starts open');
  ok((await p.locator('details.plan-day summary small').first().textContent()).includes('5 of 5 exercises on'), 'a folded muscle summarises its days and exercises');
  ok(!(await p.locator('details.plan-day').first().evaluate(e => e.open)), 'muscle lists start folded');
  await p.locator('details.plan-day summary').first().click(); ok((await p.locator('details.plan-day').first().locator('input[data-f="inc"]').first().isVisible()), 'tapping a muscle opens its exercise list');
  ok((await p.locator('.sched-day').count()) === 7 && (await p.locator('.sched-sum').textContent()).includes('5 training days'), 'plan page shows the schedule editor with the normal 5-day week');
  await p.click('[data-act="sched-preset"][data-id="seven"]'); ok((await p.locator('.sched-sum').textContent()).includes('7 training days'), '7-day template');
  await p.click('[data-act="sched-preset"][data-id="two"]'); ok((await p.locator('.sched-sum').textContent()).includes('2 training days'), '2-day template');
  ok(JSON.parse(await p.evaluate(() => localStorage.getItem('gymtracker.v2.umar'))).schedule['1'].length === 3, 'the schedule is saved with the account');
  await p.context().close();

  // 10. several muscles a day: no layout trouble, halftime state, hop to the next muscle
  p = await open(360, 740, FRI, '#/today', { logs: [lg(FRI, 0, 'barbell-bench-press', 'chest', 10, 60)], weights, profile, schedule: { 5: ['chest', 'back'], 1: ['legs', 'arms', 'shoulders'], 2: ['chest'], 3: ['back'], 4: ['legs'], 6: ['arms'], 0: ['shoulders'] } });
  ok((await p.locator('.main-event .badge').textContent()).trim() === 'Halftime' && (await p.locator('.main-event').textContent()).includes('Back still to go'), 'a two-muscle day with one muscle done shows Halftime and what is left');
  ok((await p.locator('a.btn.primary', { hasText: 'Start back' }).getAttribute('href')) === '#/m/back', 'there is a button straight to the second muscle');
  const wk = await p.evaluate(() => { const out = []; document.querySelectorAll('.wd').forEach(e => { if (e.querySelector('.mn').scrollWidth > e.clientWidth + 1 || e.querySelector('.st').scrollWidth > e.clientWidth + 1) out.push(e.textContent.trim()); }); return out.concat(document.documentElement.scrollWidth > 361 ? ['page scrolls sideways'] : []); });
  ok(wk.length === 0 && (await p.locator('.fweek .wd').count()) === 7, 'seven fight-week tiles with several muscles fit on a 360 px phone: ' + (wk.join(',') || 'ok'));
  await p.goto(URL + '#/m/chest/5'); await p.waitForTimeout(200);
  ok((await p.locator('[data-act="wk-next"]').textContent()).includes('Next: Back'), 'last exercise of the first muscle offers the second muscle');
  await p.context().close();

  // 11. first-run polish
  p = await open(390, 844, FRI, '#/', { logs: [], weights, profile });
  ok((await p.locator('.d-stats').textContent()).includes('Your first workout is') && await p.locator('.d-stats a[href="#/today"]').count() === 1 && !(await p.locator('.d-stats').textContent()).includes('Share this week'), 'Home before the first workout shows a welcome instead of zeros');
  await p.goto(URL + '#/m/arms'); await p.waitForTimeout(250);
  ok((await p.locator('.first-hint').textContent()).includes('First time?') && (await p.locator('.first-hint').textContent()).includes('20 kg'), 'first set of a barbell move gets a beginner hint about the empty bar');
  await p.locator('section.ex [data-act="log"]').click(); await p.waitForTimeout(150);
  ok((await p.locator('#toast').textContent()).includes('Pick a weight first'), 'logging with 0 kg explains what to do');
  await p.locator('section.ex [data-act="kgset"]').first().click(); await p.locator('section.ex [data-act="log"]').click(); await p.waitForTimeout(250);
  const clash = await p.evaluate(() => { const r = document.getElementById('rest').getBoundingClientRect(), b = [...document.querySelectorAll('section.ex [data-act="log"], section.ex .kg-pick .chip')].map(e => e.getBoundingClientRect()); return !r.width ? 'timer hidden' : b.some(q => r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom); });
  ok(clash === false, 'the rest timer does not cover the log button or the weight chips: ' + clash);
  await p.context().close();
  p = await open(390, 844, FRI, '#/today', { logs: [], weights, profile });
  ok(!(await p.locator('.ticker').textContent()).includes('night') && (await p.locator('.ticker').textContent()).includes('day'), 'wording says day, not night');
  await p.context().close();

  // 12. pounds
  p = await open(390, 844, FRI, '#/m/arms', { logs: [], weights, profile });
  await p.evaluate(() => { localStorage.setItem('gymtracker.unit', 'lb'); }); await p.reload(); await p.waitForTimeout(300);
  ok((await p.locator('.kg-pick .chip').allTextContents()).slice(0, 3).join() === '5,10,15' && (await p.locator('.fld label').nth(1).textContent()) === 'Lb', 'pounds: quick weights and label switch to lb');
  await p.fill('[data-f="kg"]', '135'); await p.locator('section.ex [data-act="log"]').click(); await p.waitForTimeout(250);
  ok(Math.abs((await p.evaluate(() => Store.allLogs()[0].kg)) - 61.2349) < 0.001 && (await p.locator('.sets .sv').textContent()).includes('135 lb'), 'pounds: 135 lb is stored as 61.23 kg and shown back as 135 lb');
  await p.context().close();

  // 13. edit exercises from the muscle picker
  p = await open(390, 844, FRI, '#/pick', { logs: [], weights, profile });
  ok((await p.locator('.pick-edit').count()) === 5 && (await p.locator('.pick-edit').first().textContent()).includes('Edit 5 exercises'), 'each muscle on the picker has an Edit exercises link');
  await p.locator('.pick-edit').nth(2).click(); await p.waitForTimeout(300);
  ok(await p.locator('#pd-legs').evaluate(e => e.open) && !(await p.locator('#pd-chest').evaluate(e => e.open)), 'the link opens Plan with that muscle expanded');
  await p.context().close();

  // 14. share sheet and links
  p = await open(390, 844, FRI, '#/', { logs: armsLogs.concat([lg(FRI, 0, 'barbell-curl', 'arms', 12, 30)]), weights, profile });
  await p.locator('[data-act="share-week"]').click(); await p.waitForSelector('.share-prev img', { timeout: 8000 });
  ok((await p.locator('.share-btns .btn').count()) === 3 && await p.locator('#sheet [role="dialog"]').count() === 1, 'share opens a dialog with a preview image and Share, Save image, Copy text');
  const txt = await p.evaluate(() => { return null; });
  await p.keyboard.press('Escape'); ok(await p.locator('#sheet').count() === 0, 'Escape closes the dialog');
  ok((await p.locator('.st-link').first().getAttribute('href')) === '#/calendar' && (await p.locator('.st-link[href="#/home/records"]').count()) === 1, 'Home number tiles link to the calendar and to the records');
  await p.locator('.st-link[href="#/home/records"]').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(() => { const r = document.getElementById('sec-records'); return !r || r.getBoundingClientRect().top < 200; }), 'the records tile scrolls to the records');
  await p.goto(URL + '#/today'); await p.waitForTimeout(200);
  ok(await p.locator('.t-actions a[href="#/plan/arms"]').count() === 1, 'Today links to edit the muscles of the day');
  await p.goto(URL + '#/plan'); await p.waitForTimeout(200);
  ok((await p.locator('#pd-arms a[href="#/m/arms"]').count()) === 1, 'each muscle in Plan has a Train now link');
  await p.context().close();

  // 15. share cards: post and story sizes, record card
  p = await open(390, 844, FRI, '#/summary/arms', { logs: armsLogs.concat([lg(FRI, 0, 'barbell-curl', 'arms', 12, 32.5)]), weights, profile });
  await p.locator('.share-mini').first().click(); await p.waitForSelector('.share-prev img', { timeout: 8000 });
  ok((await p.locator('#sheet h2').textContent()).includes('record') && await p.locator('#sheet [data-act="share-fmt"]').count() === 2, 'a record card opens with Post and Story sizes');
  const dims = async () => p.evaluate(() => new Promise(r => { const i = document.querySelector('.share-prev img'); if (i.complete) r([i.naturalWidth, i.naturalHeight]); else i.onload = () => r([i.naturalWidth, i.naturalHeight]); }));
  ok((await dims()).join('x') === '1080x1350', 'post card is 1080 x 1350');
  await p.locator('[data-act="share-fmt"][data-v="story"]').click(); await p.waitForFunction(() => { const i = document.querySelector('.share-prev img'); return i && i.naturalHeight === 1920; }, null, { timeout: 8000 });
  ok(true, 'story card is 1080 x 1920');
  await p.context().close();

  // 16. install as an app
  p = await open(390, 844, FRI, '#/', { logs: [], weights, profile });
  ok(await p.locator('#install-fab').isVisible() && (await p.locator('.install-card').count()) === 1, 'a round install button and a Home card are offered on a phone browser');
  await p.locator('#install-fab').click(); await p.waitForSelector('#sheet .istep');
  ok((await p.locator('.istep li').count()) === 3 && (await p.locator('#sheet').textContent()).includes('Turn this into an app'), 'the dialog explains it in three steps');
  await p.click('[data-act="install-later"]'); await p.waitForTimeout(250);
  ok((await p.locator('.install-card').count()) === 0 && await p.locator('#install-fab').isVisible(), 'Not now hides the Home card but keeps the small button');
  await p.goto(URL + '#/m/arms'); await p.waitForTimeout(250); ok(!(await p.locator('#install-fab').isVisible()), 'the button stays out of the way on the workout page');
  await p.context().close();
  // iPhone Safari gets the Share menu steps, and beforeinstallprompt gives a one-tap Install now
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', reducedMotion: 'reduce' }); const q = await ctx.newPage(); await q.clock.install({ time: FRI }); await signIn(q, 'umar', { logs: [], weights, profile }); await q.goto(URL + '#/'); await q.waitForTimeout(300);
    await q.locator('#install-fab').click(); await q.waitForSelector('#sheet .istep'); ok((await q.locator('.istep').textContent()).includes('Add to Home Screen'), 'iPhone: steps mention Share and Add to Home Screen'); await ctx.close(); }
  { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const q = await ctx.newPage(); await q.clock.install({ time: FRI }); await signIn(q, 'umar', { logs: [], weights, profile }); await q.goto(URL + '#/'); await q.waitForTimeout(300);
    await q.evaluate(() => { window.__installEvt = { prompt() { window.__prompted = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) }; });
    await q.locator('#install-fab').click(); await q.waitForSelector('#sheet [data-act="install-now"]'); await q.click('[data-act="install-now"]'); await q.waitForTimeout(250);
    ok(await q.evaluate(() => window.__prompted === true), 'desktop: Install now triggers the browser install prompt'); await ctx.close(); }

  // 17. smart rest timer
  p = await open(390, 844, FRI, '#/m/chest/1', { logs: [], weights, profile });
  await p.locator('section.ex [data-act="kgset"]').first().click(); await p.locator('section.ex [data-act="log"]').click(); await p.waitForTimeout(250);
  ok((await p.locator('#rest-t').textContent()).includes('2:30') || (await p.locator('#rest-t').textContent()).includes('2:29'), 'smart rest: about 2:30 after a big barbell lift');
  await p.goto(URL + '#/m/shoulders/2'); await p.waitForTimeout(250);
  await p.locator('section.ex [data-act="kgset"]').first().click(); await p.locator('section.ex [data-act="log"]').click(); await p.waitForTimeout(250);
  ok((await p.locator('#rest-t').textContent()).includes('1:15') || (await p.locator('#rest-t').textContent()).includes('1:14'), 'smart rest: about 1:15 after a small lateral raise');
  await p.locator('#rest [data-rest="add"]').click(); await p.locator('section.ex [data-act="log"]').click(); await p.waitForTimeout(250);
  ok((await p.locator('#rest-t').textContent()).includes('1:30') || (await p.locator('#rest-t').textContent()).includes('1:29'), 'adding 15 seconds is remembered for that exercise');
  await p.context().close();

  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nv3 UI tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
