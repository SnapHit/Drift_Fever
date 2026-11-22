/* A STRANGER'S THUMBS (briefs/FIRST-MINUTE.md, priority 1 and measure 1).
   Scripted hands that play like someone who has never seen the game: on
   a phone, the two steer buttons and DRIFT / BRAKE (Easy, the throttle
   automatic); on a keyboard, Pro's keys (W to drive, the arrows, SPACE,
   S), which is what a desktop gets by default.

   The hands see what a player sees (the car and the road ahead, and
   which prompt is up) and act like a person who does not know the car
   yet, with every number drawn from the run's seed so each disturbed
   run is a different stranger:
   - late: what they see reaches the thumb THUMBS.REACT seconds later,
     and they anticipate less than a practised player (THUMBS.LEAD: the
     error is judged a little ahead from how fast it is changing, as a
     person sees the car turning);
   - bang-bang: a button is pressed when the car points off the road
     ahead by more than a deadband, and let go once it points back, a
     little after it should be (over-long), and now and then a press is
     cut short (over-short);
   - surprised by a wall: whatever is held stays held for a moment after
     a touch (the steering held into the wall);
   - unsure: coming into a corner fast, now and then DRIFT / BRAKE alone
     (on Easy it brakes) or S on a keyboard;
   - told to: when a prompt comes up, after reading it, they do what it
     says (slide, brake), wherever the car is;
   - a slide tried in a corner: DRIFT held with the corner's button, too
     early or too late, too short or too long, then steering by the nose
     again (which, in a slide, means steering out of it).
   Nothing here reads the physics' internals to decide an input beyond
   what is on screen: the car's place, heading and speed, the road, the
   prompt.

   One self-contained function, so the same source drives a page (it is
   handed in as text) and Node. makeThumbs(track, seed, opts) returns
   { frame(world, ctx) -> { left, right, hb, w, s }, P (the personality),
   log }, called once a frame at 60 Hz; ctx: { state, prompt, pro }.
   opts.scale multiplies every reaction and hold time (a known answer). */
