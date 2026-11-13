/* GARAGE MEASURE 3: THE READABILITY RULE WITH THE GLOW ON. In every
   preset, on one tier, mid slide on two career tracks at 844x390, with
   each glow colour in turn.

   The edge is sampled as the visuals probe samples it
   (game/test/visuals/probes.js): the edge line's own geometry 4 to 40 m
   ahead of the car, both sides, the brightest pixel within three of
   each point, and the asphalt 1.9 m inside each; the median over the
   points. The glow is every pixel the glow changed: the same frame is
   drawn with it and without it (Math.random is seeded, so the two
   differ only by the glow), and the pixels that differ are the light.
   Its 99th percentile is judged, so a few bright pixels cannot hide
   and one cannot fail it.

   THE BARS.
   1. Brighter: the edge's luminance is over the luminance of the road
      under the glow. This is the rule as the visuals probe measures it.
   2. The stronger light: what the glow adds to the road in its
      strongest channel is less than the edge stands over the asphalt
      beside it in its strongest channel, by MARGIN. Luminance alone
      cannot judge a magenta or a violet, which are dim to it at any
      strength; this can.
   3. Visible by day: at dawn the glow changes at least SEEN pixels by
      more than 12 levels.
   AS THE BRIEF WORDS IT ("never more saturated than the road edge"):
   reported, not a bar, because no coloured light can meet it: the edge
   is a pale yellow that draws nearly white (its colour, the largest
   channel less the smallest, is 0.08 to 0.15 of full), and the frame
   with no glow at all already holds kerbs, walls, tail-lights and the
   car's own paint several times more colourful. Both numbers are in
   every line and in the json.

   Known answer: every glow at FIVE times its strength at night must
   fail a bar.

   node game/test/garage/readable.js [low|high]   writes review/garage/readable-<tier>.json and shots */
import path from 'node:path';
import fs from 'node:fs';
import * as G from './lib.js';

const tier = process.argv[2] === 'high' ? 'high' : 'low';
const PRESETS = ['night', 'dusk', 'dawn', 'rain'], GLOWS = ['aqua', 'lime', 'amber', 'magenta', 'violet'];
const SEEN = 150, MARGIN = 1.15, TRACKS = [0, 4], VP = { width: 844, height: 390 };
const env = await G.start(), out = { tier, viewport: VP, rows: [], known: [] };

/* the edge line's points on the screen, 4 to 40 m ahead of the car, each with the asphalt 1.9 m inside it, read off the page */
const EDGE = `(() => {
  const F = window.__feel, A = window.__loop.app, C = A.ground.centre, cam = F.scene.camera, THREE = F.scene.THREE, v = new THREE.Vector3(), pts = [];
  cam.updateMatrixWorld();
  const n = C.length, i0 = Math.round(F.world.along / 2);
  const at = (c, u) => { const lx = -Math.cos(c.heading), lz = Math.sin(c.heading); v.set(c.x + lx * u, (c.y || 0) - u * Math.tan(c.bank || 0) + 0.02, c.z + lz * u).project(cam); return v.z < 1 && Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98 ? [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight] : null; };
  for (let m = 4; m <= 40; m += 2) {
    const c = C[(i0 + Math.round(m / 2)) % n], hw = c.width / 2;
    for (const sgn of [1, -1]) { const e = at(c, sgn * (hw - 0.7)), r = at(c, sgn * (hw - 2.6)); if (e && r) pts.push([e[0], e[1], r[0], r[1]]); }
  }
  return pts;
})()`;

function edgeOf(img, pts, scale) {
  const lum = [], chroma = [], over = [];
  for (const [px, py, rx, ry] of pts) {
    let best = null;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = Math.round(px * scale) + dx, y = Math.round(py * scale) + dy;
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      const o = (y * img.w + x) * 4, l = G.lumOf(img.d[o], img.d[o + 1], img.d[o + 2]);
      if (!best || l > best.l) best = { l, r: img.d[o], g: img.d[o + 1], b: img.d[o + 2] };
    }
    if (!best) continue;
    const o = (Math.min(img.h - 1, Math.max(0, Math.round(ry * scale))) * img.w + Math.min(img.w - 1, Math.max(0, Math.round(rx * scale)))) * 4;
    lum.push(best.l); chroma.push(G.chromaOf(best.r, best.g, best.b));
    over.push((Math.max(best.r, best.g, best.b) - Math.max(img.d[o], img.d[o + 1], img.d[o + 2])) / 255);
  }
  return { samples: lum.length, lum: +G.pct(lum, 0.5).toFixed(3), chroma: +G.pct(chroma, 0.5).toFixed(3), overRoad: +G.pct(over, 0.5).toFixed(3) };
}
/* the most colourful half per cent of a picture */
function colourOf(img) { const c = []; for (let i = 0; i < img.d.length; i += 16) c.push(G.chromaOf(img.d[i], img.d[i + 1], img.d[i + 2])); return +G.pct(c, 0.995).toFixed(3); }
function glowOf(on, off) {
  const mask = G.diffMask(on, off, 3), lum = [], chroma = [], add = [];
  let seen = 0;
  for (let p = 0, i = 0; p < mask.m.length; p++, i += 4) {
    if (!mask.m[p]) continue;
    const r = on.d[i], g = on.d[i + 1], b = on.d[i + 2], most = Math.max(r - off.d[i], g - off.d[i + 1], b - off.d[i + 2]);
    lum.push(G.lumOf(r, g, b)); chroma.push(G.chromaOf(r, g, b)); add.push(most / 255);
    if (Math.max(Math.abs(r - off.d[i]), Math.abs(g - off.d[i + 1]), Math.abs(b - off.d[i + 2])) > 12) seen++;
  }
  return { pixels: mask.n, seen, lum: +G.pct(lum, 0.99).toFixed(3), chroma: +G.pct(chroma, 0.99).toFixed(3), adds: +G.pct(add, 0.99).toFixed(3), box: mask.box };
}

