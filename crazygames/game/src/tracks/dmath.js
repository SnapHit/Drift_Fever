/* DETERMINISTIC TRIGONOMETRY. Math.sin and Math.cos are not required to
   be correctly rounded, and engines differ in the last bit (Node and
   Chromium already do). The daily track must be the same for everyone
   and a ghost replays against its walls, so the generator never calls
   them: these use only + - * / and Math.round, which IEEE 754 and the
   language fix exactly, so every engine gives the same bits.

   Range reduction by pi/2 in two parts (the first has 33 significant
   bits, so q * PIO2_1 is exact for |q| < 2^20), then Taylor series to
   the 17th and 18th power on [-pi/4, pi/4], where the first dropped
   term is below 1e-19. Accurate to a few units in the last place for
   any angle a track can reach. */

const INV_PIO2 = 0.6366197723675814;
const PIO2_1 = 1.5707963267341256;
const PIO2_1T = 6.077100506506192e-11;

function sinKernel(r) {
  const r2 = r * r;
  return r * (1 + r2 * (-1 / 6 + r2 * (1 / 120 + r2 * (-1 / 5040 + r2 * (1 / 362880 + r2 * (-1 / 39916800 + r2 * (1 / 6227020800 + r2 * (-1 / 1307674368000 + r2 * (1 / 355687428096000)))))))));
}
function cosKernel(r) {
  const r2 = r * r;
  return 1 + r2 * (-1 / 2 + r2 * (1 / 24 + r2 * (-1 / 720 + r2 * (1 / 40320 + r2 * (-1 / 3628800 + r2 * (1 / 479001600 + r2 * (-1 / 87178291200 + r2 * (1 / 20922789888000 + r2 * (-1 / 6402373705728000)))))))));
}

function reduce(x) {
  const q = Math.round(x * INV_PIO2);
  const r = (x - q * PIO2_1) - q * PIO2_1T;
  return [r, ((q % 4) + 4) % 4];
}

export function dsin(x) {
  const [r, k] = reduce(x);
  return k === 0 ? sinKernel(r) : k === 1 ? cosKernel(r) : k === 2 ? -sinKernel(r) : -cosKernel(r);
}

export function dcos(x) {
  const [r, k] = reduce(x);
  return k === 0 ? cosKernel(r) : k === 1 ? -sinKernel(r) : k === 2 ? -cosKernel(r) : sinKernel(r);
}

export const TWO_PI = 6.283185307179586;

/* An angle wrapped to [-pi, pi]. */
export function wrapAngle(a) { return a - TWO_PI * Math.round(a / TWO_PI); }
