// Requires Vite on localhost:5173. Checks the new commons against all 18 holes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(/\/src\/main\.js(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + '\nwindow.parkTest={scene,renderer,camera,course};' });
    });
    await page.goto('http://localhost:5173');
    await page.waitForFunction(() => !!window.parkTest);
    const report = await page.evaluate(async () => {
      const { scene, renderer, camera, course } = parkTest;
      const { environmentClearance } = await import('/src/course/EnvironmentAssets.js');
      const { PREVIEW_PATHS } = await import('/src/camera/PreviewPaths.js');
      const { distanceToSegment } = await import('/src/course/Layout.js');
      const commons = course.environment.commons;
      renderer.setAnimationLoop(null);
      const occupied = [...course.environment.placements];
      for (const p of commons.placements) {
        if (!environmentClearance(p.x, p.z, p.radius, course.holes, course.colliders)) throw Error('Course overlap: ' + p.name);
        if (occupied.some(q => Math.hypot(p.x - q.x, p.z - q.z) < p.radius + q.radius + 1)) throw Error('Prefab overlap: ' + p.name);
        for (const h of course.holes) {
          const path = h.previewPath || PREVIEW_PATHS[h.id];
          if (path?.slice(1).some((b, i) => distanceToSegment(p.x, p.z, [path[i][0], path[i][2]], [b[0], b[2]]) <= p.radius + 2)) throw Error('Preview overlap: ' + p.name);
        }
        occupied.push(p);
      }
      // Independent lane check (does not reuse environmentClearance): every prop and every
      // ambient detail stays clear of fairway centerlines, tees, baskets and water.
      const { WATER } = await import('/src/course/Layout.js');
      const laneProblems = [];
      const everything = [...commons.placements, ...commons.ambient.points];
      for (const p of everything) {
        for (const h of course.holes) {
          for (const route of [h.route, h.alternate].filter(Boolean)) {
            if (route.slice(1).some((b, i) => distanceToSegment(p.x, p.z, route[i], b) < h.width + p.radius)) laneProblems.push(`${p.name || p.kind} in hole ${h.id} lane`);
          }
          if (Math.hypot(p.x - h.tee.x, p.z - h.tee.z) < p.radius + 6 || Math.hypot(p.x - h.basket.x, p.z - h.basket.z) < p.radius + 6) laneProblems.push(`${p.name || p.kind} at hole ${h.id} tee/basket`);
        }
        if (WATER.some(w => Math.hypot(p.x - w.x, p.z - w.z) < w.radius + p.radius)) laneProblems.push(`${p.name || p.kind} in water`);
      }
      // Ambient items are not claimed placements, but still honour the shared clearance rules.
      for (const p of commons.ambient.points) {
        if (!environmentClearance(p.x, p.z, p.radius, course.holes, course.colliders)) throw Error('Ambient overlap: ' + p.kind);
        for (const h of course.holes) {
          const path = h.previewPath || PREVIEW_PATHS[h.id];
          if (path?.slice(1).some((b, i) => distanceToSegment(p.x, p.z, [path[i][0], path[i][2]], [b[0], b[2]]) <= p.radius + 2)) throw Error('Ambient preview overlap: ' + p.kind);
        }
      }
      // Rebuilding on a scratch scene must reproduce the layout exactly (no Math.random).
      const { addParkCommons } = await import('/src/course/ParkCommons.js');
      const again = addParkCommons(new scene.constructor(), course.holes, course.colliders, course.environment.placements);
      const deterministic = JSON.stringify(again.placements) === JSON.stringify(commons.placements) &&
        JSON.stringify(again.ambient) === JSON.stringify(commons.ambient);
      camera.position.set(42, 36, 90); camera.lookAt(3, 0, 28);
      function measure(visible) {
        commons.batches.forEach(b => b.visible = visible); renderer.render(scene, camera);
        return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      }
      const before = measure(false), after = measure(true);
      document.querySelector('.pg-root').hidden = true;
      renderer.render(scene, camera);
      return { playground: commons.playground, placements: commons.placements.length,
        types: [...new Set(commons.placements.flatMap(p => [p.name, ...(p.parts || [])]))],
        landmarks: commons.landmarks, restStops: commons.restStops, gate: commons.gate, ambient: commons.ambient.stats,
        batches: commons.batches.length, laneProblems, deterministic,
        addedCalls: after.calls - before.calls, addedTriangles: after.triangles - before.triangles };
    });
    console.log(JSON.stringify(report, null, 2));
    assert(report.playground, 'central playground must be placed');
    assert(report.placements > 700, 'empty park areas receive substantial planting');
    assert.deepEqual(report.laneProblems, [], 'decor stays out of lanes, tees, baskets and water');
    assert(report.deterministic, 'decor layout is deterministic');
    assert(!/Math\.random\s*\(/.test(fs.readFileSync('src/course/ParkCommons.js', 'utf8') + fs.readFileSync('src/course/ParkDecor.js', 'utf8')), 'no Math.random');
    for (const key of ['bandshell', 'plaza', 'pond', 'food', 'kiosk0', 'rose0', 'garden0', 'gazebo0']) assert(report.landmarks[key], `Missing landmark: ${key}`);
    assert(report.restStops.stops >= 5 && report.restStops.lamps >= 15, 'rest stops and path lamps are placed');
    assert(report.gate, 'entrance gate is placed');
    assert(report.ambient.fence > 250 && report.ambient.leaves > 500 && report.ambient.windbreak > 100, 'ambient boundary and ground detail present');
    for (const name of ['Bandshell stage', 'Fountain plaza', 'Fountain', 'Ornamental lily pond', 'Food truck court', 'Food truck', 'Umbrella table', 'Snack kiosk court', 'Park kiosk', 'Garden gazebo', 'Rose garden', 'Community garden', 'Entrance gate', 'Rest stop', 'Bike rack', 'Drinking fountain', 'Recycling station', 'Little free library', 'Lamppost', 'Flower bed', 'Flower urn', 'Banner flag', 'Bird bath', 'Planter box', 'Clipped hedge']) assert(report.types.includes(name), `Missing decor: ${name}`);
    for (const name of ['Crape myrtle', 'Southern magnolia', 'Bald cypress', 'Slash pine', 'Red maple', 'Royal palm', 'Hydrangea shrub', 'Rose bush', 'Boxwood ball', 'Pollinator meadow']) assert(report.types.includes(name), `Missing planting: ${name}`);
    for (const name of ['Spreading live oak', 'Silver eucalyptus', 'Flowering tree', 'Sabal palm', 'Young umbrella tree', 'Golden broadleaf', 'Slender cedar', 'Fern patch', 'Ornamental grass', 'Flowering shrub', 'Wildflower patch']) assert(report.types.includes(name), `Missing foliage: ${name}`);
    assert(report.addedCalls <= 70, 'shared instancing bounds draw calls');
    assert(report.addedTriangles <= 300000, 'bounded foliage geometry');
    await page.screenshot({ path: '/tmp/park-commons.png' });
    assert.deepEqual(errors, []);
    console.log('PASS: central playground, foliage variety, decor set pieces, all-hole/preview/water clearance, determinism, prefab spacing, rendering budget.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
