// Multi-device, multi-user sync test against an in-memory fake Firestore (no real cloud, no real data).
const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const { fakeCloud } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), cloud = fakeCloud(null), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  async function device() {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await cloud.install(ctx);
    const p = await ctx.newPage(); p.on('pageerror', e => fails.push('PAGEERROR ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|403|404|net::ERR/.test(m.text())) fails.push('console ' + m.text()); });
    return { ctx, p };
  }
  const login = async (p, name) => {
    await p.goto(URL + '#/'); await p.fill('#un', name); await p.click('form[data-form="login"] button[type="submit"]');
    try { await p.waitForSelector('#memo-ok', { timeout: 1500 }); await p.check('#memo-ok'); await p.click('#memo-go'); } catch (e) { /* a name already on this device skips the remember step */ }
    await p.waitForTimeout(700);
  };
  const synced = p => p.waitForFunction(() => Sync.status().state === 'synced', null, { timeout: 8000 }).catch(() => {});
  const setsToday = p => p.evaluate(() => Store.allLogs().length);
  const logSet = async (p, kg) => { await p.goto(URL + '#/m/shoulders'); const s = p.locator('section.ex').first(); await s.locator(`[data-act="kgset"][data-v="${kg}"]`).first().click(); await s.locator('[data-act="log"]').click(); };

  // A: brand new device, new user -> setup screen
  const A = await device(); await login(A.p, 'umar');
  ok(await A.p.locator('form[data-form="setup"]').count() === 1, 'new user sees the setup screen');
  await A.p.fill('#su-now', '92'); await A.p.fill('#su-goal', '75'); await A.p.click('form[data-form="setup"] button'); await A.p.click('[data-act="week-done"]'); await A.p.waitForTimeout(300);
  await logSet(A.p, 10); await A.p.waitForTimeout(2200); await synced(A.p);
  ok([...cloud.docs.keys()].some(k => k.startsWith('/users/umar/logs/')), 'set reached the cloud under users/umar');
  ok(cloud.docs.has('/users/umar/meta/settings'), 'profile/settings reached the cloud');

  // B: second device, same user -> gets profile + set without setup
  const B = await device(); await login(B.p, 'umar'); await synced(B.p);
  ok(await B.p.locator('form[data-form="setup"]').count() === 0, 'second device skips setup (profile pulled)');
  ok(await setsToday(B.p) === 1, 'second device pulled the set');
  await logSet(B.p, 12.5); await B.p.waitForTimeout(2200); await synced(B.p);
  await A.p.evaluate(() => Sync.run()); await A.p.waitForTimeout(800);
  ok(await setsToday(A.p) === 2, 'first device receives the second device\'s set');

  // remove on A propagates to B
  await A.p.goto(URL + '#/m/shoulders'); await A.p.locator('section.ex').first().locator('[data-act="rm"]').first().click(); await A.p.waitForTimeout(2200); await synced(A.p);
  await B.p.evaluate(() => Sync.run()); await B.p.waitForTimeout(800);
  ok(await setsToday(B.p) === 1 && await setsToday(A.p) === 1, 'removing a set propagates');

  // another user is isolated
  const C = await device(); await login(C.p, 'sam');
  ok(await C.p.locator('form[data-form="setup"]').count() === 1, 'a different user starts fresh');
  await C.p.fill('#su-now', '80'); await C.p.fill('#su-goal', '72'); await C.p.click('form[data-form="setup"] button'); await C.p.click('[data-act="week-done"]'); await C.p.waitForTimeout(300);
  ok(await setsToday(C.p) === 0, 'sam does not see umar\'s sets');

  // open sign-up: a brand-new name just works, an invalid name is refused before any request
  const D = await device(); await login(D.p, 'bob_99');
  ok(await D.p.locator('form[data-form="setup"]').count() === 1, 'a brand-new username is created automatically');
  const E = await device(); await login(E.p, 'Ab');
  ok((await E.p.locator('#login-err').textContent()).includes('3 to 20'), 'invalid username is refused with a clear message');
  ok(await E.p.evaluate(() => Store.user()) === '', 'invalid username is not signed in');

  // offline edits catch up
  cloud.down = true; await logSet(A.p, 5); await A.p.waitForTimeout(2400);
  ok((await A.p.evaluate(() => Sync.status().state)) === 'offline', 'offline state is reported');
  ok(await setsToday(A.p) === 2, 'set is saved locally while offline');
  cloud.down = false; await A.p.evaluate(() => Sync.run()); await synced(A.p);
  await B.p.evaluate(() => Sync.run()); await B.p.waitForTimeout(800);
  ok(await setsToday(B.p) === 2, 'offline set synced after coming back online');

  await b.close(); console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nsync tests OK'); process.exit(fails.length ? 1 : 0);
})();
