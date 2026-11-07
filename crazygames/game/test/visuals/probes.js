/* THE VISUALS MEASUREMENTS, VISUALS.md "Measure" 1, 3 and 4, each with
   a known answer that can fail, and the screenshot set. (2, nothing
   occludes the road, is occlusion.js, in Node; 5, the existing probes,
   are run as they are.) Runs the shipped page in headless Chromium on
   the forced WebGL 2 path through the dev server, with the scripted
   driver drifting, and writes review/visuals/*.json and shots/.

   node game/test/visuals/probes.js [readability] [perf] [download] [shots]
   (no names: everything)

   1. Readability: in every preset and every theme, in 390x844 and
      1280x720, mid drift, the road edge's luminance against the
      asphalt inside it, the barrier beside it and the ground beyond
      it, read off the screenshot at points projected from the track's
      own geometry 4 to 40 m ahead of the car (the edge as the
      brightest pixel within two of its point, since the line is a few
      pixels wide at distance; the others as a three pixel mean). The
      edge's median must beat the brightest neighbour's median by a
      margin. Known answer: the
      edge painted the theme's ground colour must fail.
   3. Perf: JavaScript time per frame at 1x and 6x CPU throttle at
      390x844 on a generated circuit, low tier and high tier, with the
      draw calls and triangles the renderer counts. Known answer: 20 ms
      of busy work per frame flips the verdict; and one more instanced
      mesh in the scene is one more draw call (two with its shadow).
   4. Download: the initial download tools/build-site.js counts, and an
      independent count of the same files. Known answer: a megabyte
      added under game/later/ leaves the initial download unchanged;
      the same megabyte under game/lab/ grows it by a megabyte. */
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as L from '../loop/lib.js';
import { PRESET_NAMES } from '../../src/env/presets.js';
import { THEME_NAMES } from '../../src/env/themes.js';

const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const run = name => want.length === 0 || want.includes(name);
const reviewDir = path.join(L.root, 'review', 'visuals');
const shotsDir = path.join(reviewDir, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });
const started = new Date().toISOString();
const note = 'headless Chromium, forced WebGL 2 on SwiftShader; the GPU half of a frame is not measured here';
const out = {};
let failed = 0;
function verdict(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ': ' + detail : '')); if (!ok) failed++; return ok; }
const RUN_BUDGET = 60 * 300;

export const READ = {
  AHEAD:      [4, 40],    // m ahead of the car the edge is sampled
  STEP:       1,          // m between samples (every metre: samples hidden behind the track are skipped)
  MARGIN:     1.35,       // the edge's median luminance over the brightest neighbour's median, at least
  HUD_TOP:    0.14,       // share of the frame's height under the HUD, not sampled
  BLOCK:      1,          // pixels either side of a sample averaged
  MIN_SAMPLES: 8,
};

