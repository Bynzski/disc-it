const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({args:['--no-sandbox']});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.stack));
  await page.route(/\/src\/main\.js(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text())+'\nwindow.t={state,holes,colliders,course,renderer,scene,camera,disc,THREE,startHole,throwDisc,updatePhysics,updateHUD,nextHole,restartHole,updateCamera,hud,preview};'});});
  await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.t);
  await page.evaluate(()=>{t.renderer.setAnimationLoop(null);t.hud.toast=()=>{};window.playHole=()=>{
   const s=t.state,h=t.holes[s.holeIndex], trace=[];t.preview.skip();
   const originalToast=t.hud.toast; let hits=0;t.hud.toast=text=>{if(/kick|branches/.test(text))hits++;};
   function save(){return Object.fromEntries(Object.entries(s).map(([k,v])=>[k,v?.isVector3?v.clone():Array.isArray(v)?v.slice():v]));}
   function restore(snapshot){for(const [k,v]of Object.entries(snapshot))s[k]=v?.isVector3?v.clone():Array.isArray(v)?v.slice():v;}
   function shot(type,power,elevation,yaw,bank=0){Object.assign(s,{discType:type,power,elevation,aimYaw:yaw,releaseAngle:bank});hits=0;t.throwDisc();let k=0;while(s.mode==='flying'&&k++<900)t.updatePhysics(1/60);if(s.mode==='flying')throw Error('Never settled');return hits;}
   const teeSnapshot=save();const pinYaw=Math.atan2(h.basket.x-s.lie.x,h.basket.z-s.lie.z);
   const directHits=shot('driver',1,.32,pinYaw);const directRemaining=s.lie.distanceTo(h.basket)*3.05;restore(teeSnapshot);
   // Walk the designed centerline by making real physics throws from each lie.
   // Search release choices, not lie positions. Never force a basket capture.
   let waypoint=1;
   for(let stroke=0;stroke<18&&!s.finished;stroke++){
    while(waypoint<h.route.length-1&&Math.hypot(s.lie.x-h.route[waypoint][0],s.lie.z-h.route[waypoint][1])<18)waypoint++;
    const target=waypoint===h.route.length-1?h.basket:new t.THREE.Vector3(h.route[waypoint][0],.08,h.route[waypoint][1]);
    const distance=s.lie.distanceTo(target),yaw=Math.atan2(target.x-s.lie.x,target.z-s.lie.z);
    const snapshot=save();let best=null;
    const types=distance<16?['putter']:distance<48?['putter','midrange']:['midrange','driver'];
    const powers=distance<8?[.08,.12,.18,.25,.35,.45]:[.25,.4,.55,.7,.85,1];
    const elevations=distance<8?[0,.05]:[.12,.25,.38];
    for(const type of types)for(const power of powers)for(const elevation of elevations)for(const offset of [-.2,-.1,0,.1,.2]){
     restore(snapshot);const collisions=shot(type,power,elevation,yaw+offset);
     const remain=s.lie.distanceTo(target);
     const cost=s.finished?-1000:remain+collisions*1.5;
     if(!best||cost<best.cost)best={cost,type,power,elevation,yaw:yaw+offset,collisions,remain};
    }
    restore(snapshot);shot(best.type,best.power,best.elevation,best.yaw);
    trace.push({disc:best.type,power:best.power,waypoint,remaining:Math.round(best.remain),hits:best.collisions,lie:s.lie.toArray()});
   }
   t.hud.toast=originalToast;t.updateHUD();
   return {hole:h.id,par:h.par,finished:s.finished,score:s.throws,directHits,directRemaining:Math.round(directRemaining),trace};
  };});
  const rows=[];
  const count=await page.evaluate(()=>t.holes.length);
  for(let i=0;i<count;i++){
   const row=await page.evaluate(()=>playHole());rows.push(row);console.log(JSON.stringify(row));
   assert(row.finished,`Hole ${i+1} cannot complete`);
   if(i<count-1){await page.locator('#pg-next').click();await page.waitForFunction(index=>t.state.holeIndex===index,i+1);}
  }
  assert.equal(await page.locator('#pg-final-title').innerText(),'Round complete');
  assert.equal(await page.locator('#pg-score-total').innerText(),String(rows.reduce((sum,r)=>sum+r.score,0)));
  await page.screenshot({path:'/tmp/redesigned-scorecard.png'});
  await page.locator('#pg-next').click();
  assert.deepEqual(await page.evaluate(()=>t.state.scores),Array(count).fill(null));
  await page.evaluate(()=>{t.updateCamera(1);t.renderer.render(t.scene,t.camera);t.updateHUD();});
  await page.screenshot({path:'/tmp/redesigned-tee.png'});
  assert.deepEqual(errors,[]);
  require('node:fs').writeFileSync('/tmp/redesigned-round.json',JSON.stringify(rows,null,2));
  console.log('PASS: eighteen real tee-to-basket physics sequences, next-hole UI, final totals, new round.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
