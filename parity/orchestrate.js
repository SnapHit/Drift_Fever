/* PARITY: Drift_Fever's index.html against the vendored module, on the same
   roads and the same input tapes, in the same browser.

   Both sides are pages in one headless Chromium so they share a Math
   library; Node's differs from Chromium's in the last bit of sin and exp,
   which a two minute drive turns into a different trace. The comparison
   is exact: every frame's hash must match, every road's hash must match.

   Known answers, every run:
     K1  a different day gives a different road and a different drive
     K2  a perturbed constant makes the comparison fail (physics and generator)
     K3  the original gives the same roads and drives at two viewports
     K4  the day the probe set is the day startRun rolled to, both sides
     K5  the original page's own frame loop is dead while the probe drives

   --quick        3 days instead of 28
   --days N       how many days from --from (default 28 from 20261001)
   --check        no browser: verify parity/stamp.json matches the files
   --stamp        after a pass, write parity/stamp.json and parity/REPORT.md */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveOriginal, openBrowser, runWorkerJobs } from './browser.js';
import * as J from './jobs.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const STAMPED = ['sim/drift-fever-sim.js', 'vendor/original/index.html', 'parity/probe.cjs', 'parity/tapes.cjs', 'parity/orchestrate.js', 'parity/browser.js', 'parity/module-page.html'];
function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex'); }
function fileHashes() { const o = {}; for (const p of STAMPED) o[p] = sha(p); return o; }

if (flag('--check')) {
  const stampPath = path.join(root, 'parity', 'stamp.json');
  if (!fs.existsSync(stampPath)) { console.error('parity: no parity/stamp.json. Run npm run parity -- --stamp'); process.exit(1); }
  const stamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  const now = fileHashes();
  const stale = Object.keys(now).filter(p => now[p] !== stamp.files[p]);
  if (!stamp.pass || stale.length) {
    console.error('parity: STALE. ' + (stamp.pass ? '' : 'the last recorded run did not pass. ') + (stale.length ? 'changed since the stamp: ' + stale.join(', ') : ''));
    console.error('Run npm run parity -- --stamp and commit parity/stamp.json with the change.');
    process.exit(1);
  }
  console.log('parity: stamp holds. ' + stamp.summary);
  process.exit(0);
}

const TZ = process.env.TZ;
const FROM = +opt('--from', '20261001');
const DAYS = flag('--quick') ? 3 : +opt('--days', '28');
const CONCURRENCY = +opt('--concurrency', '6');
const { LEVELS, TAPES, VIEW, VIEW_WIDE } = J;
const days = J.dayList(FROM, DAYS);
const groups = J.buildGroups(days);
const viewportJobs = J.viewportJobs(days);
const perturbJobs = J.perturbJobs(days).physics;
const perturbRoadJobs = J.perturbJobs(days).generator;

