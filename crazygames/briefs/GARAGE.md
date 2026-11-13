# Brief: the garage (14 November 2026)

Branch `crazygames-garage`. Folders: `game/src/garage/`, `game/src/cars/`,
`game/src/ui/screens.js`, `game/src/ui/padnav.js` only if a new control
needs it, `game/src/loop/save.js`, `game/src/env/show.js` (smoke colour
and underglow only), `game/src/main.js` (wiring only), `game/index.html`
(styles), `game/src/tune.js` (new numbers), `game/test/garage/`,
`review/garage/`. Nothing outside `crazygames/`. Never push to `main`.

Read `../CLAUDE.md` first, all of it; the Status section's last six
entries are where this starts. Then `../DESIGN.md`, the Progression
section.

## Why

The author plays the whole game from an empty save and calls it
excellent. The garage is the thinnest screen in it: a row of cards, a
row of paint swatches, three upgrade bars, over the menu's backdrop.
DESIGN.md promised cosmetics (paint, wheels, underglow, tyre smoke
colour) and only paint exists. He also found the game too easy to buy
out: coins need more worth spending on that does not make the car
faster. He chose this scope himself on 14 November: **cosmetics and a
showroom. Nothing in this round changes how a car drives.**

## What to build, in priority order

1. **The showroom.** In the garage the picked car stands in a lit
   space of its own and turns slowly, drawn by the game's renderer at
   the game's quality, large enough to admire: the screen's controls
   sit beside or under it, not over it. A drag (pointer or touch) turns
   it by hand; left alone it turns itself again. It must show the car
   exactly as it will race: its paint and every cosmetic below, live as
   they are picked, before buying (a preview) as well as after. Fits
   390x844, 844x390, 800x450 and 1280x720 with every control reachable
   without the car being hidden; the screen may scroll its controls but
   not the car. The rest of the menus keep their backdrop.
2. **Wheels.** At least four wheel designs beyond the standard one,
   original, readable at race distance from the chase camera, built in
   code like the cars (`game/src/cars/`), no image assets. Bought per
   car with coins, kept per car, shown in the race, on ghosts and on
   the rivals' portraits where the rival wears them (rivals keep the
   standard wheel unless you give one a set that suits his line).
3. **Underglow.** At least five colours and off. A soft light under
   the car on the road, strongest at night, visible by day, never
   brighter or more saturated than the road edge (the readability rule
   in `../CLAUDE.md`), never hiding the tyre marks. Bought per car.
4. **Tyre smoke colour.** At least five colours beside the standard.
   The spectacle round's smoke (`SHOW.SMOKE` in `env/show.js`) takes
   the colour; its amount, life and climb with the multiplier stay
   exactly as they are. Bought per car.
5. **The screen's order.** One screen, the car on show, and tabs or
   sections for Cars, Paint, Wheels, Glow, Smoke and Upgrades, each
   item showing owned, chosen or its price, one press to preview, one
   to buy or choose. A locked item the coins cannot reach says how many
   more are needed. Works by keyboard, touch and gamepad
   (`ui/padnav.js`: every enabled button reachable by d-pad,
   `game/test/ready/pad.js` is the measure and must still pass).

Prices are yours to propose in `LOOP` in `tune.js`, as first guesses
for the author's play: a full cosmetic set for one car should cost
about what one clean pass of a chapter pays (about 7,500 coins), no
single item more than 1,500. Paint stays 60.

## Rules

- **Nothing here is read by the physics or the score.** Recorded runs
  and the recorded Kestrow race replay to the bit
  (`game/test/ladder2/determinism.js` must pass, with its known
  answers). The rivals' driving is not touched.
- **Saves are additive.** An old save loads with standard wheels, no
  glow and standard smoke on every car, and nothing a player owns is
  lost or changed. A save written by this build and read by `main`'s
  build must not throw. Ghosts record the cosmetics they ran with, and
  a ghost without them shows the standard ones. Keep the full storage
  rule (`write` in `save.js`: ghosts go first, never coins, stars,
  cars or anything bought).
- No image assets, no outside requests, no new dependencies. Every
  number in a named block. Australian spelling, no em or en dashes, no
  model names or session identifiers anywhere.
- The cars are original designs. Nothing may make one resemble a real
  car, and nothing is named after a real brand, a real wheel maker or a
  competitor's game.
- Frame cost: the sandbox draws in software, so measure JavaScript
  time per frame as the spectacle round did
  (`game/test/spectacle/`), in a race at night with glow and coloured
  smoke on against the same race without. The quality adaptation
  (`LOOK.ADAPT`) must still step down; say what each cosmetic costs.
  The underglow must have a cheap form for the low tier.
- The garage tip on a lost race (`garageTip` in `main.js`) still opens
  the garage, on the Cars section.

## Measures, each with a known answer that can fail

Write them in `game/test/garage/`, results and shots in
`review/garage/`.

1. Layout at the four sizes: the car is fully visible and not covered
   by a control in every section; no control under 44 px; nothing
   scrolls sideways. Known answer: a control laid over the car is
   caught.
2. Every cosmetic shows: for each wheel, glow and smoke colour, a shot
   of the showroom and a shot mid slide in a race at night and by day,
   and a pixel measure that the item differs from the standard one
   where it should and nowhere else. Known answer: two items given the
   same look are caught.
3. The readability rule with the brightest glow on the darkest preset:
   the road edge is still the brightest and most saturated thing on
   screen (`game/test/visuals/` has the measure). Known answer: a glow
   turned up past the edge is caught.
4. Buying: coins fall by the price once, a second press does not
   charge again, an item out of reach cannot be bought, preview without
   buying does not survive leaving the garage or reach a race. Known
   answer for each.
5. Saves: an old save (take one from `game/test/loop/` or make one
   from `main`) loads unchanged; a new save loads in `main`'s
   `save.js` without throwing; the full storage rule still holds
   (`game/test/loop/quota.js`).
6. Nothing else changed: `ladder2/determinism.js`, `play13/check.js`,
   `play13/career.js`, `play14/check.js`, `ready/pad.js`,
   `ready/keys.js`, `ready/sdk.js` (after `npm run build`),
   `ladder/earning.js` all pass. Restore other rounds' review files
   with `git checkout -- review/<round>` after running their probes.
7. Frame cost, as above.

Look hard at your own shots at every size after every step. If the
showroom would not make a player want the next wheel, it is not done.

## How to run things here

- From `crazygames/`, with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.
- Pages advance with `R.runFrames` (`game/test/ladder/lib.js`); the
  frame loop is stubbed in the probes.
- A foreground command dies at ten minutes: split long probes.
- `crazygames/node_modules` in this worktree is a symlink: do not
  commit it.
- Commit as `git -c user.name="SnapHit" -c
  user.email="nathanhaslewood@gmail.com"`, small commits, no trailers.

## When done

`review/garage/REPORT.md`, short, for a phone: what was built, a table
of the measures with their known answers, the prices proposed, the
frame costs, what failed or was cut and why, anything the author must
judge by eye, and every deviation from this brief. Do not add a Status
entry to `CLAUDE.md`; the reviewer does that at the merge. If
something in this brief turns out to be wrong, stop that part and say
so in the report; do not work around it.
