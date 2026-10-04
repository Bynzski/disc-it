import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeBasket } from './Basket.js';
import { planCedarForest, makePlayField } from './CedarForest.js';

export const CEDAR_BOUNDS = { minX: -190, maxX: 190, minZ: -200, maxZ: 200 };
const peaks = [
  [-125, -125, 18, 48], [-42, -20, 13, 54], [78, 58, 19, 58], [142, -82, 14, 46],
  [-148, 94, 15, 48], [12, 146, 12, 40], [-72, 158, 10, 36], [165, 120, 11, 34],
];

export function cedarHeight(x, z) {
  let y = 4 + .012 * z;
  for (const [px, pz, height, radius] of peaks) y += height * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (radius * radius));
  return y + 1.1 * Math.sin(x * .035) * Math.cos(z * .028) + .4 * Math.sin((x + z) * .07);
}

function normalAt(x, z) {
  const e = .5;
  return new THREE.Vector3(cedarHeight(x - e, z) - cedarHeight(x + e, z), 2 * e, cedarHeight(x, z - e) - cedarHeight(x, z + e)).normalize();
}

function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

const holeInfo = [
  [1, 'Mosslight', 3, 'Open with a quiet line through the first cedar stands.'],
  [2, 'Cedar Switchback', 3, 'A narrow reversal through layered trunks.'],
  [3, "Raven's Needle", 3, 'Thread the low branches and settle near the old pine.'],
  [4, 'Hollow Creek', 4, 'Carry the fern-lined hollow and find the hidden shelf.'],
  [5, 'Fernway', 3, 'A patient downhill lane through bright green understory.'],
  [6, 'Pine Cathedral', 4, 'The tall grove frames a demanding uphill approach.'],
  [7, 'Green Shadow', 3, 'A cool tunnel opens onto a protected basket.'],
  [8, 'Root Cellar', 3, 'Stay below the root shelf and find the short landing.'],
  [9, 'Canopy Crossing', 4, 'A braided corridor tests distance before the carry.'],
  [10, 'Moonlit Trunk', 4, 'A rolling climb through widely spaced old growth.'],
  [11, 'Deer Run', 3, 'Follow the game trail and bend around the fallen oak.'],
  [12, 'Mistline', 4, 'A high ridge catches the last light above the hollow.'],
  [13, 'Granite Gate', 3, 'Thread the mossy stone gate and favor the inside line.'],
  [14, 'Foxglove', 3, 'A quick forest turn rewards a clean release.'],
  [15, 'Mossback', 4, 'Play the uphill shelf before the ridge drops away.'],
  [16, 'Lantern Bend', 3, 'The trail bends beneath a bright stand of hemlocks.'],
  [17, 'Old-growth', 3, 'A narrow final walk between monumental trunks.'],
  [18, 'Cedar Crown', 4, 'Finish above the forest with a full downhill release.'],
];

function ringPoint(angle, scale, offset = 0) {
  const x = Math.cos(angle) * 160 * scale;
  const z = Math.sin(angle) * 170 * scale;
  const tx = -Math.sin(angle) * 160, tz = Math.cos(angle) * 170;
  const length = Math.hypot(tx, tz);
  return [x - tz / length * offset, z + tx / length * offset];
}

function routeFor(index) {
  const start = -Math.PI / 2 + index * Math.PI * 2 / 18;
  const span = .235 + (index % 3) * .012;
  const dogleg = index % 2 ? 1 : -1;
  return [
    ringPoint(start, 1.08),
    ringPoint(start + .07, 1.01, dogleg * 5),
    ringPoint(start + span - .07, .94, -dogleg * 4),
    ringPoint(start + span, .98),
  ];
}

function previewFor(route) {
  const points = route.slice(0, -1).map(([x, z], i) => [x, cedarHeight(x, z) + 18 + (i === 1 ? 2 : 0), z]);
  const a = route.at(-2), b = route.at(-1), basketY = cedarHeight(b[0], b[1]);
  for (const [t, clearance, pinClearance] of [[.55, 13, 9], [.78, 10, 7]]) {
    const x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[1], b[1], t);
    points.push([x, Math.max(cedarHeight(x, z) + clearance, basketY + pinClearance), z]);
  }
  return points;
}

