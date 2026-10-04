import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batcher, mix } from './CedarKit.js';

// Cedar Hollow's forest dressing: creeks, ponds, trails, a ranger cabin and
// layered planting. Everything is deterministic (seeded value noise, no
// Math.random) and decorative only -- nothing here adds colliders. All placement
// is validated against `play.clearance`, the same tee / basket / fairway test
// used by the course itself, so no prop can crowd a lane, tee pad or basket.

const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const { lerp, smoothstep } = THREE.MathUtils;
function vnoise(x, z, seed = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const h = (i, j) => hash(i * 57.3 + j * 131.9 + seed * 17.7);
  return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
}
const fbm = (x, z, seed = 0) => vnoise(x, z, seed) * .55 + vnoise(x * 2.1, z * 2.1, seed + 3) * .3 + vnoise(x * 4.3, z * 4.3, seed + 7) * .15;

class Grid {
  constructor(cell = 8) { this.cell = cell; this.map = new Map(); this.maxR = 0; }
  key(i, j) { return (i + 2048) * 4096 + (j + 2048); }
  add(x, z, r) {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    if (!this.map.has(k)) this.map.set(k, []);
    this.map.get(k).push({ x, z, r }); this.maxR = Math.max(this.maxR, r);
  }
  blocked(x, z, r, pad = 0) {
    const reach = Math.ceil((r + this.maxR + pad) / this.cell), ci = Math.floor(x / this.cell), cj = Math.floor(z / this.cell);
    for (let i = ci - reach; i <= ci + reach; i++) for (let j = cj - reach; j <= cj + reach; j++) {
      const list = this.map.get(this.key(i, j));
      if (list) for (const p of list) if (Math.hypot(x - p.x, z - p.z) < r + p.r + pad) return true;
    }
    return false;
  }
}

// Nearest-distance field over sampled polylines (creeks, trails).
class PointField {
  constructor(cell = 8) { this.cell = cell; this.map = new Map(); this.maxW = 0; }
  add(x, z, w = 0) {
    const k = Math.floor(x / this.cell) * 8192 + Math.floor(z / this.cell);
    if (!this.map.has(k)) this.map.set(k, []);
    this.map.get(k).push([x, z, w]); this.maxW = Math.max(this.maxW, w);
  }
  // distance to the nearest edge (centre distance minus half width); Infinity beyond `reach`.
  distance(x, z, reach = 14) {
    const ci = Math.floor(x / this.cell), cj = Math.floor(z / this.cell), n = Math.ceil(reach / this.cell);
    let best = Infinity;
    for (let i = ci - n; i <= ci + n; i++) for (let j = cj - n; j <= cj + n; j++) {
      const list = this.map.get(i * 8192 + j);
      if (list) for (const [px, pz, w] of list) best = Math.min(best, Math.hypot(x - px, z - pz) - w);
    }
    return best;
  }
}

function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

