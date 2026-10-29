# The feel prototype: report

Branch `crazygames-feel`, DESIGN.md build step 1, brief `briefs/FEEL.md`.
Every number below was measured by `game/test/feel/probes.js` in
headless Chromium on the forced WebGL 2 path, and the JSON beside this
file is what it wrote.

## In short, for a phone

- It plays at `/` on the preview once merged: the test track by default,
  `?ground=park` for the car park. Thumbs: steer left and right under
  the left thumb, BRAKE and DRIFT (the handbrake) under the right, the
  throttle is automatic. Keyboard: arrows or WASD, space for the
  handbrake, R to restart. Gamepad: stick or d-pad, right trigger, left
  trigger, A for the handbrake, Y or start to restart.
- `?tune=1` opens sliders for 33 constants (grip, power, lock, steering
  rate, the assist, the camera, the scoring threshold), applied as you
  drag, remembered on the device, with a line at the top saying what
  differs from the defaults, to screenshot. `?debug=1` shows the
  backend, fps, worst frame and physics time. `?assist=0` turns the
  hidden assist off, `?auto=1` lets the scripted driver drive.
- The car: rear wheel drive, a grip curve per axle that peaks and falls
  to a tail, friction circles so throttle and brake eat cornering grip,
  weight transfer, a handbrake that takes the rear's grip to 30 per
  cent, 0 to 100 km/h in about 5 s, 133 km/h flat out. The assist at
  full level countersteers for you, and a spin control keyed on yaw
  rate (not angle) eases the throttle and fades steering into the slide
  past 0.8 rad/s, so a held button settles into a 25 to 60 degree
  circle instead of a spin. The same assist leaves a 36 degree,
  76 km/h slide through the sweeper alone.
- Measured: the physics is bit for bit deterministic and the frame rate
  cannot change a run; the scripted driver laps the test track in 54 s
  without touching a wall; the drift script holds 3.4 s above 30
  degrees through the sweeper; the camera keeps the whole car on screen
  in every one of 6,923 frames per viewport, a wall hit included; the
  JavaScript half of a frame is 4.2 ms at the 95th percentile with the
  CPU throttled 6x. Every known answer was caught.
- Honest caveats: the sandbox has no GPU, so the GPU half of a frame is
  unmeasured, and the renderer's own submission is 11.7 ms p95 at 6x
  (17.5 in an earlier run), which puts the whole frame at 13.4 to
  19.5 ms there. And nobody has driven it with thumbs yet: that is the
  author's judgement, and what the tune panel is for.

## What was built

```
game/index.html                 the page: import map to ./vendor/three.webgpu.min.js, the HUD styles
game/src/main.js                the host: the 120 Hz loop, the recorder, window.__feel for the probes
game/src/tune.js                TUNE, every feel constant, and PANEL, what the tuning panel shows
game/src/physics/vehicle.js     the vehicle model
game/src/physics/world.js       the car, the walls, the cones, where the car is along the track
game/src/physics/driver.js      the scripted driver, pure pursuit plus the drift script
game/src/ground/track.js        the test track and the car park, hand made, in the tracks contract
game/src/render/scene.js        plain shapes on three.js: ground, road, edges, walls, cones, car, marks, smoke
game/src/camera/chase.js        the chase camera, and carOnScreen for the probes
game/src/input/input.js         keyboard and gamepad, and the one record the physics reads
game/src/input/touch.js         the four big buttons and the restart button
game/src/scoring/drift.js       drift points, the chain, banking, loss, the proximity bonus, callouts
game/src/ui/hud.js, tune.js, debug.js
game/test/feel/serve.js         the dev server (node game/test/feel/serve.js, port 8788)
game/test/feel/lib.js           Playwright helpers
game/test/feel/sim.js           a Node harness for the physics alone, no browser
game/test/feel/probes.js        measurements 1 to 4 and the screenshots
```

`npm run build` passes: the new game is 15 files, 1.05 MB initial
download, of which three.js is 1.0 MB. Nothing under `public/`, `sim/`,
`parity/`, `game/src/tracks/` or `game/src/cars/` was touched.

