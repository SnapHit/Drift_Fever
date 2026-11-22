/* FIRST-RUN ONBOARDING. The game opens on the title; on a new player's
   first run of anything (a career track, the daily, the stunt park) this
   shows short prompts at the moments they apply: steer, DRIFT / BRAKE with steering
   to slide, DRIFT / BRAKE alone to brake, then what a banked chain and a
   clean sector are the first time each happens. Every prompt is shown
   once and goes when it is done (or after LOOP.ONBOARD.PROMPT_MAX
   seconds if ignored, so the next can come). On a keyboard the keys are
   drawn as key caps; on touch an arrow points at the button. One SKIP
   ends it. The car is never paused. Plain DOM, nothing per frame unless
   something changes.

   On Pro (briefs/PRO-CONTROLS.md, a keyboard or a gamepad driving with
   throttle and brake) the prompts are Pro's own: drive, steer, the
   handbrake to slide, the throttle to hold it, brake. The key caps print
   what this keyboard's keys print (input/layout.js). */
import { LOOP, PROFILES, FIRST } from '../tune.js';
import { keyLabel } from '../input/layout.js';
import { FIRST_ON } from '../first.js';

const KEYS = {
  steer: '<span class="keys"><kbd>&#9664;</kbd><kbd>&#9654;</kbd><i>or</i><kbd data-code="KeyA">A</kbd><kbd data-code="KeyD">D</kbd></span>',
  drift: '<span class="keys"><kbd class="wide">SPACE</kbd><i>+</i><kbd>&#9664;</kbd><kbd>&#9654;</kbd></span>',
  brake: '<span class="keys"><kbd class="wide">SPACE</kbd></span>',
};
const PAD = {
  steer: '<span class="keys"><kbd class="pad">&#9664;</kbd><kbd class="pad">&#9654;</kbd><i>+ stick</i></span>',
  drift: '<span class="keys"><kbd class="pad round">A</kbd><i>+ stick</i></span>',
  brake: '<span class="keys"><kbd class="pad round">A</kbd></span>',
};
const TEXT = {
  steer: { keys: 'Steer', touch: 'Steer with the left and right buttons' },
  drift: { keys: 'Hold SPACE while steering to slide', touch: 'Hold DRIFT / BRAKE while steering to slide' },
  brake: { keys: 'SPACE on its own brakes', touch: 'DRIFT / BRAKE on its own brakes' },
  chain: 'Straighten up to bank a drift chain. The longer the slide, the bigger the multiplier.',
  clean: 'A sector with no wall hits pays a clean bonus.',
};
/* Pro's five, in order; steer is Easy's */
const PRO_STEPS = ['drive', 'steer', 'drift', 'hold', 'brake'];
const PRO_KEYS = {
  drive: '<span class="keys"><kbd data-code="KeyW">W</kbd><i>or</i><kbd>&#9650;</kbd></span>',
  steer: KEYS.steer,
  drift: '<span class="keys"><kbd class="wide">SPACE</kbd><i>+</i><kbd>&#9664;</kbd><kbd>&#9654;</kbd></span>',
  hold: '<span class="keys"><kbd data-code="KeyW">W</kbd><i>+ steer against the slide</i></span>',
  brake: '<span class="keys"><kbd data-code="KeyS">S</kbd><i>or</i><kbd>&#9660;</kbd></span>',
};
const PRO_PAD = {
  drive: '<span class="keys"><kbd class="pad">RT</kbd></span>',
  steer: PAD.steer,
  drift: '<span class="keys"><kbd class="pad round">A</kbd><i>+ stick</i></span>',
  hold: '<span class="keys"><kbd class="pad">RT</kbd><i>+ stick against the slide</i></span>',
  brake: '<span class="keys"><kbd class="pad">LT</kbd></span>',
};
const PRO_TEXT = {
  drive: { keys: 'Hold {W} to drive', pad: 'Hold RT to drive' },
  steer: { keys: 'Steer', pad: 'Steer' },
  drift: { keys: 'Tap SPACE while steering to slide', pad: 'Tap A while steering to slide' },
  hold: { keys: 'Hold the slide: throttle on, steer against it', pad: 'Hold the slide: throttle on, steer against it' },
  brake: { keys: '{S} brakes, and reverses once stopped', pad: 'LT brakes, and reverses once stopped' },
};
/* the letters on the caps, and in the words, as this keyboard prints them */
const byLayout = html => html.replace(/data-code="(\w+)">(\w)</g, (m, c, q) => 'data-code="' + c + '">' + keyLabel(c, q) + '<');
const lettered = text => text.replace(/\{([WASD])\}/g, (m, q) => keyLabel('Key' + q, q));

