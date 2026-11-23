/* WHICH CONTROLS A RUN IS DRIVEN WITH (briefs/PRO-CONTROLS.md, 22
   November 2026).

   Since the evening of 23 November 2026, by the author's word, **every
   run is Easy**: keys, gamepads and touch alike, and the title has no
   CONTROLS toggle. Pro was the default on keys and pads from the evening
   of 22 November; when the author played it on a desktop every slide he
   caught ended in the wall (on Pro a slide only closes when the throttle
   lifts, and letting the countersteer go with W held winds it into a
   spin: game/test/controls/release.js), he then found Easy "works well"
   on the same desktop, and decided Pro does not add enough for a player
   to keep in sight. It is kept, hidden, until strangers on a desktop
   or CrazyGames say otherwise.

   Pro is reached only from the address: ?controls=pro (or any ?pro=a, b
   or c, which picks the handling; a otherwise) drives keys and pads on
   Pro and shows the title's toggle, whose choice ('easy' or 'pro') is a
   preference of the device under its own key, never in the save, and
   is forgotten when toggled back to Pro. Without the address a stored
   choice is ignored. Every localStorage call is wrapped so the game
   plays the same with no memory at all. */
import { PROFILES } from '../tune.js';
import { EASY, profileOf } from '../physics/profile.js';

const PREF_KEY = 'driftfever.cg.controls';
const query = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
const askedVariant = query.get('pro');
const variant = PROFILES.PRO_VARIANTS.includes(askedVariant) ? askedVariant : PROFILES.PRO_DEFAULT;
const available = query.get('controls') !== 'easy' && (query.get('controls') === 'pro' || query.has('pro'));   // Pro only when the address asks

let pref = null;   // 'easy', 'pro', or null: Pro, as the address asked
try { const v = localStorage.getItem(PREF_KEY); pref = v === 'easy' || v === 'pro' ? v : null; } catch (e) { pref = null; }
function keep(v) {
  pref = v;
  try { if (v) localStorage.setItem(PREF_KEY, v); else localStorage.removeItem(PREF_KEY); } catch (e) { /* no memory: kept for this page */ }
}

export const controls = {
  /* is Pro on the address at all (the title shows its toggle only then) */
  get available() { return available; },
  get variant() { return variant; },
  get preference() { return pref; },
  /* does a run driven by this input go on Pro */
  proFor(source) {
    if (!available || source === 'touch') return false;
    return pref !== 'easy';
  },
  /* the title's toggle, with Pro on the address: Easy kept, or forgotten back to Pro */
  toggle(source) { keep(this.proFor(source) ? 'easy' : null); },
  /* for the probes: true chooses Easy, false forgets the choice */
  get easyPreferred() { return pref === 'easy'; },
  setEasyPreferred(v) { keep(v ? 'easy' : null); },
  /* the profile a run starts with, from the input that moved last */
  profileFor(source) {
    return this.proFor(source) ? profileOf('pro', variant) : EASY;
  },
};
