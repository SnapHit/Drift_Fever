/* NOTHING THAT EXISTS HAS CHANGED, measured side by side (briefs/
   PLAYGROUND.md: recorded runs and the recorded Kestrow race replay to
   the bit). game/test/ladder2/determinism.js compares this branch with
   answers stored in review/ladder2/main.json, which were recorded in
   another build of Chromium: in the browser this machine has now
   (chromium-1243), main's own code misses those stored hashes exactly
   as this branch does (the last bit of a sine differs between
   builds), so that probe can no longer tell a change from the browser.
   This one can: main's code (out of git, served from a temporary
   folder) and this branch's run in the same browser, and must agree
   to the bit on
     a. the two tapes of ladder2/main.json (career 1 and The vice)
        replayed through the run structure and bare through the world:
        score, results hash and world hash;
     b. the recorded Kestrow race tape: the player's hash and his;
     c. two runs driven live by the game's own scripted drivers: career
        1 by the scripted drifter to its results, and the race against
        Kestrow by the mixed scripted player: scores, both totals,
        steps and hashes.
   Known answers: one steering entry of a tape turned the other way
   gives another hash; this branch with one physics number moved one
   per cent (the starter's ACCEL) no longer agrees with main.

   node game/test/park/same.js   writes review/park/same.json */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..', '..', '..'), repo = path.resolve(root, '..');
const ref = process.env.MAIN_REF || 'origin/main';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'park-same-'));
execFileSync('sh', ['-c', `git -C "${repo}" archive ${ref} crazygames music 2>/dev/null | tar -x -C "${tmp}" || git -C "${repo}" archive ${ref} crazygames | tar -x -C "${tmp}"`]);
fs.symlinkSync(fs.realpathSync(path.join(root, 'node_modules')), path.join(tmp, 'crazygames', 'node_modules'));
const commit = execFileSync('git', ['-C', repo, 'rev-parse', '--short', ref]).toString().trim();
const tapes = JSON.parse(fs.readFileSync(path.join(root, 'review', 'ladder2', 'main.json'), 'utf8'));
const toTape = t => t.map(e => ({ n: e[0], s: e[1], t: e[2], b: e[3], h: e[4] }));
let failed = 0; const say = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; };

