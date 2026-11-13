/* A LOOK AT THE GARAGE at one size, for working on it:
   node game/test/garage/peek.js 390x844 [section] [car] [out.png] [kind:item ...]
   presses each kind:item (a preview) before the shot; ANGLE= turns the car to an angle. */
import path from 'node:path';
import * as R from '../ladder/lib.js';
const [size, section, car, file, ...looks] = process.argv.slice(2);
const [w, h] = (size || '390x844').split('x').map(Number);
const env = await R.start();
const pg = await R.emptyPage(env, { width: w, height: h }, process.env.QUERY || '');
await pg.page.evaluate(({ section, car, looks }) => { const L = window.__loop; window.__feel.draw = false; L.save.state.coins = 4200; L.action('garage'); if (car) L.action('pick-car', car); for (const l of looks) L.action(l.startsWith('paint:') ? 'paint' : 'look', l.replace(/^paint:/, '')); if (section) L.action('garage-tab', section); }, { section, car, looks });
await R.runFrames(pg.page, +(process.env.FRAMES || 40));   // drawing off: the software renderer is slow
if (process.env.ANGLE) { await pg.page.evaluate(a => { const s = window.__loop.showroom.state; s.angle = a; s.dragging = true; }, +process.env.ANGLE); await R.runFrames(pg.page, 2); }
await pg.page.evaluate(() => { window.__feel.draw = true; });
await R.runFrames(pg.page, 2);
await pg.page.screenshot({ path: file || path.join(R.root, 'review', 'garage', 'shots', 'peek.png'), timeout: 180000 });
if (pg.errors.length) console.log(pg.errors);
await env.close();
