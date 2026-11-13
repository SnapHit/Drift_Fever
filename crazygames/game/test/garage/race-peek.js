/* A LOOK AT A RACE with cosmetics on, for working on them:
   node game/test/garage/race-peek.js night low out.png wheels=discs glow=aqua smoke=rose [index] */
import * as G from './lib.js';
const [preset, tier, file, ...rest] = process.argv.slice(2);
const look = {}; let index = 0;
for (const r of rest) { if (/=/.test(r)) { const [k, v] = r.split('='); look[k] = v; } else index = +r; }
const env = await G.start();
const pg = await G.page(env, { width: +(process.env.W || 844), height: +(process.env.H || 390) }, 'tier=' + tier + '&preset=' + preset + '&adapt=0');
await G.wear(pg.page, look);
const m = await G.midSlide(pg.page, index, +(process.env.MULT || 2), +(process.env.HELD || 16));
console.log(JSON.stringify(m));
await G.shot(pg.page, file);
if (pg.errors.length) console.log(pg.errors);
await env.close();
