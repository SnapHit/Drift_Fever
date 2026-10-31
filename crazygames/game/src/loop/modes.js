/* THE MODES. What a run is made of: the career ladder (fixed seeds, in
   order, each unlocked by a star on the one before), the daily drift (the
   seed for the local date), free drift (the car park), and the sums that
   turn a run into stars and coins. Pure data and arithmetic. */
import { LOOP } from '../tune.js';
import { dailySeed, localDate } from '../ground/source.js';

/* Eight career tracks, easy to hard, circuits and sprints by turns.
   Seeds are fixed so the ladder is the same for everyone. Lengths are
   asked of the generator; the stand-in test track ignores them. */
export const CAREER = [
  { name: 'First slide',   kind: 'circuit', seed: 1101, difficulty: 0.10, length: 560 },
  { name: 'Harbour run',   kind: 'sprint',  seed: 1202, difficulty: 0.20, length: 800 },
  { name: 'Switchbacks',   kind: 'circuit', seed: 1303, difficulty: 0.30, length: 600 },
  { name: 'Long shadows',  kind: 'sprint',  seed: 1404, difficulty: 0.40, length: 900 },
  { name: 'Tight city',    kind: 'circuit', seed: 1505, difficulty: 0.55, length: 620 },
  { name: 'Ridge road',    kind: 'sprint',  seed: 1606, difficulty: 0.65, length: 1000 },
  { name: 'Hairpin heaven', kind: 'circuit', seed: 1707, difficulty: 0.80, length: 660 },
  { name: 'The gauntlet',  kind: 'sprint',  seed: 1808, difficulty: 0.95, length: 1100 },
];

export function careerSpec(index) {
  const c = CAREER[index];
  return c ? { mode: 'career', index, key: 'career:' + index, name: c.name, seed: c.seed, kind: c.kind, difficulty: c.difficulty, length: c.length } : null;
}

export function dailySpec(date) {
  const d = localDate(date), seed = dailySeed(date);
  return { mode: 'daily', key: 'daily:' + d, date: d, name: 'Daily drift', seed, kind: seed & 1 ? 'sprint' : 'circuit', difficulty: 0.5, length: undefined };
}

/* Is a career track playable: the first always, the rest after a star on
   the one before. */
export function careerUnlocked(save, index) {
  if (index <= 0) return true;
  const prev = save.career[String(index - 1)];
  return !!(prev && prev.stars >= 1);
}

export function careerStars(save) { let n = 0; for (const k of Object.keys(save.career)) n += save.career[k].stars; return n; }

/* The three targets for a track: the first is STAR_RATE points per
   metre of the run, the others multiples of it. */
export function starTargets(track, laps) {
  const metres = track.kind === 'circuit' ? track.length * laps : (track.finish ? track.finish.along : track.length);
  const base = metres * LOOP.STAR_RATE;
  return LOOP.STAR_LEVELS.map(k => Math.round(base * k / 10) * 10);
}

export function starsFor(score, targets) { let n = 0; for (const t of targets) if (score >= t) n++; return n; }

export function coinsFor(score, stars, mode) {
  const c = score * LOOP.COIN_PER_POINT + stars * LOOP.COIN_PER_STAR;
  return Math.floor(c * (mode === 'daily' ? LOOP.DAILY_BONUS : 1));
}

export function lapsFor(track) { return track.kind === 'circuit' ? LOOP.LAPS : 1; }
