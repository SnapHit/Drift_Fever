/* MEASURE 5, THE LIVE TITLE (briefs/FIRST-MINUTE.md priority 4, behind
   ?first=2). From an empty save, on the title a new player sees (the
   menu with start here, .menu.fresh), as a phone (390x844, touch) and a
   desktop (1280x720), on WebGL 2 and on WebGPU (game/test/webgpu/lib.js),
   on both tiers:
   - it moves: the share of the backdrop's pixels that change by more
     than MOVED levels from one frame to the next, and the metres the car
     drives;
   - the car is in frame and never under a button: the car's box (its
     eight corners projected through the camera as it drew, the lens
     shift included) is inside the screen and clear of every button,
     frame by frame;
   - the buttons' text keeps its contrast: the frame drawn is put under
     the page's own buttons so the browser composites them as it does
     the canvas, the text made transparent, and each line of each button
     (its bold name and its small line, at the opacity it is drawn with)
     is held against what then shows behind it: per line the contrast
     that all but its darkest PCT of pixels reach, the lowest over the
     frames, against main's title measured the same way;
   - its cost, on the low tier as a phone (390x844): draw calls and the
     game's own work per frame (each frame stepped with the GPU idle
     before it, the GPU process and the page on separate cores, as
     look/cost.js does), against main's title, within LIMIT; on both
     backends. Main's title stands on the day's daily track, this one on
     career track 1: that is the comparison a player gets.
   Known answers, each able to fail: the car's clear place put on the
   menu on purpose is caught under a button; a frame drawn twice (the
   clock not moved) reads as not moving.

   node game/test/first/title.js [--backends webgl2,webgpu] [--tiers low,high] [--sizes 390x844,1280x720] [--frames 60] [--no-cost] [--no-pages]
   writes review/first/title-<backends>.json (title-cost-<backends>.json with --no-pages) and pictures title-*.jpg; the cost wants the machine to itself, the rest does not */
import path from 'node:path';
import fs from 'node:fs';
import * as F from './lib.js';
import * as W from '../webgpu/lib.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const BACKENDS = arg('--backends', 'webgl2,webgpu').split(','), TIERS = arg('--tiers', 'low,high').split(',');
const SIZES = arg('--sizes', '390x844,1280x720').split(',').map(s => { const [w, h] = s.split('x').map(Number); return { width: w, height: h }; });
const PROBE = {
  FRAMES:      +arg('--frames', 60),   // samples looked at on each page (pictures and contrast)
  STRIDE:      10,      // frames from one sample to the next (the car's place is looked at on every frame between): 60 samples are 10 s of the title, its first slides in them
  WARM:        60,      // frames drawn first: the first ones build what they draw
  MOVED:       6,       // levels (of 255) a pixel must change by to count as moved
  MOVING:      0.005,   // share of the picture's pixels that must move from one frame to the next to count as moving (a frame drawn twice moves none; on a phone the menu and its shade cover most of the backdrop, and the least seen moving was 1.7 per cent)
  PCT:         0.05,    // a line's contrast is what all but its darkest 5 per cent of pixels reach
  FLOOR:       4.5,     // the contrast every line keeps if main's own is lower (WCAG AA for text this size)
  COST_FRAMES: 150,     // frames timed for the cost, the first COST_SKIP dropped (they build)
  COST_SKIP:   10,
  LIMIT:       0.10,    // the cost against main's title
  SHOTS:       [12, 48],      // samples written out as pictures (with ?first=2), for the eye
};

/* a page of one side's game on the title of an empty save */
async function openTitle(sideName, backend, vp, tier) {
  const S = await F.side(sideName);
  for (let attempt = 0; ; attempt++) {
    const env = await S.R.start(backend === 'webgpu' ? { args: W.ARGS } : undefined);
    try {
      const ctx = await env.browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: vp.width < vp.height, isMobile: false });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
      page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|AudioContext/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
      if (backend === 'webgpu') await page.addInitScript(W.FAKE);
      else await page.addInitScript('window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {};');
      const q = (backend === 'webgl2' ? 'renderer=webgl2&' : '') + 'tier=' + tier + (sideName === 'branch' ? '&first=2' : '');
      await page.goto(env.url + '?' + q, { waitUntil: 'load', timeout: 120000 });
      let ready = false;
      for (const end = Date.now() + 90000; Date.now() < end && !ready; await new Promise(r => setTimeout(r, 200))) ready = await page.evaluate(() => window.__ready === true).catch(() => false);
      if (!ready) throw new Error('never ready');
      const got = await page.evaluate(() => window.__feel.scene.info().backend);
      if (got !== backend) throw new Error('asked for ' + backend + ', got ' + got);
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } const L = window.__loop; L.save.reset(); L.action('title'); window.__clock = 1000; window.__feel.draw = true; });
      const fresh = await page.evaluate(() => !!document.querySelector('#screens.on .screen.title .menu.fresh [data-action="first"]'));
      if (!fresh) throw new Error('no new player\'s menu on the title');
      return { env, page, errors, close: async () => { await ctx.close(); await env.close(); } };
    } catch (e) { await env.close().catch(() => {}); if (attempt >= 3) throw e; console.log('(again: ' + String(e.message || e).split('\n')[0] + ')'); }
  }
}

