/* THE KEYS REACH THE CAR (briefs/PRO-CONTROLS.md, measure 2). On Pro,
   through real key events and the game's own frame loop, read off the
   recorded tape (what the physics was given, step by step) and the car:
   W ramps the throttle to full in TUNE.CONTROLS.THROTTLE_RAMP counted in
   steps and lets go in THROTTLE_RELEASE; S brakes; S held at a
   standstill reverses; space locks the rear (the handbrake on, the rear
   wheel stopped while the front turns); the letters go by where the key
   sits on a simulated AZERTY keyboard (z at W's place drives, q at A's
   steers left, a at Q's and w at Z's do nothing), arrows too; and with
   the title's toggle on Easy the same page drives as Easy always has (W
   is DRIFT). Known answer: the throttle key unbound (W, its letter and
   Up taken out of Pro's bindings) fails the throttle check.
   node game/test/controls/keys.js   writes review/controls/keys.json */
import * as R from './lib.js';

const env = await R.start(), out = {};
const pg = await R.profilePage(env, { width: 1280, height: 720 }, 'b'), page = pg.page;
await page.evaluate(() => { window.__feel.draw = false; });

/* a run of career 1 at GO, nothing held */
const RUN = `const L = window.__loop, F = window.__feel, I = F.input; L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(1);
  const steps = () => { const v = []; for (const e of F.tapeCopy()) for (let i = 0; i < e.n; i++) v.push(e); return v; };`;
/* W held for 40 frames and let go for 20: the steps until the throttle reached 1, and back to 0 */
const W_CHECK = R.KEY + RUN + `
  const C = F.TUNE.CONTROLS, n0 = steps().length;
  down('w', 'KeyW'); frames(40); const held = steps().slice(n0);
  up('w', 'KeyW'); frames(20); const all = steps().slice(n0), gone = all.slice(held.length);
  const full = held.findIndex(e => e.t === 1), none = gone.findIndex(e => e.t === 0);
  return { want: Math.round(C.THROTTLE_RAMP / F.STEP), wantBack: Math.round(C.THROTTLE_RELEASE / F.STEP), toFull: full < 0 ? null : full + 1, toNone: none < 0 ? null : none + 1, first: held.slice(0, 4).map(e => e.t), speed: F.world.car.speed, mode: I.mode };`;
const w = out.throttle = await page.evaluate(new Function(W_CHECK));
const wOk = r => r.mode === 'pro' && r.toFull === r.want && r.toNone === r.wantBack && r.first[0] > 0 && r.first[0] < 0.1;
R.verdict(wOk(w), 'W ramps the throttle to full in ' + w.toFull + ' steps (TUNE ' + w.want + ', ' + (w.want / 120).toFixed(3) + ' s), starting ' + w.first.join(', ') + ', and back to nothing in ' + w.toNone + ' (TUNE ' + w.wantBack + ')');

/* S brakes, then reverses once stopped */
const s = out.brake = await page.evaluate(new Function(R.KEY + RUN + `
  const C = F.TUNE.CONTROLS, c = F.world.car;
  down('w', 'KeyW'); frames(150); up('w', 'KeyW'); frames(2); const before = c.speed;
  const n0 = steps().length; down('s', 'KeyS'); frames(60); const after = c.speed, rec = steps().slice(n0);
  frames(240); const vx = c.vx;
  up('s', 'KeyS'); frames(2);
  return { before, after, vx, brakeFull: rec.findIndex(e => e.b === 1) + 1, want: Math.round(C.BRAKE_RAMP / F.STEP), throttleWhileS: Math.max(...rec.map(e => e.t)) };`));
R.verdict(s.before > 15 && s.after < s.before - 8 && s.brakeFull === s.want, 'S brakes: ' + s.before.toFixed(1) + ' m/s to ' + s.after.toFixed(1) + ' in half a second, the brake full after ' + s.brakeFull + ' steps (TUNE ' + s.want + ')');
R.verdict(s.vx < -2, 'S held at a standstill reverses: ' + s.vx.toFixed(1) + ' m/s along the nose after 4 s more');

/* space locks the rear */
const h = out.handbrake = await page.evaluate(new Function(R.KEY + RUN + `
  const c = F.world.car;
  down('w', 'KeyW'); frames(120); down(' ', 'Space'); frames(10);
  const f0 = c.wheelF, r0 = c.wheelR; frames(10); const hb = c.hb, dF = c.wheelF - f0, dR = c.wheelR - r0;
  up(' ', 'Space'); up('w', 'KeyW'); frames(2);
  return { hb, dF, dR, rec: F.tapeCopy().slice(-3).map(e => e.h) };`));
R.verdict(h.hb === 1 && Math.abs(h.dR) < 1e-9 && h.dF > 1, 'space locks the rear: handbrake ' + h.hb + ', in a sixth of a second the front wheel turned ' + h.dF.toFixed(2) + ' rad and the rear ' + h.dR.toFixed(3));

