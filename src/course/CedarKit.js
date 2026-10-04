import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Cedar Hollow decoration kit. Every prop is authored once as a small merged,
// vertex-coloured geometry (one material), then stamped out as InstancedMesh
// batches. Hundreds of ferns, logs, mushrooms and trees therefore cost one draw
// call per kind, and the look comes from per-facet colour jitter, not textures.

const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const col = hex => (hex.isColor ? hex.clone() : new THREE.Color(hex));
export const mix = (a, b, t) => col(a).lerp(col(b), t);

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl6o: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  taper: new THREE.CylinderGeometry(.62, 1, 1, 6, 1, true),
  taperClosed: new THREE.CylinderGeometry(.62, 1, 1, 6),
  cone7: new THREE.ConeGeometry(1, 1, 7),
  cone7o: new THREE.ConeGeometry(1, 1, 7, 1, true),
  cone5o: new THREE.ConeGeometry(1, 1, 5, 1, true),
  cone4o: new THREE.ConeGeometry(1, 1, 4, 1, true),
  cone3o: new THREE.ConeGeometry(1, 1, 3, 1, true),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  oct: new THREE.OctahedronGeometry(1, 0),
  dome: new THREE.SphereGeometry(1, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl4o: new THREE.CylinderGeometry(1, 1, 1, 4, 1, true),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  disc8: new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2),
  disc12: new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2),
};
export const geometries = G;

const up = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();

// One piece of a kit. `color` is a hex/Color or a [bottom, top] gradient measured
// over the piece's own height (or `mode: 'radial'` / `'moss'` for discs / rocks).
export function P(geometry, color, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], options = {}) {
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
  return { geometry, color, position, scale: s, rotation, ...options };
}

// Orient a +Y pointing piece along a direction vector (used for fronds/branches).
export function aimed(geometry, color, from, direction, length, width, options = {}) {
  const d = new THREE.Vector3(...direction).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(up, d);
  const mid = [from[0] + d.x * length / 2, from[1] + d.y * length / 2, from[2] + d.z * length / 2];
  return P(geometry, color, mid, [width[0], length, width[1] ?? width[0]], q, options);
}

export function transformParts(parts, position = [0, 0, 0], yaw = 0, scale = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromAxisAngle(up, yaw), new THREE.Vector3(scale, scale, scale));
  return parts.map(p => ({ ...p, pre: p.pre ? m.clone().multiply(p.pre) : m.clone() }));
}

function partMatrix(p) {
  const q = p.rotation.isQuaternion ? p.rotation : tmpQ.setFromEuler(tmpE.set(...p.rotation));
  const m = new THREE.Matrix4().compose(tmpV.set(...p.position), q, tmpS.set(...p.scale));
  return p.pre ? p.pre.clone().multiply(m) : m;
}