export const CEDAR_HOLES = holeInfo.map(([id, name, par, note], index) => {
  const route = routeFor(index);
  return {
    id, name, par, note, route, width: id > 9 ? 6 : 7,
    lengthFeet: Math.round(route.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - route[i][0], point[1] - route[i][1]), 0) * 3.05),
    previewPath: previewFor(route),
  };
});

const DOGLEG_GUARDS = [
  { holeId: 1, rock: [27.4, -167.4], tree: [26.29, -168.06] },
  { holeId: 2, rock: [71.7, -157.5], tree: [71.83, -157.28] },
  { holeId: 3, rock: [124.1, -106.7], tree: [123.57, -108.01] },
  { holeId: 4, rock: [149.9, -72.2], tree: [149.94, -72.27] },
  { holeId: 5, rock: [159.9, 1], tree: [160.25, -.24] },
  { holeId: 6, rock: [159, 47.2], tree: [158.46, 47.89] },
  { holeId: 7, rock: [123.2, 108.6], tree: [124.2, 107.99] },
  { holeId: 8, rock: [92.6, 144.7], tree: [92.28, 144.73] },
  { holeId: 9, rock: [25.4, 167.6], tree: [26.7, 167.77] },
  { holeId: 10, rock: [-16.7, 173.7], tree: [-16.79, 173.67] },
  { holeId: 11, rock: [-81, 146.3], tree: [-79.93, 147.57] },
  { holeId: 12, rock: [-118.1, 122.3], tree: [-118.43, 121.42] },
  { holeId: 13, rock: [-150.1, 58.5], tree: [-150.13, 59.84] },
  { holeId: 14, rock: [-164.4, 13.5], tree: [-164.11, 12.55] },
  { holeId: 15, rock: [-149.4, -60.3], tree: [-150.66, -58.55] },
  { holeId: 16, rock: [-133.7, -101.9], tree: [-133.52, -102.06] },
  { holeId: 17, rock: [-79.4, -147.5], tree: [-81.18, -147.15] },
  { holeId: 18, rock: [-40.3, -169.8], tree: [-38.85, -169.56] },
];

export function cedarSurfaceHeight(x, z) {
  const terrain = cedarHeight(x, z);
  const onFairway = CEDAR_HOLES.some(h => h.route.slice(1).some((point, i) => segmentDistance(x, z, h.route[i], point) <= h.width * .5));
  let surface = terrain + (onFairway ? .08 : 0);
  for (const h of CEDAR_HOLES) {
    const [bx, bz] = h.route.at(-1), dx = (x - bx) / 4.5, dz = (z - bz) / 4, q = 1 - dx * dx - dz * dz;
    if (q > 0) {
      const center = cedarHeight(bx, bz) - .72;
      surface = Math.max(surface, center + .8 * Math.sqrt(q));
    }
  }
  return surface;
}

// Same tee / basket / fairway clearance the course uses; exported for tests.
export const cedarPlayField = makePlayField(CEDAR_HOLES);
export const clearOfCedarPlay = (x, z, radius = 2) => x - radius >= CEDAR_BOUNDS.minX && x + radius <= CEDAR_BOUNDS.maxX && z - radius >= CEDAR_BOUNDS.minZ && z + radius <= CEDAR_BOUNDS.maxZ && cedarPlayField.clearance(x, z) > radius;
const GROUND = { minX: -200, maxX: 200, minZ: -210, maxZ: 210 };

const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...options });
const palette = {
  path: material(0x76563a), pathLight: material(0x967451), bark: material(0x4b3328), wood: material(0x765139),
  rock: material(0x4e5a4c), rockLight: material(0x74806a), flag: material(0xe5ad3d, { side: THREE.DoubleSide }),
  ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
};
const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
const flagShape = new THREE.Shape();
flagShape.moveTo(0, 0); flagShape.lineTo(1.25, -.2); flagShape.lineTo(0, -.55); flagShape.closePath();
const flagGeometry = new THREE.ShapeGeometry(flagShape);

// Collects many small matrices into one InstancedMesh (one draw call).
function instanced(scene, name, geometry, mat, matrices, { cast = true } = {}) {
  if (!matrices.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length); mesh.name = name;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = cast; mesh.receiveShadow = true; mesh.userData.decorative = true;
  mesh.computeBoundingSphere(); scene.add(mesh); return mesh;
}
const _o = new THREE.Object3D();
function matrixOf(x, y, z, sx, sy, sz, ry = 0) { _o.position.set(x, y, z); _o.rotation.set(0, ry, 0); _o.scale.set(sx, sy, sz); _o.updateMatrix(); return _o.matrix.clone(); }

