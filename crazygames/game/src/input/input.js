/* THE INPUT. Keyboard, touch and gamepad all write one record:
   steer -1..+1 (+ is right), throttle 0..1, brake 0..1, handbrake 0 or
   1, and restart, which is an edge: true on the frame it was pressed.
   The physics reads the record and nothing else. Whichever source moved
   last is the active one; on touch the throttle is automatic, on when
   the brake is off, as DESIGN.md asks.

   Keyboard: arrows or WASD in both cases, space handbrake, R restart.
   Gamepad: left stick or d-pad steer, right trigger throttle, left
   trigger brake, A (or X) handbrake, Y or start restart.
   Touch: the big buttons touch.js draws; a thumb can slide between the
   two steer buttons without lifting. */
import { TUNE } from '../tune.js';
import { createTouch } from './touch.js';

export function createInput(root) {
  const keys = new Set();
  const record = { steer: 0, throttle: 0, brake: 0, handbrake: 0, restart: false, source: 'keys' };
  let restartEdge = false;
  let lastKey = 0, lastPad = 0, lastTouch = 0, now = 0;
  const touch = createTouch(root, () => { lastTouch = now; }, () => { restartEdge = true; lastTouch = now; });

  const keyMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', A: 'left', d: 'right', D: 'right', w: 'up', W: 'up', s: 'down', S: 'down', ' ': 'hb', Shift: 'hb' };
  window.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') { if (!e.repeat) restartEdge = true; lastKey = now; e.preventDefault(); return; }
    const k = keyMap[e.key];
    if (!k) return;
    keys.add(k); lastKey = now; e.preventDefault();
  });
  window.addEventListener('keyup', e => { const k = keyMap[e.key]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());

  let padSeen = false;
  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const dz = TUNE.CONTROLS.GAMEPAD_DEADZONE;
      let steer = p.axes[0] || 0;
      if (Math.abs(steer) < dz) steer = 0; else steer = (steer - Math.sign(steer) * dz) / (1 - dz);
      const b = i => (p.buttons[i] && (p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0))) || 0;
      if (b(14)) steer = -1; if (b(15)) steer = 1;
      const throttle = Math.max(b(7), b(1) ? 1 : 0);
      const brake = b(6);
      const handbrake = (b(0) || b(2)) ? 1 : 0;
      const restart = b(3) || b(9);
      const active = steer !== 0 || throttle > 0 || brake > 0 || handbrake || restart;
      if (active) { lastPad = now; }
      if (restart && !padSeen) restartEdge = true;
      padSeen = !!restart;
      if (active || record.source === 'pad') return { steer, throttle, brake, handbrake };
    }
    return null;
  }

  /* Called once per frame with the time; returns the record. */
  function read(t) {
    now = t;
    const pad = readPad();
    const tv = touch.read();
    if (lastTouch >= lastKey && lastTouch >= lastPad && lastTouch > 0) record.source = 'touch';
    else if (lastPad >= lastKey && lastPad > 0) record.source = 'pad';
    else record.source = 'keys';
    if (record.source === 'touch') {
      record.steer = tv.steer; record.brake = tv.brake; record.handbrake = tv.handbrake;
      record.throttle = TUNE.CONTROLS.TOUCH_AUTO_THROTTLE ? (tv.brake > 0 ? 0 : 1) : tv.throttle;
    } else if (record.source === 'pad' && pad) {
      record.steer = pad.steer; record.throttle = pad.throttle; record.brake = pad.brake; record.handbrake = pad.handbrake;
    } else {
      record.steer = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
      record.throttle = keys.has('up') ? 1 : 0;
      record.brake = keys.has('down') ? 1 : 0;
      record.handbrake = keys.has('hb') ? 1 : 0;
    }
    record.restart = restartEdge;
    restartEdge = false;
    return record;
  }

  return { read, touch, record };
}
