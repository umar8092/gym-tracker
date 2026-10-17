// Seeds 4 weeks of fake history, then screenshots today / calendar / progress to check charts and statuses.
const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  const seed = () => {
    const pad = n => (n < 10 ? '0' : '') + n, ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const plan = { 1: ['chest', 'barbell-bench-press'], 2: ['back', 'barbell-row'], 3: ['legs', 'barbell-squat'], 4: ['shoulders', 'overhead-press'], 5: ['arms', 'barbell-curl'] };
    const logs = [], weights = []; let id = 1; const start = new Date(2026, 8, 14), end = new Date(2026, 9, 14);
    for (let d = new Date(start), i = 0; d <= end; d.setDate(d.getDate() + 1), i++) {
      const p = plan[d.getDay()]; if (!p) continue;
      if (i % 9 === 4) continue; // a few missed days
      for (let s = 0; s < 3; s++) logs.push({ id: id++, d: ymd(d), m: p[0], e: p[1], reps: 10 - s, kg: 20 + Math.floor(i / 7) * 2.5, ts: d.getTime() + s });
    }
    for (let k = 0; k < 5; k++) { const d = new Date(2026, 8, 14 + k * 7); weights.push({ d: ymd(d), kg: 92 - k * 0.9 }); }
    localStorage.setItem('gymtracker.user', 'umar'); localStorage.setItem('gymtracker.v1', JSON.stringify({ profile: { startKg: 92, goalKg: 75, startDate: '2026-09-14' }, weights, logs, hidden: {}, nextId: id }));
  };
  await page.context().route(/googleapis\.com/, r => r.abort());
  await page.addInitScript(seed);
  await page.clock.install({ time: new Date('2026-10-15T09:00:00') });
  for (const r of ['', 'calendar', 'progress']) { await page.goto('http://localhost:8765/index.html#/' + r); await page.waitForTimeout(250); await page.screenshot({ path: `/tmp/gt-shots/seed-${r || 'today'}.png`, fullPage: true }); }
  console.log(errs.length ? errs.join('\n') : 'seeded OK'); await b.close();
})();
