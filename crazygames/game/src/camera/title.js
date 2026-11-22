/* THE LIVE TITLE'S CAMERA (briefs/FIRST-MINUTE.md priority 4, behind
   ?first=2). The title's car drives (main.js), and this camera keeps it
   in the clear: the largest stretch of the screen that no button, no
   text and no logo of the title covers (found from the page's own
   layout, freeLand), the car placed in the middle of it by shifting the
   lens (the camera looks at the car, and its view offset moves the car
   to that place, as a shift lens does), at a distance that makes it
   FILL of that stretch. Round the car's front the camera swings slowly
   from one front three quarter view to the other, low, as a
   photographer at the barrier would, so a slide comes at it; a stretch
   much wider than it is tall (a phone's, under its menu) films the car
   from the side instead, which is the car's own long shape. The camera
   follows the way the car travels, not the way it points, so a slide
   shows its angle. Drawn only: nothing here is read by the physics.
   Every number of taste is in TITLE. */
export const TITLE = {
  CELL:        12,      // px: the layout is looked at in cells this big
  MARGIN:      10,      // px kept clear round every button, text and logo
  MIN_SIZE:    56,      // px: a clear stretch smaller than this across is no place for the car; the backdrop then stays as it was
  FILL:        0.62,    // share of the clear stretch the car's box fills, across or up, whichever is tighter
  ASPECT:      [1.7, 2.8],   // the car's box on screen, width over height: from a front three quarter, and from the side
  WIDE:        2.6,     // a clear stretch wider than this many times its height is filmed from the side
  SIDE:        [72, 108],    // degrees round from behind for that: side on, swinging a little either way
  CAR_LONG:    4.6,     // m the car is taken to be long, for that
  NEAR:        5,       // m the camera comes no closer than
  FAR:         34,      // m nor further
  HEIGHT:      0.32,    // the camera's height over the road, as a share of its distance (low)
  SWING:       [125, 215],   // degrees round from straight behind the car the camera swings between: its front left, through straight ahead, to its front right
  SWING_TIME:  14,      // s for one swing across and back
  FOLLOW:      0.35,    // s, how quickly the camera's place follows the way the car travels
  MOVING:      0.02,    // m a frame the car must move for its way to count (else the way it points)
  FOV:         38,      // degrees, vertical: long, so the car reads as itself and not as a wide angle
  SHADE:       [0.62, 0.75],   // the title's shade over the backdrop is opened round the clear stretch (index.html, #screens.liveland): its ellipse's half axes as shares of the stretch's width and height
  /* a device that cannot afford it: the car stops for the rest of the visit (the camera still frames it) before the adaptive quality would step down for the title's sake (LOOK.ADAPT: half of 90 frames over 22 ms) */
  SLOW_MS:     22,      // ms: a frame of the browser's clock longer than this is slow (the adaptive quality's own bar)
  IGNORE_MS:   250,     // a gap this long is the tab hidden or a load, not a slow frame (as the adaptive quality)
  WATCH:       60,      // frames looked at
  WAIT:        60,      // frames on the title before any is judged (the first ones build what is first drawn)
  SLOW_SHARE:  0.33,    // share of the WATCH frames slow that stops the car (20 frames): well before the adaptive quality's 45 of 90
};

/* Can the device afford the live title? frame(ms) each title frame with the
   browser's frame interval; afford() false for good once SLOW_SHARE of
   WATCH frames among the last WATCH were slow. */
