# Brief: the game loop (DESIGN.md build steps 2 and 3, put together)

Branch `crazygames-loop`. Folder: `crazygames/game/`, except
`game/src/tracks/` and `game/src/cars/`, which belong to the track and car
sessions (read them, do not change them; if one needs a change, write it
up in your report). Read `../DESIGN.md`, `../CLAUDE.md` and `../BRIEF.md`
(hard limits) first, then `review/feel/REPORT.md` for how the handling got
where it is.

## Goal

Turn the feel prototype into a game someone would play for ten minutes:
a title screen, a track to drive, a score that means something, a ghost
to beat, a car to choose, and a reason to go again.

## What may or may not be there when you start

The track generator (`briefs/TRACKS.md`) and the five cars
(`briefs/CARS.md`) are being built at the same time on their own
branches. Check `main` when you start and again as you go
(`git fetch origin main`). Whatever is merged, use it. Whatever is not,
build against its data contract in that brief with the existing test
track and block car standing in, behind one small adapter each, so the
real one drops in by changing a line. Merge `main` into your branch when
either lands.

## Build

- **Run structure.** A title screen, then a run: a countdown, the drive,
  a finish (sprints) or a lap count (circuits, three laps), and a results
  screen with the score, the best chain, stars against three targets, and
  one input to go again. Runs of 60 to 120 seconds.
- **Daily drift.** The track for the local date from `dailySeed`, the same
  for everyone. The best run is saved on the device (localStorage, every
  call in try/catch, the game plays with no storage).
- **Ghost.** The best run of a track is replayed as a translucent car from
  its recorded input stream, using the deterministic physics. The ghost
  must line up with the run it was recorded from, frame for frame.
- **Career.** A short ladder of fixed seeds with star targets that unlock
  in order; at least eight tracks.
- **Free drift.** The car park, no timer.
- **Cars and coins.** Coins from every run, more for stars. A garage
  screen to choose and buy cars and paint, saved on the device. Each car
  has its own handling, as a small set of overrides of `TUNE.VEHICLE`, with
  the starter as the current tune. Keep it simple: no upgrades yet.
- **Track presentation in plain materials.** The generated walls, kerbs,
  clipping zones and a start and finish gantry. No art beyond what reads
  clearly; art is a later stage.
- **Scoring on real tracks.** The existing drift scoring, with proximity
  read from the track's `clips`.
- Phone first: every screen usable with a thumb in 390x844 portrait and
  in landscape.

## Keep

The handling in `game/src/tune.js` and the controls (left, right, DRIFT;
the car drives itself; no brake) are the author's, tuned by playing. Do
not retune them. The probes in `game/test/feel/` must still pass; run
`handling.js` and `probes.js` before you finish.

## Measure, each with a known answer that can fail

1. Ghost replay matches the recorded run's end state exactly. Known
   answer: one perturbed input frame must differ.
2. The scripted driver completes three generated tracks of each kind
   (if the generator is merged) or the test track, start to finish
   through the full run structure, with a score and a results screen.
3. Saved progress survives a reload, and the game runs with storage
   throwing on every call. Known answer: a corrupted save must be
   recovered from, not crash.
4. JavaScript frame time at 6x CPU throttle on forced WebGL 2, p95 and
   worst, on a generated track.

## Deliver

Commits on `crazygames-loop`, pushed after every meaningful step (usage
limits will interrupt you). Never push to `main`. Australian spelling, no
em or en dashes, no model names or session identifiers in commits, code or
comments. Finish with `review/loop/REPORT.md`: a phone-readable summary
first, then the measurements and known answers, screenshots of every
screen in both orientations, what is not done, and every deviation.
