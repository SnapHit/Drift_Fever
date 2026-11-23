/* THE BOOT, 23 November 2026, after the author saw it on his phone: for
   about half a second after typing driftfever.com the race HUD stood on
   an empty screen (0 POINTS, 0 KM/H, the touch buttons, DRIFT / BRAKE)
   before the title came, "like a splash screen but ugly, and it makes
   no sense". Now nothing of a run shows until a run starts, and the
   title is drawn the moment the game's code runs, with the 3D backdrop
   coming in behind it when the renderer has started.

   The page is opened as a visitor's phone opens it, on WebGPU (the
   sandbox's, game/test/webgpu/lib.js; on the WebGL 2 fallback here the
   renderer starts inside one task, so nothing is ever painted between
   the code running and the game being ready, and there is nothing to
   see), from an empty profile, as a phone with touch and as a desktop.
   A watcher put in before the page runs looks every 10 ms, until the
   game says it is ready, at what a player could see: the HUD, the touch
   buttons, the title. A press on the title before the game is ready is
   kept and acted on once it is (career track 1 starts).
   Known answer: main as it was before this change (23cfd99, from git)
   shows the HUD while it boots, and is caught.

   node game/test/start/boot.js [--ref <commit>]   writes review/start/boot.json */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ARGS, FAKE } from '../webgpu/lib.js';   // the WebGPU backend in the sandbox, for both sides

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..', '..', '..'), repo = path.resolve(root, '..');
const args = process.argv.slice(2), ref = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : '23cfd99';   // main before this change
const SIZES = { phone: { width: 390, height: 844, touch: true }, desktop: { width: 1280, height: 720, touch: false } };

/* what a player could see, looked at every 10 ms until window.__ready */
const WATCH = `(function () {
  const seen = window.__boot = { hud: 0, touch: 0, title: 0, firstTitle: null, looks: 0, pressed: null };
  const shows = el => !!el && !el.classList.contains('hidden') && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const t0 = performance.now();
  const look = () => {
    if (window.__ready === true) { clearInterval(id); return; }
    seen.looks++;
    if (shows(document.getElementById('hud'))) seen.hud++;
    if (shows(document.getElementById('touch'))) seen.touch++;
    if (document.querySelector('#screens.on .screen.title')) { seen.title++; if (seen.firstTitle === null) seen.firstTitle = Math.round(performance.now() - t0); }
  };
  const id = setInterval(look, 10);
  document.addEventListener('DOMContentLoaded', look);
  /* the press before the game is ready: made from inside the page the moment start here is drawn (a
     mutation observer runs before the page yields), not raced from outside, which in the sandbox's
     boot of a few tens of milliseconds often came too late */
  if (window.__pressEarly) {
    const mo = new MutationObserver(() => {
      if (seen.pressed) return;
      const b = document.querySelector('#screens.on .screen.title [data-action="first"]');
      if (!b) return;
      seen.pressed = { readyAtPress: window.__ready === true };
      b.click(); mo.disconnect();
    });
    mo.observe(document, { childList: true, subtree: true });   // the document itself: before the page runs it has no root element yet
  }
})();`

/* asked of the page every few ms, not by Playwright's own polling, which waits on a frame the stubbed loop never gives */
async function until(page, fn, ms, every = 100) {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise(r => setTimeout(r, every))) if (await page.evaluate(fn).catch(() => false)) return true;
  return false;
}

