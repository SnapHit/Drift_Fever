/* DRIFT RACE MEASURE 9 (briefs/DRIFT-RACE.md): FRAMES, in
   review/driftrace/shots/. Against the first rival on career 1, by day
   (?preset=dusk) and at night (?preset=night), at 1280x720, 390x844 and
   844x390, the player driven by the scripted players (a player's hands
   only):
     grid        the countdown on the level grid, a second in
     side        side by side mid slide, both sliding, the close bonus counting
     ahead       the player ahead (the grip player), him in view behind
     behind      the player behind (the slide player), him in view ahead
     lead        a lead bonus just banked at a gate, its pop showing
     contact     the frame after the player swipes his side (at 1280x720
                 the first race ever, so its one prompt shows)
     finish      the first car home at the line
     won, lost   the results (tapes recorded once, replayed)
     career      the career with its rival card
   Only the frames named are drawn. Each file is SIZE-PRESET-MOMENT.png.

   node game/test/driftrace/shots.js [night|dusk]   writes review/driftrace/shots/ and shots.json */
import path from 'node:path';
import * as R from '../rivals/lib.js';

const env = await R.start();
const presets = process.argv.slice(2).filter(a => /^(night|dusk)$/.test(a));
const PRESETS = presets.length ? presets : ['dusk', 'night'];
const SIZES = [R.LANDSCAPE, R.PORTRAIT, R.PHONE_LANDSCAPE];
const out = { shots: [] };
const file = (vp, p, m) => path.join(R.raceShots, R.tagOf(vp) + '-' + p + '-' + m + '.png');

/* run frames undrawn until cond (a source over F, A, R, t) is true; then draw one and shoot it */
async function shootWhen(pg, cond, max, name, steer) {
  const f = await pg.page.evaluate(({ cond, max, steer }) => {
    const F = window.__feel, A = window.__loop.app, fn = new Function('F', 'A', 'R', 't', 'return (' + cond + ');');
    const sfn = steer ? new Function('F', 'A', 'R', 't', steer) : null;
    F.draw = false;
    for (let k = 0; k < max; k++) {
      window.__clock += 1000 / 60;
      const R = window.__loop.rival(), t = window.__loop.tandem(), L = window.__loop.lead();
      if (sfn) sfn(F, A, R, t);
      F.frame(window.__clock);
      t.L = L;
      if (fn(F, A, window.__loop.rival(), t)) return { k, state: A.state, gap: t.gap, mult: t.mult, zone: t.zone, place: L ? L.place : 0, gapS: L ? +L.gap.toFixed(2) : 0, leads: L ? L.eventCount : 0 };
      if (A.state === 'results') return null;
    }
    return null;
  }, { cond, max, steer: steer || null });
  if (f) { await R.shot(pg.page, name, 1); out.shots.push({ file: path.basename(name), ...f }); }
  else out.shots.push({ file: path.basename(name), missing: true });
  console.log((f ? 'shot ' : 'MISSING ') + path.basename(name) + (f ? ' ' + JSON.stringify(f) : ''));
  return f;
}
/* the results' tapes: won by the mixed player; lost by the grip player held on the grid with DRIFT for its first 8 s */
async function record(kind, hold) {
  const pg = await R.page(env, R.LANDSCAPE, '');
  await R.battleRun(pg.page, 'r1', { player: kind });
  if (hold) await pg.page.evaluate(h => { const A = window.__loop.app, d = A.driver; let n = 0; A.driver = { input: w => (n++ < h * 120 ? { steer: 0, throttle: 1, brake: 0, handbrake: 1 } : d.input(w)) }; }, hold);
  await R.until(pg.page, "f.state==='results'", 60 * 200, 120);
  const r = await pg.page.evaluate(() => { const r = window.__loop.results(); let left = r.steps; const cut = []; for (const e of window.__feel.tapeCopy()) { if (left <= 0) break; const n = Math.min(e.n, left); cut.push({ ...e, n }); left -= n; } return { tape: cut, won: r.won, score: r.score, rival: r.rival.total }; });
  await pg.close();
  return r;
}
const lost = await record('grip', 8), won = await record('mixed', 0);
console.log('tapes: won ' + won.score + ' to ' + won.rival + ' (' + won.won + '), lost ' + lost.score + ' to ' + lost.rival + ' (' + lost.won + ')');
const SWIPE = `if (!A.swipe && A.state === 'drive' && R && R.state.sliding && t.gap < 9 && F.scoring.state.chain > 0 && R.runDistance() > 60) { A.swipe = 1; window.__feel.setDriver(null); }
  if (A.swipe) { const c = F.world.car, r = R.world.car, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), lx = -Math.cos(c.yaw), lz = Math.sin(c.yaw), dx = r.x - c.x, dz = r.z - c.z; F.inject = { steer: Math.max(-1, Math.min(1, -Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz) * 4)), throttle: 1, brake: 0, handbrake: 0 }; }`;

