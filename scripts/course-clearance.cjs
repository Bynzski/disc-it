// Diagnostic only: report nearest physical obstacles without changing geometry.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({args:['--no-sandbox']});
 try {
  const page = await browser.newPage();
  await page.route(/\/src\/main\.js(?:\?.*)?$/, async r => {
   const response = await r.fetch();
   await r.fulfill({response, body: await response.text()+'\nwindow.clearanceTest={course};'});
  });
  await page.goto('http://localhost:5173');
  await page.waitForFunction(()=>!!window.clearanceTest);
  console.log(JSON.stringify(await page.evaluate(()=>{
   const {holes,colliders,water}=clearanceTest.course;
   return holes.slice(9).map(h=>({hole:h.id,points:h.route.map(([x,z],i)=>({
    point:i===0?'tee':i===h.route.length-1?'basket':`waypoint ${i}`,x,z,
    nearest:colliders.map(c=>({kind:c.kind,hole:c.holeId,role:c.role,
     clearance:Math.hypot(x-(c.x??c.center.x),z-(c.z??c.center.z))-(c.canopyRadius??Math.max(c.radii.x,c.radii.z))
    })).sort((a,b)=>a.clearance-b.clearance).slice(0,3),
    water:Math.min(...water.map(p=>Math.hypot(x-p.x,z-p.z)-p.radius))
   }))}));
  }),null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
