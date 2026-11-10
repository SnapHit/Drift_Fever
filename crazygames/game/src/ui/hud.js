/* THE HUD. The running total at the top, the live chain by the car
   (projected from its position every frame), the multiplier, callouts
   that rise and fade, a small speed and angle readout, the run's lap or
   distance and time with the best to beat, the 3 2 1 GO countdown, and
   an exit button back to the title. Plain DOM, updated only when a value
   changes, so it costs nothing at 60fps.

   With the spectacle round on (briefs/SPECTACLE.md 4) the score reacts:
   the number by the car pops with weight at every step of the
   multiplier and grows and changes colour with it (HUD_SHOW); a banked
   chain flies from the car to the total, which pops as it lands; a
   lost chain breaks in two and falls. Plain DOM and CSS animations, a
   few elements a second at most. */
import { FX_ON } from '../fx.js';

export const HUD_SHOW = {
  GROW:        0.12,     // the live number grows this share per multiplier step
  GROW_MAX:    6,        // up to this multiplier
  HEAT_CLASSES: 5,       // h1 to h5: the colour by multiplier (index.html)
  FLY_TIME:    560,      // ms for a banked chain to reach the total
  BREAK_TIME:  700,      // ms a lost chain takes to fall apart
};

/* THE BATTLE'S HUD (briefs/RIVALS.md 2): the rival's total beside the
   player's, a closeness meter that rides under the player's car so it
   reads without looking away from the cars, the tandem bonus while it
   counts, a tag with the rival's name over his car, and an arrow at the
   edge of the screen with the distance when he is out of view. */
export const HUD_BATTLE = {
  METER_BELOW:   46,       // px under the player's car the meter rides
  METER_SEGS:    5,        // segments of the meter
  TAG_UP:        2.3,      // m over the rival's car his tag sits
  EDGE:          34,       // px from the screen's edge the arrow sits
  LIVE_SIDE:     118,      // px the live score moves beside the player's car, away from the rival, so it never sits on him
  LIVE_DOWN:     34,       // px down from over the roof
  SMOOTH:        0.12,     // s, the meter's easing
};

