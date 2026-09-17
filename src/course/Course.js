import * as THREE from 'three';
import { addBoulder } from './Boulder.js';
import { createBin, createParkSign, createPicnicTable, createShelter, placeAsset } from './ParkAssets.js';
import { makeBasket } from './Basket.js';
import { addEnvironmentDetails } from './EnvironmentAssets.js';
import { HOLE_DATA, COURSE_BOUNDS, WATER, distanceToSegment, inPolygon } from './Layout.js';

export { COURSE_BOUNDS };
export const COURSE_NAME = 'Tocobaga Park';
export const COURSE_BLB = 'An original city-park routing inspired by coastal Florida';
const material = color => new THREE.MeshStandardMaterial({ color, roughness: .9 });
const wood = material(0x745438), leaves = material(0x39673d), rough = material(0x73924f);
const fairway = material(0x89a85e), concrete = material(0xa8aaa0), sand = material(0xc3ba91);
const trunkGeo = new THREE.CylinderGeometry(.7, 1, 1, 8);
const crownGeo = new THREE.SphereGeometry(1, 10, 8);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const circleGeo = new THREE.CircleGeometry(1, 32);

function box(scene, x, y, z, sx, sy, sz, mat, angle = 0) {
  const mesh = new THREE.Mesh(boxGeo, mat);
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.y = angle;
  mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
}
function disk(scene, x, z, radius, mat, y = .015) {
  const mesh = new THREE.Mesh(circleGeo, mat);
  mesh.rotation.x = -Math.PI / 2; mesh.scale.setScalar(radius); mesh.position.set(x, y, z);
  mesh.receiveShadow = true; scene.add(mesh);
}
function strip(scene, a, b, width, mat, y = .012) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, Math.hypot(dx, dz)), mat);
  mesh.rotation.set(-Math.PI / 2, 0, -Math.atan2(dx, dz));
  mesh.position.set((a[0]+b[0])/2, y, (a[1]+b[1])/2);
  mesh.receiveShadow = true; scene.add(mesh);
}

