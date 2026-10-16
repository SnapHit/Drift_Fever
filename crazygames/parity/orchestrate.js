/* PARITY: Drift_Fever's index.html against the vendored module, on the same
   roads and the same input tapes, in the same browser.

   Both sides are pages in one headless Chromium so they share a Math
   library; Node's differs from Chromium's in the last bit of sin and exp,
   which a two minute drive turns into a different trace. The comparison
   is exact: every frame's hash must match, every road's hash must match,
   every event list must match.

   Known answers, every run:
     K1  a different day gives a different road and a different drive
     K2  a perturbed constant makes the comparison fail (physics and generator)
     K3  the original gives the same roads and drives at two viewports
     K4  both sides boot on a sentinel day and startRun rolls them to the
         job's day; the day rolled from matches on both sides for every job
     K5  the original page's own frame loop is dead while the probe drives
     K6  the original advanced by its own frame(t), drawing every frame,
         matches the module's step(dt)
     K7  every death kind occurs at least once, including running out of time
     K8  the shipped greybox page, driven through its own frame function
         with the 3D renderer attached and its input through its own
         handlers, matches the original driven through its own frame(),
         frame for frame; and a renderer that writes one simulation field
         it should only read is caught
     K9  the shipped page gives the same drive at a phone viewport and at
         the small one the test runs it at

   --quick        3 days instead of 28, never stamped
   --days N       how many days from --from (default 28 from 20261001)
   --check        no browser: verify parity/stamp.json matches the files
   --stamp        after a full pass, write parity/stamp.json and parity/REPORT.md */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveOriginal, openBrowser, runWorkerJobs } from './browser.js';
import * as J from './jobs.js';
import { commit as ORIGINAL_COMMIT, originalHtml } from '../tools/original.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const STAMPED = ['sim/drift-fever-sim.js', 'vendor/original/COMMIT', 'parity/probe.cjs', 'parity/tapes.cjs', 'parity/jobs.js',
                 'parity/orchestrate.js', 'parity/browser.js', 'parity/module-page.html', 'parity/run.js', 'tools/original.js', 'tools/serve.js',
                 // the shipped page, which K8 and K9 cover
                 'public/index.html', 'public/game.js', 'public/chrome.js', 'public/world.js', 'public/chrome.css', 'public/vendor/three.webgpu.min.js'];
function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex'); }
function fileHashes() {
  const o = {};
  for (const p of STAMPED) o[p] = sha(p);
  // the original itself, as read from the repository history at the pinned commit
  o['index.html@' + ORIGINAL_COMMIT] = crypto.createHash('sha256').update(originalHtml()).digest('hex');
  return o;
}

if (flag('--check')) {
  const stampPath = path.join(root, 'parity', 'stamp.json');
  if (!fs.existsSync(stampPath)) { console.error('parity: no parity/stamp.json. Run npm run parity -- --stamp'); process.exit(1); }
  const stamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  const now = fileHashes();
  const stale = Object.keys(now).filter(p => now[p] !== stamp.files[p]);
  if (!stamp.pass || stale.length || stamp.days !== 28) {
    console.error('parity: STALE. ' + (stamp.pass ? '' : 'the last recorded run did not pass. ') + (stamp.days !== 28 ? 'the stamp is not from a full 28 day run. ' : '') + (stale.length ? 'changed since the stamp: ' + stale.join(', ') : ''));
    console.error('Run npm run parity -- --stamp and commit parity/stamp.json with the change.');
    process.exit(1);
  }
  console.log('parity: stamp holds. ' + stamp.summary);
  process.exit(0);
}

const TZ = process.env.TZ;
const FROM = +opt('--from', '20261001');
const QUICK = flag('--quick');
const DAYS = QUICK ? 3 : +opt('--days', '28');
const CONCURRENCY = +opt('--concurrency', '6');
const { LEVELS, TAPES, VIEW, VIEW_WIDE, SENTINEL_DAY } = J;
const days = J.dayList(FROM, DAYS);
const groups = J.buildGroups(days);
const viewportJobs = J.viewportJobs(days);
const perturbJobs = J.perturbJobs(days).physics;
const perturbRoadJobs = J.perturbJobs(days).generator;
const pageGroups = J.pageGroups(days, QUICK);
const pageBreakJobs = J.pageBreakJobs(days);
const pageViewportJobs = J.pageViewportJobs(days);