export function createTitleGuard() {
  const T = TITLE, ring = new Uint8Array(T.WATCH);
  let n = 0, at = 0, slow = 0, seen = 0, ok = true;
  return {
    frame(ms) {
      if (!ok || !(ms > 0) || ms > T.IGNORE_MS) return ok;
      if (++seen <= T.WAIT) return ok;
      const s = ms > T.SLOW_MS ? 1 : 0;
      slow += s - (n >= T.WATCH ? ring[at] : 0); ring[at] = s; at = (at + 1) % T.WATCH; n = Math.min(T.WATCH, n + 1);
      if (slow >= T.SLOW_SHARE * T.WATCH) ok = false;   // not waiting for a full window: the adaptive quality's own must never fill with the title's slow frames
      return ok;
    },
    afford: () => ok,
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

/* The largest clear stretch of the screen: rects is every box to keep
   clear ({ left, top, right, bottom } in px), w and h the screen's size.
   The screen is cut into cells, a cell under a box (with MARGIN) is
   taken, and the rectangle of free cells that holds the biggest car
   (carAcross) wins, the bigger stretch of two that hold the same.
   Returns { x, y, w, h } in px, or null when nothing of MIN_SIZE is clear. */
const side = land => land.w > land.h * TITLE.WIDE;
/* how long the car can be on screen in a stretch, in px, before FILL */
export const carAcross = land => Math.min(land.w, land.h * TITLE.ASPECT[side(land) ? 1 : 0]);
export function freeLand(rects, w, h) {
  const T = TITLE, cs = T.CELL, cols = Math.max(1, Math.floor(w / cs)), rows = Math.max(1, Math.floor(h / cs));
  const taken = new Uint8Array(cols * rows);
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor((r.left - T.MARGIN) / cs)), x1 = Math.min(cols - 1, Math.floor((r.right + T.MARGIN) / cs));
    const y0 = Math.max(0, Math.floor((r.top - T.MARGIN) / cs)), y1 = Math.min(rows - 1, Math.floor((r.bottom + T.MARGIN) / cs));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) taken[y * cols + x] = 1;
  }
  /* the biggest rectangle of free cells: each row's run of free cells upwards, then every span along the row */
  const up = new Int32Array(cols);
  let best = null, bestScore = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) up[x] = taken[y * cols + x] ? 0 : up[x] + 1;
    for (let x = 0; x < cols; x++) {
      let hgt = Infinity;
      for (let x2 = x; x2 < cols && up[x2] > 0; x2++) {
        hgt = Math.min(hgt, up[x2]);
        const rw = (x2 - x + 1) * cs, rh = hgt * cs, score = carAcross({ w: rw, h: rh }) + rw * rh * 1e-6;
        if (score > bestScore) { bestScore = score; best = { x: x * cs, y: (y - hgt + 1) * cs, w: rw, h: rh }; }
      }
    }
  }
  return best && carAcross(best) >= T.MIN_SIZE ? best : null;
}

export function createTitleCamera() {
  const s = { yaw: 0, init: false, t: 0, land: null, x: 0, z: 0 };
  /* pose: the car's interpolated pose; cam: the three.js camera; view:
     { w, h }; land: the clear stretch (freeLand) or null */
  function update(pose, dt, cam, view, land) {
    const T = TITLE;
    s.t += dt;
    if (!s.init) { s.yaw = pose.yaw; s.x = pose.x; s.z = pose.z; s.init = true; }
    /* the camera follows the way the car travels (it faces -Z at yaw 0), with a lag; at a standstill, the way it points */
    const dx = pose.x - s.x, dz = pose.z - s.z, way = Math.hypot(dx, dz) > T.MOVING ? Math.atan2(-dx, -dz) : pose.yaw;
    s.x = pose.x; s.z = pose.z;
    let d = way - s.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    s.yaw += d * (1 - Math.exp(-dt / T.FOLLOW));
    const sw = land && side(land) ? T.SIDE : T.SWING;
    const k = 0.5 - 0.5 * Math.cos(s.t / T.SWING_TIME * Math.PI * 2), round = lerp(sw[0], sw[1], k) * Math.PI / 180;
    /* how far: the car's box FILL of the clear stretch */
    const fovR = T.FOV * Math.PI / 180, across = land ? carAcross(land) * T.FILL : view.w * 0.4;
    const tanH = Math.tan(fovR / 2) * view.w / view.h;   // the horizontal half view's tangent
    let dist = T.CAR_LONG * view.w / (across * 2 * tanH);
    dist = Math.max(T.NEAR, Math.min(T.FAR, dist));
    const a = s.yaw + round, y0 = pose.y || 0;
    /* behind the car is +sin, +cos of its yaw (it faces -Z at yaw 0) */
    cam.position.set(pose.x + Math.sin(a) * dist, y0 + dist * T.HEIGHT + 0.6, pose.z + Math.cos(a) * dist);
    cam.lookAt(pose.x, y0 + 0.6, pose.z);
    if (cam.fov !== T.FOV) { cam.fov = T.FOV; cam.updateProjectionMatrix(); }
    /* the shift: the car, in the middle of the view, moved to the middle of the clear stretch */
    if (land) {
      const cx = land.x + land.w / 2, cy = land.y + land.h / 2;
      cam.setViewOffset(view.w, view.h, view.w / 2 - cx, view.h / 2 - cy, view.w, view.h);
    } else if (cam.view && cam.view.enabled) cam.clearViewOffset();
    s.land = land;
  }
  function release(cam) { if (cam.view && cam.view.enabled) cam.clearViewOffset(); s.init = false; }
  return { state: s, update, release };
}
