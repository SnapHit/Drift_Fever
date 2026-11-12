/* LADDER2 MEASURE 6 (briefs/RIVALS-LADDER-2.md): A NEW PLAYER, END TO
   END, BY REAL INPUT ONLY.

   The game as it ships: `npm run build` (the parity check, then dist/),
   dist/ served from 127.0.0.1 as the Worker serves it, no query in the
   address, in headless Chromium (software WebGL 2, the sandbox has no
   GPU). Each profile is a new, empty browser context (no storage, no
   cookies: what an incognito window is).
   - phone: 390x844, touch (a mobile context with a touch screen); every
     action is a tap or a held touch sent through the browser's own
     touch input (CDP Input.dispatchTouchEvent), so the page sees real
     pointer events;
   - desktop: 1280x720, keys for driving (the browser's own key events)
     and the mouse for the menus.
   The browser's clock is Playwright's (page.clock), paused and advanced
   one 16 ms frame at a time, so the game runs its own frame loop exactly
   as it does on a device, frame by frame, and the same inputs at the
   same frames give the same run.

   THE DRIVING. A new player's thumbs are scripted, as the brief allows:
   1. rehearsal: in a throwaway empty context, the journey is driven by
      a scripted player (rivals/players.js, the mixed player, a player's
      hands) reading the car each frame; its wish is turned into what a
      thumb can do (left, right or neither, DRIFT held or not: the steer
      through a sigma delta, so a half turn is the button pressed every
      other frame) and sent as real touches or keys, and every press and
      release is written down with its frame;
      The desktop plays the phone's rehearsal as keys (the game reads the
      same steer and DRIFT from either), unless --rehearse-all;
   2. the test: in a new empty context, the journey again, and in every
      run the recorded presses and releases are sent at their frames.
      Nothing in the test reads the game to decide an input. Menus are
      tapped where their buttons are drawn, once they are on screen. The
      game is read only to report what happened (its state, the
      onboarding's prompts, the score, the save), and the run's result
      is compared with the rehearsal's.

   THE JOURNEY, each step with a frame (review/ladder2/shots/np-*):
   the first visit lands in the onboarding run (career track 1, prompts);
   its prompts appear; the run ends in results; then by taps alone: the
   title, the career, a run of track one, its results with the offer of
   Kestrow once a star is won, the race, its results, the rivals screen
   and back to the title; then a second visit in the same profile lands
   on the title with the progress kept.
   On every screen: no page error, no console error, no request to
   another host (and no failed request), no two buttons or a button and
   a heading overlapping, no button outside the view, and the title does
   not scroll.
   The time from load to the first playable frame is measured in a third
   empty context on the real clock (software drawing: a sandbox number).
   Known answer: a profile whose storage holds a returning player's save
   (the one main wrote, review/ladder2/main.json) does not land in the
   onboarding run, so the first-visit check fails.

   node game/test/ladder2/newplayer.js [--only phone|desktop] [--no-build] [--origin https://host]   writes review/ladder2/newplayer.json and shots/np-*.png */
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..', '..', '..');
const dist = path.join(root, 'dist');
const args0 = process.argv.slice(2), LIVE = args0.includes('--origin') ? args0[args0.indexOf('--origin') + 1].replace(/\/+$/, '') : null;   // --origin: the deployed build at that address, not dist/ (written beside, to live/, so the local record stays)
const outDir = path.join(root, 'review', 'ladder2', LIVE ? 'live' : ''), shots = path.join(outDir, 'shots');
fs.mkdirSync(shots, { recursive: true });
const args = process.argv.slice(2), only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
export const NP = { FRAME_MS: 16, RUN_FRAMES: 60 * 240, WAIT_FRAMES: 60 * 20, KIND: 'mixed' };   // a frame of the browser's clock; the most frames a run or a wait may take; the scripted player rehearsed

let failed = 0;
const verdict = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; };

