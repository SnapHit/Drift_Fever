/* BEING AHEAD PAYS (briefs/DRIFT-RACE.md). A drift race is cut into
   gates: every checkpoint and every lap's line, and the finish last.
   The first car to reach a gate banks a lead bonus; the first across the
   finish banks a larger one (TANDEM.LEAD_SHARE and LINE_SHARE, shares of
   the track's first star, as the clean and pace bonuses are). Both cars
   play by it. If both reach a gate in the same step, the one further
   past it has it, and a dead heat is the player's.

   The bonuses are kept here, apart from either car's own scoring, so the
   rival's driving hash and the player's solo score never depend on the
   other car; a race's total is the scoring's total plus what is banked
   here. Also keeps the place and the gap for the HUD: who is ahead in
   run distance, and by how many seconds (the time since the leader was
   where the other car is now).

   Stepped at the physics rate after both worlds, so a replay scores the
   same. With no rival nothing here exists. */
import { TANDEM } from '../tune.js';
import { STEP } from '../physics/world.js';
import { runMetres, starRate } from '../loop/modes.js';

export function createLead(track, laps) {
  const circuit = track.kind === 'circuit', cps = (track.checkpoints || []).length;
  const gates = circuit ? laps * (cps + 1) : cps + 1;
  const metres = runMetres(track, laps), rate = starRate(track);
  const perGate = gates > 1 ? Math.round(TANDEM.LEAD_SHARE * rate * metres / (gates - 1)) : 0;
  const line = Math.round(TANDEM.LINE_SHARE * rate * metres);
  /* the player's winning margin: points for s seconds clear at the line (TANDEM.MARGIN_SHARE of the first star a second, up to MARGIN_CAP) */
  const perSecond = TANDEM.MARGIN_SHARE * rate * metres;
  const margin = s => Math.round(Math.min(TANDEM.MARGIN_CAP, Math.max(0, s || 0)) * perSecond);
  const start = track.start ? track.start.along || 0 : 0;
  const passed = p => circuit ? p.lap * (cps + 1) + p.nextCp : p.nextCp + (p.finished ? 1 : 0);
  const mk = () => ({ done: 0, lead: 0, line: 0, gates: 0, total: 0, reach: [] });
  const L = {
    gates, perGate, lineValue: line, steps: 0,
    player: mk(), rival: mk(),
    owner: [],          // per gate: 'player' or 'rival'
    place: 1,           // the player's: 1 ahead or level, 2 behind
    gap: 0,             // s between the cars
    changes: 0,         // how many times the place has changed hands
    aheadT: 0,          // s the player has spent ahead
    events: [], eventCount: 0,   // the last few { who, kind, v, gate } for the HUD
  };
  function reset() {
    L.player = mk(); L.rival = mk(); L.owner.length = 0; L.steps = 0; L.place = 1; L.gap = 0; L.changes = 0; L.aheadT = 0; L.events.length = 0; L.eventCount = 0; placed = false;
  }
  let placed = false;
  function bank(who, k) {
    const e = L[who], fin = k === gates - 1, v = fin ? line : perGate;
    L.owner[k] = who;
    if (fin) e.line += v; else { e.lead += v; e.gates++; }
    e.total += v;
    L.events.push({ who, kind: fin ? 'line' : 'lead', v, gate: k }); L.eventCount++;
    if (L.events.length > 6) L.events.shift();
  }
  /* each car's first step at each whole metre into the run, for the gap */
  function reachAt(e, d) {
    const m = Math.floor(d - start);
    while (e.reach.length <= m && m >= 0) e.reach.push(L.steps);
  }
  function gapOf(lead, trailDist) {
    const m = Math.floor(trailDist - start);
    if (m < 0 || m >= lead.reach.length) return 0;
    return (L.steps - lead.reach[m]) * STEP;
  }
  /* pp, rp: the player's and the rival's progress states; pd, rd: their
     metres into the run (unwrapped). After both worlds have stepped. */
  function step(pp, rp, pd, rd) {
    L.steps++;
    const nP = Math.min(gates, passed(pp)), nR = Math.min(gates, passed(rp));
    for (let k = Math.min(L.player.done, L.rival.done); k < Math.max(nP, nR); k++) {
      if (L.owner[k]) continue;
      const p = k < nP, r = k < nR;
      if (p && r) bank(pd - rd >= 0 ? 'player' : 'rival', k);   // the same step: the one further on; a dead heat is the player's
      else if (p) bank('player', k);
      else if (r) bank('rival', k);
    }
    L.player.done = nP; L.rival.done = nR;
    reachAt(L.player, pd); reachAt(L.rival, rd);
    /* the place: by run distance, until either is home; then by who finished first */
    const pFin = !!pp.finished, rFin = !!rp.finished;
    const place = pFin || rFin ? (L.owner[gates - 1] === 'rival' ? 2 : 1) : pd >= rd ? 1 : 2;
    if (placed && place !== L.place) L.changes++;
    L.place = place; placed = true;
    if (place === 1 && !pFin && !rFin) L.aheadT += STEP;
    /* the leader's time back to where the other car is now */
    L.gap = pFin || rFin ? 0 : place === 1 ? gapOf(L.player, rd) : gapOf(L.rival, pd);
    return L;
  }
  return { state: L, step, reset, passed, margin };
}
