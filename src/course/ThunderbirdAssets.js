import * as THREE from 'three';
import { mulberry32 } from './ThunderbirdNoise.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
const taper = new THREE.CylinderGeometry(.72, 1, 1, 8);
const cone = new THREE.ConeGeometry(1, 1, 5);
const crown = new THREE.IcosahedronGeometry(1, 0);
const boulder = new THREE.IcosahedronGeometry(1, 1);
const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...options });
const palette = {
  adobe: material(0xc97852),
  stone: material(0xb46a49),
  paleStone: material(0xd08a60),
  wood: material(0x70462f),
  darkWood: material(0x4a3028),
  canvas: material(0x4f7771),
  canvasLight: material(0x6c9182),
  metal: material(0x4b5d59),
  water: material(0x5e9b9a),
  gold: material(0xd6a94b),
  leaf: material(0x6b8768),
  leafLight: material(0x8da078),
  flower: material(0xd4aa49),
  rock: material(0x7c4935),
  rockLight: material(0xa35d3c),
};

function part(parent, geometry, mat, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function prefab(name) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.decorative = true;
  return root;
}

export function createTrailheadShelter() {
  const root = prefab('Trailhead shade shelter');
  part(root, box, palette.stone, [0, .12, 0], [9, .24, 6]);
  for (const x of [-3.7, 3.7]) for (const z of [-2.35, 2.35]) {
    part(root, box, palette.wood, [x, 1.8, z], [.22, 3.25, .22]);
  }
  for (const z of [-2.35, 2.35]) part(root, box, palette.darkWood, [0, 3.35, z], [8.1, .24, .24]);
  for (const x of [-3.7, 3.7]) part(root, box, palette.darkWood, [x, 3.35, 0], [.24, .24, 5]);
  part(root, box, palette.canvas, [0, 3.92, -1.55], [9.3, .18, 3.5], [-.2, 0, 0]);
  part(root, box, palette.canvasLight, [0, 3.92, 1.55], [9.3, .18, 3.5], [.2, 0, 0]);
  part(root, box, palette.darkWood, [0, 4.18, 0], [.28, .28, 6.4]);
  for (const z of [-2.45, 2.45]) part(root, box, palette.adobe, [0, .4, z], [7.8, .45, .18]);
  return root;
}

export function createDesertPicnicTable() {
  const root = prefab('Desert picnic table');
  for (let i = 0; i < 5; i++) part(root, box, palette.wood, [0, 1.12, (i - 2) * .25], [3.7, .14, .22]);
  for (const side of [-1, 1]) {
    part(root, box, palette.wood, [0, .62, side * 1.05], [3.7, .12, .35]);
    for (const x of [-1.3, 1.3]) part(root, box, palette.metal, [x, .55, 0], [.14, 1.1, .14]);
  }
  part(root, box, palette.metal, [0, .28, 0], [3.2, .12, .12]);
  for (const x of [-1.3, 1.3]) part(root, box, palette.darkWood, [x, .92, 0], [.12, .12, 2.25], [0, 0, x > 0 ? -.08 : .08]);
  return root;
}

export function createTrailBench() {
  const root = prefab('Weathered trail bench');
  for (const x of [-1.05, 1.05]) {
    part(root, box, palette.stone, [x, .25, 0], [.34, .5, .7]);
    part(root, box, palette.darkWood, [x, .76, -.24], [.12, .9, .12], [-.12, 0, 0]);
  }
  for (let i = 0; i < 3; i++) part(root, box, palette.wood, [0, .57, -.2 + i * .2], [2.8, .1, .17]);
  for (let i = 0; i < 3; i++) part(root, box, palette.wood, [0, .86 + i * .17, -.3], [2.8, .13, .09]);
  return root;
}

export function createTrailMarker() {
  const root = prefab('Cedar trail marker');
  part(root, box, palette.darkWood, [0, 1.35, 0], [.2, 2.7, .2]);
  part(root, box, palette.canvas, [0, 2.08, .02], [1.8, .38, .14]);
  part(root, box, palette.gold, [0, 1.62, .02], [1.45, .22, .14]);
  part(root, cone, palette.gold, [0, 2.78, 0], [.22, .42, .22]);
  part(root, box, palette.darkWood, [.55, 2.08, .1], [.55, .1, .08], [0, 0, -.18]);
  return root;
}

