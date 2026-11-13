# Quicker rivals at the top of the ladder: report (14 November 2026)

Brief: `briefs/RIVALS-PACE.md`. Branch `crazygames-pace`.

## Summary

- **Dovane: target met.** The plain fastback, three laps of Over and
  under: 83.8 s, 6,961 of his own, x5.55 (was x2.90). Passes all three
  bars with room: 0 of 20 disturbed runs miss, 2 of 38 moves miss.
- **Sarrow: target met, in the starter.** No clean setup at his target
  was found in a fast car, so he stays in the starter coupe, now with
  one step of each upgrade: 77.9 s, 5,914, x5.40 (was x3.93). 0 of 20
  miss, 3 of 38 moves miss. His line stays.
- **Halvik: target not met.** The best clean setup found is the plain
  light hatch over two laps of High wire: 68.6 s, 3,509, x3.57 (was
  x3.29, and every disturbed run missed the bar). Passes all three
  bars: 1 of 20 miss, 2 of 38 moves miss. It beats what he had, so it
  is kept, as the brief says. His line changed, because his angles are
  no longer the biggest.
- **So the ladder still does not climb after Varsk.** Halvik (x3.57)
  is below Varsk (x4.37), and Sarrow (x5.40) is just below Dovane
  (x5.55). Nobody is above x6. Details and the choice I made below.
- Nothing else changed: determinism, earning, the play13 check and
  career probes all pass.

## The table, measured in the page

Own points (drift, clean and pace, no lead bonuses); the multiple is
points a second over his track's three star rate
(`ladder3/ruler.js`), worked out in the page too.
`game/test/pace/measure.js table`, `review/pace/table.json`.

| rival | setup | race s | own points | points/s | multiple |
|---|---|---|---|---|---|
| Kestrow | First slide, starter, 4 laps | 75.2 | 2,662 | 35.4 | 1.93 |
| Tolvo | Tight city, hatch, 3 laps | 83.5 | 4,849 | 58.1 | 3.69 |
| Varsk | Upper deck, fastback, 3 laps | 93.7 | 6,581 | 70.2 | 4.37 |
| Dovane | Over and under, fastback, 3 laps | 83.8 | 6,961 | 83.1 | **5.55** |
| Halvik | High wire, light hatch, 2 laps | 68.6 | 3,509 | 51.1 | **3.57** |
| Sarrow | Endless eight, starter +1 of each, 3 laps | 77.9 | 5,914 | 75.9 | **5.40** |

All six: no respawn, no hard hit, no scrape in the page.

## Each rival's bars

`game/test/pace/measure.js bars`, `review/pace/bars.json`. Page run:
the `driftrace/hands.js` driving bar in Chromium. Disturbed: the 20
disturbances in Node, at most 2 may miss. Plateau: each of 19 driving
numbers one per cent either way, 5 runs each, at most 4 of 38 moves
may miss.

| rival | page run | 20 disturbed | plateau |
|---|---|---|---|
| Dovane | PASS: 0 hard, 0 scrapes, lowest 83 km/h, least slid corner 63%, mean angle 33.1, best chain 1,109 | **PASS, 0 miss**; worst 0 hard, 0 scrapes, totals 6,314 to 7,276 | **PASS, 2 of 38** (2 of 190 runs): ANGLE_CAP down (2 hard hits), HB_OVER up (1 hard hit) |
| Halvik | PASS: 0 hard, 0 scrapes, lowest 53 km/h, least slid corner 34%, mean angle 29.1, best chain 488 | **PASS, 1 miss** (a corner 27% slid); worst 0 hard, 1 scrape, totals 3,462 to 3,890 | **PASS, 2 of 38** (2 runs): KEEP up (a corner 20%), SETUP up (1 hard hit) |
| Sarrow | PASS: 0 hard, 0 scrapes, lowest 87 km/h, least slid corner 58%, mean angle 28.5, best chain 514 | **PASS, 0 miss**; worst 0 hard, 2 scrapes, totals 5,698 to 5,929 | **PASS, 3 of 38** (3 runs): PROGRESS down (1 hard hit), HB_OVER up (2 hard hits), HB_OVER down (3 scrapes) |

Page and Node totals agree for all three.

## The measurements, each with its known answer

| # | measure | result | known answer |
|---|---|---|---|
| 1 | nothing else changed (`ladder2/determinism.js`) | PASS: career 1 895 = 895, The vice 1,678 = 1,678, the Kestrow race 2,114 and 4,497 with both hashes the same | all three caught |
| 2 | the three bars for each | PASS for all three (table above) | Halvik as on `main` fails the disturbed bar: 20 of 20 miss. Caught (`review/pace/bars-main.json`) |
| 3 | the six-row table in the page | **FAIL: does not climb.** Halvik x3.57 is not above Dovane x5.55, and is under Varsk too | the table on `main` does not climb (Dovane x2.90 under Varsk x4.37). Caught (`table-main.json`) |
| 4a | `ladder/earning.js` | PASS | a win over the third with none over the second does not open the fourth: held; with the second beaten it opens: caught |
| 4b | `play13/check.js` | PASS, 33 checks | its own known answers pass |
| 4c | `play13/career.js` | PASS, 24 checks | its own known answers pass |

Other rounds' review files were restored with `git checkout`. The
rivals screen with the new three, from the check probe, is in
`review/pace/shots/`.

