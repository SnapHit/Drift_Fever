/* EASY IS THE GAME AS IT IS (briefs/PRO-CONTROLS.md, measure 1, and its
   rule that rivals are untouched). park/same.js's comparison, main's
   code out of git against this branch in one browser, made for each way
   a run is Easy on this branch: no switch on the address; ?controls=pro
   with the title's toggle on Easy; ?controls=pro on touch. Each must
   agree with main to the bit on
     a. the two recorded tapes of ladder2/main.json (career 1 and The
        vice), replayed through the run structure and bare through the
        world: score, results hash, world hash;
     b. the recorded Kestrow race tape: the player's hash and his;
     c. career 1 driven live by the scripted drifter to its results, and
        the race against Kestrow by the mixed scripted player: scores,
        both totals, steps and hashes.
   Rivals: on Pro (variant b) the Kestrow tape replayed makes another
   player but the same Kestrow, and the live race the same Kestrow total
   and hash as main.
   Known answer: this branch with one Easy assist number moved one per
   cent (TUNE.ASSIST.DRIFT_HOLD) disagrees with main.
   node game/test/controls/easy.js   writes review/controls/easy.json */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as C from './lib.js';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..', '..', '..'), repo = path.resolve(root, '..');
const ref = process.env.MAIN_REF || 'origin/main';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'controls-easy-'));
execFileSync('sh', ['-c', `git -C "${repo}" archive ${ref} crazygames music 2>/dev/null | tar -x -C "${tmp}" || git -C "${repo}" archive ${ref} crazygames | tar -x -C "${tmp}"`]);
fs.symlinkSync(fs.realpathSync(path.join(root, 'node_modules')), path.join(tmp, 'crazygames', 'node_modules'));
const commit = execFileSync('git', ['-C', repo, 'rev-parse', '--short', ref]).toString().trim();
const tapes = JSON.parse(fs.readFileSync(path.join(root, 'review', 'ladder2', 'main.json'), 'utf8'));
const toTape = t => t.map(e => ({ n: e[0], s: e[1], t: e[2], b: e[3], h: e[4] }));

