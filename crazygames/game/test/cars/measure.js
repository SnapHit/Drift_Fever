/* THE CAR MEASUREMENTS THAT NEED NO BROWSER. Builds every car with the
   pinned three.js package (the same 0.184.0 the game bundles) and
   measures what was built, not what the numbers say should have been:

   1. Triangles, draw calls (one per material group per mesh) and
      materials per car, against 800 to 3,000 triangles; code size per
      car, raw and gzipped, against the 100 KB the brief allows for all
      five.
   2. Dimensions within sensible ranges for the class, the starter
      inside the physics' box, the wheels touching the ground plane and
      nothing else below it, the tyres clear of the body and inside its
      width, the car facing -Z with its origin at the middle of the
      wheelbase, and every part closed with its faces outwards.

   Every check has a known answer: a deliberately broken car (or file)
   that the same check must fail. A probe that passes its broken case
   is a defect of the probe, and the run fails.

   node game/test/cars/measure.js     writes review/cars/measure.json */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as THREE from 'three';
import { createCar, CARS, carSpec } from '../../src/cars/index.js';
import { buildCar } from '../../src/cars/build.js';
import { TUNE } from '../../src/tune.js';
import { root, reviewDir, writeJson } from './lib.js';

const carsDir = path.join(root, 'game', 'src', 'cars');
const V = TUNE.VEHICLE;
const clone = o => JSON.parse(JSON.stringify(o));
const build = (spec, opts) => buildCar(THREE, spec, opts || {});
const r3 = v => Math.round(v * 1000) / 1000;

/* ---- 1. counts ---- */

function counts(car) {
  let triangles = 0, drawCalls = 0;
  const mats = new Set();
  car.group.updateMatrixWorld(true);
  car.group.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    let v = o.parent; while (v) { if (!v.visible) return; v = v.parent; }
    const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count;
    if (Array.isArray(o.material)) {
      // the renderer draws one call per group; every vertex must be in exactly one
      let covered = 0;
      for (const gr of g.groups) { drawCalls++; covered += gr.count; mats.add(o.material[gr.materialIndex]); }
      if (covered !== n) throw new Error(o.name + ': groups cover ' + covered + ' of ' + n);
    } else { drawCalls++; mats.add(o.material); }
    triangles += n / 3;
  });
  return { triangles, drawCalls, materials: mats.size };
}

function codeSize(files) {
  let raw = 0, gz = 0;
  for (const f of files) { const b = fs.readFileSync(f); raw += b.length; gz += zlib.gzipSync(b, { level: 9 }).length; }
  return { raw, gzip: gz };
}

/* ---- 2. shape ---- */

/* World positions of every vertex of the meshes under obj (skipping the
   underglow, which is light on the ground, not a part of the car). */
function vertices(car, filter) {
  const out = [], v = new THREE.Vector3();
  car.group.updateMatrixWorld(true);
  car.group.traverse(o => {
    if (!o.isMesh || o === car.underglow || (filter && !filter(o))) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); out.push([v.x, v.y, v.z]); }
  });
  return out;
}
const isWheel = car => o => Object.values(car.wheels).some(w => w.mesh === o);

/* Each wheel as built: its axle position, tyre radius and half width
   from its own vertices, and its lowest point. */
function wheels(car) {
  car.group.updateMatrixWorld(true);
  const out = {};
  for (const [name, w] of Object.entries(car.wheels)) {
    const p = w.mesh.geometry.attributes.position;
    let R = 0, hw = 0;
    for (let i = 0; i < p.count; i++) { R = Math.max(R, Math.hypot(p.getY(i), p.getZ(i))); hw = Math.max(hw, Math.abs(p.getX(i))); }
    const centre = new THREE.Vector3().setFromMatrixPosition(w.mesh.matrixWorld);
    let low = Infinity; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(w.mesh.matrixWorld); low = Math.min(low, v.y); }
    out[name] = { x: centre.x, y: centre.y, z: centre.z, R, hw, low };
  }
  return out;
}

