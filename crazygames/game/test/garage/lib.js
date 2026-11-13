/* SHARED BY THE GARAGE PROBES (briefs/GARAGE.md). The ladder round's
   harness (headless Chromium through the dev server, the frame loop
   stubbed, the page advanced at a synthetic 60 Hz), writing to
   review/garage/, plus the moves this round needs: the garage opened
   on a section with coins, a look put on the chosen car in the save,
   and a career run brought mid slide for a shot. */
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import * as R from '../ladder/lib.js';

export * from '../ladder/lib.js';
export const dir = path.join(R.root, 'review', 'garage');
export const shots = path.join(dir, 'shots');
fs.mkdirSync(shots, { recursive: true });
export const SIZES = [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 800, height: 450 }, { width: 1280, height: 720 }];
export const SECTIONS = ['cars', 'paint', 'wheels', 'glow', 'smoke', 'upgrades'];

let fails = 0;
export const say = (pass, msg) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + msg); return pass; };
export const failed = () => fails;

/* the garage, with coins, on a section; drawing off */
export async function openGarage(page, coins, section, car) {
  await page.evaluate(({ coins, section, car }) => { const L = window.__loop; window.__feel.draw = false; L.save.state.coins = coins; L.action('garage'); if (car) L.action('pick-car', car); if (section) L.action('garage-tab', section); }, { coins: coins === undefined ? 0 : coins, section: section || null, car: car || null });
  await R.runFrames(page, 3);
}

/* put a look on the chosen car in the save, as if bought: { wheels, glow, smoke } */
export async function wear(page, look) {
  await page.evaluate(look => {
    const S = window.__loop.save.state, c = S.cars[S.car], STD = { wheels: 'standard', glow: 'off', smoke: 'standard' };
    for (const k of ['wheels', 'glow', 'smoke']) { const id = (look && look[k]) || STD[k]; if (id !== STD[k] && !c.own[k].includes(id)) c.own[k].push(id); c[k] = id; }
  }, look || null);
}

/* Math.random made the same every time, so two runs of one moment are
   the same picture to the pixel and only what was changed differs. The
   effects' random numbers are decoration; the physics has none. */
