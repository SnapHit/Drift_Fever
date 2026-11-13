# The garage round: report

Brief: `briefs/GARAGE.md`, 14 November 2026. Branch `crazygames-garage`.
Probes in `game/test/garage/` (`run-all.sh` lists them), results and
shots here. Everything was measured in the sandbox's headless Chromium
on the WebGL 2 fallback, drawn in software. Nothing has run on a real
GPU, on WebGPU, on a phone or with a real controller.

## What was built

- **The showroom.** In the garage the picked car stands on a turntable
  in a dark studio of its own (a floor that shows the car in it, a lit
  wall, light bars), drawn by the game's renderer into the game's
  canvas, turning slowly. A drag turns it by hand; 2.2 s after letting
  go it turns itself again. The controls sit under it on a tall screen
  and beside it on a wide one; they scroll, the car does not.
- **Six sections**: Cars, Paint, Wheels, Glow, Smoke, Upgrades. Every
  item says WORN, OWNED or its price, and how many coins short you are.
  A press on something not owned shows it on the car (a preview) and a
  BUY button appears; a press on something owned fits it at once.
  Previews hold while you move between sections, so a whole look can be
  tried before anything is bought, also on a car you do not own.
- **Wheels**: five designs beside each car's standard one, built from
  numbers in `cars/wheels.js`: Daggers (ten thin silver spokes),
  Turbines (gunmetal blades, bright lip), Discs (white, red cap), Deep
  fours (gold, deep lip), Tri-blades (red on black). The tile's picture
  is drawn from the same numbers as the wheel.
- **Underglow**: Aqua, Lime, Amber, Magenta, Violet, and off. A plain
  10 triangle light on the low tier, a 262 triangle round cornered one
  on the high tier, each one draw call, drawn under the tyre marks.
  Strongest at night (`SHOW.UNDERGLOW` in `env/show.js`).
- **Smoke colour**: Aqua, Lime, Tangerine, Rose, Violet, and standard.
  Only the colour changes. On the Smoke section the car does a burnout
  on the turntable in the colour.
- **Who wears what**: the player's car in every run, the menu backdrop,
  ghosts (a new ghost records its look and shows its wheels and a faint
  glow; an old ghost shows the standard ones), and four rivals, wheels
  only: Varsk turbines, Dovane deep fours, Halvik daggers, Sarrow
  discs, in the race and on their portraits. Kestrow and Tolvo keep the
  standard wheel.
- **Saves**: each car gains `wheels`, `glow`, `smoke` and `own`. Old
  saves load as they were.

## The measures