/* one frame drawn, with the GPU idle before it; dt 0 when still is set (the known answer) */
const FRAME = (page, still) => page.evaluate(async still => {
  const F = window.__feel, R = F.scene.renderer, d = window.__gpuCanvas && window.__gpuCanvas.device();
  if (d) await d.queue.onSubmittedWorkDone(); else if (R.backend && R.backend.gl) R.backend.gl.finish();
  if (!still) window.__clock += 1000 / 60;
  F.frame(window.__clock);
  const i = F.info();
  return { ms: i.frameMs, phys: i.physMs, dc: i.drawCalls, tri: i.triangles, adapt: i.adapt };
}, !!still);

/* the page's half: the car's box on screen (its eight corners through the
   camera as it drew), every button and its lines, and the frame's picture
   (the canvas on WebGL 2, read in the task that drew it; the texture on
   WebGPU, read back) */
const PAGE = `(function () {
  const F = window.__feel, T = F.scene.THREE, v = new T.Vector3();
  let box = null;
  const R = r => ({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
  const P = window.__titleProbe = {
    async init() { const m = await import('/src/garage/roster.js'); box = m.carBox(window.__loop.save.state.car); },
    car() {
      const cam = F.scene.camera, p = F.pose, w = innerWidth, h = innerHeight;
      cam.updateMatrixWorld();
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), lx = -Math.cos(p.yaw), lz = Math.sin(p.yaw);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
      for (const f of [-box.halfLength, box.halfLength]) for (const l of [-box.halfWidth, box.halfWidth]) for (const y of [0, box.height]) {
        v.set(p.x + fx * f + lx * l, (p.y || 0) + y, p.z + fz * f + lz * l).project(cam);
        if (v.z > 1) behind = true;
        const sx = (v.x + 1) / 2 * w, sy = (1 - v.y) / 2 * h;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return { x0, y0, x1, y1, behind, inside: !behind && x0 >= 0 && y0 >= 0 && x1 <= w && y1 <= h };
    },
    buttons() {
      return [...document.querySelectorAll('#screens.on .screen.title button')].filter(b => b.getBoundingClientRect().height > 0).map(b => {
        const lines = [...b.querySelectorAll('b, small, span')].filter(e => e.textContent.trim() && e.getBoundingClientRect().height > 0 && !e.querySelector('b, small, span')).map(e => {
          let a = 1; for (let n = e; n && n !== b.parentElement; n = n.parentElement) a *= +getComputedStyle(n).opacity;
          const c = getComputedStyle(e).color.match(/[\\d.]+/g).map(Number);
          return { text: e.textContent.trim().slice(0, 24), rect: R(e.getBoundingClientRect()), rgb: c.slice(0, 3), alpha: a * (c.length > 3 ? c[3] : 1) };
        });
        return { action: b.dataset.action, rect: R(b.getBoundingClientRect()), lines };
      });
    },
    under(car, buttons) {
      let under = 0, of = null;
      for (const b of buttons) { const a = Math.max(0, Math.min(car.x1, b.rect.x1) - Math.max(car.x0, b.rect.x0)) * Math.max(0, Math.min(car.y1, b.rect.y1) - Math.max(car.y0, b.rect.y0)); if (a > under) { under = a; of = b.action; } }
      return { under, of };
    },
    async picture() {
      const G = window.__gpuCanvas;
      if (!G) return F.scene.renderer.domElement.toDataURL('image/png').split(',')[1];
      const d = G.device(), t = G.texture(), w = t.width, h = t.height, row = Math.ceil(w * 4 / 256) * 256;
      const buf = d.createBuffer({ size: row * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const e = d.createCommandEncoder(); e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: row }, [w, h]); d.queue.submit([e.finish()]);
      await buf.mapAsync(GPUMapMode.READ);
      const src = new Uint8Array(buf.getMappedRange()), out = new Uint8ClampedArray(w * h * 4), bgra = /^bgra/.test(G.format());
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = y * row + x * 4, o = (y * w + x) * 4; out[o] = src[s + (bgra ? 2 : 0)]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + (bgra ? 0 : 2)]; out[o + 3] = 255; }
      buf.unmap(); buf.destroy();
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    },
    /* n frames: all but the last two stepped undrawn, the car's place looked at on every one; the last two drawn and taken.
       every: page source run before each frame (a known answer); still: the clock not moved (a known answer) */
    async advance(n, every, still) {
      const run = every ? new Function(every) : null;
      let worst = { under: 0, of: null, car: null }, out = 0, nUnder = 0, driven = 0, slid = 0, pics = [];
      const bs = P.buttons(), A = window.__loop.app;
      for (let k = 0; k < n; k++) {
        if (run) run();
        const draw = k >= n - 2;
        F.draw = draw;
        const c0 = F.world.car, x = c0.x, z = c0.z;
        if (!still) window.__clock += 1000 / 60;
        F.frame(window.__clock);
        const c = F.world.car; driven += Math.hypot(c.x - x, c.z - z); if (Math.abs(c.slip) * 180 / Math.PI >= 12) slid++;
        const car = P.car(), u = P.under(car, bs);
        if (!car.inside) out++;
        if (u.under > 0) nUnder++;
        if (u.under > worst.under) worst = { under: u.under, of: u.of, car };
        if (draw) pics.push(await P.picture());
      }
      F.draw = true;
      const c = F.world.car, car = P.car();
      return { worst, out, nUnder, driven, slid, pics, layout: { w: innerWidth, h: innerHeight, car, buttons: bs, land: A.titleLand, speed: c.speed, slip: c.slip * 180 / Math.PI } };
    },
  };
})();`;

