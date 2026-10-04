import * as THREE from 'three';
import { fbm, hash2, mulberry32 } from './ThunderbirdNoise.js';
import {
  createAgave, createBarrelCactus, createBluff, createBoulderCluster, createCairnStack, createCholla, createFenceBay, createGrassTuft,
  createHoodoo, createJuniper, createMesa, createOcotillo, createPinon, createPricklyPear, createRabbitbrush, createRamada,
  createRockArch, createSagebrush, createSaguaro, createStoneScatter, createThunderbirdMarker, createTrailBench, createTrailMarker,
  createWaterTank, createWildflowers, createWindmill, createYucca,
} from './ThunderbirdAssets.js';

// ---------------------------------------------------------------------------
// Baking. Tintable flat-shaded parts across every prefab share one material and
// are drawn as one InstancedMesh per geometry; the part colour (times a small
// per-asset tint) is stored as the instance colour. A group of N prefabs with
// G distinct primitives therefore costs G draw calls, not N * parts.
// ---------------------------------------------------------------------------
const sharedMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
const unit = new THREE.Color(1, 1, 1);
const tintable = m => m.isMeshStandardMaterial && !m.map && !m.metalness && m.flatShading && m.roughness === 1;
export function bakeThunderbird(scene, assets, name, { cast = true } = {}) {
  const groups = new Map();
  for (const asset of assets) {
    asset.updateMatrixWorld(true);
    const tint = asset.userData.tint ?? unit;
    asset.traverse(mesh => {
      if (!mesh.isMesh) return;
      const mat = mesh.material, shared = tintable(mat), key = shared ? mesh.geometry.uuid : `${mesh.geometry.uuid}/${mat.uuid}`;
      if (!groups.has(key)) groups.set(key, { geometry: mesh.geometry, material: shared ? sharedMaterial : mat, shared, items: [] });
      groups.get(key).items.push([mesh.matrixWorld.clone(), shared ? mat.color.clone().multiply(tint) : null]);
    });
  }
  const batches = [];
  for (const { geometry, material, shared, items } of groups.values()) {
    const batch = new THREE.InstancedMesh(geometry, material, items.length);
    batch.name = name;
    items.forEach(([matrix, color], i) => { batch.setMatrixAt(i, matrix); if (shared) batch.setColorAt(i, color); });
    batch.instanceMatrix.needsUpdate = true;
    if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    batch.castShadow = cast; batch.receiveShadow = true;
    batch.computeBoundingSphere();
    scene.add(batch); batches.push(batch);
  }
  return batches;
}

const smoothstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = v => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------------------
// Ground colour: one function drives the terrain's vertex colours, the horizon
// skirt, wash and patch decals so every layer blends into the same soil.
// ---------------------------------------------------------------------------
export function makeGroundColor(heightAt) {
  const C = hex => new THREE.Color(hex);
  const clay = C(0xa65332), sand = C(0xc99a6b), caliche = C(0xd1b088), rust = C(0x8a432f), dark = C(0x7a4030), olive = C(0x9a7a58), ochre = C(0xbb8248);
  return function colorAt(x, z, out = new THREE.Color()) {
    const h = heightAt(x, z), n1 = fbm(x, z, 38, 101), n2 = fbm(x, z, 13, 202, 2), n3 = fbm(x, z, 95, 303, 2);
    const slope = Math.hypot(heightAt(x + 1.5, z) - heightAt(x - 1.5, z), heightAt(x, z + 1.5) - heightAt(x, z - 1.5)) / 3;
    out.copy(clay);
    out.lerp(sand, .55 * (1 - smoothstep(4, 14, h)));
    out.lerp(rust, smoothstep(24, 46, h) * .5);
    out.lerp(caliche, smoothstep(.54, .72, n1) * .6);
    out.lerp(ochre, smoothstep(.58, .8, n2) * .4);
    out.lerp(olive, smoothstep(.6, .78, n3) * .3);
    out.lerp(dark, smoothstep(.3, .75, slope) * .5);
    return out.multiplyScalar(.9 + .2 * n2);
  };
}

// ---------------------------------------------------------------------------
// Terrain skirt: a coarse apron around the playable plane that rises toward
// the horizon, so the buttes stand on land instead of floating in the sky.
// ---------------------------------------------------------------------------
export function skirtHeight(heightAt, x, z, plane) {
  const out = Math.max(Math.abs(x) - plane.hx, Math.abs(z) - plane.hz, 0);
  return heightAt(x, z) + smoothstep(0, 260, out) * 16 + out * .015 + (fbm(x, z, 70, 909) - .5) * Math.min(out, 60) * .25 - Math.min(out, 6) * .02;
}
export function buildSkirt(heightAt, colorAt, plane, outer = 640) {
  const step = [0, 10, 24, 44, 72, 110, 160, 230, 320, outer - plane.hx];
  const xs = [], zs = [];
  for (const d of step) { xs.unshift(-plane.hx - d); zs.unshift(-plane.hz - d); }
  for (const d of step) { xs.push(plane.hx + d); zs.push(plane.hz + d); }
  const nx = xs.length, positions = [], colors = [], indices = [], c = new THREE.Color();
  for (let j = 0; j < zs.length; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zs[j], y = skirtHeight(heightAt, x, z, plane);
    positions.push(x, y, z); colorAt(x, z, c); c.multiplyScalar(.96); colors.push(c.r, c.g, c.b);
  }
  const mid = step.length - 1;
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (i === mid && j === mid) continue; // the playable plane fills the centre
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    indices.push(a, d, b, b, d, e);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true }));
  mesh.name = 'Thunderbird horizon skirt'; mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Play model: signed distance from a point to the nearest thing a player,
