/* CORNER WALL PROBE, after play on 5 November 2026: too easy to hit the
   walls in corners and stall. Generated tracks (both kinds,
   difficulty 0.3 and 0.7), the scripted driver drifting every corner
   (corners found from the centre line's curvature: a run tighter than
   CORNER_R metres, padded), one lap or to the finish. Reports wall
   contacts and hard hits per kilometre, stalls (speed under 5 m/s after
   the start), respawns, mean speed and lap time.

   The tracks are generated as the game asks for them (banked, with
   crossovers); --flat drives them flat.

   node game/test/feel/corners.js [seeds] [--json] [--flat] */
import { createWorld, STEP } from '../../src/physics/world.js';
import { createDriver } from '../../src/physics/driver.js';
import { generateTrack } from '../../src/tracks/generate.js';

const N = +(process.argv.find(a => /^\d+$/.test(a)) || 20);
const FLAT = process.argv.includes('--flat');   // the tracks with no height, bank or crossover, as the game drove them before 7 November 2026
const CORNER_R = 70;

function sectionsOf(t) {
  const C = t.centre, n = C.length, secs = {};
  let start = -1, k = 0;
  const curv = i => { const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)]; let d = b.heading - a.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) / 4; };
  for (let i = 0; i <= n; i++) {
    const tight = i < n && curv(i) > 1 / CORNER_R;
    if (tight && start < 0) start = i;
    if (!tight && start >= 0) { if (i - start >= 4) secs['c' + (k++)] = [Math.max(0, start * 2 - 6), i * 2]; start = -1; }
  }
  return secs;
}

function drive(t) {
  t.sections = sectionsOf(t); t.cones = t.cones || [];
  const w = createWorld(t), d = createDriver(t, { drift: '*' });
  const target = t.kind === 'sprint' && t.finish ? t.finish.along : t.length;
  let resp = 0, maxAlong = 0, stalls = 0, slow = false, vSum = 0, n = 0, wrapped = false, last = 0;
  const maxSteps = Math.round(240 / STEP);
  let i = 0;
  for (; i < maxSteps; i++) {
    w.stepWorld(d.input(w)); if (w.respawned && !w.recovered) resp++;
    if (t.kind !== 'sprint' && w.along < last - t.length / 2) wrapped = true;
    last = w.along;
    if (!wrapped) maxAlong = Math.max(maxAlong, w.along);
    if (i * STEP > 3) { const s = w.car.speed < 5; if (s && !slow) stalls++; slow = s; }
    vSum += w.car.speed; n++;
    if (wrapped || maxAlong >= target - 4) break;
  }
  const km = Math.max(0.05, maxAlong / 1000);
  return { done: wrapped || maxAlong >= target - 4, respawned: resp, seconds: +(i * STEP).toFixed(1), km: +km.toFixed(2), contacts: w.hits, hard: w.hardHits, stalls, meanKmh: +(vSum / n * 3.6).toFixed(0) };
}

const rows = [];
for (const kind of ['circuit', 'sprint']) for (const difficulty of [0.3, 0.7]) for (let s = 1; s <= N; s++) {
  const t = generateTrack(s * 7919 + 11, FLAT ? { kind, difficulty, elevation: 0 } : { kind, difficulty });
  rows.push({ kind, difficulty, seed: s * 7919 + 11, ...drive(t) });
}
const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
const km = sum(r => r.km);
const out = { tracks: rows.length, finished: rows.filter(r => r.done).length, contactsPerKm: +(sum(r => r.contacts) / km).toFixed(2), hardPerKm: +(sum(r => r.hard) / km).toFixed(2), stallsPerKm: +(sum(r => r.stalls) / km).toFixed(2), respawnsPerKm: +(sum(r => r.respawned) / km).toFixed(2), meanKmh: +(sum(r => r.meanKmh) / rows.length).toFixed(0), worstContacts: Math.max(...rows.map(r => r.contacts / r.km)).toFixed(1) };
if (process.argv.includes('--json')) console.log(JSON.stringify({ summary: out, rows }, null, 1)); else console.log(JSON.stringify(out));
