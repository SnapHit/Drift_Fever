/* MEASURE 3, A STAR IN THE FIRST RUN (briefs/FIRST-MINUTE.md priority
   2). The newcomer's first runs of track 1 from an empty save, the same
   RUNS strangers as newcomer.js on a phone (touch, Easy), with ?first=2:
   at least 7 of 10 earn a star. Three stars stay a skill: the careful
   scripted driver (physics/driver.js, no slides) still earns no more
   than two, clean, and the scripted drifter's stars are reported. Both
   are driven on main too, for the record, and so are the three scripted
   players with a thumb's hands (rivals/players.js: grip, slide and
   mixed; steering -1, 0 or +1, DRIFT / BRAKE, as a phone), with each
   one's best banked chain: the slide is still earned if what they score
   by sliding stays well above a stranger's.
   Known answer: main's targets with the same hands (the same runs'
   scores against main's 450, 900, 1,580): reported, and they must miss
   the bar, or the bar proves nothing.

   node game/test/first/stars.js [--runs 10]   writes review/first/stars.json */
import path from 'node:path';
import * as F from './lib.js';
import { FIRST } from '../../src/tune.js';

const args = process.argv.slice(2), RUNS = +(args.includes('--runs') ? args[args.indexOf('--runs') + 1] : 10);
const MAIN_TARGETS = [450, 900, 1580];   // career track 1's targets on main (loop/modes.js starTargets: 518 m, 3 laps, difficulty 0.1)
const starsOf = (score, t) => t.filter(x => score >= x).length;

/* a scripted driver's run of career 1, to its results */
const DRIVE = `return ((driver) => {
  const L = window.__loop, F = window.__feel; F.draw = false; window.__clock = 1000;
  try { localStorage.clear(); } catch (e) { /* none */ } L.save.reset(); L.save.setOnboarded();
  L.startRun(L.careerSpec(0)); F.setDriver(driver);
  for (let i = 0; i < 60 * 300 && L.app.state !== 'results'; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); }
  const R = L.results();
  return R ? { score: R.score, stars: R.stars, targets: R.targets, cleanSectors: R.cleanSectors, hits: F.world.hits, seconds: +R.seconds.toFixed(1), drift: Math.round(R.parts.drift), bestChain: Math.round(F.scoring.state.best) } : null;
})(arguments[0]);`;

async function sideOf(name, query) {
  const S = await F.side(name), env = await S.R.start(), out = { strangers: [], drivers: {} };
  try {
    const pg = await F.freshPage(env, S.R, F.PHONE, query, true);
    for (let seed = 1; seed <= RUNS; seed++) {
      await pg.page.evaluate(() => { const L = window.__loop; try { localStorage.clear(); } catch (e) { /* none */ } L.save.reset(); L.action('title'); });
      const r = await pg.page.evaluate(seed => window.__first.run(seed, {}), seed);
      if (r.error) throw new Error(name + ' seed ' + seed + ': ' + r.error);
      out.strangers.push({ seed, score: r.results.score, stars: r.results.stars, targets: r.targets, cleanSectors: r.results.cleanSectors, coins: r.results.coins, drift: Math.round(r.results.parts.drift), bestChain: r.results.bestChain });
    }
    for (const [k, d] of [['careful', { drift: null }], ['drifter', { drift: '*' }], ['grip player', { player: 'grip' }], ['slide player', { player: 'slide' }], ['mixed player', { player: 'mixed' }]]) out.drivers[k] = await pg.page.evaluate(new Function(DRIVE), d);
    out.errors = pg.errors.slice(0, 5);
    await pg.close();
  } finally { await env.close(); }
  return out;
}

const main = await sideOf('main', ''), branch = await sideOf('branch', 'first=2');
const T = branch.strangers[0].targets;
const won = branch.strangers.filter(s => s.stars >= 1).length, withMain = branch.strangers.filter(s => starsOf(s.score, MAIN_TARGETS) >= 1).length, mainWon = main.strangers.filter(s => s.stars >= 1).length;
F.say(JSON.stringify(T) === JSON.stringify(FIRST.STARS), 'the first run of track 1 asks the switch\'s targets: ' + T.join(', ') + ' (main ' + MAIN_TARGETS.join(', ') + ')');
F.say(won >= Math.ceil(RUNS * 0.7), 'with ?first=2, ' + won + ' of ' + RUNS + ' strangers earn a star on their first run (bar 7 of 10; scores ' + branch.strangers.map(s => s.score).join(' ') + ')');
const c = branch.drivers.careful, d = branch.drivers.drifter;
F.say(!!c && c.stars <= 2 && /^12 of 12$/.test(c.cleanSectors), 'three stars stay a skill: the careful scripted driver earns ' + (c && c.stars) + ' star(s), clean (' + (c && c.cleanSectors) + ', ' + (c && c.score) + ' points); the scripted drifter ' + (d && d.stars) + ' (' + (d && d.score) + ')');
F.say(withMain < Math.ceil(RUNS * 0.7), 'known answer: against main\'s targets the same runs earn ' + withMain + ' of ' + RUNS + ' stars, which misses the bar (caught); main itself, its own hands and targets: ' + mainWon + ' of ' + RUNS + ' (scores ' + main.strangers.map(s => s.score).join(' ') + '; careful ' + (main.drivers.careful && main.drivers.careful.stars) + ', drifter ' + (main.drivers.drifter && main.drivers.drifter.stars) + ')');
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const [k, side] of [['strangers (median of ' + RUNS + ')', null], ...Object.keys(branch.drivers).map(k => [k, k])]) {
  const one = sd => side ? sd.drivers[side] : { score: med(sd.strangers.map(s => s.score)), drift: med(sd.strangers.map(s => s.drift)), bestChain: med(sd.strangers.map(s => s.bestChain)), stars: med(sd.strangers.map(s => s.stars)) };
  const show = r => r ? r.score + ' points (' + r.stars + ' star' + (r.stars === 1 ? '' : 's') + ', ' + r.drift + ' from slides, best chain ' + r.bestChain + (r.seconds ? ', ' + r.seconds + ' s, ' + r.hits + ' hits' : '') + ')' : '-';
  console.log('INFO ' + k + ': main ' + show(one(main)) + '; ?first=2 ' + show(one(branch)));
}
F.say(main.errors.length === 0 && branch.errors.length === 0, 'no page errors (' + [...main.errors, ...branch.errors].join(' | ') + ')');
F.writeJson(path.join(F.dir, 'stars.json'), { main: F.mainCommit(), targets: { branch: T, main: MAIN_TARGETS }, sides: { main, branch }, withMainTargets: withMain });
console.log(F.failed() ? F.failed() + ' failed' : 'all passed');
process.exit(F.failed() ? 1 : 0);
