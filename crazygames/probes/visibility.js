/* STAGE 2 "DONE" 3: THE ROAD AHEAD STAYS VISIBLE.

   A. Seconds of road visible ahead at top speed, at 390x844 and 1280x720:
      on the parity driver tape over three days and six levels, every
      tenth frame, the contiguous run of road ahead of the car whose
      segment centres project on screen and are not hidden by anything
      the renderer draws (a ray from the camera to each). Worst case, the
      count under 3.5 seconds, the fifth percentile and the median.
      Known answer B: a fake crest dropped 30 segments ahead of the car
      must cut the run to under 30 segments.
   B. For every hazard and jump on 28 days of every level, the first car
      position at which it is drawn, on screen and unoccluded, against
      the first position at which the original's own drawRoad rule draws
      it with the reference camera, swept a segment at a time. The count
      of targets this renderer shows later than the original, and the
      worst lateness.
      Known answer A: the replica of the original's rule agrees with the
      original page's own bvis table on every segment of every frame of a
      drawn drive. Known answer C: the fake crest before a target makes
      this renderer show it later, and the probe says so.

   The drives for A skip the GPU submission (the geometry is what is
   measured, and a software rasteriser costs forty milliseconds a frame);
   everything else is the shipped page as it runs.

   node probes/visibility.js [--quick]   writes review/stage-2/visibility.json */
import path from 'node:path';
import * as L from './lib.js';
import * as J from '../parity/jobs.js';

const quick = process.argv.includes('--quick');
const days = J.dayList(20261001, 28);
const env = await L.start();
const results = { started: new Date().toISOString(), knownAnswers: {}, run: {}, targets: null };

/* ---- known answer A: the replica against the original page ---- */
for (const viewport of [J.VIEW, J.VIEW_WIDE]) {
  const side = await L.openSide(env, 'original', viewport, days[0]);
  await side.page.addScriptTag({ path: path.join(L.here, 'visibility-inpage.js') });
  const r = await side.page.evaluate(({ job, w, h }) => {
    const S = window.__S, V = window.visibilityProbe;
    let frames = 0, cells = 0, mismatches = 0, first = null;
    window.driveProbe.drive(S, job, { frame: (n) => {
      /* the original has just drawn this frame: its bvis is for its own position, camHeight and cameraX */
      const t = V.originalTable(S.get('position'), w, h, S.get('camHeight'), S.get('cameraX'));
      /* the page's bvis is read after the far field merge, which clears it
         on absorbed segments and gives them an anchor instead: drawn means
         bvis or an anchor, which is what segAnchor answers */
      const bvis = S.get('bvis'), banchor = S.get('banchor'), count = S.get('bcount');
      if (!t) return;
      frames++;
      for (let k = 0; k < Math.min(count, t.count); k++) { cells++; const drawn = (bvis[k] || banchor[k] >= 0) ? 1 : 0; if (drawn !== t.bvis[k]) { mismatches++; if (!first) first = { n, k, page: drawn, replica: t.bvis[k] }; } }
    } });
    return { frames, cells, mismatches, first };
  }, { job: { day: days[0], level: 3, mode: 'DAILY', seed: J.seedOf(days[0], 3, 'driver'), tape: 'driver', maxFrames: quick ? 200 : 600, every: 1 }, w: viewport.width, h: viewport.height });
  results.knownAnswers['A replica vs original bvis ' + viewport.width + 'x' + viewport.height] = { ...r, pass: r.frames > 0 && r.mismatches === 0, errors: side.errors };
  console.log('known answer A at ' + viewport.width + 'x' + viewport.height + ': ' + JSON.stringify(r));
  await side.close();
}