export function createOrientationBoard() {
  const root = prefab('Trail orientation board');
  for (const x of [-1.2, 1.2]) part(root, box, palette.darkWood, [x, 1.15, 0], [.15, 2.3, .15]);
  part(root, box, palette.wood, [0, 1.72, 0], [2.9, 1.75, .18]);
  part(root, box, palette.canvas, [0, 1.72, .12], [2.58, 1.42, .06]);
  part(root, box, palette.gold, [-.35, 1.76, .17], [1.25, .09, .03], [0, 0, -.14]);
  part(root, box, palette.paleStone, [.46, 2.05, .17], [.08, .62, .03], [0, 0, .38]);
  part(root, box, palette.paleStone, [.66, 1.62, .17], [.72, .08, .03], [0, 0, .28]);
  part(root, crown, palette.gold, [-.92, 2.15, .19], [.14, .14, .08]);
  part(root, crown, palette.paleStone, [.02, 1.42, .19], [.12, .12, .08]);
  part(root, crown, palette.paleStone, [.83, 2.22, .19], [.12, .12, .08]);
  return root;
}

export function createWaterRefill() {
  const root = prefab('Trail water refill');
  part(root, cylinder, palette.stone, [0, .45, 0], [.72, .9, .72]);
  part(root, taper, palette.metal, [0, 1.4, -.12], [.2, 1.4, .2]);
  part(root, box, palette.metal, [.32, 2.03, -.12], [.78, .12, .12]);
  part(root, box, palette.metal, [.58, 1.94, .08], [.12, .12, .46]);
  part(root, cylinder, palette.metal, [0, 1.78, .28], [.55, .16, .55]);
  part(root, cylinder, palette.water, [0, 1.88, .28], [.38, .04, .38]);
  part(root, box, palette.canvas, [0, 1.16, -.55], [.82, .7, .1]);
  part(root, box, palette.gold, [0, 1.17, -.61], [.5, .12, .03]);
  return root;
}

export function createCairn() {
  const root = prefab('Sandstone trail cairn');
  part(root, boulder, palette.rockLight, [0, .3, 0], [1, .52, .86], [.1, .2, -.08]);
  part(root, boulder, palette.rock, [.08, .72, .02], [.78, .45, .68], [-.08, -.2, .1]);
  part(root, boulder, palette.rockLight, [-.04, 1.06, -.02], [.52, .34, .48], [.12, .15, -.1]);
  return root;
}

export function createYucca() {
  const root = prefab('Desert yucca');
  part(root, taper, palette.darkWood, [0, .75, 0], [.22, 1.5, .22]);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    part(root, cone, i % 2 ? palette.leaf : palette.leafLight, [Math.sin(a) * .42, 1.35, Math.cos(a) * .42], [.13, 1.8, .13], [Math.sin(a) * .42, a, -Math.cos(a) * .42]);
  }
  part(root, cone, palette.flower, [0, 2.48, 0], [.14, 1.25, .14]);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    part(root, crown, palette.flower, [Math.sin(a) * .16, 2.9, Math.cos(a) * .16], [.14, .12, .14]);
  }
  return root;
}

export function createAgave() {
  const root = prefab('Blue agave rosette');
  part(root, crown, palette.leafLight, [0, .34, 0], [.72, .4, .72]);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    part(root, cone, i % 3 ? palette.leaf : palette.leafLight, [Math.sin(a) * .36, .58, Math.cos(a) * .36], [.18, 1.42, .18], [Math.sin(a) * .58, a, -Math.cos(a) * .58]);
  }
  return root;
}

