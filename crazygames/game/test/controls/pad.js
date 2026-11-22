/* THE GAMEPAD (briefs/PRO-CONTROLS.md, measure 6). On Pro, with the
   browser's gamepad list replaced by one fed pad: half the right trigger
   is half the throttle, in the record and in the physics (no ramp: the
   trigger is analogue); the left trigger brakes, and held at a standstill
   reverses; the stick steers (past its dead zone) and the d-pad too; A
   and X are the handbrake and B is not; Y and start restart. On Easy the
   same pad drives as it always has (throttle on, the triggers DRIFT). The
   menus by pad: every button on Pro's title, its toggle included, is
   reached by d-pad moves (ready/pad.js measures the rest of the screens).
   Known answer: the triggers swapped (the throttle fed on the left
   trigger's button) fails the throttle check.
   node game/test/controls/pad.js   writes review/controls/pad.json */
import * as R from './lib.js';

const env = await R.start(), out = {};
const FEED = `
  window.__pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], connected: true, id: 'fed' };
  navigator.getGamepads = () => [window.__pad];
  const set = (o) => { const P = window.__pad; for (const b of P.buttons) { b.pressed = false; b.value = 0; } P.axes[0] = 0; P.axes[1] = 0;
    for (const [i, v] of Object.entries(o.b || {})) { P.buttons[+i].value = v; P.buttons[+i].pressed = v > 0.5; } if (o.x !== undefined) P.axes[0] = o.x; };
  const frames = n => { const F = window.__feel; if (window.__clock === undefined) window.__clock = 1000; for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); } };
`;
const pg = await R.profilePage(env, { width: 1280, height: 720 }, 'b'), page = pg.page;
await page.evaluate(new Function(FEED + 'window.__feel.draw = false; window.__set = set; window.__frames = frames;'));

/* the record and the physics for one fed state, in a fresh Pro run of career 1 */
const THROTTLE = (rt, lt) => `
  const L = window.__loop, F = window.__feel, set = window.__set, frames = window.__frames;
  set({}); L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(2);
  set({ b: { [${rt}]: 0.5 } }); frames(30);
  const r = F.input.record, c = F.world.car;
  const o = { source: r.source, profile: L.profile(), throttle: r.throttle, brake: r.brake, carThrottle: c.throttle, tape: F.tapeCopy().slice(-1).map(e => e.t + ' for ' + e.n + ' steps'), speed: c.speed };
  set({}); return o;`;
const halfOk = r => r.source === 'pad' && r.throttle === 0.5 && r.brake === 0 && r.carThrottle === 0.5 && /^0.5 for 60 steps$/.test(r.tape[0]) && r.speed > 2;
const half = out.halfThrottle = await page.evaluate(new Function(THROTTLE(7, 6)));
R.verdict(halfOk(half), 'half the right trigger is half the throttle: in the record ' + half.throttle + ', the physics ' + half.carThrottle + ', the tape ' + half.tape.join(', ') + ' (no ramp), ' + half.speed.toFixed(1) + ' m/s after half a second, source ' + half.source);

const lt = out.brake = await page.evaluate(new Function(`
  const L = window.__loop, F = window.__feel, set = window.__set, frames = window.__frames;
  set({}); L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(2);
  const c = F.world.car;
  set({ b: { 7: 1 } }); frames(120); const before = c.speed;
  set({ b: { 6: 1 } }); frames(30); const after = c.speed, rec = F.input.record.brake;
  frames(240); const vx = c.vx; set({}); return { before, after, rec, vx };`));
R.verdict(lt.before > 12 && lt.after < lt.before - 6 && lt.rec === 1, 'the left trigger brakes: ' + lt.before.toFixed(1) + ' m/s to ' + lt.after.toFixed(1) + ' in half a second (brake ' + lt.rec + ')');
R.verdict(lt.vx < -2, 'the left trigger held at a standstill reverses: ' + lt.vx.toFixed(1) + ' m/s along the nose');

const parts = out.parts = await page.evaluate(new Function(`
  const L = window.__loop, F = window.__feel, set = window.__set, frames = window.__frames, I = F.input, o = {};
  set({}); L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(2);
  const read = s => { set(s); const r = I.read(performance.now()); return { steer: +r.steer.toFixed(3), handbrake: r.handbrake, restart: r.restart }; };
  o.stick = read({ x: 0.6 }); o.stickSmall = read({ x: 0.1 }); o.dpadLeft = read({ b: { 14: 1 } });
  o.A = read({ b: { 0: 1 } }); read({}); o.X = read({ b: { 2: 1 } }); read({}); o.B = read({ b: { 1: 1 } }); read({});
  o.Y = read({ b: { 3: 1 } }); read({}); o.start = read({ b: { 9: 1 } }); read({});
  set({}); return o;`));