export function makeThumbs(track, seed, opts) {
  const o = opts || {};
  /* the personality: every range is a stranger's, not a skilled player's */
  const THUMBS = {
    REACT: [0.18, 0.32],        // s from seeing to pressing
    LEAD: [0.1, 0.3],           // s ahead the error is judged from how fast it changes (a practised player's is longer)
    LOOK_T: [0.55, 0.9],        // s of road ahead they steer for
    LOOK_MIN: 6,                // m, at least
    DEAD: [3, 7],               // degrees off before a press
    RELEASE: [0.2, 0.5],        // share of the deadband the car must come back inside before the press ends
    MIN_HOLD: [0.08, 0.16],     // s a press lasts at least
    LINGER: [0.04, 0.2],        // s a press stays on after it should end (over-long)
    SHORT: [0.1, 0.3],          // chance a press is cut short (over-short), at 0.05 to 0.12 s
    WALL_FREEZE: [0.25, 0.6],   // s the hands stay as they are after a wall touch
    DRIFT_BEFORE: 0.15,         // chance of trying a slide in a corner before the drift prompt has been seen
    DRIFT_AFTER: [0.4, 0.8],    // and after it
    DRIFT_AT: [-15, 10],        // m from the corner's start the slide is tried (early, late)
    DRIFT_HOLD: [0.3, 1.6],     // s DRIFT is held in a slide on Easy
    TAP_HOLD: [0.15, 0.6],      // s SPACE is held in a slide on Pro (the prompt says tap)
    UNSURE: [0.15, 0.45],       // chance per corner of DRIFT / BRAKE alone (Easy) or S (Pro) coming in fast
    UNSURE_FAST: 20,            // m/s: fast, to a stranger
    UNSURE_HOLD: [0.2, 0.8],    // s
    READ: [0.5, 1.2],           // s to read a prompt before doing what it says
    BRAKE_PROMPT: 0.75,         // chance of trying the brake prompt
    PROMPT_BRAKE_HOLD: [0.4, 1.0],   // s
    GO_LATE: [0.3, 1.5],        // s after GO a keyboard stranger finds W (Pro)
    LIFT: [0.1, 0.35],          // chance per corner of letting W go coming in fast (Pro)
    LIFT_HOLD: [0.2, 0.6],      // s
  };
  let s = (seed >>> 0) || 1;
  const rnd = () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const U = r => r[0] + (r[1] - r[0]) * rnd();
  const k = o.scale || 1;
  const P = {
    react: U(THUMBS.REACT) * k, lead: U(THUMBS.LEAD), lookT: U(THUMBS.LOOK_T), dead: U(THUMBS.DEAD), release: U(THUMBS.RELEASE),
    minHold: U(THUMBS.MIN_HOLD) * k, linger: U(THUMBS.LINGER) * k, short: U(THUMBS.SHORT), wallFreeze: U(THUMBS.WALL_FREEZE),
    driftAfter: U(THUMBS.DRIFT_AFTER), unsure: U(THUMBS.UNSURE), read: U(THUMBS.READ), goLate: U(THUMBS.GO_LATE), lift: U(THUMBS.LIFT),
  };
  const C = track.centre, n = C.length, closed = track.kind === 'circuit', L = track.length;
  const at = i => closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
  const corners = (track.corners || []).map(c => ({ from: c.from, to: c.to, dir: c.dir === 'left' ? -1 : 1 })).sort((a, b) => a.from - b.from);
  const DT = 1 / 60, lag = Math.max(1, Math.round(P.react / DT));
  const seen = new Float64Array(lag + 7);   // the error as seen, frame by frame: the thumb acts on what it was REACT ago, and how it was changing then
  let head = 0, frames = 0;
  const out = { left: 0, right: 0, hb: 0, w: 0, s: 0 };
  const st = { side: 0, since: 0, cut: -1, lingerT: -1, freeze: 0, slide: null, unsure: null, lift: null, plans: new Map(), promptSeen: {}, promptT: 0, prompt: null, goT: -1, wHeld: false, lastTouch: false, driftPrompted: false, brakeDone: false };
  const log = { presses: 0, slides: 0, unsure: 0, promptSlides: 0, promptBrakes: 0, freezes: 0, lifts: 0 };

  /* the next corner ahead of s (or the one the car is in) and how far */
  function cornerAhead(sAlong) {
    let best = null, ahead = Infinity;
    for (const c of corners) {
      if (sAlong >= c.from && sAlong <= c.to) return { c, ahead: 0 };
      const a = closed ? ((c.from - sAlong) % L + L) % L : c.from - sAlong;
      if (a >= 0 && a < ahead) { ahead = a; best = c; }
    }
    return { c: best, ahead };
  }
  /* what a corner looks like to this stranger, decided once per pass of it */
  function planFor(c, lap) {
    const key = c.from + ':' + lap;
    if (!st.plans.has(key)) st.plans.set(key, { slide: rnd() < (st.driftPrompted ? P.driftAfter : THUMBS.DRIFT_BEFORE), at: U(THUMBS.DRIFT_AT), hold: o.pro ? U(THUMBS.TAP_HOLD) : U(THUMBS.DRIFT_HOLD) * k, unsure: rnd() < P.unsure, unsureHold: U(THUMBS.UNSURE_HOLD), lift: o.pro && rnd() < P.lift, liftHold: U(THUMBS.LIFT_HOLD), done: false, unsureDone: false, liftDone: false });
    return st.plans.get(key);
  }
  /* how far the car points off the road ahead, degrees, + when the road is to its right */
  function error(world) {
    const car = world.car, v = car.speed;
    const look = Math.max(THUMBS.LOOK_MIN, v * P.lookT);
    const t = C[at(world.centreIndex + Math.round(look / 2))];
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), lx = -Math.cos(car.yaw), lz = Math.sin(car.yaw);
    const dx = t.x - car.x, dz = t.z - car.z;
    return -Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz) * 180 / Math.PI;
  }
  function press(side) { if (st.side !== side) { st.side = side; st.since = 0; st.lingerT = -1; st.cut = rnd() < P.short ? 0.05 + rnd() * 0.07 : -1; if (side) log.presses++; } }

  function frame(world, ctx) {
    frames++;
    const car = world.car, driving = ctx.state === 'drive';
    out.left = 0; out.right = 0; out.hb = 0; out.s = 0;
    if (!driving) { out.w = 0; st.side = 0; return out; }
    /* the prompts, read and then done */
    if (ctx.prompt !== st.prompt) { st.prompt = ctx.prompt; st.promptT = 0; }
    else st.promptT += DT;
    /* a lap: the car's place along the track wraps (each corner is a new decision every lap) */
    if (st.prevAlong !== undefined && closed && st.prevAlong - world.along > L / 2) st.lapCount = (st.lapCount || 0) + 1;
    st.prevAlong = world.along;
    /* Pro: the throttle, once W is found */
    if (o.pro) {
      if (st.goT < 0) st.goT = 0; else st.goT += DT;
      st.wHeld = st.goT >= P.goLate;
    }
    /* what the eyes see now, and what the thumb acts on (from REACT ago) */
    seen[head] = error(world);
    const back = j => seen[((head - j) % seen.length + seen.length) % seen.length];
    const e = frames > lag + 6 ? back(lag) + P.lead * (back(lag) - back(lag + 6)) * 10 : 0;   // the error then, and its rate over 0.1 s, judged LEAD ahead
    head = (head + 1) % seen.length;
    /* a wall touch: the hands freeze as they are for a moment */
    if (world.touching && !st.lastTouch) { st.freeze = P.wallFreeze; log.freezes++; }
    st.lastTouch = !!world.touching;
    const { c, ahead } = cornerAhead(world.along);
    const plan = c ? planFor(c, st.lapCount || 0) : null;
    /* the prompts say what to do */
    if (ctx.prompt === 'drift') st.driftPrompted = true;
    if (ctx.prompt === 'drift' && st.promptT >= P.read && !st.promptSeen.drift && !st.slide) {
      st.promptSeen.drift = true; log.promptSlides++;
      const dir = c ? c.dir : (e >= 0 ? 1 : -1);
      st.slide = { dir, left: o.pro ? U(THUMBS.TAP_HOLD) : U(THUMBS.DRIFT_HOLD) * k };
    }
    if (ctx.prompt === 'brake' && st.promptT >= P.read && !st.promptSeen.brake) {
      st.promptSeen.brake = true;
      if (rnd() < THUMBS.BRAKE_PROMPT) { st.unsure = { left: U(THUMBS.PROMPT_BRAKE_HOLD) }; log.promptBrakes++; }
    }
    /* a corner coming: a slide, an unsure press, a lift */
    if (plan && !st.slide && !st.unsure) {
      if (plan.slide && !plan.done && (ahead > 0 ? -ahead : world.along - c.from) >= plan.at) { plan.done = true; log.slides++; st.slide = { dir: c.dir, left: plan.hold }; }
      else if (plan.unsure && !plan.unsureDone && ahead > 0 && ahead < 25 && car.speed > THUMBS.UNSURE_FAST) { plan.unsureDone = true; log.unsure++; st.unsure = { left: plan.unsureHold }; }
    }
    if (plan && o.pro && plan.lift && !plan.liftDone && ahead > 0 && ahead < 30 && car.speed > THUMBS.UNSURE_FAST) { plan.liftDone = true; log.lifts++; st.lift = { left: plan.liftHold }; }
    /* the thumbs */
    if (st.freeze > 0) {
      st.freeze -= DT;   // as they were
      out.left = st.side < 0 ? 1 : 0; out.right = st.side > 0 ? 1 : 0;
      if (st.slide) { out.hb = 1; st.slide.left -= DT; if (st.slide.left <= 0) st.slide = null; }
      if (st.unsure) { if (o.pro) out.s = 1; else out.hb = 1; st.unsure.left -= DT; if (st.unsure.left <= 0) st.unsure = null; }
    } else if (st.unsure) {
      /* unsure: DRIFT / BRAKE alone on Easy (the steer buttons let go), S on Pro */
      if (o.pro) { out.s = 1; } else { press(0); out.hb = 1; }
      st.unsure.left -= DT; if (st.unsure.left <= 0) st.unsure = null;
      if (o.pro) steer(e);
    } else if (st.slide) {
      /* a slide: the corner's button with DRIFT (SPACE) */
      press(st.slide.dir);
      out.hb = 1;
      st.slide.left -= DT; if (st.slide.left <= 0) st.slide = null;
    } else steer(e);
    if (st.side < 0) out.left = 1; else if (st.side > 0) out.right = 1;
    if (o.pro) {
      out.w = st.wHeld && !out.s ? 1 : 0;
      if (st.lift) { out.w = 0; st.lift.left -= DT; if (st.lift.left <= 0) st.lift = null; }
    }
    st.since += DT;
    return out;
  }
  /* bang-bang on the error, with a deadband, a minimum press, a release that lingers and the odd short one */
  function steer(e) {
    const want = Math.abs(e) > P.dead ? (e > 0 ? 1 : -1) : 0;
    if (st.side === 0) { if (want) press(want); return; }
    if (st.cut > 0 && st.since >= st.cut) { press(0); return; }
    if (st.since < P.minHold) return;
    if (want === -st.side) { press(0); return; }   // the other way: off first, the other button next frame
    const back = e * st.side < P.dead * P.release;
    if (back) { if (st.lingerT < 0) st.lingerT = 0; else st.lingerT += DT; if (st.lingerT >= P.linger) press(0); }
    else st.lingerT = -1;
  }
  return { frame, P, log, THUMBS };
}
