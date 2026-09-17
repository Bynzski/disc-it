import * as THREE from 'three';
import { buildCourse, COURSE_BOUNDS } from './course/Course.js';
import { collideBoulder } from './course/Boulder.js';
import { Disc, DISCS } from './entities/Disc.js';
import { HUD } from './ui/HUD.js';
import { HolePreviewController } from './camera/HolePreviewController.js';

const clamp = THREE.MathUtils.clamp;
const RAD2DEG = 180 / Math.PI;
const DISC_RADIUS = 0.24;
const REST_HEIGHT = 0.08;
const MIN_ELEVATION = 0;
const MAX_ELEVATION = 0.55;
const POWER_CYCLE_MS = 2800;
const EYE_HEIGHT = 1.68;

const app = document.querySelector('#app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc9e2);
scene.fog = new THREE.Fog(0x9cc9e2, 110, 300);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 700);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.domElement.style.touchAction = 'none';
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x5d7545, 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3d0, 2.4);
sun.position.set(42, 90, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
scene.add(sun);

const course = buildCourse(scene);
const { holes, colliders } = course;
let roundHoles = holes;
const disc = new Disc(scene);

const aimLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0.75 })
);
scene.add(aimLine);

const basketBeacon = new THREE.Mesh(
  new THREE.RingGeometry(1.25, 1.34, 48),
  new THREE.MeshBasicMaterial({ color: 0xffe071, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
);
basketBeacon.rotation.x = -Math.PI / 2;
scene.add(basketBeacon);

const state = {
  mode: 'aiming',
  showLanding: true,
  holeIndex: 0,
  scores: holes.map(() => null),
  discType: 'midrange',
  lie: holes[0].tee.clone(),
  position: holes[0].tee.clone(),
  velocity: new THREE.Vector3(),
  throws: 0,
  power: 0,
  charging: false,
  powerRising: true,
  chargeStart: 0,
  pointerX: innerWidth / 2,
  pointerY: innerHeight * 0.46,
  cameraView: 'first',
  cameraSnap: true,
  mouseCaptured: false,
  aimYaw: 0,
  elevation: 0,
  releaseAngle: 0,
  spin: 0,
  bank: 0,
  flightHeading: 0,
  spinRate: 0,
  landingTime: 0,
  finished: false,
};

const landingFlyover = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-150, 34, 315),
  new THREE.Vector3(-178, 42, 90),
  new THREE.Vector3(-115, 46, -130),
  new THREE.Vector3(35, 38, -190),
  new THREE.Vector3(178, 44, -80),
  new THREE.Vector3(150, 40, 145),
  new THREE.Vector3(15, 36, 300),
], true, 'centripetal');
landingFlyover.arcLengthDivisions = 600;

const touchControls = new Set();
const touchAim = {
  active: false,
  pointerId: null,
  lastX: 0,
  lastY: 0,
  suppressMouseUntil: 0,
};

const hud = new HUD({
  holes,
  onStartRound: startRound,
  onRestart: restartHole,
  onNextHole: nextHole,
  onToggleView: toggleCameraView,
  onSelectDisc: selectDisc,
  onReleaseMouse: () => { if (isMouseCaptured()) document.exitPointerLock(); },
  onTouchControl: setTouchControl,
  onTouchThrowStart: startTouchThrow,
  onTouchThrowEnd: endTouchThrow,
  onTouchThrowCancel: cancelTouchThrow,
  onTouchFlat: resetTouchTilt,
});

const preview = new HolePreviewController({
  camera,
  hudRoot: hud.root,
  onReturn: () => {
    // Cut beneath the preview fade; never fly backward to the tee.
    state.mode = 'aiming';
    state.cameraView = 'first';
    state.cameraSnap = true;
    updateCamera(1);
    state.mode = 'preview';
  },
  onEnd: () => {
    state.mode = 'aiming';
    state.charging = false;
    state.power = 0;
    updateHUD();
  },
});

const hole = () => roundHoles[state.holeIndex];

