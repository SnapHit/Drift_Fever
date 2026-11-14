/* THE LINES THE SCRIPTED HANDS DRIVE, one for each challenge, each from
   the park's own start (briefs/PLAYGROUND.md measure 3). A line is only
   where the hands are asked to go and where a slide is wanted; what
   they do with it is theirs, and what the judge counts is the judge's.
   No imports: the probes hand this to the page and to Node alike.
   P is PARK (src/park/layout.js), H the hands' line makers. */
export function parkLines(P, H) {
  const { line, arc, join, smooth } = H;
  const S = P.START, D = P.DONUT, A = P.EIGHT.a, B = P.EIGHT.b, W = P.WALL, Sl = P.SLALOM, GA = P.GATES[0], GB = P.GATES[1];
  const TAU = Math.PI * 2;
  const L = {};
  /* donuts: up the east side of the pad, then round and round */
  L.donut = (turns, R) => { const r = R || 16; return join(smooth([[S.x, S.z], [D.x + r, 52], [D.x + r, D.z + 22, 1], [D.x + r, D.z, 1]], 20), arc(D.x, D.z, r, 0, -TAU * (turns + 0.6), true), line([[D.x + r, D.z], [D.x + r + 30, D.z - 60]], false)); };
  /* the figure eight: north through the crossing, round the east pillar, across, round the west one */
  L.eight = (links) => {
    const cx = (A.x + B.x) / 2, r = (B.x - A.x) / 2, parts = [smooth([[S.x, S.z], [cx - 8, 55], [cx, 30, 1], [cx, A.z, 1]], 22)];
    for (let k = 0; k < links + 1; k++) parts.push(k % 2 ? arc(A.x, A.z, r, 0, -TAU, true) : arc(B.x, B.z, r, Math.PI, Math.PI + TAU, true));
    parts.push(line([[cx, A.z], [cx, A.z - 50]], false));
    return join(...parts);
  };
  /* the slalom: up the east of the park, round to the west along the cones. lag: the weave drawn that many metres early, since a slide answers late */
  L.slalom = (amp, lag) => {
    const a = amp || 6.5, x1 = Sl.x0 + (Sl.n - 1) * Sl.step, pts = [];
    const ph = (Sl.n - 1) % 2 ? -1 : 1;
    for (let x = x1 + 16; x > Sl.x0 - 16; x--) pts.push({ x, z: Sl.z + a * Math.cos(Math.PI * (x - (lag || 0) - Sl.x0) / Sl.step) * ph, slide: true });
    return join(smooth([[S.x, S.z], [70, 62], [108, 20], [108, -40, 1], [x1 + 16, pts[0].z, 1]], 26), pts, line([[Sl.x0 - 16, pts[pts.length - 1].z], [Sl.x0 - 40, Sl.z + 30]], false));
  };
  /* the wall ride: into the mouth of the curve, then round the inside, tail to the wall, lap after lap */
  L.wall = (laps, off) => {
    const r = W.r - P.SOLID_R - (off || 3.0), a1 = W.to * Math.PI / 180;
    return join(smooth([[S.x, S.z], [-40, 62], [W.x + r, 30, 0, 26], [W.x + r, W.z + 14, 1], [W.x + r, W.z, 1]], 24), arc(W.x, W.z, r, 0, -TAU * (laps || 1) - (TAU - a1) - 0.5, true), line([[W.x + r * Math.cos(a1 + 0.5), W.z - r * Math.sin(-a1 - 0.5)], [W.x + 60, W.z + 40]], false));
  };
  /* a gate: a straight run at it a little to one side, and a flick thrown before it so the slide carves through the gap. Short: north from the start. Long: north through the gate on grip, round, and back south through it at speed. Returns { path, flick } (flick: the hands' option) */
  L.gate = (long, o) => {
    const q = Object.assign(long ? { off: -1.5, lead: 22, dir: 1, hb: 0.3, hold: 1.2 } : { off: 1.5, lead: 16, dir: -1, hb: 0.3, hold: 1.2 }, o || {});
    const x = GA.x + q.off;
    const run = long
      ? smooth([[S.x, S.z], [GA.x, GA.z + 10], [GA.x + 3, GA.z - 30], [3, -48, 0, 14], [x - 6, -64, 0, 12], [x, -44, 0, 14], [x, GA.z - q.lead]], 16)
      : smooth([[S.x, S.z], [x, S.z - 12], [x, GA.z + q.lead]], 12);
    const d = long ? 1 : -1, after = line([[x, GA.z - d * q.lead], [x + q.dir * d * -10, GA.z + d * 14]], true).concat(line([[x + q.dir * d * -10, GA.z + d * 14], [x + q.dir * d * -44, GA.z + d * 30]], false));
    return { path: join(run, after), flick: { at: run.length - 1, dir: q.dir, hb: q.hb, hold: q.hold } };
  };
  /* the open floor: a circle in the east of the park, for the long slide and the big chain, then straight on to bank it */
  L.open = (turns, R) => { const r = R || 22, cx = 100, cz = 50; return join(smooth([[S.x, S.z], [cx - r - 20, 84, 0, 14], [cx - r, cz + 16, 1], [cx - r, cz, 1]], 22), arc(cx, cz, r, Math.PI, Math.PI + TAU * turns, true), line([[cx - r, cz], [cx - r, cz - 55]], false)); };
  /* the grand tour, one chain: east through the narrow gate, north into the long wall's curve and round it, east past the donut pad, south through the first gate, round and north past the eight, west along the cones */
  L.tour = () => {
    const r = W.r - P.SOLID_R - 3.4;
    return join(
      smooth([[S.x, S.z], [-70, 84], [-134, 74, 0, 14], [-134, 46, 0, 12], [GB.x - 14, GB.z, 1], [GB.x + 16, GB.z, 1], [W.x + r + 6, 22, 1], [W.x + r, W.z + 4, 1], [W.x + r, W.z, 1]], 22),
      arc(W.x, W.z, r, 0, -TAU + 1.25, true),
      smooth([[W.x + r * Math.cos(1.25), W.z + r * Math.sin(1.25), 1], [-66, 4, 1], [-34, 6, 1], [GA.x, GA.z - 8, 1, 30], [GA.x, GA.z + 14, 1], [26, 70, 1], [52, 44, 1], [52, -40, 1], [30, Sl.z + 4, 1], [-40, Sl.z + 4, 1], [-60, Sl.z + 30]], 24));
  };
  return L;
}
