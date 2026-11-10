/* SPECTACLE MEASURE 2: NIGHT READS. The road and its edge 20, 40 and 80
   m ahead of the car, at night against dusk, at both tiers, with the
   round on and with ?fx=0 (the game as it is on main).

   The same moments of the same run (the scripted drifter on career 1
   and career 3, four moments each at speed), each drawn at dusk and at
   night (scene.setLook keeps the car where it is). At each distance,
   points within 2 m of it along the track, both sides, are projected
   from the track's own geometry into the screenshot, as the visuals
   probe does (game/test/visuals/probes.js): the edge line (the
   brightest pixel within two of its point) and the asphalt 2.6 m inside
   the edge (a three pixel mean); points behind a barrier, a crest or
   off the screen are skipped.

   THE BAR, set before measuring, against dusk at the same moment and
   tier, at every distance:
   - the road itself reads: its luminance at night is at least
     ROAD_SHARE of dusk's (a black road shows no marks, no rubber, no
     grid and no shape between its edges);
   - the edge reads on it: edge over road at least EDGE_OVER (the
     readability margin of the visuals probe);
   - the edge is as visible as at dusk: its luminance at least
     EDGE_SHARE of dusk's.
   Known answer: night with ?fx=0 (main) must fail it.

   node game/test/spectacle/night.js
   Writes review/spectacle/night.json and shots/night-*.png. */
import path from 'node:path';
import * as S from './lib.js';

export const BAR = { ROAD_SHARE: 0.6, EDGE_OVER: 1.35, EDGE_SHARE: 0.6, DISTANCES: [20, 40, 80], WINDOW: 2, MIN_SAMPLES: 3 };
const TRACKS = [0, 2], MOMENTS = [6, 20, 34, 48];   // career index; seconds into the drive
const VP = S.LANDSCAPE;

const PROJECT = `
  const sc = F.scene, w = F.world, T = w.ground, C = T.centre, n = C.length, cam = sc.camera;
  cam.updateMatrixWorld(); const THREE = sc.THREE, v = new THREE.Vector3();
  const W = extra.w, H = extra.h, hudTop = 0.14 * H;
  const solid = []; sc.scene.traverse(o => { if (o.isMesh && /^(wall|clip|barriers|bridge|ramp|cut|road|kerb|runoff)$/.test(o.name)) solid.push(o); });
  const ray = new THREE.Raycaster(), to = new THREE.Vector3();
  const hidden = (x, y, z) => { to.set(x, y + 0.15, z).sub(cam.position); const d = to.length(); ray.set(cam.position, to.normalize()); ray.far = d - 1.0; return ray.intersectObjects(solid, false).length > 0; };
  const out = {};
  for (const d of extra.distances) {
    out[d] = [];
    for (let a = d - extra.window; a <= d + extra.window; a += 1) {
      const raw = Math.round((w.along + a) / 2);
      if (T.kind !== 'circuit' && raw >= n) break;
      const i = (raw % n + n) % n, c = C[i], lx = -Math.cos(c.heading), lz = Math.sin(c.heading), hw = c.width / 2;
      const cy = u => (c.y || 0) - Math.max(-hw, Math.min(hw, u)) * Math.tan(c.bank || 0);
      for (const sgn of [1, -1]) {
        const set = { edge: [sgn * (hw - 0.7), cy(sgn * (hw - 0.7)) + 0.02], road: [sgn * (hw - 2.6), cy(sgn * (hw - 2.6))] };
        if (hidden(c.x + lx * set.edge[0], set.edge[1], c.z + lz * set.edge[0]) || hidden(c.x + lx * set.road[0], set.road[1], c.z + lz * set.road[0])) continue;
        const row = {}; let ok = true;
        for (const k of Object.keys(set)) {
          const [u, y] = set[k];
          v.set(c.x + lx * u, y, c.z + lz * u).project(cam);
          if (v.z > 1 || v.z < -1) { ok = false; break; }
          const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
          if (px < 3 || px > W - 4 || py < hudTop || py > H - 4) { ok = false; break; }
          row[k] = [Math.round(px), Math.round(py)];
        }
        if (ok) out[d].push(row);
      }
    }
  }
  return out;
`;
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

async function read(page, png, pts) {
  const rects = [];
  for (const d of Object.keys(pts)) for (const p of pts[d]) {
    rects.push({ x0: p.edge[0] - 2, y0: p.edge[1] - 2, x1: p.edge[0] + 2, y1: p.edge[1] + 2 });
    rects.push({ x0: p.road[0] - 1, y0: p.road[1] - 1, x1: p.road[0] + 1, y1: p.road[1] + 1 });
  }
  const r = await S.readRects(page, png, rects);
  const res = {}; let k = 0;
  for (const d of Object.keys(pts)) {
    const e = [], ro = [];
    for (let j = 0; j < pts[d].length; j++) { e.push(r[k++].max); ro.push(r[k++].mean); }
    res[d] = { n: e.length, edge: +median(e).toFixed(4), road: +median(ro).toFixed(4) };
  }
  return res;
}

