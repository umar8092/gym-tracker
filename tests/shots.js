// Usage: node tests/shots.js  (needs `python3 -m http.server 8765` in the project root)
// Renders every screen at phone + desktop, light + dark, for a fixed weekday, and reports console errors / horizontal overflow.
const { chromium } = require(process.env.PW_CORE || '/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const OUT = process.env.OUT || '/tmp/gt-shots';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const sizes = [[390, 844, 'phone'], [1280, 900, 'desk']];
  for (const [w, h, tag] of sizes) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 2 });
      const page = await ctx.newPage(); await require('./helpers').signIn(page);
      page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED/.test(m.text())) errors.push(tag + ' ' + m.text()); });
      page.on('pageerror', e => errors.push(tag + ' PAGEERROR ' + e.message));
      await page.clock.install({ time: new Date('2026-10-15T09:00:00') }); // a Thursday = shoulders
      await page.goto('http://localhost:8765/index.html');
      for (const r of ['', 'pick', 'm/shoulders', 'm/chest', 'calendar', 'progress', 'plan']) {
        await page.goto('http://localhost:8765/index.html#/' + r);
        await page.waitForTimeout(250);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 0) errors.push(`${tag}/${scheme} #/${r} horizontal overflow ${over}px`);
        await page.screenshot({ path: `${OUT}/${tag}-${scheme}-${r.replace('/', '_') || 'today'}.png`, fullPage: true });
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(errors.length ? 'ISSUES:\n' + errors.join('\n') : 'no console errors, no overflow');
})();
