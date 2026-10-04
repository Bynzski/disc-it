// Requires the Vite dev server on http://localhost:5173 (override with PORT_URL) and Playwright.
// Pure-Node checks of the same course (scenery clearance, determinism, budgets) live in
// scripts/thunderbird-routing-test.cjs and need neither.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const { THUNDERBIRD_HOLES, thunderbirdHeight, thunderbirdSurfaceHeight } = await import('../src/course/ThunderbirdCourse.js');
  for (const h of THUNDERBIRD_HOLES) for (const [x, z] of h.route) assert(thunderbirdSurfaceHeight(x, z) - thunderbirdHeight(x, z) > .07, 'fairway physics surface must cover its visual ribbon');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/\/src\/main\.js(?:\?.*)?$/, async r => {
      const q = await r.fetch();
      await r.fulfill({ response: q, body: await q.text() + '\nwindow.tb={preview,state,get holes(){return holes},get course(){return course},get colliders(){return colliders},startHole,renderer,scene,camera}' });
    });
    await page.goto(process.env.PORT_URL || 'http://localhost:5173');
    await page.locator('[data-course="thunderbird"]').click();
    assert.match(await page.locator('#pg-round-summary').innerText(), /18 Holes.*Par 57.*5285 ft/);
    const dressing = await page.evaluate(() => tb.course.environment.dressing);
    assert(dressing.length >= 30 && new Set(dressing.map(p => p.type)).size >= 6, 'desert dressing should stay varied and intentional');
    assert.equal(await page.evaluate(() => tb.colliders.filter(c => c.role === 'basket-shelf').length), 18, 'every basket shelf exposes collision metadata');

    // Scenery: instanced, varied, dense, and cheap to draw.
    const scenery = await page.evaluate(() => {
      const s = tb.course.environment.scenery, types = new Set(s.placements.map(p => p.type));
      tb.renderer.setAnimationLoop(null);
      tb.renderer.info.reset(); tb.renderer.render(tb.scene, tb.camera);
      return { placements: s.placements.length, types: types.size, batches: s.batches.length, instanced: s.batches.every(b => b.isInstancedMesh), calls: tb.renderer.info.render.calls, triangles: tb.renderer.info.render.triangles, mesas: s.mesas.length, washes: s.wash.length, ground: !!s.groundDetail };
    });
    assert(scenery.placements >= 2500 && scenery.types >= 20 && scenery.instanced && scenery.batches <= 70, 'dense instanced desert scenery');
    assert(scenery.mesas >= 20 && scenery.washes >= 3 && scenery.ground, 'horizon mesas, dry washes and ground patches present');
    assert(scenery.calls < 900, `render calls stay bounded (${scenery.calls}; 540 of them are basket chain lines from Basket.js)`);
    assert(scenery.triangles < 480000, `triangle budget (${scenery.triangles})`);

    await page.locator('#pg-start-round').click();
    await page.waitForFunction(() => tb.preview.active);
    const report = await page.evaluate(() => {
      tb.renderer.setAnimationLoop(null);
      return tb.holes.map((h, index) => {
        tb.startHole(index);
        let min = Infinity, rocks = 0;
        for (let i = 0; i <= 300; i++) {
          const p = tb.preview.sample(i / 300).position;
          min = Math.min(min, p.y - tb.course.groundHeight(p.x, p.z));
          for (const c of tb.colliders) {
            if (c.kind === 'tree') { if (p.y < (c.baseY ?? 0) + c.height + .25 && Math.hypot(p.x - c.x, p.z - c.z) < c.canopyRadius + .45) rocks++; continue; }
            const q = p.clone().sub(c.center).divide(c.radii);
            if (q.length() < 1) rocks++;
          }
        }
        return { id: h.id, feet: h.lengthFeet, par: h.par, drop: +(h.basket.y - h.tee.y).toFixed(1), previewClearance: +min.toFixed(1), rocks };
      });
    });
    assert.equal(report.length, 18);
    assert.equal(report.reduce((s, h) => s + h.par, 0), 57);
    assert.equal(report.reduce((s, h) => s + h.feet, 0), 5285);
    assert(report.every(h => h.previewClearance > 3 && h.rocks === 0));
    assert(report.some(h => h.drop < -20) && report.some(h => h.drop > 15));
    const averageDrop = half => half.reduce((sum, h) => sum + Math.abs(h.drop), 0) / half.length;
    assert(averageDrop(report.slice(9)) >= averageDrop(report.slice(0, 9)));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ scenery, report }, null, 2));
    console.log('PASS: Thunderbird metadata, elevation progression, instanced scenery, terrain clearance, and 18 custom flyovers');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
