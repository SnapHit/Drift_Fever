# The drift race: report (11 and 12 November 2026)

> **Reviewer's note, 12 November 2026.** After this report was written the
> lead and line bonuses were raised on review (`TANDEM.LEAD_SHARE` 0.45 to
> 2.2, `LINE_SHARE` 0.3 to 1.0), because at the first numbers a player who
> led all the way and never slid lost 1,182 to 2,680. The numbers below are
> at the first shares. At the new ones, over 20 disturbed races: grip wins
> 9, slide 12, mixed 6; the all-the-way leader who never slides about ties
> (2,672 to 2,662); the slider who trails all the way loses 4,196 to 4,585.
> The won results frames are recorded at the first shares (a probe-only
> setting), so their totals are not a real race's.


Branch `crazygames-driftrace`, brief `briefs/DRIFT-RACE.md`. Every number
below was measured in this sandbox: headless Chromium drawing in software
(forced WebGL 2 on SwiftShader), and Node for the many-run parts. The JSON
beside this file is what the probes wrote; `runs/` holds the log of every
probe in `game/test/` run on this branch (`summary-all.txt` is the full
run, `summary.txt` the final rerun of this round's probes on the final
code); `shots/` holds the frames.

## In short, for a phone

- **The battle is now a DRIFT RACE.** Both cars start level, side by
  side (2.2 m either side of the centre line), and go at GO. Your score
  is the solo score plus the race's bonuses; the higher total wins and a
  tie is yours.
- **Being ahead pays.** Every checkpoint and every lap's line is a gate.
  The first car through banks a lead bonus (18 points on First slide);
  the first across the finish banks a larger one (181). He plays by it
  too.
- **Close pays, ahead or behind.** While both cars slide close together
  your drift points count up to 1.6 times. Nothing says "stay back" any
  more.
- **On screen:** your place and the gap in seconds ride under your car
  (1ST +0.3 s in cyan, 2ND -0.8 s in his red), the close bonus under
  that while it counts, both totals at the top, a pop over whichever car
  banks a gate in its colour, his name tag and the arrow as before. The
  results show who won, both totals and a table of drift, clean, pace,
  leads, first home and close for each car, with REMATCH.
- **Kestrow now has your hands.** His driver plans with exactly a
  player's controls: the throttle always on, no brake, DRIFT with or
  without steering (with the wheel straight it is the brake). Over every
  step of his race the brake is never on and the throttle never below
  full, and the guard that would enforce it never had to act.
- **He is clean and robust:** four laps of First slide in 75.2 s, no
  respawn, no hit, no wall contact, every corner at least 42 per cent
  sliding; under 20 disturbances none misses the bar.
- **What does not hold, plainly:**
  - **The mixed player does not win.** A scripted player who slides the
    two drift corners and takes the sweeper on grip wins **2 races of
    20**. By the brief's own test **Kestrow is not right yet**, so the
    other five were not started (priority 4).
  - **The place changes in 17 of 20 mixed races**, not all.
  - **A player parked on his line is shoved into the wall and held
    there 1.2 s** (the bar is 1 s) before the game recovers him.
  - **The pin release decides nothing.** In none of the four contact
    cases did it act, and a following player gets past him exactly as
    well with it off. The brief's known answer cannot be caught.
- **For you to decide (measurement 3):** a player who leads nearly all
  the way but never slides scores **1,182 against his 2,680** and loses
  by far; leading every gate and the line would still only make it
  1,200 against 2,662. A player who slides well but trails all the way
  **wins 4,196 to 3,113**. A lead is worth very little next to drift.

Preview: https://drift-fever-crazygames.novlrgames.workers.dev/ (this
branch is not on it until it is merged).

## What was built

