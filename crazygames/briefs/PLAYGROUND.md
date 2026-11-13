# Brief: the playground (14 November 2026)

Branch `crazygames-playground`. Folders: `game/src/park/` (new, the
park and its challenges), `game/src/ground/track.js` and `source.js`
(the park's ground), `game/src/env/` and `game/src/render/scene.js`
(drawing the park, only what it needs), `game/src/scoring/` only to
read, `game/src/loop/save.js`, `game/src/ui/screens.js`,
`game/src/ui/hud.js`, `game/src/main.js` (wiring only),
`game/index.html` (styles), `game/src/tune.js` (new numbers),
`game/test/park/`, `review/park/`. Nothing outside `crazygames/`.
Never push to `main`.

Read `../CLAUDE.md` first, all of it; the Status section's last six
entries are where this starts. Then `../DESIGN.md`.

## Why

Free drift is a 150 by 110 m car park with a few cones, no score that
matters and nothing to do (`carPark` in `ground/track.js`, `startFree`
in `main.js`). The author chose this scope himself on 14 November: **a
stunt park with challenges. A larger open area with cones, pillars to
drift around, donut rings and a few scored challenges that pay coins
once each. No timer.** It is where a player learns the car and where
one who has finished the career still has something to do.

## What to build, in priority order

1. **The park.** Free drift's ground, replacing the car park: an open
   paved area about three to four times its size, walled all round,
   flat, with distinct places a player can see from the start and
   drive to: pillars to circle (solid, the physics' walls), a donut
   pad with rings marked on the ground, a slalom of cones, a figure
   eight round two pillars, a long wall to slide beside, a narrow gate
   or two. Laid out so a slide can link from one place to the next.
   Dressed by the game's own scenery, lamps and presets so it reads by
   day and at night; nothing occludes the car from the chase camera
   for more than a moment (a pillar between camera and car must fade
   or the camera must clear it; measure it).
2. **Challenges.** At least eight, each at a place in the park, each
   judged at the physics rate from the player's own world only, each
   with three levels (bronze, silver, gold) that pay coins once each
   and never again. Suggested, yours to improve: donuts round a pillar
   without breaking the slide (count), the figure eight (count of
   links), slalom cones passed in one slide, the longest single slide
   in metres, the biggest single chain banked, a wall ride (metres
   slid within a small distance of the long wall without touching),
   a gate taken sideways at speed, a tour (one chain that visits every
   place). No timer anywhere; a challenge starts when the player
   begins doing it and ends when the slide ends, with no menu and no
   start button. The game says what is being counted as it happens
   (a small readout by the car or in the HUD: "DONUTS 3", then the
   level reached), and a level newly won is celebrated with the
   spectacle the game already has.
3. **Knowing what there is to do.** A challenge list reachable from
   the park (a HUD button) and from the title's FREE DRIFT button
   (its small line says how many levels are won, "7 of 24"): each
   challenge's name, one line of what to do, its three targets, which
   are won, what each pays. Each place in the park carries a marker
   the player can see from a distance (painted on the ground or a low
   sign, never anything that hides the road), dimmed once its gold is
   won. Works by touch, keyboard and gamepad (`ui/padnav.js`;
   `game/test/ready/pad.js` must still pass and cover the new screen).
4. **The title's button** reads PLAYGROUND or STUNT PARK, your choice
   of the clearer one at 390 px wide; "free drift" may stay as its
   small line. A first visit shows one line on what the park is, once.

Coins are yours to propose in `LOOP` in `tune.js` as first guesses for
the author's play: all levels of all challenges together should pay
about what one clean pass of a chapter pays (about 7,500), bronze
reachable by a newcomer in the starter within a few tries, gold a real
feat in an upgraded car. The park pays nothing else: no coins a point,
no stars, no missions, no ghost.

## Rules

- **The physics, the cars and the score rules are not touched.** The
  park is ground and walls like any other; challenges read the world
  and the drift scorer, they do not change them. Recorded runs and the
  recorded Kestrow race replay to the bit
  (`game/test/ladder2/determinism.js` must pass with its known
  answers). Career, daily, Lab and rivals are unchanged.
- **Every challenge can be reached by a player's hands** (steer and
  one button, throttle always on). Prove each level of each challenge
  with a scripted driver held to a player's controls (`opts.hands` in
  `rivals/rival.js` shows how the rival is held; `physics/driver.js`
  is the scripted driver), in the starter for bronze and in any owned
  car for gold. A level no scripted hand reaches is lowered or said to
  be unproven in the report, not left in as if it were proven.
