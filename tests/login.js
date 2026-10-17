// Sign-in screen: live rules, counter, ideas, strength hint, the "remember it" step, offline escape, loading screen.
const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const { fakeCloud } = require('./helpers');
const URL = process.env.URL || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' }), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
  async function open(down) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), cloud = fakeCloud(null); await cloud.install(ctx); cloud.down = down;
    const p = await ctx.newPage(); p.on('pageerror', e => fails.push('PAGEERROR ' + e.message)); await p.goto(URL + '#/'); return { p, ctx, cloud };
  }
  let { p } = await open(false);
  ok((await p.locator('.intro').textContent()).includes('hard to guess') && (await p.locator('.note').textContent()).includes('Keep it private'), 'login explains: personal, hard to guess, no password');
  await p.fill('#un', 'ab'); ok((await p.locator('#un-count').textContent()) === '2 / 20', 'live character counter');
  await p.fill('#un', 'Iron Wolf!'); ok((await p.inputValue('#un')) === 'ironwolf' && (await p.locator('#un-hint').textContent()).includes('left out'), 'capitals and symbols are cleaned as you type, with a hint');
  await p.fill('#un', 'abcdefghijklmnopqrstuvwxyz'); ok((await p.inputValue('#un')).length === 20 && (await p.locator('#un-count').textContent()).includes('limit reached') && await p.locator('#un-count.limit').count() === 1, 'at 20 characters the counter turns red and says the limit is reached');
  await p.fill('#un', 'umar'); ok((await p.locator('#un-str').textContent()).includes('Easy to guess'), 'short names are flagged as easy to guess');
  await p.fill('#un', 'ironwolf482'); ok((await p.locator('#un-str').textContent()).includes('Hard to guess'), 'a longer name with a number is called hard to guess');
  const chips = await p.locator('#un-chips .chip').evaluateAll(a => a.map(x => x.dataset.v));
  ok(chips.length === 3 && chips.every(n => /^[a-z0-9_]{3,20}$/.test(n)), 'three valid username ideas are offered: ' + chips.join(', '));
  await p.locator('#un-chips .chip').first().click(); ok((await p.inputValue('#un')) === chips[0], 'tapping an idea fills the username');
  await p.click('[data-act="shuffle-names"]'); ok((await p.locator('#un-chips .chip').count()) === 3, 'ideas can be shuffled');
  // remember step
  await p.fill('#un', 'ironwolf482'); await p.click('button[type="submit"]'); await p.waitForSelector('#memo-ok');
  ok((await p.locator('#memo-name').textContent()) === 'ironwolf482' && await p.locator('#memo-go').isDisabled(), 'remember step shows the name and blocks Continue until it is ticked');
  await p.click('.crumb'); await p.waitForSelector('#un'); ok((await p.locator('#un').count()) === 1, 'change username goes back to the form');
  await p.fill('#un', 'ironwolf482'); await p.click('button[type="submit"]'); await p.waitForSelector('#memo-ok'); await p.check('#memo-ok');
  ok(!(await p.locator('#memo-go').isDisabled()), 'ticking the box enables Continue');
  await p.click('#memo-go'); await p.waitForSelector('form[data-form="setup"]', { timeout: 8000 }); ok(true, 'continuing signs in and reaches the setup screen');
  await p.fill('#su-now', '92'); await p.fill('#su-goal', '75'); await p.click('form[data-form="setup"] button[type="submit"]'); await p.waitForTimeout(300);
  ok((await p.locator('.routine li').count()) === 5 && (await p.locator('h1').textContent()).includes('Your week') && await p.locator('.sched').count() === 0, 'after setup a normal 5-day routine is shown, the editor is hidden');
  ok((await p.locator('[data-act="week-open"]').textContent()).includes('optional'), 'customising is marked optional');
  await p.click('[data-act="week-open"]'); ok((await p.locator('.sched-day').count()) === 7 && (await p.locator('.preset').count()) === 6, 'customise opens templates and a row for each of the 7 days');
  await p.click('[data-act="sched-preset"][data-id="three"]'); ok((await p.locator('.sched-sum').textContent()).includes('3 training days'), 'choosing the 3-day template updates the summary');
  await p.click('.sched-day:nth-child(7) [data-m="legs"]'); ok((await p.locator('.sched-sum').textContent()).includes('4 training days'), 'tapping a muscle on Sunday adds a training day');
  await p.click('[data-act="week-reset"]'); ok((await p.locator('.routine li').count()) === 5, 'back to the normal routine');
  await p.click('[data-act="week-done"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/plan'; }); await p.waitForTimeout(400); await p.evaluate(() => { document.querySelectorAll('details.fold').forEach(d => { d.open = true; }); });
  ok((await p.locator('.sec:has(h2:text-is("Account"))').textContent()).includes('only key to your workouts'), 'account section repeats the keep-it-safe reminder');
  await p.context().close();
  // no connection: clear message, offline option
  ({ p } = await open(true));
  await p.fill('#un', 'ironwolf482'); await p.click('button[type="submit"]'); await p.waitForSelector('#memo-ok'); await p.check('#memo-ok'); await p.waitForTimeout(600);
  ok((await p.locator('#login-err').textContent()).includes('Could not reach the cloud') && await p.locator('#offline-go').isVisible(), 'no connection: says so and offers to continue offline');
  await p.click('#offline-go'); await p.waitForSelector('form[data-form="setup"]', { timeout: 8000 }); ok(true, 'continue offline reaches setup without the cloud');
  await p.context().close();
  console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nlogin tests OK'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
