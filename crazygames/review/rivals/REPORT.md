# Rivals and tandem: report (11 November 2026)

Branch `crazygames-rivals`, brief `briefs/RIVALS.md`. Every number below
was measured in this sandbox: headless Chromium drawing in software
(forced WebGL 2 on SwiftShader), and Node for the many-run parts. The
JSON beside this file is what the probes wrote; `runs/` holds the log of
every probe in `game/test/` run on this branch after the last code
change; `shots/` holds the frames.

## In short, for a phone

- **A battle is one run against a named rival.** He starts ahead on the
  grid, staggered to one side, and both go at GO. He drives his own
  line and drifts the corners; you chase. Circuits run 2 laps
  (`TANDEM.LAPS`).
- **He is the same every time.** He has his own physics world, stepped
  in lockstep with yours, and a driver that reads only his world. His
  run's hash is identical whatever you do: with you chasing, ramming
  him, parked on his line, or not there at all.
- **He drives by looking ahead.** Every 8 physics steps he tries a few
  ways to drive the next second on a copy of his own car: stay on grip,
  or slide at one of six depths of steering. He marks each try the way
  the game marks a drift, less a heavy cost for coming near the edge,
  plus the ground covered, and drives the best. He corrects himself a
  dozen times a second, which is what keeps him the same on another
  engine's maths.
- **The tandem.** While your slide scores and his does too, your drift
  points count up to 2.5 times (`TANDEM.BONUS` 1.5), at 4.5 m or
  closer, fading to nothing at 14 m. Ahead of him earns nothing.
  Everything else about the score is as it was.
- **He is solid and never moved by you.** A hard contact (5 m/s along
  the normal) is a wall hit: the chain is lost, the camera shakes,
  sparks fly, and the bonus is off for 1.5 s. After his finish he is no
  longer solid and fades out over 1.2 s.
- **The HUD:**
  - his total under yours, with who leads;
  - a five bar closeness meter that rides just under your car:
    green "x2.3 TANDEM" while it counts, amber "CLOSER", red "TOO FAR",
    grey "AHEAD: NO BONUS";
  - his name tag over his car;
  - an arrow with the distance when he is out of view;
  - TANDEM, DOOR TO DOOR and TOO FAR callouts.

  In a battle your live score sits beside your car, on the side away
  from him, so it never covers him.
- **Six rivals**, two in each chapter:

  | | rival | car | style | his track |
  |---|---|---|---|---|
  | Rookie | Kestrow | starter, flame | smooth and wide | 1 First slide |
  | Rookie | Tolvo | hatch, amber | fast and shallow | 7 Hairpin heaven |
  | Pro | Varsk | fastback, lime | late and aggressive | 9 Upper deck |
  | Pro | Dovane | tourer, wine | long, linked slides | 13 Over and under |
  | Legend | Halvik | drift build, magenta | the biggest angles | 17 Knot yard |
  | Legend | Sarrow | fastback, white | fast, deep and linked | 21 Endless eight |

  A rival opens with a star on his track and a win over the rival
  before him. Battles gate nothing that exists.
- **Rewards are coins**: the run's points at the career rate (0.1 a
  point) every time, and a prize the first time you beat him (300 to
  1,500). A battle earns no stars or missions, and no ghost is kept.
- **The career screen** shows a card after each rival's track: locked
  (with what opens him), BATTLE, or BEATEN with the best margin. A
  career result that opens a rival offers the battle beside NEXT.
- **What holds:**
  - Main's tapes replay to main's hash and score.
  - A battle replays to the same two totals and both hashes.
  - The save from main loads with nothing repaired and nothing changed.
  - Contact never leaves the cars overlapping.
  - The countdown camera is never inside either car, and both cars are
    in view at GO.
  - The layout is clean at all four sizes.
  - The low tier's JavaScript p95 at 6x throttle is 13.8 ms in a battle,
    against a 16.7 ms budget.
