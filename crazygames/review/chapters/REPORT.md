# Career chapters, 24 tracks: report

Branch `crazygames-chapters`, brief `briefs/CHAPTERS.md`. Every number
below was measured in this sandbox (headless Chromium, forced WebGL 2 on
SwiftShader, and Node for the plain data parts). The JSON beside this
file is what the probes wrote. `shots/` holds the screenshots, and
`runs/` holds the console output of every probe in `game/test/`, run on
this branch after the last code change.

## In short, for a phone

- **Three chapters of eight: Rookie, Pro, Legend.** Rookie is the old
  eight, unchanged: names, seeds, settings, order, indices 0 to 7. Pro is
  8 to 15 and Legend 16 to 23, in the same flat `CAREER` list, so every
  save key keeps its meaning (`career:N`, `career[N]`, the mission
  flags, the ghosts).
- **Unlocking.** Inside a chapter, a track opens with a star on the one
  before, as now. Pro's first track opens with 12 Rookie stars and
  Legend's with 14 Pro stars (`LOOP.CHAPTERS.OPEN`, first guesses for you
  to tune).
- **Sixteen new tracks, chosen by measurement.** Each slot has fixed
  settings: kind, length, difficulty, the Lab's style weights, and a
  figure eight or not. Its seed is the first candidate that passes every
  check:
  - both scripted drivers finish with 0 respawns
  - the careful driver drives it clean to at least one star
  - it generates in under 600 ms
  - nothing occludes the road in any theme
  - it has at least its chapter's number of banked corners

  All 24 tracks pass the same check in the page.
- **Each chapter is a measured step up.**

  | | Rookie | Pro | Legend |
  |---|---|---|---|
  | mean circuit run | 2,046 m | 2,318 m | 2,472 m |
  | mean sprint run | 916 m | 1,158 m | 1,270 m |
  | banked corners | 18 | 32 | 35 |
  | figure eights | 1 | 3 | 4 |
  | hairpins and doubles | 5 | 14 | 17 |
  | asked difficulty | 0.50 | 0.70 | 0.90 |
- **The career screen** shows the three chapters, each with its stars
  and missions, or "8 more Rookie stars to open Pro" when locked. The
  list scrolls under a fixed header and opens at the furthest open
  chapter. The header tally and the title's CAREER button count out of
  72 stars and 72 missions.
- **The heading** reads "CAREER · PRO · TRACK 3 OF 8".
- **The results** say "Pro unlocked: Upper deck", with NEXT going there.
  When a run leaves the next chapter locked, they say how many more stars
  open it, for example "1 more Rookie star to open Pro".
- **Saves.** Nothing new is stored. A save written by main's own code
  with 12 Rookie stars loads with every field identical and 0 fixes, and
  Pro is open on that first visit. With 11 stars Pro stays locked.
- **Kept.** These are untouched: `physics/`, `audio/`, `assets/`,
  `tracks/generate.js`, and the handling, scoring, star, coin and
  mission rules. Every probe in `game/test/` passes, except
  `tracks2.js`'s busyness known answer, which misses on main too.
- **For you to decide.**
  - `OPEN`, now 12 and 14.
  - Circuit run times. The new circuits take the careful driver 123 to
    143 s and the drifter 91 to 128 s, over DESIGN.md's 60 to 120 s.
    Rookie's Crossover was already 106 to 140 s.
  - Save size. With a scripted ghost on all 24 tracks the save reaches
    2.2 million characters (see "Open").

## What was built

```
game/src/loop/modes.js        CAREER is 24 tracks; CHAPTERS (ranges over it); chapterOf, chapterStars,
                              starsToOpen, chapterOpen; careerUnlocked by the chapter rule; careerSpec
                              passes a track's style weights and crossover to the generator
game/src/tune.js              LOOP.CHAPTERS.OPEN [0, 12, 14]
game/src/main.js              runHead names the chapter; careerNews: the results' unlock line, a second
                              note line, and NEXT
game/src/ui/screens.js        the career screen in three chapters, opened at the current one; the note line
game/index.html               the chapter styles; the list scrolls in its own box; two layout fixes (below)
game/test/chapters/run.js     a career run in Node: the host's per step code, for the seed search
game/test/chapters/seeds.js   the seed search and the check (writes seeds.json)
game/test/chapters/probes.js  the measurements: tracks, ladder, saves, screens, perf
game/test/chapters/main-save.js  writes the two saves from a worktree of main
game/test/visuals/occlusion.js   checkTrack exported for the seed search; --career checks the 24 tracks
game/test/retention/probes.js    the missions probe walks all 24 career tracks
```

