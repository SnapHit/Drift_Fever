/* GARAGE MEASURE 2: EVERY COSMETIC SHOWS, WHERE IT SHOULD AND NOWHERE
   ELSE. For each wheel, glow and smoke colour: a shot of the showroom
   (1280x720) and a shot mid slide in a race at night and by day (dawn),
   low tier, 844x390, the HUD out of the picture.

   The race frames are the same frame every time: the scripted drifter
   is deterministic and Math.random is seeded, so two runs of the
   standard look are the same picture to the pixel (checked first: that
   is what "nowhere else" stands on). Then, for each item:
     - it differs from the standard look in at least MIN pixels;
     - every pixel that differs lies where that kind of thing is drawn:
       for wheels, where hiding the wheels changes the picture; for
       smoke, where hiding the smoke does; for the glow, inside the
       glow's own outline on the road, projected to the screen (each
       grown by GROW pixels);
     - for a smoke colour, the smoke itself is the standard smoke to the
       last puff: as many puffs alive, in the same places, the same
       sizes and the same strengths (the brief: its amount, life and
       climb stay exactly as they are). Known answer: the same frame
       with the effects thinned to half is caught;
     - every pair of items of a kind differs from each other in at
       least PAIR pixels by more than 24 levels.
   In the showroom the same three, inside the stage.

   Known answers: with one wheel given another's numbers, one glow
   another's colour and one smoke another's colour, each pair must be
   caught as the same; and a glow drawn far wider than its outline must
   be caught outside it.

   node game/test/garage/looks.js [race|showroom]   writes review/garage/looks-<part>.json and shots */
import path from 'node:path';
import fs from 'node:fs';
import * as G from './lib.js';

const part = process.argv[2] === 'showroom' ? 'showroom' : 'race';
const KINDS = { wheels: ['daggers', 'turbines', 'discs', 'fours', 'blades'], glow: ['aqua', 'lime', 'amber', 'magenta', 'violet'], smoke: ['aqua', 'lime', 'tangerine', 'rose', 'violet'] };
const MIN = { wheels: 12, glow: 150, smoke: 300 }, PAIR = { wheels: 8, glow: 100, smoke: 200 }, GROW = 2;
const env = await G.start(), out = { part, rows: [], pairs: [], known: [] };

/* make two items of a kind the same in the page (the known answer), or put them back */
const TWIN = `async (on) => {
  const C = await import('/src/garage/cosmetics.js'), W = await import('/src/cars/wheels.js');
  window.__twin = window.__twin || { glow: C.GLOWS[2].hex, smoke: C.SMOKES[2].hex, wheel: { ...W.WHEEL_DESIGNS.turbines } };
  C.GLOWS[2].hex = on ? C.GLOWS[1].hex : window.__twin.glow;
  C.SMOKES[2].hex = on ? C.SMOKES[1].hex : window.__twin.smoke;
  Object.assign(W.WHEEL_DESIGNS.turbines, on ? { ...W.WHEEL_DESIGNS.daggers, name: 'Turbines' } : window.__twin.wheel);
}`;
const SECOND = { wheels: ['daggers', 'turbines'], glow: ['aqua', 'lime'], smoke: ['aqua', 'lime'] };

function pairs(kind, imgs, region, tag, expectSame) {
  const ids = Object.keys(imgs);
  let worst = null;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const d = G.difference(imgs[ids[i]], imgs[ids[j]], region, 24);
    const row = { where: tag, kind, a: ids[i], b: ids[j], pixels: d.big, mean: d.mean };
    if (!expectSame) out.pairs.push(row);
    if (!worst || d.big < worst.pixels) worst = row;
  }
  return worst;
}