export function createHud(root) {
  const el = document.createElement('div');
  el.id = 'hud';
  el.innerHTML = `
    <div id="total"><span id="totalN">0</span><span id="totalL">points</span><span id="toBeat"></span></div>
    <div id="live"><span id="liveN"></span><span id="liveM"></span></div>
    <div id="callouts"></div>
    <div id="readout"><span id="speed">0</span><span class="u">km/h</span><span id="angle">0</span><span class="u">deg</span></div>
    <div id="runinfo"><span id="lap"></span><span id="clock"></span></div>
    <div id="count"></div>
    <div id="missions" hidden></div>
    <canvas id="streaks"></canvas>
    <div id="boost">BOOST</div>
    <div id="vs" hidden><span class="vsl">VS</span><b id="vsName"></b><span id="vsN">0</span><span id="vsLead"></span></div>
    <div id="meter" hidden><i></i><i></i><i></i><i></i><i></i><b id="meterT"></b></div>
    <div id="tag" hidden><b id="tagName"></b><span id="tagMult"></span></div>
    <div id="arrow" hidden><span class="ar">&#9650;</span><b id="arrowD"></b></div>
    <div id="prompt1" hidden></div>
    <button type="button" id="exit" aria-label="back to the title">&#10005;</button>
    <button type="button" id="fs" aria-label="full screen" hidden></button>
    <button type="button" id="snd" aria-label="sound" hidden></button>`;
  root.appendChild(el);
  const total = el.querySelector('#totalN'), live = el.querySelector('#live'), liveN = el.querySelector('#liveN'), liveM = el.querySelector('#liveM');
  const callouts = el.querySelector('#callouts'), speed = el.querySelector('#speed'), angle = el.querySelector('#angle');
  const lapEl = el.querySelector('#lap'), clockEl = el.querySelector('#clock'), countEl = el.querySelector('#count'), toBeat = el.querySelector('#toBeat'), exit = el.querySelector('#exit'), fs = el.querySelector('#fs'), snd = el.querySelector('#snd'), missionsEl = el.querySelector('#missions');
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let lastTotal = -1, lastLive = -1, lastMult = -1, lastSpeed = -1, lastAngle = -1, lastNear = null, lastVisible = null, lastLap = '', lastClock = '', lastCount = '', lastBeat = '';
  let shown = 0;
  const v = { x: 0, y: 0, z: 0 };
  let lastText = '', lastHeat = 0;
  const totalBox = el.querySelector('#total');
  const vs = el.querySelector('#vs'), vsName = el.querySelector('#vsName'), vsN = el.querySelector('#vsN'), vsLead = el.querySelector('#vsLead');
  const meter = el.querySelector('#meter'), segs = [...meter.querySelectorAll('i')], meterT = el.querySelector('#meterT');
  const tag = el.querySelector('#tag'), tagName = el.querySelector('#tagName'), tagMult = el.querySelector('#tagMult');
  const arrow = el.querySelector('#arrow'), arrowD = el.querySelector('#arrowD'), prompt1 = el.querySelector('#prompt1');
  const bat = { rivalX: null, on: false, k: 0, lastN: -1, lastLead: '', lastSeg: -1, lastMode: '', lastT: '', lastTag: null, lastArrow: null, lastMult: '', promptT: 0 };
  const carPx = { x: 0, y: 0 };
  let tmpV = null;
  /* a banked chain flies from where the number was to the total */
  function fly(text) {
    const d = document.createElement('div');
    d.className = 'fly ' + (lastHeat ? 'h' + lastHeat : '');
    d.textContent = text;
    el.appendChild(d);
    const r = total.getBoundingClientRect(), x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
    const anim = d.animate([
      { transform: 'translate(' + v.x + 'px,' + (v.y - 30) + 'px) translate(-50%,-50%) scale(1.25)', opacity: 1 },
      { transform: 'translate(' + ((v.x + x1) / 2) + 'px,' + (Math.min(v.y, y1) - 40) + 'px) translate(-50%,-50%) scale(1.1)', opacity: 1, offset: 0.45 },
      { transform: 'translate(' + x1 + 'px,' + y1 + 'px) translate(-50%,-50%) scale(0.55)', opacity: 0.2 },
    ], { duration: HUD_SHOW.FLY_TIME, easing: 'cubic-bezier(0.5, 0, 0.75, 1)' });
    const done = () => { d.remove(); total.classList.remove('pop'); void total.offsetWidth; total.classList.add('pop'); };
    anim.onfinish = done;
    setTimeout(() => { if (d.isConnected) done(); }, HUD_SHOW.FLY_TIME + 200);   // where animations do not run
  }
  /* a lost chain breaks in two and falls */
  function shatter(text) {
    for (const side of [-1, 1]) {
      const d = document.createElement('div');
      d.className = 'shard ' + (side < 0 ? 'l' : 'r');
      d.textContent = text;
      el.appendChild(d);
      const base = 'translate(' + v.x + 'px,' + (v.y - 30) + 'px) translate(-50%,-50%)';
      d.animate([
        { transform: base, opacity: 1 },
        { transform: base + ' translate(' + side * 46 + 'px, 70px) rotate(' + side * 28 + 'deg)', opacity: 0 },
      ], { duration: HUD_SHOW.BREAK_TIME, easing: 'cubic-bezier(0.3, 0, 0.9, 0.6)' }).onfinish = () => d.remove();
      setTimeout(() => d.remove(), HUD_SHOW.BREAK_TIME + 200);
    }
  }
  /* SPEED STREAKS: thin lines rushing out from the centre of the screen,
     fading in above STREAK_FROM m/s and strongest while boosting. Drawn
     only; a fixed pool, so nothing allocates per frame. */
  const STREAK_FROM = 28, STREAK_FULL = 52, STREAKS = 40;
  const sc = el.querySelector('#streaks'), sx = sc.getContext('2d'), boostEl = el.querySelector('#boost');
  const pool = [];
  let seed = 12345;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < STREAKS; i++) pool.push({ a: rnd() * Math.PI * 2, r: rnd(), sp: 0.6 + rnd() * 0.8 });
  let lastBoost = false, streakOn = false;
  function streaks(pose, view, dt) {
    const k = Math.min(1, Math.max(0, (pose.speed - STREAK_FROM) / (STREAK_FULL - STREAK_FROM))) * 0.55 + (pose.boost > 0 ? 0.45 : 0);
    if (k <= 0.01) { if (streakOn) { sx.clearRect(0, 0, sc.width, sc.height); streakOn = false; } return; }
    streakOn = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(view.w * dpr), H = Math.round(view.h * dpr);
    if (sc.width !== W || sc.height !== H) { sc.width = W; sc.height = H; }
    sx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.42, R = Math.hypot(W, H) * 0.6;
    sx.lineCap = 'round';
    for (const p of pool) {
      p.r += p.sp * dt * (1.2 + k * 2.4);
      if (p.r > 1) { p.r -= 1; p.a = rnd() * Math.PI * 2; }
      const r0 = (0.35 + p.r * 0.65) * R, len = (0.04 + 0.12 * k) * R * p.r;
      const ca = Math.cos(p.a), sa = Math.sin(p.a);
      sx.strokeStyle = 'rgba(220,245,255,' + (0.35 * k * p.r).toFixed(3) + ')';
      sx.lineWidth = (1 + 1.5 * k) * dpr;
      sx.beginPath(); sx.moveTo(cx + ca * r0, cy + sa * r0); sx.lineTo(cx + ca * (r0 + len), cy + sa * (r0 + len)); sx.stroke();
    }
  }
  return {
    el, exit, fs, snd,
    setVisible(on) { el.classList.toggle('hidden', !on); },
    /* text for the lap or distance slot and the clock; '' hides */
    setRun(lap, clock) {
      if (lap !== lastLap) { lastLap = lap; lapEl.textContent = lap; }
      if (clock !== lastClock) { lastClock = clock; clockEl.textContent = clock; }
    },
    setToBeat(text) { if (text !== lastBeat) { lastBeat = text; toBeat.textContent = text; } },
    /* over the countdown: which run this is (head: { label, name }) and
       the track's missions ([{ text, done }]); neither hides the box */
    setMissions(list, head) {
      if (!list && !head) { if (!missionsEl.hidden) { missionsEl.hidden = true; missionsEl.innerHTML = ''; } return; }
      missionsEl.innerHTML = (head ? '<i>' + esc(head.label) + '</i><strong>' + esc(head.name) + '</strong>' : '')
        + (list && list.length ? '<b>MISSIONS</b>' + list.map(m => '<span class="' + (m.done ? 'done' : '') + '">' + (m.done ? '&#10003;' : '&#9671;') + ' ' + esc(m.text) + '</span>').join('') : '');
      missionsEl.classList.toggle('headed', !!head);
      missionsEl.hidden = false;
    },
    /* a one line notice that rises and fades like the score's callouts */
    notice(text, kind) {
      const d = document.createElement('div');
      d.className = 'callout ' + (kind || 'good');
      d.textContent = text;
      callouts.appendChild(d);
      setTimeout(() => d.remove(), 1500);
    },
    /* '' for none, else the big number or GO */
    setCount(text, go) {
      if (text !== lastCount) { lastCount = text; countEl.textContent = text; countEl.classList.toggle('on', !!text); countEl.classList.toggle('go', !!go); if (text) { countEl.classList.remove('pop'); void countEl.offsetWidth; countEl.classList.add('pop'); } }
    },
    update(score, pose, camera, THREE, view, dt) {
      const s = score.state;
      if (!tmpV) tmpV = new THREE.Vector3();
      streaks(pose, view, dt || 1 / 60);
      const boosting = pose.boost > 0;
      if (boosting !== lastBoost) { lastBoost = boosting; boostEl.classList.toggle('on', boosting); }
      if (s.total !== lastTotal) { lastTotal = s.total; total.textContent = String(s.total); }
      const kmh = Math.round(pose.speed * 3.6), deg = Math.round(s.angle);
      if (kmh !== lastSpeed) { lastSpeed = kmh; speed.textContent = String(kmh); }
      if (deg !== lastAngle) { lastAngle = deg; angle.textContent = String(deg); }
      if (bat.on) { const q = tmpV.set(pose.x, (pose.y || 0) + 0.2, pose.z).project(camera); carPx.x = (q.x * 0.5 + 0.5) * view.w; carPx.y = (-q.y * 0.5 + 0.5) * view.h; }
      const visible = s.chain >= 1;
      if (visible !== lastVisible) { lastVisible = visible; live.classList.toggle('on', visible); }
      if (visible) {
        const n = Math.round(s.chain);
        if (n !== lastLive) { lastLive = n; liveN.textContent = String(n); lastText = String(n) + (s.mult > 1 ? ' x' + s.mult : ''); }
        if (s.mult !== lastMult) {
          const up = s.mult > lastMult && lastMult > 0;
          lastMult = s.mult; liveM.textContent = s.mult > 1 ? 'x' + s.mult : ''; live.classList.add('bump'); setTimeout(() => live.classList.remove('bump'), 180);
          if (FX_ON) {
            const h = Math.min(HUD_SHOW.HEAT_CLASSES, s.mult);
            for (let k = 1; k <= HUD_SHOW.HEAT_CLASSES; k++) live.classList.toggle('h' + k, k === h);
            lastHeat = h;
            live.style.setProperty('--k', String(1 + HUD_SHOW.GROW * (Math.min(HUD_SHOW.GROW_MAX, s.mult) - 1)));
            if (up) { live.classList.remove('pop'); void live.offsetWidth; live.classList.add('pop'); }
          }
        }
        if (s.near !== lastNear) { lastNear = s.near; live.classList.toggle('near', s.near); }
        // project the car's roof to the screen
        const p = new THREE.Vector3(pose.x, 1.9, pose.z).project(camera);
        v.x = (p.x * 0.5 + 0.5) * view.w; v.y = (-p.y * 0.5 + 0.5) * view.h;
        /* in a battle, beside the car on the side away from the rival, as far as the screen allows */
        if (bat.on && bat.rivalX !== null) { const side = bat.rivalX > v.x ? -1 : 1; v.x = Math.max(70, Math.min(view.w - 70, v.x + side * HUD_BATTLE.LIVE_SIDE)); v.y += HUD_BATTLE.LIVE_DOWN; }
        live.style.transform = 'translate(' + Math.round(v.x) + 'px,' + Math.round(v.y) + 'px)';
      }
      if (s.calloutCount < shown) shown = 0;
      const fresh = Math.min(s.callouts.length, s.calloutCount - shown);
      for (let i = s.callouts.length - fresh; i < s.callouts.length; i++) {
        const c = s.callouts[i];
        const d = document.createElement('div');
        d.className = 'callout ' + c.kind;
        d.textContent = c.text;
        callouts.appendChild(d);
        setTimeout(() => d.remove(), 1500);
        if (FX_ON && c.kind === 'bank' && !/^(CLEAN|PACE)/.test(c.text)) fly(c.text.split(' ')[0]);
        else if (FX_ON && c.kind === 'lost' && lastText) shatter(lastText);
      }
      shown = s.calloutCount;
    },
    /* the battle: { name } or null */
    setBattle(b) {
      bat.on = !!b; bat.rivalX = null; vs.hidden = !b; meter.hidden = true; tag.hidden = true; arrow.hidden = true; prompt1.hidden = true; bat.lastN = -1; bat.lastLead = ''; bat.lastSeg = -1; bat.lastMode = ''; bat.lastT = ''; bat.lastTag = null; bat.lastArrow = null; bat.k = 0;
      el.classList.toggle('battle', !!b);
      if (b) { vsName.textContent = b.name.toUpperCase(); tagName.textContent = b.name.toUpperCase(); }
    },
    /* one line, once, at the moment it applies */
    prompt(text, seconds) { prompt1.textContent = text; prompt1.hidden = false; prompt1.classList.remove('in'); void prompt1.offsetWidth; prompt1.classList.add('in'); bat.promptT = seconds || 3; },
    /* every frame of a battle: t the tandem's state, rival, the player's
       score state, rv the rival's drawn pose (or null) */
    battle(t, rival, mine, rv, camera, THREE, view, dt) {
      if (!bat.on) return;
      const theirs = rival.scoring.state.total;
      if (theirs !== bat.lastN) { bat.lastN = theirs; vsN.textContent = String(theirs); }
      const lead = mine.total > theirs ? 'ahead' : mine.total < theirs ? 'behind' : 'level';
      if (lead !== bat.lastLead) { bat.lastLead = lead; vs.className = lead; vsLead.textContent = lead === 'ahead' ? 'YOU LEAD' : lead === 'behind' ? 'HE LEADS' : 'LEVEL'; }
      if (bat.promptT > 0) { bat.promptT -= dt; if (bat.promptT <= 0) prompt1.hidden = true; }
      /* the meter, under the player's car: segments by closeness, and what it means */
      const live = rival.solid() && t.together;
      bat.k += ((live && !t.ahead ? t.k : 0) - bat.k) * (1 - Math.exp(-dt / HUD_BATTLE.SMOOTH));
      const seg = live && !t.ahead ? Math.round(bat.k * HUD_BATTLE.METER_SEGS) : 0;
      const mode = !live ? 'off' : t.ahead ? 'ahead' : t.mult > 1 ? 'on' : t.k > 0 ? 'near' : 'far';
      if (mode === 'off') { if (!meter.hidden) meter.hidden = true; }
      else {
        if (meter.hidden) meter.hidden = false;
        if (seg !== bat.lastSeg) { bat.lastSeg = seg; segs.forEach((g, i) => g.classList.toggle('lit', i < seg)); }
        if (mode !== bat.lastMode) { bat.lastMode = mode; meter.className = mode; }
        const text = mode === 'on' ? 'x' + t.mult.toFixed(1) + ' TANDEM' : mode === 'ahead' ? 'AHEAD: NO BONUS' : mode === 'near' ? 'CLOSER' : 'TOO FAR';
        if (text !== bat.lastT) { bat.lastT = text; meterT.textContent = text; }
        meter.style.transform = 'translate(' + Math.round(carPx.x) + 'px,' + Math.round(carPx.y + HUD_BATTLE.METER_BELOW) + 'px) translate(-50%, 0)';
      }
      /* the tag over his car, or the arrow at the edge when he is out of view */
      if (!rv || rival.state.fade >= 0.95 || !rival.solid() && rival.state.fade > 0.5) { bat.rivalX = null; if (!tag.hidden) tag.hidden = true; if (!arrow.hidden) arrow.hidden = true; return; }
      const p = tmpV.set(rv.pose.x, (rv.pose.y || 0) + HUD_BATTLE.TAG_UP, rv.pose.z).project(camera);
      const inView = p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
      bat.rivalX = p.z < 1 ? (p.x * 0.5 + 0.5) * view.w : null;
      if (inView) {
        if (tag.hidden) tag.hidden = false; if (!arrow.hidden) arrow.hidden = true;
        tag.style.transform = 'translate(' + Math.round((p.x * 0.5 + 0.5) * view.w) + 'px,' + Math.round((-p.y * 0.5 + 0.5) * view.h) + 'px) translate(-50%, -100%)';
        const m = rival.scoring.state.chain > 0 && rival.scoring.state.mult > 1 ? 'x' + rival.scoring.state.mult : '';
        if (m !== bat.lastMult) { bat.lastMult = m; tagMult.textContent = m; }
      } else {
        if (!tag.hidden) tag.hidden = true; if (arrow.hidden) arrow.hidden = false;
        /* the direction on the screen: behind the camera the projection flips */
        let ax = p.x, ay = p.y; if (p.z > 1) { ax = -ax; ay = -ay; }
        const len = Math.hypot(ax, ay) || 1; ax /= len; ay /= len;
        const E = HUD_BATTLE.EDGE, hw = view.w / 2 - E, hh = view.h / 2 - E, sc = Math.min(hw / Math.max(1e-6, Math.abs(ax)), hh / Math.max(1e-6, Math.abs(ay)));
        const x = view.w / 2 + ax * sc, y = view.h / 2 - ay * sc, ang = Math.atan2(ax, ay) * 180 / Math.PI;
        arrow.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%, -50%)';
        arrow.firstElementChild.style.transform = 'rotate(' + Math.round(ang) + 'deg)';
        const d = Math.round(Math.hypot(rv.pose.x - camera.position.x, rv.pose.z - camera.position.z)) + ' m';
        if (d !== bat.lastArrow) { bat.lastArrow = d; arrowD.textContent = d; }
      }
    },
    reset() { shown = 0; callouts.innerHTML = ''; lastTotal = -1; lastLive = -1; lastMult = -1; lastText = ''; for (const d of el.querySelectorAll('.fly, .shard')) d.remove(); },
  };
}
