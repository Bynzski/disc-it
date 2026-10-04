import * as THREE from 'three';
import { createBench } from './EnvironmentAssets.js';
import { createBin } from './ParkAssets.js';
import { WATER, COURSE_BOUNDS } from './Layout.js';

// Shared low-poly kit for Tocobaga's decorative layer. Geometry and materials
// are created once so bakeAssets() collapses every prop that uses the same
// pair into a single InstancedMesh (draw call), however many are scattered.
export const box = new THREE.BoxGeometry(1, 1, 1);
export const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
export const crown = new THREE.IcosahedronGeometry(1, 0);
export const cone = new THREE.ConeGeometry(1, 1, 8);
export const disk = new THREE.CylinderGeometry(1, 1, 1, 48);
const hex = new THREE.CylinderGeometry(1, 1, 1, 6);
// A quarter sphere (half-dome) that opens toward +z, for the bandshell.
const dome = new THREE.SphereGeometry(1, 16, 8, Math.PI, Math.PI, 0, Math.PI / 2);
export const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, ...options });
export const colors = {
  bark: mat(0x785437), dark: mat(0x355d45), leaf: mat(0x587e46), lime: mat(0x859951),
  silver: mat(0x8eaa8a), blossom: mat(0xd7aab6), gold: mat(0xd3b666), grass: mat(0x8b995c),
  wood: mat(0xb38b58), teal: mat(0x427f7b), coral: mat(0xc77953), metal: mat(0x405d58),
  path: mat(0xc5ba98), mulch: mat(0x9b7e5a), sand: mat(0xe0cf9e), stone: mat(0xb7b29b),
  // Added for the decorative pass.
  white: mat(0xe8e3d3), rose: mat(0xd0607e), red: mat(0xb5483c), peri: mat(0x8aa0d8),
  maple: mat(0xb4522f), orange: mat(0xcf8b36), 
  terracotta: mat(0xb0603f),
  water: mat(0x5e9db3, { roughness: .3 }), lily: mat(0x4c8c48),
  glow: mat(0xf7e3a4, { emissive: 0xffd27a, emissiveIntensity: .45 }),
  shell: mat(0xe9e5d6, { side: THREE.DoubleSide }), shellIn: mat(0x4c8f8a, { side: THREE.DoubleSide }),
};
export const flowerColors = [colors.gold, colors.rose, colors.white, colors.peri, colors.red, colors.blossom];

export function part(root, geometry, material, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
  root.add(mesh); return mesh;
}
export function group(name) { const root = new THREE.Group(); root.name = name; return root; }
// Nest a prefab and remember its name, so composites can report what they hold.
function add(root, child, x, z, rotation = 0, scale = 1, y = 0) {
  child.position.set(x, y, z); child.rotation.y = rotation; child.scale.setScalar(scale);
  root.add(child);
  const names = root.userData.parts ||= new Set();
  names.add(child.name); child.userData.parts?.forEach(n => names.add(n));
  return child;
}
const polar = (r, a) => [Math.sin(a) * r, Math.cos(a) * r];
// Same deterministic hash the commons uses; no Math.random anywhere.
export const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------------------------------------------------------------- small props
export function createLamppost(variant = 0) {
  const root = group('Lamppost');
  part(root, cylinder, colors.stone, [0, .22, 0], [.22, .44, .22]);
  part(root, cylinder, colors.metal, [0, 2, 0], [.065, 3.6, .065]);
  part(root, box, colors.metal, [0, 3.9, 0], [.42, .08, .42]);
  part(root, box, colors.glow, [0, 4.15, 0], [.3, .42, .3]);
  part(root, cone, colors.metal, [0, 4.5, 0], [.34, .3, .34]);
  if (variant) { // hanging flower basket
    part(root, box, colors.metal, [.3, 3.3, 0], [.6, .05, .05]);
    part(root, crown, colors.leaf, [.55, 3.05, 0], [.28, .2, .28]);
    part(root, crown, variant === 1 ? colors.rose : colors.gold, [.55, 3.22, 0], [.2, .14, .2]);
  }
  return root;
}

export function createFlowerUrn() {
  const root = group('Flower urn');
  part(root, cylinder, colors.terracotta, [0, .35, 0], [.3, .7, .3]);
  part(root, cylinder, colors.terracotta, [0, .72, 0], [.38, .1, .38]);
  part(root, crown, colors.leaf, [0, .88, 0], [.4, .3, .4]);
  part(root, crown, colors.rose, [-.15, 1.08, 0], [.15, .12, .15]);
  part(root, crown, colors.gold, [.14, 1.1, .05], [.15, .12, .15]);
  part(root, crown, colors.white, [0, 1.17, -.12], [.13, .11, .13]);
  return root;
}

export function createPlanterBox() {
  const root = group('Planter box');
  part(root, box, colors.wood, [0, .35, 0], [2.2, .7, .8]);
  part(root, box, colors.bark, [0, .7, 0], [2, .06, .6]);
  for (let i = 0; i < 4; i++) {
    const x = -.75 + i * .5;
    part(root, crown, colors.leaf, [x, .88, 0], [.3, .24, .3]);
    part(root, crown, flowerColors[i % 4], [x, 1.08, .05], [.14, .12, .14]);
    part(root, crown, flowerColors[(i + 2) % 6], [x + .12, 1.0, -.12], [.11, .1, .11]);
  }
  return root;
}

