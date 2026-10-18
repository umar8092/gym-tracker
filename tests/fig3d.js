// Opens the form guide of every 3D exercise on a page and checks the figure renders (no errors, canvas not blank). Screenshots to /tmp/gt-shots.
const { chromium } = require('./pw');
const { signIn } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html', OUT = '/tmp/gt-shots', muscle = process.argv[2] || 'shoulders', views = (process.argv[3] || 'default,Side,Back,Top').split(',');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), fails = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  await signIn(page); page.on('pageerror', e => fails.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|GL Driver/.test(m.text())) fails.push('console ' + m.text().slice(0, 200)); });
  await page.goto(URL + '#/m/' + muscle); await page.waitForTimeout(500);
  const n = await page.locator('details.guide:not(.hist)').count();
  for (let i = 0; i < n; i++) {
    const d = page.locator('details.guide:not(.hist)').nth(i); await d.locator('summary').click();
    const fig = d.locator('.fig'); if (!(await fig.count())) { await d.locator('summary').click(); continue; }
    await page.waitForFunction(el => el && el.__st && el.__st.ready, await fig.elementHandle(), { timeout: 60000 }).catch(() => fails.push('figure not ready: ' + i));
    await fig.locator('.seg button').nth(0).click(); // Start still
    for (const v of views) {
      if (v !== 'default') await fig.locator('.views button', { hasText: v }).click();
      await page.waitForTimeout(900);
      await fig.locator('canvas').screenshot({ path: `${OUT}/f3d-${muscle}-${i}-${v}-start.png` });
    }
    await fig.locator('.seg button').nth(1).click(); await page.waitForTimeout(300);
    await fig.locator('.views button', { hasText: 'Front' }).click(); await page.waitForTimeout(900);
    await fig.locator('canvas').screenshot({ path: `${OUT}/f3d-${muscle}-${i}-front-end.png` });
    await d.locator('summary').click();
  }
  console.log(fails.length ? 'ISSUES:\n' + fails.join('\n') : '3D figures OK'); await b.close();
})();
