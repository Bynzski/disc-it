import * as THREE from 'three';

// Shared resources keep repeated placements inexpensive. Sizes are world-space
// radii; the collider uses the same ellipsoid as the faceted visual.
const geometry = new THREE.SphereGeometry(1, 10, 7);
const material = new THREE.MeshStandardMaterial({
  color: 0x85867b, roughness: 1, flatShading: true,
});

export function addBoulder(scene, colliders, { x, z, size = [1.6, 1.1, 1.3] }) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Park boulder';
  mesh.scale.set(...size);
  // Bury the bottom third so the rock sits naturally in the grass.
  mesh.position.set(x, size[1] * 0.65, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({ kind: 'rock', center: mesh.position.clone(), radii: mesh.scale.clone() });
  return mesh;
}

// Approximate the disc as a sphere against an expanded ellipsoid. Resolve
// penetration even when slow, but only bounce/damp when travelling into it.
export function collideBoulder(position, velocity, rock, discRadius) {
  const radii = rock.radii.clone().addScalar(discRadius);
  const local = position.clone().sub(rock.center);
  const scaled = local.clone().divide(radii);
  const length = scaled.length();
  if (length >= 1) return false;
  if (length < 0.0001) scaled.set(1, 0, 0);
  else scaled.divideScalar(length);
  const surface = scaled.clone().multiply(radii);
  const normal = scaled.clone().divide(radii).normalize();
  position.copy(rock.center).add(surface).addScaledVector(normal, 0.005);
  const incoming = velocity.dot(normal);
  if (incoming >= 0) return false;
  velocity.addScaledVector(normal, -incoming * 1.3);
  velocity.multiplyScalar(0.6);
  return incoming < -0.8;
}
