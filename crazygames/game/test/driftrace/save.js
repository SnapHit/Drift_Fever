/* DRIFT RACE MEASURE 8 (briefs/DRIFT-RACE.md; the rivals round's
   measure 8 reworked): THE SAVE. In headless Chromium.
   1. The save written by main's code (review/driftrace/main.json,
      written by main-record.js on this branch's base: a career 1 run
      with a star, a ghost, missions, coins, and a tandem battle against
      Kestrow under the old rules, so a `rivals` entry) loads with
      nothing repaired, nothing added and every value the same as main
      stored it; the tandem entry keeps its won and best.
   2. From it a race is played to its results (the mixed scripted
      player, a player's hands only): the entry is updated as main's
      rule updates it (won if ever won, the best margin, when), the run's
      coins are paid, no ghost is kept for the race, and every other
      field is as it was.
   3. A rivals entry of the wrong shape (an entry for a rival who does
      not exist, one with the wrong types, one that is not an object) is
      repaired on load, everything else kept, and the game runs: a race
      drives and the career shows its cards, with no page errors.
   4. Known answer: that save fails the rivals invariants raw and passes
      them repaired.
   5. game/test/loop/quota.js passes (the save when storage is full).

   node game/test/driftrace/save.js   writes review/driftrace/save.json */
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as R from '../rivals/lib.js';

const env = await R.start();
const rec = JSON.parse(fs.readFileSync(path.join(R.raceDir, 'main.json'), 'utf8'));
const main = { key: rec.save.key, blob: rec.save.blob, from: rec.commit };
const out = { from: main.from };
const VP = { width: 640, height: 360 };

async function load(blob) {
  const pg = await R.openPage(env, VP, 'title=1');
  await pg.page.evaluate(([k, b]) => { localStorage.setItem(k, b); }, [main.key, blob]);
  await pg.page.reload({ waitUntil: 'load' });
  await pg.page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  return pg;
}
const RIVAL_INV = `s => s && s.rivals && typeof s.rivals === 'object' && !Array.isArray(s.rivals) && Object.entries(s.rivals).every(([k, e]) => window.__loop.RIVALS.some(r => r.id === k) && e && typeof e === 'object' && typeof e.won === 'boolean' && typeof e.best === 'number' && isFinite(e.best) && typeof e.when === 'number')`;

