/* WHICH CONTROLS A PLAYER GETS (input/mode.js). Since the evening of 23
   November 2026, by the author's word, every run is Easy and Pro is
   hidden: after he played Pro on a desktop (every slide he caught ended
   in the wall, controls/release.js) and then Easy on the same desktop
   ("works well"), he decided Pro does not add enough for a player.

   As shipped, from an empty profile at 1280x720 with no touch: the title
   has no CONTROLS toggle, a career run from the keys is Easy (W only
   drives, SPACE is DRIFT), a gamepad and touch drive Easy, and a device
   that chose Pro earlier the same day is not put on it. On Easy the
   stick is all or nothing like a key (TUNE.CONTROLS.PAD_EASY_FULL): a
   stick pushed most of the way with A gives the very record the right
   arrow with SPACE does, a light push nothing; on Pro it stays analogue.
   With ?controls=pro: the toggle is back, keys and pads drive Pro a, the
   toggle keeps Easy on the device and toggled back forgets it.
   The probes' harness asks for Easy unless the address names controls
   or pro, so as shipped is opened as controls=shipped, which the game
   does not read as a switch.
   Known answer: main before this change (origin/main, or MAIN_REF) as
   shipped shows the CONTROLS toggle and puts a gamepad on Pro, caught.
   node game/test/controls/default.js   writes review/controls/default.json */
import * as F from '../first/lib.js';
import * as R from './lib.js';

/* a stand-in gamepad whose stick and buttons the page sets */
const PAD = `window.__pad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  navigator.getGamepads = () => [window.__pad.connected ? Object.assign({ id: 'stand-in', index: 0, connected: true, mapping: 'standard', timestamp: performance.now() }, window.__pad) : null];`;
const PAGE = R.KEY + PAD + `
  const L = window.__loop, I = window.__feel.input, C = L.controls;
  const btn = () => document.querySelector('#screens.on [data-action="controls"]');
  const pref = () => { try { return localStorage.getItem('driftfever.cg.controls'); } catch (e) { return 'unreadable'; } };
  const run = () => { L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(2); const p = L.profile(); return p.controls + (p.variant ? ' ' + p.variant : ''); };
  const o = { pref0: pref() };
  down('ArrowLeft', 'ArrowLeft'); frames(1); up('ArrowLeft', 'ArrowLeft'); frames(1);   // the keys moved last, as a desktop player's do
  L.action('title'); o.toggle0 = btn() ? btn().textContent : null; o.run0 = run();
  down('w', 'KeyW'); frames(2); const w = I.read(performance.now()); o.w = { throttle: w.throttle, handbrake: w.handbrake }; up('w', 'KeyW');
  down(' ', 'Space'); o.space = I.read(performance.now() + 1).handbrake; up(' ', 'Space'); frames(1);
  o.pad = C.proFor ? C.proFor('pad') : null; o.touch = C.proFor ? C.proFor('touch') : null;
  /* the stick, read as each mode reads it */
  const stick = (mode, x, a) => { I.setMode(mode); window.__pad.connected = true; window.__pad.axes[0] = x; window.__pad.buttons[0] = { pressed: !!a, value: a ? 1 : 0 }; const r = I.read(performance.now() + 5); const out = { steer: +r.steer.toFixed(3), handbrake: r.handbrake, source: r.source }; window.__pad.axes[0] = 0; window.__pad.buttons[0] = { pressed: false, value: 0 }; I.read(performance.now() + 6); window.__pad.connected = false; return out; };
  o.stick = { easyFar: stick('easy', 0.8, true), easyLight: stick('easy', 0.4, false), easyLeft: stick('easy', -0.7, false), proFar: stick('pro', 0.8, false) };
  I.setMode('easy'); down('ArrowRight', 'ArrowRight'); down(' ', 'Space'); const k = I.read(performance.now() + 10); o.keysSame = { steer: k.steer, handbrake: k.handbrake }; up('ArrowRight', 'ArrowRight'); up(' ', 'Space'); I.read(performance.now() + 11);
  L.action('title');
  return o;`;
const ASKED = R.KEY + `
  const L = window.__loop, C = L.controls;
  const btn = () => document.querySelector('#screens.on [data-action="controls"]');
  const pref = () => { try { return localStorage.getItem('driftfever.cg.controls'); } catch (e) { return 'unreadable'; } };
  const run = () => { L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(2); const p = L.profile(); L.action('title'); return p.controls + (p.variant ? ' ' + p.variant : ''); };
  down('ArrowLeft', 'ArrowLeft'); frames(1); up('ArrowLeft', 'ArrowLeft'); frames(1);
  L.action('title'); const o = { label0: btn() ? btn().textContent : null, run0: run(), pad: C.proFor('pad') };
  btn().click(); o.label1 = btn().textContent; o.pref1 = pref(); o.run1 = run();
  btn().click(); o.label2 = btn().textContent; o.pref2 = pref(); o.run2 = run();
  return o;`;