/* The lowest point of each wheel over a whole turn, worst case: the
   polygon's flats lift it a little between vertices. */
function wheelsOverATurn(car, steps) {
  let worstHigh = -Infinity, worstLow = Infinity;
  for (let s = 0; s < steps; s++) {
    for (const w of Object.values(car.wheels)) w.mesh.rotation.x = 2 * Math.PI * s / steps;
    for (const w of Object.values(wheels(car))) { worstHigh = Math.max(worstHigh, w.low); worstLow = Math.min(worstLow, w.low); }
  }
  for (const w of Object.values(car.wheels)) w.mesh.rotation.x = 0;
  return { highest: worstHigh, lowest: worstLow };
}

/* Points of the body (every vertex, every face's middle and every edge's
   middle) inside a tyre's cylinder: the tyre would show through. */
function bodyInTyres(car, steer) {
  for (const k of ['fl', 'fr']) car.wheels[k].pivot.rotation.y = steer || 0;
  car.group.updateMatrixWorld(true);
  const W = wheels(car);
  const inv = Object.fromEntries(Object.entries(car.wheels).map(([k, w]) => [k, new THREE.Matrix4().copy(w.mesh.matrixWorld).invert()]));
  let hits = 0, worst = 0;
  const v = new THREE.Vector3();
  car.group.traverse(o => {
    if (!o.isMesh || o === car.underglow || isWheel(car)(o)) return;
    const p = o.geometry.attributes.position;
    const pts = [];
    for (let i = 0; i < p.count; i += 3) {
      const a = [p.getX(i), p.getY(i), p.getZ(i)], b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], c = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
      pts.push(a, b, c, a.map((_, j) => (a[j] + b[j] + c[j]) / 3), a.map((_, j) => (a[j] + b[j]) / 2), a.map((_, j) => (b[j] + c[j]) / 2), a.map((_, j) => (a[j] + c[j]) / 2));
    }
    for (const q of pts) {
      v.set(q[0], q[1], q[2]).applyMatrix4(o.matrixWorld);
      for (const k in car.wheels) {
        const w = W[k], l = v.clone().applyMatrix4(inv[k]);
        const r = Math.hypot(l.y, l.z), depth = Math.min(w.R - r, w.hw - Math.abs(l.x));
        if (depth > 0.002) { hits++; worst = Math.max(worst, depth); }
      }
    }
  });
  for (const k of ['fl', 'fr']) car.wheels[k].pivot.rotation.y = 0;
  return { hits, worst };
}

/* The body's half width at a station, from its own vertices. */
function bodyHalfWidthAt(car, z) {
  let w = 0;
  for (const p of vertices(car, o => o === car.body)) if (Math.abs(p[2] - z) < 0.15) w = Math.max(w, Math.abs(p[0]));
  return w;
}
function roofTop(car) { let y = 0; const zs = [carSpec(car.id) ? carSpec(car.id).screen[1] : -1, carSpec(car.id) ? carSpec(car.id).roof.end : 1]; for (const p of vertices(car, o => o === car.body)) if (p[2] > zs[0] && p[2] < zs[1]) y = Math.max(y, p[1]); return y; }
function centroidZ(mesh) { mesh.geometry.computeBoundingBox(); const b = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld); return (b.min.z + b.max.z) / 2; }

/* Signed volume of each part: positive when its faces point outwards. */
function partVolumes(car) {
  return car.parts.map(p => {
    let v = 0; const a = p.p;
    for (let i = 0; i < a.length; i += 9) v += (a[i] * (a[i + 4] * a[i + 8] - a[i + 5] * a[i + 7]) - a[i + 1] * (a[i + 3] * a[i + 8] - a[i + 5] * a[i + 6]) + a[i + 2] * (a[i + 3] * a[i + 7] - a[i + 4] * a[i + 6])) / 6;
    return { name: p.name, volume: v };
  });
}
function wheelVolumes(car) {
  return Object.entries(car.wheels).map(([k, w]) => {
    const a = w.mesh.geometry.attributes.position.array; let v = 0;
    for (let i = 0; i < a.length; i += 9) v += (a[i] * (a[i + 4] * a[i + 8] - a[i + 5] * a[i + 7]) - a[i + 1] * (a[i + 3] * a[i + 8] - a[i + 5] * a[i + 6]) + a[i + 2] * (a[i + 3] * a[i + 7] - a[i + 4] * a[i + 6])) / 6;
    return { name: 'wheel ' + k, volume: v };
  });
}

