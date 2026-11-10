/* SPECTACLE MEASURE 7: BEFORE AND AFTER. The same seed and the same
   moment with ?fx=0 (the game as it is on main) and with the round on,
   at both tiers, in all four presets, at 1280x720 and 390x844: the
   countdown (its first second, where the sweep is), mid slide with the
   chain at x5, a wall hit, the finish (just after the line) and the
   results. Each pair is one picture, main on the left, this branch on
   the right, in review/spectacle/pairs/ (half size, JPEG), and the six
   frames worth a closer look at full size in pairs/full/.

   The moments are the same in both because the run is: the scripted
   drifter from the start for the slide (the chain is held at x5 by the
   probe in both, which only the score sees), the same steering into the
   wall for the hit, and the same tape of career 1 to the line for the
   finish. Particles are random, so no two pictures are the same pixel
   for pixel; everything under them is.

   node game/test/spectacle/shots.js [--quick]   (--quick: dusk and night, low tier, 1280x720)
   Writes review/spectacle/pairs/ and shots.json. */
import path from 'node:path';
import fs from 'node:fs';
import * as S from './lib.js';

const quick = process.argv.includes('--quick');
const PRESETS = quick ? ['dusk', 'night'] : ['dusk', 'night', 'dawn', 'rain'];
const TIERS = quick ? ['low'] : ['low', 'high'];
const VIEWS = quick ? [S.LANDSCAPE] : [S.LANDSCAPE, S.PORTRAIT];
const MOMENTS = ['countdown', 'slide', 'hit', 'finish', 'results'];
const FULL = [['low', '1280x720', 'night', 'slide'], ['low', '1280x720', 'dusk', 'slide'], ['high', '1280x720', 'rain', 'slide'], ['low', '390x844', 'night', 'slide'], ['high', '1280x720', 'dusk', 'finish'], ['low', '1280x720', 'dawn', 'countdown']];
const pairsDir = path.join(S.reviewDir, 'pairs'), fullDir = path.join(pairsDir, 'full'), tmpDir = path.join(S.reviewDir, '.tmp');
for (const d of [pairsDir, fullDir, tmpDir]) fs.mkdirSync(d, { recursive: true });

const env = await S.start();
/* the tape of career 1 to 40 steps before the line, for the finish */
const rec = await S.page(env, S.LANDSCAPE, 'fx=0');
await S.careerRun(rec.page, 0);
await S.until(rec.page, "f.state==='results'", 60 * 200, 120);
const lead = await rec.page.evaluate(() => {
  const F = window.__feel, r = window.__loop.results(), tape = F.tapeCopy();
  /* the step the line was crossed: replay through the run structure to find it */
  window.__loop.replayRun(window.__loop.careerSpec(0), tape.map(e => ({ ...e })));
  const crossed = F.world.step;
  let left = crossed - 40; const cut = [];
  for (const e of tape) { if (left <= 0) break; const n = Math.min(e.n, left); cut.push({ ...e, n }); left -= n; }
  return { tape: cut, crossed, steps: r.steps };
});
await rec.close();

