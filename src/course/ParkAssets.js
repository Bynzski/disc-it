import * as THREE from 'three';

// Reusable, ground-anchored park props. Share geometry/materials across instances.
// Furniture is decorative in this pass; tree and boulder obstacles have colliders.
const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
const foliage = new THREE.IcosahedronGeometry(1, 1);
const cone = new THREE.ConeGeometry(1, 1, 12);
const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...options });
const palette = {
  wood: material(0x99714b), end: material(0x715135),
  steel: material(0x334e4a, { metalness: 0.35, roughness: 0.55 }),
  roof: material(0x526963, { metalness: 0.2 }),
  stone: material(0xbcb39d), soil: material(0x514231),
  leaves: material(0x587342), pine: material(0x365f46), pineLight: material(0x477653),
  cream: material(0xeee2bd), flowers: material(0xe8bb63),
};
const labelCache = new Map();

function part(parent, geo, mat, position, size, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...position);
  mesh.scale.set(...size);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function group(name) {
  const result = new THREE.Group();
  result.name = name;
  result.userData.decorative = true;
  return result;
}

export function placeAsset(scene, asset, x, z, rotation = 0, scale = 1) {
  asset.position.set(x, 0, z);
  asset.rotation.y = rotation;
  asset.scale.setScalar(scale);
  scene.add(asset);
  return asset;
}

export function createPicnicTable() {
  const root = group('Picnic table');
  for (let i = 0; i < 5; i++) {
    part(root, box, palette.wood, [0, 1.12, (i - 2) * 0.23], [3.2, 0.12, 0.21]);
  }
  for (const side of [-1, 1]) {
    part(root, box, palette.wood, [0, 0.62, side * 0.93], [3.2, 0.13, 0.4]);
    for (const x of [-1.05, 1.05]) {
      part(root, box, palette.steel, [x, 0.52, side * 0.49], [0.12, 1.1, 0.12], [side * -0.45, 0, 0]);
    }
  }
  for (const x of [-1.05, 1.05]) {
    part(root, box, palette.steel, [x, 0.49, 0], [0.12, 0.1, 2.18]);
  }
  return root;
}

export function createShelter() {
  const root = group('Picnic shelter');
  part(root, box, palette.stone, [0, 0.055, 0], [10, 0.11, 7]);
  for (const x of [-4, 4]) for (const z of [-2.5, 2.5]) {
    part(root, box, palette.end, [x, 1.95, z], [0.22, 3.9, 0.22]);
    part(root, box, palette.stone, [x, 0.2, z], [0.46, 0.3, 0.46]);
  }
  for (const z of [-2.5, 2.5]) part(root, box, palette.wood, [0, 3.6, z], [8.6, 0.3, 0.2]);
  for (const x of [-4, 0, 4]) {
    part(root, box, palette.wood, [x, 3.68, 0], [0.16, 0.2, 5.4]);
  }
  // Two roof planes meet along a raised ridge (no imported model required).
  for (const side of [-1, 1]) {
    part(root, box, palette.roof, [0, 4.15, side * 1.65], [10, 0.15, 3.62], [side * 0.35, 0, 0]);
  }
  for (const x of [-2.5, 2.5]) {
    const table = createPicnicTable(); table.position.set(x, 0.12, 0); root.add(table);
  }
  return root;
}

export function createBin() {
  const root = group('Park litter bin');
  part(root, cylinder, palette.steel, [0, 0.59, 0], [0.39, 1.18, 0.39]);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    part(root, box, palette.wood, [Math.sin(a) * 0.39, 0.56, Math.cos(a) * 0.39], [0.1, 0.9, 0.065], [0, a, 0]);
  }
  part(root, cylinder, palette.steel, [0, 1.2, 0], [0.46, 0.1, 0.46]);
  part(root, box, palette.soil, [0, 1.257, 0], [0.44, 0.01, 0.18]);
  return root;
}

export function createPlanter() {
  const root = group('Native planting bed');
  part(root, box, palette.soil, [0, 0.07, 0], [5, 0.14, 2.5]);
  for (const z of [-1.3, 1.3]) part(root, box, palette.stone, [0, 0.14, z], [5.4, 0.28, 0.18]);
  for (const x of [-2.6, 2.6]) part(root, box, palette.stone, [x, 0.14, 0], [0.18, 0.28, 2.5]);
  for (let i = 0; i < 8; i++) {
    const x = (i % 4) * 1.2 - 1.8, z = i < 4 ? -0.6 : 0.6;
    part(root, foliage, palette.leaves, [x, 0.39, z], [0.65, 0.4 + i % 3 * 0.07, 0.6]);
    for (let j = 0; j < 3; j++) {
      part(root, foliage, palette.flowers, [x + (j - 1) * 0.2, 0.72 + i % 3 * 0.07, z + (j % 2) * 0.18], [0.1, 0.09, 0.1]);
    }
  }
  return root;
}

export function createParkSign(title, subtitle) {
  const root = group('Park information sign');
  const key = `${title}/${subtitle}`;
  if (!labelCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#284c3b'; ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = '#d9c59a'; ctx.lineWidth = 8; ctx.strokeRect(22, 22, 980, 468);
    ctx.textAlign = 'center'; ctx.fillStyle = '#f6e8c6';
    ctx.font = 'bold 70px sans-serif'; ctx.fillText(title, 512, 205, 920);
    ctx.font = '34px sans-serif'; ctx.fillText(subtitle, 512, 300, 920);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    labelCache.set(key, new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
  }
  for (const x of [-1.15, 1.15]) part(root, box, palette.end, [x, 1.2, 0], [0.14, 2.4, 0.14]);
  part(root, box, palette.wood, [0, 2.05, 0], [3.3, 1.7, 0.16]);
  part(root, new THREE.PlaneGeometry(3.15, 1.55), labelCache.get(key), [0, 2.05, 0.086], [1, 1, 1]);
  return root;
}

export function addPine(scene, colliders, x, z, scale = 1) {
  const root = group('Evergreen pine');
  root.userData.decorative = false;
  part(root, cylinder, palette.end, [0, 2.1, 0], [0.22, 4.2, 0.22]);
  for (let i = 0; i < 4; i++) {
    const radius = 2 - i * 0.36;
    part(root, cone, i % 2 ? palette.pineLight : palette.pine, [0, 3.3 + i * 1.05, 0], [radius, 3, radius]);
  }
  placeAsset(scene, root, x, z, 0, scale);
  colliders.push({ kind: 'tree', x, z, trunkRadius: 0.22 * scale, canopyRadius: 1.6 * scale, trunkHeight: 4.2 * scale, height: 8 * scale });
  return root;
}