/* letters by position (a simulated AZERTY keyboard), arrows, both cases */
const cases = [
  ['AZERTY drive: prints z, sits at W', 'z', 'KeyW', { t: 1, b: 0, s: 0, h: 0 }],
  ['AZERTY left: prints q, sits at A', 'q', 'KeyA', { t: 0, b: 0, s: -1, h: 0 }],
  ['AZERTY brake: prints s, sits at S', 's', 'KeyS', { t: 0, b: 1, s: 0, h: 0 }],
  ['AZERTY right, caps lock: prints D, sits at D', 'D', 'KeyD', { t: 0, b: 0, s: 1, h: 0 }],
  ['AZERTY: prints a, sits at Q, unbound', 'a', 'KeyQ', { t: 0, b: 0, s: 0, h: 0 }],
  ['AZERTY: prints w, sits at Z, unbound', 'w', 'KeyZ', { t: 0, b: 0, s: 0, h: 0 }],
  ['arrow up drives', 'ArrowUp', 'ArrowUp', { t: 1, b: 0, s: 0, h: 0 }],
  ['arrow down brakes', 'ArrowDown', 'ArrowDown', { t: 0, b: 1, s: 0, h: 0 }],
  ['space is the handbrake', ' ', 'Space', { t: 0, b: 0, s: 0, h: 1 }],
  ['shift is the handbrake', 'Shift', 'ShiftLeft', { t: 0, b: 0, s: 0, h: 1 }],
  ['no code falls back to the letter: W', 'W', '', { t: 1, b: 0, s: 0, h: 0 }],
];
out.letters = {};
for (const [name, key, code, want] of cases) {
  const got = await page.evaluate(new Function('a', R.KEY + `
    const { key, code } = a, I = window.__feel.input; I.setMode('pro');
    down(key, code); const r = I.read(performance.now()); const o = { t: r.throttle, b: r.brake, s: r.steer, h: r.handbrake };
    up(key, code); I.read(performance.now() + 1); return o;`), { key, code });
  out.letters[name] = got;
  R.verdict(got.t === want.t && got.b === want.b && got.s === want.s && got.h === want.h, name + ': ' + JSON.stringify(got));
}
/* two keys for one job: W and Up held, Up let go, still driving */
const two = await page.evaluate(new Function(R.KEY + `const I = window.__feel.input; I.setMode('pro'); down('w', 'KeyW'); down('ArrowUp', 'ArrowUp'); up('ArrowUp', 'ArrowUp'); const r = I.read(performance.now()).throttle; up('w', 'KeyW'); return { still: r, after: I.read(performance.now() + 2).throttle };`));
R.verdict(two.still === 1 && two.after === 0, 'W and Up held and Up let go: still driving (' + two.still + '), nothing once W goes too (' + two.after + ')');

/* the title's toggle to Easy: the same page drives as Easy always has */
const easy = out.easyToggle = await page.evaluate(new Function(R.KEY + `
  const L = window.__loop; L.action('title'); const before = document.querySelector('[data-action="controls"]').textContent;
  document.querySelector('[data-action="controls"]').click(); const after = document.querySelector('[data-action="controls"]').textContent;
  L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(1);
  const I = window.__feel.input; down('w', 'KeyW'); const r = I.read(performance.now()); const o = { before, after, profile: L.profile(), mode: I.mode, t: r.throttle, b: r.brake, h: r.handbrake, pref: localStorage.getItem('driftfever.cg.controls') };
  up('w', 'KeyW'); L.action('title'); document.querySelector('[data-action="controls"]').click(); o.back = document.querySelector('[data-action="controls"]').textContent; o.prefBack = localStorage.getItem('driftfever.cg.controls'); return o;`));
R.verdict(/PRO/.test(easy.before) && /EASY/.test(easy.after) && easy.profile.controls === 'easy' && easy.mode === 'easy' && easy.h === 1 && easy.t === 1 && easy.b === 0 && easy.pref === 'easy' && /PRO/.test(easy.back) && easy.prefBack === null,
  'the title toggle: ' + easy.before + ' to ' + easy.after + ', remembered on the device (' + easy.pref + '), and then W is DRIFT with the car driving itself, as Easy always was (throttle ' + easy.t + ', handbrake ' + easy.h + '); toggled back: ' + easy.back);

/* known answer: the throttle key unbound */
const unbound = out.unbound = await page.evaluate(new Function(R.KEY + `
  const B = window.__feel.input.proBindings; delete B.code.KeyW; delete B.key.ArrowUp; delete B.letter.w; delete B.letter.W;` + W_CHECK.replace(R.KEY, '')));
const caught = !wOk(unbound);
R.verdict(caught, 'known answer: with the throttle key unbound the throttle check fails (reached full in ' + unbound.toFull + ' steps): ' + (caught ? 'CAUGHT' : 'MISSED'));
R.verdict(pg.errors.length === 0, 'no page errors (' + pg.errors.length + ')');
await env.close();
process.exit(R.finish('keys', out) ? 1 : 0);
