# The game loop: report

Branch `crazygames-loop`, DESIGN.md build steps 2 and 3 put together,
brief `briefs/GAME-LOOP.md`. Every number below was measured by
`game/test/loop/probes.js` in headless Chromium on the forced WebGL 2
path, and the JSON beside this file is what it wrote. The track
generator and the five car models were merged to `main` during this
work and are used; nothing stands in.

## In short, for a phone

- It is a game now. A title screen with four big buttons: **Daily
  drift** (one seeded track for the local date, the same for everyone,
  a sprint or a circuit by the seed's parity), **Career** (eight fixed
  seeds, circuits and sprints by turns, each unlocked by one star on the
  one before), **Free drift** (the car park, no timer) and **Garage**
  (five cars, eight paints, coins).
- A run: 3 2 1 GO, the drive (three laps of a circuit, counted at the
  start line only once every checkpoint has been passed in order, or a
  sprint to its finish line), then a results card: the score, the best
  chain, stars against three targets, the run time, the coins earned,
  and one big GO AGAIN (also DRIFT, Enter, R or a gamepad face button).
  Career runs offer NEXT when the next track is open.
- The best run of every track is saved on the device as its input tape
  and replayed as a translucent ghost through a second copy of the
  physics, in lockstep with your run. Measured: it ends in exactly the
  recorded state and sits on the recorded position in every one of
  4,961 sampled frames; one tape entry moved by 0.01 of steer is caught.
- Coins: 0.02 a point plus 25 a star, the daily paying half as much
  again. The cars cost 900, 1,800, 3,200 and 6,000; a paint other than a
  car's own costs 60. Each car is the author's tune with a few
  overrides (`game/src/garage/roster.js`): the hatch is short, light and
  quick to steer; the tourer long, heavy, slow to steer and damped in a
  slide; the fastback has the power; the drift build holds the biggest
  angles. The starter is the tune itself, untouched.
- Tracks are drawn with the generator's own mesh builder (road, edges,
  kerbs, run-off, barriers by kind, clipping posts, the lines), plus a
  gantry over the start and a sprint's finish. Generated flat
  (`elevation: 0`) because the physics is flat.
- Measured: the scripted driver finished three generated circuits and
  four generated sprints through the whole structure with a results
  screen every time (circuits 84 to 87 s, sprints 35 to 49 s); the save
  survives a reload; the game runs to a results screen with
  `localStorage` throwing on every call, in both the ways it can; a
  save that is not JSON, and one that is JSON of the wrong shape, both
  load to a valid state; JavaScript is 2.2 ms p95 and 8.3 ms worst per
  frame at 6x CPU throttle with the ghost running. Every known answer
  was caught.
- Honest caveats: nothing is balanced. The star targets are a first
  guess (0.55 points per metre of run for the first star, then 2.2 and
  4 times that) and the scripted driver, which drifts badly on
  generated corners, earned no stars on any track. The run lengths
  are the generator's: a three lap circuit takes the scripted driver
  about 85 s, which is inside the brief's 60 to 120 s, but a drifting
  player will be slower. Nobody has played it with thumbs.

## What was built

```
game/src/main.js              the host: title, career, garage, countdown, drive, results, free, dev
game/src/tune.js              + LOOP: every loop constant (countdown, laps, stars, coins, prices, the ghost)
game/src/loop/save.js         the save: one key, every call wrapped, a validator that repairs a bad blob
game/src/loop/progress.js     laps, checkpoints in order, the finish line
game/src/loop/ghost.js        the ghost: a second world stepping the recorded tape in lockstep
game/src/loop/modes.js        the career ladder, the daily spec, star targets, coins
game/src/garage/roster.js     the five cars: names, prices, paints, dims, handling overrides
game/src/ground/source.js     tracks from the generator (elevation 0, memoised), dailySeed, the car park
game/src/render/car.js        car models from ../cars/, and the see through copy for the ghost
game/src/render/scene.js      the track through buildTrackMesh, gantries, the ghost, the car by model
game/src/ui/screens.js        title, career, garage, results
game/src/ui/hud.js            + lap or distance, the clock, the best to beat, the countdown, exit
game/src/input/input.js       + a started gate for the countdown, an action edge for go again
game/src/physics/vehicle.js   reads a car's own tune when it has one (prototype: the author's tune)
game/src/physics/world.js     createWorld(ground, { tune })
game/src/physics/driver.js    drift: '*' drifts every section, for the measurements
game/test/loop/lib.js, probes.js   the measurements and the screenshots
```

`npm run build` passes: 36 files, 1.24 MB initial download including
three.js. Nothing under `public/`, `sim/`, `parity/`, `game/src/tracks/`
or `game/src/cars/` was changed. The feel probes (`handling.js`,
`probes.js`: determinism, drive, camera) were rerun and pass unchanged.

