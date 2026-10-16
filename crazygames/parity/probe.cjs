/* THE PROBE. One file, loaded into the original page and into the page
   hosting the module, so both sides of the parity test are driven by the
   same code against the same narrow interface:

     S.get(name)        a top level variable of the game
     S.set(name, v)
     S.fn.name(...)     a top level function
     S.fn.step(dt)      the module's frame; absent in the original, where
                        the probe's genericStep reproduces frame()'s
                        simulation half from the original's own functions,
                        and where a realFrame job calls the original's own
                        frame(t) instead, drawing and all
     S.seedRandom(k)    reseed the Math.random stand in

   Nothing here draws, waits or reads a clock. The day is set by the runner
   before a job starts, and the probe records the day it rolled from. */
(function (root) {
  'use strict';
  const VERSION = 10;

  /* FNV-1a over the eight bytes of each number, so 0.1 and 0.1000001 hash
     apart and -0 and 0 hash apart. Strings and booleans mix too. */
  const dv = new DataView(new ArrayBuffer(8));
  function mixNum(h, v) {
    if (typeof v === 'boolean') v = v ? 1 : 0;
    else if (v === null || v === undefined) v = -7777777;
    else if (typeof v !== 'number') return mixStr(h, String(v));
    dv.setFloat64(0, v);
    for (let i = 0; i < 8; i++) { h ^= dv.getUint8(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function mixStr(h, s) {
    h ^= 0x5c; h = Math.imul(h, 16777619) >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function mixObj(h, o) {
    for (const k in o) { const v = o[k]; if (v === null || typeof v !== 'object') h = mixNum(h, v); }
    return h;
  }

  /* WHAT A FRAME IS. Every scalar top level variable of the simulation,
     generated from the module's own list, minus the ones the renderer owns
     (shake, smoke, the camera lean, the title clock, the boot splash, colour
     strings, the spark and wreck ledgers the draw passes drain, and
     camHeight, which render() writes). Then the drift, the ghost cursor,
     the racers, the input, and the road around the car: every field of
     every segment from six behind the car to forty eight ahead, which is
     where the tyre marks are laid and where generation arrives, and every
     field of every hazard and jump, close call ledger included. */
  const SCALARS = ["airHeadingV","airLateralV","airTime","airborne","banked","barShow","beatBest","beatDaily","beatFlash","bestKnown","bestScore","biome","biomeRngState","calloutCoach","calloutFull","calloutLife","calloutLock","calloutPoint","calloutPri","calloutSide","calloutStyle","calloutText","camLift","carAheadSegs","carCurve","carFallV","carFrac","carJustUnlocked","carPick","carPitch","carSegIndex","carVY","carX","carY","chainBestSaid","chainLapse","chainLinks","chainSaidAt","chainTier","chainTime","cityGlow","cityPhase","cityPulse","cleanDaysEver","clock","clockPop","coachDropped","coachQuiet","coastSpeed","continues","countdown","countdownSaid","cpBanked","cpBiome","cpClock","cpGates","cpSeg","cpTime","cpValid","curveScale","dailyBest","dailyClean","dailyDone","dailyGates","dailyGhostBytes","dailyTime","deadFor","deathKind","driftGap","driftLife","driftLock","driftSide","driftSize","driftText","driftWordN","edgeClear","explodeFlash","finaleBiome0","finaleDriving","finaleFirstToday","finaleFlash","finaleFree","finaleGlow","finaleHueDue","finaleHueN","finaleLevel","finaleScale","finaleShellsFired","finaleSky","finaleSpin","finaleStrobe","finaleSwing","finaleT","finaleWavesFired","finishClean","finishMargin","finishRecord","finishSeg","finishTime","finishX","finishedEver","furthest","gateFlash","gateFlash2","gatesPassed","hazardSide","heatPulse","hillPhase","hitStop","jumpDue","landFlare","landSlow","landSlowTo","lastBiomeHue","lastDir","lastMarkSeg","lastPlacedSeg","lastSeed","level","maxCurveSeen","mode","multPop","multiplier","nextGate","onRough","openJumpBuilt","openingEndSeg","paused","position","prevCarIndex","racerBump","racerClean","racerFormNow","restOwed","restartWanted","resumeFlash","rngState","roadWidth","runBestChain","runBestMult","runDistance","runTime","runsEver","score","scrapeMeter","scrapeRisk","scrapeSide","scraping","seedPinned","segBase","skipOnRamp","state","todayStamp","trainBlockBuilt","trainBlockSaid","trainHitSaid","trainJumpBuilt","trainJumpSaid","trainLandSaid","trainLineFree","trainMoveSaid","trainMoverBuilt","trainPinchBuilt","trainPlaced","trainRecharged","trainScraped","trainSplitBuilt","trainStep","trainedEver","wasInOpening","wasScraping","widthScale","worldHeat"];
  const DRIFT = ['headingV', 'lateralV', 'headingAngle', 'travelAngle', 'slip', 'slipDeg', 'slipNorm', 'lateralAccel'];
  const GHOST = ['i', 'said', 'ahead', 'shown', 'live', 'n'];
  const WINDOW_BEHIND = 6, WINDOW_AHEAD = 48;

  function checkNames(S) {
    const missing = [];
    for (const n of SCALARS) { try { S.get(n); } catch (e) { missing.push(n); } }
    for (const n of ['drift', 'ghost', 'racers', 'held', 'tilt', 'steering', 'segments', 'hazards', 'jumps', 'segBase', 'FEEL']) { try { S.get(n); } catch (e) { missing.push(n); } }
    if (missing.length) throw new Error('this side has no ' + missing.join(', '));
  }
  function frameHash(S) {
    let h = 2166136261;
    for (let i = 0; i < SCALARS.length; i++) h = mixNum(h, S.get(SCALARS[i]));
    const d = S.get('drift'); for (let i = 0; i < DRIFT.length; i++) h = mixNum(h, d[DRIFT[i]]);
    const g = S.get('ghost'); for (let i = 0; i < GHOST.length; i++) h = mixNum(h, g[GHOST[i]]);
    const rs = S.get('racers'); h = mixNum(h, rs.length);
    for (let r = 0; r < rs.length; r++) h = mixObj(h, rs[r]);
    const held = S.get('held'); h = mixNum(h, held.keyLeft); h = mixNum(h, held.keyRight); h = mixNum(h, held.touchLeft); h = mixNum(h, held.touchRight);
    const tilt = S.get('tilt'); h = mixNum(h, tilt.active); h = mixNum(h, tilt.value);
    h = mixNum(h, S.get('steering').value);
    const segs = S.get('segments'), base = S.get('segBase'), car = S.get('carSegIndex');
    h = mixNum(h, segs.length); h = mixNum(h, base);
    const lo = Math.max(0, car - base - WINDOW_BEHIND), hi = Math.min(segs.length, car - base + WINDOW_AHEAD);
    for (let i = lo; i < hi; i++) h = mixObj(h, segs[i]);
    const hz = S.get('hazards'); h = mixNum(h, hz.length); for (let i = 0; i < hz.length; i++) h = mixObj(h, hz[i]);
    const jp = S.get('jumps'); h = mixNum(h, jp.length); for (let i = 0; i < jp.length; i++) h = mixObj(h, jp[i]);
    return h >>> 0;
  }
  function frameVector(S) {
    const out = {};
    for (const n of SCALARS) out[n] = S.get(n);
    const d = S.get('drift'); for (const n of DRIFT) out['drift.' + n] = d[n];
    const g = S.get('ghost'); for (const n of GHOST) out['ghost.' + n] = g[n];
    const rs = S.get('racers'); out['racers.length'] = rs.length;
    rs.forEach((r, k) => { for (const n in r) if (typeof r[n] !== 'object') out['racers[' + k + '].' + n] = r[n]; });
    const held = S.get('held'); for (const n in held) out['held.' + n] = held[n];
    const tilt = S.get('tilt'); out['tilt.active'] = tilt.active; out['tilt.value'] = tilt.value;
    out['steering.value'] = S.get('steering').value;
    const segs = S.get('segments'), base = S.get('segBase'), car = S.get('carSegIndex');
    out['segments.length'] = segs.length; out['segBase'] = base;
    const lo = Math.max(0, car - base - WINDOW_BEHIND), hi = Math.min(segs.length, car - base + WINDOW_AHEAD);
    for (let i = lo; i < hi; i++) for (const n in segs[i]) if (typeof segs[i][n] !== 'object') out['segments[' + segs[i].index + '].' + n] = segs[i][n];
    S.get('hazards').forEach((z, k) => { for (const n in z) if (typeof z[n] !== 'object') out['hazards[' + k + '].' + n] = z[n]; });
    S.get('jumps').forEach((j, k) => { for (const n in j) if (typeof j[n] !== 'object') out['jumps[' + k + '].' + n] = j[n]; });
    return out;
  }

  /* frame()'s simulation half, in frame()'s order. Used in the original
     page for the fast path; the module's own step() is what the comparison
     then checks against this, and a realFrame job checks both against the
     original's frame() itself. */
  function genericStep(S, dt) {
    if (S.get('paused')) { S.fn.clearHeldInput(); return; }
    S.fn.spendRestartWanted();
    const hs = S.get('hitStop');
    if (hs > 0) {
      S.set('hitStop', hs - dt);
      S.set('deadFor', S.get('deadFor') + dt);
      return;
    }
    S.fn.updateSteering(dt);
    S.fn.update(dt);
    S.fn.updateScore(dt);
    S.fn.updateClock(dt);
    S.fn.updateSpectacle(dt);
    S.fn.ghostUpdate(dt);
    S.fn.updateBar(dt);
  }
  /* The stepper for a job. A realFrame job on the original calls frame(t)
     with integer millisecond timestamps 17 apart, so dt is 17/1000 exactly
     as frame() computes it, and 0 on the first frame as frame() has it. On
     the module the same dt sequence goes to step(). */
  function stepper(S, job) {
    if (job.realFrame && S.fn.__frame) {
      S.set('lastTime', 0);
      let t = 0;
      return function () { t += 17; S.fn.__frame(t); };
    }
    const inner = S.fn.step ? function (dt) { S.fn.step(dt); } : function (dt) { genericStep(S, dt); };
    if (job.realFrame) { let n = 0; return function () { inner(n++ === 0 ? 0 : 17 / 1000); }; }
    return function () { inner(1 / 60); };
  }
  /* INPUT THROUGH THE PAGE'S OWN HANDLERS, for the jobs that ask for it.
     'keys' sends keydown and keyup for the arrow keys to the window,
     'pointer' presses the left or right half of the game canvas, and a
     tap is the Enter key. The original page and the shipped page carry
     the same handlers, so both sides are driven the same way and the
     comparison covers the input wiring as well as the simulation. */
  const pressed = { left: false, right: false };
  function keyEvent(type, key) { root.dispatchEvent(new KeyboardEvent(type, { key: key, bubbles: true, cancelable: true })); }
  function pointerEvent(type, id, side) {
    const canvas = root.document.getElementById('game');
    const w = root.innerWidth || 390, h = root.innerHeight || 844;
    canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: side < 0 ? w * 0.25 : w * 0.75, clientY: h * 0.6, bubbles: true, cancelable: true, isPrimary: id === 1, pointerType: 'touch' }));
  }
  function setPressed(via, left, right) {
    if (via === 'keys') {
      if (left !== pressed.left) keyEvent(left ? 'keydown' : 'keyup', 'ArrowLeft');
      if (right !== pressed.right) keyEvent(right ? 'keydown' : 'keyup', 'ArrowRight');
    } else {
      if (left !== pressed.left) pointerEvent(left ? 'pointerdown' : 'pointerup', 1, -1);
      if (right !== pressed.right) pointerEvent(right ? 'pointerdown' : 'pointerup', 2, 1);
    }
    pressed.left = left; pressed.right = right;
  }
  function applyInput(S, tape, v, job) {
    v = v < -1 ? -1 : (v > 1 ? 1 : v);
    if (tape.kind === 'digital') {
      if (job && job.inputVia) { setPressed(job.inputVia, v < -0.15, v > 0.15); return; }
      const held = S.get('held'); held.keyLeft = v < -0.15; held.keyRight = v > 0.15;
    }
    else { const tilt = S.get('tilt'); tilt.active = true; tilt.value = v; }
  }
  function releaseInput(S, job) {
    if (job && job.inputVia) setPressed(job.inputVia, false, false);
    const held = S.get('held'); held.keyLeft = held.keyRight = held.touchLeft = held.touchRight = false;
    const tilt = S.get('tilt'); tilt.value = 0;
  }
  function tap(S, job) {
    if (job && job.inputVia) { keyEvent('keydown', 'Enter'); keyEvent('keyup', 'Enter'); return; }
    S.fn.startOrRestart();
  }

  /* Into a run, through startRun, which is the path that rolls the day.
     The tilt record is told a sensor exists and has no reading yet, so the
     original's updateTilt leaves tilt.value to the tape in a realFrame job
     and never times the sensor out. */
  function prepare(S, job) {
    checkNames(S);
    S.seedRandom(job.seed >>> 0);
    S.set('paused', false);
    S.set('runsEver', job.runsEver);
    S.set('mode', S.get(job.mode));
    S.set('level', job.level);
    S.set('seedPinned', false);
    const tilt = S.get('tilt'); tilt.seenSensor = true; tilt.rawDeg = null; tilt.zeroDeg = null; tilt.active = false; tilt.value = 0;
    pressed.left = pressed.right = false;
    releaseInput(S, job);
    if (job.perturb) for (const k in job.perturb) S.get('FEEL')[k] = job.perturb[k];
    const rolledFrom = S.get('todayStamp');
    S.fn.startRun();
    if (S.get('todayStamp') !== job.day) throw new Error('todayStamp ' + S.get('todayStamp') + ' after startRun, wanted ' + job.day + ': the day did not take');
    return rolledFrom;
  }

  function record(o) {
    const keys = Object.keys(o).filter(k => typeof o[k] !== 'object' && typeof o[k] !== 'function').sort();
    let s = '';
    for (const k of keys) { const v = o[k]; s += k + '=' + (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toPrecision(17)) : String(v)) + ';'; }
    return s;
  }

  /* THE ROAD, over its whole length, generated the way update() generates
     it: the camera's segment goes to topUpRoad and the car's index comes
     off the same position, in jumps of thirty segments. Snapshotting as it
     goes, because topUpRoad trims behind the camera: walking the arrays at
     the end would see the last hundred and thirty segments and nothing
     else. Hazards and jumps are keyed and collected the same way. */
  function road(S, job) {
    const rolledFrom = prepare(S, job);
    const FEEL = S.get('FEEL');
    const SEG = FEEL.SEGMENT_LENGTH, CAMD = FEEL.CAMERA_DISTANCE, SPEED = FEEL.SPEED;
    const end = job.mode === 'DAILY' ? S.get('finishSeg') + 200 : job.endlessSegments;
    const seen = new Set(), hz = new Map(), jp = new Map();
    let h = 2166136261, nSeg = 0, first = [];
    for (let seg = 0; seg <= end; seg += 30) {
      const position = seg * SEG;
      S.set('position', position);
      S.set('prevCarIndex', S.get('carSegIndex'));
      S.set('carSegIndex', Math.floor((position + CAMD) / SEG));
      S.set('runTime', position / SPEED);
      S.fn.updateDifficulty();
      S.fn.topUpRoad(Math.floor(position / SEG));
      const segs = S.get('segments');
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (seen.has(s.index)) continue;
        seen.add(s.index); nSeg++;
        const line = record(s) + 'height=' + S.fn.segHeight(s.index).toPrecision(17) + ';';
        h = mixStr(h, line);
        if (first.length < 2 || job.keepRecords) first.push(line);
      }
      for (const z of S.get('hazards')) { const k = z.kind + ':' + z.from; if (!hz.has(k)) hz.set(k, record(z)); }
      for (const j of S.get('jumps')) { const k = j.from; if (!jp.has(k)) jp.set(k, record(j)); }
    }
    for (const k of [...hz.keys()].sort()) { h = mixStr(h, 'H' + hz.get(k)); if (job.keepRecords) first.push('H' + hz.get(k)); }
    for (const k of [...jp.keys()].sort((a, b) => a - b)) { h = mixStr(h, 'J' + jp.get(k)); if (job.keepRecords) first.push('J' + jp.get(k)); }
    return { hash: h >>> 0, segments: nSeg, hazards: hz.size, jumps: jp.size, finishSeg: S.get('finishSeg'),
             todayStamp: S.get('todayStamp'), rolledFrom, lastSeed: S.get('lastSeed'), biome: S.get('biome'), first,
             hazardKeys: [...hz.keys()].sort().slice(0, 6), jumpKeys: [...jp.keys()].sort((a, b) => a - b).slice(0, 6) };
  }

  /* A DRIVE. The tape is fed in as tilt or as keys, the world steps once,
     the frame is hashed. Deaths are followed the way a player follows them,
     through startOrRestart, which is a continue when there is a checkpoint
     and a fresh run when there is not. */
  function drive(S, job) {
    const tape = root.parityTapes[job.tape];
    if (!tape) throw new Error('no tape ' + job.tape);
    const rolledFrom = prepare(S, job);
    const steer = tape.make(job.seed);
    const step = stepper(S, job);
    const FEEL = S.get('FEEL');
    const DRIVING = S.get('DRIVING'), DEAD = S.get('DEAD'), FINISHED = S.get('FINISHED');
    const hashes = new Array(job.maxFrames);
    const events = [];
    let restartsLeft = tape.restarts, tappedThisDeath = false, finishedFrames = 0, n = 0, dump = null, nextTapped = false, nextFrames = 0;
    for (; n < job.maxFrames; n++) {
      const st = S.get('state');
      if (st === DRIVING) {
        applyInput(S, tape, steer(n, S), job);
        tappedThisDeath = false;
      } else if (st === DEAD) {
        releaseInput(S, job);
        if (!tappedThisDeath && restartsLeft > 0) {
          const due = tape.restart === 'reflex' ? true : S.get('deadFor') >= FEEL.DEATH_INPUT_LOCK + tape.restartDelay;
          if (due) {
            /* The tap is an input, and the random stand in is reseeded at
               every input so both sides draw the same endless seed from
               it: the original's particle effects have consumed draws the
               module's hooks did not, which is the one place the two
               streams part. */
            S.seedRandom((job.seed ^ Math.imul(n + 1, 2654435761)) >>> 0);
            tap(S, job); tappedThisDeath = true; restartsLeft--; events.push([n, 'tap', S.get('state'), S.get('continues')]);
          }
        } else if (restartsLeft <= 0 && S.get('deadFor') > 2) break;
      } else if (st === FINISHED) {
        releaseInput(S, job);
        finishedFrames++;
        if (tape.afterFinish === 'next' && !nextTapped) {
          /* The whole day is one input at a time: once the finale has run
             its course a tap goes into the next level, and the tape drives
             the opening of it. */
          if (!S.fn.finaleRunning() && S.get('deadFor') >= FEEL.DEATH_INPUT_LOCK + 0.5) {
            S.seedRandom((job.seed ^ Math.imul(n + 7, 2654435761)) >>> 0);
            tap(S, job); nextTapped = true; events.push([n, 'next', S.get('level'), S.get('mode')]);
          }
        } else if (finishedFrames > job.finishFrames) break;
      }
      if (nextTapped && S.get('state') !== FINISHED && ++nextFrames > tape.nextLevelFrames) break;
      step();
      hashes[n] = frameHash(S);
      if (job.dumpAt === n) {
        dump = frameVector(S);
        if (job.audit) for (const name of job.audit) { let v; try { v = S.get(name); } catch (e) { v = '<missing>'; } if (v === null || typeof v !== 'object') dump['hidden:' + name] = v; }
      }
      const after = S.get('state');
      if (after !== st) events.push([n, 'state', st, after, after === DEAD ? S.get('deathKind') : S.get('gatesPassed')]);
    }
    hashes.length = n;
    const out = { frames: n, hashes, events, end: frameVector(S), todayStamp: S.get('todayStamp'), rolledFrom };
    if (dump) out.dump = dump;
    return out;
  }

  /* THE ROUTES. A scripted session through the game's own entry points by
     name: pause and resume, the title screen from pause, the car pick, the
     mode switch, endless, the title route, skipping training, a crash and
     the restart after it, a finish, the finale skipped, the next level.
     The centre tape steers whenever the car is driving. */
  function routes(S, job) {
    checkNames(S);
    S.seedRandom(job.seed >>> 0);
    S.set('runsEver', job.runsEver);
    S.set('paused', false);
    const tilt = S.get('tilt'); tilt.seenSensor = true; tilt.rawDeg = null; tilt.zeroDeg = null; tilt.active = false; tilt.value = 0;
    releaseInput(S);
    const tape = root.parityTapes.centre;
    const steer = tape.make(job.seed);
    const step = stepper(S, job);
    const hashes = [], events = [];
    const script = job.script.slice();
    const DRIVING = S.get('DRIVING');
    const rolledFrom = S.get('todayStamp');
    for (let n = 0; n < job.maxFrames; n++) {
      while (script.length && script[0][0] === n) {
        const [, name, ...a] = script.shift();
        // every scripted call is an input, and the random stand in is reseeded at each one; see drive()
        S.seedRandom((job.seed ^ Math.imul(n + 3, 2654435761)) >>> 0);
        if (name === 'set') S.set(a[0], a[1]);
        else S.fn[name].apply(null, a);
        events.push([n, name, S.get('state'), S.get('mode'), S.get('level'), S.get('paused'), S.get('carPick'), S.get('deathKind'), S.get('continues')]);
      }
      if (S.get('state') === DRIVING && !S.get('paused')) applyInput(S, tape, steer(n, S)); else releaseInput(S);
      step();
      hashes.push(frameHash(S));
    }
    if (S.get('todayStamp') !== job.day) throw new Error('todayStamp ' + S.get('todayStamp') + ' wanted ' + job.day);
    return { frames: hashes.length, hashes, events, end: frameVector(S), todayStamp: S.get('todayStamp'), rolledFrom };
  }

  /* A SNAPSHOT: the state as it stands, no run started. After a reload it
     is the records, the ghost and the car pick as they came back from the
     store on this side. */
  function snapshot(S, job) {
    checkNames(S);
    return { hashes: [frameHash(S)], frames: 1, events: [], end: frameVector(S), todayStamp: S.get('todayStamp'), rolledFrom: S.get('todayStamp') };
  }

  function runJob(S, job) {
    try {
      const r = job.kind === 'road' ? road(S, job) : job.kind === 'routes' ? routes(S, job) : job.kind === 'snapshot' ? snapshot(S, job) : drive(S, job);
      r.ok = true; return r;
    } catch (e) {
      return { ok: false, error: String(e && e.stack || e) };
    }
  }
  root.parityProbe = { VERSION, runJob, frameHash, frameVector, SCALARS };
  if (typeof module !== 'undefined') module.exports = root.parityProbe;
})(typeof globalThis !== 'undefined' ? globalThis : this);
