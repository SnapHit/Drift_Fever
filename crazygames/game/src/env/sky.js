/* THE SKY: a dome of vertex colours (zenith to horizon through a band,
   a glow around the sun), the sun's disc, stars at night, cloud
   streaks, and the backdrop on the horizon (mountains, peaks, mesas, a
   headland or a city skyline) as one silhouette ring. Everything here
   is unlit, unfogged and follows the camera, so it costs five draw
   calls at most and no shadow work. Colours come from the preset; the
   backdrop's shape from the theme and the seed. */
import { makeRng, makeNoise } from './rng.js';
import { sunDirection } from './presets.js';

export const SKY = {
  RADIUS:        820,      // m, inside the camera's far plane
  SEGMENTS:      [48, 24], // around, up: the gradient is per vertex
  GLOW_POWER:    6,        // how tight the glow around the sun is
  GLOW:          0.9,      // its strength
  SUN_SIZE:      0.045,    // radians of apparent radius for the disc
  STARS:         900,
  STAR_SIZE:     2.2,      // px
  CLOUDS:        22,       // streaks
  BACK_RADIUS:   600,      // m, the silhouette ring, from the camera
  BACK_SEGMENTS: 160,
  BACK_HEIGHT:   { mountains: 110, peaks: 170, mesas: 70, headland: 60, skyline: 90 },
  BACK_HAZE:     0.55,     // how far the backdrop's colour sits towards the horizon colour
};

/* hex colours are sRGB; vertex colours are linear */
const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const c3 = (hex, out) => { out[0] = lin(((hex >> 16) & 255) / 255); out[1] = lin(((hex >> 8) & 255) / 255); out[2] = lin((hex & 255) / 255); return out; };
const mix3 = (a, b, t, out) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeSky(THREE, preset) {
  const group = new THREE.Group();
  group.name = 'sky';
  const sunDir = sunDirection(preset);
  /* the dome */
  const geo = new THREE.SphereGeometry(SKY.RADIUS, SKY.SEGMENTS[0], SKY.SEGMENTS[1]);
  const pos = geo.attributes.position, n = pos.count;
  const col = new Float32Array(n * 3);
  const zenith = c3(preset.zenith, [0, 0, 0]), horizon = c3(preset.horizon, [0, 0, 0]), band = c3(preset.band, [0, 0, 0]), glow = c3(preset.glow, [0, 0, 0]);
  const tmp = [0, 0, 0], tmp2 = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i) / SKY.RADIUS, y = pos.getY(i) / SKY.RADIUS, z = pos.getZ(i) / SKY.RADIUS;
    const up = Math.max(0, y);
    // horizon to band over the first slice of elevation, band to zenith above
    mix3(horizon, band, smooth(0.0, 0.12, up), tmp);
    mix3(tmp, zenith, smooth(0.08, 0.55, up), tmp2);
    const d = Math.max(0, x * sunDir[0] + y * sunDir[1] + z * sunDir[2]);
    const g = Math.pow(d, preset.glowPower || SKY.GLOW_POWER) * (preset.glowGain || SKY.GLOW) * (1 - smooth(0.3, 0.9, up) * 0.7);
    // below the horizon the dome is the horizon colour, darkened, so a hill's gap never shows sky
    const below = y < 0 ? smooth(0, -0.25, y) : 0;
    for (let k = 0; k < 3; k++) col[i * 3 + k] = (tmp2[k] + glow[k] * g) * (1 - below * 0.35);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  dome.name = 'dome';
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);
  /* the sun's disc */
  if (preset.sunDisc && !preset.rain) {
    const r = SKY.RADIUS * 0.97 * Math.tan(preset.sunSize || SKY.SUN_SIZE);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: preset.sunDisc, fog: false, depthWrite: false, toneMapped: false, transparent: true, opacity: 0.95 }));
    disc.position.set(sunDir[0], sunDir[1], sunDir[2]).multiplyScalar(SKY.RADIUS * 0.97);
    disc.lookAt(0, 0, 0);
    disc.renderOrder = -9;
    disc.name = 'sun';
    group.add(disc);
    /* the spectacle round's halo: a soft additive bloom round the disc, so the low tier sees a sun worth looking at without the post pass */
    if (preset.sunSize && typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.18, 'rgba(255,255,255,0.45)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.12)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(r * 9, r * 9), new THREE.MeshBasicMaterial({ map: tex, color: preset.glow, fog: false, depthWrite: false, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.85 }));
      halo.position.copy(disc.position).multiplyScalar(0.99);
      halo.lookAt(0, 0, 0);
      halo.renderOrder = -8;
      halo.name = 'halo';
      group.add(halo);
    }
  }
  /* stars */
  if (preset.stars) {
    const rng = makeRng(99);
    const sp = new Float32Array(SKY.STARS * 3), sc = new Float32Array(SKY.STARS * 3);
    for (let i = 0; i < SKY.STARS; i++) {
      const el = Math.asin(rng.range(0.03, 1)), az = rng.range(0, Math.PI * 2), R = SKY.RADIUS * 0.95;
      sp[i * 3] = Math.cos(el) * Math.sin(az) * R; sp[i * 3 + 1] = Math.sin(el) * R; sp[i * 3 + 2] = Math.cos(el) * Math.cos(az) * R;
      const b = rng.range(0.35, 1) * preset.stars;
      sc[i * 3] = b; sc[i * 3 + 1] = b; sc[i * 3 + 2] = b * rng.range(0.9, 1.1);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: SKY.STAR_SIZE, vertexColors: true, fog: false, depthWrite: false, sizeAttenuation: false, toneMapped: false }));
    stars.renderOrder = -9;
    stars.frustumCulled = false;
    stars.name = 'stars';
    group.add(stars);
  }
  /* cloud streaks: long thin quads high on the dome, lit on the sun's side */
  if (preset.cloud > 0) {
    const rng = makeRng(7);
    const cp = [], cc = [];
    const lit = c3(preset.glow, [0, 0, 0]), shade = mix3(c3(preset.band, [0, 0, 0]), c3(preset.zenith, [0, 0, 0]), 0.5, [0, 0, 0]);
    const count = Math.round(SKY.CLOUDS * preset.cloud);
    for (let i = 0; i < count; i++) {
      const el = rng.range(0.08, 0.45), az = rng.range(0, Math.PI * 2), len = rng.range(0.15, 0.5), th = rng.range(0.004, 0.012);
      const R = SKY.RADIUS * 0.93;
      const centre = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
      const along = [Math.cos(az), 0, -Math.sin(az)];
      const upv = [-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az)];
      const d = Math.max(0, centre[0] * sunDir[0] + centre[1] * sunDir[1] + centre[2] * sunDir[2]);
      const k = 0.35 + 0.65 * Math.pow(d, 2);
      const colour = mix3(shade, lit, k, [0, 0, 0]);
      const corner = (a, b) => [(centre[0] + along[0] * a * len + upv[0] * b * th) * R, (centre[1] + along[1] * a * len + upv[1] * b * th) * R, (centre[2] + along[2] * a * len + upv[2] * b * th) * R];
      // a lens: pointed ends, so it reads as a streak and not a bar
      const q = [corner(-1, 0), corner(-0.45, -1), corner(0.45, -1), corner(1, 0), corner(0.45, 1), corner(-0.45, 1)];
      for (const t of [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]) { cp.push(...q[t]); cc.push(...colour); }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    const clouds = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, transparent: true, opacity: 0.28, side: THREE.DoubleSide, toneMapped: false }));
    clouds.renderOrder = -9;
    clouds.frustumCulled = false;
    clouds.name = 'clouds';
    group.add(clouds);
  }
  return group;
}

