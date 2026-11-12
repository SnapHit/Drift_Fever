# The rivals ladder: report (12 and 13 November 2026)

Branch `crazygames-ladder`, brief `briefs/RIVALS-LADDER.md`. Every number
below was measured in this sandbox: headless Chromium drawing in software
(forced WebGL 2 on SwiftShader), and Node for the many-run parts. The JSON
beside this file is what the probes wrote; `runs/summary.txt` has the exit
code of every probe in `game/test/` on the final code; `shots/` holds the
frames.

## In short, for a phone

- **RIVALS is on the title**, beside the career and the daily. Before
  anything is earned it says "Win a star on First slide to race Kestrow";
  then how many are beaten ("1/2 beaten"), with an orange RACE mark
  whenever a rival is earned and not yet beaten ("Tolvo is waiting").
- **The rivals screen shows all six from the first visit**, in ladder
  order. Each card is edged and named in his paint, with his own car drawn
  in that paint (by the game's renderer, no images), how he drives, his
  track, laps and car, his prize, and his state: what earns him with each
  part ticked, RACE, or BEATEN with the best margin (still raceable).
- **A race is earned as before** (a star on his track and a win over the
  one before), and the ladder is now a strict chain: a stored win over the
  third with none over the second does not open the fourth.
- **Offers repeat.** A career result on a rival's track offers his race
  beside NEXT every time he is earned and not beaten. A race's results
  name the next rival and either offer him or say, ticked, what still
  earns him, and always offer the rivals screen.
- **Two rivals are in the game (`TANDEM.LIVE` 2): Kestrow and Tolvo.**
  Tolvo is new: Tight city, three laps, the light hatch in amber, 83.5 s,
  4,849 of his own. He passes measures 2 and 3: clean and robust with a
  player's hands, and the scripted players win 0 (grip), 3 (slide) and 8
  (mixed) races of 20 against him, against Kestrow's 9, 12 and 6. The
  ladder climbs on both counts (wins 27 to 11, his multiple of the three
  star target 1.26 to 2.72).
- **The ladder stops at Varsk**, the third. On every Pro circuit the
  scripted slide player is 14 to 17 s slower over three laps than the grip
  and mixed players, so a rival at the players' pace leaves it behind all
  the way in every race and the race bar fails. What I tried is below.
  Varsk, Dovane, Halvik and Sarrow are built and measured and wait behind
  `?rivals=all`; on the rivals screen they say SOON, "not in the game yet".
- **Priority 4:** the pin release is proved and stays (swiping Varsk on
  Upper deck it lets the player through on 41 steps and the boxes overlap
  0.22 m at most; with it off, 0.93 m). The parked player's 1.2 s hold is
  the game's own stuck recovery (`TUNE.ASSIST.RECOVER_AFTER` 1.2 s), not
  the rival, so the 1 s bar cannot be met without retuning the author's
  block. Not changed.

Preview: https://drift-fever-crazygames.novlrgames.workers.dev/ (this
branch is not on it until it is merged).

## What was built

```
game/src/rivals/roster.js   rivalNeeds (what earns him, in the player's words, ticked), rivalState (off, locked, open, beaten), ladderSummary (the title's line); the ladder a strict chain; Tolvo on Tight city, 3 laps, searched again, a true style line; Varsk on Upper deck, 3 laps, the closest found (not in the game)
game/src/ui/screens.js      the RIVALS button and its mark; the rivals screen; the career card's words from rivalNeeds; the career result's offer beside NEXT; a race's results naming the next rival, with RIVALS
game/src/ui/portraits.js    PORTRAIT: each rival's car in his paint, drawn once by the game's renderer into its canvas and copied out in the same task (never shown in a frame), kept for the session
game/src/main.js            the rivals screen and its action; the repeating offer; nextRival for a race's results; finishNow, a probe hook
game/index.html             the title's six buttons (two to a row on a portrait phone), the mark, the rivals screen's cards, the results' three-button row; the title's small buttons 44 px on a short landscape screen
game/src/tune.js            TANDEM.LIVE 2
game/test/ladder/           earning.js (m4), layout.js (m5), rivals.js (m2, m3, the ladder table), determinism.js and main-record.js (m1), save.js (m8), pin.js (priority 4), shots.js (m9), search.js, run-all.sh
game/test/driftrace/        search.js: an optional stronger total ceiling and measure 2's total bar as a demand (both off by default); contact.js: --out
```

