/* THE DIRECTOR (briefs/SPECTACLE.md 3): the camera's big moments, laid
   over the chase camera without touching it. The chase camera
   (camera/chase.js, TUNE.CAMERA, set by the author through play) runs
   every frame exactly as before; the director then moves the three.js
   camera on from where the chase camera put it, and only:

   - over the countdown, a sweep that starts in front of the car, low,
     and swings round beside it to end exactly on the chase camera
     well before GO (the countdown's length is unchanged, and nothing
     about the controls is);
   - when a big chain is banked, a kick: the view pulls back and widens
     for a moment, more for a bigger multiplier;
   - on a hard hit, a harder shake than the chase camera's own;
   - at the finish, the camera swings round to look at the car side on
     while the run plays out in slow motion, then holds there behind the
     results. Slow motion is only ever after the line: the score is
     settled when the car crosses it, and the physics steps it takes in
     slow motion are the same steps, only drawn over more frames.

   Drawn only: nothing here is read by the physics or the score. Every
   number of taste is in DIRECTOR. */
export const DIRECTOR = {
  /* the countdown's sweep, over u from 0 (the countdown starts) to 1 (GO) */
  SWEEP_END:      0.8,     // share of the countdown by which the camera is on the chase camera
  SWEEP_AHEAD:    6.0,     // m in front of the car the sweep starts, low, looking back at its face
  SWEEP_LOW:      1.2,     // m above the road there
  SWEEP_RISE:     1.5,     // m it rises as it swings round beside the car (kept under a start gantry's banner, 2.9 m up)
  SWEEP_SIDE:     4.2,     // m out to the side halfway round, staying over the road
  SWEEP_LOOK_UP:  1.6,     // m above the road the sweep looks, over the roof, so the car sits under the countdown's number and not behind it
  /* the kick when a chain is banked */
  KICK_FROM:      3,       // the multiplier a banked chain needs
  KICK_BACK:      [0.9, 2.2],   // m the view pulls back, at KICK_FROM and at x8
  KICK_FOV:       [4, 9],  // degrees wider
  KICK_TIME:      0.5,     // s for it to settle
  /* the shake on a hard hit, on top of the chase camera's */
  HIT_SHAKE:      0.22,    // m
  HIT_SHAKE_TIME: 0.4,     // s
  HIT_SHAKE_HZ:   17,
  /* the finish */
  SLOW:           0.28,    // the speed of time after the line
  SLOW_EASE:      0.18,    // s for time to slow
  SIDE_DIST:      6.8,     // m to the side of the car
  SIDE_AHEAD:     1.2,     // m ahead of it
  SIDE_HEIGHT:    1.5,     // m above the road
  SIDE_TIME:      0.75,    // s for the camera to swing round
  SIDE_FOV:       48,      // degrees
};

const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function createDirector(THREE) {
  const s = { kick: 0, kickK: 0, shake: 0, shakeT: 0, finishT: -1, side: 1, timeScale: 1, fx: 0, fz: 0 };
  const look = new THREE.Vector3(), dir = new THREE.Vector3(), from = new THREE.Vector3();

  function reset() { s.kick = 0; s.shake = 0; s.finishT = -1; s.timeScale = 1; }
  /* a banked chain: the value and its multiplier */
  function bank(mult) { if (mult >= DIRECTOR.KICK_FROM) { s.kick = 1; s.kickK = Math.min(1, (mult - DIRECTOR.KICK_FROM) / Math.max(1, 8 - DIRECTOR.KICK_FROM)); } }
  function hardHit() { s.shake = 1; }
  /* the line is crossed: the slow motion and the swing begin; side is
     the car's left (1) or right (-1), whichever has more room */
  function finish(side) { if (s.finishT < 0) { s.finishT = 0; s.side = side || 1; } }

  /* After chase.update has written cam. mode: 'countdown' (u, 0 to 1),
     'drive', 'finish' (from the line to the results and behind them). */
  function apply(mode, pose, cam, dt, u, chaseState) {
    const D = DIRECTOR;
    const y0 = pose.y || 0;
    if (mode === 'countdown') {
      const k = ease(Math.min(1, u / D.SWEEP_END));
      if (k >= 1) return;
      /* round the car at the height of its roof, from in front of it (phi = pi) by its side to behind it (phi = 0), staying over the road */
      const phi = (1 - k) * Math.PI;
      const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw);
      const along = -Math.cos(phi) * D.SWEEP_AHEAD, up = D.SWEEP_LOW + Math.sin(phi) * D.SWEEP_RISE, side = Math.sin(phi) * D.SWEEP_SIDE;
      const px = pose.x + fx * along + lx * side, pz = pose.z + fz * along + lz * side, py = y0 + up;
      /* blended into the chase camera's own position and look, so it lands on it exactly */
      const w = ease(Math.max(0, (k - 0.55) / 0.45));
      cam.position.set(lerp(px, chaseState.px, w), lerp(py, chaseState.py, w), lerp(pz, chaseState.pz, w));
      look.set(lerp(pose.x, chaseState.tx, w), lerp(y0 + D.SWEEP_LOOK_UP, chaseState.ty, w), lerp(pose.z, chaseState.tz, w));
      cam.lookAt(look);
      return;
    }
    if (mode === 'finish' && s.finishT >= 0) {
      s.finishT += dt;
      const k = ease(s.finishT / D.SIDE_TIME);
      const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw) * s.side, lz = Math.sin(pose.yaw) * s.side;
      const px = pose.x + lx * D.SIDE_DIST + fx * D.SIDE_AHEAD, pz = pose.z + lz * D.SIDE_DIST + fz * D.SIDE_AHEAD, py = y0 + D.SIDE_HEIGHT;
      from.copy(cam.position);
      cam.position.set(lerp(from.x, px, k), lerp(from.y, py, k), lerp(from.z, pz, k));
      look.set(lerp(chaseState.tx, pose.x, k), lerp(chaseState.ty, y0 + 0.7, k), lerp(chaseState.tz, pose.z, k));
      cam.lookAt(look);
      const fov = lerp(cam.fov, D.SIDE_FOV, k);
      if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
      s.timeScale = lerp(1, D.SLOW, ease(s.finishT / D.SLOW_EASE));
      return;
    }
    s.timeScale = 1;
    /* the kick: back along the view and wider, easing out */
    if (s.kick > 0) {
      const e = s.kick * s.kick;
      cam.getWorldDirection(dir);
      cam.position.addScaledVector(dir, -lerp(D.KICK_BACK[0], D.KICK_BACK[1], s.kickK) * e);
      cam.fov += lerp(D.KICK_FOV[0], D.KICK_FOV[1], s.kickK) * e;
      cam.updateProjectionMatrix();
      s.kick = Math.max(0, s.kick - dt / D.KICK_TIME);
    }
    if (s.shake > 0) {
      s.shakeT += dt;
      const a = D.HIT_SHAKE * s.shake * s.shake, w = s.shakeT * D.HIT_SHAKE_HZ * Math.PI * 2;
      cam.position.x += Math.sin(w) * a; cam.position.y += Math.cos(w * 1.3) * a * 0.6; cam.position.z += Math.sin(w * 0.7 + 1) * a;
      s.shake = Math.max(0, s.shake - dt / D.HIT_SHAKE_TIME);
    }
  }
  return { state: s, reset, bank, hardHit, finish, apply, get timeScale() { return s.timeScale; } };
}
