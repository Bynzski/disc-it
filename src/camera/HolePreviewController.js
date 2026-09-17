import * as THREE from 'three';
import { PREVIEW_PATHS, PREVIEW_FOCUS } from './PreviewPaths.js';
import './preview.css';

const smooth = t => t * t * (3 - 2 * t);

// Owns the camera only during a hole introduction. Gameplay state and physics
// remain the caller's responsibility; no per-hole animation implementations.
export class HolePreviewController {
  constructor({ camera, hudRoot, onReturn, onEnd }) {
    Object.assign(this, { camera, hudRoot, onReturn, onEnd });
    this.active = false;
    this.overlay = document.createElement('div');
    this.overlay.className = 'pg-preview';
    this.overlay.hidden = true;
    this.overlay.innerHTML = '<div class="pg-preview-fade"></div><div class="pg-preview-caption"><span>HOLE PREVIEW</span><p class="pg-preview-route"></p><small>Press Space to skip</small></div>';
    document.body.appendChild(this.overlay);
    this.fade = this.overlay.querySelector('.pg-preview-fade');
    this.caption = this.overlay.querySelector('.pg-preview-caption');
    // Capture phase ensures a skip cannot also restart, charge, capture the
    // mouse, activate a focused button, or throw on the corresponding mouseup.
    this.swallowClick = false;
    window.addEventListener('keydown', e => {
      if (!this.active) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat && ['Space', 'Enter', 'Escape'].includes(e.code)) this.skip();
    }, true);
    window.addEventListener('mousedown', e => {
      if (!this.active) return;
      e.preventDefault(); e.stopImmediatePropagation();
      this.swallowClick = true;
      this.skip();
    }, true);
    window.addEventListener('click', e => {
      if (!this.active && !this.swallowClick) return;
      e.preventDefault(); e.stopImmediatePropagation();
      this.swallowClick = false;
      if (this.active) this.skip();
    }, true);
    window.addEventListener('wheel', e => {
      if (this.active) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, { capture: true, passive: false });
  }

  start(hole) {
    if (this.active) this.skip();
    this.active = true;
    this.returned = false;
    this.elapsed = 0;
    this.hole = hole;
    this.normalFov = this.camera.fov;
    this.duration = THREE.MathUtils.clamp(4 + (hole.lengthFeet - 205) / 410 * 2.2, 4, 6.2);
    this.travelDuration = this.duration - 1.25; // .75s pin hold + .5s fade/cut
    const supplied = hole.previewPath || PREVIEW_PATHS[hole.id];
    const points = supplied
      ? supplied.map(p => Array.isArray(p) ? new THREE.Vector3(...p) : new THREE.Vector3(p.x, p.y, p.z))
      : (hole.route || [[hole.tee.x, hole.tee.z], [hole.basket.x, hole.basket.z]])
        .map(p => new THREE.Vector3(p[0], 5.5, p[1]));
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.curve.arcLengthDivisions = 500;
    this.pin = hole.basket.clone().add(new THREE.Vector3(0, 1.35, 0));
    this.overlay.hidden = false;
    this.fade.style.opacity = '0';
    this.caption.style.opacity = '1';
    this.overlay.querySelector('.pg-preview-route').textContent = hole.note || '';
    this.hudRoot.classList.add('is-preview');
    this.hudRoot.inert = true;
    this.camera.fov = this.normalFov + 4;
    this.camera.updateProjectionMatrix();
    this.update(0);
  }

  // Deterministic sampling also lets tests inspect the entire path without
  // relying on render timing or teleporting the player's lie.
  sample(progress) {
    const u = THREE.MathUtils.clamp(progress, 0, 1);
    // Mild easing retains forward travel through the middle of a long hole.
    const travel = u * .55 + smooth(u) * .45;
    const position = this.curve.getPointAt(travel);
    const ahead = this.curve.getPointAt(Math.min(1, travel + .075));
    ahead.y = Math.max(1.35, ahead.y - 2.2);
    const pinBlend = smooth(THREE.MathUtils.clamp((travel - .72) / .28, 0, 1));
    const target = ahead.lerp(this.pin, pinBlend);
    const focus = PREVIEW_FOCUS[this.hole.id];
    if (focus && travel > focus.start && travel < focus.end) {
      const phase = (travel - focus.start) / (focus.end - focus.start);
      const weight = Math.sin(phase * Math.PI) ** 2 * focus.weight;
      target.lerp(new THREE.Vector3(...focus.point), weight);
    }
    return { position, target };
  }

  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    if (!this.returned) {
      const { position, target } = this.sample(this.elapsed / this.travelDuration);
      this.camera.position.copy(position);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(target);
    }
    const fadeStart = this.travelDuration + .75;
    if (this.elapsed > fadeStart) {
      const fadeTime = this.elapsed - fadeStart;
      if (fadeTime >= .25 && !this.returned) this.returnToTee();
      this.fade.style.opacity = String(fadeTime < .25 ? fadeTime / .25 : Math.max(0, 1 - (fadeTime - .25) / .25));
      this.caption.style.opacity = '0';
    }
    if (this.elapsed >= this.duration) this.finish();
  }

  returnToTee() {
    this.returned = true;
    this.camera.fov = this.normalFov;
    this.camera.updateProjectionMatrix();
    this.onReturn();
  }

  skip() {
    if (this.active) this.finish();
  }

  finish() {
    if (!this.returned) this.returnToTee();
    this.active = false;
    this.overlay.hidden = true;
    this.hudRoot.classList.remove('is-preview');
    this.hudRoot.inert = false;
    this.onEnd();
  }
}