```
game/src/rivals/driver.js   RIVAL_DRIVE.HANDS 1: the grip line keeps the throttle on and brakes with DRIFT and the wheel straight (HB_OVER, HB_STEER); the look ahead plans with that. A pick hook and an avoid hook for the scripted players only (AVOID_*)
game/src/rivals/rival.js    the level grid (gridStart, GRID_SIDE); the hands rule as a guard that counts any input it has to change (state.overruled); opts.free is the old driver, for the known answer only
game/src/rivals/players.js  PLAYERS: the three scripted players with a player's hands (grip, slide, mixed), and ?auto=1 in a race
game/src/rivals/roster.js   Kestrow's new numbers and his race laps (laps: 4)
game/src/scoring/lead.js    the lead gates, the finish, the place, the gap in seconds, the lead pops' events; kept apart from either car's own scoring
game/src/scoring/tandem.js  the close bonus in any position (the ahead rule and TOO FAR gone); CLOSE SLIDE and DOOR TO DOOR callouts
game/src/tune.js            TANDEM now holds the drift race's numbers (the name is kept: nothing stored reads it)
game/src/loop/modes.js      battleLaps(track, def): a rival's own laps
game/src/main.js            the player's grid place, the lead gates in the step, the race totals, the results' parts for both cars, the copy
game/src/camera/director.js the race's sweep ends on a pair view, so both cars are in view at GO, easing into the chase camera 0.9 s after (RACE_PAIR_*)
game/src/ui/hud.js, screens.js, index.html   place and gap under the car, the close meter, the lead pops, the results table, the career card's words
game/test/driftrace/        the race in Node (race.js), the searches, and one probe per measurement; run-all.sh runs every probe
```

Removed: `game/src/rivals/chase.js` (the chaser that lifted and braked)
and `game/test/rivals/battle.js`; the rivals round's probes were moved
to `game/test/driftrace/` and reworked rather than left passing stale.

Every number of taste is in a named block with a one-line comment:
`TANDEM` (grid, `LEAD_SHARE` 0.45, `LINE_SHARE` 0.3, `NEAR` 4.5, `FAR`
12, `BONUS` 0.6, contact), `RIVAL_DRIVE` (`HB_OVER`, `HB_STEER`,
`AVOID_*`), `PLAYERS`, each rival's `laps` in the roster, `HUD_BATTLE`
(`POP_UP`, `POP_TIME`), `DIRECTOR.RACE_PAIR_*`.

Not touched: `physics/vehicle.js`, `physics/driver.js`,
`physics/world.js`, `audio/`, `assets/audio/`, `TUNE.VEHICLE`,
`TUNE.ASSIST`, `TUNE.CAMERA`, `TUNE.SCORING`, `LOOP` (stars, coins,
prices, chapters), career seeds.

### How Kestrow and the players were chosen

- **The players** (`test/driftrace/players-search.js`): each drives
  alone, four laps, starter with no upgrades, under three start offsets;
  the mark is its worst run (hard hits, wall contacts, time, and for the
  two that slide, their drift points). The grip player's search also
  charged for any drift points: with the throttle always on, the first
  grip player braked with DRIFT and slid the tight corners anyway (67
  and 54 per cent sliding with no slide asked for). The final one has no
  drift points at all. The mixed player's drift points were weighed 1.5
  against its time. Alone on First slide (four laps, no rival): grip
  75.0 s and 754 points, none of them drift; mixed 76.1 s and 3,141,
  sliding the two drift corners (about 62 per cent of each) and never
  the sweeper; slide 88.4 s and 5,616, sliding all three.
