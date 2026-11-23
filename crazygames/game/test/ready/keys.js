/* CRAZYGAMES READINESS, the keyboard layout (14 November 2026). The
   letters steer by where the key sits, so an AZERTY keyboard's ZQSD
   block works with no rebinding: the key at A's position (it prints q)
   steers left, the one at W's (prints z) is the game's, and the key that
   prints a (it sits at Q) does nothing. Since 23 November, when
   keyboards start on Easy, W and Up only drive (the car does by itself)
   and do not drift: a desktop player holding W to go was holding the
   brake. A key the game takes is read by the page's default being
   stopped. Known answer: the same presses bound by the printed letter,
   as the game was until 14 November (sending no code), steer the wrong
   way.
   node game/test/ready/keys.js */
import * as R from '../ladder/lib.js';
const env = await R.start(), pg = await R.emptyPage(env, { width: 1280, height: 720 }, '');
let fails = 0;
const press = async (key, code) => pg.page.evaluate(async ([key, code]) => {
  const I = window.__feel.input || window.__loop.input;
  const ev = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true });
  window.dispatchEvent(ev);
  const r = I.read(performance.now()); const out = { steer: r.steer, hb: r.handbrake, bound: ev.defaultPrevented };
  window.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true }));
  I.read(performance.now() + 1);
  return out;
}, [key, code]);
const cases = [
  ['AZERTY left: prints q, sits at A', 'q', 'KeyA', { steer: -1, hb: 0, bound: true }],
  ['AZERTY drive: prints z, sits at W, taken and no drift', 'z', 'KeyW', { steer: 0, hb: 0, bound: true }],
  ['AZERTY: prints a, sits at Q, unbound', 'a', 'KeyQ', { steer: 0, hb: 0, bound: false }],
  ['AZERTY: prints w, sits at Z, unbound', 'w', 'KeyZ', { steer: 0, hb: 0, bound: false }],
  ['QWERTY left', 'a', 'KeyA', { steer: -1, hb: 0, bound: true }],
  ['QWERTY right, caps lock', 'D', 'KeyD', { steer: 1, hb: 0, bound: true }],
  ['QWERTY drift on S', 's', 'KeyS', { steer: 0, hb: 1, bound: true }],
  ['QWERTY W only drives: no drift, no brake', 'w', 'KeyW', { steer: 0, hb: 0, bound: true }],
  ['up arrow only drives', 'ArrowUp', 'ArrowUp', { steer: 0, hb: 0, bound: true }],
  ['down arrow drifts', 'ArrowDown', 'ArrowDown', { steer: 0, hb: 1, bound: true }],
  ['arrow left', 'ArrowLeft', 'ArrowLeft', { steer: -1, hb: 0, bound: true }],
  ['space', ' ', 'Space', { steer: 0, hb: 1, bound: true }],
  ['no code falls back to the letter', 'd', '', { steer: 1, hb: 0, bound: true }],
];
for (const [name, key, code, want] of cases) {
  const got = await press(key, code), pass = got.steer === want.steer && got.hb === want.hb && got.bound === want.bound;
  if (!pass) fails++;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + ': ' + JSON.stringify(got));
}
/* known answer: by printed letter (no code), the AZERTY a key steers left, which is the fault */
const old = await press('a', ''), caught = old.steer === -1;
if (!caught) fails++;
console.log((caught ? 'PASS' : 'FAIL') + ' known answer: bound by the printed letter, the key that prints a steers left: ' + (caught ? 'CAUGHT' : 'MISSED'));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