/* ---- the build as it ships, served as the Worker serves dist/ ---- */
if (!LIVE && !args.includes('--no-build')) execSync('npm run build', { cwd: root, stdio: 'inherit' });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const p = path.normalize(path.join(dist, u));
  if (!p.startsWith(dist) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  res.end(fs.readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = LIVE || 'http://127.0.0.1:' + server.address().port;
const URL0 = origin + '/';

function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium-') && fs.existsSync(p)) return p; }
  return undefined;
}
const browser = await chromium.launch({ executablePath: findChromium(), headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

const PROFILES = {
  phone: { vp: { width: 390, height: 844 }, touch: true, ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } },
  desktop: { vp: { width: 1280, height: 720 }, touch: false, ctx: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } },
};

/* ---- what is read, only to report ---- */
const READ = () => {
  const L = window.__loop, A = L && L.app;
  if (!A) return { state: 'loading' };
  const ob = document.getElementById('onboard'), pr = ob && ob.querySelector('.prompt'), inf = ob && ob.querySelector('.info');
  const s = window.__feel.scoring.state, R = A.results;
  return { state: A.state, mode: A.spec ? A.spec.mode : null, index: A.spec ? A.spec.index : null, rival: A.rival ? A.rival.def.id : null, onboard: !!(L.onboard && L.onboard.active), prompt: pr && !pr.hidden && !ob.hidden ? pr.innerText.replace(/\s+/g, ' ').trim() : '', info: inf && !inf.hidden && !ob.hidden ? inf.innerText.replace(/\s+/g, ' ').trim() : '', total: s.total, screen: (document.querySelector('#screens .screen') || {}).className || '', results: R ? { score: R.score, stars: R.stars, rival: R.rival ? R.rival.total : null, won: R.won, offer: R.offer ? R.offer.id : null } : null };
};
/* the screen as drawn: buttons, headings, overlaps, outside the view, the page's scroll */
const LAYOUT = () => {
  const box = e => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height }; };
  const meets = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
  const shown = e => { if (!e) return false; for (let n = e; n && n !== document.body; n = n.parentElement) { const st = getComputedStyle(n); if (st.display === 'none' || st.visibility === 'hidden' || n.hidden) return false; } const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0; };
  const W = innerWidth, H = innerHeight, inside = a => a.l >= -0.5 && a.t >= -0.5 && a.r <= W + 0.5 && a.b <= H + 0.5;
  const name = e => ((e.innerText || e.getAttribute('aria-label') || e.id || e.className || e.tagName) + '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const scr = document.getElementById('screens'), s = scr && scr.querySelector('.screen');
  const onScreen = s && shown(s);
  const btns = [...document.querySelectorAll('button')].filter(shown);
  const lists = [...document.querySelectorAll('.list')];
  const inList = b => lists.some(l => l.contains(b));
  const heads = [...document.querySelectorAll('h1, h2, .prompt, .info, #hud .count, p.rule')].filter(shown);
  const out = { W, H, screen: onScreen ? s.className : 'run', buttons: btns.length, clash: [], outside: [], small: [], pageScrolls: false };
  out.pageScrolls = document.scrollingElement.scrollHeight > H + 1 || (onScreen && scr.scrollHeight > scr.clientHeight + 1);
  for (let i = 0; i < btns.length; i++) {
    const a = box(btns[i]);
    if (!inList(btns[i]) && !inside(a)) out.outside.push(name(btns[i]));
    if (a.w < 43.5 || a.h < 43.5) out.small.push(name(btns[i]) + ' ' + Math.round(a.w) + 'x' + Math.round(a.h));
    for (let j = i + 1; j < btns.length; j++) if (!btns[i].contains(btns[j]) && !btns[j].contains(btns[i]) && meets(a, box(btns[j])) && !(inList(btns[i]) && inList(btns[j]) && false)) out.clash.push(name(btns[i]) + ' / ' + name(btns[j]));
    for (const h of heads) if (!h.contains(btns[i]) && !btns[i].contains(h) && meets(a, box(h))) out.clash.push(name(btns[i]) + ' / ' + name(h));
  }
  /* a list's buttons: inside the list's box once scrolled to, and inside the view across */
  for (const l of lists) for (const b of l.querySelectorAll('button')) { if (!shown(b)) continue; const a = box(b), lb = box(l); if (a.l < lb.l - 0.5 || a.r > lb.r + 0.5 || a.l < -0.5 || a.r > W + 0.5) out.outside.push(name(b)); }
  return out;
};

