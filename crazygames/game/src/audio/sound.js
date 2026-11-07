/* SOUND: the engine and the tyres, synthesised with Web Audio, so there
   is nothing to download and nothing to licence.

   The engine is a big, lazy V8 made of exhaust pulses, not tones (after
   play on 8 November: oscillators sounded like a fly, twice): each
   firing strikes fixed low resonances (renderEngineLoop, a few loops at
   set revs rendered as the sound starts and crossfaded), so it rumbles
   rather than buzzes. The
   revs come from the speed through a gearbox of SOUND.GEARS: each gear
   runs from SHIFT_RPM to MAX_RPM, so the note climbs, drops at a shift,
   and climbs again; wheelspin and a slide add revs.

   The tyres are looped noise through two band passes, a low hiss and a
   high squeal, whose level grows with the drift angle and the speed,
   and whose pitch rises with the angle.

   Nothing here touches the physics: it reads the car once a frame. The
   AudioContext starts on the first tap or key (browsers allow sound only
   after one), is suspended while the page is hidden, and a mute switch
   sets the master level to nothing and is remembered on the device
   (localStorage, in try/catch). Every number of taste is in SOUND. */

export const SOUND = {
  MASTER:        1.0,      // the overall level
  ENGINE:        0.55,     // the engine's level
  TYRES:         0.38,     // the tyres' level at a full slide (the squeal kept as loud against the deeper engine)
  IDLE_RPM:      650,
  SHIFT_RPM:     1900,     // where a gear starts after an upshift
  MAX_RPM:       3900,     // where it shifts up: a big, lazy V8 (a firing note of 43 to 260 Hz)
  GEARS:         [0, 15, 28, 42, 58, 80],   // m/s at the top of gears one to five (the last is the ceiling)
  SLIDE_RPM:     700,      // revs added at a full rear slide or wheelspin
  RPM_EASE:      0.09,     // s for the revs to follow
  BASS_DB:       5,        // dB of low shelf under 160 Hz, for the rumble where a speaker can give it
  V8: {                    // the exhaust model, rendered into loops by renderEngineLoop
    resonators: [[62, 0.05, 1], [124, 0.03, 0.7], [270, 0.012, 0.3]],   // Hz, decay s, weight: the exhaust's body, pipe and muffler
    pattern:    [1, 0.62, 0.9, 0.55, 0.95, 0.68, 0.84, 0.58],          // each firing's strength in turn: the banks' uneven pulses
    jitter:     0.06,     // share of random wobble in the firing interval
    noise:      0.25,     // exhaust puff after each firing
    drive:      1.6,      // soft clip
    lowpass:    650,      // Hz, the last filter: no buzz above it
    highpass:   28,       // Hz, below this nothing a speaker could play
    load:       0.85,     // how hard each firing is struck in the loops
    loops:      [700, 1150, 1700, 2350, 3100, 3900],   // rpm of the pre-rendered loops the engine crossfades between
    cycles:     8,        // engine cycles (two revolutions each) in a loop
  },
  SQUEAL_FROM:   9,        // degrees of slide before the tyres sing
  SQUEAL_FULL:   38,       // degrees at full voice
  SQUEAL_HZ:     [1100, 1900],  // the squeal's band, rising with the angle
  HISS_HZ:       520,      // the low scrub band
  SPEED_FULL:    18,       // m/s at which the tyres reach full voice
  FADE:          0.25,     // s to fade in or out
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

/* One seamless loop of the V8 at a steady rpm: a cross-plane V8 fires
   every 90 degrees of crank, but each bank's exhaust sees its pulses
   unevenly, which is the burble; so each firing strikes a bank of
   resonators (the exhaust's body, pipe and muffler) with a strength from
   the bank pattern and a little jitter, and a puff of noise rides on it.
   The jitter repeats every loop and the loop is cut after the resonators
   have settled into that repeat, so it joins without a click. */
export function renderEngineLoop(sr, rpm, o) {
  const fire = rpm / 60 * 4;                                   // firings a second
  const per = sr / fire, firings = o.cycles * 8;
  const pat = o.pattern, res = o.resonators.map(([f, decay, w]) => { const R = Math.exp(-1 / (decay * sr)), wv = 2 * Math.PI * f / sr; return { a1: 2 * R * Math.cos(wv), a2: -R * R, g: (1 - R) * w * 6, y1: 0, y2: 0 }; });
  let seed = 97531; const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const jit = []; for (let k = 0; k < firings; k++) jit.push(1 + (rand() - 0.5) * o.jitter);
  const sum = jit.reduce((a, b) => a + b, 0); for (let k = 0; k < firings; k++) jit[k] *= firings / sum;   // the loop is exactly its length
  const loopLen = Math.round(per * firings), warm = 3, out = new Float32Array(loopLen);
  const lpA = 1 - Math.exp(-2 * Math.PI * o.lowpass / sr);
  const hpA = Math.exp(-2 * Math.PI * o.highpass / sr);
  let lpY = 0, hpY = 0, hpX = 0, puff = 0, next = 0, k = 0;
  const total = loopLen * (warm + 1);
  for (let n = 0; n < total; n++) {
    let x = 0;
    if (n >= next) { x = pat[k % pat.length] * (0.55 + 0.45 * o.load); next += per * jit[k % firings]; k++; puff = 1; }
    const nz = (rand() * 2 - 1) * puff * o.noise * (0.4 + 0.6 * o.load); puff *= 0.9965;
    let y = 0;
    for (const r of res) { const v = r.g * (x + nz * 0.02) + r.a1 * r.y1 + r.a2 * r.y2; r.y2 = r.y1; r.y1 = v; y += v; }
    y += nz * 0.15;
    lpY += (y - lpY) * lpA;
    hpY = hpA * (hpY + lpY - hpX); hpX = lpY;     // a DC blocker: the pulses all push one way
    if (n >= loopLen * warm) out[n - loopLen * warm] = Math.tanh(hpY * o.drive);
  }
  return out;
}

/* The graph, on any AudioContext (a live one, or an OfflineAudioContext
   for a test render). update() sets every level for a moment in time. */
export function buildVoices(ctx, out) {
  const master = ctx.createGain(); master.gain.value = 0; master.connect(out);
  // engine: loops of exhaust pulses through fixed resonances, rendered
  // here at a few revs and crossfaded, each nudged in pitch to the revs
  // between them, so the resonances barely move and the note stays deep
  const bass = ctx.createBiquadFilter(); bass.type = 'lowshelf'; bass.frequency.value = 160; bass.gain.value = SOUND.BASS_DB;
  const engine = ctx.createGain(); engine.gain.value = SOUND.ENGINE;
  bass.connect(engine); engine.connect(master);
  const loops = SOUND.V8.loops.map(r => {
    const data = renderEngineLoop(ctx.sampleRate, r, SOUND.V8);
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate); b.getChannelData(0).set(data);
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(bass); src.start();
    return { rpm: r, src, g };
  });
  const ready = Promise.resolve();
  // tyres: two bands of one looped noise
  const len = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let seed = 12345; for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) >>> 0; d[i] = seed / 2147483648 - 1; }
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const squealBand = ctx.createBiquadFilter(); squealBand.type = 'bandpass'; squealBand.Q.value = 9;
  const squealBand2 = ctx.createBiquadFilter(); squealBand2.type = 'bandpass'; squealBand2.Q.value = 14;
  const hissBand = ctx.createBiquadFilter(); hissBand.type = 'bandpass'; hissBand.frequency.value = SOUND.HISS_HZ; hissBand.Q.value = 0.8;
  const squeal = ctx.createGain(); squeal.gain.value = 0;
  const hiss = ctx.createGain(); hiss.gain.value = 0;
  noise.connect(squealBand); squealBand.connect(squealBand2); squealBand2.connect(squeal); squeal.connect(master);
  noise.connect(hissBand); hissBand.connect(hiss); hiss.connect(master);
  noise.start();
  let rpm = SOUND.IDLE_RPM;
  /* car: { speed m/s, slip rad, rearSlide, spinning, hb }; on: the car is
     being driven (else everything fades); level: the master level; t: the
     context time this is for; dt: seconds since the last update */
  function update(car, on, level, t, dt) {
    const k = 1 - Math.exp(-dt / SOUND.RPM_EASE);
    const slide = car ? Math.max(clamp01((car.rearSlide || 0) - 0.6), car.spinning ? 1 : 0) : 0;
    const want = car ? rpmFor(car.speed).rpm + slide * SOUND.SLIDE_RPM : SOUND.IDLE_RPM;
    rpm += (Math.min(SOUND.MAX_RPM + 400, want) - rpm) * k;
    const r = clamp01((rpm - SOUND.IDLE_RPM) / (SOUND.MAX_RPM - SOUND.IDLE_RPM)), tc = 0.02;
    // the two loops either side of the revs, equal power, each played at the revs
    let i = 0; while (i < loops.length - 2 && rpm > loops[i + 1].rpm) i++;
    const lo = loops[i], hi = loops[i + 1], x = clamp01((rpm - lo.rpm) / (hi.rpm - lo.rpm));
    for (const L of loops) {
      const g = L === lo ? Math.cos(x * Math.PI / 2) : L === hi ? Math.sin(x * Math.PI / 2) : 0;
      L.g.gain.setTargetAtTime(g, t, tc);
      if (g > 0) L.src.playbackRate.setTargetAtTime(rpm / L.rpm, t, tc);
    }
    engine.gain.setTargetAtTime(SOUND.ENGINE * (0.85 + 0.25 * r), t, tc);
    const angle = car ? Math.abs(car.slip || 0) * 180 / Math.PI : 0;
    const voice = car ? smooth(SOUND.SQUEAL_FROM, SOUND.SQUEAL_FULL, angle) * smooth(2, SOUND.SPEED_FULL, car.speed) : 0;
    const hb = car && car.hb > 0.5 && car.speed > 3 ? 0.6 : 0;
    const v = Math.max(voice, hb);
    squeal.gain.setTargetAtTime(SOUND.TYRES * v, t, 0.04);
    hiss.gain.setTargetAtTime(SOUND.TYRES * 0.8 * Math.max(v, car ? 0.08 * smooth(5, 40, car.speed) : 0), t, 0.05);
    const sf = SOUND.SQUEAL_HZ[0] + (SOUND.SQUEAL_HZ[1] - SOUND.SQUEAL_HZ[0]) * smooth(SOUND.SQUEAL_FROM, 60, angle);
    squealBand.frequency.setTargetAtTime(sf, t, 0.05); squealBand2.frequency.setTargetAtTime(sf * 1.01, t, 0.05);
    master.gain.setTargetAtTime(on ? level : 0, t, SOUND.FADE / 3);
  }
  return { update, master, ready, rpm: () => rpm };
}

export function createSound() {
  let ctx = null, voices = null, muted = false;
  try { muted = localStorage.getItem(SOUND.KEY) === 'off'; } catch (e) { muted = false; }
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  function start() {
    if (!AC) return;
    try {
      if (!ctx) { ctx = new AC(); voices = buildVoices(ctx, ctx.destination); }
      if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
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
  function setMuted(m) { muted = !!m; try { localStorage.setItem(SOUND.KEY, muted ? 'off' : 'on'); } catch (e) {} if (voices && ctx) voices.master.gain.setTargetAtTime(0, ctx.currentTime, 0.02); }
  return { update, setMuted, get muted() { return muted; }, get available() { return !!AC; }, get running() { return !!ctx && ctx.state === 'running'; } };
}

/* the speaker icon, crossed when muted */
export function soundIcon(muted) {
  const body = 'M4 9h4l5-4v14l-5-4H4z';
  const extra = muted ? 'M16 9l5 6M21 9l-5 6' : 'M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12';
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${body}" fill="currentColor"/><path d="${extra}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}
