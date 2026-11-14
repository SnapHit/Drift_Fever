/* A PLAN OF THE PARK for the review: the game's own scene seen from
   straight above, by day, with the lines the scripted hands were asked
   to drive laid over it (lines.js), each in its challenge's colour.
   Not a measure: a picture.
   node game/test/park/plan.js   writes review/park/shots/plan.png */
import path from 'node:path';
import * as P from './lib.js';

const env = await P.start();
const pg = await P.parkPage(env, { width: 1200, height: 820 }, 'preset=dawn&fx=none'), page = pg.page;
await page.evaluate(() => { window.__feel.draw = false; window.__loop.save.setParkSeen(); window.__loop.action('free'); });
await P.runFrames(page, 5);
const lines = await page.evaluate(() => {
  const F = window.__feel, sc = F.scene, cam = sc.camera, R = window.__hands, T = sc.THREE;
  document.getElementById('ui').style.visibility = 'hidden';
  sc.scene.fog.near = 5000; sc.scene.fog.far = 9000;
  cam.fov = 38; cam.aspect = 1200 / 820; cam.near = 1; cam.far = 2000; cam.position.set(0, 330, 0.01); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  sc.render();
  const v = new T.Vector3(), px = p => { v.set(p.x, 0, p.z).project(cam); return [Math.round((v.x * 0.5 + 0.5) * 1200), Math.round((-v.y * 0.5 + 0.5) * 820)]; };
  const L = R.lines, sets = { donut: L.donut(2), eight: L.eight(3), slalom: L.slalom(5.5, 4), wall: L.wall(1.2), gate: L.gate(true, { off: -3, lead: 16, dir: -1 }).path, open: L.open(1.5), tour: L.tour() };
  return Object.fromEntries(Object.entries(sets).map(([k, pts]) => [k, pts.filter((_, i) => i % 3 === 0).map(px)]));
});
await page.evaluate(lines => {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 820; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99;pointer-events:none';
  const g = c.getContext('2d'), col = { donut: '#19d8ff', eight: '#ff2d8a', slalom: '#ffd34d', wall: '#ff8a3c', gate: '#9be31c', open: '#ffffff', tour: '#c9a0ff' };
  g.lineWidth = 2; g.font = '700 15px system-ui, sans-serif';
  let y = 24;
  for (const k of Object.keys(lines)) { g.strokeStyle = col[k]; g.globalAlpha = 0.9; g.beginPath(); lines[k].forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.fillStyle = col[k]; g.fillText(({ open: 'slide and chain', gate: 'gate (long run)' })[k] || k, 16, y); y += 20; }
  document.body.appendChild(c);
}, lines);
await new Promise(r => setTimeout(r, 300));
await page.screenshot({ path: path.join(P.shots, 'plan.png'), timeout: 180000 });
await env.close();
console.log('review/park/shots/plan.png');