if (part === 'race') {
  for (const preset of ['night', 'dawn']) {
    const pg = await G.page(env, { width: 844, height: 390 }, 'tier=low&preset=' + preset + '&adapt=0'), page = pg.page;
    await G.hud(page, false);
    const frame = async (look, file, hook, density) => {
      await G.wear(page, look);
      const m = await G.midSlide(page, 0, 2, 16, null, density);
      if (hook) await page.evaluate(hook);
      const png = await G.snap(page, file || path.join(G.shots, 'tmp.png'));
      const img = await G.decode(png);
      /* the smoke as it stands: how many puffs, and their corners and strengths summed */
      img.smoke = await page.evaluate(() => { const sm = window.__feel.scene.effects().pools.smoke, g = sm.mesh.geometry, n = sm.live(), P = g.attributes.position.array, A = g.attributes.alpha.array; let ps = 0, as = 0; for (let i = 0; i < n * 12; i++) ps += P[i]; for (let i = 0; i < n * 4; i++) as += A[i]; return { n, ps, as, heat: window.__feel.scene.show().state.heat }; });
      return img;
    };
    const tag = 'race ' + preset;
    const base = await frame({}, path.join(G.shots, 'race-' + preset + '-standard.png')), again = await frame({});
    const same = G.diffMask(base, again, 0);
    out.rows.push({ where: tag, item: 'standard twice', differs: same.n });
    G.say(same.n === 0, tag + ': the standard look drawn twice is the same picture to the pixel (' + same.n + ' pixels differ)');
    /* where each kind is drawn */
    const noWheels = await frame({}, null, () => { const w = window.__feel.scene.carModel().wheels; for (const k of Object.keys(w)) w[k].mesh.visible = false; });
    const noSmoke = await frame({}, null, () => { window.__feel.scene.effects().pools.smoke.mesh.scale.setScalar(0); });
    await page.evaluate(() => { window.__feel.scene.effects().pools.smoke.mesh.scale.setScalar(1); });
    /* the glow's outline on the screen: its mesh's corners on the road, through the camera, at the frame the shot is of */
    const outline = async () => page.evaluate(() => {
      const sc = window.__feel.scene, g = sc.carModel().underglow, THREE = sc.THREE, v = new THREE.Vector3();
      g.geometry.computeBoundingBox(); g.updateWorldMatrix(true, false); sc.camera.updateMatrixWorld();
      const b = g.geometry.boundingBox;
      return [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]].map(([x, z]) => { v.set(x, b.max.y, z).applyMatrix4(g.matrixWorld).project(sc.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
    });
    const polyMask = (poly, img, scale) => {
      const m = new Uint8Array(img.w * img.h), P = poly.map(([x, y]) => [x * scale, y * scale]);
      const inside = (x, y) => { let sign = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); } } return true; };
      let n = 0;
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (inside(x + 0.5, y + 0.5)) { m[y * img.w + x] = 1; n++; }
      return { m, n, w: img.w, h: img.h };
    };
    await G.wear(page, { glow: 'aqua' }); await G.midSlide(page, 0, 2, 16); await G.snap(page, path.join(G.shots, 'tmp.png'));
    const poly = await outline();
    const regions = { wheels: G.grow(G.diffMask(base, noWheels, 0), GROW), smoke: G.grow(G.diffMask(base, noSmoke, 0), GROW), glow: G.grow(polyMask(poly, base, base.w / 844), GROW) };
    out.rows.push({ where: tag, item: 'regions', wheels: regions.wheels.n, smoke: regions.smoke.n, glow: regions.glow.n });
    console.log('  ' + tag + ': the wheels cover ' + regions.wheels.n + ' pixels, the smoke ' + regions.smoke.n + ', the glow\'s outline ' + regions.glow.n);
    for (const kind of Object.keys(KINDS)) {
      const imgs = {};
      for (const id of KINDS[kind]) {
        const img = imgs[id] = await frame({ [kind]: id }, path.join(G.shots, 'race-' + preset + '-' + kind + '-' + id + '.png'));
        const d = G.diffMask(img, base, 3), off = G.outside(d, regions[kind]);
        out.rows.push({ where: tag, kind, item: id, differs: d.n, outside: off });
        G.say(d.n >= MIN[kind] && off === 0, tag + ' ' + kind + ' ' + id + ': differs from the standard in ' + d.n + ' pixels (bar ' + MIN[kind] + '), ' + off + ' of them outside where ' + kind + ' is drawn');
        if (kind === 'smoke') {
          const a = img.smoke, b = base.smoke, sameSmoke = a.n === b.n && a.ps === b.ps && a.as === b.as && a.heat === b.heat;
          out.rows.push({ where: tag, kind, item: id, smoke: a, standard: b, sameSmoke });
          G.say(sameSmoke && a.n > 20, tag + ' smoke ' + id + ': the smoke is the standard smoke to the last puff: ' + a.n + ' puffs alive against ' + b.n + ', the same places and sizes (sum ' + a.ps.toFixed(3) + ' against ' + b.ps.toFixed(3) + '), the same strengths (' + a.as.toFixed(3) + ' against ' + b.as.toFixed(3) + '), the same heat');
        }
      }
      if (kind === 'smoke') {
        const thin = await frame({ smoke: 'rose' }, null, null, 0.5);
        await page.evaluate(() => { window.__feel.scene.effects().setDensity(1); });
        const caught = !(thin.smoke.n === base.smoke.n && thin.smoke.ps === base.smoke.ps);
        out.known.push({ where: tag, kind: 'smoke', what: 'effects at half', puffs: thin.smoke.n, standard: base.smoke.n, caught });
        G.say(caught, tag + ' smoke known answer: with the effects thinned to half there are ' + thin.smoke.n + ' puffs against ' + base.smoke.n + ': ' + (caught ? 'CAUGHT' : 'MISSED'));
      }
      const worst = pairs(kind, imgs, regions[kind], tag);
      G.say(worst.pixels >= PAIR[kind], tag + ' ' + kind + ': every pair differs; the closest are ' + worst.a + ' and ' + worst.b + ' by ' + worst.pixels + ' pixels (bar ' + PAIR[kind] + ')');
      /* the known answer: the second item given the first one's look */
      await page.evaluate('(' + TWIN + ')(true)');
      const [a, b] = SECOND[kind], twin = await frame({ [kind]: b });
      await page.evaluate('(' + TWIN + ')(false)');
      const d = G.difference(imgs[a], twin, regions[kind], 24), caught = d.big < PAIR[kind];
      out.known.push({ where: tag, kind, a, b, pixels: d.big, caught });
      G.say(caught, tag + ' ' + kind + ' known answer: ' + b + ' given the look of ' + a + ' differs from it in ' + d.big + ' pixels: ' + (caught ? 'CAUGHT' : 'MISSED'));
    }
    /* the known answer for "nowhere else": a glow three times as wide as its outline */
    const wide = await frame({ glow: 'aqua' }, null, () => { window.__feel.scene.carModel().underglow.scale.set(3, 1, 3); });
    const dw = G.diffMask(wide, base, 3), offW = G.outside(dw, regions.glow);
    out.known.push({ where: tag, kind: 'glow', what: 'three times as wide', outside: offW, caught: offW > 0 });
    G.say(offW > 0, tag + ' known answer: a glow three times as wide as its outline has ' + offW + ' pixels outside it: ' + (offW > 0 ? 'CAUGHT' : 'MISSED'));
    if (pg.errors.length) G.say(false, 'page errors: ' + pg.errors.slice(0, 2).join(' | '));
    await pg.close();
  }
  try { fs.unlinkSync(path.join(G.shots, 'tmp.png')); } catch (e) { /* none */ }
} else {
  const VP = { width: 1280, height: 720 }, pg = await G.emptyPage(env, VP, ''), page = pg.page;
  const frame = async (kind, id, file) => {
    await page.evaluate(({ kind, id }) => {
      const L = window.__loop; window.__feel.draw = false; window.__clock = 1000;   /* the same clock each time, so each frame's length is the same to the last bit */
      L.save.state.coins = 0; L.action('garage'); L.action('garage-tab', kind || 'wheels'); if (id) L.action('look', kind + ':' + id);
      const s = L.showroom.state; s.angle = 4.1; s.dragging = true;
    }, { kind, id });
    await G.seedRandom(page, 7);
    await G.runFrames(page, kind === 'smoke' ? 150 : 4);
    const png = await G.snap(page, file || path.join(G.shots, 'tmp.png'));
    return G.decode(png);
  };
  const stage = await page.evaluate(() => { window.__loop.action('garage'); const r = document.querySelector('.garage .stage').getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; });
  for (const kind of Object.keys(KINDS)) {
    const base = await frame(kind, null, path.join(G.shots, 'showroom-' + kind + '-standard.png')), again = await frame(kind, null);
    const region = { m: new Uint8Array(base.w * base.h), w: base.w, h: base.h };
    for (let y = Math.ceil(stage.y0); y < Math.floor(stage.y1); y++) for (let x = Math.ceil(stage.x0); x < Math.floor(stage.x1); x++) region.m[y * base.w + x] = 1;
    const same = G.difference(base, again, region, 0);
    G.say(same.big === 0, 'showroom ' + kind + ': the standard drawn twice is the same picture inside the stage (' + same.big + ' pixels differ)');
    const imgs = {};
    for (const id of KINDS[kind]) {
      const img = imgs[id] = await frame(kind, id, path.join(G.shots, 'showroom-' + kind + '-' + id + '.png'));
      const d = G.difference(img, base, region, 3);
      out.rows.push({ where: 'showroom', kind, item: id, differs: d.big });
      G.say(d.big >= MIN[kind] * 4, 'showroom ' + kind + ' ' + id + ': the preview differs from the standard in ' + d.big + ' pixels of the stage (bar ' + MIN[kind] * 4 + ')');
    }
    const worst = pairs(kind, imgs, region, 'showroom');
    G.say(worst.pixels >= PAIR[kind] * 4, 'showroom ' + kind + ': every pair differs; the closest are ' + worst.a + ' and ' + worst.b + ' by ' + worst.pixels + ' pixels (bar ' + PAIR[kind] * 4 + ')');
    await page.evaluate('(' + TWIN + ')(true)');
    const [a, b] = SECOND[kind], twin = await frame(kind, b);
    await page.evaluate('(' + TWIN + ')(false)');
    const d = G.difference(imgs[a], twin, region, 24), caught = d.big < PAIR[kind] * 4;
    out.known.push({ where: 'showroom', kind, a, b, pixels: d.big, caught });
    G.say(caught, 'showroom ' + kind + ' known answer: ' + b + ' given the look of ' + a + ' differs from it in ' + d.big + ' pixels: ' + (caught ? 'CAUGHT' : 'MISSED'));
  }
  if (pg.errors.length) G.say(false, 'page errors: ' + pg.errors.slice(0, 2).join(' | '));
  await pg.close();
  try { fs.unlinkSync(path.join(G.shots, 'tmp.png')); } catch (e) { /* none */ }
}
fs.writeFileSync(path.join(G.dir, 'looks-' + part + '.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(G.failed() ? G.failed() + ' failed' : 'all passed');
process.exit(G.failed() ? 1 : 0);