export function createThunderbirdMarker() {
  const root = prefab('Thunderbird trail marker');
  part(root, box, palette.darkWood, [0, 1.15, 0], [.18, 2.3, .18]);
  part(root, box, palette.wood, [0, 2.02, 0], [1.5, .14, .14]);
  part(root, crown, palette.darkWood, [0, 2.28, 0], [.34, .2, .24]);
  part(root, crown, palette.darkWood, [.28, 2.48, 0], [.18, .18, .18]);
  part(root, cone, palette.gold, [.5, 2.48, 0], [.08, .22, .08], [0, 0, -Math.PI / 2]);
  for (const z of [-.12, .12]) part(root, box, palette.darkWood, [0, 2.28, z], [.6, .06, .12], [0, 0, z > 0 ? -.2 : .2]);
  part(root, box, palette.canvas, [0, .75, .1], [.8, .35, .1]);
  return root;
}

// ---------------------------------------------------------------------------
// Desert scenery prefabs. Each factory is deterministic for a given integer
// seed, shares the primitives above, and reports its footprint radius in
// `userData.radius` so the placement pass can reject overlaps and play areas.
// Colours live on the part materials; the baker multiplies a per-instance tint.
// ---------------------------------------------------------------------------
const rod = new THREE.CylinderGeometry(1, 1, 1, 5);
const blade = new THREE.ConeGeometry(1, 1, 3);
const desert = {
  sandRed: material(0x8d4a33), sandOrange: material(0xb9693f), sandCream: material(0xd8b183), sandRose: material(0xb5705a),
  sandDark: material(0x66332a), cap: material(0x4e332c), limestone: material(0xcdb18a), ironstone: material(0x5d4239),
  saguaro: material(0x4a7448), saguaroLight: material(0x5f8a56), pear: material(0x5f8a50), pearLight: material(0x77a05b), pearFruit: material(0xb0405e),
  cholla: material(0x8d9b5a), chollaSpine: material(0xdcd2a4), ocotilloStem: material(0x7b7050), ocotilloTip: material(0xd2452f),
  sagebrush: material(0x6f7d58), sageDark: material(0x5d6c4a), sageSilver: material(0x818b66), rabbit: material(0x8e8d40), goldBloom: material(0xe0b838),
  juniperDark: material(0x34513c), juniperMid: material(0x466a4a), juniperBerry: material(0x7088aa), pinonDark: material(0x37573a), pinonMid: material(0x4d7246),
  grassGold: material(0xc79c55), grassPale: material(0xdbc38a), grassGreen: material(0x8a9a52),
  yellow: material(0xe6bb35), orange: material(0xdb7a2c), purple: material(0x8c62b8), red: material(0xc4423a), white: material(0xf1e8d0), stem: material(0x6f8a4e),
  weathered: material(0x8a6a4c), grayWood: material(0x9a8a78), rust: material(0x9c5130), tin: material(0x93908a), steel: material(0x70807f), brush: material(0x8f6e47), pipe: material(0x4a4d4a),
};
export const DESERT_SWATCHES = desert;
const rr = (r, a, b) => a + (b - a) * r();
const sub = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
const strata = [desert.sandRed, desert.sandOrange, desert.sandCream, desert.sandRose, desert.sandRed, desert.sandDark];

export function createHoodoo(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 7919 + 11), root = prefab('Sandstone hoodoo');
  const columns = r() < .45 ? 2 : 3;
  for (let c = 0; c < columns; c++) {
    const lead = c === 0, ox = lead ? 0 : (r() - .5) * 4, oz = lead ? 0 : (r() - .5) * 4;
    const h = lead ? rr(r, 6.5, 10.5) : rr(r, 3, 6.5), w = lead ? rr(r, 1.05, 1.55) : rr(r, .65, 1.05), n = 4 + (r() < .5 ? 1 : 0);
    const col = sub(root, ox, 0, oz, r() * 6.28);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const seg = h / n * (i === 0 ? 1.2 : .95), rad = w * (i === 0 ? 1.45 : i === n - 1 ? .98 : .72 + r() * .22);
      part(col, i === 0 ? taper : cylinder, strata[(i + c + seed) % strata.length], [0, y + seg / 2, 0], [rad, seg, rad * (.85 + r() * .25)], [(r() - .5) * .08, 0, (r() - .5) * .08]);
      y += seg * .94;
    }
    part(col, crown, desert.cap, [0, y + w * .12, 0], [w * 1.28, w * .5, w * 1.2]);
  }
  for (let i = 0; i < 3; i++) { const a = r() * 6.28, d = rr(r, 1.5, 3); part(root, crown, strata[(i + 1) % 4], [Math.sin(a) * d, .35, Math.cos(a) * d], [rr(r, .5, .95), rr(r, .3, .55), rr(r, .5, .9)], [r(), r() * 3, r()]); }
  root.userData.radius = 3.6; root.userData.height = 10;
  return root;
}

