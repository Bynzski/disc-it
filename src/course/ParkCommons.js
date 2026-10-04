import * as THREE from 'three';
import { COURSE_BOUNDS, distanceToSegment } from './Layout.js';
import { createBench, createRoundPicnicTable, createSwingSet, environmentClearance, bakeAssets } from './EnvironmentAssets.js';
import { createBin, createParkSign } from './ParkAssets.js';
import { PREVIEW_PATHS } from '../camera/PreviewPaths.js';
import {
  box, cylinder, crown, cone, disk, colors, flowerColors, part, group, noise,
  createLamppost, createBannerFlag, createFlowerUrn, createFlowerBed, createEntranceGate,
  addLandmarks, addPathAmenities, addEdgeDressing, addLawnPlanting, addAmbientDetail,
} from './ParkDecor.js';

// The shared low-poly kit (geometry, materials, helpers) lives in ParkDecor so
// the trees, play garden and every decorative prop bake into the same batches.
// Decoration is instanced at the end by bakeAssets().
const ring = new THREE.RingGeometry(19, 21.4, 64);

const TREE_TYPES = ['Spreading live oak', 'Silver eucalyptus', 'Flowering tree', 'Sabal palm', 'Young umbrella tree', 'Golden broadleaf', 'Slender cedar',
  'Crape myrtle', 'Southern magnolia', 'Bald cypress', 'Slash pine', 'Red maple', 'Royal palm'];
const TREE_HEIGHT = [5.8, 7.2, 3.6, 6, 3.2, 5, 6.2, 3.4, 4.2, 6.4, 7.6, 4.8, 8.4];
const TREE_RADIUS = [3.8, 3.1, 3.1, 3.7, 3.1, 3.1, 1.7, 2.7, 3.2, 2.4, 2.5, 3.1, 3.4];
const BROADLEAF = [colors.dark, colors.silver, colors.blossom, null, colors.lime, colors.gold, null, null, null, null, null, colors.maple];
export const treeRadius = variant => TREE_RADIUS[variant];
export function createParkTree(variant) {
  const root = group(TREE_TYPES[variant]);
  const height = TREE_HEIGHT[variant];
  part(root, cylinder, variant === 12 ? colors.stone : colors.bark, [0, height / 2, 0], [variant === 12 ? .24 : .28, height, variant === 12 ? .24 : .28]);
  if (variant === 3 || variant === 12) {
    const fronds = variant === 12 ? 11 : 9, reach = variant === 12 ? 1.9 : 1.5;
    for (let i = 0; i < fronds; i++) {
      const angle = i * Math.PI * 2 / fronds;
      part(root, crown, i % 2 ? colors.leaf : colors.dark,
        [Math.sin(angle) * reach, height + .15, Math.cos(angle) * reach], [.48, .25, variant === 12 ? 2.6 : 2.1], [.16 + (variant === 12 ? .12 : 0), angle, 0]);
    }
    part(root, crown, colors.lime, [0, height + .4, 0], [.65, .65, .65]);
    if (variant === 12) part(root, cylinder, colors.lime, [0, height - .5, 0], [.3, 1, .3]);
  } else if (variant === 6) {
    for (let i = 0; i < 4; i++) part(root, cone, i % 2 ? colors.leaf : colors.dark,
      [0, 2.9 + i * 1.2, 0], [1.6 - i * .28, 2.9, 1.6 - i * .28]);
  } else if (variant === 9) { // bald cypress: buttressed trunk, olive-rust spire
    part(root, cone, colors.lime, [0, 3.7, 0], [1.9, 5.6, 1.9]);
    part(root, cone, colors.leaf, [0, 6.5, 0], [1.1, 2.2, 1.1]);
    part(root, cone, colors.bark, [0, .45, 0], [.7, .9, .7]);
  } else if (variant === 10) { // slash pine: bare trunk, flat tufted crown
    for (const [x, y, z, r] of [[0, height - .1, 0, 1.9], [1.3, height - 1.1, .5, 1.4], [-1.1, height - 1.5, -.6, 1.5]]) {
      part(root, crown, colors.dark, [x, y, z], [r, .5, r]);
      part(root, crown, colors.leaf, [x * .8, y + .3, z * .8], [r * .6, .3, r * .6]);
    }
  } else if (variant === 7) { // crape myrtle: three slim stems, summer blossom
    for (const [x, z, c] of [[0, 0, colors.rose], [-.7, .35, colors.blossom], [.65, -.3, colors.white]]) {
      part(root, box, colors.bark, [x * .6, 1.8, z * .6], [.08, 3.4, .08], [z * .15, 0, -x * .15]);
      part(root, crown, c, [x, 3.5, z], [1.0, .85, .95]);
      part(root, crown, colors.rose, [x * 1.3, 3.1, z * 1.3 + .2], [.55, .4, .5]);
    }
  } else if (variant === 8) { // southern magnolia: dense glossy crown, creamy blooms
    for (const [x, y, z, w] of [[0, 4, 0, 1.9], [-1.2, 3.4, .4, 1.4], [1.1, 3.5, -.5, 1.4]]) part(root, crown, colors.dark, [x, y, z], [w, w * .88, w * .95]);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      part(root, crown, colors.white, [Math.sin(a) * 1.7, 3.5 + (i % 3) * .5, Math.cos(a) * 1.5], [.2, .17, .2]);
    }
  } else {
    const material = BROADLEAF[variant];
    const width = variant === 0 ? 2.5 : variant === 1 ? 1.35 : variant === 11 ? 1.9 : 1.7;
    for (const [x, y, z] of [[0, .5, 0], [-1.25, -.35, .45], [1.2, 0, -.55], [.25, -.5, 1.3]]) {
      part(root, box, colors.bark, [x * .5, height - .8, z * .5], [.12, 2.1, .12], [z * .5, 0, -x * .5]);
      part(root, crown, material, [x, height + y, z], [width, variant === 1 ? 2 : 1.25, width * .86]);
    }
    if (variant === 11) part(root, crown, colors.orange, [.1, height + 1.1, .1], [.9, .7, .8]);
  }
  return root;
}