export function buildCourse(scene) {
  const colliders = [], baskets = [];
  const holes = HOLE_DATA.map(data => ({
    ...data,
    tee: new THREE.Vector3(data.route[0][0], .08, data.route[0][1]),
    basket: new THREE.Vector3(data.route.at(-1)[0], 0, data.route.at(-1)[1]),
    aimPoint: new THREE.Vector3(data.route[1][0], 0, data.route[1][1]),
  }));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(470, 590), rough);
  ground.rotation.x = -Math.PI / 2; ground.position.set(10, 0, 60);
  ground.receiveShadow = true; scene.add(ground);

  // Every planting has a role: lane edge, shortcut-blocking grove or guardian.
  // Protect every tee and putting circle, including those of adjacent holes.
  const clear = (x, z, radius, frontOnly = false) => (frontOnly ? holes.slice(0, 9) : holes).every(h =>
    Math.hypot(x-h.tee.x, z-h.tee.z) > radius + 5 &&
    Math.hypot(x-h.basket.x, z-h.basket.z) > radius + 4);
  const occupied = [];
  let environment;
  const overlapsPark = (x, z, radius) => environment?.placements.some(p =>
    Math.hypot(x-p.x, z-p.z) < radius+p.radius+1);
  function tree(x, z, scale = 1, role = 'edge', holeId = 0) {
    const crownR = 2.2 * scale;
    if (!clear(x, z, crownR, holeId <= 9) || occupied.some(p => Math.hypot(x-p[0], z-p[1]) < 2.3)) return;
    // New planting must never change a front-nine lane (including alternates),
    // or close a neighboring back-nine fairway.
    if (holeId > 9 && holes.some(h => h.id !== holeId && nearRoute(x, z, h, h.width * .75 + crownR + 1))) return;
    if (holeId > 9 && overlapsPark(x, z, crownR)) return;
    occupied.push([x, z]);
    const trunkH = 4.5 * scale, trunkR = .4 * scale;
    const trunk = new THREE.Mesh(trunkGeo, wood);
    trunk.position.set(x, trunkH/2, z); trunk.scale.set(trunkR, trunkH, trunkR);
    trunk.castShadow = true; trunk.receiveShadow = true; scene.add(trunk);
    const crown = new THREE.Mesh(crownGeo, leaves);
    crown.position.set(x, trunkH, z); crown.scale.set(crownR, crownR, crownR);
    crown.castShadow = true; crown.receiveShadow = true; scene.add(crown);
    colliders.push({ kind: 'tree', x, z, trunkRadius: trunkR, canopyRadius: crownR,
      trunkHeight: trunkH, canopyBottom: trunkH-crownR, height: trunkH+crownR, role, holeId });
  }
  function bush(x, z, holeId) {
    if (!clear(x, z, 1.4, holeId <= 9)) return;
    if (holeId > 9 && holes.some(h => h.id !== holeId && nearRoute(x, z, h, h.width * .75 + 2.4))) return;
    if (holeId > 9 && overlapsPark(x, z, 1.4)) return;
    if (holeId > 9) {
      // Saw-palmetto fans: low solid rough uses the existing underbrush collider.
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        const frond = new THREE.Mesh(crownGeo, leaves);
        frond.position.set(x + Math.sin(a)*.55, .85, z + Math.cos(a)*.55);
        frond.scale.set(.35, .22, .95); frond.rotation.set(-.55, a, 0);
        frond.castShadow = true; scene.add(frond);
      }
    } else {
      const mesh = new THREE.Mesh(crownGeo, leaves);
      mesh.position.set(x, .85, z); mesh.scale.set(1.5, 1.05, 1.5);
      mesh.castShadow = true; scene.add(mesh);
    }
    colliders.push({ kind: 'tree', x, z, trunkRadius: 1.4, canopyRadius: 1.4,
      canopyBottom: 0, trunkHeight: 1, height: 1.9, role: 'underbrush', holeId });
  }
  function nearRoute(x, z, data, margin) {
    return [data.route, data.alternate].filter(Boolean).some(route =>
      route.slice(1).some((b, i) => distanceToSegment(x, z, route[i], b) < margin));
  }
  function buildHole(data) {
    const paths = [data.route, data.alternate].filter(Boolean);
    for (const route of paths) {
      for (let j = 1; j < route.length; j++) {
        const a = route[j-1], b = route[j];
        strip(scene, a, b, data.width*1.4, fairway);
        disk(scene, b[0], b[1], data.width*.7, fairway);
        const dx = b[0]-a[0], dz = b[1]-a[1], length = Math.hypot(dx, dz);
        for (let d = 7; d < length-4; d += data.spacing) {
          for (const side of [-1, 1]) {
            const x = a[0]+dx*d/length-dz/length*data.width*side;
            const z = a[1]+dz*d/length+dx/length*data.width*side;
            // Do not block the other arm of a dogleg or an alternate window.
            if (!nearRoute(x, z, data, data.width*.7)) tree(x, z, data.trees, 'edge', data.id);
            if ([2, 8, 12, 17].includes(data.id)) {
              const ox = x-dz/length*5*side, oz = z+dx/length*5*side;
              if (!nearRoute(ox, oz, data, data.width*.7)) {
                tree(ox, oz, data.trees*1.2, 'rough', data.id);
                bush(ox+1, oz+1, data.id);
              }
            }
          }
        }
      }
    }
    // Generous, visibly mown landing clearings, rather than uniform tunnels.
    for (const p of data.route.slice(1, -1)) disk(scene, p[0], p[1], data.width*.85, fairway, .017);
    for (const [x, z, scale] of [...(data.blockers || []), ...(data.guardians || [])]) tree(x, z, scale, 'guardian', data.id);
    for (const polygon of data.groves || []) {
      const xs = polygon.map(p => p[0]), zs = polygon.map(p => p[1]);
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 4.6) {
        for (let z = Math.min(...zs); z <= Math.max(...zs); z += 4.6) {
          if (inPolygon(x, z, polygon) && !nearRoute(x, z, data, 6)) {
            tree(x, z, 1.65, 'grove', data.id);
            bush(x+1.3, z+1.2, data.id);
          }
        }
      }
    }
    const a = data.route[0], b = data.route[1];
    const angle = Math.atan2(b[0]-a[0], b[1]-a[1]);
    box(scene, a[0], .04, a[1], 3.2, .08, 5, concrete, angle);
    const sx = a[0]-Math.cos(angle)*4.3-Math.sin(angle)*2;
    const sz = a[1]+Math.sin(angle)*4.3-Math.cos(angle)*2;
    placeAsset(scene, createParkSign(`${data.id}  ${data.name}`, `PAR ${data.par}  /  ${data.lengthFeet} FT`), sx, sz, angle+Math.PI);
    baskets.push(makeBasket(scene, data.basket));
    // Short connecting paths make the routing read as one property.
    if (data.id < holes.length) {
      const next = holes[data.id];
      strip(scene, [data.basket.x, data.basket.z], [next.tee.x, next.tee.z], 1.7, sand, .021);
    }
  }

  holes.slice(0, 9).forEach(buildHole);

  // Water landing: one penalty stroke and a rethrow from the prior lie.
  // Shoreline rocks/cypress frame the carry without obstructing the dry route.
  for (const pond of WATER) {
    const waterHole = holes[pond.holes[0]-1];
    placeAsset(scene, createParkSign('WATER  +1', 'LAND IN WATER: RETHROW FROM PREVIOUS LIE'), waterHole.tee.x + 6, waterHole.tee.z - 4, Math.PI);
    disk(scene, pond.x, pond.z, pond.radius+1.4, sand, .025);
    disk(scene, pond.x, pond.z, pond.radius, material(0x527e93), .032);
    for (let i = 0; i < 10; i++) {
      const angle = i/10*Math.PI*2;
      const x = pond.x+Math.sin(angle)*(pond.radius+1.8), z = pond.z+Math.cos(angle)*(pond.radius+1.8);
      if (clear(x, z, 2, true) && !holes.slice(0, 9).some(h => nearRoute(x, z, h, 6))) {
        addBoulder(scene, colliders, { x, z, size: [1.7, 1.25, 1.5] });
        tree(x+2.5, z+2.5, 1.4, 'shoreline', pond.holes[0]);
      }
    }
  }
  placeAsset(scene, createShelter(), -28, 248);
  placeAsset(scene, createPicnicTable(), -41, 246);
  placeAsset(scene, createBin(), -37, 253);
  // Pavilion is outside the intended lanes; its grove, not invisible furniture,
  // blocks the shortcut. Parking/path are visual boundaries, not hidden OB.
  strip(scene, [-100, 259], [10, 235], 3.2, concrete, .024);
  box(scene, -67, .016, 241, 38, .025, 15, material(0x687073));
  for (let x = -83; x < -48; x += 5) box(scene, x, .035, 241, .12, .02, 11, sand);
  for (let x = -91; x <= -47; x += 4) box(scene, x, .8, 254, .16, 1.6, .16, wood);
  box(scene, -69, 1.2, 254, 44, .14, .14, wood);
  placeAsset(scene, createParkSign('FOUNDERS GREEN', 'TOCOBAGA PARK  /  FRONT NINE'), -84, 286, Math.PI/2);
  // Signature backdrop behind the final green, with a clear putting circle.
  box(scene, -85, 2.3, 282, .35, 4.6, .35, wood);
  box(scene, -85, 2.3, 291, .35, 4.6, .35, wood);
  box(scene, -85, 4.5, 286.5, .45, .35, 9.5, wood);
  // Freeze the established park before adding the inner loop. New planting
  // respects these prefab footprints instead of silently deleting park assets.
  environment = addEnvironmentDetails(scene, holes.slice(0, 9), colliders);
  holes.slice(9).forEach(buildHole);
  strip(scene, [4, 244], [10, 235], 1.7, sand, .021);
  return { holes, colliders, baskets, water: WATER, environment };
}