export function createBluff(seed = 1, length = 14) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 6151 + 5), root = prefab('Layered sandstone bluff');
  const layers = 4 + Math.floor(r() * 3), depth = length * rr(r, .38, .5);
  let y = 0;
  for (let i = 0; i < layers; i++) {
    const t = i / layers, hh = rr(r, 1.0, 1.9), w = length * (1 - t * .26) * rr(r, .85, 1.1), d = depth * (1 - t * .3);
    const mat = strata[(i + seed) % strata.length];
    if (i % 2 === 0) part(root, box, mat, [(r() - .5) * length * .12, y + hh / 2, (r() - .5) * .6], [w, hh, d], [0, (r() - .5) * .16, 0]);
    else part(root, crown, mat, [(r() - .5) * length * .12, y + hh * .5, (r() - .5) * .5], [w * .56, hh * .78, d * .75], [0, (r() - .5) * .3, 0]);
    y += hh * .88;
  }
  part(root, crown, desert.cap, [(r() - .5) * length * .25, y + .2, 0], [length * .22, .6, depth * .4]);
  for (let i = 0; i < 5; i++) { const x = (i / 4 - .5) * length * .95 + (r() - .5) * 1.5, z = depth * (.55 + r() * .35) * (r() < .5 ? 1 : -1); part(root, boulder, strata[(i + 2) % 4], [x, .5, z], [rr(r, .7, 1.4), rr(r, .45, .9), rr(r, .7, 1.3)], [r(), r() * 3, r()]); }
  root.userData.radius = length * .55 + 1; root.userData.height = y; root.userData.depth = depth;
  return root;
}

export function createRockArch(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 3571 + 3), root = prefab('Sandstone window arch');
  const span = rr(r, 4, 5.4), h = rr(r, 5.2, 6.6);
  for (const side of [-1, 1]) {
    part(root, taper, strata[(seed + (side > 0 ? 1 : 0)) % 4], [side * span / 2, h * .5, 0], [1.5, h, 1.7], [0, 0, side * .04]);
    part(root, crown, desert.sandOrange, [side * span / 2, h * .2, 1.2], [1.2, .8, .9], [r(), r(), r()]);
  }
  part(root, box, desert.sandRose, [0, h + .35, 0], [span + 2.2, 1.1, 1.8], [0, 0, (r() - .5) * .08]);
  part(root, crown, desert.cap, [0, h + 1.1, 0], [span * .4, .7, 1.1]);
  root.userData.radius = span / 2 + 2.6; root.userData.height = h + 1.5;
  return root;
}

export function createBoulderCluster(seed = 1, size = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 4789 + 7), root = prefab('Scattered red boulders');
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const s = size * (i === 0 ? rr(r, .8, 1.5) : rr(r, .4, .85)), a = r() * 6.28, d = i === 0 ? 0 : s * 1.6;
    part(root, s > 1.1 ? boulder : crown, [desert.sandRed, desert.sandRose, desert.ironstone, desert.sandOrange][Math.floor(r() * 4)], [Math.sin(a) * d, s * .42, Math.cos(a) * d], [s * 1.15, s * .8, s], [r() * .4, r() * 6, r() * .4]);
  }
  root.userData.radius = 1.7 * size + (n > 1 ? .8 : 0); root.userData.height = 1.6 * size;
  return root;
}

