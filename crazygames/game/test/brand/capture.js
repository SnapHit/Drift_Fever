/* THE COVER ART'S BACKGROUNDS (15 November 2026): frames of the game
   itself, drawn by its own renderer on the high tier, from a camera put
   where a photographer would stand. No image here is made by anything
   but the game: a race against Varsk on Upper deck, the player's car
   driven by the look-ahead driver with a player's hands, stopped at one
   step (the run is deterministic, so every frame can be made again),
   then looked at from a set of cameras, one per shape of cover.

   CrazyGames asks for three covers (docs.crazygames.com/requirements/
   game-covers, read 15 November 2026): 1920x1080, 800x1200 and 800x800;
   the share card is 1200x630. Each is drawn at twice its size and
   scaled down by compose.js.

   node game/test/brand/capture.js [--preview] [--only chase,duel] [--out dir] [--shots file.json]
   writes brand/bg/<concept>-<shape>.png (--preview: half the pixels, jpg) */
import path from 'node:path'; import fs from 'node:fs';
import * as R from '../garage/lib.js';
const args = process.argv.slice(2), preview = args.includes('--preview');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(R.root, 'brand', 'bg');
fs.mkdirSync(out, { recursive: true });

export const SHAPES = { landscape: [1920, 1080], portrait: [800, 1200], square: [800, 800], share: [1200, 630] };
/* a camera: metres from the car, metres up, bearing round the car in degrees, field of view, the height it looks at, and metres it looks to one side of the car */
const SHOTS = JSON.parse(fs.readFileSync(args.includes('--shots') ? args[args.indexOf('--shots') + 1] : new URL('./shots.json', import.meta.url), 'utf8'));

const env = await R.start();
for (const [name, shot] of Object.entries(SHOTS)) {
  if (only && !only.includes(name)) continue;
  const context = await env.browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: preview ? 1 : 2 });
  const page = await context.newPage();
  page.on('pageerror', e => console.log('ERR', String(e).slice(0, 300)));
  await page.addInitScript(`(function () { window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {}; })();`);
  await page.goto(env.url + '?renderer=webgl2&tier=high&adapt=0&title=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.evaluate(({ shot }) => {
    try { localStorage.clear(); } catch (e) {}
    const L = window.__loop, S = L.save; S.reset(); S.setOnboarded();
    const [wheels, glow, smoke] = shot.look;
    S.state.cars[shot.car] = { paint: shot.paint, up: { power: 3, grip: 3, steer: 3 }, wheels, glow, smoke, own: { wheels: [wheels], glow: [glow], smoke: [smoke] } };
    S.state.car = shot.car;
    window.__feel.draw = false;
    L.startRun({ ...L.battleSpec(shot.rival), preset: shot.preset }); L.skipCountdown();
    window.__feel.setDriver({ player: 'slide', drive: L.RIVALS.find(r => r.id === shot.hands).drive });
    document.getElementById('ui').style.visibility = 'hidden';
    const v = document.getElementById('vignette'); if (v) v.style.display = 'none';
  }, { shot });
  await R.seedRandom(page, 7);
  await page.evaluate(({ to, mult }) => {
    const F = window.__feel, s = F.scoring.state;
    window.__clock = 1000;
    for (let k = 0; k < to; k++) { window.__clock += 1000 / 60; if (s.chain > 0) s.driftTime = Math.max(s.driftTime, (mult - 1) * 1.2 + 0.05); F.frame(window.__clock); }
  }, { to: shot.step, mult: shot.mult || 4 });
  for (const [shape, cam] of Object.entries(shot.cams)) {
    const [w, h] = SHAPES[shape];
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    await page.evaluate(({ cam }) => {
      const [dist, up, bearing, fov, ty = 0.55, side = 0] = cam;
      const F = window.__feel, S = F.scene, c = S.camera, p = F.pose, T = S.THREE;
      S.resize(innerWidth, innerHeight);
      const yaw = (p.yaw || 0) + bearing * Math.PI / 180, y0 = p.y || 0;
      c.position.set(p.x + Math.sin(yaw) * dist, y0 + up, p.z + Math.cos(yaw) * dist);
      c.up.set(0, 1, 0); c.fov = fov; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix();
      c.lookAt(new T.Vector3(p.x + Math.sin(yaw + Math.PI / 2) * side, y0 + ty, p.z + Math.cos(yaw + Math.PI / 2) * side)); c.updateMatrixWorld();
      F.draw = true; S.render(); F.draw = false;
    }, { cam });
    await page.waitForTimeout(500);
    const file = path.join(out, name + '-' + shape + (preview ? '.jpg' : '.png'));
    await page.screenshot(preview ? { path: file, quality: 85 } : { path: file });
    console.log('wrote ' + path.relative(R.root, file));
  }
  await context.close();
}
await env.close();
