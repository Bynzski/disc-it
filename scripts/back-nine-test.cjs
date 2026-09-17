const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.route(/\/src\/main\.js(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nwindow.backTest={course,state,renderer,scene,camera,startHole,preview,finishHole,updateHUD};'});});
  await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.backTest);
  const data=await page.evaluate(()=>({holes:backTest.course.holes,colliders:backTest.course.colliders,environment:backTest.course.environment.placements}));
  const report=await page.evaluate(async()=>{
   const {distanceToSegment}=await import('/src/course/Layout.js');
   const {course}=backTest, conflicts=[],crossings=[];
   const paths=h=>[h.route,h.alternate].filter(Boolean);
   const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
   for(const h of course.holes.slice(9)){
    for(const p of course.environment.placements){
     const clearance=Math.min(...paths(h).flatMap(path=>path.slice(1).map((b,i)=>distanceToSegment(p.x,p.z,path[i],b))))-p.radius;
     if(clearance<2)conflicts.push({hole:h.id,asset:p.name,x:p.x,z:p.z,clearance});
    }
    for(const g of course.holes.filter(g=>g.id<h.id))for(const path of paths(h))for(const other of paths(g))
     for(let i=1;i<path.length;i++)for(let j=1;j<other.length;j++){
      const a=path[i-1],b=path[i],c=other[j-1],d=other[j];
      if(orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0)crossings.push([g.id,h.id]);
     }
   }
   return {conflicts,crossings,holes:course.holes.map(h=>({id:h.id,name:h.name,par:h.par,feet:h.lengthFeet})),placements:course.environment.placements.length};
  });
  console.log(JSON.stringify(report,null,2));
  assert.deepEqual(report.crossings,[],'no new fairway centerline crossings');
  assert.deepEqual(report.conflicts,[],'park props clear intended centerlines');
  if(process.env.FRONT_NINE_BASELINE){
   const baseline=JSON.parse(fs.readFileSync(process.env.FRONT_NINE_BASELINE));
   assert.deepEqual(data.holes.slice(0,9),baseline.holes,'front-nine data preserved');
   assert.deepEqual(data.environment,baseline.environment,'all established park assets preserved');
   assert.deepEqual(data.colliders.filter(c=>!c.holeId||c.holeId<=9),baseline.colliders,'front-nine colliders preserved');
  }
  for(const [name,width,height] of [['desktop',1280,800],['phone',390,844],['small-phone',320,568]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>{const t=backTest;t.renderer.setAnimationLoop(null);t.startHole(17);t.preview.skip();t.state.scores=Array(18).fill(4);t.state.throws=4;t.finishHole();t.updateHUD();t.renderer.render(t.scene,t.camera);});
   assert.equal(await page.locator('.pg-score-cell').count(),18);
   assert.equal(await page.locator('#pg-score-total').innerText(),'72');
   assert.match(await page.locator('#pg-final-eyebrow').innerText(),/TOCOBAGA PARK/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:`/tmp/back-nine-score-${name}.png`});
  }
  console.log('PASS: back-nine routing, park preservation, responsive 18-hole scorecard');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
