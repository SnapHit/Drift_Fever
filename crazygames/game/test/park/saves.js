/* PLAYGROUND MEASURE 5: THE SAVES, as the garage round's saves.js does
   it. In Node, with main's own save code beside this build's (main's
   game/src is taken from git into a temporary folder, so "main" is
   whatever the main branch holds; MAIN_REF names another).

   1. An old save loads unchanged, with nothing won. The old save is
      made by main's code: coins, cars, cosmetics, career, daily,
      missions, the Lab, rivals and ghosts. This build reads it: no
      repairs, every field main wrote is as main wrote it, and the park
      has no level won and its welcome not yet seen.
      Known answer: the same save with one coin taken is caught.
   2. A save written by this build (levels won, the welcome seen) loads
      in main's save.js without throwing, and main reads everything of
      its own from it as it is. Known answer: a loader made to throw is
      reported by the same harness. Reported, not a bar: what main
      keeps of the park if it writes the save back.
   3. A level pays once, at the save: again pays nothing; a higher
      level first pays the lower ones with it, once; after a reload
      nothing more. Known answer: the same save with its park levels
      wiped pays again, so a second payment would be seen.
   4. What this build does not know is repaired, never a crash: a
      challenge it has not got, a level of 7, a level of 1.5.
   5. The full storage rule with the park in the save: ghosts go first,
      the park's levels and the coins are never touched.
      game/test/loop/quota.js is run as it is, too.

   node game/test/park/saves.js   writes review/park/saves.json */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSave, KEY, repair } from '../../src/loop/save.js';
import { LOOP } from '../../src/tune.js';
import { allCoins, CHALLENGES } from '../../src/park/challenges.js';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..', '..', '..'), repo = path.resolve(root, '..');
const dir = path.join(root, 'review', 'park'); fs.mkdirSync(dir, { recursive: true });
let failed = 0; const out = {};
const say = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'park-main-'));
const ref = process.env.MAIN_REF || 'origin/main';
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
  s.addCoins(60000); s.buyCar('hatch', 2500); s.buyCar('fastback', 10000); s.chooseCar('fastback'); s.setPaint('hatch', 'lime');
  s.buyUpgrade('fastback', 'power'); s.buyUpgrade('starter', 'steer');
  if (s.buyCosmetic) { s.buyCosmetic('fastback', 'wheels', 'blades'); s.buyCosmetic('hatch', 'glow', 'aqua'); }
  for (let i = 0; i < 9; i++) s.careerResult(i, 1 + i % 3, 400 + i * 37);
  s.dailyResult('2026-11-13', 2, 1234); s.missionResult('career:2', [true, false, true]); s.labResult('ABCDEF012345', 1, 321); s.setLabLast('ABCDEF012345');
  s.rivalResult('r1', true, 250); s.rivalResult('r2', false, -90); s.setOnboarded();
  s.setGhost('career:0', ghost(1000, 40)); s.setGhost('career:1', ghost(1001, 50, { seed: 1248 }));
}
const oldText = oldStore.text;
const strip = st => { const c = JSON.parse(JSON.stringify(st)); delete c.park; return c; };
/* key order does not matter to a save: compare as sorted text */
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(q => [q, x[q]])) : x);
const sameAsOld = text => { const st = memory(); st.setItem(KEY, text); const s = createSave({ storage: st }); return { save: s, same: canon(strip(s.state)) === canon(JSON.parse(oldText)), repaired: s.status.repaired }; };
{
  const r = sameAsOld(oldText), pk = r.save.state.park;
  const nothing = pk && Object.keys(pk.won).length === 0 && pk.seen === false;
  out.old = { chars: oldText.length, same: r.same, repaired: r.repaired, nothing, key: KEY === M.KEY, hadPark: 'park' in JSON.parse(oldText) };
  say(KEY === M.KEY && r.same && r.repaired === 0 && nothing && !out.old.hadPark, 'an old save made by main (' + out.main + ', ' + oldText.length + ' characters: 3 cars, cosmetics, 9 career results, 2 ghosts, 2 rivals; no park field) loads unchanged: every field main wrote is as it was, ' + r.repaired + ' repairs, nothing won in the park and its welcome not yet seen');
  const robbed = JSON.parse(oldText); robbed.coins -= 1;
  const k = sameAsOld(JSON.stringify(robbed));
  out.old.known = !k.same;
  say(!k.same, 'known answer: the same save with one coin taken is caught as changed: ' + (!k.same ? 'CAUGHT' : 'MISSED'));
}

