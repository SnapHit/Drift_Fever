/* WHICH CONTROLS A RUN IS DRIVEN WITH (briefs/PRO-CONTROLS.md, 22
   November 2026). Pro is the default on a keyboard and a gamepad since
   the evening of 22 November, by the author's word, before he has
   picked a variant: ?pro=a, b or c picks one (a, the most helped,
   otherwise), and ?controls=easy makes every run Easy, the game exactly
   as it was before the round, as the probes' harness does. Touch is
   always Easy. A keyboard or gamepad player can choose Easy with the
   toggle on the title; that is a preference of the device, kept under
   its own key, never in the save, and every localStorage call is
   wrapped so the game plays the same with no memory at all. */
import { PROFILES } from '../tune.js';
import { EASY, profileOf } from '../physics/profile.js';

const PREF_KEY = 'driftfever.cg.controls';
const query = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
const askedVariant = query.get('pro');
const variant = PROFILES.PRO_VARIANTS.includes(askedVariant) ? askedVariant : PROFILES.PRO_DEFAULT;
const available = query.get('controls') !== 'easy';

let easyPref = false;
try { easyPref = localStorage.getItem(PREF_KEY) === 'easy'; } catch (e) { easyPref = false; }

export const controls = {
  /* is Pro on the address at all */
  get available() { return available; },
  get variant() { return variant; },
  /* the device's choice: Easy even with a keyboard or a gamepad */
  get easyPreferred() { return easyPref; },
  setEasyPreferred(v) {
    easyPref = !!v;
    try { if (easyPref) localStorage.setItem(PREF_KEY, 'easy'); else localStorage.removeItem(PREF_KEY); } catch (e) { /* no memory: kept for this page */ }
  },
  /* the profile a run starts with, from the input that moved last */
  profileFor(source) {
    if (!available || source === 'touch' || easyPref) return EASY;
    return profileOf('pro', variant);
  },
};