async function side(dir, name, opts) {
  const S = await import(pathToFileURL(path.join(dir, 'game', 'test', 'feel', 'serve.js')).href + '?' + name);
  const { chromium } = await import('playwright');
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH, exe = base && fs.existsSync(base) ? fs.readdirSync(base).map(d => path.join(base, d, 'chrome-linux', 'chrome')).find(p => p.includes('chromium-') && fs.existsSync(p)) : undefined;
  const { server, url } = await S.serveGame();
  const launch = () => chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...ARGS] });
  const out = {};
  let browser = null;
  try {
    /* a browser of its own for each page: in software a second page in the same browser often never gets a WebGPU device */
    for (const [size, vp] of Object.entries(SIZES)) for (let attempt = 0; ; attempt++) {
      if (browser) await browser.close().catch(() => {});
      browser = await launch();
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: vp.touch, isMobile: vp.touch });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
      await page.addInitScript(FAKE);
      if (opts.press && size === 'phone') await page.addInitScript('window.__pressEarly = true;');
      await page.addInitScript(WATCH);
      await page.goto(url, { waitUntil: 'commit', timeout: 120000 });
      const press = opts.press && size === 'phone';
      /* in software a WebGPU page now and then never gets its device: given up after 90 s and opened again, three times at most */
      const came = await until(page, () => window.__ready === true || (document.getElementById('fail') && !document.getElementById('fail').hidden), 90000);
      if (!came) { await ctx.close(); if (attempt >= 2) throw new Error(name + ' ' + size + ': the page never became ready'); console.log('(' + name + ' ' + size + ': again, the WebGPU device never came)'); continue; }
      if (press) await until(page, () => window.__loop && window.__loop.app.state !== 'title', 30000);
      const boot = await page.evaluate(() => window.__boot);
      const pressed = press ? { ...(boot.pressed || { readyAtPress: null }), stateAfter: await page.evaluate(() => window.__loop.app.state) } : null;
      const after = await page.evaluate(() => ({ title: !!document.querySelector('#screens.on .screen.title'), state: window.__loop ? window.__loop.app.state : null, backend: window.__feel && window.__feel.scene ? window.__feel.scene.info().backend : null }));
      out[size] = { ...boot, pressed, after, errors };
      await ctx.close();
      break;
    }
  } finally { if (browser) await browser.close().catch(() => {}); server.close(); }
  return out;
}

let fails = 0;
const ok = (name, pass, detail) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name + ': ' + detail); };
const now = await side(root, 'here', { press: true });
for (const [size, r] of Object.entries(now)) {
  ok(size + ': the race HUD never shows while the game boots', r.looks > 0 && r.hud === 0, r.hud + ' of ' + r.looks + ' looks');
  ok(size + ': nor the touch buttons', r.touch === 0, r.touch + ' of ' + r.looks + ' looks');
  ok(size + ': the title shows before the game is ready', r.title > 0, r.title + ' of ' + r.looks + ' looks' + (r.firstTitle !== null ? ', first at ' + r.firstTitle + ' ms of the watch' : ''));
  ok(size + ': no page errors, on WebGPU', r.errors.length === 0 && r.after.backend === 'webgpu', (r.errors.join(' | ') || 'none') + ', backend ' + r.after.backend);
  if (r.pressed) ok(size + ': a press on start here before the game is ready starts career track 1 once it is', r.pressed.readyAtPress === false && /countdown|drive/.test(r.pressed.stateAfter), (r.pressed.readyAtPress === null ? 'never pressed' : 'pressed with the game ' + (r.pressed.readyAtPress ? 'already ready (not a test of the wait)' : 'not ready')) + ', then state ' + r.pressed.stateAfter);
  else ok(size + ': still on the title once ready', r.after.title && r.after.state === 'title', 'state ' + r.after.state);
}

/* the known answer: main before this change, from git */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-'));
execFileSync('sh', ['-c', `git -C "${repo}" archive ${ref} crazygames music 2>/dev/null | tar -x -C "${tmp}" || git -C "${repo}" archive ${ref} crazygames | tar -x -C "${tmp}"`]);
fs.symlinkSync(fs.realpathSync(path.join(root, 'node_modules')), path.join(tmp, 'crazygames', 'node_modules'));
const then = await side(path.join(tmp, 'crazygames'), 'then', { press: false });
const caught = then.phone.hud > 0 && then.phone.touch > 0 && then.phone.title === 0;
ok('known answer: main before the change (' + ref + ') shows the HUD and the touch buttons while it boots, and no title', caught, 'on the phone the HUD in ' + then.phone.hud + ', the touch buttons in ' + then.phone.touch + ' and the title in ' + then.phone.title + ' of ' + then.phone.looks + ' looks; on the desktop the HUD in ' + then.desktop.hud + ' of ' + then.desktop.looks + ': ' + (caught ? 'CAUGHT' : 'MISSED'));
fs.rmSync(tmp, { recursive: true, force: true });

const dir = path.join(root, 'review', 'start'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'boot.json'), JSON.stringify({ ref, now, then }, null, 1));
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
