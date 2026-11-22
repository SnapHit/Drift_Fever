/* GHOSTS KNOW HOW THEY WERE DRIVEN (briefs/PRO-CONTROLS.md, measure 5).
   In Node, the save's rules: validGhost keeps a Pro record's controls,
   variant and prorev, and gives an Easy record exactly what main's
   validGhost gives; today's Easy and Pro daily ghosts live side by side
   and both go with the day; a Lab code's Pro ghost goes with the code.
   In the page, on variant b: career 1 run on Easy (the title's toggle)
   by the scripted drifter, then on Pro by the careful driver's keys,
   each to its results. The Pro best is kept under its own key and the
   Easy one is untouched; the Pro record replays (loop/ghost.js, its own
   world in this browser) to the hash its run finished with, and replayed
   as Easy (the profile taken off) to another; it survives the save being
   read back; a Pro run races the Pro ghost and an Easy run the Easy one.
   main's save (ladder2/main.json, written by main's code): its Easy
   ghost replays to the same hash on main and on this branch, and on
   this branch with Pro on the address, where a Pro run with no Pro best
   races it as Easy.
   Known answer: the profile dropped from the Pro ghost is caught, both
   by the replay (another hash) and by the slot (the run will not race a
   Pro slot's ghost without its profile).
   node game/test/controls/ghosts.js   writes review/controls/ghosts.json */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as R from './lib.js';
import { createProDriver, PRO_DRIVER, DRIVE } from './driver.js';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..', '..', '..'), repo = path.resolve(root, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'controls-ghosts-'));
execFileSync('sh', ['-c', `git -C "${repo}" archive ${process.env.MAIN_REF || 'origin/main'} crazygames music 2>/dev/null | tar -x -C "${tmp}" || git -C "${repo}" archive ${process.env.MAIN_REF || 'origin/main'} crazygames | tar -x -C "${tmp}"`]);
fs.symlinkSync(fs.realpathSync(path.join(root, 'node_modules')), path.join(tmp, 'crazygames', 'node_modules'));
const out = {};

/* ---- the save's rules, in Node ---- */
const S = await import(pathToFileURL(path.join(root, 'game/src/loop/save.js')).href);
const SM = await import(pathToFileURL(path.join(tmp, 'crazygames/game/src/loop/save.js')).href);
const mainBlob = JSON.parse(JSON.parse(fs.readFileSync(path.join(root, 'review', 'ladder2', 'main.json'), 'utf8')).save.blob);
const easyRec = mainBlob.ghosts['career:0'];
R.verdict(JSON.stringify(S.validGhost(easyRec)) === JSON.stringify(SM.validGhost(easyRec)), "an Easy ghost record (main's save, career 1) is read exactly as main reads it: " + JSON.stringify(S.validGhost(easyRec)).length + ' characters, the same');
const proRec = Object.assign({}, easyRec, { controls: 'pro', variant: 'b', prorev: 1 });
const kept = S.validGhost(proRec);
R.verdict(kept.controls === 'pro' && kept.variant === 'b' && kept.prorev === 1 && !('controls' in S.validGhost(easyRec)), 'a Pro record keeps its profile (' + kept.controls + ', ' + kept.variant + ', rev ' + kept.prorev + '); an Easy one gains none');
const mem = new Map(), store = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const sv = S.createSave({ storage: store });
sv.setGhost('daily:2026-11-22', easyRec); sv.setGhost('pro:daily:2026-11-22', proRec);
const both = Object.keys(sv.state.ghosts).sort().join(' ');
sv.setGhost('daily:2026-11-23', easyRec);
const next = Object.keys(sv.state.ghosts).sort().join(' ');
sv.setGhost('pro:daily:2026-11-24', proRec);
const later = Object.keys(sv.state.ghosts).sort().join(' ');
R.verdict(both === 'daily:2026-11-22 pro:daily:2026-11-22' && next === 'daily:2026-11-23' && later === 'pro:daily:2026-11-24', "today's Easy and Pro daily ghosts are kept side by side (" + both + '), and both go with the day (then ' + next + ', then ' + later + ')');
sv.labResult('AAAAAAAAAAAA', 0, 10); sv.setGhost('lab:AAAAAAAAAAAA', easyRec); sv.setGhost('pro:lab:AAAAAAAAAAAA', proRec);
for (let i = 0; i < 6; i++) sv.labResult('B' + String(i).padStart(11, '0'), 0, 10 + i);
const labLeft = Object.keys(sv.state.ghosts).filter(k => /lab:/.test(k));
R.verdict(labLeft.length === 0, 'a Lab code pushed out of the six kept takes its Easy and its Pro ghost with it (left: ' + (labLeft.join(' ') || 'none') + ')');

