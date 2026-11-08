/* SHARED BY THE RETENTION PROBES. The loop probes' harness (headless
   Chromium through the dev server, the frame loop stubbed, the page
   advanced by window.__feel.frame at a synthetic 60 Hz), plus a page
   opener that clears the save before the game loads (a first visit) and
   counts real clicks on the page. */
import path from 'node:path';
import * as L from '../loop/lib.js';

export const { start, runFrames, stat, writeJson, PORTRAIT, LANDSCAPE, root, COLLECT, beginRun, driveToResults, saveState, saveStatus } = L;
export const reviewDir = path.join(L.root, 'review', 'retention');
export const SMALL = { width: 800, height: 450 };          // CrazyGames' smallest 16:9 frame
export const PHONE_LANDSCAPE = { width: 844, height: 390 };

const INIT = `(function () {
  window.requestAnimationFrame = function () { return 0; };
  window.cancelAnimationFrame = function () {};
})();`;

/* A page. opts.firstVisit clears localStorage before the game loads;
   opts.touch gives the context a touch screen; opts.query adds to the
   query string. Every real click on the page is counted in
   window.__clicks, so a probe can say how many it took to reach
   gameplay. */
export async function openPage(env, viewport, opts) {
  const o = opts || {};
  const context = await env.browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!o.touch });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  /* a first visit clears the save once per tab (the init script runs on every load, a reload included) */
  await page.addInitScript(INIT + (o.firstVisit ? `try { if (!sessionStorage.getItem('probe-cleared')) { localStorage.clear(); sessionStorage.setItem('probe-cleared', '1'); } } catch (e) {}` : '') + `window.__clicks = 0; window.addEventListener('click', function () { window.__clicks++; }, true);`);
  const q = 'renderer=webgl2' + (o.query ? '&' + o.query : '');
  await page.goto(env.url + '?' + q, { waitUntil: 'load', timeout: 120000 });
  await waitReady(page);
  return { page, context, errors, close: () => context.close() };
}

export async function waitReady(page) {
  await page.waitForFunction(() => window.__ready === true || (document.getElementById('fail') && !document.getElementById('fail').hidden), null, { timeout: 120000 });
  const failed = await page.evaluate(() => { const f = document.getElementById('fail'); return f && !f.hidden ? f.textContent : null; });
  if (failed) throw new Error('page failed: ' + failed);
}

/* Reload the page as the same device (the save kept) and wait for it. */
export async function reload(page) {
  await page.reload({ waitUntil: 'load', timeout: 120000 });
  await waitReady(page);
}

/* Run frames until the car moves faster than 1 m/s or the budget runs
   out; returns the frame it moved on, or -1. */
export async function framesUntilMoving(page, budget) {
  const frames = await runFrames(page, budget, 'return +window.__feel.world.car.speed.toFixed(2);');
  return frames.findIndex(v => v > 1);
}

export const clicks = page => page.evaluate(() => window.__clicks);
export const onboardState = page => page.evaluate(() => { const o = window.__loop.onboard; return { active: o.active, visible: o.visible(), step: o.state.step, shown: o.state.shown.slice(), done: { ...o.state.done }, skipped: o.state.skipped, skipShown: !document.getElementById('skip').hidden && !o.el.hidden }; });

/* A TEST DRIVER THAT HUGS THE CLIP WALLS. The game's scripted drivers
   (physics/driver.js, which this brief leaves alone) follow the centre
   line, so they never come within the proximity distance of a clipping
   zone. This one is pure pursuit like them, but inside a clipping zone
   (and a little before it) it aims at a line clipGap metres off the
   judged wall, throws the car into a slide with the handbrake at the
   zone's entry and holds the throttle through it, steering by the
   direction of travel as the drifter does. It runs in the page, written
   over window.__loop.app.driver, and writes the same input record. */