/* ---- run ---- */
const { server, url } = await serveOriginal();
const browser = await openBrowser();
const t0 = Date.now();
const tasks = [];
const base = { timezoneId: TZ, viewport: VIEW };
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
const coverage = { roads: 0, drives: 0, frames: 0, finishes: 0, deaths: { 0: 0, 1: 0, 2: 0 }, continues: 0, gatesMax: 0, taps: 0 };
function signature(hashes) { let h = 2166136261; for (const x of hashes) { h ^= x; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function compareSides(name, jobs, A, B, mustMatch) {
  const out = [];
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i], a = A.results[i], b = B.results[i];
    if (!a || !a.ok) { failures.push(`${name} ${j.key}: original side failed: ${a && a.error}`); continue; }
    if (!b || !b.ok) { failures.push(`${name} ${j.key}: module side failed: ${b && b.error}`); continue; }
    if (a.todayStamp !== j.day || b.todayStamp !== j.day) failures.push(`${name} ${j.key}: K4 todayStamp ${a.todayStamp}/${b.todayStamp} is not the job's day ${j.day}`);
    let same, detail;
    if (j.kind === 'road') { same = a.hash === b.hash && a.segments === b.segments && a.hazards === b.hazards && a.jumps === b.jumps; detail = `hash ${a.hash} vs ${b.hash}, segments ${a.segments}/${b.segments}, hazards ${a.hazards}/${b.hazards}, jumps ${a.jumps}/${b.jumps}`; }
    else {
      let k = 0; const n = Math.min(a.hashes.length, b.hashes.length);
      while (k < n && a.hashes[k] === b.hashes[k]) k++;
      same = k === n && a.hashes.length === b.hashes.length;
      detail = same ? `${a.frames} frames identical` : `first mismatch at frame ${k} of ${a.hashes.length}/${b.hashes.length}`;
    }
    out.push({ key: j.key, same, detail, a, b });
    if (mustMatch && !same) failures.push(`${name} ${j.key}: ${detail}`);
  }
  return out;
}
const report = { commit: fs.readFileSync(path.join(root, 'vendor', 'original', 'COMMIT'), 'utf8').trim(), tz: TZ, days, levels: LEVELS, tapes: TAPES, elapsedSeconds: elapsed, groups: {}, knownAnswers: {}, failures, coverage };
for (const g of groups) {
  const A = done[g.name + '|original'], B = done[g.name + '|module'];
  if (A.errors.length) failures.push(`${g.name}: original page errors: ${A.errors.join(' | ')}`);
  if (B.errors.length) failures.push(`${g.name}: module page errors: ${B.errors.join(' | ')}`);
  if (A.info.frameLoopStopped !== true) failures.push(`${g.name}: K5 the original's frame loop was still running`);
  const rows = compareSides(g.name, g.jobs, A, B, true);
  report.groups[g.name] = { rows: rows.map(r => ({ key: r.key, same: r.same, detail: r.detail, frames: r.a.frames, events: r.a.events && r.a.events.length, end: r.a.end && { state: r.a.end.state, gatesPassed: r.a.end.gatesPassed, continues: r.a.end.continues, banked: r.a.end.banked } })), hookCalls: B.hookCalls, info: A.info };
  for (const r of rows) {
    if (r.a.hashes) {
      coverage.drives++; coverage.frames += r.a.frames;
      for (const e of r.a.events) { if (e[1] === 'tap') coverage.taps++; if (e[1] === 'state' && e[3] === 2) coverage.deaths[e[4]] = (coverage.deaths[e[4]] || 0) + 1; if (e[1] === 'state' && e[3] === 3) coverage.finishes++; }
      coverage.continues += r.a.end.continues; coverage.gatesMax = Math.max(coverage.gatesMax, r.a.end.gatesPassed);
    } else coverage.roads++;
  }
}
/* K1: different days differ, per level, roads and drives */
{
  const k1 = { pass: true, detail: [] };
  for (const level of LEVELS) {
    const g = done['level ' + level + '|original'];
    const roads = g.results.filter((r, i) => groups[level - 1].jobs[i].kind === 'road').map(r => r.hash);
    const distinctRoads = new Set(roads).size;
    const drives = {};
    groups[level - 1].jobs.forEach((j, i) => { if (j.kind === 'drive') (drives[j.tape] = drives[j.tape] || []).push(signature(g.results[i].hashes)); });
    const line = `L${level}: ${distinctRoads}/${roads.length} distinct roads` + TAPES.map(t => `, ${new Set(drives[t]).size}/${drives[t].length} distinct ${t} drives`).join('');
    k1.detail.push(line);
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
  const pass = p && r && !p.same && !r.same;
  report.knownAnswers.K2_perturbation_fails = { pass, physics: p && { note: perturbJobs[0].note, caught: !p.same, detail: p.detail }, generator: r && { note: perturbRoadJobs[0].note, caught: !r.same, detail: r.detail } };
  if (!pass) failures.push('K2: a perturbed constant was NOT caught: ' + JSON.stringify(report.knownAnswers.K2_perturbation_fails));
}
/* K3: the original at two viewports */
{
  const rows = compareSides('viewport', viewportJobs, done['viewport|original'], done['viewport|original-wide'], false);
  const pass = rows.length === viewportJobs.length && rows.every(r => r.same);
  report.knownAnswers.K3_viewport_independent = { pass, viewports: [VIEW, VIEW_WIDE], rows: rows.map(r => ({ key: r.key, same: r.same, detail: r.detail })) };
  if (!pass) failures.push('K3: the original gave different results at ' + JSON.stringify(VIEW_WIDE) + ': ' + rows.filter(r => !r.same).map(r => r.key + ' ' + r.detail).join('; '));
}
report.knownAnswers.K4_day_took = { pass: !failures.some(f => f.includes('K4')), note: 'every job on both sides reported todayStamp equal to the day the runner set, after startRun rolled the day' };
report.knownAnswers.K5_frame_loop_dead = { pass: !failures.some(f => f.includes('K5')), titleTimeAtStart: groups.map(g => done[g.name + '|original'].info.titleTimeAtStart) };
report.pass = failures.length === 0;
report.summary = `${report.pass ? 'PASS' : 'FAIL'}: ${coverage.roads} roads and ${coverage.drives} drives (${coverage.frames} frames) over ${days.length} days x ${LEVELS.length} levels x ${TAPES.length} tapes plus endless, identical on both sides; ` +
  `${coverage.finishes} finishes, ${coverage.deaths[0] || 0} off road, ${coverage.deaths[1] || 0} hits, ${coverage.deaths[2] || 0} ran out, ${coverage.continues} continues, ${coverage.taps} taps; ` +
  `K1 ${report.knownAnswers.K1_days_differ.pass ? 'ok' : 'FAIL'}, K2 ${report.knownAnswers.K2_perturbation_fails.pass ? 'ok' : 'FAIL'}, K3 ${report.knownAnswers.K3_viewport_independent.pass ? 'ok' : 'FAIL'}, K4 ${report.knownAnswers.K4_day_took.pass ? 'ok' : 'FAIL'}, K5 ${report.knownAnswers.K5_frame_loop_dead.pass ? 'ok' : 'FAIL'}; ${Math.round(elapsed)}s`;

fs.mkdirSync(path.join(root, 'parity', 'out'), { recursive: true });
fs.writeFileSync(path.join(root, 'parity', 'out', 'report.json'), JSON.stringify(report, null, 1));
console.log('\n' + report.summary);
for (const l of report.knownAnswers.K1_days_differ.detail) console.log('  ' + l);
console.log('  K2 physics: ' + JSON.stringify(report.knownAnswers.K2_perturbation_fails.physics));
console.log('  K2 generator: ' + JSON.stringify(report.knownAnswers.K2_perturbation_fails.generator));
console.log('  K3: ' + report.knownAnswers.K3_viewport_independent.rows.map(r => r.key + ' ' + (r.same ? 'same' : 'DIFF')).join('; '));
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log('  ' + f); }