async function side(dir, tweak) {
  const R = await import(pathToFileURL(path.join(dir, 'game/test/ladder/lib.js')).href + '?' + (tweak ? 't' : 'p'));
  const env = await R.start(), res = { replays: {}, live: {} };
  const open = async () => { const pg = await R.page(env, { width: 640, height: 360 }, ''); if (tweak) await pg.page.evaluate(() => { window.__feel.TUNE.VEHICLE.ACCEL *= 1.01; }); return pg; };
  const replay = async (spec, tape) => {
    const pg = await open();
    const r = await pg.page.evaluate(({ spec, tape }) => {
      const Lp = window.__loop, F = window.__feel;
      const sp = spec.battle ? Lp.battleSpec(spec.battle) : Lp.careerSpec(spec.index);
      const out = Lp.replayRun(sp, tape);
      const run = out ? { score: out.score, hash: out.hash, rival: out.rival ? out.rival.total : null, rivalHash: out.rivalHash || null } : null;
      Lp.startRun(sp); Lp.app.driver = null;
      const bare = F.replay(tape);
      if (Lp.rival() && !Lp.rival().state.finished) Lp.rival().finishRun();
      return { run, bare, bareRival: Lp.rival() ? Lp.rival().hash() : null };
    }, { spec, tape });
    r.errors = pg.errors.length; await pg.close();
    return r;
  };
  for (const t of tapes.tapes) {
    const tape = toTape(t.tape);
    res.replays[t.name] = await replay({ index: t.index }, tape);
    const bad = tape.map(e => ({ ...e })); let k = Math.floor(bad.length * 0.45); while (k < bad.length && Math.abs(bad[k].s) < 0.2) k++; bad[k].s = -bad[k].s;
    res.replays[t.name + ' (one entry turned)'] = await replay({ index: t.index }, bad);
  }
  res.replays['the Kestrow race tape'] = await replay({ battle: 'r1' }, toTape(tapes.race.tape));
  /* live: the game's own scripted drivers, to the results */
  const live = async (battle) => {
    const pg = await open();
    const r = await pg.page.evaluate(battle => {
      const Lp = window.__loop, F = window.__feel; F.draw = false; window.__clock = 1000;
      Lp.startRun(battle ? Lp.battleSpec(battle) : Lp.careerSpec(0));
      F.setDriver(battle ? { player: 'mixed' } : { drift: '*' });
      for (let i = 0; i < 60 * 200 && Lp.app.state !== 'results'; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); }
      const out = Lp.results();
      return out ? { score: out.score, steps: out.steps, hash: out.hash, rival: out.rival ? out.rival.total : null, rivalHash: out.rivalHash || null, seconds: +out.seconds.toFixed(3) } : null;
    }, battle || null);
    r && (r.errors = pg.errors.length); await pg.close();
    return r;
  };
  res.live['career 1, the scripted drifter'] = await live(null);
  res.live['the race against Kestrow, the mixed scripted player'] = await live('r1');
  await env.close();
  return res;
}
const main = await side(path.join(tmp, 'crazygames')), mine = await side(root), moved = await side(root, true);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const k of Object.keys(main.replays)) {
  if (/turned/.test(k)) continue;
  const a = main.replays[k], b = mine.replays[k];
  say(same(a, b) && !!a.bare, k + ': replayed on main (' + commit + ') and on this branch in the same browser, the same to the bit: score ' + (a.run ? a.run.score : 'no finish') + ' and ' + (b.run ? b.run.score : 'no finish') + ', world hash ' + (a.bare === b.bare ? 'same' : 'DIFFERENT') + (a.bareRival ? ', his hash ' + (a.bareRival === b.bareRival ? 'same' : 'DIFFERENT') : ''));
}
for (const k of Object.keys(main.replays)) {
  if (!/turned/.test(k)) continue;
  const base = k.replace(' (one entry turned)', '');
  say(mine.replays[k].bare !== mine.replays[base].bare && same(main.replays[k], mine.replays[k]), 'known answer: ' + base + ' with one steering entry turned the other way gives another world hash (' + (mine.replays[k].bare !== mine.replays[base].bare ? 'CAUGHT' : 'MISSED') + '), and main and this branch still agree on it');
}
for (const k of Object.keys(main.live)) {
  const a = main.live[k], b = mine.live[k];
  say(!!a && same(a, b), k + ', driven live on both: ' + (a ? a.score + (a.rival !== null ? ' against ' + a.rival : '') + ' in ' + a.steps + ' steps (' + a.seconds + ' s)' : 'no result') + ' on main, ' + (b ? b.score + (b.rival !== null ? ' against ' + b.rival : '') + ' in ' + b.steps + ' steps' : 'no result') + ' on this branch; hashes ' + (a && b && a.hash === b.hash && a.rivalHash === b.rivalHash ? 'same' : 'DIFFERENT'));
}
const caught = Object.keys(main.live).filter(k => !same(main.live[k], moved.live[k])).length + Object.keys(main.replays).filter(k => !same(main.replays[k], moved.replays[k])).length;
say(caught >= 4, 'known answer: this branch with the starter\'s ACCEL moved one per cent disagrees with main on ' + caught + ' of ' + (Object.keys(main.live).length + Object.keys(main.replays).length) + ' of these: ' + (caught ? 'CAUGHT' : 'MISSED'));
fs.mkdirSync(path.join(root, 'review', 'park'), { recursive: true });
fs.writeFileSync(path.join(root, 'review', 'park', 'same.json'), JSON.stringify({ main: commit, note: 'headless Chromium, both sides in the same browser', mainSide: main, thisBranch: mine, moved }, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
