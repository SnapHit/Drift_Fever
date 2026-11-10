/* SHARED BY THE RIVALS PROBES. The spectacle probes' harness (headless
   Chromium through the dev server, the frame loop stubbed, the page
   advanced at a synthetic 60 Hz), plus the moves this round needs: a
   battle started against a rival with a chosen player driver, run to a
   moment or to the results. */
import path from 'node:path';
import fs from 'node:fs';
import * as S from '../spectacle/lib.js';

export * from '../spectacle/lib.js';
export const rivalsDir = path.join(S.root, 'review', 'rivals');
export const rivalShots = path.join(rivalsDir, 'shots');
fs.mkdirSync(rivalShots, { recursive: true });

/* Start a battle against rival id with the player driven by driver (a
   scripted driver's options, or null for no driver), drawing off. */
export async function battleRun(pg, id, driver) {
  await pg.evaluate(({ id, driver }) => {
    const Lp = window.__loop; window.__feel.draw = false; window.__clock = window.__clock || 1000;
    Lp.startRun(Lp.battleSpec(id));
    if (driver) window.__feel.setDriver(driver);
  }, { id, driver: driver === undefined ? { drift: '*' } : driver });
}

/* What a battle frame looks like to the probes. */
export const BATTLE = `
  const A = window.__loop.app, w = window.__feel.world, c = w.car, s = window.__feel.scoring.state, R = window.__loop.rival(), t = window.__loop.tandem();
  return { i, state: A.state, step: w.step, x: c.x, z: c.z, v: c.speed, angle: Math.abs(c.slip) * 180 / Math.PI, total: s.total, chain: s.chain, mult: s.mult, tmult: t.mult, k: t.k, gap: t.gap, zone: t.zone,
    rival: R ? { x: R.world.car.x, z: R.world.car.z, v: R.world.car.speed, total: R.scoring.state.total, sliding: R.state.sliding, finished: R.state.finished, fade: R.state.fade } : null, hit: w.hit ? { speed: w.hit.speed, kind: w.hit.kind, hard: w.hit.hard } : null, depth: w.bodyDepth };
`;