// Canopy kits: radius / height of each authored tree, used to fit it to a collider.
const CANOPY_KITS = { cedar: [3.6, 17], fir: [2.7, 22], spruce: [2.1, 15], hemlock: [2.7, 14] };
const canopyKit = n => { const v = (Math.sin(n * 12.9898 + 4.1) * 43758.5453) % 1, f = v < 0 ? v + 1 : v; return f < .34 ? 'cedar' : f < .6 ? 'fir' : f < .8 ? 'spruce' : 'hemlock'; };

function addForestDressing(forest, colliders) {
  const { batcher } = forest, placements = [], occupied = [];
  const add = (zone, type, kit, x, z, radius, rotation = 0, scale = 1) => {
    if (!clearOfCedarPlay(x, z, radius) || occupied.some(p => Math.hypot(x - p.x, z - p.z) < radius + p.radius)) return;
    batcher.add(kit, x, cedarHeight(x, z), z, rotation, scale);
    occupied.push({ x, z, radius });
    placements.push({ zone, type, name: kit, x, z, radius });
  };
  add('Trailhead clearing', 'kiosk', 'kiosk', -24, -191, 4.4, .12);
  add('Trailhead clearing', 'bench', 'bench', 25, -191, 1.6, -.3);
  add('Trailhead clearing', 'bin', 'bin', 38, -181, .8, 0);
  add('Cedar grove', 'bench', 'bench', 183, 12, 1.6, -.45);
  add('Cedar grove', 'fern', 'fern', 187, 27, 1, 0, .8);
  add('Fern hollow', 'stump', 'stump', -36, 191, 1.2, 0, .9);
  add('Fern hollow', 'log', 'logNurse', -55, 188, 2.4, .2, .9);
  add('Fern hollow', 'fern', 'fernDeep', -19, 184, 1, 0, .85);
  add('Ravens rest', 'bench', 'bench', -186, 62, 1.6, .45);
  add('Ravens rest', 'bin', 'bin', -179, 75, .8, 0);
  add('Old growth', 'stump', 'stumpTall', 20, 185, 1.2, 0, 1.05);
  add('Old growth', 'fern', 'fern', 34, 181, 1, 0, .9);
  add('Pine cathedral', 'log', 'logRoot', 92, 157, 2.4, -.3, 1.1);
  add('Pine cathedral', 'fern', 'fernDeep', 105, 151, 1, 0, .8);
  return { placements, occupied };
}

function addDoglegGuards(forest, colliders, occupied, placements) {
  const { batcher } = forest;
  // The visible boulder is authored at radii (1.7, 1.4, 1.5) and centred .42 of its height up.
  const boulder = (x, z, size, yaw, tint) => batcher.add('boulder', x, cedarHeight(x, z) + size[1] * .03, z, yaw, [size[0] / 1.7, size[1] / 1.4, size[2] / 1.5], tint);
  for (const guard of DOGLEG_GUARDS) {
    const [x, z] = guard.rock;
    if (!clearOfCedarPlay(x, z, 2.5)) continue;
    const size = guard.holeId % 2 ? [2.7, 1.9, 2.4] : [2.5, 1.7, 2.2];
    boulder(x, z, size, guard.holeId * .37, guard.holeId % 2 ? 1.12 : .95);
    colliders.push({ kind: 'rock', role: 'shortcut-guard', holeId: guard.holeId, center: new THREE.Vector3(x, cedarHeight(x, z) + size[1] * .45, z), radii: new THREE.Vector3(...size) });
    occupied.push({ x, z, radius: 2.7 });
    placements.push({ zone: `Dogleg guard / Hole ${guard.holeId}`, type: 'guard-rock', x, z, radius: 2.7 });
    const companionX = x + (guard.holeId % 2 ? 2.1 : -2.1), companionZ = z + (guard.holeId % 3 ? 1.2 : -1.2);
    if (clearOfCedarPlay(companionX, companionZ, 1.2)) {
      boulder(companionX, companionZ, [1.35, 1, 1.2], guard.holeId * .61, .9);
      occupied.push({ x: companionX, z: companionZ, radius: 1.35 });
      placements.push({ zone: `Dogleg guard / Hole ${guard.holeId}`, type: 'guard-stone', x: companionX, z: companionZ, radius: 1.35 });
    }
  }
}

