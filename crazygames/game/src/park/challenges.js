/* THE PARK'S CHALLENGES (briefs/PLAYGROUND.md 2). Eight, each with
   three levels, judged at the physics rate from the player's own world
   and the drift scorer's state. Nothing here changes either: the judge
   only reads. No timer, no start button: a challenge begins when the
   player begins doing it and ends when the slide (or the chain) does.

   What "one slide" and "one chain" mean, in the scorer's own terms
   (scoring/drift.js): the car is sliding on a step when the scorer
   scores it (drifting, with no gap); a chain is alive from its first
   scoring step until it is banked or lost.

     donut   full turns round the donut pillar in one slide, within
             reach of it. The winding angle only grows on sliding
             steps; the slide may flicker for GRACE and no longer.
     eight   links of the figure eight in one chain. A link is a pass
             round the far side of one pillar, sliding, after a pass
             round the far side of the other the same way (so the two
             loops turn opposite ways and the car crossed between
             them). Two links are one whole eight.
     slalom  cones passed in order on alternate sides in one chain. A
             cone counts once the car is clear past it and it still
             stands; any cone knocked starts the count again.
     wall    metres slid with the body within WALL_NEAR of the long
             wall, in one slide, until the wall is touched.
     gate    the speed through a gate, sideways (GATE_ANGLE or more of
             slide) and clean (no wall contact just before).
     slide   metres in one unbroken slide, anywhere.
     chain   the points of one banked chain, anywhere.
     tour    places visited in one chain: the donut pad, the figure
             eight, the slalom, the long wall and the two gates.

   A level is reached the moment its count is, not when the slide
   ends. state.value is what each is counting now, state.best the most
   this visit, state.level the level this visit's best has reached (0
   to 3), and state.events the levels reached as they happen, for the
   host to pay and celebrate. state.live is what the readout shows.
   Every number is in LOOP.PARK (tune.js). */
import { LOOP } from '../tune.js';
import { STEP, bodyPoints } from '../physics/vehicle.js';
import { wallGap } from './layout.js';