/* the picture put under the page's buttons, the text made transparent: what shows behind each line (keep: the text left as it is, for a picture as a player sees it) */
async function behindText(page, png, keep) {
  await page.evaluate(async ({ b64, keep }) => {
    let img = document.getElementById('__bd');
    if (!img) {
      img = document.createElement('img'); img.id = '__bd';
      const cv = window.__feel.scene.renderer.domElement, cs = getComputedStyle(cv);
      Object.assign(img.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: cs.zIndex === 'auto' ? '0' : cs.zIndex });
      cv.after(img);
      const st = document.createElement('style'); st.id = '__bdText'; document.head.appendChild(st);
    }
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
    document.getElementById('__bdText').textContent = keep ? '' : '#screens .screen.title button, #screens .screen.title button * { color: transparent !important; text-shadow: none !important; } #screens .screen.title button svg { visibility: hidden !important; }';
  }, { b64: png.toString('base64'), keep: !!keep });
  if (keep) return page.screenshot({ type: 'jpeg', quality: 82 });
  const shot = await page.screenshot();
  await page.evaluate(() => { document.getElementById('__bdText').textContent = ''; });
  return W.decode(shot);
}
async function unpicture(page) { await page.evaluate(() => { const i = document.getElementById('__bd'); if (i) i.remove(); const s = document.getElementById('__bdText'); if (s) s.remove(); }); }

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/* each line's contrast against the pixels behind it (img decoded): what all but the darkest PCT reach */
function contrasts(img, layout) {
  const out = [];
  for (const b of layout.buttons) for (const ln of b.lines) {
    const r = ln.rect, vals = [];
    for (let y = Math.max(0, Math.floor(r.y0)); y < Math.min(img.h, Math.ceil(r.y1)); y++) for (let x = Math.max(0, Math.floor(r.x0)); x < Math.min(img.w, Math.ceil(r.x1)); x++) {
      const o = (y * img.w + x) * 4, br = img.d[o], bg = img.d[o + 1], bb = img.d[o + 2], a = ln.alpha;
      const tr = ln.rgb[0] * a + br * (1 - a), tg = ln.rgb[1] * a + bg * (1 - a), tb = ln.rgb[2] * a + bb * (1 - a);
      vals.push(ratio(lum(tr, tg, tb), lum(br, bg, bb)));
    }
    if (!vals.length) continue;
    vals.sort((p, q) => p - q);
    out.push({ button: b.action, line: ln.text, contrast: +vals[Math.floor(vals.length * PROBE.PCT)].toFixed(2) });
  }
  return out;
}
/* the share of pixels that moved by more than MOVED between two decoded pictures */
function moved(a, b) {
  if (!a || !b || a.w !== b.w || a.h !== b.h) return null;
  let n = 0; const N = a.w * a.h;
  for (let i = 0; i < N; i++) { const o = i * 4; if (Math.max(Math.abs(a.d[o] - b.d[o]), Math.abs(a.d[o + 1] - b.d[o + 1]), Math.abs(a.d[o + 2] - b.d[o + 2])) > PROBE.MOVED) n++; }
  return n / N;
}

