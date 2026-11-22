# Brief: real controls on a keyboard and a gamepad (22 November 2026)

Branch `crazygames-controls`. Folders: `game/src/input/`,
`game/src/physics/` (the player's handling only; see Rules),
`game/src/tune.js` (the `VEHICLE`, `ASSIST` and `CONTROLS` blocks and a
new profiles block only), `game/src/loop/ghost.js` and `save.js` (what a
ghost records), `game/src/ui/onboard.js` (the prompts),
`game/src/ui/screens.js` (the title's hint line and one toggle),
`game/src/main.js` (wiring only), `game/test/controls/` (new),
`review/controls/` (new). Nothing in `render/`, `env/`, `cars/` or
`camera/`: round 1A (`briefs/COVER-LOOK.md`) works there at the same
time. Nothing outside `crazygames/`. Never push to `main`.

Read `../CLAUDE.md` first, all of it, then `../ROADMAP.md`, then
`../DESIGN.md` (its Driving section describes what this round brings
back).

## Why

CrazyGames rejected the game on 22 November for overall quality. Our
reading (ROADMAP.md, point 2): on a keyboard the car drives itself. The
throttle is always on, there is no brake, and W, S, Up, Down, Space and
Shift all press the one DRIFT button (`input/input.js`, "Since 29
October 2026 there is no brake and no throttle"). In a drift the assist
holds the angle the steering asks for. That is right for thumbs on a
phone and wrong for a desktop, which is most of CrazyGames' audience:
PolyTrack ("WASD / arrow keys = drive") and Drift Hunters (WASD or
arrows, Space for the handbrake) both hand the player the car. The
physics already models throttle, brake, reverse, weight transfer and a
handbrake (`physics/vehicle.js`); the input switches them off.

**The goal: on a keyboard or a gamepad the player drives the car,
starts a slide with the handbrake or a flick, holds it with the throttle
and the steering, and loses it by getting either wrong. On touch,
nothing changes.**

## What to build, in priority order

Everything behind `?controls=pro` until the author has played it; then
Pro becomes the default on a keyboard and a gamepad.

1. **Pro inputs.** Keyboard: W or Up drives, S or Down brakes and then
   reverses once stopped, A D or Left Right steer, Space (and Shift)
   is the handbrake, R restarts; letters by where the key sits, as now,
   so ZQSD works on AZERTY. Keys are on or off, so the throttle and the
   brake ramp in and out over a tunable time rather than jumping.
   Gamepad: right trigger throttle and left trigger brake and reverse,
   both analogue, left stick or d-pad steer, A or X the handbrake, Y or
   start restarts; menus as now. The input record already carries
   throttle 0 to 1 and brake 0 to 1; fill them.
2. **Pro handling.** A handling profile for the player's car on Pro,
   layered on the car's own tune (`createVehicle`'s tune pair), never
   on `TUNE` itself, so rivals and Easy are untouched. Arcade, not a
   simulation: easy to start a slide, a skill to hold one. The throttle
   holds and widens the angle (power oversteer at the rear), lifting
   closes it, countersteer catches it, too much of either spins or
   straightens. The assist lighter than on a phone, still there.
   **Three variants**, `?pro=a`, `b` and `c`, from most helped to
   least, each a named set of numbers in one block, so the author picks
   one by play rather than anyone picking by measurement.
3. **Easy stays as it is.** Touch keeps the automatic throttle and the
   DRIFT / BRAKE button, bit for bit. A keyboard or gamepad player can
   choose Easy with one toggle on the title, remembered on the device
   (a preference, not the save).
4. **Ghosts know how they were driven.** A ghost records its profile
   and variant, and replays with them; a ghost with no profile is Easy.
   A Pro run's best keeps its own ghost; an Easy run's ghost still
   replays the same as today.
5. **The words.** The first run's prompts on Pro: drive, steer,
   handbrake to slide, throttle to hold it, brake; key caps by layout
   as now. The title's hint line says what the player's own input does
   (it says "The car drives itself" today, which is false on Pro).
   `SUBMISSION.md`'s controls are not changed by this round.

## Rules

- **Easy is the game as it is.** With Easy (touch, or the toggle, or no
  `?controls=pro`), every recorded run, ghost and rival race replays to
  the bit: `game/test/park/same.js` against `main`, and the Kestrow
  race to the same totals.
- **Rivals are untouched.** They drive with their own hands and tune;
  their races are the same to the bit on Pro and on Easy. Balance on Pro
  is for the author's play in round 2, not this round.
- **No new physics without need.** Prefer numbers in the profile over
  new code in `vehicle.js`. If the model cannot do something Pro needs
  (for example the throttle has no effect on the angle while the drift
  controller holds it), change the smallest thing, keep every term
  exactly zero on Easy, and say so in the report.
- **Deterministic.** Same inputs from the same start, same run, on Pro
  as on Easy. The ramps are counted in physics steps, never in frames
  or the clock.
- Score rules, star targets, missions, park levels and prices are not
  changed in this round.
- Australian spelling, no em or en dashes, every tunable named in a
  block at the top of its file with a comment, model names and session
  identifiers never in commits, code or comments.

## Measures, each with a known answer that can fail

1. **Easy unchanged.** `park/same.js`, the recorded tapes and the
   Kestrow race, against `main`. Known answer: one Easy assist number
   moved one per cent is caught.
2. **The keys reach the car.** On Pro, W ramps the throttle to full in
   the set time, S brakes, S held at a standstill reverses, Space locks
   the rear, letters by position on a simulated AZERTY layout. Known
   answer: the throttle key unbound fails the probe.
3. **The throttle steers the slide.** On each variant, a scripted
   input on an open ground (the stunt park): a handbrake entry at 20
   m/s, then the throttle held at three levels with countersteer. The
   held slide angle must rise with the throttle, and lifting must
   close it within a second. Report angle against throttle for a, b and
   c. Known answer: on Easy, where the controller holds the angle, the
   same inputs show little or no rise, and the probe says so.
4. **A slide can be lost.** On each variant, too much throttle with no
   countersteer spins the car (slip past 90 degrees) within three
   seconds; on Easy it does not. Known answer: the assist at full
   strength is caught as unspinnable.
5. **Ghosts.** A Pro run's tape replays to the same hash with its
   recorded profile, and to a different one if replayed as Easy. An
   Easy ghost from `main`'s save replays unchanged. Known answer: the
   profile dropped from the ghost is caught.
6. **Gamepad.** Fed button values: half right trigger is half throttle,
   left trigger brakes, the stick steers; menus still reachable
   (`ready/pad.js`). Known answer: triggers swapped are caught.
7. **Words and layout.** The prompts and the title's hint on Pro, Easy
   and touch at 390x844, 844x390, 800x450 and 1280x720: nothing under
   44 px, nothing off the screen, the hint true to the input. Known
   answer: the old "drives itself" line on Pro is caught.
8. **Nothing else changed.** `play15/check.js`, `start/check.js`,
   `bench/check.js`, `ready/keys.js`, `ready/pad.js`, `ready/sizes.js`
   pass. Restore other rounds' review files with
   `git checkout -- review/<round>` after running their probes.

Drive it yourself through the probes' inputs on every variant on three
career tracks. If a slide on Pro cannot be held on purpose by a careful
input, or holding it is no different from Easy, it is not done.

## How to run things here

- From `crazygames/`, with `PLAYWRIGHT_BROWSERS_PATH` pointing at a
  folder holding `chromium-<n>/chrome-linux/chrome` (the probes'
  `findChromium` does not know `chrome-linux64`; make a folder of
  symlinks if the browser sits elsewhere).
- Pages advance with `R.runFrames` (`game/test/feel/lib.js`), inputs go
  in through `window.__feel.inject`; `game/test/park/same.js` compares
  `main` from git with the working copy in one browser.
- A foreground command dies at ten minutes: split long probes, or run
  them in the background.
- `crazygames/node_modules` in a worktree is a symlink: never commit it.
- Commit with the author name and email the existing commits use
  (`git log -1 --format='%an %ae'`), small commits, no trailers. **Push
  the branch after every working step**: a machine was once lost with a
  round's work on it.

## When done

`review/controls/REPORT.md`, short, for a phone: what each key and
trigger does on Pro and on Easy, the three variants in one table (their
numbers, angle against throttle, how easily each spins), the measures
with their known answers, every change to `vehicle.js` and why, and
every deviation from this brief. Then a short play guide for the author:
which links to open (`?controls=pro&pro=a`, `b`, `c`), what to try on
each (the stunt park first, then career track 1, then a rival), and the
one question to answer: which variant, or what is wrong with all three.
Do not add a Status entry to `CLAUDE.md`; the reviewer does that at the
merge. If something in this brief turns out to be wrong, stop that part
and say so in the report; do not work around it.
