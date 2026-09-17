import * as THREE from 'three';

// Same playable basket dimensions as the original course.
export function makeBasket(scene, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);
  const metal = new THREE.MeshStandardMaterial({ color: 0xc7ccd1, metalness: .65, roughness: .28 });
  const band = new THREE.MeshStandardMaterial({ color: 0xffd33d, metalness: .18, roughness: .35 });
  const chains = new THREE.LineBasicMaterial({ color: 0xe9eef2 });
  function cylinder(top, bottom, height, y, material, open = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 28, 1, open), material);
    mesh.position.y = y; mesh.castShadow = true; group.add(mesh);
  }
  cylinder(.055, .055, 2.45, 1.22, metal);
  cylinder(.72, .72, .16, 2.35, band);
  cylinder(.92, .68, .34, .83, metal, true);
  for (const [radius, tube, y] of [[.68, .025, 2.2], [.86, .03, 1.02]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 28), metal);
    ring.rotation.x = Math.PI / 2; ring.position.y = y; group.add(ring);
  }
  function line(a, b) {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), chains));
  }
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    line([Math.cos(a)*.62, 2.2, Math.sin(a)*.62], [Math.cos(a+.12)*.24, 1.15, Math.sin(a+.12)*.24]);
  }
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    line([Math.cos(a)*.2, .82, Math.sin(a)*.2], [Math.cos(a)*.82, .98, Math.sin(a)*.82]);
  }
  return group;
}