async function open(sideName, query, prep) {
  const S = await F.side(sideName), env = await S.R.start();
  try {
    const pg = await S.R.openPage(env, F.DESKTOP, query, { touch: false });
    await pg.page.evaluate(() => { window.__feel.draw = false; });
    if (prep) await prep(pg.page);
    const r = await pg.page.evaluate(new Function(query === 'controls=pro' ? ASKED : PAGE));
    r.errors = pg.errors.slice(0, 3);
    await pg.close();
    return r;
  } finally { await env.close(); }
}

const out = {};
const now = out.shipped = await open('branch', 'controls=shipped');
R.verdict(now.pref0 === null && now.toggle0 === null && now.run0 === 'easy', 'as shipped, an empty profile on a keyboard: no CONTROLS toggle on the title (' + now.toggle0 + '), and a career run from the keys is ' + now.run0);
R.verdict(now.w.handbrake === 0 && now.w.throttle === 1 && now.space === 1, 'on Easy W only drives (throttle ' + now.w.throttle + ', DRIFT ' + now.w.handbrake + ') and SPACE is DRIFT (' + now.space + ')');
R.verdict(now.pad === false && now.touch === false, 'a gamepad drives Easy (Pro: ' + now.pad + '), and touch (Pro: ' + now.touch + ')');
const s = now.stick;
R.verdict(s.easyFar.steer === 1 && s.easyFar.handbrake === 1 && s.easyFar.source === 'pad' && s.easyFar.steer === now.keysSame.steer && s.easyFar.handbrake === now.keysSame.handbrake && s.easyLeft.steer === -1 && s.easyLight.steer === 0,
  'on Easy the stick is all or nothing: pushed 0.8 with A it reads ' + JSON.stringify(s.easyFar) + ', as the right arrow with SPACE does ' + JSON.stringify(now.keysSame) + '; 0.7 left ' + s.easyLeft.steer + '; a light 0.4 ' + s.easyLight.steer);
R.verdict(s.proFar.steer > 0.5 && s.proFar.steer < 1, 'on Pro the stick stays analogue: 0.8 reads ' + s.proFar.steer);
/* a device that chose Pro earlier the same day is not put on it */
const stored = out.storedPro = await (async () => {
  const S = await F.side('branch'), env = await S.R.start();
  try {
    const pg = await S.R.openPage(env, F.DESKTOP, 'controls=shipped', { touch: false });
    await pg.page.evaluate(() => { try { localStorage.setItem('driftfever.cg.controls', 'pro'); } catch (e) { /* none */ } });
    await pg.page.reload();
    for (let i = 0; i < 300 && !(await pg.page.evaluate(() => !!(window.__loop && window.__loop.controls)).catch(() => false)); i++) await new Promise(r => setTimeout(r, 200));
    const r = await pg.page.evaluate(() => ({ pref: window.__loop.controls.preference, keys: window.__loop.controls.proFor('keys'), pad: window.__loop.controls.proFor('pad') }));
    await pg.close();
    return r;
  } finally { await env.close(); }
})();
R.verdict(stored.pref === 'pro' && stored.keys === false && stored.pad === false, 'a device that stored Pro earlier is not put on it without the address (stored ' + stored.pref + '; keys Pro ' + stored.keys + ', pad Pro ' + stored.pad + ')');
const asked = out.asked = await open('branch', 'controls=pro');
R.verdict(/PRO/.test(asked.label0) && asked.run0 === 'pro a' && asked.pad === true, '?controls=pro: the toggle is back (' + asked.label0 + '), keys drive ' + asked.run0 + ' and a pad Pro (' + asked.pad + ')');
R.verdict(/EASY/.test(asked.label1) && asked.pref1 === 'easy' && asked.run1 === 'easy' && /PRO/.test(asked.label2) && asked.pref2 === null && asked.run2 === 'pro a', 'its toggle: ' + asked.label1 + ' kept as ' + asked.pref1 + ' (run ' + asked.run1 + '), back to ' + asked.label2 + ' and forgotten (' + asked.pref2 + ', run ' + asked.run2 + ')');
R.verdict(now.errors.length === 0 && asked.errors.length === 0, 'no page errors (' + [...now.errors, ...asked.errors].join(' | ') + ')');
/* the known answer: main before the change shows the toggle and puts a pad on Pro */
const then = out.main = await open('main', 'controls=shipped');
const caught = then.toggle0 !== null && then.pad === true;
R.verdict(caught, 'known answer: main before the change (' + F.mainCommit() + ') as shipped shows ' + then.toggle0 + ' and drives a pad on Pro (' + then.pad + '): ' + (caught ? 'CAUGHT' : 'MISSED'));
process.exit(R.finish('default', out) ? 1 : 0);