/* ---- A: the visible run on drives ---- */
for (const viewport of [J.VIEW, J.VIEW_WIDE]) {
  const side = await L.openSide(env, 'page', viewport, days[0]);
  await side.page.addScriptTag({ path: path.join(L.here, 'visibility-inpage.js') });
  const runs = [], reasons = {};
  let bump = null;
  const levels = quick ? [2, 5] : J.LEVELS;
  const useDays = quick ? [days[0]] : days.slice(0, 3);
  for (const day of useDays) {
    await side.page.clock.setFixedTime(L.dayDate(day));
    for (const level of levels) {
      const r = await side.page.evaluate(({ job, w, h, bumpTest }) => {
        const S = window.__S, V = window.visibilityProbe, P = S.world.probe, F = S.get('FEEL');
        const renderer = S.world.renderer; const real = renderer.render; renderer.render = () => {};
        const out = [], reasons = {};
        let bump = null;
        try {
          window.driveProbe.drive(S, job, { frame: (n) => {
            if (S.get('state') !== S.get('DRIVING') || S.fn.countHolding()) return;
            const v = V.visibleRun(w, h);                                   // everything drawn can hide the road: ramps, gantries, trees
            const g = V.visibleRun(w, h, ['road']);     // the road surface alone, which is all the original's rule knows
            const o = V.originalRun(w, h);
            out.push([n, v.segments, v.furthest, o.segments, o.furthest, g.segments, g.furthest]);
            reasons[v.reason] = (reasons[v.reason] || 0) + 1;
            if (bumpTest && !bump && n > 300 && v.segments > 100) {
              // the known answer: a crest 30 segments ahead, then the run again
              const T = P.table();
              P.setBump(T.carIdx + 30, 2500); P.rebuild(w, h);
              const vb = V.visibleRun(w, h);
              P.setBump(-1, 0); P.rebuild(w, h);
              bump = { at: n, without: g.segments, withCrest: vb.segments, reason: vb.reason, caught: vb.segments <= 30 && /^occluded/.test(vb.reason) };
            }
          } });
        } finally { renderer.render = real; }
        return { out, reasons, bump };
      }, { job: { day, level, mode: 'DAILY', seed: J.seedOf(day, level, 'driver'), tape: 'driver', maxFrames: quick ? 500 : 900, every: 10 }, w: viewport.width, h: viewport.height, bumpTest: !bump });
      for (const [n, segs, furthest, oSegs, oFurthest, gSegs, gFurthest] of r.out) runs.push({ day, level, n, segs, furthest, oSegs, oFurthest, gSegs, gFurthest });
      for (const k in r.reasons) reasons[k] = (reasons[k] || 0) + r.reasons[k];
      if (r.bump && !bump) bump = r.bump;
      process.stdout.write('  run ' + viewport.width + 'x' + viewport.height + ' L' + level + ' ' + day + ': ' + r.out.length + ' frames, min run ' + Math.min(...r.out.map(x => x[1])) + ' segments here, ' + Math.min(...r.out.map(x => x[3])) + ' by the original\n');
    }
  }
  const F = await side.page.evaluate(() => ({ L: window.__S.get('FEEL').SEGMENT_LENGTH, SPEED: window.__S.get('FEEL').SPEED }));
  const sec = v => +(v * F.L / F.SPEED).toFixed(2);
  const dist = (key) => { const a = runs.map(r => r[key]).sort((x, y) => x - y); return { worstSeconds: sec(a[0]), p05Seconds: sec(L.pct(a, 0.05)), medianSeconds: sec(L.pct(a, 0.5)), maxSeconds: sec(a[a.length - 1]), under35: a.filter(v => v * F.L / F.SPEED < 3.5).length }; };
  const worst = runs.reduce((a, b) => (b.gSegs < a.gSegs ? b : a), runs[0]);
  const shorterThanOriginal = runs.filter(r => r.gSegs < r.oSegs);
  results.run[viewport.width + 'x' + viewport.height] = {
    frames: runs.length,
    /* the ground alone hiding the road, against the original's rule, which knows only the ground */
    groundOnly: { contiguousRun: dist('gSegs'), furthestVisible: dist('gFurthest') },
    original: { contiguousRun: dist('oSegs'), furthestVisible: dist('oFurthest') },
    worstFrameGroundOnly: worst,
    framesShorterThanOriginal: shorterThanOriginal.length, worstShortfallSeconds: shorterThanOriginal.length ? sec(Math.max(...shorterThanOriginal.map(r => r.oSegs - r.gSegs))) : 0,
    framesFurthestShorterThanOriginal: runs.filter(r => r.gFurthest < r.oFurthest).length,
    /* everything drawn hiding the road: ramps and gantries in front of the far road, which the original's rule does not count although it draws them over the road too */
    everything: { contiguousRun: dist('segs'), furthestVisible: dist('furthest'), reasons },
    knownAnswerB: bump, errors: side.errors };
  console.log('visible run at ' + viewport.width + 'x' + viewport.height + ': ' + JSON.stringify(results.run[viewport.width + 'x' + viewport.height]));
  await side.close();
}

