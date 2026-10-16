# Stage 2 brief: the greybox renderer

Written 16 October 2026. Read `BRIEF.md` and `CLAUDE.md` in this folder in
full first. They win over this file wherever the two disagree, and if they
do, say so in the report.

## The goal

The whole game, playable in real 3D at the preview URL, drawn in plain
shapes. Every mechanic in BRIEF.md "Preserved exactly" works and plays the
same as driftfever.com. No art: that is stage 3. The point of this stage is
to judge the camera, the sense of speed and the frame rate before any art
goes in, on a renderer stage 3 can dress without rebuilding.

## Done means all of this, measured

1. **The shipped page plays the same game.** Stage 1 proved the module
   matches the original. Stage 2 must prove the real page does: its own
   frame loop, its own input wiring, the renderer attached. Drive the
   shipped greybox page headless with the parity tapes and compare its
   traces with the original's, frame for frame, on the same days and levels
   the parity test uses. Known answer: make the renderer write one
   simulation field it should only read, and confirm the comparison fails.
   Fold this into `npm run parity` so the stamp and CI cover it.
2. **What the player sees is what the simulation decides.** Where the car
   sits against the road edges, the rough shoulders, hazards, jumps,
   gates, chevrons and the other racers on screen must agree with the
   simulation's numbers. Probe it: at sampled frames, project the car's
   wheel contact points and the relevant road features to screen and check
   that "off road", "hit", "contact" and "airborne" in the simulation match
   what is drawn, within a stated tolerance. Known answer: offset the drawn
   car by a small lateral amount and confirm the probe catches it. Report
   the worst case and the count, not a median.
3. **The road ahead stays visible.** At the camera you choose, measure the
   seconds of road visible ahead at top speed in 390x844 portrait and
   1280x720 landscape. About 3.5 seconds is a core pillar and must not
   fall. Then, for every hazard and jump on 28 days of every level, measure
   when it first becomes visible and unoccluded, and confirm it is never
   later than in the original, whose sight-line clauses assume a fixed
   reference camera. Hills occlude for real in 3D; that is exactly where
   this can break. Worst case and count.
4. **The low tier frame budget is measured.** See "Performance" below.
5. **It deploys.** `npm run build` produces `dist/` with the game at `/`
   and the parity status page moved to `/status/`. The build prints the
   initial download size and fails above 20MB.

## Scope

**In:**
- The world in real 3D with plain materials: the road built from the
  simulation's segments (curves and hills), lane and edge lines, rough
  shoulders, terrain either side, hazards, jumps and ramps, chevrons,
  gates and checkpoints, the finish, distance signs and landmarks as
  simple blocks at their real positions, the city skyline as a few boxes
  on the horizon. Basic hemisphere and directional light, plain fog, only
  as much as makes the shapes readable.
- The readability rule from BRIEF.md applies already: the road edge is the
  brightest and most saturated thing on screen, the player's car is the
  most findable car, nothing occludes the road ahead.
- Cars: one simple original block-out body, used for the player (fixed
  cyan) and the three racers (their fixed colours), plus the ghost, with
  the drift yaw, airborne pose, contact sparks, wreck and respawn shown
  plainly. Smoke, debris, fireworks and camera shake through their hooks
  as simple particles and offsets.
- A real chase camera, high, in the spirit of Art of Rally, tuned by the
  measurements in "Done" 3. Constants in one named block.
- Everything outside the 3D world, reproduced from the live game for this
  stage: title screen, countdown, HUD (distance to finish, track number,
  score and the rest), pause and the route to the title screen, tutorial
  coaching lines, run card, share card, car unlocks, the music button. The
  recommended route is to port the original's own overlay drawing onto a
  transparent Canvas 2D layer above the 3D canvas, text verbatim, so it
  matches now and stage 3 restyles it. Your call if you find better, but
  say why.
- Input exactly as the live game: keys in both cases, touch halves, tilt
  with calibration, one input to restart on every path.
- Audio exactly as the live game: the four music tracks and how they are
  handled, silent with the button off on failure, and the sound effects.
  Copy the music from the repository's `music/` folder into `dist/` at
  build time (read only; nothing outside this folder changes). Music loads
  after the first playable frame and does not count against the initial
  download.
- three.js WebGPURenderer with its WebGL 2 fallback, pinned to an exact
  version from npm, bundled locally. Zero external requests. Record
  three.js and its licence in a new `ASSETS.md`.
- Portrait and landscape, phone to desktop.

**Out, and do not start them:** textures, models, PBR materials, shadows,
bloom, presets (dusk, night, dawn, rain), the final car design, KTX2 or
Draco, the CrazyGames SDK. That is stages 3 to 6.

## Performance

There is no Chromebook in the sandbox and headless GPU numbers are not real
GPU numbers. So:
- Measure what the sandbox can measure honestly: JavaScript time per frame
  (simulation step, scene update, render submission) on the forced WebGL 2
  path, with CPU throttling through the DevTools protocol at 4x and 6x as a
  proxy for an old Chromebook. Report p95 and the worst frame, and say
  plainly what this does and does not tell us.
- Add a `?debug=1` overlay that shows the active backend (WebGPU or WebGL 2),
  the quality tier, frames per second and the worst frame time of the last
  few seconds, and `?renderer=webgl2` to force the fallback, so the author
  can check it on a real phone and a real Chromebook.
- Pick the lowest tier's settings (resolution scale, draw distance) from
  those measurements. Tier selection may be simple at this stage.

## How to work

- Work on the branch `crazygames-stage-2`, branched from `main`. Push to it
  often: the parity workflow runs on `crazygames-*` branches. **Do not
  merge to `main`.** The reviewer merges after review.
- Nothing outside `crazygames/` changes. `sim/drift-fever-sim.js` is never
  edited by hand. If the renderer appears to need a gameplay change, or the
  module does not expose something the renderer must draw, stop and write
  it up rather than working around it. A re-vendor with a new boundary
  decision in `tools/vendor.config.js` is allowed if it is needed, with the
  full parity run and a fresh stamp, and it must be called out in the
  report.
- The preview Worker only deploys `main`, so the reviewer cannot play the
  branch. Commit a review set to `review/stage-2/`: screenshots of the
  greybox and of the live game at the same tape frame side by side, in
  390x844 and 1280x720, covering the title screen, the countdown, a deep
  drift, a jump in the air, a hazard approach, contact with a racer, a
  wreck, a gate, the finish and the run card. Keep the set under 5MB.
- Every probe carries a known answer that can fail, and you report whether
  it did. A probe that passes for the wrong reason is a defect of the
  probe.
- Australian spelling, no em or en dashes, in code, comments and copy.
- Model names and session identifiers never go into commits, code or
  comments. That includes commit trailers.

## The report

Finish with `review/stage-2/REPORT.md`, short enough to read on a phone,
then the detail below it: what was built, each "Done" item with its
measurement, worst case, count and known-answer result, the initial
download size, what is not done or not proven, every deviation from this
brief and why, and anything you would change about stage 3 based on what
you found.