**How the generator is asked.** A Rookie track names no options, so its
spec and its generator call are exactly as before. A new track may name:

- `style`, which becomes `options.weights = LOOP.LAB.STYLES[style]`
- `crossover: 'always'`

The generator already takes both options.

Every figure eight is asked a length range, for example `[780, 880]`,
not a single number. The generator only tries a figure eight on a lap of
at least 760 m. Asked for "800 m" (10 per cent either side), seed after
seed came back with no bridge.

**The unlock rule** follows the brief's wording exactly. A chapter's
first track opens on the stars won in the chapter before. Every other
track opens on a star on the one before. The current chapter is the
furthest open one.

## Measurements, each with its known answer

Run them with:

- `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node game/test/chapters/probes.js`
  (about 12 minutes; name a section to run one)
- `node game/test/chapters/seeds.js` (about 15 s)

98 verdicts, all passed (`runs/chapters-probes.log`).

### 1. The new tracks (`tracks.json`, `seeds.json`, `occlusion.json`)

All 24 tracks are driven through the real run structure in the page
(`startRun`, the countdown, the drive, the results), each from an empty
save. The careful driver is `{ drift: null }` and the drifter
`{ drift: '*' }`. Respawns are counted at every physics step, both off
the track and stuck. Wall contacts are read at the line.

- **All 24 pass. PASS.**
  - Both drivers finish every track with 0 respawns.
  - The careful driver has 0 wall contacts and every sector clean on
    every track, and earns exactly one star on each.
  - The worst generation time in the page is 165 ms (Knot yard).
  - Nothing occludes the road in any of the 5 themes: 0 props inside the
    barriers, the terrain never above the road, 0.03 per cent of sight
    lines blocked and none within 30 m.
- **Known answer: five seeds the search rejected fail the check in the
  page too. CAUGHT.**
  - 2206: a drifter respawn, and only 2 banked corners
  - 2305: 5 props inside the barriers
  - 2507: a plain fallback layout, no bridge
  - 2607: a drifter respawn
  - 2101: 2 banked corners, under Pro's 3
- **Each chapter beats the one before on run length, banked corners,
  figure eights, technical and hairpin styles, and asked difficulty.
  PASS.** Known answer: the same comparison read backwards fails.
  CAUGHT.

**What the search found.** With only the brief's three checks, the
search picked 2305 for Pin drop and 3609 for Thousand turns. Running
`occlusion.js` over the career found two problems with them:

- Pin drop has a grandstand 5.3 m inside the barriers, in every theme.
- On Thousand turns the terrain rises 0.24 m above the road.

So the readability rule joined the check. A floor of banked corners
joined it too: at least 3 a track in Pro and 4 in Legend. Without it,
Pro had 14 banked corners against Rookie's 18. `seeds.json` records
every candidate tried, what it measured and why it was dropped.

**Two margins are thin.** They are reported here, not tuned.

- **The careful driver's star is close on every track, Rookie
  included.** Pin drop scored 530 against 530, and Thousand turns 281
  against 280. That is the 8 November design: a clean run at par is one
  star.
- **Legend has only 3 more banked corners than Pro.** That is 35 against
  32, or 39 and 36 per cent of corners. A Legend floor of 5 found no
  seed for The vice in 30 candidates. The generator rarely banks hairpins
  and technical corners, so "more banks" and "more technical and hairpin
  styles" pull against each other.

### 2. The ladder (`ladder.json`)

- **Fixed cases. PASS.**
  - A fresh save opens track 1 only.
  - 11 Rookie stars keep Pro locked, and playing Pro 1 is refused.
  - 12 Rookie stars open Pro 1 and only it.
  - A star on Pro 1 opens Pro 2.
  - 13 Pro stars keep Legend locked; 14 open it, and it plays.

  The 11 star case is the known answer: Pro stays locked one star short.
  CAUGHT.