function addForestCanopy(forest, colliders, placements, occupied, guardTrees) {
  const { batcher } = forest;
  let seed = 712367;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let index = 0;
  const addTree = (x, z, scale = 1, options = {}) => {
    const guard = options.guard === true;
    if (!clearOfCedarPlay(x, z, guard ? 3.1 : 3.1 * scale) || (!options.force && (forest.blocksTree(x, z, 3) || occupied.some(p => Math.hypot(x - p.x, z - p.z) < p.radius + 4.5 * scale)))) return false;
    const y = cedarHeight(x, z), height = guard ? 17 : (9 + random() * 7) * scale, radius = guard ? 2.15 : (1.45 + random() * 1.15) * scale;
    const rotation = random() * Math.PI * 2, tint = .86 + random() * .24;
    const kit = guard ? 'fir' : canopyKit(index++), [kr, kh] = CANOPY_KITS[kit];
    batcher.add(kit, x, y - .1, z, rotation, [radius / kr, height / kh, radius / kr], tint);
    colliders.push({ kind: 'tree', x, z, baseY: y, trunkRadius: .28 * scale, canopyRadius: radius, canopyBottom: guard ? 2.4 : height * .24, height, trunkHeight: height * .68, role: options.role || 'forest-canopy', holeId: options.holeId });
    occupied.push({ x, z, radius: radius * 1.1 });
    placements.push({ zone: options.role === 'shortcut-guard' ? `Dogleg guard / Hole ${options.holeId}` : 'Old-growth canopy', type: options.role === 'shortcut-guard' ? 'guard-conifer' : 'conifer', x, z, radius });
    return true;
  };
  for (const guard of guardTrees) addTree(guard.tree[0], guard.tree[1], 1, { guard: true, force: true, role: 'shortcut-guard', holeId: guard.holeId });
  for (const [x, z, scale] of [[-165, -158, 1.15], [-148, -172, .9], [-120, -168, 1.05], [168, 40, 1.1], [176, 66, .9], [-178, 120, 1], [155, 170, 1.05], [38, 181, .9], [-38, -181, 1.1], [74, -178, .9]]) addTree(x, z, scale);
  let count = 10 + guardTrees.length;
  for (let attempt = 0; attempt < 3200 && count < 430; attempt++) {
    const x = CEDAR_BOUNDS.minX + 5 + random() * (CEDAR_BOUNDS.maxX - CEDAR_BOUNDS.minX - 10);
    const z = CEDAR_BOUNDS.minZ + 5 + random() * (CEDAR_BOUNDS.maxZ - CEDAR_BOUNDS.minZ - 10);
    if (!clearOfCedarPlay(x, z, 3.1)) continue;
    if (placements.some(p => p.zone === 'Old-growth canopy' && Math.hypot(x - p.x, z - p.z) < 4.2)) continue;
    if (addTree(x, z, .75 + random() * .65)) count++;
  }
}