| # | Measure | Result | Known answers |
|---|---------|--------|---------------|
| 1 | Layout, 390x844, 844x390, 800x450, 1280x720; 3 cars x 6 sections each (72 views) | **Pass.** Car whole through a full turn, inside the stage, under no control; smallest control 44 px; nothing scrolls sideways; every control reachable. The pane scrolls only at 844x390 (cars, wheels, glow, smoke). | Caught at all four sizes: a button laid over the car, a 40 px button, a row wider than the pane, and a car box moved off the car (checked against the picture). |
| 2 | Every cosmetic shows, where it should and nowhere else. Race: night and dawn, low tier, 844x390, same frame every time | **Pass.** Standard drawn twice: 0 pixels differ. Each wheel differs from standard in 170 to 219 pixels, each glow in 1,002 to 1,020, each smoke in 26,292 to 27,990; 0 pixels outside where that thing is drawn. Closest pairs: wheels 101 pixels, glows 533, smokes 14,856. Coloured smoke is the standard smoke to the last puff (97 puffs, same places, sizes, strengths). Showroom (1280x720): pass. | Caught: one wheel, glow and smoke each given another's look (0 pixels apart); a glow three times its outline (35,000 pixels outside); effects thinned to half (47 puffs against 97). |
| 3 | Readability with the glow on: 4 presets x 2 tracks x 5 colours, low and high tier | **Brightness: pass.** The edge is brighter than the lit road under the car in all 80; closest x1.11 (low, night, lime). **The stronger light: pass**, closest x1.17 on both tiers against a bar of 1.15. **Visible by day: pass** (at least 936 pixels changed at dawn). **"Never more saturated than the edge": not met, 0 of 80, and cannot be.** See below. | Caught, 20 of 20: every colour at five times its strength at night. |
| 4 | Buying, by real presses, 390x844 and 1280x720 | **Pass.** A press previews and moves no coin; BUY takes the price once; a second press takes nothing; one coin short it is refused and says "1 more coin needed"; a preview does not leave the garage or reach a race; nothing is sold for a car not owned. | Caught at both sizes: a save made to charge twice, to charge again for what is owned, to sell with too few coins, and a host made to write the preview into the save. |
| 5 | Saves, against main's own `save.js` taken from git | **Pass.** A save made by main (3 cars, 9 results, 2 ghosts, 2 rivals) loads with 0 repairs and every field as written. A save from this build loads in main's code without throwing, 0 repairs, coins, cars, paints, upgrades, stars and ghosts as written. Unknown ids are put back to standard and counted. Full storage: ghosts go first, coins, stars and everything bought stay. `loop/quota.js` passes as it is. | Caught: one coin taken from the old save; a loader made to throw; 60 characters of storage drops nothing. |
| 6 | Nothing else changed | **Pass, all eight**, run on the final code: `ladder2/determinism.js` (main's two tapes and the recorded Kestrow race replay to the same scores and hashes), `play13/check.js`, `play13/career.js`, `play14/check.js`, `ready/pad.js`, `ready/keys.js`, `ready/sdk.js` after `npm run build`, `ladder/earning.js`. | Their own. |
| 7 | Frame cost and the adaptation | **Pass**, with a caveat: the cost is below what this measure can see. See below. The adaptation steps down to its last level with all three on, on both tiers, and they stay on. | Caught: 20 ms of busy work fails the budget; 3 ms shows as a cost; 900 fast frames step nothing down. |
| + | Keyboard, touch, gamepad, the drag (`controls.js`, three sizes) | **Pass.** Every enabled button of all six sections reached by d-pad; A previews and buys, B goes back; Tab reaches every button and Enter previews and buys; taps preview and buy; a drag turns the car by 0.011 radians a pixel, it holds, then turns itself again. GARAGE from a lost race opens on Cars. | Caught: up and down alone miss buttons; a drag begun on the controls does not turn the car. |
| + | Ghosts and rivals (`wearing.js`) | **Pass.** | Caught: a ghost's record changed shows the change. |

### Measure 3, the part that failed

The brief asks that the glow is never brighter **or more saturated**
than the road edge. Brightness holds. Saturation cannot: the edge is a
pale yellow that draws nearly white. Its colourfulness (largest
channel less smallest) measures 0.08 to 0.19 of full, and the same
frames with **no glow at all** already hold things at 0.55 to 0.81:
the kerbs, the orange walls, the tail-lights, the car's own paint. Any
coloured light that can be seen is more colourful than the edge. So I
did not turn the glow down until it vanished. I added a bar that can
judge strength for every colour instead (luminance alone cannot: a
full strength magenta is dim to it): what the glow adds to the road in
its strongest channel must be at least 15 per cent less than the edge
stands over the asphalt beside it. That is my bar, not the brief's.
It caught a real fault on the high tier (lime, amber and magenta were
within 15 per cent at night), so the soft glow is dimmed there
(`SHOW.UNDERGLOW.SOFT` 0.72). The margins are thin at night (x1.17).
Not measured with `?fx=0`, on banked road, or with a rival's glow
(no rival has one).

## Prices proposed (`LOOP.COSMETICS` in `tune.js`)

| Wheels | | Glow | | Smoke | |
|---|---|---|---|---|---|
| Daggers | 500 | Aqua | 300 | Aqua | 300 |
| Turbines | 650 | Lime | 300 | Lime | 300 |
| Discs | 800 | Amber | 350 | Tangerine | 350 |
| Deep fours | 950 | Magenta | 350 | Rose | 350 |
| Tri-blades | 1,200 | Violet | 400 | Violet | 400 |
| all five | 4,100 | all five | 1,700 | all five | 1,700 |

All fifteen on one car: **7,500**. Dearest single item 1,200. Paint
stays 60. One of each at the cheapest is 1,100, at the dearest 2,000.
Five cars dressed in everything is 37,500. First guesses.

## Frame costs

JavaScript time per frame without the draw, 6x CPU throttle, 390x844,
career 1 at night, chain held at x5, 270 frames, as the spectacle round
measured (its own figure for this race was median 1.1, p95 4.8 ms).

| Low tier | median ms | p95 ms | draw calls | triangles |
|---|---|---|---|---|
| no cosmetics | 1.2 | 5.8 | 76 | 176,117 |
| wheels | 1.3 | 5.6 | 76 | 177,445 |
| glow | 1.3 | 5.5 | 78 | 176,137 |
| smoke | 1.0 | 4.2 | 76 | 176,117 |
| all three | 1.1 | 5.5 | 78 | 177,465 |
| no cosmetics, again | 1.0 | 4.9 | 76 | 176,117 |
| no cosmetics, third run | 1.5 | 10.2 | 76 | 176,117 |

High tier: no cosmetics 1.5 and 5.9 (again 1.3 and 6.0), all three 1.5
and 6.3; 452,167 triangles to 454,023.

- **What each costs in JavaScript: nothing this measure can see.** The
  same plain race measured three times gave medians of 1.0 to 1.5 ms
  and p95 of 4.9 to 10.2 ms, and every cosmetic sits inside that. The
  budget (p95 under 16.7 ms) holds with room. A 3 ms cost is seen
  (median 1.5 to 4.6), so a cosmetic costs under about half a
  millisecond a frame at 6x, and I cannot say more than that.
- **To the renderer**: wheels 1,328 triangles more and no draw call
  (664 a pass, drawn in the shadow pass too); glow one draw call, 10
  triangles on the low tier and 262 on the high; smoke nothing.
- The two tables were measured before two fixes that only take work
  away (the glow no longer throws a shadow, and the soft glow is drawn
  in one pass, not two): they show the glow as 2 draw calls. It is 1
  on both tiers now, counted by `adapt.js`. I did not measure the
  times again.
- **Not measured: the GPU.** The glow is see through and additive over
  about the car's footprint; the smoke fills the same pixels as before.
  What that costs a phone is for play.
- The showroom is made the first time the garage opens, not at start
  up. It draws the car twice (the picture in the floor). Its frame
  time was not measured.

## Failed, cut, not done

- **The saturation half of the readability rule**, as above.
- **Rivals wear wheels only.** The brief asks only for wheels. A
  rival's `look` can also name a glow and a smoke and the plumbing is
  there; none does, because a rival's coloured smoke changes races the
  author has already judged by eye.
- **A ghost has no smoke**, so its smoke colour is recorded and not
  shown. Ghosts never had smoke.
- **Readable at race distance** is measured as pixels, not judged: on
  the low tier at 844x390 a wheel is about 12 pixels across. They tell
  apart by colour there, not by spoke count.
- Not run: the other rounds' probes beyond the brief's list
  (`spectacle/`, `visuals/`, `loop/probes.js`, `chapters/`,
  `retention/`). `lab/cars.html` is still broken, as on main.
- The high tier's looks were shot for measure 3 but not put through
  measure 2 (its bloom spreads light past any outline).

## For the author's eye

1. **The showroom**: does it make you want the next wheel? Its light
   (`SHOWROOM` in `garage/showroom.js`), the blue wall, the turning
   speed, the drag on a real phone.
2. **Wheels in a race on your phone.** Shots: `shots/race-night-wheels-*`
   and `race-dawn-wheels-*`. Bought designs give back a fifth of their
   own colour unlit (`FINISH.WHEEL_LIFT`) so they read at night; say if
   that looks wrong.
3. **Glow strength**, night and day: `shots/readable-low-night-*`,
   `readable-high-night-*`, `readable-*-dawn-*`. It could go up about
   15 per cent at most before my bar fails.
4. **Smoke colours**: `shots/race-night-smoke-*`, `race-dawn-smoke-*`.
   Rose at night is close to the standard smoke's own red.
5. **Prices.**
6. **Paint now previews first** and needs PAINT IT to buy (it used to
   charge on the first press). A paint is still not owned: going back
   to one you paid for costs 60 again, as before this round. Next to
   OWNED wheels that may now feel wrong. Not changed: the brief says
   paint stays 60.
7. **Going back to main's build loses what was bought.** Main does not
   carry the new fields when it writes, and the coins are not given
   back. Only matters if this is merged and then rolled back.
8. The four rivals' wheels.

## Deviations from the brief

1. **Files outside the brief's list**, each because the brief's own
   asks could not be met without it:
   - `render/scene.js`: the look passed to the player's, ghost's and
     rival's models; the glow's strength by preset and tier; the glow
     throws no shadow.
   - `env/effects.js`: the smoke takes a chosen colour (`setSmoke`).
   - `env/particles.js`: `clear()` starts the pool from its first slot
     again, so the same run draws its puffs in the same order. Needed
     for two runs to be the same picture to the pixel. No visible
     change.
   - `ui/portraits.js`: a rival's portrait in his wheels, kept by car,
     paint and wheel.
   - `rivals/roster.js`: `look` on four rivals. Data only; his driving
     never reads it, and the recorded Kestrow race replays to the bit.
2. **Measure 3**: my own strength bar in place of the saturation
   wording.
3. **"A full cosmetic set" read as all fifteen items on one car**
   (7,500). With no item over 1,500, one of each could not reach it.
4. **Owned items fit on one press**, not two. Only things not owned
   are previewed first.
5. **"By day" is the dawn preset.**
6. **The garage no longer shows the track behind it**, and the world
   is not updated while the garage is open. Picking a car no longer
   changes the menu backdrop until you leave.
7. **High tier frame cost** measured plain and with all three only
   (a frame takes the software renderer about a second there).
8. Screenshots are read with Node's own zlib, so no dependency was
   added.
9. No Status entry in `CLAUDE.md`.

## Running it

From `crazygames/` with `PLAYWRIGHT_BROWSERS_PATH` set:
`sh game/test/garage/run-all.sh` (about six minutes), and
`sh game/test/garage/run-all.sh perf` for the frame costs as well
(about 40 minutes more, alone on the machine). `peek.js` and
`race-peek.js` take one shot of the garage or a race for working on
the look.