/* The backdrop: a ring of silhouettes around the world at BACK_RADIUS,
   coloured between the theme's backdrop colour and the horizon so it
   reads as a distant range through haze. Built around the origin and
   pinned to the camera's position by the scene, like the sky, so it is
   never clipped by the far plane and always rises above the fogged
   edge of the terrain; it is unfogged. */
export function makeBackdrop(THREE, theme, preset, seed) {
  const kind = theme.backdrop;
  if (!kind) return null;
  const noise = makeNoise((seed >>> 0) + 101), rng = makeRng((seed >>> 0) + 202);
  const N = SKY.BACK_SEGMENTS, R = SKY.BACK_RADIUS, H = SKY.BACK_HEIGHT[kind] || 80;
  const pos = [], col = [];
  const base = c3(theme.backColour, [0, 0, 0]), haze = c3(preset.horizon, [0, 0, 0]);
  const low = mix3(base, haze, SKY.BACK_HAZE, [0, 0, 0]), high = mix3(base, haze, SKY.BACK_HAZE * 0.55, [0, 0, 0]);
  const heights = new Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2;
    let h;
    if (kind === 'skyline') {
      // towers: a staircase of blocks, each a few segments wide
      const block = Math.floor(i / 2);
      const seedH = Math.abs(noise.noise(block * 1.7, 0.5));
      h = H * (0.15 + 0.85 * Math.pow(seedH, 1.6)) * (rng.chance(0.15) ? 0.35 : 1);
      heights[i] = h;
    } else if (kind === 'mesas') {
      const n1 = noise.fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2, 3);
      h = n1 > 0.05 ? H * (0.7 + 0.3 * noise.noise(i * 0.3, 1)) : H * 0.18 * (1 + noise.noise(i * 0.6, 2));
    } else {
      const sharp = kind === 'peaks' ? 1.8 : 1.2;
      const n1 = noise.fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3, 4, 2.2, 0.55);
      h = H * Math.pow(Math.max(0.05, 0.5 + 0.5 * n1), sharp);
      if (kind === 'headland') h *= 0.6 + 0.4 * Math.max(0, Math.cos(a - 1.3));
    }
    heights[i] = Math.max(2, h);
  }
  for (let i = 0; i < N; i++) {
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
    const h0 = heights[i], h1 = kind === 'skyline' ? heights[i] : heights[i + 1];
    const x0 = Math.sin(a0) * R, z0 = Math.cos(a0) * R, x1 = Math.sin(a1) * R, z1 = Math.cos(a1) * R;
    const q = [[x0, -40, z0], [x1, -40, z1], [x1, h1, z1], [x0, h0, z0]];
    const qc = [low, low, high, high];
    for (const t of [0, 1, 2, 0, 2, 3]) { pos.push(...q[t]); col.push(...qc[t]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, toneMapped: false }));
  mesh.name = 'backdrop';
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  return mesh;
}