export function createMesa(seed = 1, width = 40, height = 30) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 977 + 13), root = prefab('Distant mesa');
  const yaw = r() * 6.28;
  part(root, taper, desert.sandRose, [0, height * .12, 0], [width * 1.4, height * .5, width * .95], [0, yaw, 0]);
  part(root, cylinder, desert.sandRed, [0, height * .5, 0], [width, height * .5, width * .68], [0, yaw, 0]);
  part(root, cylinder, desert.sandOrange, [0, height * .78, 0], [width * .97, height * .12, width * .66], [0, yaw, 0]);
  part(root, cylinder, desert.sandCream, [0, height * .9, 0], [width * .93, height * .12, width * .63], [0, yaw, 0]);
  if (r() < .7) {
    const s = rr(r, .22, .38), a = yaw + rr(r, 1, 2);
    const ox = Math.cos(a) * width * .85, oz = Math.sin(a) * width * .55, bh = height * rr(r, .55, .85);
    part(root, taper, desert.sandRose, [ox, bh * .15, oz], [width * s * 1.5, bh * .6, width * s * 1.2], [0, yaw, 0]);
    part(root, cylinder, desert.sandRed, [ox, bh * .62, oz], [width * s, bh * .6, width * s * .8], [0, yaw, 0]);
    part(root, cylinder, desert.sandCream, [ox, bh * .95, oz], [width * s * .96, bh * .1, width * s * .76], [0, yaw, 0]);
  }
  root.userData.radius = width * 1.3; root.userData.height = height;
  return root;
}

export function createStoneScatter(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 811 + 1), root = prefab('Wash cobbles');
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = r() * 1.1, s = rr(r, .16, .42); part(root, crown, [desert.limestone, desert.sandRose, desert.grayWood, desert.sandCream][Math.floor(r() * 4)], [Math.sin(a) * d, s * .3, Math.cos(a) * d], [s * 1.4, s * .6, s], [0, r() * 6, 0]); }
  root.userData.radius = 1.3;
  return root;
}

export function createSaguaro(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 1237 + 17), root = prefab('Saguaro cactus');
  const h = rr(r, 4.2, 7.4), tr = rr(r, .36, .48), col = r() < .5 ? desert.saguaro : desert.saguaroLight;
  part(root, cylinder, col, [0, h / 2, 0], [tr, h, tr]);
  part(root, crown, col, [0, h, 0], [tr * 1.02, tr * 1.25, tr * 1.02]);
  const arms = Math.floor(r() * 3.6);
  for (let i = 0; i < arms; i++) {
    const side = i % 2 ? -1 : 1, y = rr(r, .36, .62) * h, reach = rr(r, .8, 1.35), up = rr(r, .26, .46) * h, ar = tr * rr(r, .6, .78);
    const arm = sub(root, 0, y, 0, r() * 6.28);
    part(arm, cylinder, col, [side * (tr * .5 + reach / 2), 0, 0], [ar, reach + tr, ar], [0, 0, Math.PI / 2]);
    part(arm, cylinder, col, [side * (tr * .5 + reach), up / 2 - ar * .3, 0], [ar, up, ar]);
    part(arm, crown, col, [side * (tr * .5 + reach), up - ar * .3, 0], [ar * 1.02, ar * 1.25, ar * 1.02]);
  }
  root.userData.radius = 1.6; root.userData.height = h; root.userData.trunk = tr;
  return root;
}

export function createPricklyPear(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 521 + 9), root = prefab('Prickly pear');
  const pads = 3 + Math.floor(r() * 4);
  for (let i = 0; i < pads; i++) {
    const tier = i < 2 ? 0 : 1, a = r() * 6.28, d = tier ? rr(r, .1, .35) : rr(r, .15, .5), y = tier ? .72 + r() * .2 : .34 + r() * .08;
    const s = rr(r, .36, .52) * (tier ? .85 : 1);
    part(root, crown, i % 2 ? desert.pear : desert.pearLight, [Math.sin(a) * d, y, Math.cos(a) * d], [s, s * 1.15, s * .16], [(r() - .5) * .5, a, (r() - .5) * .7]);
    if (tier && r() < .7) part(root, crown, desert.pearFruit, [Math.sin(a) * d, y + s * 1.1, Math.cos(a) * d], [.1, .1, .1]);
  }
  root.userData.radius = 1.0; root.userData.height = 1.4;
  return root;
}

