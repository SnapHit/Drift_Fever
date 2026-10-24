# Stage 2 report: the greybox renderer

Branch `crazygames-stage-2`. Every number here comes from a committed
output in this folder or `parity/`, or from a run made at the wrap-up on
24 October 2026; each section names its source.

## Summary

The whole game runs in real 3D in plain shapes, with the live game's own
title screen, HUD, input, audio and run card drawn on top.

- **1. Same game: met.** The shipped page, through its own frame loop
  with the renderer attached, matched the live game frame for frame on
  28 of 28 jobs (26,100 frames). A renderer writing one simulation field
  was caught at frame 0. Only 2 of the 28 days.
- **2. Drawn matches decided: met.** 43 drives, 18,110 sampled frames, 0
  failures. Worst: car centre 1.98 units off, rear wheel 0.36 px off on
  screen. A car drawn 0.05 of a half width aside is caught. Gates and
  hits were each checked once only.
- **3. Road ahead: met, like for like.** Worst 3.56 s portrait, 3.27 s
  landscape (8 of 1,425 landscape frames under 3.5 s), never shorter
  than the live game. 0 of 2,245 hazards and jumps seen later than the
  live game.
- **4. Frame budget: measured, and not held at 6x.** JavaScript p95 15 to
  17 ms at 6x CPU throttle (budget 16.7), worst 38 ms. The GPU cannot be
  measured here.
- **5. Deploys: met.** Initial download 2.04 MB. Game at `/`, status at
  `/status/`, and the build does fail over the limit (checked).

Not proven: the WebGPU path, the readability rule, 60 fps on a real
Chromebook, the music. Every known answer was caught.

Reviewer's note: in the review set the greybox draws the car with much
less drift yaw than the live game at the same frame (`03-deep-drift`),
and its hazard stripes outshine the road edge (`05-hazard-approach`).
The simulation is identical; both are drawing problems, and the drift
yaw is the first thing to fix, because the drift is the game.

---

## What was built

- `public/world.js`: the 3D world on three.js 0.184.0 (WebGPURenderer
  with its WebGL 2 fallback, bundled locally, recorded in `ASSETS.md`).
  The road from the simulation's segments with curves and hills, lane and
  edge lines, rough shoulders, terrain, hazards, jumps and ramps,
  chevrons, gates, the finish, signs and landmarks as blocks, the skyline
  as boxes, hemisphere and directional light, fog. One block-out car for
  the player (cyan), the three racers and the ghost, with drift yaw,
  airborne pose, sparks, wreck, smoke, fireworks and shake. Every tunable
  is in `WORLD` at the top.
- Two layers, as the original painted them: the ground (terrain,
  roadside blocks, skyline) is drawn first, the depth is cleared, then
  the road layer (road, paint, gantries, ramps, hazards, gates, cars).
  Nothing beside the road can hide the road, a hazard or a car.
- A chase camera, one rig per orientation, chosen by the visibility
  probe: portrait fov 100, 5,594 back, 6,038 up, 28.7 degrees down;
  landscape fov 66, 5,600 back, 5,600 up, 25 degrees down.
- `public/chrome.js`, `chrome.css`, `index.html`: the live game's title
  screen, countdown, HUD, pause and the route to the title, coaching
  lines, run card, share card, unlocks, music button, input and audio,
  sliced mechanically from the live game by `tools/chrome.js` and run
  verbatim on a transparent canvas over the 3D canvas (the brief's
  recommended route).
- `public/game.js`: the host. `?debug=1` shows backend, tier, pixel
  ratio, fps and worst frame; `?renderer=webgl2` forces the fallback.