/* In the page: project the track's points ahead of the car into pixels. */
const PROJECT = `
  const sc = F.scene, w = F.world, T = w.ground, C = T.centre, n = C.length, cam = sc.camera;
  cam.updateMatrixWorld(); const THREE = sc.THREE, v = new THREE.Vector3();
  const W = extra.w, H = extra.h, hudTop = extra.hudTop * H;
  const pts = [];
  /* a sample whose edge point is hidden behind a barrier, a bridge or an
     embankment nearer the camera is not a sample of the edge: ray cast
     from the camera against the track itself (a crest or a bank hides
     road beyond it too) */
  const solid = []; sc.scene.traverse(o => { if (o.isMesh && /^(wall|clip|barriers|bridge|ramp|cut|road|kerb|runoff)$/.test(o.name)) solid.push(o); });
  const ray = new THREE.Raycaster(), to = new THREE.Vector3();
  /* aimed a little above the line and stopping a metre short, so a ray grazing the road it lies on does not count as hidden */
  const hidden = (x, y, z) => { to.set(x, y + 0.15, z).sub(cam.position); const d = to.length(); ray.set(cam.position, to.normalize()); ray.far = d - 1.0; return ray.intersectObjects(solid, false).length > 0; };
  const wallOff = (i, side) => { const c = C[i], lx = -Math.cos(c.heading), lz = Math.sin(c.heading); const wl = T.walls.find(q => q.side === side && !q.cap); if (!wl || !wl.points[i]) return c.width / 2; const p = wl.points[i]; return Math.abs((p.x - c.x) * lx + (p.z - c.z) * lz); };
  for (let a = extra.from; a <= extra.to; a += extra.step) {
    const i = (Math.round((w.along + a) / 2) % n + n) % n;
    if (T.kind !== 'circuit' && Math.round((w.along + a) / 2) >= n) break;
    const c = C[i], lx = -Math.cos(c.heading), lz = Math.sin(c.heading), hw = c.width / 2;
    for (const sgn of [1, -1]) {
      const wo = wallOff(i, sgn > 0 ? 'left' : 'right');
      /* the edge line is 0.9 m wide, standing 0.25 m in from the road's
         edge (mesh.js EDGE_INSET) where a barrier may stand, so its middle,
         0.7 m in, is sampled; the ground beyond the barrier is sampled where the
         camera sees over the barrier's top (a metre high) */
      const dWall = Math.hypot(c.x + lx * sgn * wo - cam.position.x, c.z + lz * sgn * wo - cam.position.z);
      const over = Math.max(2.5, dWall * 1.0 / Math.max(0.5, cam.position.y - (c.y || 0) - 1.0) + 0.6);
      /* the road's height u metres to the left, as mesh.js lays it: tilted by the bank, level beyond the edge */
      const cy = u => (c.y || 0) - Math.max(-hw, Math.min(hw, u)) * Math.tan(c.bank || 0);
      const set = { edge: [sgn * (hw - 0.7), cy(sgn * (hw - 0.7)) + 0.02], road: [sgn * (hw - 2.6), cy(sgn * (hw - 2.6))], wall: [sgn * wo, cy(sgn * wo) + 0.5], outside: [sgn * (wo + over), cy(sgn * (wo + over))] };
      const row = { along: a, side: sgn };
      let ok = true;
      if (hidden(c.x + lx * set.edge[0], set.edge[1], c.z + lz * set.edge[0])) continue;
      for (const k of Object.keys(set)) {
        const [u, y] = set[k];
        v.set(c.x + lx * u, y, c.z + lz * u).project(cam);
        if (v.z > 1 || v.z < -1) { ok = false; break; }
        const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
        if (px < 2 || px > W - 3 || py < hudTop || py > H - 3) { ok = false; break; }
        row[k] = [Math.round(px), Math.round(py)];
      }
      if (ok) pts.push(row);
    }
  }
  return pts;
`;
/* In the page: decode a screenshot and read pixel blocks. */
async function readPixels(page, pngBase64, points, block) {
  return page.evaluate(async ({ png, points, block }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + png; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const at = (x, y) => { let r = 0, g = 0, b = 0, k = 0; for (let dy = -block; dy <= block; dy++) for (let dx = -block; dx <= block; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= c.width || yy >= c.height) continue; const o = (yy * c.width + xx) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; k++; } return { r: r / k, g: g / k, b: b / k, lum: lum(r / k, g / k, b / k) / 255 }; };
    /* the edge line is a few pixels wide at distance and the sample
       lands within a pixel or two of it: the brightest pixel in a small
       window around the point is the line, if there is one */
    const brightest = (x, y, w) => { let best = null; for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= c.width || yy >= c.height) continue; const o = (yy * c.width + xx) * 4; const l = lum(d[o], d[o + 1], d[o + 2]) / 255; if (!best || l > best.lum) best = { r: d[o], g: d[o + 1], b: d[o + 2], lum: l }; } return best; };
    return points.map(p => ({ along: p.along, side: p.side, edge: brightest(...p.edge, 2), road: at(...p.road), wall: at(...p.wall), outside: at(...p.outside) }));
  }, { png: pngBase64, points, block });
}
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
function summarise(samples) {
  const m = k => +median(samples.map(s => s[k].lum)).toFixed(3);
  const edge = m('edge'), road = m('road'), wall = m('wall'), outside = m('outside');
  const neighbour = Math.max(road, wall, outside);
  const share = samples.length ? samples.filter(s => s.edge.lum > Math.max(s.road.lum, s.wall.lum, s.outside.lum)).length / samples.length : 0;
  return { samples: samples.length, edge, road, wall, outside, ratio: +(edge / Math.max(0.001, neighbour)).toFixed(2), shareEdgeBrightest: +share.toFixed(3) };
}

