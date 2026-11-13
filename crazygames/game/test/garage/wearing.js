/* WHO WEARS WHAT ON THE ROAD (briefs/GARAGE.md 2 and the saves rule).
   The player's car, its ghost and the rival each wear their own look.

   Ghosts: a run finished with discs, an aqua glow and rose smoke worn
   saves a ghost that records them; raced again, the ghost wears the
   discs and a glow, and still does after the player has gone back to
   the standard look; the same ghost with its look taken out of the
   save (a ghost from before this round) shows the standard wheel and
   no glow. Known answer: with the ghost's record changed to deep
   fours, the ghost shows deep fours.
   Rivals: Varsk, Dovane, Halvik and Sarrow race on the wheels the
   roster gives them and Kestrow and Tolvo on the standard one; each
   portrait is drawn with them (Varsk's differs from the same car and
   paint on standard wheels). Known answer: two portraits of one car,
   paint and wheel are the same picture.

   node game/test/garage/wearing.js   writes review/garage/wearing.json and shots */
import path from 'node:path';
import fs from 'node:fs';
import * as G from './lib.js';

const env = await G.start(), out = {};
const pg = await G.emptyPage(env, { width: 844, height: 390 }, '?rivals=all'.slice(1)), page = pg.page;
const ghostNow = () => page.evaluate(() => { const sc = window.__feel.scene, m = sc.ghostModel(), c = sc.carModel(); return { look: sc.looks.ghost, wheels: m ? m.wheelsId || 'standard' : null, glow: m ? m.underglow.visible : null, car: { look: sc.looks.car, wheels: c.wheelsId || 'standard', glow: c.underglow.visible } }; });

/* ---- ghosts ---- */
await G.wear(page, { wheels: 'discs', glow: 'aqua', smoke: 'rose' });
await G.beginRun(page, 'career', 0, { drift: '*' });
const run = await G.driveToResults(page, 60 * 150);
const rec = await page.evaluate(() => { const g = window.__loop.save.ghost('career:0'); return g ? { look: g.look, steps: g.steps } : null; });
out.recorded = { finished: run.finished, ghostSaved: run.results && run.results.ghostSaved, rec };
G.say(run.finished && rec && rec.look.wheels === 'discs' && rec.look.glow === 'aqua' && rec.look.smoke === 'rose', 'a run finished with discs, an aqua glow and rose smoke saves a ghost that records them: ' + JSON.stringify(rec && rec.look));
await page.evaluate(() => { window.__feel.draw = false; window.__loop.startRun(window.__loop.careerSpec(0)); });
const g1 = await ghostNow();
await G.wear(page, {});
await page.evaluate(() => { window.__loop.startRun(window.__loop.careerSpec(0)); });
const g2 = await ghostNow();
out.ghost = { g1, g2 };
G.say(g1.wheels === 'discs' && g1.glow && g2.wheels === 'discs' && g2.glow && g2.car.wheels === 'standard' && !g2.car.glow, 'raced again, the ghost wears the discs and a glow; with the player back on the standard look the ghost still does (ghost ' + g2.wheels + ', glow ' + g2.glow + '; player ' + g2.car.wheels + ', glow ' + g2.car.glow + ')');
await G.midSlide(page, 0, 2, 16); await G.hud(page, true);
await G.snap(page, path.join(G.shots, 'wearing-ghost.png'));
/* a ghost from before this round: the same record with no look, through the save's own repair */
await page.evaluate(() => { const S = window.__loop.save, raw = JSON.parse(JSON.stringify(S.state)); delete raw.ghosts['career:0'].look; localStorage.setItem(S.KEY, JSON.stringify(raw)); S.reload(); window.__loop.startRun(window.__loop.careerSpec(0)); });
const g3 = await ghostNow();
out.ghost.g3 = g3;
G.say(g3.look.wheels === 'standard' && g3.wheels === 'standard' && g3.glow === false, 'the same ghost with no look in the save (one from before this round) shows the standard wheel and no glow: ' + JSON.stringify(g3.look));
await page.evaluate(() => { const S = window.__loop.save; S.state.ghosts['career:0'].look = { wheels: 'fours', glow: 'off', smoke: 'standard' }; window.__loop.startRun(window.__loop.careerSpec(0)); });
const g4 = await ghostNow();
out.ghost.g4 = g4;
G.say(g4.wheels === 'fours', 'known answer: the ghost\'s record changed to deep fours, the ghost shows ' + g4.wheels + ': ' + (g4.wheels === 'fours' ? 'CAUGHT' : 'MISSED'));

/* ---- rivals ---- */
const WANT = { r1: 'standard', r2: 'standard', r3: 'turbines', r4: 'fours', r5: 'daggers', r6: 'discs' };
const rivals = await page.evaluate(() => { const L = window.__loop, sc = window.__feel.scene, o = {}; for (const d of L.RIVALS) { L.startRun(L.battleSpec(d.id)); const m = sc.rivalModel(); o[d.id] = { name: d.name, wheels: m.wheelsId || 'standard', glow: m.underglow.visible, look: sc.looks.rival, player: sc.carModel().wheelsId || 'standard' }; } L.action('title'); return o; });
out.rivals = rivals;
G.say(Object.keys(WANT).every(id => rivals[id].wheels === WANT[id] && !rivals[id].glow && rivals[id].player === 'standard'), 'in a race each rival wears the roster\'s wheels and the player his own: ' + Object.keys(WANT).map(id => rivals[id].name + ' ' + rivals[id].wheels).join(', '));
await page.evaluate(() => { window.__feel.draw = true; }); await G.runFrames(page, 2);
const pics = await page.evaluate(() => {
  const L = window.__loop; L.action('rivals');
  const P = L.portraits, varsk = L.RIVALS[2];
  P.make([{ car: varsk.car, paint: 'lime' }]);   // the same car and paint on standard wheels
  const withWheels = P.get(varsk.car, 'lime', varsk.look), plain = P.get(varsk.car, 'lime', null);
  const twice = P.get(varsk.car, 'lime', { wheels: 'turbines' });
  return { shown: document.querySelectorAll('#screens .rcard img.pic').length, differs: !!withWheels && !!plain && withWheels !== plain, same: withWheels === twice, len: withWheels.length };
});
out.portraits = pics;
G.say(pics.shown === 6 && pics.differs, 'the rivals screen shows ' + pics.shown + ' portraits, and Varsk\'s, on his turbines, is not the picture of the same car and paint on standard wheels');
G.say(pics.same, 'known answer: the portrait asked for twice by the same car, paint and wheel is one picture: ' + (pics.same ? 'CAUGHT' : 'MISSED'));
await G.runFrames(page, 2);
await page.screenshot({ path: path.join(G.shots, 'wearing-rivals.png'), timeout: 180000 });
if (pg.errors.length) G.say(false, 'page errors: ' + pg.errors.slice(0, 2).join(' | '));
fs.writeFileSync(path.join(G.dir, 'wearing.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(G.failed() ? G.failed() + ' failed' : 'all passed');
process.exit(G.failed() ? 1 : 0);
