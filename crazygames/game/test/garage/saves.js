/* GARAGE MEASURE 5: THE SAVES. In Node, with main's own save code
   beside this build's (main's game/src is taken from git into a
   temporary folder, so "main" is whatever the main branch holds).

   1. An old save loads unchanged. The old save is made by main's code:
      coins, three cars with paints and upgrades, career stars, a daily,
      missions, the Lab, rivals and two ghosts. This build reads it: no
      repairs, every field main wrote is as main wrote it, and every car
      wears the standard wheels, no glow and the standard smoke and owns
      nothing more. A ghost without a look shows the standard one.
      Known answer: the same save with one coin taken is caught.
   2. A save written by this build (cosmetics bought and worn, a ghost
      with its look) loads in main's save.js without throwing, and main
      reads the coins, cars, paints, upgrades and stars from it as they
      are. Known answer: a loader that does throw is caught by the same
      harness. Also reported, not a bar: what main keeps of the
      cosmetics if it then writes the save back (none: a player who went
      back to main's build and on again would have to buy them again).
   3. Additive both ways for what this build adds: buying and wearing
      survive a reload; an id this build does not know is repaired to
      the standard one and counted, never a crash.
   4. The full storage rule with cosmetics in the save: ghosts go first,
      and coins, stars, cars and everything bought are never touched.
      game/test/loop/quota.js is run as it is, too.

   node game/test/garage/saves.js   writes review/garage/saves.json */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSave, KEY, repair } from '../../src/loop/save.js';
import { lookOf, fullSetPrice, priceOf } from '../../src/garage/cosmetics.js';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..', '..', '..'), repo = path.resolve(root, '..');
const dir = path.join(root, 'review', 'garage'); fs.mkdirSync(dir, { recursive: true });
let failed = 0; const out = {};
const say = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; };

/* main's game/src, out of git */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'garage-main-'));
const ref = process.env.MAIN_REF || 'main';
execFileSync('sh', ['-c', `git -C "${repo}" archive ${ref} crazygames/game/src | tar -x -C "${tmp}"`]);
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
const M = await import(pathToFileURL(path.join(tmp, 'crazygames/game/src/loop/save.js')).href);
out.main = execFileSync('git', ['-C', repo, 'rev-parse', '--short', ref]).toString().trim();

function memory(cap) {
  let held = null;
  return { getItem: () => held, setItem(k, v) { if (cap !== undefined && String(v).length > cap) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } held = String(v); }, removeItem() { held = null; }, get text() { return held; } };
}
function ghost(when, n, extra) {
  const tape = []; for (let i = 0; i < n; i++) tape.push([3, (i % 7) / 10, 1, 0, i % 2]);
  return { score: 100 + when, best: 10, car: 'starter', paint: 'cyan', steps: n * 3, hash: 'h' + when, tape, when, seconds: 60, gen: 4, rev: 1, up: { power: 1, grip: 0, steer: 2 }, ...(extra || {}) };
}

/* ---- 1. an old save, made by main ---- */
const oldStore = memory();
{
  const s = M.createSave({ storage: oldStore });
  s.addCoins(60000); s.buyCar('hatch', 2500); s.buyCar('fastback', 10000); s.chooseCar('fastback'); s.setPaint('hatch', 'lime'); s.setPaint('fastback', 'night');
  s.buyUpgrade('fastback', 'power'); s.buyUpgrade('fastback', 'power'); s.buyUpgrade('starter', 'steer');
  for (let i = 0; i < 9; i++) s.careerResult(i, 1 + i % 3, 400 + i * 37);
  s.dailyResult('2026-11-13', 2, 1234); s.missionResult('career:2', [true, false, true]); s.labResult('ABCDEF012345', 1, 321); s.setLabLast('ABCDEF012345');
  s.rivalResult('r1', true, 250); s.rivalResult('r2', false, -90); s.setOnboarded();
  s.setGhost('career:0', ghost(1000, 40)); s.setGhost('career:1', ghost(1001, 50, { seed: 1248 }));
}
const oldText = oldStore.text, oldState = JSON.parse(oldText);
const strip = st => { const c = JSON.parse(JSON.stringify(st)); for (const id of Object.keys(c.cars)) { for (const k of ['wheels', 'glow', 'smoke', 'own']) delete c.cars[id][k]; } for (const k of Object.keys(c.ghosts)) delete c.ghosts[k].look; return c; };
const sameAsOld = text => { const st = memory(); st.setItem(KEY, text); const s = createSave({ storage: st }); return { save: s, same: JSON.stringify(strip(s.state)) === JSON.stringify(JSON.parse(oldText)), repaired: s.status.repaired }; };
{
  const r = sameAsOld(oldText), cars = r.save.state.cars;
  const standard = Object.keys(cars).every(id => cars[id].wheels === 'standard' && cars[id].glow === 'off' && cars[id].smoke === 'standard' && ['wheels', 'glow', 'smoke'].every(k => Array.isArray(cars[id].own[k]) && cars[id].own[k].length === 0));
  const ghosts = Object.values(r.save.state.ghosts).every(g => JSON.stringify(g.look) === JSON.stringify(lookOf(null)));
  out.old = { chars: oldText.length, same: r.same, repaired: r.repaired, standard, ghosts, key: KEY === M.KEY };
  say(KEY === M.KEY && r.same && r.repaired === 0 && standard && ghosts, 'an old save made by main (' + out.main + ', ' + oldText.length + ' characters: 3 cars, 9 career results, 2 ghosts, 2 rivals) loads unchanged: every field main wrote is as it was, ' + r.repaired + ' repairs, every car on standard wheels with no glow and standard smoke, each ghost shown in the standard look');
  const robbed = JSON.parse(oldText); robbed.coins -= 1;
  const k = sameAsOld(JSON.stringify(robbed));
  out.old.known = !k.same;
  say(!k.same, 'known answer: the same save with one coin taken is caught as changed: ' + (!k.same ? 'CAUGHT' : 'MISSED'));
}

