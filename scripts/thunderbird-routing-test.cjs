// Node-only (no browser, no dev server): `node scripts/thunderbird-routing-test.cjs`.
// 1. Routing: distinct corridors, separated greens, walkable transitions.
// 2. Scenery: the baked desert dressing is deterministic, bounded in draw calls
//    and triangles, and stays clear of fairways, tees, baskets and preview paths.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { THUNDERBIRD_HOLES: H } = await import('../src/course/ThunderbirdCourse.js');
  const { distanceToSegment: d } = await import('../src/course/Layout.js');
  const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const segments = h => h.route.slice(1).map((b, i) => [h.route[i], b]);
  const crossings = [], crowding = [];
  for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) {
    const unrelated = Math.abs(i - j) > 1;
    if (unrelated) for (const [a, b] of segments(H[i])) for (const [c, e] of segments(H[j])) {
      if (orient(a, b, c) * orient(a, b, e) < 0 && orient(c, e, a) * orient(c, e, b) < 0) crossings.push([i + 1, j + 1]);
    }
    const bi = H[i].route.at(-1), bj = H[j].route.at(-1), basketGap = Math.hypot(bi[0] - bj[0], bi[1] - bj[1]);
    if (basketGap < 30) crowding.push({ type: 'basket-basket', holes: [i + 1, j + 1], gap: basketGap });
    if (unrelated) {
      for (const [tee, basket] of [[H[i].route[0], bj], [H[j].route[0], bi]]) {
        const gap = Math.hypot(tee[0] - basket[0], tee[1] - basket[1]);
        if (gap < 25) crowding.push({ type: 'tee-basket', holes: [i + 1, j + 1], gap });
      }
      let corridor = Infinity;
      for (const p of H[i].route) for (const [a, b] of segments(H[j])) corridor = Math.min(corridor, d(...p, a, b));
      for (const p of H[j].route) for (const [a, b] of segments(H[i])) corridor = Math.min(corridor, d(...p, a, b));
      if (corridor < 10) crowding.push({ type: 'corridor', holes: [i + 1, j + 1], gap: corridor });
    }
  }
  const walks = H.slice(0, -1).map((h, i) => Math.hypot(H[i + 1].route[0][0] - h.route.at(-1)[0], H[i + 1].route[0][1] - h.route.at(-1)[1]));
  assert.deepEqual(crossings, [], 'unrelated centerlines must not cross');
  assert.deepEqual(crowding, [], 'unrelated greens, tees, and corridors need separation');
  assert(Math.max(...walks) < 45, 'transitions remain walkable');
  console.log(JSON.stringify({ crossings, crowding, maxTransition: +Math.max(...walks).toFixed(1), totalFeet: H.reduce((s, h) => s + h.lengthFeet, 0), par: H.reduce((s, h) => s + h.par, 0) }, null, 2));
  console.log('PASS: Thunderbird routing has distinct corridors, separated greens, and connected transitions');

  // ---- Scenery (headless build; the hole signs need a canvas, so stub one) ----
  globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }) };
  const THREE = await import('three');
  const { buildThunderbirdCourse, THUNDERBIRD_BOUNDS: B, thunderbirdHeight, thunderbirdSurfaceHeight } = await import('../src/course/ThunderbirdCourse.js');
  const sources = ['ThunderbirdCourse', 'ThunderbirdAssets', 'ThunderbirdScenery', 'ThunderbirdNoise'].map(n => fs.readFileSync(path.join(__dirname, '../src/course', n + '.js'), 'utf8'));
  assert(sources.every(s => !s.includes('Math.random')), 'scenery must be deterministic: no Math.random');

  const build = () => { const scene = new THREE.Scene(); return { scene, course: buildThunderbirdCourse(scene) }; };
  const { scene, course } = build();
  const again = build().course;
  const sc = course.environment.scenery;
  const key = p => `${p.type}@${p.x.toFixed(3)},${p.z.toFixed(3)}`;
  assert.deepEqual(sc.placements.map(key), again.environment.scenery.placements.map(key), 'identical placements on every build');
  assert.equal(course.colliders.length, again.colliders.length, 'identical collider set on every build');

  // Budget: draw calls, instancing, triangles.
  let drawCalls = 0, instancedBatches = 0, triangles = 0, instances = 0;
  const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
  scene.traverse(o => {
    if (o.isInstancedMesh) { drawCalls++; instancedBatches++; instances += o.count; triangles += tris(o.geometry) * o.count; }
    else if (o.isMesh) { drawCalls++; triangles += tris(o.geometry); }
  });
  const sceneryBatches = sc.batches.length;
  assert(drawCalls <= 200, `draw calls stay bounded (${drawCalls}; the pre-scenery course used 800)`);
  assert(sceneryBatches <= 70 && sc.batches.every(b => b.isInstancedMesh), `scenery is instanced (${sceneryBatches} batches)`);
  assert(triangles <= 480000, `triangle budget (${Math.round(triangles)})`);
  assert(sc.batches.every(b => b.count > 0 && b.instanceMatrix.count === b.count));

  // Variety and density.
  const types = sc.stats.byType;
  for (const t of ['hoodoo', 'bluff', 'arch', 'boulder', 'saguaro', 'prickly-pear', 'cholla', 'barrel-cactus', 'ocotillo', 'agave', 'yucca', 'sagebrush', 'rabbitbrush', 'juniper', 'pinon', 'wildflowers', 'grass', 'wash-cobbles', 'ramada', 'windmill', 'water-tank', 'corral-fence', 'fence', 'trail-marker', 'cairn']) assert(types[t] > 0, `missing scenery type: ${t}`);
  assert(sc.placements.length >= 2500 && sc.placements.length <= 6000, `placement count in range (${sc.placements.length})`);
  assert(types.hoodoo >= 30 && types.bluff >= 15 && types.sagebrush >= 400 && types.juniper + types.pinon >= 80 && types.saguaro >= 20 && types.wildflowers >= 80, 'dense, varied planting and rock');
  assert(sc.wash.length >= 3 && sc.mesas.length >= 20 && sc.stats.patches >= 100, 'wash channels, horizon mesas and ground patches');
  assert(sc.groundDetail && sc.groundDetail.geometry.attributes.color, 'ground colour patches are one vertex-coloured mesh');
  assert(course.environment.dressing.length >= 30 && new Set(course.environment.dressing.map(p => p.type)).size >= 6, 'existing dressing remains');
  assert.equal(course.water.length, 0, 'Thunderbird Gardens has no water hazards for scenery to block');
  assert.equal(course.colliders.filter(c => c.role === 'basket-shelf').length, 18);
  assert(sc.stats.colliders <= 400, 'scenery colliders stay bounded');
  for (const h of H) for (const [x, z] of h.route) assert(thunderbirdSurfaceHeight(x, z) - thunderbirdHeight(x, z) > .07, 'scenery leaves the fairway physics surface untouched');

  // Independent play model: nothing may sit on a fairway, tee pad, basket shelf, walking link or preview path.
  const holes = course.holes;
  const seg = (x, z, a, b) => d(x, z, a, b);
  const edgeDistance = (x, z) => {
    let best = Infinity;
    holes.forEach((h, i) => {
      h.route.slice(1).forEach((b, j) => { best = Math.min(best, seg(x, z, h.route[j], b) - h.width / 2); });
      best = Math.min(best, Math.hypot(x - h.route[0][0], z - h.route[0][1]) - 5.5, Math.hypot(x - h.route.at(-1)[0], z - h.route.at(-1)[1]) - 9.5);
      if (holes[i + 1]) best = Math.min(best, seg(x, z, h.route.at(-1), holes[i + 1].route[0]) - 1.5);
    });
    return best;
  };
  const factor = [.6, .8, 1];
  const violations = [];
  for (const p of sc.placements) {
    const edge = edgeDistance(p.x, p.z);
    if (p.margin > 0 ? edge < p.radius * factor[p.layer] + p.margin - 1e-6 : edge < 0) violations.push({ ...p, edge: +edge.toFixed(2) });
    if (p.x - p.radius < B.minX || p.x + p.radius > B.maxX || p.z - p.radius < B.minZ || p.z + p.radius > B.maxZ) violations.push({ ...p, edge: 'bounds' });
  }
  assert.deepEqual(violations.slice(0, 5), [], `scenery clear of play areas (${violations.length} violations)`);
  const minEdge = Math.min(...sc.placements.map(p => edgeDistance(p.x, p.z) - p.radius * factor[p.layer]));

  // Solid props (rock, tree, structure) never overlap each other.
  const solids = sc.placements.filter(p => p.layer === 2 && p.margin > 0);
  const overlaps = [];
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
    const a = solids[i], b = solids[j];
    if (Math.abs(a.x - b.x) < 30 && Math.abs(a.z - b.z) < 30 && Math.hypot(a.x - b.x, a.z - b.z) < (a.radius + b.radius) * .999) overlaps.push([key(a), key(b)]);
  }
  assert.deepEqual(overlaps.slice(0, 5), [], 'solid scenery does not overlap');

  // Scenery colliders stay off the fairways, and no preview camera path passes through any collider.
  const sceneryColliders = course.colliders.filter(c => c.role === 'scenery');
  for (const c of sceneryColliders) {
    const x = c.x ?? c.center.x, z = c.z ?? c.center.z, r = c.radii ? Math.max(c.radii.x, c.radii.z) : c.canopyRadius;
    assert(edgeDistance(x, z) >= r - .001, `collider on play area at ${x.toFixed(1)},${z.toFixed(1)}`);
  }
  let previewHits = 0, previewMin = Infinity, previewCrowd = 0;
  for (const h of holes) {
    const curve = new THREE.CatmullRomCurve3(h.previewPath.map(p => new THREE.Vector3(...p)), false, 'centripetal');
    for (let i = 0; i <= 400; i++) {
      const v = curve.getPoint(i / 400);
      previewMin = Math.min(previewMin, v.y - course.groundHeight(v.x, v.z));
      for (const p of sc.placements) if (Math.abs(p.x - v.x) < 12 && Math.abs(p.z - v.z) < 12 && Math.hypot(p.x - v.x, p.z - v.z) < p.radius * factor[p.layer]) previewCrowd++;
      for (const c of course.colliders) {
        if (c.kind === 'rock') { if (v.clone().sub(c.center).divide(c.radii.clone().addScalar(.45)).length() < 1) previewHits++; }
        else if (v.y < c.baseY + c.height + .25 && Math.hypot(v.x - c.x, v.z - c.z) < c.canopyRadius + .45) previewHits++;
      }
    }
  }
  assert.equal(previewCrowd, 0, 'no scenery footprint lies under a preview camera path');
  assert.equal(previewHits, 0, 'preview camera paths never pass through colliders');
  assert(previewMin > 3, 'preview paths keep terrain clearance');

  console.log(JSON.stringify({ drawCalls, instancedBatches, sceneryBatches, instances, triangles: Math.round(triangles), placements: sc.placements.length, byType: types, wash: sc.wash.map(w => w.name), mesas: sc.mesas.length, patches: sc.stats.patches, sceneryColliders: sceneryColliders.length, minClearanceBeyondFootprint: +minEdge.toFixed(2), previewMin: +previewMin.toFixed(1) }, null, 2));
  console.log('PASS: Thunderbird scenery is deterministic, instanced, varied, and clear of fairways, tees, baskets, colliders and preview paths');
})().catch(e => { console.error(e); process.exit(1); });
