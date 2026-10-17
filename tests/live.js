// Live smoke test against the real Firebase project with throwaway usernames. Cleans up everything it writes.
// Usage: node tests/live.js   (needs `python3 -m http.server 8765` for the UI part; set URL to test the deployed site)
const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const KEY = 'AIzaSyAl32tER_FWZglF60u6tpFvhH9sEwGj1BU', P = 'gym-tracker-5937f';
const DB = `projects/${P}/databases/(default)/documents`, BASE = `https://firestore.googleapis.com/v1/${DB}`;
const URL = process.env.URL || 'http://localhost:8765/index.html';
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
const name = 'zz_smoke_' + Math.random().toString(36).slice(2, 8);
const int = v => ({ integerValue: String(v) });
const logDoc = (kg = 10) => ({ d: { stringValue: '2026-10-15' }, m: { stringValue: 'shoulders' }, e: { stringValue: 'overhead-press' }, reps: int(10), kg: { doubleValue: kg }, ts: int(Date.now()), u: int(Date.now()), del: { booleanValue: false } });
async function token() { const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: 'POST', body: JSON.stringify({ returnSecureToken: true }) }); return (await r.json()).idToken; }
const call = (t, path, body, method = 'POST') => fetch(BASE + path, { method, headers: { ...(t ? { Authorization: 'Bearer ' + t } : {}), 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
(async () => {
  const t = await token(); ok(!!t, 'anonymous sign-in works');
  const w = (n, id, fields) => ({ writes: [{ update: { name: `${DB}/users/${n}/logs/${id}`, fields } }] });
  ok((await call(t, ':commit', w(name, 'rest1', logDoc()))).status === 200, 'valid set is accepted');
  ok((await call(t, ':commit', w(name, 'rest2', logDoc(5000)))).status === 403, 'absurd weight (5000 kg) is rejected');
  ok((await call(t, ':commit', w(name, 'rest3', { ...logDoc(), extra: { stringValue: 'x' } }))).status === 403, 'unknown extra field is rejected');
  ok((await call(t, ':commit', w('Bad Name', 'rest4', logDoc()))).status === 403, 'invalid username in the path is rejected');
  ok((await call(null, `/users/${name}/logs/rest1`, null, 'GET')).status === 403, 'unauthenticated read is rejected');
  ok((await call(t, `/users/${name}/logs/rest1`, null, 'GET')).status === 200, 'authenticated read works');

  // the real app, two devices, against the real cloud
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const fl = [];
  async function dev() { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.on('pageerror', e => fl.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|40[34]/.test(m.text())) fl.push(m.text()); }); return p; }
  const synced = p => p.waitForFunction(() => Sync.status().state === 'synced', null, { timeout: 15000 }).catch(() => {});
  const ui = 'zz_ui_' + Math.random().toString(36).slice(2, 8);
  const A = await dev(); await A.goto(URL + '#/'); await A.fill('#un', ui); await A.click('form[data-form="login"] button[type="submit"]'); await A.check('#memo-ok'); await A.click('#memo-go'); await A.waitForSelector('form[data-form="setup"]', { timeout: 15000 }).catch(() => {});
  ok(await A.locator('form[data-form="setup"]').count() === 1, 'real cloud: new username reaches the setup screen');
  await A.fill('#su-now', '90'); await A.fill('#su-goal', '80'); await A.click('form[data-form="setup"] button'); await A.click('[data-act="week-done"]');
  await A.goto(URL + '#/m/shoulders'); const s = A.locator('section.ex').first(); await s.locator('[data-act="kgset"][data-v="10"]').first().click(); await s.locator('[data-act="log"]').click();
  await A.waitForTimeout(2500); await synced(A);
  ok(await A.evaluate(() => Sync.status().state) === 'synced', 'real cloud: device A synced without errors');
  const B = await dev(); await B.goto(URL + '#/'); await B.fill('#un', ui); await B.click('form[data-form="login"] button[type="submit"]'); await B.check('#memo-ok'); await B.click('#memo-go'); await B.waitForTimeout(3500); await synced(B);
  ok(await B.locator('form[data-form="setup"]').count() === 0, 'real cloud: second device skips setup');
  ok(await B.evaluate(() => Store.allLogs().length) === 1, 'real cloud: second device received the set');
  fl.length && fails.push(...fl);
  await b.close();

  // cleanup: delete everything created under both throwaway names
  for (const n of [name, ui]) {
    for (const coll of ['logs', 'weights']) {
      const r = await (await call(t, `/users/${n}:runQuery`, { structuredQuery: { from: [{ collectionId: coll }] } })).json();
      for (const row of r) if (row.document) await call(t, ':commit', { writes: [{ delete: row.document.name }] });
    }
    await call(t, ':commit', { writes: [{ delete: `${DB}/users/${n}/meta/settings` }] });
  }
  const left = await (await call(t, `/users/${ui}:runQuery`, { structuredQuery: { from: [{ collectionId: 'logs' }] } })).json();
  ok(!left.some(x => x.document), 'cleanup removed all test data');
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nlive tests OK');
  process.exit(fails.length ? 1 : 0);
})();