/* ---- run ---- */
const { server, url } = await serveOriginal();
const browser = await openBrowser();
const t0 = Date.now();
const tasks = [];
const base = { timezoneId: TZ, viewport: VIEW, sentinelDay: SENTINEL_DAY };
for (const g of groups) {
  tasks.push({ name: g.name, side: 'original', run: () => runWorkerJobs(browser, url, g.jobs, { ...base, side: 'original' }) });
  tasks.push({ name: g.name, side: 'module', run: () => runWorkerJobs(browser, url, g.jobs, { ...base, side: 'module' }) });
}
tasks.push({ name: 'viewport', side: 'original', run: () => runWorkerJobs(browser, url, viewportJobs, { ...base, side: 'original' }) });
tasks.push({ name: 'viewport', side: 'original-wide', run: () => runWorkerJobs(browser, url, viewportJobs, { ...base, side: 'original', viewport: VIEW_WIDE }) });
tasks.push({ name: 'perturb physics', side: 'original', run: () => runWorkerJobs(browser, url, perturbJobs.map(j => ({ ...j, perturb: undefined })), { ...base, side: 'original' }) });
tasks.push({ name: 'perturb physics', side: 'module', run: () => runWorkerJobs(browser, url, perturbJobs, { ...base, side: 'module' }) });
tasks.push({ name: 'perturb generator', side: 'original', run: () => runWorkerJobs(browser, url, perturbRoadJobs.map(j => ({ ...j, perturb: undefined })), { ...base, side: 'original' }) });
tasks.push({ name: 'perturb generator', side: 'module', run: () => runWorkerJobs(browser, url, perturbRoadJobs, { ...base, side: 'module' }) });
/* The shipped page against the original, both drawing every frame at the
   small viewport, and the two known answers. */
const pageBase = { ...base, viewport: J.PAGE_VIEW };
for (const g of pageGroups) {
  tasks.push({ name: g.name, side: 'original', run: () => runWorkerJobs(browser, url, g.jobs, { ...pageBase, side: 'original' }) });
  tasks.push({ name: g.name, side: 'page', run: () => runWorkerJobs(browser, url, g.jobs, { ...pageBase, side: 'page' }) });
}
tasks.push({ name: 'page break', side: 'original', run: () => runWorkerJobs(browser, url, pageBreakJobs, { ...pageBase, side: 'original' }) });
tasks.push({ name: 'page break', side: 'page', run: () => runWorkerJobs(browser, url, pageBreakJobs, { ...pageBase, side: 'page', parityBreak: J.PAGE_BREAK_FIELD }) });
tasks.push({ name: 'page viewport', side: 'page', run: () => runWorkerJobs(browser, url, pageViewportJobs, { ...pageBase, side: 'page' }) });
tasks.push({ name: 'page viewport', side: 'page-phone', run: () => runWorkerJobs(browser, url, pageViewportJobs, { ...base, side: 'page' }) });
// the slow ones first, so they do not tail the run
const slow = n => (n === 'real frame' || n.startsWith('page')) ? -1 : 0;
tasks.sort((a, b) => slow(a.name) - slow(b.name));

const done = {};
let next = 0, active = 0;
await new Promise((resolve, reject) => {
  const pump = () => {
    while (active < CONCURRENCY && next < tasks.length) {
      const t = tasks[next++]; active++;
      t.run().then(r => { done[t.name + '|' + t.side] = r; process.stdout.write('  done: ' + t.name + ' [' + t.side + '] ' + Math.round((Date.now() - t0) / 1000) + 's\n'); active--; if (next >= tasks.length && active === 0) resolve(); else pump(); })
             .catch(e => reject(e));
    }
  };
  pump();
});
await browser.close(); server.close();
const elapsed = (Date.now() - t0) / 1000;

