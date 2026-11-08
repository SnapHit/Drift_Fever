/* SOUND: the engine and the tyres, from two recordings the author chose
   (8 November 2026, after three rounds of synthesis that sounded like a
   fly, a buzz and a whistle). Both are from Pixabay, recorded in ASSETS.md.
   game/assets/audio/ holds what was cut from them, 24 kHz mono WAV, so a
   loop joins without the gap an MP3's padding would leave:

     engine-start.wav   the engine cranking and catching, played once as
                        a run's countdown starts
     engine-idle.wav    a V8 idling, cut into a seamless loop: the engine
                        for the whole run, pitched up with the revs
     drift-loop.wav     a real car drifting, cut into a seamless loop: the
                        tyres, louder with the drift angle and the speed

   The revs come from the speed through a gearbox of SOUND.GEARS: each
   gear runs from SHIFT_RPM to MAX_RPM, so the note climbs, drops at a
   shift, and climbs again; wheelspin and a slide add revs. The idle loop
   is played at a rate that rises with the revs (up to PITCH_MAX times),
   through a low pass that opens and a level that grows, so the idle
   becomes a rev without turning into a chipmunk.

   Nothing here touches the physics: it reads the car once a frame. The
   AudioContext starts on the first tap or key (browsers allow sound only
   after one), the recordings are fetched and decoded then (silent until
   they arrive, and silent for good if they cannot be), it is suspended
   while the page is hidden, and a mute switch sets the master level to
   nothing and is remembered on the device (localStorage, in try/catch).
   Every number of taste is in SOUND. */

export const SOUND = {
  MASTER:        1.0,      // the overall level
  ENGINE:        0.42,     // the engine's level at idle
  ENGINE_REV:    0.22,     // and how much louder at the limiter
  START:         0.6,      // the starter and catch at a countdown
  TYRES:         0.55,     // the drift recording's level at a full slide
  IDLE_RPM:      650,
  SHIFT_RPM:     1900,     // where a gear starts after an upshift
  MAX_RPM:       3900,     // where it shifts up
  GEARS:         [0, 15, 28, 42, 58, 80],   // m/s at the top of gears one to five (the last is the ceiling)
  SLIDE_RPM:     700,      // revs added at a full rear slide or wheelspin
  RPM_EASE:      0.09,     // s for the revs to follow
  PITCH_MAX:     2.1,      // the idle recording's playback rate at the limiter: higher and it turns into a toy
  CUTOFF:        [900, 5000],   // Hz, the engine's low pass from idle to the limiter
  SQUEAL_FROM:   9,        // degrees of slide before the tyres sing
  SQUEAL_FULL:   36,       // degrees at full voice
  SQUEAL_PITCH:  [0.94, 1.08],  // the drift recording's playback rate, from a light slide to a deep one
  HISS:          0.05,     // a little road noise at speed under everything
  HISS_HZ:       520,
  SPEED_FULL:    18,       // m/s at which the tyres reach full voice
  FADE:          0.25,     // s to fade in or out
  FILES:         { start: 'engine-start.wav', idle: 'engine-idle.wav', drift: 'drift-loop.wav' },
  KEY:           'driftfever.cg.sound.v1',
};

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* The revs for a speed: which gear, and how far up it. */
export function rpmFor(speed) {
  const G = SOUND.GEARS, v = Math.max(0, speed);
  let g = 1; while (g < G.length - 1 && v > G[g]) g++;
  const lo = G[g - 1], hi = G[g], f = clamp01((v - lo) / Math.max(1e-6, hi - lo));
  const from = g === 1 ? SOUND.IDLE_RPM : SOUND.SHIFT_RPM;
  return { rpm: from + (SOUND.MAX_RPM - from) * f, gear: g };
}

/* decodeAudioData as a promise, for the older Safari that only calls back */
function decode(ctx, data) {
  return new Promise((res, rej) => { const p = ctx.decodeAudioData(data, res, rej); if (p && p.then) p.then(res, rej); });
}
/* the recordings, fetched from beside the game; fetchBytes is replaceable for a test render */
export async function loadBuffers(ctx, fetchBytes) {
  const get = fetchBytes || (name => fetch(new URL('../../assets/audio/' + name, import.meta.url)).then(r => { if (!r.ok) throw new Error(name + ' ' + r.status); return r.arrayBuffer(); }));
  const out = {};
  for (const k of Object.keys(SOUND.FILES)) out[k] = await decode(ctx, await get(SOUND.FILES[k]));
  return out;
}

/* The graph, on any AudioContext (a live one, or an OfflineAudioContext
   for a test render), from the decoded recordings. update() sets every
   level for a moment in time; start() plays the starter. */