### How a run works

The host is a state machine. In the menus the physics does not step and
the camera orbits the chosen car on the daily track's start line. A run
builds its track once (memoised, so going again is instant), a world
with the chosen car's tune, a progress tracker and, if the track has a
saved ghost, a second world for it. The countdown counts in frame time
with the car held; at GO the throttle is released (the countdown is the
gate the feel prototype's "press anything" was) and the tape starts. At
the finish the open chain is banked, the results are computed and saved,
and the car is brought to a halt behind the card with DRIFT and no
steering, which is the game's brake. Going again restarts the same
spec; the ghost is the new best if the score beat it.

A circuit's lap counts when the car crosses the start line forwards
having passed every checkpoint (the generator's three, in order) since
the last crossing, so the respawn and shortcuts cannot count one. A
sprint finishes at its finish line with its checkpoints passed.

### Per car handling

`createVehicle(x, z, yaw, tune)`: a car's tune is a pair of objects
whose prototypes are `TUNE.VEHICLE` and `TUNE.ASSIST` with the car's
overrides as own properties, so a `?tune=1` slider still reaches every
constant a car does not override, the starter is `TUNE` itself, and the
ghost steps with the tune of the car it was recorded in. Nothing in the
author's tune was changed.

## Measurements, each with its known answer

Run: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node game/test/loop/probes.js`
(about 40 minutes, most of it the shots and the perf runs; name a probe
to run one). The drives use the scripted driver drifting every section
through `window.__loop` and `window.__feel`, the frame loop stubbed and
the page's own frame function called at 60 Hz, two physics steps a
frame.

### 1. The ghost (`ghost.json`)

- Career track 1 (circuit 1101, 566 m, three laps) recorded through the
  real run structure: 10,040 steps, 5,776 tape entries, score 824, saved
  as `career:0`. The same track started again with the ghost: the
  ghost's end hash (position, yaw, velocity, yaw rate, steering, weight
  transfer, handbrake, cones, step and hit counts) equals the recorded
  run's. PASS.
- In the second run the ghost's position and yaw were compared with the
  recording's at the same step in 4,961 frames: 0 differ, worst
  difference 0, and the ghost's step count equalled the player's in
  every frame it was running. PASS.
- Known answer: tape entry 2,888's steer moved by 0.01 in the saved
  ghost: a different end hash. CAUGHT.

### 2. Runs through the whole structure (`runs.json`)

Career 1 to 6 and the daily, each from the title through countdown,
drive and results, with the results card in the DOM showing the same
score the host computed:

| run | track | length | corners | laps | time | score | best chain | stars (targets) | contacts (hard) | drift frames |
|---|---|---|---|---|---|---|---|---|---|---|
| career 1 | circuit 1101 | 566 m | 5 | 3 | 83.7 s | 824 | 137 | 0 (930 / 2,050 / 3,740) | 3 (3) | 1,213 |
| career 2 | sprint 1202 | 844 m | 5 | 1 | 34.5 s | 19 | 9 | 0 (440 / 970 / 1,770) | 2 (2) | 146 |
| career 3 | circuit 1303 | 642 m | 5 | 3 | 84.1 s | 57 | 10 | 0 (1,060 / 2,330 / 4,240) | 4 (3) | 316 |
| career 4 | sprint 1404 | 982 m | 13 | 1 | 43.9 s | 202 | 123 | 0 (520 / 1,140 / 2,070) | 1 (0) | 406 |
| career 5 | circuit 1505 | 604 m | 8 | 3 | 86.7 s | 369 | 92 | 0 (1,000 / 2,190 / 3,990) | 3 (3) | 744 |
| career 6 | sprint 1606 | 1,034 m | 14 | 1 | 48.5 s | 221 | 150 | 0 (550 / 1,200 / 2,190) | 5 (2) | 477 |
| daily (31 Oct 2026) | sprint 1976143581 | 992 m | 7 | 1 | 39.4 s | 87 | 51 | 0 (520 / 1,150 / 2,090) | 5 (2) | 282 |

Three circuits and four sprints finished, no respawns. PASS. The
scripted driver's handbrake drift script was written for the test
track's hairpins; on generated corners it loses the slide early and
hits walls, so its scores say nothing about what a player scores. They
do say the structure runs end to end on every track.

Known answer: `LOOP.LAPS` set to 99 on career 1 with half the budget:
5 laps done, still driving, no results. CAUGHT.

### 3. The save (`save.json`)

- A run on career 2, then 5,000 coins added, the hatch bought and
  chosen and painted lime, and the page reloaded: the save is identical
  (4,100 coins, car hatch, paint lime, career 2's stars and best, the
  ghost with 4,138 steps). PASS.
- The ladder: track 2 locked at the start and the action to play it
  refused; a run of track 1 with no star leaves it locked; one star
  opens it and only it. PASS.
- `localStorage` throwing: with the property itself throwing (which
  took the first build down before the title, because `typeof
  localStorage` evaluates the getter; the store is now taken inside a
  try) and with every method throwing (3 of 3 writes failed, counted),
  the game loads, runs career 1 to a results screen (score 824) and
  shows the title with "no memory on this device", with no page
  errors. PASS, both.
- A save that is not JSON, and a save that is JSON of the wrong shape
  (coins a string, a car that does not exist, cars a string, a career
  entry with stars as a word and a negative best, daily a number, one
  ghost with a tape entry that is not numbers and one good ghost): both
  load (repaired 1 and 7 fixes), the state is valid (0 coins, the
  starter, the good ghost kept and the bad one dropped), and career 1
  runs to a results screen with no page errors. PASS, both.
- Known answer: the wrong shaped save fails the state invariants (a
  finite non negative coin count, a chosen car that is owned, stars 0 to
  3, every ghost valid) raw, and passes them after repair. CAUGHT.

### 4. Frame time (`perf.json`)

Forced WebGL 2, 390x844, low tier, career 1 (a generated circuit) with
the ghost of the previous run stepping in every one of the 390 measured
frames, the scripted driver driving, 420 frames with the first 30
reported separately, DevTools CPU throttle via CDP. As in the feel
report, "JS without submit" is everything in the frame but
`renderer.render`, which is the number the verdict uses; "submit" on
SwiftShader includes software rasterisation on the main thread and is
an upper bound on a real GPU.

| throttle | JS without submit p95 / worst | physics p95 / worst | submit p95 | whole frame p95 / worst | first frames worst |
|---|---|---|---|---|---|---|
| 1x | 0.2 / 7.5 ms | 0.1 / 7.4 | 2.6 | 3.0 / 12.5 | 110 |
| 4x | 1.8 / 20.2 ms | 1.0 / 13.5 | 8.9 | 10.7 / 83.7 | 284 |
| 6x | 2.2 / 8.3 ms | 1.5 / 8.1 | 8.4 | 9.9 / 21.4 | 501 |

JavaScript p95 at 6x under 16.7 ms with two worlds stepping: PASS.
The first frames are the track mesh and the car models reaching the
GPU (shader compiles); half a second at 6x happens once, behind the
countdown.

Known answer: 20 ms of busy work inside every frame at 4x: JS p95 1.8
to 23.7 ms, the verdict flips. CAUGHT.

## Screenshots

`shots/` holds every screen in 1280x720, 390x844 and 844x390: `title`,
`career`, `garage` (the tourer picked, not owned), `countdown`, `drive`
(mid drift on career 1 with the ghost, the chain by the car, the lap and
the clock, the best to beat), `results` and `free` (a handbrake turn in
the car park with the touch pad showing).

## Not done, and deviations from the brief

- **Balance.** Star targets, coin rates and prices are first guesses in
  `LOOP`; the scripted driver earned no stars, and it is not a measure
  of a player. The author decides these by playing.
- **The countdown releases the car at GO.** The feel prototype waited
  for the player's first press; a run with a countdown would otherwise
  sit at GO until a key was pressed and the clock would be meaningless.
  The controls themselves (left, right, DRIFT, no brake, the car drives
  itself) are unchanged, and free drift still waits for the first press.
- **Run lengths.** Circuits are the generator's at the lengths
  `modes.js` asks for (560 to 660 m, three laps as the brief says);
  sprints 800 to 1,100 m. The scripted driver takes 84 to 87 s and 35 to
  49 s. If a drifting player runs long, `LOOP.LAPS` and the lengths in
  `CAREER` are where to cut.
- **Tracks are flat.** The generator's elevation and bank are asked off
  (`elevation: 0`) because the physics and the camera are flat; the
  track session says the same in `CLAUDE.md`.
- **No upgrades, no underglow, no tyre smoke colour**: the brief says
  keep it simple; paint is the one cosmetic.
- **The ghost's hash is stored but not checked on load**, only its
  shape: a tape that no longer replays to its hash (after a handling
  change) will drive a different line, which is honest rather than
  wrong. A handling change should bump `LOOP.SAVE_VERSION` to drop old
  ghosts.
- **Tilt steering and gamepad on the screens** are not built; the
  screens take touch, mouse and the keyboard's Enter on a focused
  button; GO AGAIN takes DRIFT, Enter, R and a gamepad face button.
- `?ground=track` and `?ground=park` keep the feel prototype's endless
  drive with no countdown or results, so the feel probes run unchanged.
- `package.json` and `tools/serve.js` are outside the brief's folders, so
  the loop probes run with `node game/test/loop/probes.js`.
- The car session's note: a rear wheel vanishing after a sliding frame in
  software WebGL 2 was not seen in the screenshots here, and was not
  looked for.
