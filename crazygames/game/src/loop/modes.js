/* THE MODES. What a run is made of: the career ladder (fixed seeds, in
   order, each unlocked by a star on the one before), the daily drift (the
   seed for the local date), free drift (the car park), and the sums that
   turn a run into stars and coins. Pure data and arithmetic. */
import { LOOP, TANDEM } from '../tune.js';
import { dailySeed, localDate } from '../ground/source.js';

/* The career: one flat list of 24 tracks in three chapters of eight
   (CHAPTERS below), circuits and sprints by turns. Indices 0 to 7 are
   the first eight tracks, unchanged, so every save key (career:N, the
   save's career[N], the mission flags) keeps its meaning. Seeds are fixed
   so the ladder is the same for everyone. Lengths are asked of the
   generator; the stand-in test track ignores them.

   From Pro on a track may also name a style, the Track Lab's feature
   weights (LOOP.LAB.STYLES), and crossover: 'always' for a figure eight.
   Both are generator options it already takes; a track without them is
   asked for exactly as before. The Pro and Legend seeds were chosen by
   measurement (game/test/chapters/seeds.js, review/chapters/seeds.json):
   each is the first candidate for its slot that both scripted drivers
   finish with no respawn, that the careful driver drives clean to a star,
   that generates in under 600 ms, that nothing occludes (the readability
   rule, in every theme) and that has its chapter's least banked corners. */
export const CAREER = [
  /* Rookie */
  { name: 'First slide',   kind: 'circuit', seed: 1101, difficulty: 0.10, length: 560 },
  { name: 'Harbour run',   kind: 'sprint',  seed: 1202, difficulty: 0.20, length: 800 },
  { name: 'Crossover',     kind: 'circuit', seed: 1327, difficulty: 0.30, length: 820 },   // 844 m, a figure eight over a bridge
  { name: 'Long shadows',  kind: 'sprint',  seed: 1404, difficulty: 0.40, length: 900 },
  { name: 'Tight city',    kind: 'circuit', seed: 1505, difficulty: 0.55, length: 620 },
  { name: 'Ridge road',    kind: 'sprint',  seed: 1606, difficulty: 0.65, length: 1000 },
  { name: 'Hairpin heaven', kind: 'circuit', seed: 1707, difficulty: 0.80, length: 660 },
  { name: 'The gauntlet',  kind: 'sprint',  seed: 1808, difficulty: 0.95, length: 1100 },
  /* Pro */
  { name: 'Upper deck',    kind: 'circuit', seed: 2105, difficulty: 0.50, length: [770, 840],  style: 'flowing',   crossover: 'always' },
  { name: 'Quarry cut',    kind: 'sprint',  seed: 2213, difficulty: 0.55, length: 1100, style: 'technical' },
  { name: 'Pin drop',      kind: 'circuit', seed: 2314, difficulty: 0.60, length: 720,  style: 'hairpins' },
  { name: 'Breakwater',    kind: 'sprint',  seed: 2406, difficulty: 0.65, length: 1150 },
  { name: 'Over and under', kind: 'circuit', seed: 2510, difficulty: 0.70, length: [770, 860],  style: 'technical', crossover: 'always' },
  { name: 'Switchbacks',   kind: 'sprint',  seed: 2606, difficulty: 0.75, length: 1200, style: 'hairpins' },
  { name: 'Smoke ring',    kind: 'circuit', seed: 2708, difficulty: 0.80, length: 760 },
  { name: 'Razor wire',    kind: 'sprint',  seed: 2809, difficulty: 0.90, length: 1250, style: 'technical' },
  /* Legend */
  { name: 'Knot yard',     kind: 'circuit', seed: 3102, difficulty: 0.70, length: [780, 880],  style: 'technical', crossover: 'always' },
  { name: 'Serpent spine', kind: 'sprint',  seed: 3202, difficulty: 0.75, length: 1250, style: 'hairpins' },
  { name: 'High wire',     kind: 'circuit', seed: 3303, difficulty: 0.80, length: [780, 880],  style: 'hairpins',  crossover: 'always' },
  { name: 'Needle run',    kind: 'sprint',  seed: 3404, difficulty: 0.85, length: 1300, style: 'technical' },
  { name: 'Endless eight', kind: 'circuit', seed: 3505, difficulty: 0.85, length: [780, 880],  crossover: 'always' },
  { name: 'Thousand turns', kind: 'sprint', seed: 3611, difficulty: 0.90, length: 1350, style: 'hairpins' },
  { name: 'The vice',      kind: 'circuit', seed: 3707, difficulty: 0.95, length: [780, 880],  style: 'technical', crossover: 'always' },
  { name: 'The last bend', kind: 'sprint',  seed: 3808, difficulty: 1.00, length: 1400, style: 'technical' },
];

