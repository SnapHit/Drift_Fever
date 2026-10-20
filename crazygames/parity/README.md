# The parity test

`npm run parity` proves that `sim/drift-fever-sim.js` is the simulation in
Drift_Fever's `index.html` at the commit pinned in `vendor/original/COMMIT`,
read out of this repository's own history, by running both on the same
roads and the same input tapes and comparing every frame.

## How it works

- `browser.js` serves the original page (`git show <commit>:index.html`,
  via `tools/original.js`), a host page for the module and, under
  `/page/`, the shipped greybox page from its sources, from one local
  http server, and opens them in one headless Chromium. One
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
  `topUpRoad` over the whole track the way `update` does (the camera's
  segment to `topUpRoad`, the car's index off the same position) and
  hashes every segment, hazard and jump as it appears, because `topUpRoad`
  trims behind the camera. A drive job feeds a tape in as tilt or as held
  keys, lets the game's own `updateSteering` make `steering.value` of it,
  steps the frame, and hashes the state every frame: every scalar top level
  variable of the simulation (173 of them, generated from the module's own
  list, minus the ones the renderer owns), the drift, the ghost cursor, the
  racers, the input, every field of every segment from six behind the car
  to forty eight ahead (where tyre marks are laid and generation arrives)
  and every field of every hazard and jump, close call ledger included.
  Event lists (deaths with their kind, taps, continues, next levels, every
  scripted call) are compared as well as the hashes.
- `tapes.cjs` holds the input tapes: `driver` reads the hazard list and
  the curvature ahead and finishes every level, then takes the one tap
  into the next level once the finale has run its course; `keys` is the
  same driver as digital input, for the ramp and the clamp; `centre` and
  `hug` are plain closed loops on `carFrac` and reach the gates, so their
  deaths are followed by continues; `swing` and `chaos` are open loop, die
  before the first gate, and exercise the off road death, the buffered
  reflex restart and the fresh run after it. The random stand in is
  reseeded at every tap and every scripted call, because the original's
  particle effects consume draws the module's hooks do not, and in endless
  the seed after a continue is drawn from it.
- A `routes` job is a scripted session through the game's own entry
  points by name: pause and resume, the title screen from pause, the car
  pick, the mode switch, endless, the title route with and without a
  training record, skipping training, a crash and the restart after it, a
  hit, a finish, the finale skipped, the next level, with the centre tape
  steering whenever the car is driving.
- A `records across reloads` group finishes training, reloads the original
  page (its localStorage survives) and makes the module again over the
  same store, and snapshots what came back: records, the daily ghost, the
  car pick, the training flag. A run of the same level then drives against
  that ghost on both sides.
- `jobs.js` builds the jobs (28 days x 6 levels x 6 tapes, plus endless,
  routes, records, a run out of time, a fresh player on the eased ramp,
  the real frame, two viewports and two perturbations); `orchestrate.js`
  runs them, compares, and writes `out/report.json`.

## Known answers

- K1 a different day gives a different road and a different drive.
- K2 a perturbed constant makes the comparison fail, on the physics side
  (`HEADING_BUILD_TIME`) and on the generator side (`CHECKPOINT_EVERY`).
- K3 the original gives the same roads and drives at 390x844 and 1280x720.
  A property of the original, checked because the module cannot have it
  any other way.
- K4 both sides boot on a sentinel day and `startRun` rolls them to the
  job's day through the game's own `rollDayIfNeeded`; the day rolled from
  matches on both sides for every job.
- K5 the original page's own frame loop is dead while the probe drives.
- K6 the original advanced by its own `frame(t)`, drawing every frame, with
  integer millisecond timestamps 17 apart, matches the module's `step(dt)`
  on the same dt sequence. This is what checks the probe's own copy of the
  frame order, and the module's, against the real thing.
- K7 every ending is reached at least once: off road, a hit, running out
  of time, a finish, a continue and a next level.
- K8 the shipped greybox page (`public/`), driven through its own frame
  function with the 3D renderer attached, matches the original driven
  through its own `frame()` frame for frame, on real frame jobs across
  the six levels, endless, the routes script and a reload; two of the
  jobs put the input in through the page's own handlers (arrow key
  events, pointer events on the two halves of the canvas, Enter for a
  tap), on both sides. The known answer: a page whose renderer writes
  one simulation field it should only read (`carPitch`, set by
  `window.__parityBreak` before load) must fail the comparison. Both
  pages run at a small viewport (120x260) because the headless GPU is a
  software rasteriser and its cost is per pixel.
- K9 the shipped page gives the same drive at 390x844 as at the small
  viewport.

The comparison is against the untuned original: no `?debug=1`, no stored
tuning, `seedPinned` false.

## Does drawing feed back into the simulation

`node parity/render-feedback.js` drives the original with `render()`
called after every step, as the live frame loop does, and compares
against the same drives without it, at a phone and a desktop viewport.
The extraction found one path from the renderer into the generator:
`render()` writes `camHeight` with a viewport term while the car is in
the air, and `sightClear` reads `camHeight` when a jump is being placed.
The module reads the reference camera height by construction. Measured at
the shipped constants: 5 of 5 drives drawn every frame at 390x844 and at
1280x720 were identical to the undrawn drives, and 140 of 140 drives with
render's exact write reproduced in Node were identical at both aspects.
The clause does fire at the shipped hill amplitude (a camera 20 per cent
lower changes 85 of 168 roads, 20 per cent higher changes 4), so the path
is live and the fix belongs in Drift_Fever: render should not write the
variable the generator reads. Until then this probe is the measurement.

## The stamp

`npm run parity -- --stamp` records a pass in `parity/stamp.json` with the
hashes of the files it covered. `npm run build` runs `--check`, which
refuses to build if any of those files changed since the stamp. Commit the
stamp with any change to the module, the original or the test.