export async function seedRandom(page, seed) {
  await page.evaluate(seed => { let s = (seed >>> 0) || 1; Math.random = () => { window.__calls++; s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }, seed || 12345);
}

/* A career run brought to a frame mid slide, the same frame every time
   (the scripted drifter is deterministic), ready for a shot. Returns
   the moment, or null. */
export async function midSlide(page, index, mult, held, where, density) {
  await R.careerRun(page, index);
  if (density) await page.evaluate(k => { window.__feel.scene.effects().setDensity(k); }, density);   // a known answer's thinned effects
  await seedRandom(page, 7);   // after the run is set up (a track's dressing is built with random numbers the first time only), before its first frame
  if (where !== 'road') return R.slideAt(page, mult || 2, held || 14);
  /* as slideAt (spectacle/lib.js), but with the whole car on the asphalt, clear of the kerbs' paint */
  return page.evaluate(({ mult, held }) => {
    const F = window.__feel, s = F.scoring.state;
    let run = 0;
    for (let k = 0; k < 60 * 90; k++) {
      window.__clock += 1000 / 60;
      if (s.chain > 0 && mult > 1) s.driftTime = Math.max(s.driftTime, (mult - 1) * 1.2 + 0.05);
      F.frame(window.__clock);
      const c = F.world.car, a = Math.abs(c.slip) * 180 / Math.PI;
      if (window.__loop.app.state !== 'drive') { run = 0; if (window.__loop.app.state === 'results') return null; continue; }
      run = a > 22 && c.speed > 12 && Math.abs(F.world.lateral) < F.world.halfWidth - 3.2 ? run + 1 : 0;
      if (run >= held && a > 26) return { angle: a, v: c.speed, mult: s.mult, frame: k, lateral: F.world.lateral, halfWidth: F.world.halfWidth };
    }
    return null;
  }, { mult: mult || 2, held: held || 14 });
}
/* the HUD out of the picture (its numbers pop on the wall clock) or back in */
export const hud = (page, on) => page.evaluate(on => { document.getElementById('ui').style.visibility = on ? '' : 'hidden'; }, !!on);

/* A PNG's pixels inside a rect, read in the page: returns per pixel
   [r, g, b] as a flat array (small rects only). */
export async function pixels(page, png, rect) {
  return page.evaluate(async ({ png, rect }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + png; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const x0 = Math.max(0, Math.round(rect.x0)), y0 = Math.max(0, Math.round(rect.y0)), x1 = Math.min(c.width, Math.round(rect.x1)), y1 = Math.min(c.height, Math.round(rect.y1));
    if (x1 <= x0 || y1 <= y0) return { w: 0, h: 0, data: [] };
    return { w: x1 - x0, h: y1 - y0, data: Array.from(ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data) };
  }, { png: png.toString('base64'), rect });
}

/* A PNG as raw pixels: { w, h, d } with d the RGBA bytes. Read here
   with Node's own zlib (a screenshot is an 8 bit RGB or RGBA PNG, not
   interlaced), so the probes need nothing installed. */
export async function decode(png) {
  let o = 8, w = 0, h = 0, type = 0;
  const idat = [];
  while (o < png.length) {
    const len = png.readUInt32BE(o), kind = png.toString('ascii', o + 4, o + 8), body = png.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); type = body[9]; if (body[8] !== 8 || (type !== 2 && type !== 6) || body[12] !== 0) throw new Error('not an 8 bit RGB or RGBA PNG'); }
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = type === 6 ? 4 : 3, stride = w * bpp, d = new Uint8Array(w * h * 4), line = new Uint8Array(stride), prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0, v = raw[src + x];
      let p = 0;
      if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = (v + p) & 255;
    }
    for (let x = 0; x < w; x++) { const t = (y * w + x) * 4, q = x * bpp; d[t] = line[q]; d[t + 1] = line[q + 1]; d[t + 2] = line[q + 2]; d[t + 3] = bpp === 4 ? line[q + 3] : 255; }
    prev.set(line);
  }
  return { w, h, d };
}
export const lumOf = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
/* how colourful a pixel is: its largest channel less its smallest, 0 to 1 */
export const chromaOf = (r, g, b) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
/* the pixels of A and B that differ by more than tol in any channel: a mask and its count and box */
export function diffMask(A, B, tol) {
  const m = new Uint8Array(A.w * A.h); let n = 0, x0 = A.w, y0 = A.h, x1 = -1, y1 = -1;
  for (let i = 0, p = 0; p < m.length; i += 4, p++) {
    if (Math.abs(A.d[i] - B.d[i]) > tol || Math.abs(A.d[i + 1] - B.d[i + 1]) > tol || Math.abs(A.d[i + 2] - B.d[i + 2]) > tol) {
      m[p] = 1; n++; const x = p % A.w, y = (p / A.w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { m, n, box: n ? { x0, y0, x1, y1 } : null, w: A.w, h: A.h };
}
/* a mask grown by r pixels */
export function grow(mask, r) {
  const { m, w, h } = mask, out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) out[yy * w + xx] = 1; }
  }
  return { m: out, w, h, n: out.reduce((s, v) => s + v, 0) };
}
/* how many of a's pixels lie outside b */
export const outside = (a, b) => { let n = 0; for (let i = 0; i < a.m.length; i++) if (a.m[i] && !b.m[i]) n++; return n; };
/* the mean absolute difference per channel between A and B over a mask's pixels, 0 to 255, and how many of them differ by more than tol */
export function difference(A, B, mask, tol) {
  let sum = 0, k = 0, big = 0;
  for (let p = 0, i = 0; p < mask.m.length; p++, i += 4) {
    if (!mask.m[p]) continue;
    const d0 = Math.abs(A.d[i] - B.d[i]), d1 = Math.abs(A.d[i + 1] - B.d[i + 1]), d2 = Math.abs(A.d[i + 2] - B.d[i + 2]);
    sum += (d0 + d1 + d2) / 3; k++; if (Math.max(d0, d1, d2) > (tol || 24)) big++;
  }
  return { mean: k ? +(sum / k).toFixed(2) : 0, pixels: k, big };
}
export const pct = (list, q) => { if (!list.length) return 0; const s = list.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

/* Draw the frame and take the picture. The frame is drawn, then drawn
   again as it stands (nothing stepped), and the page is given a moment:
   a canvas drawn once is sometimes photographed a frame late, which
   showed one item's picture under the next one's name. */
export async function snap(page, file) {
  await page.evaluate(() => { window.__feel.draw = true; });
  await R.runFrames(page, 1);
  await page.evaluate(() => { const L = window.__loop; if (L.app.state === 'garage') L.showroom.render(); else window.__feel.scene.render(); return new Promise(res => setTimeout(res, 60)); });
  const png = await page.screenshot({ path: file, timeout: 180000 });
  await page.evaluate(() => { window.__feel.draw = false; });
  return png;
}