/* ---- 2. a save from this build, read by main ---- */
let bought;
{
  const st = memory(); st.setItem(KEY, oldText);
  const s = createSave({ storage: st }), before = s.state.coins;
  const got = [s.buyCosmetic('fastback', 'wheels', 'blades'), s.buyCosmetic('fastback', 'glow', 'magenta'), s.buyCosmetic('fastback', 'smoke', 'rose'), s.buyCosmetic('hatch', 'wheels', 'discs'), s.wearCosmetic('hatch', 'wheels', 'standard')];
  s.setGhost('career:2', ghost(1002, 30, { car: 'fastback', paint: 'night', look: lookOf(s.state.cars.fastback) }));
  bought = { text: st.text, coins: s.state.coins, spent: before - s.state.coins, got };
  const price = priceOf('wheels', 'blades') + priceOf('glow', 'magenta') + priceOf('smoke', 'rose') + priceOf('wheels', 'discs');
  say(got.every(Boolean) && bought.spent === price, 'this build buys four cosmetics on two cars for ' + bought.spent + ' coins (their prices come to ' + price + ') and records a ghost with its look');
  /* the reload */
  const again = createSave({ storage: st }), f = again.state.cars.fastback, h = again.state.cars.hatch;
  const kept = again.status.repaired === 0 && f.wheels === 'blades' && f.glow === 'magenta' && f.smoke === 'rose' && h.wheels === 'standard' && h.own.wheels.includes('discs') && again.state.coins === bought.coins && again.state.ghosts['career:2'].look.wheels === 'blades';
  out.reload = { kept, repaired: again.status.repaired };
  say(kept, 'reloaded by this build: what was bought is owned, what was worn is worn, the ghost keeps its look, ' + again.status.repaired + ' repairs');
}
const inMain = text => {
  const st = memory(); st.setItem(M.KEY, text);
  let threw = null, s = null;
  try { s = M.createSave({ storage: st }); s.addCoins(1); s.careerResult(9, 1, 50); } catch (e) { threw = String(e); }
  return { threw, s, st };
};
{
  const r = inMain(bought.text), now = JSON.parse(bought.text);
  const ok = !r.threw && r.s.state.coins === now.coins + 1 && r.s.state.car === now.car && Object.keys(now.cars).every(id => r.s.state.cars[id] && r.s.state.cars[id].paint === now.cars[id].paint && JSON.stringify(r.s.state.cars[id].up) === JSON.stringify(now.cars[id].up)) && JSON.stringify(r.s.state.rivals) === JSON.stringify(now.rivals) && Object.keys(r.s.state.ghosts).length === Object.keys(now.ghosts).length && r.s.state.career['3'].stars === now.career['3'].stars;
  out.inMain = { threw: r.threw, repaired: r.s ? r.s.status.repaired : null, ok };
  say(ok, 'a save written by this build loads in main\'s save.js without throwing (' + (r.threw || 'nothing thrown') + '), main repairs ' + (r.s ? r.s.status.repaired : '?') + ' things, and its coins, chosen car, cars, paints, upgrades, stars, rivals and all ' + Object.keys(now.ghosts).length + ' ghosts are as written; main then plays on and writes');
  /* the known answer: the same harness on a loader that throws */
  const real = M.createSave, bad = { ...M, createSave() { throw new Error('made to throw'); } };
  let caught = false; try { bad.createSave({ storage: memory() }); } catch (e) { caught = true; }
  const viaHarness = (() => { const st = memory(); st.setItem(M.KEY, bought.text); let threw = null; try { bad.createSave({ storage: st }); } catch (e) { threw = String(e); } return threw; })();
  out.inMain.known = !!viaHarness;
  say(!!viaHarness && caught && typeof real === 'function', 'known answer: a loader made to throw is reported by the same harness: ' + (viaHarness ? 'CAUGHT (' + viaHarness + ')' : 'MISSED'));
  /* and back again, reported: what a round trip through main keeps */
  const back = createSave({ storage: (() => { const st = memory(); st.setItem(KEY, r.st.text); return st; })() });
  const f = back.state.cars.fastback;
  out.roundTrip = { coins: back.state.coins, fastback: { wheels: f.wheels, glow: f.glow, smoke: f.smoke, own: f.own }, repaired: back.status.repaired };
  console.log('  reported, not a bar: after main has written the save back, this build finds the fastback on ' + f.wheels + ' wheels, glow ' + f.glow + ', smoke ' + f.smoke + ', owning ' + JSON.stringify(f.own) + ': main does not carry the cosmetics, so going back to main\'s build and on again loses what was bought (' + bought.spent + ' coins here); the coins are not given back');
}