function selectDisc(type) {
  if (!Object.hasOwn(DISCS, type) || state.showLanding || state.mode !== 'aiming' || state.finished || state.charging) return;
  if (type === state.discType) return;
  state.discType = type;
  disc.select(type);
  hud.toast(`${DISCS[type].name} selected`);
}

function yawToBasket(from) {
  const target = hole().basket;
  return Math.atan2(target.x - from.x, target.z - from.z);
}

function aimDirection() {
  return new THREE.Vector3(Math.sin(state.aimYaw), 0, Math.cos(state.aimYaw)).normalize();
}

function angleLabel(angle) {
  const deg = Math.round(angle * RAD2DEG);
  if (Math.abs(deg) < 2) return 'Flat';
  return deg > 0 ? `${deg}° hyzer` : `${Math.abs(deg)}° anhyzer`;
}

function pointAimAtBasket() {
  state.aimYaw = yawToBasket(state.lie);
  state.elevation = clamp(state.elevation ?? 0, MIN_ELEVATION, MAX_ELEVATION);
}

function toggleCameraView() {
  if (state.showLanding || state.mode !== 'aiming' || state.finished) return;
  state.cameraView = state.cameraView === 'first' ? 'third' : 'first';
  state.cameraSnap = true;
  hud.toast(state.cameraView === 'first' ? 'First-person view' : 'Elevated inspection view');
}

function isMouseCaptured() {
  return document.pointerLockElement === renderer.domElement;
}

function requestMouseCapture() {
  if (state.showLanding || state.finished || state.mode !== 'aiming' || isMouseCaptured()) return;
  renderer.domElement.requestPointerLock?.();
}

function setTouchControl(control, active) {
  if (!control) return;
  if (active) touchControls.add(control);
  else touchControls.delete(control);
}

function resetTouchTilt() {
  if (state.showLanding || state.mode !== 'aiming' || state.finished) return;
  state.releaseAngle = 0;
}

function startTouchThrow() {
  if (state.showLanding || state.mode !== 'aiming' || state.finished || state.charging) return;
  state.charging = true;
  state.chargeStart = performance.now();
  state.power = 0;
}

function endTouchThrow() {
  if (!state.charging) return;
  state.charging = false;
  if (state.mode === 'aiming' && !state.finished) state.power = chargePower(performance.now());
  throwDisc();
}

function cancelTouchThrow() {
  if (!state.charging || state.mode !== 'aiming') return;
  state.charging = false;
  state.power = 0;
}

function updateTouchAiming(dt) {
  if (state.showLanding || state.mode !== 'aiming' || state.finished) {
    touchControls.clear();
    touchAim.active = false;
    return;
  }
  const tiltAxis = (touchControls.has('tilt-hyzer') ? 1 : 0) - (touchControls.has('tilt-anhyzer') ? 1 : 0);
  if (tiltAxis) state.releaseAngle = clamp(state.releaseAngle + tiltAxis * 0.72 * dt, -0.38, 0.38);
}

function canDragAim() {
  return !state.showLanding && state.mode === 'aiming' && !state.finished && !state.charging;
}