// disc or preview camera needs (fairway edge, tee pad, basket shelf, walking
// link, flyover path). Props are placed only where this distance is positive
// beyond their own footprint.
// ---------------------------------------------------------------------------
export function makePlayModel(holes) {
  const segs = [], spots = [];
  const seg = (a, b, half) => { const dx = b[0] - a[0], dz = b[1] - a[1]; segs.push([a[0], a[1], dx, dz, dx * dx + dz * dz || 1, half]); };
  holes.forEach((h, i) => {
    h.route.slice(1).forEach((b, j) => seg(h.route[j], b, h.width / 2));
    const path = (h.previewPath || []).map(p => [p[0], p[2]]);
    path.slice(1).forEach((b, j) => seg(path[j], b, 1));
    spots.push([h.route[0][0], h.route[0][1], 5.5], [h.route.at(-1)[0], h.route.at(-1)[1], 9.5]);
    const next = holes[i + 1];
    if (next) seg(h.route.at(-1), next.route[0], 1.5);
  });
  return {
    dist(x, z) {
      let best = Infinity;
      for (const [ax, az, dx, dz, len2, half] of segs) {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
        const d = Math.hypot(x - ax - t * dx, z - az - t * dz) - half;
        if (d < best) best = d;
      }
      for (const [sx, sz, r] of spots) { const d = Math.hypot(x - sx, z - sz) - r; if (d < best) best = d; }
      return best;
    },
  };
}

// Occupancy hash. Layers: 2 solid (rock, tree, structure), 1 mid (shrub, cactus), 0 ground cover.
function makeOccupancy() {
  const cell = 8, cells = new Map(); let maxR = 6;
  const key = (i, j) => i * 100003 + j;
  const gap = (a, b) => {
    if (a.l === 2 && b.l === 2) return a.r + b.r;
    if (a.l === 2 || b.l === 2) { const s = a.l === 2 ? a : b, o = a.l === 2 ? b : a; return s.r * .85 + o.r * .5; }
    if (a.l === 1 && b.l === 1) return (a.r + b.r) * .85;
    if (a.l === 0 && b.l === 0) return (a.r + b.r) * .7;
    return Math.max(a.r, b.r) * .7 + Math.min(a.r, b.r) * .3;
  };
  const free = (x, z, r, l) => {
    const me = { x, z, r, l }, span = Math.ceil((r + maxR) / cell);
    const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    for (let i = ci - span; i <= ci + span; i++) for (let j = cj - span; j <= cj + span; j++) {
      const list = cells.get(key(i, j)); if (!list) continue;
      for (const p of list) if (Math.hypot(x - p.x, z - p.z) < gap(me, p)) return false;
    }
    return true;
  };
  const add = (x, z, r, l) => {
    maxR = Math.max(maxR, r);
    const k = key(Math.floor(x / cell), Math.floor(z / cell));
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push({ x, z, r, l });
  };
  return { free, add };
}