Every number of taste is in a named block with a one-line comment:
`PORTRAIT` (portraits.js), `PLAYER_CAR` (test/ladder/lib.js), `RACE`
(test/ladder/rivals.js), each rival's `track`, `laps` and `drive` in the
roster.

Not touched: `physics/`, `audio/`, `assets/audio/`, `TUNE.VEHICLE`,
`TUNE.ASSIST`, `TUNE.CAMERA`, `TUNE.SCORING`, `LOOP`, career seeds,
Kestrow's driving and laps, `TANDEM.LEAD_SHARE`, `LINE_SHARE`, `BONUS`,
`NEAR`, `FAR`, `PIN_SLACK`, the save's shape.

## The ladder table

`node game/test/ladder/rivals.js` (`rivals.json`). His own total is
undisturbed, in the page. The multiple is his total over his track's three
star target at his race's laps (in brackets, at the career's laps, the
literal target). Wins are of 20 disturbed races each.

| # | rival | track | car | laps | race s | his total | x 3 star | grip | slide | mixed | all | players drove | in the game |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Kestrow | 1 First slide | starter (flame) | 4 | 75.2 | 2,662 | 1.26 (1.69) | 9 | 12 | 6 | 27 | starter, no upgrades | yes |
| 2 | Tolvo | 5 Tight city | hatch (amber) | 3 | 83.5 | 4,849 | 2.72 (2.72) | 0 | 3 | 8 | 11 | starter, no upgrades | **yes, new** |
| 3 | Varsk | 9 Upper deck | fastback (lime) | 3 | 91.2 | 4,333 | 1.94 (1.94) | 0 | 0 | 4 | 4 | starter, one step of each | no: fails 2 and 3 |
| 4 | Dovane | 13 Over and under | tourer (wine) | 2 | 56.4 | 2,006 | 1.43 (0.95) | 0 | 14 | 9 | 23 | starter, one step of each | no: unsearched, fails 2 and 3 |
| 5 | Halvik | 17 Knot yard | drift build (magenta) | 2 | 69.2 | 1,684 | 1.22 (0.81) | 14 | 12 | 20 | 46 | starter, two steps of each | no: unsearched, fails 2 and 3 |
| 6 | Sarrow | 21 Endless eight | fastback (white) | 2 | 75.6 | 856 | 0.66 (0.44) | 13 | 18 | 15 | 46 | starter, two steps of each | no: unsearched, fails 2 |