/* ---- the checks, each a function of a built car, so a broken car can be fed through the same code ---- */

const GENERAL = {
  length: [3.6, 4.9], width: [1.6, 2.0], height: [1.1, 1.5], wheelbase: [2.2, 2.95], track: [1.4, 1.75], wheelRadius: [0.28, 0.38],
  wheelbaseShare: [0.55, 0.66], overhang: [0.55, 1.15],
};
const CLASS = {
  starter: 'inside the physics box (4.40 by 1.84, centred 0.025 m ahead of the wheelbase middle), wheelbase, track and wheel radius exactly the physics values',
  hatch: 'length 3.6 to 3.9 m, wheelbase 2.2 to 2.45 m: the shortest of the five',
  tourer: 'length 4.6 to 4.9 m, width at least 1.9 m, wheelbase at least 2.75 m: the longest wheelbase of the five',
  fastback: 'length 4.5 to 4.9 m, rear tyres at least 40 mm wider than the fronts, body at least 60 mm wider at the rear axle than the front',
  driftbuild: 'roof at most 1.22 m, the lowest of the five; width at least 1.95 m; a wing at least 50 mm above the roof',
};

function shapeChecks(car, ctx) {
  const id = ctx.as || car.id, d = car.dims, W = wheels(car), out = [];
  const add = (name, value, ok, limit) => out.push({ name, value, limit, pass: !!ok });
  const inR = (v, r) => v >= r[0] - 1e-9 && v <= r[1] + 1e-9;
  // measured from the wheels, not read back from dims
  const wb = ((W.rl.z + W.rr.z) - (W.fl.z + W.fr.z)) / 2, tr = ((W.fr.x - W.fl.x) + (W.rr.x - W.rl.x)) / 2;
  const R = Math.max(...Object.values(W).map(w => w.R));
  const fOver = -(d.centreZ - d.halfLength) - (-(W.fl.z + W.fr.z) / 2), rOver = (d.centreZ + d.halfLength) - (W.rl.z + W.rr.z) / 2;
  add('length m', r3(d.length), inR(d.length, GENERAL.length), GENERAL.length);
  add('width m', r3(d.width), inR(d.width, GENERAL.width), GENERAL.width);
  add('height m', r3(d.height), inR(d.height, GENERAL.height), GENERAL.height);
  add('wheelbase m (measured from the wheels)', r3(wb), inR(wb, GENERAL.wheelbase), GENERAL.wheelbase);
  add('track m (measured)', r3(tr), inR(tr, GENERAL.track), GENERAL.track);
  add('wheel radius m (measured)', r3(R), inR(R, GENERAL.wheelRadius), GENERAL.wheelRadius);
  add('wheelbase as a share of length', r3(wb / d.length), inR(wb / d.length, GENERAL.wheelbaseShare), GENERAL.wheelbaseShare);
  add('front overhang m', r3(fOver), inR(fOver, GENERAL.overhang), GENERAL.overhang);
  add('rear overhang m', r3(rOver), inR(rOver, GENERAL.overhang), GENERAL.overhang);
  add('dims agree with the wheels (wheelbase, track, radius within 1 mm)', r3(Math.max(Math.abs(wb - d.wheelbase), Math.abs(tr - d.track), Math.abs(R - d.wheelRadius))),
    Math.abs(wb - d.wheelbase) < 0.001 && Math.abs(tr - d.track) < 0.001 && Math.abs(R - d.wheelRadius) < 0.001, '< 0.001');

  // the class
  if (id === 'starter') {
    const zc = -V.WHEELBASE / 2 + V.CG_TO_FRONT;          // the collision box sits on the centre of mass: front axle plus CG_TO_FRONT
    const ok = d.length <= 2 * V.HALF_LENGTH + 1e-4 && d.width <= 2 * V.HALF_WIDTH + 1e-4 && Math.abs(d.centreZ - zc) < 0.005
      && Math.abs(wb - V.WHEELBASE) < 0.001 && Math.abs(tr - V.TRACK) < 0.001 && Math.abs(R - V.WHEEL_RADIUS) < 0.001;
    add('class: ' + CLASS.starter, { length: r3(d.length), width: r3(d.width), centreZ: r3(d.centreZ), wheelbase: r3(wb), track: r3(tr), radius: r3(R) }, ok, 'TUNE.VEHICLE');
  } else if (id === 'hatch') {
    add('class: ' + CLASS.hatch, { length: r3(d.length), wheelbase: r3(wb), shortest: ctx.shortest === car.id }, inR(d.length, [3.6, 3.9]) && inR(wb, [2.2, 2.45]) && ctx.shortest === car.id, 'as stated');
  } else if (id === 'tourer') {
    add('class: ' + CLASS.tourer, { length: r3(d.length), width: r3(d.width), wheelbase: r3(wb), longest: ctx.longestWb === car.id }, inR(d.length, [4.6, 4.9]) && d.width >= 1.9 && wb >= 2.75 && ctx.longestWb === car.id, 'as stated');
  } else if (id === 'fastback') {
    const wf = bodyHalfWidthAt(car, (W.fl.z + W.fr.z) / 2), wr = bodyHalfWidthAt(car, (W.rl.z + W.rr.z) / 2);
    const tf = W.fl.hw * 2, trr = W.rl.hw * 2;
    add('class: ' + CLASS.fastback, { length: r3(d.length), tyreFront: r3(tf), tyreRear: r3(trr), bodyFront: r3(2 * wf), bodyRear: r3(2 * wr) }, inR(d.length, [4.5, 4.9]) && trr - tf >= 0.04 - 1e-9 && 2 * (wr - wf) >= 0.06, 'as stated');
  } else if (id === 'driftbuild') {
    const roof = roofTop(car);
    add('class: ' + CLASS.driftbuild, { roof: r3(roof), width: r3(d.width), height: r3(d.height), lowest: ctx.lowest === car.id }, roof <= 1.22 && ctx.lowest === car.id && d.width >= 1.95 && d.height - roof >= 0.05, 'as stated');
  }

  // the ground
  const lows = Object.values(W).map(w => w.low);
  add('wheels touching the ground at rest: lowest point of each wheel, worst m', r3(Math.max(...lows.map(Math.abs))), lows.every(l => Math.abs(l) <= 0.002), '|y| <= 0.002');
  const turn = wheelsOverATurn(car, 360);
  const S = Math.min(...Object.values(car.wheels).map(() => carSpec(id) ? carSpec(id).wheel.segments : 12));
  const flat = R * (1 - Math.cos(Math.PI / S));
  add('over a whole turn: a wheel never sinks, and lifts no more than its polygon allows (m)', { highest: r3(turn.highest), lowest: r3(turn.lowest), polygonAllows: r3(flat) }, turn.lowest >= -0.002 && turn.highest <= flat + 0.002, 'lowest >= -0.002, highest <= R(1 - cos(pi/S)) + 0.002');
  let lowest = Infinity; for (const p of vertices(car, o => !isWheel(car)(o))) lowest = Math.min(lowest, p[1]);
  add('nothing but the tyres below 50 mm (lowest body point m)', r3(lowest), lowest >= 0.05, '>= 0.05');

  // the tyres and the body
  const clash = bodyInTyres(car, 0);
  add('body points inside a tyre, wheels straight', clash.hits, clash.hits === 0, 0);
  const tuck = Object.entries(W).map(([k, w]) => (Math.abs(w.x) + w.hw) - bodyHalfWidthAt(car, w.z));
  add('tyres inside the body width: worst tyre face past the body side (m)', r3(Math.max(...tuck)), Math.max(...tuck) <= 0.005, '<= 0.005');

  // facing and origin
  const hz = centroidZ(car.lights.head), tz = centroidZ(car.lights.tail);
  add('facing -Z: headlights ahead of the front axle, tail lights behind the rear', { head: r3(hz), tail: r3(tz), frontAxle: r3((W.fl.z + W.fr.z) / 2) }, hz < (W.fl.z + W.fr.z) / 2 && tz > (W.rl.z + W.rr.z) / 2 && (W.fl.z + W.fr.z) < 0, 'head < front axle < 0 < rear axle < tail');
  const ox = Object.values(W).reduce((s, w) => s + w.x, 0) / 4, oz = Object.values(W).reduce((s, w) => s + w.z, 0) / 4;
  add('origin at the middle of the wheelbase on the ground (m)', { x: r3(ox), z: r3(oz) }, Math.abs(ox) < 0.001 && Math.abs(oz) < 0.001, '< 0.001');

  // closed and outwards
  if (car.parts) {
    const vols = [...partVolumes(car), ...wheelVolumes(car)];
    const bad = vols.filter(p => !(p.volume > 0));
    add('every part closed with its faces outwards (signed volume > 0)', { parts: vols.length, inverted: bad.map(b => b.name) }, bad.length === 0, 'all > 0');
  }
  return out;
}

