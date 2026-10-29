/* TOUCH. Three big buttons: steer left and right under the left thumb,
   DRIFT under the right (there is no brake: DRIFT with no steering stops
   the car). A thumb that slides from one
   button to its neighbour without lifting changes buttons, because every
   pointer is hit tested against the button rectangles on every move,
   not bound to the element it landed on. A restart button sits at the
   top right. The buttons appear on the first touch, or at once on a
   device whose pointer is coarse. */
export function createTouch(root, onActive, onRestart) {
  const el = document.createElement('div');
  el.id = 'touch';
  el.innerHTML = `
    <div class="pad left">
      <button type="button" data-b="left" aria-label="steer left"><span>&#9664;</span></button>
      <button type="button" data-b="right" aria-label="steer right"><span>&#9654;</span></button>
    </div>
    <div class="pad right">
      <button type="button" data-b="hb" aria-label="handbrake"><span>DRIFT</span></button>
    </div>`;
  root.appendChild(el);
  const buttons = {};
  for (const b of el.querySelectorAll('button')) buttons[b.dataset.b] = b;
  const pointers = new Map();        // pointerId -> button name or null
  const held = { left: 0, right: 0, brake: 0, hb: 0 };
  let shown = false;
  function show() { if (!shown) { shown = true; el.classList.add('on'); } }
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) show();
  // a touch anywhere, on a device the media query did not call coarse, brings the buttons up
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') show(); }, { passive: true });

  function hitTest(x, y) {
    for (const name in buttons) {
      const r = buttons[name].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return name;
    }
    return null;
  }
  function recount() {
    for (const k in held) held[k] = 0;
    for (const name of pointers.values()) if (name) held[name] = 1;
    for (const name in buttons) buttons[name].classList.toggle('down', !!held[name]);
  }
  const area = el;
  area.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const name = hitTest(e.clientX, e.clientY);
    if (name === null && e.pointerType === 'mouse') return;     // a mouse on empty ground is not a touch
    pointers.set(e.pointerId, name);
    try { area.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
    recount(); onActive();
    e.preventDefault();
  });
  area.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const name = hitTest(e.clientX, e.clientY);
    if (name !== pointers.get(e.pointerId)) { pointers.set(e.pointerId, name); recount(); }
    e.preventDefault();
  });
  const up = e => { if (pointers.delete(e.pointerId)) { recount(); onActive(); } };
  area.addEventListener('pointerup', up);
  area.addEventListener('pointercancel', up);
  area.addEventListener('lostpointercapture', up);
  area.addEventListener('contextmenu', e => e.preventDefault());

  const restart = document.createElement('button');
  restart.id = 'restart';
  restart.type = 'button';
  restart.textContent = '↻';
  restart.setAttribute('aria-label', 'restart');
  restart.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); onRestart(); });
  root.appendChild(restart);

  const out = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
  return {
    el, show,
    read() {
      out.steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      out.throttle = 0;
      out.brake = held.brake ? 1 : 0;
      out.handbrake = held.hb ? 1 : 0;
      return out;
    },
    /* for the probes: press and release by name */
    press(name, down) { pointers.set('probe-' + name, down ? name : null); if (!down) pointers.delete('probe-' + name); recount(); onActive(); },
  };
}
