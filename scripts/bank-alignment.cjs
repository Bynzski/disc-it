const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({args:['--no-sandbox']});
 try {
  const page = await browser.newPage();
  await page.route(/\/src\/main\.js(?:\?.*)?$/,async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:(await response.text())+'\nwindow.t={state,renderer,preview,startHole,throwDisc,updatePhysics,updateHUD,disc,THREE,colliders,course};'});
  });
  await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.t);
  const results=await page.evaluate(()=>{
   const t=window.t;t.renderer.setAnimationLoop(null);
   // Test-page-only clear field: identical launch, no trees/water/wind.
   t.colliders.length=0;t.course.water=[];
   const rows=[];
   for(const angle of [.38,-.38,0]) {
    t.startHole(0);t.preview.skip();
    Object.assign(t.state,{discType:'driver',aimYaw:Math.PI,elevation:7*Math.PI/180,releaseAngle:angle,power:1});
    t.state.lie.set(0,.08,0);t.updateHUD();
    const transform=getComputedStyle(document.querySelector('#pg-tilt-disc')).transform;
    const cssAngle=Math.atan2(new DOMMatrix(transform).b,new DOMMatrix(transform).a);
    t.throwDisc();const releaseBank=t.state.bank;
    // For heading PI, world +X is player-right. Sample the actual mesh normal.
    t.disc.update(t.state.position,t.state.bank,0,true,t.state.flightHeading);
    t.disc.mesh.updateMatrixWorld(true);
    const normal=new t.THREE.Vector3(0,1,0).transformDirection(t.disc.body.matrixWorld);
    let count=0;while(t.state.mode==='flying'&&count++<3600)t.updatePhysics(1/120);
    rows.push({angle,cssAngle,releaseBank,normalX:normal.x,position:t.state.position.toArray(),mode:t.state.mode,count});
   }
   return rows;
  });
  console.log(JSON.stringify(results,null,2));
  for(const r of results){
   assert.equal(r.releaseBank,r.angle);
   assert(Math.abs(r.cssAngle+r.angle)<.00001,'HUD must show left-edge-down for positive hyzer');
   assert(Math.abs(r.normalX+Math.sin(r.angle))<1e-9,'mesh normal must match banked lift');
   assert.equal(r.mode,'aiming');
   assert(r.position.every(Number.isFinite));
  }
  assert(results[0].position[0]<0,'22-degree hyzer must finish player-left');
  assert(results[1].position[0]>0,'22-degree anhyzer must finish player-right');
  console.log('PASS: HUD, mesh normal, release bank, and controlled flight agree.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