The test track is a 712 m closed loop, 14 m wide with concrete walls
both sides: a 105 m start straight, a 150 degree sweeper of radius 55,
a straight, a radius 14 hairpin, a left-right chicane, a second radius
14 hairpin the other way, a 120 m straight and a radius 19 hairpin back
onto the start. Five clipping zones (the sweeper's outer wall, the
chicane's outer walls, the three hairpins' inner walls) are drawn in
orange and pay the proximity bonus. The car park is 150 by 110 m inside
a tyre wall with a slalom, a circle of cones for donuts, a gate and a
box; cones pay the near miss bonus too. Both are in the data shape
`briefs/TRACKS.md` asks the generator for, so a generated track drops in.

### The vehicle model

Two axles in the car's frame (x forward, y left, yaw positive left, as
three.js rotates about Y for a car that faces -Z), the world velocity
kept in world axes so collisions act on it directly. Per step:

- Steering: the driver's input slews to a lock that shrinks with speed
  (32 degrees at rest, 12 at 30 m/s); the assist adds countersteer
  proportional to body slip and yaw rate, with a spin guard past 55
  degrees, up to 40 degrees of lock.
- Loads: static split by the centre of mass (45 per cent front) plus
  longitudinal weight transfer through a 0.12 s filter.
- Each axle: slip angle, a tyre curve `s(2 - s)` up to the peak then an
  exponential fall to the tail (0.78 front, 0.70 rear), scaled by the
  friction circle of the axle's longitudinal demand. The rear spins when
  the drive exceeds its capacity (grip drops to 60 per cent, drive to
  85). The handbrake scales rear grip to 30 per cent and brakes it,
  then releases over 0.25 s.
- A guard that no axle may reverse its own lateral slip within a step
  (measured across the steered wheel at the front), which is what makes
  the car sit still instead of twitching.
- Below 3 m/s the car blends to a kinematic bicycle, keyed on total
  speed so a deep slide keeps its momentum.
- Collisions: six body points against wall segments with an inward
  normal, position correction and a rigid body impulse with restitution
  0.12 and friction 0.5. A hit over 4 m/s along the normal is hard:
  the chain is lost and the car keeps 55 per cent of its speed. Cones
  are knocked, roll and fall over, and are part of the run's state.

Found on the way, by the Node harness and then by the probes:

- The anti jitter guard measured the front's slip in the body frame, so
  a steered wheel on a straight car produced no force and the car ran
  wide at full lock. Measured across the wheel now.
- The low speed blend keyed on the forward velocity component, so a
  slide past 60 degrees lost its sideways momentum in a snap. Keyed on
  total speed now.
- A held full lock and full throttle spun the car every three seconds.
  An angle based limiter stabilised it but killed the sweeper drift,
  which lives at the same angles; the yaw rate control (a donut spin
  runs over 2 rad/s, a held sweeper slide under 0.8) separates them.
- The frame's float accumulator could land an ulp under a step and slip
  it into the next frame, which the determinism probe saw as a different
  run at 120 Hz: the step count is now rounded within a millionth of a
  step. The first frame after a restart no longer inherits a stale
  clock either.
- The tyre mark quads were wound by the direction of travel, so half of
  them were culled. Double sided now.
- three.js lights are in physical units in this build (a light is
  divided by pi), so the first scene was lit by the hemisphere alone;
  the sun is 3.6 and the hemisphere 2.4.

## Measurements, each with its known answer