/* ---- compare ---- */
const failures = [], notes = [];
const coverage = { roads: 0, drives: 0, frames: 0, finishes: 0, deaths: { 0: 0, 1: 0, 2: 0 }, continues: 0, taps: 0, nextLevel: 0, reloads: 0 };
function signature(hashes) { let h = 2166136261; for (const x of hashes) { h ^= x; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function compareSides(name, jobs, A, B, mustMatch) {
  const out = [];
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i], a = A.results[i], b = B.results[i];
    if (!a || !a.ok) { failures.push(`${name} ${j.key}: original side failed: ${a && a.error}`); continue; }
    if (!b || !b.ok) { failures.push(`${name} ${j.key}: module side failed: ${b && b.error}`); continue; }
    if (j.kind !== 'reload' && j.kind !== 'snapshot' && (a.todayStamp !== j.day || b.todayStamp !== j.day)) failures.push(`${name} ${j.key}: K4 todayStamp ${a.todayStamp}/${b.todayStamp} is not the job's day ${j.day}`);
    if (a.rolledFrom !== undefined && a.rolledFrom !== b.rolledFrom) failures.push(`${name} ${j.key}: K4 the day rolled from differs: ${a.rolledFrom} vs ${b.rolledFrom}`);
    if (i === 0 && a.rolledFrom !== undefined && a.rolledFrom !== SENTINEL_DAY) failures.push(`${name} ${j.key}: K4 the first job did not roll from the sentinel day (${a.rolledFrom})`);
    let same, detail;
    if (j.kind === 'road') { same = a.hash === b.hash && a.segments === b.segments && a.hazards === b.hazards && a.jumps === b.jumps; detail = `hash ${a.hash} vs ${b.hash}, segments ${a.segments}/${b.segments}, hazards ${a.hazards}/${b.hazards}, jumps ${a.jumps}/${b.jumps}`; }
    else if (j.kind === 'reload') { same = true; detail = 'reloaded'; }
    else {
      let k = 0; const n = Math.min(a.hashes.length, b.hashes.length);
      while (k < n && a.hashes[k] === b.hashes[k]) k++;
      same = k === n && a.hashes.length === b.hashes.length;
      detail = same ? `${a.frames} frames identical` : `first mismatch at frame ${k} of ${a.hashes.length}/${b.hashes.length}`;
      const ea = JSON.stringify(a.events), eb = JSON.stringify(b.events);
      if (ea !== eb) { same = false; detail += `; events differ: ${ea.slice(0, 200)} vs ${eb.slice(0, 200)}`; }
    }
    out.push({ key: j.key, kind: j.kind, same, detail, a, b });
    if (mustMatch && !same) failures.push(`${name} ${j.key}: ${detail}`);
  }
  return out;
}
const report = { commit: ORIGINAL_COMMIT, tz: TZ, days, levels: LEVELS, tapes: TAPES, elapsedSeconds: elapsed, groups: {}, knownAnswers: {}, failures, coverage };
for (const g of groups) {
  const A = done[g.name + '|original'], B = done[g.name + '|module'];
  if (A.errors.length) failures.push(`${g.name}: original page errors: ${A.errors.join(' | ')}`);
  if (B.errors.length) failures.push(`${g.name}: module page errors: ${B.errors.join(' | ')}`);
  if (A.info.frameLoopStopped !== true) failures.push(`${g.name}: K5 the original's frame loop was still running`);
  const rows = compareSides(g.name, g.jobs, A, B, true);
  report.groups[g.name] = { rows: rows.map(r => ({ key: r.key, kind: r.kind, same: r.same, detail: r.detail, frames: r.a.frames, events: r.a.events, end: r.a.end && { state: r.a.end.state, gatesPassed: r.a.end.gatesPassed, continues: r.a.end.continues, banked: r.a.end.banked, level: r.a.end.level } })), hookCalls: B.hookCalls, info: A.info };
  for (const r of rows) {
    if (r.kind === 'road') coverage.roads++;
    else if (r.kind === 'reload') coverage.reloads++;
    else if (r.kind === 'drive' || r.kind === 'routes') {
      coverage.drives++; coverage.frames += r.a.frames;
      for (const e of r.a.events) {
        if (e[1] === 'tap') coverage.taps++;
        if (e[1] === 'next') coverage.nextLevel++;
        if (e[1] === 'state' && e[3] === 2) coverage.deaths[e[4]] = (coverage.deaths[e[4]] || 0) + 1;
        if (e[1] === 'state' && e[3] === 3) coverage.finishes++;
      }
      coverage.continues += r.a.end.continues;
    }
  }
}
/* K1: different days differ, per level, roads and drives */
{
  const k1 = { pass: true, detail: [] };
  for (const level of LEVELS) {
    const g = done['level ' + level + '|original'], jobs = groups[level - 1].jobs;
    const roads = g.results.filter((r, i) => jobs[i].kind === 'road').map(r => r.hash);
    const distinctRoads = new Set(roads).size;
    const drives = {};
    jobs.forEach((j, i) => { if (j.kind === 'drive') (drives[j.tape] = drives[j.tape] || []).push(signature(g.results[i].hashes)); });
    k1.detail.push(`L${level}: ${distinctRoads}/${roads.length} distinct roads` + TAPES.map(t => `, ${new Set(drives[t]).size}/${drives[t].length} ${t}`).join(''));
    if (distinctRoads !== roads.length) k1.pass = false;
    for (const t of TAPES) if (new Set(drives[t]).size !== drives[t].length) k1.pass = false;
  }
  report.knownAnswers.K1_days_differ = k1;
  if (!k1.pass) failures.push('K1: two days gave the same road or the same drive: ' + k1.detail.join('; '));
}
/* K2: perturbations must be caught */
{
  const p = compareSides('perturb physics', perturbJobs, done['perturb physics|original'], done['perturb physics|module'], false)[0];
  const r = compareSides('perturb generator', perturbRoadJobs, done['perturb generator|original'], done['perturb generator|module'], false)[0];
  const pass = !!(p && r && !p.same && !r.same);
  report.knownAnswers.K2_perturbation_fails = { pass, physics: p && { note: perturbJobs[0].note, caught: !p.same, detail: p.detail }, generator: r && { note: perturbRoadJobs[0].note, caught: !r.same, detail: r.detail } };
  if (!pass) failures.push('K2: a perturbed constant was NOT caught: ' + JSON.stringify(report.knownAnswers.K2_perturbation_fails));
}
/* K3: the original at two viewports. A property of the original, checked
   here because the module cannot have it any other way. */
{
  const rows = compareSides('viewport', viewportJobs, done['viewport|original'], done['viewport|original-wide'], false);
  const pass = rows.length === viewportJobs.length && rows.every(r => r.same);
  report.knownAnswers.K3_viewport_independent = { pass, viewports: [VIEW, VIEW_WIDE], rows: rows.map(r => ({ key: r.key, same: r.same, detail: r.detail })) };
  if (!pass) failures.push('K3: the original gave different results at ' + JSON.stringify(VIEW_WIDE) + ': ' + rows.filter(r => !r.same).map(r => r.key + ' ' + r.detail).join('; '));
}
report.knownAnswers.K4_day_rolled = { pass: !failures.some(f => f.includes('K4')), note: 'both sides boot on ' + SENTINEL_DAY + '; every job reports the day rolled from, equal on both sides, and the first job of every group rolled from the sentinel' };
report.knownAnswers.K5_frame_loop_dead = { pass: !failures.some(f => f.includes('K5')), titleTimeAtStart: groups.map(g => done[g.name + '|original'].info.titleTimeAtStart) };
{
  const rows = report.groups['real frame'].rows;
  report.knownAnswers.K6_real_frame = { pass: rows.length > 0 && rows.every(r => r.same), rows: rows.map(r => ({ key: r.key, same: r.same, detail: r.detail })) };
  if (!report.knownAnswers.K6_real_frame.pass) failures.push('K6: the original driven by its own frame() differs from the module: ' + rows.filter(r => !r.same).map(r => r.key + ' ' + r.detail).join('; '));
}
{
  const d = coverage.deaths;
  const pass = d[0] > 0 && d[1] > 0 && d[2] > 0 && coverage.finishes > 0 && coverage.continues > 0 && coverage.nextLevel > 0;
  report.knownAnswers.K7_every_ending_reached = { pass, offRoad: d[0], hits: d[1], ranOut: d[2], finishes: coverage.finishes, continues: coverage.continues, nextLevel: coverage.nextLevel };
  if (!pass) failures.push('K7: an ending was never reached: ' + JSON.stringify(report.knownAnswers.K7_every_ending_reached));
}
/* K8: the shipped page. Every page group must match the original frame
   for frame, with no page errors, and the renderer that writes a
   simulation field must be caught. */
{
  const rows = [];
  for (const g of pageGroups) {
    const A = done[g.name + '|original'], B = done[g.name + '|page'];
    if (A.errors.length) failures.push(`${g.name}: original page errors: ${A.errors.join(' | ')}`);
    if (B.errors.length) failures.push(`${g.name}: shipped page errors: ${B.errors.join(' | ')}`);
    if (A.info.frameLoopStopped !== true) failures.push(`${g.name}: K5 the original's frame loop was still running`);
    if (B.info.frameLoopStopped !== true) failures.push(`${g.name}: K5 the shipped page's frame loop was still running`);
    const r = compareSides(g.name, g.jobs, A, B, true);
    rows.push(...r);
    report.groups[g.name] = { rows: r.map(x => ({ key: x.key, kind: x.kind, same: x.same, detail: x.detail, frames: x.a.frames, events: x.a.events, inputVia: g.jobs.find(j => j.key === x.key) && g.jobs.find(j => j.key === x.key).inputVia || null })), info: A.info, pageInfo: B.info };
  }
  const brk = compareSides('page break', pageBreakJobs, done['page break|original'], done['page break|page'], false)[0];
  const caught = !!(brk && !brk.same);
  const drives = rows.filter(r => r.kind === 'drive' || r.kind === 'routes');
  const viaKeys = drives.filter(r => pageGroups[0].jobs.some(j => j.key === r.key && j.inputVia === 'keys'));
  const viaPointer = drives.filter(r => pageGroups[0].jobs.some(j => j.key === r.key && j.inputVia === 'pointer'));
  const pass = rows.length > 0 && rows.every(r => r.same) && caught && viaKeys.length > 0 && viaPointer.length > 0
            && !failures.some(f => f.startsWith('page') && !f.startsWith('page break'));
  report.knownAnswers.K8_shipped_page = { pass, jobs: rows.length, identical: rows.filter(r => r.same).length, frames: drives.reduce((s, r) => s + r.a.frames, 0),
    byKeyEvents: viaKeys.map(r => r.key + ' ' + r.detail), byPointerEvents: viaPointer.map(r => r.key + ' ' + r.detail),
    breakField: J.PAGE_BREAK_FIELD, breakCaught: caught, breakDetail: brk && brk.detail, world: done['page|page'].info.world, viewport: J.PAGE_VIEW };
  if (!pass) failures.push('K8: the shipped page differs from the original, or the renderer write was not caught: ' + JSON.stringify({ identical: report.knownAnswers.K8_shipped_page.identical, jobs: rows.length, breakCaught: caught }));
}
/* K9: the shipped page at the phone viewport against the small one. */
{
  const rows = compareSides('page viewport', pageViewportJobs, done['page viewport|page'], done['page viewport|page-phone'], false);
  const pass = rows.length === pageViewportJobs.length && rows.every(r => r.same);
  report.knownAnswers.K9_page_viewport_independent = { pass, viewports: [J.PAGE_VIEW, VIEW], rows: rows.map(r => ({ key: r.key, same: r.same, detail: r.detail })) };
  if (!pass) failures.push('K9: the shipped page gave different results at ' + JSON.stringify(VIEW) + ': ' + rows.map(r => r.key + ' ' + r.detail).join('; '));
}
report.pass = failures.length === 0;
const ka = report.knownAnswers;
report.summary = `${report.pass ? 'PASS' : 'FAIL'}: ${coverage.roads} roads and ${coverage.drives} drives (${coverage.frames} frames) over ${days.length} days x ${LEVELS.length} levels x ${TAPES.length} tapes, plus endless, routes, records across ${coverage.reloads} reloads, the real frame and the shipped page (${ka.K8_shipped_page.jobs} jobs, ${ka.K8_shipped_page.frames} frames drawn), identical on both sides; ` +
  `${coverage.finishes} finishes, ${coverage.nextLevel} next levels, ${coverage.deaths[0] || 0} off road, ${coverage.deaths[1] || 0} hits, ${coverage.deaths[2] || 0} ran out, ${coverage.continues} continues, ${coverage.taps} taps; ` +
  ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9'].map((k, i) => k + ' ' + (Object.values(ka)[i].pass ? 'ok' : 'FAIL')).join(', ') + `; ${Math.round(elapsed)}s`;

