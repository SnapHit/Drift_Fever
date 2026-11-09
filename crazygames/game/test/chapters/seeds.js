/* CHOOSING THE PRO AND LEGEND SEEDS BY MEASUREMENT (briefs/CHAPTERS.md 3).
   Every slot of CAREER from index 8 on keeps its settings (kind, length,
   difficulty, style, crossover) and is tried on a fixed list of candidate
   seeds: (chapter + 1) x 1000 + (slot in chapter + 1) x 101, then the
   next ones up. A candidate is kept when:
     - the generator did not fall back to its plain layout, and a slot
       asking for a crossover got its bridge
     - it generates in under GEN_MS (the worst of GEN_REPEAT runs)
     - the scripted careful driver and the scripted drifter both finish
       with 0 respawns (off the track or stuck)
     - the careful driver drives it clean (no wall contact) and earns at
       least one star
     - it has at least BANKED_MIN[chapter] banked corners, so each chapter
       has more banks than the one before (Rookie has 18 in 8 tracks,
       2.25 a track; Pro asks 3 a track and Legend 4)
   The first candidate that passes is the slot's seed; the ones before it
   are recorded with what failed. The Rookie eight are measured the same
   way for comparison. Node's Math is not Chromium's to the last bit, so
   probes.js drives the kept seeds again in the page, and that is the
   record; this is the search.

   node game/test/chapters/seeds.js [--candidates N] [--json]
     writes review/chapters/seeds.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAREER, CHAPTERS, careerSpec, chapterOf, runMetres, lapsFor } from '../../src/loop/modes.js';
import { generateTrack } from '../../src/tracks/generate.js';
import { trackFor } from '../../src/ground/source.js';
import { driveRun } from './run.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const reviewDir = path.resolve(here, '..', '..', '..', 'review', 'chapters');
const args = process.argv.slice(2);
const K = args.includes('--candidates') ? +args[args.indexOf('--candidates') + 1] : 16;
export const GEN_MS = 600, GEN_REPEAT = 3;
export const BANKED_MIN = [0, 3, 4];

export function candidateSeeds(index, k) {
  const c = chapterOf(index), base = (c + 1) * 1000 + (index - CHAPTERS[c].from + 1) * 101;
  return Array.from({ length: k }, (_, j) => base + j);
}

/* What a track is made of. */
export function features(t) {
  const types = {};
  for (const c of t.corners) types[c.type] = (types[c.type] || 0) + 1;
  const laps = lapsFor(t);
  return { kind: t.kind, length: t.length, runMetres: Math.round(runMetres(t, laps)), laps, corners: t.corners.length, banked: t.corners.filter(c => c.bank > 0).length, bridges: (t.bridges || []).length, hairpins: (types.hairpin || 0) + (types.double || 0), clips: (t.clips || []).length, types, measuredDifficulty: +(+t.difficulty).toFixed(2), attempts: t.attempts, fallback: !!t.fallback };
}

/* Measure one spec: generation time, the features, both drivers. */
export function measure(spec) {
  const opts = { kind: spec.kind, difficulty: spec.difficulty, length: spec.length, ...(spec.options || {}) };
  let worst = 0;
  for (let r = 0; r < GEN_REPEAT; r++) { const t0 = performance.now(); generateTrack(spec.seed, opts); worst = Math.max(worst, performance.now() - t0); }
  const t = trackFor(spec);
  const f = features(t);
  const careful = driveRun(t, 'careful'), drifter = driveRun(t, 'drifter');
  return { seed: spec.seed, genMs: Math.round(worst), ...f, careful, drifter };
}

/* The check, and what failed. */
export function check(m, spec) {
  const fails = [];
  if (m.fallback) fails.push('plain layout');
  if (spec.options && spec.options.crossover === 'always' && m.bridges < 1) fails.push('no bridge');
  if (!(m.genMs < GEN_MS)) fails.push('generation ' + m.genMs + ' ms');
  for (const d of ['careful', 'drifter']) {
    if (!m[d].finished) fails.push(d + ' did not finish');
    if (m[d].respawns) fails.push(d + ' ' + m[d].respawns + ' respawns');
  }
  if (m.careful.contacts) fails.push('careful ' + m.careful.contacts + ' wall contacts');
  if (spec.chapter !== undefined && m.banked < BANKED_MIN[spec.chapter]) fails.push(m.banked + ' banked corners, under ' + BANKED_MIN[spec.chapter]);
  if (m.careful.stars < 1) fails.push('careful ' + m.careful.score + ' under the first star ' + m.careful.targets[0]);
  return fails;
}

const slim = m => ({ ...m, careful: slimRun(m.careful), drifter: slimRun(m.drifter) });
const slimRun = r => ({ finished: r.finished, seconds: r.seconds, score: r.score, stars: r.stars, targets: r.targets, contacts: r.contacts, hard: r.hard, respawns: r.respawns, offTrack: r.offTrack, stuck: r.stuck, cleanSectors: r.cleanSectors + '/' + r.sectors, meanKmh: r.meanKmh });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = { rule: 'the first candidate seed that passes every check is the slot\'s seed', genMs: GEN_MS, rookie: [], slots: [] };
  for (let i = 0; i < 8; i++) { const spec = careerSpec(i), m = measure(spec); out.rookie.push({ index: i, name: spec.name, ...slim(m), fails: check(m, spec) }); }
  for (let i = 8; i < CAREER.length; i++) {
    const base = careerSpec(i), tried = [];
    let chosen = null;
    for (const seed of candidateSeeds(i, K)) {
      const spec = { ...base, seed }, m = measure(spec), fails = check(m, spec);
      tried.push({ ...slim(m), fails });
      if (!fails.length && chosen === null) chosen = seed;
      if (chosen !== null && tried.length >= 3) break;   // the chosen seed and enough after it to show the check is not trivial
    }
    out.slots.push({ index: i, name: base.name, chapter: CHAPTERS[chapterOf(i)].name, settings: { kind: base.kind, difficulty: base.difficulty, length: base.length, style: CAREER[i].style || 'mixed', crossover: CAREER[i].crossover || 'default' }, inCareer: CAREER[i].seed, chosen, agrees: chosen === CAREER[i].seed, tried });
    const s = out.slots[out.slots.length - 1];
    console.log(i, base.name, 'chosen', chosen, 'in CAREER', CAREER[i].seed, tried.map(t => t.seed + (t.fails.length ? ' x ' + t.fails.join(', ') : ' ok') + ' [' + t.genMs + 'ms ' + t.runMetres + 'm c' + t.corners + ' b' + t.banked + ' x' + t.bridges + ' h' + t.hairpins + ' careful ' + t.careful.score + '/' + t.careful.targets[0] + ' ' + t.careful.seconds + 's drifter ' + t.drifter.seconds + 's]').join(' | '));
  }
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(path.join(reviewDir, 'seeds.json'), JSON.stringify(out, null, 1));
  for (const r of out.rookie) console.log('rookie', r.index, r.name, r.fails.length ? r.fails.join(', ') : 'ok', r.genMs + 'ms', r.runMetres + 'm');
}