/* ---- one profile, rehearsed or tested ---- */
async function journey(profileName, mode, tapes, opts) {
  const P = PROFILES[profileName], o = opts || {};
  /* a rehearsal may run at a smaller window (o.ctx): the physics does not read the window, and the test's comparison with it says so */
  const context = await browser.newContext(o.ctx || P.ctx);
  if (o.seed) await context.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('np-seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('np-seeded', '1'); } } catch (e) {} }, o.seed);
  const log = { profile: profileName, mode, steps: [], errors: [], requests: { total: 0, otherHost: [], failed: [] }, runs: [] };
  const watch = page => {
    page.on('pageerror', e => log.errors.push({ at: log.steps.length, text: 'pageerror: ' + String(e) }));
    page.on('console', m => { if (m.type() === 'error') log.errors.push({ at: log.steps.length, text: 'console: ' + m.text() }); });
    page.on('request', r => { log.requests.total++; const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) log.requests.otherHost.push(u); });
    page.on('requestfailed', r => log.requests.failed.push(r.url() + ' ' + (r.failure() && r.failure().errorText) + ' (after step ' + log.steps.length + (log.steps.length ? ', ' + log.steps[log.steps.length - 1].name : '') + ')'));
    page.on('response', r => { if (r.status() >= 400) log.requests.failed.push(r.url() + ' ' + r.status()); });
  };
  let page = await context.newPage();
  watch(page);
  await page.clock.install({ time: new Date('2026-11-12T09:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-12T09:00:01Z'));
  let cdp = await context.newCDPSession(page);
  let frameNo = 0;
  const tick = async n => { for (let k = 0; k < (n || 1); k++) { await page.clock.runFor(NP.FRAME_MS); frameNo++; } };
  const read = () => page.evaluate(READ);
  const layout = () => page.evaluate(LAYOUT);
  let shotN = 0;
  async function step(name, what, extra) {
    /* a results card counts its score, stars and coins up: two seconds to settle before the frame, as a player would see it */
    if (/results$/.test(name)) await tick(120);
    console.log('   ' + mode + ' step ' + name + ' at frame ' + frameNo + ' (' + new Date().toISOString().slice(11, 19) + ')');
    const st = await read(), lay = await layout();
    const file = 'np-' + profileName + '-' + String(++shotN).padStart(2, '0') + '-' + name + '.png';
    /* through the protocol: Playwright's own screenshot waits on an animation frame, which the paused clock never gives */
    if (mode === 'test') { const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(shots, file), Buffer.from(r.data, 'base64')); }
    const e = { name, what, frame: frameNo, state: st.state, screen: lay.screen, prompt: st.prompt, info: st.info, results: st.results, layout: lay, errorsSoFar: log.errors.length, shot: mode === 'test' ? file : null, ...(extra || {}) };
    log.steps.push(e);
    return e;
  }
  /* wait, frame by frame, for something to be on screen (reading only what is drawn: a button's presence) */
  async function waitFor(sel, max) {
    for (let k = 0; k < (max || NP.WAIT_FRAMES); k++) {
      const ok = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0 && !e.disabled; }, sel);
      if (ok) return true;
      await tick();
    }
    return false;
  }
  async function tapSel(sel) {
    if (!(await waitFor(sel))) throw new Error('not on screen: ' + sel);
    const q = await page.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    await tick();
    if (P.touch) await page.touchscreen.tap(q.x, q.y); else await page.mouse.click(q.x, q.y);
    await tick();
  }

  /* ---- the thumbs ---- */
  const held = { left: 0, right: 0, hb: 0 };
  let pads = null;
  const KEY = { left: 'ArrowLeft', right: 'ArrowRight', hb: 'Space' };
  async function press(name, down) {
    if (held[name] === (down ? 1 : 0)) return;
    held[name] = down ? 1 : 0;
    if (!P.touch) { if (down) await page.keyboard.down(KEY[name]); else await page.keyboard.up(KEY[name]); return; }
    if (!pads) pads = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#touch button')].map(b => { const r = b.getBoundingClientRect(); return [b.dataset.b, { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }]; })));
    /* a finger down: touchStart with every finger now on the glass; a finger up: touchEnd with that finger */
    const ID = { left: 1, right: 2, hb: 3 }, pt = k => ({ x: pads[k].x, y: pads[k].y, id: ID[k] });
    if (down) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: Object.keys(held).filter(k => held[k]).map(pt) });
    else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [pt(name)] });
  }
  async function releaseAll() { for (const k of ['left', 'right', 'hb']) await press(k, false); }
  /* the rehearsal's scripted player, in the page: its wish for this frame, as a thumb can give it */
  const WISH = kind => {
    const L = window.__loop, A = L.app, np = window.__np;
    if (A.state !== 'drive' || A.settle > 0) { return { left: 0, right: 0, hb: 0 }; }
    if (!np.p || np.run !== A.world) {
      np.run = A.world; np.e = 0;
      np.p = np.mod.createPlayer(A.ground, kind, null, () => { const r = L.rival(); return r && r.solid() ? r.world.car : null; }, { index: A.spec.index || 0, car: 'starter', up: null });
    }
    let inp = null;
    for (let k = 0; k < 2; k++) inp = np.p.input(A.world);   // a frame is about two physics steps
    np.e += inp.steer;
    const q = np.e > 0.5 ? 1 : np.e < -0.5 ? -1 : 0;
    np.e -= q;
    return { left: q < 0 ? 1 : 0, right: q > 0 ? 1 : 0, hb: inp.handbrake ? 1 : 0 };
  };
  async function drive(name) {
    /* from the frame the run's countdown is on screen to its results */
    const tape = mode === 'test' ? tapes[log.runs.length] : [];
    if (mode === 'rehearse') await page.evaluate(async () => { window.__np = window.__np || { e: 0 }; window.__np.mod = await import('/src/rivals/players.js'); window.__np.p = null; });
    /* the presses are counted from the frame GO is drawn (the HUD's count reads GO), as a player starts on GO: the countdown's frames before it can differ by one between two loads */
    const begun = frameNo;
    for (let w = 0; w < NP.WAIT_FRAMES && !(await page.evaluate(() => { const c = document.getElementById('count'); return !!(c && c.classList.contains('go') && c.textContent === 'GO'); })); w++) await tick();
    const goAfter = frameNo - begun;
    const start = frameNo, prompts = [], seen = new Set();
    let ti = 0, st = null, k = 0;
    for (; k < NP.RUN_FRAMES; k++) {
      const f = frameNo - start;
      if (mode === 'rehearse') {
        const w = await page.evaluate(WISH, NP.KIND);
        for (const n of ['left', 'right', 'hb']) if (w[n] !== held[n]) { tape.push([f, n, w[n]]); await press(n, !!w[n]); }
      } else {
        while (ti < tape.length && tape[ti][0] === f) { await press(tape[ti][1], !!tape[ti][2]); ti++; }
      }
      await tick();
      st = await read();
      for (const t of [st.prompt, st.info]) if (t && !seen.has(t)) { seen.add(t); prompts.push({ frame: frameNo - start, text: t }); if (mode === 'test') await step(name + '-prompt' + prompts.length, 'a prompt appears: ' + t); }
      if (st.state === 'results' && st.results) break;
      if (k % 600 === 0) console.log('   ' + mode + ' ' + name + ' frame ' + k + ': ' + st.state + ', ' + Math.round(st.total) + ' points (' + new Date().toISOString().slice(11, 19) + ')');
    }
    if (mode === 'rehearse') { for (const n of ['left', 'right', 'hb']) if (held[n]) tape.push([frameNo - start, n, 0]); }
    await releaseAll();
    const r = { name, frames: frameNo - start, goAfter, results: st && st.results, prompts, presses: tape.length };
    log.runs.push(r);
    if (mode === 'rehearse') r.tape = tape;
    return r;
  }

  try {
    await page.goto(URL0, { waitUntil: 'load', timeout: 120000 });
    for (let k = 0; k < 600 && !(await page.evaluate(() => window.__ready === true || !document.getElementById('fail').hidden)); k++) await tick();
    await tick(2);
    const first = await step('first-visit', 'the first visit, an empty profile, no click');
    first.landedInOnboarding = first.state === 'countdown' && !!(await read()).onboard;
    if (o.firstVisitOnly) { await context.close(); return log; }
    const ob = await drive('onboarding');
    await step('onboarding-results', 'the onboarding run ends in results');
    await tapSel('#screens [data-action="title"]');
    await step('title', 'the title, after the first run');
    await tapSel('#screens [data-action="career"]');
    await step('career', 'the career');
    await tapSel('#screens [data-action="play-career"][data-arg="0"]');
    await step('track1-start', 'a run of track one');
    const t1 = await drive('track1');
    const res1 = await step('track1-results', 'its results');
    res1.offer = await page.evaluate(() => { const b = document.querySelector('#screens .rivalgo'); return b ? b.innerText.replace(/\s+/g, ' ').trim() : null; });
    if (!res1.offer) throw new Error('no offer of Kestrow on the results of track one (' + JSON.stringify(t1.results) + ')');
    await tapSel('#screens .rivalgo');
    await step('race-start', 'the race against Kestrow');
    const race = await drive('race');
    await step('race-results', 'the race\'s results');
    await tapSel('#screens [data-action="rivals"]');
    await step('rivals', 'the rivals screen');
    await tapSel('#screens .rivals [data-action="title"]');
    await step('title-again', 'back to the title');
    const saveBefore = await page.evaluate(() => { const S = window.__loop.save; return { coins: S.data ? S.data.coins : null }; }).catch(() => null);
    void ob; void race; void saveBefore;
    /* the second visit: the same profile, the page opened again */
    await page.close();
    page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date('2026-11-12T10:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-12T10:00:01Z'));
    cdp = await context.newCDPSession(page); pads = null;
    await page.goto(URL0, { waitUntil: 'load', timeout: 120000 });
    for (let k = 0; k < 600 && !(await page.evaluate(() => window.__ready === true)); k++) await tick();
    await tick(2);
    const second = await step('second-visit', 'a second visit, the same profile');
    second.title = await page.evaluate(() => [...document.querySelectorAll('#screens .title .menu button')].map(b => b.innerText.replace(/\s+/g, ' ').trim()));
  } catch (e) {
    log.error = String(e && e.stack || e);
    try { await step('stopped', 'where the journey stopped: ' + String(e && e.message || e)); } catch (e2) {}
  }
  log.frames = frameNo;
  await context.close();
  return log;
}

