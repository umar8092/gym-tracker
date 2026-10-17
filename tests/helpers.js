// Test helpers: sign a user in without the network, and a fake in-memory Firestore for sync tests.
exports.signIn = async function (page, name = 'umar', extra = {}) {
  await page.context().route(/googleapis\.com/, r => r.abort()); // no real cloud in UI tests
  await page.addInitScript(([name, extra]) => {
    if (localStorage.getItem('gymtracker.user')) return; // seed once, never overwrite later edits
    const t = new Date(); const pad = n => (n < 10 ? '0' : '') + n; const ymd = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    const db = Object.assign({ profile: { startKg: 92, goalKg: 75, startDate: ymd }, weights: [{ d: ymd, kg: 92, u: 1, dirty: false }], logs: [], hidden: {}, settings: { u: 1, dirty: false }, pull: { logs: 0, weights: 0 } }, extra);
    localStorage.setItem('gymtracker.user', name); localStorage.setItem('gymtracker.v2.' + name, JSON.stringify(db));
  }, [name, extra]);
};

// In-memory Firestore REST + anonymous auth. allowed = usernames the rules accept.
exports.fakeCloud = function (allowed) {
  const docs = new Map(); let n = 0; const log = []; const api = { down: false };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const json = (route, status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const num = f => (f && (f.integerValue !== undefined ? Number(f.integerValue) : f.doubleValue)) || 0;
  async function install(ctx) {
    await ctx.route(/googleapis\.com/, async route => {
      const req = route.request(), url = new URL(req.url());
      if (api.down) return route.abort('internetdisconnected');
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (url.host.startsWith('identitytoolkit')) return json(route, 200, { idToken: 'tok' + ++n, refreshToken: 'ref' + n, expiresIn: '3600' });
      if (url.host.startsWith('securetoken')) return json(route, 200, { id_token: 'tok' + ++n, refresh_token: 'ref' + n, expires_in: '3600' });
      const path = decodeURIComponent(url.pathname.split('/documents')[1] || '');
      const m = path.match(/^\/users\/([^/:]+)/); const name = m && m[1];
      log.push(req.method() + ' ' + path);
      if (!req.headers().authorization) return json(route, 401, { error: { message: 'no auth' } });
      if (path === ':commit') { // database-level call: the rules are checked per written document
        const writes = JSON.parse(req.postData()).writes;
        if (writes.some(w => !allowed.includes((w.update.name.split('/users/')[1] || '').split('/')[0]))) return json(route, 403, { error: { status: 'PERMISSION_DENIED' } });
        for (const w of writes) docs.set(w.update.name.split('/documents')[1], w.update.fields);
        return json(route, 200, { writeResults: [] });
      }
      if (!name || !allowed.includes(name)) return json(route, 403, { error: { status: 'PERMISSION_DENIED' } });
      if (path.endsWith(':runQuery')) {
        const q = JSON.parse(req.postData()).structuredQuery, coll = q.from[0].collectionId, min = num(q.where.fieldFilter.value);
        const rows = [...docs.entries()].filter(([k, v]) => k.startsWith(`/users/${name}/${coll}/`) && num(v.u) >= min).sort((a, b) => num(a[1].u) - num(b[1].u)).slice(0, q.limit);
        return json(route, 200, rows.length ? rows.map(([k, v]) => ({ document: { name: 'projects/p/databases/(default)/documents' + k, fields: v } })) : [{ readTime: 'x' }]);
      }
      const d = docs.get(path);
      return d ? json(route, 200, { name: 'x' + path, fields: d }) : json(route, 404, { error: { status: 'NOT_FOUND' } });
    });
  }
  return Object.assign(api, { install, docs, log });
};