export function createOnboarding(root, onSkip) {
  const el = document.createElement('div');
  el.id = 'onboard';
  el.hidden = true;
  el.innerHTML = `<div class="prompt" hidden></div><div class="info" hidden></div><button type="button" id="skip">SKIP</button>`;
  root.appendChild(el);
  const prompt = el.querySelector('.prompt'), info = el.querySelector('.info'), skip = el.querySelector('#skip');
  skip.addEventListener('click', e => { e.stopPropagation(); stop(true); if (onSkip) onSkip(); });

  const O = LOOP.ONBOARD, OP = PROFILES.PRO_PROMPTS;
  const st = {
    active: false, step: null, stepT: 0, steerT: 0, hbT: 0, waitT: 0,
    done: { steer: false, drift: false, brake: false }, how: {}, shown: [], infoT: 0, infoKind: null,
    chainShown: false, cleanShown: false, skipped: false, source: 'keys', mode: 'easy',
    corners: 0, inCorner: false,   // corners driven, for the first minute's prompts (FIRST.ONBOARD)
  };
  let lastPrompt = '', lastInfo = '', lastPos = '';

  /* mode: 'pro' for Pro's five prompts, else Easy's three */
  function start(source, mode) {
    st.active = true; st.step = null; st.stepT = 0; st.steerT = 0; st.hbT = 0; st.waitT = 0;
    st.done.steer = st.done.drift = st.done.brake = false; st.how = {}; st.shown.length = 0; st.infoT = 0; st.infoKind = null;
    st.chainShown = st.cleanShown = false; st.skipped = false; st.source = source || 'keys'; st.corners = 0; st.inCorner = false;
    st.mode = mode === 'pro' ? 'pro' : 'easy';
    if (st.mode === 'pro') st.done.drive = st.done.hold = false; else { delete st.done.drive; delete st.done.hold; }
    el.hidden = false; skip.hidden = false;
    setPrompt('', '');
    setInfo('');
  }
  function stop(skipped) {
    st.active = false; st.step = null; st.skipped = !!skipped;
    el.hidden = true; setPrompt('', ''); setInfo('');
  }
  function setPrompt(html, pos) {
    if (html !== lastPrompt) { lastPrompt = html; prompt.innerHTML = html; prompt.hidden = !html; }
    if (pos !== lastPos) { lastPos = pos; prompt.className = 'prompt' + (pos ? ' ' + pos : ''); }
  }
  function setInfo(html) { if (html !== lastInfo) { lastInfo = html; info.innerHTML = html; info.hidden = !html; } }
  function show(step) {
    st.step = step; st.stepT = 0; st.steerT = 0; st.hbT = 0; st.shown.push(step);
    const touch = st.source === 'touch', pad = st.source === 'pad';
    if (st.mode === 'pro' && !(touch && TEXT[step])) {
      /* Pro's words (a Pro run gone over to touch keeps them for drive and hold, which touch does not have) */
      const text = lettered(PRO_TEXT[step][pad ? 'pad' : 'keys']);
      const keys = touch ? '' : pad ? PRO_PAD[step] : byLayout(PRO_KEYS[step]);
      setPrompt('<b>' + text + '</b>' + keys, 'centre');
      return;
    }
    const text = TEXT[step][touch ? 'touch' : 'keys'];
    const keys = touch ? '' : pad ? PAD[step] : byLayout(KEYS[step]);
    const arrow = touch ? '<span class="arrow">&#9660;</span>' : '';
    setPrompt('<b>' + text + '</b>' + keys + arrow, touch ? (step === 'steer' ? 'at-left' : 'at-right') : 'centre');
  }
  /* how: 'done' when the player did it, 'timeout' when it was left */
  function finish(step, how) { st.done[step] = true; st.how[step] = how; st.step = null; st.waitT = 0; setPrompt('', ''); }

  /* ctx: { driving, record (the input record), source, scoring (its
     state), cornerAhead (m to the next corner, or Infinity), speed (m/s) } */
  function update(dt, ctx) {
    if (!st.active) return;
    if (ctx.source) st.source = ctx.source;
    /* corners driven: in one, then out of it */
    const inCorner = ctx.cornerAhead === 0;
    if (st.inCorner && !inCorner) st.corners++;
    st.inCorner = inCorner;
    const s = ctx.scoring;
    /* the explanations, when the thing first happens */
    if (st.infoKind) { st.infoT -= dt; if (st.infoT <= 0) { st.infoKind = null; setInfo(''); } }
    if (!st.chainShown && s.lastBank >= O.INFO_CHAIN_MIN && !st.infoKind) { st.chainShown = true; st.shown.push('chain'); st.infoKind = 'chain'; st.infoT = O.INFO_SHOWN; setInfo('<b>+' + s.lastBank + (s.lastBankMult > 1 ? ' x' + s.lastBankMult : '') + ' banked.</b> ' + TEXT.chain); }
    else if (!st.cleanShown && s.clean > 0 && !st.infoKind) { st.cleanShown = true; st.shown.push('clean'); st.infoKind = 'clean'; st.infoT = O.INFO_SHOWN; setInfo('<b>Clean sector.</b> ' + TEXT.clean); }
    if (!ctx.driving) return;
    const r = ctx.record;
    if (st.mode === 'pro') { proSteps(dt, ctx, r, s); return; }
    if (st.step) {
      st.stepT += dt;
      const readable = st.stepT >= O.PROMPT_MIN;
      if (st.step === 'steer') { if (r.steer !== 0) st.steerT += dt; if (readable && st.steerT >= O.STEER_HOLD) finish('steer', 'done'); }
      else if (st.step === 'drift') { if (s.drifting && r.handbrake && r.steer !== 0) st.hbT += dt; if (readable && st.hbT > 0) finish('drift', 'done'); }   // the player doing what it says, not a slide off a wall
      else if (st.step === 'brake') { if (r.handbrake && r.steer === 0) st.hbT += dt; else st.hbT = 0; if (readable && st.hbT >= O.BRAKE_HOLD) finish('brake', 'done'); }
      if (st.step && st.stepT >= O.PROMPT_MAX) finish(st.step, 'timeout');
    } else if (!st.done.steer) show('steer');
    else if (!st.done.drift) { st.waitT += dt; if (firstDrift(ctx) ? firstDrift(ctx) === 'now' : ctx.cornerAhead <= O.DRIFT_LEAD || st.waitT >= O.DRIFT_WAIT) show('drift'); }
    else if (!st.done.brake) { st.waitT += dt; if (FIRST_ON && ctx.cornerAhead !== Infinity ? firstBrake(ctx) : st.waitT >= O.BRAKE_AFTER) show('brake'); }
    else if (st.chainShown && st.cleanShown && !st.infoKind) stop(false);
    /* the steps are done: the explanations can still come, but SKIP has nothing left to skip */
    if (st.active && st.done.steer && st.done.drift && st.done.brake && !skip.hidden) skip.hidden = true;
  }
  /* Pro's five, each done by the player doing what it says: the throttle
     held, steering held, the handbrake with steering into a slide, a
     slide held with the throttle on, the brake held */
  function proSteps(dt, ctx, r, s) {
    if (st.step) {
      st.stepT += dt;
      const readable = st.stepT >= O.PROMPT_MIN;
      if (st.step === 'drive') { if (r.throttle > 0) st.steerT += dt; if (readable && st.steerT >= O.STEER_HOLD) finish('drive', 'done'); }
      else if (st.step === 'steer') { if (r.steer !== 0) st.steerT += dt; if (readable && st.steerT >= O.STEER_HOLD) finish('steer', 'done'); }
      else if (st.step === 'drift') { if (s.drifting && r.handbrake && r.steer !== 0) st.hbT += dt; if (readable && st.hbT > 0) finish('drift', 'done'); }
      else if (st.step === 'hold') { if (s.drifting && r.throttle > 0 && !r.handbrake) st.hbT += dt; if (readable && st.hbT >= OP.HOLD_SLIDE) finish('hold', 'done'); }
      else if (st.step === 'brake') { if (r.brake > 0) st.hbT += dt; else st.hbT = 0; if (readable && st.hbT >= O.BRAKE_HOLD) finish('brake', 'done'); }
      if (st.step && st.stepT >= O.PROMPT_MAX) finish(st.step, 'timeout');
    } else if (!st.done.drive) show('drive');
    else if (!st.done.steer) show('steer');
    else if (!st.done.drift) { st.waitT += dt; if (ctx.cornerAhead <= O.DRIFT_LEAD || st.waitT >= O.DRIFT_WAIT) show('drift'); }
    else if (!st.done.hold) show('hold');   // at once, while the slide it follows is still going
    else if (!st.done.brake) { st.waitT += dt; if (st.waitT >= O.BRAKE_AFTER) show('brake'); }
    else if (st.chainShown && st.cleanShown && !st.infoKind) stop(false);
    if (st.active && taught() && !skip.hidden) skip.hidden = true;
  }
  const taught = () => st.mode === 'pro' ? PRO_STEPS.every(k => st.done[k]) : st.done.steer && st.done.drift && st.done.brake;
  /* THE FIRST MINUTE'S PROMPTS (briefs/FIRST-MINUTE.md, ?first=2, Easy
     only): the slide prompt waits until FIRST.ONBOARD.DRIFT_AFTER
     corners are behind the car (on track 1 the first is taken at full
     pace), then comes DRIFT_LEAD before the next as always; the brake
     prompt comes BRAKE_LEAD before a corner at BRAKE_SPEED or more,
     where braking helps, or after BRAKE_WAIT. Without the switch, null
     and the prompts are as they were. */
  function firstDrift(ctx) {
    if (!FIRST_ON || ctx.cornerAhead === Infinity) return null;   // the stunt park has no corners: its prompts are as they were
    if (st.corners < FIRST.ONBOARD.DRIFT_AFTER) return st.waitT >= O.DRIFT_WAIT + 30 ? 'now' : 'wait';
    return ctx.cornerAhead <= O.DRIFT_LEAD || st.waitT >= O.DRIFT_WAIT + 30 ? 'now' : 'wait';
  }
  function firstBrake(ctx) {
    const F = FIRST.ONBOARD;
    return (ctx.cornerAhead > 0 && ctx.cornerAhead <= F.BRAKE_LEAD && (ctx.speed || 0) >= F.BRAKE_SPEED) || st.waitT >= F.BRAKE_WAIT;
  }

  /* for the probes: is a prompt or an explanation on screen */
  function visible() { return !el.hidden && (!prompt.hidden || !info.hidden); }
  return { el, state: st, start, stop, update, visible, get active() { return st.active; }, get taught() { return taught(); } };
}

/* How far along the track to the next corner's start, the short way on
   a circuit; Infinity on a track with no corners. */
export function cornerAhead(track, along) {
  const corners = track.corners || [];
  if (!corners.length) return Infinity;
  const L = track.length, circuit = track.kind === 'circuit';
  let best = Infinity;
  for (const c of corners) {
    if (along >= c.from && along <= c.to) return 0;
    let d = c.from - along;
    if (circuit) d = ((d % L) + L) % L;
    if (d >= 0 && d < best) best = d;
  }
  return best;
}
