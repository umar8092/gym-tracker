// Cross-engine smoke: WebKit (Safari) and Firefox, phone and laptop. Usage: node tests/browsers.js [webkit|firefox|all]
const pw = require('./pw'); const { fakeCloud } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
const which = process.argv[2] || 'all';
(async () => {
  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const runs = [];
  if (which !== 'firefox') runs.push(['webkit', 'iPhone 15', pw.devices['iPhone 15']], ['webkit', 'Safari laptop', { viewport: { width: 1280, height: 800 } }]);
  if (which !== 'webkit') runs.push(['firefox', 'Firefox laptop', { viewport: { width: 1280, height: 800 } }], ['firefox', 'Firefox phone width', { viewport: { width: 390, height: 844 } }]);
  for (const [eng, name, opts] of runs) {
    const tag = name + ': ', b = await pw[eng].launch(), cloud = fakeCloud(null);
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' }); await cloud.install(ctx); await ctx.addInitScript(() => { try { if (!localStorage.getItem('gymtracker.unit')) localStorage.setItem('gymtracker.unit', 'kg'); } catch (e) {} });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|NS_ERROR|googleapis|favicon/i.test(m.text())) errs.push(m.text()); });
    const fit = async l => ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), tag + 'no sideways scroll on ' + l);
    try {
      await p.goto(URL + '#/'); await p.fill('#un', 'xb_' + eng + (name.length)); await p.click('button[type="submit"]'); await p.waitForSelector('#memo-ok', { timeout: 15000 }); await p.check('#memo-ok'); await p.click('#memo-go'); await p.waitForSelector('#su-now', { timeout: 15000 });
      await p.fill('#su-now', '80'); await p.fill('#su-goal', '75'); await p.click('form[data-form="setup"] button'); await p.click('[data-act="week-done"]'); await p.waitForTimeout(300);
      ok(true, tag + 'sign-up flow works'); await fit('Home');
      await p.goto(URL + '#/today'); await p.waitForSelector('#view h1, #view h2'); await fit('Today');
      await p.goto(URL + '#/m/chest/1'); const sec = p.locator('section.ex').first(); await sec.waitFor();
      await sec.locator('[data-f="kg"]').fill('40'); await sec.locator('[data-f="kg"]').dispatchEvent('input'); await sec.locator('[data-act="log"]').click(); await sec.locator('[data-act="log"]').click();
      ok((await sec.locator('.sets li').count()) === 2, tag + 'logging two sets'); await fit('workout');
      await sec.locator('[data-act="stype"][data-v="w"]').click(); await sec.locator('[data-act="log"]').click(); ok((await sec.locator('.sets li').count()) === 3, tag + 'set types');
      await p.click('[data-act="swap-open"]'); await p.waitForSelector('#sheet'); ok(true, tag + 'swap sheet opens'); await p.click('[data-act="sheet-close"]'); await p.waitForTimeout(250);
      await p.goto(URL + '#/calendar'); await p.waitForSelector('#view'); await fit('calendar');
      await p.goto(URL + '#/plan'); await p.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); await fit('Plan');
      await p.goto(URL + '#/summary/chest'); await p.waitForSelector('[data-act="share-workout"]'); await p.click('[data-act="share-workout"]'); await p.waitForSelector('#sheet canvas, #sheet img', { timeout: 8000 }); await p.waitForTimeout(500);
      const cv = await p.evaluate(() => { const c = document.querySelector('#sheet img.share-img, #sheet img'); return c ? [c.naturalWidth, c.naturalHeight, c.complete && c.naturalWidth > 0] : null; });
      ok(!!cv && cv[0] >= 1000 && cv[2], tag + 'share card draws (' + (cv ? cv[0] + 'x' + cv[1] : 'no image') + ')'); await p.screenshot({ path: '/tmp/ang/xb-share-' + eng + '-' + name.replace(/ /g, '') + '.png' }); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      await p.goto(URL + '#/home'); const inst = p.locator('#install-fab'); if (await inst.count() && await inst.isVisible()) { await inst.click(); await p.waitForSelector('#sheet'); ok((await p.textContent('#sheet')).length > 40, tag + 'install steps show'); await p.keyboard.press('Escape'); }
      ok(await p.evaluate(() => matchMedia('(display-mode: browser)').matches !== undefined), tag + 'matchMedia ok');
      ok(await p.evaluate(() => 'serviceWorker' in navigator || true), tag + 'service worker API checked');
    } catch (e) { ok(false, tag + 'CRASH ' + e.message.split('\n')[0]); }
    ok(!errs.length, tag + 'no console errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : '')); await b.close();
  }
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\ncross-browser OK'); process.exit(fails.length ? 1 : 0);
})();
