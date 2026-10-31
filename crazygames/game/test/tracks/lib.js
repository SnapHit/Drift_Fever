/* SHARED BY THE TRACK PROBES. Paths, the browser, small statistics. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..', '..', '..');          // crazygames/
export const reviewDir = path.join(root, 'review', 'tracks');

export function findChromium() {
  if (process.env.TRACKS_CHROMIUM) return process.env.TRACKS_CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium-') && fs.existsSync(p)) return p; }
  return undefined;
}

export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/* Distribution of a list: count, min, percentiles, max, mean. */
export function dist(values) {
  const s = values.slice().sort((a, b) => a - b);
  const p = q => s[Math.min(s.length - 1, Math.floor(s.length * q))];
  const r = v => Math.round(v * 1000) / 1000;
  return { n: s.length, min: r(s[0]), p5: r(p(0.05)), p50: r(p(0.5)), p95: r(p(0.95)), max: r(s[s.length - 1]), mean: r(s.reduce((a, b) => a + b, 0) / s.length) };
}

export function writeJson(name, data) { fs.mkdirSync(reviewDir, { recursive: true }); fs.writeFileSync(path.join(reviewDir, name), JSON.stringify(data, null, 1)); }