export function createCholla(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 2791 + 19), root = prefab('Cholla cactus');
  const h = rr(r, .8, 1.3);
  part(root, rod, desert.cholla, [0, h / 2, 0], [.14, h, .14]);
  const branches = 5 + Math.floor(r() * 3);
  for (let i = 0; i < branches; i++) {
    const a = i / branches * 6.28 + r() * .5, tilt = rr(r, .45, .95), len = rr(r, .55, .95), y = h * rr(r, .5, 1);
    const b = sub(root, 0, y, 0, a);
    const holder = sub(b);
    holder.rotation.z = tilt;
    part(holder, rod, i % 2 ? desert.cholla : desert.chollaSpine, [0, len / 2, 0], [.1, len, .1]);
  }
  root.userData.radius = 1.2; root.userData.height = 2;
  return root;
}

export function createBarrelCactus(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 313 + 2), root = prefab('Barrel cactus');
  const s = rr(r, .42, .7);
  part(root, crown, desert.saguaroLight, [0, s * .85, 0], [s, s * 1.15, s]);
  part(root, crown, desert.goldBloom, [0, s * 1.85, 0], [s * .38, s * .2, s * .38]);
  root.userData.radius = s + .3; root.userData.height = s * 2;
  return root;
}

export function createOcotillo(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 659 + 4), root = prefab('Ocotillo');
  const n = 7 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + r() * .6, tilt = rr(r, .1, .42), len = rr(r, 2.2, 3.6);
    const holder = sub(root, 0, 0, 0, a);
    const stick = sub(holder); stick.rotation.z = tilt;
    part(stick, blade, desert.ocotilloStem, [0, len / 2, 0], [.07, len, .07]);
    part(stick, cone, desert.ocotilloTip, [0, len + .14, 0], [.11, .38, .11]);
  }
  root.userData.radius = 1.3; root.userData.height = 3.7;
  return root;
}

export function createSagebrush(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 271 + 8), root = prefab('Big sagebrush');
  const palette = [desert.sagebrush, desert.sageDark, desert.sageSilver], n = 2 + (r() < .45 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + r(), d = i ? rr(r, .35, .65) : 0, s = i ? rr(r, .5, .75) : rr(r, .75, 1);
    part(root, crown, palette[(i + seed) % 3], [Math.sin(a) * d, s * .6, Math.cos(a) * d], [s * 1.05, s * .62, s * .95], [0, r() * 6, 0]);
  }
  root.userData.radius = 1.3; root.userData.height = .9;
  return root;
}

export function createRabbitbrush(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 733 + 6), root = prefab('Rabbitbrush');
  for (let i = 0; i < 2; i++) {
    const a = i * 2.1 + r(), d = i ? .4 : 0, s = rr(r, .5, .7);
    part(root, crown, desert.rabbit, [Math.sin(a) * d, s * .6, Math.cos(a) * d], [s, s * .8, s]);
    part(root, crown, desert.goldBloom, [Math.sin(a) * d, s * 1.28, Math.cos(a) * d], [s * .62, s * .3, s * .62]);
  }
  root.userData.radius = 1.3; root.userData.height = 1.1;
  return root;
}

export function createJuniper(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 1999 + 23), root = prefab('Utah juniper');
  const h = rr(r, 1.3, 2.1), lean = (r() - .5) * .25;
  part(root, taper, desert.grayWood, [0, h / 2, 0], [.36, h, .36], [lean, 0, -lean]);
  if (r() < .6) part(root, rod, desert.grayWood, [.5, h * .78, 0], [.07, 1.5, .07], [0, 0, -.9]);
  const lobes = 3 + Math.floor(r() * 2);
  for (let i = 0; i < lobes; i++) {
    const a = i / lobes * 6.28 + r(), d = i ? rr(r, .8, 1.4) : 0, s = i ? rr(r, 1.2, 1.7) : rr(r, 1.7, 2.2);
    part(root, crown, [desert.juniperDark, desert.juniperMid][(i + seed) % 2], [Math.sin(a) * d, h + (i ? .1 : .75) + r() * .4, Math.cos(a) * d], [s, s * .82, s * .95], [0, r() * 6, 0]);
  }
  for (let i = 0; i < 3; i++) { const a = r() * 6.28; part(root, crown, desert.juniperBerry, [Math.sin(a) * 1.5, h + .5 + r(), Math.cos(a) * 1.5], [.11, .11, .11]); }
  root.userData.radius = 2.5; root.userData.height = h + 2.2; root.userData.trunk = .4; root.userData.canopy = 2.1; root.userData.canopyBottom = 1.4;
  return root;
}