async function moment(p, name) {
  if (name === 'countdown') { await S.careerRun(p, 0, null); await S.runFrames(p, 40); return true; }
  if (name === 'slide') { await S.careerRun(p, 0); return !!(await S.slideAt(p, 5, 20)); }
  if (name === 'hit') {
    /* down the road, then hard over into the barrier on the left, the same in both */
    await S.careerRun(p, 0, null);
    await S.until(p, "f.state==='drive'", 400);
    await p.evaluate(() => { window.__feel.inject = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }; });
    await S.runFrames(p, 150);
    await p.evaluate(() => { window.__feel.inject = { steer: 1, throttle: 1, brake: 0, handbrake: 0 }; });
    const f = await S.untilExact(p, 'f.hit > 4', 400);
    await S.runFrames(p, 3);
    await p.evaluate(() => { window.__feel.inject = null; });
    return !!f;
  }
  if (name === 'finish' || name === 'results') {
    await p.evaluate(t => { const Lp = window.__loop; Lp.replayRun(Lp.careerSpec(0), t); Lp.app.state = 'drive'; window.__feel.setDriver({ drift: '*' }); }, lead.tape);
    const f = await S.untilExact(p, 'f.finished', 240);
    if (name === 'finish') { await S.runFrames(p, 14); return !!f; }
    await S.until(p, "f.state==='results'", 600, 10);
    await S.runFrames(p, 100);
    return true;
  }
}
const out = { pairs: [], missing: [] };
for (const tier of TIERS) for (const vp of VIEWS) for (const fx of ['0', 'on']) {
  const tag = S.tagOf(vp);
  const pg = await S.page(env, vp, 'tier=' + tier + (fx === '0' ? '&fx=0' : ''), { touch: vp === S.PORTRAIT });
  const p = pg.page;
  for (const preset of PRESETS) {
    await p.evaluate(pr => window.__feel.scene.setLook({ preset: pr }), preset);
    for (const m of MOMENTS) {
      const ok = await moment(p, m);
      if (!ok) out.missing.push([tier, tag, fx, preset, m].join(' '));
      await S.shot(p, path.join(tmpDir, [tier, tag, preset, m, fx].join('-') + '.png'));
      await p.evaluate(() => { window.__feel.inject = null; window.__loop.app.driver = null; });
    }
  }
  if (pg.errors.length) console.log('errors on ' + [tier, tag, fx].join(' ') + ': ' + pg.errors.slice(0, 2).join(' | '));
  await pg.close();
  console.log('  shot ' + tier + ' ' + tag + ' fx=' + fx);
}
/* side by side, main on the left */
const comp = await S.page(env, { width: 800, height: 600 }, '');
for (const tier of TIERS) for (const vp of VIEWS) for (const preset of PRESETS) for (const m of MOMENTS) {
  const tag = S.tagOf(vp), base = [tier, tag, preset, m].join('-');
  const a = fs.readFileSync(path.join(tmpDir, base + '-0.png')).toString('base64'), b = fs.readFileSync(path.join(tmpDir, base + '-on.png')).toString('base64');
  const full = FULL.some(f => f.join('-') === base);
  for (const scale of full ? [0.5, 1] : [0.5]) {
    const jpg = await comp.page.evaluate(async ({ a, b, scale, label }) => {
      const load = s => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + s; });
      const A = await load(a), B = await load(b), w = Math.round(A.width * scale), h = Math.round(A.height * scale), gap = Math.round(8 * scale) + 4;
      const c = document.createElement('canvas'); c.width = w * 2 + gap; c.height = h; const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.drawImage(A, 0, 0, w, h); x.drawImage(B, w + gap, 0, w, h);
      x.font = '700 ' + Math.max(11, Math.round(16 * scale)) + 'px system-ui, sans-serif'; x.fillStyle = 'rgba(0,0,0,0.6)';
      for (const [t, ox] of [['main (?fx=0)', 0], ['this branch', w + gap]]) { const tw = x.measureText(t).width + 12; x.fillRect(ox, h - 26 * Math.max(0.7, scale), tw, 26 * Math.max(0.7, scale)); x.fillStyle = '#fff'; x.fillText(t, ox + 6, h - 8 * Math.max(0.7, scale)); x.fillStyle = 'rgba(0,0,0,0.6)'; }
      x.fillStyle = 'rgba(0,0,0,0.6)'; const lt = x.measureText(label).width + 12; x.fillRect(c.width - lt, 0, lt, 24 * Math.max(0.7, scale)); x.fillStyle = '#fff'; x.fillText(label, c.width - lt + 6, 17 * Math.max(0.7, scale));
      return c.toDataURL('image/jpeg', 0.82).split(',')[1];
    }, { a, b, scale, label: base });
    const file = path.join(scale === 1 ? fullDir : pairsDir, base + '.jpg');
    fs.writeFileSync(file, Buffer.from(jpg, 'base64'));
    if (scale === 0.5) out.pairs.push(path.relative(S.reviewDir, file));
  }
}
await comp.close();
fs.rmSync(tmpDir, { recursive: true, force: true });
S.writeJson(path.join(S.reviewDir, 'shots.json'), out);
await env.close();
console.log(out.pairs.length + ' pairs' + (out.missing.length ? '; moments not reached: ' + out.missing.join(', ') : ''));
process.exit(0);