fs.mkdirSync(path.join(root, 'parity', 'out'), { recursive: true });
fs.writeFileSync(path.join(root, 'parity', 'out', 'report.json'), JSON.stringify(report, null, 1));
console.log('\n' + report.summary);
for (const l of ka.K1_days_differ.detail) console.log('  ' + l);
console.log('  K2 physics: ' + JSON.stringify(ka.K2_perturbation_fails.physics));
console.log('  K2 generator: ' + JSON.stringify(ka.K2_perturbation_fails.generator));
console.log('  K3: ' + ka.K3_viewport_independent.rows.map(r => r.key + ' ' + (r.same ? 'same' : 'DIFF')).join('; '));
console.log('  K6: ' + ka.K6_real_frame.rows.map(r => r.key + ' ' + r.detail).join('; '));
console.log('  K7: ' + JSON.stringify(ka.K7_every_ending_reached));
console.log('  K8: ' + JSON.stringify({ jobs: ka.K8_shipped_page.jobs, identical: ka.K8_shipped_page.identical, frames: ka.K8_shipped_page.frames, breakCaught: ka.K8_shipped_page.breakCaught, breakDetail: ka.K8_shipped_page.breakDetail, world: ka.K8_shipped_page.world }));
console.log('  K8 by key events: ' + ka.K8_shipped_page.byKeyEvents.join('; '));
console.log('  K8 by pointer events: ' + ka.K8_shipped_page.byPointerEvents.join('; '));
console.log('  K9: ' + ka.K9_page_viewport_independent.rows.map(r => r.key + ' ' + (r.same ? 'same' : 'DIFF')).join('; '));
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log('  ' + f); }