- Tiers: low is pixel ratio 1.0, high is 2.0, both 200 segments of road
  (the original's draw distance). WebGL 2, or four cores or fewer, picks
  low.
- The parity test drives the shipped page (K8, K9). Four probes under
  `probes/`, their outputs here, and `tools/build-site.js`.

## The five Done items

### 1. The shipped page plays the same game

Sources: `parity/stamp.json` and `parity/REPORT.md` (stamped
2026-10-23T10:13:41Z, covering every file under `public/` as it stands),
and a full `npm run parity` run at the wrap-up on the code at 55f4f3f:
PASS, K1 to K9 ok, 799 s. The CI run on 55f4f3f passed with the same
figures.

- K8: 28 page jobs, 28 identical to the original frame for frame, 26,100
  frames drawn through the page's own frame function with the 3D
  renderer attached. Input through the page's own handlers as well: L4
  on 20261002 by arrow key events and L2 on 20261002 by pointer events on
  the canvas halves, 1,000 frames each, identical. Also routes, endless
  and records across a reload.
- K9: the page at 390x844 gives the same drive as at 120x260.
- Worst case 0 mismatching frames; count 28 of 28 jobs.
- Known answer: the page with its renderer writing `carPitch` was
  caught, first mismatch at frame 0 of 240.
- Under it, the module: 1,086 drives (4,757,947 frames) over 28 days, 6
  levels and 6 tapes, plus endless, routes and reloads, identical; K1 to
  K7 pass.

### 2. What the player sees is what the simulation decides

Source: `review/stage-2/screen.json` (run 2026-10-23T23:35Z to
2026-10-24T00:37Z), `probes/screen.js`, `probes/screen-inpage.js`.

The probe reads what the renderer drew (car meshes, the road vertex
buffer, hazard, gate and ramp quads) and holds it against the
simulation's numbers on every second frame. Drives: 2 days x 6 levels x
the driver, hug and chaos tapes, plus a level 3 centre drive that passes
a gate and ends on a hazard, at 390x844 (37 drives, 15,110 frames); the
day 1 driver tape on 6 levels at 1280x720 (6 drives, 3,000 frames).
Result: PASS, 0 check failures, no page errors.

| check (tolerance) | n | worst 390x844 | worst 1280x720 |
|---|---|---|---|
| car centre across the road (25 units) | 18,100 | 1.98 | 1.20 |
| car centre along the road (12 units) | 18,100 | 4.28 | 0.15 |
| car height above the drawn road vs carY (10 units) | 17,981 | 7.60 | 2.88 |
| rear wheel across the road (25 units) | 35,962 | 4.62 | 4.52 |
| rear wheel on screen against the lips (2 px) | 34,702 | 0.35 | 0.36 |
| racer centre across the road (25 units) | 45,909 | 1.06 | 0.79 |
| racer along the road (12 units) | 45,909 | 2.82 | 0.29 |
| contact: gap between the drawn cars (90 units) | 321 | 0 | 0 |
| ramp deck half width (4 units) | 91 | 0.0001 | 0.0001 |
| gate drawn at the banked segment (1.5 segments) | 1 | 0 | none |
| car at the drawn gate when banked (1.5 segments) | 1 | 0 | none |
| hit: drawn hazard overlaps the car (1 unit) | 1 | 0 | none |

Outcomes seen at 390x844, each checked: 10 off road deaths (9 past the
edge, 1 on the scrape meter), drawn car past the line in all 10; 2,268
edge scraping frames, drawn car in the scrape band in all; 377 airborne
frames, all drawn in the air; 256 contacts; 66 ramp riding frames; 1
gate; 1 hit. The probe now fails if any of these is never seen.

Known answer: the drawn car shifted by 0.05 of the half width on a 400
frame drive is caught: 400 wheel, 200 centre and 400 on-screen failures,
worst 8.49 px against the 2 px tolerance.

The probe checks position, not yaw. The drawn drift angle is not
measured against the simulation's (see the reviewer's note).

### 3. The road ahead stays visible

Source: `review/stage-2/visibility.json` (part A run
2026-10-23T10:13Z, part B 2026-10-23T11:13Z, both on the layered world).