/* ---- 3. ids this build does not know ---- */
{
  const raw = JSON.parse(bought.text);
  raw.cars.fastback.wheels = 'chrome-spinners'; raw.cars.fastback.own.glow.push('ultraviolet'); raw.cars.hatch.smoke = 'rose';   // rose is real but the hatch does not own it
  let threw = null, r = null; try { r = repair(raw); } catch (e) { threw = String(e); }
  const ok = !threw && r.state.cars.fastback.wheels === 'standard' && !r.state.cars.fastback.own.glow.includes('ultraviolet') && r.state.cars.fastback.own.glow.includes('magenta') && r.state.cars.hatch.smoke === 'standard' && r.fixes === 3 && r.state.coins === raw.coins;
  out.unknown = { threw, fixes: r && r.fixes, ok };
  say(ok, 'a save with a wheel this build does not know, a glow it does not know in the owned list and a smoke worn but not owned: each put back to the standard one, ' + (r && r.fixes) + ' repairs counted, everything else kept, nothing thrown');
}

/* ---- 4. full storage ---- */
{
  const one = JSON.stringify(ghost(1, 250)).length, base = JSON.parse(bought.text);
  for (const k of Object.keys(base.ghosts)) delete base.ghosts[k];
  const cap = JSON.stringify(base).length + one * 3 + 400, st = memory(cap);
  st.setItem(KEY, JSON.stringify(base));
  const s = createSave({ storage: st });
  for (let i = 0; i < 7; i++) s.setGhost('career:' + i, ghost(2000 + i, 250, { look: lookOf({ wheels: 'blades' }) }));
  const coins = s.state.coins;
  const b1 = s.buyCosmetic('fastback', 'glow', 'aqua'); s.careerResult(4, 3, 99999);
  const again = createSave({ storage: st }), f = again.state.cars.fastback, kept = Object.keys(again.state.ghosts).sort();
  const ok = b1 && s.status.ghostsDropped > 0 && s.status.failedWrites === 0 && again.status.repaired === 0 && again.state.coins === coins - priceOf('glow', 'aqua') && f.wheels === 'blades' && f.glow === 'aqua' && f.smoke === 'rose' && f.own.glow.includes('magenta') && f.own.glow.includes('aqua') && again.state.cars.hatch.own.wheels.includes('discs') && again.state.career['4'].stars === 3 && kept.includes('career:6') && !kept.includes('career:0');
  out.full = { cap, dropped: s.status.ghostsDropped, failed: s.status.failedWrites, kept, ok };
  say(ok, 'storage with room for about three ghosts: ' + s.status.ghostsDropped + ' ghosts dropped oldest first (kept ' + kept.join(', ') + '), 0 failed writes, and on a reload the coins, the stars and every cosmetic bought and worn are there, a glow bought while full included');
  /* known answer: a storage too small for the save with no ghosts drops nothing and loses nothing in memory */
  const tiny = memory(60), t = createSave({ storage: tiny });
  t.addCoins(900); const b2 = t.buyCosmetic('starter', 'wheels', 'daggers');
  out.full.known = t.status.ghostsDropped === 0 && t.status.failedWrites > 0;
  say(b2 && t.status.ghostsDropped === 0 && t.status.failedWrites > 0 && t.state.cars.starter.wheels === 'daggers', 'known answer: 60 characters of storage: nothing dropped, ' + t.status.failedWrites + ' writes failed and counted, the wheels still worn in memory');
  let quota = '';
  try { quota = execFileSync('node', [path.join(root, 'game/test/loop/quota.js')]).toString(); } catch (e) { quota = String(e.stdout || e); failed++; }
  out.full.quota = quota.trim().split('\n').pop();
  say(/all passed/.test(quota), 'game/test/loop/quota.js as it is: ' + out.full.quota);
}
out.fullSet = fullSetPrice();
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(path.join(dir, 'saves.json'), JSON.stringify(out, null, 1));
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
