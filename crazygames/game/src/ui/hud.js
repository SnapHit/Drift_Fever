/* THE HUD. The running total at the top, the live chain by the car
   (projected from its position every frame), the multiplier, callouts
   that rise and fade, a small speed and angle readout, the run's lap or
   distance and time with the best to beat, the 3 2 1 GO countdown, and
   an exit button back to the title. Plain DOM, updated only when a value
   changes, so it costs nothing at 60fps. */
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
      streaks(pose, view, dt || 1 / 60);
      const boosting = pose.boost > 0;
      if (boosting !== lastBoost) { lastBoost = boosting; boostEl.classList.toggle('on', boosting); }
      if (s.total !== lastTotal) { lastTotal = s.total; total.textContent = String(s.total); }
      const kmh = Math.round(pose.speed * 3.6), deg = Math.round(s.angle);
      if (kmh !== lastSpeed) { lastSpeed = kmh; speed.textContent = String(kmh); }
      if (deg !== lastAngle) { lastAngle = deg; angle.textContent = String(deg); }
      const visible = s.chain >= 1;
      if (visible !== lastVisible) { lastVisible = visible; live.classList.toggle('on', visible); }
      if (visible) {
        const n = Math.round(s.chain);
        if (n !== lastLive) { lastLive = n; liveN.textContent = String(n); }
        if (s.mult !== lastMult) { lastMult = s.mult; liveM.textContent = s.mult > 1 ? 'x' + s.mult : ''; live.classList.add('bump'); setTimeout(() => live.classList.remove('bump'), 180); }
        if (s.near !== lastNear) { lastNear = s.near; live.classList.toggle('near', s.near); }
        // project the car's roof to the screen
        const p = new THREE.Vector3(pose.x, 1.9, pose.z).project(camera);
        v.x = (p.x * 0.5 + 0.5) * view.w; v.y = (-p.y * 0.5 + 0.5) * view.h;
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
      }
      shown = s.calloutCount;
    },
    reset() { shown = 0; callouts.innerHTML = ''; lastTotal = -1; lastLive = -1; lastMult = -1; },
  };
}
