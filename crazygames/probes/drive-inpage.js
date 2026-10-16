/* AN IN PAGE DRIVE FOR THE PROBES. The parity probe's drive, with a hook
   on every frame so a probe can look at the world while the tape is
   driving. Same preparation, same tapes, same restart rules, same real
   frame stepping (integer milliseconds, 17 apart), so what the probes
   measure is measured on the drives the parity test has already proven
   identical to the original's. */
(function (root) {
  'use strict';
  function applyInput(S, tape, v) {
    v = v < -1 ? -1 : (v > 1 ? 1 : v);
    if (tape.kind === 'digital') { const held = S.get('held'); held.keyLeft = v < -0.15; held.keyRight = v > 0.15; }
    else { const tilt = S.get('tilt'); tilt.active = true; tilt.value = v; }
  }
  function releaseInput(S) {
    const held = S.get('held'); held.keyLeft = held.keyRight = held.touchLeft = held.touchRight = false;
    const tilt = S.get('tilt'); tilt.value = 0;
  }
  function prepare(S, job) {
    S.seedRandom(job.seed >>> 0);
    S.set('paused', false);
    S.set('runsEver', job.runsEver === undefined ? 10 : job.runsEver);
    S.set('mode', S.get(job.mode || 'DAILY'));
    S.set('level', job.level);
    S.set('seedPinned', false);
    const tilt = S.get('tilt'); tilt.seenSensor = true; tilt.rawDeg = null; tilt.zeroDeg = null; tilt.active = false; tilt.value = 0;
    releaseInput(S);
    S.fn.startRun();
    if (job.day && S.get('todayStamp') !== job.day) throw new Error('todayStamp ' + S.get('todayStamp') + ' after startRun, wanted ' + job.day);
  }
  /* job: { level, mode, seed, tape, maxFrames, day, every }, hooks: { frame(n, S, info) } */
  function drive(S, job, hooks) {
    const tape = root.parityTapes[job.tape];
    if (!tape) throw new Error('no tape ' + job.tape);
    prepare(S, job);
    const steer = tape.make(job.seed);
    S.set('lastTime', 0);
    let t = 0;
    const step = () => { t += 17; S.fn.__frame(t); };
    const FEEL = S.get('FEEL');
    const DRIVING = S.get('DRIVING'), DEAD = S.get('DEAD'), FINISHED = S.get('FINISHED');
    const events = [];
    let restartsLeft = tape.restarts, tappedThisDeath = false, finishedFrames = 0, n = 0, nextTapped = false, nextFrames = 0;
    const every = job.every || 1;
    for (; n < job.maxFrames; n++) {
      const st = S.get('state');
      if (st === DRIVING) { applyInput(S, tape, steer(n, S)); tappedThisDeath = false; }
      else if (st === DEAD) {
        releaseInput(S);
        if (!tappedThisDeath && restartsLeft > 0) {
          const due = tape.restart === 'reflex' ? true : S.get('deadFor') >= FEEL.DEATH_INPUT_LOCK + tape.restartDelay;
          if (due) { S.seedRandom((job.seed ^ Math.imul(n + 1, 2654435761)) >>> 0); S.fn.startOrRestart(); tappedThisDeath = true; restartsLeft--; events.push([n, 'tap', S.get('state'), S.get('continues')]); }
        } else if (restartsLeft <= 0 && S.get('deadFor') > 2) break;
      } else if (st === FINISHED) {
        releaseInput(S);
        finishedFrames++;
        if (tape.afterFinish === 'next' && !nextTapped) {
          if (!S.fn.finaleRunning() && S.get('deadFor') >= FEEL.DEATH_INPUT_LOCK + 0.5) { S.seedRandom((job.seed ^ Math.imul(n + 7, 2654435761)) >>> 0); S.fn.startOrRestart(); nextTapped = true; events.push([n, 'next', S.get('level'), S.get('mode')]); }
        } else if (finishedFrames > (job.finishFrames || 600)) break;
      }
      if (nextTapped && S.get('state') !== FINISHED && ++nextFrames > tape.nextLevelFrames) break;
      step();
      const after = S.get('state');
      if (after !== st) events.push([n, 'state', st, after, after === DEAD ? S.get('deathKind') : S.get('gatesPassed')]);
      if (hooks && hooks.frame && (n % every === 0 || after !== st)) hooks.frame(n, S, { before: st, after });
    }
    return { frames: n, events };
  }
  root.driveProbe = { drive, prepare };
})(typeof globalThis !== 'undefined' ? globalThis : this);
