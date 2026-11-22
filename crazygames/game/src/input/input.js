/* THE INPUT. Keyboard, touch and gamepad all write one record:
   steer -1..+1 (+ is right), throttle 0..1, brake 0..1, handbrake 0 or
   1, and restart, which is an edge: true on the frame it was pressed.
   The physics reads the record and nothing else. Whichever source moved
   last is the active one; on touch the throttle is automatic, on when
   the brake is off, as DESIGN.md asks.

   Two modes, set by the host for each run (setMode):

   EASY, the game since 29 October 2026, and every touch run whatever the
   mode: there is no brake and no throttle: the car drives itself once
   anything is pressed, and DRIFT both drifts (with steering) and stops
   the car (without). Keyboard: left and right (arrows or A, D) steer;
   space, shift, up, down, W or S drift (the letters by position, so Q,
   D, Z, S on AZERTY); R restart. Gamepad: left stick or d-pad steer, A,
   B, X or either trigger drift, Y or start restart.

   PRO (briefs/PRO-CONTROLS.md, 22 November 2026), keyboard and gamepad
   only: the player drives. Keyboard: W or Up is the throttle, S or Down
   the brake and, once stopped, reverse (the physics turns a held brake
   at a standstill into reverse), A D or Left Right steer, space or
   shift the handbrake, R restart, the letters by position as on Easy.
   A key is on or off, so the throttle and the brake it holds ramp in and
   out over TUNE.CONTROLS' times; the record carries what the keys hold
   and ramp(), called once per physics step by the host, eases towards
   it, so the ramp is counted in steps. Gamepad: right trigger throttle,
   left trigger brake and reverse, both analogue and not ramped, left
   stick or d-pad steer, A or X the handbrake, Y or start restart; the
   menus by pad are as they were (ui/padnav.js).

   Touch: the big buttons touch.js draws; a thumb can slide between the
   two steer buttons without lifting. Always Easy.

   For the game loop: setStarted(false) holds the car on the line through
   a countdown on Easy (the throttle stays off until the player presses
   anything, or the loop calls setStarted(true) at GO), and record.action
   is an edge, true on the frame DRIFT, Enter, R or a gamepad face button
   was pressed, which is the one input that goes again from the results. */
import { TUNE } from '../tune.js';
import { STEP } from '../physics/vehicle.js';
import { createTouch } from './touch.js';

