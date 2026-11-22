/* THE SWITCH (briefs/COVER-LOOK.md, measure 8): without ?look=2 every
   frame is the same as main's, pixel for pixel. main's game (out of
   git, served from a temporary folder with its own harness, as
   game/test/park/same.js does) and this branch's, in the same browser,
   each draw the same race at the same step with Math.random seeded the
   same, the HUD out of the picture, on both tiers, in three presets
   (day, dusk and night), and the two frames are compared to the pixel.
   Also drawn: the title (the backdrop main.js now flags for the look)
   and the garage's showroom, on the high tier.
   Known answer: one pixel of this branch's frame changed by one level
   is caught.

   node game/test/look/switch.js   writes review/look/switch.json (ONLY=garage,title for those cases, KEEP=dir to keep the frames) */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..', '..', '..'), repo = path.resolve(root, '..');
const ref = process.env.MAIN_REF || 'origin/main';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'look-switch-'));
execFileSync('sh', ['-c', `git -C "${repo}" archive ${ref} crazygames music 2>/dev/null | tar -x -C "${tmp}" || git -C "${repo}" archive ${ref} crazygames | tar -x -C "${tmp}"`]);
fs.symlinkSync(fs.realpathSync(path.join(root, 'node_modules')), path.join(tmp, 'crazygames', 'node_modules'));
const commit = execFileSync('git', ['-C', repo, 'rev-parse', '--short', ref]).toString().trim();
const STEP = 300;
const CASES = [];
for (const tier of ['low', 'high']) for (const [preset, rival] of [['dawn', 'r6'], ['dusk', 'r3'], ['night', 'r4']]) CASES.push({ kind: 'race', tier, preset, rival });
CASES.push({ kind: 'title', tier: 'high' }, { kind: 'garage', tier: 'high' });
if (process.env.ONLY) CASES.splice(0, CASES.length, ...CASES.filter(c => process.env.ONLY.split(',').includes(c.kind)));   // ONLY=garage,title: those cases alone
const KEEP = process.env.KEEP || null;   // a folder: each side's frames kept there as PNG

async function frames(dir) {
  const R = await import(pathToFileURL(path.join(dir, 'game/test/garage/lib.js')).href + '?' + path.basename(dir));
  const env = await R.start(), out = {};
  for (const c of CASES) {
    const pg = await R.openPage(env, { width: 640, height: 360 }, 'tier=' + c.tier + '&adapt=0&title=1');
    const png = await pg.page.evaluate(async c => {
      const L = window.__loop, F = window.__feel;
      try { localStorage.clear(); } catch (e) {}
      L.save.reset(); L.save.setOnboarded();
      F.draw = false; window.__clock = 1e7;   // far past the boot's own frame, so the first step is clamped the same on both sides however fast the page loaded (from 1000, a page ready inside a second turned the showroom's table by a step of its own)
      if (c.kind === 'race') { L.startRun({ ...L.battleSpec(c.rival), preset: c.preset }); L.skipCountdown(); F.setDriver({ player: 'mixed' }); }
      else if (c.kind === 'garage') { L.action('garage'); }
      else L.action('title');
      return null;
    }, c);
    await pg.page.evaluate(seed => { let s = seed; Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }, 7);
    await pg.page.evaluate(({ n }) => { const F = window.__feel; for (let k = 0; k < n; k++) { window.__clock += 1000 / 60; F.frame(window.__clock); } }, { n: c.kind === 'race' ? STEP : 30 });
    await pg.page.evaluate(() => { document.getElementById('ui').style.visibility = 'hidden'; const v = document.getElementById('vignette'); if (v) v.style.display = 'none'; const F = window.__feel, L = window.__loop; F.draw = true; const draw = () => L.app.state === 'garage' ? L.showroom.render() : F.scene.render(); draw(); draw(); F.draw = false; return new Promise(r => setTimeout(r, 80)); });
    const key = c.kind + ' ' + c.tier + (c.preset ? ' ' + c.preset : '');
    out[key] = await pg.page.screenshot({ timeout: 180000 });
    if (KEEP) fs.writeFileSync(path.join(KEEP, key.replace(/ /g, '-') + '-' + (dir === root ? 'branch' : 'main') + '.png'), out[key]);
    if (pg.errors.length) console.log('page errors (' + c.kind + '): ' + pg.errors.slice(0, 2).join(' | '));
    await pg.close();
  }
  await env.close();
  return { out, R };
}
const main = await frames(path.join(tmp, 'crazygames')), mine = await frames(root);
const R = mine.R, report = {};
let failed = 0; const say = (ok, t) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + t); return ok; };
for (const k of Object.keys(main.out)) {
  const A = await R.decode(main.out[k]), B = await R.decode(mine.out[k]), d = R.diffMask(A, B, 0);
  /* a frame worth comparing: not one flat colour (two blank frames would agree) */
  const lum = []; for (let i = 0; i < B.d.length; i += 4 * 97) lum.push(R.lumOf(B.d[i], B.d[i + 1], B.d[i + 2]));
  const spread = R.pct(lum, 0.95) - R.pct(lum, 0.05);
  report[k] = { pixels: A.w * A.h, differ: d.n, spread: +spread.toFixed(3) };
  say(d.n === 0 && spread > 0.1, k + ': main (' + commit + ') and this branch without ?look=2, ' + A.w + 'x' + A.h + ': ' + d.n + ' pixels differ (the frame is a picture, not blank: brightness 5th to 95th centile spans ' + spread.toFixed(2) + ')');
}
/* the known answer: one pixel of one frame moved by one level */
const k0 = Object.keys(mine.out)[0], A = await R.decode(main.out[k0]), B = await R.decode(mine.out[k0]);
B.d[(B.w * 100 + 200) * 4] = (B.d[(B.w * 100 + 200) * 4] + 1) % 256;
const kd = R.diffMask(A, B, 0);
say(kd.n === 1, 'known answer: one pixel of "' + k0 + '" changed by one level: ' + kd.n + ' pixel caught');
fs.mkdirSync(path.join(root, 'review', 'look'), { recursive: true });
fs.writeFileSync(path.join(root, 'review', 'look', 'switch.json'), JSON.stringify({ main: commit, step: STEP, size: '640x360', cases: report }, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