const PLANT_TYPES = ['Fern patch', 'Ornamental grass', 'Flowering shrub', 'Wildflower patch', 'Hydrangea shrub', 'Rose bush', 'Boxwood ball', 'Pollinator meadow'];
const PLANT_RADIUS = [1.2, 1.2, 1.2, 1.2, 1.5, 1.2, 1.1, 2.8];
export const plantRadius = variant => PLANT_RADIUS[variant];
export function createMeadowPlant(variant) {
  const root = group(PLANT_TYPES[variant]);
  if (variant === 0) {
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      part(root, crown, i % 2 ? colors.leaf : colors.dark, [Math.sin(a) * .5, .45, Math.cos(a) * .5], [.22, .14, .9], [-.3, a, 0]);
    }
  } else if (variant === 1) {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      part(root, cone, i % 2 ? colors.grass : colors.lime, [Math.sin(a) * .35, .55, Math.cos(a) * .35], [.11, .9 + i % 3 * .2, .11], [.2 * Math.cos(a), 0, .2 * Math.sin(a)]);
    }
  } else if (variant === 4) { // hydrangea: leafy mound, round pastel heads
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57, x = Math.sin(a) * .5, z = Math.cos(a) * .5;
      part(root, crown, colors.leaf, [x, .5, z], [.65, .45, .6]);
      part(root, crown, [colors.peri, colors.rose, colors.white, colors.peri][i], [x * 1.1, .95, z * 1.1], [.32, .28, .32]);
    }
  } else if (variant === 5) { // rose bush
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1, x = Math.sin(a) * .4, z = Math.cos(a) * .4;
      part(root, crown, colors.dark, [x, .5, z], [.5, .45, .5]);
      for (let j = 0; j < 2; j++) part(root, crown, [colors.rose, colors.red, colors.blossom][(i + j) % 3], [x + (j - .5) * .3, .85 + j * .1, z + .15], [.12, .1, .12]);
    }
  } else if (variant === 6) { // clipped boxwood ball
    part(root, crown, colors.dark, [0, .55, 0], [.75, .65, .75]);
    part(root, crown, colors.leaf, [0, 1.0, 0], [.5, .42, .5]);
  } else if (variant === 7) { // pollinator meadow: grass tufts and tall flower stems
    for (let i = 0; i < 4; i++) {
      const a = i * 2.4, r = .5 + (i % 4) * .55;
      part(root, cone, i % 2 ? colors.grass : colors.lime, [Math.sin(a) * r, .45, Math.cos(a) * r], [.12, .9 + i % 3 * .2, .12], [.15, 0, .15]);
    }
    for (let i = 0; i < 6; i++) {
      const a = i * 2.2 + .5, r = .3 + (i % 5) * .45, x = Math.sin(a) * r, z = Math.cos(a) * r, h = .8 + (i % 3) * .25;
      part(root, box, colors.dark, [x, h / 2, z], [.03, h, .03]);
      part(root, crown, flowerColors[i % 6], [x, h + .05, z], [.15, .12, .15]);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.4, x = Math.sin(a) * .6, z = Math.cos(a) * .6;
      part(root, crown, colors.leaf, [x, variant === 2 ? .55 : .17, z], [.55, variant === 2 ? .5 : .18, .5]);
      for (let j = 0; j < 2; j++) {
        part(root, box, colors.dark, [x + (j - 1) * .17, .4, z], [.025, .65, .025]);
        part(root, crown, (i + j) % 2 ? colors.gold : colors.blossom,
          [x + (j - 1) * .17, variant === 2 ? .94 : .75, z], [.14, .12, .14]);
      }
    }
  }
  return root;
}

