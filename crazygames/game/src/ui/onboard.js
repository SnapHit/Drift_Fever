/* FIRST-RUN ONBOARDING. On the first visit the game lands in a run of
   career track 1 with no title and no click, and this shows short
   prompts at the moments they apply: steer, DRIFT / BRAKE with steering
   to slide, DRIFT / BRAKE alone to brake, then what a banked chain and a
   clean sector are the first time each happens. Every prompt is shown
   once and goes when it is done (or after LOOP.ONBOARD.PROMPT_MAX
   seconds if ignored, so the next can come). On a keyboard the keys are
   drawn as key caps; on touch an arrow points at the button. One SKIP
   ends it. The car is never paused. Plain DOM, nothing per frame unless
   something changes. */
import { LOOP } from '../tune.js';

const KEYS = {
  steer: '<span class="keys"><kbd>&#9664;</kbd><kbd>&#9654;</kbd><i>or</i><kbd>A</kbd><kbd>D</kbd></span>',
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

export function createOnboarding(root, onSkip) {
  const el = document.createElement('div');
  el.id = 'onboard';
  el.hidden = true;
  el.innerHTML = `<div class="prompt" hidden></div><div class="info" hidden></div><button type="button" id="skip">SKIP</button>`;
  root.appendChild(el);
  const prompt = el.querySelector('.prompt'), info = el.querySelector('.info'), skip = el.querySelector('#skip');
  skip.addEventListener('click', e => { e.stopPropagation(); stop(true); if (onSkip) onSkip(); });

  const O = LOOP.ONBOARD;
  const st = {
    active: false, step: null, stepT: 0, steerT: 0, hbT: 0, waitT: 0,
    done: { steer: false, drift: false, brake: false }, shown: [], infoT: 0, infoKind: null,
    chainShown: false, cleanShown: false, skipped: false, source: 'keys',
  };
  let lastPrompt = '', lastInfo = '', lastPos = '';

  function start(source) {
    st.active = true; st.step = null; st.stepT = 0; st.steerT = 0; st.hbT = 0; st.waitT = 0;
    st.done.steer = st.done.drift = st.done.brake = false; st.shown.length = 0; st.infoT = 0; st.infoKind = null;
    st.chainShown = st.cleanShown = false; st.skipped = false; st.source = source || 'keys';
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
    const text = TEXT[step][touch ? 'touch' : 'keys'];
    const keys = touch ? '' : pad ? PAD[step] : KEYS[step];
    const arrow = touch ? '<span class="arrow">&#9660;</span>' : '';
    setPrompt('<b>' + text + '</b>' + keys + arrow, touch ? (step === 'steer' ? 'at-left' : 'at-right') : 'centre');
  }
  function finish(step) { st.done[step] = true; st.step = null; st.waitT = 0; setPrompt('', ''); }

  /* ctx: { driving, record (the input record), source, scoring (its
     state), cornerAhead (m to the next corner, or Infinity) } */
  function update(dt, ctx) {
    if (!st.active) return;
    if (ctx.source) st.source = ctx.source;
    const s = ctx.scoring;
    /* the explanations, when the thing first happens */
    if (st.infoKind) { st.infoT -= dt; if (st.infoT <= 0) { st.infoKind = null; setInfo(''); } }
    if (!st.chainShown && s.lastBank > 0 && !st.infoKind) { st.chainShown = true; st.shown.push('chain'); st.infoKind = 'chain'; st.infoT = O.INFO_SHOWN; setInfo('<b>+' + s.lastBank + (s.lastBankMult > 1 ? ' x' + s.lastBankMult : '') + ' banked.</b> ' + TEXT.chain); }
    else if (!st.cleanShown && s.clean > 0 && !st.infoKind) { st.cleanShown = true; st.shown.push('clean'); st.infoKind = 'clean'; st.infoT = O.INFO_SHOWN; setInfo('<b>Clean sector.</b> ' + TEXT.clean); }
    if (!ctx.driving) return;
    const r = ctx.record;
    if (st.step) {
      st.stepT += dt;
      const readable = st.stepT >= O.PROMPT_MIN;
      if (st.step === 'steer') { if (r.steer !== 0) st.steerT += dt; if (readable && st.steerT >= O.STEER_HOLD) finish('steer'); }
      else if (st.step === 'drift') { if (s.drifting) st.hbT += dt; if (readable && st.hbT > 0) finish('drift'); }
      else if (st.step === 'brake') { if (r.handbrake && r.steer === 0) st.hbT += dt; else st.hbT = 0; if (readable && st.hbT >= O.BRAKE_HOLD) finish('brake'); }
      if (st.step && st.stepT >= O.PROMPT_MAX) finish(st.step);
    } else if (!st.done.steer) show('steer');
    else if (!st.done.drift) { st.waitT += dt; if (ctx.cornerAhead <= O.DRIFT_LEAD || st.waitT >= O.DRIFT_WAIT) show('drift'); }
    else if (!st.done.brake) { st.waitT += dt; if (st.waitT >= O.BRAKE_AFTER) show('brake'); }
    else if (st.chainShown && st.cleanShown && !st.infoKind) stop(false);
    /* the steps are done: the explanations can still come, but SKIP has nothing left to skip */
    if (st.active && st.done.steer && st.done.drift && st.done.brake && !skip.hidden) skip.hidden = true;
  }

  /* for the probes: is a prompt or an explanation on screen */
  function visible() { return !el.hidden && (!prompt.hidden || !info.hidden); }
  return { el, state: st, start, stop, update, visible, get active() { return st.active; } };
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
