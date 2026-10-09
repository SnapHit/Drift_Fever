/* THE MODULE SIDE. createSim with a clock the runner sets, a seeded random,
   and an in memory store, driven by the shared probe. One sim per worker,
   jobs in order, so storage carries between jobs exactly as it does in the
   page on the other side. */
import { createRequire } from 'node:module';
import { createSim } from '../sim/drift-fever-sim.js';
const require = createRequire(import.meta.url);
const probe = require('./probe.cjs');
require('./tapes.cjs');

export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runWorkerJobs(jobs, opts) {
  let now = new Date(2000, 0, 1, 12);
  let rnd = mulberry(1);
  const hookCalls = {};
  const hooks = { now: () => now, random: () => rnd() };
  for (const h of (opts && opts.countHooks) || []) hooks[h] = () => { hookCalls[h] = (hookCalls[h] || 0) + 1; };
  const sim = createSim(hooks);
  const S = {
    get: n => sim.get(n), set: (n, v) => sim.set(n, v), fn: sim.fn,
    seedRandom: k => { rnd = mulberry(k); }
  };
  const results = [];
  for (const job of jobs) {
    const y = Math.floor(job.day / 10000), m = Math.floor(job.day / 100) % 100, d = job.day % 100;
    now = new Date(y, m - 1, d, 12, 0, 0, 0);
    results.push(probe.runJob(S, job));
  }
  return { results, hookCalls, names: sim.names };
}
