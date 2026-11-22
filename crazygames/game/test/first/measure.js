/* THE CLUNK, AS NUMBERS (briefs/FIRST-MINUTE.md priority 1). From one
   newcomer run's rows (lib.js COLS, one a frame at 60 Hz), everything a
   player could feel as clunky, in the brief's order:
   - the steering, closed loop: how much of the run a steer button is
     held, how often the thumb swaps sides, how far the car wanders;
   - the speed: time to pace from GO, the speed held while steering
     against without, time crawling after a mistake, DRIFT / BRAKE alone;
   - the walls: contacts and hard hits per lap, how hard, the speed each
     takes, the seconds scraping, the camera's shake, the car put back;
   - the drift: how often a DRIFT press with steering starts a scoring
     slide, how long slides hold, how they end (how fast the angle falls
     once the slide is over), spins, and whether a slide comes and goes
     with the thumbs;
   - the interruptions: the countdown, the prompts, slow motion, the
     camera's biggest turn in one frame.
   Every tunable of the judging is in CLUNK; summarise() takes the
   median and the worst over runs. */
export const CLUNK = {
  PACE: 20,            // m/s: at pace, for the time from GO (72 km/h; the careful scripted driver averages 20)
  PACE_HIGH: 25,       // m/s: and a second, higher mark
  CRAWL: 8,            // m/s: under this, after the start, is crawling (29 km/h)
  CRAWL_FROM: 3,       // s after GO before slow counts as crawling
  SLIDE: 12,           // degrees: the score's MIN_ANGLE, a slide that scores
  SLIDE_SPEED: 6,      // m/s: and its MIN_SPEED
  SLIDE_JOIN: 0.15,    // s: a slide broken for less than this is the same slide
  START_WIN: 0.6,      // s after a DRIFT press with steering inside which a scoring slide counts as started by it
  END_WIN: 0.6,        // s after the thumbs let go inside which a slide's end counts as going with them
  SNAP_WIN: 0.4,       // s after a slide ends over which its angle's fall is looked at
  SPIN: 80,            // degrees of slide past which it is a spin
  LOSS_WIN: 0.5,       // s after a wall contact over which the speed it took is looked at
  KICK_WIN: 0.1,       // s after a contact over which the yaw rate's jump is looked at
  CUT: 6,              // degrees the camera turns in one frame past which it reads as a cut
  REVERSE_GAP: 0.3,    // s: a press of one steer button within this of letting the other go is a swap of sides
};

const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const r2 = v => Math.round(v * 100) / 100;