const env = await L.start();

/* ---- 1. readability, and the screenshot set ---- */
if (run('readability') || run('shots')) {
  console.log('\n== 1. readability' + (run('shots') ? ' and the shots' : ''));
  out.readability = { margin: READ.MARGIN, shots: [], knownAnswer: null };
  let worst = null;
  const themeTrack = { forest: 0, coastal: 1, desert: 2, docks: 3, mountain: 4 };   // career tracks: circuit, sprint, circuit, sprint, circuit
  for (const [vname, vp] of [['1280x720', L.LANDSCAPE], ['390x844', L.PORTRAIT]]) {
    for (const theme of THEME_NAMES) {
      const side = await L.openPage(env, vp, 'auto=1&theme=' + theme + '&preset=dusk', { touch: vp === L.PORTRAIT });
      await side.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); for (let i = 0; i < 6; i++) S.careerResult(i, 1, 1000); });
      await L.beginRun(side.page, 'career', themeTrack[theme]);
      // to a frame mid drift
      /* a frame mid drift where enough of the edge ahead is in view: wide
         roads put the near edges off a portrait screen, and the inside
         barrier of a long corner hides the far ones */
      let best = null;
      for (let tries = 0; tries < 12 && !best; tries++) {
        for (let k = 0; k < 40 && !best; k++) { const fr = await L.runFrames(side.page, 30, L.COLLECT); for (const f of fr) if (f.angle > 25 && f.v > 10 && f.state === 'drive') { best = f; break; } }
        const seen = await side.page.evaluate(({ src, extra }) => new Function('F', 'i', 'extra', src)(window.__feel, 0, extra).length, { src: PROJECT, extra: { w: vp.width, h: vp.height, hudTop: READ.HUD_TOP, from: READ.AHEAD[0], to: READ.AHEAD[1], step: READ.STEP } });
        if (best && seen < READ.MIN_SAMPLES) best = null;
      }
      for (const preset of PRESET_NAMES) {
        await side.page.evaluate(p => { window.__feel.scene.setLook({ preset: p }); window.__feel.draw = true; }, preset);
        await L.runFrames(side.page, 1);
        const file = path.join(shotsDir, theme + '-' + preset + '-' + vname + '.png');
        const png = await side.page.screenshot({ path: file, timeout: 120000 });
        const info = await side.page.evaluate(() => window.__feel.scene.info());
        const points = await side.page.evaluate(({ src, extra }) => new Function('F', 'i', 'extra', src)(window.__feel, 0, extra), { src: PROJECT, extra: { w: vp.width, h: vp.height, hudTop: READ.HUD_TOP, from: READ.AHEAD[0], to: READ.AHEAD[1], step: READ.STEP } });
        const samples = await readPixels(side.page, png.toString('base64'), points, READ.BLOCK);
        const s = summarise(samples);
        const row = { theme, preset: info.preset, viewport: vname, file: path.relative(reviewDir, file), drawCalls: info.drawCalls, triangles: info.triangles, ...s, pass: s.samples >= READ.MIN_SAMPLES && s.ratio >= READ.MARGIN };
        out.readability.shots.push(row);
        if (!worst || row.ratio < worst.ratio) worst = row;
        console.log('  ' + theme + ' ' + preset + ' ' + vname + ': edge ' + s.edge + ' road ' + s.road + ' wall ' + s.wall + ' outside ' + s.outside + ' ratio ' + s.ratio + ' (' + s.samples + ' samples, edge brightest in ' + Math.round(s.shareEdgeBrightest * 100) + '%)');
        await side.page.evaluate(() => { window.__feel.draw = false; });
      }
      /* the known answer, once, on the first page: the edge painted the ground colour */
      if (!out.readability.knownAnswer) {
        const ka = await side.page.evaluate(async () => {
          const mesh = await import('./src/tracks/mesh.js');
          const themes = await import('./src/env/themes.js');
          const style = await import('./src/env/trackstyle.js');
          const before = mesh.LOOK.EDGE;
          /* the edge painted the ground's colour, lit like the ground */
          mesh.LOOK.EDGE = themes.THEMES[window.__feel.scene.info().theme].ground[0];
          style.TRACK_STYLE.EDGE_PAINT = 0x000000;   // and it emits nothing
          window.__feel.scene.setLook({ preset: 'dusk' });
          window.__feel.draw = true;
          return { before, painted: mesh.LOOK.EDGE };
        });
        await L.runFrames(side.page, 1);
        const file = path.join(shotsDir, 'known-answer-edge-' + vname + '.png');
        const png = await side.page.screenshot({ path: file, timeout: 120000 });
        const points = await side.page.evaluate(({ src, extra }) => new Function('F', 'i', 'extra', src)(window.__feel, 0, extra), { src: PROJECT, extra: { w: vp.width, h: vp.height, hudTop: READ.HUD_TOP, from: READ.AHEAD[0], to: READ.AHEAD[1], step: READ.STEP } });
        const s = summarise(await readPixels(side.page, png.toString('base64'), points, READ.BLOCK));
        await side.page.evaluate(async b => { const mesh = await import('./src/tracks/mesh.js'); mesh.LOOK.EDGE = b; window.__feel.scene.setLook({ preset: 'dusk' }); window.__feel.draw = false; }, ka.before);
        out.readability.knownAnswer = { ...ka, viewport: vname, file: path.relative(reviewDir, file), ...s, caught: !(s.samples >= READ.MIN_SAMPLES && s.ratio >= READ.MARGIN) };
        verdict('known answer: the edge painted the ground colour fails the margin', out.readability.knownAnswer.caught, 'ratio ' + s.ratio + ' over ' + s.samples + ' samples');
      }
      out.readability.errors = (out.readability.errors || []).concat(side.errors);
      await side.close();
    }
  }
  const all = out.readability.shots;
  out.readability.summary = { shots: all.length, worst: worst && { theme: worst.theme, preset: worst.preset, viewport: worst.viewport, ratio: worst.ratio }, allPass: all.every(r => r.pass), fewestSamples: Math.min(...all.map(r => r.samples)) };
  verdict('the road edge is the brightest of edge, asphalt, barrier and ground beyond, by ' + READ.MARGIN + 'x, in every preset, theme and viewport', out.readability.summary.allPass, all.length + ' shots, worst ratio ' + (worst && worst.ratio) + ' (' + (worst && worst.theme + ' ' + worst.preset + ' ' + worst.viewport) + '), fewest samples ' + out.readability.summary.fewestSamples);
}