/* ---- the run ---- */

const result = { when: new Date().toISOString(), three: THREE.REVISION, cars: {}, knownAnswers: [], code: {} };
const built = Object.fromEntries(CARS.map(c => [c.id, createCar(THREE, c.id, { debug: true })]));
const ctx = {
  shortest: CARS.map(c => c.id).sort((a, b) => built[a].dims.length - built[b].dims.length)[0],
  longestWb: CARS.map(c => c.id).sort((a, b) => built[b].dims.wheelbase - built[a].dims.wheelbase)[0],
  lowest: CARS.map(c => c.id).sort((a, b) => roofTop(built[a]) - roofTop(built[b]))[0],
};

const TRI = [800, 3000];
const shared = ['build.js', 'index.js'].map(f => path.join(carsDir, f));
for (const c of CARS) {
  const car = built[c.id];
  const n = counts(car);
  car.setUnderglow(0xffffff);
  const g = counts(car);
  car.setUnderglow(null);
  const own = codeSize([path.join(carsDir, c.id + '.js')]);
  const checks = [
    { name: 'triangles', value: n.triangles, limit: TRI, pass: n.triangles >= TRI[0] && n.triangles <= TRI[1] },
    { name: 'draw calls (underglow off)', value: n.drawCalls, limit: '<= 12', pass: n.drawCalls <= 12 },
    { name: 'materials', value: n.materials, limit: '<= 6', pass: n.materials <= 6 },
  ];
  checks.push(...shapeChecks(car, ctx));
  result.cars[c.id] = { label: c.label, dims: Object.fromEntries(Object.entries(car.dims).map(([k, v]) => [k, r3(v)])), triangles: n.triangles, drawCalls: n.drawCalls, materials: n.materials,
    withUnderglow: { triangles: g.triangles, drawCalls: g.drawCalls }, ownCode: own, roof: r3(roofTop(car)),
    tyresAtFullLock: bodyInTyres(car, V.LOCK * Math.PI / 180), checks };
}
const all = codeSize([...shared, ...CARS.map(c => path.join(carsDir, c.id + '.js'))]);
result.code = { shared: codeSize(shared), all, limit: 100 * 1024, pass: all.raw < 50 * 1024 };