export function createHedge(segments = 4) {
  const root = group('Clipped hedge');
  const length = segments * 1.3;
  part(root, box, colors.dark, [0, .42, 0], [length, .84, .8]);
  for (let i = 0; i < segments; i++) part(root, crown, i % 2 ? colors.leaf : colors.dark, [(i - (segments - 1) / 2) * 1.3, .9, 0], [.78, .42, .5]);
  return root;
}

export function createFlowerBed(seed = 0) {
  const root = group('Flower bed');
  part(root, cylinder, colors.stone, [0, .14, 0], [2.5, .28, 2.5]);
  part(root, cylinder, colors.mulch, [0, .18, 0], [2.2, .3, 2.2]);
  for (let i = 0; i < 4; i++) {
    const [x, z] = polar(1.3, i * 1.57 + seed);
    part(root, crown, i % 2 ? colors.leaf : colors.dark, [x, .5, z], [.6, .38, .6]);
  }
  part(root, crown, colors.leaf, [0, .65, 0], [.6, .5, .6]);
  for (let i = 0; i < 8; i++) {
    const [x, z] = polar(.35 + noise(seed * 13 + i) * 1.5, i * 2.4 + seed);
    part(root, crown, flowerColors[(i + seed) % 6], [x, .78 + noise(seed + i) * .25, z], [.15, .13, .15]);
  }
  return root;
}

export function createBirdBath() {
  const root = group('Bird bath');
  part(root, cylinder, colors.stone, [0, .08, 0], [.4, .16, .4]);
  part(root, cylinder, colors.stone, [0, .55, 0], [.16, 1, .16]);
  part(root, cylinder, colors.stone, [0, 1.05, 0], [.62, .14, .62]);
  part(root, cylinder, colors.water, [0, 1.13, 0], [.52, .03, .52]);
  part(root, crown, colors.peri, [.22, 1.25, .05], [.1, .09, .13]);
  return root;
}

export function createBannerFlag(variant = 0) {
  const root = group('Banner flag');
  const cloth = [colors.teal, colors.coral, colors.gold, colors.maple][variant % 4];
  part(root, cylinder, colors.metal, [0, 2.6, 0], [.05, 5.2, .05]);
  part(root, crown, colors.gold, [0, 5.3, 0], [.12, .12, .12]);
  part(root, box, colors.metal, [.55, 4.9, 0], [1.1, .05, .05]);
  part(root, box, cloth, [.62, 3.9, 0], [.9, 2, .04]);
  part(root, box, colors.white, [.62, 4.55, .01], [.9, .22, .05]);
  part(root, box, colors.white, [.62, 3.15, .01], [.9, .12, .05]);
  return root;
}

export function createBikeRack() {
  const root = group('Bike rack');
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * .9;
    for (const dx of [-.28, .28]) part(root, box, colors.metal, [x + dx, .38, 0], [.05, .76, .05]);
    part(root, box, colors.metal, [x, .78, 0], [.61, .05, .05]);
  }
  for (const [x, c] of [[-.9, colors.dark], [.9, colors.teal]]) {
    for (const dx of [-.5, .5]) part(root, cylinder, colors.metal, [x + dx, .32, .34], [.32, .05, .32], [Math.PI / 2, 0, 0]);
    part(root, box, c, [x, .62, .34], [.95, .06, .06], [0, 0, .12]);
    part(root, box, colors.metal, [x + .45, .98, .34], [.05, .05, .4]);
    part(root, box, colors.metal, [x - .12, .76, .34], [.3, .05, .1]);
  }
  return root;
}

export function createDrinkingFountain() {
  const root = group('Drinking fountain');
  part(root, box, colors.stone, [0, .55, 0], [.4, 1.1, .4]);
  part(root, box, colors.metal, [0, 1.12, 0], [.7, .14, .5]);
  part(root, cylinder, colors.metal, [0, 1.3, -.1], [.04, .24, .04]);
  part(root, cylinder, colors.metal, [.55, .1, .1], [.22, .1, .22]);
  part(root, cylinder, colors.water, [.55, .16, .1], [.17, .02, .17]);
  return root;
}

export function createRecyclingStation() {
  const root = group('Recycling station');
  const bins = [colors.teal, colors.dark, colors.stone];
  bins.forEach((c, i) => {
    const x = (i - 1) * .75;
    part(root, box, c, [x, .5, 0], [.62, 1, .6]);
    part(root, box, colors.metal, [x, 1.03, 0], [.68, .08, .66]);
    part(root, box, colors.metal, [x, .82, .31], [.34, .08, .02]);
  });
  for (const x of [-1.25, 1.25]) part(root, box, colors.metal, [x, 1.2, -.2], [.07, 2.4, .07]);
  part(root, box, colors.metal, [0, 2.4, -.1], [2.7, .08, 1]);
  return root;
}

export function createLittleLibrary() {
  const root = group('Little free library');
  part(root, cylinder, colors.bark, [0, .65, 0], [.08, 1.3, .08]);
  part(root, box, colors.coral, [0, 1.55, 0], [.8, .72, .52]);
  part(root, box, colors.metal, [0, 1.52, .27], [.52, .45, .02]);
  part(root, box, colors.coral, [0, 2.0, 0], [1, .1, .72], [.2, 0, 0]);
  return root;
}

