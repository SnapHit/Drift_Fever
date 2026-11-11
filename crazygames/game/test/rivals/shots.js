/* RIVALS MEASURE 9: FRAMES, in review/rivals/shots/. Against the first
   rival on career 1, by day (?preset=dusk) and at night (?preset=night),
   at 1280x720, 390x844 and 844x390:
     countdown   the sweep, a second in
     close       a chase mid slide, close in, the tandem counting
     far         the same too far back (the chase driver held 16 m back)
     contact     the frame after the player swipes his side (at 1280x720
                 the first battle ever, so its one prompt shows)
     finish      his finish, fading, the player still running
     won, lost   the results (tapes recorded once, replayed)
     career      the career with its rival cards
   Only the frames named are drawn. Each file is SIZE-PRESET-MOMENT.png.

   node game/test/rivals/shots.js [night|dusk]   writes review/rivals/shots/ and shots.json */
import path from 'node:path';
import * as R from './lib.js';

const env = await R.start();
const presets = process.argv.slice(2).filter(a => /^(night|dusk)$/.test(a));
const PRESETS = presets.length ? presets : ['dusk', 'night'];
const SIZES = [R.LANDSCAPE, R.PORTRAIT, R.PHONE_LANDSCAPE];
const out = { shots: [] };
const file = (vp, p, m) => path.join(R.rivalShots, R.tagOf(vp) + '-' + p + '-' + m + '.png');

/* run frames undrawn until cond (a source over F, A, R, t) is true; then draw one and shoot it */
async function shootWhen(pg, cond, max, name, steer) {
  const f = await pg.page.evaluate(({ cond, max, steer }) => {
    const F = window.__feel, A = window.__loop.app, fn = new Function('F', 'A', 'R', 't', 'return (' + cond + ');');
    const sfn = steer ? new Function('F', 'A', 'R', 't', steer) : null;
    F.draw = false;
    for (let k = 0; k < max; k++) {
      window.__clock += 1000 / 60;
      const R = window.__loop.rival(), t = window.__loop.tandem();
      if (sfn) sfn(F, A, R, t);
      F.frame(window.__clock);
      if (fn(F, A, window.__loop.rival(), window.__loop.tandem())) return { k, state: A.state, gap: t.gap, mult: t.mult, zone: t.zone };
      if (A.state === 'results') return null;
    }
    return null;
  }, { cond, max, steer: steer || null });
  if (f) { await R.shot(pg.page, name, 1); out.shots.push({ file: path.basename(name), ...f }); }
  else out.shots.push({ file: path.basename(name), missing: true });
  console.log((f ? 'shot ' : 'MISSING ') + path.basename(name) + (f ? ' ' + JSON.stringify(f) : ''));
  return f;
}
async function record(driver, bonus) {
  const pg = await R.page(env, R.LANDSCAPE, '');
  await pg.page.evaluate(b => { if (b) window.__loop.TANDEM.BONUS = b; }, bonus);
  await R.battleRun(pg.page, 'r1', driver);
  await R.until(pg.page, "f.state==='results'", 60 * 200, 120);
  const r = await pg.page.evaluate(() => { const r = window.__loop.results(); let left = r.steps; const cut = []; for (const e of window.__feel.tapeCopy()) { if (left <= 0) break; const n = Math.min(e.n, left); cut.push({ ...e, n }); left -= n; } return { tape: cut, won: r.won }; });
  await pg.close();
  return r;
}
const lost = await record({ drift: null }, 0), won = await record({ chase: true }, 40);
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
    await R.battleRun(pg.page, 'r1', { chase: true });
    await shootWhen(pg, "A.state==='countdown' && A.countdown < 2.0", 200, file(vp, preset, 'countdown'));
    await shootWhen(pg, "A.state==='drive' && A.runTime > 5 && t.mult > 1.7 && Math.abs(F.world.car.slip) > 0.4 && R.state.sliding", 60 * 80, file(vp, preset, 'close'));
    await shootWhen(pg, "A.state==='drive' && R.state.finished && R.state.fade > 0.15 && R.state.fade < 0.6", 60 * 80, file(vp, preset, 'finish'));
    await pg.close();
  }
  {
    const pg = await R.page(env, vp, q, { touch });
    await pg.page.evaluate(played);
    await R.battleRun(pg.page, 'r1', { chase: { GAP: 16 } });
    await shootWhen(pg, "A.state==='drive' && A.runTime > 5 && R.state.sliding && t.zone === 'far' && t.gap < 40", 60 * 80, file(vp, preset, 'far'));
    await pg.close();
  }
  {
    const pg = await R.page(env, vp, q, { touch });
    if (vp !== R.LANDSCAPE) await pg.page.evaluate(played);   // the first battle's prompt: once, at 1280x720
    await R.battleRun(pg.page, 'r1', { chase: true });
    await shootWhen(pg, "A.swipe && F.world.hit && F.world.hit.kind === 'rival'", 60 * 80, file(vp, preset, 'contact'), SWIPE);
    await pg.close();
  }
  for (const [name, t, bonus] of [['won', won, 40], ['lost', lost, 0]]) {
    const pg = await R.page(env, vp, q, { touch });
    await pg.page.evaluate(b => { const S = window.__loop.save; S.reset(); S.setOnboarded(); S.careerResult(0, 1, 500); if (b) window.__loop.TANDEM.BONUS = b; }, bonus);
    await pg.page.evaluate(tape => { window.__loop.replayRun(window.__loop.battleSpec('r1'), tape); window.__feel.draw = true; }, t.tape);
    await R.runFrames(pg.page, 100);
    await pg.page.screenshot({ path: file(vp, preset, name), timeout: 180000 });
    out.shots.push({ file: path.basename(file(vp, preset, name)), won: t.won });
    await pg.close();
  }
  {
    const pg = await R.page(env, vp, q, { touch });
    await pg.page.evaluate(() => { const S = window.__loop.save; S.reset(); S.setOnboarded(); for (let i = 0; i < 12; i++) S.careerResult(i, 2, 600 + i); S.rivalResult('r1', true, 412); window.__feel.draw = true; window.__loop.action('career'); const c = document.querySelector('.career .rivalcard[data-arg="r2"]') || document.querySelector('.career .rivalcard'); if (c) c.scrollIntoView({ block: 'center' }); });
    await R.runFrames(pg.page, 3);
    await pg.page.screenshot({ path: file(vp, preset, 'career'), timeout: 180000 });
    out.shots.push({ file: path.basename(file(vp, preset, 'career')) });
    await pg.close();
  }
}
R.writeJson(path.join(R.rivalsDir, 'shots.json'), out);
await env.close();
