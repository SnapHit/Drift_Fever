/* BEFORE AND AFTER (briefs/COVER-LOOK.md, "When done"): a race as a
   player sees it, the HUD in, in day, dusk and night and on career
   track 1, at 1280x720 and 390x844, without the switch (the game as on
   main, which measure 8 proves pixel for pixel) and with ?look=2. The
   car is the starter in cyan, what a new player drives; the moment is
   the same step of the same race on both sides.

   node game/test/look/shots.js [--only day,night] [--sizes land,port] [--sides before,after] [--tier low|high] [--out dir] [--step N]
   writes review/look/shots/<race>-<size>-<side>.png */
import path from 'node:path';
import * as L from './lib.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const only = arg('--only', 'day,dusk,night,first').split(',');
const sizes = arg('--sizes', 'land,port').split(',');
const sides = arg('--sides', 'before,after').split(',');
const tier = arg('--tier', 'high');
const out = arg('--out', L.lookShots);
const stepOver = args.includes('--step') ? +arg('--step') : null;
/* the step of each race drawn: mid slide with the rival in the picture, found by eye */
export const AT = { day: 700, dusk: 651, night: 760, first: 560 };
const VP = { land: L.LAND, port: L.PORT, phone: L.PHONE_LAND };

const env = await L.start();
for (const race of only) {
  for (const size of sizes) {
    for (const side of sides) {
      const pg = await L.page(env, VP[size], 'tier=' + tier + (side === 'after' ? '&look=2' : ''));
      await L.dress(pg.page, L.STARTER);
      const at = await L.raceTo(pg.page, { rival: L.RACES[race].rival, to: stepOver || AT[race] });
      await L.hud(pg.page, true);
      const file = path.join(out, race + '-' + size + '-' + side + '.png');
      await L.snap(pg.page, file);
      const info = await L.sceneInfo(pg.page);
      console.log(file.replace(L.root + '/', ''), JSON.stringify({ state: at.state, angle: +at.angle.toFixed(1), v: +at.v.toFixed(1), preset: info.preset, theme: info.theme, tier: info.tier, drawCalls: info.drawCalls, triangles: info.triangles }), pg.errors.length ? pg.errors.slice(0, 2) : '');
      await pg.close();
    }
  }
}
await env.close();
