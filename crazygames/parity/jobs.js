/* THE JOBS, built in one place so the orchestrator and the diagnosis tool
   agree on every seed and every parameter. A group is one page per side,
   its jobs run in order, so state carries from job to job exactly as it
   would in a session of play. */
export const LEVELS = [1, 2, 3, 4, 5, 6];
export const TAPES = ['driver', 'keys', 'centre', 'hug', 'swing', 'chaos'];
export const MAX_FRAMES = 14000, FINISH_FRAMES = 600;
export const VIEW = { width: 390, height: 844 }, VIEW_WIDE = { width: 1280, height: 720 };
export const SENTINEL_DAY = 20000101;   // the day both sides boot on, so the first startRun rolls

export function dayList(from, n) {
  const y = Math.floor(from / 10000), m = Math.floor(from / 100) % 100, d = from % 100;
  const out = [];
  for (let i = 0; i < n; i++) { const t = new Date(y, m - 1, d + i, 12); out.push(t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate()); }
  return out;
}
export const seedOf = (day, level, tape) => ((day * 31 + level * 7 + TAPES.indexOf(tape) * 3 + 11) >>> 0);
const drive = (day, level, tape, extra) => ({ kind: 'drive', key: `drive L${level} ${day} ${tape}`, day, level, mode: 'DAILY', runsEver: 10, seed: seedOf(day, level, tape), tape, maxFrames: MAX_FRAMES, finishFrames: FINISH_FRAMES, ...extra });
const road = (day, level, extra) => ({ kind: 'road', key: `road L${level} ${day}`, day, level, mode: 'DAILY', runsEver: 10, seed: seedOf(day, level, 'road'), ...extra });

/* The routes script, per day. Frame numbers are chosen so each call lands
   in the state it is meant for: setPaused needs DRIVING, leaveRun needs a
   run, skipTraining needs the training level and no training record, the
   car pick and the mode switch work from the title, a crash needs a run to
   end and startOrRestart after it is the continue or the restart, a finish
   followed by two taps is the finale skipped and the next level. */
const ROUTES = [
  [0, 'set', 'mode', 1], [0, 'set', 'level', 1], [0, 'set', 'trainedEver', false], [0, 'startRun'],
  [240, 'setPaused', true], [300, 'togglePause'], [360, 'setPaused', true], [420, 'leaveRun'],
  [480, 'pickCar', 1], [500, 'pickCar', 0], [520, 'switchMode'], [540, 'startEndless'],
  [900, 'setPaused', true], [960, 'leaveRun'], [1000, 'startTitleRoute'],
  [1200, 'skipTraining'], [1800, 'crash', 0], [1900, 'startOrRestart'], [2200, 'crash', 1], [2260, 'startOrRestart'],
  [2600, 'finishRun'], [2660, 'startOrRestart'], [2700, 'startOrRestart'],
  [3400, 'setPaused', true], [3460, 'togglePause'], [3500, 'startMode', 1], [3600, 'leaveRun'], [3620, 'startTitleRoute'],
  [3700, 'leaveRun'], [3700, 'set', 'trainedEver', true], [3720, 'startTitleRoute']];