// Same rules as the course's clearOfPlay(): tee > r + 7, basket > r + 8 and
// width / 2 + r + 2 from every fairway leg. Returned as a signed clearance.
export function makePlayField(holes) {
  const entries = holes.map(h => {
    const xs = h.route.map(p => p[0]), zs = h.route.map(p => p[1]);
    return { h, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  });
  const links = holes.map((h, i) => [h.route.at(-1), holes[(i + 1) % holes.length].route[0]]);
  return {
    clearance(x, z) {
      let best = Infinity;
      for (const e of entries) {
        const bd = Math.hypot(Math.max(e.minX - x, 0, x - e.maxX), Math.max(e.minZ - z, 0, z - e.maxZ));
        if (bd - 9 >= best) continue;
        const { route, width } = e.h;
        best = Math.min(best, Math.hypot(x - route[0][0], z - route[0][1]) - 7, Math.hypot(x - route.at(-1)[0], z - route.at(-1)[1]) - 8);
        for (let i = 1; i < route.length; i++) best = Math.min(best, segmentDistance(x, z, route[i - 1], route[i]) - width * .5 - 2);
      }
      return best;
    },
    linkDistance(x, z) { let best = Infinity; for (const [a, b] of links) best = Math.min(best, segmentDistance(x, z, a, b)); return best; },
    links,
  };
}

// ---------------------------------------------------------------- layout
// All coordinates sit inside the ring of fairways, which is otherwise empty.
const CREEKS = [
  { name: 'Hollow Creek', width: 2.6, points: [[30, 15], [21, 3], [19, -12], [23, -26], [29, -40], [35, -53], [41, -67], [47, -81], [53, -95], [50, -109], [42, -122], [37, -131]] },
  { name: 'Fern Creek', width: 2.1, points: [[-7, 2], [6, 10], [7, 23], [-2, 35], [-10, 47], [-17, 61], [-23, 74], [-29, 80]] },
];
const PONDS = [{ name: 'Mirror pond', x: 36, z: -137, r: 5.8 }, { name: 'Fern pond', x: -31, z: 82, r: 6 }];
const CLEARINGS = {
  cabin: { name: 'Ranger cabin clearing', x: 34, z: -98, r: 15 },
  meadow: { name: 'Wildflower meadow', x: -50, z: 64, r: 19 },
  glade: { name: 'Fairy glade', x: 88, z: -44, r: 10 },
  relic: { name: 'Logging relic', x: -72, z: -76, r: 11 },
  mother: { name: 'Mother cedar', x: -26, z: 18, r: 11 },
  grove: { name: 'Giant grove', x: 66, z: 50, r: 13 },
};
const BRIDGES = [{ creek: 0, x: 53, z: -95, name: 'Hollow footbridge' }, { creek: 1, x: -2, z: 35, name: 'Fern footbridge' }];
// Flyover used by the landing screen (mirrors main.js): tall props keep clear of it.
const FLYOVER = [[-165, 28, -170], [-185, 30, -80], [-165, 32, 30], [-110, 34, 145], [-10, 32, 185], [90, 34, 175], [165, 30, 120], [180, 28, 40], [155, 30, -70], [75, 32, -175], [-60, 30, -185]];

const SUN = new THREE.Vector3(-35, 82, -48).normalize();

export function planCedarForest(scene, world) {
  const { height: H, normalAt, holes, ground } = world;
  const play = makePlayField(holes);
  const batcher = new Batcher(scene);
  const records = [];
  const solid = new Grid(6), crowns = new Grid(8);
  const creekField = new PointField(8), trailField = new PointField(8);
  const up = new THREE.Vector3(0, 1, 0);
  const tilt = (x, z) => new THREE.Quaternion().setFromUnitVectors(up, normalAt(x, z));
  const inGround = (x, z, m = 1) => x > ground.minX + m && x < ground.maxX - m && z > ground.minZ + m && z < ground.maxZ - m;
  const playOk = (x, z, r, margin = 0) => play.clearance(x, z) > r + margin;
  let counter = 5000;
  const R = () => hash(counter++);
  const rec = (zone, type, x, z, radius, extra = {}) => { records.push({ zone, type, name: type, x, z, radius, ...extra }); };

  const flyover = new THREE.CatmullRomCurve3(FLYOVER.map(([x, h, z]) => new THREE.Vector3(x, H(x, z) + h, z)), true, 'centripetal').getSpacedPoints(480);
  // True when a prop whose crown is `r` wide and `top` high stays under the landing flyover.
  const aerialClear = (x, z, top, r) => flyover.every(p => Math.hypot(p.x - x, p.z - z) > r + 4 || p.y > top + 5);

  // -------------------------------------------------- creeks, ponds, bridges
  const creeks = CREEKS.map((c, ci) => {
    const curve = new THREE.CatmullRomCurve3(c.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const samples = curve.getSpacedPoints(Math.ceil(curve.getLength() / 2.4)).map((p, i, all) => {
      const a = all[Math.max(0, i - 1)], b = all[Math.min(all.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const w = c.width * (.82 + .4 * vnoise(i * .27, ci * 9));
      return { x: p.x, z: p.z, tx: (b.x - a.x) / l, tz: (b.z - a.z) / l, w };
    });
    samples.forEach(s => creekField.add(s.x, s.z, s.w * .5));
    return { ...c, samples };
  });
  for (const p of PONDS) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; creekField.add(p.x + Math.sin(a) * p.r * .6, p.z + Math.cos(a) * p.r * .6, p.r * .5); }
  const waterDistance = (x, z) => creekField.distance(x, z, 16);

  const bridges = BRIDGES.map(b => {
    const s = creeks[b.creek].samples.reduce((best, p) => Math.hypot(p.x - b.x, p.z - b.z) < Math.hypot(best.x - b.x, best.z - b.z) ? p : best);
    let nx = -s.tz, nz = s.tx; if (nx < 0 || (nx === 0 && nz < 0)) { nx = -nx; nz = -nz; }
    const yaw = Math.atan2(-nz, nx);
    const end = side => [s.x + nx * 5.5 * side, s.z + nz * 5.5 * side];
    const west = end(-1), east = end(1);
    const y = Math.max(H(...end(-1.1)), H(...end(1.1)), H(s.x, s.z)) - .5;
    return { ...b, x: s.x, z: s.z, yaw, y, west, east, nx, nz, tx: s.tx, tz: s.tz };
  });

  // -------------------------------------------------- trails
  const cabin = { ...CLEARINGS.cabin, yaw: Math.PI / 2 };
  const local = (c, lx, lz) => [c.x + lx * Math.cos(c.yaw) + lz * Math.sin(c.yaw), c.z - lx * Math.sin(c.yaw) + lz * Math.cos(c.yaw)];
  const trailDefs = [
    { name: 'Cabin lane', points: [local(cabin, -.7, 6.2), local(cabin, -1.6, 10), bridges[0].west] },
    { name: 'East bank trail', points: [bridges[0].east, [64, -90], [72, -77], [80, -62], [86, -50], [88, -45]] },
    { name: 'Meadow track', points: [local(cabin, -1.6, -5), [26, -96], [10, -91], [-15, -86], [-40, -81], [-62, -78]] },
    { name: 'Old-growth walk', points: [[-72, -65], [-69, -42], [-57, -17], [-43, 3], [-31, 12]] },
    { name: 'Fern walk', points: [[-28, 28], [-33, 42], [-39, 53], [-46, 61]] },
    { name: 'Hollow link', points: [[-19, 22], [-13, 29], bridges[1].west] },
    { name: 'Grove approach', points: [bridges[1].east, [10, 41], [28, 46], [48, 49], [60, 50]] },
  ];
  const trails = trailDefs.map(t => {
    const curve = new THREE.CatmullRomCurve3(t.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const samples = curve.getSpacedPoints(Math.max(4, Math.ceil(curve.getLength() / 2.6))).map((p, i, all) => {
      const a = all[Math.max(0, i - 1)], b = all[Math.min(all.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: p.x, z: p.z, tx: (b.x - a.x) / l, tz: (b.z - a.z) / l, w: 1.5 + .5 * vnoise(i * .21, 3) };
    });
    samples.forEach(s => trailField.add(s.x, s.z, s.w * .5));
    return { ...t, samples, length: curve.getLength() };
  });

  // -------------------------------------------------- shared checks
  const clearingList = Object.values(CLEARINGS);
  // Tree exclusion used by the course's own canopy as well as the extra planting.
  const blocksTree = (x, z, r = 2) => {
    if (clearingList.some(c => Math.hypot(x - c.x, z - c.z) < c.r + r * .4)) return true;
    if (waterDistance(x, z) < 3.2 + r * .4) return true;
    if (trailField.distance(x, z, 8) < 2.4 + r * .35) return true;
    return bridges.some(b => Math.hypot(x - b.x, z - b.z) < 8 + r * .3);
  };
  const flatOk = (x, z, r, tol) => { let mx = 0; for (let a = 0; a < 6; a++) mx = Math.max(mx, Math.abs(H(x + Math.cos(a * 1.047) * r, z + Math.sin(a * 1.047) * r) - H(x, z))); return mx <= tol; };

  // -------------------------------------------------- ground colour
  const cMoss = new THREE.Color(), cTmp = new THREE.Color();
  const bright = new THREE.Color(0x779c4c);
  function paintGround(geometry) {
    const pos = geometry.attributes.position, colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
      const n1 = fbm(x * .035, z * .035, 1), n2 = fbm(x * .06 + 40, z * .06, 2), n3 = fbm(x * .11, z * .11 + 7, 3);
      cMoss.set(0x35512f).lerp(cTmp.set(0x517a40), smoothstep(n1, .25, .75));
      cMoss.lerp(cTmp.set(0x5f4a30), smoothstep(n2, .58, .8) * .6);
      cMoss.lerp(cTmp.set(0x729651), smoothstep(n3, .66, .84) * .5);
      const gx = H(x + 1.5, z) - H(x - 1.5, z), gz = H(x, z + 1.5) - H(x, z - 1.5), slope = Math.hypot(gx, gz) / 3;
      cMoss.lerp(cTmp.set(0x5d5c4d), smoothstep(slope, .2, .42) * .7);
      cMoss.lerp(cTmp.set(0x6b8049), smoothstep(y, 15, 24) * .35);
      const wd = waterDistance(x, z);
      if (wd < 12) cMoss.lerp(cTmp.set(0x294632), (1 - smoothstep(wd, 2, 11)) * .65);
      for (const c of clearingList) {
        const d = Math.hypot(x - c.x, z - c.z), t = 1 - smoothstep(d, c.r * .55, c.r * 1.05);
        if (t > 0) cMoss.lerp(c === CLEARINGS.meadow ? bright : cTmp.set(c === CLEARINGS.cabin || c === CLEARINGS.relic ? 0x6f7648 : 0x5d8546), t * .75);
      }
      if (hash(i * .73) > .8) cMoss.multiplyScalar(.94);
      colors[i * 3] = cMoss.r; colors[i * 3 + 1] = cMoss.g; colors[i * 3 + 2] = cMoss.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  // -------------------------------------------------- water + path surfaces
  const waterMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .18, side: THREE.DoubleSide });
  const decalMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });

  function strip(samples, halfWidth, heightAt, edge, centre, noise = 0) {
    const pos = [], col = [], idx = [], c = new THREE.Color();
    samples.forEach((s, i) => {
      const w = halfWidth(s), nx = -s.tz, nz = s.tx;
      for (const side of [-1, 0, 1]) {
        const x = s.x + nx * w * side, z = s.z + nz * w * side;
        pos.push(x, heightAt(x, z, s, side), z);
        c.copy(side === 0 ? centre : edge); const j = 1 + (hash(i * 3.1 + side * 7.7) - .5) * noise; col.push(c.r * j, c.g * j, c.b * j);
      }
      if (i < samples.length - 1) { const a = i * 3; idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    g.computeVertexNormals(); return g.toNonIndexed();
  }
  const finish = g => { g.deleteAttribute('uv'); return g; };

  const waterParts = [], decalParts = [];
  for (const c of creeks) {
    waterParts.push(strip(c.samples, s => s.w * .5, (x, z, s) => Math.max(H(s.x, s.z), H(s.x - s.tz * s.w * .5, s.z + s.tx * s.w * .5), H(s.x + s.tz * s.w * .5, s.z - s.tx * s.w * .5)) + .06, new THREE.Color(0x6fb2aa), new THREE.Color(0x2f6c78), .05));
    decalParts.push(strip(c.samples, s => s.w * .5 + 1.4, (x, z) => H(x, z) + .045, new THREE.Color(0x4f5b3a), new THREE.Color(0x4a3c2d), .12));
  }
  for (const p of PONDS) {
    let rimMax = -Infinity; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; rimMax = Math.max(rimMax, H(p.x + Math.sin(a) * p.r, p.z + Math.cos(a) * p.r)); }
    p.level = rimMax + .06;
    const g = new THREE.CylinderGeometry(p.r, p.r * .92, .8, 18); g.translate(p.x, p.level - .4, p.z); g.deleteAttribute('uv');
    const ng = g.toNonIndexed(), colors = [], pos = ng.attributes.position, nrm = ng.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const top = nrm.getY(i) > .5, d = Math.hypot(pos.getX(i) - p.x, pos.getZ(i) - p.z) / p.r; const c = top ? mix(0x2f6c78, 0x6fb2aa, d * d) : new THREE.Color(0x244f5a); colors.push(c.r, c.g, c.b); }
    ng.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); waterParts.push(ng);
    // muddy rim hides the seam between the pond and the sloping bank
    const ring = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; ring.push({ x: p.x + Math.sin(a) * (p.r + .4), z: p.z + Math.cos(a) * (p.r + .4), tx: Math.cos(a), tz: -Math.sin(a), w: 1 }); }
    decalParts.push(strip(ring, () => 1.7, (x, z) => Math.max(H(x, z) + .05, p.level - .02), new THREE.Color(0x4f5b3a), new THREE.Color(0x4a3c2d), .1));
  }
  for (const t of trails) decalParts.push(strip(t.samples, s => s.w * .5, (x, z) => H(x, z) + .1, new THREE.Color(0x76593a), new THREE.Color(0xa3835a), .1));
  const meshes = [];
  const bakeStatic = (parts, material, name, shadow = false) => {
    const geometry = mergeGeometries(parts.map(finish), false); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.receiveShadow = true; mesh.castShadow = shadow; mesh.userData.decorative = true;
    scene.add(mesh); meshes.push(mesh); return mesh;
  };
  bakeStatic(waterParts, waterMaterial, 'Cedar creeks and ponds');
  bakeStatic(decalParts, decalMaterial, 'Cedar trails, mud and banks');

  // -------------------------------------------------- the planting pass
  function populate(colliders) {
    for (const c of colliders) {
      if (c.kind === 'tree' && c.role !== 'underbrush') { solid.add(c.x, c.z, Math.max(.7, c.trunkRadius + .3)); crowns.add(c.x, c.z, c.canopyRadius * .72); }
      else if (c.kind === 'rock') solid.add(c.center.x, c.center.z, Math.max(c.radii.x, c.radii.z) * .95);
    }
    const poseY = (x, z, lift = 0) => H(x, z) + lift;
    const put = (kit, x, z, { yaw = 0, scale = 1, tint = 1, lift = 0, tilted = false, zone, type, radius = 0, noRecord = false } = {}) => {
      batcher.add(kit, x, poseY(x, z, lift), z, yaw, scale, tint, tilted ? tilt(x, z) : null);
      if (zone && !noRecord) rec(zone, type || kit, x, z, radius);
    };
    // A prop with a footprint: validates play clearance and registers it as solid.
    const solidProp = (kit, x, z, radius, opts = {}) => {
      if (!inGround(x, z, radius) || !playOk(x, z, radius, opts.margin ?? 1.5) || solid.blocked(x, z, radius) || waterDistance(x, z) < radius + .5) return false;
      put(kit, x, z, { ...opts, radius }); solid.add(x, z, radius); return true;
    };
    const scatterCount = {};
    const count = key => { scatterCount[key] = (scatterCount[key] || 0) + 1; };

    // ---------- ranger cabin clearing
    {
      const c = cabin, zone = c.name;
      const corners = [[-4, -3.5], [4, -3.5], [-4, 6], [4, 6]].map(([lx, lz]) => local(c, lx, lz));
      const y = Math.max(...corners.map(p => H(...p))) - .12;
      for (const kit of ['cabin', 'cabinGlow']) batcher.add(kit, c.x, y, c.z, c.yaw, 1);
      solid.add(c.x, c.z, 8); rec(zone, 'ranger-cabin', c.x, c.z, 8);
      // campfire ring with log seats, plus a bench each side of the porch lane
      const fire = local(c, 7.5, 9); put('campfire', ...fire, { zone, type: 'campfire', radius: 2.2 }); put('embers', ...fire, { noRecord: true }); solid.add(fire[0], fire[1], 2.4);
      for (const [lx, lz, a] of [[4.6, 9, Math.PI / 2], [10.6, 9, -Math.PI / 2], [7.5, 12.2, Math.PI]]) { const p = local(c, lx, lz); put('log', p[0], p[1], { yaw: c.yaw + a + .5, scale: .45, zone, type: 'log-seat', radius: 1.2 }); solid.add(p[0], p[1], 1.2); }
      for (const [lx, lz] of [[-9, 4], [9.4, -2]]) { const p = local(c, lx, lz); put('bench', p[0], p[1], { yaw: c.yaw + Math.PI / 2 * Math.sign(lx), zone, type: 'bench', radius: 1.6 }); solid.add(p[0], p[1], 1.6); }
      // yard fence with a gate gap toward the footbridge and a rear gap for the meadow track
      const sections = [[[-12, -9], [-3.2, -9]], [[3.2, -9], [12, -9]], [[12, -9], [12, 11]], [[12, 11], [4.6, 11]], [[-4.6, 11], [-12, 11]], [[-12, 11], [-12, -9]]];
      for (const [a, b] of sections) fenceRun([local(c, ...a), local(c, ...b)], zone);
      for (const [lx, lz] of [[-5.6, 11.4], [5.6, 11.4]]) lanternPost(...local(c, lx, lz), c.yaw + (lx < 0 ? 0 : Math.PI), zone);
      lanternPost(...local(c, 3.3, 6.8), c.yaw - Math.PI / 2, zone);
      put('trailMarker', ...local(c, -4.5, 12.5), { yaw: c.yaw, zone, type: 'trail-marker', radius: .5 });
      put('signpost', ...local(c, 4, 12.8), { yaw: c.yaw + Math.PI / 2 + .3, zone, type: 'signpost', radius: .8 });
    }

    function fenceRun(points, zone, { skipEvery = 0 } = {}) {
      for (let s = 1; s < points.length; s++) {
        const a = points[s - 1], b = points[s], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 3));
        for (let k = 0; k < n; k++) {
          if (skipEvery && (k + s) % skipEvery === 0) continue;
          const p0 = [lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)], p1 = [lerp(a[0], b[0], (k + 1) / n), lerp(a[1], b[1], (k + 1) / n)];
          const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
          if (!inGround(mid[0], mid[1], 1) || !playOk(mid[0], mid[1], 1.6, 1) || waterDistance(mid[0], mid[1]) < 2) continue;
          const h0 = H(...p0), h1 = H(...p1), step = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(p1[0] - p0[0], h1 - h0, p1[1] - p0[1]).normalize());
          batcher.add('fence', mid[0], (h0 + h1) / 2, mid[1], 0, [step / 3, 1, 1], 1, q);
          rec(zone, 'fence', mid[0], mid[1], 1.5);
        }
      }
    }
    function lanternPost(x, z, yaw, zone) {
      if (!inGround(x, z, 1) || !playOk(x, z, .8, .5) || solid.blocked(x, z, .5)) return false;
      for (const kit of ['lantern', 'lanternGlow', 'lanternHalo']) batcher.add(kit, x, H(x, z), z, yaw, 1);
      solid.add(x, z, .6); rec(zone, 'lantern', x, z, .6); return true;
    }

    // ---------- bridges and creek crossings
    for (const b of bridges) {
      batcher.add('footbridge', b.x, b.y, b.z, b.yaw, 1); solid.add(b.x, b.z, 5.2); rec(b.name, 'footbridge', b.x, b.z, 5.2, { yaw: b.yaw });
      for (const side of [-1, 1]) {
        const e = side < 0 ? b.west : b.east;
        // one lamp per bank, on the upstream side of the approach, arm reaching over the path
        lanternPost(e[0] + b.tx * 2.4 + b.nx * side * .6, e[1] + b.tz * 2.4 + b.nz * side * .6, Math.atan2(side * b.nz, -side * b.nx), b.name);
        // railing fence runs hugging the bank on both sides of the crossing
        for (const dir of [-1, 1]) fenceRun([[b.x + b.nx * 5.6 * side + b.tx * 2.5 * dir, b.z + b.nz * 5.6 * side + b.tz * 2.5 * dir], [b.x + b.nx * 5.6 * side + b.tx * 9 * dir, b.z + b.nz * 5.6 * side + b.tz * 9 * dir]], b.name);
      }
    }
    // stepping stones across Hollow Creek on the walk toward the glade
    {
      const c = creeks[0], s = c.samples.reduce((best, p) => Math.hypot(p.x - 24, p.z + 30) < Math.hypot(best.x - 24, best.z + 30) ? p : best);
      for (let i = -3; i <= 3; i++) {
        const x = s.x + -s.tz * i * 1.15, z = s.z + s.tx * i * 1.15, lvl = Math.max(H(x, z), H(s.x, s.z)) + .02;
        batcher.add('flatStone', x, lvl, z, i * .9, [1.1 + (i % 2) * .2, 1, 1.1]);
      }
      rec('Hollow Creek', 'stepping-stones', s.x, s.z, 4);
    }

    // ---------- creek banks, ponds
    for (const c of creeks) {
      c.samples.forEach((s, i) => {
        if (i % 3 !== 1) return;
        for (const side of [-1, 1]) {
          const r = R(), off = s.w * .5 + .7 + r * 1.4, x = s.x - s.tz * off * side, z = s.z + s.tx * off * side;
          if (!playOk(x, z, 1, 2) || solid.blocked(x, z, .5) || bridges.some(b => Math.hypot(x - b.x, z - b.z) < 6.5)) continue;
          if (r < .22) { put('boulderSmall', x, z, { yaw: r * 20, scale: .8 + r * 2, tint: .9 + R() * .15, lift: -.1, zone: c.name, type: 'creek-boulder', radius: 1 }); solid.add(x, z, .8); }
          else if (r < .5) put('reeds', x, z, { yaw: r * 30, scale: .9 + R() * .4, zone: c.name, type: 'reeds', radius: .5 });
          else if (r < .75) put('fernDeep', x, z, { yaw: r * 40, scale: .8 + R() * .5, tint: .85 + R() * .2, zone: c.name, type: 'fern', radius: .6 });
          else put('pebbles', x, z, { yaw: r * 9, scale: .8, tilted: true, zone: c.name, type: 'pebbles', radius: .6 });
        }
      });
    }
    for (const p of PONDS) {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2 + hash(i + p.x) * .3, rr = p.r + .2 + R() * 1.2, x = p.x + Math.sin(a) * rr, z = p.z + Math.cos(a) * rr;
        if (!playOk(x, z, 1, 1)) continue;
        if (i % 3 === 0) put('reeds', x, z, { yaw: a * 5, scale: 1.1 + R() * .5, zone: p.name, type: 'reeds', radius: .6 });
        else if (i % 3 === 1) { put('boulderSmall', x, z, { yaw: a * 3, scale: 1 + R() * 1.2, lift: -.12, zone: p.name, type: 'creek-boulder', radius: 1 }); solid.add(x, z, 1); }
        else put('fernDeep', x, z, { yaw: a * 2, scale: .9 + R() * .5, zone: p.name, type: 'fern', radius: .7 });
      }
      for (let i = 0; i < 6; i++) { const a = i * 2.4, rr = R() * (p.r - 1.6), x = p.x + Math.sin(a) * rr, z = p.z + Math.cos(a) * rr; batcher.add('lily', x, p.level + .02, z, a, .8 + R() * .4); }
      rec(p.name, 'pond', p.x, p.z, p.r);
    }

    // ---------- meadow
    {
      const m = CLEARINGS.meadow, zone = m.name;
      for (let gx = m.x - m.r; gx <= m.x + m.r; gx += 2.1) for (let gz = m.z - m.r; gz <= m.z + m.r; gz += 2.1) {
        const x = gx + (R() - .5) * 2, z = gz + (R() - .5) * 2, d = Math.hypot(x - m.x, z - m.z);
        if (d > m.r - 1 + (vnoise(x * .2, z * .2) - .5) * 5 || waterDistance(x, z) < 1.4 || trailField.distance(x, z, 4) < 1.4 || solid.blocked(x, z, .3)) continue;
        const patch = vnoise(x * .13, z * .13, 11), pick = R();
        const kit = patch < .28 ? 'lupine' : patch < .55 ? 'meadow' : patch < .78 ? 'bluebell' : 'foxglove';
        if (pick < .78) put(kit, x, z, { yaw: pick * 40, scale: .9 + R() * .55, tint: .85 + R() * .25, zone, type: 'wildflowers', radius: .8 });
        else if (pick < .92) put('grass', x, z, { yaw: pick * 20, scale: .9 + R() * .5, tint: .9 + R() * .2, zone, type: 'grass', radius: .5 });
        else put('fernDeep', x, z, { yaw: pick * 50, scale: .8, zone, type: 'fern', radius: .6 });
      }
      for (const [dx, dz, s] of [[-9, 4, 1.4], [8, -9, 1.1], [5, 11, 1.7]]) solidProp('boulderSlab', m.x + dx, m.z + dz, 2.4 * s, { yaw: dx, scale: s, tint: 1, zone, type: 'mossy-boulder' });
      solidProp('bench', m.x - 6, m.z - 12.5, 1.7, { yaw: Math.PI * .05, zone, type: 'bench' });
      for (const [lx, lz] of [[-12, -9], [11, -12], [13, 4], [-14, 6]]) lanternPost(m.x + lx, m.z + lz, Math.atan2(lz, -lx), zone);
    }

    // ---------- fairy glade
    {
      const g = CLEARINGS.glade, zone = g.name;
      put('fairyRing', g.x, g.z, { yaw: .4, scale: 1.7, zone, type: 'fairy-ring', radius: 2.6 }); solid.add(g.x, g.z, 3.6);
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39996 + 1, rr = 3.6 + R() * (g.r - 4.5), x = g.x + Math.sin(a) * rr, z = g.z + Math.cos(a) * rr;
        if (waterDistance(x, z) < 2 || trailField.distance(x, z, 4) < 1.3 || solid.blocked(x, z, .4) || !playOk(x, z, .6)) continue;
        const kit = ['shroomRed', 'shroomOrange', 'shroomBrown', 'bluebell'][i % 4];
        put(kit, x, z, { yaw: a * 4, scale: 1.5 + R() * .7, tint: .95 + R() * .1, zone, type: kit === 'bluebell' ? 'wildflowers' : 'mushrooms', radius: .8 });
      }
      for (const [dx, dz, s, kit] of [[-6.5, -2, 1.5, 'boulder'], [6, 5, 1.2, 'boulderSlab'], [-3, 7.5, 1, 'boulder'], [4, -7, 1.3, 'boulder']]) solidProp(kit, g.x + dx, g.z + dz, 2 * s, { yaw: dx * 3, scale: s, tint: 1, zone, type: 'mossy-boulder' });
      solidProp('logNurse', g.x + 7.5, g.z - 5.5, 2.6, { yaw: .6, scale: 1, zone, type: 'nurse-log' });
      solidProp('snagTall', g.x - 8.5, g.z + 4.8, 1, { yaw: 2, scale: 1.15, zone, type: 'snag' });
      lanternPost(g.x + 5.5, g.z + 8.2, 2.4, zone); lanternPost(g.x - 5, g.z - 7.5, -.7, zone);
    }

    // ---------- logging relic
    {
      const r = CLEARINGS.relic, zone = r.name;
      for (let i = 0; i < 9; i++) {
        const a = i * 2.2, rr = 2 + R() * (r.r - 3), x = r.x + Math.sin(a) * rr, z = r.z + Math.cos(a) * rr;
        if (trailField.distance(x, z, 4) < 2.2) continue;
        solidProp(i % 3 === 0 ? 'stumpTall' : 'stump', x, z, 1.2, { yaw: a * 3, scale: .9 + R() * .7, zone, type: 'stump' });
      }
      for (const [dx, dz, a] of [[-5, 5, .4], [5.5, -4.5, 2.4], [1, 8, 1.2]]) solidProp(a > 2 ? 'logRoot' : 'log', r.x + dx, r.z + dz, 3, { yaw: a, scale: 1.1, zone, type: 'fallen-log' });
      fenceRun([[r.x - 9, r.z - 8], [r.x - 9, r.z + 5], [r.x - 3, r.z + 11]], zone, { skipEvery: 3 });
      lanternPost(r.x + 7, r.z + 6.5, 1.3, zone);
    }

    // ---------- mother cedar and her grove ring
    {
      const m = CLEARINGS.mother, zone = m.name;
      batcher.add('giant', m.x, H(m.x, m.z) - .3, m.z, .5, [1.75, 1.7, 1.75], 1.02); solid.add(m.x, m.z, 5.5); rec(zone, 'giant-cedar', m.x, m.z, 5.5, { height: 46 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3, x = m.x + Math.sin(a) * 8.2, z = m.z + Math.cos(a) * 8.2; if (trailField.distance(x, z, 4) < 1.8) continue; solidProp('boulder', x, z, 1.9, { yaw: a * 2, scale: .8 + R() * .5, zone, type: 'mossy-boulder' }); }
      fenceRun(Array.from({ length: 10 }, (_, i) => [m.x + Math.sin(i / 9 * 4.6 + 3.5) * 6.4, m.z + Math.cos(i / 9 * 4.6 + 3.5) * 6.4]), zone);
      for (const a of [.8, 2.3, 4.1]) lanternPost(m.x + Math.sin(a) * 9.5, m.z + Math.cos(a) * 9.5, a + Math.PI, zone);
      solidProp('bench', m.x + 8.5, m.z - 3, 1.7, { yaw: -Math.PI / 2, zone, type: 'bench' });
      solidProp('signpost', m.x - 5.5, m.z + 8.5, .9, { yaw: .6, zone, type: 'signpost' });
    }

    // ---------- giant grove
    {
      const g = CLEARINGS.grove, zone = g.name;
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + .4, rr = 4 + R() * (g.r - 3), x = g.x + Math.sin(a) * rr, z = g.z + Math.cos(a) * rr, s = .95 + R() * .3;
        if (trailField.distance(x, z, 6) < 3) continue;
        if (solidProp('giant', x, z, 3.2, { yaw: a * 4, scale: [s, s * .95, s], tint: .95 + R() * .1, zone, type: 'giant-conifer', margin: 8 })) {
          rec(zone, 'hanging-moss', x, z, .5); for (let k = 0; k < 3; k++) { const ka = a + k * 2.1; batcher.add('hangingMoss', x + Math.sin(ka) * 3.2 * s, H(x, z) + 10.5 * s, z + Math.cos(ka) * 3.2 * s, ka, 1.3); }
        }
      }
      for (const [dx, dz] of [[0, 0], [4, -5], [-6, 3]]) solidProp(R() < .5 ? 'boulder' : 'boulderSlab', g.x + dx, g.z + dz, 2.4, { yaw: dx, scale: 1.1, zone, type: 'mossy-boulder' });
    }

    // ---------- trailhead and the walking links between holes
    {
      const [a, b] = play.links[17], zone = 'Trailhead';
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
      const yaw = Math.atan2(-ux, -uz); // the arch's x axis crosses the link
      // slide the arch along the link until both posts are clear of every lane
      for (const t of [0, -.08, .08, -.16, .16, -.24, .24]) {
        const x = lerp(a[0], b[0], .55 + t), z = lerp(a[1], b[1], .55 + t);
        const px = x - uz * 3.4, pz = z + ux * 3.4, qx = x + uz * 3.4, qz = z - ux * 3.4;
        if (!playOk(px, pz, 1, 1) || !playOk(qx, qz, 1, 1) || !inGround(x, z, 4)) continue;
        batcher.add('arch', x, Math.min(H(px, pz), H(qx, qz), H(x, z)) - .1, z, yaw, 1);
        solid.add(px, pz, 1); solid.add(qx, qz, 1); rec(zone, 'trailhead-arch', x, z, 1); break;
      }
    }
    for (const [a, b] of play.links) {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
      // trail marker posts and the occasional lantern, set well back from the walking line
      for (const [t, off] of [[.3, 4.2], [.7, -4.2]]) {
        const x = a[0] + ux * l * t - uz * off, z = a[1] + uz * l * t + ux * off;
        if (!inGround(x, z, 2) || !playOk(x, z, .5, 1.2) || solid.blocked(x, z, .4)) continue;
        put('trailMarker', x, z, { yaw: Math.atan2(-uz, ux) + (off > 0 ? 0 : Math.PI), zone: 'Walking link', type: 'trail-marker', radius: .5 }); solid.add(x, z, .5);
      }
    }
    {
      // Lantern Bend: lamps flank hole 16's fairway, sliding to the nearest spot that clears lanes and trunks.
      const h = holes[15], zone = 'Lantern Bend / Hole 16';
      for (let i = 1; i < h.route.length; i++) {
        const a = h.route[i - 1], b = h.route[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
        for (let d = 9; d < l - 5; d += 13) for (const side of [-1, 1]) {
          for (const [slide, off] of [[0, 3.8], [2, 4.4], [-2, 4.4], [4, 5.2], [-4, 5.2], [0, 6.4]]) {
            const o = h.width * .5 + off;
            if (lanternPost(a[0] + ux * (d + slide) - uz * o * side, a[1] + uz * (d + slide) + ux * o * side, Math.atan2(side * ux, side * uz), zone)) break;
          }
        }
      }
      for (const hole of holes) for (const side of [-1, 1]) {
        const [a, b] = [hole.route[0], hole.route[1]], l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
        const x = a[0] - ux * 3 - uz * 9 * side, z = a[1] - uz * 3 + ux * 9 * side;
        if (hole.id % 3 === 1 && inGround(x, z, 2) && playOk(x, z, .6, 1) && !solid.blocked(x, z, .5)) { put('trailMarker', x, z, { yaw: Math.atan2(-uz, ux), zone: 'Tee marker', type: 'trail-marker', radius: .5 }); solid.add(x, z, .5); }
      }
    }

    // ---------- big trees (non-colliding): fill the forest in layers
    const treeKit = (x, z, h, wet, r) => {
      if (h > 14) return r < .32 ? 'fir' : r < .6 ? 'spruce' : r < .8 ? 'giant' : r < .92 ? 'hemlock' : 'cedar';
      if (wet) return r < .3 ? 'cedar' : r < .5 ? 'hemlock' : r < .65 ? 'alder' : r < .78 ? 'maple' : r < .9 ? 'spruce' : 'fir';
      return r < .25 ? 'cedar' : r < .45 ? 'fir' : r < .62 ? 'hemlock' : r < .8 ? 'spruce' : r < .88 ? 'giant' : r < .94 ? 'maple' : 'alder';
    };
    const SPECS = { cedar: [3.6, 17], fir: [2.7, 22], spruce: [2.1, 15], hemlock: [2.7, 14], giant: [5.4, 27], alder: [2.2, 8], maple: [2.8, 8] };
    for (let gx = ground.minX + 3; gx < ground.maxX - 2; gx += 8.2) for (let gz = ground.minZ + 3; gz < ground.maxZ - 2; gz += 8.2) {
      const x = gx + (R() - .5) * 6.5, z = gz + (R() - .5) * 6.5, density = fbm(x * .02, z * .02, 5);
      if (R() > .2 + density * .55 || !inGround(x, z, 1.5)) continue;
      const h = H(x, z), wet = waterDistance(x, z) < 15 || h < 3.2, kit = treeKit(x, z, h, wet, R()), [r0, height] = SPECS[kit];
      const s = (kit === 'giant' ? .8 + R() * .3 : kit === 'alder' || kit === 'maple' ? .85 + R() * .5 : .72 + R() * .5) * (kit === 'giant' ? 1 : 1);
      const crown = r0 * s, top = height * s;
      // not colliding, so keep them behind the lane trees, clear of play and the flyover
      if (!playOk(x, z, crown * .8, 6.5) || blocksTree(x, z, crown) || crowns.blocked(x, z, crown * .66) || solid.blocked(x, z, .8) || play.linkDistance(x, z) < crown * .5 + 1.5) continue;
      if (top > 12 && !aerialClear(x, z, top, crown)) continue;
      const tint = .82 + R() * .3;
      batcher.add(kit, x, h - .15, z, R() * 6.28, s, tint);
      crowns.add(x, z, crown * .66); solid.add(x, z, Math.max(.7, crown * .1));
      rec('Old-growth forest', kit === 'giant' ? 'giant-conifer' : kit === 'alder' || kit === 'maple' ? 'broadleaf' : 'conifer', x, z, crown, { height: top });
      if ((kit === 'giant' || kit === 'cedar' || kit === 'hemlock') && R() < .16) {
        for (let k = 0; k < 2; k++) { const a = R() * 6.28; batcher.add('hangingMoss', x + Math.sin(a) * crown * .62, h + top * (kit === 'giant' ? .42 : .2), z + Math.cos(a) * crown * .62, a, 1 + R() * .5); }
        rec('Old-growth forest', 'hanging-moss', x, z, .5);
      }
    }

    // ---------- snags, fallen timber, boulders
    const scatter = (step, fn) => {
      for (let gx = ground.minX + 2; gx < ground.maxX - 2; gx += step) for (let gz = ground.minZ + 2; gz < ground.maxZ - 2; gz += step) {
        const x = gx + (R() - .5) * step * .9, z = gz + (R() - .5) * step * .9;
        if (inGround(x, z, 1)) fn(x, z);
      }
    };
    scatter(23, (x, z) => {
      if (R() > .62) return;
      const tall = R() < .6;
      if (!playOk(x, z, 1.2, 6) || blocksTree(x, z, 1.5) || crowns.blocked(x, z, 1.5)) return;
      const s = .85 + R() * .5; if (tall && !aerialClear(x, z, 12 * s, 1.5)) return;
      if (solidProp(tall ? 'snagTall' : 'snagBroken', x, z, 1, { yaw: R() * 6.28, scale: s, zone: 'Standing dead timber', type: 'snag', margin: 6 })) crowns.add(x, z, 1);
    });
    scatter(15, (x, z) => {
      if (R() > .45) return;
      const kind = R(), kit = kind < .38 ? 'log' : kind < .6 ? 'logNurse' : kind < .78 ? 'logRoot' : kind < .92 ? 'stump' : 'stumpTall';
      const len = kit.startsWith('log') ? 3.2 : 1.3;
      if (!playOk(x, z, len, 2.5) || blocksTree(x, z, 1.5) || play.linkDistance(x, z) < len + 1) return;
      solidProp(kit, x, z, len, { yaw: R() * 6.28, scale: .8 + R() * .55, tint: 1, zone: 'Fallen timber', type: kit.startsWith('log') ? 'fallen-log' : 'stump', margin: 2.5 });
    });
    scatter(11, (x, z) => {
      if (R() > .3) return;
      const kind = R(), kit = kind < .45 ? 'boulder' : kind < .7 ? 'boulderSlab' : 'boulderSmall';
      const s = .8 + R() * 1.1, rad = 1.6 * s;
      if (!playOk(x, z, rad, 2.5) || blocksTree(x, z, 1.2) || play.linkDistance(x, z) < rad + 1.5) return;
      solidProp(kit, x, z, rad, { yaw: R() * 6.28, scale: s, tint: .88 + R() * .2, lift: -.18, zone: 'Mossy boulders', type: 'mossy-boulder', margin: 2.5 });
    });

    // ---------- understory
    scatter(6, (x, z) => {
      if (!playOk(x, z, .8, .3) || waterDistance(x, z) < 1.1 || trailField.distance(x, z, 4) < 1.2 || solid.blocked(x, z, .3)) return;
      if (clearingList.some(c => c !== CLEARINGS.mother && Math.hypot(x - c.x, z - c.z) < c.r - 1 && c !== CLEARINGS.grove)) return;
      const h = H(x, z), wet = 1 - smoothstep(waterDistance(x, z), 2, 22), shade = fbm(x * .05, z * .05, 8), pick = R();
      const fernP = .14 + wet * .2 + shade * .1, bushP = .045 + shade * .04;
      if (pick < fernP) { const deep = wet > .35 && R() < .65; put(deep ? 'fernDeep' : h > 15 && R() < .5 ? 'bracken' : 'fern', x, z, { yaw: R() * 6.28, scale: .8 + R() * .6, tint: .8 + R() * .3, zone: 'Understory', type: 'fern', radius: .7 }); count('fern'); }
      else if (pick < fernP + bushP) { put(R() < .55 ? 'salal' : 'huckleberry', x, z, { yaw: R() * 6.28, scale: .8 + R() * .6, tint: .85 + R() * .25, zone: 'Understory', type: 'undergrowth', radius: 1 }); count('bush'); }
      else if (pick < fernP + bushP + .08) { put('grass', x, z, { yaw: R() * 6.28, scale: .8 + R() * .7, tint: .85 + R() * .3, zone: 'Understory', type: 'grass', radius: .5 }); count('grass'); }
      else if (pick < fernP + bushP + .12 && play.clearance(x, z) > 6) { put('sapling', x, z, { yaw: R() * 6.28, scale: .8 + R() * .8, tint: .8 + R() * .3, zone: 'Understory', type: 'sapling', radius: .8 }); count('sapling'); }
    });
    scatter(13, (x, z) => {
      if (R() > .2 || !playOk(x, z, .8, .5) || waterDistance(x, z) < 1.5 || trailField.distance(x, z, 4) < 1.3 || solid.blocked(x, z, .5)) return;
      const pick = R();
      const kit = pick < .4 ? 'shroomBrown' : pick < .72 ? 'shroomRed' : 'shroomOrange';
      put(kit, x, z, { yaw: R() * 6.28, scale: .75 + R() * .6, tint: .92 + R() * .15, zone: 'Mushrooms and fungus', type: 'mushrooms', radius: .7 }); count('mushroom');
    });
    scatter(14, (x, z) => {
      if (R() > .12 || !playOk(x, z, 1.4, 1) || waterDistance(x, z) < 2 || trailField.distance(x, z, 4) < 2 || solid.blocked(x, z, 1)) return;
      if (clearingList.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 2 && c !== CLEARINGS.meadow)) return;
      const kit = ['lupine', 'meadow', 'bluebell', 'foxglove'][Math.floor(R() * 4)];
      for (let k = 0; k < 3; k++) {
        const fx = x + (R() - .5) * 4, fz = z + (R() - .5) * 4;
        if (!inGround(fx, fz, 1.5) || !playOk(fx, fz, .8, .5) || solid.blocked(fx, fz, .3) || waterDistance(fx, fz) < 1.2) continue;
        put(kit, fx, fz, { yaw: R() * 6.28, scale: .8 + R() * .5, tint: .85 + R() * .25, zone: 'Wildflower clearing', type: 'wildflowers', radius: .8 }); count('flower');
      }
    });
    // leaf litter and moss patches lie flat on the slope
    scatter(5.2, (x, z) => {
      if (!playOk(x, z, 1.5, .2) || waterDistance(x, z) < 1.6 || trailField.distance(x, z, 4) < 1.4 || solid.blocked(x, z, .2)) return;
      const n = fbm(x * .05 + 9, z * .05, 12), pick = R();
      if (R() > .3 + (n - .5) * .4) return;
      const kit = pick < .3 ? 'litterRust' : pick < .5 ? 'litterGold' : pick < .78 ? 'litterBrown' : 'mossPatch';
      put(kit, x, z, { yaw: R() * 6.28, scale: [1.3 + R() * 2, 1, 1.1 + R() * 1.6], tint: 1, lift: .05, tilted: true, zone: 'Forest floor', type: 'leaf-litter', radius: 1.5 }); count('litter');
    });

    // ---------- light and air
    {
      const shaftSpots = [[CLEARINGS.cabin.x - 5, CLEARINGS.cabin.z + 4, 1.1], [CLEARINGS.cabin.x + 7, CLEARINGS.cabin.z - 7, .9], [CLEARINGS.meadow.x + 4, CLEARINGS.meadow.z - 2, 1.4], [CLEARINGS.meadow.x - 10, CLEARINGS.meadow.z + 6, 1],
        [CLEARINGS.mother.x + 3, CLEARINGS.mother.z - 4, 1.2], [CLEARINGS.glade.x - 2, CLEARINGS.glade.z + 2, 1.1], [CLEARINGS.relic.x + 3, CLEARINGS.relic.z - 2, 1], [CLEARINGS.grove.x - 8, CLEARINGS.grove.z + 6, 1.2]];
      const q = new THREE.Quaternion().setFromUnitVectors(up, SUN);
      for (const [x, z, s] of shaftSpots) { if (play.clearance(x, z) < 25) continue; batcher.add('shaft', x, H(x, z) - .5, z, 0, s, 1, q); rec('Light shafts', 'light-shaft', x, z, 3); }
      const mistSpots = [...PONDS.flatMap(p => [[p.x, p.z, 16], [p.x + 9, p.z + 6, 11]]), [CLEARINGS.meadow.x, CLEARINGS.meadow.z, 15], [CLEARINGS.meadow.x + 12, CLEARINGS.meadow.z + 10, 10], [CLEARINGS.glade.x, CLEARINGS.glade.z, 12], [CLEARINGS.relic.x, CLEARINGS.relic.z, 11],
        ...creeks.flatMap(c => [.3, .55, .8].map(t => { const s = c.samples[Math.floor(c.samples.length * t)]; return [s.x, s.z, 9]; }))];
      for (const [x, z, r] of mistSpots) { if (play.clearance(x, z) < 18) continue; batcher.add('mist', x, H(x, z) + 1.1, z, 0, [r, 1, r * .8], 1); rec('Ground mist', 'mist', x, z, r); }
    }

    const built = batcher.build();
    built.forEach(m => meshes.push(m));
    return { scatterCount };
  }

  return { play, batcher, creeks, trails, bridges, clearings: CLEARINGS, ponds: PONDS, records, meshes, flyover, paintGround, populate, blocksTree, waterDistance, trailDistance: (x, z) => trailField.distance(x, z, 8), aerialClear, crowns, solid };
}
