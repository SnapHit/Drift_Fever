/* GARAGE MEASURE 1: THE LAYOUT. At 390x844, 844x390, 800x450 and
   1280x720, in every section, for the starter, the longest car (the
   grand tourer) and the widest (the drift build, with its wing):
     - the car, through a whole turn, is inside the screen and inside
       the stage, and no control's box touches the car's;
     - no control is under 44 px either way;
     - nothing scrolls sideways (the page, the screen, the pane), and no
       control reaches past the screen's sides;
     - every control is reachable: on screen as it stands, or brought
       fully into the pane by scrolling it, and on top there (not
       hidden under another).
   The car's box is the showroom's own projection (carRect), so once a
   size it is checked against the picture: the pixels the car changes
   (the same frame drawn with the car and without) lie inside its box
   at that angle.

   Known answers, at every size: a button laid over the car, a 40 px
   button and a row too wide for the pane are each caught, and a car box
   moved off the car is caught by the picture.

   node game/test/garage/layout.js   writes review/garage/layout.json and shots */
import path from 'node:path';
import fs from 'node:fs';
import * as G from './lib.js';

const CARS = ['starter', 'tourer', 'driftbuild'];
const env = await G.start(), out = { rows: [], known: [] };

const CHECK = `(() => {
  const L = window.__loop, sr = L.showroom, W = innerWidth, H = innerHeight, bad = [];
  const st = document.querySelector('.garage .stage').getBoundingClientRect(), car = sr.carRect(true);
  const hit = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  if (!car) return { bad: ['no car'], buttons: 0 };
  if (car.left < 0 || car.top < 0 || car.right > W || car.bottom > H) bad.push('car off the screen: ' + [car.left, car.top, car.right, car.bottom].map(Math.round));
  if (car.left < st.left - 1 || car.top < st.top - 1 || car.right > st.right + 1 || car.bottom > st.bottom + 1) bad.push('car outside the stage: car ' + [car.left, car.top, car.right, car.bottom].map(Math.round) + ' stage ' + [st.left, st.top, st.right, st.bottom].map(Math.round));
  const pane = document.querySelector('.garage .pane'), buttons = [...document.querySelectorAll('#screens button')].filter(b => b.offsetParent !== null);
  let smallest = 1e9;
  for (const b of buttons) {
    const inPane = pane.contains(b), name = (b.dataset.action || '') + ':' + (b.dataset.arg || '');
    if (inPane) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = b.getBoundingClientRect();
    smallest = Math.min(smallest, r.width, r.height);
    if (r.width < 44 || r.height < 44) bad.push('under 44 px: ' + name + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (hit(r, car)) bad.push('over the car: ' + name);
    if (r.left < -0.5 || r.right > W + 0.5) bad.push('past the side: ' + name);
    /* reachable: wholly on screen (and, in the pane, inside it), and the thing on top at its middle */
    const box = inPane ? pane.getBoundingClientRect() : { top: 0, bottom: H, left: 0, right: W };
    if (r.top < box.top - 0.5 || r.bottom > Math.min(H, box.bottom) + 0.5) bad.push('not reachable: ' + name + ' ' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' in ' + Math.round(box.top) + '..' + Math.round(box.bottom));
    else { const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!top || !(top === b || b.contains(top))) bad.push('covered: ' + name); }
  }
  pane.scrollTop = 0;
  const sideways = Math.max(document.documentElement.scrollWidth - W, document.querySelector('#screens').scrollWidth - document.querySelector('#screens').clientWidth, pane.scrollWidth - pane.clientWidth);
  if (sideways > 0) bad.push('scrolls sideways by ' + sideways + ' px');
  return { bad, buttons: buttons.length, smallest: Math.round(smallest), car: [car.left, car.top, car.right, car.bottom].map(Math.round), stage: [st.left, st.top, st.right, st.bottom].map(Math.round), scrolls: pane.scrollHeight > pane.clientHeight + 1 };
})()`;

