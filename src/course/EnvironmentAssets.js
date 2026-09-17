import * as THREE from 'three';
import { distanceToSegment, COURSE_BOUNDS, WATER } from './Layout.js';

// Decorative prefabs. One shared geometry/material per primitive; baked into
// spatially grouped instances below, rather than a draw call for each slat.
const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
const cone = new THREE.ConeGeometry(1, 1, 8);
const crown = new THREE.IcosahedronGeometry(1, 0);
const mat = color => new THREE.MeshStandardMaterial({ color, roughness: .9 });
const wood = mat(0x99714b), metal = mat(0x405d58), bark = mat(0x715135);
const leaf = mat(0x507647), lightLeaf = mat(0x70864e), pine = mat(0x365f46);
const seat = mat(0xbb9657);

function part(root, geometry, material, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
  root.add(mesh);
}
function prefab(name) {
  const root = new THREE.Group(); root.name = name; return root;
}

export function createBench() {
  const root = prefab('Slatted bench');
  for (const x of [-.95, .95]) {
    part(root, box, metal, [x, .36, 0], [.12, .72, .65]);
    part(root, box, metal, [x, .94, -.28], [.1, .9, .1]);
  }
  for (let i = 0; i < 3; i++) {
    part(root, box, wood, [0, .73, -.2 + i * .2], [2.5, .1, .17]);
    part(root, box, wood, [0, .99 + i * .17, -.3], [2.5, .14, .09]);
  }
  return root;
}

export function createGrill() {
  const root = prefab('Pedestal grill');
  part(root, cylinder, metal, [0, .48, 0], [.12, .96, .12]);
  part(root, box, metal, [0, .98, 0], [.95, .28, .65]);
  for (let i = 0; i < 6; i++) part(root, box, seat, [-.38 + i * .15, 1.13, 0], [.025, .025, .56]);
  part(root, box, wood, [.6, 1.02, 0], [.35, .07, .1]);
  return root;
}

export function createRoundPicnicTable() {
  const root = prefab('Round picnic table');
  part(root, cylinder, wood, [0, 1.03, 0], [1.05, .12, 1.05]);
  part(root, cylinder, metal, [0, .5, 0], [.16, 1, .16]);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, x = Math.sin(a) * 1.4, z = Math.cos(a) * 1.4;
    part(root, cylinder, wood, [x, .58, z], [.4, .12, .4]);
    part(root, cylinder, metal, [x, .27, z], [.1, .54, .1]);
    part(root, box, metal, [x / 2, .25, z / 2], [.08, .08, 1.5], [0, a, 0]);
  }
  return root;
}

export function createSwingSet() {
  const root = prefab('Two-seat swings');
  for (const x of [-2.4, 2.4]) for (const side of [-1, 1]) {
    part(root, box, metal, [x, 1.55, side * .65], [.14, 3.4, .14], [-side * .4, 0, 0]);
  }
  part(root, box, seat, [0, 3.12, 0], [5.2, .2, .2]);
  for (const x of [-1.1, 1.1]) {
    for (const side of [-1, 1]) part(root, cylinder, metal, [x + side * .34, 1.94, 0], [.018, 2.25, .018]);
    part(root, box, wood, [x, .8, 0], [.82, .09, .38]);
  }
  return root;
}

export function createShrub(variant = 0) {
  const root = prefab(variant ? 'Silver scrub cluster' : 'Low native shrub');
  for (let i = 0; i < 3; i++) {
    part(root, crown, variant ? lightLeaf : leaf, [(i - 1) * .6, .45 + (i % 2) * .2, (i % 2) * .3],
      [variant ? .55 : .8, variant ? .75 : .5, .65]);
  }
  return root;
}

export function createLandscapeTree(variant = 0) {
  const root = prefab(['Layered pine', 'Broad shade oak', 'Column cypress'][variant]);
  part(root, cylinder, bark, [0, 2.3, 0], [.24, 4.6, .24]);
  if (variant === 0) {
    for (let i = 0; i < 3; i++) part(root, cone, pine, [0, 3.5 + i * 1.1, 0], [2 - i * .4, 2.8, 2 - i * .4]);
  } else if (variant === 1) {
    for (const [x, y, z] of [[0, 4.8, 0], [-1.4, 4.2, .2], [1.3, 4.5, -.3]]) {
      part(root, crown, leaf, [x, y, z], [1.9, 1.5, 1.65]);
    }
  } else {
    part(root, crown, lightLeaf, [0, 4.5, 0], [1.1, 2.4, 1.1]);
    part(root, crown, leaf, [.5, 3.5, .3], [.8, 1.8, .8]);
  }
  return root;
}