const dz = 0.12, want = +((0.6 - dz) / (1 - dz)).toFixed(3);
R.verdict(parts.stick.steer === want && parts.stickSmall.steer === 0 && parts.dpadLeft.steer === -1, 'the stick steers: 0.6 reads ' + parts.stick.steer + ' (past the 0.12 dead zone, ' + want + '), 0.1 reads ' + parts.stickSmall.steer + ', the d-pad left ' + parts.dpadLeft.steer);
R.verdict(parts.A.handbrake === 1 && parts.X.handbrake === 1 && parts.B.handbrake === 0, 'A and X are the handbrake (' + parts.A.handbrake + ', ' + parts.X.handbrake + '), B is not (' + parts.B.handbrake + ')');
R.verdict(parts.Y.restart && parts.start.restart, 'Y and start restart (' + parts.Y.restart + ', ' + parts.start.restart + ')');

/* Easy: the same pad as it always was */
const easy = out.easy = await page.evaluate(new Function(`
  const L = window.__loop, F = window.__feel, set = window.__set, frames = window.__frames, I = F.input;
  L.action('title'); L.controls.setEasyPreferred(true);
  set({}); L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(2);
  set({ b: { 7: 0.5 } }); const r = I.read(performance.now()); const o = { profile: L.profile(), throttle: r.throttle, brake: r.brake, handbrake: r.handbrake };
  set({ b: { 1: 1 } }); o.B = I.read(performance.now() + 1).handbrake;
  set({}); I.read(performance.now() + 2); L.controls.setEasyPreferred(false); return o;`));
R.verdict(easy.profile.controls === 'easy' && easy.throttle === 1 && easy.brake === 0 && easy.handbrake === 1 && easy.B === 1, 'on Easy the same pad drives as it always has: half a right trigger is DRIFT (handbrake ' + easy.handbrake + ') with the throttle on (' + easy.throttle + '), and B is DRIFT too (' + easy.B + ')');

/* the menus: Pro's title by d-pad alone */
const menu = out.title = await page.evaluate(new Function(`
  const pad = (o) => [{ buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!(o && o.b === i), value: o && o.b === i ? 1 : 0 })), axes: [0, 0, 0, 0] }];
  const N = window.__feel.padnav; let T = 1e6;
  const tap = b => { T += 20; N.update(T, pad({ b })); T += 20; N.update(T, pad(null)); };
  const DIR = { up: 12, down: 13, left: 14, right: 15 };
  window.__loop.action('title');
  const keys = [...document.querySelectorAll('#screens button[data-action]')].filter(b => !b.disabled && b.offsetParent !== null).map(b => b.dataset.action + '|' + (b.dataset.arg || ''));
  N.focus(null); const start = N.key, seen = new Set([start]), q = [start];
  while (q.length) { const k = q.shift(); for (const d of ['up', 'down', 'left', 'right']) { N.focus(k); tap(DIR[d]); if (!seen.has(N.key)) { seen.add(N.key); q.push(N.key); } } }
  return { all: keys.length, missed: keys.filter(k => !seen.has(k)), toggle: keys.includes('controls|') };`));
R.verdict(menu.toggle && menu.missed.length === 0, "Pro's title by pad: all " + menu.all + ' buttons reached by d-pad moves, the CONTROLS toggle among them' + (menu.missed.length ? ', MISSED ' + menu.missed.join(' ') : ''));

/* known answer: the triggers swapped */
const swapped = out.swapped = await page.evaluate(new Function(THROTTLE(6, 7)));
const caught = !halfOk(swapped);
R.verdict(caught, 'known answer: with the triggers swapped (half the left trigger fed) the throttle check fails (throttle ' + swapped.throttle + ', brake ' + swapped.brake + '): ' + (caught ? 'CAUGHT' : 'MISSED'));
R.verdict(pg.errors.length === 0, 'no page errors (' + pg.errors.length + ')');
await env.close();
process.exit(R.finish('pad', out) ? 1 : 0);
