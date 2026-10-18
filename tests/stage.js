// Laptop body stage on the muscle picker: loads, follows the pointer, hidden on phones and tablets.
const pw = require('./pw'); const { signIn } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); p.on('pageerror', e => fails.push('PAGEERROR ' + e.message));
  await signIn(p); await p.goto(URL + '#/pick'); await p.waitForFunction(() => document.getElementById('stage-cv') && document.getElementById('stage-cv').dataset.focus, null, { timeout: 60000 });
  ok(true, 'stage loads on a laptop');
  const foc = () => p.evaluate(() => document.getElementById('stage-cv').dataset.focus);
  await p.hover('.pick-list a[href="#/m/back"]'); ok((await foc()) === 'back' && (await p.textContent('#stage-cap')) === 'Back', 'pointing at Back turns the body to the back');
  await p.waitForTimeout(1800); await p.screenshot({ path: '/tmp/ang/stage-back.png' });
  await p.hover('.pick-list a[href="#/m/chest"]'); await p.waitForTimeout(1800); ok((await foc()) === 'chest', 'pointing at Chest zooms to the chest'); await p.screenshot({ path: '/tmp/ang/stage-chest.png' });
  ok(await p.evaluate(() => { const c = document.getElementById('stage-cv'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < x.length; i += 4000) { if (x[i] > 0) n++; } return n > 20; }), 'the body is actually drawn');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 1280');
  await p.hover('h1'); await p.waitForTimeout(300); ok(['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'].includes(await foc()), 'moving away returns to today\'s muscle');
  await p.setViewportSize({ width: 800, height: 900 }); await p.waitForTimeout(300); ok(!(await p.locator('.stage').isVisible()), 'hidden on tablets and phones');
  const q = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await signIn(q); await q.goto(URL + '#/pick'); await q.waitForSelector('.pick-list'); await q.waitForTimeout(800);
  ok(!(await q.locator('.stage').isVisible()) && (await q.evaluate(() => !window.Engine3D)), 'phone: no stage and the 3D engine is not even downloaded');
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nstage tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