export function buildKit(parts, seed = 1, jitter = .1) {
  const geometries = parts.map((p, partIndex) => {
    const g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone();
    g.deleteAttribute('uv');
    g.computeBoundingBox();
    const bb = g.boundingBox, pos = g.attributes.position, nor = g.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const a = Array.isArray(p.color) ? col(p.color[0]) : col(p.color), b = Array.isArray(p.color) ? col(p.color[1]) : a;
    const c = new THREE.Color();
    const span = bb.max.y - bb.min.y || 1, rMax = Math.max(bb.max.x, bb.max.z, -bb.min.x, -bb.min.z) || 1;
    for (let i = 0; i < pos.count; i++) {
      let t;
      if (p.mode === 'moss') t = THREE.MathUtils.smoothstep(nor.getY(i), .28, .7);
      else if (p.mode === 'radial') t = Math.min(1, Math.hypot(pos.getX(i), pos.getZ(i)) / rMax);
      else t = (pos.getY(i) - bb.min.y) / span;
      c.copy(a).lerp(b, t);
      const j = 1 + (hash(Math.floor(i / 3) * 7.31 + partIndex * 3.17 + seed * 19.3) - .5) * (p.jitter ?? jitter) * 2;
      colors[i * 3] = c.r * j; colors[i * 3 + 1] = c.g * j; colors[i * 3 + 2] = c.b * j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.applyMatrix4(partMatrix(p));
    return g;
  });
  const merged = mergeGeometries(geometries, false);
  geometries.forEach(g => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

// ---------------------------------------------------------------- trees
function conifer({ h, trunkR, trunkH, tiers, y0, r0, rTop, tierH, low, high, trunkLow = 0x3f4d34, trunkHigh = 0x5a3f2c, twist = .7, seed = 1 }) {
  const parts = [P(G.taper, [trunkLow, trunkHigh], [0, trunkH / 2, 0], [trunkR, trunkH, trunkR])];
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1 || 1), r = THREE.MathUtils.lerp(r0, rTop, Math.pow(f, .85));
    const y = y0 + f * (h - y0 - tierH * .75), shade = mix(low, high, f);
    parts.push(P(i === 0 ? G.cone7 : G.cone7o, [mix(shade, 0x0d1f18, .28), mix(shade, 0xffffff, .08)], [0, y + tierH / 2, 0], [r, tierH, r], [0, i * twist + seed, 0]));
  }
  return parts;
}

const conifers = {
  cedar: () => conifer({ h: 17, trunkR: .5, trunkH: 9, tiers: 6, y0: 3, r0: 3.6, rTop: .7, tierH: 4.4, low: 0x1f3d33, high: 0x42704c, seed: 1 }),
  fir: () => conifer({ h: 22, trunkR: .38, trunkH: 12, tiers: 7, y0: 5, r0: 2.7, rTop: .4, tierH: 6, low: 0x244930, high: 0x5f8c52, seed: 2 }),
  spruce: () => conifer({ h: 15, trunkR: .3, trunkH: 8, tiers: 8, y0: 3.2, r0: 2.1, rTop: .22, tierH: 3.4, low: 0x2b4b49, high: 0x6a9784, seed: 3 }),
  hemlock: () => conifer({ h: 14, trunkR: .4, trunkH: 8, tiers: 5, y0: 3, r0: 2.7, rTop: .5, tierH: 4.4, low: 0x35633f, high: 0x80ad63, seed: 4 }),
  giant: () => conifer({ h: 27, trunkR: 1.1, trunkH: 17, tiers: 5, y0: 11.5, r0: 5.4, rTop: 1.1, tierH: 8.6, low: 0x1c372b, high: 0x436f48, trunkLow: 0x56653d, trunkHigh: 0x5b4130, seed: 5 }),
  sapling: () => conifer({ h: 3.4, trunkR: .12, trunkH: 1.6, tiers: 3, y0: .5, r0: .95, rTop: .25, tierH: 1.6, low: 0x2d5a38, high: 0x6c9e52, seed: 6 }),
};

function snag(tall) {
  const h = tall ? 12 : 7.5, r = tall ? .55 : .5;
  const parts = [
    P(G.taperClosed, [0x4e4639, 0x8a8372], [0, h / 2, 0], [r, h, r]),
    P(G.cone5o, 0x7c7461, [0, h + .5, 0], [r * .62, 1.5, r * .62], [.1, .5, .05]),
  ];
  const stubs = tall ? [[2.2, 1.1, .4], [4.2, -1.3, .6], [6.4, .5, -1.2], [8.6, -.6, -.9]] : [[3, .9, .5], [5, -1, .2]];
  stubs.forEach(([y, dx, dz], i) => parts.push(aimed(G.cone4o, 0x6a6150, [dx > 0 ? r * .6 : -r * .6, y, 0], [dx, .55, dz], 1.5 + i * .25, [.14, .14])));
  parts.push(P(G.dome, 0xd98f3b, [r * .92, 1.2, 0], [.34, .22, .26], [0, 0, -1.2]), P(G.dome, 0xe3a447, [-r * .9, 2.2, .2], [.3, .2, .24], [0, 0, 1.2]));
  if (!tall) parts.push(P(G.cone5o, 0x7c7461, [-.32, h + .35, .1], [.2, 1.2, .2], [.3, 0, .35]));
  return parts;
}

function broadleaf(crown, crownTop, trunkLow, trunkHigh, h, width) {
  const parts = [P(G.taper, [trunkLow, trunkHigh], [0, h / 2, 0], [.46, h, .46])];
  [[0, h + .6, 0, 1], [-1.4, h - .5, .6, .78], [1.3, h - .3, -.7, .82], [.3, h + 1.8, .4, .66]].forEach(([x, y, z, s], i) =>
    parts.push(P(G.ico0, [crown, crownTop], [x * width / 3, y, z * width / 3], [width * s, width * .66 * s, width * .9 * s], [0, i, 0])));
  parts.push(aimed(G.cone4o, trunkHigh, [0, h * .6, 0], [1, .8, .2], 1.8, [.16, .16]), aimed(G.cone4o, trunkHigh, [0, h * .7, 0], [-1, .7, -.3], 1.6, [.14, .14]));
  return parts;
}

// ---------------------------------------------------------------- ground cover
function fern(low, high, count = 9, size = 1.5) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2 + (i % 2) * .2, t = .85 + (i % 3) * .2, len = size * (.8 + (i % 4) * .1);
    const d = [Math.sin(a) * Math.sin(t), Math.cos(t) * .8, Math.cos(a) * Math.sin(t)];
    parts.push(aimed(G.cone4o, [mix(low, 0x143017, .2), mix(high, low, i % 2 ? .1 : .5)], [Math.sin(a) * .1, .05, Math.cos(a) * .1], d, len, [.34, .08]));
  }
  return parts;
}

function bush(dark, light, berries) {
  const parts = [];
  [[0, .5, 0, .8], [-.7, .38, .3, .62], [.6, .4, -.2, .66]].forEach(([x, y, z, s], i) =>
    parts.push(P(G.ico0, [mix(dark, 0x0c1b10, .2), light], [x, y, z], [s * 1.1, s * .72, s], [0, i, 0])));
  if (berries) [[.2, .88, .3], [-.6, .7, .65], [.7, .75, -.1], [-.2, .95, -.3]].forEach(p => parts.push(P(G.oct, berries, p, [.085, .085, .085]), P(G.oct, berries, [p[0] + .2, p[1] - .12, p[2] - .1], [.07, .07, .07])));
  return parts;
}

function grass(low, high, count = 8, height = 1.1) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996, r = .12 + (i % 3) * .1, d = [Math.sin(a) * .35, 1, Math.cos(a) * .35];
    parts.push(aimed(G.cone3o, [low, high], [Math.sin(a) * r, 0, Math.cos(a) * r], d, height * (.7 + (i % 4) * .13), [.09, .035]));
  }
  return parts;
}

function boulder(sx, sy, sz, rock, moss, detail = true) {
  return [P(detail ? G.ico1 : G.ico0, [rock, moss], [0, sy * .42, 0], [sx, sy, sz], [0, .6, 0], { mode: 'moss', jitter: .13, mossRock: rock })];
}

