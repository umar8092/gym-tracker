const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts\.g/.test(m.text()))errs.push(m.text())});
await p.goto('http://localhost:8765/index.html#/m/back');await p.waitForTimeout(300);
await p.locator('section.ex').nth(2).screenshot({path:'/tmp/gt-shots/mach-workout.png'});
await p.goto('http://localhost:8765/index.html#/plan');await p.waitForTimeout(300);
const d=p.locator('.plan-item details').first();await d.locator('summary').click();await p.waitForTimeout(200);
await d.locator('xpath=..').screenshot({path:'/tmp/gt-shots/mach-plan.png'});
console.log('summaries',await p.locator('.plan-item details').count(),errs.join('|')||'no errors');await b.close();})();