Run: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node game/test/feel/probes.js`
(about 12 minutes, most of it the perf runs; name a probe to run one).
The drives use the scripted driver through `window.__feel` with the frame
loop stubbed and the page's own frame function called at 60 Hz, two
physics steps a frame, the draw skipped on the way.

### 1. Determinism (`determinism.json`)

- A 1,500 frame drive (2,998 steps, 2,063 run length tape entries) of
  the drift script, then the tape replayed from a fresh start through
  the step function: the state hash (position, yaw, velocity, yaw rate,
  steering, weight transfer, handbrake, every knocked cone, the step
  and hit counts) is identical. PASS.
- The same tape fed through the page's frame function at 120 Hz, one
  step a frame, with the player's input record overridden: identical
  hash. PASS. (This is what first caught the accumulator slip.)
- Known answer: the tape with one middle step's steer moved by 0.01:
  a different hash. CAUGHT.

### 2. The scripted driver and the drift script (`drive.json`)

- The driver laps the 712 m test track in 53.9 s, max |lateral| 1.34 m
  of a 7 m half width, zero wall contacts, zero respawns, 92 km/h top.
  PASS.
- The drift script (arrive at 19 m/s, 0.8 s of handbrake on entry, full
  throttle with a lift when running wide, pure pursuit on a short look
  ahead) holds above 30 degrees for 3.4 s continuously through the
  sweeper, mean 35.6 degrees at 76 km/h, no wall contact, max angle in
  the run 50 degrees. PASS (the brief asks for 2 s).
- Known answer, the driver with its steering inverted: does not lap,
  hits a wall. CAUGHT.
- Known answer, the drift script without its handbrake: 0.23 s above
  30 degrees. CAUGHT.

### 3. The camera (`camera.json`)

In 1280x720 and 390x844, every frame of the lap (3,235), the drift run
(3,088) and a run that drives into a wall and scrapes along it (600
frames, 2 contacts, with the shake): the car's eight bounding box
corners project inside the viewport, margin zero. Worst excess -0.398
in landscape and -0.296 in portrait, in normalised device units, so the
car was never closer than about 30 per cent of the half screen to an
edge. PASS, both.

Known answer: the camera looking 30 m up at the sky: 900 of 900 frames
off screen in both viewports. CAUGHT. (Looking 60 m ahead, my first
candidate, does not lose the car with these fields of view, which I
checked on paper before replacing it.)

### 4. Frame time (`perf.json`)

Forced WebGL 2, 390x844, low tier, the drift script driving, 420 frames
with the first 30 (shader compiles) reported separately, DevTools CPU
throttle via CDP. "JS without submit" is everything in the frame but
`renderer.render`, which is the number the low tier verdict uses, as
the stage 2 probe did; "submit" is `renderer.render` itself, which on
SwiftShader includes some of the software rasteriser's work on the
main thread and is an upper bound on a real GPU. The final run:

| throttle | JS without submit p95 / worst | physics p95 / worst | submit p95 | whole frame p95 / worst | first frames worst |
|---|---|---|---|---|---|
| 1x | 0.2 / 1.8 ms | 0.1 / 0.6 | 1.3 | 1.7 / 11.8 | 9.2 |
| 4x | 2.2 / 7.0 ms | 0.9 / 5.9 | 7.1 | 7.7 / 22.3 | 38.2 |
| 6x | 4.2 / 6.9 ms | 1.4 / 6.7 | 11.7 | 13.4 / 36.2 | 54.2 |

JavaScript p95 at 6x under 16.7 ms: PASS. The physics is 1.4 ms at two
steps a frame. An earlier run on the same code gave 5.4 / 16.1 ms for
the JavaScript and 17.5 ms for the submit at 6x, a whole frame of
19.5 ms p95: the sandbox's CPU is shared and the two runs bracket it.
The scene is 17 meshes, so the submission is the renderer's per frame
cost on this path, not draw calls, and it needs a real low tier device
to know what it is.

Known answer: 20 ms of busy work inside every frame (10 ms in each of
the two steps) at 4x: JS p95 2.2 to 24.3 ms, the verdict flips.
CAUGHT.

### Also checked, outside the four

Touch through CDP touch events in portrait: a thumb on the right
button steers right with the throttle automatic; sliding it to the
left button without lifting steers left; a second thumb on DRIFT sets
the handbrake and sliding it to BRAKE brakes with the throttle off;
releasing everything leaves the throttle on and the steer centred. A
key press after that hands the source back to the keyboard. The tune
panel: a slider moved to 12 wrote `v.accel=12` to the line, survived a
reload from localStorage, and reset to the defaults. A stubbed gamepad
with the stick at -0.7, the right trigger at 0.8 and A held gave
steer -0.659 (past the 0.12 deadzone), throttle 0.8, handbrake on.

## Screenshots

`shots/drift-1280x720.png` and `shots/drift-390x844.png`: the car in the
sweeper at 30 degrees and 80 km/h, the marked outer wall in orange, the
live chain by the car. `shots/park-1280x720.png` and
`shots/park-390x844.png`: a handbrake turn in the car park with the
touch buttons showing in portrait.

## What I would tune next, by playing

- The assist's spin control (`spin ctrl from` 0.8 rad/s, `full` 1.6,
  `lift` 0.9) is the lever between "a held button settles into a
  circle" and "the car can be thrown past 50 degrees". If the author
  wants bigger angles, raise `spin ctrl from` first.
- Countersteer gain 0.5 and yaw damp 0.15 were the only pair of those
  tried that gave both a stable donut and a held sweeper slide. Below
  0.4 the car spins; at 0.85 it snaps straight.
- `rear slide grip` 0.70 against `grip rear` 1.05 sets how long a slide
  lasts; `wheelspin grip` 0.60 sets how much the throttle loosens it.
  The sweeper is a fast corner and the front axle's grip is what runs
  out there, so raising `grip front` makes long slides easier to hold.
- Camera: `cam swing` 0.65 shows about two thirds of the drift angle;
  the portrait rig sits 25 per cent higher and looks 30 per cent further
  ahead than landscape. The horizon sits at about 38 per cent of the
  height in both.
- Scoring rate 0.011 points per second per degree per km/h, a
  multiplier step every 2 s of drift: a good sweeper is about 400
  points at x3. Nothing is balanced yet.

## Not done, and deviations from the brief

- Tilt steering: DESIGN.md calls it an option; FEEL.md's controls list
  does not include it, so it is not built.
- No smoke on the low tier beyond 40 puffs, no shadows, no post
  processing: plain shapes as the brief asks.
- The frame rate on a real Chromebook and a real phone is unmeasured
  (no GPU here); `?debug=1` reports it on the device.
- The scripted drift test exercises one section (the sweeper), as the
  brief asks. The hairpins and the chicane are driven by the lap test
  only.
- Measurement 2 says "without leaving it"; the walls are solid, so the
  check is stricter: inside the walls, never touching them, no respawn.
- The known answer for the camera is "looking at the sky", not the
  "looking far ahead" I first wrote, for the reason above.
- `tools/serve.js` and `package.json` were not touched (they are outside
  the brief's folders), so the game's dev server and the probes are run
  with `node game/test/feel/...` rather than npm scripts.
- The build counts `game/test/` out of the shipped files, so the probes
  and the Node harness are not served from the preview.

---

## After play, 29 October 2026: pace, spins, getting stuck

The author played it: too slow to accelerate, the turn tips into an
uncontrollable spin, and the car gets stuck facing a wall with almost no
way to reverse. Measured by `game/test/feel/handling.js` (output
`handling.json`), before and after:

| | before | after |
|---|---|---|
| 0 to 100 km/h | 7.2 s | 3.4 s |
| speed after 5 s | 77 km/h | 125 km/h |
| top speed on the flat | 133 km/h | 168 km/h |
| slide angle, full steer held at 15 m/s | 90 degrees | 4 |
| slide angle, DRIFT tap then steer held | 90, never held | about 45, held, carrying speed |
| spins over 12 player-like patterns | every one slid to 90 | 0 |
| nose to a wall, throttle on | stuck | back on track in 1.4 s |
| nose to a wall, reverse | stuck (reverse was braked at 0.3 m/s) | clear in 1.1 s |

Known answers, both caught: with the assist off 4 of 12 patterns spin;
with the recovery off the car stays stuck.

What changed:
- **Pace:** more drive and a higher top speed, and launch traction so a
  standing start hooks up instead of spinning the rear.
- **Reverse was broken:** the brake acted against motion either way past
  0.3 m/s, so reverse never got past walking pace. The brake now acts
  against forward travel only; the brake button is labelled REVERSE too.
- **A drift controller** (`vehicle.js`, `TUNE.ASSIST.DRIFT_*`): the DRIFT
  button kicks the tail out; once sliding, how far the steering points
  into the corner sets the angle (about 45 degrees at full steer), and
  letting go of the steering straightens the car. Steering out of the
  slide ends the drift. An angle limiter at 58 degrees and damping on the
  slide angle stop overshoot.
- **Walls** pass on only 35 per cent of a hit's turning, so the car
  slides along a wall instead of being spun to face it.
- **Getting unstuck:** barely moving while trying to drive, against a
  wall or facing backwards, for 1.2 s, puts the car back on the track
  pointing the right way at 29 km/h.
- The scripted drift driver now steers into the turn, as the controller
  expects.

All FEEL.md probes rerun and pass: replay bit identical; the driver laps
in 50.8 s without touching a wall; the drift script holds over 30 degrees
for 2.13 s through the sweeper at a mean 43.7 degrees and 63 km/h; the
car stays on screen in every frame at both viewports; JavaScript p95 5.3
ms at 6x throttle. Each known answer was caught.

---

## After play, 29 October 2026 (second round): no brake, a drift that carves

The author: the brake does not work well and should not be a separate
control; starting a turn in the car park and hitting DRIFT kept all the
car's momentum and slid it straight on into the barrier. A drift should
slow the car and take it round in an arc, Drift Boss style, where the
skill is timing.

- **No brake, no throttle.** The car drives itself once the player has
  pressed anything. The controls are left, right and DRIFT. DRIFT with
  steering drifts; DRIFT with no steering stops the car (90 to 20 km/h in
  2 s). Keyboard: left and right steer; space, shift, up, down, W or S
  drift. Gamepad: stick or d-pad steer; A, B, X or a trigger drift. There
  is no reverse; getting unstuck is automatic. The physics still takes a
  brake and throttle, for the scripted driver.
- **The drift carves and slows.** The give-back of speed in a drift is
  gone. In a drift the car's path now bends towards where it points
  (`DRIFT_CARVE`), and the slide scrubs speed down to 72 km/h
  (`DRIFT_SCRUB`, `DRIFT_CRUISE`), all tunable at `?tune=1`.

Car park, from the start, then steer right and hold DRIFT
(`handling.json`, `parkArc`):

| drift starts after | speed then | slowest in the drift | turned | radius | closest to the barrier | wall hits |
|---|---|---|---|---|---|---|
| 2.0 s | 67 km/h | 56 km/h | 248 deg | 16.6 m | 23.8 m | 0 |
| 2.6 s | 83 km/h | 64 km/h | 241 deg | 19.2 m | 7.8 m | 0 |
| 3.2 s | 96 km/h | | 113 deg | | 1.9 m | 2 |

Known answer: the previous drift from 2.6 s hits the barrier. A drift
started 3.2 s in, about 10 m from the barrier, still hits it: that is a
late turn.

The drift measurement moved from the sweeper to hairpin 2: a held 30
degree slide now turns tighter than the long fast sweeper, so it belongs
in a hairpin. The scripted drifter holds over 30 degrees for 1.9 s
through hairpin 2 (the whole corner) at a mean 42.2 degrees and 53 km/h,
lapping without touching a wall; without its handbrake it holds 0 s
(caught). All other probes rerun and pass; JavaScript p95 3.4 ms at 6x.

---

## After play, 29 October 2026 (third round): turning on grip, easing into a drift

The author: turning without drifting does not turn enough, and the drift
snaps in instead of easing in. `handling.json`, `gripAndBuild`:

| from | grip turn radius, full steer | most slide | drift to 30 degrees | fastest slide growth |
|---|---|---|---|---|
| 43 km/h | 50 m before, now 10.6 m | 3 degrees | 0.33 s before, now 0.75 s | 116 deg/s before, now 87 |
| 72 km/h | 77 m before, now 17.3 m | 3 | 0.72 s | 61 |
| 101 km/h | 100 m before, now 32.4 m | 10 | 0.71 s | 58 |

What changed:
- **Arcade grip:** about 1.5 g in a turn instead of 1 g (`MU_FRONT` 1.8,
  `MU_REAR` 2.1, the rear the grippier so a hard grip turn grips instead
  of stepping out).
- **A held turn holds its speed:** the self-driving throttle eases off by
  `TURN_LIFT` (85 per cent at full steer) on grip; before, the car
  gathered speed through every turn and ran wide.
- **The spin control only acts on a slide:** it cut the steering whenever
  the car turned quickly, grip turns included. It now fades in between
  10 and 25 degrees of slide (`SLIDE_FROM`, `SLIDE_FULL`).
- **The drift eases in:** the handbrake takes the rear's grip over 0.25 s
  (`HANDBRAKE_ENGAGE`), and the angle the drift holds grows at no more
  than 50 degrees a second (`DRIFT_EASE_IN`).
- **A drift keeps its speed:** the rear keeps 35 per cent of its grip for
  the whole drift (`DRIFT_GRIP`), not only while DRIFT is held; with full
  grip back at 40 degrees of slide it scrubbed to walking pace. A held
  drift now sits near 46 degrees at 43 to 70 km/h.

Known answers: the first prototype's tune spins 8 of 12 patterns (the
previous known answer, assist off, no longer spins with this much grip,
so it was replaced); with recovery off the car stays stuck; the previous
drift hits the car park barrier. The scripted drifter now steers by the
angle from its direction of travel to its target, as a drift follows its
path and not its nose, and drifts through hairpin 2 for 2.23 s over 30
degrees at a mean 43 degrees and 61 km/h with no contact. All probes
pass; JavaScript p95 3.3 ms at 6x.
