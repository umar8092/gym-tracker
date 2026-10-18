// Renders one transparent-able portrait per built-in exercise from the real 3D figure (End pose) into /tmp/ang/raw. Post-process with tests/gen-thumbs.py.
const { chromium } = require('./pw');
const { signIn } = require('./helpers');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 700, height: 1000 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await signIn(p, 'umar', { logs: [], weights: [], profile: { startKg: 92, goalKg: 75, startDate: '2026-01-01' } });
  await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(500);
  const list = await p.evaluate(() => Data.EX.filter(e => !e.custom).map(e => [e.id, e.muscle]));
  for (const [id, m] of list) {
    await p.goto('http://localhost:8765/index.html#/m/' + m); await p.waitForTimeout(400);
    const sec = p.locator('section.ex[data-ex="' + id + '"]');
    await sec.locator('details.guide:not(.hist) summary').click(); await p.waitForTimeout(2600);
    await sec.locator('.seg button').nth(1).click(); await p.waitForTimeout(1200);
    await sec.locator('.fig canvas').first().screenshot({ path: '/tmp/ang/raw/' + id + '.png', omitBackground: true });
    console.log('ok', id);
  }
  await b.close();
})();