export const CLIPPER_SRC = `
  const ground = window.__loop.app.ground, C = ground.centre, n = C.length;
  const o = Object.assign({ lead: 14, hb: 0.45, clipGap: 1.0, vmax: 30, ay: 7, entry: 19, plan: 1.6 }, opts || {});
  const curvature = new Float64Array(n), turn = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = C[(i - 1 + n) % n], b = C[(i + 1) % n];
    let d = b.heading - a.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    curvature[i] = Math.abs(d) / 4; turn[i] = d > 0 ? 1 : d < 0 ? -1 : 0;
  }
  let hbUntil = -1, inZone = false;
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  return { input(world) {
    const car = world.car, v = car.speed, s = world.along;
    let clip = null;
    for (const c of ground.clips) if (s >= c.from - o.lead && s <= c.to) { clip = c; break; }
    const active = !!clip;
    if (active && !inZone) hbUntil = world.time + o.hb;
    inZone = active;
    const look = 5 + (active ? 0.3 : 0.42) * v;
    const ti = (world.centreIndex + Math.round(look / 2)) % n, t = C[ti];
    let tx = t.x, tz = t.z;
    if (active) { const off = Math.max(0, t.width / 2 - 0.92 - o.clipGap) * (clip.side === 'left' ? 1 : -1); tx += -Math.cos(t.heading) * off; tz += Math.sin(t.heading) * off; }
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), lx = -Math.cos(car.yaw), lz = Math.sin(car.yaw);
    const dx = tx - car.x, dz = tz - car.z;
    let steer = clamp(-Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz) * 2.4, -1, 1);
    const planM = Math.max(14, v * o.plan);
    let kmax = 0;
    for (let k = 0; k <= planM / 2; k++) { const c = curvature[(world.centreIndex + k) % n]; if (c > kmax) kmax = c; }
    const vDes = Math.min(o.vmax, kmax > 1e-4 ? Math.sqrt(o.ay / kmax) : o.vmax);
    let throttle = v < vDes ? 1 : 0, brake = v > vDes + 1.5 ? Math.min(1, (v - vDes - 1.5) / 4) : 0, handbrake = 0;
    if (!active) {
      let ahead = Infinity;
      for (const c of ground.clips) { let a = c.from - o.lead - s; if (ground.kind === 'circuit') a = ((a % ground.length) + ground.length) % ground.length; if (a >= 0 && a < ahead) ahead = a; }
      if (ahead < 60) { if (v > o.entry + 1) { throttle = 0; brake = 0.5; } else if (v < o.entry - 1) { throttle = 1; brake = 0; } }
    } else {
      const psiV = Math.atan2(-car.wvx, -car.wvz), psiT = Math.atan2(-dx, -dz);
      let diff = psiT - psiV; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
      let ds = -diff * 3;
      const into = -turn[world.centreIndex];
      if (ds * into > 0 && Math.abs(ds) < 0.3) ds = into * 0.3;
      steer = clamp(ds, -1, 1); throttle = 1; brake = 0;
      if (world.time < hbUntil) { handbrake = 1; steer = into || (steer > 0 ? 1 : -1); }
    }
    return { steer, throttle, brake, handbrake };
  } };
`;
export const installClipper = (page, opts) => page.evaluate(([src, opts]) => { window.__loop.app.driver = new Function('opts', src)(opts); }, [CLIPPER_SRC, opts || null]);

/* THE LAB'S LAYOUT. Every control on the Lab screen must be reachable
   and never under the NEW LAYOUT / DRIVE bar at any scroll position.
   Runs in the page: for every control, scroll it into view and ask
   document.elementFromPoint at its centre for the control itself; then
   step every scroll box through its range and look for any control
   whose box meets the bar's; then at the scroll end check the last
   control clears the bar. Also: is the code row (the code and COPY) on
   screen before any scrolling. */
export const LAB_LAYOUT_SRC = `
  const screen = document.querySelector('.screen.lab');
  const bar = document.querySelector('.screen.lab .row2');
  const controls = [...screen.querySelectorAll('[data-action], input')].filter(el => el.tagName !== 'FORM' && !bar.contains(el));
  const scrollers = [...screen.querySelectorAll('*'), document.getElementById('screens')].filter(el => el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
  const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; };
  const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  /* the part of a control that can be seen: its box cut to every scroll box it is inside (a control scrolled out of its box is clipped, not under the bar) */
  const seen = el => { let r = rect(el); for (let a = el.parentElement; a; a = a.parentElement) { if (!scrollers.includes(a)) continue; const c = rect(a); r = { left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) }; } return r.right > r.left && r.bottom > r.top ? r : null; };
  for (const s of scrollers) s.scrollTop = 0;
  const vis = el => { const r = rect(el); const hit = document.elementFromPoint(r.left + r.w / 2, r.top + r.h / 2); return !!hit && (hit === el || el.contains(hit)); };
  const codeVisible = vis(screen.querySelector('.code')) && vis(screen.querySelector('[data-action="lab-copy"]'));
  const reach = controls.map(el => { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const ok = vis(el); return { what: el.dataset.action || el.id || el.tagName, arg: el.dataset.arg || '', ok }; });
  const barRect = rect(bar);
  let underBar = 0;
  const positions = [];
  for (const s of scrollers) { for (let y = 0; y <= s.scrollHeight - s.clientHeight + 1; y += 24) { s.scrollTop = y; positions.push(y); for (const el of controls) { const v = seen(el); if (v && meets(v, rect(bar))) underBar++; } } s.scrollTop = s.scrollHeight; }
  if (!scrollers.length) for (const el of controls) if (meets(rect(el), rect(bar))) underBar++;
  const lowest = Math.max(...controls.map(el => { const v = seen(el); return v ? v.bottom : -Infinity; }));
  const clearsBar = lowest <= rect(bar).top + 0.5;
  for (const s of scrollers) s.scrollTop = 0;
  return { controls: controls.length, scrollers: scrollers.length, positionsTried: positions.length, codeVisible, unreachable: reach.filter(r => !r.ok), underBar, clearsBar, lowestControlBottom: +lowest.toFixed(1), barTop: +barRect.top.toFixed(1), ok: codeVisible && reach.every(r => r.ok) && underBar === 0 && clearsBar };
`;
export const labLayout = page => page.evaluate(new Function(LAB_LAYOUT_SRC));
/* the layout before 9 November 2026: a sticky bar inside the scrolling screen, which covered the controls under it */
export const OLD_LAB_CSS = `.screen.lab { height: auto !important; overflow: visible !important; } .labgrid { overflow: visible !important; flex: none !important; display: grid !important; grid-template-rows: none !important; } .labctl { overflow: visible !important; height: auto !important; } .planbox { height: auto !important; aspect-ratio: 1.25 / 1 !important; max-height: 34vh !important; } .lab .row2 { position: sticky !important; bottom: 0 !important; z-index: 1 !important; padding: 8px 0 4px !important; background: rgba(14,16,30,0.92) !important; }`;
