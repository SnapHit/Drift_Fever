/* INPUT TAPES. The same code drives both sides, so a tape is a function of
   the frame number and of what the simulation exposes, never of anything
   outside it. Open loop tapes crash early and exercise the death paths;
   the closed loop ones survive deep enough to meet gates, racers, hazards
   and jumps, which is where most of the simulation lives.

   restart     what to do when the car dies: 'wait' taps after the lock has
               passed plus a delay, 'reflex' taps on the frame of death so
               the buffered restart (restartWanted) is the path exercised.
   restarts    how many deaths are followed by a tap before the tape ends. */
(function (root) {
  'use strict';
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  /* A small deterministic noise source per tape, so two tapes with the same
     controller still drive different lines. mulberry32. */
  function noise(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const TAPES = {
    /* A driver. Centres with a PD loop, leans a little into the curvature
       ahead, and steers for the free side of the next hazard, reading the
       hazard list the way the renderer will. Finishes every level, which is
       what reaches the deep gates, the movers, the splitters, the finale to
       its end and the one tap into the next level. Gains were swept in
       Node: 20 of 20 finishes on levels 3 to 6 over five days. */
    driver: {
      restart: 'wait', restartDelay: 0.5, restarts: 1, afterFinish: 'next', nextLevelFrames: 900,
      make: function () {
        let prev = null;
        return function (i, S) {
          const frac = S.get('carFrac'), idx = S.get('carSegIndex');
          const FEEL = S.get('FEEL');
          let target = 0;
          let best = null;
          for (const h of S.get('hazards')) { if (h.to < idx - 2 || h.from > idx + 60) continue; if (!best || h.from < best.from) best = h; }
          if (best) {
            const seg = S.fn.segAt(best.from), hw = seg ? seg.hw : FEEL.ROAD_HALF_WIDTH_BASE;
            const half = best.half / hw;        // half is world units; x and swing are fractions of the half width
            const sw = best.kind === 3 ? Math.abs(best.swing || 0) : 0;
            const lo = best.x - half - sw, hi = best.x + half + sw;
            target = (lo + 0.78) >= (0.78 - hi) ? clamp(lo - 0.3, -0.78, 0.78) : clamp(hi + 0.3, -0.78, 0.78);
          }
          let sum = 0, c = 0;
          for (let k = 1; k <= 12; k++) { const s = S.fn.segAt(idx + k); if (!s) break; sum += s.curve; c++; }
          const ahead = c ? sum * S.get('curveScale') / c : 0;
          const d = prev === null ? 0 : (frac - prev) * 60; prev = frac;
          return clamp(-(frac - target) * 6 - d * 0.5 + ahead * 0.3, -1, 1);
        };
      }
    },
    /* Hold the centre of the road and lean into corners. Finishes most
       levels, which is what reaches the gates, the racers and the finale. */
    centre: {
      restart: 'wait', restartDelay: 0.5, restarts: 2,
      make: function (seed) {
        const rnd = noise(seed ^ 0x1111);
        return function (i, S) {
          /* carFrac already carries the road's sideways slide under the car,
             so plain centring is the whole controller: feeding the curve
             ahead forward as well was measured to kill it at the first
             corner. */
          const frac = S.get('carFrac');
          const wobble = 0.10 * Math.sin(i / 41) + 0.04 * (rnd() - 0.5);
          return clamp(-frac * 2.0 + wobble, -1, 1);
        };
      }
    },
    /* The same controller aimed at the right hand edge, so it scrapes,
       meets the hazards on that side and shoulders the racers. */
    hug: {
      restart: 'reflex', restartDelay: 0, restarts: 2,
      make: function (seed) {
        const rnd = noise(seed ^ 0x2222);
        return function (i, S) {
          const frac = S.get('carFrac');
          const target = 0.55 + 0.30 * Math.sin(i / 180);
          return clamp(-(frac - target) * 2.4 + 0.06 * (rnd() - 0.5), -1, 1);
        };
      }
    },
    /* Open loop. A slow sine sweep that leaves the road within seconds,
       then taps straight back in and does it again. */
    swing: {
      restart: 'wait', restartDelay: 0.3, restarts: 3,
      make: function (seed) {
        return function (i) { return Math.sin(i / 90 + (seed % 7) * 0.3) * 0.35; };
      }
    },
    /* Open loop. A seeded random walk with full lock excursions: slides,
       spins the heading, and dies in a variety of ways. */
    chaos: {
      restart: 'reflex', restartDelay: 0, restarts: 3,
      make: function (seed) {
        const rnd = noise(seed ^ 0x3333);
        let v = 0;
        return function () {
          v += (rnd() - 0.5) * 0.3;
          if (rnd() < 0.02) v = rnd() < 0.5 ? -1 : 1;
          v = clamp(v * 0.98, -1, 1);
          return v;
        };
      }
    }
  };
  root.parityTapes = TAPES;
  if (typeof module !== 'undefined') module.exports = TAPES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
