# The parity test

`npm run parity` proves that `sim/drift-fever-sim.js` is the simulation in
`vendor/original/index.html`, by running both on the same roads and the
same input tapes and comparing every frame.

## How it works

- `browser.js` serves the original page and a host page for the module
  from one local http server and opens both in one headless Chromium. One
  engine on both sides, because Node's Math library differs from
  Chromium's in the last bit of `sin` and `exp`, and a two minute drive
  turns that into a different trace. The comparison is exact.
- In the original page `requestAnimationFrame` is a no-op before the game
  script runs and the frame function is rebound to nothing after it, so the
  probe is the only thing that ever advances the world (checked: K5).
  `Math.random` is the same seeded generator on both sides. The clock is
  pinned to each job's day with Playwright's clock, so `startRun` rolls to
  the probe's day through the game's own `rollDayIfNeeded` (checked: K4).
- `probe.cjs` is the same file on both sides. It talks to the game through
  `S.get`, `S.set` and `S.fn` only. A road job calls `startRun`, walks
  `topUpRoad` over the whole track and hashes every segment, hazard and
  jump as it appears, because `topUpRoad` trims behind the camera. A drive
  job writes `steering.value` from a tape, steps the frame, and hashes the
  gameplay state every frame, racers included.
- `tapes.cjs` holds the input tapes: `driver` reads the hazard list and
  the curvature ahead and finishes every level, then takes the one tap
  into the next level once the finale has run its course; `centre` and
  `hug` are plain closed loops on `carFrac`; `swing` and `chaos` are open
  loop and exercise the deaths, the buffered restart and the continue from
  a checkpoint. The random stand in is reseeded at every tap, because the
  original's particle effects consume draws the module's hooks do not,
  and in endless the seed after a continue is drawn from it.
- A `routes` job is a scripted session through the game's own entry
  points by name: pause and resume, the title screen from pause, the car
  pick, the mode switch, endless, skipping training, the daily from the
  title, with the centre tape steering whenever the car is driving.
- `jobs.js` builds the jobs (28 days x 6 levels x 5 tapes, plus endless,
  routes, a fresh player on the eased ramp, two viewports and two
  perturbations); `orchestrate.js` runs them, compares, and writes
  `out/report.json`.

## Known answers

- K1 a different day gives a different road and a different drive.
- K2 a perturbed constant makes the comparison fail, on the physics side
  (`HEADING_BUILD_TIME`) and on the generator side (`CHECKPOINT_EVERY`).
- K3 the original gives the same roads and drives at 390x844 and 1280x720.
- K4 the day the runner set is the day `startRun` rolled to, both sides.
- K5 the original page's own frame loop is dead while the probe drives.

## The stamp

`npm run parity -- --stamp` records a pass in `parity/stamp.json` with the
hashes of the files it covered. `npm run build` runs `--check`, which
refuses to build if any of those files changed since the stamp. Commit the
stamp with any change to the module, the original or the test.