/* ---- in the page ---- */
const env = await R.start();
const pg = await R.profilePage(env, null, 'b'), page = pg.page;
const DRIVE_SRC = createProDriver.toString();
const r = out.page = await page.evaluate(async ({ src, base, opts }) => {
  const L = window.__loop, F = window.__feel, o = {}; F.draw = false;
  const G = await import('/src/loop/ghost.js');
  const frames = (n, each) => { if (window.__clock === undefined) window.__clock = 1000; for (let i = 0; i < n && (L.app.state === 'drive' || L.app.state === 'countdown'); i++) { if (each) each(); window.__clock += 1000 / 60; F.frame(window.__clock); } };
  /* an Easy run by the scripted drifter */
  L.controls.setEasyPreferred(true);
  L.startRun(L.careerSpec(0)); L.skipCountdown(); F.setDriver({ drift: '*' }); frames(60 * 200);
  o.easyRun = { profile: L.profile(), score: L.results() && L.results().score, saved: L.results() && L.results().ghostSaved };
  const easy0 = JSON.stringify(L.save.ghost('career:0'));
  L.action('title'); L.controls.setEasyPreferred(false);
  /* a Pro run by the careful driver's keys */
  L.startRun(L.careerSpec(0)); L.skipCountdown();
  const createProDriver = new Function('PRO_DRIVER', 'return ' + src)(base), drv = createProDriver(L.app.ground, opts);
  const KEYS = { up: ['w', 'KeyW'], down: ['s', 'KeyS'], left: ['a', 'KeyA'], right: ['d', 'KeyD'], hb: [' ', 'Space'] }, was = {};
  const send = (k, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { key: KEYS[k][0], code: KEYS[k][1], bubbles: true }));
  frames(60 * 240, () => { const k = drv.decide(F.world); for (const n of Object.keys(KEYS)) if (!!k[n] !== !!was[n]) { send(n, k[n]); was[n] = !!k[n]; } });
  for (const n of Object.keys(KEYS)) if (was[n]) send(n, false);
  const res = L.results();
  o.proRun = { profile: L.profile(), score: res && res.score, saved: res && res.ghostSaved, hash: res && res.hash, steps: res && res.steps };
  const pro = L.save.ghost('pro:career:0');
  o.slots = { pro: pro ? { controls: pro.controls, variant: pro.variant, prorev: pro.prorev, steps: pro.steps, score: pro.score } : null, easyUntouched: JSON.stringify(L.save.ghost('career:0')) === easy0 };
  const track = L.trackFor(L.careerSpec(0));
  const replay = rec => { const g = G.createGhost(track, rec); let n = 0; while (!g.state.done && n < 100000) { g.step(); n++; } return { hash: g.hash(), steps: n }; };
  o.replay = replay(pro);
  o.asEasy = replay(Object.assign({}, pro, { controls: undefined, variant: undefined, prorev: undefined }));
  o.recorded = pro.hash;
  /* read back from storage */
  L.save.reload();
  const back = L.save.ghost('pro:career:0');
  o.readBack = { controls: back && back.controls, variant: back && back.variant, prorev: back && back.prorev, replay: back ? replay(back).hash === pro.hash : false };
  /* which ghost a run races */
  L.action('title'); L.startRun(L.careerSpec(0)); o.raceOnPro = L.app.ghost ? { controls: L.app.ghost.state.record.controls || 'easy', score: L.app.ghost.state.record.score } : null;
  L.action('title'); L.controls.setEasyPreferred(true); L.startRun(L.careerSpec(0)); o.raceOnEasy = L.app.ghost ? { controls: L.app.ghost.state.record.controls || 'easy', score: L.app.ghost.state.record.score } : null;
  L.action('title'); L.controls.setEasyPreferred(false);
  /* the known answer: the profile dropped from the Pro slot's ghost */
  const dropped = Object.assign({}, pro); delete dropped.controls; delete dropped.variant; delete dropped.prorev;
  L.save.state.ghosts['pro:career:0'] = dropped;
  L.startRun(L.careerSpec(0)); o.droppedRaced = L.app.ghost ? (L.app.ghost.state.record.controls || 'easy') + ' ' + L.app.ghost.state.record.score : null;
  o.droppedReplay = replay(dropped).hash === pro.hash;
  L.action('title');
  return o;
}, { src: DRIVE_SRC, base: PRO_DRIVER, opts: DRIVE.b });
R.verdict(r.easyRun.profile.controls === 'easy' && r.easyRun.saved && r.proRun.profile.controls === 'pro' && r.proRun.saved, 'career 1 on Easy (scripted drifter, ' + r.easyRun.score + ') and on Pro by keys (' + r.proRun.score + ' in ' + r.proRun.steps + ' steps), each saved a ghost');
R.verdict(r.slots.pro && r.slots.pro.controls === 'pro' && r.slots.pro.variant === 'b' && r.slots.pro.prorev === 1 && r.slots.easyUntouched, "the Pro best keeps its own ghost, recording its profile (" + JSON.stringify(r.slots.pro) + "), and the Easy ghost is untouched (" + r.slots.easyUntouched + ')');
R.verdict(r.replay.hash === r.recorded && r.replay.steps === r.proRun.steps, 'the Pro ghost replays with its profile to the hash its run finished with, in ' + r.replay.steps + ' steps: ' + (r.replay.hash === r.recorded ? 'the same' : 'DIFFERENT'));
R.verdict(r.asEasy.hash !== r.recorded, 'replayed as Easy (the profile taken off) it drives another run: ' + (r.asEasy.hash !== r.recorded ? 'another hash' : 'THE SAME HASH'));
R.verdict(r.readBack.controls === 'pro' && r.readBack.variant === 'b' && r.readBack.prorev === 1 && r.readBack.replay, 'read back from storage it keeps its profile and still replays to the same hash (' + JSON.stringify(r.readBack) + ')');
R.verdict(r.raceOnPro && r.raceOnPro.controls === 'pro' && r.raceOnEasy && r.raceOnEasy.controls === 'easy', 'a Pro run races the Pro ghost (' + JSON.stringify(r.raceOnPro) + '), an Easy run the Easy one (' + JSON.stringify(r.raceOnEasy) + ')');
const caught = !r.droppedReplay && r.droppedRaced && /^easy/.test(r.droppedRaced);
R.verdict(caught, 'known answer: with the profile dropped from the Pro ghost, the replay misses the run\'s hash (' + (r.droppedReplay ? 'MISSED' : 'caught') + ') and a Pro run will not race it, racing the Easy ghost instead (' + r.droppedRaced + '): ' + (caught ? 'CAUGHT' : 'MISSED'));
R.verdict(pg.errors.length === 0, 'no page errors (' + pg.errors.length + ')');
await pg.close(); await env.close();