if (flag('--stamp') && report.pass) {
  const stamp = { pass: true, when: new Date().toISOString(), commit: report.commit, chromium: report.groups['level 1'].info.ua, tz: TZ, days: [days[0], days[days.length - 1]], summary: report.summary, files: fileHashes() };
  fs.writeFileSync(path.join(root, 'parity', 'stamp.json'), JSON.stringify(stamp, null, 1));
  const md = ['# Parity report', '', `Original: SnapHit/Drift_Fever at ${report.commit}. Browser: ${stamp.chromium}. Time zone ${TZ}. Days ${days[0]} to ${days[days.length - 1]}.`, '',
    report.summary, '', '## Known answers', '',
    ...Object.entries(report.knownAnswers).map(([k, v]) => `- ${k}: ${v.pass ? 'pass' : 'FAIL'}` + (v.detail ? ' (' + (Array.isArray(v.detail) ? v.detail.join('; ') : v.detail) + ')' : '') + (v.physics ? ` physics ${v.physics.note}: ${v.physics.detail}; generator ${v.generator.note}: ${v.generator.detail}` : '')),
    '', '## Coverage', '', '| group | jobs | frames | finishes | deaths | continues |', '|---|---|---|---|---|---|',
    ...groups.map(g => { const rows = report.groups[g.name].rows; const drives = rows.filter(r => r.frames !== undefined); return `| ${g.name} | ${rows.length} | ${drives.reduce((s, r) => s + r.frames, 0)} | ${drives.filter(r => r.end && r.end.state === 3).length} | ${drives.filter(r => r.end && r.end.state === 2).length} | ${drives.reduce((s, r) => s + (r.end ? r.end.continues : 0), 0)} |`; }),
    '', '## Hooks fired on the module side', '', '```', JSON.stringify(report.groups['level 2'].hookCalls), '```', ''];
  fs.writeFileSync(path.join(root, 'parity', 'REPORT.md'), md.join('\n'));
  console.log('stamped parity/stamp.json and wrote parity/REPORT.md');
}
process.exit(report.pass ? 0 : 1);
