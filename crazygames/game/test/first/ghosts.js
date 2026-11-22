/* RULE 2, GHOSTS AND SAVES (briefs/FIRST-MINUTE.md): a run on the new
   starter handling records it, and its ghost replays with it; an old
   ghost of the starter is not raced against the new handling; saves are
   additive. In one browser profile, so the save carries from page to
   page as a visitor's does:
   1. without the switch (the game as on main), the careful scripted
      driver runs career track 1: an old ghost, under career:0;
   2. with ?first=2 a new run of track 1 races no ghost (the old one is
      of the old handling), and the old ghost is still in the save;
   3. that run (the same driver) records its ghost under first:career:0
      with the new handling's revision, and the old one is untouched;
   4. that ghost's tape, replayed through a run with the switch, finishes
      with the hash the ghost recorded: it replays with the handling it
      was driven on; a run of track 1 now races it;
   5. without the switch again, a run of track 1 races the old ghost and
      never the new one, and every key the save had is still there.
   Known answer: the new ghost with its revision put back to the old
   one is turned away (not raced).

   node game/test/first/ghosts.js   writes review/first/ghosts.json */
import path from 'node:path';
import * as F from './lib.js';
import { FIRST } from '../../src/tune.js';

const S = await F.side('branch'), env = await S.R.start(), out = {};
const RUN = `return (() => {
  const L = window.__loop, F = window.__feel; F.draw = false; window.__clock = 1000;
  L.save.setOnboarded();
  L.startRun(L.careerSpec(0));
  const raced = L.app.ghost ? { rev: L.app.ghost.record.rev, hash: L.app.ghost.record.hash } : null;
  F.setDriver({ drift: null });
  for (let i = 0; i < 60 * 300 && L.app.state !== 'results'; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); }
  const R = L.results();
  const g = L.save.state.ghosts;
  return { raced, score: R && R.score, hash: R && R.hash, ghosts: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { rev: v.rev, hash: v.hash, score: v.score, steps: v.steps }])), keys: Object.keys(L.save.state) };
})();`;
const RACES = `return (() => { const L = window.__loop; L.save.setOnboarded(); L.startRun(L.careerSpec(0)); const g = L.app.ghost; const r = g ? { rev: g.record.rev, hash: g.record.hash } : null; L.action('title'); return r; })();`;
try {
  const ctx = await env.browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const open = async q => {
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    await page.addInitScript('window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {};');
    await page.goto(env.url + '?renderer=webgl2&controls=easy' + (q ? '&' + q : ''), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    return { page, errors };
  };
  let p = await open('');
  await p.page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } window.__loop.save.reset(); });
  out.plain = await p.page.evaluate(new Function(RUN));
  await p.page.close();
  p = await open('first=2');
  out.firstRaces = await p.page.evaluate(new Function(RACES));
  out.first = await p.page.evaluate(new Function(RUN));
  /* the new ghost's tape, replayed through a run with the switch */
  out.replay = await p.page.evaluate(() => {
    const L = window.__loop, g = L.save.ghost('first:career:0');
    if (!g) return null;
    const tape = g.tape.map(e => ({ n: e[0], s: e[1], t: e[2], b: e[3], h: e[4] }));
    const R = L.replayRun(L.careerSpec(0), tape);
    return { hash: R && R.hash, recorded: g.hash, score: R && R.score, recordedScore: g.score };
  });
  out.firstRacesAfter = await p.page.evaluate(new Function(RACES));
  /* the known answer: the new ghost's revision put back to the old handling's */
  out.known = await p.page.evaluate(new Function(`return (() => { const L = window.__loop, g = L.save.state.ghosts['first:career:0']; const was = g.rev; g.rev = 1; const r = (${RACES.replace(/^return /, '').replace(/;$/, '')}); g.rev = was; return r; })();`));
  const errFirst = p.errors.slice(); await p.page.close();
  p = await open('');
  out.plainAfter = await p.page.evaluate(new Function(RACES));
  out.keysAfter = await p.page.evaluate(() => ({ keys: Object.keys(window.__loop.save.state), ghosts: Object.keys(window.__loop.save.state.ghosts) }));
  out.errors = [...errFirst, ...p.errors];
  await p.page.close();
  await ctx.close();
} finally { await env.close(); }

const old = out.plain.ghosts['career:0'], neu = out.first.ghosts['first:career:0'];
F.say(!!old && old.rev === 1, '1. without the switch the run records an old ghost under career:0 (revision ' + (old && old.rev) + ')');
F.say(out.firstRaces === null && !!out.first.ghosts['career:0'] && JSON.stringify(out.first.ghosts['career:0']) === JSON.stringify(old), '2. with ?first=2 a run of track 1 races no ghost (' + JSON.stringify(out.firstRaces) + '), and the old ghost is still in the save, unchanged');
F.say(!!neu && neu.rev === FIRST.rev, '3. that run records its ghost under first:career:0 with the new handling\'s revision (' + (neu && neu.rev) + ', FIRST.rev ' + FIRST.rev + '; ' + (neu && neu.score) + ' points)');
F.say(!!out.replay && out.replay.hash === out.replay.recorded && out.replay.score === out.replay.recordedScore, '4. its tape replayed through a run with the switch finishes as recorded: hash ' + (out.replay && out.replay.hash === out.replay.recorded ? 'the same' : 'DIFFERENT') + ', ' + (out.replay && out.replay.score) + ' points against ' + (out.replay && out.replay.recordedScore) + '; a run now races it: ' + (out.firstRacesAfter && out.firstRacesAfter.rev === FIRST.rev && out.firstRacesAfter.hash === neu.hash));
F.say(!!out.plainAfter && out.plainAfter.rev === 1 && out.plainAfter.hash === old.hash && out.keysAfter.ghosts.includes('career:0') && out.keysAfter.ghosts.includes('first:career:0') && out.plain.keys.every(k => out.keysAfter.keys.includes(k)), '5. without the switch again a run races the old ghost (revision ' + (out.plainAfter && out.plainAfter.rev) + '), never the new one, and the save keeps every key it had (' + out.keysAfter.keys.length + ' keys; ghosts ' + out.keysAfter.ghosts.join(', ') + ')');
F.say(out.known === null, 'known answer: the new ghost with its revision put back to the old handling\'s is not raced (' + JSON.stringify(out.known) + ')');
F.say(!out.errors.length, 'no page errors (' + out.errors.join(' | ') + ')');
F.writeJson(path.join(F.dir, 'ghosts.json'), out);
console.log(F.failed() ? F.failed() + ' failed' : 'all passed');
process.exit(F.failed() ? 1 : 0);
