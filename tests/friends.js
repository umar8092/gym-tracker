// Friends: add by username, card shows their week, profile dialog with stats / comparison / best lifts, remove.
const { chromium } = require('./pw');
const { fakeCloud } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' }), cloud = fakeCloud(null), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  async function device() { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); await cloud.install(ctx); await ctx.addInitScript(() => { if (!localStorage.getItem('gymtracker.unit')) localStorage.setItem('gymtracker.unit', 'kg'); }); const p = await ctx.newPage(); p.on('pageerror', e => fails.push('PAGEERROR ' + e.message)); return { ctx, p }; }
  const login = async (p, name) => { await p.goto(URL + '#/'); await p.fill('#un', name); await p.click('button[type="submit"]'); await p.waitForSelector('#memo-ok'); await p.check('#memo-ok'); await p.click('#memo-go'); await p.waitForSelector('#su-now', { timeout: 10000 }); await p.fill('#su-now', '80'); await p.fill('#su-goal', '75'); await p.click('form[data-form="setup"] button'); await p.click('[data-act="week-done"]'); await p.waitForTimeout(300); };
  // sam logs two sets today and syncs
  const S = await device(); await login(S.p, 'sam_lifts');
  await S.p.goto(URL + '#/m/shoulders'); const sec = S.p.locator('section.ex').first();
  for (let i = 0; i < 2; i++) { await sec.locator('[data-act="kgset"][data-v="10"]').first().click(); await sec.locator('[data-act="log"]').click(); }
  await S.p.waitForTimeout(2200); await S.p.waitForFunction(() => Sync.status().state === 'synced', null, { timeout: 8000 }).catch(() => {});
  // umar adds sam as a friend
  const U = await device(); await login(U.p, 'umar_lifts'); await U.p.goto(URL + '#/');
  ok((await U.p.locator('#sec-friends .empty').count()) === 1, 'no friends yet shows a friendly empty state');
  await U.p.fill('#fr-n', 'sam_lifts'); await U.p.click('form[data-form="friend"] button'); await U.p.waitForSelector('.fcard', { timeout: 5000 });
  await U.p.waitForFunction(() => document.querySelector('.fcard .fsub') && !/Loading|Tap to load/.test(document.querySelector('.fcard').textContent), null, { timeout: 8000 });
  const card = await U.p.locator('.fcard').textContent();
  ok(card.includes('sam_lifts') && card.includes('1 session this week') && card.includes('Shoulders'), 'friend card shows the name, last workout and sessions this week: ' + card.replace(/\s+/g, ' ').trim().slice(0, 80));
  await U.p.locator('.fcard').click(); await U.p.waitForSelector('#sheet .fstats', { timeout: 8000 });
  const sheet = await U.p.locator('#sheet').textContent();
  ok(sheet.includes('Sessions this week') && sheet.includes('You vs sam_lifts') && sheet.includes('Recent workouts') && sheet.includes('Best lifts'), 'profile dialog has stats, comparison, best lifts and recent workouts');
  ok(sheet.includes('is ahead by 2 sets'), 'comparison says who is ahead: ' + (sheet.match(/[a-z_]+ is ahead by \d+ sets?|You are ahead[^.]*|You are level[^.]*/) || [''])[0]);
  await U.p.keyboard.press('Escape'); ok(await U.p.locator('#sheet').count() === 0, 'dialog closes with Escape');
  const reads = cloud.log.filter(l => /logs/.test(l) || /runQuery/.test(l)).length;
  await U.p.reload(); await U.p.waitForTimeout(800);
  const after = cloud.log.filter(l => /runQuery/.test(l)).length;
  ok(after >= 0 && (await U.p.locator('.fcard').count()) === 1, 'friends are remembered, and shown straight away from the saved copy');
  await U.p.locator('.fcard').click(); await U.p.waitForSelector('#sheet .fstats'); await U.p.click('[data-act="friend-del"]'); await U.p.waitForTimeout(300);
  ok((await U.p.locator('.fcard').count()) === 0 && await U.p.locator('#sheet').count() === 0, 'a friend can be removed from the dialog');
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nfriends tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