export function createUmbrellaTable(variant = 0) {
  const root = group('Umbrella table');
  part(root, cylinder, colors.metal, [0, 1.3, 0], [.04, 2.6, .04]);
  part(root, cone, [colors.coral, colors.teal, colors.white][variant % 3], [0, 2.65, 0], [1.8, .6, 1.8]);
  part(root, cylinder, colors.white, [0, .75, 0], [.8, .08, .8]);
  part(root, cylinder, colors.metal, [0, .37, 0], [.1, .75, .1]);
  for (let i = 0; i < 3; i++) {
    const [x, z] = polar(1.25, i * 2.09 + variant);
    part(root, cylinder, colors.wood, [x, .3, z], [.28, .6, .28]);
  }
  return root;
}

export function createFoodTruck() {
  const root = group('Food truck');
  part(root, box, colors.teal, [0, 1.5, 0], [5.4, 2.1, 2.4]);
  part(root, box, colors.white, [0, 2.62, 0], [5.5, .14, 2.5]);
  part(root, box, colors.metal, [-1.6, 2.9, -.4], [.5, .5, .5]);
  part(root, box, colors.white, [3.5, 1.1, 0], [1.6, 1.5, 2.3]);
  part(root, box, colors.metal, [4.31, 1.45, 0], [.05, .7, 2]);
  part(root, box, colors.metal, [-.3, 1.7, 1.21], [2.6, .9, .04]);
  part(root, box, colors.wood, [-.3, 1.2, 1.5], [2.6, .1, .55]);
  for (let i = 0; i < 7; i++) part(root, box, i % 2 ? colors.white : colors.coral, [-1.5 + i * .4, 2.38, 1.6], [.4, .06, 1.1], [.5, 0, 0]);
  part(root, box, colors.metal, [-2.3, 1.6, 1.21], [.8, 1.1, .04]);
  for (let i = 0; i < 3; i++) part(root, box, colors.white, [-2.3, 1.9 - i * .3, 1.24], [.55, .07, .02]);
  for (const x of [-1.6, 3]) for (const z of [-1.2, 1.2]) part(root, cylinder, colors.metal, [x, .45, z], [.45, .3, .45], [Math.PI / 2, 0, 0]);
  return root;
}

export function createSnackKiosk() {
  const root = group('Park kiosk');
  part(root, hex, colors.white, [0, 1.3, 0], [1.9, 2.6, 1.9]);
  part(root, hex, colors.stone, [0, .12, 0], [2.2, .24, 2.2]);
  part(root, cone, colors.coral, [0, 3.2, 0], [2.6, 1.3, 2.6], [0, Math.PI / 6, 0]);
  part(root, crown, colors.gold, [0, 3.95, 0], [.14, .14, .14]);
  for (const a of [0, 2.1, 4.2]) {
    const [x, z] = polar(1.62, a);
    part(root, box, colors.metal, [x, 1.6, z], [.9, .8, .08], [0, a, 0]);
    const [cx, cz] = polar(1.95, a);
    part(root, box, colors.wood, [cx, 1.1, cz], [1.1, .08, .4], [0, a, 0]);
  }
  return root;
}

// ----------------------------------------------------------- larger features
export function createFountain() {
  const root = group('Fountain');
  part(root, hex, colors.stone, [0, .3, 0], [4.2, .6, 4.2]);
  part(root, cylinder, colors.water, [0, .56, 0], [3.7, .06, 3.7]);
  part(root, cylinder, colors.stone, [0, 1.1, 0], [.5, 1.6, .5]);
  part(root, cylinder, colors.stone, [0, 1.9, 0], [1.5, .25, 1.5]);
  part(root, cylinder, colors.water, [0, 2.04, 0], [1.3, .04, 1.3]);
  part(root, cone, colors.white, [0, 2.8, 0], [.14, 1.4, .14]);
  part(root, crown, colors.white, [0, 3.5, 0], [.22, .18, .22]);
  for (let i = 0; i < 6; i++) {
    const [x, z] = polar(2.2, i * 1.047);
    part(root, cone, colors.white, [x * .72, .9, z * .72], [.1, 1.1, .1], [Math.cos(i * 1.047) * .7, 0, -Math.sin(i * 1.047) * .7]);
  }
  return root;
}

export function createFountainPlaza() {
  const root = group('Fountain plaza');
  part(root, disk, colors.stone, [0, .05, 0], [13.8, .1, 13.8]);
  part(root, disk, colors.sand, [0, .08, 0], [7.4, .12, 7.4]);
  add(root, createFountain(), 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.047;
    const [bx, bz] = polar(9.6, a + .52); add(root, createBench(), bx, bz, a + .52 + Math.PI);
    const [lx, lz] = polar(12.3, a); add(root, createLamppost(1 + i % 2), lx, lz, a);
    const [ux, uz] = polar(11.9, a + .52); add(root, createFlowerUrn(), ux, uz, a);
    const [hx, hz] = polar(12.9, a + .52); add(root, createHedge(3), hx, hz, a + .52 + Math.PI / 2);
  }
  return root;
}