Dovane, Halvik and Sarrow are as the rivals round chose them, their
drivers now planning with a player's hands; their tracks and laps were not
revisited (Dovane's race is 56 s, under 60), because the ladder stopped at
Varsk.

**The car the players drive** (`PLAYER_CAR`): the starter throughout,
because the scripted players were chosen in it and a player who knows it is
likelier to spend on its steps than on a new car. Rookie: no upgrades (the
brief). Pro: one step of each (750 coins). Legend: two of each (2,250).
When Pro opens (12 Rookie stars) a player has at least 12 x 130 = 1,560
coins from stars and their new star bonus, plus a tenth of every run's
points (Rookie runs score 500 to 1,500, so 50 to 150 a run), 60 a mission
and 700 from Kestrow's and Tolvo's prizes: comfortably over 750. Legend
needs 14 more Pro stars (1,820 more) and the Pro runs: over 2,250. These
are estimates from the prices; nobody has played a whole career to check.

## The measurements

| # | measurement | result | key numbers |
|---|---|---|---|
| 1 | nothing that exists has changed | **PASS** | main (2cdccde) recorded career 1 (895), The vice (1,678) and a race against Kestrow (2,114 against 4,497): all replay here to main's scores, hashes and both totals; 4 known answers caught |
| 2 | each new rival drives well, robustly, with a player's hands | Tolvo **PASS**, Varsk **FAIL** | Tolvo: 0 respawns, 0 hard, 0 contacts, lowest 64.3 km/h, least sliding corner 34% (31% worst disturbed), total 4,177 to 5,005 disturbed, 0 of 20 miss, brake, lift and guard 0. Varsk: 2 of 20 miss (a hard hit, 4 contacts, a corner 0% sliding) |
| 3 | each new rival is a race, and the ladder climbs | Tolvo **PASS**, Varsk **FAIL**; the climb **PASS** over the two in the game | Tolvo: wins 0, 3, 8; no player ahead or behind all the way in every race; a still player loses 0 to 6,481. Varsk: wins 0, 0, 4 and the slide player behind all the way in 20 of 20. Climb: Kestrow to Tolvo wins fall and the multiple rises; Tolvo to Varsk wins fall; fails from Varsk to Dovane on (unsearched). Known answer: Kestrow and Tolvo swapped fails: caught (every adjacent swap caught) |
| 4 | earning and the screen's states | **PASS** | 19 of 19 steps right with all six and 19 of 19 as shipped; all five routes into a race open exactly for an earned rival; known answer held, its inverse caught |
| 5 | layout | **PASS** | 44 checks at 390x844, 844x390, 800x450, 1280x720: no overlaps, no title scroll, the rivals header fixed, every button 44 px or more, no name broken across lines; known answer caught |
| 6 | contact, each new rival | **FAIL**, as Kestrow | Tolvo and Varsk: no overlap past 0.3 m outside a release, his hash unchanged by the player; PARK held 1.16 s and 1.18 s (bar 1 s); the follower never gets past either |
| 7 | frame time | **PASS** | Tolvo on Tight city, low tier, 6x throttle: JavaScript p95 5.4 ms solo, 10.6 and 11.4 ms in the race, 14.2 ms with the scripted player's own look ahead (budget 16.7); known answer 30.6 ms caught. The GPU cannot be measured here |
| 8 | the save | **PASS** | main's save, with a drift race `rivals` entry, loads with 0 repairs, 0 changes, 0 additions; quota.js 6 of 6 |
| 9 | frames | done | 42 frames plus 44 layout frames in `shots/` |

### 1. Nothing that exists has changed (`determinism.json`, `main.json`)

`game/test/ladder/main-record.js` ran on `main` as it is now (2cdccde, in
a worktree) and recorded the scripted drifter on career 1 (895, 8,396
steps) and The vice (1,678, 15,062 steps), a drift race against Kestrow
with the mixed scripted player (2,114 against 4,497, 9,424 steps), and the
save that leaves. `game/test/ladder/determinism.js` replays them here: the
same scores through the run structure, the same world hashes, and for the
race the same player hash, rival hash and both totals. Known answers: one
steering entry turned the other way changes the hash on both tracks
(caught) and the race's player hash while his stays (caught); his corner
entry 26.25 to 25.75 m/s changes his hash (caught). **PASS**.

### 2 and 3. Each new rival (`rivals.json`)

`game/test/ladder/rivals.js`. Measure 2 is the drift race's bar
(`driftrace/hands.js`): in the page and under 20 disturbances in Node, no
respawn, no hard hit, at most 2 contacts, over 40 km/h, every corner at
least 30 per cent sliding, his total within 25 per cent of undisturbed, and
only a player's hands. Measure 3: 20 disturbed races for each scripted
player in the car named above; at least two of three win 3 or more, none
wins all 20; nobody ahead, or behind, all the way in every race; a still
player loses.

**Tolvo** (Tight city, three laps, hatch):

| player | wins | finish s (his 81.1 to 83.5) | totals (his) | ahead / behind all the way | place changes | walls (hard) |
|---|---|---|---|---|---|---|
| grip | 0 | 83.2 to 86.0 | 598 to 3,076 (5,809 to 6,637) | 0 / 12 | 0 to 34 | 16 (7) |
| slide | 3 | 87.4 to 95.3 | 1,727 to 8,117 (5,707 to 6,637) | 0 / 12 | 0 to 8 | 15 (6) |
| mixed | 8 | 79.0 to 89.2 | 1,899 to 9,948 (4,177 to 6,433) | 0 / 0 | 1 to 19 | 22 (7) |

How he was found: random searches on Tight city and Hairpin heaven found
nothing clean in the time; Hairpin heaven was dropped because the scripted
players themselves crash there (the slide player has 5 hard hits alone).
On Tight city a local search from Kestrow's numbers (his character's
ranges, the drift race's search, then judged on all 21 runs with the total
bar as a demand) found drivers that were clean but either missed the bar
on a corner at 29.9 per cent or let the slide player win none. His corner
entry speed set by hand to 26.2 m/s from the search's 26.46 passed both;
26.0 and 26.3 do not (10 and 2 of 20 miss). **He is fragile to his own
numbers**, though not to the disturbances: worth knowing if he is ever
touched. The Rookie sprints (Ridge road, The gauntlet) run 37 to 48 s alone,
under 60, so only the two circuits could hold a race.

His style line now reads "Quick, linking shallow slides": he averages 22
degrees, as shallow as Kestrow, but links Tight city's close corners (best
chain 1,160 points to Kestrow's 216) and beats the grip player home. "Fast
and shallow" did not set him apart from Kestrow.

