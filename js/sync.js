/* Cloud sync through the Firestore REST API (no SDK). Each device signs in anonymously; the database rules only
   allow the listed usernames. Data layout: users/{name}/logs/{id}, users/{name}/weights/{date}, users/{name}/meta/settings.
   The app works fully offline: this only copies changes up and down when there is a connection. */
(function () {
  var KEY = 'AIzaSyAl32tER_FWZglF60u6tpFvhH9sEwGj1BU', PROJECT = 'gym-tracker-5937f';
  var BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
  var AUTH_KEY = 'gymtracker.auth';

  var status = { state: 'idle', at: 0, msg: '' }, listeners = [], running = false, again = false, timer = 0;
  function set(state, msg) { status = { state: state, at: state === 'synced' ? Date.now() : status.at, msg: msg || '' }; listeners.forEach(function (f) { f(status); }); }

  /* ---------- auth (anonymous) ---------- */
  function readAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || {}; } catch (e) { return {}; } }
  function saveAuth(a) { try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch (e) {} }
  // every call has a deadline, so a hanging connection ends in an error the user can see instead of an endless wait
  var TIMEOUT = 12000;
  function tfetch(url, opts, ms) {
    if (typeof AbortController === 'undefined') { return fetch(url, opts); }
    var ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, ms || TIMEOUT); opts = opts || {}; opts.signal = ac.signal;
    return fetch(url, opts).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); if (e && e.name === 'AbortError') { var te = new TypeError('timeout'); te.timeout = true; throw te; } throw e; });
  }
  function post(url, body, form) {
    return tfetch(url, { method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: body }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }
  function signUp() {
    return post('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + KEY, JSON.stringify({ returnSecureToken: true })).then(function (r) {
      if (!r.ok) { throw new Error('Sign-in to the cloud failed'); }
      var a = { id: r.j.idToken, rt: r.j.refreshToken, exp: Date.now() + (+r.j.expiresIn) * 1000 }; saveAuth(a); return a.id;
    });
  }
  function token(force) {
    var a = readAuth();
    if (!force && a.id && a.exp > Date.now() + 60000) { return Promise.resolve(a.id); }
    if (a.rt) {
      return post('https://securetoken.googleapis.com/v1/token?key=' + KEY, 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(a.rt), true).then(function (r) {
        if (!r.ok) { return signUp(); }
        var n = { id: r.j.id_token, rt: r.j.refresh_token, exp: Date.now() + (+r.j.expires_in) * 1000 }; saveAuth(n); return n.id;
      });
    }
    return signUp();
  }

  /* ---------- Firestore REST helpers ---------- */
  function api(path, opts, retried) {
    return token(retried).then(function (t) {
      opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, opts.headers);
      return tfetch(BASE + path, opts);
    }).then(function (r) {
      if (r.status === 401 && !retried) { return api(path, opts, true); }
      return r;
    });
  }
  function enc(v) {
    if (typeof v === 'string') { return { stringValue: v }; }
    if (typeof v === 'boolean') { return { booleanValue: v }; }
    if (v % 1 === 0 && Math.abs(v) > 1e6) { return { integerValue: String(v) }; }
    return { doubleValue: v };
  }
  function encInt(v) { return { integerValue: String(v) }; }
  function dec(f) {
    var o = {}; for (var k in f) { var x = f[k]; o[k] = 'stringValue' in x ? x.stringValue : 'integerValue' in x ? Number(x.integerValue) : 'doubleValue' in x ? x.doubleValue : x.booleanValue; }
    return o;
  }
  function docId(name) { return name.slice(name.lastIndexOf('/') + 1); }

  function queryAll(user, coll, cursor) {
    var out = [], c = cursor || 0;
    function page() {
      var body = { structuredQuery: { from: [{ collectionId: coll }], where: { fieldFilter: { field: { fieldPath: 'u' }, op: 'GREATER_THAN_OR_EQUAL', value: encInt(c) } }, orderBy: [{ field: { fieldPath: 'u' }, direction: 'ASCENDING' }], limit: 500 } };
      return api('/users/' + user + ':runQuery', { method: 'POST', body: JSON.stringify(body) }).then(function (r) {
        if (r.status === 403) { var e = new Error('The cloud refused this username'); e.denied = true; throw e; }
        if (!r.ok) { throw new Error('Cloud error ' + r.status); }
        return r.json();
      }).then(function (rows) {
        var docs = rows.filter(function (x) { return x.document; }), maxU = c;
        docs.forEach(function (x) { var d = dec(x.document.fields); d.id = docId(x.document.name); out.push(d); if (d.u > maxU) { maxU = d.u; } });
        if (docs.length >= 500 && maxU > c) { c = maxU; return page(); }
        c = maxU;
      });
    }
    return page().then(function () { return { rows: out, cursor: c }; });
  }

  function pull(user) {
    var cur = Store.pullCursor();
    return Promise.all([
      queryAll(user, 'logs', cur.logs),
      queryAll(user, 'weights', cur.weights),
      api('/users/' + user + '/meta/settings').then(function (r) {
        if (r.status === 404) { return null; }
        if (r.status === 403) { var e = new Error('The cloud refused this username'); e.denied = true; throw e; }
        if (!r.ok) { throw new Error('Cloud error ' + r.status); }
        return r.json().then(function (d) { var f = dec(d.fields); var j = JSON.parse(f.json); return { u: f.u, profile: j.profile, hidden: j.hidden, notes: j.notes, custom: j.custom, measures: j.measures, superset: j.superset }; });
      })
    ]).then(function (res) {
      return {
        logs: res[0].rows.map(function (d) { return { id: d.id, d: d.d, m: d.m, e: d.e, reps: d.reps, kg: d.kg, ts: d.ts, u: d.u, del: !!d.del }; }),
        weights: res[1].rows.map(function (d) { return { d: d.id, kg: d.kg, u: d.u }; }),
        settings: res[2], cursor: { logs: res[0].cursor, weights: res[1].cursor }
      };
    });
  }

  function push(user, p) {
    var base = 'projects/' + PROJECT + '/databases/(default)/documents/users/' + user, writes = [];
    p.logs.forEach(function (l) {
      writes.push({ update: { name: base + '/logs/' + l.id, fields: { d: enc(l.d), m: enc(l.m), e: enc(l.e), reps: encInt(l.reps), kg: { doubleValue: l.kg }, ts: encInt(l.ts), u: encInt(l.u), del: { booleanValue: !!l.del } } } });
    });
    p.weights.forEach(function (w) { writes.push({ update: { name: base + '/weights/' + w.d, fields: { kg: { doubleValue: w.kg }, u: encInt(w.u) } } }); });
    if (p.settings) { writes.push({ update: { name: base + '/meta/settings', fields: { json: enc(JSON.stringify({ profile: p.settings.profile, hidden: p.settings.hidden, notes: p.settings.notes, custom: p.settings.custom, measures: p.settings.measures, superset: p.settings.superset })), u: encInt(p.settings.u) } } }); }
    var chunks = [], i; for (i = 0; i < writes.length; i += 400) { chunks.push(writes.slice(i, i + 400)); }
    return chunks.reduce(function (pr, ch) {
      return pr.then(function () {
        return api(':commit', { method: 'POST', body: JSON.stringify({ writes: ch }) }).then(function (r) {
          if (r.status === 403) { var e = new Error('The cloud refused this username'); e.denied = true; throw e; }
          if (!r.ok) { throw new Error('Cloud error ' + r.status); }
        });
      });
    }, Promise.resolve());
  }

  function run() {
    var user = Store.user();
    if (!user) { return Promise.resolve(); }
    if (running) { again = true; return Promise.resolve(); }
    running = true; set('syncing');
    return pull(user).then(function (remote) {
      Store.merge(remote);
      var p = Store.pending();
      if (!p.logs.length && !p.weights.length && !p.settings) { return; }
      return push(user, p).then(function () { Store.ack(p); });
    }).then(function () { set('synced'); }).catch(function (e) {
      set(e.denied ? 'denied' : (e instanceof TypeError ? 'offline' : 'error'), e.message);
    }).then(function () { running = false; if (again) { again = false; schedule(); } });
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 1500); }

  window.Sync = {
    run: run, schedule: schedule,
    status: function () { return status; },
    onStatus: function (f) { listeners.push(f); },
    // a friend's recent sets (updated in the last 30 days), read only. Costs one cloud read per set returned, so only called on a button press.
    peek: function (name) { return queryAll(name, 'logs', Date.now() - 30 * 864e5).then(function (r) { return r.rows.filter(function (l) { return !l.del; }); }); },
    // is this username allowed? resolves 'ok' | 'denied' | 'offline' | 'slow' (no answer within the deadline)
    check: function (name) {
      return api('/users/' + name + '/meta/settings').then(function (r) { return r.status === 403 ? 'denied' : (r.ok || r.status === 404) ? 'ok' : 'error'; })
        .catch(function (e) { return e && e.timeout ? 'slow' : 'offline'; });
    }
  };
  Store.onWrite(function () { if (Store.user()) { schedule(); } });
  // idle refresh: pick up changes from another phone while this one stays open (only when visible, signed in and online)
  setInterval(function () { if (document.visibilityState === 'visible' && navigator.onLine !== false && Store.user()) { run(); } }, 60000);
  window.addEventListener('online', function () { run(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { run(); } });
})();