## The order at the top

Dovane passed his bars in two setups of the same driving: the fastback
with two steps of each (x5.66, 2 of 20 disturbed miss, 2 of 38 moves)
and the plain fastback (x5.55, 0 of 20, 2 of 38). I took the plain
fastback: lower, a cheaper car, and more robust. Both are above
Sarrow's x5.40, so I could not put Sarrow on top. No setup of Dovane
between x4.6 and x5.4 passed the plateau (the nearest, x5.17, missed 5
of 38). The author may prefer swapping the two in play.

## What was tried and failed

Logs in `review/pace/runs/`. Each search is `ladder3/search.js`
(robust: an undisturbed run, 6 disturbed, 6 runs with every number
jogged one per cent), with the band at the rival's target.

The first search for each, from his existing driving, got nowhere. The
band punishes a low multiple so hard that the search stays near where
it starts, and the higher-scoring drivings it can reach hit walls. So I
added a first look (`game/test/pace/explore.js`): random drivings,
each run once undisturbed in each car and upgrade step, kept when
clean, then run over the 20 disturbances. Each later search started
from what that found. In the explorer's logs, `"disturbed": 4` means 4
**or more**: it stops counting past its cap of 3.
`game/test/pace/around.js` runs a found driving with other cars, steps
and laps. It does not search.

**Dovane**
- Round 1 (`d1-a`): from his own driving (Tolvo's), in the tourer with
  two steps of each. Stuck at x2.98.
- Round 2 (`d2-a`): from an explorer find in the fastback with one step
  of each (x4.59 clean undisturbed). Never stopped hitting walls (7
  hard hits across its runs). Stopped by hand at 20 of 250.
- Round 3 (`d3-a`): from a robust find in the fastback with three steps
  of each (x4.44, 3 disturbed miss). Reached x5.62, clean over all 13
  runs, but missed 8 of 38 moves. The same driving in the fastback with
  two steps or with none passes everything (above).

**Halvik**
- Round 1 (`h1-a`): his own driving, in the drift build, on High wire.
  Best x3.63, still 1 hard hit. 6 of 20 disturbed miss and 38 of 38
  moves miss.
- First looks: High wire in the drift build, fastback and tourer (the
  best clean was x3.89, Varsk-like driving, not robust); Knot yard, the
  only other circuit in his half (best robust x3.81); Dovane's new
  driving on High wire in all five cars (every one hits walls).
- Round 2 (`h2-a`): from Dovane's family of driving found on High wire
  in the hatch (x3.81). Got to x3.71, but 4 of 20 disturbed miss.
  Over two laps the same driving gives x3.79 with 1 miss, but fails the
  plateau with 6 of 38.
- Round 3 (`h3-a`): that, over two laps. The best passed everything at
  x3.57 and x3.56, and is the Halvik now in the roster.

**Sarrow**
- Round 1 (`s1-a`): Varsk's driving in the fastback with two steps of
  each. Best x5.39 undisturbed, but 3 to 7 hard hits.
- First look in the fastback and drift build: best clean x3.86
  undisturbed. A robust look found x4.97 in the fastback with two steps
  of each (4 or more disturbed miss).
- Round 2 (`s2-a`): from that. Never clean (5 hard hits across its runs).
- First look in the starter: x4.62 with one step of each (4 or more
  miss), and x4.00 to x4.03 in the plain starter with 1 to 2 misses.
- Round 3 (`s3-a`): from the x4.62 find. Reached x5.40, which is the
  Sarrow now in the roster.

## Deviations

1. **Searches did not all start from the best existing clean driving
   on his track.** Each first round did. Rounds 2 and 3 started from
   the explorer's finds. The explorer and the setup scan are extra
   work outside the three search rounds, and I have counted them that
   way. Without them no search left its starting point.
2. Dovane's search ran in the fastback with three steps of each; he
   ships in the plain fastback, the same driving, chosen by the setup
   scan (see "The order at the top").
3. Halvik now races two laps, not three (68.6 s, inside 60 to 120).
   He is in the light hatch, not the drift build. His line was "The
   biggest angles"; it is now "Short and sharp in the light hatch". His
   race is the shortest of the six, and Dovane's 33 degrees on average
   are now the biggest.
4. Sarrow's starter has one step of each upgrade. I kept "Beats you in
   the starter coupe" because it is still the starter. Say if the line
   should mention the upgrades.
5. Two of the four tracks in each of Halvik's and Sarrow's halves are
   sprints. In the scan sprints run about 50 to 55 s, under the 60 s
   floor, so Halvik really had two tracks to choose from (High wire,
   Knot yard). I did not move any rival's track.
6. Several explorer runs and the second Dovane search were stopped by
   hand to free a core; each log says so.
7. `game/test/play13/page.js` was not rerun. It is not in the brief.
   Its pass line (a total of 4,000 or more) would fail Halvik's new
   3,509, which is a two lap race.
8. The prizes and paints are unchanged. Dovane keeps his wine paint, now
   on the fastback.

## For the author, on his own devices

- Whether Dovane at x5.55 is too big a step after Varsk at x4.37, with
  the dearer economy. The brief allowed up to x6.
- Halvik is now the easiest of the last three per second, but a short,
  quick race in a hatch that never touches a wall.
- Stored best margins over the old three still sit in a save.