**Varsk, where the ladder stops.** Pro's sprints are under 60 s too, so
Upper deck or Pin drop. On both, alone, the scripted slide player is 14 to
17 s slower over three laps than the others (Upper deck: grip 89.5 s, mixed
90.4, slide 107.2; Pin drop: 84.1, 85.4, 98.0, the slide player with 19
wall contacts). A race needs the rival near everyone's pace at once. Tried,
each judged on races:
- in the fastback at his own pace (88.4 s): every player behind all the
  way, wins 0, 1 and 0;
- in the fastback at the players' pace (91.2 s, the roster's numbers now):
  grip behind all the way in 19, slide in 20 of 20, wins 0, 0, 4; 2 of 20
  disturbed runs miss measure 2;
- in the players' own car (the starter, one step of each, 91.3 s): grip
  ahead all the way in 20 of 20, slide behind in 20 of 20, mixed wins 18;
- slower and lower scoring was not pursued: it would let the slide player
  win, but the grip and mixed players would then lead all the way, and his
  wins would rise above Tolvo's 11 while his multiple fell under 2.72, so
  the ladder would not climb.
So he cannot pass with these three scripted players on a Pro circuit: the
slide player's pace decides it, not the rival. Choosing new scripted
players per track would pass the bar by changing the ruler; I did not.

**Dovane, Halvik, Sarrow** were measured as they stand (unsearched): each
fails measure 2 (hard hits in every run), and Dovane's and Halvik's races
fail measure 3. Their rows are in the table.

### 4. Earning and the screen's states (`earning.json`)

`game/test/ladder/earning.js`. From an empty save, with all six
(`?rivals=all`) and as shipped (`TANDEM.LIVE` 2): the empty save, then for
each rival a star on his track, a race lost, a race won. After each of the
19 steps: the title's words and mark, every card's state and ticked words,
and five routes into a race (the rivals card, the career card, the offer
on a career result of his track, the next rival on the previous rival's
race results, the action itself), each open exactly when the probe's own
model says he is earned, and every card reachable by the keyboard. **19 of
19** both ways. As shipped, a rival past `LIVE` shows SOON and no route
opens him. A real career 1 run from an empty save (895, one star) offers
Kestrow beside NEXT ("KESTROW race him, just earned"), and the next career 1
result offers him again. Known answer: a save with a win over the third and
none over the second does not open the fourth (held: "Win a star on Over
and under" ticked, "Beat Varsk" not); with the second beaten too the same
check finds him open (caught).

It caught a fault first: the old rule opened the fourth on that save,
because it asked only for a win over the rival before. The ladder is now a
chain: the win counts only over an earned rival.

### 5. Layout (`layout.json`, `shots/layout-*.png`)

`game/test/ladder/layout.js`. At 390x844, 844x390, 800x450 and 1280x720, by
bounding boxes: the title with the button in each state, the rivals screen
none, some and all beaten, the career result with the offer, and four race
results (won with the next rival open, won with him still to earn, won with
none after, lost). No overlaps, every button inside the view, the title
never scrolls, the rivals header and back button stay while the list
scrolls, every button at least 44 px each way, no button's name broken
across lines. **PASS**, 44 of 44. Known answer: the cards pulled 30 px up
meet: caught.

On the way: the sixth button made the title scroll 55 px at 390x844, so on
a portrait phone CAREER and RIVALS, and FREE DRIFT and GARAGE, now share
rows (the title is exactly 844 px tall there, so it has no slack); the
title's small buttons were 36 px tall at 844x390 and 800x450 and are now 44
px; "RACE KESTROW" broke as "KESTRO / W" in the three-button row, so the
offer button carries just his name over "race him".

### 6. Contact (`contact-r2.json`, `contact-r3.json`)

`node game/test/driftrace/contact.js r2 --out ...` (and r3): the drift
race's four cases from the level grid, with a player's hands.

| | TAIL overlap | SWIPE overlap | PARK held | FOLLOW gets past | his hash |
|---|---|---|---|---|---|
| Kestrow (drift race round) | 0 m | 0 m | 1.20 s | yes | same |
| Tolvo | 0 m | 0 m | **1.16 s** | **no** | same |
| Varsk | 0 m | 0.22 m (pin release 41 steps) | **1.18 s** | **no** | same |

The follower (the grip player in the starter with every upgrade) cannot get
past Tolvo in the hatch or Varsk in the fastback within a lap: they are
quicker cars. Against Tolvo no hard contact came with a chain open, so that
rule went untested on him (it is tested on Kestrow and Varsk).

### 7. Frame time (`perf.json`)

`node game/test/driftrace/perf.js r2 r2`, as the drift race round: 390x844,
6x CPU throttle, JavaScript without the submit.

| | JS p95 ms solo, then race (two runs) | physics p95 | draw calls | triangles |
|---|---|---|---|---|
| low, Tight city, Tolvo | 5.4, then 10.6 and 11.4 | 1.9, then 6.3 and 7.7 | 67, then 101 | 177,583, then 181,031 |
| high, Tight city, Tolvo | 5.6, then 13.2 and 12.1 | 1.7, then 9.7 and 9.2 | 69, then 104 | 456,479, then 460,051 |
| low, the mixed scripted player's own look ahead too | 14.2 | | | |

**PASS** against 16.7 ms; the worst single frames reach 81 ms (p99 24 ms),
as in the drift race round. Known answer 30.6 ms caught. **The GPU cannot
be measured here** (SwiftShader): his car, smoke and trails cost on a real
GPU what Kestrow's do.

### 8. The save (`save.json`)

`game/test/ladder/save.js`: main's save (2cdccde: career 1 with a star, a
ghost, missions, coins and a drift race against Kestrow, so `rivals.r1 = {
won: false, best: -2383, when }`) loads with 0 repairs, 0 values changed,
0 fields added; after a race the entry changes by main's rule and only coins
and rivals change; a wrong-shaped entry is repaired and the game runs;
quota.js 6 of 6. **PASS**. Nothing stored changed shape.

