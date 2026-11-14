/* does the game draw on WebGPU here at all: the title's backdrop, both tiers. node game/test/webgpu/smoke.js */
import path from 'node:path'; import fs from 'node:fs';
import * as W from './lib.js';
const out = path.join(W.root, 'review', 'webgpu'); fs.mkdirSync(out, { recursive: true });
const env = await W.start();
for (const tier of ['high', 'low']) {
  const pg = await W.open(env, { width: 844, height: 390 }, 'tier=' + tier + '&adapt=0&title=1');
  await W.runFrames(pg.page, 5);
  const info = await pg.page.evaluate(() => window.__feel.scene.info());
  const img = await W.grab(pg.page, path.join(out, 'smoke-' + tier + '.png'));
  const seen = new Set(); if (img) for (let i = 0; i < img.d.length; i += 4 * 53) seen.add(img.d[i] >> 4 << 8 | img.d[i + 1] >> 4 << 4 | img.d[i + 2] >> 4);
  console.log(tier, info.backend, info.tier, 'bloom', info.bloom, 'colours', seen.size, pg.errors.slice(0, 3).join(' | '));
  await pg.close();
}
await env.close();
