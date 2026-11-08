/* THE TRACK LAB'S TRACKS. A Lab track is a set of settings (circuit or
   sprint; short, medium or long; a style; banked corners; a crossover;
   a scenery theme; a time of day) and a 24 bit seed, and the two are one
   code (code.js). This turns settings into what the generator and the
   scene are asked for, and into a run spec the host plays like a career
   track, with its key the code. Pure data; no DOM. */
import { LOOP } from '../tune.js';
import { encode, decode, format, FIELDS, SEED_MAX } from './code.js';

export const DEFAULT_SETTINGS = { kind: 'circuit', length: 'medium', style: 'mixed', bank: true, cross: false, theme: 'forest', time: 'dusk' };

/* Is a crossover on offer for these settings: a figure eight needs a
   long circuit (TRACKS.CROSS.minLap is 760 m and the long circuit asks 1000). */
export function crossoverOffered(s) { return s.kind === 'circuit' && s.length === 'long'; }

/* Settings with every field valid and the crossover only where offered. */
export function tidySettings(s) {
  const t = { ...DEFAULT_SETTINGS, ...(s || {}) };
  for (const [name, , options] of FIELDS) if (!options.includes(t[name])) t[name] = DEFAULT_SETTINGS[name];
  if (!crossoverOffered(t)) t.cross = false;
  return t;
}

/* What the generator is asked for. */
export function generatorOptions(s) {
  const o = { kind: s.kind, difficulty: LOOP.LAB.DIFFICULTY, length: LOOP.LAB.LENGTH[s.kind][s.length] };
  if (s.style !== 'mixed') o.weights = LOOP.LAB.STYLES[s.style];
  if (!s.bank) o.bank = false;
  o.crossover = s.cross ? 'always' : false;
  return o;
}

/* The run spec for settings and a seed; null if they do not encode. */
export function labSpec(settings, seed) {
  const s = tidySettings(settings);
  const code = encode(s, seed);
  if (!code) return null;
  const o = generatorOptions(s);
  return { mode: 'lab', key: 'lab:' + code, code, name: 'Lab ' + format(code), seed, kind: s.kind, difficulty: o.difficulty, length: o.length, options: { weights: o.weights, bank: o.bank, crossover: o.crossover }, theme: s.theme, preset: s.time, settings: s };
}

/* A spec from a code, or { error }. */
export function specFromCode(text) {
  const d = decode(text);
  if (d.error) return { error: d.error };
  const spec = labSpec(d.settings, d.seed);
  return spec ? { spec } : { error: 'that code does not make a track' };
}

export function randomSeed() { return Math.floor(Math.random() * (SEED_MAX + 1)); }

/* The link for a code, on this page. */
export function linkFor(code) {
  try { return location.origin + location.pathname + '?track=' + code; } catch (e) { return '?track=' + code; }
}

export { encode, decode, format };