/* 1 and 2 */
{
  const pg = await load(main.blob);
  const r = await pg.page.evaluate(([blob, inv]) => {
    const S = window.__loop.save, raw = JSON.parse(blob), st = JSON.parse(JSON.stringify(S.state));
    const changed = Object.keys(raw).filter(k => JSON.stringify(raw[k]) !== JSON.stringify(st[k]));
    const added = Object.keys(st).filter(k => !(k in raw));
    return { repaired: S.status.repaired, changed, added, rivals: st.rivals, invOk: (0, eval)(inv)(st) };
  }, [main.blob, RIVAL_INV]);
  const rawRivals = JSON.parse(main.blob).rivals;
  R.verdict(r.repaired === 0 && r.changed.length === 0 && r.added.length === 0 && JSON.stringify(r.rivals) === JSON.stringify(rawRivals) && !!rawRivals.r1 && r.invOk, 'the save from main (' + main.from.slice(0, 12) + ', with a tandem entry ' + JSON.stringify(rawRivals) + ') loads with ' + r.repaired + ' repairs, ' + r.changed.length + ' values changed' + (r.changed.length ? ' (' + r.changed.join(', ') + ')' : '') + ', ' + r.added.length + ' fields added; the entry as stored: ' + JSON.stringify(r.rivals));
  out.mainSave = r;
  const before = await pg.page.evaluate(() => JSON.parse(JSON.stringify(window.__loop.save.state)));
  await R.battleRun(pg.page, 'r1', { player: 'mixed' });
  await R.until(pg.page, "f.state==='results'", 60 * 200, 120);
  const after = await pg.page.evaluate(inv => ({ st: JSON.parse(JSON.stringify(window.__loop.save.state)), res: window.__loop.results(), inv: (0, eval)(inv)(window.__loop.save.state) }), RIVAL_INV);
  const changed = Object.keys(before).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after.st[k]));
  const e = after.st.rivals.r1;
  const ghostsSame = JSON.stringify(Object.keys(before.ghosts)) === JSON.stringify(Object.keys(after.st.ghosts));
  const was = before.rivals.r1;
  R.verdict(!!e && typeof e.won === 'boolean' && e.won === (was.won || after.res.won) && e.best === Math.round(Math.max(was.best, after.res.margin)) && after.inv && ghostsSame && changed.every(k => k === 'rivals' || k === 'coins') && after.st.coins === before.coins + after.res.coins, 'after a race (' + after.res.score + ' against ' + after.res.rival.total + ', ' + (after.res.won ? 'won' : 'lost') + '): rivals.r1 = ' + JSON.stringify(e) + ', coins +' + after.res.coins + ', fields changed: ' + changed.join(', ') + ', no ghost kept for it: ' + ghostsSame);
  out.afterBattle = { entry: e, changed, coins: after.res.coins, ghostsSame };
  await pg.close();
}
/* 3 and 4 */
{
  const bad = JSON.parse(main.blob);
  bad.rivals = { r1: { won: 'yes', best: 'lots', when: 1 }, zz9: { won: true, best: 5, when: 1 }, r2: 7 };
  const blob = JSON.stringify(bad);
  const pg = await load(blob);
  const r = await pg.page.evaluate(([blob, inv]) => {
    const S = window.__loop.save, raw = JSON.parse(blob), st = JSON.parse(JSON.stringify(S.state));
    const changed = Object.keys(raw).filter(k => k !== 'rivals' && JSON.stringify(raw[k]) !== JSON.stringify(st[k]));
    return { repaired: S.status.repaired, rivals: st.rivals, changed, invOk: (0, eval)(inv)(st) };
  }, [blob, RIVAL_INV]);
  await R.battleRun(pg.page, 'r1', { player: 'mixed' });
  const frames = await R.runFrames(pg.page, 600, 'return window.__loop.app.state;');
  const cards = await pg.page.evaluate(() => { window.__loop.action('career'); return document.querySelectorAll('.career .rivalcard').length; });
  R.verdict(r.repaired >= 3 && JSON.stringify(r.rivals) === '{}' && r.changed.length === 0 && r.invOk && frames.includes('drive') && cards > 0 && pg.errors.length === 0, 'a rivals entry of the wrong shape loads repaired (' + r.repaired + ' fixes, rivals ' + JSON.stringify(r.rivals) + ', ' + r.changed.length + ' other values changed) and the game runs: a race drives (' + frames[frames.length - 1] + '), the career shows ' + cards + ' rival cards, ' + pg.errors.length + ' page errors');
  const ka = await pg.page.evaluate(async ([blob, inv]) => { const m = await import('/src/loop/save.js'); const raw = JSON.parse(blob); const f = (0, eval)(inv); let rawOk; try { rawOk = !!f(raw); } catch (e) { rawOk = false; } const rep = m.repair(raw); return { rawOk, repOk: !!f(rep.state), fixes: rep.fixes }; }, [blob, RIVAL_INV]);
  R.verdict(!ka.rawOk && ka.repOk, 'known answer: that save fails the rivals invariants raw (' + (ka.rawOk ? 'passes: MISSED' : 'fails: CAUGHT') + ') and passes them repaired (' + ka.repOk + ')');
  out.wrongShape = { blob: bad.rivals, ...r, cards, knownAnswer: ka };
  await pg.close();
}
/* 5 */
let quota = '';
try { quota = execFileSync('node', [path.join(R.root, 'game', 'test', 'loop', 'quota.js')], { encoding: 'utf8' }); R.verdict(!/FAIL/.test(quota), 'game/test/loop/quota.js: ' + (quota.match(/PASS/g) || []).length + ' passed, ' + (quota.match(/FAIL/g) || []).length + ' failed'); }
catch (e) { quota = String(e.stdout || e); R.verdict(false, 'game/test/loop/quota.js failed: ' + quota.slice(-300)); }
out.quota = quota.trim().split('\n');
R.writeJson(path.join(R.raceDir, 'save.json'), out);
await env.close();
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