export function createLilyPond() {
  const root = group('Ornamental lily pond');
  const lobes = [[0, 0, 7.4], [5.2, 2.6, 4.6]];
  for (const [x, z, r] of lobes) part(root, disk, colors.stone, [x, .03, z], [r + .7, .06, r + .7]);
  for (const [x, z, r] of lobes) part(root, disk, colors.water, [x, .06, z], [r, .08, r]);
  for (let i = 0; i < 16; i++) {
    const [x, z] = polar(1 + noise(i * 5 + 1) * 6.2, i * 2.4);
    if (Math.abs(z) < 1.1 && x > -4 && x < 4) continue; // keep the bridge clear
    part(root, cylinder, colors.lily, [x, .12, z], [.45 + noise(i) * .25, .03, .45 + noise(i) * .25]);
    if (i % 3 === 0) part(root, crown, i % 2 ? colors.rose : colors.white, [x, .22, z], [.17, .13, .17]);
  }
  for (let i = 0; i < 12; i++) {
    const [x, z] = polar(8.4 + noise(i + 40) * .5, i * .52 + .2);
    part(root, crown, colors.stone, [x, .25, z], [.8, .5, .65]);
    if (i % 2) for (let j = 0; j < 3; j++) part(root, cone, colors.lime, [x * .93 + j * .15, .55, z * .93], [.06, 1.1, .06], [j * .12 - .1, 0, .1]);
  }
  for (let i = 0; i < 9; i++) part(root, box, colors.wood, [-4 + i * .9, .45, 0], [.7, .1, 1.7]);
  for (const side of [-.85, .85]) {
    part(root, box, colors.metal, [0, 1.15, side], [8.4, .07, .07]);
    for (const x of [-4, 0, 4]) part(root, box, colors.metal, [x, .75, side], [.07, .8, .07]);
  }
  return root;
}

export function createBandshell() {
  const root = group('Bandshell stage');
  part(root, box, colors.stone, [0, .4, -1.25], [14, .8, 9.5]);
  part(root, box, colors.wood, [0, .82, -1.25], [13.6, .05, 9.1]);
  for (let i = 0; i < 3; i++) part(root, box, colors.stone, [0, .62 - i * .2, 3.9 + i * .45], [6 - i * .6, .22, .6]);
  part(root, dome, colors.shell, [0, .85, .5], [6.4, 5.8, 6.4]);
  part(root, dome, colors.shellIn, [0, .86, .5], [6.1, 5.5, 6.1]);
  for (let i = 0; i <= 9; i++) { // front arch trim
    const t = i / 9 * Math.PI;
    part(root, box, colors.white, [Math.cos(t) * 6.4, .85 + Math.sin(t) * 5.8, .55], [.5, .5, .4], [0, 0, t + Math.PI / 2]);
  }
  for (const x of [-5.4, 5.4]) part(root, box, colors.metal, [x, 2.9, 2.3], [.18, 4.2, .18]);
  part(root, box, colors.metal, [0, 4.9, 2.3], [11, .2, .2]);
  for (let i = 0; i < 5; i++) part(root, box, i % 2 ? colors.glow : colors.gold, [-4 + i * 2, 4.6, 2.3], [.35, .35, .35]);
  for (const x of [-5.4, 5.4]) part(root, box, colors.metal, [x * .94, 1.8, 3], [1, 1.9, .8]);
  for (let i = 0; i < 8; i++) part(root, box, [colors.coral, colors.white, colors.teal][i % 3], [-5.6 + i * 1.6, 5.05 - Math.sin(i / 7 * Math.PI) * .1, 2.3], [.55, .5, .04]);
  const seats = [[10, [-.8, -.4, .4, .8]], [14, [-1.05, -.7, -.35, .35, .7, 1.05]]];
  for (const [r, angles] of seats) for (const a of angles) {
    const [x, z] = polar(r, a); add(root, createBench(), x, z + 2, a + Math.PI);
  }
  for (const side of [-1, 1]) {
    add(root, createLamppost(1), side * 9.4, 6.4, 0);
    add(root, createLamppost(0), side * 15.5, 8, 0);
    add(root, createFlowerUrn(), side * 7.2, 5, 0);
    add(root, createBannerFlag(side < 0 ? 1 : 0), side * 8.2, 3.6, side * -.3);
  }
  return root;
}

export function createGazebo() {
  const root = group('Garden gazebo');
  part(root, hex, colors.stone, [0, .1, 0], [3.4, .2, 3.4]);
  for (let i = 0; i < 6; i++) {
    const [x, z] = polar(3, i * 1.047);
    part(root, cylinder, colors.white, [x, 1.5, z], [.12, 3, .12]);
    if (i) { // railing between posts, leaving one open side
      const [x2, z2] = polar(3, (i - 1) * 1.047);
      part(root, box, colors.white, [(x + x2) / 2, .85, (z + z2) / 2], [3, .08, .08], [0, Math.atan2(x2 - x, z2 - z) + Math.PI / 2, 0]);
    }
  }
  part(root, cone, colors.coral, [0, 3.9, 0], [4.2, 1.6, 4.2], [0, Math.PI / 6, 0]);
  part(root, crown, colors.gold, [0, 4.8, 0], [.18, .18, .18]);
  part(root, cylinder, colors.wood, [0, .45, 0], [.8, .06, .8]);
  part(root, crown, colors.leaf, [-3.2, .35, 2.4], [.6, .4, .6]);
  part(root, crown, colors.rose, [3.2, .5, 2.4], [.45, .4, .45]);
  return root;
}

