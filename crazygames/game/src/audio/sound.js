/* SOUND: the engine and the tyres, synthesised with Web Audio, so there
   is nothing to download and nothing to licence.

   The engine is a big V8 (after play on 8 November: the first, a four
   cylinder revving to 7,400, sounded like a fly): the firing note, half
   and a quarter of it, through a hard clipper, a closed low pass that
   opens a little with the revs and a bass shelf, with a lope once a
   revolution. The revs come from the speed through a gearbox of
   SOUND.GEARS: each gear runs from SHIFT_RPM to MAX_RPM, so the note
   climbs, drops at a shift, and climbs again; wheelspin and a slide add
   revs.

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
  ENGINE:        0.12,     // the engine's level
  TYRES:         0.38,     // the tyres' level at a full slide (the squeal kept as loud against the deeper engine)
  IDLE_RPM:      800,
  SHIFT_RPM:     2900,     // where a gear starts after an upshift
  MAX_RPM:       5900,     // where it shifts up: a big V8 that does not scream
  GEARS:         [0, 15, 28, 42, 58, 80],   // m/s at the top of gears one to five (the last is the ceiling)
  SLIDE_RPM:     1100,     // revs added at a full rear slide or wheelspin
  RPM_EASE:      0.09,     // s for the revs to follow
  CYLINDERS:     8,        // firings per two revolutions
  CUTOFF:        [380, 1300],   // Hz, the engine's low pass from idle to the limiter: deep, but open enough for a phone speaker
  BURBLE:        0.45,     // depth of the cross-plane V8's lope, once a revolution
  BASS_DB:       4,        // dB of low shelf under 160 Hz, for the rumble where a speaker can give it
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

/* The graph, on any AudioContext (a live one, or an OfflineAudioContext
   for a test render). update() sets every level for a moment in time. */
export function buildVoices(ctx, out) {
  const master = ctx.createGain(); master.gain.value = 0; master.connect(out);
  // engine: a V8 is a low firing note with strong sub harmonics and an
  // uneven lope; on a phone speaker, which cannot give the fundamental,
  // the ear finds the low pitch from those harmonics under a closed filter
  const fire = ctx.createOscillator(); fire.type = 'sawtooth';          // the firing frequency
  const half = ctx.createOscillator(); half.type = 'sawtooth';          // half of it: the body
  const quarter = ctx.createOscillator(); quarter.type = 'square';      // a quarter: the rumble
  const gFire = ctx.createGain(); gFire.gain.value = 0.3;
  const gHalf = ctx.createGain(); gHalf.gain.value = 0.8;
  const gQuarter = ctx.createGain(); gQuarter.gain.value = 0.35;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(3 * x); } shaper.curve = curve;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.9;
  const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 1500; lp2.Q.value = 0.5;
  const bass = ctx.createBiquadFilter(); bass.type = 'lowshelf'; bass.frequency.value = 160; bass.gain.value = SOUND.BASS_DB;
  const beat = ctx.createGain(); beat.gain.value = 1 - SOUND.BURBLE / 2;
  const lope = ctx.createOscillator(); lope.type = 'sine';             // once a revolution
  const lopeDepth = ctx.createGain(); lopeDepth.gain.value = SOUND.BURBLE / 2;
  lope.connect(lopeDepth); lopeDepth.connect(beat.gain);
  const engine = ctx.createGain(); engine.gain.value = SOUND.ENGINE;
  fire.connect(gFire); half.connect(gHalf); quarter.connect(gQuarter);
  gFire.connect(shaper); gHalf.connect(shaper); gQuarter.connect(shaper);
  shaper.connect(lp); lp.connect(lp2); lp2.connect(bass); bass.connect(beat); beat.connect(engine); engine.connect(master);
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
  fire.start(); half.start(); quarter.start(); lope.start(); noise.start();
  let rpm = SOUND.IDLE_RPM;
  /* car: { speed m/s, slip rad, rearSlide, spinning, hb }; on: the car is
     being driven (else everything fades); level: the master level; t: the
     context time this is for; dt: seconds since the last update */
  function update(car, on, level, t, dt) {
    const k = 1 - Math.exp(-dt / SOUND.RPM_EASE);
    const slide = car ? Math.max(clamp01((car.rearSlide || 0) - 0.6), car.spinning ? 1 : 0) : 0;
    const want = car ? rpmFor(car.speed).rpm + slide * SOUND.SLIDE_RPM : SOUND.IDLE_RPM;
    rpm += (Math.min(SOUND.MAX_RPM + 400, want) - rpm) * k;
    const crank = rpm / 60, f = crank * SOUND.CYLINDERS / 2, r = clamp01((rpm - SOUND.IDLE_RPM) / (SOUND.MAX_RPM - SOUND.IDLE_RPM));
    const tc = 0.02;
    fire.frequency.setTargetAtTime(f, t, tc); half.frequency.setTargetAtTime(f / 2 * 1.003, t, tc); quarter.frequency.setTargetAtTime(f / 4, t, tc);
    lope.frequency.setTargetAtTime(crank, t, tc);
    lp.frequency.setTargetAtTime(SOUND.CUTOFF[0] + (SOUND.CUTOFF[1] - SOUND.CUTOFF[0]) * r, t, tc);
    engine.gain.setTargetAtTime(SOUND.ENGINE * (0.8 + 0.3 * r), t, tc);
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
  return { update, master, rpm: () => rpm };
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