- **2,000 random saves: careerUnlocked agrees with the rules on every
  case. PASS.** That is 48,000 cases (24 tracks a save), checked against
  the rules written out again in the probe. Pro was open in 427 saves and
  Legend in 206. Known answer: the same rules with OPEN one higher
  disagree 204 times. CAUGHT.
- **The career screen on 40 of those saves: every row and chapter head
  is right. PASS.** All 960 rows are enabled exactly when the rules open
  them, and every locked chapter says the right number of stars.

### 3. Saves (`saves.json`, `main-save-11.json`, `main-save-12.json`)

Both saves were written by main's own code (561d97a), in a worktree, by
`main-save.js`:

1. It drove career 1 with the scripted drifter (score 895), earning a
   star, a ghost, missions and coins.
2. Through main's save API it added a bought and upgraded hatch with
   paint, a daily result, mission flags and a Lab best.
3. It added Rookie stars up to 11 and saved, then up to 12 and saved
   again.

Results:

- **The 12 star save loads with everything kept. PASS.** Every field is
  byte identical, with 0 fixes: coins, car, cars, career, daily, ghosts,
  starPay, onboarded, missions and lab.
  - The title's CAREER button shows "12/72 stars · 5/72 missions".
  - Pro 1 is playable and Pro 2 is not.
  - Legend says "14 more Pro stars to open Legend".
  - The career screen opens at Pro.
- **Pro 1 then plays from that save. PASS.**
  - It earns a star: 668 points, 12 of 12 sectors clean.
  - It opens Pro 2: "Track 2 of 8 unlocked: Quarry cut", then "13 more
    Pro stars to open Legend".
  - The Rookie results are kept, and main's career 1 ghost still drives.
- **Known answer, the 11 star save: Pro stays locked. CAUGHT.** Pro
  shows "1 more Rookie star to open Pro", everything is kept, and the
  screen opens at Rookie.
- **A corrupted save still plays. PASS.** It held a career entry with
  stars as a word, one beyond the list, a bad key, bad mission entries
  and a bad ghost. It loads repaired with 4 fixes. The career shows 24
  rows, a track plays to its results, and there are no page errors.
- **Storage that throws still plays. PASS.** The first visit lands in
  the run, which finishes. The career shows 24 rows with track 2 open,
  and there are no page errors.
- **A scripted drifter ghost on all 24 tracks is saved whole. PASS.**
  The save is 2,202,566 characters, with no failed write (see "Open").

### 4. The screens (`screens.json`, `shots/`)

Checked at 390x844 and 844x390 (touch) and at 800x450 and 1280x720
(mouse).