function startDragAim(e) {
  if (!canDragAim() || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
  e.preventDefault();
  touchAim.active = true;
  touchAim.pointerId = e.pointerId;
  touchAim.lastX = e.clientX;
  touchAim.lastY = e.clientY;
  touchAim.suppressMouseUntil = performance.now() + 650;
  renderer.domElement.setPointerCapture?.(e.pointerId);
}

function moveDragAim(e) {
  if (!touchAim.active || e.pointerId !== touchAim.pointerId) return;
  e.preventDefault();
  const dx = e.clientX - touchAim.lastX;
  const dy = e.clientY - touchAim.lastY;
  touchAim.lastX = e.clientX;
  touchAim.lastY = e.clientY;
  if (!canDragAim()) return;
  state.aimYaw -= dx * 0.0042;
  state.elevation = clamp(state.elevation - dy * 0.0034, MIN_ELEVATION, MAX_ELEVATION);
}

function endDragAim(e) {
  if (!touchAim.active || e.pointerId !== touchAim.pointerId) return;
  e.preventDefault();
  touchAim.active = false;
  touchAim.pointerId = null;
  touchAim.suppressMouseUntil = performance.now() + 650;
}

function chargePower(now) {
  const phase = ((now - state.chargeStart) % POWER_CYCLE_MS) / POWER_CYCLE_MS;
  const rising = phase <= 0.5;
  state.powerRising = rising;
  return rising ? phase * 2 : 2 - phase * 2;
}

function throwDisc() {
  if (state.mode !== 'aiming' || state.finished) return;
  state.showLanding = false;
  const power = clamp(state.power, 0.08, 1);
  const dir = aimDirection();
  const profile = DISCS[state.discType];
  const speed = profile.minSpeed + power * (profile.speed - profile.minSpeed);
  state.velocity.set(
    dir.x * Math.cos(state.elevation) * speed,
    Math.sin(state.elevation) * speed,
    dir.z * Math.cos(state.elevation) * speed,
  );

  // Hyzer/anhyzer has an immediate influence and continues to bias the flight.
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  state.velocity.addScaledVector(right, -state.releaseAngle * 3.2);
  state.position.copy(state.lie);
  // A raised putting release makes gentle, level putts reach the chains.
  state.position.y = state.discType === 'putter' ? state.lie.y + 1.2 : REST_HEIGHT + 0.08;
  state.mode = 'flying';
  touchControls.clear();
  state.throws += 1;
  state.spin = 0;
  state.spinRate = 26;
  state.flightHeading = state.aimYaw;
  state.bank = state.releaseAngle;
  disc.resetTrail();
  hud.toast(`Throw ${state.throws} · ${profile.name} · ${Math.round(power * 100)}% power`);
}

function startRound(format = 'all') {
  if (!state.showLanding) return;
  roundHoles = format === 'front' ? holes.slice(0, 9) : format === 'back' ? holes.slice(9) : holes;
  state.roundFormat = format;
  state.scores = roundHoles.map(() => null);
  startHole(0);
}

function startHole(index) {
  preview.skip();
  if (isMouseCaptured()) document.exitPointerLock?.();
  state.showLanding = false;
  state.holeIndex = index;
  state.mode = 'aiming';
  state.discType = 'midrange';
  disc.select(state.discType);
  state.lie.copy(hole().tee);
  state.position.copy(hole().tee);
  state.velocity.set(0, 0, 0);
  state.throws = 0;
  state.power = 0;
  state.charging = false;
  state.releaseAngle = 0;
  state.elevation = 0;
  state.spin = 0;
  state.spinRate = 0;
  state.bank = 0;
  state.finished = false;
  state.cameraView = 'first';
  state.cameraSnap = true;
  state.pointerX = innerWidth / 2;
  state.pointerY = innerHeight * 0.46;
  touchControls.clear();
  pointAimAtBasket();
  // Face the first playable lane, not the pin behind a dogleg's trees.
  const opening = hole().aimPoint || hole().basket;
  state.aimYaw = Math.atan2(opening.x - state.lie.x, opening.z - state.lie.z);
  disc.resetTrail();
  updateSunTarget();
  hud.toast(`Hole ${hole().id} · ${hole().name} · Par ${hole().par} · ${hole().lengthFeet} ft`);
  state.mode = 'preview';
  updateHUD();
  preview.start(hole());
}

function restartHole() {
  if (state.showLanding) return;
  state.scores[state.holeIndex] = null;
  startHole(state.holeIndex);
}

function nextHole() {
  // Advance only after a scored finish; N must not skip unplayed holes.
  if (!state.finished) return;
  if (state.holeIndex + 1 < roundHoles.length) {
    startHole(state.holeIndex + 1);
  } else {
    state.scores = roundHoles.map(() => null);
    startHole(0);
  }
}

function finishHole() {
  if (state.finished) return;
  state.finished = true;
  state.mode = 'holed';
  state.velocity.set(0, 0, 0);
  state.position.set(hole().basket.x, 1.15, hole().basket.z);
  state.charging = false;
  state.power = 0;
  // Free the cursor so dialogs (Next hole / Restart) are clickable.
  if (isMouseCaptured()) document.exitPointerLock?.();
  disc.resetTrail();
  state.spinRate = 0;
  state.bank = 0;
  state.scores[state.holeIndex] = state.throws;
  const last = state.holeIndex + 1 >= roundHoles.length;
  hud.toast(last ? 'Round complete!' : 'Chains! Hole complete.');
}

function updateSunTarget() {
  const current = hole();
  sun.target.position.set(current.basket.x, 0, current.basket.z);
  sun.target.updateMatrixWorld();
}

function collideObstacles() {
  for (const tree of colliders) {
    if (tree.kind === 'rock') {
      if (collideBoulder(state.position, state.velocity, tree, DISC_RADIUS)) hud.toast('Rock kick');
      continue;
    }
    const dx = state.position.x - tree.x;
    const dz = state.position.z - tree.z;
    const d2 = dx * dx + dz * dz;
    const inCanopy = state.position.y > (tree.canopyBottom ?? 1.8) && state.position.y < tree.height;
    const radius = (inCanopy ? tree.canopyRadius : tree.trunkRadius) + DISC_RADIUS;
    if (state.position.y < tree.height && d2 < radius * radius) {
      const d = Math.max(Math.sqrt(d2), 0.001);
      const normal = new THREE.Vector3(dx / d, 0, dz / d);
      state.position.x = tree.x + normal.x * radius;
      state.position.z = tree.z + normal.z * radius;

      const impact = Math.max(0, -state.velocity.dot(normal));
      state.velocity.addScaledVector(normal, impact * 1.35);
      state.velocity.multiplyScalar(inCanopy ? 0.36 : 0.26);
      state.velocity.y = Math.min(state.velocity.y, inCanopy ? -1.2 : -2.4);
      state.bank += (Math.random() - 0.5) * 0.4;
      hud.toast(inCanopy ? 'Clipped branches' : 'Tree kick');
      break;
    }
  }
}

function updatePhysics(dt) {
  if (state.mode !== 'flying') return;

  const profile = DISCS[state.discType];
  const horizontalSpeed = Math.hypot(state.velocity.x, state.velocity.z);
  const grounded = state.position.y <= REST_HEIGHT + 0.001 && state.velocity.y <= 0;
  if (grounded) {
    // Snap the contact tolerance to the same plane used by the settle check.
    state.position.y = REST_HEIGHT;
    // Sliding friction only: low-speed fade must not keep accelerating a
    // grounded disc sideways indefinitely (especially the driver).
    state.velocity.y = 0;
    const friction = Math.max(0, 1 - 6 * dt / Math.max(horizontalSpeed, 0.001));
    state.velocity.x *= friction;
    state.velocity.z *= friction;
    state.bank = THREE.MathUtils.lerp(state.bank, 0, 1 - Math.exp(-12 * dt));
    state.spinRate *= Math.exp(-8 * dt);
  } else if (horizontalSpeed > 0.001) {
    const forward = new THREE.Vector3(state.velocity.x / horizontalSpeed, 0, state.velocity.z / horizontalSpeed);
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    /* Flight-model audit (dev note):
     * Before: turn/fade/hyzer were direct sideways accelerations and lift was
     * always world-up, so bank never affected the flight — hyzer was steering.
     * Now: `bank` is a real roll state (positive = hyzer, left edge down for
     * RHBH). High-speed turn torque rolls toward anhyzer, low-speed fade
     * torque rolls back toward hyzer; both scale with speed01 like before.
     * Lift acts along the disc normal (tilted by bank), so a banked disc's
     * lift gains a horizontal component and the curve emerges from orientation.
     * Retained from the old model: speed01 phase split, per-disc profiles,
     * drag, glide, and the initial bank-direction velocity kick at release. */
    const speed01 = clamp((horizontalSpeed - 7) / 18, 0, 1);
    const turnTorque = speed01 * profile.turn;
    const fadeTorque = (1 - speed01) * profile.fade;
    state.bank = clamp(state.bank + (fadeTorque - turnTorque) * 0.05 * dt, -0.8, 0.8);

    // Lift along the tilted disc normal: hyzer (bank > 0) pushes left,
    // anhyzer pushes right; cosine shading keeps flat flight unchanged.
    const lift = clamp(horizontalSpeed * profile.glide + speed01 * profile.liftBoost, 0, 8.2);
    state.velocity.y += (lift * Math.cos(state.bank) - 9.8) * dt;
    state.velocity.addScaledVector(right, -lift * Math.sin(state.bank) * dt);

    const drag = 0.18 + horizontalSpeed * profile.drag;
    state.velocity.multiplyScalar(Math.max(0, 1 - drag * dt));
  } else {
    state.velocity.y -= 9.8 * dt;
  }

  // Freeze chase direction as the disc slows, instead of orbiting a tiny slide.
  if (!grounded && horizontalSpeed > 2) state.flightHeading = Math.atan2(state.velocity.x, state.velocity.z);
  state.position.addScaledVector(state.velocity, dt);
  collideObstacles();

  const target = hole().basket;
  const basketDx = state.position.x - target.x;
  const basketDz = state.position.z - target.z;
  const basketDist = Math.hypot(basketDx, basketDz);
  const speed = state.velocity.length();
  const inChains = basketDist < 0.82 && state.position.y > 0.72 && state.position.y < 2.35;
  const inTrayOrPole = basketDist < 0.55 && state.position.y > 0.22 && state.position.y < 1.05;
  if ((inChains || inTrayOrPole) && speed < 20) {
    finishHole();
    return;
  }

  if (state.position.y <= REST_HEIGHT) {
    // Casual park rule: a water landing costs one penalty stroke and returns
    // to the previous lie. Carrying over water is legal; dry routes stay free.
    const wet = course.water?.some(w => Math.hypot(state.position.x - w.x, state.position.z - w.z) < w.radius);
    if (wet) {
      state.throws += 1;
      state.position.copy(state.lie);
      state.velocity.set(0, 0, 0);
      state.mode = 'aiming';
      state.spinRate = 0;
      state.bank = 0;
      state.power = 0;
      state.charging = false;
      state.cameraView = 'first';
      state.cameraSnap = true;
      disc.resetTrail();
      hud.toast('Water · +1 penalty · Rethrow from previous lie');
      return;
    }
    state.position.y = REST_HEIGHT;
    const hSpeed = Math.hypot(state.velocity.x, state.velocity.z);
    if (Math.abs(state.velocity.y) > 1.5 && hSpeed > 2.2) {
      state.velocity.y = -state.velocity.y * 0.16;
      state.velocity.x *= 0.58;
      state.velocity.z *= 0.58;
    } else {
      state.velocity.y = 0;
      const friction = Math.max(0, 1 - 3.4 * dt);
      state.velocity.x *= friction;
      state.velocity.z *= friction;
    }

    if (Math.hypot(state.velocity.x, state.velocity.z) < 0.18 && Math.abs(state.velocity.y) < 0.12) {
      state.velocity.set(0, 0, 0);
      state.spinRate = 0;
      state.bank = 0;
      state.mode = 'aiming';
      state.lie.copy(state.position);
      state.lie.y = REST_HEIGHT;
      state.power = 0;
      state.cameraView = 'first';
      state.cameraSnap = true;
      pointAimAtBasket();
      const feet = Math.round(state.lie.distanceTo(hole().basket) * 3.05);
      if (!state.finished) hud.toast(`Lie marked · ${feet} ft remaining`);
    }
  }

  // Keep the disc inside the park grounds.
  state.position.x = clamp(state.position.x, COURSE_BOUNDS.minX, COURSE_BOUNDS.maxX);
  state.position.z = clamp(state.position.z, COURSE_BOUNDS.minZ, COURSE_BOUNDS.maxZ);
}

function updateCamera(dt) {
  const dir = aimDirection();
  let desired;
  let target;

  if (state.showLanding) {
    const loop = (state.landingTime % 28) / 28;
    desired = landingFlyover.getPointAt(loop);
    const ahead = landingFlyover.getPointAt((loop + 0.045) % 1);
    const courseCenter = new THREE.Vector3(0, 0.7, 40);
    target = ahead.lerp(courseCenter, 0.62);
    target.y = 1.2 + Math.sin(state.landingTime * 0.35) * 0.25;
  } else if (state.mode === 'flying') {
    const vel = new THREE.Vector3(Math.sin(state.flightHeading), 0, Math.cos(state.flightHeading));
    desired = state.position.clone().addScaledVector(vel, -8.5).add(new THREE.Vector3(0, 4.2, 0));
    target = state.position.clone().addScaledVector(vel, 6).add(new THREE.Vector3(0, 1.0, 0));
  } else if (state.finished) {
    desired = hole().basket.clone().add(new THREE.Vector3(6, 4.2, 8));
    target = hole().basket.clone().add(new THREE.Vector3(0, 1.4, 0));
  } else if (state.cameraView === 'first') {
    const eye = state.lie.clone().add(new THREE.Vector3(0, 1.68, 0));
    const lookDir = new THREE.Vector3(
      Math.sin(state.aimYaw) * Math.cos(state.elevation),
      Math.sin(state.elevation),
      Math.cos(state.aimYaw) * Math.cos(state.elevation),
    ).normalize();
    desired = eye;
    target = eye.clone().addScaledVector(lookDir, 25);
  } else {
    desired = state.lie.clone().addScaledVector(dir, -11).add(new THREE.Vector3(0, 6.2, 0));
    target = state.lie.clone().addScaledVector(dir, 13).add(new THREE.Vector3(0, 0.55 + state.elevation * 2.0, 0));
  }

  camera.up.set(0, 1, 0);
  if (state.mode === 'aiming' && (state.cameraView === 'first' || state.cameraSnap) && !state.finished) {
    camera.position.copy(desired);
    camera.lookAt(target);
    state.cameraSnap = false;
    return;
  }

  camera.position.lerp(desired, 1 - Math.exp(-dt * 7));
  const look = new THREE.Vector3();
  camera.getWorldDirection(look);
  const currentTarget = camera.position.clone().add(look.multiplyScalar(10));
  currentTarget.lerp(target, 1 - Math.exp(-dt * 8));
  camera.lookAt(currentTarget);
}

function updateAimLine() {
  const dir = aimDirection();
  const start = state.lie.clone();
  start.y = 0.12;
  const end = start.clone().addScaledVector(dir, 16 + state.power * 20);
  end.y += Math.sin(state.elevation) * 3.0;
  aimLine.geometry.setFromPoints([start, end]);
  aimLine.visible = state.mode === 'aiming' && state.cameraView === 'third' && !state.finished;
  basketBeacon.position.set(hole().basket.x, 0.035, hole().basket.z);
  basketBeacon.visible = !state.showLanding && !state.finished;
  basketBeacon.rotation.z += 0.01;
}

function updateHUD() {
  const distanceFeet = (state.mode === 'flying' ? state.position : state.lie).distanceTo(hole().basket) * 3.05;

  hud.update({
    hole: hole(),
    holes: roundHoles,
    scores: state.scores,
    roundOver: state.scores.every(s => s !== null),
    holeIndex: state.holeIndex,
    holeCount: roundHoles.length,
    courseTotal: roundHoles.reduce((sum, h) => sum + h.lengthFeet, 0),
    throws: state.throws,
    discType: state.discType,
    showLanding: state.showLanding,
    canSelectDisc: !state.showLanding && state.mode === 'aiming' && !state.finished && !state.charging,
    distanceFeet,
    elevationDeg: state.elevation * RAD2DEG,
    releaseLabel: angleLabel(state.releaseAngle),
    releaseDeg: state.releaseAngle * RAD2DEG,
    cameraView: state.cameraView,
    mouseCaptured: state.mouseCaptured,
    power: state.charging ? state.power : 0,
    mode: state.mode,
    charging: state.charging,
    powerRising: state.powerRising,
    finished: state.finished,
  });
}

let lastTime = performance.now();
function animate(now) {
  // The first RAF timestamp can precede setup's performance.now(), especially on mobile.
  const dt = Math.max(0, Math.min(0.033, (now - lastTime) / 1000 || 0.016));
  lastTime = now;

  if (state.charging && state.mode === 'aiming') {
    state.power = chargePower(now);
  }
  if (state.showLanding) state.landingTime += dt;
  updateTouchAiming(dt);
  updatePhysics(dt);
  if (preview.active) preview.update(dt);
  else updateCamera(dt);
  updateAimLine();
  state.spin = (state.spin + state.spinRate * dt) % (Math.PI * 2);
  const settled = state.finished
    ? new THREE.Vector3(hole().basket.x, 1.15, hole().basket.z)
    : state.position;
  disc.update(settled, state.bank, state.spin, state.mode === 'flying', state.flightHeading);
  updateHUD();
  renderer.render(scene, camera);
}

renderer.domElement.addEventListener('pointerdown', startDragAim, { passive: false });
renderer.domElement.addEventListener('pointermove', moveDragAim, { passive: false });
renderer.domElement.addEventListener('pointerup', endDragAim, { passive: false });
renderer.domElement.addEventListener('pointercancel', endDragAim, { passive: false });

window.addEventListener('mousemove', (e) => {
  if (state.mode === 'aiming' && !state.finished && state.mouseCaptured) {
    state.aimYaw -= e.movementX * 0.0024;
    state.elevation = clamp(state.elevation - e.movementY * 0.002, MIN_ELEVATION, MAX_ELEVATION);
  }
  state.pointerX = e.clientX;
  state.pointerY = e.clientY;
});

window.addEventListener('mousedown', (e) => {
  if (performance.now() < touchAim.suppressMouseUntil) return;
  if (e.button !== 0 || state.showLanding || state.mode !== 'aiming' || state.finished) return;
  if (e.target.closest?.('button')) return;
  if (!state.mouseCaptured) {
    requestMouseCapture();
    return;
  }
  state.charging = true;
  state.chargeStart = performance.now();
  state.power = 0;
});

window.addEventListener('mouseup', (e) => {
  if (e.button !== 0 || !state.charging) return;
  state.charging = false;
  if (state.mode === 'aiming' && !state.finished) state.power = chargePower(performance.now());
  throwDisc();
});

document.addEventListener('pointerlockchange', () => {
  const captured = isMouseCaptured();
  if (state.mouseCaptured === captured) return;
  state.mouseCaptured = captured;
  document.body.classList.toggle('pg-mouse-captured', captured);
  if (captured) hud.toast('Mouse captured · Esc to release');
  else {
    state.charging = false;
    state.power = 0;
    if (!state.finished) hud.toast('Mouse released');
  }
});

window.addEventListener('wheel', (e) => {
  if (state.showLanding || state.mode !== 'aiming' || state.finished) return;
  state.releaseAngle = clamp(state.releaseAngle - e.deltaY * 0.0009, -0.38, 0.38);
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const type = { '1': 'driver', '2': 'midrange', '3': 'putter' }[e.key];
    if (type) selectDisc(type);
  }
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (state.showLanding && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    startRound(hud.roundFormat);
  }
  if (e.key === 'r' || e.key === 'R') restartHole();
  if (e.key === 'v' || e.key === 'V') toggleCameraView();
  if (e.key === 'n' || e.key === 'N') nextHole();
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

pointAimAtBasket();
updateSunTarget();
updateCamera(1);
updateAimLine();
updateHUD();
disc.update(state.position, state.bank, state.spin, false);
renderer.render(scene, camera);
renderer.setAnimationLoop(animate);