// A terrain-hugging strip along a leg of the route (geometry only, merged by caller).
function terrainRibbon(a, b, width, lift = .13) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
  const steps = Math.max(5, Math.ceil(length / 3)), vertices = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, cx = THREE.MathUtils.lerp(a[0], b[0], t), cz = THREE.MathUtils.lerp(a[1], b[1], t);
    for (const side of [-1, 1]) {
      const x = cx + nx * width * .5 * side, z = cz + nz * width * .5 * side;
      vertices.push(x, cedarHeight(x, z) + lift, z);
    }
  }
  for (let i = 0; i < steps; i++) { const p = i * 2, q = p + 1, r = p + 2, s = p + 3; indices.push(p, q, r, q, s, r); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// One canvas atlas holds every tee sign label; the labels merge into a single draw.
function addHoleSigns(scene, holes) {
  const cols = 4, rows = Math.ceil(holes.length / cols), cell = [512, 256];
  const canvas = document.createElement('canvas'); canvas.width = cell[0] * cols; canvas.height = cell[1] * rows;
  const ctx = canvas.getContext('2d');
  holes.forEach((h, i) => {
    const ox = (i % cols) * cell[0], oy = Math.floor(i / cols) * cell[1];
    ctx.fillStyle = '#284c3b'; ctx.fillRect(ox, oy, cell[0], cell[1]);
    ctx.strokeStyle = '#d9c59a'; ctx.lineWidth = 4; ctx.strokeRect(ox + 11, oy + 11, cell[0] - 22, cell[1] - 22);
    ctx.textAlign = 'center'; ctx.fillStyle = '#f6e8c6';
    ctx.font = 'bold 42px sans-serif'; ctx.fillText(`${h.id}  ${h.name}`, ox + 256, oy + 112, 470);
    ctx.font = '23px sans-serif'; ctx.fillText(`PAR ${h.par} / ${h.lengthFeet} FT`, ox + 256, oy + 168, 470);
  });
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const labels = [], posts = [], boards = [], m = new THREE.Matrix4(), rotation = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  holes.forEach((h, i) => {
    const a = h.route[0], b = h.route[1], angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const x = a[0] + Math.cos(angle) * 5, z = a[1] - Math.sin(angle) * 5, y = cedarHeight(x, z), yaw = angle + Math.PI;
    rotation.setFromAxisAngle(up, yaw);
    const frame = (px, py, pz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z).add(new THREE.Vector3(px, py, pz).applyQuaternion(rotation)), rotation, new THREE.Vector3(sx, sy, sz));
    for (const px of [-1.15, 1.15]) posts.push(frame(px, 1.2, 0, .14, 2.4, .14));
    boards.push(frame(0, 2.05, 0, 3.3, 1.7, .16));
    const plane = new THREE.PlaneGeometry(3.15, 1.55), uv = plane.attributes.uv, col = i % cols, row = Math.floor(i / cols);
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (col + uv.getX(k)) / cols, 1 - (row + 1 - uv.getY(k)) / rows);
    m.copy(frame(0, 2.05, .086, 1, 1, 1)); plane.applyMatrix4(m); labels.push(plane);
  });
  const geometry = mergeGeometries(labels, false), mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
  mesh.name = 'Cedar hole sign labels'; mesh.receiveShadow = true; mesh.userData.decorative = true; scene.add(mesh);
  const box = new THREE.BoxGeometry(1, 1, 1);
  instanced(scene, 'Cedar sign posts', box, palette.bark, posts); instanced(scene, 'Cedar sign boards', box, palette.wood, boards);
}