export function buildGroups(days) {
  const groups = [];
  for (const level of LEVELS) {
    const jobs = [];
    for (const day of days) { jobs.push(road(day, level)); for (const tape of TAPES) jobs.push(drive(day, level, tape)); }
    groups.push({ name: 'level ' + level, jobs });
  }
  {
    const jobs = [];
    for (const day of days) {
      jobs.push({ kind: 'road', key: `road endless ${day}`, day, level: 2, mode: 'ENDLESS', runsEver: 10, seed: seedOf(day, 0, 'road'), endlessSegments: 3000 });
      jobs.push({ kind: 'drive', key: `drive endless ${day} centre`, day, level: 2, mode: 'ENDLESS', runsEver: 10, seed: seedOf(day, 0, 'centre'), tape: 'centre', maxFrames: 6000, finishFrames: FINISH_FRAMES });
      jobs.push({ kind: 'drive', key: `drive endless ${day} hug`, day, level: 2, mode: 'ENDLESS', runsEver: 10, seed: seedOf(day, 0, 'hug'), tape: 'hug', maxFrames: 6000, finishFrames: FINISH_FRAMES });
    }
    groups.push({ name: 'endless', jobs });
  }
  {
    const jobs = [];
    for (const day of days.slice(0, 6)) jobs.push({ kind: 'routes', key: `routes ${day}`, day, runsEver: 10, seed: seedOf(day, 9, 'centre'), maxFrames: 4200, script: ROUTES });
    groups.push({ name: 'routes', jobs });
  }
  {
    /* Records, ghosts and the car pick, read back from the store after a
       reload on both sides: the original's page reloads with its
       localStorage, the module is created again over the same store. */
    const jobs = [];
    for (const day of days.slice(0, 2)) {
      jobs.push(drive(day, 1, 'driver', { key: `records L1 ${day} driver` }));
      jobs.push({ kind: 'reload', key: `reload A ${day}`, day });
      jobs.push({ kind: 'snapshot', key: `snapshot A ${day}`, day });
      jobs.push(drive(day, 2, 'centre', { key: `records L2 ${day} centre` }));
      jobs.push({ kind: 'reload', key: `reload B ${day}`, day });
      jobs.push({ kind: 'snapshot', key: `snapshot B ${day}`, day });
      jobs.push(drive(day, 2, 'centre', { key: `records L2 ${day} centre again` }));   // the ghost of the run before
      jobs.push({ kind: 'reload', key: `reload C ${day}`, day });
      jobs.push({ kind: 'snapshot', key: `snapshot C ${day}`, day });
    }
    groups.push({ name: 'records across reloads', jobs });
  }
  {
    /* The clock running out: on BOTH sides the clock starts short, nothing
       pays it back and a gate is worth a second, so the one death the tapes
       never reach, RAN_OUT, is compared too. The driver survives the on
       ramp, which is where the clock is pinned, and dies to the clock. */
    const jobs = [];
    for (const day of days.slice(0, 3)) jobs.push(drive(day, 3, 'driver', { key: `ranout L3 ${day} driver`, perturb: { CLOCK_START: 2, CLOCK_DRIFT_RATE: 0, CLOCK_CHECKPOINT: 1 } }));
    groups.push({ name: 'ran out of time', jobs });
  }
  {
    const jobs = [];
    for (const day of days.slice(0, 4)) jobs.push(drive(day, 2, 'centre', { key: `drive fresh L2 ${day} centre`, runsEver: 0 }));
    groups.push({ name: 'fresh player, eased ramp', jobs });
  }
  {
    /* K6: the original advanced by its own frame(t), drawing every frame,
       against the module's step(dt) with the same dt sequence. Short
       drives, because drawing is slow in a headless browser. */
    const jobs = [];
    for (const level of [2, 3]) jobs.push(drive(days[0], level, 'driver', { key: `realframe L${level} ${days[0]} driver`, realFrame: true, maxFrames: 1500 }));
    jobs.push(drive(days[0], 1, 'keys', { key: `realframe L1 ${days[0]} keys`, realFrame: true, maxFrames: 1500 }));
    groups.push({ name: 'real frame', jobs });
  }
  return groups;
}
export function viewportJobs(days) {
  const jobs = [];
  for (const day of days.slice(0, 4)) { jobs.push(road(day, 3)); jobs.push(drive(day, 3, 'centre')); }
  return jobs;
}
export function perturbJobs(days) {
  return {
    physics: [drive(days[0], 2, 'centre', { perturb: { HEADING_BUILD_TIME: 0.21 }, note: 'HEADING_BUILD_TIME 0.20 to 0.21' })],
    generator: [road(days[0], 2, { perturb: { CHECKPOINT_EVERY: 1301 }, note: 'CHECKPOINT_EVERY 1300 to 1301' })],
  };
}