function pebbles() {
  return [[0, 0, .5], [1.1, .6, .35], [-.8, .9, .3], [.3, -1, .28]].map(([x, z, s], i) => P(G.ico0, [0x58625a, 0x6f8a55], [x, s * .35, z], [s, s * .7, s * .9], [0, i, 0], { mode: 'moss' }));
}

function flatStone(w) {
  return [P(G.cyl8, [0x59625a, 0x7d867a], [0, .09, 0], [w, .18, w * .8], [0, .7, 0])];
}

function log(length, radius, { roots = false, nurse = false } = {}) {
  const parts = [
    P(G.cyl6, [0x4c3626, 0x634830], [0, radius, 0], [radius, length, radius], [0, 0, Math.PI / 2]),
    P(G.disc8, 0xb99a69, [length / 2 + .01, radius, 0], [radius * .94, 1, radius * .94], [0, 0, -Math.PI / 2], { mode: 'radial' }),
    P(G.box, [0x56804a, 0x6f9a54], [-length * .08, radius * 1.86, 0], [length * .5, radius * .2, radius * .9], [0, .06, 0]),
    aimed(G.cone4o, 0x4a3828, [-length * .22, radius * 1.4, radius * .7], [-.3, .5, 1], radius * 2.2, [.12, .12]),
  ];
  if (roots) {
    parts.push(P(G.disc8, [0x3d2d20, 0x594230], [-length / 2 - .06, radius * 1.4, 0], [radius * 1.9, 1, radius * 1.9], [0, 0, Math.PI / 2], { mode: 'radial' }));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; parts.push(aimed(G.cone4o, 0x45331f, [-length / 2 - .05, radius * 1.4, 0], [-.5, Math.cos(a) * 1.1, Math.sin(a) * 1.1], radius * 2.6, [.2, .2])); }
  }
  if (nurse) {
    parts.push(...transformParts(fern(0x3f7a45, 0x6aa352, 5, 1), [length * .1, radius * 1.9, radius * .2], .6, .85));
    parts.push(...transformParts(mushrooms('brown'), [-length * .3, radius * 1.95, -radius * .2], 0, .6));
    parts.push(P(G.dome, 0xd98f3b, [length * .32, radius * 1.4, radius * .95], [.34, .2, .28], [Math.PI / 2 - .2, 0, 0]));
  }
  return parts;
}

function stump(tall) {
  const h = tall ? 1.7 : .8, r = tall ? .6 : .85;
  const parts = [
    P(G.taper, [0x3f2f22, 0x5c4331], [0, h / 2, 0], [r, h, r]),
    P(G.disc8, 0xb59563, [0, h + .01, 0], [r * .64, 1, r * .64], [0, 0, 0], { mode: 'radial' }),
    P(G.box, [0x5b8548, 0x78a059], [r * .2, h * .65, r * .5], [r * .8, .08, r * .55], [.5, .4, .2]),
  ];
  for (let i = 0; i < 4; i++) { const a = i * 1.7; parts.push(aimed(G.cone4o, 0x45331f, [Math.sin(a) * r * .8, .1, Math.cos(a) * r * .8], [Math.sin(a), .12, Math.cos(a)], r * 1.2, [.18, .12])); }
  parts.push(P(G.dome, 0xd98f3b, [r * .7, h * .55, r * .7], [.28, .16, .22], [.3, .8, -1.2]));
  if (tall) parts.push(P(G.cone5o, 0x4e3a2a, [.12, h + .35, 0], [.3, 1, .3], [0, 0, .12]));
  return parts;
}

function mushrooms(kind) {
  const parts = [];
  const spec = {
    red: [[0, 0, .95, 0xc23a2c, 0xe35a42, true], [.5, .2, .6, 0xc23a2c, 0xe35a42, true], [-.35, .45, .5, 0xa8301f, 0xd0472f, true]],
    orange: [[0, 0, .75, 0xd88a32, 0xf0b052], [.35, .3, .6, 0xd88a32, 0xf0b052], [-.3, .25, .5, 0xcf7e2c, 0xe89f44], [.1, -.4, .4, 0xd88a32, 0xf0b052]],
    brown: [[0, 0, .55, 0x80593b, 0xa8805a], [.32, .1, .42, 0x80593b, 0xa8805a], [-.2, .3, .36, 0x6e4a30, 0x96704c]],
  }[kind];
  spec.forEach(([x, z, s, capLow, capHigh, spots], i) => {
    parts.push(P(G.cyl4o, [0xcdbf9d, 0xefe5c9], [x, s * .22, z], [.07 * s + .02, s * .44, .07 * s + .02]));
    if (kind === 'orange') parts.push(P(G.cone7o, [capHigh, capLow], [x, s * .5, z], [.26 * s, .3 * s, .26 * s], [Math.PI, 0, 0]));
    else parts.push(P(G.dome, [capLow, capHigh], [x, s * .42, z], [.3 * s, .22 * s, .3 * s]));
    if (spots) parts.push(P(G.oct, 0xf4efe0, [x + .08 * s, s * .62, z], [.05, .03, .05]), P(G.oct, 0xf4efe0, [x - .1 * s, s * .56, z + .1 * s], [.04, .03, .04]));
  });
  return parts;
}