// Placement radii cover the entire prefab, not just its origin. These props
// intentionally have no collision: keep them beyond every playable corridor.
export function environmentClearance(x, z, radius, holes, colliders) {
  if (x - radius < COURSE_BOUNDS.minX || x + radius > COURSE_BOUNDS.maxX ||
      z - radius < COURSE_BOUNDS.minZ || z + radius > COURSE_BOUNDS.maxZ) return false;
  if (WATER.some(p => Math.hypot(x - p.x, z - p.z) < p.radius + radius + 3)) return false;
  if (colliders.some(c => Math.hypot(x - (c.x ?? c.center.x), z - (c.z ?? c.center.z)) < radius + (c.canopyRadius ?? 3) + 1)) return false;
  return holes.every((h, i) => {
    if (Math.hypot(x - h.tee.x, z - h.tee.z) < radius + 12 || Math.hypot(x - h.basket.x, z - h.basket.z) < radius + 12) return false;
    const next = holes[(i + 1) % holes.length];
    if (distanceToSegment(x, z, [h.basket.x, h.basket.z], [next.tee.x, next.tee.z]) < radius + 3) return false;
    return [h.route, h.alternate].filter(Boolean).every(path => path.slice(1).every((b, j) =>
      distanceToSegment(x, z, path[j], b) > h.width + radius + 6));
  });
}

export function addEnvironmentDetails(scene, holes, colliders) {
  const placements = [], batches = [];
  const zones = [
    { name: 'Pavilion picnic lawn', x: -15, z: 218, theme: 'picnic', tree: 1 },
    { name: 'Family play lawn', x: -61, z: 204, theme: 'play', tree: 1 },
    { name: 'Pine trail rest', x: -103, z: 152, theme: 'trail', tree: 0 },
    { name: 'Meadow picnic grove', x: 12, z: -82, theme: 'picnic', tree: 1 },
    { name: 'Cypress overlook', x: 97, z: 34, theme: 'trail', tree: 2 },
  ];
  for (const zone of zones) {
    const parts = new Map();
    function place(asset, dx, dz, radius, rotation = 0) {
      const x = zone.x + dx, z = zone.z + dz;
      if (!environmentClearance(x, z, radius, holes, colliders) || placements.some(p => Math.hypot(x - p.x, z - p.z) < radius + p.radius + .8)) return;
      asset.position.set(x, 0, z); asset.rotation.y = rotation; asset.updateMatrixWorld(true);
      placements.push({ name: asset.name, zone: zone.name, x, z, radius });
      asset.traverse(mesh => {
        if (!mesh.isMesh) return;
        const key = `${mesh.geometry.uuid}/${mesh.material.uuid}`;
        if (!parts.has(key)) parts.set(key, { geometry: mesh.geometry, material: mesh.material, matrices: [] });
        parts.get(key).matrices.push(mesh.matrixWorld.clone());
      });
    }
    if (zone.theme === 'play') place(createSwingSet(), 0, 0, 3.5);
    if (zone.theme === 'picnic') {
      place(createRoundPicnicTable(), 0, 0, 2);
      place(createRoundPicnicTable(), 7, 3, 2, .3);
      place(createGrill(), -5, 3, .9);
    }
    // Benches face the activity rather than away from it.
    place(createBench(), -5, -4, 1.5, -.3);
    place(createBench(), 5, -4, 1.5, .3);
    const planting = [[-10, -8], [-5, -10], [1, -9], [7, -7], [11, -3]];
    planting.forEach(([dx, dz], i) => {
      place(createShrub(i % 2), dx, dz, 1.7, i * .8);
    });
    for (const [i, [dx, dz]] of [[-12, 10], [-2, 14], [10, 9]].entries()) {
      place(createLandscapeTree(zone.tree), dx, dz, 3.5, i * 1.3);
    }
    for (const { geometry, material, matrices } of parts.values()) {
      const batch = new THREE.InstancedMesh(geometry, material, matrices.length);
      batch.name = `Park details / ${zone.name}`;
      matrices.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
      batch.instanceMatrix.needsUpdate = true;
      batch.castShadow = true; batch.receiveShadow = true;
      batch.computeBoundingSphere();
      scene.add(batch); batches.push(batch);
    }
  }
  return { placements, batches };
}
