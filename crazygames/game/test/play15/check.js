/* AFTER PLAY, 15 November 2026 (the author's third empty save run and
   his first of the stunt park): a rival's drift counts at his share,
   Pro and Legend ask more for their stars, and the wall ride has a
   wider lane. From an empty save at 1280x720.
   Known answers: Kestrow, with no share of his own, counts in full;
   a Rookie track's targets are the plain ones; a race and the daily
   are never scaled.
   node game/test/play15/check.js   writes review/play15/check.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../ladder/lib.js';
const dir = path.join(R.root, 'review', 'play15'); fs.mkdirSync(dir, { recursive: true });
const env = await R.start(), out = {};
let fails = 0;
const ok = (name, pass, detail) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name + ': ' + detail); };
const pg = await R.emptyPage(env, { width: 1280, height: 720 }, ''), page = pg.page;

/* a race run on to the rival's line: what the results count for him against his own scoring */
const race = async id => {
  await page.evaluate(id => { const L = window.__loop; window.__feel.draw = false; L.startRun(L.battleSpec(id)); L.skipCountdown(); }, id);
  await R.runFrames(page, 60);
  await page.evaluate(() => window.__loop.finishNow());
  await R.runFrames(page, 30);
  return page.evaluate(() => { const L = window.__loop, r = L.results(), s = L.app.rival.scoring.state, Q = r.rivalParts;
    return { total: r.rival.total, own: s.total, drift: s.drift, shown: Q.drift, bonuses: Q.leads + Q.line }; });
};
for (const [id, name, share] of [['r1', 'Kestrow', 1], ['r3', 'Varsk', 0.9], ['r4', 'Dovane', 0.75], ['r6', 'Sarrow', 0.8]]) {
  const o = out[id] = await race(id), want = o.own - o.drift + Math.round(o.drift * share) + o.bonuses;
  ok((share === 1 ? 'known answer: ' : '') + name + "'s drift counts " + share + ' of itself in the results', o.shown === Math.round(o.drift * share) && o.total === want && (share === 1) === (o.total === o.own + o.bonuses),
    'his own ' + o.own + ' (drift ' + o.drift + '), counted ' + o.total + ' with ' + o.bonuses + ' of bonuses, drift shown ' + o.shown);
}

/* the star targets a run is given */
const targets = async make => page.evaluate(async make => {
  const L = window.__loop, m = await import('/src/loop/modes.js');
  const spec = make === 'daily' ? m.dailySpec() : make[0] === 'r' ? L.battleSpec(make) : m.careerSpec(+make);
  window.__feel.draw = false; L.startRun(spec); const t = L.app.targets.slice(), plain = m.starTargets(L.app.track, L.app.laps); L.action('title');
  return { t, plain };
}, make);
for (const [make, name, k] of [['0', 'Rookie track 1', 1], ['7', 'Rookie track 8', 1], ['8', 'Pro track 1', 1.5], ['15', 'Pro track 8', 1.5], ['16', 'Legend track 1', 1.5], ['daily', 'the daily', 1], ['r3', "Varsk's race on Pro track 1", 1]]) {
  const o = out['targets ' + make] = await targets(make);
  const near = o.t.every((t, i) => Math.abs(t - o.plain[i] * k) <= 10);
  ok((k === 1 ? 'known answer: ' : '') + name + ' asks ' + k + ' times the plain targets', near && (k === 1) === (o.t.join() === o.plain.join()), o.t.join(', ') + ' against plain ' + o.plain.join(', '));
}

/* the wall ride's lane and targets */
const wall = await page.evaluate(async () => { const { LOOP } = await import('/src/tune.js'); return { near: LOOP.PARK.WALL_NEAR, t: LOOP.PARK.TARGETS.wall }; });
out.wall = wall;
ok('the wall ride counts within 6 m of the wall and asks 15, 40 and 90 m', wall.near === 6 && wall.t.join() === '15,40,90', JSON.stringify(wall));

/* a race's points pill does not follow the player into the stunt park (the author's screenshot, 15 November) */
const pill = await page.evaluate(async () => { const L = window.__loop, vs = document.querySelector('#vs');
  L.startRun(L.battleSpec('r1')); const inRace = !vs.hidden; L.action('title'); L.action('free'); return { inRace, inPark: !vs.hidden }; });
out.pill = pill;
ok('the rival pill shows in a race (known answer) and not in the stunt park after it', pill.inRace && !pill.inPark, JSON.stringify(pill));

fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