- **What does not hold, plainly:**
  - **The first rival is the only one fully measured as fair.** The
    scripted chase driver beats Kestrow in 9 of 12 battles in the
    starter and in none of 12 without the bonus. It is too weak a tool
    on the later tracks: it loses every battle to Tolvo and to Varsk,
    and beats Dovane while barely in the zone. So whether rivals 2 to 6
    are fair, and get harder in the right order, is not established.
    Play is the test.
  - **Rivals 2 to 6 drive their tracks cleanly undisturbed.** Under 20
    small disturbances each misses my bar in 2 to 6 runs: a corner
    sliding as little as 8 per cent, a light scrape or a few, one hard
    hit, and Varsk's total swinging from 3,058 to 5,363. Kestrow misses
    it in none.
  - **His look ahead costs about 5 ms of physics p95 at 6x** (1.7 ms solo
    to 6.8 ms in a battle with a cheap player). It is the biggest new
    cost, and it is what to watch on the Chromebook.
  - **A battle on First slide lasts about 45 s**, under the 60 to 120 s a
    run is meant to take. See "Deviations".

Preview: https://drift-fever-crazygames.novlrgames.workers.dev/ (this
branch is not on it until it is merged).

## What was built

```
game/src/rivals/roster.js    RIVALS: the six, their cars, paints, tracks, prizes and driving; who is open; his paint never the player's
game/src/rivals/driver.js    RIVAL_DRIVE: the look ahead driver (tries on a copy of his car, marked like the score, edges, chain, progress)
game/src/rivals/rival.js     his world in lockstep: grid start, his scoring, progress and race, his finish, the fade, his body and hash
game/src/rivals/chase.js     CHASE: the scripted chase driver for the measurements (and ?auto=1 in a battle)
game/src/scoring/tandem.js   the zone, the bonus, the callouts and the measured zone time
game/src/scoring/drift.js    an optional third argument: the tandem's multiplier on a step's drift points; s.tandem, what it added
game/src/physics/world.js    an optional obstacle: another car, solid, never moved; separating axes, the impulse in his frame, a pin release
game/src/tune.js             TANDEM: the battle's run numbers
game/src/loop/modes.js       battleSpec, battleLaps
game/src/loop/save.js        the rivals entry { won, best, when }, repaired on load; rivalResult
game/src/main.js             the battle: the rival, the tandem, the HUD, the first battle's prompt, the results, the offer, the probes' hooks
game/src/render/scene.js     his car, his marks (in the one ring), his own effects and show at their density, his own copy of the player's beam
game/src/env/effects.js, show.js   a second, smaller instance (SHOW.RIVAL), with no rain of its own
game/src/camera/director.js  the battle's countdown sweep (DIRECTOR.BATTLE_*)
game/src/ui/hud.js           HUD_BATTLE: his total, the meter, the tag, the arrow, the prompt; the live score beside the car
game/src/ui/screens.js       the battle's results; the career's rival cards; the offer on a career result
game/index.html              the styles for all of it
game/test/rivals/            the harness, a Node battle, the search, the track screen, and one probe per measurement
```

Every number of taste is in a named block with a one-line comment:
- `TANDEM` in `tune.js`;
- `RIVAL_DRIVE` in `rivals/driver.js`, and each rival's overrides of it
  in `rivals/roster.js`;
- `CHASE`, `HUD_BATTLE`, `SHOW.RIVAL`, `DIRECTOR.BATTLE_*` and
  `LOOK.RIVAL_BEAM`.

Not touched: `physics/vehicle.js`, `physics/driver.js`, `audio/`,
`assets/audio/`, `TUNE.VEHICLE`, `TUNE.ASSIST`, `TUNE.CAMERA`,
`TUNE.SCORING`, `LOOP` (stars, coins, prices, chapters).

### How each rival's driving was chosen