/* ---- B: every hazard and jump, first visible, against the original ---- */
{
  const side = await L.openSide(env, 'page', J.VIEW, days[0]);
  await side.page.addScriptTag({ path: path.join(L.here, 'visibility-inpage.js') });
  const all = [];
  const useDays = quick ? days.slice(0, 1) : days;
  const levels = quick ? [3, 6] : J.LEVELS;
  for (const day of useDays) {
    await side.page.clock.setFixedTime(L.dayDate(day));
    for (const level of levels) {
      const r = await side.page.evaluate(({ job, w, h }) => {
        const S = window.__S, V = window.visibilityProbe, F = S.get('FEEL');
        window.driveProbe.prepare(S, job);
        const targets = V.listTargets(S.get('finishSeg') + 100, w, h);
        const out = [];
        for (const tg of targets) {
          const r = V.sweep(tg, Math.max(0, tg.from - 212), w, h, F.CAMERA_HEIGHT);
          out.push({ kind: tg.kind, from: tg.from, to: tg.to, x: tg.x, half: tg.half, swing: tg.swing, mine: r.mine, orig: r.orig });
        }
        return out;
      }, { job: { day, level, mode: 'DAILY', seed: J.seedOf(day, level, 'road') }, w: J.VIEW.width, h: J.VIEW.height });
      for (const t of r) all.push({ day, level, ...t });
      const later = r.filter(t => t.mine !== null && t.orig !== null && t.mine > t.orig).length;
      process.stdout.write('  targets L' + level + ' ' + day + ': ' + r.length + ' targets, ' + later + ' later than the original, ' + r.filter(t => t.mine === null).length + ' never seen here, ' + r.filter(t => t.orig === null).length + ' never by the original\n');
    }
  }
  /* known answer C: a crest before one hazard on the first road */
  const first = all.find(t => t.kind !== 'jump' && t.mine !== null) || all[0];
  await side.page.clock.setFixedTime(L.dayDate(first.day));
  const kc = await side.page.evaluate(({ job, w, h, tg }) => {
    const S = window.__S, V = window.visibilityProbe, P = S.world.probe, F = S.get('FEEL');
    window.driveProbe.prepare(S, job);
    const before = V.sweep(tg, Math.max(0, tg.from - 212), w, h, F.CAMERA_HEIGHT);
    P.setBump(tg.from - 40, 2600);
    const withCrest = V.sweep(tg, Math.max(0, tg.from - 212), w, h, F.CAMERA_HEIGHT);
    P.setBump(-1, 0);
    return { target: tg, before: before.mine, withCrest: withCrest.mine, caught: withCrest.mine === null || withCrest.mine > before.mine };
  }, { job: { day: first.day, level: first.level, mode: 'DAILY', seed: J.seedOf(first.day, first.level, 'road') }, w: J.VIEW.width, h: J.VIEW.height, tg: { kind: first.kind, from: first.from, to: first.to, x: first.x, half: first.half, swing: first.swing } });
  const F = await side.page.evaluate(() => ({ L: window.__S.get('FEEL').SEGMENT_LENGTH, SPEED: window.__S.get('FEEL').SPEED }));
  const both = all.filter(t => t.mine !== null && t.orig !== null);
  const later = both.filter(t => t.mine > t.orig);
  const lead = both.map(t => t.orig - t.mine).sort((a, b) => a - b);
  results.targets = {
    total: all.length, hazards: all.filter(t => t.kind !== 'jump').length, jumps: all.filter(t => t.kind === 'jump').length,
    neverSeenHere: all.filter(t => t.mine === null).length, neverSeenByOriginal: all.filter(t => t.orig === null).length,
    laterThanOriginal: later.length, worstLaterSegments: later.length ? Math.max(...later.map(t => t.mine - t.orig)) : 0,
    worstLaterSeconds: later.length ? +(Math.max(...later.map(t => t.mine - t.orig)) * F.L / F.SPEED).toFixed(2) : 0,
    leadOverOriginalSegments: { min: lead[0], p05: L.pct(lead, 0.05), median: L.pct(lead, 0.5), max: lead[lead.length - 1] },
    minLeadSecondsAheadHere: +(Math.min(...both.map(t => (t.kind === 'jump' ? t.to + 1 : t.from) - t.mine)) * F.L / F.SPEED).toFixed(2),
    minLeadSecondsAheadOriginal: +(Math.min(...both.map(t => (t.kind === 'jump' ? t.to + 1 : t.from) - t.orig)) * F.L / F.SPEED).toFixed(2),
    later: later.slice(0, 40), knownAnswerC: kc, errors: side.errors,
  };
  console.log('targets: ' + JSON.stringify({ ...results.targets, later: results.targets.later.length }));
  await side.close();
}
await env.close();
const ka = results.knownAnswers;
results.pass = Object.values(ka).every(k => k.pass) && Object.values(results.run).every(r => r.framesShorterThanOriginal === 0 && r.knownAnswerB && r.knownAnswerB.caught && !r.errors.length)
  && results.targets.laterThanOriginal === 0 && results.targets.knownAnswerC.caught && !results.targets.errors.length;
results.finished = new Date().toISOString();
L.writeJson(path.join(L.root, 'review', 'stage-2', 'visibility.json'), results);
console.log('\nvisibility: ' + (results.pass ? 'PASS' : 'FAIL'));
process.exit(results.pass ? 0 : 1);
