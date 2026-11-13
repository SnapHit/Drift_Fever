/* THE RIVALS (briefs/RIVALS.md): six named drivers, two in each
   chapter, each on a career track of his half of the chapter. Each has
   an invented name, one of the five cars with a paint, the side of the
   grid he starts on, a prize for the first win over him, and his
   character: a few overrides of the rival driver's numbers
   (rivals/driver.js RIVAL_DRIVE). First guesses for the author to set
   by play; the measurements in game/test/rivals/ say how each drives. */
import { TANDEM } from '../tune.js';
import { CAREER, CHAPTERS, chapterOf, careerUnlocked } from '../loop/modes.js';

export const RIVALS = [
  { id: 'r1', name: 'Kestrow', car: 'starter', paint: 'flame', track: 0, side: 1, prize: 300, laps: 4,
    style: 'Smooth and wide',
    /* the drift race (briefs/DRIFT-RACE.md): his driving searched again with a player's hands (game/test/driftrace/search.js --character): shallow slides in every corner, each banked on its own, at the scripted players' pace */
    drive: { SLIDE_GAIN: 0.35, PROGRESS: 30, KEEP: 397, ANGLE_CAP: 20.41, EDGE_SAFE: 2.47, EDGE_COST: 2670, ENTRY: 26.25, VMAX: 34, CHAIN_KEEP: 273, CHAIN_MARGIN: 0.33, AY_MAX: 7.4, OUTSIDE: 0.427, SETUP: 33.45, WINDOW_PRE: 5.32, WINDOW_POST: -3.75, LINK: 4.31, HB_TIME: 0.108, HB_OVER: 0.65, HB_STEER: 0.3 } },
  /* the rest: Tolvo and Varsk searched again for the ladder (briefs/RIVALS-LADDER.md); Dovane, Halvik and Sarrow as the rivals round chose them (game/test/rivals/search.js, review/rivals/REPORT.md), their driving now planned with a player's hands, measured and not in the game */
  { id: 'r2', name: 'Tolvo', car: 'hatch', paint: 'amber', track: 4, side: -1, prize: 400, laps: 3,
    style: 'Quick, linking shallow slides',   // measured: 22 degrees on average, as shallow as Kestrow, but his best chain is 1,160 points to Kestrow's 216 and he beats the grip player home
    /* the ladder (briefs/RIVALS-LADDER.md): Tight city, three laps; his driving searched with a player's hands from Kestrow's (game/test/ladder/search.js), then his corner entry speed set by hand to the one value nearby that passes measure 2 */
    drive: { SLIDE_GAIN: 0.35, PROGRESS: 45, KEEP: 325, ANGLE_CAP: 21.56, EDGE_SAFE: 2.37, EDGE_COST: 2875, ENTRY: 26.2, VMAX: 33.14, CHAIN_KEEP: 0, CHAIN_MARGIN: 0.34, AY_MAX: 7.28, OUTSIDE: 0.157, SETUP: 39.95, WINDOW_PRE: 3.98, WINDOW_POST: -5.28, LINK: 4.81, HB_TIME: 0.1, HB_OVER: 0.75, HB_STEER: 0.35 } },
  { id: 'r3', name: 'Varsk', car: 'fastback', paint: 'lime', track: 8, side: 1, prize: 600, laps: 3,
    style: 'Late and aggressive',
    /* the third ladder round (briefs/RIVALS-LADDER-3.md): Upper deck, three laps, searched for the driving bar on a plateau from the ladder round's numbers (game/test/ladder3/search.js, review/ladder3/runs/search/r3-d.log). In the game since 13 November 2026 by the author's decision after play: 20 of 20 disturbed runs pass, but 2 of his 38 one per cent moves miss (one run each), and the strong driver cannot beat him on pace (review/ladder3/REPORT.md); this is the closest found */
    drive: {"SLIDE_GAIN":0.445,"PROGRESS":40,"KEEP":578,"ANGLE_CAP":29.2,"EDGE_SAFE":2.86,"EDGE_COST":2646,"ENTRY":25.85,"VMAX":33.8,"CHAIN_KEEP":0,"CHAIN_MARGIN":0.36,"AY_MAX":7.29,"OUTSIDE":0.49,"SETUP":52.23,"WINDOW_PRE":3,"WINDOW_POST":-7.89,"LINK":3.79,"HB_TIME":0.302,"HB_OVER":1.86,"HB_STEER":0.35} },
  /* after play, 13 November 2026: the author beat these three by 1,139, 3,632 and 3,668 in the best car, against 262 over Varsk, so the top of the ladder was its easiest part, and all three hit walls. Each now has the closest clean, quicker scoring setup a scan of his half of his chapter found (every track, car, upgrade step and proven driving; game/test/play13/scan.js, review/play13/scan.json), not a search of his own */
  { id: 'r4', name: 'Dovane', car: 'tourer', paint: 'wine', track: 12, side: -1, prize: 800, laps: 3, up: { power: 2, grip: 2, steer: 2 },
    style: 'Long, linked slides',
    /* Tolvo's driving in the tourer with two steps of each upgrade: 94.0 s, 4,086, no contact, 0 of 20 disturbed runs miss (was 1,897 with 2 hard hits) */
    drive: { SLIDE_GAIN: 0.35, PROGRESS: 45, KEEP: 325, ANGLE_CAP: 21.56, EDGE_SAFE: 2.37, EDGE_COST: 2875, ENTRY: 26.2, VMAX: 33.14, CHAIN_KEEP: 0, CHAIN_MARGIN: 0.34, AY_MAX: 7.28, OUTSIDE: 0.157, SETUP: 39.95, WINDOW_PRE: 3.98, WINDOW_POST: -5.28, LINK: 4.81, HB_TIME: 0.1, HB_OVER: 0.75, HB_STEER: 0.35 } },
  { id: 'r5', name: 'Halvik', car: 'driftbuild', paint: 'magenta', track: 18, side: 1, prize: 1000, laps: 3,
    style: 'The biggest angles',
    /* his own driving, moved from Knot yard (5 hard hits, 1,234) to High wire over three laps: 92.1 s, 4,338, one scrape. Fragile: every one of the 20 disturbed runs misses the bar, mostly one hard hit, so on another browser's arithmetic he may touch a wall */
    drive: { SLIDE_GAIN: 0.945, PROGRESS: 92, KEEP: 1500, ANGLE_CAP: 50.2, EDGE_SAFE: 1.66, EDGE_COST: 2786, ENTRY: 19.5, VMAX: 32.1, CHAIN_KEEP: 197, CHAIN_MARGIN: 0.24, AY_MAX: 7.38, OUTSIDE: 0.092, SETUP: 70.99, WINDOW_PRE: 13.45, WINDOW_POST: 5.64, LINK: 11.96, HB_TIME: 0.279 } },
  { id: 'r6', name: 'Sarrow', car: 'starter', paint: 'white', track: 20, side: -1, prize: 1500, laps: 3,
    style: 'Beats you in the starter coupe',
    /* Varsk's driving in the plain starter over three laps of Endless eight: 94.2 s, 5,201, no contact, 0 of 20 disturbed runs miss (was the fastback, 9 hard hits, 3,366 at best). The last rival wins in the first car */
    drive: {"SLIDE_GAIN":0.445,"PROGRESS":40,"KEEP":578,"ANGLE_CAP":29.2,"EDGE_SAFE":2.86,"EDGE_COST":2646,"ENTRY":25.85,"VMAX":33.8,"CHAIN_KEEP":0,"CHAIN_MARGIN":0.36,"AY_MAX":7.29,"OUTSIDE":0.49,"SETUP":52.23,"WINDOW_PRE":3,"WINDOW_POST":-7.89,"LINK":3.79,"HB_TIME":0.302,"HB_OVER":1.86,"HB_STEER":0.35} },
];