- **Kestrow** (`test/driftrace/search.js --character`): the rivals
  round's search, his driver planning with a player's hands, plus a
  pace term (his time at the players' pace), a ceiling on his total, and
  sliding every corner made a demand. His character's ranges keep him a
  modest drifter (angle cap 16 to 30 degrees, no long links), so that a
  player who slides the drift corners well should outscore him. A last
  local search judged every candidate on all 21 runs (undisturbed and
  the 20 disturbances of measurement 2).

## The measurements

| # | measurement | result | key numbers |
|---|---|---|---|
| 1 | nothing that exists has changed | **PASS** | main's career 1 and The vice tapes replay to main's hash and score (895, 1,678); a live race (2,044 against 3,095, 9,424 steps) replays to both hashes and both totals; 3 known answers caught |
| 2 | he drives well, robustly, with a player's hands | **PASS** | 75.2 s, 2,662 points, 0 respawns, 0 hard, 0 contacts, lowest 83 km/h, least sliding corner 42%; 0 of 20 disturbed runs miss the bar; brake 0 steps, lift 0 steps, guard 0 steps; known answers: the old Kestrow braked on 648 steps and lifted on 1,066 (caught), a too-fast one misses in 6 of 6 (caught) |
| 3 | the race is a race | **FAIL** (3 of its checks) | mixed wins 2 of 20; place changes in 17 of 20 mixed races; with the close bonus at nothing the mixed player wins 1 of 20; the rest pass (below) |
| 4 | contact and passing | **FAIL** (2 checks) | no overlap past 0.3 m, every hard contact with a chain open lost it (4), his hash unchanged in all four; parked player held 1.2 s; the pin release never acted, so its known answer cannot be caught |
| 5 | frame time | **PASS** | low tier race p95 13.1 ms (15.1 ms with the scripted player's own look ahead) against 16.7; known answer 30.5 ms caught |
| 6 | layout | **PASS** | countdown, HUD, results won and lost, career card at 390x844, 844x390, 800x450, 1280x720: no overlaps, no scrolling; known answer caught |
| 7 | the camera | **PASS** | never inside either car (closest 5.43 m and 9.12 m), both in view at GO, level (0 m along, 4.4 m across) at 1280x720 and 390x844; known answer caught |
| 8 | the save | **PASS** | main's save with a tandem entry loads with 0 repairs, 0 changes, 0 additions; after a race the entry updates by main's rule; a wrong shape is repaired; quota passes |
| 9 | frames | done | 60 frames, none missing; looked at, notes below |

### 1. Nothing that exists has changed (`determinism.json`)

`node game/test/driftrace/determinism.js`. The tapes were recorded on
this branch's base, `main` at 3f0e724, by `main-record.js` in a worktree
of main (`main.json`).
- career 1: 895 points through the run structure and main's hash
  through the world. **PASS**
- The vice: 1,678 points and main's hash. **PASS**
- A race against Kestrow, live through the frame function with drawing,
  the mixed player playing (2,044 against 3,095, lost, 9,424 steps),
  replays to the same player hash, the same rival hash and the same two
  totals (each with its lead and line bonuses). **PASS**
- Known answers: main's tape with one steering entry turned the other
  way gives a different hash on both tracks; the race tape with one
  input changed gives a different player hash and leaves his unchanged;
  his entry speed 26.25 to 25.75 m/s gives a different rival hash. All
  **CAUGHT**.

His hash is taken at his line; when the player is home first the bare
replay runs him on to it, as the game does.

### 2. He drives well, robustly, with a player's hands (`hands.json`)

`node game/test/driftrace/hands.js`. The rivals round's bar, set then:
no respawn, no hard hit, at most 2 wall contacts, never under 40 km/h
after the launch, every corner at least 30 per cent sliding, his total
within 25 per cent of undisturbed. Plus the hands, every step: no brake,
the throttle full (it is full even in DRIFT with no steering, as the
player's is), and the guard never used.

| | s | total | respawns | hard | contacts | lowest km/h | least corner | brake / lift / guard steps |
|---|---|---|---|---|---|---|---|---|
| in the page | 75.2 | 2,662 | 0 | 0 | 0 | 83 | 42% (mean 60%) | 0 / 0 / 0 |
| 20 disturbances, worst | | 2,526 to 2,901 | 0 | 0 | 2 | 74.7 | 36% | 0 / 0 / 0 in all |

**PASS**, 0 of 20 miss the bar. Node's total matches the page's to the
point (the hashes differ in the last bits, the engines' Math).

His driving: shallow slides (17 to 24 degrees mean) in every corner,
each banked on its own, 42 to 79 per cent of each corner sliding.

Known answers:
- the old Kestrow (the rivals round's numbers, a driver allowed to lift
  and brake) braked on 648 steps (up to 0.39) and lifted on 1,066:
  **CAUGHT**;
- Kestrow made too fast with a player's hands (never brakes, chases
  ground, the edge nearly free) misses the bar in 6 of 6 runs (3 hard
  hits, a corner 8 per cent sliding): **CAUGHT**. The rivals round's
  too-fast numbers (entry and top speeds) no longer caught anything:
  with the throttle always on, those targets barely matter.

### 3. The race is a race (`racing.json`)

`node game/test/driftrace/racing.js`. In Node through the host's race
step, starter with no upgrades, 20 races per player: undisturbed, and 19
with the player's start a few cm off and his start and grip a little
off. Every scripted player has only the player's hands (checked every
step: 0 breaches). They see him and keep clear of him
(`RIVAL_DRIVE.AVOID_*`); he never sees them. The place counts from 3 s
after GO (both start level).

| player | wins | his finish vs theirs | ahead (share of race) | gates won (of 15) | first home | place changes | totals: player / Kestrow | contacts with him |
|---|---|---|---|---|---|---|---|---|
| grip (the line, no slide) | **0 of 20** | 73.5 to 76.0 s against his 74.2 to 76.2 | 25% to 100% | 4 to 15 | 16 of 20 | 0 to 14 | 767 to 1,198 / 2,526 to 3,071 | up to 17 |
| slide (every corner) | **17 of 20** | 86.0 to 89.9 s | 0% to 11% | 0 to 2 | 0 | 1 to 3 | 2,068 to 5,894 / 2,977 to 3,352 | up to 11 |
| mixed (the drift corners) | **2 of 20** | 73.3 to 82.7 s | 6% to 100% | 1 to 15 | 6 of 20 | 0 to 12 | 1,774 to 2,899 / 2,580 to 3,280 | up to 34 |
| never moves | loses | | | 0 | | | 0 / 3,113 | |

Undisturbed, what each part was worth (player / Kestrow):

| | drift | clean | pace | leads | first home | close |
|---|---|---|---|---|---|---|
| grip | 119 / 1,909 | 216 / 384 | 373 / 369 | 252 / 18 | 181 / 0 | 41 / - |
| slide | 3,549 / 1,909 | 336 / 384 | 311 / 369 | 0 / 270 | 0 / 181 | 0 / - |
| mixed | 1,363 / 1,909 | 288 / 384 | 357 / 369 | 108 / 162 | 0 / 181 | 80 / - |

The checks:
- the place changes hands at least once in every mixed race: **FAIL**,
  17 of 20;
- no player ahead all the way in every race, or behind all the way in
  every race: **PASS** for all three (grip ahead all the way in 2 of
  20, slide behind all the way in 0, mixed ahead all the way in 3);
- the mixed player wins: **FAIL**, 2 of 20, the narrowest margin -1,150;
- a player who never moves loses: **PASS**;
- with the lead and line bonuses at nothing, who wins (reported): grip
  0 of 20, slide 18 of 20, mixed 1 of 20;
- with the close bonus at nothing the mixed player still wins: **FAIL**,
  1 of 20 (it barely wins with it either).

Known answers: Kestrow made far too slow (99 to 109 s) is behind all the
way in every race of all three players, so the pace check fails for him:
**CAUGHT**. Against a rival who drives as the slide player does, the
mixed player's win check fails (0 of 4): **CAUGHT**.

**The two edge cases, for the author** (First slide, four laps, a gate
18 points, 15 gates, the line 181, Kestrow's own score 2,662):
- **Leads all the way but never slides**: the grip player, ahead 93 per
  cent of the undisturbed race and first home, scores **1,182 against
  2,680** and loses. Had he led every gate and the line he would have
  749 + 270 + 181 = **1,200 against 2,662**. Leading is worth about 450
  points in a race where Kestrow's drift alone is 1,909.
- **Slides well but trails all the way**: the slide player, ahead 0.4
  per cent of the race, no gate and no line, scores **4,196 against
  3,113** (his 2,662 plus every gate and the line) and wins by 1,083.

So as the numbers stand, sliding decides a race and leading is a small
garnish. If leading should matter more, `TANDEM.LEAD_SHARE` and
`LINE_SHARE` are the knobs: the whole lead pool is 45 per cent of the
first star (270 points) and the line 30 per cent (181).

Why the mixed player loses, as far as I can see:
- **at the players' pace, sliding every corner scores a lot.** A rival
  who slides every corner at the mixed player's pace outscores a player
  who slides two of three; that is why Kestrow is a modest, shallow
  drifter and still scores 1,909 in drift. Making him shallower (angle
  cap 15 to 17 degrees) broke the robustness bar (3 to 20 of 20 runs
  miss);
- **level starts at equal pace mean contact.** Alone the mixed player
  scores 3,141; in the race 1,774 to 2,899, because the two cars
  run together and touch up to 34 times, and a hard touch loses the
  chain. He does not see the player, the player's scripted driver does
  and still touches him. A human will avoid him better; that is the
  thing to play.

### 4. Contact and passing (`contact.json`)

`node game/test/driftrace/contact.js`. In Node, from the level grid,
every scripted player with the player's hands:
- **TAIL** pure pursuit on his car, flat out;
- **SWIPE** the mixed player until both slide with a chain open within
  8 m, then steered through him for 1.5 s;
- **PARK** drives to 120 m along his second lap's line at a speed it can
  stop from (pulsing DRIFT with the wheel straight), stops on it, holds
  DRIFT until he has come by, then drives on;
- **FOLLOW** "follows directly behind at a higher speed": a player has
  no throttle, so the higher speed is a quicker car, the starter with
  every upgrade, driving the grip player's line. It sits on his line, at
  his tail when within 9 m, for a lap; then takes its own line and goes
  for the side with more room when he is within 10 m ahead.

| | contacts (hard) | overlap after a step | hard with a chain open, kept | respawns after contact | held | his hash |
|---|---|---|---|---|---|---|
| TAIL | 10 (5) | 0 m | 0, 0 | 0 | 0.07 s | same |
| SWIPE | 23 (6) | 0 m | 4, 0 | 0 | 0.07 s | same |
| PARK | 2 (2) | 0 m | 0, 0 | 0 | **1.2 s** | same |
| FOLLOW | 8 (4) | 0 m | 0, 0 | 0 | 0.06 s | same |

- Boxes never overlap past 0.3 m: **PASS**. Every hard contact with a
  chain open lost it (4 of 4): **PASS**. His hash with the player there
  equals his run with no player, in all four: **PASS**. No NaN.
- **PARK: FAIL.** He comes through the parked player at 26 m/s, carries
  him along on his nose and leaves him against the wall, 1.45 m past the
  edge line, where he is held 1.2 s before the game's own recovery puts
  him back. Not a respawn in the 2 s after the contact; a stuck second.
- **FOLLOW gets past**: behind him for 31.9 s in all, by the following
  lap it is 6 m ahead of him 645 m into it. **PASS** (this changed with
  his final numbers; with the ones before it, it never got past in a
  race).
- **Known answer, the brief's: with the pin release off, the following
  case fails. MISSED.** With it off the follower gets past exactly as it
  does with it on, because the pin release acted on **0 steps in all
  four cases**. It only acts when a wall holds the player inside him;
  a player behind him is pushed back, not pinned. Getting past him
  depends on being quicker and taking another line. I also tried a
  second half to the release (let the player through after 0.3 s pressed
  against him without a break, which is the PARK case): it let PARK
  through on 8 steps, did not change PARK's result, and the following
  case stopped getting past, so I took it out.
- Known answer: with him not solid the tail run overlaps 2.77 m:
  **CAUGHT**.

`TANDEM.PIN_SLACK` is now 0.25 m (was 0.4): with 0.4 the release could
only act past the measure's own 0.3 m overlap tolerance.

### 5. Frame time (`perf.json`)

`node game/test/driftrace/perf.js`. As the rivals round: 390x844, 6x CPU
throttle, 300 frames less 30, JavaScript without `renderer.render`, the
chain held at x5. The player is the scripted drifter of the solo probes
(no look ahead of its own, as a human), and once the mixed scripted
player (a second look ahead: the worst case).

| | JS p95 ms, solo then race | physics p95 ms | draw calls | triangles |
|---|---|---|---|---|
| low, career 1 (night), Kestrow | 6.1, then **13.1** | 3.4, then 7.8 | 76, then 102 | 176,109, then 179,179 |
| high, career 1, Kestrow | 7.5, then 13.6 | 1.6, then 10.4 | 78, then 104 | 452,155, then 455,281 |
| low, career 21 (dawn), Sarrow | 4.0, then 9.3 | 1.4, then 6.3 | 68, then 93 | 333,911, then 338,503 |
| high, career 21, Sarrow | 5.6, then 11.7 | 1.6, then 8.0 | 72, then 98 | 891,207, then 895,859 |
| low, career 1, the mixed player playing | 15.1 | 9.4 | 104 | 179,375 |

**PASS**: the low tier's worst p95 is 15.1 ms, under 16.7, but closer to
it than the rivals round's 13.8. His look ahead is still the cost, and
with a player's hands it tries one more thing (the brake). Known answer:
20 ms of busy work gives 30.5 ms: **CAUGHT**. **The GPU cannot be
measured here** (SwiftShader); what the second car costs it is as the
rivals round listed (his smoke, his model's draw calls, his headlight
copy, his trails). The lead pops are DOM, a few a minute.

### 6. Layout (`layout.json`, `shots/layout-*.png`)

`node game/test/driftrace/layout.js`. At 390x844, 844x390, 800x450 and
1280x720, by bounding boxes: the countdown, the HUD mid race (the close
bonus at x1.6, the place and gap, the live score, his tag, a lead pop if
one is up), the results won (the slide player, 4,196 to 3,113) and lost
(the grip player held on the grid 8 s, 718 to 3,113), and the career
with his card. **PASS** at all four sizes, no scrolling; at 844x390 the
results card runs 24 to 364 px of 390 and every button is inside.
Known answer: the cards pulled 30 px up meet: **CAUGHT**.

It caught one fault on the way, fixed: over the countdown the sweep
swings round the cars, and the place label under the car met his total
at 844x390. The place now appears at GO.

### 7. The camera (`camera.json`)

`node game/test/driftrace/camera.js`. Every countdown frame at 60 Hz:
never inside either car's box grown by 0.3 m (closest 5.43 m to the
player, 9.12 m to him), both cars wholly in view at GO, and level (0 m
along, 4.4 m across), at 1280x720 and 390x844. **PASS**. The first run
failed at 390x844: from behind the player's car on the chase camera, he
was out of view at GO. The race's sweep now ends on a pair view (the
chase camera pulled back 3.5 m and moved halfway across to him) and eases
into the chase camera 0.9 s after GO. Known answer: with him 8 m back on
the grid the side by side check fails: **CAUGHT**.

### 8. The save (`save.json`)

`node game/test/driftrace/save.js`. The save main wrote (`main.json`:
career 1 with a star, a ghost, missions, coins, and a tandem battle
against Kestrow, so `rivals.r1 = { won: false, best: -227, when }`)
loads with 0 repairs, 0 values changed, 0 fields added, the entry as
stored. After a race (lost, 2,044 to 3,095) the entry is updated by
main's rule (won if ever won, the best margin: still -227), coins +204,
no ghost kept, nothing else changed. A wrong-shaped rivals entry is
repaired (3 fixes) and a race drives. Known answer caught. `quota.js`
passes. **PASS**.

### 9. Frames (`shots/`)

`node game/test/driftrace/shots.js`. 60 frames, `SIZE-PRESET-MOMENT.png`
for dusk and night at 1280x720, 390x844 and 844x390: grid, side (side by
side mid slide, the close bonus counting), ahead, behind, lead (a gate
just banked, its pop up), contact, finish, won, lost, career. None
missing. What I see:
- **Side by side mid slide at night is the frame of the round**: the two
  cars a metre apart sideways on the docks, both trailing red smoke and
  tail-light trails, "1ST +0.1 s" and "x1.6 CLOSE" under the player's
  car, DOOR TO DOOR called.
- The grid reads: both cars side by side, the heading "DRIFT RACE ·
  KESTROW" and "Outscore him. Lead at the gates and the line for a
  bonus."
- Place and gap read in their colours under the car at all three sizes;
  "2ND -0.3 s" in his red is clear.
- The lead pops are a little faint in a still (they rise and fade in
  1.3 s), and his sits over his car in his colour, yours over yours in
  cyan.
- **The finish frames are cluttered**: half a dozen CLEAN +24 and bank
  callouts stacked over the car. Callouts expire on the wall clock and
  the probe runs frames faster than real time, so they pile up in a
  probe; a real finish shows two or three at once. The rivals round's
  frames had the same artefact.
- In the contact frame at 1280x720 the first race's one prompt shows:
  "Slide close to him for more points, ahead or behind".
- The results card's table is small (12 px) but readable at 390x844;
  the lost card's secondary button still says "win a star, then come
  back", which is the career's wording, not the race's.

### Every probe in `game/test/`

Run in sequence on this branch (`runs/summary-all.txt`), then this
round's probes again on the final code (`runs/summary.txt`). Other
rounds' review files they rewrote were restored with `git checkout`.

| probe | result |
|---|---|
| `driftrace/hands.js`, `determinism.js`, `save.js`, `camera.js`, `layout.js`, `perf.js`, `shots.js` | pass |
| `driftrace/racing.js` | **fails** 3 checks (measurement 3 above) |
| `driftrace/contact.js` | **fails** 3 checks (PARK held, the pin release known answer, and PARK's known answer which cannot be judged) |
| `loop/quota.js`, `feel/handling.js`, `feel/corners.js`, `feel/probes.js` (14), `tracks/probes.js` (26), `visuals/occlusion.js` and `--career`, `visuals/probes.js` (7), `cars/measure.js`, `retention/codes.js`, `retention/heading.js` (28), `chapters/probes.js` (98), `stars/ghost.js` (4), `spectacle/determinism.js`, `smoke.js`, `adapt.js`, `layout.js`, `perf.js`, `loop/probes.js` (22) | pass |
| `tracks/tracks2.js` | the busyness known answer MISSED for circuits and sprints, as on `main`; not fixed |
| `cars/render.js` | fails, as on `main` (`lab/cars.html` reads `LOOK.SUN_DIR`); not touched |
| `spectacle/night.js` | **fails 1 of 8 moments on the low tier** (career 3 Crossover at 6 s, the edge at 80 m). **Identical numbers on `main` at 3f0e724**, run in a worktree: it comes from Crossover's new seed (1422), not from this round. Not fixed |
| `retention/probes.js` | 41 pass; its perf check fails, 6.1 ms against the stored 3.6 (noise 1.5). Run alone twice on the branch: 5.3 and 5.4 ms; on `main` twice: 5.0 (pass) and **5.4 (fail)**. The stored figure is stale and the check is at the edge of the sandbox's noise on `main` too; a solo career run runs none of this round's code |

`npm run build` passes: initial download 2.42 MB over 77 files (2.40 MB
over 76 after the rivals round).

## What the author should judge on his own devices

- **Is a drift race what you wanted?** Start level, race him into the
  first corner. Does being side by side into turn one feel like a race,
  or like a crash waiting to happen? Contacts are common at equal pace.
- **The two edge cases** (measurement 3): leading barely pays (18 a
  gate, 181 for the line), sliding decides. Is that right?
- **Can you beat Kestrow** by mixing grip and slides, in the starter?
  The scripted mixer mostly cannot. If you can, he may be right as he is
  and the scripted player is the weak part; if you cannot, he needs to
  score less.
- **Place and gap under the car**: readable without looking away?
- **The close bonus** (x1.6 at 4.5 m, nothing at 12 m): noticeable?
- **The lead pops**: too quiet? There is no sound for a gate.
- **The camera at GO** (the pair view, then into the chase camera in
  0.9 s): smooth, or a lurch?
- **Steering with thumbs**: see "Is the brief wrong anywhere?" first
  bullet.
- **Frame rate in a race** on the phone and the Chromebook (15.1 ms of
  JavaScript at 6x here, near the budget).

## Not done

- **Priority 4, the other five rivals.** Not started: Kestrow does not
  pass measurement 3, and the brief says Kestrow only until he is right.
  Their drivers now plan with a player's hands too (the rule is in the
  driver), so the five behind `?rivals=all` drive differently from the
  rivals round and are unmeasured.
- **Measurement 3's mixed win and place changes, measurement 4's PARK
  hold and the pin release's known answer**: failed, reported.
- A sound for a lead bonus (the brief keeps `audio/` unchanged; the
  existing cues could be called; I did not).
- The `CLAUDE.md` Status entry is the reviewer's.

## Deviations from the brief

1. **Kestrow's race is 4 laps** (`laps` in his roster entry, not in
   `TANDEM`): 3 laps were 57 s, under 60. Other rivals keep
   `TANDEM.LAPS` 2.
