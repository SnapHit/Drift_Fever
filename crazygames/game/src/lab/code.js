/* TRACK CODES. A Lab track is its settings and its seed, and the code is
   those packed into 60 bits and written as twelve characters of a base
   32 alphabet with no I, L, O or U (so a code read aloud or typed from a
   photo survives), shown in three groups: XXXX-XXXX-XXXX.

     bits 0..3    version (1)
     bits 4..27   seed, 24 bits
     bits 28..39  settings: kind 1, length 2, style 2, bank 1, cross 1,
                  theme 3, time 2
     bits 40..59  check: 20 bits of FNV-1a over the forty bits above

   decode() returns { settings, seed } or null with a reason: a wrong
   length, a character outside the alphabet, a version this build does
   not know, a check that does not match, or a setting out of range. A
   random tamper passes the check one time in a million and is then
   still held to the settings' ranges. Nothing here throws on any input. */

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 1;
export const CODE_LENGTH = 12;

export const FIELDS = [
  ['kind', 1, ['circuit', 'sprint']],
  ['length', 2, ['short', 'medium', 'long']],
  ['style', 2, ['flowing', 'technical', 'hairpins', 'mixed']],
  ['bank', 1, [false, true]],
  ['cross', 1, [false, true]],
  ['theme', 3, ['forest', 'coastal', 'desert', 'docks', 'mountain']],
  ['time', 2, ['dusk', 'night', 'dawn', 'rain']],
];
export const SEED_BITS = 24;
export const SEED_MAX = (1 << SEED_BITS) - 1;

/* Settings as a 12 bit number; null if any value is not one of its options. */
function packSettings(s) {
  let v = 0, shift = 0;
  for (const [name, bits, options] of FIELDS) {
    const i = options.indexOf(s[name]);
    if (i < 0) return null;
    v |= i << shift; shift += bits;
  }
  return v >>> 0;
}
function unpackSettings(v) {
  const s = {};
  let shift = 0;
  for (const [name, bits, options] of FIELDS) {
    const i = (v >>> shift) & ((1 << bits) - 1);
    if (i >= options.length) return null;
    s[name] = options[i]; shift += bits;
  }
  return s;
}

/* FNV-1a over the payload's five bytes, folded to 20 bits. */
function check(lo, hi) {
  let h = 0x811c9dc5;
  const bytes = [lo & 0xff, (lo >>> 8) & 0xff, (lo >>> 16) & 0xff, (lo >>> 24) & 0xff, hi & 0xff];
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193); }
  h >>>= 0;
  return (h ^ (h >>> 20)) & 0xfffff;
}

/* The code for settings and a seed (0 to SEED_MAX); null if the settings are not valid. */
export function encode(settings, seed) {
  const sv = packSettings(settings || {});
  if (sv === null || typeof seed !== 'number' || !isFinite(seed) || seed < 0 || seed > SEED_MAX || seed !== Math.floor(seed)) return null;
  /* payload: bits 0..31 in lo, 32..39 in hi (the top 4 of the settings) */
  const lo = (VERSION | (seed << 4) | ((sv & 0xf) << 28)) >>> 0;
  const hi = (sv >>> 4) & 0xff;
  const ck = check(lo, hi);
  /* twelve 5 bit digits from the 60 bits: lo (32), hi (8), ck (20) */
  const digits = [];
  let acc = 0, nbits = 0;
  const push = (v, n) => { for (let i = 0; i < n; i++) { acc |= ((v >>> i) & 1) << nbits; nbits++; if (nbits === 5) { digits.push(acc); acc = 0; nbits = 0; } } };
  push(lo, 32); push(hi, 8); push(ck, 20);
  return digits.map(d => ALPHABET[d]).join('');
}

/* Tidy a typed code: upper case, the confusable letters mapped, and
   everything that is not in the alphabet dropped (dashes, spaces). */
export function normalise(text) {
  return String(text || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
}

export function format(code) { return code ? code.slice(0, 4) + '-' + code.slice(4, 8) + '-' + code.slice(8) : ''; }

/* { settings, seed, code } or { error } */
export function decode(text) {
  const code = normalise(text);
  if (code.length !== CODE_LENGTH) return { error: code.length ? 'a code has twelve characters' : 'no code' };
  const digits = [];
  for (const ch of code) { const d = ALPHABET.indexOf(ch); if (d < 0) return { error: 'the character ' + ch + ' is not in a code' }; digits.push(d); }
  let lo = 0, hi = 0, ck = 0, bit = 0;
  for (const d of digits) for (let i = 0; i < 5; i++) { const b = (d >>> i) & 1; if (bit < 32) lo |= b << bit; else if (bit < 40) hi |= b << (bit - 32); else ck |= b << (bit - 40); bit++; }
  lo >>>= 0;
  if ((lo & 0xf) !== VERSION) return { error: 'a code from another version of the game' };
  if (check(lo, hi) !== ck) return { error: 'that is not a track code (a character may be wrong)' };
  const seed = (lo >>> 4) & SEED_MAX;
  const sv = ((lo >>> 28) & 0xf) | (hi << 4);
  const settings = unpackSettings(sv);
  if (!settings) return { error: 'a setting in the code is out of range' };
  if (settings.cross && !(settings.kind === 'circuit' && settings.length === 'long')) return { error: 'a crossover needs a long circuit' };
  return { settings, seed, code };
}
