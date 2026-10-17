const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });const p=await b.newPage({viewport:{width:1300,height:900}});
await p.goto('http://localhost:8765/tests/diagrams.html');await p.waitForTimeout(300);
const h=await p.evaluate(()=>document.body.scrollHeight);
for(let i=0,y=0;y<h;i++,y+=1250){await p.screenshot({path:`/tmp/gt-shots/diag-${i}.png`,fullPage:true,clip:{x:0,y,width:1300,height:Math.min(1250,h-y)}});}
console.log('h',h);await b.close();})();