for (const vp of G.SIZES) {
  const tag = vp.width + 'x' + vp.height, pg = await G.emptyPage(env, vp, ''), page = pg.page;
  let worst = { buttons: 0, smallest: 1e9 }, fails = [];
  for (const car of CARS) for (const section of G.SECTIONS) {
    await G.openGarage(page, 3000, section, car === 'starter' ? null : car);
    /* something previewed in each cosmetic section, so its buy button is up */
    if (section === 'wheels') await page.evaluate(() => window.__loop.action('look', 'wheels:blades'));
    if (section === 'glow') await page.evaluate(() => window.__loop.action('look', 'glow:lime'));
    if (section === 'smoke') await page.evaluate(() => window.__loop.action('look', 'smoke:rose'));
    if (section === 'paint') await page.evaluate(() => window.__loop.action('paint', 'lime'));
    await G.runFrames(page, 2);
    const r = await page.evaluate(CHECK);
    out.rows.push({ size: tag, car, section, ...r });
    worst.buttons = Math.max(worst.buttons, r.buttons); worst.smallest = Math.min(worst.smallest, r.smallest);
    if (r.bad.length) fails.push(car + ' ' + section + ': ' + r.bad.join('; '));
    if (car === 'starter') { await page.evaluate(() => { const s = window.__loop.showroom.state; s.angle = 4.1; s.dragging = true; }); await G.runFrames(page, section === 'smoke' ? 120 : 2); await G.snap(page, path.join(G.shots, 'layout-' + tag + '-' + section + '.png')); await page.evaluate(() => { window.__loop.showroom.state.dragging = false; }); }
  }
  G.say(fails.length === 0, tag + ': in ' + CARS.length * G.SECTIONS.length + ' views (3 cars, 6 sections) the car is whole, in the stage and under no control; no control under 44 px (smallest ' + worst.smallest + '); nothing scrolls sideways; all of up to ' + worst.buttons + ' controls reachable' + (fails.length ? ' FAILED: ' + fails.slice(0, 4).join(' | ') : ''));

  /* the car's box against the picture */
  await G.openGarage(page, 3000, 'cars', 'driftbuild');
  await page.evaluate(() => { const s = window.__loop.showroom.state; s.angle = 2.2; s.dragging = true; });
  await G.runFrames(page, 2);
  const withCar = await G.decode(await G.snap(page, path.join(G.shots, 'tmp.png')));
  await page.evaluate(() => { const sc = window.__loop.showroom.scene; sc.traverse(o => { if (o.name && o.name.startsWith('car:') && !(o.parent && o.parent.scale.y < 0)) o.visible = false; }); });
  const noCar = await G.decode(await G.snap(page, path.join(G.shots, 'tmp.png')));
  await page.evaluate(() => { const sc = window.__loop.showroom.scene; sc.traverse(o => { if (o.name && o.name.startsWith('car:')) o.visible = true; }); });
  const box = await page.evaluate(() => window.__loop.showroom.carRect(false)), d = G.diffMask(withCar, noCar, 6), k = withCar.w / vp.width;
  const inside = b => !!d.box && d.box.x0 >= (b.left - 2) * k && d.box.x1 <= (b.right + 2) * k && d.box.y0 >= (b.top - 2) * k && d.box.y1 <= (b.bottom + 2) * k;
  const fills = d.box ? (d.box.x1 - d.box.x0) / k / box.width : 0;
  out.rows.push({ size: tag, picture: d.box, box, fills });
  G.say(inside(box) && fills > 0.8, tag + ': the car in the picture (' + d.n + ' pixels) lies inside the box the measure uses, and fills ' + Math.round(fills * 100) + '% of its width');
  const moved = { left: box.left + box.width * 0.5, right: box.right + box.width * 0.5, top: box.top, bottom: box.bottom };
  G.say(!inside(moved), tag + ' known answer: a box moved half a car aside is caught by the picture: ' + (!inside(moved) ? 'CAUGHT' : 'MISSED'));

  /* the known answers for the layout */
  await G.openGarage(page, 3000, 'wheels');
  const known = {};
  known.over = await page.evaluate(new Function(`
    const st = document.querySelector('.garage .stage'), b = document.createElement('button'); b.type = 'button'; b.dataset.action = 'known'; b.textContent = 'X';
    b.style.cssText = 'position:absolute;left:40%;top:40%;width:60px;height:60px'; st.appendChild(b);
    const r = ${CHECK}; b.remove(); return r.bad.filter(x => /over the car/.test(x)).length;`));
  known.small = await page.evaluate(new Function(`
    const pane = document.querySelector('.garage .pane'), b = document.createElement('button'); b.type = 'button'; b.dataset.action = 'known'; b.textContent = 'X';
    b.style.cssText = 'width:40px;height:40px;padding:0'; pane.appendChild(b);
    const r = ${CHECK}; b.remove(); return r.bad.filter(x => /under 44/.test(x)).length;`));
  known.wide = await page.evaluate(new Function(`
    const pane = document.querySelector('.garage .pane'), b = document.createElement('div');
    b.style.cssText = 'width:' + (innerWidth + 200) + 'px;height:10px'; pane.style.overflowX = 'auto'; pane.appendChild(b);
    const r = ${CHECK}; b.remove(); pane.style.overflowX = ''; return r.bad.filter(x => /sideways/.test(x)).length;`));
  out.known.push({ size: tag, ...known });
  G.say(known.over > 0 && known.small > 0 && known.wide > 0, tag + ' known answers: a button laid over the car ' + (known.over ? 'CAUGHT' : 'MISSED') + ', a 40 px button ' + (known.small ? 'CAUGHT' : 'MISSED') + ', a row wider than the pane ' + (known.wide ? 'CAUGHT' : 'MISSED'));
  if (pg.errors.length) G.say(false, tag + ' page errors: ' + pg.errors.slice(0, 2).join(' | '));
  await page.close();
}
try { fs.unlinkSync(path.join(G.shots, 'tmp.png')); } catch (e) { /* none */ }
fs.writeFileSync(path.join(G.dir, 'layout.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(G.failed() ? G.failed() + ' failed' : 'all passed');
process.exit(G.failed() ? 1 : 0);
