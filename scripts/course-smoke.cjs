// Browser integration smoke test; hooks are injected only into the test page.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.stack));
    await page.route(/\/src\/main\.js(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.testCourse={state,course,holes,colliders,renderer,scene,camera,disc,THREE,startHole,throwDisc,updatePhysics,updateHUD,nextHole,restartHole,updateCamera,preview};' });
    });
    await page.goto('http://localhost:5173');
    await page.waitForFunction(() => !!window.testCourse);
    const report = await page.evaluate(() => {
      const t = testCourse;
      t.renderer.setAnimationLoop(null);
      const results = [];
      for (let h = 0; h < 9; h++) {
        t.startHole(h);
        t.preview.skip(); // Throw controls are gated during the intro flyover.
        Object.assign(t.state, { discType: 'driver', power: 1, elevation: .32 });
        t.throwDisc();
        let steps = 0;
        while (t.state.mode === 'flying' && steps++ < 2400) t.updatePhysics(1 / 120);
        if (t.state.mode === 'flying') throw Error(`Hole ${h+1}: failed to settle`);
        results.push({ hole: h+1, mode: t.state.mode, steps });
      }
      const clearance = t.holes.map(h => {
        const trees = t.colliders.filter(c => c.kind === 'tree');
        const tee = Math.min(...trees.map(c => Math.hypot(c.x-h.tee.x,c.z-h.tee.z)-c.canopyRadius));
        const green = Math.min(...trees.map(c => Math.hypot(c.x-h.basket.x,c.z-h.basket.z)-c.canopyRadius));
        const next = t.holes[h.id % t.holes.length];
        const walk = Math.hypot(next.tee.x-h.basket.x,next.tee.z-h.basket.z);
        if (tee < 5 || green < 4 || walk > 25) throw Error(`Clearance/connection failed: ${h.id}`);
        return { hole: h.id, tee: +tee.toFixed(1), green: +green.toFixed(1), nextTeeMeters: +walk.toFixed(1) };
      });
      // A short real throw toward water must cost the throw plus one penalty,
      // retain the previous lie, stop spin, and leave scoring/controls usable.
      t.startHole(6);
      t.preview.skip();
      const previous = t.state.lie.clone();
      const water = t.course.water[0];
      Object.assign(t.state, {discType:'midrange',power:.6,elevation:.5,
        aimYaw:Math.atan2(water.x-previous.x,water.z-previous.z)});
      t.throwDisc();
      for (let k=0;k<2400 && t.state.mode==='flying';k++) t.updatePhysics(1/120);
      if (t.state.throws!==2 || t.state.lie.distanceTo(previous)>.001 || t.state.mode!=='aiming' || t.state.spinRate!==0)
        throw Error('Water penalty/rethrow failed');
      const waterTest = { score:t.state.throws, mode:t.state.mode, retainedLie:true };
      t.restartHole();
      if (t.state.throws!==0) throw Error('Restart after water failed');
      return { results, clearance, waterTest, pars: t.holes.map(h => h.par), trees:t.colliders.filter(c=>c.kind==='tree').length };
    });
    assert.deepEqual(errors, []);
    assert.equal(report.pars.reduce((sum,par)=>sum+par,0),32);
    // Render every tee, not just the last test state.
    for (let i=0;i<9;i++) {
      await page.evaluate(i=>{const t=testCourse;t.startHole(i);t.preview.skip();t.updateCamera(1);t.updateHUD();t.renderer.render(t.scene,t.camera);},i);
      await page.screenshot({path:`/tmp/course-tee-${i+1}.png`});
    }
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
