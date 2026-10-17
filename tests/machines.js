const { chromium } = require('/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:1250,height:900},deviceScaleFactor:1.6});
await p.goto('http://localhost:8765/tests/machines.html');await p.waitForTimeout(300);
await p.screenshot({path:'/tmp/gt-shots/machines.png',fullPage:true});await b.close();})();