/* ---- beauty shots: wide views on the high tier ---- */
if (run('shots')) {
  console.log('\n== beauty shots');
  out.beauty = [];
  const views = [
    { theme: 'forest', preset: 'dusk', track: 0, name: 'wide-forest-dusk' },
    { theme: 'coastal', preset: 'dawn', track: 1, name: 'wide-coastal-dawn' },
    { theme: 'docks', preset: 'night', track: 3, name: 'wide-docks-night' },
    { theme: 'mountain', preset: 'dusk', track: 4, name: 'wide-mountain-dusk' },
    { theme: 'desert', preset: 'rain', track: 2, name: 'wide-desert-rain' },
  ];
  for (const v of views) {
    const side = await L.openPage(env, L.LANDSCAPE, 'auto=1&theme=' + v.theme + '&preset=' + v.preset + '&tier=high');
    await side.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); for (let i = 0; i < 6; i++) S.careerResult(i, 1, 1000); });
    // the title: the orbit camera on the line
    await side.page.evaluate(() => { window.__feel.draw = true; window.__clock = 1000; });
    await L.runFrames(side.page, 40);
    const titleFile = path.join(shotsDir, 'title-' + v.theme + '-' + v.preset + '-1280x720.png');
    await side.page.screenshot({ path: titleFile, timeout: 120000 });
    await side.page.evaluate(() => { window.__feel.draw = false; });
    await L.beginRun(side.page, 'career', v.track);
    let best = null;
    for (let k = 0; k < 40 && !best; k++) { const fr = await L.runFrames(side.page, 30, L.COLLECT); for (const f of fr) if (f.angle > 25 && f.v > 10 && f.state === 'drive') { best = f; break; } }
    // a wide view: the camera pulled back and up from the chase position, looking past the car down the road
    await side.page.evaluate(() => {
      const F = window.__feel, cam = F.scene.camera, p = F.pose, c = F.chase.state;
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), lx = -Math.cos(c.yaw), lz = Math.sin(c.yaw);
      cam.position.set(p.x - fx * 26 + lx * 9, 11, p.z - fz * 26 + lz * 9);
      cam.lookAt(p.x + fx * 14, 1.2, p.z + fz * 14);
      cam.fov = 50; cam.updateProjectionMatrix();
      document.getElementById('hud').classList.add('hidden');
      F.scene.render();
    });
    const file = path.join(shotsDir, v.name + '-1280x720.png');
    await side.page.screenshot({ path: file, timeout: 120000 });
    const info = await side.page.evaluate(() => window.__feel.scene.info());
    out.beauty.push({ ...v, file: path.relative(reviewDir, file), title: path.relative(reviewDir, titleFile), tier: info.tier, bloom: info.bloom, drawCalls: info.drawCalls, triangles: info.triangles, errors: side.errors });
    console.log('  wrote ' + file + ' (' + info.drawCalls + ' draw calls, ' + info.triangles + ' triangles, bloom ' + info.bloom + ')');
    await side.close();
  }
}