// ---------------------------------------------------------------------------
export function addThunderbirdScenery({ scene, heightAt, bounds, holes, colliders, existing = [], plane, colorAt }) {
  const play = makePlayModel(holes), occ = makeOccupancy();
  const groups = { solid: [], flora: [], cover: [], structure: [] };
  const placements = [], newColliders = [];
  const stats = { rejected: 0 };
  const margin = 2;
  const inBounds = (x, z, r) => x - r > bounds.minX + margin && x + r < bounds.maxX - margin && z - r > bounds.minZ + margin && z + r < bounds.maxZ - margin;
  const slopeAt = (x, z) => Math.hypot(heightAt(x + 1.5, z) - heightAt(x - 1.5, z), heightAt(x, z + 1.5) - heightAt(x, z - 1.5)) / 3;
  for (const p of existing) occ.add(p.x, p.z, p.radius ?? 1.4, 2);
  for (const c of colliders) { const cx = c.x ?? c.center.x, cz = c.z ?? c.center.z; occ.add(cx, cz, c.radii ? Math.max(c.radii.x, c.radii.z) : (c.canopyRadius ?? 2), 2); }

  // --- dry wash: a meandering, downhill channel that fades out near play ---
  const wash = [];
  function buildWash(name, controls, seed) {
    const curve = new THREE.CatmullRomCurve3(controls.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const n = Math.max(8, Math.round(curve.getLength() / 4)), pts = [];
    curve.getSpacedPoints(n).forEach((p, i) => {
      const t = curve.getTangent(i / n), nx = -t.z, nz = t.x, off = (fbm(p.x, p.z, 22, seed) - .5) * 14;
      pts.push({ x: p.x + nx * off, z: p.z + nz * off, w: 4.5 + 4.5 * fbm(p.x, p.z, 38, seed + 5) });
    });
    wash.push({ name, pts: pts.filter(p => inBounds(p.x, p.z, 4)) });
  }
  buildWash('Copper Wash', [[205, 150], [172, 140], [142, 128], [114, 98], [101, 72], [84, 46], [58, 30], [30, 20], [8, 14]], 41);
  buildWash('North Wash', [[72, -205], [56, -172], [50, -138], [38, -98], [32, -62], [20, -40], [10, -6], [8, 14]], 43);
  buildWash('Saddle Wash', [[-205, -62], [-182, -48], [-160, -62], [-132, -48], [-104, -58], [-74, -40], [-44, -18], [-16, 2], [8, 14]], 47);
  buildWash('Rollaway Wash', [[205, -150], [180, -138], [158, -118], [150, -92], [166, -64], [158, -42], [130, -26], [96, -30]], 53);
  const washSegs = [];
  for (const w of wash) for (let i = 1; i < w.pts.length; i++) washSegs.push([w.pts[i - 1], w.pts[i]]);
  function washDist(x, z) {
    let best = Infinity;
    for (const [a, b] of washSegs) {
      const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(x - a.x - t * dx, z - a.z - t * dz) - (a.w + (b.w - a.w) * t) / 2;
      if (d < best) best = d;
    }
    return best;
  }

  // --- generic placement ---
  const tint = (x, z, seed) => { const v = .86 + .26 * fbm(x, z, 9, seed, 2), c = new THREE.Color(v * (1 + (hash2(x * 3 | 0, z * 3 | 0, seed) - .5) * .08), v, v * (1 + (hash2(z * 3 | 0, x * 3 | 0, seed + 1) - .5) * .08)); return c; };
  const levelFactor = [.6, .8, 1];
  function place({ zone, type, make, x, z, radius, layer, group, margin: m = 1.5, yaw = 0, scale = 1, noWash = true, collider }) {
    const r = radius * scale;
    if (!inBounds(x, z, r) || play.dist(x, z) < r * levelFactor[layer] + m || (noWash && washDist(x, z) < r * .4) || !occ.free(x, z, r, layer)) { stats.rejected++; return null; }
    const asset = make();
    asset.position.set(x, heightAt(x, z) - .05, z); asset.rotation.y = yaw; asset.scale.setScalar(scale);
    asset.userData.tint = tint(x, z, 17);
    groups[group].push(asset);
    occ.add(x, z, r, layer);
    const record = { zone, type, name: asset.name, x, z, radius: r, layer, margin: m };
    placements.push(record);
    if (collider && play.dist(x, z) < 16) collider(asset, x, heightAt(x, z), z, scale, yaw);
    return record;
  }
  const rockCollider = (rx, ry, rz, dy = 0) => (asset, x, y, z) => newColliders.push({ kind: 'rock', role: 'scenery', center: new THREE.Vector3(x, y + dy + ry * .8, z), radii: new THREE.Vector3(rx, ry, rz) });
  const treeCollider = (asset, x, y, z, s) => newColliders.push({ kind: 'tree', role: 'scenery', x, z, baseY: y, trunkRadius: (asset.userData.trunk ?? .4) * s + .1, canopyRadius: (asset.userData.canopy ?? 1.2) * s, height: (asset.userData.height ?? 5) * s, canopyBottom: asset.userData.canopyBottom ?? 1.5 });
  const bluffCollider = (asset, x, y, z, s, yaw) => {
    const len = asset.userData.radius * 2 - 2, depth = asset.userData.depth, n = Math.max(2, Math.round(len / (depth * 1.1)));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1) - .5) * (len - depth);
      newColliders.push({ kind: 'rock', role: 'scenery', center: new THREE.Vector3(x + Math.cos(yaw) * t, y + asset.userData.height * .38, z - Math.sin(yaw) * t), radii: new THREE.Vector3(depth * .55 + .6, asset.userData.height * .5, depth * .55 + .6) });
    }
  };
  const scatter = (step, seed, fn) => {
    for (let iz = Math.floor(bounds.minZ / step); iz * step <= bounds.maxZ; iz++) for (let ix = Math.floor(bounds.minX / step); ix * step <= bounds.maxX; ix++) {
      const x = ix * step + (hash2(ix, iz, seed) - .5) * step * .92, z = iz * step + (hash2(ix, iz, seed + 3) - .5) * step * .92;
      fn(x, z, hash2(ix, iz, seed + 7), hash2(ix, iz, seed + 11), ix * 131 + iz * 17);
    }
  };
  // Finds the nearest acceptable site for a big composition around (x, z).
  function findSite(x0, z0, radius, margin2 = 6) {
    for (let ring = 0; ring < 22; ring++) for (let k = 0; k < Math.max(1, ring * 6); k++) {
      const a = k / Math.max(1, ring * 6) * 6.283, x = x0 + Math.cos(a) * ring * 4, z = z0 + Math.sin(a) * ring * 4;
      if (inBounds(x, z, radius) && play.dist(x, z) >= radius + margin2 && occ.free(x, z, radius, 2) && washDist(x, z) > radius * .3) return [x, z];
    }
    return null;
  }
  const put = (asset, group, x, z, yaw, zone, type, radius, lift = 0) => {
    asset.position.set(x, heightAt(x, z) - .05 + lift, z); asset.rotation.y = yaw; asset.userData.tint = tint(x, z, 29);
    groups[group].push(asset); placements.push({ zone, type, name: asset.name, x, z, radius, layer: 2, margin: 0 });
  };

  // === 1. Set pieces: ranch, ramadas, hoodoo gardens, arches ===
  const sites = [];
  const ranch = findSite(112, 168, 17, 8);
  if (ranch) {
    const [cx, cz] = ranch, yaw = .3;
    occ.add(cx, cz, 17, 2); sites.push({ zone: 'Hightail Ranch', x: cx, z: cz });
    const at = (dx, dz) => [cx + Math.cos(yaw) * dx + Math.sin(yaw) * dz, cz - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
    for (const [dx, dz, make, ry, type, rad] of [[-4, -1, () => createWindmill(2), .4, 'windmill', 2.6], [3, 1, createWaterTank, 0, 'water-tank', 5.4]]) { const [x, z] = at(dx, dz); put(make(), 'structure', x, z, yaw + ry, 'Hightail Ranch', type, rad); }
    // log-rail corral (open on one side) with a ramada beside it
    const corner = [[-11, -8], [11, -8], [11, 8], [-11, 8]];
    for (let s = 0; s < 4; s++) {
      const [ax, az] = corner[s], [bx, bz] = corner[(s + 1) % 4], len = Math.hypot(bx - ax, bz - az), bays = Math.round(len / 5);
      for (let i = 0; i < bays; i++) {
        if (s === 3 && i === 1) continue;
        const [x0, z0] = at(ax + (bx - ax) * i / bays, az + (bz - az) * i / bays), [x1, z1] = at(ax + (bx - ax) * (i + 1) / bays, az + (bz - az) * (i + 1) / bays);
        const L = Math.hypot(x1 - x0, z1 - z0), rise = heightAt(x1, z1) - heightAt(x0, z0), bay = createFenceBay(L, rise, 2);
        put(bay, 'structure', x0, z0, Math.atan2(-(z1 - z0), x1 - x0), 'Hightail Ranch', 'corral-fence', .5);
      }
    }
    const [rx, rz] = at(-1, 15); put(createRamada(5), 'structure', rx, rz, yaw, 'Hightail Ranch', 'ramada', 4.4);
    const [bx, bz] = at(-12, 11); put(createTrailBench(), 'structure', bx, bz, yaw + 1.6, 'Hightail Ranch', 'bench', 1.5);
  }
  const hoodooGarden = (zone, x, z, count, seed) => {
    const site = findSite(x, z, 9, 6); if (!site) return;
    let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const a = hash2(seed, i, 1) * 6.283, d = i === 0 ? 0 : 3 + hash2(seed, i, 2) * 8;
      const s = i === 0 ? 1.15 : .75 + hash2(seed, i, 3) * .4;
      if (place({ zone, type: 'hoodoo', make: () => createHoodoo(seed * 31 + i), x: site[0] + Math.cos(a) * d, z: site[1] + Math.sin(a) * d, radius: 3.6, layer: 2, group: 'solid', margin: 4.5, yaw: hash2(seed, i, 4) * 6.28, scale: s, collider: rockCollider(1.8, 4.5, 1.8) })) placed++;
    }
  };
  hoodooGarden('Hoodoo Garden', 150, -150, 9, 3);
  hoodooGarden('Whisper Hoodoos', -125, 165, 7, 5);
  hoodooGarden('Chimney Rocks', 28, -178, 7, 7);
  hoodooGarden('Painted Spires', 190, 40, 6, 9);
  for (const [zone, x, z, seed] of [['Window Arch', 170, 125, 1], ['Sunrise Arch', -40, 45, 2], ['Raven Gate', -178, -35, 3], ['Split Rock Gate', 160, -15, 4]]) {
    const s = findSite(x, z, 7, 7); if (s) { const rec = place({ zone, type: 'arch', make: () => createRockArch(seed), x: s[0], z: s[1], radius: 6.2, layer: 2, group: 'solid', margin: 6, yaw: hash2(seed, 9, 9) * 3.1 }); if (rec) newColliders.push({ kind: 'rock', role: 'scenery', center: new THREE.Vector3(s[0], heightAt(s[0], s[1]) + 2.5, s[1]), radii: new THREE.Vector3(4.2, 3.2, 2.4) }); }
  }
  // Rest stops: ramadas, trail markers and cairns beside selected tees and every walking link.
  for (const id of [3, 6, 8, 10, 13, 15]) {
    const h = holes[id - 1], a = h.route[0], b = h.route[1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), fx = dx / l, fz = dz / l;
    for (const side of [1, -1]) {
      const s = findSite(a[0] - fz * side * 17 - fx * 3, a[1] + fx * side * 17 - fz * 3, 4.4, 5);
      if (s && place({ zone: `Hole ${id} rest stop`, type: 'ramada', make: () => createRamada(id), x: s[0], z: s[1], radius: 4.4, layer: 2, group: 'structure', margin: 5, yaw: Math.atan2(-dz, dx) * 0 + Math.atan2(fx, fz) + 1.57 })) break;
    }
  }
  holes.forEach((h, i) => {
    const a = h.route[0], b = h.route[1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), fx = dx / l, fz = dz / l;
    for (const [side, make, type, off] of [[1, i % 3 === 0 ? createThunderbirdMarker : createTrailMarker, 'trail-marker', 8.5 + (i % 2)], [-1, () => createCairnStack(i + 3), 'cairn', 8 + (i % 3)]]) {
      for (const along of [-3, 0, 3, 6]) { if (place({ zone: `Hole ${h.id} tee`, type, make, x: a[0] - fz * side * (h.width / 2 + off - 4) + fx * along, z: a[1] + fx * side * (h.width / 2 + off - 4) + fz * along, radius: .9, layer: 2, group: 'structure', margin: 1.2, yaw: Math.atan2(dx, dz) + (side > 0 ? 0 : .6) })) break; }
    }
    const next = holes[i + 1]; if (!next) return;
    const e = h.route.at(-1), t = next.route[0], ll = Math.hypot(t[0] - e[0], t[1] - e[1]);
    if (ll > 14) for (const f of [.35, .65]) {
      const x = e[0] + (t[0] - e[0]) * f - (t[1] - e[1]) / ll * 4.2, z = e[1] + (t[1] - e[1]) * f + (t[0] - e[0]) / ll * 4.2;
      place({ zone: `Walk ${h.id}-${next.id}`, type: f < .5 ? 'cairn' : 'trail-marker', make: f < .5 ? () => createCairnStack(i + 40) : createTrailMarker, x, z, radius: .9, layer: 2, group: 'structure', margin: 1, yaw: 0 });
    }
  });

  // === 2. Rim bluffs: red-rock walls along the playable edge ===
  const rimSpots = [];
  for (let t = -190; t <= 190; t += 27) rimSpots.push([t, bounds.minZ + 9, 0], [t, bounds.maxZ - 9, Math.PI], [bounds.minX + 8, t, Math.PI / 2], [bounds.maxX - 8, t, -Math.PI / 2]);
  rimSpots.forEach(([x, z, yaw], i) => {
    if (hash2(i, 5, 71) < .22) return;
    const length = 11 + hash2(i, 6, 72) * 8;
    place({ zone: 'Rim bluffs', type: 'bluff', make: () => createBluff(i + 100, length), x: x + (hash2(i, 7, 73) - .5) * 10, z: z + (hash2(i, 8, 74) - .5) * 6, radius: length * .55 + 1, layer: 2, group: 'solid', margin: 4.5, yaw: yaw + (hash2(i, 9, 75) - .5) * .5, collider: bluffCollider });
  });
  // Interior bluffs hug the steeper shoulders.
  scatter(34, 81, (x, z, r1) => {
    const slope = slopeAt(x, z), p = .1 + smoothstep(.22, .5, slope) * .95 + (fbm(x, z, 55, 83) - .5) * .5;
    if (r1 > p) return;
    const length = 10 + r1 * 20;
    place({ zone: 'Red ledges', type: 'bluff', make: () => createBluff(Math.floor(x * 7 + z), length), x, z, radius: length * .55 + 1, layer: 2, group: 'solid', margin: 4.5, yaw: Math.atan2(heightAt(x, z + 2) - heightAt(x, z - 2), heightAt(x + 2, z) - heightAt(x - 2, z)) + 1.57, collider: bluffCollider });
  });
  // Hoodoo colonies where ridged noise is high.
  scatter(26, 91, (x, z, r1, r2, id) => {
    if (fbm(x, z, 60, 93) < .6 || r1 > .7) return;
    const n = 2 + Math.floor(r2 * 3);
    for (let i = 0; i < n; i++) place({ zone: 'Hoodoo colony', type: 'hoodoo', make: () => createHoodoo(id + i * 5), x: x + (hash2(id, i, 5) - .5) * 14, z: z + (hash2(id, i, 6) - .5) * 14, radius: 3.6, layer: 2, group: 'solid', margin: 4.5, yaw: hash2(id, i, 7) * 6.28, scale: .7 + hash2(id, i, 8) * .55, collider: rockCollider(1.8, 4.5, 1.8) });
  });
  // Boulders everywhere, thicker on slopes.
  scatter(7.4, 101, (x, z, r1, r2, id) => {
    const p = .1 + smoothstep(.15, .5, slopeAt(x, z)) * .45 + (fbm(x, z, 30, 103) - .5) * .3;
    if (r1 > p) return;
    const size = .7 + r2 * 1.5;
    place({ zone: 'Boulder field', type: 'boulder', make: () => createBoulderCluster(id, size), x, z, radius: 1.8 * size + .5, layer: 2, group: 'solid', margin: 2.4, yaw: r2 * 6.28, collider: (asset, ax, ay, az) => newColliders.push({ kind: 'rock', role: 'scenery', center: new THREE.Vector3(ax, ay + .6 * size, az), radii: new THREE.Vector3(1.5 * size, .85 * size, 1.5 * size) }) });
  });

  // === 3. Trees and large cacti ===
  scatter(7.2, 111, (x, z, r1, r2, id) => {
    const h = heightAt(x, z), grove = fbm(x, z, 42, 113), p = smoothstep(9, 34, h) * (.12 + 1.15 * smoothstep(.45, .7, grove)) + .03;
    if (r1 > p) return;
    const pinon = h > 25 || r2 > .8;
    place({ zone: pinon ? 'Piñon ridge' : 'Juniper flats', type: pinon ? 'pinon' : 'juniper', make: () => pinon ? createPinon(id) : createJuniper(id), x, z, radius: pinon ? 2.6 : 2.5, layer: 2, group: 'solid', margin: 3.2, yaw: r2 * 6.28, scale: .8 + r2 * .5, collider: treeCollider });
  });
  scatter(14, 121, (x, z, r1, r2, id) => {
    const h = heightAt(x, z), p = .5 * (1 - smoothstep(18, 28, h)) * smoothstep(.4, .65, fbm(x, z, 75, 123)) + .03;
    if (r1 > p) return;
    place({ zone: 'Saguaro slope', type: 'saguaro', make: () => createSaguaro(id), x, z, radius: 1.6, layer: 2, group: 'solid', margin: 3, yaw: r2 * 6.28, scale: .8 + r2 * .45, collider: (asset, ax, ay, az, s) => newColliders.push({ kind: 'tree', role: 'scenery', x: ax, z: az, baseY: ay, trunkRadius: asset.userData.trunk * s + .1, canopyRadius: 1.3 * s, height: asset.userData.height * s, canopyBottom: 2 }) });
  });

  // === 4. Mid-height plants ===
  const mid = (zone, type, make, step, seed, prob, radius, margin2 = 2) => scatter(step, seed, (x, z, r1, r2, id) => {
    const p = prob(x, z); if (r1 > p) return;
    place({ zone, type, make: () => make(id), x, z, radius, layer: 1, group: 'flora', margin: margin2, yaw: r2 * 6.28, scale: .8 + r2 * .5 });
  });
  const low = h => 1 - smoothstep(14, 30, h);
  mid('Prickly pear', 'prickly-pear', createPricklyPear, 7.5, 131, (x, z) => .13 * low(heightAt(x, z)) + .025, 1.0);
  mid('Cholla garden', 'cholla', createCholla, 8, 133, (x, z) => .34 * smoothstep(.5, .7, fbm(x, z, 40, 137)) * low(heightAt(x, z)) + .012, 1.1);
  mid('Barrel cactus', 'barrel-cactus', createBarrelCactus, 12, 135, (x, z) => .16 * low(heightAt(x, z)), .8);
  mid('Ocotillo', 'ocotillo', createOcotillo, 13, 139, (x, z) => .3 * smoothstep(.45, .65, fbm(x, z, 50, 141)) + .02, 1.3);
  mid('Agave', 'agave', () => createAgave(), 11, 143, (x, z) => .18 * low(heightAt(x, z)) + .03, .9);
  mid('Yucca', 'yucca', () => createYucca(), 11.5, 145, (x, z) => .12 + .12 * smoothstep(.5, .7, fbm(x, z, 60, 147)), .8);
  mid('Rabbitbrush', 'rabbitbrush', createRabbitbrush, 9, 149, (x, z) => .26 * smoothstep(.4, .7, fbm(x, z, 35, 151)) + .03, 1.2);
  // Sagebrush is the matrix of the high desert: dense, patchy, thicker along washes.
  scatter(3.7, 153, (x, z, r1, r2, id) => {
    const wd = washDist(x, z), p = (.04 + .2 * smoothstep(.38, .62, fbm(x, z, 30, 155))) * (wd < 7 && wd > 0 ? 1.8 : 1);
    if (r1 > p) return;
    place({ zone: 'Sagebrush steppe', type: 'sagebrush', make: () => createSagebrush(id), x, z, radius: 1.2, layer: 1, group: 'flora', margin: 1.8, yaw: r2 * 6.28, scale: .85 + r2 * .65 });
  });

  // === 5. Ground cover: grass, flower meadows, wash cobbles ===
  scatter(3.4, 161, (x, z, r1, r2, id) => {
    const p = .02 + .075 * smoothstep(.45, .7, fbm(x, z, 24, 163)) + (washDist(x, z) < 10 ? .04 : 0);
    if (r1 > p) return;
    place({ zone: 'Bunchgrass', type: 'grass', make: () => createGrassTuft(id, Math.floor(r2 * 3)), x, z, radius: .6, layer: 0, group: 'cover', margin: 1.0, yaw: r2 * 6.28, scale: .85 + r2 * .8 });
  });
  scatter(30, 171, (x, z, r1, r2, id) => {
    if (fbm(x, z, 70, 173) < .52 || r1 > .8) return;
    const bloom = Math.floor(hash2(id, 3, 177) * 4), cx = x, cz = z;
    for (let i = 0; i < 12; i++) {
      const a = hash2(id, i, 11) * 6.28, d = Math.sqrt(hash2(id, i, 12)) * 8;
      place({ zone: 'Wildflower meadow', type: 'wildflowers', make: () => createWildflowers(id + i, hash2(id, i, 13) < .8 ? bloom : bloom + 1), x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, radius: .65, layer: 0, group: 'cover', margin: 1.0, yaw: a, scale: .9 + hash2(id, i, 14) * .7 });
      if (i % 2 === 0) place({ zone: 'Wildflower meadow', type: 'grass', make: () => createGrassTuft(id * 3 + i, 2), x: cx + Math.cos(a + 1) * d * .9, z: cz + Math.sin(a + 1) * d * .9, radius: .6, layer: 0, group: 'cover', margin: 1.0, yaw: a, scale: 1 });
    }
  });
  for (const w of wash) w.pts.forEach((p, i) => {
    if (i % 2) return;
    for (const side of [-1, 1]) {
      const a = hash2(i, side, 181) * 6.28, d = p.w * (.1 + .35 * hash2(i, side, 183)) * side;
      place({ zone: w.name, type: 'wash-cobbles', make: () => createStoneScatter(i * 3 + side), x: p.x + Math.cos(a) * d * .3 - (w.pts[Math.min(i + 1, w.pts.length - 1)].z - p.z) * .1 * side, z: p.z + Math.sin(a) * d * .3, radius: 1.3, layer: 0, group: 'cover', margin: .6, noWash: false, yaw: a });
    }
  });

  // === 6. Rustic fence runs along the perimeter, broken by noise ===
  const rim = [[bounds.minX + 3.5, bounds.minZ + 3.5, bounds.maxX - 3.5, bounds.minZ + 3.5], [bounds.maxX - 3.5, bounds.minZ + 3.5, bounds.maxX - 3.5, bounds.maxZ - 3.5], [bounds.maxX - 3.5, bounds.maxZ - 3.5, bounds.minX + 3.5, bounds.maxZ - 3.5], [bounds.minX + 3.5, bounds.maxZ - 3.5, bounds.minX + 3.5, bounds.minZ + 3.5]];
  let fenceBays = 0;
  rim.forEach(([ax, az, bx, bz], run) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 5);
    const style = run % 3 === 0 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const x0 = ax + (bx - ax) * i / n, z0 = az + (bz - az) * i / n, x1 = ax + (bx - ax) * (i + 1) / n, z1 = az + (bz - az) * (i + 1) / n, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (fbm(mx, mz, 55, 191 + run) < .42) continue;
      if ([[x0, z0], [x1, z1], [mx, mz]].some(([x, z]) => play.dist(x, z) < 3.2 || !occ.free(x, z, .5, 0) || washDist(x, z) < 2)) continue;
      const L = Math.hypot(x1 - x0, z1 - z0), bay = createFenceBay(L, heightAt(x1, z1) - heightAt(x0, z0), style);
      put(bay, 'structure', x0, z0, Math.atan2(-(z1 - z0), x1 - x0), 'Perimeter fence', 'fence', .5); fenceBays++;
    }
  });

  const batches = [
    ...bakeThunderbird(scene, groups.solid, 'Thunderbird scenery / rock and trees'),
    ...bakeThunderbird(scene, groups.structure, 'Thunderbird scenery / structures'),
    ...bakeThunderbird(scene, groups.flora, 'Thunderbird scenery / desert plants', { cast: false }),
    ...bakeThunderbird(scene, groups.cover, 'Thunderbird scenery / ground cover', { cast: false }),
  ];
  colliders.push(...newColliders);

  // === 7. Ground detail: wash ribbons, playa and colour patches, one mesh ===
  const verts = [], cols = [], idx = [], c0 = new THREE.Color(), c1 = new THREE.Color();
  const vertex = (x, z, color, lift = .09) => { verts.push(x, heightAt(x, z) + lift, z); cols.push(color.r, color.g, color.b); return verts.length / 3 - 1; };
  const sand = new THREE.Color(0xd9bb90), gravel = new THREE.Color(0xb59a7d);
  for (const w of wash) {
    const pts = w.pts;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (play.dist(a.x, a.z) < 1 || play.dist(b.x, b.z) < 1) continue;
      const row = p => {
        const next = pts[Math.min(pts.length - 1, pts.indexOf(p) + 1)], prev = pts[Math.max(0, pts.indexOf(p) - 1)];
        let tx = next.x - prev.x, tz = next.z - prev.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const nx = -tz, nz = tx, hw = p.w * .5 * (1 + .35 * (hash2(pts.indexOf(p), 3, 1) - .5));
        colorAt(p.x - nx * hw * 1.2, p.z - nz * hw * 1.2, c0);
        const edgeL = vertex(p.x - nx * hw * 1.25, p.z - nz * hw * 1.25, c0);
        colorAt(p.x + nx * hw * 1.2, p.z + nz * hw * 1.2, c1);
        const edgeR = vertex(p.x + nx * hw * 1.25, p.z + nz * hw * 1.25, c1);
        const mixed = sand.clone().lerp(gravel, hash2(pts.indexOf(p), 4, 2) * .5);
        return [edgeL, vertex(p.x - nx * hw * .55, p.z - nz * hw * .55, mixed), vertex(p.x + nx * hw * .55, p.z + nz * hw * .55, mixed), edgeR];
      };
      const ra = row(a), rb = row(b);
      for (let k = 0; k < 3; k++) idx.push(ra[k], rb[k], ra[k + 1], ra[k + 1], rb[k], rb[k + 1]);
    }
  }
  const patchColors = { caliche: 0xd6b88e, clay: 0x9a4630, gravel: 0x9d8670, dust: 0xb36d47, playa: 0xe0cba6, sage: 0x95905f, dark: 0x7b4a3b };
  let patches = 0;
  function blob(cx, cz, r, kind, seed) {
    const sector = 11, rings = [.55, 1];
    let scale = 1;
    for (let tries = 0; tries < 3; tries++, scale *= .72) {
      let ok = play.dist(cx, cz) > r * scale * .85;
      for (let k = 0; ok && k < sector; k++) { const a = k / sector * 6.283; ok = play.dist(cx + Math.cos(a) * r * scale, cz + Math.sin(a) * r * scale) > .8; }
      if (!ok) continue;
      const core = new THREE.Color(patchColors[kind]).multiplyScalar(.93 + .14 * hash2(seed, 1, 5));
      const center = vertex(cx, cz, core), ringIdx = rings.map((f, ri) => {
        const out = [];
        for (let k = 0; k < sector; k++) {
          const a = k / sector * 6.283, rad = r * scale * f * (.78 + .44 * hash2(seed, k + ri * 20, 9)), x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
          if (ri === 1) { colorAt(x, z, c0); out.push(vertex(x, z, c0.lerp(core, .12))); } else out.push(vertex(x, z, core.clone().lerp(colorAt(x, z, c1), .1)));
        }
        return out;
      });
      for (let k = 0; k < sector; k++) { const n = (k + 1) % sector; idx.push(center, ringIdx[0][k], ringIdx[0][n], ringIdx[0][k], ringIdx[1][k], ringIdx[0][n], ringIdx[0][n], ringIdx[1][k], ringIdx[1][n]); }
      patches++; return;
    }
  }
  const basin = findLowest(heightAt, bounds, play);
  if (basin) for (let i = 0; i < 10; i++) { const a = hash2(i, 1, 201) * 6.28, d = i * 4.5 * hash2(i, 2, 203); blob(basin[0] + Math.cos(a) * d, basin[1] + Math.sin(a) * d, 12 + 9 * hash2(i, 3, 205), 'playa', 300 + i); }
  scatter(15, 211, (x, z, r1, r2, id) => {
    if (r1 > .62) return;
    const kind = ['caliche', 'clay', 'gravel', 'sage', 'dark', 'dust'][Math.floor(r2 * 6)];
    blob(x, z, 4 + 6 * hash2(id, 5, 213), kind, id);
  });
  // dust halos beneath rock formations
  for (const p of placements) if (['hoodoo', 'bluff', 'arch'].includes(p.type)) blob(p.x, p.z, p.radius * 1.15, 'dust', Math.floor(p.x * 3 + p.z));
  let groundDetail = null;
  if (idx.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx); g.computeVertexNormals();
    groundDetail = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    groundDetail.name = 'Thunderbird ground detail'; groundDetail.receiveShadow = true;
    // Triangle winding varies with the terrain; render both faces so patches never vanish.
    groundDetail.material.side = THREE.DoubleSide;
    scene.add(groundDetail);
  }

  // === 8. Horizon: layered mesas on the skirt ===
  const mesas = [];
  const horizon = [];
  const nMesa = 30;
  for (let i = 0; i < nMesa; i++) {
    const a = i / nMesa * 6.283 + (hash2(i, 1, 301) - .5) * .18, far = i % 3 === 0 ? 1 : 0;
    const radius = 330 + hash2(i, 2, 303) * 70 + far * 120, x = Math.cos(a) * radius * 1.03, z = Math.sin(a) * radius * 1.03;
    const width = (22 + hash2(i, 3, 305) * 30) * (1 + far * .5), height = (20 + hash2(i, 4, 307) * 34) * (1 + far * .45);
    const asset = createMesa(i + 1, width, height);
    asset.position.set(x, skirtHeight(heightAt, x, z, plane) - 3, z); asset.rotation.y = hash2(i, 5, 309) * 6.28;
    asset.userData.tint = new THREE.Color(.95 + hash2(i, 6, 311) * .12, .95, .95);
    horizon.push(asset); mesas.push({ x, z, width, height });
  }
  const mesaBatches = bakeThunderbird(scene, horizon, 'Thunderbird scenery / horizon mesas', { cast: false });
  batches.push(...mesaBatches);

  const byType = {};
  for (const p of placements) byType[p.type] = (byType[p.type] ?? 0) + 1;
  return { placements, batches, groundDetail, wash, mesas, sites, stats: { ...stats, byType, colliders: newColliders.length, patches, fenceBays } };
}

function findLowest(heightAt, bounds, play) {
  let best = null, bh = Infinity;
  for (let x = bounds.minX + 40; x <= bounds.maxX - 40; x += 6) for (let z = bounds.minZ + 40; z <= bounds.maxZ - 40; z += 6) {
    const h = heightAt(x, z) + (play.dist(x, z) < 12 ? 100 : 0);
    if (h < bh) { bh = h; best = [x, z]; }
  }
  return best;
}