- **The career screen: nothing overlaps, every row is reachable. PASS in
  all 12 layouts.**
  - Three saves were checked at each size, with Rookie, Pro and Legend
    each as the current chapter.
  - The boxes checked were the back button, the title, the tally, the
    coin badge, and inside the list every chapter head and row (and each
    row's number, name and stars), cut to the list's box.
  - Every 24 px scroll step was checked: 42, 61, 59 and 47 positions by
    size.
  - No two boxes meet, nothing passes under the header or the badge, and
    each of the 24 rows is what `elementFromPoint` finds once scrolled
    into view.
- **The current chapter's head and first row are in view as the screen
  opens. PASS in all 12.**
- **Known answers, CAUGHT at every size:**
  - A rule pulling each chapter head 26 px onto its first row gives 29
    to 50 meetings.
  - With the Legend save and the list left at the top, Legend is not in
    view.
- **The title's CAREER button matches the save, out of 72. PASS** for
  all three saves.
- **The heading names the chapter and overlaps nothing. PASS at all four
  sizes**, after the fix below. Over Pro 3's countdown it reads "CAREER
  · PRO · TRACK 3 OF 8" and "Pin drop". It lies inside the view, clear
  of the score, the lap and clock, the speed readout, the pads and the
  exit.
- **A run that opens Pro. PASS.** The save had 11 Rookie stars, then the
  careful driver won a star on Tight city.
  - The card reads "Pro unlocked: Upper deck", then "Track 6 of 8
    unlocked: Ridge road".
  - NEXT goes to Upper deck and is the primary button.
  - The card's parts do not meet, and every button is reachable.
- **Known answer, one star fewer. CAUGHT.** The card reads "Track 6 of 8
  unlocked: Ridge road", then "1 more Rookie star to open Pro", and NEXT
  goes to Ridge road.
- At 844x390 and 800x450 the results screen scrolls to reach MENU, as it
  did before this branch. Every button was reached by scrolling.
- **The last Rookie track with Pro locked. PASS.** The card says "8 more
  Rookie stars to open Pro", with no NEXT.

### 5. Frame time (`perf.json`)

The setup:

- forced WebGL 2, 390x844, low tier, 6x CPU throttle by CDP
- the previous run's ghost stepping in every frame, the drifter driving
- 420 frames, the first 30 dropped
- JavaScript measured without `renderer.render`

The longest Legend track by run length is The vice (2,508 m). It was
measured the same way as Rookie 1:

| track | window | JS p95 / worst | physics p95 | draw calls |
|---|---|---|---|---|
| Rookie 1, First slide | from GO | 5.6 / 14.8 ms | 2.5 | 74 |
| Rookie 1, First slide | after 40 s | 3.5 / 9.3 ms | 1.4 | 77 |
| Legend 7, The vice | from GO | 3.4 / 26.9 ms | 1.7 | 72 |
| Legend 7, The vice | after 60 s | 5.1 / 19.6 ms | 1.5 | 72 |

- **The vice is under the 16.7 ms budget and within 1.5 ms of Rookie 1.
  PASS.** Its worst window was 5.1 ms against Rookie 1's 5.6.
- The worst frames are single SwiftShader stalls, as in earlier reports.
- An earlier run of the same probe read 3.9 and 2.6 ms against 4.3 and
  4.8, which is the noise.
- **Known answer: 20 ms of busy work per frame gives 27.6 ms. CAUGHT.**

### Every probe in `game/test/`, rerun on this branch

All were run in sequence after the last code change. `runs/` holds each
log, and `runs/summary.txt` the exit codes. Several probes rewrite other
sessions' `review/` files; those were restored afterwards, so only
`review/chapters/` belongs to this branch.

| probe | result |
|---|---|
| `chapters/probes.js` | 98 verdicts, all passed, every known answer caught |
| `feel/handling.js`, `feel/probes.js`, `feel/corners.js` | pass; 14 verdicts; 80 of 80 tracks, 0.42 stalls per km, as before |
| `loop/probes.js` | all passed: the ghost frame for frame, career 1 to 6 and the daily to results, the ladder, the saves, JS p95 4.3 ms at 6x |
| `tracks/probes.js` | all measurements pass, every known answer caught |
| `tracks/tracks2.js` | B, K, X and T pass. The known answer "the old generator scores lower on busyness" is MISSED for circuits and sprints, with the same numbers the retention report found on main (corners per km 10.742 to 10.033). Reported, not fixed, as the brief asks |
| `visuals/occlusion.js` | all passed (24 seeds and 4 figure eights, every theme) |
| `visuals/occlusion.js --career` | all passed on the 24 career tracks (`occlusion.json` here) |
| `visuals/probes.js` | all passed: edge brightest in 40 shots (worst 1.4, needs 1.35), JS p95 4.4 ms at 6x, initial download 2.25 MB over 67 files |
| `cars/measure.js` | PASS |
| `retention/codes.js` | all passed (1,000 round trips, malformed codes refused, 400 seeds identical to main's generator) |
| `retention/heading.js` | all passed at four sizes, unchanged |
| `retention/probes.js` | all passed. Missions now cover all 24 career tracks plus the daily (25). Tracks where some driver completed each kind: hold 6, chain 12, clean 25, clip 25, time 25, multiplier 17. None trivial; the replay identical |

Probes changed, and why:

- **`retention/probes.js`**: the missions section walked `i < 8`. It now
  walks `CAREER.length`, because every career track carries missions.
- **`visuals/occlusion.js`**: two changes, so the seed search can use
  the same check.
  - `checkTrack` is exported, and the script body only runs when the
    file is run directly.
  - `--career` checks the career's tracks with their options and writes
    `review/chapters/occlusion.json`. Without the flag it behaves as
    before.
- **No other probe needed a change.** No other probe walks `CAREER`.
  - `loop/probes.js` drives careers 1 to 6 and the daily.
  - `retention/heading.js` checks "TRACK 1 OF 8" and "Track 2 of 8
    unlocked", which still hold.

## The track table

How to read it:

- **Run m** is the whole run: a circuit's lap times 3, or a sprint to
  its line.
- **d** is the asked difficulty, and **eight** means `crossover:
  'always'`.
- **Bridge** means the track has one.
- **Hairpins** counts hairpins and double hairpins.
- **Gen ms** is the worst of three generations in the page.

On every track the careful driver had 0 contacts and every sector clean,
and neither driver respawned. The rows come from `tracks.json`.

| # | chapter | track | seed | kind, asked | style | run m | corners (hairpins) | banked | bridge | gen ms | careful: s, score / 1st star, stars | drifter: s, score, stars |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Rookie | First slide | 1101 | circuit 560 m, d 0.10 | mixed | 1,554 | 3 (0) | 0 |  | 86 | 77, 491 / 450, 1 | 70, 895, 1 |
| 2 | Rookie | Harbour run | 1202 | sprint 800 m, d 0.20 | mixed | 800 | 8 (0) | 5 |  | 18 | 38, 252 / 230, 1 | 33, 309, 1 |
| 3 | Rookie | Crossover | 1327 | circuit 820 m, d 0.30 | mixed | 2,532 | 12 (0) | 6 | yes | 54 | 140, 723 / 690, 1 | 106, 1,128, 1 |
| 4 | Rookie | Long shadows | 1404 | sprint 900 m, d 0.40 | mixed | 858 | 8 (2) | 0 |  | 18 | 47, 240 / 230, 1 | 38, 448, 1 |
| 5 | Rookie | Tight city | 1505 | circuit 620 m, d 0.55 | mixed | 2,034 | 7 (2) | 2 |  | 30 | 124, 523 / 510, 1 | 102, 1,028, 2 |
| 6 | Rookie | Ridge road | 1606 | sprint 1000 m, d 0.65 | mixed | 978 | 12 (0) | 3 |  | 8 | 52, 252 / 240, 1 | 42, 389, 1 |
| 7 | Rookie | Hairpin heaven | 1707 | circuit 660 m, d 0.80 | mixed | 2,064 | 7 (0) | 1 |  | 14 | 115, 488 / 470, 1 | 90, 589, 1 |
| 8 | Rookie | The gauntlet | 1808 | sprint 1100 m, d 0.95 | mixed | 1,026 | 16 (1) | 1 | yes | 11 | 63, 225 / 220, 1 | 47, 300, 1 |
| 9 | Pro | Upper deck | 2105 | circuit 770 to 840 m, d 0.50, eight | flowing | 2,496 | 10 (0) | 6 | yes | 107 | 136, 668 / 640, 1 | 118, 1,921, 2 |
| 10 | Pro | Quarry cut | 2213 | sprint 1100 m, d 0.55 | technical | 1,074 | 15 (0) | 3 |  | 13 | 63, 277 / 270, 1 | 49, 410, 1 |
| 11 | Pro | Pin drop | 2314 | circuit 720 m, d 0.60 | hairpins | 2,136 | 8 (2) | 4 | yes | 27 | 129, 530 / 530, 1 | 108, 941, 1 |
| 12 | Pro | Breakwater | 2406 | sprint 1150 m, d 0.65 | mixed | 1,212 | 13 (2) | 3 | yes | 10 | 71, 300 / 290, 1 | 56, 872, 2 |
| 13 | Pro | Over and under | 2510 | circuit 770 to 860 m, d 0.70, eight | technical | 2,538 | 6 (0) | 6 | yes | 20 | 143, 634 / 600, 1 | 120, 1,207, 2 |
| 14 | Pro | Switchbacks | 2606 | sprint 1200 m, d 0.75 | hairpins | 1,090 | 10 (6) | 3 |  | 20 | 69, 255 / 250, 1 | 57, 416, 1 |
| 15 | Pro | Smoke ring | 2708 | circuit 760 m, d 0.80 | mixed | 2,100 | 8 (2) | 4 |  | 20 | 123, 494 / 480, 1 | 91, 2,060, 3 |
| 16 | Pro | Razor wire | 2809 | sprint 1250 m, d 0.90 | technical | 1,254 | 18 (2) | 3 |  | 9 | 81, 275 / 270, 1 | 60, 476, 1 |
| 17 | Legend | Knot yard | 3102 | circuit 780 to 880 m, d 0.70, eight | technical | 2,496 | 6 (0) | 4 | yes | 165 | 140, 619 / 590, 1 | 128, 2,358, 3 |
| 18 | Legend | Serpent spine | 3202 | sprint 1250 m, d 0.75 | hairpins | 1,170 | 13 (3) | 4 |  | 41 | 66, 284 / 270, 1 | 53, 906, 2 |
| 19 | Legend | High wire | 3303 | circuit 780 to 880 m, d 0.80, eight | hairpins | 2,412 | 6 (2) | 4 | yes | 5 | 134, 580 / 550, 1 | 110, 959, 1 |
| 20 | Legend | Needle run | 3404 | sprint 1300 m, d 0.85 | technical | 1,246 | 21 (0) | 4 |  | 9 | 76, 282 / 280, 1 | 57, 394, 1 |
| 21 | Legend | Endless eight | 3505 | circuit 780 to 880 m, d 0.85, eight | mixed | 2,472 | 8 (2) | 6 | yes | 40 | 137, 582 / 550, 1 | 108, 2,167, 3 |
| 22 | Legend | Thousand turns | 3611 | sprint 1350 m, d 0.90 | hairpins | 1,292 | 13 (8) | 5 |  | 13 | 83, 281 / 280, 1 | 67, 2,125, 3 |
| 23 | Legend | The vice | 3707 | circuit 780 to 880 m, d 0.95, eight | technical | 2,508 | 6 (0) | 4 | yes | 84 | 142, 559 / 540, 1 | 126, 1,678, 2 |
| 24 | Legend | The last bend | 3808 | sprint 1400 m, d 1.00 | technical | 1,372 | 17 (2) | 4 |  | 18 | 83, 293 / 290, 1 | 63, 1,366, 3 |

By chapter (`tracks.json`, `byChapter`):

| | circuit run | sprint run | corners | banked | figure eights | hairpins | technical or hairpin styles | asked / measured difficulty | careful / drifter mean s |
|---|---|---|---|---|---|---|---|---|---|
| Rookie | 2,046 m | 916 m | 73 | 18 (25%) | 1 | 5 | 0 | 0.50 / 0.35 | 82 / 66 |
| Pro | 2,318 m | 1,158 m | 88 | 32 (36%) | 3 | 14 | 5 | 0.70 / 0.43 | 102 / 82 |
| Legend | 2,472 m | 1,270 m | 90 | 35 (39%) | 4 | 17 | 7 | 0.90 / 0.44 | 108 / 89 |

Corner types by chapter:

| type | Rookie | Pro | Legend |
|---|---|---|---|
| multi | 20 | 15 | 17 |
| flow | 19 | 4 | 5 |
| esses | 7 | 13 | 16 |
| chicane | 7 | 10 | 7 |
| tight | 5 | 17 | 7 |
| sweeper | 4 | 1 | 5 |
| opening | 4 | 8 | 0 |
| tightening | 2 | 6 | 16 |
| hairpin | 3 | 6 | 7 |
| double | 2 | 8 | 10 |

The drifter scores higher on the new tracks than on Rookie: up to 3
stars, on 7 of them. Two things drive it:

- The star rate eases with the asked difficulty (`STAR_HARD_EASE`).
- The drift chains link across the busier corners.

Whether that makes Pro and Legend too generous is for play to decide.
The star rule was not touched.

## Screenshots

`shots/` holds each screen at 390x844, 844x390, 800x450 and 1280x720:

- `career-rookie`, `career-pro`, `career-legend`: the screen as it
  opens, at the current chapter
- `title`: the CAREER button out of 72
- `heading-pro`: the countdown over Pin drop
- `results-pro`: Pro unlocked, NEXT to Upper deck
- `results-short`: one star short

The probe took them all, and all were looked at. Where the 3D view was
still drawing, the backdrop's sign shows through the menu panel, as in
earlier reports.

## Two layout fixes found on the way

- **The mission list overlapped the steer pads on a phone on its side.**
  - At 844x390 the countdown's heading and mission list ran from y 105
    to 269, and the left pad starts at y 256.
  - It overlaps on main too. Measured there the same way on careers 3
    and 5: bottom 269, pad top 256.
  - `heading.js` never saw it, because the onboarding run shows no list.
  - On short landscape screens the box now sits at 24 per cent and is
    tighter: y 94 to 240. `retention/heading.js` still passes.
- **The fade in dropped its centring.**
  - `promptIn` animated from `translate(var(--tx, 0), calc(var(--ty, 0)
    + 10px))`, and `calc(0 + 10px)` is invalid.
  - So for its 0.3 s the whole transform was dropped, and the centred
    heading and prompts started half their width to the right.
  - Now it uses `0px`.

## Not done, and open

- **Balance.** `OPEN` 12 and 14 are first guesses. Nobody has played Pro
  or Legend with thumbs.
- **Run lengths.** The new circuits take the careful driver 123 to 143 s
  and the drifter 91 to 128 s, over DESIGN.md's 60 to 120 s. A figure
  eight needs a lap of at least 760 m, so three laps of one are at least
  2.3 km. There are two levers, and both are yours to choose:
  - `LOOP.LAPS`, which every circuit shares
  - two laps for figure eights, which would be a rule change
- **Save size.** With a scripted drifter ghost on all 24 tracks, the
  save is 2.2 million characters. Every write still succeeded in
  Chromium.
  - Scripted tapes are the worst case, because the steering changes
    every step. A thumb's tapes compress far better.
  - Some browsers cap `localStorage` near 2.5 to 5 million characters.
  - If a write fails, the game keeps playing, but nothing written after
    that is remembered, coins and stars included.
  - Capping career ghosts or packing the tapes tighter would remove the
    risk. That is a save format decision, outside this brief.
- **A rule edge.** Only a chapter's first track checks the stars, as the
  brief words the rule. Two consequences:
  - A save with a star on Pro 1 and fewer than 12 Rookie stars shows Pro
    2 open under a locked Pro 1. Play cannot reach that state, but an
    edited or corrupted save can; the corrupted save probe shows it.
  - If `OPEN` is raised later, players already in a chapter keep its
    later tracks.
- **"Hairpin heaven" has no hairpins.** Its 7 corners are esses,
  chicanes, a tight one and an opening one. It is a Rookie track, left
  unchanged as the brief says, but the name now sits beside Pro and
  Legend tracks that do have hairpins.
- **The CLAUDE.md Status entry is not written.** It is outside the
  brief's folders and is the reviewer's.

## Deviations from the brief

1. **The seed check has two criteria the brief does not list.** Both are
   measurements, and `seeds.json` records them for every candidate.
   - The readability rule (nothing occludes the road, in every theme).
     The brief's three checks alone picked two seeds that break it.
   - A floor of banked corners per chapter (Pro 3, Legend 4). Without
     it, Pro had fewer banked corners than Rookie.
2. **Figure eights are asked a length range**, `[min, max]`, not a
   number. The generator already takes it. Asked for "800 m", most seeds
   fell short of the 760 m lap a figure eight needs.
3. **The results card has a second line** (`note`, class `chapnote`).
   - When a run opens a chapter and a track together, the chapter is the
     main line, NEXT goes to the chapter, and the track comes second.
   - Otherwise the main line is the track news, as before, and the
     second line says how many stars open the next chapter.
4. **The shortfall line shows on every career run while the next chapter
   is locked**, not only on a chapter's last track. Every run counts
   toward the chapter, so a player on any track can read how far away it
   is.
5. **"Tangle" became "Over and under"** before the final runs.
   CrazyGames lists "Tangle Master" and "Twisted Tangle", which is too
   close. The other names are plain English phrases; only "Tangle" was
   checked against the CrazyGames catalogue.
6. **Two layout fixes outside the brief's list**, both in
   `game/index.html` and described above.
   - The mission list at 844x390, which overlapped on main too. The
     brief asks for no overlaps on the heading at four sizes, which
     needed this fix.
   - The fade in's transform.
7. **Two probes outside `game/test/chapters/` changed.**
   - `occlusion.js`: an export and a `--career` flag. Its default run is
     unchanged.
   - `retention/probes.js`: the missions section walks 24 tracks.
8. **The old saves were made by main's code**, not shaped by hand. That
   is stricter than the brief asks. To regenerate them, `main-save.js`
   needs a worktree of main.
