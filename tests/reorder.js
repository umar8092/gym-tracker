// Move earlier/later and swap an exercise during a workout; order persists and syncs.
const { chromium } = require('./pw');
const { signIn } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' }), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), p = await ctx.newPage(); p.on('pageerror', e => fails.push('PAGEERROR ' + e.message));
  await signIn(p); await p.goto(URL + '#/m/chest/1'); await p.waitForSelector('section.ex');
  const name = () => p.locator('section.ex h2').first().textContent();
  const n0 = await name(); const names = () => p.evaluate(() => [...document.querySelectorAll('.rail .ri')].map(a => a.textContent));
  ok(await p.locator('[data-act="mv-up"]').isDisabled(), 'first exercise cannot move earlier');
  await p.click('[data-act="mv-down"]'); await p.waitForTimeout(300);
  ok(p.url().endsWith('#/m/chest/2') && (await name()) === n0, 'moving later keeps the same exercise, now 2nd');
  await p.reload(); await p.waitForSelector('section.ex'); ok((await name()) === n0, 'order survives reload');
  await p.click('[data-act="mv-up"]'); await p.waitForTimeout(300); ok(p.url().endsWith('#/m/chest/1'), 'moving earlier puts it back first');
  await p.click('[data-act="swap-open"]'); await p.waitForSelector('.swap-list');
  const first = await p.locator('.swap-list button b').first().textContent(); await p.locator('.swap-list button').first().click(); await p.waitForTimeout(400);
  ok((await name()) === first && p.url().endsWith('#/m/chest/1'), 'swap puts the chosen exercise in the same slot: ' + first);
  ok((await p.evaluate(n => [...document.querySelectorAll('.rail .ri')].some(a => a.textContent.includes(n)), n0)), 'the swapped-out exercise stays in the list (trade places)');
  for (const w of [320, 390, 1280]) { await p.setViewportSize({ width: w, height: 800 }); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at ' + w); }
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nreorder tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
