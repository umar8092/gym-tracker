// Loads the site, waits for the service worker, goes offline, reloads: the app, fonts and saved data must still work.
const { chromium } = require('./pw');
(async()=>{const b=await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[],ext=[]; await require('./helpers').signIn(p);
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED/.test(m.text()))errs.push(m.text())});
p.on('request',r=>{if(!r.url().startsWith('http://localhost')&&!/googleapis/.test(r.url()))ext.push(r.url())});
await p.goto('http://localhost:8765/index.html#/m/chest');
await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForTimeout(800);
await p.locator('[data-act="kgset"][data-v="10"]').first().click();await p.locator('[data-act="log"]').first().click();
await ctx.setOffline(true);await p.reload();await p.waitForTimeout(500);
const ok=await p.evaluate(()=>({h1:document.querySelector('h1').textContent,sets:document.querySelectorAll('.sets li').length,font:document.fonts.check('700 20px "Barlow Condensed"')}));
console.log(JSON.stringify(ok),'external requests:',ext.length?ext.join(','):'none','errors:',errs.join('|')||'none');await b.close();})();
