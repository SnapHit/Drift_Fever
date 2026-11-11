/* A RIVAL'S PORTRAIT IS HIS CAR IN HIS PAINT (briefs/RIVALS-LADDER.md).
   The rivals screen shows each rival's own model, three quarters from
   the front, drawn once by the game's own renderer into its canvas and
   copied out at once, in the same task, so the frame never shows it;
   the game's scene is drawn again straight after. Each portrait is kept
   as an image for the session, keyed by car and paint. Nothing is
   downloaded and nothing is stored.

   The look is a small studio of its own: a dark backdrop the colour of
   the cards, a sky and ground light and a key light, so every paint
   reads as itself whatever the track's time of day. */
import { makeCar } from '../render/car.js';
import { paintById } from '../garage/roster.js';

export const PORTRAIT = {
  W: 240, H: 120,           // px of each portrait (shown at half that, so it stays sharp on a phone)
  BACK: 0x111628,           // the backdrop, the cards' own dark
  SKY: 0xdfe7ff, GROUND: 0x1a1d2a, HEMI: 2.4,   // the sky and ground light
  KEY: 3.2, KEY_AT: [-4, 6, -5],                // the key light and where it stands (front left, high)
  RIM: 1.6, RIM_AT: [5, 3, 6],                  // a light from behind, for the roof line
  FOV: 26,                  // degrees
  AT: [-0.62, 0.3, -0.74],  // where the camera stands, as a direction from the car, scaled to fit it
  FILL: 0.96,               // share of the portrait's width the car fills
};

export function createPortraits(THREE, renderer, redraw) {
  const cache = new Map();
  let studio = null;
  function build() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PORTRAIT.BACK);
    scene.add(new THREE.HemisphereLight(PORTRAIT.SKY, PORTRAIT.GROUND, PORTRAIT.HEMI));
    const key = new THREE.DirectionalLight(0xffffff, PORTRAIT.KEY); key.position.set(...PORTRAIT.KEY_AT); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, PORTRAIT.RIM); rim.position.set(...PORTRAIT.RIM_AT); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(PORTRAIT.FOV, 1, 0.1, 100);
    return { scene, camera };
  }
  /* draw every portrait not yet made, in one task; returns how many were made */
  function make(list) {
    const todo = list.filter(p => !cache.has(p.car + ':' + p.paint));
    if (!todo.length || !renderer || !renderer.domElement) return 0;
    if (!studio) studio = build();
    const canvas = renderer.domElement, cw = canvas.width, ch = canvas.height;
    if (cw < 8 || ch < 8) return 0;
    const out = document.createElement('canvas'); out.width = PORTRAIT.W; out.height = PORTRAIT.H;
    const g = out.getContext('2d');
    const keepShadows = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    let made = 0;
    for (const p of todo) {
      let model = null;
      try {
        model = makeCar(THREE, p.car, { paint: paintById(p.paint).hex });
        if (model.lights && model.lights.set) model.lights.set(1, 1);
        studio.scene.add(model.group);
        /* frame the car: the camera along AT at the distance that makes it FILL the portrait's width */
        const cam = studio.camera, aspect = cw / ch;
        cam.aspect = aspect; cam.updateProjectionMatrix();
        const d = model.dims, size = Math.hypot(d.length, d.width);
        const cropH = Math.min(ch, cw * PORTRAIT.H / PORTRAIT.W), cropW = cropH * PORTRAIT.W / PORTRAIT.H;
        const halfW = Math.tan(cam.fov * Math.PI / 360) * aspect * (cropW / cw);
        const dist = (size / 2) / (halfW * PORTRAIT.FILL);
        const a = PORTRAIT.AT, n = Math.hypot(a[0], a[1], a[2]);
        cam.position.set(a[0] / n * dist, a[1] / n * dist + 0.2, a[2] / n * dist);
        cam.lookAt(0, (d.height || 1.3) * 0.42, 0);
        renderer.render(studio.scene, cam);
        g.clearRect(0, 0, PORTRAIT.W, PORTRAIT.H);
        g.drawImage(canvas, (cw - cropW) / 2, (ch - cropH) / 2, cropW, cropH, 0, 0, PORTRAIT.W, PORTRAIT.H);
        cache.set(p.car + ':' + p.paint, out.toDataURL('image/png'));
        made++;
      } catch (e) {
        cache.set(p.car + ':' + p.paint, '');   // a swatch stands in
      } finally {
        if (model) { studio.scene.remove(model.group); if (model.dispose) model.dispose(); }
      }
    }
    renderer.shadowMap.enabled = keepShadows;
    if (redraw) redraw();   // the game's own frame back, in this same task
    return made;
  }
  return { make, get: (car, paint) => cache.get(car + ':' + paint) || '', has: (car, paint) => cache.has(car + ':' + paint) };
}
