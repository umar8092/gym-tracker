// End-to-end flow: log sets, remove one, open shoulder form guides (3D), switch days, calendar + progress with data.
const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const OUT = '/tmp/gt-shots', URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errs = []; await require('./helpers').signIn(page);
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  const assert = (c, msg) => { if (!c) errs.push('ASSERT FAILED: ' + msg); };
  await page.clock.install({ time: new Date('2026-10-15T09:00:00') });
  await page.goto(URL + '#/m/shoulders');
  const sec = page.locator('section.ex').first();
  // log 3 sets with the stepper, a quick chip, and the menu
  await sec.locator('[data-act="kgset"][data-v="7.5"]').first().click();
  await sec.locator('[data-act="kg+"]').click(); await sec.locator('[data-act="kg+"]').click(); // 8.5
  assert(await sec.locator('[data-f="kg"]').inputValue() === '8.5', 'kg stepper adds 0.5 each press');
  await sec.locator('[data-act="rep+"]').click(); // reps 11
  await sec.locator('[data-act="log"]').click();
  await sec.locator('[data-act="log"]').click();
  await sec.locator('[data-act="menu"]').click();
  await sec.locator('.lb-menu li[data-v="15"]').click();
  assert(await sec.locator('[data-f="kg"]').inputValue() === '15', 'menu picks 15');
  await sec.locator('[data-act="log"]').click();
  assert(await sec.locator('.sets li').count() === 3, 'three sets listed');
  await sec.locator('[data-act="rm"]').first().click();
  assert(await sec.locator('.sets li').count() === 2, 'remove works');
  // kg=0 on a non-bodyweight exercise must be refused
  const sec2 = page.locator('section.ex').nth(1);
  await sec2.locator('[data-act="log"]').click();
  assert(await sec2.locator('.sets li').count() === 0, 'zero kg refused for dumbbell move');
  await page.screenshot({ path: OUT + '/flow-logged.png', fullPage: false });
  // persistence
  await page.reload();
  assert(await page.locator('section.ex').first().locator('.sets li').count() === 2, 'sets survive reload');
  // open each form guide and take figure shots
  const n = await page.locator('details.guide:not(.hist)').count();
  for (let i = 0; i < n; i++) {
    const d = page.locator('details.guide:not(.hist)').nth(i);
    await d.locator('summary').click(); await page.waitForTimeout(700);
    await d.scrollIntoViewIfNeeded();
    await d.locator('.fig').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await d.screenshot({ path: `${OUT}/fig-${i}.png` });
    await d.locator('summary').click();
  }
  // calendar + progress after logging
  await page.goto(URL + '#/calendar'); await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/flow-cal.png', fullPage: true });
  await page.goto(URL + '#/progress'); await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/flow-progress.png', fullPage: true });
  await page.goto(URL + '#/'); await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/flow-today-done.png', fullPage: true });
  console.log(errs.length ? 'ISSUES:\n' + errs.join('\n') : 'flow OK');
  await b.close();
})();
