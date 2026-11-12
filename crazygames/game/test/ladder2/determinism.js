/* LADDER2 MEASURE 1 (briefs/RIVALS-LADDER-2.md), the ladder round's probe on this round's record: NOTHING THAT EXISTS HAS
   CHANGED. The tapes recorded on main's code (review/ladder2/main.json,
   by ladder2/main-record.js on this branch before any change of the
   round, when it was main) replay on this branch:
   a. career 1 and The vice: main's score through the run structure and
      main's world hash through the world;
   b. a drift race against Kestrow, recorded on main with the mixed
      scripted player: the player's hash, his hash and both totals.
   Known answers: one steering entry turned the other way gives another
   hash on each track; the race tape with one input changed gives
   another player hash and leaves his; his corner entry speed 26.25 to
   25.75 m/s gives another rival hash.

   node game/test/ladder2/determinism.js   writes review/ladder2/determinism.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../ladder/lib.js';
const DIR = path.join(R.root, 'review', 'ladder2');

const env = await R.start();
const VP = { width: 640, height: 360 };
const main = JSON.parse(fs.readFileSync(path.join(DIR, 'main.json'), 'utf8'));
const toTape = t => t.map(e => ({ n: e[0], s: e[1], t: e[2], b: e[3], h: e[4] }));
const out = { note: 'headless Chromium, forced WebGL 2 on SwiftShader, 60 Hz synthetic clock', mainCommit: main.commit, main: [], battle: null };

async function replay(spec, tape, probe) {
  const pg = await R.page(env, VP, '');
  const r = await pg.page.evaluate(({ spec, tape, probe }) => {
    const Lp = window.__loop, F = window.__feel;
    Lp.setRivalProbe(probe);
    const sp = spec.battle ? Lp.battleSpec(spec.battle) : Lp.careerSpec(spec.index);
    const res = Lp.replayRun(sp, tape);
    const R2 = Lp.rival();
    const run = res ? { score: res.score, hash: res.hash, rival: res.rival ? res.rival.total : null, rivalHash: res.rivalHash || null } : null;
    /* the bare replay: every step of the tape through the world (and, in a battle, the rival and the tandem), as the live run took them */
    Lp.startRun(sp); Lp.app.driver = null;
    const bare = F.replay(tape);
    /* his hash is taken at his line: run him on to it if the player was home first */
    if (Lp.rival() && !Lp.rival().state.finished) Lp.rival().finishRun();
    const rb = Lp.rival() ? Lp.rival().hash() : null;
    void R2;
    return { run, bare, bareRival: rb };
  }, { spec, tape, probe: probe || null });
  r.errors = pg.errors.slice(0, 3);
  await pg.close();
  return r;
}

for (const t of main.tapes) {
  const tape = toTape(t.tape);
  const r = await replay({ index: t.index }, tape);
  R.verdict(r.run && r.run.score === t.score && r.bare === t.hash && !r.errors.length, t.name + ': main\'s tape replays on this branch to main\'s score through the run structure (' + (r.run && r.run.score) + ' against ' + t.score + ') and to main\'s hash through the world (' + (r.bare === t.hash ? 'same' : 'DIFFERENT') + ')');
  const bad = tape.map(e => ({ ...e })); let k = Math.floor(bad.length * 0.45); while (k < bad.length && Math.abs(bad[k].s) < 0.2) k++; bad[k].s = -bad[k].s;
  const rb = await replay({ index: t.index }, bad);
  R.verdict(rb.bare !== t.hash, t.name + ' known answer: entry ' + k + ' steered the other way replays to a different hash: ' + (rb.bare !== t.hash ? 'CAUGHT' : 'MISSED') + ' (score ' + (rb.run ? rb.run.score : 'no finish') + ')');
  out.main.push({ name: t.name, score: t.score, replayedScore: r.run && r.run.score, bareSame: r.bare === t.hash, knownAnswer: { entry: k, score: rb.run && rb.run.score, caught: rb.bare !== t.hash } });
}

/* the race recorded on main */
{
  const rc = main.race, tape = toTape(rc.tape);
  const r = await replay({ battle: 'r1' }, tape);
  const ok = r.run && r.run.score === rc.score && r.run.rival === rc.rival && r.bare === rc.hash && r.bareRival === rc.rivalHash && r.run.rivalHash === rc.rivalHash && !r.errors.length;
  R.verdict(ok, 'the race against Kestrow recorded on main (' + rc.score + ' against ' + rc.rival + ', ' + rc.steps + ' steps) replays on this branch: totals ' + (r.run && r.run.score) + ' and ' + (r.run && r.run.rival) + ', player hash ' + (r.bare === rc.hash ? 'same' : 'DIFFERENT') + ', his hash ' + (r.bareRival === rc.rivalHash && r.run && r.run.rivalHash === rc.rivalHash ? 'same' : 'DIFFERENT'));
  const bad = tape.map(e => ({ ...e })); let k = Math.floor(bad.length * 0.4); while (k < bad.length && Math.abs(bad[k].s) < 0.2) k++; bad[k].s = -bad[k].s;
  const rb = await replay({ battle: 'r1' }, bad);
  R.verdict(rb.bare !== rc.hash && rb.bareRival === rc.rivalHash, 'known answer: the race tape with entry ' + k + ' steered the other way replays to a different player hash (' + (rb.bare !== rc.hash ? 'CAUGHT' : 'MISSED') + ') and leaves his (' + (rb.bareRival === rc.rivalHash ? 'yes' : 'NO') + ')');
  const rr = await replay({ battle: 'r1' }, tape, { driveOverride: { ENTRY: 25.75 } });
  R.verdict(rr.bareRival !== rc.rivalHash, 'known answer: his corner entry speed 26.25 to 25.75 m/s gives a different rival hash: ' + (rr.bareRival !== rc.rivalHash ? 'CAUGHT' : 'MISSED'));
  out.race = { recorded: { score: rc.score, rival: rc.rival, steps: rc.steps }, replayed: r.run, playerHashSame: r.bare === rc.hash, rivalHashSame: r.bareRival === rc.rivalHash, knownAnswers: { input: { entry: k, caught: rb.bare !== rc.hash, rivalUnchanged: rb.bareRival === rc.rivalHash }, entry: rr.bareRival !== rc.rivalHash } };
}
R.writeJson(path.join(DIR, 'determinism.json'), out);
await env.close();
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