1. The first rival's numbers came from a search
   (`game/test/rivals/search.js`). It drives candidates in Node under 4
   small disturbances and keeps the one whose worst run marks best:
   - no respawn, no hard hit, no wall contact and no stall are demands;
   - then the least sliding corner, the mean, his total, and the
     spread of his total across the disturbances.

   The spread term mattered. A gap between two of First slide's corners
   takes about 1.5 s, the scoring's bank gap, so whether a chain linked
   was a coin toss, and at up to x8 that swung his total by a third. The
   search chose to bank every corner (`LINK` 5 m), and his total now
   stays within 3 per cent.
2. For the other five, `tracks.js` gave every track in the rival's half
   chapter a 24 try search in his car, inside his character's ranges
   (`search.js` `CHARACTERS`). It kept the best, less a cost for a
   battle outside 60 to 120 s (`tracks.json`).
3. The long search (130 tries) then ran on the chosen track.

The mark was changed once on the way: the first screen picked a track
where the tourer never slid at all, because "no slides, no hits" outscored
"slides with a scrape". Now a mean below 40 per cent and a corner below
20 per cent cost heavily.

### Names

Invented and searched. "Rook" was my first pick and was dropped: it is a
character in Fantasy Strike and Yomi (and an operator in Rainbow Six
Siege). Web searches for Kestrow, Tolvo, Halvik, Dovane, Sarrow and Varsk
as a driver, a team, a brand or a game character found none. Varsk turns
up only a similar Estonian village name (Värska) and a stock ticker
(VRSK).

## Measurements, each with its known answer

### 1. Nothing that exists has changed (`determinism.json`)

`node game/test/rivals/determinism.js`.

- The tapes recorded on main's code before any rival code
  (`main-tapes.json`, written by `main-tapes.js` at 450312f) replay on
  this branch:
  - career 1: 895 points through the run structure, and main's hash
    through the world. **PASS**
  - The vice: 1,678 points and main's hash. **PASS**
- A battle against Kestrow, live through the frame function with
  drawing (player 1,346, Kestrow 1,573, 5,378 steps), replays from its
  tape to the same player hash, the same rival hash and the same two
  totals. **PASS**
- Known answers:
  - Main's tape with one steering entry turned the other way replays to
    a different hash, on both tracks. **CAUGHT**
  - The battle tape with one input changed gives a different player
    hash, and his hash is unchanged by it. **CAUGHT**
  - The rival with one driving number changed (his entry speed, 24.74
    to 24.24 m/s) gives a different rival hash. **CAUGHT**

  My first pick of number, his edge margin, changed nothing he does, and
  the probe said so.

### 2. The rival drives well, and robustly (`drive.json`)

`node game/test/rivals/drive.js`. Each rival on his track, the battle's
laps. Undisturbed in the page (the record) and in Node, then 20
disturbances in Node: the start up to 5 cm off each way, and both axles'
grip up to 0.5 per cent off.

The bar was set before measuring:
- no respawn and no hard hit;
- at most 2 wall contacts (scrapes);
- never under 40 km/h after the launch;
- every corner at least 30 per cent sliding;
- his total within 25 per cent of undisturbed.

Undisturbed, in the page:

| rival | s | total | respawns | hard | contacts | lowest km/h | least sliding corner | mean |
|---|---|---|---|---|---|---|---|---|
| Kestrow | 41.0 | 1,573 | 0 | 0 | 0 | 83 | 44% | 50% |
| Tolvo | 61.7 | 2,168 | 0 | 0 | 0 | 65 | 47% | 60% |
| Varsk | 67.0 | 4,206 | 0 | 0 | 0 | 83 | 35% | 55% |
| Dovane | 55.6 | 2,475 | 0 | 0 | 0 | 84 | 69% | 83% |
| Halvik | 67.6 | 2,022 | 0 | 0 | 0 | 78 | 42% | 54% |
| Sarrow | 68.7 | 3,550 | 0 | 0 | 0 | 77 | 56% | 74% |

Every rival passes undisturbed. **PASS** (6 of 6)

Under 20 disturbances, the worst case of each:

