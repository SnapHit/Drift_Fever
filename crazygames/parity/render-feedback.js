/* DOES DRAWING FEED BACK INTO THE SIMULATION. The original page, the same
   driver tape on the same roads, once with render() called after every
   step as the live frame loop does and once without, at a phone viewport
   and at a desktop one. The brief's architecture needs the answer to be
   no; the extraction found one path (render writes camHeight, which the
   sight line clause reads while the car is in the air), and this measures
   whether it changes anything at the shipped constants.

   node parity/render-feedback.js [--days N] */
process.env.TZ = process.env.PARITY_TZ || 'Australia/Sydney';
const { serveOriginal, openBrowser, runWorkerJobs } = await import('./browser.js');
const J = await import('./jobs.js');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const days = J.dayList(+opt('--from', '20261001'), +opt('--days', '6'));
const jobs = [];
for (const day of days) for (const level of [2, 3, 4, 5, 6]) jobs.push({ kind: 'drive', key: `drive L${level} ${day} driver`, day, level, mode: 'DAILY', runsEver: 10, seed: J.seedOf(day, level, 'driver'), tape: 'driver', maxFrames: J.MAX_FRAMES, finishFrames: J.FINISH_FRAMES });
const { server, url } = await serveOriginal();
const browser = await openBrowser();
const base = { timezoneId: process.env.TZ, side: 'original' };
const tasks = [
  ['plain', { ...base, viewport: J.VIEW }, jobs],
  ['rendered phone', { ...base, viewport: J.VIEW }, jobs.map(j => ({ ...j, renderEachFrame: true }))],
  ['rendered desktop', { ...base, viewport: J.VIEW_WIDE }, jobs.map(j => ({ ...j, renderEachFrame: true }))],
];
const t0 = Date.now();
const out = await Promise.all(tasks.map(([name, o, js]) => runWorkerJobs(browser, url, js, o).then(r => [name, r])));
await browser.close(); server.close();
const ref = out[0][1];
console.log('render feedback: ' + jobs.length + ' drives, ' + Math.round((Date.now() - t0) / 1000) + 's');
for (const [name, r] of out) {
  if (r.errors.length) console.log('  ' + name + ' page errors: ' + r.errors.slice(0, 3).join(' | '));
  if (name === 'plain') continue;
  let same = 0; const diffs = [];
  jobs.forEach((j, i) => {
    const a = ref.results[i], b = r.results[i];
    if (!a.ok || !b.ok) { diffs.push(j.key + ': error ' + (a.error || b.error)); return; }
    let k = 0; const n = Math.min(a.hashes.length, b.hashes.length);
    while (k < n && a.hashes[k] === b.hashes[k]) k++;
    if (k === n && a.frames === b.frames) same++; else diffs.push(j.key + ': first difference at frame ' + k + ' of ' + a.frames + '/' + b.frames);
  });
  console.log('  ' + name + ' vs plain: ' + same + ' of ' + jobs.length + ' identical' + (diffs.length ? '\n    ' + diffs.join('\n    ') : ''));
}