export function createInput(root) {
  const keys = new Set();
  const record = { steer: 0, throttle: 0, brake: 0, handbrake: 0, restart: false, action: false, source: 'keys' };
  let restartEdge = false, actionEdge = false, hbWas = 0;
  let lastKey = 0, lastPad = 0, lastTouch = 0, now = 0;
  let mode = 'easy';
  const touch = createTouch(root, () => { lastTouch = now; }, () => { restartEdge = true; lastTouch = now; });

  /* Letters are read by where the key sits (e.code), not by what it
     prints, so the WASD block is ZQSD on an AZERTY keyboard with no
     rebinding (CrazyGames' quality guidelines, checked 14 November 2026).
     Arrows, space and shift are the same key everywhere. A key event with
     no code (some remote keyboards) falls back to the letter it prints. */
  const codeMap = { KeyA: 'left', KeyD: 'right', KeyW: 'hb', KeyS: 'hb' };
  const keyMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'hb', ArrowDown: 'hb', ' ': 'hb', Shift: 'hb' };
  const letterMap = { a: 'left', A: 'left', d: 'right', D: 'right', w: 'hb', W: 'hb', s: 'hb', S: 'hb' };
  const bound = e => keyMap[e.key] || (e.code ? codeMap[e.code] : letterMap[e.key]);
  /* Pro's keys, the same keys with their own jobs, kept by the key held
     (two keys for one job, W and Up, each count until let go) */
  const pro = {
    code: { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' },
    key: { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'hb', Shift: 'hb' },
    letter: { a: 'left', A: 'left', d: 'right', D: 'right', w: 'up', W: 'up', s: 'down', S: 'down' },
  };
  const proBound = e => pro.key[e.key] || (e.code ? pro.code[e.code] : pro.letter[e.key]);
  const proHeld = new Map();   // the key held (its code, else its letter) -> its job
  const keyId = e => e.code || ('k:' + String(e.key).toLowerCase());
  const proHas = job => { for (const j of proHeld.values()) if (j === job) return true; return false; };
  /* The car drives itself once the player has pressed anything (DESIGN:
     no brake; DRIFT slows it). Until then it waits on the line. */
  let started = false;
  const typing = e => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  window.addEventListener('keydown', e => {
    if (typing(e)) return;   // a text field (the Lab's code entry) keeps its keys
    if (e.key === 'r' || e.key === 'R') { if (!e.repeat) { restartEdge = true; actionEdge = true; } lastKey = now; e.preventDefault(); return; }
    if (e.key === 'Enter') { if (!e.repeat) actionEdge = true; lastKey = now; return; }
    const k = bound(e), p = proBound(e);
    if (p) proHeld.set(keyId(e), p);
    if (!k) return;
    keys.add(k); lastKey = now; e.preventDefault();
  });
  window.addEventListener('keyup', e => { const k = bound(e); if (k) keys.delete(k); proHeld.delete(keyId(e)); });
  window.addEventListener('blur', () => { keys.clear(); proHeld.clear(); });

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
      let throttle = 1, brake = 0, handbrake, restart = b(3) || b(9);
      if (mode === 'pro') {
        /* Pro: the triggers are the pedals, as they read (a half pressed
           trigger is half), and A or X the handbrake */
        const td = TUNE.CONTROLS.TRIGGER_DEADZONE, trig = i => { const v = b(i); return v > td ? Math.min(1, v) : 0; };
        throttle = trig(7); brake = trig(6);
        handbrake = (b(0) || b(2)) ? 1 : 0;
      } else handbrake = (b(0) || b(1) || b(2) || b(6) > 0.3 || b(7) > 0.3) ? 1 : 0;
      const active = steer !== 0 || handbrake || restart || (mode === 'pro' && (throttle > 0 || brake > 0));
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
    const proHands = mode === 'pro' && record.source !== 'touch';
    let throttle = 0, brake = 0;
    if (record.source === 'touch') {
      record.steer = tv.steer; record.handbrake = tv.handbrake;
    } else if (record.source === 'pad' && pad) {
      record.steer = pad.steer; record.handbrake = pad.handbrake;
      throttle = pad.throttle; brake = pad.brake;
    } else if (proHands) {
      record.steer = (proHas('right') ? 1 : 0) - (proHas('left') ? 1 : 0);
      record.handbrake = proHas('hb') ? 1 : 0;
      throttle = proHas('up') ? 1 : 0; brake = proHas('down') ? 1 : 0;
    } else {
      record.steer = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
      record.handbrake = keys.has('hb') ? 1 : 0;
    }
    if (record.steer !== 0 || record.handbrake) started = true;
    if (proHands) { record.throttle = throttle; record.brake = brake; }
    else {
      record.brake = 0;
      record.throttle = started && TUNE.CONTROLS.AUTO_THROTTLE ? 1 : 0;
    }
    record.restart = restartEdge;
    if (record.handbrake && !hbWas) actionEdge = true;
    hbWas = record.handbrake;
    record.action = actionEdge;
    restartEdge = false; actionEdge = false;
    return record;
  }

  /* PRO'S RAMP, once per physics step: rec is the step's input as the
     host has it (quantised); while on, the throttle and the brake ease
     towards what the keys hold by one step's share of their times, and
     the step gets the eased values, quantised as the host quantises. Off
     (Easy, a pad, touch, a scripted or injected input), the ramp follows
     rec so it carries on smoothly if the keys take over, and rec is
     returned untouched. */
  const ramped = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
  const rampState = { t: 0, b: 0 };
  const toward = (v, want, up, down) => {
    const C = TUNE.CONTROLS;
    if (want > v) { v = Math.min(want, v + 1 / Math.max(1, Math.round(C[up] / STEP))); if (v > want - 1e-9) v = want; }
    else if (want < v) { v = Math.max(want, v - 1 / Math.max(1, Math.round(C[down] / STEP))); if (v < want + 1e-9) v = want; }
    return v;
  };
  function ramp(rec, on) {
    if (!on) { rampState.t = rec.throttle; rampState.b = rec.brake; return rec; }
    rampState.t = toward(rampState.t, rec.throttle, 'THROTTLE_RAMP', 'THROTTLE_RELEASE');
    rampState.b = toward(rampState.b, rec.brake, 'BRAKE_RAMP', 'BRAKE_RELEASE');
    ramped.steer = rec.steer; ramped.handbrake = rec.handbrake;
    ramped.throttle = Math.round(rampState.t * 100) / 100; ramped.brake = Math.round(rampState.b * 100) / 100;
    return ramped;
  }

  return { read, touch, record, ramp,
    resetRamp() { rampState.t = 0; rampState.b = 0; },
    /* on Pro with the keys driving, the host ramps each step */
    get ramping() { return mode === 'pro' && record.source === 'keys'; },
    setMode(m) { mode = m === 'pro' ? 'pro' : 'easy'; }, get mode() { return mode; },
    proBindings: pro,   // for the probes: the known answer unbinds the throttle key here
    setStarted(v) { started = !!v; }, get started() { return started; }, get keyUsed() { return lastKey > 0; } };
}