/* FRAMES samples of one page, STRIDE frames apart: motion between a sample's two drawn frames, the car's place on every frame, the lines' contrast on each sample */
async function look(pg, backend, label, opts) {
  const o = opts || {}, rows = [];
  await pg.page.evaluate(PAGE); await pg.page.evaluate(() => window.__titleProbe.init());
  for (let i = 0; i < PROBE.WARM; i++) await FRAME(pg.page);
  let framesOut = 0, framesUnder = 0, framesSeen = 0, driven = 0, slid = 0, worst = null;
  for (let i = 0; i < PROBE.FRAMES; i++) {
    const r = await pg.page.evaluate(({ n, every, still }) => window.__titleProbe.advance(n, every, still), { n: PROBE.STRIDE, every: o.every || null, still: !!o.still });
    framesSeen += PROBE.STRIDE; framesOut += r.out; framesUnder += r.nUnder; driven += r.driven; slid += r.slid;
    if (r.worst.under > 0 && (!worst || r.worst.under > worst.under)) worst = r.worst;
    const A = await W.decode(Buffer.from(r.pics[0], 'base64')), png = Buffer.from(r.pics[1], 'base64'), B = await W.decode(png);
    const mv = moved(A, B), seen = await behindText(pg.page, png), con = contrasts(seen, r.layout);
    const low = con.reduce((m, c) => (!m || c.contrast < m.contrast ? c : m), null);
    if (!o.noShots && PROBE.SHOTS.includes(i)) fs.writeFileSync(path.join(F.dir, 'title-' + label + '-s' + i + '.jpg'), await behindText(pg.page, png, true));
    rows.push({ i, moved: mv, low, car: r.layout.car, speed: +r.layout.speed.toFixed(1), slip: +r.layout.slip.toFixed(1) });
  }
  await unpicture(pg.page);
  const mvs = rows.map(r => r.moved).filter(x => x !== null).sort((a, b) => a - b);
  const lows = rows.map(r => r.low).filter(Boolean), lowest = lows.reduce((m, c) => (!m || c.contrast < m.contrast ? c : m), null);
  return {
    samples: rows.length, frames: framesSeen, movedMin: +mvs[0].toFixed(4), movedMedian: +mvs[Math.floor(mvs.length / 2)].toFixed(4), samplesStill: mvs.filter(x => x < PROBE.MOVING).length, driven: +driven.toFixed(1), slid,
    framesOut, framesUnder, worstUnder: worst ? { px: Math.round(worst.under), of: worst.of, car: worst.car } : null, lowest, rows,
  };
}

/* the cost: COST_FRAMES frames stepped one at a time with the GPU idle before each */
async function cost(pg) {
  for (let i = 0; i < PROBE.WARM; i++) await FRAME(pg.page);
  const f = [];
  for (let i = 0; i < PROBE.COST_FRAMES; i++) f.push(await FRAME(pg.page));
  const t = f.slice(PROBE.COST_SKIP), med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  return { frames: t.length, drawCalls: med(t.map(x => x.dc)), drawCallsMax: Math.max(...t.map(x => x.dc)), triangles: med(t.map(x => x.tri)), workMs: +med(t.map(x => x.ms)).toFixed(2), physMs: +med(t.map(x => x.phys)).toFixed(2), adapt: Math.max(...t.map(x => x.adapt)) };
}