function fairyRing() {
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + (i % 3) * .1, r = 1.65 + (i % 2) * .22, s = .28 + (i % 3) * .08;
    parts.push(P(G.cyl6o, 0xe6dcc0, [Math.sin(a) * r, s * .3, Math.cos(a) * r], [.03, s * .6, .03]), P(G.dome, [0xc9b894, 0xe9dec2], [Math.sin(a) * r, s * .58, Math.cos(a) * r], [s * .55, s * .3, s * .55]));
  }
  return parts;
}

function flowers(kind) {
  const spec = {
    lupine: { bloom: [0x6a5fc2, 0x8b6fd0, 0xa68ae0], spike: true, tall: 1, leaf: 0x3f7a45 },
    meadow: { bloom: [0xf0cb3e, 0xf2efe0, 0xe58a33], spike: false, tall: .75, leaf: 0x5f9a4a },
    foxglove: { bloom: [0xc45a96, 0xe08ab8, 0xb04a86], spike: true, tall: 1.3, leaf: 0x3f7a45 },
    bluebell: { bloom: [0x4a7ed8, 0x9ab8ef, 0xf2efe0], spike: false, tall: .65, leaf: 0x5f9a4a },
  }[kind];
  const parts = [];
  for (let i = 0; i < 2; i++) { const a = i * 2.1; parts.push(P(G.ico0, [mix(spec.leaf, 0x10281a, .2), spec.leaf], [Math.sin(a) * .4, .12, Math.cos(a) * .4], [.5, .2, .42], [0, a, 0])); }
  for (let i = 0; i < 6; i++) {
    const a = i * 2.39996, r = .15 + (i % 4) * .13, x = Math.sin(a) * r, z = Math.cos(a) * r, h = spec.tall * (.62 + (i % 3) * .2);
    const c = spec.bloom[i % 3];
    parts.push(P(G.cone3o, 0x3a6a3d, [x, h / 2, z], [.025, h, .025]));
    if (spec.spike) parts.push(P(G.cone4o, c, [x, h + .02, z], [.11, spec.tall * .5, .11]));
    else parts.push(P(G.oct, c, [x, h, z], [.13, .08, .13]));
  }
  return parts;
}

function disc(low, high, size = 1) {
  return [P(G.disc8, [low, high], [0, 0, 0], [size, 1, size * .8], [0, 0, 0], { mode: 'radial', jitter: .16 })];
}

function hangingMoss() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.9, r = .15 + (i % 3) * .25, h = 1.5 + (i % 4) * .45;
    parts.push(P(G.cone4o, [0xbfcfa6, 0x839a68], [Math.sin(a) * r, -h / 2, Math.cos(a) * r], [.1 + (i % 2) * .05, h, .07], [Math.PI, 0, 0]));
  }
  parts.push(P(G.ico0, [0x839a68, 0xa6bb8a], [0, .05, 0], [.55, .16, .55]));
  return parts;
}

// ---------------------------------------------------------------- built things
const wood = 0x7a5636, woodDark = 0x5a3c25, woodLight = 0xa07c52, stone = 0x6d7468, roof = 0x4b3b30;

