/* WHERE DO THE TWO SIDES PART. Runs one group up to a job on both sides,
   finds the first frame whose hash differs, re-runs with a dump at that
   frame and the one before, and prints the fields that differ.

   node parity/diagnose.js --group "level 2" --key "drive L2 20261001 centre" [--quick] */
process.env.TZ = process.env.PARITY_TZ || 'Australia/Sydney';
const { serveOriginal, openBrowser, runWorkerJobs } = await import('./browser.js');
const J = await import('./jobs.js');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const days = J.dayList(+opt('--from', '20261001'), args.includes('--quick') ? 3 : +opt('--days', '28'));
const group = J.buildGroups(days).find(g => g.name === opt('--group', 'level 2'));
const key = opt('--key');
const at = group.jobs.findIndex(j => j.key === key);
if (at < 0) { console.error('no job ' + key + ' in group ' + group.name); process.exit(2); }
const jobs = group.jobs.slice(0, at + 1);
const { server, url } = await serveOriginal();
const browser = await openBrowser();
const base = { timezoneId: process.env.TZ, viewport: J.VIEW, sentinelDay: J.SENTINEL_DAY };
async function both(js) {
  const [a, b] = await Promise.all([runWorkerJobs(browser, url, js, { ...base, side: 'original' }), runWorkerJobs(browser, url, js, { ...base, side: 'module' })]);
  return [a.results[a.results.length - 1], b.results[b.results.length - 1], a, b];
}
let [a, b, A, B] = await both(jobs);
/* every top level variable the module has that the original also has: the
   hidden state, for the frame diff */
const probeNames = B.names.filter(n => !/^[A-Z_0-9]+$/.test(n));
const presentRun = await runWorkerJobs(browser, url, jobs.slice(0, 1), { ...base, side: 'original', auditNames: probeNames });
const hidden = presentRun.present;
if (!a.ok || !b.ok) { console.log('original', a.ok ? 'ok' : a.error, '\nmodule', b.ok ? 'ok' : b.error); process.exit(1); }
if (a.hash !== undefined) {
  console.log('road: hash', a.hash, 'vs', b.hash, a.hash === b.hash ? 'SAME' : 'DIFF', '| segments', a.segments, b.segments, '| hazards', a.hazards, b.hazards, '| jumps', a.jumps, b.jumps);
  console.log(' first records\n  O', a.first[0], '\n  M', b.first[0]);
} else {
  let k = 0; const n = Math.min(a.hashes.length, b.hashes.length);
  while (k < n && a.hashes[k] === b.hashes[k]) k++;
  console.log('drive:', a.frames, 'vs', b.frames, 'frames; first mismatch at frame', k === n && a.frames === b.frames ? 'none' : k);
  console.log(' events O', JSON.stringify(a.events), '\n events M', JSON.stringify(b.events));
  if (!(k === n && a.frames === b.frames)) {
    for (const f of [k - 1, k]) {
      if (f < 0) continue;
      const js = jobs.map((j, i) => i === at ? { ...j, dumpAt: f, audit: hidden } : j);
      const [x, y] = await both(js);
      const dx = x.dump, dy = y.dump;
      const diffs = Object.keys(dx).filter(n => !Object.is(dx[n], dy[n]));
      console.log(' frame', f + ':', diffs.length ? '' : 'identical');
      for (const d of diffs) console.log('   ', d.padEnd(32), 'O', JSON.stringify(dx[d]), ' M', JSON.stringify(dy[d]));
    }
  }
}
await browser.close(); server.close();