function createPlayGarden() {
  const root = group('Central play garden');
  part(root, disk, colors.mulch, [0, .045, 0], [17.8, .09, 17.8]);
  part(root, ring, colors.path, [0, .055, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  // Two roofed towers linked by an open bridge, with contrasting slides.
  for (const x of [-4, 4]) {
    for (const dx of [-1.3, 1.3]) for (const z of [-2.3, .3]) {
      part(root, box, colors.wood, [x + dx, 1.9, z], [.2, 3.8, .2]);
    }
    part(root, box, colors.wood, [x, 2, -1], [3, .18, 3]);
    part(root, cone, x < 0 ? colors.teal : colors.coral, [x, 4.35, -1], [2.3, 1.5, 2.3], [0, Math.PI / 4, 0]);
    for (const side of [-1, 1]) {
      part(root, box, colors.teal, [x + side * 1.3, 2.65, -1], [.1, .1, 2.6]);
      for (let i = 0; i < 5; i++) part(root, box, colors.wood, [x + side * 1.3, 2.35, -2 + i * .5], [.07, .7, .07]);
    }
    // Slide runs toward the open front of the garden.
    const slope = -.38, length = 5.2;
    part(root, box, x < 0 ? colors.coral : colors.teal, [x, 1.07, 2.85], [1.2, .12, length], [slope, 0, 0]);
    for (const side of [-1, 1]) part(root, box, colors.gold, [x + side * .63, 1.23, 2.85], [.1, .32, length], [slope, 0, 0]);
    part(root, box, colors.wood, [x, 1, -3.7], [1.5, .15, 3.6], [.56, 0, 0]);
    for (let i = 0; i < 7; i++) part(root, box, colors.gold, [x, .2 + i * .27, -5.15 + i * .42], [1.6, .12, .2]);
  }
  part(root, box, colors.wood, [0, 2, -1], [5.5, .15, 1.5]);
  for (const z of [-1.75, -.25]) {
    part(root, box, colors.metal, [0, 2.9, z], [5.5, .1, .1]);
    for (let x = -2.5; x <= 2.5; x += .5) part(root, box, colors.wood, [x, 2.45, z], [.06, .9, .06]);
  }
  const swings = createSwingSet(); swings.position.set(-10, 0, 5); swings.rotation.y = -.35; root.add(swings);
  // Sandbox and stepping stones give the lawn smaller activity areas too.
  part(root, disk, colors.wood, [9, .12, 7], [3.5, .24, 3.5]);
  part(root, disk, colors.sand, [9, .25, 7], [3.15, .05, 3.15]);
  for (let i = 0; i < 7; i++) part(root, cylinder, i % 2 ? colors.teal : colors.coral,
    [-3 + i * 1.1, .25 + (i % 3) * .12, 10 + Math.sin(i) * .9], [.45, .5 + (i % 3) * .24, .45]);
  // Climbing bars at the rear.
  for (const x of [-2, 2]) for (const z of [-10, -7]) part(root, cylinder, colors.teal, [x, 1.4, z], [.09, 2.8, .09]);
  for (let x = -2; x <= 2; x += .5) part(root, cylinder, colors.gold, [x, 2.8, -8.5], [.045, 3.1, .045], [Math.PI / 2, 0, 0]);
  for (const x of [-2, 2]) for (let y = .4; y <= 2.8; y += .4) part(root, cylinder, colors.metal, [x, y, -8.5], [.045, 3, .045], [Math.PI / 2, 0, 0]);
  return root;
}

export function addParkCommons(scene, holes, colliders, established) {
  const assets = [], placements = [], occupied = [...established];
  const previewClear = (x, z, radius) => holes.every(h => {
    const path = h.previewPath || PREVIEW_PATHS[h.id];
    return !path || path.slice(1).every((b, i) => distanceToSegment(x, z, [path[i][0], path[i][2]], [b[0], b[2]]) > radius + 2);
  });
  // Overlap with other props is the cheap test, so it runs before the course.
  function clear(x, z, radius) {
    if (occupied.some(p => Math.hypot(x - p.x, z - p.z) < radius + p.radius + 1)) return false;
    return environmentClearance(x, z, radius, holes, colliders) && previewClear(x, z, radius);
  }
  // Thin or tiny details may share space with props but never with a lane.
  const clearLite = (x, z, radius) => environmentClearance(x, z, radius, holes, colliders) && previewClear(x, z, radius);
  const solid = (x, z, pad) => occupied.some(p => !p.tree && Math.hypot(x - p.x, z - p.z) < p.radius + pad);
  function place(asset, x, z, radius, rotation = 0, scale = 1, zone = 'Landscape grove', extra = {}) {
    if (!clear(x, z, radius)) return false;
    asset.position.set(x, 0, z); asset.rotation.y = rotation; asset.scale.setScalar(scale);
    assets.push(asset);
    const p = { name: asset.name, x, z, radius, zone, ...extra };
    if (asset.userData.parts) p.parts = [...asset.userData.parts];
    placements.push(p); occupied.push(p); return true;
  }
  // Deterministic ring search outward from an anchor for a clear site.
  function findSite(ax, az, radius, { min = 0, max = 120, step = 7 } = {}) {
    for (let d = min; d <= max; d += step) {
      const count = d === 0 ? 1 : Math.max(8, Math.round(Math.PI * 2 * d / step));
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2 + d * .37, x = ax + Math.sin(angle) * d, z = az + Math.cos(angle) * d;
        if (clear(x, z, radius)) return [x, z];
      }
    }
    return null;
  }
  const center = { x: 3, z: 28, radius: 21.5 };
  const ctx = {
    place, clear, clearLite, solid, findSite, noise, holes, center, assets, placements,
    createTree: createParkTree, createPlant: createMeadowPlant, treeRadius, plantRadius,
  };
  const playground = place(createPlayGarden(), center.x, center.z, center.radius, 0, 1, 'Central commons');
  if (playground) {
    // Seats face the play garden from the outside of its walking loop.
    for (const angle of [-1.2, .2, 1.65, 2.75]) {
      place(createBench(), center.x + Math.sin(angle) * 24.5, center.z + Math.cos(angle) * 24.5, 1.6, angle + Math.PI, 1, 'Central commons');
      for (const side of [-1, 1]) place(createFlowerUrn(), center.x + Math.sin(angle + side * .1) * 24.6, center.z + Math.cos(angle + side * .1) * 24.6, .65, angle, 1, 'Central commons');
    }
    place(createRoundPicnicTable(), -22, 14, 2, .2, 1, 'Central commons');
    place(createBin(), -19, 19, .7, 0, 1, 'Central commons');
    // Signs use their own texture, while all solid geometry joins the batches.
    place(createParkSign('PLAY GARDEN', 'TOCOBAGA PARK  /  COMMONS'), 3, 52.5, 1.9, 0, 1, 'Central commons');
    // Lamps, beds and banners complete the outside of the walking loop.
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2 + .2;
      place(createLamppost(i % 3), center.x + Math.sin(angle) * 29, center.z + Math.cos(angle) * 29, .55, angle, 1, 'Central commons');
    }
    for (let i = 0; i < 10; i++) {
      const angle = i / 10 * Math.PI * 2 + .55;
      place(createFlowerBed(i), center.x + Math.sin(angle) * 31.5, center.z + Math.cos(angle) * 31.5, 2.8, angle, 1, 'Central commons');
    }
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2 + .1;
      place(createBannerFlag(i), center.x + Math.sin(angle) * 36, center.z + Math.cos(angle) * 36, 1.15, angle + Math.PI / 2, 1, 'Central commons');
    }
  }
  // Big set pieces claim their ground first, then everything else grows around them.
  const landmarks = addLandmarks(ctx);
  const gate = (() => {
    const x = -67, z = COURSE_BOUNDS.maxZ - 8;
    return place(createEntranceGate(), x, z, 7, 0, 1, 'Entrance') ? { x, z } : null;
  })();
  ctx.gate = gate;
  const restStops = addPathAmenities(ctx);
  // Deterministic jitter avoids rows and makes reloads reproduce the planting.
  let index = 0;
  for (let x = COURSE_BOUNDS.minX + 12; x < COURSE_BOUNDS.maxX - 10; x += 14) {
    for (let z = COURSE_BOUNDS.minZ + 12; z < COURSE_BOUNDS.maxZ - 10; z += 14) {
      const seed = index++, px = x + (noise(seed) - .5) * 10, pz = z + (noise(seed + 900) - .5) * 10;
      // Keep broad meadow pockets between groves rather than carpet the park.
      const grove = Math.sin(px * .037) + Math.cos(pz * .029);
      if (grove < -.45 || noise(seed + 70) < .12) continue;
      const variant = Math.floor(noise(seed + 200) * TREE_TYPES.length), scale = .75 + noise(seed + 300) * .55;
      const radius = TREE_RADIUS[variant] * scale;
      if (!place(createParkTree(variant), px, pz, radius, noise(seed + 400) * 6.28, scale, 'Landscape grove', { tree: true })) continue;
      for (let j = 0; j < 2; j++) {
        const angle = noise(seed * 3 + j + 500) * Math.PI * 2, offset = radius + 2.8 + j * .7;
        const plantScale = .8 + noise(seed + j + 600) * .6, plant = (seed + j) % PLANT_TYPES.length;
        place(createMeadowPlant(plant), px + Math.sin(angle) * offset, pz + Math.cos(angle) * offset,
          PLANT_RADIUS[plant] * plantScale, angle, plantScale);
      }
    }
  }
  // Understory trees fill the gaps between the larger groves.
  const small = [7, 8, 2, 4, 11, 9];
  for (let x = COURSE_BOUNDS.minX + 19; x < COURSE_BOUNDS.maxX - 10; x += 14) {
    for (let z = COURSE_BOUNDS.minZ + 19; z < COURSE_BOUNDS.maxZ - 10; z += 14) {
      const seed = index++, px = x + (noise(seed) - .5) * 8, pz = z + (noise(seed + 900) - .5) * 8;
      if (noise(seed + 70) < .6) continue;
      const variant = small[Math.floor(noise(seed + 200) * small.length)], scale = .6 + noise(seed + 300) * .35;
      place(createParkTree(variant), px, pz, TREE_RADIUS[variant] * scale, noise(seed + 400) * 6.28, scale, 'Understory grove', { tree: true });
    }
  }
  // Flowering borders around the commons provide color at eye level.
  if (playground) for (let i = 0; i < 22; i++) {
    const angle = i / 22 * Math.PI * 2;
    place(createMeadowPlant(i % 2 ? 1 : 3), center.x + Math.sin(angle) * 25,
      center.z + Math.cos(angle) * 25, 1.2, angle, 1, 'Central commons');
  }
  addEdgeDressing(ctx);
  addLawnPlanting(ctx);
  const ambient = addAmbientDetail(ctx);
  const batches = bakeAssets(scene, assets, 'Park commons and varied planting');
  return { playground: playground ? center : null, placements, landmarks: Object.fromEntries(Object.entries(landmarks).map(([k, v]) => [k, v && { x: v.x, z: v.z }])),
    restStops, gate, ambient, batches };
}