export function clunk(run, cols) {
  const C = CLUNK, rows = run.rows, K = {};
  cols.forEach((k, i) => { K[k] = i; });
  const g = (row, k) => row[K[k]];
  const dt = 1 / 60;
  const go = rows.findIndex(r => g(r, 'st') === 1);
  let end = rows.findIndex((r, i) => i > go && (g(r, 'fin') === 1 || g(r, 'st') === 2));
  if (end < 0) end = rows.length;
  const drive = rows.slice(go, end);
  const laps = run.track && run.track.kind === 'circuit' ? run.track.laps || 3 : 1;
  const out = { seconds: run.results ? r2(run.results.seconds) : null, score: run.results ? run.results.score : null, stars: run.results ? run.results.stars : null, coins: run.results ? run.results.coins : null, cleanSectors: run.results ? run.results.cleanSectors : null, parts: run.results ? run.results.parts : null, finished: !!run.results };
  /* ---- the speed ---- */
  const at = (i) => drive[i] ? g(drive[i], 't') : 0;
  const first = (pred) => { for (let i = 0; i < drive.length; i++) if (pred(drive[i])) return r2(at(i)); return null; };
  out.meanV = r2(mean(drive.map(r => g(r, 'v'))));
  out.toPace = first(r => g(r, 'v') >= C.PACE);
  out.toPaceHigh = first(r => g(r, 'v') >= C.PACE_HIGH);
  out.crawlS = r2(drive.filter(r => g(r, 't') > C.CRAWL_FROM && g(r, 'v') < C.CRAWL).length * dt);
  const late = drive.filter(r => g(r, 't') > 4);
  const held = late.filter(r => g(r, 'inS') !== 0 && !g(r, 'inH')), free = late.filter(r => g(r, 'inS') === 0 && !g(r, 'inH'));
  out.steerShare = r2(drive.filter(r => g(r, 'inS') !== 0).length / Math.max(1, drive.length));
  out.vSteering = r2(mean(held.map(r => g(r, 'v'))));
  out.vNotSteering = r2(mean(free.map(r => g(r, 'v'))));
  /* ---- the steering, closed loop ---- */
  let presses = 0, swaps = 0, lastSide = 0, offT = 1e9;
  for (let i = 1; i < drive.length; i++) {
    const a = g(drive[i - 1], 'inS'), b = g(drive[i], 'inS');
    const sa = a > 0 ? 1 : a < 0 ? -1 : 0, sb = b > 0 ? 1 : b < 0 ? -1 : 0;
    if (sb !== 0 && sb !== sa) { presses++; if (lastSide && sb === -lastSide && offT <= C.REVERSE_GAP) swaps++; }
    if (sa !== 0 && sb === 0) { lastSide = sa; offT = 0; } else if (sb === 0) offT += dt; else { lastSide = sb; offT = 0; }
  }
  const driveS = Math.max(dt, drive.length * dt);
  out.pressesPer10s = r2(presses / driveS * 10);
  out.swapsPer10s = r2(swaps / driveS * 10);
  out.wander = r2(mean(drive.map(r => Math.abs(g(r, 'lat')) / Math.max(1, g(r, 'hw')))));   // the share of the half width off the centre, on average
  /* ---- the walls ---- */
  const contacts = [];
  for (let i = 1; i < drive.length; i++) if (g(drive[i], 'touch') && !g(drive[i - 1], 'touch')) contacts.push(i);
  const hits = drive.filter(r => g(r, 'hit') > 0.8).map(r => g(r, 'hit'));
  out.contactsPerLap = r2(contacts.length / laps);
  out.hardPerLap = r2(drive.reduce((n, r) => n + g(r, 'hard'), 0) / laps);
  out.impactMean = r2(mean(hits));
  out.impactMax = r2(hits.length ? Math.max(...hits) : 0);
  const losses = contacts.map(i => { const v0 = g(drive[Math.max(0, i - 1)], 'v'); let lo = v0; for (let k = i; k < Math.min(drive.length, i + C.LOSS_WIN * 60); k++) lo = Math.min(lo, g(drive[k], 'v')); return v0 - lo; });
  out.lossPerContact = r2(mean(losses));
  out.lossTotal = r2(losses.reduce((s, x) => s + x, 0));
  out.scrapeS = r2(drive.filter(r => g(r, 'touch')).length * dt);
  out.shakeMax = r2(Math.max(0, ...drive.map(r => g(r, 'shake'))));
  const kicks = contacts.map(i => { const r0 = g(drive[Math.max(0, i - 1)], 'r'); let m = 0; for (let k = i; k < Math.min(drive.length, i + C.KICK_WIN * 60); k++) m = Math.max(m, Math.abs(g(drive[k], 'r') - r0)); return m; });
  out.yawKickMean = r2(mean(kicks));
  out.putBack = drive.filter(r => g(r, 'resp') === 2).length;
  out.offTrack = drive.filter(r => g(r, 'resp') === 1).length;
  /* ---- the drift ---- */
  const ang = r => Math.abs(g(r, 'ang')), scoring = r => ang(r) >= C.SLIDE && g(r, 'v') >= C.SLIDE_SPEED;
  const slides = [];
  let cur = null;
  for (let i = 0; i < drive.length; i++) {
    if (scoring(drive[i])) { if (cur && i - cur.end <= C.SLIDE_JOIN * 60) cur.end = i; else { cur = { start: i, end: i }; slides.push(cur); } }
  }
  out.slides = slides.length;
  out.slideSecondsMean = r2(mean(slides.map(s => (s.end - s.start + 1) * dt)));
  out.slideSecondsTotal = r2(slides.reduce((n, s) => n + (s.end - s.start + 1) * dt, 0));
  out.slidesOverOneSecond = slides.filter(s => (s.end - s.start + 1) * dt >= 1).length;
  out.slideAngleMean = r2(mean(slides.map(s => mean(drive.slice(s.start, s.end + 1).map(ang)))));
  const falls = slides.map(s => { let m = 0; for (let k = s.end; k < Math.min(drive.length - 1, s.end + C.SNAP_WIN * 60); k++) m = Math.max(m, (ang(drive[k]) - ang(drive[k + 1])) * 60); return m; });
  out.endFallMean = r2(mean(falls));   // degrees a second the angle falls by, at most, as a slide ends: a snap back reads high
  out.endFallMax = r2(falls.length ? Math.max(...falls) : 0);
  out.spins = 0;
  for (let i = 1; i < drive.length; i++) if (ang(drive[i]) > C.SPIN && ang(drive[i - 1]) <= C.SPIN) out.spins++;
  /* a DRIFT press with steering, and what it did */
  const driftPresses = [], alone = [];
  for (let i = 1; i < drive.length; i++) {
    if (g(drive[i], 'inH') && !g(drive[i - 1], 'inH')) {
      let j = i; while (j < drive.length && g(drive[j], 'inH')) j++;
      (g(drive[i], 'inS') !== 0 ? driftPresses : alone).push({ i, until: j });
    }
  }
  const startedBy = driftPresses.filter(p => slides.some(s => s.start >= p.i - 6 && s.start <= p.i + C.START_WIN * 60) || scoring(drive[p.i]));
  out.driftPresses = driftPresses.length;
  out.driftPressStarts = r2(driftPresses.length ? startedBy.length / driftPresses.length : 0);
  /* a slide's end goes with the thumbs when the steering (or DRIFT) was let go inside END_WIN before it */
  const withThumbs = slides.filter(s => { for (let k = Math.max(0, s.end - C.END_WIN * 60); k <= s.end; k++) { const a = drive[k], b = drive[k + 1] || a; if ((g(a, 'inS') !== 0 && g(b, 'inS') === 0) || (g(a, 'inH') && !g(b, 'inH')) || (g(a, 'inS') !== g(b, 'inS'))) return true; } return false; });
  out.slideEndsWithThumbs = r2(slides.length ? withThumbs.length / slides.length : 0);
  out.driftAlonePresses = alone.length;
  out.driftAloneLoss = r2(mean(alone.map(p => { const v0 = g(drive[p.i - 1], 'v'); let lo = v0; for (let k = p.i; k < Math.min(drive.length, p.until + 18); k++) lo = Math.min(lo, g(drive[k], 'v')); return v0 - lo; })));
  /* ---- the interruptions ---- */
  out.countdownS = r2(rows.filter(r => g(r, 'st') === 0).length * dt);
  out.promptS = r2(rows.filter(r => g(r, 'prompt') >= 1 && g(r, 'prompt') <= 5).length * dt);
  out.infoS = r2(rows.filter(r => g(r, 'prompt') === 6).length * dt);
  const fin = rows.findIndex(r => g(r, 'fin') === 1), res = rows.findIndex(r => g(r, 'st') === 2);
  out.lineToResultsS = fin >= 0 && res >= 0 ? r2((res - fin) * dt) : null;
  let cut = 0, cuts = 0, fovStep = 0;
  for (let i = 1; i < rows.length; i++) {
    let d = Math.abs(g(rows[i], 'cyaw') - g(rows[i - 1], 'cyaw')); if (d > 180) d = 360 - d;
    if (d > cut) cut = d; if (d > C.CUT) cuts++;
    fovStep = Math.max(fovStep, Math.abs(g(rows[i], 'fov') - g(rows[i - 1], 'fov')));
  }
  out.cameraTurnMax = r2(cut); out.cameraCuts = cuts; out.fovStepMax = r2(fovStep);
  return out;
}

/* over runs: each number's median and its worst (the worse end for that number), and how many runs earned a star */
const WORSE_LOW = new Set(['score', 'stars', 'coins', 'meanV', 'vSteering', 'vNotSteering', 'driftPressStarts', 'slideSecondsMean', 'slideSecondsTotal', 'slidesOverOneSecond', 'slideEndsWithThumbs', 'slides', 'slideAngleMean']);
export function summarise(list) {
  const keys = Object.keys(list[0]).filter(k => k !== 'seed' && (typeof list[0][k] === 'number' || list[0][k] === null));
  const o = { runs: list.length, withStar: list.filter(m => m.stars >= 1).length, finished: list.filter(m => m.finished).length };
  for (const k of keys) {
    const v = list.map(m => m[k]).filter(x => typeof x === 'number').sort((a, b) => a - b);
    if (!v.length) { o[k] = null; continue; }
    o[k] = { median: v[Math.floor(v.length / 2)], worst: WORSE_LOW.has(k) ? v[0] : v[v.length - 1] };
  }
  return o;
}