export function rivalById(id) { return RIVALS.find(r => r.id === id) || null; }
export function rivalOnTrack(index) { return RIVALS.find(r => r.track === index) || null; }

/* A rival opens with a star on his track and a win over the rival
   before him (briefs/RIVALS.md). Battles gate nothing that exists. */
export function rivalIndex(id) { return RIVALS.findIndex(r => r.id === id); }
/* How many rivals are in the game: the first TANDEM.LIVE, or all six
   with ?rivals=all in the address (the rest are built but not yet fair
   or robust: review/rivals/REPORT.md). */
const ALL = typeof location !== 'undefined' && /[?&]rivals=all(&|$)/.test(location.search || '');
export function rivalsLive() { return ALL ? RIVALS.length : Math.min(RIVALS.length, TANDEM.LIVE); }
export function rivalOpen(save, id) {
  const k = rivalIndex(id);
  if (k < 0 || k >= rivalsLive()) return false;
  const e = save.career[String(RIVALS[k].track)];
  if (!e || e.stars < 1) return false;
  if (k === 0) return true;
  /* the ladder is a chain (briefs/RIVALS-LADDER.md measure 4): the win over the rival before him counts only if he was earned too, so a save holding a win over the third and none over the second does not open the fourth */
  const prev = save.rivals && save.rivals[RIVALS[k - 1].id];
  return !!(prev && prev.won) && rivalOpen(save, RIVALS[k - 1].id);
}
export function openRivals(save) { return RIVALS.filter(r => rivalOpen(save, r.id)).map(r => r.id); }