- **Saves are additive.** A `park` field; an old save loads unchanged
  with nothing won; a save from this build read by `main`'s `save.js`
  does not throw. A level pays once: leaving and coming back, a
  reload, or winning silver before bronze never pays twice (winning a
  higher level first pays the lower ones too, once). Keep the full
  storage rule (`write` in `save.js`).
- The garage round's cosmetics show in the park as in any run.
- The CrazyGames adapter still sees the park as play
  (`sdk.playing`, `game/test/ready/sdk.js`).
- No image assets, no outside requests, no new dependencies. Every
  number in a named block. Australian spelling, no em or en dashes, no
  model names or session identifiers anywhere. Nothing named after a
  competitor's game or a real brand.
- Frame cost: measure JavaScript time per frame in the park at night
  mid slide as the spectacle round did (`game/test/spectacle/`),
  against a career run; the park must not cost more than a career
  track on the low tier. The quality adaptation must still step down.

## Measures, each with a known answer that can fail

Write them in `game/test/park/`, results and shots in `review/park/`.

1. The park: its size, that every place is reachable from the start
   without touching a wall, that the car cannot leave it (a driver
   aimed at each wall and corner at full speed stays inside), and that
   a respawn or a stuck recovery puts the car back in open ground.
   Known answer: a gap cut in the wall is caught.
2. Sight: the car is visible from the chase camera through a scripted
   lap of every place; the longest stretch hidden is under a third of
   a second. Known answer: a pillar that does not fade or clear is
   caught.
3. Each challenge, each level: the scripted hands reach it; the count
   is right against an independent count from the recorded positions
   (donuts by winding angle round the pillar, slalom by side
   changes, and so on). Known answers: a slide broken mid donut does
   not count on; a wall touched ends the wall ride; a cone hit is not
   a cone passed.
4. Paying: each level pays its coins once; again after a reload and
   after leaving for the title pays nothing; a higher level first pays
   the lower ones once. Known answer for each.
5. Saves, as the garage round's `game/test/garage/saves.js` does it,
   against `main`'s `save.js` from git; `game/test/loop/quota.js`
   passes.
6. Layout: the list and the in-park readout at 390x844, 844x390,
   800x450 and 1280x720: nothing under 44 px, nothing scrolls
   sideways, the readout never covers the car. Known answer: a
   readout laid over the car is caught.
7. Nothing else changed: `ladder2/determinism.js`, `play13/check.js`,
   `play13/career.js`, `play14/check.js`, `ready/pad.js`,
   `ready/keys.js`, `ready/sdk.js` (after `npm run build`),
   `ladder/earning.js`, `garage/buy.js`, `garage/layout.js` all pass.
   Restore other rounds' review files with
   `git checkout -- review/<round>` after running their probes.
8. Frame cost, as above.

Look hard at your own shots at every size after every step, by day and
at night. If a player dropped in the park would not see three things
to try within five seconds, it is not done.

## How to run things here

- From `crazygames/`, with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.
- Pages advance with `R.runFrames` (`game/test/ladder/lib.js`); the
  frame loop is stubbed in the probes. `game/test/garage/lib.js` is
  the newest example of a round's helpers.
- A foreground command dies at ten minutes: split long probes.
- `crazygames/node_modules` in this worktree is a symlink: do not
  commit it.
- Commit as `git -c user.name="SnapHit" -c
  user.email="nathanhaslewood@gmail.com"`, small commits, no trailers.
  Do not commit superseded screenshots: keep shots out of the history
  until the last commit.

## When done

`review/park/REPORT.md`, short, for a phone: what was built, a table
of the measures with their known answers, the challenges with their
targets and coins and which levels the scripted hands reached in which
car, the frame costs, what failed or was cut and why, anything the
author must judge by eye, and every deviation from this brief. Do not
add a Status entry to `CLAUDE.md`; the reviewer does that at the
merge. If something in this brief turns out to be wrong, stop that
part and say so in the report; do not work around it.
