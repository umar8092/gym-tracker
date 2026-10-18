/* Local-first storage, one database per username on this device. Every record carries u (last-changed time) and dirty
   (not yet synced) so sync.js can merge with Firestore. Backup = JSON export/import.
   ponytail: last-change-wins per record; fine for a few people each logging their own sets. */
(function () {
  var USER_KEY = 'gymtracker.user', THEME_KEY = 'gymtracker.theme', LEGACY = 'gymtracker.v1';
  function dbKey(u) { return 'gymtracker.v2.' + u; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function now() { return Date.now(); }

  var user = '', db = null, persistent = true, writeFns = [], mergeFns = [];
  try { user = localStorage.getItem(USER_KEY) || ''; } catch (e) { persistent = false; }

  function fresh() {
    return { profile: { startKg: null, goalKg: null, startDate: ymd(new Date()) }, weights: [], logs: [], hidden: {}, notes: {}, custom: {}, schedule: null, measures: [], superset: {}, stype: {}, settings: { u: 0, dirty: false }, pull: { logs: 0, weights: 0 } };
  }
  function normalize(o) {
    var d = fresh(); for (var k in d) { if (!(k in o)) { o[k] = d[k]; } }
    o.logs.forEach(function (l) { if (typeof l.id === 'number') { l.id = 'o' + l.id + uid(); l.u = l.ts || now(); l.dirty = true; } if (!l.u) { l.u = l.ts || now(); l.dirty = true; } });
    o.weights.forEach(function (w) { if (!w.u) { w.u = now(); w.dirty = true; } });
    Data.setCustom(o.custom); Data.setSchedule(o.schedule || Data.DEFAULT_SCHEDULE);
    return o;
  }
  function load(name) {
    try {
      var raw = localStorage.getItem(dbKey(name));
      if (raw) { return normalize(JSON.parse(raw)); }
      // the first username on a device with pre-2.0 data adopts it
      var old = localStorage.getItem(LEGACY);
      if (old) {
        var o = JSON.parse(old); o.settings = { u: now(), dirty: true }; return normalize(o);
      }
    } catch (e) { persistent = false; }
    return fresh();
  }
  function save() { try { localStorage.setItem(dbKey(user), JSON.stringify(db)); } catch (e) { persistent = false; } }
  function wrote() { save(); writeFns.forEach(function (f) { f(); }); }
  function live() { return db.logs.filter(function (l) { return !l.del; }); }
  // set types (w warm-up, f failure, d drop) live in the settings JSON: the cloud rules only allow fixed fields on log docs
  function stype() { return db.stype || (db.stype = {}); }
  function touchSettings() { db.settings.u = now(); db.settings.dirty = true; }

  if (user) { db = load(user); save(); }

  var Store = {
    ymd: ymd, parse: parse, addDays: addDays,
    today: function () { return ymd(new Date()); },
    get persistent() { return persistent; },

    /* ---- who is training ---- */
    user: function () { return db ? user : ''; },
    knownUser: function (name) { try { return !!localStorage.getItem(dbKey(name)); } catch (e) { return false; } },
    signIn: function (name) {
      user = name; db = load(name); save();
      try { localStorage.setItem(USER_KEY, name); localStorage.removeItem(LEGACY); } catch (e) { persistent = false; }
    },
    signOut: function () { user = ''; db = null; try { localStorage.removeItem(USER_KEY); } catch (e) {} },
    needsSetup: function () { return !!db && (db.profile.startKg == null || db.profile.goalKg == null); },

    profile: function () { return db.profile; },
    setProfile: function (p) { db.profile = Object.assign(db.profile, p); touchSettings(); wrote(); },

    /* ---- sets ---- */
    addSet: function (date, muscle, exId, reps, kg) {
      var t = now();
      var id = uid(); db.logs.push({ id: id, d: date, m: muscle, e: exId, reps: reps, kg: kg, ts: t, u: t, dirty: true }); wrote(); return id;
    },
    updateSet: function (id, reps, kg) {
      db.logs.forEach(function (l) { if (l.id === id) { l.reps = reps; l.kg = kg; l.u = now(); l.dirty = true; } }); wrote();
    },
    restoreSet: function (id) { db.logs.forEach(function (l) { if (l.id === id) { l.del = false; l.u = now(); l.dirty = true; } }); wrote(); },
    removeSet: function (id) {
      db.logs.forEach(function (l) { if (l.id === id) { l.del = true; l.u = now(); l.dirty = true; } }); wrote();
    },
    setsFor: function (date, exId) {
      return live().filter(function (l) { return l.d === date && l.e === exId; }).sort(function (a, b) { return a.ts - b.ts; }).map(function (l) { l.t = stype()[l.id] || ''; return l; });
    },
    workSets: function (date, exId) { return Store.setsFor(date, exId).filter(function (l) { return l.t !== 'w'; }); },
    logsOn: function (date) { return live().filter(function (l) { return l.d === date; }); },
    allLogs: function () { return live().filter(function (l) { return stype()[l.id] !== 'w'; }); },   // warm-ups never count towards PRs, volume or streaks
    allLogsRaw: function () { return live(); },
    setType: function (id, t) {
      var m = stype(); if (t) { m[id] = t; } else { delete m[id]; }
      var ids = Object.keys(m); if (ids.length > 40) { var keep = {}; db.logs.forEach(function (l) { keep[l.id] = l.ts; }); ids.sort(function (a, b) { return (keep[a] || 0) - (keep[b] || 0); }).slice(0, ids.length - 40).forEach(function (k) { delete m[k]; }); }
      touchSettings(); wrote();
    },
    lastSession: function (exId, before) {
      var best = '';
      live().forEach(function (l) { if (l.e === exId && l.d < before && l.d > best) { best = l.d; } });
      return best ? { date: best, sets: Store.workSets(best, exId) } : null;
    },

    /* ---- plan filter ---- */
    isHidden: function (id) { return !!db.hidden[id]; },
    // short per-exercise notes (seat height, grip...). Kept small: they travel inside the settings document.
    note: function (exId) { return db.notes[exId] || ''; },
    setNote: function (exId, text) { text = String(text).trim().slice(0, 140); if (text) { db.notes[exId] = text; } else { delete db.notes[exId]; } touchSettings(); wrote(); },
    // own exercises travel inside the settings document (limit keeps it under the 6000 character cap)
    // body measurements in cm, newest last. Travel inside the settings document, so capped (keeps it far under the 6000 character limit).
    measures: function () { return db.measures.slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; }); },
    addMeasure: function (m) {
      db.measures = db.measures.filter(function (x) { return x.d !== m.d; }); db.measures.push(m);
      db.measures.sort(function (a, b) { return a.d < b.d ? -1 : 1; }); db.measures = db.measures.slice(-24); touchSettings(); wrote();
    },
    removeMeasure: function (d) { db.measures = db.measures.filter(function (x) { return x.d !== d; }); touchSettings(); wrote(); },
    // superset: this exercise is done back to back with the one above it
    isSuper: function (id) { return !!db.superset[id]; },
    setSuper: function (id, on) { if (on) { db.superset[id] = 1; } else { delete db.superset[id]; } touchSettings(); wrote(); },
    schedule: function () { return JSON.parse(JSON.stringify(Data.schedule || Data.DEFAULT_SCHEDULE)); },
    setSchedule: function (map) { Data.setSchedule(map); db.schedule = Store.schedule(); touchSettings(); wrote(); },
    customCount: function () { return Object.keys(db.custom).length; },
    addCustom: function (c) {
      if (Store.customCount() >= 12) { return false; }
      var id = 'c-' + uid(); db.custom[id] = { id: id, name: c.name, muscle: c.muscle, equip: c.equip, sets: c.sets, reps: c.reps }; if (c.timed) { db.custom[id].timed = 1; }
      Data.setCustom(db.custom); touchSettings(); wrote(); return id;
    },
    removeCustom: function (id) { delete db.custom[id]; delete db.hidden[id]; Data.setCustom(db.custom); touchSettings(); wrote(); },
    setHidden: function (id, hide) { if (hide) { db.hidden[id] = true; } else { delete db.hidden[id]; } touchSettings(); wrote(); },

    /* ---- body weight ---- */
    weights: function () { return db.weights.slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; }); },
    addWeight: function (d, kg) {
      db.weights = db.weights.filter(function (w) { return w.d !== d; });
      db.weights.push({ d: d, kg: kg, u: now(), dirty: true }); wrote();
    },
    currentKg: function () { var w = Store.weights(); return w.length ? w[w.length - 1].kg : db.profile.startKg; },

    /* ---- day status for the calendar and dashboard ---- */
    dayInfo: function (date) {
      var t = Store.today(), planned = Data.planFor(parse(date).getDay()), plannedAll = Data.planAll(parse(date).getDay()), trained = [];
      live().forEach(function (l) { if (l.d === date && trained.indexOf(l.m) < 0) { trained.push(l.m); } });
      var kind;
      if (date < db.profile.startDate && !trained.length) { kind = 'none'; }
      else if (trained.length) { kind = 'done'; }
      else if (date > t) { kind = planned ? 'upcoming' : 'rest'; }
      else if (date === t) { kind = planned ? 'today' : 'rest'; }
      else if (!planned) { kind = 'rest'; }
      else { // a missed day is made up if that muscle was trained within the next 6 days
        var end = addDays(date, 6);
        kind = live().some(function (l) { return l.m === planned && l.d > date && l.d <= end; }) ? 'madeup' : 'missed';
      }
      return { date: date, planned: planned, plannedAll: plannedAll, trained: trained, kind: kind };
    },
    streak: function () {
      var n = 0, d = Store.today(), guard = 0;
      while (guard++ < 400) {
        var i = Store.dayInfo(d);
        if (i.kind === 'none' || i.kind === 'missed') { break; }  // madeup: neither counts nor breaks
        if (i.kind === 'done') { n++; }
        d = Store.addDays(d, -1);
      }
      return n;
    },
    // shown volume, in the chosen display unit
    volume: function (logs) { return logs.reduce(function (s, l) { return s + l.reps * (window.Stats ? window.Stats.toU(l.kg) : l.kg); }, 0); },

    /* ---- backup ---- */
    exportJSON: function () { return JSON.stringify(db, null, 2); },
    importJSON: function (text) {
      var o = JSON.parse(text);
      if (!o || !Array.isArray(o.logs) || !o.profile) { throw new Error('Not a Gym Workout Tracker backup file'); }
      o.logs.forEach(function (l) { l.id = typeof l.id === 'string' ? l.id : 'i' + l.id + uid(); l.u = now(); l.dirty = true; });
      o.weights = (o.weights || []).map(function (w) { return { d: w.d, kg: w.kg, u: now(), dirty: true }; });
      o.settings = { u: now(), dirty: true }; o.pull = { logs: 0, weights: 0 };
      db = normalize(o); wrote();
    },
    // clears this device only; the cloud copy comes back at the next sync
    reset: function () { db = fresh(); Data.setCustom({}); Data.setSchedule(Data.DEFAULT_SCHEDULE); wrote(); },

    /* ---- sync hooks (used by sync.js) ---- */
    onWrite: function (f) { writeFns.push(f); },
    onMerge: function (f) { mergeFns.push(f); },
    pullCursor: function () { return db.pull; },
    pending: function () {
      return {
        logs: db.logs.filter(function (l) { return l.dirty; }).map(function (l) { return Object.assign({}, l); }),
        weights: db.weights.filter(function (w) { return w.dirty; }).map(function (w) { return Object.assign({}, w); }),
        settings: db.settings.dirty ? { u: db.settings.u, profile: db.profile, hidden: db.hidden, notes: db.notes, custom: db.custom, schedule: db.schedule, measures: db.measures, superset: db.superset, stype: db.stype } : null
      };
    },
    ack: function (sent) {
      sent.logs.forEach(function (s) { db.logs.forEach(function (l) { if (l.id === s.id && l.u === s.u) { l.dirty = false; } }); });
      sent.weights.forEach(function (s) { db.weights.forEach(function (w) { if (w.d === s.d && w.u === s.u) { w.dirty = false; } }); });
      if (sent.settings && db.settings.u === sent.settings.u) { db.settings.dirty = false; }
      save();
    },
    // remote: {logs, weights, settings, cursor}. Returns true if anything local changed.
    merge: function (remote) {
      var changed = false, byId = {}, byD = {};
      db.logs.forEach(function (l) { byId[l.id] = l; });
      db.weights.forEach(function (w) { byD[w.d] = w; });
      remote.logs.forEach(function (r) {
        var l = byId[r.id];
        if (!l) { r.dirty = false; db.logs.push(r); byId[r.id] = r; changed = true; }
        else if (r.u > l.u) { Object.assign(l, r, { dirty: false }); changed = true; }
      });
      remote.weights.forEach(function (r) {
        var w = byD[r.d];
        if (!w) { db.weights.push({ d: r.d, kg: r.kg, u: r.u, dirty: false }); changed = true; }
        else if (r.u > w.u) { w.kg = r.kg; w.u = r.u; w.dirty = false; changed = true; }
      });
      if (remote.settings && remote.settings.u > db.settings.u) {
        db.profile = Object.assign(db.profile, remote.settings.profile); db.hidden = remote.settings.hidden || {}; db.notes = remote.settings.notes || {}; db.custom = remote.settings.custom || {}; Data.setCustom(db.custom); db.schedule = remote.settings.schedule || null; Data.setSchedule(db.schedule || Data.DEFAULT_SCHEDULE); db.measures = remote.settings.measures || []; db.superset = remote.settings.superset || {}; db.stype = remote.settings.stype || {};
        db.settings = { u: remote.settings.u, dirty: false }; changed = true;
      } else if (!remote.settings && db.settings.u === 0 && !Store.needsSetup()) { touchSettings(); }
      if (remote.cursor) { db.pull = remote.cursor; }
      save();
      if (changed) { mergeFns.forEach(function (f) { f(); }); }
      return changed;
    },

    /* ---- theme ---- */
    theme: function () { try { return localStorage.getItem(THEME_KEY) || ''; } catch (e) { return ''; } },
    setTheme: function (v) { try { if (v) { localStorage.setItem(THEME_KEY, v); } else { localStorage.removeItem(THEME_KEY); } } catch (e) {} }
  };
  window.Store = Store;
})();