/* ---- main's save, on main and on this branch, in one browser ---- */
async function mainGhost(dir, query) {
  const L = await import(pathToFileURL(path.join(dir, 'game/test/ladder/lib.js')).href + '?' + (query ? 'q' : 'n') + dir.length);
  const e = await L.start(), p = await L.openPage(e, { width: 640, height: 360 }, (query ? query + '&' : '') + 'title=1');
  await p.page.evaluate(blob => { localStorage.setItem('driftfever.cg.save.v1', blob); }, JSON.stringify(mainBlob));
  await p.page.reload({ waitUntil: 'load' });
  await p.page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const res = await p.page.evaluate(async () => {
    const Lp = window.__loop, G = await import('/src/loop/ghost.js'), rec = Lp.save.ghost('career:0');
    const g = G.createGhost(Lp.trackFor(Lp.careerSpec(0)), rec); let n = 0; while (!g.state.done && n < 100000) { g.step(); n++; }
    Lp.startRun(Lp.careerSpec(0));
    return { hash: g.hash(), steps: n, raced: Lp.app.ghost ? (Lp.app.ghost.state.record.controls || 'easy') + ' ' + Lp.app.ghost.state.record.score : null, profile: Lp.profile ? Lp.profile().controls : 'easy' };
  });
  res.errors = p.errors.length; await p.close(); await e.close();
  return res;
}
const onMain = out.mainSave = await mainGhost(path.join(tmp, 'crazygames'), '');
const onMine = out.mainSaveHere = await mainGhost(root, '');
const onPro = out.mainSaveHerePro = await mainGhost(root, 'controls=pro&pro=b');
R.verdict(onMain.hash === onMine.hash && onMain.steps === onMine.steps && onMine.errors === 0, "main's save: its Easy ghost replays to the same hash on main and on this branch (" + onMain.steps + ' steps): ' + (onMain.hash === onMine.hash ? 'the same' : 'DIFFERENT'));
R.verdict(onPro.hash === onMain.hash && onPro.profile === 'pro' && /^easy 895/.test(onPro.raced || ''), "with Pro on the address, a Pro run with no Pro best races main's Easy ghost, which replays the same: " + onPro.raced + ', ' + (onPro.hash === onMain.hash ? 'the same hash' : 'ANOTHER HASH'));
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(R.finish('ghosts', out) ? 1 : 0);