| rival | runs missing the bar | respawns | hard | contacts | lowest km/h | least sliding corner | total |
|---|---|---|---|---|---|---|---|
| Kestrow | **0** | 0 | 0 | 0 | 81.7 | 42% | 1,517 to 1,596 |
| Tolvo | 5 | 0 | 0 | 1 | 64.5 | **8%** | 2,011 to 2,298 |
| Varsk | 6 | 0 | 0 | 0 | 82.1 | 35% | **3,058 to 5,363** |
| Dovane | 6 | 0 | 0 | **5** | 82.4 | 62% | 2,245 to **3,105** |
| Halvik | 2 | 0 | **1** | 1 | 49.2 | 40% | 1,867 to 2,043 |
| Sarrow | 4 | 0 | 0 | **3** | 75.7 | 31% | 3,240 to 3,550 |

Kestrow **PASS**. The other five **FAIL** my bar in the runs counted.
Nobody respawns or stalls, and only Halvik ever hits hard. What fails is
consistency: a corner Tolvo sometimes barely slides, Varsk's chain
linking or not, and a few scrapes.

In Node the totals match the page to the point for four of the six
(Dovane 2,445 against 2,475). The hashes differ in the last bits
everywhere, as the brief expected of the engines' maths, and he stays on
course.

Known answer: Kestrow made too fast (entry 32 m/s, top 40, progress worth
twice as much, the edge nearly free) misses the bar in 6 of 6 runs, with 5
hard hits, a corner at 0 per cent, and 502 points against 1,573.
**CAUGHT**

### 3. The battle is fair (`fair.json`)

`node game/test/rivals/fair.js`. In Node through the host's battle step,
12 battles per rival: the undisturbed one, and 11 with the chase driver's
gap and his start and grip a little off.

The chase driver (`rivals/chase.js`) is the rival's own driver in the
player's car. Its look ahead is pulled onto the line he actually drove,
and it holds a 6.5 m gap. For Pro and Legend the probe climbs a ladder of
cars and upgrades until the chaser wins most battles.

| rival | chase car | chase wins | worst margin | in the zone, mean / worst | careful driver | never moves |
|---|---|---|---|---|---|---|
| Kestrow | starter, none | **9 of 12** | -227 | 64% / 48% | loses 12 of 12 | loses |
| Tolvo | starter, none | **0 of 12** | -1,968 | 75% / 48% | loses 12 of 12 | loses |
| Varsk | every car up to a fully upgraded drift build | **0 of 12** | -3,782 | 81% / 54% | loses 12 of 12 | loses |
| Dovane | starter, none | 10 of 12 | -174 | **14% / 6%** | loses 12 of 12 | loses |
| Halvik | starter, none | 8 of 12 | -504 | 82% / 65% | loses 12 of 12 | loses |
| Sarrow | starter, none | 7 of 12 | -1,588 | 57% / 10% | loses 12 of 12 | loses |

Known answer: the same 12 chase battles against Kestrow with the tandem
bonus at nothing lose 12 of 12 (undisturbed, 1,005 against 1,573). So the
tandem decides that battle. **CAUGHT**

What this does and does not show:
- **Kestrow: PASS.** He is chaseable in the starter with no upgrades,
  and the tandem is what wins.
- **The undisturbed chase against Kestrow loses** (1,393 against 1,573).
  The chaser's wins come from its disturbed runs. It is noisy: on its
  good runs it stays in the zone, on its bad runs it hits walls and
  loses whole chains.
- **Tolvo and Varsk: FAIL.** The chaser loses every battle even while in
  the zone 75 and 81 per cent of the time. It hits walls on those
  tracks. A version driving with numbers tuned for the starter did no
  better. So I cannot say whether a good human can beat them, and
  Tolvo is a Rookie rival who must be chaseable in the starter.
- **Dovane: the tandem does not decide.** The chaser beats him while
  barely in the zone, so his own score is low for his track.
- "They get harder" is **not** shown. By total against their tracks:
  Kestrow 1,573, Tolvo 2,168, Varsk 4,206, Dovane 2,475, Halvik 2,022,
  Sarrow 3,550.