/* ---- 3. a level pays once (before 2, so the save for main has levels in it) ---- */
let mine;
{
  const st = memory(); st.setItem(KEY, oldText);
  const s = createSave({ storage: st }), c0 = s.state.coins, C = LOOP.PARK.COINS;
  const a = s.parkWin('donut', 1), a2 = s.parkWin('donut', 1);
  const b = s.parkWin('gate', 2), b2 = s.parkWin('gate', 1), b3 = s.parkWin('gate', 2);
  const c = s.parkWin('tour', 3), c2 = s.parkWin('tour', 3);
  const d = s.parkWin('donut', 3);
  s.setParkSeen();
  const want = C.donut[0] + C.gate[0] + C.gate[1] + C.tour[0] + C.tour[1] + C.tour[2] + C.donut[1] + C.donut[2];
  const ok = a.coins === C.donut[0] && a.levels.join() === '1' && a2.coins === 0 && a2.levels.length === 0 && b.coins === C.gate[0] + C.gate[1] && b.levels.join() === '1,2' && b2.coins === 0 && b3.coins === 0 && c.coins === C.tour[0] + C.tour[1] + C.tour[2] && c2.coins === 0 && d.coins === C.donut[1] + C.donut[2] && d.levels.join() === '2,3' && s.state.coins - c0 === want;
  out.pay = { paid: s.state.coins - c0, want, again: [a2.coins, b2.coins, b3.coins, c2.coins] };
  say(ok, 'a level pays once: donut bronze ' + a.coins + ', again ' + a2.coins + '; gate silver first pays bronze with it (' + b.coins + ' = ' + C.gate[0] + ' + ' + C.gate[1] + '), then bronze again ' + b2.coins + ' and silver again ' + b3.coins + '; tour gold first pays all three (' + c.coins + '), again ' + c2.coins + '; the donut\'s other two ' + d.coins + '; ' + (s.state.coins - c0) + ' coins in all, the sum of those eight levels (' + want + ')');
  const again = createSave({ storage: st }), r1 = again.parkWin('donut', 3), r2 = again.parkWin('gate', 2), r3 = again.parkWin('tour', 1), r4 = again.parkWin('gate', 3);
  const okR = again.status.repaired === 0 && r1.coins === 0 && r2.coins === 0 && r3.coins === 0 && r4.coins === C.gate[2] && again.state.park.seen === true && again.state.park.won.donut === 3 && again.state.park.won.gate === 3 && again.state.park.won.tour === 3;
  out.pay.reload = { repaired: again.status.repaired, again: [r1.coins, r2.coins, r3.coins], next: r4.coins };
  say(okR, 'after a reload: the same levels pay ' + [r1.coins, r2.coins, r3.coins].join(', ') + ', the welcome stays seen, and the one level not yet won (gate gold) still pays its ' + r4.coins + ', once');
  const forget = createSave({ storage: (() => { const m2 = memory(); const raw = JSON.parse(st.text); raw.park.won = {}; m2.setItem(KEY, JSON.stringify(raw)); return m2; })() });
  const f = forget.parkWin('donut', 3);
  out.pay.known = f.coins;
  say(f.coins === C.donut[0] + C.donut[1] + C.donut[2], 'known answer: the same save with its park levels wiped pays the donut again (' + f.coins + '), so the harness can see a second payment: ' + (f.coins > 0 ? 'CAUGHT' : 'MISSED'));
  const x = again.parkWin('loop', 2), y = again.parkWin('slalom', 9), z = again.parkWin('slalom', 0);
  say(x.coins === 0 && y.levels.join() === '1,2,3' && z.coins === 0, 'a challenge that does not exist pays ' + x.coins + '; a level over three is three (' + y.levels.join() + '); a level of none pays ' + z.coins);
  mine = { text: st.text, coins: again.state.coins };
}

/* ---- 2. a save from this build, read by main ---- */
const inMain = text => {
  const st = memory(); st.setItem(M.KEY, text);
  let threw = null, s = null;
  try { s = M.createSave({ storage: st }); s.addCoins(1); s.careerResult(9, 1, 50); } catch (e) { threw = String(e); }
  return { threw, s, st };
};
{
  const r = inMain(mine.text), now = JSON.parse(mine.text);
  const ok = !r.threw && r.s.state.coins === now.coins + 1 && r.s.state.car === now.car && Object.keys(now.cars).every(id => r.s.state.cars[id] && r.s.state.cars[id].paint === now.cars[id].paint && JSON.stringify(r.s.state.cars[id].up) === JSON.stringify(now.cars[id].up) && JSON.stringify(r.s.state.cars[id].own) === JSON.stringify(now.cars[id].own)) && JSON.stringify(r.s.state.rivals) === JSON.stringify(now.rivals) && Object.keys(r.s.state.ghosts).length === Object.keys(now.ghosts).length && r.s.state.career['3'].stars === now.career['3'].stars && JSON.stringify(r.s.state.missions) === JSON.stringify(now.missions);
  out.inMain = { threw: r.threw, repaired: r.s ? r.s.status.repaired : null, ok };
  say(ok, 'a save written by this build (park levels won, the welcome seen) loads in main\'s save.js without throwing (' + (r.threw || 'nothing thrown') + '), main repairs ' + (r.s ? r.s.status.repaired : '?') + ' things, and its coins, chosen car, cars, paints, upgrades, cosmetics, stars, missions, rivals and ghosts are as written; main then plays on and writes');
  const bad = { ...M, createSave() { throw new Error('made to throw'); } };
  const viaHarness = (() => { const st = memory(); st.setItem(M.KEY, mine.text); let threw = null; try { bad.createSave({ storage: st }); } catch (e) { threw = String(e); } return threw; })();
  out.inMain.known = !!viaHarness;
  say(!!viaHarness, 'known answer: a loader made to throw is reported by the same harness: ' + (viaHarness ? 'CAUGHT (' + viaHarness + ')' : 'MISSED'));
  const back = createSave({ storage: (() => { const st = memory(); st.setItem(KEY, r.st.text); return st; })() });
  out.roundTrip = { coins: back.state.coins, park: back.state.park, repaired: back.status.repaired };
  console.log('  reported, not a bar: after main has written the save back, this build finds the park as ' + JSON.stringify(back.state.park) + ': main does not carry the park field, so a player who went back to main\'s build and on again could win and be paid every level a second time (' + allCoins() + ' coins at most). A rollback only.');
}

