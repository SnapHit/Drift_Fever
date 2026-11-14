/* SHARED BY THE PARK PROBES (briefs/PLAYGROUND.md). The garage round's
   harness (headless Chromium through the dev server, the frame loop
   stubbed, the page advanced at a synthetic 60 Hz), writing to
   review/park/, plus what this round needs: the scripted hands
   (hands.js) and their lines (lines.js) handed to the page, a line
   driven through the real game (free drift started by its own action,
   the hands set as its driver, the game's own judge and save doing the
   counting and the paying), and every physics step of the drive
   recorded so the counts can be made again in Node by other means. */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as G from '../garage/lib.js';

export * from '../garage/lib.js';
const here = path.dirname(fileURLToPath(import.meta.url));
export const dir = path.join(G.root, 'review', 'park');
export const shots = path.join(dir, 'shots');
fs.mkdirSync(shots, { recursive: true });
export const SIZES = [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 800, height: 450 }, { width: 1280, height: 720 }];
export const tag = vp => vp.width + 'x' + vp.height;

let fails = 0;
export const say = (pass, msg) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + msg); return pass; };
export const failed = () => fails;
export const finish = async (env, file, out) => { if (file) fs.writeFileSync(path.join(dir, file), JSON.stringify(out, null, 1)); if (env) await env.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0); };

/* a page on the title with an empty save, the park's time of day fixed (dusk unless asked) */
export async function parkPage(env, vp, query, opts) {
  const pg = await G.openPage(env, vp || G.LANDSCAPE, (query && /preset=/.test(query) ? '' : 'preset=dusk&') + (query || '') + '&title=1', opts);
  await pg.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); S.setOnboarded(); window.__loop.action('title'); });
  await loadHands(pg.page);
  return pg;
}
/* the hands, their lines and the game's own modules, as window.__hands in the page */
export async function loadHands(page) {
  const hs = fs.readFileSync(path.join(here, 'hands.js'), 'utf8'), ls = fs.readFileSync(path.join(here, 'lines.js'), 'utf8');
  await page.evaluate(async ({ hs, ls }) => {
    const mod = src => import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    const H = await mod(hs), L = await mod(ls), V = await import('/src/physics/vehicle.js'), P = await import('/src/park/layout.js'), C = await import('/src/park/challenges.js');
    window.__hands = { H, V, P, C, lines: L.parkLines(P.PARK, H), deps: { stepVehicle: V.stepVehicle, STEP: V.STEP, bodyPoints: V.bodyPoints, wallGap: P.wallGap } };
  }, { hs, ls });
}
/* the car the next drive is made in: bought and upgraded through the save's own calls, and chosen */
export async function ownCar(page, car, up) {
  await page.evaluate(({ car, up }) => {
    const S = window.__loop.save;
    const coins = S.state.coins; S.state.coins = 999999;
    if (!S.state.cars[car]) S.buyCar(car, 0);
    for (const k of ['power', 'grip', 'steer']) for (let i = (S.state.cars[car].up || {})[k] || 0; i < ((up || {})[k] || 0); i++) S.buyUpgrade(car, k);
    S.chooseCar(car); S.state.coins = coins; S.write();
  }, { car, up: up || null });
}

/* DRIVE A LINE in the park, through the game. o: { line (a name in
   lines.js), args, hands (overrides of HANDS), seconds (the most),
   tail (s driven on after the line's end, so a chain banks), meddle (a
   known answer: a function source (h, world, out, t, mem) run on the
   hands' output every step), each (a function source (F, Lp, i) run
   after every frame; what it returns is collected as frames), keep (do
   not start the park again), noRec (do not send the recording back) }.
   Returns the judge's best and levels, what the save paid, the world's
   contacts, and rec: every physics step as [x, z, yaw, speed, slip
   (rad), vx > 0, touching, hard hit, cones knocked, then the judge's
   eight counts]. */
export async function drive(page, o) {
  return page.evaluate(o => {
    const Lp = window.__loop, F = window.__feel, R = window.__hands;
    F.draw = false; if (window.__clock === undefined) window.__clock = 1000;
    const coins0 = Lp.save.state.coins, won0 = JSON.stringify(Lp.save.state.park.won);
    if (!o.keep) Lp.action('free');
    const made = R.lines[o.line](...(o.args || []));
    const path = Array.isArray(made) ? made : made.path;
    const hands = R.H.createHands(R.deps, Lp.app.ground, path, Object.assign({}, made.flick ? { flick: made.flick } : {}, o.hands || {}));
    const meddle = o.meddle ? new Function('h', 'world', 'out', 't', 'mem', o.meddle) : null, mem = {};
    const J = Lp.park().state, ids = R.C.CHALLENGES.map(c => c.id), rec = [];
    let hard = 0;
    Lp.app.driver = { input(world) {
      const c = world.car;
      if (world.step > 0) rec.push([c.x, c.z, c.yaw, c.speed, c.slip, c.vx > 0 ? 1 : 0, world.touching ? 1 : 0, world.hardHits > hard ? 1 : 0, world.conesKnocked, ...ids.map(id => J.value[id])]);
      hard = world.hardHits;
      const out = hands.input(world);
      if (meddle) meddle(hands, world, out, world.time, mem);
      return out;
    } };
    const each = o.each ? new Function('F', 'Lp', 'i', o.each) : null, frameRows = [];
    const maxF = Math.round((o.seconds || 60) * 60), tail = Math.round((o.tail === undefined ? 2.5 : o.tail) * 60);
    let after = 0, frames = 0;
    for (; frames < maxF; frames++) {
      window.__clock += 1000 / 60; F.frame(window.__clock);
      if (each) { const r = each(F, Lp, frames); if (r !== undefined) frameRows.push(r); }
      if (hands.done && ++after > tail) break;
      if (Lp.app.state !== 'free') break;
    }
    Lp.app.driver = null;
    const w = F.world;
    return { line: o.line, args: o.args || [], car: Lp.save.state.car, up: Lp.save.state.cars[Lp.save.state.car].up, seconds: +(frames / 60).toFixed(1), done: hands.done, guard: hands.guard, state: Lp.app.state,
      best: Object.assign({}, J.best), level: Object.assign({}, J.level), events: J.events.map(e => ({ id: e.id, level: e.level, value: +e.value.toFixed(1) })),
      hits: w.hits, hardHits: w.hardHits, cones: w.conesKnocked, coins: Lp.save.state.coins - coins0, wonBefore: JSON.parse(won0), won: Object.assign({}, Lp.save.state.park.won), rec: o.noRec ? [] : rec, frames: frameRows };
  }, o);
}
/* the park's ground as the game has it, for the independent counts */
export const groundOf = page => page.evaluate(() => { const g = window.__loop.app.ground; return { bounds: g.bounds, start: g.start, cones: g.cones, park: g.park, walls: g.walls.map(w => ({ place: w.place, kind: w.kind, side: w.side, points: w.points.map(p => [p.x, p.z]) })) }; });
