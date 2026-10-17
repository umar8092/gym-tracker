/* Local-first storage. Everything lives in one localStorage key, with JSON export/import as the backup.
   ponytail: single device only; swap save()/load() for Firestore if phone + laptop sync is needed. */
(function () {
  var KEY = 'gymtracker.v1';
  var THEME_KEY = 'gymtracker.theme';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }

  function defaults() {
    var t = ymd(new Date());
    return { profile: { startKg: 92, goalKg: 75, startDate: t }, weights: [{ d: t, kg: 92 }], logs: [], hidden: {}, nextId: 1 };
  }

  var persistent = true;
  var db = (function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var o = JSON.parse(raw), d = defaults(); for (var k in d) { if (!(k in o)) { o[k] = d[k]; } } return o; }
    } catch (e) { persistent = false; }
    return defaults();
  })();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { persistent = false; }
  }
  save();

  var Store = {
    ymd: ymd, parse: parse, addDays: addDays,
    today: function () { return ymd(new Date()); },
    get persistent() { return persistent; },
    profile: function () { return db.profile; },
    setProfile: function (p) { db.profile = Object.assign(db.profile, p); save(); },

    /* ---- sets ---- */
    addSet: function (date, muscle, exId, reps, kg) {
      db.logs.push({ id: db.nextId++, d: date, m: muscle, e: exId, reps: reps, kg: kg, ts: Date.now() });
      save();
    },
    removeSet: function (id) { db.logs = db.logs.filter(function (l) { return l.id !== id; }); save(); },
    setsFor: function (date, exId) {
      return db.logs.filter(function (l) { return l.d === date && l.e === exId; }).sort(function (a, b) { return a.ts - b.ts; });
    },
    logsOn: function (date) { return db.logs.filter(function (l) { return l.d === date; }); },
    allLogs: function () { return db.logs; },
    // sets from the most recent earlier day this exercise was done
    lastSession: function (exId, before) {
      var best = '';
      db.logs.forEach(function (l) { if (l.e === exId && l.d < before && l.d > best) { best = l.d; } });
      return best ? { date: best, sets: Store.setsFor(best, exId) } : null;
    },

    /* ---- plan filter (user can drop exercises they do not have equipment for) ---- */
    isHidden: function (id) { return !!db.hidden[id]; },
    setHidden: function (id, hide) { if (hide) { db.hidden[id] = true; } else { delete db.hidden[id]; } save(); },

    /* ---- body weight ---- */
    weights: function () { return db.weights.slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; }); },
    addWeight: function (d, kg) {
      db.weights = db.weights.filter(function (w) { return w.d !== d; });
      db.weights.push({ d: d, kg: kg }); save();
    },
    currentKg: function () { var w = Store.weights(); return w.length ? w[w.length - 1].kg : db.profile.startKg; },

    /* ---- day status for the calendar and dashboard ---- */
    dayInfo: function (date) {
      var t = Store.today(), jsDay = parse(date).getDay();
      var planned = Data.planFor(jsDay);
      var trained = [];
      db.logs.forEach(function (l) { if (l.d === date && trained.indexOf(l.m) < 0) { trained.push(l.m); } });
      var kind;
      if (date < db.profile.startDate && !trained.length) { kind = 'none'; }
      else if (trained.length) { kind = 'done'; }
      else if (date > t) { kind = planned ? 'upcoming' : 'rest'; }
      else if (date === t) { kind = planned ? 'today' : 'rest'; }
      else { kind = planned ? 'missed' : 'rest'; }
      return { date: date, planned: planned, trained: trained, kind: kind };
    },
    // consecutive planned days done, counted back from today (today only counts if done)
    streak: function () {
      var t = Store.today(), n = 0, d = t, guard = 0;
      while (guard++ < 400) {
        var i = Store.dayInfo(d);
        if (i.kind === 'none') { break; }
        if (i.kind === 'done') { n++; }
        else if (i.kind === 'missed') { break; }
        d = Store.addDays(d, -1);
      }
      return n;
    },
    volume: function (logs) { return logs.reduce(function (s, l) { return s + l.reps * l.kg; }, 0); },

    /* ---- backup ---- */
    exportJSON: function () { return JSON.stringify(db, null, 2); },
    importJSON: function (text) {
      var o = JSON.parse(text);
      if (!o || !Array.isArray(o.logs) || !o.profile) { throw new Error('Not a Gym Tracker backup file'); }
      db = Object.assign(defaults(), o); save();
    },
    reset: function () { db = defaults(); save(); },

    /* ---- theme ---- */
    theme: function () { try { return localStorage.getItem(THEME_KEY) || ''; } catch (e) { return ''; } },
    setTheme: function (v) { try { if (v) { localStorage.setItem(THEME_KEY, v); } else { localStorage.removeItem(THEME_KEY); } } catch (e) {} }
  };
  window.Store = Store;
})();