const out = { probe: PROBE, main: F.mainCommit(), pages: {}, cost: {} };
const sz = vp => vp.width + 'x' + vp.height;
if (!args.includes('--no-pages')) for (const backend of BACKENDS) for (const tier of TIERS) for (const vp of SIZES) {
  const res = {};
  for (const side of ['main', 'branch']) {
    const pg = await openTitle(side, backend, vp, tier);
    try { res[side] = await look(pg, backend, backend + '-' + tier + '-' + sz(vp), { noShots: side === 'main' }); res[side].errors = pg.errors.slice(); }
    finally { await pg.close(); }
  }
  const a = res.main, b = res.branch, key = backend + ' ' + tier + ' ' + sz(vp);
  out.pages[key] = { main: { ...a, rows: undefined }, branch: { ...b, rows: undefined }, rows: b.rows };
  const name = backend + ', ' + tier + ' tier, ' + sz(vp);
  F.say(b.samplesStill === 0 && b.driven > 5, name + ': the backdrop moves from frame to frame at every one of ' + b.samples + ' samples (' + (b.movedMin * 100).toFixed(1) + ' per cent of pixels at the least, median ' + (b.movedMedian * 100).toFixed(1) + '; main\'s, its camera circling a parked car, ' + (a.movedMedian * 100).toFixed(1) + '); the car drove ' + Math.round(b.driven) + ' m in ' + b.frames + ' frames and slid in ' + b.slid);
  F.say(b.framesOut === 0 && b.framesUnder === 0, name + ': the car in frame in all ' + b.frames + ' frames (out ' + b.framesOut + ') and never under a button (' + b.framesUnder + ' frames' + (b.worstUnder ? ', worst ' + b.worstUnder.px + ' px under ' + b.worstUnder.of : '') + ')');
  const bar = Math.min(a.lowest ? a.lowest.contrast : PROBE.FLOOR, PROBE.FLOOR);
  F.say(b.lowest && b.lowest.contrast >= bar, name + ': the lowest contrast of a button\'s line over ' + b.samples + ' samples ' + (b.lowest ? b.lowest.contrast + ' (' + b.lowest.button + ', "' + b.lowest.line + '")' : '-') + ', main\'s ' + (a.lowest ? a.lowest.contrast + ' (' + a.lowest.button + ', "' + a.lowest.line + '")' : '-') + ', bar ' + bar.toFixed(2));
  F.say(!a.errors.length && !b.errors.length, name + ': no page errors (' + [...a.errors, ...b.errors].join(' | ') + ')');
}

/* the cost, on the low tier as a phone, on each backend */
if (!args.includes('--no-cost')) for (const backend of BACKENDS) {
  const vp = F.PHONE, res = {};
  for (const side of ['main', 'branch']) {
    const pg = await openTitle(side, backend, vp, 'low');
    try { const cores = F.pin(); res[side] = { ...await cost(pg), cores }; } finally { await pg.close(); }
  }
  out.cost[backend] = res;
  const a = res.main, b = res.branch, ok = b.drawCalls <= a.drawCalls * (1 + PROBE.LIMIT) && b.workMs <= a.workMs * (1 + PROBE.LIMIT);
  F.say(ok, backend + ', low tier, as a phone: draw calls ' + a.drawCalls + ' to ' + b.drawCalls + ' (x' + (b.drawCalls / a.drawCalls).toFixed(3) + '), the game\'s own work ' + a.workMs + ' to ' + b.workMs + ' ms a frame (x' + (b.workMs / a.workMs).toFixed(3) + '; physics and the driver ' + a.physMs + ' and ' + b.physMs + '; ' + b.cores + '): within ' + PROBE.LIMIT * 100 + ' per cent');
}

/* known answers, on the first backend, low tier, as a phone */
if (!args.includes('--no-pages')) {
  const backend = BACKENDS[0], pg = await openTitle('branch', backend, F.PHONE, 'low');
  try {
    /* the car's clear place put on the menu, and kept there */
    const k1 = await look(pg, backend, 'known', { noShots: true, every: "const A = window.__loop.app, m = document.querySelector('#screens.on .screen.title .menu').getBoundingClientRect(); A.titleLook = -1e9; A.titleLand = { x: m.left, y: m.top, w: m.width, h: m.height };" });
    F.say(k1.framesUnder > 0, 'known answer: the car\'s clear place put on the menu is caught under a button in ' + k1.framesUnder + ' of ' + k1.frames + ' frames' + (k1.worstUnder ? ' (worst ' + k1.worstUnder.px + ' px under ' + k1.worstUnder.of + ')' : '') + '; its lowest contrast then ' + (k1.lowest ? k1.lowest.contrast : '-'));
    /* a frame drawn again with the clock not moved */
    const k2 = await look(pg, backend, 'still', { noShots: true, still: true });
    F.say(k2.samplesStill === k2.samples, 'known answer: frames drawn with the clock not moved read as not moving: ' + k2.samplesStill + ' of ' + k2.samples + ' samples still (median ' + (k2.movedMedian * 100).toFixed(2) + ' per cent of pixels moved)');
    out.knownAnswers = { underMenu: { ...k1, rows: undefined }, still: { ...k2, rows: undefined } };
  } finally { await pg.close(); }
}
F.writeJson(path.join(F.dir, (args.includes('--no-pages') ? 'title-cost-' : 'title-') + BACKENDS.join('-') + '.json'), out);
console.log(F.failed() ? F.failed() + ' failed' : 'all passed');
process.exit(F.failed() ? 1 : 0);
