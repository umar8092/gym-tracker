// Your data: CSV export, calendar reminders (.ics), delete from the cloud, privacy, problem report text.
const { chromium } = require('./pw');
const { fakeCloud } = require('./helpers');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' }), cloud = fakeCloud(null), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, reducedMotion: 'reduce' }); await cloud.install(ctx); await ctx.addInitScript(() => { if (!localStorage.getItem('gymtracker.unit')) localStorage.setItem('gymtracker.unit', 'kg'); });
  const p = await ctx.newPage(); p.on('pageerror', e => fails.push('PAGEERROR ' + e.message));
  await p.goto(URL + '#/'); await p.fill('#un', 'data_tester'); await p.click('button[type="submit"]'); await p.waitForSelector('#memo-ok'); await p.check('#memo-ok'); await p.click('#memo-go'); await p.waitForSelector('#su-now', { timeout: 10000 });
  await p.fill('#su-now', '80'); await p.fill('#su-goal', '75'); await p.click('form[data-form="setup"] button'); await p.click('[data-act="week-done"]'); await p.waitForTimeout(300);
  await p.goto(URL + '#/m/chest/1'); const sec = p.locator('section.ex').first(); for (let i = 0; i < 2; i++) { await sec.locator('[data-act="kgset"][data-v="10"]').first().click(); await sec.locator('[data-act="log"]').click(); }
  await p.waitForTimeout(2300); await p.waitForFunction(() => Sync.status().state === 'synced', null, { timeout: 8000 }).catch(() => {});
  ok([...cloud.docs.keys()].some(k => k.startsWith('/users/data_tester/logs/')), 'precondition: data reached the cloud');
  await p.goto(URL + '#/plan'); await p.evaluate(() => document.querySelectorAll('details.fold').forEach(d => { d.open = true; }));
  let [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="csv"][data-k="workouts"]')]); let csv = fs.readFileSync(await dl.path(), 'utf8');
  ok(csv.includes('date,muscle,exercise,set,reps,weight_kg,weight_lb') && csv.split('\r\n').length === 3 && csv.includes('Barbell bench press,1,') && csv.includes(',10,22'), 'workouts CSV has a header and one row per set with kg and lb');
  [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="csv"][data-k="weights"]')]); csv = fs.readFileSync(await dl.path(), 'utf8');
  ok(csv.includes('date,weight_kg,weight_lb') && csv.includes(',80,176.4'), 'weights CSV exported');
  await p.fill('#rm-t', '07:30'); [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="ics"]')]); const ics = fs.readFileSync(await dl.path(), 'utf8');
  ok(ics.startsWith('BEGIN:VCALENDAR') && (ics.match(/BEGIN:VEVENT/g) || []).length === 5 && ics.includes('RRULE:FREQ=WEEKLY;BYDAY=MO') && /DTSTART:\d{8}T073000/.test(ics) && ics.includes('TRIGGER:-PT15M') && ics.includes('SUMMARY:Gym: Chest'), 'reminders file: 5 weekly events at 07:30 with a 15 minute alert');
  ok((await p.locator('.sec:has(h2:text-is("Your data"))').textContent()).includes('Privacy') && (await p.locator('.sec:has(h2:text-is("Your data"))').textContent()).includes('No email, no password'), 'a plain privacy note is shown');
  // problem report has no username, has version
  let opened = null; await p.context().route(/github\.com/, r => r.abort()); await p.evaluate(() => { window.open = (u) => { window.__u = u; }; });
  await p.fill('#rq-x', 'Please add cable fly'); await p.click('[data-act="req-send"]'); const url = decodeURIComponent(await p.evaluate(() => window.__u));
  ok(url.includes('gym-v') && !url.includes('data_tester'), 'problem report includes the app version and never the username');
  // delete: wrong name is refused, right name wipes cloud + device
  await p.click('[data-act="delete-open"]'); await p.fill('#del-n', 'wrong'); await p.click('[data-act="delete-go"]');
  ok((await p.locator('#del-err').textContent()).includes('not your username') && [...cloud.docs.keys()].some(k => k.startsWith('/users/data_tester/')), 'a wrong username does not delete anything');
  await p.fill('#del-n', 'data_tester'); await p.click('[data-act="delete-go"]'); await p.waitForSelector('form[data-form="login"]', { timeout: 8000 });
  ok(![...cloud.docs.keys()].some(k => k.startsWith('/users/data_tester/')), 'deleting removes every cloud document of the user');
  ok(await p.evaluate(() => !localStorage.getItem('gymtracker.user')), 'and signs the person out of this device');
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\ndata tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