function cabin() {
  const parts = [], W = 7, D = 5.4;
  parts.push(P(G.box, [0x555c52, 0x7b8374], [0, .28, 0], [W + .6, .56, D + .6]));
  for (let i = 0; i < 7; i++) {
    const y = .56 + .27 + i * .5, c = i % 2 ? wood : woodDark;
    parts.push(P(G.cyl6, [c, mix(c, 0xa07c52, .3)], [0, y, D / 2], [.27, W + .7, .27], [0, 0, Math.PI / 2]), P(G.cyl6, [c, mix(c, 0xa07c52, .3)], [0, y, -D / 2], [.27, W + .7, .27], [0, 0, Math.PI / 2]));
    parts.push(P(G.cyl6, [c, mix(c, 0xa07c52, .3)], [-W / 2, y + .13, 0], [.27, D + .7, .27], [Math.PI / 2, 0, 0]), P(G.cyl6, [c, mix(c, 0xa07c52, .3)], [W / 2, y + .13, 0], [.27, D + .7, .27], [Math.PI / 2, 0, 0]));
  }
  const top = .56 + .27 + 7 * .5;
  // gable infill and a two-pitch roof with moss on the shaded side
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) parts.push(P(G.box, i % 2 ? woodDark : wood, [s * (W / 2 - .15), top + i * .5 + .25, 0], [.3, .5, D * (1 - i * .24)]));
  const pitch = .5, slope = D / 2 / Math.cos(pitch) + .5;
  parts.push(P(G.box, [roof, 0x66503f], [0, top + 1.28, D * .27], [W + 1.2, .2, slope], [pitch, 0, 0]), P(G.box, [0x44382f, 0x5d4a3c], [0, top + 1.28, -D * .27], [W + 1.2, .2, slope], [-pitch, 0, 0]));
  parts.push(P(G.box, [0x5a8a46, 0x78a057], [W * .08, top + 1.4, -D * .27 - .02], [W * .55, .08, slope * .5], [-pitch, 0, 0]));
  parts.push(P(G.box, [0x555c52, 0x7b8374], [-W * .3, top + 2.2, -D * .12], [.9, 3.4, .9]), P(G.box, 0x3e423b, [-W * .3, top + 3.95, -D * .12], [1.1, .14, 1.1]));
  // porch: deck, posts, steps, railing, door
  parts.push(P(G.box, [woodDark, woodLight], [0, .62, D / 2 + 1.3], [W - .6, .16, 2.4]));
  for (const x of [-W / 2 + .6, W / 2 - .6]) parts.push(P(G.box, woodDark, [x, 2, D / 2 + 2.2], [.2, 2.8, .2]));
  parts.push(P(G.box, [roof, 0x66503f], [0, 3.55, D / 2 + 1.3], [W + .4, .16, 2.7], [.18, 0, 0]));
  for (let i = 0; i < 2; i++) parts.push(P(G.box, woodLight, [1, .22 + i * .22, D / 2 + 2.9 + (1 - i) * .35], [1.8, .12, .5]));
  parts.push(P(G.box, [0x4a301e, 0x6d4a2d], [-.7, 1.55, D / 2 + .3], [1.3, 2, .14]));
  for (const [x, z, sx, sz] of [[2, D / 2 + .3, 1.3, .1], [-2.2, D / 2 + .3, 1.3, .1]]) parts.push(P(G.box, woodDark, [x, 1.9, z], [sx, 1.1, sz]));
  parts.push(P(G.box, woodDark, [-W / 2 - .3, 1.9, 0], [.1, 1.1, 1.3]));
  parts.push(P(G.box, [woodDark, wood], [W / 2 - 1.3, 1.1, D / 2 + 2.3], [1.8, .1, .08]), P(G.box, woodDark, [W / 2 - 1.3, 1.35, D / 2 + 2.3], [1.8, .1, .08]));
  // woodpile, barrel and a chopping stump
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) parts.push(P(G.cyl6, [0x5c4330, 0xb99a69], [W / 2 + 1 + r * .22 + .4, .3 + r * .5, -.3 + c * .55 + r * .27], [.24, 1.4, .24], [0, 0, Math.PI / 2], { jitter: .14 }));
  parts.push(P(G.box, woodDark, [W / 2 + 1.1, 1.9, 0], [1.9, .14, 2.3]));
  parts.push(P(G.cyl8, [0x6a4a2c, 0x8a6740], [-W / 2 - 1.1, .55, D / 2 - .4], [.45, 1.1, .45]), P(G.cyl8, 0x384a45, [-W / 2 - 1.1, .35, D / 2 - .4], [.47, .08, .47]), P(G.cyl8, 0x384a45, [-W / 2 - 1.1, .8, D / 2 - .4], [.47, .08, .47]));
  parts.push(P(G.cyl6, [0x4c3626, 0x634830], [-W / 2 - 1.8, .3, -D / 2 + .5], [.42, .6, .42]), P(G.box, 0x555b60, [-W / 2 - 1.8, .85, -D / 2 + .5], [.34, .08, .16], [0, .5, .2]));
  return parts;
}

function cabinGlow() {
  return [P(G.box, 0xffcf74, [2, 1.9, 3.04], [1.05, .85, .04]), P(G.box, 0xffcf74, [-2.2, 1.9, 3.04], [1.05, .85, .04]), P(G.box, 0xffc060, [-3.83, 1.9, 0], [.04, .85, 1.05]), P(G.box, 0xffcf74, [-2.9, 2.55, 4.7], [.3, .42, .3])];
}

function footbridge() {
  const parts = [], len = 9, w = 2;
  const deckY = t => .75 + Math.sin(t * Math.PI) * .45, xAt = t => -len / 2 + .25 + t * (len - .5);
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    parts.push(P(G.box, [i % 2 ? woodLight : wood, mix(wood, woodLight, .6)], [xAt(t), deckY(t), 0], [.46, .12, w], [0, 0, Math.cos(t * Math.PI) * -.1]));
  }
  for (const z of [-w / 2 + .06, w / 2 - .06]) {
    for (let k = 0; k <= 4; k++) { const t = k / 4; parts.push(P(G.box, [woodDark, wood], [xAt(t), deckY(t) + .5, z], [.15, 1, .15])); }
    for (let k = 0; k < 4; k++) for (const h of [.55, .95]) {
      const a = [xAt(k / 4), deckY(k / 4) + h, z], b = [xAt((k + 1) / 4), deckY((k + 1) / 4) + h, z];
      parts.push(aimed(G.box, [wood, woodLight], a, [b[0] - a[0], b[1] - a[1], 0], Math.hypot(b[0] - a[0], b[1] - a[1]), [.09, .09]));
    }
  }
  for (const z of [-w / 2 + .3, w / 2 - .3]) parts.push(P(G.box, woodDark, [0, .55, z], [len + .6, .22, .24]));
  for (const x of [-len / 2 - .2, len / 2 + .2]) parts.push(P(G.box, [0x555c52, 0x7b8374], [x, .35, 0], [1.2, 1.3, 2.6]));
  return parts;
}

function trailMarker() {
  return [
    P(G.box, [woodDark, wood], [0, .6, 0], [.16, 1.2, .16]),
    P(G.box, 0xe4b84b, [0, .98, 0], [.2, .16, .2]),
    P(G.box, [wood, woodLight], [.14, .74, 0], [.52, .16, .05], [0, 0, 0]),
    P(G.cone4o, woodLight, [.46, .74, 0], [.12, .18, .06], [0, 0, -Math.PI / 2]),
    P(G.box, 0x3d4a3a, [0, 1.24, 0], [.28, .06, .28]),
  ];
}

