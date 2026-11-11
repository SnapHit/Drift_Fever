/* CHOOSING A RIVAL'S DRIVING WITH A PLAYER'S HANDS (briefs/DRIFT-RACE.md
   priority 1). The rivals round's search (game/test/rivals/search.js:
   a random search, then a local one, each candidate judged by its worst
   run under small disturbances) with his driver planning under the
   player's controls (RIVAL_DRIVE.HANDS), the race's laps, and two more
   terms: his finish time should sit at the scripted players' pace
   (--seconds, the time the race is to be close at), and his total under
   a ceiling (--cap, so a player who slides the drift corners can beat
   him). The page and the probes are the record; this is the search.

   node game/test/driftrace/search.js r1 [--n 300] [--seed 1] [--seconds 60] [--cap 1700] [--disturb 6] */
import { measureRival } from '../rivals/sim.js';
import { RANGES, CHARACTERS, mark } from '../rivals/search.js';
import { rivalById } from '../../src/rivals/roster.js';
import { RIVAL_DRIVE } from '../../src/rivals/driver.js';

export const HAND_RANGES = Object.assign({}, RANGES, { HB_OVER: [0.5, 6], HB_STEER: [0.05, 0.5], VMAX: [22, 34] });
/* the race's characters: the first rival smooth and wide, a modest drifter who banks each corner (shallow angles, no long links), so a player who slides the drift corners well can outscore him */
export const RACE_CHARACTERS = { r1: { ANGLE_CAP: [16, 30], LINK: [0, 6], CHAIN_KEEP: [0, 400], SLIDE_GAIN: [0.15, 0.8] } };
/* the disturbances: the start a few cm off and the grip half a per cent off */
export const DISTURB = [{}, { offset: [0.04, -0.03], grip: 0.005 }, { offset: [-0.05, 0.02], grip: -0.005 }, { offset: [0.01, 0.05], grip: 0.002 }, { offset: [-0.02, -0.04], grip: -0.003 }, { offset: [0.03, 0.03], grip: 0.004 }];

export function judge(def, drive, o) {
  const runs = (o.disturb || DISTURB).map(d => measureRival({ ...def, drive }, { ...d, maxSeconds: 240 }));
  const m = mark(runs, o.want);
  let v = m.value;
  for (const r of runs) {
    v -= Math.max(0, Math.abs(r.seconds - o.seconds) - o.slack) * 300;
    v -= Math.max(0, r.total - o.cap) * (o.capWeight || 1);   // capWeight: the ladder round's searches pull harder on a ceiling (1 as before)
    v -= r.contacts * 600 + r.hard * 3000;
    /* sliding every corner is the rule (the bar is 30 per cent of each): a demand, not a preference */
    v -= Math.max(0, 0.33 - r.worstCorner) * 60000;
  }
  const secs = runs.map(r => r.seconds), tots = runs.map(r => r.total);
  return { value: v, detail: Object.assign({}, m.detail, { seconds: [Math.min(...secs), Math.max(...secs)], totals: [Math.min(...tots), Math.max(...tots)], contacts: Math.max(...runs.map(r => r.contacts)), worstCorner: +Math.min(...runs.map(r => r.worstCorner)).toFixed(2) }) };
}

let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const round = (k, v) => /KEEP|COST|PROGRESS/.test(k) ? Math.round(v) : /TIME|GAIN|OUTSIDE/.test(k) ? +v.toFixed(3) : +v.toFixed(2);

export function search(def, o) {
  rs = o.seed || 1;
  const ranges = Object.assign({}, HAND_RANGES, o.ranges || {});
  let best = { drive: Object.assign({}, def.drive), ...judge(def, def.drive, o) };
  console.log('start ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  for (let k = 0; k < o.n; k++) {
    const local = k > o.n * (o.localFrom === undefined ? 0.35 : o.localFrom);
    const drive = Object.assign({}, local ? best.drive : {});
    for (const key of Object.keys(ranges)) {
      const [a, b] = ranges[key];
      if (local) { if (rnd() < 0.3) { const cur = drive[key] !== undefined ? drive[key] : RIVAL_DRIVE[key]; drive[key] = round(key, Math.max(a, Math.min(b, cur + (rnd() - 0.5) * (b - a) * 0.25))); } }
      else drive[key] = round(key, a + (b - a) * rnd());
    }
    const r = judge(def, drive, o);
    if (r.value > best.value) { best = { drive, ...r }; console.log(k + ' ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail) + ' ' + JSON.stringify(drive)); }
  }
  return best;
}

if (process.argv[1] && process.argv[1].endsWith('driftrace/search.js')) {
  const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? +args[args.indexOf(k) + 1] : d;
  const def = { ...rivalById(args.find(a => /^r\d/.test(a)) || 'r1') };
  if (args.includes('--fresh')) def.drive = {};
  /* --from grip|slide|mixed: start from a scripted player's numbers, and search near them from the first try */
  if (args.includes('--from')) { const { PLAYERS } = await import('../../src/rivals/players.js'); def.drive = { ...PLAYERS[args[args.indexOf('--from') + 1]].drive }; }
  const ch = CHARACTERS[def.id] || {};
  const best = search(def, { n: arg('--n', 300), seed: arg('--seed', 1), seconds: arg('--seconds', 60), slack: arg('--slack', 1.5), cap: arg('--cap', 1700), want: ch.want, ranges: Object.assign({}, ch.ranges, args.includes('--character') ? RACE_CHARACTERS[def.id] : {}), disturb: args.includes('--all20') ? [{}, ...(await import('./hands.js')).DISTURB] : DISTURB.slice(0, arg('--disturb', 6)), localFrom: args.includes('--from') || args.includes('--local') ? 0 : undefined });
  console.log('best ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  console.log('drive: ' + JSON.stringify(best.drive));
}
