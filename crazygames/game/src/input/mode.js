/* WHICH CONTROLS A RUN IS DRIVEN WITH (briefs/PRO-CONTROLS.md, 22
   November 2026). Touch is always Easy.

   Since 23 November 2026 a keyboard starts on Easy and a gamepad on Pro
   (variant a, the most helped; ?pro=a, b or c picks one). Pro was the
   keyboard's default from the evening of 22 November, and when the
   author played it on a desktop every slide he caught ended in the
   wall: on Pro a slide only closes when the throttle lifts, and letting
   the countersteer go with W still held winds it into a spin, every
   time (game/test/controls/release.js). A gamepad's trigger can feather,
   and on Easy a stick barely slides with the first minute's starter, so
   the pad keeps Pro until Pro is reworked.

   The title's CONTROLS toggle switches the input in use between Easy and
   Pro. The choice is a preference of the device, kept under its own key
   and never in the save: 'easy' or 'pro', for keys and pads alike, and
   forgotten again when it is toggled back to that input's own default.
   On the address, ?controls=pro (or any ?pro=) makes Pro the keys'
   default too, as it was, and ?controls=easy makes every run Easy, the
   game exactly as it was before Pro, as the probes' harness does. Every
   localStorage call is wrapped so the game plays the same with no
   memory at all. */
import { PROFILES } from '../tune.js';
import { EASY, profileOf } from '../physics/profile.js';

const PREF_KEY = 'driftfever.cg.controls';
const query = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
const askedVariant = query.get('pro');
const variant = PROFILES.PRO_VARIANTS.includes(askedVariant) ? askedVariant : PROFILES.PRO_DEFAULT;
const available = query.get('controls') !== 'easy';
const keysPro = query.get('controls') === 'pro' || query.has('pro');   // the address asks for Pro on the keys

/* what an input drives with when the device has not chosen */
const proByDefault = source => source === 'pad' || (source === 'keys' && keysPro);

let pref = null;   // 'easy', 'pro', or null: each input's own default
try { const v = localStorage.getItem(PREF_KEY); pref = v === 'easy' || v === 'pro' ? v : null; } catch (e) { pref = null; }
function keep(v) {
  pref = v;
  try { if (v) localStorage.setItem(PREF_KEY, v); else localStorage.removeItem(PREF_KEY); } catch (e) { /* no memory: kept for this page */ }
}

export const controls = {
  /* is Pro on the address at all */
  get available() { return available; },
  get variant() { return variant; },
  /* the device's choice, if it has made one */
  get preference() { return pref; },
  /* does a run driven by this input go on Pro */
  proFor(source) {
    if (!available || source === 'touch') return false;
    return pref ? pref === 'pro' : proByDefault(source);
  },
  /* the title's toggle: the other of what this input drives with now */
  toggle(source) {
    const pro = !this.proFor(source);
    keep(pro === proByDefault(source) ? null : pro ? 'pro' : 'easy');
  },
  /* for the probes: true chooses Easy for keys and pads, false forgets the choice */
  get easyPreferred() { return pref === 'easy'; },
  setEasyPreferred(v) { keep(v ? 'easy' : null); },
  /* the profile a run starts with, from the input that moved last */
  profileFor(source) {
    return this.proFor(source) ? profileOf('pro', variant) : EASY;
  },
};
