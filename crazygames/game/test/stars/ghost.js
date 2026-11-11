/* A GHOST ONLY DRIVES THE LAYOUT IT WAS RECORDED ON. Two career slots
   were given new seeds on 11 November 2026 (`was` in CAREER). In the
   page: a ghost with no seed of its own (one saved before that day) is
   ignored on a slot that has had two seeds and kept on a slot that has
   not; a ghost that names the slot's seed is kept; one that names
   another is ignored. Known answer: the same old ghost on career 1,
   which never changed, does replay.

   node game/test/stars/ghost.js */
import * as R from '../spectacle/lib.js';

const env = await R.start();
const pg = await R.page(env, { width: 640, height: 360 }, '');
const out = await pg.page.evaluate(async () => {
  const Lp = window.__loop, S = Lp.save, A = Lp.app, res = {};
  /* a real ghost: a short tape that the save accepts */
  const mk = extra => Object.assign({ score: 10, best: 0, car: 'starter', paint: 'cyan', steps: 240, hash: 'x', tape: [[240, 0, 1, 0, 0]], when: 1, seconds: 2, gen: 4, rev: 1 }, extra);
  const C = Lp.CAREER || (await import('/src/loop/modes.js')).CAREER;
  const gen = window.__loop.trackFor(Lp.careerSpec(0)).version || 1;
  const set = (i, extra) => S.setGhost('career:' + i, mk(Object.assign({ gen }, extra)));
  const has = i => { Lp.startRun(Lp.careerSpec(i)); return !!A.ghost; };
  set(0, {}); res.oldOnUnchanged = has(0);
  set(1, {}); res.oldOnReseeded = has(1);
  set(1, { seed: C[1].seed }); res.newOnReseeded = has(1);
  set(1, { seed: C[1].was }); res.wrongSeed = has(1);
  set(2, {}); res.oldOnCrossover = has(2);
  res.was = [C[1].was, C[2].was];
  return res;
});
await pg.close(); await env.stop?.();
R.verdict(out.oldOnUnchanged === true, 'known answer: a ghost with no seed replays on First slide, whose seed never changed: ' + out.oldOnUnchanged);
R.verdict(out.oldOnReseeded === false && out.oldOnCrossover === false, 'a ghost with no seed is ignored on Harbour run and Crossover (seeds were ' + out.was.join(' and ') + '): ' + out.oldOnReseeded + ', ' + out.oldOnCrossover);
R.verdict(out.newOnReseeded === true, 'a ghost recorded on the new seed replays: ' + out.newOnReseeded);
R.verdict(out.wrongSeed === false, 'a ghost that names the old seed is ignored: ' + out.wrongSeed);
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
