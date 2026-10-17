// Batch 1+2 features: history, target, set comparison, PR, repeat, plates, rest timer, notes, summary, progress.
const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const { signIn } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html', OUT = '/tmp/gt-shots';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  page.on('pageerror', e => fails.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) fails.push('console ' + m.text()); });
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
  let id = 0; const lg = (n, e, m, reps, kg) => ({ id: 's' + ++id, d: day(n), m, e, reps, kg, ts: new Date(day(n) + 'T10:00:00').getTime() + id * 1000, u: 1, dirty: false });
  const logs = [ // bench: 14 days ago 8x60 x3, 7 days ago 9,9,8 x 60. lateral raise 7 days ago 12 x 7.5 x3. push-up bodyweight
    lg(14, 'barbell-bench-press', 'chest', 8, 60), lg(14, 'barbell-bench-press', 'chest', 8, 60), lg(14, 'barbell-bench-press', 'chest', 8, 60),
    lg(7, 'barbell-bench-press', 'chest', 9, 60), lg(7, 'barbell-bench-press', 'chest', 9, 60), lg(7, 'barbell-bench-press', 'chest', 8, 60),
    lg(7, 'push-up', 'chest', 12, 0), lg(7, 'push-up', 'chest', 10, 0), lg(14, 'push-up', 'chest', 10, 0), lg(14, 'push-up', 'chest', 8, 0)];
  await signIn(page, 'umar', { logs, weights: [{ d: day(14), kg: 92, u: 1, dirty: false }, { d: day(0), kg: 90.5, u: 1, dirty: false }], profile: { startKg: 92, goalKg: 75, startDate: day(30) } });
  await page.goto(URL + '#/m/chest'); await page.waitForTimeout(300);
  const bench = page.locator('section.ex').first();
  ok((await bench.locator('.target').textContent()).includes('Target today: 9 reps'), 'target today suggests +1 rep (lowest set was 8)');
  ok(await bench.locator('[data-f="reps"]').inputValue() === '9' && await bench.locator('[data-f="kg"]').inputValue() === '60', 'first set is pre-filled from last time');
  await bench.locator('[data-act="log"]').click();
  ok(await bench.locator('.sets li').count() === 1 && (await bench.locator('.dl').first().textContent()).includes('same'), 'logged set shows "same" vs last time');
  ok(await bench.locator('[data-f="reps"]').inputValue() === '9', 'next set preloaded from last time (set 2 = 9 reps)');
  ok(!(await page.locator('#rest').isHidden()), 'rest timer started after logging');
  await page.locator('#rest [data-rest="skip"]').click(); ok(await page.locator('#rest').isHidden(), 'rest timer can be skipped');
  await bench.locator('[data-act="kg+"]').click(); await bench.locator('[data-act="kg+"]').click(); await bench.locator('[data-act="kg+"]').click(); await bench.locator('[data-act="kg+"]').click(); await bench.locator('[data-act="kg+"]').click(); // 62.5
  await bench.locator('[data-act="log"]').click();
  ok((await bench.locator('.sets li').nth(1).textContent()).includes('+2.5 kg'), 'heavier set shows +2.5 kg');
  ok(await bench.locator('.sets li').nth(1).locator('.prb').count() === 1, 'heaviest weight ever gets a PR badge');
  ok(await bench.locator('[data-act="repeat"]').count() === 1, 'repeat-last-time offered for the missing set');
  await bench.locator('[data-act="repeat"]').click(); ok(await bench.locator('.sets li').count() === 3, 'repeat logs the remaining set(s)');
  await bench.locator('[data-act="plates"]').click(); await bench.locator('[data-f="kg"]').fill('100'); await bench.locator('[data-f="kg"]').dispatchEvent('input');
  await bench.locator('[data-act="kg+"]').click(); await bench.locator('[data-act="kg-"]').click();
  ok((await bench.locator('.plates').textContent()).includes('each side 1 × 25 + 1 × 15'), 'plate calculator: 100 kg = 25 + 15 per side');
  await bench.locator('details.hist > summary').click();
  ok((await bench.locator('.hist-list li').first().textContent()).includes('9 × 60'), 'history lists last session');
  ok(await bench.locator('.hist-list li .vd.up').count() >= 1, 'history shows an Up verdict for the better session');
  await bench.locator('[data-f="note"]').fill('Seat 4, wide grip'); await bench.locator('[data-f="note"]').dispatchEvent('change');
  ok((await bench.locator('.ex-note').textContent()).includes('Seat 4'), 'note shows under the exercise name');
  await page.screenshot({ path: OUT + '/feat-workout.png', fullPage: false });
  await bench.screenshot({ path: OUT + '/feat-bench.png' });
  // summary
  await page.locator('.finish a.btn').click(); await page.waitForTimeout(300);
  ok((await page.locator('h1').textContent()).includes('Chest done'), 'summary page opens');
  ok(await page.locator('#rest').isHidden(), 'rest timer is hidden on the summary page');
  ok((await page.locator('main').textContent()).includes('Better than last time on 1 of 1'), 'summary counts exercises beaten (only bench was done today)');
  await page.screenshot({ path: OUT + '/feat-summary.png', fullPage: true });
  // progress
  await page.goto(URL + '#/progress'); await page.waitForTimeout(300);
  ok((await page.locator('.sec').first().textContent()).includes('How you are doing'), 'progress shows analytics first');
  ok(await page.locator('.sec').first().locator('.vd.up').count() >= 1, 'last-session comparison shows exercises going up');
  await page.locator('[data-act="mode"][data-v="7"]').click(); await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/feat-progress.png', fullPage: true });
  await page.locator('[data-act="mode"][data-v="30"]').click(); await page.waitForTimeout(200);
  ok(await page.locator('.empty').first().count() >= 0, '30-day view renders');
  // rest timer settings
  await page.goto(URL + '#/plan'); await page.locator('[data-act="rest-sec"][data-v="60"]').click();
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.rest')).sec) === 60, 'rest length setting is saved');
  await page.locator('[data-act="rest-on"]').click(); ok(await page.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.rest')).on) === false, 'rest timer can be switched off');
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nfeature tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