/* ---- known answers: each must FAIL the check it is aimed at ---- */
function known(name, check, expectFail, note) {
  const failed = !check.pass;
  result.knownAnswers.push({ name, check: check.name, expect: expectFail ? 'fail' : 'pass', got: failed ? 'fail' : 'pass', value: check.value, caught: failed === expectFail, note });
}
const find = (checks, prefix) => checks.find(c => c.name.startsWith(prefix));

// counts: a car with one more 12 triangle box in a new material must count 12 more and one more call
{
  const car = createCar(THREE, 'starter');
  const before = counts(car);
  car.group.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()));
  const after = counts(car);
  known('counter: a 12 triangle box in its own material added to the starter', { name: 'counts +12 triangles, +1 call, +1 material', value: [after.triangles - before.triangles, after.drawCalls - before.drawCalls, after.materials - before.materials], pass: after.triangles - before.triangles === 12 && after.drawCalls - before.drawCalls === 1 && after.materials - before.materials === 1 }, false, 'the known answer is +12, +1, +1: a counter that misses the box or counts it wrongly fails here');
}
// the triangle budget: the tourer lofted at 50 mm stations is far over 3,000
{
  const s = clone(carSpec('tourer')); s.spacing = 0.05; s.archSteps = 20;
  const n = counts(build(s));
  known('budget: the tourer with stations every 50 mm', { name: 'triangles', value: n.triangles, pass: n.triangles >= TRI[0] && n.triangles <= TRI[1] }, true);
}
// code size: the counter adds exactly what is appended, and three.js as car code is over the limit
{
  const tmp = path.join(reviewDir, '.size-probe.js');
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.copyFileSync(path.join(carsDir, 'build.js'), tmp);
  const a = codeSize([tmp]).raw;
  fs.appendFileSync(tmp, 'x'.repeat(10000));
  const b = codeSize([tmp]).raw;
  fs.unlinkSync(tmp);
  known('code size: 10,000 bytes appended to a copy of build.js', { name: 'size grows by exactly 10,000', value: b - a, pass: b - a === 10000 }, false, 'the known answer is 10,000: a counter that reads anything else fails here');
  const big = codeSize([...shared, path.join(root, 'public', 'vendor', 'three.webgpu.min.js')]);
  known('code size: three.js counted as if it were car code', { name: 'all five under 50 KB raw', value: big.raw, pass: big.raw < 50 * 1024 }, true);
}
// the ground: wheels moved up 30 mm, and down 30 mm
for (const dy of [0.03, -0.03]) {
  const car = createCar(THREE, 'starter');
  for (const w of Object.values(car.wheels)) w.pivot.position.y += dy;
  known('ground: the starter with its wheels moved ' + (dy > 0 ? 'up' : 'down') + ' 30 mm', find(shapeChecks(car, ctx), 'wheels touching the ground'), true);
}
// the ground over a turn: a wheel built with 6 segments lifts far more than a 15 segment one may
{
  const s = clone(carSpec('starter')); s.wheel.segments = 6; s.wheel.spokes = 3; s.wheel.spokeShare = 0.5;
  known('ground over a turn: the starter judged as 15 segment wheels but built with 6', find(shapeChecks(build(s), { ...ctx, as: 'starter' }), 'over a whole turn'), true, 'the 6 segment wheel lifts R(1 - cos 30 deg) = 44 mm between vertices');
}
// the body below 50 mm: the drift build's splitter dropped to 20 mm
{
  const s = clone(carSpec('driftbuild')); s.extras.find(e => e.type === 'splitter').y = 0.02;
  known('ground: the drift build with its splitter at 20 mm', find(shapeChecks(build(s), { ...ctx, as: 'driftbuild' }), 'nothing but the tyres'), true);
}
// ranges: a stretched starter is too long, a narrow track is too narrow
{
  const s = clone(carSpec('starter')); s.dims.length = 5.2;
  known('ranges: the starter stretched to 5.2 m', find(shapeChecks(build(s), { ...ctx, as: 'hatch' }), 'length m'), true);
  const t = clone(carSpec('hatch')); t.dims.track = 1.2;
  known('ranges: the hatch on a 1.2 m track', find(shapeChecks(build(t), { ...ctx, as: 'hatch' }), 'track m'), true);
}
// the class: the starter 60 mm too wide for the physics box, and the wheelbase 50 mm long
{
  const s = clone(carSpec('starter')); s.halfWidth += 0.03;
  known('class: the starter 60 mm wider than the physics box', find(shapeChecks(build(s), ctx), 'class:'), true);
  const t = clone(carSpec('starter')); t.dims.wheelbase = 2.6;
  known('class: the starter on a 2.60 m wheelbase', find(shapeChecks(build(t), ctx), 'class:'), true);
  const f = clone(carSpec('fastback')); f.dims.tyre = [0.27, 0.27]; f.flare.rear.amount = 0.0;
  known('class: the fastback with no hips and equal tyres', find(shapeChecks(build(f), ctx), 'class:'), true);
  const d = clone(carSpec('driftbuild')); d.extras = d.extras.filter(e => e.type !== 'wing');
  known('class: the drift build without its wing', find(shapeChecks(build(d), ctx), 'class:'), true);
}
// the tyres: 80 mm bigger wheels hit the arches; a 120 mm wider track pokes out of the body
{
  const s = clone(carSpec('starter')); s.dims.wheelRadius += 0.08; s.archGap = [s.archGap[0] - 0.08, s.archGap[1] - 0.08];
  known('tyres: the starter on wheels 80 mm bigger in the same arches', find(shapeChecks(build(s), { ...ctx, as: 'hatch' }), 'body points inside a tyre'), true);
  const t = clone(carSpec('starter')); t.dims.track += 0.12;
  known('tyres: the starter on a track 120 mm wider', find(shapeChecks(build(t), { ...ctx, as: 'hatch' }), 'tyres inside the body width'), true);
}
// facing and origin: the car turned round, and moved 200 mm forward
{
  const car = createCar(THREE, 'starter'); car.group.rotation.y = Math.PI;
  known('facing: the starter turned round', find(shapeChecks(car, ctx), 'facing -Z'), true);
  const c2 = createCar(THREE, 'starter'); for (const ch of c2.group.children) ch.position.z -= 0.2;
  known('origin: the starter built 200 mm forward of its origin', find(shapeChecks(c2, ctx), 'origin at the middle'), true);
}
// closed and outwards: the body's faces turned inside out
{
  const car = createCar(THREE, 'starter', { debug: true });
  const body = car.parts.find(p => p.name === 'body');
  for (let i = 0; i < body.p.length; i += 9) for (let j = 0; j < 3; j++) { const t = body.p[i + 3 + j]; body.p[i + 3 + j] = body.p[i + 6 + j]; body.p[i + 6 + j] = t; }
  known('closed: the starter body with every face turned inside out', find(shapeChecks(car, ctx), 'every part closed'), true);
}