Seconds of road visible ahead at top speed, every tenth frame of the
driver tape over 3 days and 6 levels, 1,425 frames per viewport. Like
for like, only the ground hides the road (the original's own rule):

| | 390x844 | 1280x720 |
|---|---|---|
| worst contiguous run | 3.56 s | 3.27 s |
| frames under 3.5 s | 0 | 8 |
| worst furthest visible | 3.73 s | 3.53 s |
| median | 4.49 s | 4.49 s |
| frames shorter than the original | 0 | 0 |
| original: worst run, frames under 3.5 s | 0.58 s, 300 | 0.58 s, 1,143 |

Hazards and jumps on 28 days of every level, 2,245 targets (963
hazards, 1,282 jumps): 0 seen later than the original, 0 never seen.
Lead over the original at least 5 segments, median 51. Every target is
first seen at least 3.11 s ahead here; the original's is as late as
0.49 s.

Counting everything the world draws as an occluder (reported, not the
pass condition, because the original also draws these in front and its
rule cannot say so): 3 targets stand behind a nearer gantry or ramp and
are seen later than the original, the worst by 93 segments. The road
ahead counted the same way has a worst contiguous run of 0 s (a ramp or
gantry right ahead) and a worst furthest visible of 2.44 s and 2.27 s
(23 and 27 frames under 3.5 s).

Known answers, all caught: A, the replica of the original's sight rule
agreed with the original page's own table on all 120,000 cells at each
viewport; B, a fake crest 30 segments ahead cut the run from 202 to 30
segments at both viewports; C, a fake crest before a target made it show
later (car position 1,317 to 1,428).

### 4. The low tier frame budget

Source: `review/stage-2/perf.json` (run 2026-10-23T21:20Z). Headless
Chromium, forced WebGL 2, 390x844, low tier, CPU throttled through
DevTools; the driver (L2, 700 frames), hug (L5, 600) and chaos (L6, 500)
tapes. JavaScript time is the frame less the GPU submission: the
simulation, the chrome and the scene update.

| throttle | JS p95 | JS worst | scene update p95 | frame p95 with software GPU |
|---|---|---|---|---|
| 1x | 3 to 4 ms | 10 ms | 2 ms | 103 to 110 ms |
| 4x | 11 to 12 ms | 38 ms | 8 ms | 183 to 194 ms |
| 6x | 15 to 17 ms | 38 ms | 11 to 12 ms | 193 to 205 ms |

Budget 16.7 ms. At 6x the JavaScript p95 is over it on one drive (L2
driver, 17 ms); the worst frame is 38 ms at 4x and 6x. The run on 20
October, before the layered world, measured 14 to 15 ms at 6x. The timer
resolves to 1 ms, so the change is close to noise, but this run's
verdict is a fail at 6x.

Known answer: 20 ms of busy work inside the frame, through the
simulation's `updateSmoke` hook, raised the median from 1 to 21 ms and
flipped the verdict. Caught.

What this does not tell us: the GPU cost. The submission here is
SwiftShader, a software rasteriser, and says nothing about a
Chromebook's GPU.

### 5. It deploys

`npm run build` at the wrap-up, and again at review: the stamp holds,
`dist/` has 13 files and 11.73 MB in all, the game at `/`
(`dist/index.html`) and the status page at `/status/`
(`dist/status/index.html`), the music in `dist/music/`. Known answer:
the same build with the limit set to 2 MB fails (exit 1) on the 2.04 MB
download.

## Initial download

2.04 MB (2,139,800 bytes) over 7 files: three.webgpu.min.js 1,005,970,
drift-fever-sim.js 598,236, chrome.js 415,981, world.js 62,840,
chrome.css 27,676, index.html 21,974, game.js 7,123. These are exactly
the files the page loads before its first frame (the icon is inline).
The music, 9.68 MB over 4 tracks, loads after the first playable frame.
The limit is 20 MB.

## Not done or not proven

- **The WebGPU path.** Every run in this stage came up on WebGL 2 in
  headless Chromium. No probe has driven the WebGPU backend.
- **The readability rule.** No probe measures it. By eye in the review
  set, the greybox's hazard warning stripes are brighter than its road
  edge (`05-hazard-approach`), and the drift angle at the same frame
  reads smaller than the live game's (`03-deep-drift`). Observations,
  not measurements.
- **60 fps on a Chromebook.** See Done 4.
- **K8 covers 2 of the 28 days**, at 120x260, because the page draws
  every frame in a software rasteriser on a two core runner.
- **Gates and hits in Done 2 rest on one case each**, and landscape saw
  no gate, hit or off road death. The gate and hit checks have no known
  answer of their own; the offset known answer covers the car checks.
- **Music and sound.** The tracks are copied into `dist/music/` and the
  chrome's audio code is the original's verbatim; no probe plays them or
  checks the silent fallback.
- **The `?debug=1` overlay** prints `cam undefined/undefined` on its last
  line (it reads `WORLD.CAM_HEIGHT` and `CAM_BACK`, which no longer
  exist), and its worst frame covers the last second, not the last few.
  Not fixed here: it is under `public/` and would need a new stamp.
- **The original's render feedback** (found in stage 1): the live game's
  `render()` writes `camHeight` and the generator reads it. Measured as
  inert at the shipped constants. The fix belongs in Drift_Fever.

## Deviations from STAGE-2.md, and why

1. **Branch, not `main`.** `crazygames/CLAUDE.md` and `BRIEF.md` say
   commit straight to `main`; `STAGE-2.md` says work on the branch and
   do not merge. The work stayed on the branch for review, because
   pushing to `main` deploys.
2. **Done 1 on 2 days, not 28.** For runner time; see above.
3. **Done 3 is passed like for like** with the original's rule, where
   only the ground hides a target. Counted with everything drawn, 3
   targets are later, and they are reported.
4. **The low tier was not cut down from the measurements.** It keeps the
   original's 200 segment draw distance and a pixel ratio of 1. The
   JavaScript cost does not depend on resolution and the GPU cost cannot
   be measured here, so there was no measurement to choose a smaller
   tier from.
5. **Curvature.** The simulation's curve is a sideways slide per
   segment, not a heading. The world draws 1/1000 radian of heading per
   unit (`CURVE_HEADING`); by the comment in `world.js`, that keeps every
   corner on 28 days under 100 degrees, where a literal reading makes
   hard corners 150 degree hairpins. That figure is not re-measured
   here. Gameplay is untouched; the drawn bends are not the original's
   projection, and Done 2 is measured in the road's own frame.
6. **The probes changed after the renderer was final**, each with its
   failing or missing case:
   - screen agreement, 24 October: the pixel check uses the drawn width
     at the wheel, and the off road and scrape checks hold the drawn
     car's reference point (centre less `bodyOffsetX`) against the
     simulation's half width. The failing run, 37 failures over 42
     drives, is kept in `screen-before-probe-fix.json`. Then: gates are
     checked on the frame before the crossing (both renderers stop
     drawing a gate once it is crossed); `toRoad` falls back to the
     nearest chord, where it had returned NaN on the inside of a bend
     and a NaN passed silently; an unmeasurable value is now a failure;
     a drive reaching a gate and a hazard was added, and the probe fails
     if any outcome goes unseen.
   - frame budget: it had no known answer; it has one now.
   - review set: it was drawing the road layer alone after the layered
     world; it now draws the page's own last frame, and each shot checks
     both sides are in the same state and that it shows its scene.

## Review set

`review/stage-2/shots/`, indexed in `shots.json`: 20 images (the title,
countdown, deep drift, jump in the air, hazard approach, contact with a
racer, wreck, gate, finish and run card, each at 390x844 and 1280x720),
greybox and live game side by side at the same tape frame, 2,210,220
bytes in all, under the 5 MB limit. All 20 match the live game's
simulation state exactly and show their scene. Known answer: the live
game driven one frame further is caught (position and carX differ).

## For stage 3

- **Draw the drift angle the player feels.** The greybox car yaws far
  less than the live game's at the same frame. Measure the drawn yaw
  against the live game's on screen, with a known answer, and fix it
  before any art.
- **Measure on a real Chromebook before any art.** The JavaScript alone
  is at the budget at 6x, and the scene update, which rebuilds the world
  around the car every frame, is 11 to 12 ms of it at p95. Reusing
  geometry between frames is the first thing to try. Then open the
  preview with `?debug=1&renderer=webgl2`, after fixing its last line.
- **Drive the WebGPU path** on a real device before relying on it.
- **Build a readability probe before the presets**: the edge's
  brightness and saturation against everything else on screen, and the
  player's car against the racers, per preset. Today nothing would
  notice if art broke it, and the greybox already looks to break it at
  the hazard stripes.
- **Shadows across the two layers.** The depth is cleared between them,
  so a shadow from one onto the other needs its own pass. Keep the
  layering: it is what keeps roadside art from hiding the road.
- **Ramps and gantries hide the road right ahead** (worst furthest
  visible 2.27 s counting everything). The original does the same, but
  solid 3D ramps will read as walls; judge it in art.
- **Add a known answer for the gate and hit checks**, and more drives
  that reach them, and extend K8 beyond 2 days if the runner allows.
- **Fix the `camHeight` write** in Drift_Fever's `render()`.
