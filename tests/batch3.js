// Batch 3: weight trend + goal date, muscle balance, made-up missed days, custom exercises.
const { chromium } = require('./pw');
const { signIn } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', e => fails.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) fails.push('console ' + m.text()); });
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
  let id = 0; const lg = (n, e, m) => ({ id: 's' + ++id, d: day(n), m, e, reps: 10, kg: 20, ts: Date.now() - n * 864e5 + id, u: 1, dirty: false });
  const w = [21, 14, 7, 0].map((n, i) => ({ d: day(n), kg: 92 - i * 0.5, u: 1, dirty: false }));
  await signIn(page, 'umar', { logs: [lg(0, 'barbell-bench-press', 'chest'), lg(0, 'barbell-bench-press', 'chest')], weights: w, profile: { startKg: 92, goalKg: 75, startDate: day(40) } });
  await page.goto(URL + '#/progress'); await page.waitForTimeout(300);
  const tr = await page.locator('.trend').first().textContent();
  ok(/0\.5 kg a week down/.test(tr) && /(reach 75 kg|Goal) around/.test(tr), 'weight trend shows pace and goal date: ' + tr);
  ok((await page.locator('.bal li').count()) === 6 && (await page.locator('.bal li').first().locator('b').textContent()) === '2', 'muscle balance lists 6 muscles, chest has 2 sets');
  // custom exercise
  await page.goto(URL + '#/plan'); await page.evaluate(() => { document.querySelectorAll('details.fold').forEach(d => { d.open = true; }); });
  await page.fill('#cx-n', 'Cable crossover'); await page.selectOption('#cx-m', 'chest'); await page.selectOption('#cx-e', 'Machine');
  await page.locator('form[data-form="custom"] button[type="submit"]').click(); await page.waitForTimeout(300);
  await page.goto(URL + '#/m/chest/6'); await page.waitForTimeout(300);
  const ex = page.locator('section.ex', { hasText: 'Cable crossover' });
  ok(await ex.count() === 1, 'custom exercise appears under its muscle');
  await ex.locator('[data-f="kg"]').fill('20'); await ex.locator('[data-f="reps"]').fill('10'); await ex.locator('[data-act="log"]').click(); ok(await ex.locator('.sets li').count() === 1, 'a set can be logged on it');
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('gymtracker.v2.umar'))).settings.dirty === true, 'custom exercise marks settings for sync');
  await ex.locator('details.guide:not(.hist) summary').click();
  page.once('dialog', d => d.accept()); await ex.locator('[data-act="del-custom"]').click(); await page.waitForTimeout(300);
  ok(await page.locator('section.ex', { hasText: 'Cable crossover' }).count() === 0, 'custom exercise can be deleted');
  // warm-up ramp and editing a past set (bench seeded today only, so use the history of push-up logged on a past Wednesday above)
  await page.goto(URL + '#/m/chest'); await page.waitForTimeout(300);
  const bs = page.locator('section.ex').first(); await bs.locator('[data-f="kg"]').fill('60'); await bs.locator('[data-act="warm"]').click();
  ok((await bs.locator('.warmup').textContent()).includes('8 × 30 kg, 5 × 42.5 kg, 3 × 50 kg'), 'warm-up ramp shows for 60 kg');
  // rotating quote card: one at a time, tap shows another
  await page.goto(URL + '#/today'); await page.waitForTimeout(400);
  const q1 = await page.locator('.d-quote .quote').textContent(); await page.locator('.d-quote').click(); await page.waitForTimeout(500);
  const q2 = await page.locator('.d-quote .quote').textContent();
  ok(await page.locator('.d-quote').count() === 1 && q1 !== q2, 'one quote card, tap shows a different quote: ' + q2);
  const kinds = await page.evaluate(() => { // a Monday 3 weeks ago: missed alone, made up once chest is trained on Wednesday
    let d = new Date(); d.setDate(d.getDate() - 21); while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
    const mon = Store.ymd(d), wed = Store.addDays(mon, 2), a = Store.dayInfo(mon).kind;
    Store.addSet(wed, 'chest', 'push-up', 10, 0); return [a, Store.dayInfo(mon).kind];
  });
  ok(kinds[0] === 'missed' && kinds[1] === 'madeup', 'missed day becomes made up when trained later that week: ' + kinds);
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nbatch3 tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