export function buildVoices(ctx, out, buffers) {
  const master = ctx.createGain(); master.gain.value = 0; master.connect(out);
  // engine: the idle loop, pitched and opened up with the revs
  const idle = ctx.createBufferSource(); idle.buffer = buffers.idle; idle.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7; lp.frequency.value = SOUND.CUTOFF[0];
  const engine = ctx.createGain(); engine.gain.value = 0;
  idle.connect(lp); lp.connect(engine); engine.connect(master);
  // tyres: the drift loop
  const drift = ctx.createBufferSource(); drift.buffer = buffers.drift; drift.loop = true;
  const squeal = ctx.createGain(); squeal.gain.value = 0;
  drift.connect(squeal); squeal.connect(master);
  // a little road noise at speed
  const len = Math.floor(ctx.sampleRate * 2), nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
  let seed = 12345; for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) >>> 0; d[i] = seed / 2147483648 - 1; }
  const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
  const hissBand = ctx.createBiquadFilter(); hissBand.type = 'bandpass'; hissBand.frequency.value = SOUND.HISS_HZ; hissBand.Q.value = 0.8;
  const hiss = ctx.createGain(); hiss.gain.value = 0;
  noise.connect(hissBand); hissBand.connect(hiss); hiss.connect(master);
  idle.start(); drift.start(); noise.start();
  let rpm = SOUND.IDLE_RPM, startedAt = -1;
  /* the starter, once: the idle loop stays down while it plays */
  function start(t) {
    const s = ctx.createBufferSource(); s.buffer = buffers.start;
    const g = ctx.createGain(); g.gain.value = SOUND.START;
    s.connect(g); g.connect(master); s.start(t);
    startedAt = t;
  }
  /* car: { speed m/s, slip rad, rearSlide, spinning, hb }; on: the car is
     being driven (else everything fades); level: the master level; t: the
     context time this is for; dt: seconds since the last update */
  function update(car, on, level, t, dt) {
    const k = 1 - Math.exp(-dt / SOUND.RPM_EASE);
    const slide = car ? Math.max(clamp01((car.rearSlide || 0) - 0.6), car.spinning ? 1 : 0) : 0;
    const want = car ? rpmFor(car.speed).rpm + slide * SOUND.SLIDE_RPM : SOUND.IDLE_RPM;
    rpm += (Math.min(SOUND.MAX_RPM + 300, want) - rpm) * k;
    const r = clamp01((rpm - SOUND.IDLE_RPM) / (SOUND.MAX_RPM - SOUND.IDLE_RPM)), tc = 0.03;
    idle.playbackRate.setTargetAtTime(1 + (SOUND.PITCH_MAX - 1) * r, t, tc);
    lp.frequency.setTargetAtTime(SOUND.CUTOFF[0] + (SOUND.CUTOFF[1] - SOUND.CUTOFF[0]) * r, t, tc);
    // while the starter plays, the idle loop waits, then swells in as the engine catches
    const sinceStart = startedAt < 0 ? 99 : t - startedAt, catchUp = smooth(1.4, 2.0, sinceStart);
    engine.gain.setTargetAtTime((SOUND.ENGINE + SOUND.ENGINE_REV * r) * catchUp, t, tc);
    const angle = car ? Math.abs(car.slip || 0) * 180 / Math.PI : 0;
    const voice = car ? smooth(SOUND.SQUEAL_FROM, SOUND.SQUEAL_FULL, angle) * smooth(2, SOUND.SPEED_FULL, car.speed) : 0;
    const hb = car && car.hb > 0.5 && car.speed > 3 ? 0.6 : 0;
    const v = Math.max(voice, hb);
    squeal.gain.setTargetAtTime(SOUND.TYRES * v, t, 0.05);
    const P = SOUND.SQUEAL_PITCH;
    drift.playbackRate.setTargetAtTime(P[0] + (P[1] - P[0]) * smooth(SOUND.SQUEAL_FROM, 60, angle), t, 0.08);
    hiss.gain.setTargetAtTime(car ? SOUND.HISS * smooth(5, 40, car.speed) : 0, t, 0.05);
    master.gain.setTargetAtTime(on ? level : 0, t, SOUND.FADE / 3);
  }
  return { update, start, master, rpm: () => rpm };
}

export function createSound() {
  let ctx = null, voices = null, muted = false, loading = false, startWanted = false;
  try { muted = localStorage.getItem(SOUND.KEY) === 'off'; } catch (e) { muted = false; }
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  function start() {
    if (!AC) return;
    try {
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
      if (!voices && !loading) {
        loading = true;
        loadBuffers(ctx).then(b => { voices = buildVoices(ctx, ctx.destination, b); if (startWanted && performance.now() - startWanted < 1500) voices.start(ctx.currentTime); startWanted = false; }).catch(() => { /* no recordings: the game plays on in silence */ });
      }
    } catch (e) { ctx = null; voices = null; }
  }
  const unlock = () => start();
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    try { if (document.hidden) ctx.suspend(); else ctx.resume(); } catch (e) {}
  });
  let last = 0;
  function update(car, on) {
    if (!voices || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, dt = Math.min(0.1, Math.max(0.001, t - last || 0.016)); last = t;
    voices.update(car, on && !muted, SOUND.MASTER, t, dt);
  }
  /* the engine starting, at a run's countdown */
  function engineStart() {
    if (muted) return;
    if (voices && ctx) voices.start(ctx.currentTime); else startWanted = performance.now();   // the recordings are still on their way
  }
  function setMuted(m) { muted = !!m; try { localStorage.setItem(SOUND.KEY, muted ? 'off' : 'on'); } catch (e) {} if (voices && ctx) voices.master.gain.setTargetAtTime(0, ctx.currentTime, 0.02); }
  return { update, engineStart, setMuted, get muted() { return muted; }, get available() { return !!AC; }, get running() { return !!ctx && ctx.state === 'running'; }, get loaded() { return !!voices; } };
}

/* the speaker icon, crossed when muted */
export function soundIcon(muted) {
  const body = 'M4 9h4l5-4v14l-5-4H4z';
  const extra = muted ? 'M16 9l5 6M21 9l-5 6' : 'M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12';
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${body}" fill="currentColor"/><path d="${extra}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}
