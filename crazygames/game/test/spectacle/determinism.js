/* SPECTACLE MEASURE 1: THE RUN IS UNTOUCHED. A recorded tape replays to
   the same hash and the same score with every new effect on, and with
   ?fx=0, on career 1 and on the longest Legend track.

   For each track:
   a. A live run with the round on: the scripted drifter drives it to
      the results through the game's own frame function, at 60 Hz, with
      the effects, the show, the dressing, the director (its countdown
      sweep, kicks, the slow motion after the line) and the adaptation
      all running every frame, and a frame drawn every DRAW_EVERY. The
      run's tape, its world hash and its score are kept.
   b. That tape replayed on the same page (the round on) and on a page
      with ?fx=0: the world hash after the tape's steps must equal the
      live run's, and the score through the run structure
      (__loop.replayRun) must equal the live run's.
   c. A live run with ?fx=0 by the same driver: the same score, and the
      same inputs step for step up to the line (after it, the finish's
      settle runs a step or two longer or shorter by frame rounding, in
      both builds; those steps are recorded in each tape and replay
      exactly).
   d. Known answer: the tape with one input changed (a steering entry
      in the middle of the run turned the other way) must not replay to
      the same hash.

   node game/test/spectacle/determinism.js
   Writes review/spectacle/determinism.json. */
import path from 'node:path';
import * as S from './lib.js';

const DRAW_EVERY = 30;
const VP = { width: 640, height: 360 };
const env = await S.start();
const out = { note: 'headless Chromium, forced WebGL 2 on SwiftShader, the scripted drifter, 60 Hz synthetic clock', tracks: [] };

/* the career's longest Legend track, by run metres (length times laps) */
const probe = await S.page(env, VP, '');
const legend = await probe.page.evaluate(() => {
  const Lp = window.__loop; let best = null;
  for (let i = 16; i < 24; i++) { const spec = Lp.careerSpec(i), t = Lp.trackFor(spec), laps = t.kind === 'circuit' ? Lp.LOOP.LAPS : 1, m = t.length * laps; if (!best || m > best.metres) best = { index: i, name: spec.name, metres: Math.round(m), kind: t.kind }; }
  return best;
});
await probe.close();
console.log('longest Legend track: ' + JSON.stringify(legend));

async function liveRun(query, index) {
  const pg = await S.page(env, VP, query);
  const p = pg.page;
  await S.careerRun(p, index);
  const r = await p.evaluate(({ every }) => {
    const F = window.__feel, A = window.__loop.app;
    let k = 0, crossed = -1;
    while (A.state !== 'results' && k < 60 * 400) {
      window.__clock += 1000 / 60;
      F.draw = k % every === 0;
      F.frame(window.__clock);
      if (crossed < 0 && window.__loop.progress() && window.__loop.progress().finished) crossed = F.world.step;
      k++;
    }
    F.draw = false;
    const res = window.__loop.results();
    const tape = F.tapeCopy();
    /* the tape up to the results (later entries are the results screen's stopped car) */
    let left = res.steps; const cut = [];
    for (const e of tape) { if (left <= 0) break; const n = Math.min(e.n, left); cut.push({ ...e, n }); left -= n; }
    return { frames: k, state: A.state, score: res.score, hash: res.hash, steps: res.steps, crossedAt: crossed, tape: cut, adapt: F.scene.adaptState ? F.scene.adaptState() : null };
  }, { every: DRAW_EVERY });
  r.errors = pg.errors.slice(0, 3);
  await pg.close();
  return r;
}
async function replay(query, index, tape) {
  const pg = await S.page(env, VP, query);
  const r = await pg.page.evaluate(({ index, tape }) => {
    const Lp = window.__loop, F = window.__feel;
    const res = Lp.replayRun(Lp.careerSpec(index), tape);
    const score = res ? res.score : null;
    Lp.startRun(Lp.careerSpec(index)); Lp.app.driver = null;
    const hash = F.replay(tape);
    return { score, hash };
  }, { index, tape });
  r.errors = pg.errors.slice(0, 3);
  await pg.close();
  return r;
}
const same = (a, b, upTo) => { let i = 0, ia = 0, ib = 0, na = a[0] ? a[0].n : 0, nb = b[0] ? b[0].n : 0; while (i < upTo && ia < a.length && ib < b.length) { const x = a[ia], y = b[ib]; if (x.s !== y.s || x.t !== y.t || x.b !== y.b || x.h !== y.h) return i; const k = Math.min(na, nb, upTo - i); i += k; na -= k; nb -= k; if (!na) { ia++; na = a[ia] ? a[ia].n : 0; } if (!nb) { ib++; nb = b[ib] ? b[ib].n : 0; } } return i >= upTo ? -1 : i; };

