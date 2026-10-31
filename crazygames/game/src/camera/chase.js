/* THE CHASE CAMERA. Sits behind and above the car on a heading that
   follows the car's with a lag, swings part way towards the direction of
   travel so a drift shows its angle, pulls back and widens with speed,
   and shakes on a hit. Pure arithmetic on the interpolated pose; the
   three.js camera is written at the end of update. Every constant is in
   TUNE.CAMERA.

   The angle the camera follows is the car's yaw plus SWING times the
   body slip (clamped), smoothed on the circle with time constant LAG.
   The shake is a decaying sine on a fixed frequency, so it is
   deterministic and bounded by SHAKE_MAX, which the on screen check in
   the probes relies on. */
import { TUNE } from '../tune.js';

const DEG = Math.PI / 180;

export function createChaseCamera() {
  const state = { yaw: 0, shake: 0, shakeT: 0, fov: TUNE.CAMERA.FOV, portrait: false, initialised: false,
    px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 };

  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  function reset(pose) { state.yaw = pose.yaw; state.shake = 0; state.initialised = true; }

  function hit(speed) {
    const C = TUNE.CAMERA;
    state.shake = Math.min(C.SHAKE_MAX, state.shake + speed * C.SHAKE);
  }

  /* pose: { x, z, yaw, slip, speed }; dt in seconds; writes cam (a
     three.js PerspectiveCamera, or anything with position, lookAt, fov,
     updateProjectionMatrix). */
  function update(pose, dt, cam, aspect) {
    const C = TUNE.CAMERA;
    if (!state.initialised) reset(pose);
    state.portrait = aspect < 1;
    // slip > 0 means the car travels to the left of its nose, so the direction of travel is yaw + slip
    const swing = Math.max(-C.SWING_MAX * DEG, Math.min(C.SWING_MAX * DEG, pose.slip * C.SWING));
    const target = pose.yaw + (pose.speed > 2 ? swing : 0);
    const k = 1 - Math.exp(-dt / Math.max(0.001, C.LAG));
    state.yaw = wrap(state.yaw + wrap(target - state.yaw) * k);
    const dist = (C.DISTANCE + C.DISTANCE_SPEED * pose.speed) * (state.portrait ? C.PORTRAIT_DISTANCE : 1);
    const height = C.HEIGHT * (state.portrait ? C.PORTRAIT_HEIGHT : 1);
    const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
    state.px = pose.x - fx * dist; state.py = height; state.pz = pose.z - fz * dist;
    // the shake: a decaying sine on the look target, sideways and up
    state.shakeT += dt;
    state.shake *= Math.exp(-dt * C.SHAKE_DECAY);
    const sx = Math.sin(state.shakeT * C.SHAKE_HZ * Math.PI * 2) * state.shake;
    const sy = Math.cos(state.shakeT * C.SHAKE_HZ * Math.PI * 2 * 0.77) * state.shake * 0.6;
    const lx = -Math.cos(state.yaw), lz = Math.sin(state.yaw);
    const look = C.LOOK_AHEAD * (state.portrait ? C.PORTRAIT_LOOK : 1);
    state.tx = pose.x + fx * look + lx * sx; state.ty = C.LOOK_UP + sy; state.tz = pose.z + fz * look + lz * sx;
    state.fov = (state.portrait ? C.FOV_PORTRAIT : C.FOV) + C.FOV_SPEED * pose.speed;
    if (cam) {
      cam.position.set(state.px, state.py, state.pz);
      cam.lookAt(state.tx, state.ty, state.tz);
      if (cam.fov !== state.fov) { cam.fov = state.fov; cam.updateProjectionMatrix(); }
    }
  }

  /* The menu camera: a slow orbit around a point on the start line, for
     the title and the garage, written straight to the three.js camera. */
  function orbit(centre, t, cam, aspect) {
    const C = TUNE.CAMERA;
    const portrait = aspect < 1;
    const ang = t * 0.25, dist = portrait ? 11 : 9, height = portrait ? 4.2 : 3.2;
    cam.position.set(centre.x + Math.sin(ang) * dist, height, centre.z + Math.cos(ang) * dist);
    cam.lookAt(centre.x, 0.9, centre.z);
    const fov = portrait ? C.FOV_PORTRAIT : C.FOV;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  return { state, update, reset, hit, orbit };
}

/* Is the car's whole box on screen? Projects the eight corners of the
   body's bounding box through the camera and returns the worst normalised
   device coordinate excess (0 or less means fully on screen), with the
   corner that was worst. The probes call this every frame. */
export function carOnScreen(THREE, cam, pose, dims, margin) {
  const hl = dims.halfLength, hw = dims.halfWidth, h = dims.height;
  const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw);
  let worst = -Infinity, worstCorner = null;
  const v = new THREE.Vector3();
  for (const f of [-hl, hl]) for (const l of [-hw, hw]) for (const y of [0, h]) {
    v.set(pose.x + fx * f + lx * l, y, pose.z + fz * f + lz * l);
    v.project(cam);
    const ex = Math.max(Math.abs(v.x) - (1 - (margin || 0)), Math.abs(v.y) - (1 - (margin || 0)), v.z > 1 ? 1 : -1);
    if (ex > worst) { worst = ex; worstCorner = { f, l, y, ndcX: v.x, ndcY: v.y }; }
  }
  return { excess: worst, corner: worstCorner, onScreen: worst <= 0 };
}