/* ---- the time to the first playable frame, on the real clock ---- */
async function timing(profileName) {
  const P = PROFILES[profileName];
  const context = await browser.newContext(P.ctx);
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(URL0, { waitUntil: 'load', timeout: 120000 });
  const tLoad = Date.now() - t0;
  let tReady = null, tCount = null, tDrive = null;
  for (let k = 0; k < 2400 && tDrive === null; k++) {
    const s = await page.evaluate(() => ({ ready: window.__ready === true, state: window.__loop && window.__loop.app.state }));
    const t = Date.now() - t0;
    if (s.ready && tReady === null) tReady = t;
    if (s.state === 'countdown' && tCount === null) tCount = t;
    if (s.state === 'drive') tDrive = t;
    await new Promise(r => setTimeout(r, 25));
  }
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), transfer: n.transferSize } : null; });
  await context.close();
  return { profile: profileName, loadEventMs: tLoad, readyMs: tReady, countdownOnScreenMs: tCount, goMs: tDrive, nav };
}

const out = { url: URL0, note: LIVE ? 'the deployed build at ' + LIVE + '; headless Chromium, software WebGL 2 (SwiftShader); each profile a new empty context; the clock paused and advanced 16 ms a frame' : 'dist/ as npm run build makes it, served from 127.0.0.1; headless Chromium, software WebGL 2 (SwiftShader); each profile a new empty context; the clock paused and advanced 16 ms a frame', profiles: {} };
const mainSave = JSON.parse(fs.readFileSync(path.join(root, 'review', 'ladder2', 'main.json'), 'utf8')).save;
for (const name of Object.keys(PROFILES)) {
  if (only && only !== name) continue;
  /* the desktop plays the phone's rehearsed presses as keys: the game reads the same three inputs from either, so the runs are the same (the comparison below says so); --rehearse-all rehearses each profile */
  const prior = fs.existsSync(path.join(outDir, 'newplayer.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'newplayer.json'), 'utf8')).profiles || {} : {};
  const from = name !== 'phone' && !args.includes('--rehearse-all') ? (out.profiles.phone || prior.phone) : null;
  let reh;
  if (from) { console.log('== ' + name + ': the phone\'s rehearsal, its presses sent as keys'); reh = { runs: from.rehearsal.runs.map((r, k) => ({ ...r, tape: from.tapes[k] })), error: from.rehearsal.error, borrowed: 'phone' }; }
  else if (name === 'desktop') { console.log('== desktop: the rehearsal, keys, in a 390x844 window (drawn three times faster in software)'); reh = await journey(name, 'rehearse', null, { ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } }); reh.window = '390x844'; }
  else { console.log('== ' + name + ': the rehearsal'); reh = await journey(name, 'rehearse'); }
  const tapes = reh.runs.map(r => r.tape);
  console.log('   rehearsal: ' + reh.runs.map(r => r.name + ' ' + JSON.stringify(r.results) + ' in ' + r.frames + ' frames, ' + r.presses + ' presses').join('; ') + (reh.error ? ' :: stopped: ' + reh.error.split('\n')[0] : ''));
  console.log('== ' + name + ': the test');
  const log = await journey(name, 'test', tapes);
  const tm = await timing(name);
  const known = await journey(name, 'test', [], { seed: [mainSave.key, mainSave.blob], firstVisitOnly: true });
  const S = log.steps, by = n => S.find(s => s.name === n);
  const first = by('first-visit'), second = by('second-visit');
  const prompts = (log.runs[0] || { prompts: [] }).prompts;
  verdict(!log.error, name + ': the journey ran to its end' + (log.error ? ' :: ' + log.error.split('\n')[0] : ''));
  verdict(!!(first && first.landedInOnboarding), name + ': the first visit lands in the onboarding run (state ' + (first && first.state) + ')');
  verdict(prompts.length >= 3, name + ': the onboarding\'s prompts appear: ' + prompts.map(p => '"' + p.text + '" at frame ' + p.frame).join('; '));
  verdict(!!by('onboarding-results') && by('onboarding-results').state === 'results', name + ': the onboarding run ends in results (' + JSON.stringify(log.runs[0] && log.runs[0].results) + ')');
  for (const k of ['title', 'career', 'track1-results', 'race-results', 'rivals', 'title-again']) verdict(!!by(k), name + ': reached by taps alone: ' + k + (by(k) ? ' (' + by(k).screen + ')' : ''));
  const r1 = by('track1-results');
  verdict(!!(r1 && r1.offer), name + ': the results of track one offer Kestrow once a star is won: ' + (r1 ? JSON.stringify(r1.results) + ', offer ' + JSON.stringify(r1.offer) : 'not reached'));
  verdict(!!(second && second.state === 'title'), name + ': a second visit lands on the title (' + (second && second.state) + ') with the progress kept: ' + (second && second.title ? second.title.join(' | ') : ''));
  const same = log.runs.map((r, k) => ({ name: r.name, same: !!(reh.runs[k] && JSON.stringify(reh.runs[k].results) === JSON.stringify(r.results)) }));
  verdict(same.length === 3 && same.every(s => s.same), name + ': every run of the test played the rehearsal\'s presses to the rehearsal\'s result (' + same.map(s => s.name + ' ' + (s.same ? 'same' : 'DIFFERENT')).join(', ') + ')');
  verdict(log.errors.length === 0, name + ': no page error and no console error (' + log.errors.length + (log.errors.length ? ': ' + log.errors.slice(0, 3).map(e => e.text).join(' | ') : '') + ')');
  verdict(log.requests.otherHost.length === 0 && log.requests.failed.length === 0, name + ': ' + log.requests.total + ' requests, none to another host (' + log.requests.otherHost.length + '), none failed (' + log.requests.failed.length + (log.requests.failed.length ? ': ' + log.requests.failed.slice(0, 3).join(' | ') : '') + ')');
  const clashes = S.filter(s => s.layout.clash.length || s.layout.outside.length);
  verdict(clashes.length === 0, name + ': on every screen nothing overlaps and no button is outside the view (' + S.length + ' screens' + (clashes.length ? ': ' + clashes.slice(0, 4).map(s => s.name + ' ' + JSON.stringify({ clash: s.layout.clash.slice(0, 3), outside: s.layout.outside.slice(0, 3) })).join('; ') : '') + ')');
  const titles = S.filter(s => /title/.test(s.screen));
  verdict(titles.length > 0 && titles.every(s => !s.layout.pageScrolls), name + ': the title does not scroll (' + titles.length + ' times)');
  const kn = known.steps[0];
  verdict(kn && !(kn.state === 'countdown'), name + ': known answer: a profile holding a returning player\'s save does not land in the onboarding run (state ' + (kn && kn.state) + '), so the first-visit check fails on it: ' + (kn && kn.state !== 'countdown' ? 'CAUGHT' : 'MISSED'));
  console.log('   time to the first playable frame (real clock, software drawing): load event ' + tm.loadEventMs + ' ms, the game ready ' + tm.readyMs + ' ms, the countdown on screen ' + tm.countdownOnScreenMs + ' ms, GO ' + tm.goMs + ' ms');
  out.profiles[name] = { rehearsal: { runs: reh.runs.map(r => ({ name: r.name, results: r.results, frames: r.frames, presses: r.presses })), error: reh.error || null, borrowed: reh.borrowed || null }, test: { ...log, runs: log.runs }, tapes, timing: tm, knownAnswer: { state: kn && kn.state, caught: !!(kn && kn.state !== 'countdown') } };
}
/* the profiles not run this time are kept from the file */
const was = fs.existsSync(path.join(outDir, 'newplayer.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'newplayer.json'), 'utf8')) : null;
if (was && was.profiles) for (const k of Object.keys(was.profiles)) if (!out.profiles[k]) out.profiles[k] = was.profiles[k];
fs.writeFileSync(path.join(outDir, 'newplayer.json'), JSON.stringify(out, null, 1));
await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
