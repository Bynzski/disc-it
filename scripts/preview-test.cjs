// Only preview behavior: no course redesign tests or throw-optimization bot.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.route(/\/src\/main\.js(?:\?.*)?$/,async route=>{
   const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.t={preview,state,camera,renderer,scene,holes,colliders,startHole,nextHole,finishHole,throwDisc,updateCamera,updateHUD};'});
  });
  await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.t);
  assert.equal(await page.evaluate(()=>t.preview.active),true,'new round preview');
  const report=await page.evaluate(()=>{
   t.renderer.setAnimationLoop(null);
   const report=[];
   for(let h=0;h<9;h++){
    t.startHole(h);const p=t.preview;const collisions=[];let minY=Infinity,maxY=0;
    for(let i=0;i<=400;i++){
     const {position:v,target}=p.sample(i/400);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
     for(const c of t.colliders){
      if(c.kind==='tree'){
       const r=v.y>(c.canopyBottom??1.8)?c.canopyRadius:c.trunkRadius;
       if(v.y<c.height+.25&&Math.hypot(v.x-c.x,v.z-c.z)<r+.45)collisions.push({i,role:c.role,x:c.x,z:c.z,y:v.y});
      }else if(c.kind==='rock'){
       const v2=v.clone().sub(c.center).divide(c.radii.clone().addScalar(.45));if(v2.length()<1)collisions.push({i,role:'rock'});
      }
     }
     // Pavilion footprint/roof incl. margin (only structure near a route).
     if(Math.abs(v.x+28)<5.5&&Math.abs(v.z-248)<4&&v.y<5)collisions.push({i,role:'pavilion'});
     if(!v.toArray().every(Number.isFinite)||target.distanceTo(v)<.1)throw Error('Invalid camera sample');
    }
    // Move through the actual sequence and verify it cuts to tee and restores FOV.
    const yaw=t.state.aimYaw,lie=t.state.lie.clone();
    for(let i=0;i<500&&p.active;i++)p.update(1/60);
    if(p.active||t.state.mode!=='aiming'||t.camera.fov!==58||t.state.aimYaw!==yaw||t.state.lie.distanceTo(lie)>0||t.state.throws!==0)throw Error('End transition failed '+h);
    report.push({hole:h+1,duration:p.duration,minY,maxY,collisions:collisions.slice(0,8),collisionCount:collisions.length});
   }
   return report;
  });
  console.log(JSON.stringify(report,null,2));
  assert(report.every(r=>r.collisionCount===0),'camera path must clear obstacles');
  assert(report.every(r=>r.minY>3&&r.maxY<8&&r.duration>=4&&r.duration<=7));
  // Input suppression and every skip mechanism, early/middle/late.
  for(const [index,skip]of ['Space','Enter','Escape','click'].entries()){
   await page.evaluate(i=>{t.startHole(i);t.preview.update(t.preview.travelDuration*(i/4));},index);
   const before=await page.evaluate(()=>({yaw:t.state.aimYaw,elevation:t.state.elevation,disc:t.state.discType,hole:t.state.holeIndex}));
   await page.keyboard.press('3');await page.keyboard.press('v');await page.keyboard.press('r');
   await page.mouse.wheel(0,100);await page.mouse.move(400,300);
   assert.deepEqual(await page.evaluate(()=>({yaw:t.state.aimYaw,elevation:t.state.elevation,disc:t.state.discType,hole:t.state.holeIndex})),before);
   await page.evaluate(()=>t.throwDisc());assert.equal(await page.evaluate(()=>t.state.throws),0);
   if(skip==='click')await page.mouse.click(650,300);else await page.keyboard.press(skip);
   assert.equal(await page.evaluate(()=>t.preview.active),false);
   assert.equal(await page.evaluate(()=>t.state.mode),'aiming');
   assert.equal(await page.evaluate(()=>t.state.charging),false);
   assert.equal(await page.evaluate(()=>!!document.pointerLockElement),false);
   assert.equal(await page.evaluate(()=>t.state.throws),0);
  }
  // Current replay, next hole, new round; no preview after an ordinary throw.
  await page.keyboard.press('r');assert.equal(await page.evaluate(()=>t.preview.active),true);
  await page.keyboard.press('Space');
  await page.mouse.click(650,300);await page.waitForFunction(()=>t.state.mouseCaptured);
  await page.mouse.down();await page.waitForTimeout(100);await page.mouse.up();
  assert.equal(await page.evaluate(()=>t.state.throws),1);assert.equal(await page.evaluate(()=>t.preview.active),false);
  await page.evaluate(()=>{t.finishHole();t.nextHole();});assert.equal(await page.evaluate(()=>t.preview.active),true);
  await page.evaluate(()=>{t.startHole(8);t.preview.skip();t.finishHole();t.nextHole();});
  assert.equal(await page.evaluate(()=>t.state.holeIndex),0);assert.equal(await page.evaluate(()=>t.preview.active),true);
  // Render midpoint and final basket framing for every preview.
  for(let i=0;i<9;i++){
   for(const [label,fraction]of [['mid',.5],['basket',1]]){
    await page.evaluate(({i,fraction})=>{t.startHole(i);t.preview.update(t.preview.travelDuration*fraction);t.renderer.render(t.scene,t.camera);},{i,fraction});
    await page.screenshot({path:`/tmp/preview-${i+1}-${label}.png`});
   }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: nine preview paths, obstacle clearance, automatic end, skip keys/click, input isolation, replay/advance/new round, gameplay restoration.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