2. **`TANDEM` keeps its name** and holds the race's numbers; `AHEAD`,
   `STAGGER_*` and `CALL_FAR_AFTER` are gone, `GRID_SIDE`, `LEAD_SHARE`
   and `LINE_SHARE` are new, `BONUS` is 0.6 (was 1.5) and `FAR` 12 (was
   14), as a garnish. `PIN_SLACK` is 0.25 (was 0.4), see measurement 4.
3. **The lead and line bonuses are kept apart from both cars' scoring**
   (`scoring/lead.js`), so his driving hash and the player's solo score
   do not depend on the other car. A race's total is the two added.
4. **The scripted players see him and keep clear** (`AVOID_*` in
   `RIVAL_DRIVE`, used only with an avoid function, never by him). A
   player sees the other car; blind players crashed into him from the
   grid. It did not make the mixed player win.
5. **The follower is in an upgraded starter**: a player has no
   throttle, so "a higher speed" has to be a quicker car.
6. **The place waits for GO**, and the race's countdown ends on a pair
   view instead of on the chase camera (measurement 7).
7. **The first race's prompt** now says "Slide close to him for more
   points, ahead or behind" (it said to stay behind).
8. **The won results frame and layout case use the slide player** (the
   mixed player rarely wins); the lost case is the grip player held on
   the grid for 8 s.