export const CHALLENGES = [
  { id: 'donut',  name: 'Donuts',       place: 'The donut pad',     what: 'Slide right round the pillar without breaking the slide.', unit: 'turns',  label: 'DONUTS' },
  { id: 'eight',  name: 'Figure eight', place: 'The twin pillars',  what: 'Loop one pillar, cross over, loop the other, in one chain.', unit: 'links', label: 'EIGHT' },
  { id: 'slalom', name: 'Slalom',       place: 'The cone line',     what: 'Weave the cones on alternate sides in one chain. Knock none.', unit: 'cones', label: 'SLALOM' },
  { id: 'wall',   name: 'Wall ride',    place: 'The long wall',     what: 'Slide close beside the orange wall without touching it.', unit: 'm', label: 'WALL RIDE' },
  { id: 'gate',   name: 'Gate crasher', place: 'Either gate',       what: 'Go through a gate sideways, as fast as you dare.', unit: 'km/h', label: 'GATE' },
  { id: 'slide',  name: 'Long slide',   place: 'Anywhere',          what: 'Hold one slide without letting it straighten.', unit: 'm', label: 'SLIDE' },
  { id: 'chain',  name: 'Big chain',    place: 'Anywhere',          what: 'Bank one big chain.', unit: 'points', label: 'CHAIN' },
  { id: 'tour',   name: 'Grand tour',   place: 'Everywhere',        what: 'Visit the places in one chain: pad, pillars, cones, wall and both gates.', unit: 'places', label: 'TOUR' },
];
export const LEVELS = ['bronze', 'silver', 'gold'];
export const challengeById = id => CHALLENGES.find(c => c.id === id);
/* the level a value reaches: how many of the three targets it meets */
export function levelOf(id, value) { const t = LOOP.PARK.TARGETS[id]; let n = 0; while (n < 3 && value >= t[n]) n++; return n; }
/* what a challenge's levels pay, and all of them together */
export const coinsOf = (id, level) => LOOP.PARK.COINS[id][level - 1];
export function allCoins() { let n = 0; for (const c of CHALLENGES) for (const v of LOOP.PARK.COINS[c.id]) n += v; return n; }
/* how many levels a save has won, of how many */
export function parkTally(won) { let n = 0; for (const c of CHALLENGES) n += Math.max(0, Math.min(3, (won && won[c.id]) | 0)); return { won: n, of: CHALLENGES.length * 3 }; }
/* a value as the readout says it */
export function sayValue(id, v) {
  const u = challengeById(id).unit, n = Math.floor(v);
  return u === 'm' ? n + ' m' : u === 'km/h' ? n + ' km/h' : u === 'places' ? n + ' of 6' : String(n);
}

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function createParkJudge(ground) {
  const G = ground.park, K = LOOP.PARK;
  const ids = CHALLENGES.map(c => c.id);
  const zero = () => { const o = {}; for (const id of ids) o[id] = 0; return o; };
  const st = {
    value: zero(), best: zero(), level: zero(),
    events: [], eventCount: 0,          // { id, level, value }: a level reached this visit, in order
    live: { id: null, value: 0, level: 0 },   // the readout: which challenge, its count, the level that count has reached
    sliding: false, alive: false,
    /* the workings, kept in the state so the probes can read them */
    off: 0,                            // s since the last sliding step
    donutWind: 0, donutAng: null,
    eightLast: null, eightSide: 0, eightAt: null,
    slalomLast: null, slalomDir: 0, slalomPending: null, slalomKnocked: 0, slalomAt: null,
    wallNear: Infinity,
    gateT: 0, gateSide: [0, 0],
    visited: {}, tourT: 0,
    drift: 0,
  };
  const pts = new Float64Array(12);
  const E = G.eight, axisZ = E.a.z, west = E.a.x < E.b.x ? E.a : E.b, east = west === E.a ? E.b : E.a;

  function reset() {
    for (const id of ids) { st.value[id] = 0; st.best[id] = 0; st.level[id] = 0; }
    st.events.length = 0; st.eventCount = 0; st.live.id = null; st.live.value = 0; st.live.level = 0;
    st.sliding = false; st.alive = false; st.off = 0; st.drift = 0; st.slalomAt = null; st.slalomKnocked = 0;
    endChain(); st.gateSide[0] = 0; st.gateSide[1] = 0; st.gateT = 0;
  }
  /* the chain is over (banked or lost), or never began: everything counted in one chain starts again */
  function endChain() {
    st.donutWind = 0; st.donutAng = null; st.eightLast = null; st.eightSide = 0; st.eightAt = null;
    st.slalomLast = null; st.slalomDir = 0; st.slalomPending = null;
    st.visited = {}; st.tourT = 0;
    st.value.donut = 0; st.value.eight = 0; st.value.slalom = 0; st.value.wall = 0; st.value.slide = 0; st.value.tour = 0;
  }
  function visit(place) { if (!st.visited[place]) { st.visited[place] = true; st.value.tour++; st.tourT = K.TOUR_SHOWN; } }

  /* world: the player's world after its step; S: the drift scorer's state after its step */
  function step(world, S) {
    const c = world.car;
    const sliding = S.drifting && S.gap === 0, alive = S.drifting;
    /* a chain banked since the last step: its points */
    if (S.drift > st.drift) st.value.chain = S.drift - st.drift;
    st.drift = S.drift;
    if (!alive) { if (st.alive) endChain(); st.alive = false; st.sliding = false; st.off = 1e9; }
    else {
      st.alive = true; st.sliding = sliding;
      st.off = sliding ? 0 : st.off + STEP;
      const broken = st.off > K.GRACE;

      /* ---- the long slide: metres, unbroken ---- */
      if (sliding) st.value.slide += c.speed * STEP; else st.value.slide = 0;

      /* ---- donuts ---- */
      {
        const D = G.donut, dx = c.x - D.x, dz = c.z - D.z, d = Math.hypot(dx, dz);
        if (broken || d > D.reach) { st.donutWind = 0; st.donutAng = null; }
        else {
          const ang = Math.atan2(dz, dx);
          if (sliding && st.donutAng !== null) st.donutWind += wrap(ang - st.donutAng);
          st.donutAng = ang;
        }
        st.value.donut = Math.floor(Math.abs(st.donutWind) / (2 * Math.PI) + 1e-9);
        if (sliding && d <= D.tour) visit('donut');
      }

      /* ---- the figure eight ---- */
      {
        /* beyond a pillar, away from the other: crossing the line through both there is a pass round its far side */
        const side = c.z > axisZ ? 1 : -1;
        const at = c.x < west.x && Math.hypot(c.x - west.x, c.z - west.z) <= E.reach ? 'w' : c.x > east.x && Math.hypot(c.x - east.x, c.z - east.z) <= E.reach ? 'e' : null;
        if (at && st.eightAt === at && st.eightSide && side !== st.eightSide && sliding) {
          const L = st.eightLast;
          st.value.eight = L && L.at !== at && L.heading === side ? st.value.eight + 1 : 1;
          st.eightLast = { at, heading: side };
        }
        st.eightAt = at; st.eightSide = side;
        if (sliding && (Math.hypot(c.x - E.a.x, c.z - E.a.z) <= E.tour || Math.hypot(c.x - E.b.x, c.z - E.b.z) <= E.tour)) visit('eight');
      }

      /* ---- the long wall ---- */
      {
        const W = G.wall;
        bodyPoints(c, pts);
        let near = Infinity;
        for (let k = 0; k < 6; k++) { const d = wallGap(W, pts[k * 2], pts[k * 2 + 1]); if (d < near) near = d; }
        st.wallNear = near;
        if (broken || (world.touching && near < 1)) st.value.wall = 0;
        else if (sliding && near <= K.WALL_NEAR) st.value.wall += c.speed * STEP;
        if (sliding && near <= K.TOUR_WALL) visit('wall');
      }

      /* ---- the slalom ---- */
      {
        const Sl = G.slalom, lat = c.z - Sl.z, at = c.x;
        if (world.conesKnocked !== st.slalomKnocked) { st.value.slalom = 0; st.slalomLast = null; st.slalomDir = 0; st.slalomPending = null; }
        /* a cone the car has drawn level with, inside reach: counted once the car is clear past it and it still stands */
        if (st.slalomAt !== null && Math.abs(lat) <= K.SLALOM_REACH) {
          for (let i = 0; i < Sl.n; i++) { const x = Sl.x[i]; if ((st.slalomAt - x) * (at - x) < 0 || (at === x && st.slalomAt !== x)) st.slalomPending = { i, side: lat > 0 ? 1 : -1, dir: at > st.slalomAt ? 1 : -1 }; }
        }
        const Pn = st.slalomPending;
        if (Pn && Math.abs(at - Sl.x[Pn.i]) >= K.SLALOM_CLEAR) {
          st.slalomPending = null;
          if (!world.cones[Sl.first + Pn.i].knocked && (at - Sl.x[Pn.i]) * Pn.dir > 0) {
            const L = st.slalomLast;
            st.value.slalom = L && Pn.i === L.i + Pn.dir && Pn.dir === st.slalomDir && Pn.side === -L.side ? st.value.slalom + 1 : 1;
            st.slalomLast = { i: Pn.i, side: Pn.side }; st.slalomDir = Pn.dir;
          }
        }
        if (sliding && Math.abs(lat) <= K.TOUR_SLALOM && at >= Sl.x[0] - 5 && at <= Sl.x[Sl.n - 1] + 5) visit('slalom');
      }
    }
    st.slalomAt = c.x; st.slalomKnocked = world.conesKnocked;

    /* ---- the gates: the speed through, sideways and clean; and the tour's visit ---- */
    for (let k = 0; k < G.gates.length; k++) {
      const g = G.gates[k], u = g.along === 'z' ? c.z - g.z : c.x - g.x, v = g.along === 'z' ? c.x - g.x : c.z - g.z;
      const side = u > 0 ? 1 : -1, was = st.gateSide[k];
      st.gateSide[k] = side;
      if (!was || side === was || Math.abs(v) > g.gap / 2) continue;
      if (alive) visit('gate-' + g.id);
      const clean = !world.touching && (world.lastTouch < 0 || world.time - world.lastTouch > K.GATE_CLEAN);
      if (sliding && S.angle >= K.GATE_ANGLE && clean) { st.value.gate = c.speed * 3.6; st.gateT = K.GATE_SHOWN; }
    }
    if (st.gateT > 0) { st.gateT -= STEP; if (st.gateT <= 0) st.value.gate = 0; }
    if (st.tourT > 0) st.tourT -= STEP;

    /* ---- the best this visit, and the levels it reaches ---- */
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k], v = st.value[id];
      if (v > st.best[id]) {
        st.best[id] = v;
        const lv = levelOf(id, v);
        if (lv > st.level[id]) { st.level[id] = lv; st.events.push({ id, level: lv, value: v }); st.eventCount++; if (st.events.length > 12) st.events.shift(); }
      }
    }

    /* ---- the readout: what is being counted now ---- */
    const V = st.value;
    let id = null;
    if (V.gate > 0) id = 'gate';
    else if (V.donut > 0 || Math.abs(st.donutWind) >= K.DONUT_SHOWN * 2 * Math.PI) id = 'donut';
    else if (V.eight > 0) id = 'eight';
    else if (V.slalom > 0) id = 'slalom';
    else if (V.wall >= K.WALL_SHOWN) id = 'wall';
    else if (st.tourT > 0 && V.tour >= 2) id = 'tour';
    else if (V.slide >= K.SLIDE_SHOWN) id = 'slide';
    st.live.id = id; st.live.value = id ? V[id] : 0; st.live.level = id ? levelOf(id, V[id]) : 0;
  }
  return { state: st, step, reset, ground };
}

/* Cones knocked over stand up again once they are at rest and the car
   is well away (LOOP.PARK.RESTAND), so the slalom is there to try again
   without leaving the park. The host calls this, not the judge, which
   only reads: it is the one thing in the park that writes to the
   world, and only in free drift. */
export function restandCones(world) {
  const R = LOOP.PARK.RESTAND, c = world.car;
  for (const k of world.cones) {
    if (!k.knocked || k.vx !== 0 || k.vz !== 0) continue;
    if (Math.hypot(k.x - c.x, k.z - c.z) < R || Math.hypot(k.x0 - c.x, k.z0 - c.z) < R) continue;
    k.x = k.x0; k.z = k.z0; k.knocked = 0; k.tilt = 0; k.tiltX = 0; k.tiltZ = 0;
  }
}