/* THE LADDER, as the screens tell it (briefs/RIVALS-LADDER.md). What
   earns rival k, in the player's words, each ticked when done: a star on
   his career track, and a win over the rival before him. */
export function rivalNeeds(save, k) {
  const d = RIVALS[k];
  if (!d) return [];
  const e = save.career[String(d.track)], prev = k > 0 ? RIVALS[k - 1] : null, pe = prev && save.rivals && save.rivals[prev.id];
  /* a track the career has not opened yet says where it is, so the player knows what stands between him and it */
  const ch = CHAPTERS[chapterOf(d.track)], shut = !(e && e.stars >= 1) && !careerUnlocked(save, d.track);
  const out = [{ kind: 'star', text: 'Win a star on ' + CAREER[d.track].name, note: shut && ch ? ' (' + ch.name + ' track ' + (d.track - ch.from + 1) + ', not open yet)' : '', done: !!(e && e.stars >= 1), track: d.track }];
  if (prev) out.push({ kind: 'win', text: 'Beat ' + prev.name, done: !!(pe && pe.won) && rivalOpen(save, prev.id), rival: prev.id });
  return out;
}
/* A rival's state: 'off' (not in the game yet), 'locked', 'open' (earned
   and not yet beaten) or 'beaten'. Earned is earned for good: a beaten
   rival stays raceable. */
export function rivalState(save, k) {
  const d = RIVALS[k];
  if (!d || k >= rivalsLive()) return 'off';
  if (!rivalOpen(save, d.id)) return 'locked';
  const e = save.rivals && save.rivals[d.id];
  return e && e.won ? 'beaten' : 'open';
}
/* The title's line: how many of the live rivals are beaten, the ones open
   and not yet beaten (each a reason to tap), and before the first is
   earned, what earns him. */
export function ladderSummary(save) {
  const live = rivalsLive(), states = RIVALS.slice(0, live).map((_, k) => rivalState(save, k));
  const beaten = states.filter(s => s === 'beaten').length, ready = RIVALS.filter((_, k) => states[k] === 'open').map(r => r.id);
  const earned = states.filter(s => s === 'open' || s === 'beaten').length;
  return { live, beaten, ready, earned, first: earned ? null : rivalNeeds(save, 0).filter(n => !n.done) };
}

/* The rival's paint, never the player's (the readability rule: the
   player's car is the most findable). */
export function rivalPaint(def, playerPaint) { return def.paint !== playerPaint ? def.paint : def.altPaint || 'white'; }
