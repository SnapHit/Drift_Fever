# Drift Fever: CrazyGames edition, the new design

Decided 29 October 2026. This replaces the "same game, every mechanic
preserved" goal in `BRIEF.md`. The live game at driftfever.com is
unchanged and keeps its own design.

## Why

The greybox proved the live game's design does not travel. Its car is
locked to the road and runs forward by itself; steering slides it
sideways, and the only skill is staying inside the edges. That suits
young children on school Chromebooks. On CrazyGames it competes with
games where you actually drive. Every one of the most popular car games
there in October 2026 (PolyTrack, Smash Karts, Racing Limits, Sky
Riders, Demolition Derby 3, Rally Racer Dirt) has a car that turns,
spins and crashes. The author played it and called it childish and
restricted.

So the edition becomes a new game under the same name, built for players
aged roughly 12 to 17: a real drift game. None of the current top ten
car games on CrazyGames is a proper drift game, and drifting is the name.

## The game in one paragraph

You throw a real 3D car sideways through short courses built for
drifting. Points come from angle, speed and how long you hold it, with a
multiplier that grows as you link drifts together and a bonus for
drifting close to the walls. Straighten up and the chain is banked; hit
a wall or leave the track and it is lost. Scores earn coins, coins buy
and upgrade cars, and every day there is a new track for everyone, with
your best run as a ghost to beat.

## Pillars, in priority order

1. **The car feels great to throw around.** Weight, grip, a handbrake,
   and a slide you can hold and steer. Arcade, not simulation: easy to
   start a drift, a skill to hold one, satisfying to link them. If the
   car is not fun on an empty car park, nothing else matters.
2. **Instant, on any device.** Loads in seconds, playable on a phone with
   thumbs, on a school Chromebook and with a keyboard or gamepad. 60fps on
   the low tier.
3. **One more go.** Runs of 60 to 120 seconds, an instant restart, a
   score that is easy to read and a clear target to beat.
4. **Looks the part.** Stylised realism at dusk, Art of Rally as the
   reference, the car always the most readable thing on screen.

## Driving

- A real vehicle model with its own heading, not a car on rails:
  rear-wheel drive, a tyre grip curve, weight transfer, a handbrake that
  breaks the rear loose, countersteer that catches the slide. Tunable
  constants in one block, and a hidden assist level for phones.
- A fixed simulation step, deterministic for a given input stream, so a
  run can be replayed exactly. Ghosts and leaderboards depend on it.
- Controls. Keyboard: arrows or WASD, space for the handbrake. Phone:
  steer left and right with the thumbs, throttle automatic, with brake and
  handbrake buttons; tilt as an option. Gamepad: the obvious mapping.
- Walls and barriers are solid. A hard hit costs the chain and speed and
  never ends the run. Leaving the track is a respawn on the racing line.

## Scoring

- Drift points: angle times speed for every moment the slide is held
  above a minimum angle, shown climbing live by the car.
- The multiplier grows as drifts chain without a straight gap, and resets
  when the chain is banked or lost.
- Proximity bonus for drifting close to marked walls and clipping points,
  in the spirit of real drift judging.
- Callouts for big angle, long chain, near miss and a perfect line.
- Each track has three star targets.

## Modes at launch

- **Daily drift:** one seeded track per day, the same for everyone. Your
  best run is saved as a ghost.
- **Career:** a series of tracks with star targets that unlock in order.
- **Free drift:** an open area with no timer, for learning the car.

Later, if it takes off: racing against AI drivers, leaderboards (they
need a small backend, which is a cost decision for the author), and live
multiplayer.

## Progression

- Coins from every run, more for stars.
- Five original cars at launch, each with a clear character (light and
  twitchy, heavy and smooth, and so on). Never a recognisable real car.
  The starter car is cyan.
- Upgrades per car: power, grip, steering angle. Cosmetics: paint, wheels,
  underglow, tyre smoke colour.
- No loot boxes and no pay to win. Ads only through the CrazyGames SDK,
  after Basic Launch.

## Camera

A chase camera that follows the car's heading with a little lag, swings
out to show the drift angle, widens the field of view with speed and
shakes on impacts. Measured: the car stays readable in every slide, and
the road ahead is visible enough to plan the next corner.

## What carries over and what is retired

Carried over: three.js with WebGPU and the WebGL 2 fallback, the build
and the preview Worker, the hard limits in `BRIEF.md` (20MB initial,
250MB and 1,500 files, PEGI 12, 60fps low tier, original car design,
asset licences in `ASSETS.md`, no external requests except the SDK
adapter), daily seeded content and ghosts as ideas, and the way of
working (every claim measured, known answers that can fail).

Retired for the new game: the vendored simulation, the parity test as a
gate, and the lane-bound physics. Stages 1 and 2 stay in the repository
and the greybox stays playable at `/greybox/` for comparison.

## Build order

1. **Feel prototype.** One car, a test track and an open car park, the
   chase camera, keyboard, touch and gamepad controls, live drift scoring
   on screen. Plain shapes. The author judges it on a phone and nothing
   else proceeds until the car is fun.
2. **Tracks.** A seeded generator for drift courses (closed circuits and
   point to point, walls, clipping points, run-off), the daily track,
   ghosts.
3. **Cars and progression.** Five cars, upgrades, cosmetics, coins,
   career, a garage screen, saved progress.
4. **Art.** Lighting, dusk and night presets, the environment, effects,
   the car models.
5. **Size, speed and CrazyGames packaging**, then Basic Launch.

Parts of stages 2 and 3 that do not depend on the feel (the track
generator as a module, the car models) may be built in parallel with
stage 1, each on its own branch and in its own folder.
