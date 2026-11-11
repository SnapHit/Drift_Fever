/* DRIFT RACE MEASURE 1 (briefs/DRIFT-RACE.md; the rivals round's
   measure 1, reworked for the race): NOTHING THAT EXISTS HAS CHANGED,
   AND A RACE REPLAYS. In headless Chromium through the game's own run structure.

   a. The tapes recorded on main's code (review/driftrace/main.json,
      written by main-record.js on this branch's base: career 1 and The
      vice, the scripted drifter) replay on this branch to the same world
      hash and the same score, through the run structure
      (__loop.replayRun) and through the bare world (__feel.replay).
   b. A race against the first rival, the mixed scripted player (a
      player's hands only, rivals/players.js) playing the player, live
      through the frame function with drawing; its tape replays through
      the run structure to the same player hash, the same rival hash and
      the same two totals (each with its lead and line bonuses).
   c. Known answers: the main tape with one steering entry turned the
      other way does not replay to main's hash; the race with one of
      the rival's driving numbers changed gives a different rival hash.

   node game/test/driftrace/determinism.js   writes review/driftrace/determinism.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../rivals/lib.js';

const env = await R.start();
const VP = { width: 640, height: 360 };
const main = JSON.parse(fs.readFileSync(path.join(R.raceDir, 'main.json'), 'utf8'));
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

/* the battle, live, drawn every 30th frame */
const pg = await R.page(env, VP, '');
await R.battleRun(pg.page, 'r1', { player: 'mixed' });
const live = await pg.page.evaluate(() => {
  const F = window.__feel, A = window.__loop.app; let k = 0;
  while (A.state !== 'results' && k < 60 * 300) { window.__clock += 1000 / 60; F.draw = k % 30 === 0; F.frame(window.__clock); k++; }
  F.draw = false;
  const res = window.__loop.results(), tape = F.tapeCopy();
  let left = res.steps; const cut = [];
  for (const e of tape) { if (left <= 0) break; const n = Math.min(e.n, left); cut.push({ ...e, n }); left -= n; }
  return { frames: k, score: res.score, rival: res.rival.total, won: res.won, hash: res.hash, rivalHash: res.rivalHash, steps: res.steps, tape: cut };
});
live.errors = pg.errors.slice(0, 3);
await pg.close();
R.verdict(live.errors.length === 0 && live.steps > 0, 'the race live: ' + live.frames + ' frames, the player ' + live.score + ' against the rival ' + live.rival + (live.won ? ' (won)' : ' (lost)') + ', ' + live.steps + ' steps');
const rb = await replay({ battle: 'r1' }, live.tape);
R.verdict(rb.run && rb.bare === live.hash && rb.run.rivalHash === live.rivalHash && rb.bareRival === live.rivalHash && rb.run.score === live.score && rb.run.rival === live.rival, 'its tape replays: player hash through the world ' + (rb.bare === live.hash ? 'same' : 'DIFFERENT') + ', rival hash ' + (rb.run.rivalHash === live.rivalHash && rb.bareRival === live.rivalHash ? 'same' : 'DIFFERENT') + ', the two totals through the run structure ' + rb.run.score + ' and ' + rb.run.rival + ' against ' + live.score + ' and ' + live.rival);
const entry = (await import('../../src/rivals/roster.js')).RIVALS[0].drive.ENTRY;
const changed = await replay({ battle: 'r1' }, live.tape, { driveOverride: { ENTRY: +(entry - 0.5).toFixed(2) } });
const chHash = changed.run ? changed.run.rivalHash : changed.bareRival;
R.verdict(chHash !== live.rivalHash, 'known answer: the rival with one driving number changed (his corner entry speed ' + entry + ' to ' + (entry - 0.5).toFixed(2) + ' m/s) gives a different rival hash: ' + (chHash !== live.rivalHash ? 'CAUGHT' : 'MISSED') + (changed.run ? ' (his total ' + changed.run.rival + ')' : ''));
const bad = live.tape.map(e => ({ ...e })); let kk = Math.floor(bad.length * 0.5); while (kk < bad.length && Math.abs(bad[kk].s) < 0.2) kk++; bad[kk].s = -bad[kk].s;
const rbad = await replay({ battle: 'r1' }, bad);
R.verdict(rbad.bare !== live.hash && rbad.bareRival === live.rivalHash, 'known answer: the race tape with one input changed replays to a different player hash (' + (rbad.bare !== live.hash ? 'CAUGHT' : 'MISSED') + '), and the rival\'s hash is unchanged by it (' + (rbad.bareRival === live.rivalHash ? 'yes' : 'NO') + ')');
out.battle = { live: { ...live, tape: undefined }, replay: rb.run, bareSame: rb.bare === live.hash, knownAnswerRival: { rivalTotal: changed.run && changed.run.rival, caught: chHash !== live.rivalHash }, knownAnswerTape: { entry: kk, caught: rbad.bare !== live.hash, rivalUnchanged: rbad.bareRival === live.rivalHash } };
R.writeJson(path.join(R.raceDir, 'determinism.json'), out);
await env.close();
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