export function createRoseGarden() {
  const root = group('Rose garden');
  part(root, disk, colors.path, [0, .04, 0], [6.6, .08, 6.6]);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2;
    if (i % 9 === 0) continue; // two entries
    const [x, z] = polar(6.1, a);
    part(root, crown, i % 2 ? colors.leaf : colors.dark, [x, .6, z], [.95, .7, .95]);
  }
  part(root, cylinder, colors.mulch, [0, .12, 0], [3.8, .24, 3.8]);
  for (let i = 0; i < 22; i++) {
    const [x, z] = polar(.9 + noise(i * 3 + 7) * 2.6, i * 2.4);
    part(root, crown, colors.dark, [x, .45, z], [.4, .3, .4]);
    part(root, crown, [colors.rose, colors.red, colors.white, colors.gold, colors.blossom][i % 5], [x, .72, z], [.17, .14, .17]);
  }
  add(root, createBirdBath(), 0, 0, 0);
  for (const a of [Math.PI / 2, -Math.PI / 2]) { const [x, z] = polar(4.9, a); add(root, createBench(), x, z, a + Math.PI); }
  return root;
}

export function createCommunityGarden() {
  const root = group('Community garden');
  part(root, box, colors.stone, [0, .03, 0], [18, .06, 14]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const x = (c - 1.5) * 4.2, z = (r - 1) * 4.2, i = r * 4 + c;
    part(root, box, colors.wood, [x, .3, z], [3.2, .6, 1.6]);
    part(root, box, colors.bark, [x, .62, z], [2.9, .05, 1.3]);
    for (let k = 0; k < 4; k++) {
      part(root, crown, i % 3 ? colors.leaf : colors.lime, [x - 1.1 + k * .75, .9, z + (k % 2 - .5) * .5], [.35, .3 + (i % 3) * .1, .35]);
      if ((i + k) % 3 === 0) part(root, crown, flowerColors[(i + k) % 6], [x - 1.1 + k * .75, 1.25, z + (k % 2 - .5) * .5], [.14, .12, .14]);
    }
  }
  part(root, cylinder, colors.wood, [8, 1.2, 5.5], [.07, 2.4, .07]);
  part(root, cylinder, colors.wood, [8, 1.9, 5.5], [.05, 1.6, .05], [0, 0, Math.PI / 2]);
  part(root, crown, colors.orange, [8, 2.65, 5.5], [.3, .3, .3]);
  for (const x of [-9.4, 9.4]) part(root, box, colors.wood, [x, .6, -6], [.15, 1.2, .15]);
  part(root, box, colors.wood, [0, 1.45, -6.9], [3.4, .12, .12]);
  return root;
}

export function createRestStop() {
  const root = group('Rest stop');
  part(root, disk, colors.path, [0, .04, 0], [4.5, .08, 4.5]);
  add(root, createBench(), 0, -1.6, Math.PI);
  add(root, createDrinkingFountain(), -3.2, .6, Math.PI / 2);
  add(root, createBikeRack(), 0, 3, 0, .9);
  add(root, createRecyclingStation(), 3.1, -.6, -Math.PI / 2, .85);
  add(root, createLamppost(2), -2.5, -2.8, 0);
  add(root, createLittleLibrary(), 2.5, -3, Math.PI);
  return root;
}

export function createFoodCourt() {
  const root = group('Food truck court');
  part(root, disk, colors.path, [0, .04, 0], [10.4, .08, 10.4]);
  add(root, createFoodTruck(), -.8, -3.2, 0);
  for (const [x, z, v] of [[-3.8, 4, 0], [0, 5.6, 1], [3.8, 4, 2]]) add(root, createUmbrellaTable(v), x, z, v);
  add(root, createRecyclingStation(), 6.8, 1, -.9);
  add(root, createBin(), -6.6, 1.2, 0);
  for (const x of [-6.8, 6.4]) add(root, createLamppost(1), x, -3.6, 0);
  add(root, createPlanterBox(), -6, 6, .6);
  add(root, createPlanterBox(), 6, 6.4, -.6);
  return root;
}

export function createSnackCourt() {
  const root = group('Snack kiosk court');
  part(root, disk, colors.path, [0, .04, 0], [7.2, .08, 7.2]);
  add(root, createSnackKiosk(), 0, -1.6, 0);
  add(root, createUmbrellaTable(1), -3.4, 2.7, 1);
  add(root, createUmbrellaTable(2), 3.4, 2.7, 2);
  add(root, createBin(), 4.6, -2.2, 0);
  add(root, createFlowerUrn(), -3.8, -2.4, 0);
  add(root, createLamppost(1), -4.8, .6, 0);
  return root;
}