/* THE SHIPPED PAGE. Stage 2: the greybox page, driven through its own
   frame function with the renderer attached, against the original driven
   through its own frame(), on the same days, levels and tapes. Every job
   is a real frame job (integer millisecond timestamps 17 apart on both
   sides), shorter than the module's, because both sides draw every frame
   in a headless browser. Some drive the input through the page's own
   handlers: arrow keys, the two halves of the canvas, the Enter key for a
   tap. A records sequence reloads the page between runs. */
export const PAGE_VIEW = { width: 120, height: 260 };   // phone proportions, small because the headless GPU is a software rasteriser and the cost is per pixel
export function pageGroups(days, quick) {
  const d0 = days[0], d1 = days[1] || days[0];
  const real = (job, frames, extra) => ({ ...job, realFrame: true, maxFrames: frames, key: 'page ' + job.key, ...extra });
  const jobs = [];
  if (quick) {
    jobs.push(real(drive(d0, 2, 'driver'), 900));
    jobs.push(real(drive(d0, 5, 'hug'), 900));
    jobs.push(real(drive(d0, 3, 'keys'), 600, { inputVia: 'keys', key: 'page drive L3 ' + d0 + ' keys by events' }));
    jobs.push(real(drive(d0, 2, 'keys'), 600, { inputVia: 'pointer', key: 'page drive L2 ' + d0 + ' keys by pointer' }));
  } else {
    /* Sized for a two core runner: both sides draw every frame and the
       page's frames cost tens of milliseconds in a software rasteriser. */
    for (const level of LEVELS) { jobs.push(real(drive(d0, level, 'driver'), 1000)); jobs.push(real(drive(d0, level, 'hug'), 800)); jobs.push(real(drive(d0, level, 'chaos'), 500)); }
    jobs.push(real(drive(d1, 4, 'keys'), 1000, { inputVia: 'keys', key: 'page drive L4 ' + d1 + ' keys by events' }));
    jobs.push(real(drive(d1, 2, 'keys'), 1000, { inputVia: 'pointer', key: 'page drive L2 ' + d1 + ' keys by pointer' }));
    jobs.push(real(drive(d1, 3, 'centre'), 800));
    jobs.push(real(drive(d1, 5, 'swing'), 600));
    jobs.push(real({ kind: 'drive', key: `drive endless ${d1} centre`, day: d1, level: 2, mode: 'ENDLESS', runsEver: 10, seed: seedOf(d1, 0, 'centre'), tape: 'centre', finishFrames: FINISH_FRAMES }, 800));
    jobs.push({ kind: 'routes', key: `page routes ${d1}`, day: d1, runsEver: 10, seed: seedOf(d1, 9, 'centre'), maxFrames: 4200, script: ROUTES, realFrame: true });
  }
  const groups = [{ name: 'page', jobs }];
  {
    /* Records across a reload of the shipped page: training finished, the
       page reloaded with its localStorage, the records and the ghost read
       back, then a run against that ghost. */
    const rec = [];
    rec.push(real(drive(d0, 1, 'driver', { key: `records L1 ${d0} driver` }), quick ? 1200 : 3000));
    rec.push({ kind: 'reload', key: `page reload ${d0}`, day: d0 });
    rec.push({ kind: 'snapshot', key: `page snapshot ${d0}`, day: d0 });
    rec.push(real(drive(d0, 2, 'centre', { key: `records L2 ${d0} centre` }), quick ? 600 : 900));
    groups.push({ name: 'page records', jobs: rec });
  }
  return groups;
}
/* The known answer: the renderer writes a field it should only read. */
export const PAGE_BREAK_FIELD = 'carPitch';
export function pageBreakJobs(days) {
  return [{ ...drive(days[0], 2, 'centre'), realFrame: true, maxFrames: 240, key: 'page break L2 ' + days[0] + ' centre' }];
}
/* The page at two viewports: its layout changes, its simulation must not. */
export function pageViewportJobs(days) {
  return [{ ...drive(days[0], 3, 'driver'), realFrame: true, maxFrames: 600, key: 'page viewport L3 ' + days[0] + ' driver' }];
}