for (const preset of PRESETS) for (const vp of SIZES) {
  const touch = vp.width < 900;
  const q = 'preset=' + preset;
  /* every page but the first battle's prompt frame has a battle behind it, so the once-only prompt is not in every frame */
  const played = () => { window.__loop.save.state.rivals.r1 = { won: false, best: -100, when: 1 }; };
  {
    const pg = await R.page(env, vp, q, { touch });
    await pg.page.evaluate(played);
    await R.battleRun(pg.page, 'r1', { player: 'mixed' });
    await shootWhen(pg, "A.state==='countdown' && A.countdown < 2.0", 200, file(vp, preset, 'grid'));
    await shootWhen(pg, "A.state==='drive' && A.runTime > 3 && t.mult > 1.2 && Math.abs(F.world.car.slip) > 0.35 && R.state.sliding && t.gap < 7", 60 * 80, file(vp, preset, 'side'));
    await shootWhen(pg, "A.state==='drive' && t.L && t.L.eventCount > 0 && (A.leadSeen === undefined ? (A.leadSeen = t.L.eventCount, false) : t.L.eventCount > A.leadSeen && (A.leadAt = A.leadAt || A.runTime) && A.runTime - A.leadAt > 0.25)", 60 * 80, file(vp, preset, 'lead'));
    await shootWhen(pg, "A.state==='drive' && t.L && (F.__loopP = window.__loop.progress()) && (F.__loopP.finished || R.state.finished) && A.runTime > 20", 60 * 120, file(vp, preset, 'finish'));
    await pg.close();
  }
  for (const [kind, moment, place] of [['grip', 'ahead', 1], ['slide', 'behind', 2]]) {
    const pg = await R.page(env, vp, q, { touch });
    await pg.page.evaluate(played);
    await R.battleRun(pg.page, 'r1', { player: kind });
    await shootWhen(pg, "A.state==='drive' && A.runTime > 12 && t.L && t.L.place === " + place + " && t.L.gap > 0.4 && t.L.gap < 1.6 && t.gap < 30", 60 * 80, file(vp, preset, moment));
    await pg.close();
  }
  {
    const pg = await R.page(env, vp, q, { touch });
    if (vp !== R.LANDSCAPE) await pg.page.evaluate(played);   // the first race's prompt: once, at 1280x720
    await R.battleRun(pg.page, 'r1', { player: 'mixed' });
    await shootWhen(pg, "A.swipe && F.world.hit && F.world.hit.kind === 'rival'", 60 * 80, file(vp, preset, 'contact'), SWIPE);
    await pg.close();
  }
  for (const [name, t] of [['won', won], ['lost', lost]]) {
    const pg = await R.page(env, vp, q, { touch });
    await pg.page.evaluate(() => { const S = window.__loop.save; S.reset(); S.setOnboarded(); S.careerResult(0, 1, 500); });
    await pg.page.evaluate(tape => { window.__loop.replayRun(window.__loop.battleSpec('r1'), tape); window.__feel.draw = true; }, t.tape);
    await R.runFrames(pg.page, 100);
    await pg.page.screenshot({ path: file(vp, preset, name), timeout: 180000 });
    out.shots.push({ file: path.basename(file(vp, preset, name)), won: t.won });
    await pg.close();
  }
  {
    const pg = await R.page(env, vp, q, { touch });
    await pg.page.evaluate(() => { const S = window.__loop.save; S.reset(); S.setOnboarded(); for (let i = 0; i < 12; i++) S.careerResult(i, 2, 600 + i); S.state.rivals.r1 = { won: false, best: -120, when: 1 }; window.__feel.draw = true; window.__loop.action('career'); const c = document.querySelector('.career .rivalcard'); if (c) c.scrollIntoView({ block: 'center' }); });
    await R.runFrames(pg.page, 3);
    await pg.page.screenshot({ path: file(vp, preset, 'career'), timeout: 180000 });
    out.shots.push({ file: path.basename(file(vp, preset, 'career')) });
    await pg.close();
  }
}
R.writeJson(path.join(R.raceDir, 'shots.json'), out);
await env.close();