function lantern() {
  return [
    P(G.box, [woodDark, wood], [0, 1.3, 0], [.18, 2.6, .18]),
    P(G.box, woodDark, [.4, 2.45, 0], [.9, .08, .08]),
    P(G.box, 0x2f3e3b, [.8, 2.2, 0], [.34, .08, .34]), P(G.box, 0x2f3e3b, [.8, 2.64, 0], [.4, .07, .4]),
    P(G.box, 0x2f3e3b, [.8 - .15, 2.42, .15], [.04, .42, .04]), P(G.box, 0x2f3e3b, [.8 + .15, 2.42, -.15], [.04, .42, .04]),
    P(G.cone4o, 0x2f3e3b, [.8, 2.9, 0], [.28, .28, .28], [0, Math.PI / 4, 0]),
    P(G.box, [stone, 0x838b7c], [0, .1, 0], [.5, .2, .5]),
  ];
}

function lanternGlow() { return [P(G.box, 0xffcf70, [.8, 2.42, 0], [.22, .34, .22])]; }

function fenceSection() {
  const parts = [];
  for (const x of [-1.5, 1.5]) parts.push(P(G.taper, [woodDark, wood], [x, .62, 0], [.13, 1.24, .13]));
  for (const [y, z] of [[.42, .05], [.88, -.05]]) parts.push(P(G.box, [wood, woodLight], [0, y, z], [3.05, .11, .09], [0, 0, y > .5 ? .015 : -.015]));
  parts.push(P(G.box, 0x5b8548, [-.6, .96, -.05], [.7, .04, .12]));
  return parts;
}

function signpost() {
  return [
    P(G.box, [woodDark, wood], [0, 1.15, 0], [.2, 2.3, .2]),
    P(G.box, [wood, woodLight], [.5, 1.9, 0], [1.1, .3, .07]), P(G.cone4o, woodLight, [1.18, 1.9, 0], [.15, .22, .06], [0, 0, -Math.PI / 2]),
    P(G.box, [woodDark, wood], [-.45, 1.45, 0], [1, .3, .07], [0, .1, 0]), P(G.cone4o, wood, [-1.05, 1.45, .02], [.15, .22, .06], [0, 0, Math.PI / 2]),
    P(G.box, [0x3d4a3a, 0x5a8a46], [0, 2.4, 0], [.34, .05, .34]),
  ];
}

function trailheadArch() {
  const parts = [];
  for (const x of [-3.4, 3.4]) {
    parts.push(P(G.taper, [0x4c3626, 0x6a4c33], [x, 2.6, 0], [.42, 5.2, .42]), P(G.box, [stone, 0x838b7c], [x, .25, 0], [1.2, .5, 1.2]));
    parts.push(aimed(G.cone4o, woodDark, [x, 3.4, 0], [-Math.sign(x) * 1, 1, 0], 1.7, [.14, .14]));
  }
  parts.push(P(G.box, [woodDark, wood], [0, 5.25, 0], [8.2, .46, .46]), P(G.box, [wood, woodLight], [0, 4.55, 0], [4.6, .8, .12]), P(G.box, [0x5a8a46, 0x78a057], [0, 5.55, 0], [6.4, .12, .5]));
  parts.push(P(G.box, 0xe4b84b, [0, 4.55, .08], [3.6, .14, .04]), P(G.box, 0xe4b84b, [0, 4.3, .08], [2.6, .1, .04]));
  for (const x of [-1.9, 1.9]) parts.push(P(G.cyl6o, 0x2f3e3b, [x, 4.45, 0], [.012, .22, .012]));
  return parts;
}

function campfire() {
  const parts = [];
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; parts.push(P(G.ico0, [0x4a524b, 0x838b7c], [Math.sin(a) * 1.05, .2, Math.cos(a) * 1.05], [.34, .24, .3], [0, i, 0])); }
  for (let i = 0; i < 3; i++) parts.push(P(G.cyl6, [0x2a2018, 0x4a3828], [0, .32, 0], [.12, 1.4, .12], [.3, i * 2.09, Math.PI / 2 - .3]));
  parts.push(P(G.cyl8, 0x2a2018, [0, .06, 0], [.8, .05, .8]));
  parts.push(...transformParts([P(G.cyl6, [0x6a4a2c, 0x8a6740], [0, .22, 0], [.3, .45, .3])], [1.9, 0, .6], 0, 1), ...transformParts([P(G.cyl6, [0x6a4a2c, 0x8a6740], [0, .22, 0], [.3, .45, .3])], [-1.7, 0, 1], 0, 1));
  return parts;
}
function embers() { return [P(G.ico0, 0xff7a2e, [0, .42, 0], [.3, .24, .3]), P(G.oct, 0xffb347, [.1, .66, 0], [.14, .22, .14])]; }


function bench() {
  const parts = [];
  for (const x of [-1.05, 1.05]) parts.push(P(G.box, [0x555c52, 0x7b8374], [x, .25, 0], [.38, .5, .7]), P(G.box, [woodDark, wood], [x, .78, -.25], [.13, .95, .13], [-.12, 0, 0]));
  for (let i = 0; i < 3; i++) parts.push(P(G.box, [wood, woodLight], [0, .57, -.2 + i * .2], [2.8, .1, .17]), P(G.box, [woodDark, wood], [0, .86 + i * .17, -.3], [2.8, .13, .09]));
  return parts;
}

function bin() {
  const parts = [P(G.cyl8, 0x344a45, [0, .6, 0], [.4, 1.2, .4])];
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; parts.push(P(G.box, [woodDark, wood], [Math.sin(a) * .4, .58, Math.cos(a) * .4], [.1, .95, .065], [0, a, 0])); }
  parts.push(P(G.cyl8, 0x344a45, [0, 1.23, 0], [.47, .1, .47]), P(G.box, 0x4e5a4c, [0, 1.29, 0], [.43, .04, .18]));
  return parts;
}

