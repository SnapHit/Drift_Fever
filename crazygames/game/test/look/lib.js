/* SHARED BY THE COVER LOOK PROBES (briefs/COVER-LOOK.md). The garage
   round's harness (headless Chromium through the dev server, the frame
   loop stubbed, the page advanced at a synthetic 60 Hz, Math.random
   seeded so two runs of one moment are the same picture), writing to
   review/look/, plus the moves this round needs: a race brought to a
   chosen step with both cars driven by the scripted players, the car a
   player drives dressed as asked, and a frame of it taken with or
   without the HUD.

   The races: each preset's track has a rival on it, so a race is the
   same race every time (both cars scripted, nothing random in the
   physics). Day is Sarrow on Endless eight (dawn), dusk Varsk on Upper
   deck, night Dovane on Over and under; the first impression is Kestrow
   on career track 1, First slide. */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../garage/lib.js';

export * from '../garage/lib.js';
export const lookDir = path.join(R.root, 'review', 'look');
export const lookShots = path.join(lookDir, 'shots');
fs.mkdirSync(lookShots, { recursive: true });

export const RACES = {
  day:   { rival: 'r6', label: 'day (dawn), Sarrow on Endless eight' },
  dusk:  { rival: 'r3', label: 'dusk, Varsk on Upper deck' },
  night: { rival: 'r4', label: 'night, Dovane on Over and under' },
  first: { rival: 'r1', label: 'career track 1, Kestrow on First slide' },
};
export const LAND = { width: 1280, height: 720 };
export const PORT = { width: 390, height: 844 };
export const PHONE_LAND = { width: 844, height: 390 };

/* A page with a clean save, the onboarding done, every career track
   open. query: the address after the ?, without the renderer (webgl2
   is the default here, as in every probe; webgpu/lib.js for the other). */
export async function page(env, vp, query, opts) {
  const pg = await R.openPage(env, vp, (query || '') + '&title=1&adapt=0', opts);
  await pg.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); S.setOnboarded(); for (let i = 0; i < 24; i++) S.careerResult(i, 3, 100000); });
  return pg;
}

/* The car the player drives: { car, paint, wheels, glow, smoke, up }, put in the save as if bought. */
export async function dress(pg, d) {
  await pg.evaluate(d => {
    const S = window.__loop.save;
    if (!d) return;
    const own = { wheels: [d.wheels || 'standard'], glow: [d.glow || 'off'], smoke: [d.smoke || 'standard'] };
    S.state.cars[d.car] = { paint: d.paint, up: d.up || { power: 0, grip: 0, steer: 0 }, wheels: d.wheels || 'standard', glow: d.glow || 'off', smoke: d.smoke || 'standard', own };
    S.state.car = d.car;
  }, d || null);
}
export const STARTER = { car: 'starter', paint: 'cyan' };
export const HERO = { car: 'driftbuild', paint: 'amber', wheels: 'blades', glow: 'violet', smoke: 'standard', up: { power: 3, grip: 3, steer: 3 } };

/* A race against rival id brought to step `to` (frames of 1/60 s from
   GO), both cars scripted (the player by the mixed scripted player, or
   by a rival's driving with a player's hands), drawing off. preset
   forces a time of day. Returns where things stand. */
export async function raceTo(pg, o) {
  await pg.evaluate(o => {
    const L = window.__loop, F = window.__feel;
    F.draw = false; window.__clock = 1000;
    L.startRun({ ...L.battleSpec(o.rival), ...(o.preset ? { preset: o.preset } : {}) }); L.skipCountdown();
    F.setDriver(o.hands ? { player: 'slide', drive: L.RIVALS.find(r => r.id === o.hands).drive } : { player: 'mixed' });
  }, o);
  await R.seedRandom(pg, 7);
  return pg.evaluate(o => {
    const F = window.__feel, s = F.scoring.state;
    for (let k = 0; k < o.to; k++) { window.__clock += 1000 / 60; if (o.mult && s.chain > 0) s.driftTime = Math.max(s.driftTime, (o.mult - 1) * 1.2 + 0.05); F.frame(window.__clock); }
    const c = F.world.car;
    return { state: window.__loop.app.state, step: F.world.step, angle: Math.abs(c.slip) * 180 / Math.PI, v: c.speed, mult: s.mult, info: F.scene.info() };
  }, o);
}

/* the HUD and the low tier's vignette in or out of the picture */
export async function hud(pg, on) {
  await pg.evaluate(on => { document.getElementById('ui').style.visibility = on ? '' : 'hidden'; const v = document.getElementById('vignette'); if (v) v.style.display = on ? '' : 'none'; }, !!on);
}

/* Draw the frame as it stands and take its picture: the frame is drawn
   twice (nothing stepped between) and the page given a moment, as the
   garage round learnt. */
export async function snap(pg, file) {
  await pg.evaluate(() => { const F = window.__feel; F.draw = true; F.scene.render(); F.scene.render(); F.draw = false; return new Promise(res => setTimeout(res, 80)); });
  const png = await pg.screenshot(file ? { path: file, timeout: 180000 } : { timeout: 180000 });
  return png;
}

/* The scene's numbers for this frame: draw calls, triangles, the tier, the backend. */
export const sceneInfo = pg => pg.evaluate(() => window.__feel.scene.info());