let asWorded = 0, rows = 0;
for (const preset of PRESETS) {
  const pg = await G.page(env, VP, 'tier=' + tier + '&preset=' + preset + '&adapt=0'), page = pg.page;
  await G.hud(page, false);
  for (const index of TRACKS) {
    const frame = async (glow, boost) => {
      await G.wear(page, { glow });
      const m = await G.midSlide(page, index, 2, 16);
      if (boost) await page.evaluate(k => { window.__feel.scene.carModel().underglow.material.color.multiplyScalar(k); }, boost);
      const png = await G.shot(page, path.join(G.shots, 'readable-' + tier + '-' + preset + '-' + index + '-' + (glow || 'off') + (boost ? '-x' + boost : '') + '.png'));
      return { m, img: await G.decode(png), pts: await page.evaluate(EDGE) };
    };
    const off = await frame('off');
    if (!off.m) { G.say(false, tier + ' ' + preset + ' career ' + (index + 1) + ': no slide found'); continue; }
    const scale = off.img.w / VP.width, already = colourOf(off.img), tag = tier + ' ' + preset + ' career ' + (index + 1) + ' ';
    for (const glow of GLOWS) {
      const on = await frame(glow);
      const e = edgeOf(on.img, on.pts, scale), g = glowOf(on.img, off.img);
      const row = { preset, index, glow, edge: e, glow_: g, alreadyOnScreen: already, brighter: e.lum > g.lum, stronger: e.overRoad >= g.adds * MARGIN, asWorded: e.chroma > g.chroma, visible: g.seen >= SEEN };
      out.rows.push(row); rows++; if (row.asWorded) asWorded++;
      G.say(row.brighter && row.stronger && e.samples >= 8 && g.pixels > 0, tag + glow + ': edge luminance ' + e.lum + ' over the glow\'s ' + g.lum + '; the edge stands ' + e.overRoad + ' over the asphalt, the glow adds ' + g.adds + ' (x' + (e.overRoad / Math.max(0.001, g.adds)).toFixed(2) + ', bar ' + MARGIN + '); as worded: edge colour ' + e.chroma + ', glow ' + g.chroma + ', the frame without it ' + already + ' (' + e.samples + ' edge points, ' + g.pixels + ' glow pixels)');
      if (preset === 'dawn') G.say(row.visible, tag + glow + ' is visible by day: ' + g.seen + ' pixels changed by more than 12 levels (bar ' + SEEN + ')');
      if (preset === 'night') {
        const hot = await frame(glow, 5), eh = edgeOf(hot.img, hot.pts, scale), gh = glowOf(hot.img, off.img), caught = !(eh.lum > gh.lum && eh.overRoad >= gh.adds * MARGIN);
        out.known.push({ index, glow, edge: eh, glow_: gh, caught });
        G.say(caught, tag + glow + ' known answer: at five times its strength it fails (luminance ' + gh.lum + ' against the edge\'s ' + eh.lum + ', adds ' + gh.adds + ' against ' + eh.overRoad + '): ' + (caught ? 'CAUGHT' : 'MISSED'));
      }
    }
  }
  if (pg.errors.length) { G.say(false, 'page errors: ' + pg.errors.slice(0, 2).join(' | ')); }
  await pg.close();
}
out.asWorded = { met: asWorded, of: rows };
console.log('AS THE BRIEF WORDS IT (the glow never more colourful than the edge): met in ' + asWorded + ' of ' + rows + '. Not a bar here; see the head of this file.');
fs.writeFileSync(path.join(G.dir, 'readable-' + tier + '.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(G.failed() ? G.failed() + ' failed' : 'all passed');
process.exit(G.failed() ? 1 : 0);
