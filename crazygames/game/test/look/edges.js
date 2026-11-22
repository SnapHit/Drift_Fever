/* CLEAN EDGES (briefs/COVER-LOOK.md, measure 5): a straight, high
   contrast edge at 1280x720 on the low tier, and the count of stair
   steps along it. The edge is the road's right hand edge line against
   the asphalt on a straight, the left hand line, from the road's side (the painted line is the longest straight
   high contrast edge in a race frame; a kerb is striped across its
   length, so its edge is short runs). Row by row up the lower part of
   the frame, the boundary is found where the brightness first crosses
   halfway from the asphalt to the paint; a row is a stair step when
   the boundary is hard: the one pixel step there carries at least 80
   per cent of the contrast, with no pixel in between. The rows found
   must lie on a straight line (so it is the edge and nothing else).
   The share of rows that are stair steps with ?look=2 must be at most
   half the share on main (no switch, no antialiasing).
   Known answer: ?look=2&aa=0 (the look with the antialiasing off) does
   not halve it, and fails.

   node game/test/look/edges.js   writes review/look/edges.json */
import path from 'node:path';
import * as L from './lib.js';

/* where the edge is: the race and the step, a straight with the line long in the picture */
const AT = { rival: 'r6', to: 150 };

function stairs(img) {
  const { w, h, d } = img, lum = (x, y) => { const k = (y * w + x) * 4; return L.lumOf(d[k], d[k + 1], d[k + 2]); };
  const rows = [];
  for (let y = Math.round(h * 0.45); y < Math.round(h * 0.97); y++) {
    /* the asphalt's level left of the car, and the first bright paint past it going left */
    let x = Math.round(w * 0.38), road = 0, k = 0;
    for (let i = 0; i < 12; i++) { road += lum(x - i, y); k++; } road /= k;
    let hit = -1;
    for (let q = x; q > 2; q--) if (lum(q, y) > road + 0.35) { hit = q; break; }
    if (hit < 0) continue;
    const paint = Math.max(lum(hit, y), lum(hit - 1, y), lum(hit - 2, y)), mid = (road + paint) / 2, contrast = paint - road;
    let b = hit; while (b < x && lum(b + 1, y) > mid) b++;
    const step = lum(b, y) - lum(b + 1, y);
    rows.push({ y, x: b, hard: step >= 0.8 * contrast, contrast });
  }
  /* the rows on a straight line: a least squares fit, trimmed and fitted again (a row that found the barrier or the car is an outlier), and only the rows within 1.5 px of the last fit */
  const fit = list => { const n = list.length, sx = list.reduce((s, r) => s + r.y, 0), sy = list.reduce((s, r) => s + r.x, 0), sxx = list.reduce((s, r) => s + r.y * r.y, 0), sxy = list.reduce((s, r) => s + r.y * r.x, 0); const m = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx); return { m, c: (sy - m * sx) / Math.max(1, n) }; };
  const n = rows.length;
  let line = fit(rows), keep = rows;
  for (const tol of [24, 8, 3]) { keep = keep.filter(r => Math.abs(r.x - (line.m * r.y + line.c)) <= tol); if (keep.length < 10) break; line = fit(keep); }
  const slope = line.m;
  const on = rows.filter(r => Math.abs(r.x - (line.m * r.y + line.c)) <= 1.5);
  return { rows: n, onLine: on.length, slope: +slope.toFixed(3), hard: on.filter(r => r.hard).length, share: on.length ? +(on.filter(r => r.hard).length / on.length).toFixed(3) : 1, contrast: on.length ? +(on.reduce((s, r) => s + r.contrast, 0) / on.length).toFixed(3) : 0 };
}

async function measure(env, query, name) {
  const pg = await L.page(env, L.LAND, 'tier=low' + query);
  await L.dress(pg.page, L.STARTER);
  await L.raceTo(pg.page, AT);
  await L.hud(pg.page, false);
  const png = await L.snap(pg.page, path.join(L.lookShots, 'edges-' + name + '.png'));
  await pg.close();
  return stairs(await L.decode(png));
}

const env = await L.start();
const main = await measure(env, '', 'main'), look = await measure(env, '&look=2', 'look'), off = await measure(env, '&look=2&aa=0', 'look-aa-off');
const ok = r => r.onLine >= 60;
L.say(ok(main) && ok(look), 'the edge found: ' + main.onLine + ' rows on a straight line on main, ' + look.onLine + ' with the look (at least 60 each)');
L.say(look.share <= main.share / 2, 'with ?look=2 ' + look.hard + ' of ' + look.onLine + ' rows are stair steps (' + (look.share * 100).toFixed(0) + ' per cent), on main ' + main.hard + ' of ' + main.onLine + ' (' + (main.share * 100).toFixed(0) + ' per cent): ' + (look.share <= main.share / 2 ? 'at most half' : 'NOT halved'));
L.say(!(off.share <= main.share / 2), 'known answer: the look with the antialiasing off has ' + (off.share * 100).toFixed(0) + ' per cent stair steps: ' + (off.share <= main.share / 2 ? 'MISSED' : 'CAUGHT, not halved'));
L.writeJson(path.join(L.lookDir, 'edges.json'), { main, look, lookAaOff: off, at: AT, size: '1280x720', tier: 'low' });
await env.close();
console.log(L.failed() ? L.failed() + ' failed' : 'all passed');
process.exit(L.failed() ? 1 : 0);