const env = await S.start();
const out = { bar: BAR, note: 'headless Chromium, forced WebGL 2 on SwiftShader, 1280x720; luminance 0 to 1 from the screenshot', runs: [] };
const quick = process.argv.includes('--quick');   // iterating: the low tier with the round on only
for (const tier of quick ? ['low'] : ['low', 'high']) for (const fx of quick ? ['on'] : ['on', '0']) for (const index of TRACKS) {
  const pg = await S.page(env, VP, 'tier=' + tier + (fx === '0' ? '&fx=0' : ''));
  const p = pg.page;
  await S.careerRun(p, index);
  await S.until(p, "f.state==='drive'", 400);
  let t = 0;
  for (const at of MOMENTS) {
    await S.runFrames(p, Math.max(1, Math.round((at - t) * 60)));
    t = at;
    await S.until(p, 'f.v > 15', 600, 1);
    const row = { tier, fx, track: index, at };
    for (const preset of ['dusk', 'night']) {
      await p.evaluate(pr => { window.__feel.scene.setLook({ preset: pr }); }, preset);
      const file = path.join(S.shotsDir, 'night-' + tier + '-fx' + fx + '-c' + (index + 1) + '-' + at + 's-' + preset + '.png');
      const png = await S.shot(p, file);
      const pts = await p.evaluate(({ src, extra }) => new Function('F', 'i', 'extra', src)(window.__feel, 0, extra), { src: PROJECT, extra: { w: VP.width, h: VP.height, distances: BAR.DISTANCES, window: BAR.WINDOW } });
      row[preset] = await read(p, png, pts);
      if (at !== MOMENTS[0]) await import('node:fs').then(fs => fs.unlinkSync(file));   // keep one moment's frames per run
    }
    /* the verdict at each distance */
    row.pass = true; row.why = [];
    for (const d of BAR.DISTANCES) {
      const N = row.night[d], D = row.dusk[d];
      if (N.n < BAR.MIN_SAMPLES || D.n < BAR.MIN_SAMPLES) { row.why.push(d + ' m: too few samples (' + N.n + ', ' + D.n + ')'); continue; }
      const roadOk = N.road >= BAR.ROAD_SHARE * D.road, overOk = N.edge / Math.max(1e-4, N.road) >= BAR.EDGE_OVER, edgeOk = N.edge >= BAR.EDGE_SHARE * D.edge;
      if (!(roadOk && overOk && edgeOk)) { row.pass = false; row.why.push(d + ' m: ' + (!roadOk ? 'road ' + N.road + ' under ' + BAR.ROAD_SHARE + ' of dusk ' + D.road + '; ' : '') + (!overOk ? 'edge over road ' + (N.edge / Math.max(1e-4, N.road)).toFixed(2) + '; ' : '') + (!edgeOk ? 'edge ' + N.edge + ' under ' + BAR.EDGE_SHARE + ' of dusk ' + D.edge : '')); }
    }
    out.runs.push(row);
    console.log('  ' + tier + ' fx=' + fx + ' career ' + (index + 1) + ' at ' + at + ' s: ' + BAR.DISTANCES.map(d => d + ' m night road ' + row.night[d].road + ' edge ' + row.night[d].edge + ' / dusk road ' + row.dusk[d].road + ' edge ' + row.dusk[d].edge + ' (' + row.night[d].n + ')').join('; ') + (row.pass ? '' : '  FAIL ' + row.why.join(' | ')));
  }
  await pg.close();
}
for (const tier of ['low', 'high']) {
  const on = out.runs.filter(r => r.tier === tier && r.fx === 'on'), off = out.runs.filter(r => r.tier === tier && r.fx === '0');
  const ratio = (rows, d, k) => median(rows.map(r => r.night[d][k] / Math.max(1e-4, r.dusk[d][k])));
  S.verdict(on.every(r => r.pass), tier + ' tier, round on: night reads at 20, 40 and 80 m in ' + on.filter(r => r.pass).length + ' of ' + on.length + ' moments; night road over dusk road (median) ' + BAR.DISTANCES.map(d => d + ' m ' + ratio(on, d, 'road').toFixed(2)).join(', ') + '; edge ' + BAR.DISTANCES.map(d => ratio(on, d, 'edge').toFixed(2)).join(', '));
  S.verdict(off.some(r => !r.pass), tier + ' tier, known answer: night with ?fx=0 (main) fails the bar in ' + off.filter(r => !r.pass).length + ' of ' + off.length + ' moments; night road over dusk road (median) ' + BAR.DISTANCES.map(d => d + ' m ' + ratio(off, d, 'road').toFixed(2)).join(', ') + ': ' + (off.some(r => !r.pass) ? 'CAUGHT' : 'MISSED'));
}
S.writeJson(path.join(S.reviewDir, 'night.json'), out);
await env.close();
console.log(S.failures() ? S.failures() + ' failed' : 'all passed');
process.exit(S.failures() ? 1 : 0);
