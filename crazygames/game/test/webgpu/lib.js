/* THE WEBGPU BACKEND, IN THE SANDBOX (15 November 2026). Until now every
   probe ran the WebGL 2 fallback, and a phone runs WebGPU. The sandbox's
   Chromium will give a WebGPU device drawn in software
   (--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader), and it
   draws, but it cannot show: the first getCurrentTexture() on a canvas
   destroys the device ("A valid external Instance reference no longer
   exists"). So the canvas' WebGPU context is replaced, before the page
   runs, by one that hands the renderer a texture of the device's own to
   draw into, and the picture is read back from that texture. The game
   and three.js are untouched and do not know.

   start()            a browser that has WebGPU
   open(env, vp, q, { timeout })   a page of the game on the WebGPU backend, the frame loop stubbed as in the other probes
   grab(page, file)   the last frame drawn, as { w, h, d } (RGBA), written as a PNG if a file is given */
import fs from 'node:fs';
import * as R from '../garage/lib.js';
export * from '../garage/lib.js';

export const ARGS = ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--ignore-gpu-blocklist'];
export const start = () => R.start({ args: ARGS });

const FAKE = `(function () {
  window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {};
  const real = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, opts) {
    if (kind !== 'webgpu') return real.call(this, kind, opts);
    if (this.__fake) return this.__fake;
    const canvas = this; let cfg = null, tex = null;
    const ctx = {
      canvas,
      configure(c) { cfg = c; if (tex) { tex.destroy(); tex = null; } },
      unconfigure() { cfg = null; if (tex) { tex.destroy(); tex = null; } },
      getConfiguration() { return cfg; },
      getCurrentTexture() {
        if (!tex || tex.width !== canvas.width || tex.height !== canvas.height) {
          if (tex) tex.destroy();
          tex = cfg.device.createTexture({ size: [canvas.width, canvas.height], format: cfg.format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING, viewFormats: cfg.viewFormats || [] });
        }
        return tex;
      },
    };
    window.__gpuCanvas = { ctx, device: () => cfg && cfg.device, texture: () => tex, format: () => cfg && cfg.format };
    return (this.__fake = ctx);
  };
})();`;

export async function open(env, viewport, query, opts) {
  const wait = (opts && opts.timeout) || 120000;   // a page whose WebGPU device never comes stays unready for good: a probe that retries can give up sooner
  const context = await env.browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  await page.addInitScript(FAKE);
  await page.goto(env.url + '?' + (query || ''), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__ready === true || (document.getElementById('fail') && !document.getElementById('fail').hidden), null, { timeout: wait });
  const failed = await page.evaluate(() => { const f = document.getElementById('fail'); return f && !f.hidden ? f.textContent : null; });
  if (failed) throw new Error('page failed: ' + failed);
  return { page, context, errors, close: () => context.close() };
}

/* the frame in the texture the renderer last drew into, top row first */
export async function grab(page, file) {
  const r = await page.evaluate(async () => {
    const G = window.__gpuCanvas; if (!G || !G.texture()) return null;
    const d = G.device(), t = G.texture(), w = t.width, h = t.height, row = Math.ceil(w * 4 / 256) * 256;
    const buf = d.createBuffer({ size: row * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const e = d.createCommandEncoder(); e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: row }, [w, h]); d.queue.submit([e.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(buf.getMappedRange()), out = new Uint8ClampedArray(w * h * 4), bgra = /^bgra/.test(G.format());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = y * row + x * 4, o = (y * w + x) * 4; out[o] = src[s + (bgra ? 2 : 0)]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + (bgra ? 0 : 2)]; out[o + 3] = 255; }
    buf.unmap(); buf.destroy();
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
    return { w, h, png: c.toDataURL('image/png').split(',')[1] };
  });
  if (!r) return null;
  const png = Buffer.from(r.png, 'base64');
  if (file) fs.writeFileSync(file, png);
  return R.decode(png);
}