export function buildCedarCourse(scene) {
  const colliders = [], baskets = [];
  const world = { height: cedarHeight, normalAt, holes: CEDAR_HOLES, ground: GROUND };
  const forest = planCedarForest(scene, world);
  const groundGeometry = new THREE.PlaneGeometry(400, 420, 120, 126); groundGeometry.rotateX(-Math.PI / 2);
  const positions = groundGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, cedarHeight(positions.getX(i), positions.getZ(i)));
  groundGeometry.computeVertexNormals(); forest.paintGround(groundGeometry);
  const ground = new THREE.Mesh(groundGeometry, palette.ground); ground.receiveShadow = true; ground.name = 'Cedar ground'; scene.add(ground);
  const dressing = addForestDressing(forest, colliders);
  addDoglegGuards(forest, colliders, dressing.occupied, dressing.placements);
  addForestCanopy(forest, colliders, dressing.placements, dressing.occupied, DOGLEG_GUARDS);
  const holes = CEDAR_HOLES.map(data => ({
    ...data,
    tee: new THREE.Vector3(data.route[0][0], cedarSurfaceHeight(...data.route[0]) + .08, data.route[0][1]),
    basket: new THREE.Vector3(data.route.at(-1)[0], cedarSurfaceHeight(...data.route.at(-1)), data.route.at(-1)[1]),
    aimPoint: new THREE.Vector3(data.route[1][0], cedarHeight(...data.route[1]), data.route[1][1]),
  }));
  const ribbons = [], ribbonLight = [], pads = [], markers = [], shelves = [], poles = [], flags = [];
  const markerGeometry = new THREE.CylinderGeometry(.18, .24, .7, 7), padGeometry = new THREE.CylinderGeometry(1, 1, .12, 16), poleGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  for (const h of holes) {
    for (let i = 1; i < h.route.length; i++) {
      ribbons.push(terrainRibbon(h.route[i - 1], h.route[i], h.width, .12));
      ribbonLight.push(terrainRibbon(h.route[i - 1], h.route[i], h.width * .3, .15));
    }
    const a = h.route[0], b = h.route[1], angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
    pads.push(matrixOf(a[0], cedarHeight(a[0], a[1]) + .08, a[1], 2.1, .12, 2.8, angle));
    for (const side of [-1, 1]) {
      const mx = a[0] + Math.cos(angle) * 2.8 * side, mz = a[1] - Math.sin(angle) * 2.8 * side;
      markers.push(matrixOf(mx, cedarHeight(mx, mz) + .35, mz, 1, 1, 1));
    }
    const p = h.basket;
    shelves.push(matrixOf(p.x, p.y - .8, p.z, 4.5, .8, 4, h.id * .61));
    colliders.push({ kind: 'rock', role: 'basket-shelf', center: new THREE.Vector3(p.x, p.y - .8, p.z), radii: new THREE.Vector3(4.5, .8, 4) });
    baskets.push(makeBasket(scene, p));
    poles.push(matrixOf(p.x, p.y + 2.35, p.z, .08, 1.2, .08)); flags.push(matrixOf(p.x, p.y + 2.95, p.z, 1, 1, 1, h.id * .37));
  }
  for (const [list, mat, name] of [[ribbons, palette.path, 'Cedar fairway ribbons'], [ribbonLight, palette.pathLight, 'Cedar fairway centre line']]) {
    const geometry = mergeGeometries(list, false); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.receiveShadow = true; scene.add(mesh);
  }
  instanced(scene, 'Cedar tee pads', padGeometry, palette.pathLight, pads, { cast: false });
  instanced(scene, 'Cedar tee markers', markerGeometry, new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 1, flatShading: true }), markers);
  instanced(scene, 'Cedar basket shelves', rockGeometry, palette.rockLight, shelves);
  instanced(scene, 'Cedar flag poles', poleGeometry, new THREE.MeshStandardMaterial({ color: 0x765139, roughness: 1, flatShading: true }), poles);
  instanced(scene, 'Cedar basket flags', flagGeometry, palette.flag, flags, { cast: false });
  addHoleSigns(scene, holes);
  for (let i = 0; i < 24; i++) {
    const h = CEDAR_HOLES[i % CEDAR_HOLES.length], routeIndex = i % h.route.length;
    const a = h.route[Math.max(0, routeIndex - 1)], b = h.route[routeIndex];
    const x = a[0] + (b[0] - a[0]) * .5 + (i % 2 ? 1 : -1) * (h.width + 5), z = a[1] + (b[1] - a[1]) * .5 + (i % 2 ? -1 : 1) * 4;
    if (!clearOfCedarPlay(x, z, 2.2)) continue;
    const size = [1.5 + (i % 2) * .7, 1 + i % 3 * .25, 1.2 + (i % 2) * .5];
    forest.batcher.add('boulder', x, cedarHeight(x, z) + size[1] * .03, z, i * .43, [size[0] / 1.7, size[1] / 1.4, size[2] / 1.5], i % 3 ? .92 : 1.12);
    colliders.push({ kind: 'rock', center: new THREE.Vector3(x, cedarHeight(x, z) + size[1] * .45, z), radii: new THREE.Vector3(...size) });
  }
  const populated = forest.populate(colliders);
  const placements = [...dressing.placements, ...forest.records];
  return {
    id: 'forest', holes, colliders, baskets, water: [], bounds: CEDAR_BOUNDS, groundHeight: cedarSurfaceHeight, groundNormal: normalAt,
    palette: { sky: 0x8ea99a, fog: 0x6e8976, fogNear: 72, fogFar: 270, hemiSky: 0xd5e0d4, hemiGround: 0x1d3928, hemiIntensity: 1.55, sun: 0xeadcae, sunIntensity: 1.9, sunPosition: [-35, 82, -48] },
    name: 'Cedar Hollow', environment: { dressing: placements, forest: { meshes: forest.meshes, scatter: populated.scatterCount, creeks: forest.creeks.map(c => ({ name: c.name, samples: c.samples })), trails: forest.trails.map(t => ({ name: t.name, samples: t.samples })), bridges: forest.bridges, ponds: forest.ponds, clearings: forest.clearings } },
  };
}
