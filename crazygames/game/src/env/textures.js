/* PROCEDURAL TEXTURES, drawn on canvases at start: no files, no
   requests. The asphalt and concrete are grain around a mean of one,
   so they modulate the track's vertex colours without changing them
   (the road edge stays exactly as bright as the readability rule
   measures). The sponsor atlas is made up names in bold type on
   coloured panels; the sprites are soft discs for smoke and dust, and
   a hot core for sparks and exhaust. */
import { makeRng } from './rng.js';

/* Made up sponsors. None is a real company or a competitor's game. */
export const SPONSORS = [
  ['KOALA TYRES', 0xe8c23a, 0x1a1a1a],
  ['REDBACK BRAKES', 0xb0202a, 0xffffff],
  ['WATTLE OIL', 0xf2a51a, 0x2a1a00],
  ['DRIFT FEVER', 0x19d8ff, 0x06222b],
  ['SNAPHIT', 0x111318, 0x19d8ff],
  ['COOLABAH FUEL', 0x1f6f3a, 0xf0f0e0],
  ['GALAH GEAR', 0xe85a8a, 0xffffff],
  ['SOUTHERLY', 0x2f5fb0, 0xffffff],
  ['NULLARBOR', 0xc96a2a, 0x1a1000],
  ['QUOKKA RACING', 0xf0f0f0, 0x202020],
  ['BOOMER MOTORS', 0x3a3a3a, 0xffd23f],
  ['CASSOWARY', 0x1b4f8a, 0x8be0ff],
];

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* grain: value noise summed at a few scales, written as grey */
function grain(ctx, w, h, seed, amp, scales) {
  const rng = makeRng(seed);
  const img = ctx.createImageData(w, h), d = img.data;
  const layers = scales.map(s => { const n = Math.ceil(w / s) + 2, a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rng.next() * 2 - 1; return { s, n, a }; });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (const L of layers) {
      const fx = (x / L.s) % (L.n - 1), fy = (y / L.s) % (L.n - 1);
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const a = L.a[iy * L.n + ix], b = L.a[iy * L.n + ix + 1], c = L.a[(iy + 1) * L.n + ix], dd = L.a[(iy + 1) * L.n + ix + 1];
      v += ((a + (b - a) * tx) + ((c + (dd - c) * tx) - (a + (b - a) * tx)) * ty) / layers.length;
    }
    const g = Math.max(0, Math.min(255, Math.round(128 + 128 * amp * v)));
    const k = (y * w + x) * 4;
    d[k] = g; d[k + 1] = g; d[k + 2] = g; d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function asphaltTexture(THREE, size) {
  const s = size || 256, c = canvas(s, s), ctx = c.getContext('2d');
  grain(ctx, s, s, 11, 0.5, [2, 5, 17]);
  // a few darker patches and fine cracks
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
  const rng = makeRng(12);
  for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.ellipse(rng.range(0, s), rng.range(0, s), rng.range(6, 30), rng.range(4, 16), rng.range(0, 3), 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 0.25; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) { ctx.beginPath(); let x = rng.range(0, s), y = rng.range(0, s); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rng.range(-14, 14); y += rng.range(-14, 14); ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

export function concreteTexture(THREE, size) {
  const s = size || 128, c = canvas(s, s), ctx = c.getContext('2d');
  grain(ctx, s, s, 21, 0.3, [3, 9, 31]);
  // panel joints
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, s, 2); ctx.fillRect(0, 0, 2, s);
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* The sponsor atlas: ROWS panels stacked, each a full width strip. */
export function sponsorAtlas(THREE) {
  const W = 512, H = 64, rows = SPONSORS.length, c = canvas(W, H * rows), ctx = c.getContext('2d');
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  SPONSORS.forEach(([name, bg, fg], i) => {
    ctx.fillStyle = hex(bg); ctx.fillRect(0, i * H, W, H);
    ctx.fillStyle = hex(fg);
    ctx.font = '900 44px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, W / 2, i * H + H / 2 + 2, W - 24);
    ctx.fillStyle = hex(fg); ctx.globalAlpha = 0.5; ctx.fillRect(10, i * H + 6, 10, H - 12); ctx.fillRect(W - 20, i * H + 6, 10, H - 12); ctx.globalAlpha = 1;
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { texture: t, rows, uv: i => { const k = ((i % rows) + rows) % rows; return { v0: 1 - (k + 1) / rows, v1: 1 - k / rows }; } };
}

/* A banner for the start gantry. */
export function bannerTexture(THREE, text, bg, fg) {
  const W = 1024, H = 128, c = canvas(W, H), ctx = c.getContext('2d');
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  ctx.fillStyle = hex(bg); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = hex(fg);
  ctx.font = '900 86px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2 + 4, W - 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* A soft disc: alpha falls from the centre, with a little noise, for smoke and dust. */
/* A billowing puff for the spectacle round's smoke: a cluster of soft
   lobes, lit a little from above (brighter on top, shaded beneath) so a
   puff reads as a volume and not a disc, over two octaves of noise. */
export function puffSprite(THREE, size) {
  const s = size || 128, c = canvas(s, s), ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s), d = img.data, rng = makeRng(47);
  const lobes = [];
  for (let i = 0; i < 9; i++) { const a = rng.range(0, Math.PI * 2), r = i === 0 ? 0 : rng.range(0.08, 0.24); lobes.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.85, r: i === 0 ? 0.3 : rng.range(0.14, 0.24) }); }
  const octave = (n, seed) => { const g = makeRng(seed), a = new Float32Array((n + 1) * (n + 1)); for (let i = 0; i < a.length; i++) a[i] = g.next(); return (x, y) => { const fx = x * n, fy = y * n, ix = Math.min(n - 1, Math.floor(fx)), iy = Math.min(n - 1, Math.floor(fy)), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); const q = (i, j) => a[j * (n + 1) + i]; return (q(ix, iy) * (1 - sx) + q(ix + 1, iy) * sx) * (1 - sy) + (q(ix, iy + 1) * (1 - sx) + q(ix + 1, iy + 1) * sx) * sy; }; };
  const n1 = octave(6, 48), n2 = octave(14, 49);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = (x + 0.5) / s - 0.5, v = (y + 0.5) / s - 0.5;
    let a = 0, top = 0;
    for (const L of lobes) { const r = Math.hypot(u - L.x, v - L.y) / L.r; if (r < 1) { const k = 1 - r * r; if (k * k > a) { a = k * k; top = (L.y - v) / L.r; } } }
    const edge = Math.max(0, 1 - Math.hypot(u, v) * 2);
    a *= Math.min(1, edge * 2.2) * (0.62 + 0.38 * n1((x + 0.5) / s, (y + 0.5) / s)) * (0.82 + 0.18 * n2((x + 0.5) / s, (y + 0.5) / s));
    const shade = Math.max(0.62, Math.min(1, 0.84 + 0.22 * top));   // canvas y runs down: lobes lit from the top
    const g = Math.round(255 * shade), k = (y * s + x) * 4;
    d[k] = g; d[k + 1] = g; d[k + 2] = g; d[k + 3] = Math.round(255 * Math.min(1, a * 1.1));
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function softSprite(THREE, size, noisy) {
  const s = size || 128, c = canvas(s, s), ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s), d = img.data, rng = makeRng(31);
  const n = 5, cells = new Float32Array(n * n); for (let i = 0; i < cells.length; i++) cells[i] = rng.next();
  const fade = t => t * t * (3 - 2 * t);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (x + 0.5) / s - 0.5, dy = (y + 0.5) / s - 0.5, r = Math.hypot(dx, dy) * 2;
    let a = Math.max(0, 1 - r); a = a * a * (3 - 2 * a);
    // a little smooth noise so puffs are not perfect discs; coarse and faint, so no cell shows
    if (noisy) { const fx = x / s * (n - 1), fy = y / s * (n - 1), ix = Math.floor(fx), iy = Math.floor(fy), tx = fade(fx - ix), ty = fade(fy - iy); const v = cells[iy * n + ix] * (1 - tx) * (1 - ty) + cells[iy * n + ix + 1] * tx * (1 - ty) + cells[(iy + 1) * n + ix] * (1 - tx) * ty + cells[(iy + 1) * n + ix + 1] * tx * ty; a *= 0.8 + 0.2 * v; }
    const k = (y * s + x) * 4;
    d[k] = 255; d[k + 1] = 255; d[k + 2] = 255; d[k + 3] = Math.round(255 * a);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* A hot core with a glow, for sparks and the exhaust. */
export function sparkSprite(THREE, size) {
  const s = size || 32, c = canvas(s, s), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,240,200,0.9)'); g.addColorStop(0.6, 'rgba(255,160,60,0.35)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* A rain streak: a thin vertical line that fades at both ends. */
export function rainSprite(THREE) {
  const w = 8, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(3, 0, 2, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
