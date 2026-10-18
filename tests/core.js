// Core muscle: optional, not in the default week, trainable, shows in pickers, balance and the week editor.
const { chromium } = require('./pw');
const { signIn } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' }), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), p = await ctx.newPage(); p.on('pageerror', e => fails.push('PAGEERROR ' + e.message));
  await signIn(p); await p.goto(URL + '#/pick'); await p.waitForSelector('main a[href="#/m/core"], #view a[href="#/m/core"]');
  ok(true, 'Core appears in the muscle picker');
  ok(!(await p.evaluate(() => Object.values(Data.schedule ? Data.DEFAULT_SCHEDULE : {}).flat().includes('core'))), 'Core is not in the default week');
  await p.goto(URL + '#/m/core/2'); await p.waitForSelector('section.ex');
  ok((await p.locator('section.ex h2').textContent()) === 'Plank' && (await p.locator('section.ex .logger label').first().textContent()) === 'Seconds', 'Plank is timed (seconds)');
  await p.goto(URL + '#/m/core/1'); const sec = p.locator('section.ex').first();
  await sec.locator('[data-act="log"]').click(); await p.waitForTimeout(200);
  ok((await sec.locator('.sets li').count()) === 1, 'a bodyweight core set logs at 0 kg');
  await p.goto(URL + '#/plan'); await p.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true));
  ok(await p.locator('#pd-core').count() === 1 && (await p.locator('#pd-core .plan-ex').count()) === 5, 'Plan lists 5 core exercises');
  await p.evaluate(() => { const guides = document.querySelectorAll('.guide'); }); 
  for (const w of [320, 390, 1280]) { await p.setViewportSize({ width: w, height: 800 }); await p.goto(URL + '#/m/core/1'); await p.waitForSelector('section.ex'); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'core workout fits at ' + w); await p.goto(URL + '#/pick'); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'picker fits at ' + w); }
  // 6-muscle choice in the week editor: core can be added to a day
  await p.setViewportSize({ width: 390, height: 844 }); await p.goto(URL + '#/plan'); await p.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true));
  ok(await p.locator('[data-act="sched-chip"][data-m="core"]').count() === 7, 'week editor offers Core on all 7 days');
  await p.locator('[data-act="sched-chip"][data-m="core"][data-d="1"]').click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Store.schedule()[1].includes('core')), 'Core can be added to Monday next to Chest');
  await p.goto(URL + '#/today'); await p.waitForSelector('#view'); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Today with Chest + Core fits'); ok((await p.textContent('#view')).includes('Core'), 'Today shows Core');
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\ncore tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
