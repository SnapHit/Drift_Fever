/* THE INPUT. Keyboard, touch and gamepad all write one record:
   steer -1..+1 (+ is right), throttle 0..1, brake 0..1, handbrake 0 or
   1, and restart, which is an edge: true on the frame it was pressed.
   The physics reads the record and nothing else. Whichever source moved
   last is the active one; on touch the throttle is automatic, on when
   the brake is off, as DESIGN.md asks.

   Since 29 October 2026 there is no brake and no throttle: the car
   drives itself once anything is pressed, and DRIFT both drifts (with
   steering) and stops the car (without). The physics still takes brake
   and throttle, for the scripted driver.
   Keyboard: left and right (arrows or A, D) steer; space, shift, up,
   down, W or S drift; R restart. Gamepad: left stick or d-pad steer, A,
   B, X or either trigger drift, Y or start restart.
   Touch: the big buttons touch.js draws; a thumb can slide between the
   two steer buttons without lifting.

   For the game loop: setStarted(false) holds the car on the line through
   a countdown (the throttle stays off until the player presses anything,
   or the loop calls setStarted(true) at GO), and record.action is an
   edge, true on the frame DRIFT, Enter, R or a gamepad face button was
   pressed, which is the one input that goes again from the results. */
import { TUNE } from '../tune.js';
import { createTouch } from './touch.js';

export function createInput(root) {
  const keys = new Set();
  const record = { steer: 0, throttle: 0, brake: 0, handbrake: 0, restart: false, action: false, source: 'keys' };
  let restartEdge = false, actionEdge = false, hbWas = 0;
  let lastKey = 0, lastPad = 0, lastTouch = 0, now = 0;
  const touch = createTouch(root, () => { lastTouch = now; }, () => { restartEdge = true; lastTouch = now; });

  const keyMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'hb', ArrowDown: 'hb', a: 'left', A: 'left', d: 'right', D: 'right', w: 'hb', W: 'hb', s: 'hb', S: 'hb', ' ': 'hb', Shift: 'hb' };
  /* The car drives itself once the player has pressed anything (DESIGN:
     no brake; DRIFT slows it). Until then it waits on the line. */
  let started = false;
  window.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') { if (!e.repeat) { restartEdge = true; actionEdge = true; } lastKey = now; e.preventDefault(); return; }
    if (e.key === 'Enter') { if (!e.repeat) actionEdge = true; lastKey = now; return; }
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
      const throttle = 1, brake = 0;
      const handbrake = (b(0) || b(1) || b(2) || b(6) > 0.3 || b(7) > 0.3) ? 1 : 0;
      const restart = b(3) || b(9);
      const active = steer !== 0 || handbrake || restart;
      if (active) { lastPad = now; }
      if (restart && !padSeen) { restartEdge = true; actionEdge = true; }
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
      record.steer = tv.steer; record.handbrake = tv.handbrake;
    } else if (record.source === 'pad' && pad) {
      record.steer = pad.steer; record.handbrake = pad.handbrake;
    } else {
      record.steer = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
      record.handbrake = keys.has('hb') ? 1 : 0;
    }
    if (record.steer !== 0 || record.handbrake) started = true;
    record.brake = 0;
    record.throttle = started && TUNE.CONTROLS.AUTO_THROTTLE ? 1 : 0;
    record.restart = restartEdge;
    if (record.handbrake && !hbWas) actionEdge = true;
    hbWas = record.handbrake;
    record.action = actionEdge;
    restartEdge = false; actionEdge = false;
    return record;
  }

  return { read, touch, record, setStarted(v) { started = !!v; }, get started() { return started; } };
}