function kiosk() {
  const parts = [P(G.box, [0x555c52, 0x7b8374], [0, .12, 0], [6, .24, 3.6])];
  for (const x of [-2.3, 2.3]) parts.push(P(G.box, [woodDark, wood], [x, 1.5, 0], [.2, 2.8, .2]));
  parts.push(P(G.box, [wood, woodLight], [0, 2.35, -.05], [5, 1.3, .18]), P(G.box, 0x6f9650, [0, 2.35, .08], [4.5, .9, .04]), P(G.box, 0xe4b84b, [-1.45, 2.48, .12], [.7, .12, .04]), P(G.box, 0xf0e2bb, [.9, 2.3, .12], [1.5, .6, .03]));
  parts.push(P(G.box, wood, [0, 2.9, 0], [6, .22, .22]), P(G.box, [0x203d32, 0x3a5f46], [0, 3.15, 0], [6.6, .18, 3.1], [0, 0, .04]), P(G.box, [0x5a8a46, 0x78a057], [0, 3.28, 0], [4.8, .08, 2.4], [0, 0, .04]));
  return parts;
}

function reeds() {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39996, r = .1 + (i % 3) * .22, h = 1.5 + (i % 4) * .35, lean = [Math.sin(a) * .14, 1, Math.cos(a) * .14];
    parts.push(aimed(G.cone3o, [0x58763a, 0xa5b05a], [Math.sin(a) * r, 0, Math.cos(a) * r], lean, h, [.05, .03]));
    if (i % 3 === 0) parts.push(P(G.cyl6o, 0x5a3b26, [Math.sin(a) * r + lean[0] * h, h * .96, Math.cos(a) * r + lean[2] * h], [.06, .38, .06]));
  }
  return parts;
}

function lily() {
  return [P(G.disc8, [0x4d8a45, 0x6fae56], [0, .04, 0], [.55, 1, .5], [0, 0, 0], { mode: 'radial' }), P(G.disc8, [0x4d8a45, 0x6fae56], [.8, .04, .5], [.38, 1, .34], [0, 1, 0], { mode: 'radial' }), P(G.oct, 0xf0b5cf, [.1, .13, .05], [.12, .1, .12])];
}

function lightShaft() {
  // Tapered crossed quads; alpha is baked into an RGBA vertex colour.
  const top = 44, wTop = 11, wBottom = 6;
  const pos = [], colors = [], idx = [];
  const rows = [[0, wBottom, 0], [top * .32, (wTop + wBottom) * .45, .34], [top * .68, wTop * .92, .24], [top, wTop, 0]];
  for (const rot of [0, Math.PI / 2]) {
    const base = pos.length / 3, c = Math.cos(rot), s = Math.sin(rot);
    rows.forEach(([y, w, a]) => { for (const side of [-1, 1]) { pos.push(side * w / 2 * c, y, side * w / 2 * s); colors.push(1, .95, .74, a); } });
    for (let r = 0; r < 3; r++) { const a = base + r * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}

function mistDisc() {
  const pos = [0, 0, 0], colors = [.84, .93, .88, .2], idx = [], n = 14;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pos.push(Math.sin(a), 0, Math.cos(a)); colors.push(.84, .93, .88, 0); }
  for (let i = 0; i < n; i++) idx.push(0, 1 + (i + 1) % n, 1 + i);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}

// ---------------------------------------------------------------- registry
const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
const halo = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: .09, blending: THREE.AdditiveBlending, depthWrite: false });
const ember = new THREE.MeshBasicMaterial({ vertexColors: true });
const shaft = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: .27 });
const mist = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: .85 });

