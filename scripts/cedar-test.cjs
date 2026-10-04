// Cedar Hollow regression test. Requires the Vite dev server on http://localhost:5173
// (npm run dev) and Playwright (set PLAYWRIGHT_PATH if it is installed elsewhere).
// Node-side checks cover routing; the browser checks build the real course, then
// verify forest dressing: determinism, clearance from tees / baskets / fairways /
// preview and flyover cameras / creeks, asset variety, count bounds and draw budgets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const { CEDAR_BOUNDS, CEDAR_HOLES, cedarHeight, cedarSurfaceHeight } = await import('../src/course/CedarCourse.js');
  assert.equal(CEDAR_HOLES.length, 18);
  assert.equal(CEDAR_HOLES.reduce((sum, hole) => sum + hole.par, 0), 61);
  assert.equal(CEDAR_HOLES.reduce((sum, hole) => sum + hole.lengthFeet, 0), 2890);
  for (const hole of CEDAR_HOLES) for (const [x, z] of hole.route) assert(cedarSurfaceHeight(x, z) - cedarHeight(x, z) > .07);
  const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const segments = hole => hole.route.slice(1).map((point, index) => [hole.route[index], point]);
  const crossings = [];
  for (let i = 0; i < CEDAR_HOLES.length; i++) for (let j = i + 2; j < CEDAR_HOLES.length; j++) for (const [a, b] of segments(CEDAR_HOLES[i])) for (const [c, d] of segments(CEDAR_HOLES[j])) if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) crossings.push([i + 1, j + 1]);
  assert.deepEqual(crossings, []);
  const transitions = CEDAR_HOLES.slice(0, -1).map((hole, index) => Math.hypot(CEDAR_HOLES[index + 1].route[0][0] - hole.route.at(-1)[0], CEDAR_HOLES[index + 1].route[0][1] - hole.route.at(-1)[1]));
  assert(Math.max(...transitions) < 45);
  // Deterministic dressing: no unseeded randomness anywhere in the Cedar sources.
  for (const file of fs.readdirSync(path.join(__dirname, '../src/course')).filter(name => /^Cedar.*\.js$/.test(name))) {
    assert(!/Math\.random\s*\(/.test(fs.readFileSync(path.join(__dirname, '../src/course', file), 'utf8')), `${file} must not use Math.random`);
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/\/src\/main\.js(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + '\nwindow.cedar={THREE,scene,camera,renderer,state,preview,landingCameras,startHole,throwDisc,updatePhysics,updateHUD,get course(){return course},get holes(){return holes},get colliders(){return colliders}};' });
    });
    await page.goto('http://localhost:5173');
    await page.locator('[data-course="forest"]').click();
    assert.match(await page.locator('#pg-round-summary').innerText(), /18 Holes.*Par 61.*2890 ft/);
    assert.equal(await page.locator('#pg-selected-course').innerText(), 'Cedar Hollow');
    assert.equal(await page.evaluate(() => cedar.colliders.filter(collider => collider.role === 'shortcut-guard').length), 36);

    const landing = await page.evaluate(() => {
      const points = cedar.landingCameras.forest.curve.getPoints(1000);
      return {
        minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
        minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)),
      };
    });
    assert(landing.minX >= CEDAR_BOUNDS.minX && landing.maxX <= CEDAR_BOUNDS.maxX);
    assert(landing.minZ >= CEDAR_BOUNDS.minZ && landing.maxZ <= CEDAR_BOUNDS.maxZ);

    const report = await page.evaluate(() => {
      cedar.renderer.setAnimationLoop(null);
      return cedar.holes.map((hole, index) => {
        cedar.preview.start(cedar.holes[index]);
        let minClearance = Infinity;
        let rockHits = 0;
        let targetOutside = 0;
        for (let i = 0; i <= 200; i++) {
          const sample = cedar.preview.sample(i / 200);
          minClearance = Math.min(minClearance, sample.position.y - cedar.course.groundHeight(sample.position.x, sample.position.z));
          if (sample.target.x < cedar.course.bounds.minX || sample.target.x > cedar.course.bounds.maxX || sample.target.z < cedar.course.bounds.minZ || sample.target.z > cedar.course.bounds.maxZ) targetOutside++;
          for (const collider of cedar.colliders) {
            if (collider.kind !== 'rock' || collider.role === 'basket-shelf') continue;
            const local = sample.position.clone().sub(collider.center).divide(collider.radii);
            if (local.length() < 1) rockHits++;
          }
        }
        return { id: hole.id, minClearance: +minClearance.toFixed(2), rockHits, targetOutside };
      });
    });
    assert(report.every(hole => hole.minClearance > 8 && hole.rockHits === 0 && hole.targetOutside === 0));


    // ---- forest dressing -------------------------------------------------
    const forest = await page.evaluate(async () => {
      const { cedarPlayField, cedarHeight, buildCedarCourse } = await import('/src/course/CedarCourse.js');
      const { THREE, scene, camera, renderer, course } = cedar;
      const env = course.environment, dressing = env.dressing, tee = course.holes.map(h => h.tee), baskets = course.holes.map(h => h.basket);
      const ground = { minX: -200, maxX: 200, minZ: -210, maxZ: 210 };
      const byType = {};
      for (const p of dressing) byType[p.type] = (byType[p.type] || 0) + 1;
      // Everything stays inside the ground plane and out of every tee, basket, fairway and walking-link margin.
      const clearanceFailures = [], bounds = [];
      for (const p of dressing) {
        if (p.x - 1 < ground.minX || p.x + 1 > ground.maxX || p.z - 1 < ground.minZ || p.z + 1 > ground.maxZ) bounds.push(p.type);
        // Dogleg guard metadata keeps a slightly generous radius; their placement test used 2.5 / 1.2.
        const r = p.type === 'trailhead-arch' ? 1 : p.type === 'mist' ? 0 : p.type === 'guard-rock' ? 2.5 : p.type === 'guard-stone' ? 1.2 : p.radius;
        if (cedarPlayField.clearance(p.x, p.z) <= r) clearanceFailures.push(`${p.type}@${p.x.toFixed(1)},${p.z.toFixed(1)}`);
        for (const t of [...tee, ...baskets]) if (Math.hypot(p.x - t.x, p.z - t.z) < Math.min(r, 3) + 4) clearanceFailures.push(`${p.type} touches tee/basket`);
      }
      // Decorative planting is separated from the playable trees: crowns of the new conifers keep a wide berth.
      const decorTrees = dressing.filter(p => p.height && (p.type === 'conifer' || p.type === 'giant-conifer') && p.zone === 'Old-growth forest');
      const laneDistance = decorTrees.map(p => cedarPlayField.clearance(p.x, p.z) - p.radius * .8);
      // No prop sits on a water surface; trails never cross a creek except over a bridge.
      const forestData = env.forest;
      const creekSamples = forestData.creeks.flatMap(c => c.samples), pondList = forestData.ponds;
      const waterConflicts = dressing.filter(p => !['pond', 'mist', 'light-shaft', 'footbridge', 'stepping-stones', 'reeds', 'creek-boulder', 'pebbles', 'fern', 'fence', 'lantern', 'wildflowers', 'trail-marker'].includes(p.type) && (
        creekSamples.some(s => Math.hypot(p.x - s.x, p.z - s.z) < s.w * .5 + Math.min(p.radius, 2)) || pondList.some(q => Math.hypot(p.x - q.x, p.z - q.z) < q.r + Math.min(p.radius, 2)))).length;
      let trailCreek = Infinity;
      for (const t of forestData.trails) for (const s of t.samples) for (const c of creekSamples) trailCreek = Math.min(trailCreek, Math.hypot(s.x - c.x, s.z - c.z) - c.w * .5 - s.w * .5);
      let trailPlay = Infinity, creekPlay = Infinity;
      for (const t of forestData.trails) for (const s of t.samples) trailPlay = Math.min(trailPlay, cedarPlayField.clearance(s.x, s.z));
      for (const s of creekSamples) creekPlay = Math.min(creekPlay, cedarPlayField.clearance(s.x, s.z) - s.w * .5);
      for (const q of pondList) creekPlay = Math.min(creekPlay, cedarPlayField.clearance(q.x, q.z) - q.r);
      // Preview and landing cameras never enter a tree, snag or giant.
      const trees = [...dressing.filter(p => p.height).map(p => ({ x: p.x, z: p.z, r: p.radius, top: cedarHeight(p.x, p.z) + p.height })),
        ...course.colliders.filter(c => c.kind === 'tree' && c.role !== 'underbrush').map(c => ({ x: c.x, z: c.z, r: c.canopyRadius, top: c.baseY + c.height }))];
      const hitsTree = pos => trees.some(t => Math.hypot(pos.x - t.x, pos.z - t.z) < Math.max(.9, t.r * .5) && pos.y < t.top + 1);
      let previewHits = 0, flyoverHits = 0;
      renderer.setAnimationLoop(null);
      for (let index = 0; index < course.holes.length; index++) {
        cedar.preview.start(course.holes[index]);
        for (let i = 0; i <= 200; i++) if (hitsTree(cedar.preview.sample(i / 200).position)) previewHits++;
      }
      for (const point of cedar.landingCameras.forest.curve.getPoints(1200)) if (hitsTree(point)) flyoverHits++;
      cedar.preview.skip();
      // Determinism: rebuilding the course reproduces the same dressing.
      const again = buildCedarCourse(new THREE.Group()).environment.dressing;
      const signature = list => list.length + ':' + list.reduce((sum, p, i) => sum + (p.x * 3.1 + p.z * 1.7 + p.radius) * ((i % 13) + 1), 0).toFixed(3);
      // Draw budget: every mesh is instanced or a merged static batch. Measured over the landing flyover and tee views.
      const cedarMeshes = []; course.environment.forest.meshes.forEach(m => cedarMeshes.push(m));
      const instanceTotal = cedarMeshes.filter(m => m.isInstancedMesh).reduce((sum, m) => sum + m.count, 0);
      const kinds = {}; cedarMeshes.filter(m => m.isInstancedMesh).forEach(m => { kinds[m.userData.kit] = m.count; });
      const samples = [];
      const curve = cedar.landingCameras.forest.curve, ground0 = course.groundHeight;
      for (const t of [0, .12, .25, .37, .5, .62, .75, .88]) { camera.position.copy(curve.getPointAt(t)); camera.lookAt(0, 8, 0); camera.updateMatrixWorld(); renderer.render(scene, camera); samples.push([renderer.info.render.calls, renderer.info.render.triangles]); }
      for (const h of course.holes.filter(h => [1, 5, 9, 14].includes(h.id))) {
        const a = h.route[0], b = h.route[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        camera.position.set(a[0] - (b[0] - a[0]) / l * 6, ground0(a[0], a[1]) + 3, a[1] - (b[1] - a[1]) / l * 6); camera.lookAt(h.basket.x, h.basket.y + 1, h.basket.z); camera.updateMatrixWorld();
        renderer.render(scene, camera); samples.push([renderer.info.render.calls, renderer.info.render.triangles]);
      }
      const staticMeshes = []; scene.traverse(o => { if (o.isMesh && o.visible) staticMeshes.push(o); });
      const cedarRoot = course.environment.forest.meshes[0].parent;
      // Baskets (Basket.js) are grouped meshes plus chain lines; everything else is a direct, batched child.
      const cedarDrawables = cedarRoot.children.filter(o => o.isMesh).length, basketDrawables = cedarRoot.children.filter(o => o.isGroup).reduce((sum, g) => { let n = 0; g.traverse(o => { if (o.isMesh || o.isLine) n++; }); return sum + n; }, 0);
      return {
        byType, bounds, clearanceFailures, minLane: Math.min(...laneDistance), decorTrees: decorTrees.length, waterConflicts, trailCreek, trailPlay, creekPlay,
        previewHits, flyoverHits, deterministic: signature(dressing) === signature(again), colliders: course.colliders.length, instanceTotal, kinds,
        meanCalls: samples.reduce((s, v) => s + v[0], 0) / samples.length, maxCalls: Math.max(...samples.map(v => v[0])),
        maxTriangles: Math.max(...samples.map(v => v[1])), cedarDrawables, basketDrawables, bridges: forestData.bridges.length, creeks: forestData.creeks.length,
        trails: forestData.trails.length, scatter: forestData.scatter,
      };
    });
    assert.deepEqual(forest.bounds, [], 'dressing stays inside the ground plane');
    assert.deepEqual(forest.clearanceFailures, [], 'dressing never crowds a tee, basket, fairway or link margin');
    assert(forest.decorTrees >= 250 && forest.decorTrees <= 900, `layered canopy count (${forest.decorTrees})`);
    assert(forest.minLane > 5, `non-colliding conifers keep a wide berth from lanes (${forest.minLane})`);
    assert.equal(forest.waterConflicts, 0, 'no solid prop in a creek or pond');
    assert(forest.trailCreek > 1, `trails only meet creeks at bridges (${forest.trailCreek})`);
    assert(forest.trailPlay > 8 && forest.creekPlay > 3, `trails (${forest.trailPlay}) and water (${forest.creekPlay}) stay off the playable course`);
    assert.equal(forest.previewHits, 0, 'preview cameras never enter a tree');
    assert.equal(forest.flyoverHits, 0, 'landing flyover never enters a tree');
    assert(forest.deterministic, 'seeded dressing rebuilds identically');
    assert(forest.colliders <= 520, `decoration adds no extra colliders (${forest.colliders})`);
    assert(forest.bridges === 2 && forest.creeks === 2 && forest.trails >= 6, 'creeks, footbridges and trail network exist');
    const bounds = {
      conifer: [400, 1600], 'giant-conifer': [20, 200], broadleaf: [40, 300], snag: [30, 200], 'fallen-log': [40, 250], stump: [30, 200], 'mossy-boulder': [60, 450],
      fern: [300, 1500], undergrowth: [100, 700], grass: [100, 700], mushrooms: [40, 400], wildflowers: [150, 900], 'leaf-litter': [600, 3000],
      lantern: [10, 60], 'trail-marker': [8, 60], fence: [25, 200], 'hanging-moss': [40, 400], 'light-shaft': [4, 16], mist: [6, 24], reeds: [10, 80],
      'ranger-cabin': [1, 1], footbridge: [2, 2], pond: [2, 2], campfire: [1, 1], 'trailhead-arch': [1, 1], 'fairy-ring': [1, 1], 'stepping-stones': [1, 1], 'giant-cedar': [1, 1],
    };
    for (const [type, [min, max]] of Object.entries(bounds)) assert((forest.byType[type] || 0) >= min && (forest.byType[type] || 0) <= max, `${type} count ${forest.byType[type] || 0} outside [${min}, ${max}]`);
    for (const kit of ['cedar', 'fir', 'spruce', 'hemlock', 'giant', 'snagTall', 'snagBroken', 'alder', 'maple', 'sapling', 'fern', 'fernDeep', 'bracken', 'salal', 'huckleberry', 'grass', 'boulder', 'boulderSlab', 'log', 'logRoot', 'logNurse', 'stump', 'shroomRed', 'shroomOrange', 'shroomBrown', 'lupine', 'meadow', 'foxglove', 'bluebell', 'litterRust', 'litterGold', 'litterBrown', 'mossPatch', 'hangingMoss', 'cabin', 'footbridge', 'lantern', 'fence', 'signpost', 'arch', 'shaft', 'mist', 'kiosk', 'bench', 'bin', 'trailMarker']) assert(forest.kinds[kit] > 0, `missing instanced kit ${kit}`);
    assert(forest.instanceTotal >= 4000 && forest.instanceTotal <= 9000, `instance total ${forest.instanceTotal}`);
    assert(forest.cedarDrawables <= 120, `cedar draw objects stay batched (${forest.cedarDrawables} direct meshes; ${forest.basketDrawables} basket parts)`);
    assert(forest.meanCalls <= 480 && forest.maxCalls <= 640, `draw calls (mean ${forest.meanCalls}, max ${forest.maxCalls}) stay under budget; baseline was mean 611 / max 978`);
    assert(forest.maxTriangles <= 450000, `triangle budget (${forest.maxTriangles})`);

    const directFinishes = await page.evaluate(() => {
      cedar.renderer.setAnimationLoop(null);
      const results = [];
      for (let index = 0; index < cedar.holes.length; index++) {
        let made = 0;
        for (const type of ['driver', 'midrange']) for (const power of [.5, .75, 1]) for (const elevation of [.12, .32, .5]) {
          cedar.startHole(index); cedar.preview.skip();
          const hole = cedar.holes[index], state = cedar.state;
          state.discType = type; state.power = power; state.elevation = elevation; state.releaseAngle = 0;
          state.aimYaw = Math.atan2(hole.basket.x - state.lie.x, hole.basket.z - state.lie.z);
          cedar.throwDisc();
          let steps = 0;
          while (state.mode === 'flying' && steps++ < 2400) cedar.updatePhysics(1 / 60);
          if (state.finished) made++;
        }
        results.push(made);
      }
      cedar.state.showLanding = true;
      cedar.updateHUD();
      return results;
    });
    assert.deepEqual(directFinishes, Array(18).fill(0));

    await page.evaluate(() => { if (cedar.preview.active) cedar.preview.finish(); cedar.state.showLanding = true; });
    await page.locator('#pg-start-round').click();
    await page.waitForFunction(() => cedar.preview.active);
    assert.equal(await page.evaluate(() => cedar.preview.active), true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: '/tmp/cedar-course.png' });
    console.log(JSON.stringify({ totalFeet: 2890, par: 61, landing, report, forest: { counts: forest.byType, meanCalls: forest.meanCalls, maxCalls: forest.maxCalls, maxTriangles: forest.maxTriangles, instances: forest.instanceTotal, drawables: forest.cedarDrawables, basketDrawables: forest.basketDrawables } }, null, 2));
    console.log('PASS: Cedar Hollow terrain, routing surface, forest dressing (clearance, variety, counts, draw budget), preview clearance, selector, and landing bounds');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