export function createEntranceGate() {
  const root = group('Entrance gate');
  for (const x of [-4.2, 4.2]) {
    part(root, box, colors.stone, [x, 1.4, 0], [.9, 2.8, .9]);
    part(root, box, colors.white, [x, 2.9, 0], [1.15, .2, 1.15]);
    part(root, box, colors.glow, [x, 3.3, 0], [.4, .5, .4]);
    part(root, cone, colors.metal, [x, 3.75, 0], [.45, .4, .45]);
  }
  part(root, box, colors.wood, [0, 3.0, 0], [8.4, .35, .3]);
  part(root, box, colors.teal, [0, 3.65, 0], [5, .8, .2]);
  part(root, box, colors.white, [0, 3.65, .11], [4.4, .1, .02]);
  for (const x of [-6, 6]) add(root, createFlowerUrn(), x, 0, 0);
  add(root, createBannerFlag(0), -6.4, 1.2, 0); add(root, createBannerFlag(1), 6.4, 1.2, Math.PI);
  return root;
}

// ------------------------------------------------------- scattered placement
// `ctx` is the placement toolkit created by ParkCommons: place/clear/findSite
// all share the commons' occupancy list, so decor never overlaps other props.
export function addLandmarks(ctx) {
  const { place, findSite, center, noise: n } = ctx;
  const found = {};
  const towardCenter = (x, z) => Math.atan2(center.x - x, center.z - z);
  function landmark(make, anchor, radius, zone, options = {}) {
    const site = findSite(anchor[0], anchor[1], radius, options);
    if (!site) return null;
    const asset = make();
    return place(asset, site[0], site[1], radius, options.facing === false ? n(site[0]) * 6.28 : towardCenter(site[0], site[1]), 1, zone, options.extra) ? { x: site[0], z: site[1], asset } : null;
  }
  found.bandshell = landmark(createBandshell, [150, 300], 18.5, 'Bandshell lawn', { max: 90 });
  found.plaza = landmark(createFountainPlaza, [-170, 250], 14.6, 'Fountain plaza', { max: 100, facing: false });
  if (found.plaza) found.pond = landmark(createLilyPond, [found.plaza.x, found.plaza.z], 9, 'Fountain plaza', { min: 22, max: 70, facing: false });
  found.food = landmark(createFoodCourt, [48, 76], 11.5, 'Food court', { max: 110 });
  for (const [i, anchor] of [[center.x - 36, center.z + 2], [168, -96]].entries()) found[`kiosk${i}`] = landmark(createSnackCourt, anchor, 7.8, 'Snack kiosk', { max: 90 });
  for (const [i, anchor] of [[-175, 100], [-175, -60], [175, -140], [170, 150], [-20, -165]].entries()) found[`gazebo${i}`] = landmark(createGazebo, anchor, 5, 'Gazebos', { max: 80, facing: false });
  for (const [i, anchor] of [[-170, 170], [170, -30], [60, -175]].entries()) found[`rose${i}`] = landmark(createRoseGarden, anchor, 7.6, 'Rose gardens', { max: 80, facing: false });
  for (const [i, anchor] of [[-172, 20], [172, 105]].entries()) found[`garden${i}`] = landmark(createCommunityGarden, anchor, 10.8, 'Community garden', { max: 90, facing: false });
  return found;
}

// Amenities beside the short walking links between baskets and tees. Tees and
// greens keep a wide margin, so each link gets lamps and a rest stop nearby.
export function addPathAmenities(ctx) {
  const { place, findSite, holes } = ctx;
  let stops = 0, lamps = 0;
  holes.slice(0, -1).forEach((h, i) => {
    const next = holes[i + 1];
    const dx = next.tee.x - h.basket.x, dz = next.tee.z - h.basket.z, length = Math.hypot(dx, dz) || 1;
    const fx = dx / length, fz = dz / length, mx = h.basket.x + dx / 2, mz = h.basket.z + dz / 2;
    for (const side of [-1, 1]) {
      const lamp = findSite(mx - fz * 9 * side, mz + fx * 9 * side, .55, { max: 28, step: 4 });
      if (lamp && place(createLamppost((i + side + 3) % 3), lamp[0], lamp[1], .55, 0, 1, 'Path lighting')) lamps++;
    }
    if (stops < 10 && i % 2 === 0) {
      const side = i % 4 ? 1 : -1;
      const site = findSite(mx - fz * 14 * side, mz + fx * 14 * side, 4.6, { max: 60, step: 5 });
      if (site && place(createRestStop(), site[0], site[1], 4.6, Math.atan2(mx - site[0], mz - site[1]), 1, 'Rest stops')) stops++;
    }
  });
  return { stops, lamps };
}

