/* THE JOBS, built in one place so the orchestrator and the diagnosis tool
   agree on every seed and every parameter. A group is one page per side,
   its jobs run in order, so state carries from job to job exactly as it
   would in a session of play. */
export const LEVELS = [1, 2, 3, 4, 5, 6];
export const TAPES = ['driver', 'centre', 'hug', 'swing', 'chaos'];
export const MAX_FRAMES = 14000, FINISH_FRAMES = 600;
export const VIEW = { width: 390, height: 844 }, VIEW_WIDE = { width: 1280, height: 720 };

export function dayList(from, n) {
  const y = Math.floor(from / 10000), m = Math.floor(from / 100) % 100, d = from % 100;
  const out = [];
  for (let i = 0; i < n; i++) { const t = new Date(y, m - 1, d + i, 12); out.push(t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate()); }
  return out;
}
export const seedOf = (day, level, tape) => ((day * 31 + level * 7 + TAPES.indexOf(tape) * 3 + 11) >>> 0);

export function buildGroups(days) {
  const groups = [];
  for (const level of LEVELS) {
    const jobs = [];
    for (const day of days) {
      jobs.push({ kind: 'road', key: `road L${level} ${day}`, day, level, mode: 'DAILY', runsEver: 10, seed: seedOf(day, level, 'road') });
      for (const tape of TAPES) jobs.push({ kind: 'drive', key: `drive L${level} ${day} ${tape}`, day, level, mode: 'DAILY', runsEver: 10, seed: seedOf(day, level, tape), tape, maxFrames: MAX_FRAMES, finishFrames: FINISH_FRAMES });
    }
    groups.push({ name: 'level ' + level, jobs });
  }
  {
    const jobs = [];
    for (const day of days) {
      jobs.push({ kind: 'road', key: `road endless ${day}`, day, level: 2, mode: 'ENDLESS', runsEver: 10, seed: seedOf(day, 0, 'road'), endlessSegments: 3000 });
      jobs.push({ kind: 'drive', key: `drive endless ${day} centre`, day, level: 2, mode: 'ENDLESS', runsEver: 10, seed: seedOf(day, 0, 'centre'), tape: 'centre', maxFrames: 6000, finishFrames: FINISH_FRAMES });
    }
    groups.push({ name: 'endless', jobs });
  }
  {
    /* The routes, per day. Frame numbers are chosen so each call lands in
       the state it is meant for: setPaused needs DRIVING, leaveRun needs a
       pause, skipTraining needs the training level, the car pick and the
       mode switch work from the title. */
    const jobs = [];
    for (const day of days.slice(0, 6)) jobs.push({ kind: 'routes', key: `routes ${day}`, day, runsEver: 10, seed: seedOf(day, 9, 'centre'), maxFrames: 4200, script: [
      [0, 'set', 'mode', 1], [0, 'set', 'level', 1], [0, 'startRun'],
      [240, 'setPaused', true], [300, 'togglePause'], [360, 'setPaused', true], [420, 'leaveRun'],
      [480, 'nextCar'], [500, 'nextCar'], [520, 'switchMode'], [540, 'startEndless'],
      [900, 'setPaused', true], [960, 'leaveRun'], [1000, 'switchMode'], [1020, 'startDaily'],
      [1200, 'skipTraining'], [1800, 'setPaused', true], [1830, 'leaveRun'], [1900, 'set', 'level', 2], [1920, 'startRun'],
      [2600, 'startOrRestart'], [3400, 'setPaused', true], [3460, 'togglePause'] ] });
    groups.push({ name: 'routes', jobs });
  }
  {
    const jobs = [];
    for (const day of days.slice(0, 4)) jobs.push({ kind: 'drive', key: `drive fresh L2 ${day} centre`, day, level: 2, mode: 'DAILY', runsEver: 0, seed: seedOf(day, 2, 'centre'), tape: 'centre', maxFrames: MAX_FRAMES, finishFrames: FINISH_FRAMES });
    groups.push({ name: 'fresh player, eased ramp', jobs });
  }
  return groups;
}
export function viewportJobs(days) {
  const jobs = [];
  for (const day of days.slice(0, 4)) {
    jobs.push({ kind: 'road', key: `road L3 ${day}`, day, level: 3, mode: 'DAILY', runsEver: 10, seed: seedOf(day, 3, 'road') });
    jobs.push({ kind: 'drive', key: `drive L3 ${day} centre`, day, level: 3, mode: 'DAILY', runsEver: 10, seed: seedOf(day, 3, 'centre'), tape: 'centre', maxFrames: MAX_FRAMES, finishFrames: FINISH_FRAMES });
  }
  return jobs;
}
export function perturbJobs(days) {
  return {
    physics: [{ kind: 'drive', key: `drive L2 ${days[0]} centre`, day: days[0], level: 2, mode: 'DAILY', runsEver: 10, seed: seedOf(days[0], 2, 'centre'), tape: 'centre', maxFrames: MAX_FRAMES, finishFrames: FINISH_FRAMES, perturb: { HEADING_BUILD_TIME: 0.21 }, note: 'HEADING_BUILD_TIME 0.20 to 0.21' }],
    generator: [{ kind: 'road', key: `road L2 ${days[0]}`, day: days[0], level: 2, mode: 'DAILY', runsEver: 10, seed: seedOf(days[0], 2, 'road'), perturb: { CHECKPOINT_EVERY: 1301 }, note: 'CHECKPOINT_EVERY 1300 to 1301' }],
  };
}