/* setup: { query, prep (page source run once the page is open), tweak } */
async function side(dir, setup) {
  const R = await import(pathToFileURL(path.join(dir, 'game/test/ladder/lib.js')).href + '?' + setup.name.replace(/\W/g, ''));
  const env = await R.start(), res = { replays: {}, live: {} };
  const open = async () => {
    const pg = await R.page(env, { width: 640, height: 360 }, setup.query || '');
    if (setup.prep) await pg.page.evaluate(new Function(setup.prep));
    if (setup.tweak) await pg.page.evaluate(() => { window.__feel.TUNE.ASSIST.DRIFT_HOLD *= 1.01; });
    return pg;
  };
  const replay = async (spec, tape) => {
    const pg = await open();
    const r = await pg.page.evaluate(({ spec, tape }) => {
      const Lp = window.__loop, F = window.__feel;
      const sp = spec.battle ? Lp.battleSpec(spec.battle) : Lp.careerSpec(spec.index);
      const out = Lp.replayRun(sp, tape);
      const run = out ? { score: out.score, hash: out.hash, rival: out.rival ? out.rival.total : null, rivalHash: out.rivalHash || null } : null;
      const profile = Lp.profile ? Lp.profile() : null;
      Lp.startRun(sp); Lp.app.driver = null;
      const bare = F.replay(tape);
      if (Lp.rival() && !Lp.rival().state.finished) Lp.rival().finishRun();
      return { run, bare, bareRival: Lp.rival() ? Lp.rival().hash() : null, profile };
    }, { spec, tape });
    r.errors = pg.errors.length; await pg.close();
    return r;
  };
  for (const t of tapes.tapes) res.replays[t.name] = await replay({ index: t.index }, toTape(t.tape));
  res.replays['the Kestrow race tape'] = await replay({ battle: 'r1' }, toTape(tapes.race.tape));
  const live = async (battle) => {
    const pg = await open();
    const r = await pg.page.evaluate(battle => {
      const Lp = window.__loop, F = window.__feel; F.draw = false; window.__clock = 1000;
      Lp.startRun(battle ? Lp.battleSpec(battle) : Lp.careerSpec(0));
      const profile = Lp.profile ? Lp.profile() : null;
      F.setDriver(battle ? { player: 'mixed' } : { drift: '*' });
      for (let i = 0; i < 60 * 200 && Lp.app.state !== 'results'; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); }
      const out = Lp.results();
      return out ? { score: out.score, steps: out.steps, hash: out.hash, rival: out.rival ? out.rival.total : null, rivalHash: out.rivalHash || null, seconds: +out.seconds.toFixed(3), profile } : null;
    }, battle || null);
    r && (r.errors = pg.errors.length); await pg.close();
    return r;
  };
  res.live['career 1, the scripted drifter'] = await live(null);
  res.live['the race against Kestrow, the mixed scripted player'] = await live('r1');
  await env.close();
  return res;
}
const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'profile' || k === 'errors' ? undefined : v)));
const same = (a, b) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));
const TOUCH = `const F = window.__feel; window.__clock = 1000; for (let i = 0; i < 3; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); } F.input.touch.press('left', true); F.input.touch.press('left', false); window.__clock += 1000 / 60; F.frame(window.__clock);`;
const SETUPS = [
  { name: 'no switch', query: '' },
  { name: 'controls=pro, the toggle on Easy', query: 'controls=pro&pro=b', prep: 'window.__loop.controls.setEasyPreferred(true);' },
  { name: 'controls=pro, on touch', query: 'controls=pro&pro=b', prep: TOUCH },
];
const out = { main: commit, setups: {} };
const main = out.mainSide = await side(path.join(tmp, 'crazygames'), { name: 'main', query: '' });
for (const S of SETUPS) {
  const mine = out.setups[S.name] = await side(root, S);
  let all = true;
  for (const k of Object.keys(main.replays)) { const a = main.replays[k], b = mine.replays[k]; if (!same(a, b) || !a.bare) all = false; }
  for (const k of Object.keys(main.live)) { const a = main.live[k], b = mine.live[k]; if (!a || !same(a, b)) all = false; }
  const profiles = [...Object.values(mine.replays), ...Object.values(mine.live)].map(r => r && r.profile && r.profile.controls);
  const errs = [...Object.values(mine.replays), ...Object.values(mine.live)].reduce((n, r) => n + ((r && r.errors) || 0), 0);
  C.verdict(all && profiles.every(p => p === 'easy') && errs === 0, S.name + ': every replay and live run the same to the bit as main (' + commit + '): ' + Object.keys(main.replays).map(k => k + ' ' + (main.replays[k].run ? main.replays[k].run.score : '-')).join(', ') + '; live ' + Object.keys(main.live).map(k => main.live[k] ? main.live[k].score + (main.live[k].rival !== null ? ' v ' + main.live[k].rival : '') : '-').join(', ') + '; every run Easy (' + [...new Set(profiles)].join() + ')');
}
/* rivals on Pro */
const pro = out.pro = await side(root, { name: 'pro b', query: 'controls=pro&pro=b' });
const kt = 'the Kestrow race tape', lr = 'the race against Kestrow, the mixed scripted player';
const ka = main.replays[kt], kb = pro.replays[kt];   // the tape stops short of his line, so on main too there are no results: his world after the bare replay is the measure
const rivalSame = (ka.run && kb.run ? ka.run.rivalHash === kb.run.rivalHash : !ka.run && !kb.run) && !!ka.bareRival && ka.bareRival === kb.bareRival;
const playerOther = pro.replays[kt].bare !== main.replays[kt].bare;
C.verdict(rivalSame && playerOther && pro.replays[kt].profile.controls === 'pro', 'on Pro the Kestrow tape drives another player (world hash ' + (playerOther ? 'different' : 'THE SAME') + ') and the same Kestrow, to the bit (his hash ' + (rivalSame ? 'same' : 'DIFFERENT') + ')');
const liveSame = pro.live[lr] && main.live[lr] && pro.live[lr].rival === main.live[lr].rival && pro.live[lr].rivalHash === main.live[lr].rivalHash;
C.verdict(liveSame, 'on Pro, the live race against Kestrow: his total ' + (pro.live[lr] && pro.live[lr].rival) + ' and hash ' + (liveSame ? 'the same as main' : 'DIFFERENT from main (' + (main.live[lr] && main.live[lr].rival) + ')'));
/* the known answer */
const moved = out.moved = await side(root, { name: 'moved', query: '', tweak: true });
const caught = Object.keys(main.live).filter(k => !same(main.live[k], moved.live[k])).length + Object.keys(main.replays).filter(k => !same(main.replays[k], moved.replays[k])).length;
C.verdict(caught >= 3, 'known answer: this branch with the Easy assist\'s DRIFT_HOLD moved one per cent disagrees with main on ' + caught + ' of ' + (Object.keys(main.live).length + Object.keys(main.replays).length) + ' runs: ' + (caught >= 3 ? 'CAUGHT' : 'MISSED'));
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(C.finish('easy', out) ? 1 : 0);