/* ---- 3. perf ---- */
if (run('perf')) {
  console.log('\n== 3. perf');
  out.perf = { budgetMs: 16.7, runs: [] };
  const FRAMES = 300;
  async function measure(tier, throttle, loadMs, extraMesh) {
    const side = await L.openPage(env, L.PORTRAIT, 'auto=1&tier=' + tier + '&theme=forest&preset=dusk');
    await side.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} window.__loop.save.reset(); });
    await L.beginRun(side.page, 'career', 0);
    const cdp = await side.context.newCDPSession(side.page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await side.page.evaluate(({ loadMs, extraMesh }) => {
      const F = window.__feel; F.draw = true;
      if (loadMs) { const step = F.world.stepWorld; F.world.stepWorld = inp => { const t0 = performance.now(); let g = 0; while (performance.now() - t0 < loadMs / 2 && g++ < 1e9) {} return step(inp); }; }
      if (extraMesh) { const THREE = F.scene.THREE; const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff00ff }), 50); m.castShadow = true; m.frustumCulled = false; const M = new THREE.Matrix4(); for (let i = 0; i < 50; i++) { M.makeTranslation(F.world.car.x + 5 + i * 0.1, 0.5, F.world.car.z); m.setMatrixAt(i, M); } F.scene.scene.add(m); }
    }, { loadMs: loadMs || 0, extraMesh: !!extraMesh });
    const frames = await L.runFrames(side.page, FRAMES, 'return { ms: F.info().frameMs, phys: F.info().physMs, submit: F.scene.info().submitMs, draw: F.scene.info().drawCalls, tris: F.scene.info().triangles, state: window.__loop.app.state };');
    const info = await side.page.evaluate(() => window.__feel.scene.info());
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await side.close();
    const warm = 30, body = frames.slice(warm);
    return { tier, throttle, loadMs: loadMs || 0, extraMesh: !!extraMesh, frames: frames.length, allDriving: body.every(f => f.state === 'drive'), backend: info.backend, bloom: info.bloom, env: info.env, frame: L.stat(body.map(f => f.ms)), jsWithoutSubmit: L.stat(body.map(f => f.ms - f.submit)), physics: L.stat(body.map(f => f.phys)), submit: L.stat(body.map(f => f.submit)), drawCalls: L.stat(body.map(f => f.draw)), triangles: L.stat(body.map(f => f.tris)), firstFrames: { worst: +Math.max(...frames.slice(0, warm).map(f => f.ms)).toFixed(1) }, errors: side.errors };
  }
  for (const tier of ['low', 'high']) for (const throttle of [1, 6]) {
    const r = await measure(tier, throttle, 0, false);
    out.perf.runs.push(r);
    console.log('  ' + tier + ' ' + throttle + 'x: js without submit p95 ' + r.jsWithoutSubmit.p95 + ' worst ' + r.jsWithoutSubmit.worst + ' ms; frame p95 ' + r.frame.p95 + '; submit p95 ' + r.submit.p95 + '; draw calls ' + r.drawCalls.p50 + ' (worst ' + r.drawCalls.worst + '), triangles ' + r.triangles.p50 + '; first frames worst ' + r.firstFrames.worst + '; bloom ' + r.bloom);
  }
  const low6 = out.perf.runs.find(r => r.tier === 'low' && r.throttle === 6), high6 = out.perf.runs.find(r => r.tier === 'high' && r.throttle === 6);
  out.perf.summary = { lowJsP95At6x: low6.jsWithoutSubmit.p95, lowJsWorstAt6x: low6.jsWithoutSubmit.worst, highJsP95At6x: high6.jsWithoutSubmit.p95, lowDrawCalls: low6.drawCalls.p50, highDrawCalls: high6.drawCalls.p50, lowTriangles: low6.triangles.p50, highTriangles: high6.triangles.p50, holds: low6.jsWithoutSubmit.p95 < out.perf.budgetMs };
  verdict('low tier JavaScript frame p95 at 6x throttle under 16.7 ms, on a generated circuit with the world around it', out.perf.summary.holds && low6.allDriving, low6.jsWithoutSubmit.p95 + ' ms, worst ' + low6.jsWithoutSubmit.worst + ', ' + low6.drawCalls.p50 + ' draw calls');
  const loaded = await measure('low', 6, 20, false);
  const rise = loaded.jsWithoutSubmit.p95 - low6.jsWithoutSubmit.p95;
  out.perf.knownAnswer = { loadMs: 20, p95Before: low6.jsWithoutSubmit.p95, p95Loaded: loaded.jsWithoutSubmit.p95, rise: +rise.toFixed(2), caught: rise > 12 && loaded.jsWithoutSubmit.p95 >= out.perf.budgetMs };
  verdict('known answer: 20 ms of busy work per frame raises the p95 by about 20 ms and fails the budget', out.perf.knownAnswer.caught, 'p95 ' + low6.jsWithoutSubmit.p95 + ' -> ' + loaded.jsWithoutSubmit.p95 + ' ms');
  const low1 = out.perf.runs.find(r => r.tier === 'low' && r.throttle === 1);
  const extra = await measure('low', 1, 0, true);
  const added = extra.drawCalls.p50 - low1.drawCalls.p50;
  out.perf.knownAnswerDraw = { drawCallsBefore: low1.drawCalls.p50, drawCallsWithExtraMesh: extra.drawCalls.p50, added, caught: added >= 1 && added <= 2 };
  verdict('known answer: one more instanced mesh is one or two more draw calls (its shadow is the second)', out.perf.knownAnswerDraw.caught, low1.drawCalls.p50 + ' -> ' + extra.drawCalls.p50);
}