export function createPinon(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 1423 + 29), root = prefab('Piñon pine');
  const h = rr(r, 1.9, 2.8);
  part(root, taper, desert.ironstone, [0, h / 2 + .2, 0], [.3, h + .4, .3]);
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const s = (2.3 - i * .55) * rr(r, .9, 1.12), y = h + i * 1.05;
    part(root, i === tiers - 1 ? cone : crown, [desert.pinonDark, desert.pinonMid][(i + seed) % 2], [(r() - .5) * .5, y, (r() - .5) * .5], i === tiers - 1 ? [s * .75, 2.1, s * .75] : [s, s * .62, s], [0, r() * 6, 0]);
  }
  root.userData.radius = 2.6; root.userData.height = h + 3.4; root.userData.trunk = .34; root.userData.canopy = 2.2; root.userData.canopyBottom = 1.6;
  return root;
}

export function createGrassTuft(seed = 1, tone = 0) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 97 + 3), root = prefab('Desert grass tuft');
  const mat = [desert.grassGold, desert.grassPale, desert.grassGreen][tone % 3], n = 5 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + r() * .6, holder = sub(root, Math.sin(a) * .1, 0, Math.cos(a) * .1, a), b = sub(holder);
    b.rotation.z = rr(r, .18, .5);
    part(b, blade, mat, [0, .3, 0], [rr(r, .05, .09), rr(r, .55, .95), .05]);
  }
  root.userData.radius = .55;
  return root;
}

export function createWildflowers(seed = 1, bloom = 0) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 197 + 5), root = prefab('Desert wildflowers');
  const heads = [[desert.yellow, desert.white], [desert.orange, desert.yellow], [desert.purple, desert.white], [desert.red, desert.yellow]][bloom % 4];
  part(root, crown, desert.stem, [0, .1, 0], [.4, .16, .4]);
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = r() * .5, y = rr(r, .22, .5);
    part(root, blade, desert.stem, [Math.sin(a) * d, y / 2, Math.cos(a) * d], [.03, y, .03]);
    part(root, blade, r() < .75 ? heads[0] : heads[1], [Math.sin(a) * d, y + .06, Math.cos(a) * d], [.11, .1, .11], [Math.PI, 0, 0]);
  }
  root.userData.radius = .65;
  return root;
}

export function createRamada(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 313 + 31), root = prefab('Log ramada');
  const sx = 2.7, sz = 1.95;
  for (const x of [-sx, sx]) for (const z of [-sz, sz]) {
    part(root, box, desert.limestone, [x, .17, z], [.62, .34, .62]);
    part(root, cylinder, desert.weathered, [x, 1.75, z], [.17, 3.2, .17]);
  }
  for (const z of [-sz, sz]) part(root, box, desert.grayWood, [0, 3.34, z], [sx * 2 + 1.2, .24, .24]);
  for (let i = 0; i < 10; i++) part(root, rod, desert.weathered, [-sx - .4 + i * ((sx * 2 + .8) / 9), 3.55, 0], [.055, sz * 2 + 1.2, .055], [Math.PI / 2, 0, 0]);
  part(root, box, desert.brush, [0, 3.67, 0], [sx * 2 + 1.4, .13, sz * 2 + .9], [0, 0, (r() - .5) * .02]);
  part(root, box, desert.rust, [0, 3.66, sz + .55], [sx * 2 + 1.4, .09, .5]);
  part(root, box, desert.weathered, [0, .52, -sz + .55], [sx * 2 - .6, .12, .5]);
  for (const x of [-sx + .6, sx - .6]) part(root, box, desert.limestone, [x, .26, -sz + .55], [.34, .52, .5]);
  root.userData.radius = 4.4; root.userData.height = 4;
  return root;
}

