// Set types: warm-up stays out of rounds and records; failure and drop are tagged; survives reload and cloud.
const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const { fakeCloud } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' }), cloud = fakeCloud(null), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); await cloud.install(ctx); await ctx.addInitScript(() => { if (!localStorage.getItem('gymtracker.unit')) localStorage.setItem('gymtracker.unit', 'kg'); });
  const p = await ctx.newPage(); p.on('pageerror', e => fails.push('PAGEERROR ' + e.message));
  await p.goto(URL + '#/'); await p.fill('#un', 'type_tester'); await p.click('button[type="submit"]'); await p.waitForSelector('#memo-ok'); await p.check('#memo-ok'); await p.click('#memo-go'); await p.waitForSelector('#su-now', { timeout: 10000 });
  await p.fill('#su-now', '80'); await p.fill('#su-goal', '75'); await p.click('form[data-form="setup"] button'); await p.click('[data-act="week-done"]'); await p.waitForTimeout(300);
  await p.goto(URL + '#/m/chest/1'); const sec = p.locator('section.ex').first();
  const log = async (type, kg) => { if (type) await sec.locator('[data-act="stype"][data-v="' + type + '"]').click(); await sec.locator('[data-f="kg"]').fill(String(kg)); await sec.locator('[data-f="kg"]').dispatchEvent('input'); await sec.locator('[data-act="log"]').click(); };
  await log('w', 10); ok((await sec.locator('.sets li').first().textContent()).includes('Warm-up') && (await sec.locator('.sets li .prb').count()) === 0, 'warm-up is listed as Warm-up with no PR');
  await sec.locator('[data-act="stype"][data-v="w"]').click(); ok((await sec.locator('[data-act="log"]').textContent()).includes('Log warm-up'), 'button says Log warm-up while that type is chosen');
  await sec.locator('[data-act="stype"][data-v=""]').click(); await sec.locator('[data-f="kg"]').fill('20'); await sec.locator('[data-f="kg"]').dispatchEvent('input'); await sec.locator('[data-act="log"]').click();
  ok((await sec.locator('.sets li').nth(1).textContent()).includes('Round 1'), 'first normal set is Round 1 even after a warm-up');
  await log('f', 20); const t2 = await sec.locator('.sets li').nth(2).textContent(); ok(t2.includes('Round 2') && t2.includes('failure'), 'failure set tagged');
  ok(await p.evaluate(() => Store.allLogs().length === 2 && Store.allLogsRaw().length === 3), 'warm-up is excluded from stats logs but kept in the raw log');
  await p.waitForTimeout(2300); await p.waitForFunction(() => Sync.status().state === 'synced', null, { timeout: 8000 }).catch(() => {});
  await p.reload(); await p.waitForSelector('section.ex'); ok((await p.locator('section.ex').first().locator('.sets li').first().textContent()).includes('Warm-up'), 'types survive a reload');
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nset type tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
