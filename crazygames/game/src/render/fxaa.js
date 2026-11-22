/* FXAA, IN TSL (briefs/COVER-LOOK.md 8, ?look=2). The vendored three.js
   bundle has no antialiasing pass, so this is written here as the bloom
   is: the well known fast approximate antialiasing (after Timothy
   Lottes's FXAA, in its short form): the brightness of a pixel and its
   four diagonal neighbours says whether it sits on an edge and which
   way the edge runs, and the picture is blurred a little along the edge
   and never across it. It runs on the tone mapped picture, in display
   space, so it smooths the edges MSAA cannot: a bright line that glows
   (the road's edge line, a lamp) is far brighter than one before tone
   mapping, and samples averaged before the tone curve still step after
   it. Nine texture reads a pixel, one full screen pass. Every number is
   in FXAA. */

export const FXAA = {
  REDUCE_MIN: 1 / 128,   // the least the edge direction is shortened by, so flat areas do not blur
  REDUCE_MUL: 1 / 8,     // and how much a bright neighbourhood shortens it
  SPAN_MAX:   8,         // px, the longest blur along an edge
};

/* tex: a texture node of the tone mapped picture (an RTT node); returns the antialiased colour node */
export function fxaa(THREE, tex) {
  const T = THREE.TSL, F = FXAA;
  const uv = T.uv(), texel = T.vec2(1).div(T.vec2(tex.size(T.int(0))));
  const at = (dx, dy) => tex.sample(uv.add(T.vec2(dx, dy).mul(texel))).rgb;
  const luma = c => c.dot(T.vec3(0.299, 0.587, 0.114));
  const M = tex.sample(uv);
  const lNW = luma(at(-1, -1)), lNE = luma(at(1, -1)), lSW = luma(at(-1, 1)), lSE = luma(at(1, 1)), lM = luma(M.rgb);
  const lMin = T.min(lM, T.min(T.min(lNW, lNE), T.min(lSW, lSE))), lMax = T.max(lM, T.max(T.max(lNW, lNE), T.max(lSW, lSE)));
  const dir0 = T.vec2(lNW.add(lNE).sub(lSW.add(lSE)).negate(), lNW.add(lSW).sub(lNE.add(lSE)));
  const reduce = T.max(lNW.add(lNE).add(lSW).add(lSE).mul(0.25 * F.REDUCE_MUL), T.float(F.REDUCE_MIN));
  const rcp = T.float(1).div(T.min(dir0.x.abs(), dir0.y.abs()).add(reduce));
  const dir = T.clamp(dir0.mul(rcp), T.vec2(-F.SPAN_MAX), T.vec2(F.SPAN_MAX)).mul(texel);
  const s = k => tex.sample(uv.add(dir.mul(k))).rgb;
  const A = s(1 / 3 - 0.5).add(s(2 / 3 - 0.5)).mul(0.5);
  const B = A.mul(0.5).add(s(-0.5).add(s(0.5)).mul(0.25));
  const lB = luma(B);
  return T.vec4(T.select(lB.lessThan(lMin).or(lB.greaterThan(lMax)), A, B), M.a);
}
