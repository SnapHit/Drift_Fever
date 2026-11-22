/* THE BENCH: ?bench=1 on any device measures how it draws a heavy moment
   of the game and shows the result on screen, to be sent back as a
   screenshot or copied as one line. Added 22 November 2026, after the
   CrazyGames rejection, because the frame rate on a real desktop
   graphics card had never been measured.

   What it runs: a race against BENCH.RIVAL (Varsk on Upper deck: a
   rival, lamps, smoke, trails, the full scenery), both cars driven by
   the scripted players, the countdown skipped. It measures the tier the
   device chose, then the other one, each for BENCH.MEASURE seconds
   after BENCH.WARM seconds to settle. Then it stops the race where it is.

   Nothing is saved: the race never reaches its line (it runs about 80 s
   and the bench stops it before 35), no prompts are shown, and the save
   is never written. ?adapt=0 on the link keeps the quality from stepping
   down mid measure; without it the bench says that it adapted.

   The numbers: frames from the browser's own frame clock, so a 120 Hz
   screen can show more than 60. Median fps, the slowest 1 per cent, the
   share of frames over 20 ms (under 50 fps, which a player sees as a
   stutter), and the game's own work per frame in milliseconds (the
   physics, the scene and the submission to the GPU; the GPU's own time
   is not in it). */

export const BENCH = {
  RIVAL:   'r3',    // Varsk on Upper deck
  WARM:    3,       // s to settle before each measure (a tier change rebuilds the world)
  MEASURE: 12,      // s measured on each tier
  SLOW_MS: 20,      // a frame longer than this counts as a stutter
};

/* h: { root, begin(), end(), tier() -> 'low'|'high', setTier(t), info() -> scene info, frameMs() -> the game's work last frame, adapt() -> adapt state } */
export function runBench(h) {
  const out = { when: new Date().toISOString(), gpu: gpuName(), screen: screenText(), tiers: [], done: false };
  window.__bench = out;
  const ui = overlay(h.root);
  h.begin();
  const first = h.tier(), order = first === 'high' ? ['high', 'low'] : ['low', 'high'];
  let leg = 0, t0 = -1, phase = 'warm', stamps = [], work = [];
  ui.status('Measuring the ' + order[0] + ' tier (this device chose it)...');
  function tick(t) {
    if (t0 < 0) t0 = t;
    const s = (t - t0) / 1000;
    if (phase === 'warm') {
      if (s >= BENCH.WARM) { phase = 'measure'; t0 = t; stamps = [t]; work = []; }
    } else {
      stamps.push(t); work.push(h.frameMs());
      if (s >= BENCH.MEASURE) {
        const info = h.info();
        out.tiers.push(summarise(order[leg], stamps, work, info, h.adapt()));
        leg++;
        if (leg < order.length) {
          h.setTier(order[leg]);
          phase = 'warm'; t0 = -1;
          ui.status('Measuring the ' + order[leg] + ' tier...');
        } else {
          h.setTier(first);
          h.end();
          out.done = true;
          ui.show(out);
          return;
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return out;
}

function quantile(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] : 0; }

function summarise(tier, stamps, work, info, adapt) {
  const d = [];
  for (let i = 1; i < stamps.length; i++) d.push(stamps[i] - stamps[i - 1]);
  const s = d.slice().sort((a, b) => a - b), w = work.slice().sort((a, b) => a - b);
  const med = quantile(s, 0.5), p99 = quantile(s, 0.99);
  return {
    tier,
    backend: info.backend,
    frames: d.length,
    fps: med > 0 ? Math.round(1000 / med) : 0,
    low1: p99 > 0 ? Math.round(1000 / p99) : 0,
    slowShare: d.length ? Math.round(1000 * d.filter(x => x > BENCH.SLOW_MS).length / d.length) / 10 : 0,
    workMs: Math.round(quantile(w, 0.5) * 10) / 10,
    workP95: Math.round(quantile(w, 0.95) * 10) / 10,
    drawCalls: info.drawCalls, triangles: info.triangles,
    pixelRatio: adapt.pixelRatio, bloom: adapt.bloom, adapted: adapt.level > 0 || adapt.steps.length > 0,
  };
}

function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'unknown';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return String(name || 'unknown');
  } catch (e) { return 'unknown'; }
}

function screenText() {
  const dpr = window.devicePixelRatio || 1;
  return innerWidth + 'x' + innerHeight + ' at ' + (Math.round(dpr * 100) / 100) + 'x, ' + (navigator.hardwareConcurrency || '?') + ' cores';
}

/* one line for the copy button and the probes */
export function benchLine(out) {
  return 'Drift Fever bench ' + out.when.slice(0, 16) + ' | ' + out.gpu + ' | ' + out.screen + ' | ' + out.tiers.map(t =>
    t.tier + ' ' + t.backend + ': ' + t.fps + ' fps, 1% low ' + t.low1 + ', ' + t.slowShare + '% over ' + BENCH.SLOW_MS + ' ms, work ' + t.workMs + '/' + t.workP95 + ' ms' + (t.adapted ? ' (adapted)' : '')).join(' | ');
}

function overlay(root) {
  const el = document.createElement('div');
  el.id = 'bench';
  el.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:50;max-width:min(92vw,560px);' +
    'padding:16px 18px;border-radius:14px;background:rgba(10,12,24,0.88);border:2px solid rgba(255,255,255,0.25);color:#fff;' +
    'font:14px/1.4 system-ui,sans-serif;text-align:left;pointer-events:auto;';
  root.appendChild(el);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return {
    status(text) { el.innerHTML = '<b style="font-size:16px">Drift Fever bench</b><br>' + esc(text) + '<br><small>About 35 seconds. Keep this tab in front.</small>'; },
    show(out) {
      const rows = out.tiers.map(t => '<tr><td><b>' + esc(t.tier) + '</b> ' + esc(t.backend) + '</td><td><b>' + t.fps + '</b> fps</td><td>1% low ' + t.low1 + '</td><td>' + t.slowShare + '% stutter</td><td>' + t.workMs + ' ms</td></tr>').join('');
      el.innerHTML = '<b style="font-size:16px">Drift Fever bench</b><br><small>' + esc(out.gpu) + '<br>' + esc(out.screen) + '</small>' +
        '<table style="margin:10px 0;border-collapse:collapse;width:100%;font-size:13px">' + rows + '</table>' +
        '<small>fps: frames a second, median. 1% low: the slowest frames. Stutter: frames over ' + BENCH.SLOW_MS + ' ms. ms: the game\'s own work per frame.' +
        (out.tiers.some(t => t.adapted) ? ' The quality adapted during the measure: open the link with &amp;adapt=0 for raw numbers.' : '') + '</small><br>' +
        '<button type="button" style="margin-top:10px;min-height:44px;padding:0 16px;border-radius:22px;border:2px solid #ef5a17;background:rgba(239,90,23,0.25);color:#fff;font:inherit;font-weight:700">COPY RESULT</button>';
      const b = el.querySelector('button');
      b.addEventListener('click', e => {
        e.stopPropagation();
        const line = benchLine(out);
        const ok = () => { b.textContent = 'COPIED'; };
        try { navigator.clipboard.writeText(line).then(ok, () => { window.prompt('Copy this', line); }); } catch (err) { window.prompt('Copy this', line); }
      });
    },
  };
}
