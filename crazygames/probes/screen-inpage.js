/* SCREEN AGREEMENT, IN PAGE. Stage 2 "Done" 2: what the player sees is
   what the simulation decides. On every sampled frame this reads what the
   renderer DREW (the car meshes' world positions, the road strip's vertex
   buffer, the hazard and gate quads by their tags) and compares it with
   the simulation's own numbers, in the road frame and on screen. It never
   asks the renderer where it meant to put things. */
(function (root) {
  'use strict';
  const S = () => root.__S;
  function vec(p, o) { return { x: p[o], y: p[o + 1], z: p[o + 2] }; }
  /* The six vertices of quad q in a strip, in the order strip.quad wrote them: a b c a c d. */
  function quadCorners(strip, q) { const o = q * 18, p = strip.pos; return { a: vec(p, o), b: vec(p, o + 3), c: vec(p, o + 6), d: vec(p, o + 15) }; }
  function findQuad(strip, pred) { for (let q = 0; q < strip.n; q++) { const t = strip.tags[q]; if (t && pred(t)) return q; } return -1; }
  function findQuads(strip, pred) { const out = []; for (let q = 0; q < strip.n; q++) { const t = strip.tags[q]; if (t && pred(t)) out.push(q); } return out; }
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y, z: p.z - q.z });
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 });
  const lerp = (p, q, u) => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u, z: p.z + (q.z - p.z) * u });
  const len2 = v => Math.hypot(v.x, v.z);
  /* Where a point sits against a drawn road quad. The quad is a bilinear
     patch between two straight cross sections (near a to b, far d to c),
     and the point's (lateral, along) is the inverse of that map in the
     plan, solved by Newton from the chord estimate; on a curve the two
     cross sections are not parallel and a plain projection on the centre
     chord is off by the lateral times the turn. Height is against the
     surface at that (lateral, along). */
  function againstQuad(P, qc) {
    const N0 = qc.a, N1 = qc.b, F0 = qc.d, F1 = qc.c;   // near left, near right, far left, far right
    // X(t, u) = (1-u)((1-t)N0 + t N1) + u((1-t)F0 + t F1), t in 0..1 across, u in 0..1 along
    let t = 0.5, u = 0.5;
    {
      const near = mid(N0, N1), far = mid(F0, F1);
      const axis = sub(far, near), al = len2(axis);
      const rel = sub(P, near);
      u = (rel.x * axis.x + rel.z * axis.z) / (al * al);
      const rx = N1.x - N0.x, rz = N1.z - N0.z, rl = Math.hypot(rx, rz);
      t = 0.5 + (rel.x * rx + rel.z * rz) / (rl * rl);
    }
    for (let it = 0; it < 4; it++) {
      const X = { x: (1 - u) * ((1 - t) * N0.x + t * N1.x) + u * ((1 - t) * F0.x + t * F1.x), z: (1 - u) * ((1 - t) * N0.z + t * N1.z) + u * ((1 - t) * F0.z + t * F1.z) };
      const dXt = { x: (1 - u) * (N1.x - N0.x) + u * (F1.x - F0.x), z: (1 - u) * (N1.z - N0.z) + u * (F1.z - F0.z) };
      const dXu = { x: ((1 - t) * F0.x + t * F1.x) - ((1 - t) * N0.x + t * N1.x), z: ((1 - t) * F0.z + t * F1.z) - ((1 - t) * N0.z + t * N1.z) };
      const ex = P.x - X.x, ez = P.z - X.z;
      const det = dXt.x * dXu.z - dXt.z * dXu.x;
      if (Math.abs(det) < 1e-9) break;
      t += (ex * dXu.z - ez * dXu.x) / det;
      u += (dXt.x * ez - dXt.z * ex) / det;
    }
    const width = (1 - u) * Math.hypot(N1.x - N0.x, N1.z - N0.z) + u * Math.hypot(F1.x - F0.x, F1.z - F0.z);
    const hw = width / 2;
    const lateral = (t - 0.5) * width;
    const surfaceY = (1 - u) * ((1 - t) * N0.y + t * N1.y) + u * ((1 - t) * F0.y + t * F1.y);
    return { frac: lateral / hw, u, t, height: P.y - surfaceY, lateral, hw, leftEdge: lerp(N0, F0, u), rightEdge: lerp(N1, F1, u) };
  }
  const stats = { frames: 0, checks: {}, worst: {}, counts: {}, fails: [] };
  function note(name, value, limit, detail) {
    const c = stats.checks[name] = stats.checks[name] || { n: 0, fail: 0, worst: 0, sum: 0 };
    c.n++; c.sum += Math.abs(value);
    if (Math.abs(value) > c.worst) { c.worst = Math.abs(value); c.worstDetail = detail; }
    if (Math.abs(value) > limit) { c.fail++; if (stats.fails.length < 40) stats.fails.push(name + ' ' + value.toFixed(4) + ' > ' + limit + ' ' + JSON.stringify(detail)); }
  }
  function count(name) { stats.counts[name] = (stats.counts[name] || 0) + 1; }
  const TOL = { frac: 0.01, units: 25, px: 2.0, height: 10, contactGap: 90, hitOverlap: 1 };

  function sample(n, info) {
    const s = S(), W = s.world, P = W.probe, F = s.get('FEEL');
    const st = s.get('state'), DRIVING = s.get('DRIVING'), DEAD = s.get('DEAD');
    const strips = P.strips, road = strips.road, blocks = strips.blocks;
    stats.frames++;
    const cars = P.cars();
    const carS = s.get('position') + F.CAMERA_DISTANCE;
    const carIdx = Math.floor(carS / F.SEGMENT_LENGTH);
    const axleS = s.fn.rearAxleZ();
    const axleIdx = Math.floor(axleS / F.SEGMENT_LENGTH);
    const seg = s.fn.segAt(carIdx), axleSeg = s.fn.segAt(axleIdx);
    const driving = st === DRIVING && !s.fn.countHolding();
    if (cars.player.visible && seg) {
      /* 1. the car against the drawn road: the pivot's world position is the
         car's reference point CAR_YAW_PIVOT ahead of its centre. The centre
         is the body group's origin. */
      const body = cars.player.userData.body;
      const centre = P.worldPos(body);
      const q = findQuad(road, t => t.kind === 'surface' && t.seg === carIdx);
      if (q >= 0) {
        const ag = againstQuad(centre, quadCorners(road, q));
        // the body's centre is the yaw pivot's offset off the car's bookkeeping position, as the original's carToWorld has it
        const yaw = s.fn.carYaw();
        /* in units, because the simulation's half width is one number per
           segment while both renderers draw the width as a ramp between
           boundaries, so a fraction of the drawn width is not the
           simulation's fraction where the road is changing width */
        const simX = s.get('carX') + s.fn.bodyOffsetX(yaw);
        note('car centre vs road frame (units)', ag.lateral - simX, TOL.units, { n, lateral: ag.lateral, simX, frac: ag.frac, state: st });
        note('car centre along the road vs position (units)', (ag.u + carIdx) * F.SEGMENT_LENGTH - (carS + s.fn.bodyOffsetZ(yaw)), 12, { n });
        /* height: the car sits carY above the road (on the ramp deck or in the air) */
        const wheels = cars.player.userData.wheels;
        const wr = F.CAR_WHEEL_DIAMETER / 2;
        let minH = Infinity;
        for (const w of wheels) { const p = P.worldPos(w); const qq = findQuad(road, t => t.kind === 'surface' && t.seg === Math.floor(toRoadS(p) / F.SEGMENT_LENGTH)); if (qq < 0) continue; const a = againstQuad(p, quadCorners(road, qq)); minH = Math.min(minH, a.height - wr); }
        if (minH < Infinity && st !== DEAD) {
          note('car height above drawn road vs carY (units)', minH - s.get('carY'), TOL.height, { n, drawn: minH, carY: s.get('carY'), airborne: s.get('airborne') });
          if (s.get('airborne')) { count('airborne frames'); if (minH <= TOL.height) count('airborne but drawn on the road'); }
          else if (s.get('carY') === 0 && minH > TOL.height) count('on the road but drawn in the air');
        }
      }
      /* 2. the rear wheels against the drawn edges, in the road frame and on
         screen, each wheel against the quads of the segment it is actually
         over (a yawed car's wheels straddle segments) */
      if (axleSeg && st !== DEAD) {
        const contacts = s.fn.rearWheelOffsets(s.get('carX'));
        const wheels = cars.player.userData.wheels;   // 0 front left, 1 front right, 2 rear left, 3 rear right
        for (const [k, simX] of [[2, contacts.left], [3, contacts.right]]) {
          const wp = P.worldPos(wheels[k]); wp.y -= F.CAR_WHEEL_DIAMETER / 2;
          const wIdx = Math.floor(toRoadS(wp) / F.SEGMENT_LENGTH);
          const qs = findQuad(road, t => t.kind === 'surface' && t.seg === wIdx);
          const lipL = findQuad(road, t => t.kind === 'lip' && t.seg === wIdx && t.a0 < 0), lipR = findQuad(road, t => t.kind === 'lip' && t.seg === wIdx && t.a0 > 0);
          if (qs >= 0 && lipL >= 0 && lipR >= 0) {
            const qc = quadCorners(road, qs), ql = quadCorners(road, lipL), qr = quadCorners(road, lipR);
            const ag = againstQuad(wp, qc);
            note('rear wheel vs road frame (units)', ag.lateral - simX, TOL.units, { n, wheel: k, lateral: ag.lateral, simX });
            if (s.get('carY') !== 0) continue;   // in the air or on a ramp the wheel is above the surface the lips are on
            /* on screen: the wheel between the two drawn outer lip edges at the same place along the road */
            const outerL = lerp(ql.a, ql.d, ag.u), outerR = lerp(qr.b, qr.c, ag.u);
            const pw = P.project(wp.x, wp.y, wp.z), pl = P.project(outerL.x, outerL.y, outerL.z), pr = P.project(outerR.x, outerR.y, outerR.z);
            const EO = 1 + F.RUMBLE_WIDTH_FRACTION;
            /* where the simulation puts the wheel, as a point on the drawn
               cross section between the two outer lip edges, projected: a
               fraction along a line is not kept by perspective, a point is */
            const expectFrac = (simX / axleSeg.hw + EO) / (2 * EO);
            const e3 = lerp(outerL, outerR, expectFrac);
            const pe = P.project(e3.x, e3.y, e3.z);
            note('rear wheel on screen vs the lips (px)', Math.hypot(pw.sx - pe.sx, pw.sy - pe.sy), TOL.px, { n, wheel: k, sx: pw.sx, sy: pw.sy, expectSx: pe.sx, expectSy: pe.sy, span: pr.sx - pl.sx });
          }
        }
      }
      /* 3. off road, scraping and the edge: at the frame the run ends off road, the drawn car centre is past OFF_ROAD */
      if (info.after === DEAD && info.before === DRIVING && s.get('deathKind') === s.get('OFF_ROAD') && q >= 0) {
        /* the edge kills two ways: past OFF_ROAD at once, or past SCRAPE_START
           for longer than the scrape meter allows; the car's bookkeeping says
           which, and the drawn car must agree with it */
        const ag = againstQuad(centre, quadCorners(road, q));
        const simFrac = (s.get('carX') + s.fn.bodyOffsetX(s.fn.carYaw())) / seg.hw;
        const line = Math.abs(s.get('carFrac')) > F.OFF_ROAD ? F.OFF_ROAD : F.SCRAPE_START;
        count(line === F.OFF_ROAD ? 'off road deaths past the edge' : 'off road deaths on the scrape meter');
        if (Math.abs(ag.lateral) <= line * seg.hw - TOL.units) { count('off road death with the drawn car inside the line'); stats.fails.push('off road death drawn inside the line at frame ' + n + ' drawn ' + ag.lateral.toFixed(0) + ' line ' + (line * seg.hw).toFixed(0) + ' simFrac ' + simFrac.toFixed(3)); }
      }
      if (driving && s.get('scraping') && q >= 0 && !hazardAlongside(s, carIdx)) {
        count('edge scraping frames');
        const ag = againstQuad(centre, quadCorners(road, q));
        if (Math.abs(ag.lateral) < F.SCRAPE_START * seg.hw - TOL.units) { count('scraping with the drawn car inside the scrape band'); stats.fails.push('scraping drawn inside the band at frame ' + n + ' drawn ' + ag.lateral.toFixed(0) + ' band ' + (F.SCRAPE_START * seg.hw).toFixed(0) + ' carFrac ' + s.get('carFrac').toFixed(3) + ' side ' + s.get('scrapeSide')); }
      }
    }
    /* 4. a hit: the drawn car overlaps the drawn hazard's core */
    if (info.after === DEAD && info.before === DRIVING && s.get('deathKind') === s.get('HIT_OBJECT')) {
      count('hits');
      const hz = s.get('hazards').find(h => h.hit && carIdx >= h.from - 1 && carIdx <= h.to + 1) || s.get('hazards').find(h => h.hit);
      const qh = hz && findQuads(blocks, t => t.kind === 'hazard' && t.hazard === hz);
      if (!qh || !qh.length) { count('hit with no drawn hazard'); stats.fails.push('hit at frame ' + n + ' with no drawn hazard'); }
      else {
        // the hazard's top quad is its first quad; its lateral extent in the road frame against the surface quad under the car
        const top = quadCorners(blocks, qh[0]);
        const qs = findQuad(road, t => t.kind === 'surface' && t.seg === carIdx);
        if (qs >= 0) {
          const qc = quadCorners(road, qs);
          const hl = againstQuad(top.a, qc).lateral, hr = againstQuad(top.d, qc).lateral;   // a is the near left corner, d the near right
          const cl = s.get('carX') - F.CAR_BODY_WIDTH / 2, cr = s.get('carX') + F.CAR_BODY_WIDTH / 2;
          const overlap = Math.min(hr, cr) - Math.max(hl, cl);
          note('hit: drawn hazard against the car (overlap units, must be positive)', overlap > 0 ? 0 : overlap, TOL.hitOverlap, { n, hl, hr, cl, cr });
          if (overlap <= 0) count('hit with the drawn hazard clear of the car');
        }
      }
    }
    /* 5. contact: when the ledger says two cars touched (the player and a
       racer, or two racers), the two drawn bodies nearest the contact
       point are touching, within the solver's own spans. */
    const lc = P.lastContacts;
    if (lc.length) {
      const rs = s.get('racers');
      const cands = [];
      if (cars.player.visible) cands.push({ name: 'player', s: carS, x: s.get('carX'), yaw: s.fn.carYaw(), obj: cars.player.userData.body });
      rs.forEach((r, i) => { if (cars.racers[i].visible) cands.push({ name: 'racer ' + i, s: r.z + F.CAMERA_DISTANCE, x: r.x, yaw: r.yaw, obj: cars.racers[i].userData.body }); });
      for (const c of lc) {
        count('contacts');
        const cs = c.z + F.CAMERA_DISTANCE;
        const ranked = cands.map(k => ({ k, d: Math.abs(k.s - cs) + Math.abs(k.x - c.x) })).sort((p, q) => p.d - q.d);
        if (ranked.length < 2 || ranked[1].d > 3000) { count('contact with no drawn pair nearby'); continue; }
        const A = ranked[0].k, B = ranked[1].k;
        const pa = toRoad(P.worldPos(A.obj)), pb = toRoad(P.worldPos(B.obj));
        const dS = pb.s - pa.s, dX = pb.x - pa.x;
        const along = s.fn.spanAlong(A.yaw) + s.fn.spanAlong(B.yaw), across = s.fn.spanAcross(A.yaw) + s.fn.spanAcross(B.yaw);
        const gap = Math.max(Math.abs(dS) - along, Math.abs(dX) - across);
        note('contact: gap between the drawn cars (units, 0 is touching)', Math.max(0, gap), TOL.contactGap, { n, pair: A.name + ' / ' + B.name, dS, dX, along, across });
      }
    }
    /* 6. racers against the drawn road */
    const rs = s.get('racers');
    rs.forEach((r, i) => {
      const car = cars.racers[i];
      if (!car || !car.visible) return;
      const rp = P.worldPos(car.userData.body);
      const rS = r.z + F.CAMERA_DISTANCE, rIdx = Math.floor(rS / F.SEGMENT_LENGTH);
      const rseg = s.fn.segAt(rIdx);
      const qr = findQuad(road, t => t.kind === 'surface' && t.seg === rIdx);
      if (qr < 0 || !rseg) return;
      const ag = againstQuad(rp, quadCorners(road, qr));
      note('racer centre vs road frame (units)', ag.lateral - (r.x + s.fn.bodyOffsetX(r.yaw)), TOL.units, { n, racer: i, lateral: ag.lateral, simX: r.x + s.fn.bodyOffsetX(r.yaw) });
      note('racer along the road vs z (units)', (ag.u + rIdx) * F.SEGMENT_LENGTH - (rS + s.fn.bodyOffsetZ(r.yaw)), 12, { n, racer: i });
    });
    /* 7. gates: at the frame a gate is passed, the drawn gate stood where the car is */
    if (info.before === DRIVING && info.after === DRIVING && s.get('gatesPassed') !== lastGates) {
      if (s.get('gatesPassed') > lastGates) {
        count('gates passed');
        const g = s.fn.gateSegment(s.get('gatesPassed'));
        const qg = findQuad(blocks, t => (t.kind === 'gate' || t.kind === 'finish') && t.seg === g);
        if (qg < 0) { count('gate passed with no drawn gate'); }
        else { const post = quadCorners(blocks, qg); const gs = toRoadS(mid(post.a, post.b)); note('gate drawn at the segment the simulation banked (segments)', gs / F.SEGMENT_LENGTH - g, 1.5, { n, g, drawnSeg: gs / F.SEGMENT_LENGTH }); }
      }
    }
    lastGates = s.get('gatesPassed');
    /* 8. a ramp: while the simulation says the car is riding a ramp, the drawn deck is under it */
    for (const j of s.get('jumps')) {
      if (!j.riding || j.done) continue;
      if (carIdx < j.from || carIdx > j.to) continue;
      count('ramp riding frames');
      const qj = findQuads(blocks, t => t.kind === 'jump' && t.jump === j);
      if (!qj.length) { count('riding a ramp that is not drawn'); continue; }
      const deck = quadCorners(blocks, qj[0]);
      const half = Math.hypot(deck.b.x - deck.a.x, deck.b.z - deck.a.z) / 2;
      const expectHalf = F.JUMP_RAMP_HALF * (s.fn.segAt(j.from) ? s.fn.segAt(j.from).hw : 0);
      note('ramp deck half width drawn vs JUMP_RAMP_HALF (units)', half - expectHalf, 4, { n, half, expectHalf });
    }
  }
  let lastGates = 0;
  /* world point to road coordinates, through the frame table the renderer built */
  function toRoad(p) {
    const T = S().world.probe.table();
    let best = null;
    for (let n = 0; n + 1 < T.count; n++) {
      const ax = T.x[n], az = T.z[n], bx = T.x[n + 1], bz = T.z[n + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const u = ((p.x - ax) * dx + (p.z - az) * dz) / l2;
      if (u < -0.001 || u > 1.001) continue;
      const px = ax + dx * u, pz = az + dz * u;
      const lat = ((p.x - px) * -dz + (p.z - pz) * dx) / Math.sqrt(l2);   // positive to the right of travel: right is (-forward.z, forward.x)
      const d = Math.abs(lat);
      if (!best || d < best.d) best = { d, s: (T.idx[n] + u) * S().get('FEEL').SEGMENT_LENGTH, x: lat };
    }
    return best || { s: NaN, x: NaN };
  }
  function toRoadS(p) { return toRoad(p).s; }
  function toRoadX(p) { return toRoad(p).x; }
  function hazardAlongside(s, carIdx) { return s.get('hazards').some(h => carIdx >= h.from - 2 && carIdx <= h.to + 2); }
  function reset() { stats.frames = 0; stats.checks = {}; stats.counts = {}; stats.fails = []; lastGates = 0; }
  function summary() { const out = { frames: stats.frames, checks: {}, counts: stats.counts, fails: stats.fails }; for (const k in stats.checks) { const c = stats.checks[k]; out.checks[k] = { n: c.n, fail: c.fail, worst: +c.worst.toFixed(4), mean: +(c.sum / Math.max(1, c.n)).toFixed(4), worstDetail: c.worstDetail }; } return out; }
  root.screenProbe = { sample, summary, reset, TOL, _againstQuad: againstQuad };
})(typeof globalThis !== 'undefined' ? globalThis : this);