/* ---- 4. what this build does not know ---- */
{
  const raw = JSON.parse(mine.text);
  raw.park.won.loop = 2; raw.park.won.donut = 7; raw.park.won.gate = 1.5; raw.park.seen = 'yes';
  let threw = null, r = null; try { r = repair(raw); } catch (e) { threw = String(e); }
  const ok = !threw && r.state.park.won.loop === undefined && r.state.park.won.donut === undefined && r.state.park.won.gate === undefined && r.state.park.won.tour === 3 && r.state.park.seen === false && r.fixes === 3 && r.state.coins === raw.coins;
  out.unknown = { threw, fixes: r && r.fixes, ok };
  say(ok, 'a save with a challenge this build has not got, a level of 7 and a level of 1.5: each dropped (nothing won there, so it can be won and paid once), ' + (r && r.fixes) + ' repairs counted, the tour\'s gold and the coins kept, nothing thrown');
  let t2 = null, r2 = null; try { r2 = repair(Object.assign(JSON.parse(mine.text), { park: 'gold' })); } catch (e) { t2 = String(e); }
  say(!t2 && r2.fixes === 1 && Object.keys(r2.state.park.won).length === 0, 'a park field that is not an object: one repair, nothing won, nothing thrown');
}

/* ---- 5. full storage ---- */
{
  const one = JSON.stringify(ghost(1, 250)).length, base = JSON.parse(mine.text);
  for (const k of Object.keys(base.ghosts)) delete base.ghosts[k];
  const cap = JSON.stringify(base).length + one * 3 + 400, st = memory(cap);
  st.setItem(KEY, JSON.stringify(base));
  const s = createSave({ storage: st });
  for (let i = 0; i < 7; i++) s.setGhost('career:' + i, ghost(2000 + i, 250));
  const coins = s.state.coins, w = s.parkWin('eight', 2);
  const again = createSave({ storage: st }), kept = Object.keys(again.state.ghosts).sort();
  const ok = w.coins === LOOP.PARK.COINS.eight[0] + LOOP.PARK.COINS.eight[1] && s.status.ghostsDropped > 0 && s.status.failedWrites === 0 && again.status.repaired === 0 && again.state.coins === coins + w.coins && again.state.park.won.eight === 2 && again.state.park.won.tour === 3 && again.state.park.won.donut === 3 && again.state.park.seen && kept.includes('career:6') && !kept.includes('career:0');
  out.full = { cap, dropped: s.status.ghostsDropped, failed: s.status.failedWrites, kept, ok };
  say(ok, 'storage with room for about three ghosts: ' + s.status.ghostsDropped + ' ghosts dropped oldest first (kept ' + kept.join(', ') + '), 0 failed writes, and on a reload the coins and every park level are there, one won while full included');
  const tiny = memory(60), t = createSave({ storage: tiny });
  const p = t.parkWin('donut', 1);
  out.full.known = t.status.ghostsDropped === 0 && t.status.failedWrites > 0;
  say(p.coins === LOOP.PARK.COINS.donut[0] && t.status.ghostsDropped === 0 && t.status.failedWrites > 0 && t.state.park.won.donut === 1, 'known answer: 60 characters of storage: nothing dropped, ' + t.status.failedWrites + ' writes failed and counted, the level still won in memory');
  let quota = '';
  try { quota = execFileSync('node', [path.join(root, 'game/test/loop/quota.js')]).toString(); } catch (e) { quota = String(e.stdout || e); failed++; }
  out.full.quota = quota.trim().split('\n').pop();
  say(/all passed/.test(quota), 'game/test/loop/quota.js as it is: ' + out.full.quota);
}
out.allCoins = allCoins(); out.levels = CHALLENGES.length * 3;
say(out.allCoins === 7500, 'all ' + out.levels + ' levels together pay ' + out.allCoins + ' coins (the brief: about 7,500, one clean pass of a chapter)');
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(path.join(dir, 'saves.json'), JSON.stringify(out, null, 1));
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