### 9. Frames (`shots/`, `shots.json`)

`game/test/ladder/shots.js`. At 1280x720, 390x844 and 844x390: the title
none earned, waiting and all beaten; the rivals screen none earned, mid
ladder, all beaten, and as shipped; the career offer, a race won with the
next rival open, one lost; Tolvo and Varsk side by side mid slide at dusk
and at night. Plus `layout-*` at all four sizes. What I see:
- **Six cards read as six characters**: each edged and named in his own
  paint, his own car drawn in it (the coupe, the hatch, two fastbacks in
  lime and white, the tourer, the drift build with its wing), one line of
  style in italics. Varsk and Sarrow share the fastback; the paint tells
  them apart, the shape does not.
- Locked cards stay in colour, a little dimmed, so the ladder ahead shows;
  ticks are cyan, what is left yellow.
- The orange RACE mark on RIVALS is the loudest thing on the title after
  DAILY DRIFT; it pulses gently.
- Tolvo side by side at night: the amber hatch beside the player, "2ND
  -0.1 s" and "x1.6 CLOSE" under the player's car. The exhaust flame and
  smoke are heavy in a still.
- As shipped, four cards say SOON, "not in the game yet": honest, but the
  author's call (below).

### Every probe in `game/test/`

Run in sequence on the final code by `game/test/ladder/run-all.sh`
(`runs/summary.txt`). Other rounds' review files they rewrote were restored
with `git checkout`. The per-probe logs were then deleted by my mistake
while cleaning those up; the exit codes and failing lines were kept.

| probe | result |
|---|---|
| `ladder/earning.js`, `layout.js`, `determinism.js`, `save.js`, `pin.js` | pass |
| `ladder/rivals.js` | **fails**: Varsk, Dovane, Halvik, Sarrow fail measures 2 and/or 3, the climb fails past Varsk; Kestrow and Tolvo pass |
| `driftrace/hands.js`, `determinism.js`, `save.js`, `camera.js`, `layout.js`, `perf.js` | pass |
| `driftrace/racing.js` | fails as on `main`: the mixed player wins 6 of 20, the place changes in 17 of 20 mixed races, 5 of 20 with no close bonus |
| `driftrace/contact.js` | fails as on `main`: PARK held 1.2 s; the pin release known answers are not judged on Kestrow (`ladder/pin.js` proves it on Varsk) |
| `loop/quota.js`, `feel/handling.js`, `feel/corners.js`, `feel/probes.js`, `tracks/probes.js`, `visuals/occlusion.js` and `--career`, `visuals/probes.js`, `cars/measure.js`, `retention/codes.js`, `retention/heading.js`, `chapters/probes.js`, `stars/ghost.js`, `spectacle/determinism.js`, `smoke.js`, `adapt.js`, `layout.js`, `perf.js`, `retention/probes.js`, `loop/probes.js` | pass |
| `tracks/tracks2.js` | fails as on `main`: the busyness known answer MISSED |
| `cars/render.js` | fails as on `main`: `lab/cars.html` times out (it reads `LOOK.SUN_DIR`) |
| `spectacle/night.js` | fails as on `main`: 7 of 8 moments on the low tier (Crossover at 80 m) |

