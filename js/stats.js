/* Pure analytics over a list of set logs {d, e, reps, kg, ts, ...}. No DOM, no storage: easy to test.
   Estimated max uses the Epley formula: kg x (1 + reps / 30). */
(function () {
  function epley(kg, reps) { return kg > 0 ? kg * (1 + reps / 30) : 0; }
  function r1(n) { return Math.round(n * 10) / 10; }
  function kgText(n) { return Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : String(r1(n)); }

  function summarize(date, sets) {
    var s = { date: date, sets: sets, n: sets.length, topKg: 0, e1rm: 0, volume: 0, reps: 0, maxReps: 0 };
    sets.forEach(function (x) {
      s.topKg = Math.max(s.topKg, x.kg); s.e1rm = Math.max(s.e1rm, epley(x.kg, x.reps));
      s.volume += x.kg * x.reps; s.reps += x.reps; s.maxReps = Math.max(s.maxReps, x.reps);
    });
    return s;
  }
  // one summary per day this exercise was done, oldest first
  function sessions(exId, logs) {
    var by = {};
    logs.filter(function (l) { return l.e === exId; }).sort(function (a, b) { return a.ts - b.ts; })
      .forEach(function (l) { (by[l.d] = by[l.d] || []).push(l); });
    return Object.keys(by).sort().map(function (d) { return summarize(d, by[d]); });
  }
  function inRange(logs, exId, from, to) {
    var sets = logs.filter(function (l) { return l.e === exId && l.d >= from && l.d <= to; }).sort(function (a, b) { return a.ts - b.ts; });
    return sets.length ? summarize(from + '..' + to, sets) : null;
  }

  // how one set compares with the same set number last time
  function setDelta(now, prev) {
    if (!prev) { return null; }
    if (now.kg !== prev.kg) { var d = r1(now.kg - prev.kg); return { dir: d > 0 ? 'up' : 'down', text: (d > 0 ? '+' : '−') + kgText(Math.abs(d)) + ' kg' }; }
    if (now.reps !== prev.reps) { var r = now.reps - prev.reps; return { dir: r > 0 ? 'up' : 'down', text: (r > 0 ? '+' : '−') + Math.abs(r) + (Math.abs(r) === 1 ? ' rep' : ' reps') }; }
    return { dir: 'same', text: 'same' };
  }

  // verdict for period a (recent) against b (earlier). Both are summaries.
  function compare(a, b) {
    var bodyweight = a.topKg === 0 && b.topKg === 0;
    var pct = function (x, y) { return y > 0 ? (x - y) / y : 0; };
    var strength = bodyweight ? pct(a.reps, b.reps) : pct(a.e1rm, b.e1rm);
    var work = bodyweight ? pct(a.reps, b.reps) : pct(a.volume, b.volume);
    var verdict;
    if (strength <= -0.02) { verdict = work >= 0.05 ? 'mixed' : 'down'; }
    else if (strength >= 0.02) { verdict = 'up'; }
    else { verdict = work >= 0.05 ? 'up' : work <= -0.05 ? 'down' : 'same'; }
    var parts = [];
    if (!bodyweight) {
      if (a.topKg !== b.topKg) { parts.push('Heaviest set ' + (a.topKg > b.topKg ? 'up ' : 'down ') + kgText(Math.abs(a.topKg - b.topKg)) + ' kg (' + kgText(b.topKg) + ' to ' + kgText(a.topKg) + ')'); }
      else { parts.push('Same heaviest set (' + kgText(a.topKg) + ' kg)'); }
    }
    if (a.n !== b.n) { parts.push(a.n + ' sets instead of ' + b.n); }
    if (b.volume > 0 && !bodyweight && Math.abs(work) >= 0.02) { parts.push('total ' + (work > 0 ? 'up ' : 'down ') + Math.round(Math.abs(work) * 100) + '%'); }
    if (bodyweight) { parts.push('Total reps ' + b.reps + ' to ' + a.reps); }
    else if (a.n === b.n && a.topKg === b.topKg && a.reps !== b.reps) { parts.push('reps ' + b.reps + ' to ' + a.reps); }
    return { verdict: verdict, change: Math.abs(strength) + Math.abs(work) * 0.5, text: parts.join(', ') + '.' };
  }

  // rows for the Progress page. mode: 'session' | 7 | 30
  function progress(logs, exIds, mode, today, addDays) {
    var rows = [];
    exIds.forEach(function (id) {
      var a, b;
      if (mode === 'session') {
        var ss = sessions(id, logs); if (ss.length < 2) { return; }
        a = ss[ss.length - 1]; b = ss[ss.length - 2];
      } else {
        a = inRange(logs, id, addDays(today, -(mode - 1)), today); b = inRange(logs, id, addDays(today, -(2 * mode - 1)), addDays(today, -mode));
        if (!a || !b) { return; }
      }
      var c = compare(a, b); c.id = id; c.a = a; c.b = b; rows.push(c);
    });
    return rows.sort(function (x, y) { return y.change - x.change; });
  }

  // PR check for a set, against earlier sets of the same exercise. Returns 'weight' | 'est' | 'reps' | null.
  function prFor(set, exLogs) {
    var prev = exLogs.filter(function (l) { return l.id !== set.id && (l.ts < set.ts || (l.ts === set.ts && l.id < set.id)); });
    if (!prev.length) { return null; }
    var maxKg = 0, maxE = 0, maxReps = 0;
    prev.forEach(function (l) { maxKg = Math.max(maxKg, l.kg); maxE = Math.max(maxE, epley(l.kg, l.reps)); maxReps = Math.max(maxReps, l.reps); });
    if (set.kg > 0) {
      if (set.kg > maxKg) { return 'weight'; }
      if (epley(set.kg, set.reps) > maxE + 0.001) { return 'est'; }
      return null;
    }
    return maxKg === 0 && set.reps > maxReps ? 'reps' : null;
  }
  var PR_TEXT = { weight: 'New PR: heaviest weight', est: 'New PR: best estimated max', reps: 'New PR: most reps' };

  // all-time bests for one exercise
  function records(exId, logs) {
    var best = null;
    logs.filter(function (l) { return l.e === exId; }).forEach(function (l) {
      var key = l.kg > 0 ? l.kg * 1000 + l.reps : l.reps;
      if (!best || (l.kg > best.kg) || (l.kg === best.kg && l.reps > best.reps)) { best = l; }
    });
    return best;
  }

  // "Target today" from last session: add weight once every set hit the top of the rep range, otherwise add a rep.
  function target(repText, last) {
    if (!last || !last.sets.length) { return null; }
    var m = /(\d+)(?:-(\d+))?/.exec(repText) || [0, '10'], low = +m[1], high = +(m[2] || m[1]);
    var maxKg = last.topKg, atTop = last.sets.filter(function (s) { return s.kg === maxKg; });
    var weakest = Math.min.apply(null, atTop.map(function (s) { return s.reps; }));
    var allTop = last.sets.every(function (s) { return s.reps >= high; });
    if (maxKg === 0) { return { kg: 0, reps: weakest + 1, why: 'Last time your lowest set was ' + weakest + ' reps.' }; }
    if (allTop) { return { kg: maxKg + 2.5, reps: low, why: 'You reached ' + high + ' reps on every set last time, so add weight.' }; }
    return { kg: maxKg, reps: Math.min(high, weakest + 1), why: 'Last time your lowest set at ' + kgText(maxKg) + ' kg was ' + weakest + ' reps.' };
  }

  // plates per side for a barbell. avail in kg, largest first.
  function plates(total, bar, avail) {
    var side = Math.round((total - bar) * 100 / 2), out = [], left = side;
    if (total < bar) { return null; }
    avail.forEach(function (p) { var pc = Math.round(p * 100), n = Math.floor(left / pc); if (n > 0) { out.push({ plate: p, count: n }); left -= n * pc; } });
    return { perSide: out, achieved: r1(total - 2 * left / 100), exact: left === 0 };
  }

  var Stats = { epley: epley, kgText: kgText, summarize: summarize, sessions: sessions, inRange: inRange, setDelta: setDelta, compare: compare, progress: progress, prFor: prFor, PR_TEXT: PR_TEXT, records: records, target: target, plates: plates };
  if (typeof module !== 'undefined') { module.exports = Stats; } else { window.Stats = Stats; }
})();
