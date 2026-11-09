/* A SAVE FROM MAIN, for the old save measurement (briefs/CHAPTERS.md,
   Keep). Runs main's game (a worktree of main given on the command line)
   in headless Chromium, plays career track 1 to its results with the
   scripted drifter (a star or two, a ghost, missions, coins), then adds
   through main's own save API what a player who has played a while has:
   stars on the other Rookie tracks, mission flags, a daily result, a
   bought and upgraded car with a paint, a Lab best. Writes the blob main
   stored (as the string main wrote), twice: with 11 Rookie stars and, after one more star, with 12
   (LOOP.CHAPTERS.OPEN[1]).

   node game/test/chapters/main-save.js /path/to/main/worktree
     writes review/chapters/main-save-11.json and main-save-12.json */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const wt = path.resolve(process.argv[2] || '');
const R = await import(path.join(wt, 'crazygames', 'game', 'test', 'retention', 'lib.js'));
const commit = execSync('git -C ' + JSON.stringify(wt) + ' rev-parse HEAD').toString().trim();
const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'review', 'chapters');
const env = await R.start();
const pg = await R.openPage(env, R.SMALL, { firstVisit: true, query: 'title=1' });
const { page } = pg;
await page.evaluate(() => { window.__feel.draw = false; window.__loop.save.reset(); });
await R.beginRun(page, 'career', 0, { drift: '*' });
const run = await R.driveToResults(page, 60 * 300);
const blobs = await page.evaluate(() => {
  const Lp = window.__loop, S = Lp.save;
  S.addCoins(3000); S.buyCar('hatch', 900); S.buyUpgrade('hatch', 'grip'); S.setPaint('hatch', 'lime'); S.chooseCar('starter');
  S.dailyResult('2026-11-09', 1, 640);
  S.missionResult('career:1', [true, false, true]); S.missionResult('career:2', [false, false, true]);
  const lab = Lp.lab.labSpec({ kind: 'sprint', length: 'short', style: 'hairpins', bank: true, cross: false, theme: 'desert', time: 'night' }, 4242);
  S.labResult(lab.code, 1, 333); S.setLabLast(lab.code);
  const rookie = () => { let n = 0; for (let i = 0; i < 8; i++) n += (S.state.career[String(i)] || {}).stars || 0; return n; };
  /* 11 Rookie stars, the first track's own from the run */
  for (let i = 1; i < 8 && rookie() < 11; i++) S.careerResult(i, Math.min(2, 11 - rookie()), 400 + i * 10);
  const b11 = localStorage.getItem(S.KEY), s11 = rookie();
  for (let i = 1; i < 8 && rookie() < 12; i++) if ((S.state.career[String(i)] || {}).stars < 3) S.careerResult(i, S.state.career[String(i)].stars + 1, 500 + i * 10);
  return { b11, s11, b12: localStorage.getItem(S.KEY), s12: rookie(), key: S.KEY };
});
for (const [n, blob] of [[11, blobs.b11], [12, blobs.b12]]) fs.writeFileSync(path.join(outDir, 'main-save-' + n + '.json'), JSON.stringify({ from: 'main ' + commit, key: blobs.key, rookieStars: n === 11 ? blobs.s11 : blobs.s12, run: run.results && { score: run.results.score, stars: run.results.stars }, blob }, null, 1));
console.log('main', commit, 'run', run.results && run.results.score, run.results && run.results.stars, 'stars', blobs.s11, blobs.s12, 'errors', pg.errors.length);
await pg.close(); await env.close();