// Soft planting that hugs the outside of every fairway: beyond the tree line
// and the environment clearance margin, so it dresses lanes without crowding.
export function addEdgeDressing(ctx) {
  const { place, holes, noise: n, createPlant, createTree, plantRadius, treeRadius } = ctx;
  const ornamental = [7, 8, 2, 4, 11, 9];
  let seed = 5000, baths = 0;
  function plant(x, z, variant, scale) {
    return place(createPlant(variant), x, z, plantRadius(variant) * scale, n(seed + 33) * 6.28, scale, 'Fairway edge planting');
  }
  for (const h of holes) for (const route of [h.route, h.alternate].filter(Boolean)) for (let j = 1; j < route.length; j++) {
    const a = route[j - 1], b = route[j], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    const fx = dx / len, fz = dz / len;
    for (let d = 4; d < len - 2; d += 5.5 + n(seed) * 3) for (const side of [-1, 1]) {
      seed += 7;
      const off = h.width + 7.6 + n(seed + 1) * 8;
      const x = a[0] + fx * d - fz * off * side, z = a[1] + fz * d + fx * off * side;
      const r = n(seed + 2), s = .8 + n(seed + 3) * .5;
      let ok;
      if (r < .26) ok = plant(x, z, Math.floor(n(seed + 4) * 4), s);
      else if (r < .40) ok = plant(x, z, 4 + Math.floor(n(seed + 5) * 3), s);
      else if (r < .48) ok = place(createFlowerBed(Math.floor(n(seed + 6) * 6)), x, z, 2.8, n(seed + 7) * 6.28, 1, 'Fairway edge planting');
      else if (r < .56) {
        const v = ornamental[Math.floor(n(seed + 8) * ornamental.length)], ts = .6 + n(seed + 9) * .35;
        ok = place(createTree(v), x, z, treeRadius(v) * ts, n(seed + 10) * 6.28, ts, 'Fairway edge planting', { tree: true });
      } else if (r < .64) ok = plant(x, z, 7, s);
      else if (r < .67 && baths < 12) { ok = place(createBirdBath(), x, z, .95, n(seed + 11) * 6.28, 1, 'Fairway edge planting'); if (ok) baths++; }
      else if (r < .70) ok = place(createPlanterBox(), x, z, 1.4, Math.atan2(fx, fz), 1, 'Fairway edge planting');
      else if (r < .72) ok = place(createHedge(4), x, z, 2.9, Math.atan2(fx, fz) + Math.PI / 2, 1, 'Fairway edge planting');
      if (ok && r < .56 && r >= .40) for (let k = 0; k < 1; k++) {
        const ang = n(seed + 20 + k) * 6.28, dist = 3.4 + k;
        plant(x + Math.sin(ang) * dist, z + Math.cos(ang) * dist, 4 + (k + Math.floor(n(seed + 30) * 3)) % 4, .85);
      }
    }
  }
}

// Open lawn between and beyond the fairways: wildflower drifts, shrub islands
// and a few beds so the park reads as maintained rather than raw grass.
export function addLawnPlanting(ctx) {
  const { place, noise: n, createPlant, plantRadius } = ctx;
  let seed = 9000, baths = 0;
  for (let x = COURSE_BOUNDS.minX + 10; x < COURSE_BOUNDS.maxX - 8; x += 17) {
    for (let z = COURSE_BOUNDS.minZ + 10; z < COURSE_BOUNDS.maxZ - 8; z += 17) {
      seed += 5;
      const px = x + (n(seed) - .5) * 11, pz = z + (n(seed + 1) - .5) * 11, r = n(seed + 2);
      const s = .9 + n(seed + 3) * .5, rot = n(seed + 4) * 6.28;
      if (r < .30) place(createPlant(7), px, pz, plantRadius(7) * s, rot, s, 'Open lawn planting');
      else if (r < .45) place(createPlant(4 + Math.floor(n(seed + 5) * 3)), px, pz, 1.4 * s, rot, s, 'Open lawn planting');
      else if (r < .58) place(createFlowerBed(Math.floor(n(seed + 6) * 6)), px, pz, 2.8, rot, 1, 'Open lawn planting');
      else if (r < .62 && baths < 8) { if (place(createBirdBath(), px, pz, .95, rot, 1, 'Open lawn planting')) baths++; }
      else if (r < .67) place(createPlanterBox(), px, pz, 1.4, rot, 1, 'Open lawn planting');
      else if (r < .72) place(createHedge(5), px, pz, 3.4, rot, 1, 'Open lawn planting');
    }
  }
}