for (const t of [{ index: 0, name: 'career 1' }, { index: legend.index, name: 'longest Legend (' + legend.name + ', ' + legend.metres + ' m)' }]) {
  console.log('\n== ' + t.name);
  const on = await liveRun('', t.index);
  S.verdict(on.state === 'results' && on.errors.length === 0, t.name + ': the live run with the round on reached the results in ' + on.frames + ' frames, score ' + on.score + ', ' + on.steps + ' steps, the line at step ' + on.crossedAt + (on.errors.length ? ', errors ' + on.errors.join(' | ') : ''));
  const rOn = await replay('', t.index, on.tape);
  const rOff = await replay('fx=0', t.index, on.tape);
  S.verdict(rOn.hash === on.hash && rOn.score === on.score, t.name + ': its tape replayed with the round on: hash ' + (rOn.hash === on.hash ? 'same' : rOn.hash + ' against ' + on.hash) + ', score ' + rOn.score + ' against ' + on.score);
  S.verdict(rOff.hash === on.hash && rOff.score === on.score, t.name + ': its tape replayed with ?fx=0: hash ' + (rOff.hash === on.hash ? 'same' : rOff.hash + ' against ' + on.hash) + ', score ' + rOff.score + ' against ' + on.score);
  const off = await liveRun('fx=0', t.index);
  const diverge = same(on.tape, off.tape, on.crossedAt);
  const rOff2 = await replay('', t.index, off.tape);
  S.verdict(off.score === on.score && diverge < 0 && off.crossedAt === on.crossedAt && rOff2.hash === off.hash, t.name + ': the same driver with ?fx=0 scores ' + off.score + ' (round on ' + on.score + '), the same inputs to the line at step ' + off.crossedAt + (diverge >= 0 ? ' (differ at step ' + diverge + ')' : '') + ', its tape replays with the round on to its own hash ' + (rOff2.hash === off.hash) + '; steps to the results ' + off.steps + ' against ' + on.steps);
  /* the known answer: one steering entry in the middle turned the other way */
  const bad = on.tape.map(e => ({ ...e }));
  let k = Math.floor(bad.length * 0.45); while (k < bad.length && Math.abs(bad[k].s) < 0.2) k++;
  if (k < bad.length) bad[k].s = -bad[k].s;
  const rBad = await replay('', t.index, bad);
  S.verdict(rBad.hash !== on.hash, t.name + ' known answer: the tape with entry ' + k + ' of ' + bad.length + ' steered the other way (' + (k < bad.length ? bad[k].n + ' steps' : 'none') + ') replays to a different hash: ' + (rBad.hash !== on.hash ? 'CAUGHT' : 'MISSED') + ' (score ' + rBad.score + ')');
  out.tracks.push({ track: t.name, index: t.index, on: { score: on.score, hash: on.hash, steps: on.steps, crossedAt: on.crossedAt, frames: on.frames, adapt: on.adapt }, replayOn: rOn, replayFx0: rOff, fx0: { score: off.score, hash: off.hash, steps: off.steps, crossedAt: off.crossedAt, firstDifferentInput: diverge }, knownAnswer: { entry: k, hash: rBad.hash, caught: rBad.hash !== on.hash } });
}
S.writeJson(path.join(S.reviewDir, 'determinism.json'), out);
await env.close();
console.log(S.failures() ? S.failures() + ' failed' : 'all passed');
process.exit(S.failures() ? 1 : 0);
