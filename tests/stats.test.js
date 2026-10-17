// Unit tests for js/stats.js (no browser). Run: node tests/stats.test.js
const assert = require('assert');
const S = require('../js/stats.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('PASS', name); };
let id = 0; const L = (d, e, reps, kg, ts) => ({ id: ++id, d, e, reps, kg, ts: ts || Date.parse(d + 'T10:00:00') + id });
const addDays = (s, k) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };

t('epley estimate', () => { assert.strictEqual(Math.round(S.epley(100, 5) * 10) / 10, 116.7); assert.strictEqual(S.epley(0, 10), 0); });
t('sessions groups by day, oldest first', () => {
  const ss = S.sessions('a', [L('2026-10-08', 'a', 10, 20), L('2026-10-01', 'a', 8, 20), L('2026-10-08', 'a', 9, 20), L('2026-10-08', 'b', 5, 5)]);
  assert.deepStrictEqual(ss.map(x => x.date), ['2026-10-01', '2026-10-08']); assert.strictEqual(ss[1].n, 2); assert.strictEqual(ss[1].volume, 380);
});
t('set delta: weight, reps, same, none', () => {
  assert.deepStrictEqual(S.setDelta({ kg: 22.5, reps: 8 }, { kg: 20, reps: 10 }), { dir: 'up', text: '+2.5 kg' });
  assert.deepStrictEqual(S.setDelta({ kg: 20, reps: 9 }, { kg: 20, reps: 10 }), { dir: 'down', text: '−1 rep' });
  assert.strictEqual(S.setDelta({ kg: 20, reps: 10 }, { kg: 20, reps: 10 }).dir, 'same'); assert.strictEqual(S.setDelta({ kg: 20, reps: 10 }, undefined), null);
});
t('compare: heavier is up', () => {
  const a = S.summarize('x', [L('d', 'a', 10, 22.5), L('d', 'a', 10, 22.5)]), b = S.summarize('y', [L('d', 'a', 10, 20), L('d', 'a', 10, 20)]);
  const c = S.compare(a, b); assert.strictEqual(c.verdict, 'up'); assert.ok(c.text.includes('up 2.5 kg (20 to 22.5)'), c.text);
});
t('compare: same weight, fewer sets is down and says why', () => {
  const a = S.summarize('x', [L('d', 'a', 10, 20), L('d', 'a', 10, 20)]), b = S.summarize('y', [L('d', 'a', 10, 20), L('d', 'a', 10, 20), L('d', 'a', 10, 20)]);
  const c = S.compare(a, b); assert.strictEqual(c.verdict, 'down'); assert.ok(c.text.includes('2 sets instead of 3'), c.text);
});
t('compare: lighter but more work is mixed; tiny change is same', () => {
  const lighter = S.summarize('x', [1, 2, 3, 4, 5].map(() => L('d', 'a', 10, 17.5))), heavy = S.summarize('y', [1, 2, 3].map(() => L('d', 'a', 10, 20)));
  assert.strictEqual(S.compare(lighter, heavy).verdict, 'mixed');
  assert.strictEqual(S.compare(S.summarize('x', [L('d', 'a', 10, 20)]), S.summarize('y', [L('d', 'a', 10, 20)])).verdict, 'same');
});
t('compare: bodyweight uses total reps', () => {
  const c = S.compare(S.summarize('x', [L('d', 'p', 12, 0), L('d', 'p', 10, 0)]), S.summarize('y', [L('d', 'p', 10, 0), L('d', 'p', 8, 0)]));
  assert.strictEqual(c.verdict, 'up'); assert.ok(c.text.includes('Total reps 18 to 22'), c.text);
});
t('progress by session and by window; skips exercises without two periods', () => {
  const logs = [L('2026-10-01', 'a', 10, 20), L('2026-10-08', 'a', 10, 22.5), L('2026-10-08', 'b', 10, 10)];
  assert.deepStrictEqual(S.progress(logs, ['a', 'b'], 'session', '2026-10-09', addDays).map(r => r.id), ['a']);
  assert.deepStrictEqual(S.progress(logs, ['a'], 7, '2026-10-09', addDays).map(r => r.id), ['a']);
  assert.strictEqual(S.progress(logs, ['a'], 30, '2026-10-09', addDays).length, 0);
});
t('PR detection: first time is baseline, then weight, then estimated max, bodyweight reps', () => {
  const l1 = L('2026-10-01', 'a', 10, 20), l2 = L('2026-10-08', 'a', 8, 22.5), l3 = L('2026-10-15', 'a', 12, 20), l4 = L('2026-10-15', 'a', 6, 20);
  const all = [l1, l2, l3, l4];
  assert.strictEqual(S.prFor(l1, all), null); assert.strictEqual(S.prFor(l2, all), 'weight');
  assert.strictEqual(S.prFor(l3, all), null); // 20 x 12 (e1rm 28) vs 22.5 x 8 (e1rm 28.5): not a PR
  const l5 = L('2026-10-22', 'a', 15, 20); assert.strictEqual(S.prFor(l5, all.concat(l5)), 'est'); assert.strictEqual(S.prFor(l4, all), null);
  const p1 = L('2026-10-01', 'p', 10, 0), p2 = L('2026-10-08', 'p', 12, 0); assert.strictEqual(S.prFor(p2, [p1, p2]), 'reps');
});
t('target: add a rep, add weight at the top of the range, bodyweight', () => {
  const mk = sets => S.summarize('d', sets.map(([r, k]) => L('d', 'a', r, k)));
  assert.deepStrictEqual(S.target('8-10', mk([[8, 20], [9, 20], [8, 20]])), { kg: 20, reps: 9, why: 'Last time your lowest set at 20 kg was 8 reps.' });
  const up = S.target('8-10', mk([[10, 20], [10, 20], [10, 20]])); assert.strictEqual(up.kg, 22.5); assert.strictEqual(up.reps, 8);
  assert.strictEqual(S.target('8-15', mk([[10, 0], [9, 0]])).reps, 10);
  assert.strictEqual(S.target('10', null), null);
});
t('plate calculator: exact, impossible, below bar', () => {
  const av = [25, 20, 15, 10, 5, 2.5, 1.25];
  assert.deepStrictEqual(S.plates(100, 20, av), { perSide: [{ plate: 25, count: 1 }, { plate: 15, count: 1 }], achieved: 100, exact: true });
  const odd = S.plates(61, 20, av); assert.strictEqual(odd.exact, false); assert.strictEqual(odd.achieved, 60);
  assert.strictEqual(S.plates(15, 20, av), null); assert.deepStrictEqual(S.plates(20, 20, av).perSide, []);
});
t('trend: slope, goal date, too little data, wrong direction', () => {
  const w = [['2026-01-01', 92], ['2026-01-08', 91.5], ['2026-01-15', 91], ['2026-01-22', 90.5]].map(([d, kg]) => ({ d, kg }));
  const r = S.trend(w, 75, '2026-01-22'); assert.strictEqual(r.perWeek, -0.5); assert.strictEqual(r.nowKg, 90.5); assert.strictEqual(r.etaDays, 217);
  assert.strictEqual(S.trend(w.slice(0, 2), 75, '2026-01-22'), null);
  assert.strictEqual(S.trend(w, 95, '2026-01-22').etaDays, null);
  assert.strictEqual(S.trend(w, 90.4, '2026-01-22').etaDays, 0);
});
t('setsByGroup: counts inside the range only', () => {
  const logs = [L('2026-01-05', 'a', 8, 10), L('2026-01-06', 'a', 8, 10), L('2026-01-06', 'b', 8, 10), L('2026-01-20', 'a', 8, 10), L('2026-01-06', 'zz', 8, 10)];
  assert.deepStrictEqual(S.setsByGroup(logs, { a: 'chest', b: 'back' }, '2026-01-05', '2026-01-11'), { chest: 2, back: 1 });
});
console.log(`\n${n} stats tests OK`);
