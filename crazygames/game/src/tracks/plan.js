/* THE PLAN VIEW: a track from above on a 2D canvas, in the look's
   colours: run-off, the road (a bridge deck over the road beneath),
   the edges, the barriers by kind with the clipping zones on top, the
   lines and checkpoints, the start and its direction, the radius and
   bank at each apex, and a bridge's deck outlined. Drawn by the track
   browser at /lab/tracks.html and by the game's Track Lab screen.
   Fills the canvas, scaled to fit, at the device's pixel ratio. */
import { LOOK } from './mesh.js';

const hex = n => '#' + n.toString(16).padStart(6, '0');

/* opts: { labels: false } leaves the radius labels off (a small screen). */
export function drawPlan(canvas, track, opts) {
  const o = opts || {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
  canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = o.background || '#24252b'; g.fillRect(0, 0, w, h);
  if (!track) return;
  const b = track.bounds, pad = o.pad === undefined ? 10 : o.pad;
  const bw = b.maxX - b.minX - 50, bh = b.maxZ - b.minZ - 50;
  const sc = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  const ox = w / 2 - ((b.minX + b.maxX) / 2) * sc, oz = h / 2 - ((b.minZ + b.maxZ) / 2) * sc;
  const P = (x, z) => [ox + x * sc, oz + z * sc];
  const C = track.centre, n = C.length, closed = track.kind === 'circuit';
  const side = (c, u) => P(c.x - Math.cos(c.heading) * u, c.z + Math.sin(c.heading) * u);
  // run-off: fill between the edge and the barrier
  for (const [wall, sgn] of [[track.walls[0], 1], [track.walls[1], -1]]) {
    g.fillStyle = hex(LOOK.RUNOFF);
    for (let i = 0; i + 1 < wall.points.length && i + 1 <= (closed ? n : n - 1); i++) {
      const c0 = C[i % n], c1 = C[(i + 1) % n];
      const a = side(c0, sgn * c0.width / 2), bq = side(c1, sgn * c1.width / 2), p0 = P(wall.points[i].x, wall.points[i].z), p1 = P(wall.points[i + 1].x, wall.points[i + 1].z);
      if (Math.hypot(p0[0] - a[0], p0[1] - a[1]) < 0.3 * sc && Math.hypot(p1[0] - bq[0], p1[1] - bq[1]) < 0.3 * sc) continue;
      g.beginPath(); g.moveTo(...a); g.lineTo(...bq); g.lineTo(...p1); g.lineTo(...p0); g.closePath(); g.fill();
    }
  }
  // the road; the lower pass first so a bridge draws over the road beneath
  const m = closed ? n : n - 1;
  const roadQuad = (i, hexFill) => {
    const c0 = C[i], c1 = C[(i + 1) % n];
    const a = side(c0, c0.width / 2), bq = side(c1, c1.width / 2), cq = side(c1, -c1.width / 2), d = side(c0, -c0.width / 2);
    g.fillStyle = hexFill; g.strokeStyle = hexFill; g.lineWidth = 1;
    g.beginPath(); g.moveTo(...a); g.lineTo(...bq); g.lineTo(...cq); g.lineTo(...d); g.closePath(); g.fill(); g.stroke();
  };
  for (let i = 0; i < m; i++) if (C[i].layer !== 1) roadQuad(i, C[i].part === 'cut' ? '#33343b' : hex(LOOK.ROAD));
  for (let i = 0; i < m; i++) if (C[i].layer === 1) roadQuad(i, C[i].part === 'deck' ? hex(LOOK.BRIDGE) : '#45474f');
  // the edges
  g.strokeStyle = hex(LOOK.EDGE); g.lineWidth = Math.max(1, 0.9 * sc);
  for (const sgn of [1, -1]) { g.beginPath(); for (let i = 0; i < n; i++) { const p = side(C[i], sgn * C[i].width / 2); i ? g.lineTo(...p) : g.moveTo(...p); } if (closed) g.closePath(); g.stroke(); }
  // barriers by kind, clips on top
  const kindColour = { concrete: LOOK.WALL, tyres: LOOK.WALL_TYRES, fence: LOOK.WALL_FENCE };
  for (const wall of track.walls) {
    const p = wall.points;
    for (let i = 0; i + 1 < p.length; i++) {
      const s = i * 2;
      let kind = wall.kind;
      if (!wall.cap) for (const sp of wall.spans) if (s >= sp.from && s < sp.to) { kind = sp.kind; break; }
      const clip = !wall.cap && track.clips.some(c => c.side === wall.side && s >= c.from && s < c.to);
      g.strokeStyle = hex(clip ? LOOK.WALL_CLIP : kind === 'tyres' ? 0x7d8698 : kindColour[kind] || LOOK.WALL);
      g.lineWidth = clip ? Math.max(2, 1.2 * sc) : Math.max(1, (kind === 'tyres' ? 0.9 : 0.5) * sc);
      g.beginPath(); g.moveTo(...P(p[i].x, p[i].z)); g.lineTo(...P(p[i + 1].x, p[i + 1].z)); g.stroke();
    }
  }
  // lines and checkpoints
  const line = (along, colour, wdt) => { const c = C[Math.min(n - 1, Math.round(along / 2))]; g.strokeStyle = colour; g.lineWidth = wdt; g.beginPath(); g.moveTo(...side(c, c.width / 2)); g.lineTo(...side(c, -c.width / 2)); g.stroke(); };
  for (const cp of track.checkpoints) line(cp, '#8d92a8', 1.5);
  line(track.startLine, '#ffffff', 3);
  if (track.finish) line(track.finish.along, '#ffffff', 5);
  // the start and its direction
  const s0 = track.start, f = [-Math.sin(s0.yaw), -Math.cos(s0.yaw)];
  const a = P(s0.x, s0.z), bq = P(s0.x + f[0] * 14, s0.z + f[1] * 14);
  g.strokeStyle = '#19d8ff'; g.fillStyle = '#19d8ff'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(...a); g.lineTo(...bq); g.stroke();
  g.beginPath(); g.arc(a[0], a[1], 4, 0, Math.PI * 2); g.fill();
  // corner labels: the radius at each apex, and the bank where a corner is banked
  if (o.labels !== false) {
    g.font = '10px system-ui, sans-serif'; g.textAlign = 'center';
    for (const c of track.corners) {
      const q = C[Math.min(n - 1, Math.round(c.apex / 2))];
      const out = c.dir === 'left' ? -1 : 1;
      const p = side(q, out * (q.width / 2 + 10));
      g.fillStyle = c.bank > 0 ? '#ffd27a' : 'rgba(238,241,247,0.8)';
      g.fillText(Math.round(c.radius) + (c.radiusEnd && Math.abs(c.radiusEnd - c.radius) > 1 ? ' to ' + Math.round(c.radiusEnd) : '') + ' m' + (c.bank > 0 ? ', ' + Math.round(c.bank) + '°' : ''), p[0], p[1] + 3);
    }
  }
  // the bridge: its deck outlined
  for (const br of track.bridges || []) {
    const i0 = Math.round(br.deck[0] / 2), i1 = Math.round(br.deck[1] / 2);
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.setLineDash([4, 3]);
    g.beginPath();
    for (let i = i0; i <= i1; i++) { const c = C[((i % n) + n) % n], p = side(c, c.width / 2 + 1.5); i === i0 ? g.moveTo(...p) : g.lineTo(...p); }
    for (let i = i1; i >= i0; i--) { const c = C[((i % n) + n) % n], p = side(c, -c.width / 2 - 1.5); g.lineTo(...p); }
    g.closePath(); g.stroke(); g.setLineDash([]);
  }
}
