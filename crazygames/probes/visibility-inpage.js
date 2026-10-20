/* VISIBILITY, IN PAGE. Stage 2 "Done" 3.

   Two questions, answered against what the renderer draws:
   - how many seconds of road ahead are in view at top speed, which is the
     contiguous run of segment centres ahead of the car that project
     inside the screen and are not hidden by the drawn road, walls,
     terrain or blocks (a ray from the camera to each);
   - when a hazard or a jump first becomes visible and unoccluded, swept
     by car position, against the original's own rule for the same
     thing, replicated here from drawRoad: the painter's test on the
     anisotropic projection with the reference camera.

   The replica is checked against the original page's own bvis table
   frame by frame (probes/visibility.js, known answer A). */
(function (root) {
  'use strict';
  const S = () => root.__S;

  /* ---- the original's visibility rule, from index.html drawRoad ----
     For a car at `position`, returns the visibility table for the
     segments ahead: bvis[n] for n = 0..count, with bx and the per boundary
     screen y, exactly as drawRoad computes them, at viewport w x h and
     camera height camHeight. */
  function originalTable(position, w, h, camHeight, cameraX) {
    const s = S(), F = s.get('FEEL');
    const seg = F.SEGMENT_LENGTH;
    const baseIndex = Math.floor(position / seg);
    const base = s.fn.segAt(baseIndex);
    if (!base) return null;
    const percent = (position - baseIndex * seg) / seg;
    const CAMERA_DEPTH = 1 / Math.tan((F.FIELD_OF_VIEW_DEG / 2) * Math.PI / 180);
    const horizonY = Math.round(h * F.HORIZON_FRACTION);
    const camX = cameraX || 0;
    let x = 0, dx = -(base.curve * s.get('curveScale') * percent);
    const carZ = position + F.CAMERA_DISTANCE;
    const carIdx = Math.floor(carZ / seg);
    const carSegFrac = (carZ - carIdx * seg) / seg;
    const carGroundY = s.fn.segHeight(carIdx) + (s.fn.segHeight(carIdx + 1) - s.fn.segHeight(carIdx)) * carSegFrac;
    const want = Math.min(F.DRAW_DISTANCE_SEGMENTS, 519);
    const bx = [], by = [], bz = [], bw = [];
    let count = 0, lastHw = base.hw;
    for (let k = 0; k <= want; k++) {
      const sg = s.fn.segAt(baseIndex + k);
      if (sg) lastHw = sg.hw;
      const dz = (baseIndex + k) * seg - position;
      const scale = CAMERA_DEPTH / dz;
      bx[k] = w / 2 + scale * (x - camX) * w / 2;
      by[k] = horizonY + scale * camHeight * h / 2 - scale * (s.fn.segHeight(baseIndex + k) - carGroundY) * w / 2;
      bw[k] = scale * lastHw * w / 2;
      bz[k] = dz;
      count = k;
      if (!sg) break;
      x += dx;
      dx += sg.curve * s.get('curveScale');
    }
    let maxy = h;
    const bvis = new Uint8Array(count + 1);
    for (let n = 0; n < count; n++) {
      const sg = s.fn.segAt(baseIndex + n);
      bvis[n] = 0;
      if (!sg) break;
      if (bz[n] <= CAMERA_DEPTH || by[n + 1] >= by[n] || by[n + 1] >= maxy) continue;
      bvis[n] = 1;
      maxy = by[n + 1];
    }
    return { baseIndex, count, bvis, bx, by, bw, w, h };
  }
  /* Is a thing standing on segment `at`, offset xFrac half widths, drawn
     and on screen by the original's rule. */
  function originalSees(table, at, xFrac) {
    if (!table) return false;
    const n = at - table.baseIndex;
    if (n < 0 || n >= table.count) return false;
    if (!table.bvis[n]) return false;
    const sx = table.bx[n] + table.bw[n] * (xFrac || 0);
    return sx >= 0 && sx <= table.w;
  }

  /* ---- this renderer ---- */
  /* which: the strips that may hide the point; the default is everything
     the world draws. ['road', 'walls', 'terrain'] is the ground alone,
     which is the only occluder the original's rule knows. */
  function pointVisible(P, p, cam, w, h, which) {
    const pr = P.project(p.x, p.y, p.z);
    if (!pr.inFront || pr.sx < 0 || pr.sx > w || pr.sy < 0 || pr.sy > h) return { visible: false, why: 'off screen' };
    const d = Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z);
    const hit = P.raycast(cam, p, which);
    if (hit < d - 60) { const lh = P.lastHit(); return { visible: false, why: 'occluded by ' + (lh.tag || lh.strip), hit, d }; }
    return { visible: true };
  }
  /* The road visible ahead of the car, in segments: the contiguous run
     from the car (the first centre off screen or hidden ends it) and the
     furthest visible centre (road beyond a dip counts). */
  function visibleRun(w, h, which) {
    const s = S(), P = s.world.probe, F = s.get('FEEL');
    const T = P.table();
    const cam = P.cameraPos();
    let run = 0, furthest = 0, reason = 'draw distance', broken = false;
    for (let n = 0; n + 1 < T.count; n++) {
      const idx = T.idx[n];
      if (idx <= T.carIdx) continue;
      if (!T.ok[n]) { if (!broken) reason = 'road not generated'; break; }
      const p = P.roadPoint(idx * F.SEGMENT_LENGTH, 0, 30);
      const v = pointVisible(P, p, cam, w, h, which);
      if (!v.visible) { if (!broken) { reason = v.why; broken = true; } continue; }
      if (!broken) run = idx - T.carIdx;
      furthest = idx - T.carIdx;
    }
    return { segments: run, furthest, seconds: run * F.SEGMENT_LENGTH / F.SPEED, reason };
  }
  /* The same two numbers by the original's rule at the same car position,
     with the reference camera and this viewport. */
  function originalRun(w, h) {
    const s = S(), F = s.get('FEEL');
    const t = originalTable(s.get('position'), w, h, F.CAMERA_HEIGHT, s.get('cameraX'));
    if (!t) return { segments: 0, furthest: 0 };
    const carIdx = Math.floor((s.get('position') + F.CAMERA_DISTANCE) / F.SEGMENT_LENGTH);
    let run = 0, furthest = 0, broken = false;
    for (let n = 0; n < t.count; n++) {
      const idx = t.baseIndex + n;
      if (idx <= carIdx) continue;
      const vis = t.bvis[n] && t.bx[n] >= 0 && t.bx[n] <= w;
      if (!vis) { broken = true; continue; }
      if (!broken) run = idx - carIdx;
      furthest = idx - carIdx;
    }
    return { segments: run, furthest };
  }
  /* Is a hazard or a jump drawn and in view: tested at the points a
     player would see first, the top edge of its near face. */
  function targetPoints(target) {
    const s = S(), P = s.world.probe, F = s.get('FEEL');
    const L = F.SEGMENT_LENGTH;
    if (target.kind === 'jump') {
      const hw = P.hwAt(target.from * L), half = F.JUMP_RAMP_HALF * hw;
      // the lip of the ramp, which is the tall end, and the foot
      return [P.roadPoint((target.to + 1) * L, -half, F.JUMP_RAMP_HEIGHT + 40), P.roadPoint((target.to + 1) * L, half, F.JUMP_RAMP_HEIGHT + 40), P.roadPoint((target.to + 1) * L, 0, F.JUMP_RAMP_HEIGHT + 40), P.roadPoint(target.from * L, 0, 40)];
    }
    const hw = P.hwAt(target.from * L);
    const x = (target.kind === 'mover' ? target.x : target.x) * hw;
    const H = s.world.probe.W.HAZARD_HEIGHT;
    return [P.roadPoint(target.from * L, x - target.half, H), P.roadPoint(target.from * L, x + target.half, H), P.roadPoint(target.from * L, x, H), P.roadPoint(target.from * L, x, H / 2)];
  }
  function targetVisible(target, w, h, which) {
    const s = S(), P = s.world.probe;
    // not drawn at all beyond the table the renderer built this frame
    const T = P.table();
    const at = target.kind === 'jump' ? target.to + 1 : target.from;
    if (at > T.idx[T.count - 1] || at < T.idx[0]) return false;
    const cam = P.cameraPos();
    for (const p of targetPoints(target)) { const v = pointVisible(P, p, cam, w, h, which); if (v.visible) return true; }
    return false;
  }
  /* Put the car at segment `p` (its front, as the simulation's carSegIndex
     counts), generate the road there, rebuild the world. */
  function placeAt(p, w, h) {
    const s = S(), F = s.get('FEEL');
    const position = p * F.SEGMENT_LENGTH - F.CAMERA_DISTANCE;
    s.set('position', position);
    s.set('prevCarIndex', s.get('carSegIndex'));
    s.set('carSegIndex', Math.floor((position + F.CAMERA_DISTANCE) / F.SEGMENT_LENGTH));
    s.set('runTime', Math.max(0, position) / F.SPEED);
    s.fn.updateDifficulty();
    s.fn.topUpRoad(Math.floor(position / F.SEGMENT_LENGTH));
    s.world.probe.rebuild(w, h);
    return position;
  }
  /* Every hazard and jump on the road from here to `end`, keyed like the
     parity probe's road job keys them, with the car walked ahead to
     generate them and then put back. */
  function listTargets(end, w, h) {
    const s = S(), F = s.get('FEEL');
    const hz = new Map(), jp = new Map();
    for (let seg = 0; seg <= end; seg += 30) {
      placeAt(seg + Math.floor(F.CAMERA_DISTANCE / F.SEGMENT_LENGTH), w, h);
      for (const z of s.get('hazards')) { const k = z.kind + ':' + z.from; if (!hz.has(k)) hz.set(k, { kind: z.kind === s.get('HAZ_MOVER') ? 'mover' : z.kind === s.get('HAZ_SPLITTER') ? 'splitter' : 'blocker', from: z.from, to: z.to, x: z.x, half: z.half, swing: z.swing }); }
      for (const j of s.get('jumps')) if (!jp.has(j.from)) jp.set(j.from, { kind: 'jump', from: j.from, to: j.to });
    }
    return [...hz.values(), ...jp.values()].sort((a, b) => a.from - b.from);
  }
  /* The sweep for one target: the first car segment, from `start` up to
     the target, at which it is visible here and by the original's rule. */
  function sweep(target, start, w, h, camHeight) {
    const s = S(), F = s.get('FEEL');
    // a fresh road, because the simulation trims behind the camera and the
    // sweep walks forward from well before the target
    s.fn.startRun();
    let mine = null, orig = null;
    const xFrac = target.kind === 'jump' ? 0 : target.x;
    const at = target.kind === 'jump' ? target.to + 1 : target.from;
    for (let p = start; p <= target.from; p += 2) {
      const position = placeAt(p, w, h);
      const generated = s.fn.segAt(at);
      if (orig === null && generated) { const t = originalTable(position, w, h, camHeight, 0); if (originalSees(t, at, xFrac)) orig = p; }
      if (mine === null && generated && targetVisible(target, w, h)) mine = p;
      if (mine !== null && orig !== null) break;
    }
    // refine each to the segment, one step back
    const refine = (p, test) => { if (p === null || p <= start) return p; placeAt(p - 1, w, h); return test(p - 1) ? p - 1 : p; };
    mine = refine(mine, () => s.fn.segAt(at) && targetVisible(target, w, h));
    orig = refine(orig, q => { const t = originalTable(q * F.SEGMENT_LENGTH - F.CAMERA_DISTANCE, w, h, camHeight, 0); return !!s.fn.segAt(at) && originalSees(t, at, xFrac); });
    return { mine, orig };
  }
  root.visibilityProbe = { originalTable, originalSees, visibleRun, originalRun, targetVisible, placeAt, listTargets, sweep, pointVisible };
})(typeof globalThis !== 'undefined' ? globalThis : this);