### 4. Contact (`contact.json`)

`node game/test/rivals/contact.js`. Against Kestrow, in Node. Three
scripted players:
- **TAIL** pursues his car at up to his speed plus 5 m/s.
- **SWIPE** chases him until both are sliding with a chain open, then
  steers into his side.
- **PARK** stops on the line he takes on his second lap, 120 m along,
  waits, then drives on.

The bar:
- the boxes never overlap by more than 0.3 m after a step (a step at
  20 m/s closing is 0.17 m);
- every hard contact with a chain open loses it;
- no respawn in the 2 s after a contact (the game's own "off the
  track");
- never held under 1 m/s for more than 1 s while asking to drive;
- no NaN;
- his hash equal to his run with no player at all.

| | contacts (hard) | largest overlap after a step | hard with a chain open, kept it | respawns after contact | held | closest centres | his hash |
|---|---|---|---|---|---|---|---|
| TAIL | 6 (1) | 0 m | 0, 0 | 0 | 0.07 s | 4.41 m | same |
| SWIPE | 6 (2) | 0 m | 2, 0 | 0 | 0.07 s | 3.02 m | same |
| PARK | 3 (3) | 0 m | 1, 0 | 0 | 0.07 s | 0.12 m (*) | same |

All **PASS**.

(*) After his finish he is not solid, so the parked player drove on
through his fading car.

Run-off, for comparison: the ram script alone, with him not solid, runs
1.5 m past the edge line on its own. With him solid, up to 2.8 m. That is
into the run-off, inside the walls.

Known answer: with him not solid, the tail ram overlaps 2.23 m.
**CAUGHT**

The pin release (`TANDEM.PIN_SLACK`: a wall holding the player 0.4 m
inside him lets him through until they part) is in the code, but none of
these scenarios triggered it. It is unmeasured.

### 5. Frame time (`perf.json`)

`node game/test/rivals/perf.js`. Measured as the spectacle round did:
- 390x844, 6x CPU throttle;
- 300 frames, with the first 30 dropped;
- JavaScript without `renderer.render`;
- the player's chain held at x5;
- the chase driver keeping him in view.

| | JS p95 ms, solo then battle | physics p95 ms | draw calls | triangles |
|---|---|---|---|---|
| low, career 1 (night), Kestrow | 5.7, then **13.8** | 1.7, then 9.4 | 76, then 104 | 176,113, then 182,633 |
| high, career 1, Kestrow | 6.0, then 13.5 | 1.9, then 9.3 | 78, then 106 | 452,163, then 458,743 |
| low, career 21 (dawn), Sarrow | 4.7, then 10.3 | 1.5, then 8.3 | 68, then 95 | 333,911, then 342,413 |
| high, career 21, Sarrow | 4.7, then 12.2 | 1.6, then 8.5 | 72, then 100 | 891,207, then 900,341 |
| low, career 1, Kestrow, the scripted drifter playing | 5.7, then **9.2** | 1.7, then **6.8** | 76, then 102 | |

The bar is the low tier's p95 under 16.7 ms in a battle. **PASS**, worst
13.8 ms.

Known answer: 20 ms of busy work per frame gives 34.6 ms. **CAUGHT**

The chase driver runs the same look ahead as the rival, so the chased
rows count it twice. The last row, with a cheap player, is what a human
battle costs: about **3.5 ms of JavaScript p95 and 5 ms of physics p95 at
6x**, nearly all of it his look ahead. Unthrottled, his driver costs
about 0.09 ms a physics step in Node. Already done to make it cheaper:
- a table for the corner lookups;
- a copy of the car stepped at 60 Hz;
- each look's 7 tries spread one a step, so no frame carries them all.

The knobs if it shows on a Chromebook are `RIVAL_DRIVE.HORIZON`,
`REPLAN`, `SUB` and the number of `INTO` depths.

**The GPU cannot be measured here** (SwiftShader draws in software). What
the second car costs the GPU, in likely order:
1. His smoke: up to 55 puffs on the low tier (half the player's pool,
   `SHOW.RIVAL.SHARE`), 182 on the high, soft blended quads with
   overdraw. The player's own smoke is unchanged.
2. His car model: about 20 to 28 more draw calls (the model's parts,
   his trails, glows and pools). These are draw calls, not triangles
   (+6,500).
3. His copy of the headlight: a second spot light in his materials
   only, so it costs on his pixels alone.
4. Small: his trails (70 quads), his glows (40 on the low tier), his
   sparks and marks (the marks share the player's ring and its budget).

### 6. Layout (`layout.json`, `shots/layout-*.png`)

`node game/test/rivals/layout.js`. At 390x844, 844x390, 800x450 and
1280x720, by bounding boxes.

- **The countdown**: the heading and its line, the count, both totals,
  the readout, the lap and clock, the buttons and the pads. No overlaps,
  all inside the view. **PASS** at four sizes.
- **The HUD mid chase**, the tandem at x2.4: the fixed elements, the
  meter, the live score and his tag. None meets another. **PASS** at
  four sizes.
- **The results, won and lost.** No scrolling and no parts meeting; at
  every size the card and the REMATCH, CAREER and MENU buttons are
  inside the view. **PASS** at four sizes.

  | size | card | REMATCH bottom | CAREER and MENU bottom |
  |---|---|---|---|
  | 844x390 | 82 to 306 px of 390 | 206 | 288 |
  | 390x844 | 65 to 570 px of 844 | 463 | 550 |
  | 800x450 | 112 to 336 px of 450 | 236 | 318 |
  | 1280x720 | 57 to 551 px of 720 | 444 | 531 |

- **The career with its six cards** (beaten, open, four locked): every
  card inside the list, its parts apart, and no card meeting a row or a
  chapter head. **PASS** at four sizes.
- Known answer: the cards pulled 30 px up onto the row above meet in 6
  places. **CAUGHT**

The first runs caught real faults, all fixed:
- the battle's line ran off a portrait screen;
- in landscape the heading box met his total and the count;
- the off screen arrow showed during the countdown and sat on the left
  pad;
- the first battle's prompt overflowed and lost its centring in its
  fade in (the same `--tx` the other centred boxes use).

In a solo run on `main` the count meets the mission box at 844x390 too.
That is not mine and was not changed.

### 7. The camera (`camera.json`)

`node game/test/rivals/camera.js`. Every frame of the countdown at 60 Hz,
for all six rivals at 1280x720 and 390x844. The camera is never inside
either car's box (grown by 0.3 m): it comes no nearer than 5.45 m to the
player and 7.71 m to the rival. At GO both cars are wholly in view.
**PASS** (12 of 12)

Known answer: the solo sweep (`DIRECTOR.BATTLE` off) with the rival
straight ahead (`TANDEM.STAGGER_SIDE` 0) is inside him for 28 frames.
**CAUGHT**

Every track's start is straight, so the numbers are the same for every
rival. The finish beat is unchanged: the slow motion and the side-on
swing follow the player.

### 8. The save (`save.json`)

`node game/test/rivals/save.js`.

- The save main's code wrote (`main-save.json`) loads with 0 repairs,
  0 values changed, and one field added: `rivals = {}`. **PASS**
- After a battle from it, the save gains `rivals.r1 = { won, best,
  when }` (best -227, the margin) and the run's coins. No ghost is kept
  for it, and nothing else changes. **PASS**
- A rivals entry of the wrong shape (an unknown rival, wrong types, not
  an object) loads with 3 fixes and nothing else changed, a battle
  drives, and the career shows its cards, with no page errors. **PASS**
- Known answer: that save fails the rivals invariants raw and passes
  them repaired. **CAUGHT**
- `game/test/loop/quota.js` passes (6 verdicts). **PASS**

### 9. Frames (`shots/`)

`node game/test/rivals/shots.js`. 48 frames: `SIZE-PRESET-MOMENT.png` for
dusk (day) and night, at 1280x720, 390x844 and 844x390.

The moments:
- `countdown`;
- `close`: mid slide, a few metres behind him, the tandem at x2.5;
- `far`: the chaser held 16 m back, TOO FAR showing;
- `contact`: the frame of a swipe into his side. At 1280x720 it is the
  first battle ever, so its one prompt shows;
- `finish`: his finish, fading;
- `won` and `lost`: the results;
- `career`: the rival cards.

All were looked at. What I see:
- **The close chase at night is the best of them**: two cars sideways a
  few metres apart on the docks, him red in the player's lights with
  his tag, both trailing red smoke and tail-light trails, the bonus
  green under the player's car. It reads at all three sizes.
- It is good, not yet spectacular. The camera is the author's chase
  camera, high and behind, so he is mostly seen past the player's car
  and at about a fifth of its size on screen.
- **His paint at night**: a version lit by the scene's own headlight
  washed him to white at 5 m (the beam is about 13 times stronger there
  than at 20 m). He now has his own copy of it, which never lights him
  more brightly than at 26 m. Without that he was a dark shape.
- **The `finish` frames are weak**: they catch him 77 m ahead, small.
- **The `won` frames show 11,321 points**: that tape was recorded with a
  probe-only bonus of 40 so that it would win. The card is real, the
  number is not a real battle's.
- By dusk, the smoke is the warm grey of the spectacle round. At night
  it is the round's pink-red, and it is a lot of smoke with two cars
  making it.

### Every probe in `game/test/`

Run in sequence on this branch after the last code change. Each log is in
`runs/`, and `runs/summary.txt` holds the exit codes. The probes rewrite
other rounds' `review/` files; those were restored, so only
`review/rivals/` belongs to this branch.

| probe | result |
|---|---|
| `rivals/determinism.js`, `drive.js`, `fair.js`, `contact.js`, `camera.js`, `layout.js`, `save.js`, `perf.js` | as above: `drive.js` fails my disturbance bar for rivals 2 to 6, and `fair.js` fails for Tolvo and Varsk; the rest pass |
| `loop/quota.js`, `feel/handling.js`, `feel/corners.js` | pass |
| `feel/probes.js` | all passed, 14 verdicts |
| `tracks/probes.js` | all measurements pass, every known answer caught |
| `tracks/tracks2.js` | the busyness known answer MISSED for circuits and sprints, as on `main`. Reported, not fixed |
| `visuals/occlusion.js`, `--career` | all passed |
| `visuals/probes.js` | all passed, 7 verdicts |
| `cars/measure.js`, `retention/codes.js` | pass |
| `cars/render.js` | **FAILS, also on `main`**: `lab/cars.html` reads `LOOK.SUN_DIR`, which `render/scene.js` has not had since an earlier round (absent at 450312f too), so the turntable never starts. Not touched; reported |
| `retention/heading.js` | all passed, 28 verdicts (after the offer fix in deviation 8) |
| `chapters/probes.js` | all passed, 98 verdicts |
| `spectacle/determinism.js`, `night.js`, `smoke.js`, `adapt.js`, `layout.js`, `perf.js` | all passed (10, 4, 5, 14, 9, 2 verdicts) |
| `retention/probes.js` | all passed, 42 verdicts; its perf check read 4.3 ms against the stored 3.6 (noise 1.5) |
| `loop/probes.js` | all passed, 22 verdicts |

`npm run build` passes: initial download 2.40 MB over 76 files (2.32 MB over 71 after the spectacle round).

## What the author should judge on his own devices

- **Is chasing Kestrow the best thing in the game?** It is the one rival
  measured as fair. On First slide at night, follow him into the first
  corner and see whether the meter under the car reads without looking
  away from the cars.
- **The bonus and the zone**: x2.5 at 4.5 m, nothing at 14 m
  (`TANDEM.BONUS`, `NEAR`, `FAR`). Too generous? Too tight for thumbs?
- **Tolvo and Varsk**: can you beat them in the cars the career would
  have you in? The scripted chaser cannot.
- **Frame rate in a battle** on the phone and the Chromebook. His look
  ahead is the new cost; `RIVAL_DRIVE.REPLAN` and `HORIZON` are the
  knobs.
- **Contact**: does a hard contact (5 m/s, `TANDEM.HARD_HIT`) feel fair,
  and is losing the clean sector to it right?
- **His colour at night** (`LOOK.RIVAL_BEAM.ref`), and whether two cars'
  smoke at night is too much.
- **Battle length**: First slide is about 45 s at 2 laps.
- **The prizes**, 300 to 1,500 coins.

## Not done

- **Rivals 2 to 6 are built but not proven.** Their fairness and their
  order of difficulty are not established (measure 3), and they miss
  the driving bar in some disturbed runs (measure 2). Each is a fixed
  set of numbers and a track; play will tell.
- **The chase driver is weak beyond career 1.** A stronger one, or a
  thumb, is needed to judge the others.
- **The pin release is untested** by any scenario.
- **Rival sounds**: none, as the brief says. The tandem callouts use the
  existing clean sector cue.
- **The `CLAUDE.md` Status entry** is the reviewer's.

## Deviations from the brief

1. **A battle on First slide lasts about 45 s, not 60 to 120.** "Circuits
   run fewer laps in a battle" (2 of 3) and "inside 60 to 120 s" cannot
   both hold for a 518 m lap; I kept fewer laps (`TANDEM.LAPS`). The
   other rivals' battles run 56 to 69 s.
2. **A battle earns no stars, missions or career result.** Its coins
   are the run's points at the career rate and the first win's prize.
   That keeps "battles gate nothing that exists" exact.
3. **A rival contact counts as a hit in the world** (`world.hits`), so it
   costs the sector's clean bonus, as a wall hit does ("a hit like a wall
   hit").
4. **The chase driver is in `game/src/rivals/`**, not `game/test/`. The
   page must load it, and `test/` is not served. It ships, small, and
   `?auto=1` in a battle drives it.
5. **Measures 2 (disturbances), 3 and 4 run in Node** through the same
   code; the page is the record for the undisturbed runs (measures 1, 2,
   5 to 9). The page and Node agree on four of six rivals' totals to the
   point.
6. **His lighting.** The player's headlight never lights the rival; his
   own dimmed copy of it does (`LOOK.RIVAL_BEAM`). The headlight itself
   is unchanged.
7. **In a battle the live score sits beside the car** (`HUD_BATTLE`), and
   on a short landscape screen the count is smaller and lower, so neither
   sits on him or his total. Solo runs are unchanged.
8. **A career result that opens a rival offers the battle beside NEXT**,
   as a secondary button. My first version made it the main button, and
   `retention/heading.js` caught that it took NEXT's place.
9. **Two of the rivals' cars repeat** (Varsk and Sarrow both drive the
   fastback, in lime and white); the hatch, tourer and drift build have
   one each.

## Is the brief wrong anywhere?

- **The 60 to 120 s rule against fewer laps**, as above, for the first
  track.
- **"Build a scripted chase driver for the measurements (it follows the
  rival and slides when he does)"** reads as a small tool. In this car a
  slide is a tight arc (about 20 to 36 m radius at its 24 m/s cruise), so
  two cars in different places do different things with the same
  inputs. A chaser good enough to judge fairness is as hard to build as
  the rival. Mine is good enough for career 1 only.

## The lead run, my view

The rival chasing the player. What it would take:
- His driver would read the player's world. The chase driver already
  does exactly that (it follows the line the other car drove), so the
  brain exists.
- The score would need a rule for leading: points for keeping him close
  behind while you slide.
- His run would then depend on the player. It would still replay
  exactly, since the tape replays the player and he follows, but "the
  same every time" would no longer hold.

I would build it only after play shows the chase is fun. If built, I
would make him chase the player's own best battle as a ghost, so he
stays the same for a given ghost. About a round of work, most of it
making a chaser good on every track. That is the part this round shows
is hard.