// Ground-level and boundary detail. Items are tiny or thin, so they are baked
// but not claimed as placements; each is still checked against every lane.
export function addAmbientDetail(ctx) {
  const { clearLite, solid, noise: n, assets, createTree, placements, center } = ctx;
  const points = [], stats = { fence: 0, railing: 0, leaves: 0, pebbles: 0, stones: 0, windbreak: 0 };
  const leafColors = [colors.orange, colors.bark, colors.maple, colors.gold, colors.bark];
  const keep = (x, z, radius, kind) => { points.push({ x, z, radius, kind }); };
  const leafGroup = group('Fallen leaves');
  // Leaf litter and pebbles under every planted tree.
  placements.filter(p => p.tree).forEach((p, i) => {
    for (let k = 0; k < (p.radius > 2 ? 3 : 2); k++) {
      const seed = i * 17 + k, ang = n(seed) * 6.28, dist = (.3 + .8 * n(seed + 1)) * p.radius;
      const x = p.x + Math.sin(ang) * dist, z = p.z + Math.cos(ang) * dist;
      if (!clearLite(x, z, .2) || solid(x, z, .2)) continue;
      part(leafGroup, box, leafColors[(i + k) % 5], [x, .03 + k * .002, z], [.26, .02, .17], [0, n(seed + 2) * 6.28, 0]);
      keep(x, z, .2, 'leaf'); stats.leaves++;
    }
    if (i % 3 === 0) for (let k = 0; k < 2; k++) {
      const ang = n(i * 5 + k + 70) * 6.28, dist = p.radius * (.6 + n(i + k) * .6);
      const x = p.x + Math.sin(ang) * dist, z = p.z + Math.cos(ang) * dist;
      if (!clearLite(x, z, .25) || solid(x, z, .25)) continue;
      part(leafGroup, crown, colors.stone, [x, .05, z], [.2 + n(i + k) * .12, .1, .16]);
      keep(x, z, .25, 'pebble'); stats.pebbles++;
    }
  });
  assets.push(leafGroup);
  // Stepping-stone walks radiating from the play garden's loop.
  const stones = group('Stepping stones');
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + .39;
    for (let d = 28.6; d < 46; d += 2.2) {
      const x = center.x + Math.sin(a) * d + Math.cos(a) * Math.sin(d) * .5, z = center.z + Math.cos(a) * d - Math.sin(a) * Math.sin(d) * .5;
      if (!clearLite(x, z, .6) || solid(x, z, .3)) continue;
      part(stones, cylinder, colors.stone, [x, .04, z], [.55, .08, .45], [0, n(k * 20 + d) * 3, 0]);
      keep(x, z, .6, 'stone'); stats.stones++;
    }
  }
  assets.push(stones);
  // White rail fence around the property, with a gap behind the entrance gate.
  const fence = group('Perimeter fence'), inset = 8, bay = 5.5, gate = ctx.gate;
  const sides = [
    [COURSE_BOUNDS.minX + inset, COURSE_BOUNDS.minZ + inset, 1, 0, COURSE_BOUNDS.maxX - COURSE_BOUNDS.minX - 2 * inset],
    [COURSE_BOUNDS.minX + inset, COURSE_BOUNDS.maxZ - inset, 1, 0, COURSE_BOUNDS.maxX - COURSE_BOUNDS.minX - 2 * inset],
    [COURSE_BOUNDS.minX + inset, COURSE_BOUNDS.minZ + inset, 0, 1, COURSE_BOUNDS.maxZ - COURSE_BOUNDS.minZ - 2 * inset],
    [COURSE_BOUNDS.maxX - inset, COURSE_BOUNDS.minZ + inset, 0, 1, COURSE_BOUNDS.maxZ - COURSE_BOUNDS.minZ - 2 * inset],
  ];
  for (const [sx, sz, ux, uz, length] of sides) {
    for (let d = 0; d < length - 1; d += bay) {
      const len = Math.min(bay, length - d), mx = sx + ux * (d + len / 2), mz = sz + uz * (d + len / 2);
      if (gate && Math.hypot(mx - gate.x, mz - gate.z) < 8) continue;
      if (!clearLite(mx, mz, .4) || solid(mx, mz, .6)) continue;
      const px = sx + ux * d, pz = sz + uz * d;
      part(fence, box, colors.wood, [px, .65, pz], [.2, 1.3, .2]);
      for (const y of [.5, .95]) part(fence, box, colors.white, [mx, y, mz], [ux ? len : .1, .12, uz ? len : .1]);
      keep(mx, mz, .4, 'fence'); stats.fence++;
    }
  }
  // Low rail fence around each pond, broken wherever a fairway needs the room.
  for (const pond of WATER) {
    const radius = pond.radius + 7, segments = 30, chord = 2 * Math.PI * radius / segments;
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, x = pond.x + Math.sin(a) * radius, z = pond.z + Math.cos(a) * radius;
      if (!clearLite(x, z, 1.4) || solid(x, z, .2)) continue;
      part(fence, box, colors.wood, [x, .45, z], [.16, .9, .16]);
      part(fence, box, colors.wood, [x, .72, z], [chord, .1, .08], [0, a, 0]);
      keep(x, z, 1.4, 'railing'); stats.railing++;
    }
  }
  assets.push(fence);
  // A windbreak of evergreens and palms outside the boundary closes the edge.
  const outer = group('Windbreak');
  const kinds = [6, 6, 0, 9, 10, 6, 9, 3];
  const bounds = COURSE_BOUNDS;
  const edges = [
    [bounds.minX, bounds.minZ, 1, 0, bounds.maxX - bounds.minX, 0, -1], [bounds.minX, bounds.maxZ, 1, 0, bounds.maxX - bounds.minX, 0, 1],
    [bounds.minX, bounds.minZ, 0, 1, bounds.maxZ - bounds.minZ, -1, 0], [bounds.maxX, bounds.minZ, 0, 1, bounds.maxZ - bounds.minZ, 1, 0],
  ];
  let seed = 400;
  for (const [sx, sz, ux, uz, length, nx, nz] of edges) {
    for (let d = 0; d < length; d += 9 + n(seed) * 5) {
      seed += 3;
      const off = 5 + n(seed) * 11, v = kinds[Math.floor(n(seed + 1) * kinds.length)], s = 1 + n(seed + 2) * .5;
      const tree = createTree(v);
      tree.position.set(sx + ux * d + nx * off, 0, sz + uz * d + nz * off); tree.rotation.y = n(seed + 3) * 6.28; tree.scale.setScalar(s);
      outer.add(tree); stats.windbreak++;
    }
  }
  assets.push(outer);
  return { points, stats };
}