export function createWindmill(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 541 + 37), root = prefab('Ranch windmill');
  const H = 9.2, bottom = 1.45, top = .48, lean = Math.atan((bottom - top) / H);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const mx = sx * (bottom + top) / 2, mz = sz * (bottom + top) / 2;
    part(root, box, desert.steel, [mx, H / 2, mz], [.13, H / Math.cos(lean), .13], [sz * lean, 0, -sx * lean]);
  }
  for (const y of [1.8, 4.4, 7]) {
    const w = bottom - (bottom - top) * (y / H);
    for (const z of [-w, w]) part(root, box, desert.steel, [0, y, z], [w * 2, .07, .07]);
    for (const x of [-w, w]) part(root, box, desert.steel, [x, y, 0], [.07, .07, w * 2]);
  }
  part(root, box, desert.weathered, [0, H + .08, 0], [1.3, .16, 1.3]);
  part(root, box, desert.steel, [0, H + .5, 0], [.5, .55, 1.0]);
  part(root, rod, desert.pipe, [0, H / 2, 0], [.06, H, .06]);
  const wheel = sub(root, 0, H + .75, .78), spin = r() * 6.28;
  part(wheel, crown, desert.rust, [0, 0, 0], [.3, .3, .24]);
  for (let i = 0; i < 14; i++) {
    const a = spin + i / 14 * 6.28;
    part(wheel, box, i % 2 ? desert.tin : desert.rust, [Math.sin(a) * 1.35, Math.cos(a) * 1.35, 0], [.32, 1.5, .04], [0, 0, -a]);
  }
  part(root, box, desert.steel, [0, H + .55, -1.6], [.1, .1, 3.0]);
  part(root, box, desert.rust, [0, H + .75, -3.1], [.05, 1.0, 1.15]);
  root.userData.radius = 2.6; root.userData.height = H + 2.2;
  return root;
}

export function createWaterTank() {
  const root = prefab('Stock water tank');
  part(root, cylinder, desert.limestone, [0, .16, 0], [3.35, .32, 3.35]);
  part(root, cylinder, desert.steel, [0, 1.35, 0], [3.1, 2.2, 3.1]);
  part(root, cylinder, desert.rust, [0, .7, 0], [3.14, .45, 3.14]);
  part(root, cylinder, desert.tin, [0, 2.47, 0], [3.2, .18, 3.2]);
  part(root, cylinder, desert.water, [0, 2.4, 0], [2.9, .08, 2.9]);
  part(root, box, desert.weathered, [3.9, .38, 0], [3.2, .7, 1.05]);
  part(root, box, desert.water, [3.9, .72, 0], [3.0, .06, .85]);
  part(root, rod, desert.pipe, [2.2, 1.9, 0], [.07, 3.2, .07], [0, 0, 1.45]);
  part(root, box, desert.weathered, [-1.8, 1.3, 2.6], [.1, 2.3, .3], [.2, 0, .2]);
  root.userData.radius = 5.4; root.userData.height = 2.7;
  return root;
}

// One fence bay from A to B. Local +x runs toward B; the caller yaws the group.
export function createFenceBay(length, rise = 0, style = 0) {
  const root = prefab('Rustic fence bay');
  const mat = style === 2 ? desert.grayWood : desert.weathered;
  part(root, box, desert.weathered, [0, .62, 0], [.16, 1.35, .16]);
  const tilt = Math.atan2(rise, length), rl = Math.hypot(length, rise);
  const rails = style === 1 ? [.45, .75, 1.05] : [.55, 1.0];
  for (const y of rails) part(root, box, style === 1 ? desert.steel : mat, [length / 2, y + rise / 2, 0], [rl, style === 1 ? .025 : .1, style === 1 ? .025 : .09], [0, 0, tilt]);
  root.userData.radius = .5;
  return root;
}

export function createCairnStack(seed = 1) {
  seed = Math.abs(Math.trunc(seed));
  const r = mulberry32(seed * 887 + 3), root = prefab('Stacked trail cairn');
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const s = .5 - i * .075, h = s * .5;
    part(root, crown, [desert.sandRose, desert.limestone, desert.sandOrange][i % 3], [(r() - .5) * .08, y + h / 2, (r() - .5) * .08], [s, h, s * .85], [0, r() * 6, 0]);
    y += h * .8;
  }
  root.userData.radius = .7; root.userData.height = y + .1;
  return root;
}
