/* THE COVER PAIR (briefs/COVER-LOOK.md, measure 2): the game's own frame
   at the cover's angle beside the cover art, for the author's eye. The
   frame is made as game/test/brand/capture.js makes the covers' and the
   reference pictures' (the same race, step and camera as
   brand/reference-shots.json's "action-night", which was set up to
   match the key art): a race against Varsk on Upper deck stopped at
   step 651, the drift build in amber on tri-blades with the violet
   glow, every upgrade, the player driven by the look-ahead driver with
   Sarrow's driving, then seen from the cover's camera, on the high tier.
   Two sides: before the round (no switch, at night: the floodlit preset
   main has, the reference picture's) and with ?look=2 at the cover's
   floodlit dusk. No number stands in for the eye.

   node game/test/look/cover.js [--sides before,after] [--dpr 1|2] [--out dir] [--cam d,up,bearing,fov,ty,side] [--preset name] [--step N]
   writes review/look/cover-<side>.png (the frame) and review/look/cover-pair.png
   (the cover over the frame with the switch), cover-pair-before.png (over the one without) */
import path from 'node:path'; import fs from 'node:fs';
import * as R from '../garage/lib.js';
const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const sides = arg('--sides', 'before,after').split(','), dpr = +arg('--dpr', 1), out = arg('--out', path.join(R.root, 'review', 'look'));
fs.mkdirSync(out, { recursive: true });
const REF = JSON.parse(fs.readFileSync(path.join(R.root, 'game', 'test', 'brand', 'reference-shots.json'), 'utf8'))['action-night'];
export const SHOT = { ...REF, cam: args.includes('--cam') ? arg('--cam').split(',').map(Number) : REF.cams.landscape, step: +arg('--step', REF.step) };
const SIDE = { before: { query: '', preset: arg('--preset', 'night') }, after: { query: '&look=2', preset: arg('--preset', 'twilight') } };
const W = 1920, H = 1080;

const env = await R.start();
const frames = {};
for (const side of sides) {
  const S = SIDE[side];
  const context = await env.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.addInitScript(`(function () { window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {}; })();`);
  await page.goto(env.url + '?renderer=webgl2&tier=high&adapt=0&title=1' + S.query, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.evaluate(({ shot, preset }) => {
    try { localStorage.clear(); } catch (e) {}
    const L = window.__loop, Sv = L.save; Sv.reset(); Sv.setOnboarded();
    const [wheels, glow, smoke] = shot.look;
    Sv.state.cars[shot.car] = { paint: shot.paint, up: { power: 3, grip: 3, steer: 3 }, wheels, glow, smoke, own: { wheels: [wheels], glow: [glow], smoke: [smoke] } };
    Sv.state.car = shot.car;
    window.__feel.draw = false;
    L.startRun({ ...L.battleSpec(shot.rival), preset }); L.skipCountdown();
    window.__feel.setDriver({ player: 'slide', drive: L.RIVALS.find(r => r.id === shot.hands).drive });
    document.getElementById('ui').style.visibility = 'hidden';
    const v = document.getElementById('vignette'); if (v) v.style.display = 'none';
  }, { shot: SHOT, preset: S.preset });
  await R.seedRandom(page, 7);
  await page.evaluate(({ to, mult }) => {
    const F = window.__feel, s = F.scoring.state;
    window.__clock = 1000;
    for (let k = 0; k < to; k++) { window.__clock += 1000 / 60; if (s.chain > 0) s.driftTime = Math.max(s.driftTime, (mult - 1) * 1.2 + 0.05); F.frame(window.__clock); }
  }, { to: SHOT.step, mult: SHOT.mult || 4 });
  await page.evaluate(({ cam }) => {
    const [dist, up, bearing, fov, ty = 0.55, sd = 0] = cam;
    const F = window.__feel, S = F.scene, c = S.camera, p = F.pose, T = S.THREE;
    S.resize(innerWidth, innerHeight);
    const yaw = (p.yaw || 0) + bearing * Math.PI / 180, y0 = p.y || 0;
    c.position.set(p.x + Math.sin(yaw) * dist, y0 + up, p.z + Math.cos(yaw) * dist);
    c.up.set(0, 1, 0); c.fov = fov; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix();
    c.lookAt(new T.Vector3(p.x + Math.sin(yaw + Math.PI / 2) * sd, y0 + ty, p.z + Math.cos(yaw + Math.PI / 2) * sd)); c.updateMatrixWorld();
    F.draw = true; S.render(); S.render(); F.draw = false;
  }, { cam: SHOT.cam });
  await page.waitForTimeout(400);
  const file = path.join(out, 'cover-' + side + '.png');
  frames[side] = await page.screenshot({ path: file, timeout: 300000 });
  const info = await page.evaluate(() => window.__feel.scene.info());
  console.log('wrote ' + path.relative(R.root, file) + ' ' + JSON.stringify({ preset: info.preset, tier: info.tier, drawCalls: info.drawCalls }) + (errors.length ? ' ERRORS ' + errors.slice(0, 3).join(' | ') : ''));
  await context.close();
}
/* the pairs: the cover over the frame, each 1920 wide, for a phone's portrait */
const art = fs.readFileSync(path.join(R.root, 'brand', 'art', 'hero-landscape.jpg'));
const page = await (await env.browser.newContext({ viewport: { width: W, height: H * 2 }, deviceScaleFactor: 1 })).newPage();
for (const side of Object.keys(frames)) {
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:#000}img{display:block;width:${W}px;height:${H}px;object-fit:cover}</style><img src="data:image/jpeg;base64,${art.toString('base64')}"><img src="data:image/png;base64,${frames[side].toString('base64')}">`);
  await page.waitForTimeout(200);
  const file = path.join(out, side === 'after' ? 'cover-pair.png' : 'cover-pair-' + side + '.png');
  await page.screenshot({ path: file });
  console.log('wrote ' + path.relative(R.root, file));
}
await env.close();
