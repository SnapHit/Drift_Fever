/* THE PROBE. One file, loaded into the original page and into Node, so both
   sides of the parity test are driven by the same code against the same
   narrow interface:

     S.get(name)        a top level variable of the game
     S.set(name, v)
     S.fn.name(...)     a top level function
     S.fn.step(dt)      the module's frame; absent in the page, where the
                        probe's own genericStep reproduces frame()'s
                        simulation half from the original's functions
     S.seedRandom(k)    reseed the Math.random stand in

   Nothing here draws, waits or reads a clock. The day is set by the runner
   before a job starts, and the probe checks it took. */
(function (root) {
  'use strict';
  const VERSION = 7;

  /* FNV-1a over the eight bytes of each number, so 0.1 and 0.1000001 hash
     apart and -0 and 0 hash apart. */
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

  /* What a frame is. Gameplay state only: nothing the renderer owns. */
  const SCALARS = ['state', 'countdown', 'position', 'runTime', 'carX', 'carFrac', 'carY', 'carVY', 'carPitch', 'carFallV',
    'airborne', 'airTime', 'carSegIndex', 'prevCarIndex', 'carCurve', 'coastSpeed', 'score', 'banked', 'clock', 'multiplier',
    'gatesPassed', 'nextGate', 'scraping', 'onRough', 'scrapeSide', 'scrapeMeter', 'scrapeRisk', 'hazardSide', 'landSlow',
    'landSlowTo', 'airHeadingV', 'airLateralV', 'hitStop', 'deadFor', 'deathKind', 'restartWanted', 'continues', 'cpValid',
    'cpSeg', 'cpTime', 'cpClock', 'cpBanked', 'cpGates', 'cpBiome', 'biome', 'lastBiomeHue', 'biomeRngState', 'rngState',
    'segBase', 'jumpDue', 'finishSeg', 'runsEver', 'todayStamp', 'lastSeed', 'level', 'mode', 'finaleT', 'finaleDriving',
    'finaleWavesFired', 'finaleShellsFired', 'finaleHueN', 'finishTime', 'finishClean', 'finishRecord', 'worldHeat',
    'chainLinks', 'chainTier', 'chainTime', 'runBestMult', 'runBestChain', 'calloutLife', 'calloutPri', 'driftLife',
    'calloutText', 'driftText', 'racerFormNow', 'racerBump', 'racerClean', 'trainStep', 'trainPlaced', 'coachQuiet',
    'dailyBest', 'dailyTime', 'dailyClean', 'dailyDone', 'furthest', 'bestScore', 'multPop', 'gateFlash', 'resumeFlash',
    'skipOnRamp', 'wasInOpening', 'lastMarkSeg', 'curveScale', 'widthScale', 'roadWidth', 'paused',
    // the world's reaction to the driving: state the simulation owns and the renderer reads
    'landFlare', 'heatPulse', 'cityGlow', 'cityPulse', 'edgeClear', 'beatFlash', 'gateFlash2', 'explodeFlash', 'finaleGlow', 'finaleFlash'];
  const DRIFT = ['headingV', 'lateralV', 'headingAngle', 'travelAngle', 'slip', 'slipDeg', 'slipNorm', 'lateralAccel'];
  const GHOST = ['i', 'said', 'ahead', 'shown', 'live', 'n'];
  const RACER = ['z', 'x', 'hv', 'lv', 'yaw', 'speed', 'sparkT', 'owed', 'squeeze', 'wreck', 'recover', 'step', 'lane',
    'laneNow', 'laneT', 'y', 'vy', 'air', 'ride', 'dodge', 'dodgeSide'];

  function frameHash(S) {
    let h = 2166136261;
    for (let i = 0; i < SCALARS.length; i++) h = mixNum(h, S.get(SCALARS[i]));
    const d = S.get('drift'); for (let i = 0; i < DRIFT.length; i++) h = mixNum(h, d[DRIFT[i]]);
    const g = S.get('ghost'); for (let i = 0; i < GHOST.length; i++) h = mixNum(h, g[GHOST[i]]);
    const rs = S.get('racers'); h = mixNum(h, rs.length);
    for (let r = 0; r < rs.length; r++) for (let i = 0; i < RACER.length; i++) h = mixNum(h, rs[r][RACER[i]]);
    h = mixNum(h, S.get('segments').length); h = mixNum(h, S.get('hazards').length); h = mixNum(h, S.get('jumps').length);
    return h >>> 0;
  }
  function frameVector(S) {
    const out = {};
    for (const n of SCALARS) out[n] = S.get(n);
    const d = S.get('drift'); for (const n of DRIFT) out['drift.' + n] = d[n];
    const g = S.get('ghost'); for (const n of GHOST) out['ghost.' + n] = g[n];
    const rs = S.get('racers'); out['racers.length'] = rs.length;
    rs.forEach((r, k) => { for (const n of RACER) out['racers[' + k + '].' + n] = r[n]; });
    out['segments.length'] = S.get('segments').length; out['hazards.length'] = S.get('hazards').length; out['jumps.length'] = S.get('jumps').length;
    return out;
  }

  /* frame()'s simulation half, in frame()'s order. Used in the page, where
     there is no step(); the module's own step() is what the comparison then
     checks against this. */
  function genericStep(S, dt) {
    if (S.get('paused')) { S.fn.clearHeldInput(); return; }
    S.fn.spendRestartWanted();
    const hs = S.get('hitStop');
    if (hs > 0) {
      S.set('hitStop', hs - dt);
      S.set('deadFor', S.get('deadFor') + dt);
      return;
    }
    S.fn.update(dt);
    S.fn.updateScore(dt);
    S.fn.updateClock(dt);
    S.fn.updateSpectacle(dt);
    S.fn.ghostUpdate(dt);
    S.fn.updateBar(dt);
  }

  /* Into a run, through startRun, which is the path that rolls the day. */
  function prepare(S, job) {
    S.seedRandom(job.seed >>> 0);
    S.set('paused', false);
    S.set('runsEver', job.runsEver);
    S.set('mode', S.get(job.mode));
    S.set('level', job.level);
    S.set('seedPinned', false);
    if (job.perturb) for (const k in job.perturb) S.get('FEEL')[k] = job.perturb[k];
    S.fn.startRun();
    if (S.get('todayStamp') !== job.day) throw new Error('todayStamp ' + S.get('todayStamp') + ' after startRun, wanted ' + job.day + ': the day did not take');
  }

  function record(o) {
    const keys = Object.keys(o).filter(k => typeof o[k] !== 'object' && typeof o[k] !== 'function').sort();
    let s = '';
    for (const k of keys) { const v = o[k]; s += k + '=' + (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toPrecision(17)) : String(v)) + ';'; }
    return s;
  }

  /* THE ROAD, over its whole length, snapshotting as topUpRoad generates
     because it trims behind the camera as it goes: walking the arrays at
     the end would see the last hundred and thirty segments and nothing
     else. Hazards and jumps are keyed and collected the same way. */
  function road(S, job) {
    prepare(S, job);
    const FEEL = S.get('FEEL');
    const SEG = FEEL.SEGMENT_LENGTH, CAMD = FEEL.CAMERA_DISTANCE, SPEED = FEEL.SPEED;
    const end = job.mode === 'DAILY' ? S.get('finishSeg') + 200 : job.endlessSegments;
    const seen = new Set(), hz = new Map(), jp = new Map();
    let h = 2166136261, nSeg = 0, first = [];
    for (let seg = 0; seg <= end; seg += 30) {
      S.set('carSegIndex', seg);
      S.set('position', seg * SEG - CAMD);
      S.set('runTime', seg * SEG / SPEED);
      S.fn.updateDifficulty();
      S.fn.topUpRoad(seg);
      const segs = S.get('segments');
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (seen.has(s.index)) continue;
        seen.add(s.index); nSeg++;
        const line = record(s) + 'height=' + S.fn.segHeight(s.index).toPrecision(17) + ';';
        h = mixStr(h, line);
        if (first.length < 2) first.push(line);
        if (job.keepRecords) first.push(line);
      }
      for (const z of S.get('hazards')) { const k = z.kind + ':' + z.from; if (!hz.has(k)) hz.set(k, record(z)); }
      for (const j of S.get('jumps')) { const k = j.from; if (!jp.has(k)) jp.set(k, record(j)); }
    }
    for (const k of [...hz.keys()].sort()) { h = mixStr(h, 'H' + hz.get(k)); if (job.keepRecords) first.push('H' + hz.get(k)); }
    for (const k of [...jp.keys()].sort((a, b) => a - b)) { h = mixStr(h, 'J' + jp.get(k)); if (job.keepRecords) first.push('J' + jp.get(k)); }
    return { hash: h >>> 0, segments: nSeg, hazards: hz.size, jumps: jp.size, finishSeg: S.get('finishSeg'),
             todayStamp: S.get('todayStamp'), lastSeed: S.get('lastSeed'), biome: S.get('biome'), first,
             hazardKeys: [...hz.keys()].sort().slice(0, 6), jumpKeys: [...jp.keys()].sort((a, b) => a - b).slice(0, 6) };
  }

  /* A DRIVE. steering.value is the one thing written each frame, the world
     steps once, the frame is hashed. Deaths are followed the way a player
     follows them, through startOrRestart, which is a continue when there
     is a checkpoint and a fresh run when there is not. */
  function drive(S, job) {
    const tapes = root.parityTapes;
    const tape = tapes[job.tape];
    if (!tape) throw new Error('no tape ' + job.tape);
    prepare(S, job);
    const steer = tape.make(job.seed);
    const step = S.fn.step ? function (dt) { S.fn.step(dt); } : function (dt) { genericStep(S, dt); };
    const dt = 1 / 60;
    const FEEL = S.get('FEEL');
    const DRIVING = S.get('DRIVING'), DEAD = S.get('DEAD'), FINISHED = S.get('FINISHED');
    const hashes = new Array(job.maxFrames);
    const events = [];
    let restartsLeft = tape.restarts, tappedThisDeath = false, finishedFrames = 0, n = 0, dump = null, nextTapped = false, nextFrames = 0;
    const steering = S.get('steering');
    for (; n < job.maxFrames; n++) {
      const st = S.get('state');
      if (st === DRIVING) {
        let v = steer(n, S);
        steering.value = v < -1 ? -1 : (v > 1 ? 1 : v);
        tappedThisDeath = false;
      } else if (st === DEAD) {
        if (!tappedThisDeath && restartsLeft > 0) {
          const dead = S.get('deadFor');
          const due = tape.restart === 'reflex' ? true : dead >= FEEL.DEATH_INPUT_LOCK + tape.restartDelay;
          if (due) {
            /* The tap is an input, and the random stand in is reseeded at
               every input so both sides draw the same endless seed from
               it: the original's particle effects have consumed draws the
               module's hooks did not, which is the one place the two
               streams part. */
            S.seedRandom((job.seed ^ Math.imul(n + 1, 2654435761)) >>> 0);
            S.fn.startOrRestart(); tappedThisDeath = true; restartsLeft--; events.push([n, 'tap', S.get('state'), S.get('continues')]);
          }
        } else if (restartsLeft <= 0 && S.get('deadFor') > 2) break;
      } else if (st === FINISHED) {
        finishedFrames++;
        if (tape.afterFinish === 'next' && !nextTapped) {
          /* The whole day is one input at a time: once the finale has run
             its course a tap goes into the next level, and the tape drives
             the opening of it. */
          if (!S.fn.finaleRunning() && S.get('deadFor') >= FEEL.DEATH_INPUT_LOCK + 0.5) {
            S.seedRandom((job.seed ^ Math.imul(n + 7, 2654435761)) >>> 0);
            S.fn.startOrRestart(); nextTapped = true; events.push([n, 'next', S.get('level'), S.get('mode')]);
          }
        } else if (finishedFrames > job.finishFrames) break;
      }
      if (nextTapped && S.get('state') !== FINISHED && ++nextFrames > tape.nextLevelFrames) break;
      step(dt);
      hashes[n] = frameHash(S);
      if (job.dumpAt === n) {
        dump = frameVector(S);
        if (job.audit) for (const name of job.audit) { let v; try { v = S.get(name); } catch (e) { v = '<missing>'; } if (v === null || typeof v !== 'object') dump['hidden:' + name] = v; }
      }
      const after = S.get('state');
      if (after !== st) events.push([n, 'state', st, after, after === DEAD ? S.get('deathKind') : S.get('gatesPassed')]);
    }
    hashes.length = n;
    const out = { frames: n, hashes, events, end: frameVector(S), todayStamp: S.get('todayStamp') };
    if (dump) out.dump = dump;
    if (job.audit) { out.audit = {}; for (const name of job.audit) { let v; try { v = S.get(name); } catch (e) { v = '<missing>'; } out.audit[name] = (v === null || typeof v !== 'object') ? v : '<object>'; } }
    return out;
  }

  /* THE ROUTES. A scripted session: pause and resume, the title screen from
     pause, the mode switch, skipping training, the car pick, the daily from
     the title, with the centre tape steering whenever the car is driving.
     Every call goes through the game's own entry point, by name. */
  function routes(S, job) {
    S.seedRandom(job.seed >>> 0);
    S.set('runsEver', job.runsEver);
    S.set('paused', false);
    const steer = root.parityTapes.centre.make(job.seed);
    const step = S.fn.step ? function (dt) { S.fn.step(dt); } : function (dt) { genericStep(S, dt); };
    const dt = 1 / 60;
    const hashes = [], events = [];
    const script = job.script.slice();
    const DRIVING = S.get('DRIVING');
    const steering = S.get('steering');
    for (let n = 0; n < job.maxFrames; n++) {
      while (script.length && script[0][0] === n) {
        const [, name, ...a] = script.shift();
        // every scripted call is an input, and the random stand in is reseeded at each one; see drive()
        S.seedRandom((job.seed ^ Math.imul(n + 3, 2654435761)) >>> 0);
        if (name === 'set') S.set(a[0], a[1]);
        else S.fn[name].apply(null, a);
        events.push([n, name, S.get('state'), S.get('mode'), S.get('level'), S.get('paused'), S.get('carPick')]);
      }
      if (S.get('state') === DRIVING && !S.get('paused')) { const v = steer(n, S); steering.value = v < -1 ? -1 : (v > 1 ? 1 : v); }
      step(dt);
      hashes.push(frameHash(S));
    }
    if (S.get('todayStamp') !== job.day) throw new Error('todayStamp ' + S.get('todayStamp') + ' wanted ' + job.day);
    return { frames: hashes.length, hashes, events, end: frameVector(S), todayStamp: S.get('todayStamp') };
  }

  function runJob(S, job) {
    try {
      const r = job.kind === 'road' ? road(S, job) : job.kind === 'routes' ? routes(S, job) : drive(S, job);
      r.ok = true; return r;
    } catch (e) {
      return { ok: false, error: String(e && e.stack || e) };
    }
  }
  root.parityProbe = { VERSION, runJob, frameHash, frameVector, SCALARS };
  if (typeof module !== 'undefined') module.exports = root.parityProbe;
})(typeof globalThis !== 'undefined' ? globalThis : this);