## What the author should judge on his own devices

- **Is RIVALS findable and clear?** The button, the mark, the screen, the
  ticks. Does "Tolvo is waiting" make you tap it?
- **The portraits**: each car on a dark studio backdrop, three quarters
  from the front. Do they read as his car at a glance on the phone?
- **SOON cards**: with two rivals live, four cards say "not in the game
  yet". Keep them visible (the brief: nothing hidden), or hide them until
  each is ready?
- **Can you beat Tolvo** in the starter? The scripted slide player wins 3
  of 20 and the mixed 8; the grip player never does. Is he the step up
  from Kestrow?
- **The career result's three buttons** (NEXT, the rival, MENU) at thumb
  size.
- **Frame rate** racing Tolvo on the phone and the Chromebook.

## Not done

- **Rivals three to six are not in the game.** Varsk cannot pass with
  these scripted players (above); Dovane, Halvik and Sarrow were not
  searched again, because the ladder stops at the first who cannot pass.
- **Gamepad navigation of the screens.** No screen in the game is
  reachable by a gamepad (see below). The keyboard reaches every rival card
  by Tab, locked ones included.
- **PARK's 1.2 s hold** (priority 4): not fixable without retuning the
  author's block (below).
- The `CLAUDE.md` Status entry is the reviewer's.

## Deviations from the brief

1. **The ladder is a strict chain** (`rivalOpen`): a win over the rival
   before counts only if he was earned too. The brief's known answer
   required it and the old rule failed it. Nothing stored changes.
2. **The title counts beaten rivals of those in the game** ("1/2 beaten"),
   not of six, while fewer than six are live.
3. **On a portrait phone the title's menu is two to a row** for career and
   rivals, free drift and garage; on a short landscape screen the small
   buttons are 44 px (were 36).
4. **The career result's offer moved** from a full-width button above GO
   AGAIN into the row beside NEXT, as the brief asks, labelled with his
   name.
5. **Tolvo's track is Tight city** (was Hairpin heaven, the brief's own
   example): the scripted players crash on Hairpin heaven alone and no
   clean Tolvo was found there. His style line was changed to be true.
6. **Varsk's roster entry is the closest found** (Upper deck, three laps);
   he is not in the game.
7. **The won race results in the layout probe and frames** are a real race
   against the rival ended at once by a probe hook (`finishNow`), shown as
   a win by 137: the words are the game's, the totals are not a real
   race's.
8. **The search** (`driftrace/search.js`) gained two options used only by
   the ladder's searches; its defaults are as before. `driftrace/contact.js`
   gained `--out`.
9. **Measure 3's climb** is read per step: from each rival to the next, the
   three players' total wins fall or his multiple rises. The multiple uses
   his race's laps; the career's is in brackets.
10. **The pin release** is proved on Varsk, who is not in the game; the rule
    is shared by every rival.

## Is the brief wrong anywhere?

- **"Keyboard and gamepad reach every card, as the other screens do."** The
  other screens are not reachable by a gamepad at all (DOM buttons with no
  gamepad focus; a pad's buttons only act in a run and on results).
  Gamepad menus would be their own small round.
- **Measure 3 on Pro tracks with these three scripted players** asks for
  something no rival pace gives: the slide player is 14 to 17 s slower over
  three laps than the other two on every Pro circuit, so a rival either
  leaves it behind all the way in every race or lets the others lead all
  the way. The ruler decides it, not the rival. Either the bar allows for a
  player that much slower than the field, or the scripted players are
  chosen again per chapter; both are the author's call.
- **The 1 s bar for a parked player** is below the game's own stuck
  recovery (`TUNE.ASSIST.RECOVER_AFTER` 1.2 s), the author's block. The
  parked player is not held by the rival (their centres are 4.4 m apart);
  he is stopped against the wall after the shove and the game recovers him
  at 1.2 s, as it would any stuck car.
- **Race length.** Every career sprint runs under 60 s even alone (37 to 53
  s), so only circuits can hold a rival's race, which narrows "his half of
  his chapter" to two tracks.
