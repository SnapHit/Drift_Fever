/* THE COSMETICS (briefs/GARAGE.md): wheels, underglow and tyre smoke
   colour. Each is a list of items with an id, a name and what it looks
   like; the first of each list is the standard one, which every car has
   and which costs nothing. Bought per car, kept per car (the save's
   cars[id].own), worn one of each at a time (cars[id].wheels, .glow,
   .smoke). Prices are LOOP.COSMETICS in tune.js.

   A LOOK is { wheels, glow, smoke }, three ids. lookOf() makes one from
   anything, so a save, a ghost or a rival with none, or with an id this
   build does not know, wears the standard ones.

   Nothing here is read by the physics or the score. */
import { LOOP } from '../tune.js';
import { WHEEL_DESIGNS } from '../cars/wheels.js';

export const KINDS = ['wheels', 'glow', 'smoke'];
export const STANDARD = { wheels: 'standard', glow: 'off', smoke: 'standard' };

export const WHEELS = [{ id: 'standard', name: 'Standard' }, ...Object.keys(WHEEL_DESIGNS).map(id => ({ id, name: WHEEL_DESIGNS[id].name }))];

/* the glow's colours: chosen to be told apart on dark asphalt and never
   near the road edge's pale yellow */
export const GLOWS = [
  { id: 'off',     name: 'Off',     hex: null },
  { id: 'aqua',    name: 'Aqua',    hex: 0x19d8ff },
  { id: 'lime',    name: 'Lime',    hex: 0x7dff2a },
  { id: 'amber',   name: 'Amber',   hex: 0xff8a1c },
  { id: 'magenta', name: 'Magenta', hex: 0xff2d9a },
  { id: 'violet',  name: 'Violet',  hex: 0x8a4dff },
];

/* the smoke's colours, as the smoke drifts away in plain light; the
   show lights them by the time of day (env/show.js smokeColours) */
export const SMOKES = [
  { id: 'standard',  name: 'Standard',  hex: null },
  { id: 'aqua',      name: 'Aqua',      hex: 0x4fd8ff },
  { id: 'lime',      name: 'Lime',      hex: 0x9be84a },
  { id: 'tangerine', name: 'Tangerine', hex: 0xff9a3c },
  { id: 'rose',      name: 'Rose',      hex: 0xff5fa8 },
  { id: 'violet',    name: 'Violet',    hex: 0xa070ff },
];

export const ITEMS = { wheels: WHEELS, glow: GLOWS, smoke: SMOKES };
const PRICES = { wheels: LOOP.COSMETICS.WHEELS, glow: LOOP.COSMETICS.GLOW, smoke: LOOP.COSMETICS.SMOKE };

export function itemOf(kind, id) { return (ITEMS[kind] || []).find(i => i.id === id) || null; }
export function isItem(kind, id) { return !!itemOf(kind, id); }
/* coins for an item; the standard ones are 0 */
export function priceOf(kind, id) { return id === STANDARD[kind] ? 0 : (PRICES[kind] && PRICES[kind][id]) || 0; }
export const glowHex = id => { const g = itemOf('glow', id); return g ? g.hex : null; };
export const smokeHex = id => { const s = itemOf('smoke', id); return s ? s.hex : null; };

/* A look from anything: unknown or missing ids are the standard ones. */
export function lookOf(o) {
  const out = {};
  for (const k of KINDS) out[k] = o && typeof o[k] === 'string' && isItem(k, o[k]) ? o[k] : STANDARD[k];
  return out;
}
export const isStandard = look => KINDS.every(k => look[k] === STANDARD[k]);

/* What a car in the save owns and wears, repaired: own lists hold only
   known, bought items, once each, and an item worn is the standard one
   or one that is owned. fix() is called for anything that had to change
   (a missing field is not a fix: a save from before the garage round has
   none). */
export function carCosmetics(raw, fix) {
  const own = {}, worn = {};
  for (const k of KINDS) {
    const list = raw && raw.own && Array.isArray(raw.own[k]) ? raw.own[k] : [];
    if (raw && raw.own !== undefined && !(raw.own && Array.isArray(raw.own[k])) && fix) fix();
    own[k] = [];
    for (const id of list) { if (typeof id === 'string' && id !== STANDARD[k] && isItem(k, id) && !own[k].includes(id)) own[k].push(id); else if (fix) fix(); }
    const w = raw ? raw[k] : undefined;
    if (w === undefined) worn[k] = STANDARD[k];
    else if (w === STANDARD[k] || own[k].includes(w)) worn[k] = w;
    else { worn[k] = STANDARD[k]; if (fix) fix(); }
  }
  return { wheels: worn.wheels, glow: worn.glow, smoke: worn.smoke, own };
}
export const owns = (car, kind, id) => id === STANDARD[kind] || !!(car && car.own && car.own[kind] && car.own[kind].includes(id));
/* what the whole set costs on one car */
export function fullSetPrice() { let n = 0; for (const k of KINDS) for (const i of ITEMS[k]) n += priceOf(k, i.id); return n; }