/* The chapters: ranges over CAREER, [from, to). The first track of a
   chapter after the first opens with LOOP.CHAPTERS.OPEN[c] stars won in
   the chapter before it; inside a chapter a track opens with a star on
   the one before, as the ladder always has. */
export const CHAPTERS = [
  { id: 'rookie', name: 'Rookie', from: 0,  to: 8 },
  { id: 'pro',    name: 'Pro',    from: 8,  to: 16 },
  { id: 'legend', name: 'Legend', from: 16, to: 24 },
];

/* The chapter a career index is in, as an index into CHAPTERS. */
export function chapterOf(index) {
  for (let c = 0; c < CHAPTERS.length; c++) if (index >= CHAPTERS[c].from && index < CHAPTERS[c].to) return c;
  return -1;
}

/* The generator options a career track names, or undefined (the first
   eight name none, so they are asked for exactly as before). */
function careerOptions(c) {
  const o = {};
  if (c.style && c.style !== 'mixed') o.weights = LOOP.LAB.STYLES[c.style];
  if (c.crossover !== undefined) o.crossover = c.crossover;
  return Object.keys(o).length ? o : undefined;
}

export function careerSpec(index) {
  const c = CAREER[index];
  if (!c) return null;
  const ch = chapterOf(index), spec = { mode: 'career', index, key: 'career:' + index, name: c.name, seed: c.seed, kind: c.kind, difficulty: c.difficulty, length: c.length, chapter: ch, inChapter: index - CHAPTERS[ch].from };
  const options = careerOptions(c);
  if (options) spec.options = options;
  return spec;
}

export function dailySpec(date) {
  const d = localDate(date), seed = dailySeed(date);
  return { mode: 'daily', key: 'daily:' + d, date: d, name: 'Daily drift', seed, kind: seed & 1 ? 'sprint' : 'circuit', difficulty: 0.5, length: undefined };
}

/* Stars won on a range of career tracks, [from, to). */
function starsOn(save, from, to) {
  let n = 0;
  for (let i = from; i < to; i++) { const e = save.career[String(i)]; if (e) n += e.stars; }
  return n;
}
/* Stars won in a chapter. */
export function chapterStars(save, c) { const ch = CHAPTERS[c]; return ch ? starsOn(save, ch.from, ch.to) : 0; }
/* How many more stars in the chapter before open chapter c: 0 when it is open. */
export function starsToOpen(save, c) {
  if (c <= 0 || c >= CHAPTERS.length) return 0;
  return Math.max(0, LOOP.CHAPTERS.OPEN[c] - chapterStars(save, c - 1));
}
/* Is a chapter open: the first always, the rest by the stars of the one before. */
export function chapterOpen(save, c) { return c === 0 || (c > 0 && c < CHAPTERS.length && starsToOpen(save, c) === 0); }

/* Is a career track playable: the first of a chapter when the chapter is
   open, the rest after a star on the one before. */
export function careerUnlocked(save, index) {
  if (index <= 0) return index === 0;
  const c = chapterOf(index);
  if (c < 0) return false;
  if (index === CHAPTERS[c].from) return chapterOpen(save, c);
  const prev = save.career[String(index - 1)];
  return !!(prev && prev.stars >= 1);
}

/* Stars won on the whole career (the tracks that exist). */
export function careerStars(save) { return starsOn(save, 0, CAREER.length); }

/* The three targets for a track: the first is STAR_RATE points per
   metre of the run, eased on harder tracks, the others multiples of it. */
export function runMetres(track, laps) { return track.kind === 'circuit' ? track.length * laps : (track.finish ? track.finish.along : track.length); }
/* the first star's points per metre of run on this track */
export function starRate(track) {
  const d = track.requested && track.requested.difficulty !== undefined ? track.requested.difficulty : 0.5;
  return LOOP.STAR_RATE * (1 - d * LOOP.STAR_HARD_EASE);
}
export function starTargets(track, laps) {
  const base = runMetres(track, laps) * starRate(track);
  return LOOP.STAR_LEVELS.map(k => Math.round(base * k / 10) * 10);
}

export function starsFor(score, targets) { let n = 0; for (const t of targets) if (score >= t) n++; return n; }

export function coinsFor(score, stars, mode) {
  const c = score * LOOP.COIN_PER_POINT + stars * LOOP.COIN_PER_STAR;
  return Math.floor(c * (mode === 'daily' ? LOOP.DAILY_BONUS : 1));
}

export function lapsFor(track) { return track.kind === 'circuit' ? LOOP.LAPS : 1; }

/* A battle (briefs/RIVALS.md): the career track of a rival, run with
   TANDEM.LAPS laps against him. The track is the career's, generated
   from the same spec. */
export function battleSpec(def) {
  const c = careerSpec(def.track);
  if (!c) return null;
  return Object.assign({}, c, { mode: 'battle', key: 'battle:' + def.id, rival: def.id });
}
export function battleLaps(track) { return track.kind === 'circuit' ? TANDEM.LAPS : 1; }
