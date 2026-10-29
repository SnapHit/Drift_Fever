/* THE HUD. The running total at the top, the live chain by the car
   (projected from its position every frame), the multiplier, callouts
   that rise and fade, and a small speed and angle readout. Plain DOM,
   updated only when a value changes, so it costs nothing at 60fps. */
export function createHud(root) {
  const el = document.createElement('div');
  el.id = 'hud';
  el.innerHTML = `
    <div id="total"><span id="totalN">0</span><span id="totalL">points</span></div>
    <div id="live"><span id="liveN"></span><span id="liveM"></span></div>
    <div id="callouts"></div>
    <div id="readout"><span id="speed">0</span><span class="u">km/h</span><span id="angle">0</span><span class="u">deg</span></div>
    <div id="ground"></div>`;
  root.appendChild(el);
  const total = el.querySelector('#totalN'), live = el.querySelector('#live'), liveN = el.querySelector('#liveN'), liveM = el.querySelector('#liveM');
  const callouts = el.querySelector('#callouts'), speed = el.querySelector('#speed'), angle = el.querySelector('#angle'), groundEl = el.querySelector('#ground');
  let lastTotal = -1, lastLive = -1, lastMult = -1, lastSpeed = -1, lastAngle = -1, lastNear = null, lastVisible = null;
  let shown = 0;
  const v = { x: 0, y: 0, z: 0 };
  return {
    el,
    setGroundLinks(html) { groundEl.innerHTML = html; },
    update(score, pose, camera, THREE, view) {
      const s = score.state;
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