const failures = [];
for (const [id, c] of Object.entries(result.cars)) for (const k of c.checks) if (!k.pass) failures.push(id + ': ' + k.name + ' = ' + JSON.stringify(k.value));
if (!result.code.pass) failures.push('code size ' + result.code.all.raw);
const missed = result.knownAnswers.filter(k => !k.caught);
result.pass = failures.length === 0 && missed.length === 0;
result.failures = failures;
writeJson(path.join(reviewDir, 'measure.json'), result);

for (const [id, c] of Object.entries(result.cars)) {
  console.log(`${id.padEnd(11)} ${String(c.triangles).padStart(5)} tris  ${c.drawCalls} calls  ${c.materials} materials  ${c.dims.length} x ${c.dims.width} x ${c.dims.height} m  wb ${c.dims.wheelbase} tr ${c.dims.track} R ${c.dims.wheelRadius}  spec ${c.ownCode.raw} B  checks ${c.checks.filter(k => k.pass).length}/${c.checks.length}  at full lock ${c.tyresAtFullLock.hits} body points in a tyre`);
}
console.log(`code: shared ${result.code.shared.raw} B (${result.code.shared.gzip} gz), all five ${result.code.all.raw} B (${result.code.all.gzip} gz)`);
for (const k of result.knownAnswers) console.log((k.caught ? 'caught  ' : 'MISSED  ') + k.name + '  -> ' + JSON.stringify(k.value));
for (const f of failures) console.log('FAIL ' + f);
console.log(result.pass ? 'PASS' : 'FAIL');
process.exit(result.pass ? 0 : 1);
