const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try {
  for(const format of ['front','back','all']){
   const page=await browser.newPage({viewport:{width:1280,height:800}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route(/\/src\/main\.js(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nwindow.roundTest={state,holes,preview,finishHole,nextHole,updateHUD};'});});
   await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.roundTest);
   assert.equal(await page.locator('[data-round-format="all"]').getAttribute('aria-checked'),'true','all 18 defaults selected');
   if(format!=='all')await page.locator(`[data-round-format="${format}"]`).click();
   const expected=format==='all'?18:9, first=format==='back'?10:1, last=format==='front'?9:18;
   await page.locator('#pg-start-round').click();await page.waitForFunction(()=>roundTest.preview.active);await page.keyboard.press('Space');
   assert.equal(await page.locator('#pg-hole-number').innerText(),String(first).padStart(2,'0'));
   assert.equal(await page.evaluate(()=>roundTest.state.scores.length),expected);
   for(let i=0;i<expected;i++)await page.evaluate(()=>{roundTest.state.throws=3;roundTest.finishHole();roundTest.nextHole();roundTest.preview.skip();});
   assert.equal(await page.locator('#pg-hole-number').innerText(),String(first).padStart(2,'0'),'new round retains selected format');
   assert.equal(await page.evaluate(()=>roundTest.state.scores.length),expected);
   assert.deepEqual(errors,[]);
   console.log(`PASS: ${format} round runs holes ${first}–${last} and restarts in the same format`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