/* ---- 4. download ---- */
if (run('download')) {
  console.log('\n== 4. download');
  const gameDir = path.join(L.root, 'game');
  const skip = rel => /(^|\/)(test|tests|__tests__)(\/|$)|\.test\.[cm]?js$/.test(rel);
  function count() {
    let bytes = 0, files = 0;
    const walk = rel => { const p = path.join(gameDir, rel); if (fs.statSync(p).isDirectory()) { if (fs.existsSync(path.join(p, '.noship'))) return; for (const f of fs.readdirSync(p)) walk(rel ? rel + '/' + f : f); return; } if (skip(rel) || rel.endsWith('.noship')) return; files++; if (!rel.startsWith('later/')) bytes += fs.statSync(p).size; };
    walk('');
    bytes += fs.statSync(path.join(L.root, 'public', 'vendor', 'three.webgpu.min.js')).size;
    return { bytes, files };
  }
  const build = () => { const o = execFileSync('node', [path.join(L.root, 'tools', 'build-site.js')], { cwd: L.root, encoding: 'utf8' }); const m = o.match(/new game: (\d+) files, initial download ([\d.]+) MB/); return { files: +m[1], mb: +m[2], output: o.trim() }; };
  const own = count(), built = build();
  out.download = { ownBytes: own.bytes, ownMB: +(own.bytes / 1048576).toFixed(2), buildMB: built.mb, buildFiles: built.files, limitMB: 20, aimMB: 5, agree: Math.abs(own.bytes / 1048576 - built.mb) < 0.02 };
  verdict('initial download under 5 MB (limit 20), build and independent count agree', built.mb < 5 && out.download.agree, built.mb + ' MB over ' + built.files + ' files (own count ' + out.download.ownMB + ' MB)');
  // the known answers: a megabyte under later/ does not count, under lab/ it does
  const blob = Buffer.alloc(1048576, 1);
  const laterDir = path.join(gameDir, 'later'), laterFile = path.join(laterDir, 'probe-blob.bin'), labFile = path.join(gameDir, 'lab', 'probe-blob.bin');
  const hadLater = fs.existsSync(laterDir);
  try {
    fs.mkdirSync(laterDir, { recursive: true }); fs.writeFileSync(laterFile, blob);
    const withLater = build();
    fs.rmSync(laterFile); if (!hadLater) fs.rmSync(laterDir, { recursive: true, force: true });
    fs.writeFileSync(labFile, blob);
    const withLab = build();
    fs.rmSync(labFile);
    out.download.knownAnswer = { base: built.mb, withLater: withLater.mb, withLab: withLab.mb, laterUnchanged: Math.abs(withLater.mb - built.mb) < 0.02, labGrew: Math.abs(withLab.mb - built.mb - 1) < 0.02, caught: Math.abs(withLater.mb - built.mb) < 0.02 && Math.abs(withLab.mb - built.mb - 1) < 0.02 };
  } finally {
    if (fs.existsSync(laterFile)) fs.rmSync(laterFile);
    if (!hadLater && fs.existsSync(laterDir)) fs.rmSync(laterDir, { recursive: true, force: true });
    if (fs.existsSync(labFile)) fs.rmSync(labFile);
    build();
  }
  verdict('known answer: a megabyte under game/later/ leaves the initial download unchanged, under game/lab/ it grows by one', out.download.knownAnswer.caught, built.mb + ' MB, with later/ ' + out.download.knownAnswer.withLater + ', with lab/ ' + out.download.knownAnswer.withLab);
}

await env.close();
for (const k of Object.keys(out)) L.writeJson(path.join(reviewDir, k + '.json'), { started, note, ...out[k] });
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '; wrote review/visuals/' + Object.keys(out).map(k => k + '.json').join(', '));
process.exit(failed ? 1 : 0);
