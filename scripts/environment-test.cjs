// Requires Vite on localhost:5173. Screenshots and same-camera rendering budget.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(/\/src\/main\.js(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + '\nwindow.envTest={scene,renderer,camera,course,colliders,preview,state};' });
    });
    await page.goto('http://localhost:5173');
    await page.waitForFunction(() => !!window.envTest);
    const report = await page.evaluate(async () => {
      const { environmentClearance } = await import('/src/course/EnvironmentAssets.js');
      const { course, colliders, renderer, scene, camera } = envTest;
      renderer.setAnimationLoop(null);
      const { placements, batches } = course.environment;
      for (const p of placements) {
        if (!environmentClearance(p.x, p.z, p.radius, course.holes.slice(0, 9), colliders.filter(c => !c.holeId || c.holeId <= 9))) throw Error('Unsafe placement: ' + p.name);
      }
      // Same scene, viewport, camera, and shadow state on both passes.
      camera.position.set(-12, 18, 274); camera.lookAt(-18, 0, 232);
      function measure(visible) {
        batches.forEach(b => b.visible = visible);
        renderer.render(scene, camera);
        return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      }
      const baseline = measure(false), detailed = measure(true);
      return { baseline, detailed, placements: placements.length, batches: batches.length,
        names: [...new Set(placements.map(p => p.name))], zones: [...new Set(placements.map(p => p.zone))] };
    });
    assert.equal(report.names.length, 9, 'all nine prefab types placed');
    assert.equal(report.zones.length, 5, 'five park areas enriched');
    assert(report.detailed.calls - report.baseline.calls <= 50, 'bounded added draw calls');
    assert(report.detailed.triangles - report.baseline.triangles <= 10000, 'bounded added triangles');
    await page.evaluate(() => { document.querySelector('.pg-root').hidden = true; });
    await page.screenshot({ path: '/tmp/environment-pavilion.png' });
    await page.evaluate(() => {
      const { camera, scene, renderer } = envTest;
      camera.position.set(-58, 5, 188); camera.lookAt(-61, 1, 204); renderer.render(scene, camera);
    });
    await page.screenshot({ path: '/tmp/environment-playground.png' });
    await page.evaluate(() => { document.querySelector('.pg-root').hidden = false; });
    await page.locator('#pg-start-round').click();
    assert.equal(await page.evaluate(() => envTest.preview.active), true);
    await page.keyboard.press('Space');
    await page.locator('[data-disc="putter"]').click();
    assert.equal(await page.evaluate(() => envTest.state.discType), 'putter');
    assert.equal(await page.evaluate(() => envTest.state.throws), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(report, null, 2));
    console.log('PASS: asset placement, render budget, screenshots, course start and disc selection');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