if (flag('--stamp') && report.pass && !QUICK && DAYS === 28) {
  const stamp = { pass: true, when: new Date().toISOString(), commit: report.commit, chromium: report.groups['level 1'].info.ua, tz: TZ, days: DAYS, from: days[0], to: days[days.length - 1], summary: report.summary, files: fileHashes() };
  fs.writeFileSync(path.join(root, 'parity', 'stamp.json'), JSON.stringify(stamp, null, 1));
  const md = ['# Parity report', '', `Original: SnapHit/Drift_Fever at ${report.commit}. Browser: ${stamp.chromium}. Time zone ${TZ}. Days ${days[0]} to ${days[days.length - 1]}.`, '',
    report.summary, '', '## Known answers', '',
    ...Object.entries(ka).map(([k, v]) => `- ${k}: ${v.pass ? 'pass' : 'FAIL'}` + (v.detail ? ' (' + (Array.isArray(v.detail) ? v.detail.join('; ') : v.detail) + ')' : '') + (v.physics ? ` physics ${v.physics.note}: ${v.physics.detail}; generator ${v.generator.note}: ${v.generator.detail}` : '') + (v.note ? ' (' + v.note + ')' : '') + (k.startsWith('K7') ? ' ' + JSON.stringify({ offRoad: v.offRoad, hits: v.hits, ranOut: v.ranOut, finishes: v.finishes, continues: v.continues, nextLevel: v.nextLevel }) : '')),
    '', '## Coverage', '', '| group | jobs | frames | finishes | next levels | deaths | continues |', '|---|---|---|---|---|---|---|',
    ...groups.concat(pageGroups).map(g => { const rows = report.groups[g.name].rows; const ev = rows.flatMap(r => r.events || []); return `| ${g.name} | ${rows.length} | ${rows.reduce((s, r) => s + (r.frames || 0), 0)} | ${ev.filter(e => e[1] === 'state' && e[3] === 3).length} | ${ev.filter(e => e[1] === 'next').length} | ${ev.filter(e => e[1] === 'state' && e[3] === 2).length} | ${rows.reduce((s, r) => s + (r.end ? r.end.continues : 0), 0)} |`; }),
    '', '## Hooks fired on the module side, level 6', '', '```', JSON.stringify(report.groups['level 6'].hookCalls), '```', ''];
  fs.writeFileSync(path.join(root, 'parity', 'REPORT.md'), md.join('\n'));
  console.log('stamped parity/stamp.json and wrote parity/REPORT.md');
} else if (flag('--stamp')) console.log('not stamped: ' + (report.pass ? 'only a full 28 day run is stamped' : 'the run failed'));
process.exit(report.pass ? 0 : 1);
