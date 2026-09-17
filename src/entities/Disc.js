import * as THREE from 'three';

export const DISCS = {
  // Arcade flight coefficients: launch speed range, lift per speed, drag,
  // high-speed turn and low-speed fade. Midrange retains the original feel.
  driver: { name: 'Driver', minSpeed: 9, speed: 38, glide: 0.24, liftBoost: 2.5, drag: 0.010, turn: 3.1, fade: 3.8, color: '#f08b47', ratings: '9 / 5 / −2 / 2', description: 'Long distance · stronger turn and fade' },
  midrange: { name: 'Mid-Range', minSpeed: 8.5, speed: 32, glide: 0.26, liftBoost: 2.5, drag: 0.012, turn: 2.15, fade: 2.65, color: '#73b8c5', ratings: '5 / 5 / −1 / 1', description: 'Balanced distance and control' },
  putter: { name: 'Putter', minSpeed: 3, speed: 18, glide: 0.36, liftBoost: 1.5, drag: 0.020, turn: 0.25, fade: 0.55, color: '#e8cf78', ratings: '2 / 3 / 0 / 1', description: 'Short approaches · gentle, straighter flight' },
};

export class Disc {
  constructor(scene) {
    this.mesh = new THREE.Group();
    // Bank/heading orient the disc plane; spin is around its local normal.
    // Mixing these in one Euler rotation makes the plane wobble every turn.
    this.rotor = new THREE.Group();
    this.mesh.add(this.rotor);
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.235, 0.055, 32), new THREE.MeshStandardMaterial({ color: DISCS.midrange.color, roughness: 0.4 }));
    this.body.castShadow = true;
    this.rotor.add(this.body);
    const stamp = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.115, 32), new THREE.MeshBasicMaterial({ color: '#fff5dc', side: THREE.DoubleSide }));
    stamp.rotation.x = -Math.PI / 2;
    stamp.position.y = 0.03;
    this.rotor.add(stamp);
    scene.add(this.mesh);
    this.trailPoints = [];
    this.trailGeometry = new THREE.BufferGeometry();
    this.trail = new THREE.Line(this.trailGeometry, new THREE.LineBasicMaterial({ color: '#fff8dd', transparent: true, opacity: 0.55 }));
    scene.add(this.trail);
  }
  select(type) { this.body.material.color.set(DISCS[type].color); }
  resetTrail() { this.trailPoints = []; this.trailGeometry.setFromPoints([new THREE.Vector3()]); }
  update(position, bank, spin, flying, heading = 0) {
    this.mesh.position.copy(position);
    // Local +Z is forward, +Y is the plate normal. Viewed from behind,
    // player-right is local -X. Positive RHBH hyzer lowers the left edge:
    // normal tilts toward local +X (player-left), matching aerodynamic lift.
    this.mesh.rotation.set(0, heading, -bank, 'YXZ');
    this.rotor.rotation.y = spin;
    if (flying) {
      this.trailPoints.push(position.clone());
      if (this.trailPoints.length > 90) this.trailPoints.shift();
      this.trailGeometry.setFromPoints(this.trailPoints);
    }
  }
}
