/* WHERE CAR MODELS COME FROM. makeCar(THREE, id, options) answers in the
   contract of briefs/CARS.md: { group, body, wheels: { fl, fr, rl, rr },
   lights, setPaint(colour), setUnderglow(colour or null), dims, dispose }
   with each wheel { pivot, mesh }, units metres, Y up, the car facing -Z
   and its origin on the ground at the middle of the wheelbase.

   Until the five models (another session, folder ../cars/) are merged,
   this builds the feel prototype's block car to the roster's dimensions
   for each id: a body, a cabin, four wheels and two lamps. The real ones
   drop in by the import at MODELS below. */
import { carById } from '../garage/roster.js';

/* The models, when merged: import { createCar } from '../cars/index.js' */
const MODELS = null;

export const STAND_IN = !MODELS;

const BLOCK = {
  DARK:       0x0d6f85,     // the cabin, darkened from the paint
  WHEEL:      0x15151a,
  LAMP_FRONT: 0xfff6d0,
  LAMP_REAR:  0xff2a2a,
};

export function makeCar(THREE, id, options) {
  const o = options || {};
  if (MODELS) return MODELS.createCar(THREE, id, o);
  const spec = carById(id), D = spec.dims;
  const group = new THREE.Group();
  const paintMat = new THREE.MeshLambertMaterial({ color: o.paint === undefined ? 0x19d8ff : o.paint });
  const darkMat = new THREE.MeshLambertMaterial({ color: BLOCK.DARK });
  const bodyW = D.track - 0.12, bodyL = D.length, wr = D.wheelRadius;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 0.5, bodyL), paintMat);
  body.position.y = wr + 0.17;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.78, 0.5, bodyL * 0.42), darkMat);
  cabin.position.set(0, wr + 0.17 + 0.48, bodyL * 0.04);
  group.add(cabin);
  const headMat = new THREE.MeshBasicMaterial({ color: BLOCK.LAMP_FRONT }), tailMat = new THREE.MeshBasicMaterial({ color: BLOCK.LAMP_REAR });
  const head = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.9, 0.12, 0.08), headMat);
  head.position.set(0, wr + 0.3, -bodyL / 2 + 0.02);
  group.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.9, 0.12, 0.08), tailMat);
  tail.position.set(0, wr + 0.3, bodyL / 2 - 0.02);
  group.add(tail);
  const wheelGeo = new THREE.CylinderGeometry(wr, wr, 0.28, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: BLOCK.WHEEL });
  const wheels = {};
  const half = D.track / 2, hb = D.wheelbase / 2;
  for (const [name, x, z] of [['fl', -half, -hb], ['fr', half, -hb], ['rl', -half, hb], ['rr', half, hb]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, wr, z);
    const mesh = new THREE.Mesh(wheelGeo, wheelMat);
    pivot.add(mesh);
    group.add(pivot);
    wheels[name] = { pivot, mesh };
  }
  const dims = { length: bodyL, width: D.track + 0.16, height: wr + 0.17 + 0.25 + 0.5, wheelbase: D.wheelbase, track: D.track, wheelRadius: wr, halfLength: bodyL / 2, halfWidth: (D.track + 0.16) / 2, centreZ: 0, frontAxle: -hb, rearAxle: hb };
  return {
    id, group, body, wheels, dims,
    lights: { head, tail, set(h, t) { head.visible = h > 0; tail.visible = t > 0; } },
    setPaint(colour) { paintMat.color.setHex(colour); },
    setUnderglow() { /* the block car has none */ },
    dispose() { group.traverse(m => { if (m.geometry) m.geometry.dispose(); }); for (const m of [paintMat, darkMat, headMat, tailMat, wheelMat]) m.dispose(); },
  };
}

/* A model made see through, for the ghost: every material cloned so the
   original car is untouched. */
export function makeGhostly(model, opacity, tint) {
  model.group.traverse(m => {
    if (!m.isMesh) return;
    const mat = m.material.clone();
    mat.transparent = true; mat.opacity = opacity; mat.depthWrite = false;
    if (tint !== undefined && mat.color) mat.color.lerp({ r: ((tint >> 16) & 255) / 255, g: ((tint >> 8) & 255) / 255, b: (tint & 255) / 255 }, 0.5);
    m.material = mat;
    m.renderOrder = 2;
  });
  return model;
}