const defs = {
  cedar: [() => conifers.cedar(), vc, { shadow: true, tint: true }],
  fir: [() => conifers.fir(), vc, { shadow: true, tint: true }],
  spruce: [() => conifers.spruce(), vc, { shadow: true, tint: true }],
  hemlock: [() => conifers.hemlock(), vc, { shadow: true, tint: true }],
  giant: [() => conifers.giant(), vc, { shadow: true, tint: true }],
  sapling: [() => conifers.sapling(), vc, { shadow: true, tint: true }],
  snagTall: [() => snag(true), vc, { shadow: true }],
  snagBroken: [() => snag(false), vc, { shadow: true }],
  alder: [() => broadleaf(0x8fae48, 0xc2d062, 0xb6b2a2, 0x8a8576, 5.6, 1.9), vc, { shadow: true, tint: true }],
  maple: [() => broadleaf(0xcf9a32, 0xecc65c, 0x6a5a45, 0x4e4234, 5, 2.3), vc, { shadow: true, tint: true }],
  fern: [() => fern(0x3f7a45, 0x72ab55, 9, 1.5), vc, { tint: true }],
  fernDeep: [() => fern(0x2a5a3c, 0x4f8a50, 10, 1.9), vc, { tint: true }],
  bracken: [() => fern(0x8a8a3c, 0xc4a64a, 8, 1.8), vc, { tint: true }],
  salal: [() => bush(0x2f5a3a, 0x58884a, 0xb83a35), vc, { tint: true }],
  huckleberry: [() => bush(0x3d6a35, 0x7ea64e, 0x3a2f6a), vc, { tint: true }],
  grass: [() => grass(0x4d7a3c, 0xa6b45c, 8, 1.1), vc, { tint: true }],
  boulder: [() => boulder(1.7, 1.4, 1.5, 0x59635b, 0x6f9650), vc, { shadow: true, tint: true }],
  boulderSlab: [() => boulder(2.2, .85, 1.5, 0x6d7568, 0x6e9250), vc, { shadow: true, tint: true }],
  boulderSmall: [() => boulder(.8, .6, .7, 0x59635b, 0x75994f, false), vc, { shadow: true, tint: true }],
  pebbles: [pebbles, vc, { shadow: false }],
  flatStone: [() => flatStone(.7), vc, { shadow: false }],
  log: [() => log(6, .55), vc, { shadow: true }],
  logRoot: [() => log(7, .6, { roots: true }), vc, { shadow: true }],
  logNurse: [() => log(6.5, .6, { nurse: true }), vc, { shadow: true }],
  stump: [() => stump(false), vc, { shadow: true }],
  stumpTall: [() => stump(true), vc, { shadow: true }],
  shroomRed: [() => mushrooms('red'), vc, {}],
  shroomOrange: [() => mushrooms('orange'), vc, {}],
  shroomBrown: [() => mushrooms('brown'), vc, {}],
  fairyRing: [fairyRing, vc, {}],
  lupine: [() => flowers('lupine'), vc, { tint: true }],
  meadow: [() => flowers('meadow'), vc, { tint: true }],
  foxglove: [() => flowers('foxglove'), vc, { tint: true }],
  bluebell: [() => flowers('bluebell'), vc, { tint: true }],
  litterRust: [() => disc(0x7b4b2d, 0x5a4531, 1), vc, { flat: true }],
  litterGold: [() => disc(0x8a7236, 0x5f5232, 1), vc, { flat: true }],
  litterBrown: [() => disc(0x4a382a, 0x3a3a2a, 1), vc, { flat: true }],
  mossPatch: [() => disc(0x628a44, 0x3f6a38, 1), vc, { flat: true }],
  hangingMoss: [hangingMoss, vc, {}],
  cabin: [cabin, vc, { shadow: true }],
  cabinGlow: [cabinGlow, glow, {}],
  footbridge: [footbridge, vc, { shadow: true }],
  trailMarker: [trailMarker, vc, { shadow: true }],
  lantern: [lantern, vc, { shadow: true }],
  lanternGlow: [lanternGlow, glow, {}],
  lanternHalo: [() => [P(G.sphere, 0xffffff, [.8, 2.42, 0], [.95, .95, .95])], halo, {}],
  fence: [fenceSection, vc, { shadow: true }],
  signpost: [signpost, vc, { shadow: true }],
  arch: [trailheadArch, vc, { shadow: true }],
  campfire: [campfire, vc, {}],
  bench: [bench, vc, { shadow: true }],
  bin: [bin, vc, { shadow: true }],
  kiosk: [kiosk, vc, { shadow: true }],
  reeds: [reeds, vc, {}],
  lily: [lily, vc, { flat: true }],
  embers: [embers, ember, {}],
  shaft: [() => lightShaft(), shaft, { raw: true }],
  mist: [() => mistDisc(), mist, { raw: true }],
};

export const KIT_NAMES = Object.keys(defs);

// Collects instances per kit and bakes them into one InstancedMesh per kit.
export class Batcher {
  constructor(scene, label = 'Cedar dressing') {
    this.scene = scene; this.label = label; this.sets = new Map(); this.kits = new Map();
  }
  geometry(name) {
    if (!this.kits.has(name)) {
      const [make, material, options] = defs[name];
      const made = make();
      this.kits.set(name, { geometry: options.raw ? made : buildKit(made, KIT_NAMES.indexOf(name) + 1), material, options });
    }
    return this.kits.get(name);
  }
  // pose: position, yaw, uniform or [sx,sy,sz] scale, optional quaternion to tilt onto the terrain.
  add(name, x, y, z, yaw = 0, scale = 1, tint = 1, quaternion = null) {
    this.geometry(name);
    if (!this.sets.has(name)) this.sets.set(name, { matrices: [], tints: [] });
    const set = this.sets.get(name);
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    tmpQ.setFromAxisAngle(up, yaw);
    if (quaternion) tmpQ.premultiply(quaternion);
    set.matrices.push(new THREE.Matrix4().compose(tmpV.set(x, y, z), tmpQ, tmpS.set(...s)));
    set.tints.push(tint);
  }
  count(name) { return this.sets.get(name)?.matrices.length || 0; }
  total() { let n = 0; for (const set of this.sets.values()) n += set.matrices.length; return n; }
  build() {
    const meshes = [];
    for (const [name, set] of this.sets) {
      const { geometry, material, options } = this.geometry(name);
      const mesh = new THREE.InstancedMesh(geometry, material, set.matrices.length);
      mesh.name = `${this.label} / ${name}`;
      set.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      if (options.tint) {
        const c = new THREE.Color();
        set.tints.forEach((t, i) => mesh.setColorAt(i, c.setRGB(t, t * (.97 + (hash(i * 1.7 + name.length) - .5) * .12), t * .96)));
        mesh.instanceColor.needsUpdate = true;
      }
      mesh.castShadow = !!options.shadow; mesh.receiveShadow = !options.raw;
      mesh.userData.decorative = true; mesh.userData.kit = name; mesh.userData.instances = set.matrices.length;
      mesh.computeBoundingSphere(); mesh.frustumCulled = true;
      this.scene.add(mesh); meshes.push(mesh);
    }
    return meshes;
  }
}

export { vc as kitMaterial };