9. **The probes that wrote rivals-round files now write
   `review/driftrace/`**; `review/rivals/` is left as that round's
   record.

## Is the brief wrong anywhere?

- **"The rival gets only what a player's hands can give."** The brief
  names the throttle, the brake and DRIFT. It does not name the steering,
  and that matters: on a phone and a keyboard the steering is three
  values (-1, 0, +1, `input/touch.js`); only a gamepad gives anything in
  between. Kestrow's driver steers into a slide at depths of 0.1 to 1.0.
  A thumb can approximate those by tapping; whether it can do so as
  well as he does is untested. If "a player's hands" means a phone's,
  his steering should be three-valued too, and he would need searching
  again.
- **Measurement 4's known answer** ("with the pin release off, the
  following case fails") cannot be caught in this physics: a player
  behind him is pushed back, not pinned, and the release acted on 0
  steps in every case. What decides a pass is being quicker on another
  line.
- **Measurement 3's "the mixed player wins"** against a rival who slides
  every corner, robustly, at the players' pace, is hard to have both
  ways with this scoring: sliding every corner at that pace scores more
  than sliding two of three. The way through I found is a shallow,
  modest Kestrow, and it was not enough for a scripted mixer. It may be
  enough for a human. Play will say.
- **"The rival's driver lifts and brakes" (`rivals/driver.js` writes
  `throttle` and `brake`)** was right, and the old Kestrow braked on 648
  steps and lifted on 1,066 of his race.
