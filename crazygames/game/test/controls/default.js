/* WHICH CONTROLS A KEYBOARD GETS (23 November 2026, input/mode.js),
   after the author played Pro on a desktop and every slide he caught
   ended in the wall (controls/release.js). As shipped, from an empty
   profile at 1280x720 with no touch: the title's toggle reads CONTROLS
   EASY and a career run from the keys is Easy, where W only drives and
   SPACE is DRIFT; the toggle puts the keys on Pro a, remembered on the
   device as 'pro', and toggled back the choice is forgotten; a gamepad
   still drives Pro a and touch Easy; a device that chose Easy before
   keeps Easy for keys and pads; ?controls=pro still puts the keys on
   Pro. The probes' harness asks for Easy unless the address names
   controls or pro, so as shipped is opened as controls=shipped, which
   the game does not read as a switch.
   Known answer: main before this change (origin/main, or MAIN_REF) as
   shipped puts the keys on Pro a, and is caught.
   node game/test/controls/default.js   writes review/controls/default.json */
import * as F from '../first/lib.js';
import * as R from './lib.js';

const PAGE = R.KEY + `
  const L = window.__loop, I = window.__feel.input, C = L.controls;
  const btn = () => document.querySelector('#screens.on [data-action="controls"]');
  const pref = () => { try { return localStorage.getItem('driftfever.cg.controls'); } catch (e) { return 'unreadable'; } };
  const run = () => { L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(2); const p = L.profile(); return p.controls + (p.variant ? ' ' + p.variant : ''); };
  const o = { pref0: pref() };
  down('ArrowLeft', 'ArrowLeft'); frames(1); up('ArrowLeft', 'ArrowLeft'); frames(1);   // the keys moved last, as a desktop player's do
  L.action('title'); o.label0 = btn() ? btn().textContent : null; o.run0 = run();
  down('w', 'KeyW'); frames(2); const w = I.read(performance.now()); o.w = { throttle: w.throttle, handbrake: w.handbrake, speed: +window.__feel.world.car.speed.toFixed(2) }; up('w', 'KeyW');
  down(' ', 'Space'); o.space = I.read(performance.now() + 1).handbrake; up(' ', 'Space'); frames(1);
  if (!C.proFor) return o;   // main before the change: the known answer needs no more
  L.action('title'); btn().click(); o.label1 = btn().textContent; o.pref1 = pref(); o.run1 = run();
  L.action('title'); btn().click(); o.label2 = btn().textContent; o.pref2 = pref(); o.run2 = run();
  o.pad = C.proFor('pad'); o.touch = C.proFor('touch');
  C.setEasyPreferred(true); o.chosenEasy = { keys: C.proFor('keys'), pad: C.proFor('pad'), pref: pref() }; C.setEasyPreferred(false);
  o.prefEnd = pref();
  L.action('title');
  return o;`;
const ASKED = R.KEY + `
  const L = window.__loop; down('ArrowLeft', 'ArrowLeft'); frames(1); up('ArrowLeft', 'ArrowLeft'); frames(1);
  L.action('title'); const b = document.querySelector('#screens.on [data-action="controls"]'); const label = b ? b.textContent : null;
  L.startRun(L.careerSpec(0)); L.skipCountdown(); frames(2); const p = L.profile(); L.action('title'); return { label, run: p.controls + (p.variant ? ' ' + p.variant : '') };`;

async function open(sideName, query) {
  const S = await F.side(sideName), env = await S.R.start();
  try {
    const pg = await S.R.openPage(env, F.DESKTOP, query, { touch: false });
    await pg.page.evaluate(() => { window.__feel.draw = false; });
    const r = await pg.page.evaluate(new Function(query === 'controls=pro' ? ASKED : PAGE));
    r.errors = pg.errors.slice(0, 3);
    await pg.close();
    return r;
  } finally { await env.close(); }
}

const out = {};
const now = out.shipped = await open('branch', 'controls=shipped');
R.verdict(now.pref0 === null && /EASY/.test(now.label0) && now.run0 === 'easy', 'as shipped, an empty profile on a keyboard: the title reads ' + now.label0 + ' and a career run from the keys is ' + now.run0);
R.verdict(now.w.handbrake === 0 && now.w.throttle === 1 && now.space === 1, 'on Easy W only drives (throttle ' + now.w.throttle + ', DRIFT ' + now.w.handbrake + ') and SPACE is DRIFT (' + now.space + ')');
R.verdict(/PRO/.test(now.label1) && now.pref1 === 'pro' && now.run1 === 'pro a', 'the toggle: ' + now.label1 + ', remembered as ' + now.pref1 + ', and the run is ' + now.run1);
R.verdict(/EASY/.test(now.label2) && now.pref2 === null && now.run2 === 'easy', 'toggled back: ' + now.label2 + ', the choice forgotten (' + now.pref2 + '), the run ' + now.run2);
R.verdict(now.pad === true && now.touch === false, 'a gamepad still drives Pro (' + now.pad + ') and touch Easy (Pro: ' + now.touch + ')');
R.verdict(now.chosenEasy.keys === false && now.chosenEasy.pad === false && now.chosenEasy.pref === 'easy' && now.prefEnd === null, 'a device that chose Easy before keeps Easy for keys and pads (stored ' + now.chosenEasy.pref + ')');
const asked = out.asked = await open('branch', 'controls=pro');
R.verdict(/PRO/.test(asked.label) && asked.run === 'pro a', '?controls=pro still puts the keys on Pro: ' + asked.label + ', the run ' + asked.run);
R.verdict(now.errors.length === 0 && asked.errors.length === 0, 'no page errors (' + [...now.errors, ...asked.errors].join(' | ') + ')');
/* the known answer: main before the change puts the keys on Pro */
const then = out.main = await open('main', 'controls=shipped');
const caught = /PRO/.test(then.label0) && then.run0 === 'pro a';
R.verdict(caught, 'known answer: main before the change (' + F.mainCommit() + ') as shipped reads ' + then.label0 + ' and drives the keys on ' + then.run0 + ': ' + (caught ? 'CAUGHT' : 'MISSED'));
process.exit(R.finish('default', out) ? 1 : 0);
