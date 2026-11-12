# The rest of the ladder, second attempt: report (13 November 2026)

Brief: `briefs/RIVALS-LADDER-3.md`. Branch `crazygames-ladder3`.

## Summary

- **Still two rivals in the game** (`TANDEM.LIVE` 2): Kestrow and Tolvo.
  Nothing a player sees has changed.
- **Tolvo: no plateau in three rounds**, so he is the Tolvo on `main`,
  exactly, as the brief says. The best found missed 4 of his 38 one per
  cent moves (main's misses 9).
- **The chain stops at Varsk.** In three rounds his driving got close
  (20 of 20 disturbed runs pass, 2 of 38 moves miss, one run each), but
  the strong driver cannot beat him on pace. He, Dovane, Halvik and
  Sarrow stay behind `?rivals=all`. Varsk's closest driving is kept
  there; the other three are as they were.
- **The ruler's headroom fails for Kestrow** (the strong driver
  outscores him by 20 to 46 per cent but finishes 3.5 to 7.9 s behind
  him). As the brief says, nothing of his changed. What that means is
  below.
- Priority 3 is run with two live: everything passes as on `main`, apart
  from the failures `main` already has.
- **Something in the brief looks wrong, and I stopped rather than work
  around it.** With this driver, the plateau bar and the headroom bar
  look out of reach together for anyone above Kestrow (see "What this
  says about the brief").

## The ruler (measure 3)

The definition is written once, in `game/test/ladder3/ruler.js`:

- **His rate:** his own race points (drift, clean and pace) over his
  race time.
- **The three star rate:** his track's three star target for a career
  run, over that run's time at par pace (run metres / `PAR_SPEED`).
- **His multiple:** the first over the second.
- **The staircase:** each multiple at least 5 per cent above the one
  before.
- **Headroom and pace:** the strong driver races him and must finish
  first and score at least a quarter more, in each of three races (one
  undisturbed, two disturbed).
- **The strong driver's car:** the car a player would have by then
  (`ladder/lib.js PLAYER_CAR`). That is the starter in Rookie, the
  starter with one step of each by Pro, and two steps of each by
  Legend. A player is likelier to upgrade the car he knows than buy a
  new one, and by then he has earned those steps many times over (the
  ladder round's arithmetic).
- **The sanity check:** the three scripted players race him 20 times
  each. Kestrow uses `PLAYERS.AT`, because it passed on First slide;
  everyone else uses their own numbers.

| rival | track | car | laps | race s | his points | multiple | step | strong s / his s (3 races) | strong total against his | sanity won / lost of 60 | parked |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Kestrow | 1 First slide | starter | 4 | 75.2 | 2,662 | 1.93 | bottom | 78.7/75.2, 80.4/74.8, 82.1/74.2 | +20%, +46%, +42% | 18 / 42 (grip 16, slide 1, mixed 1) | loses |
| Tolvo | 5 Tight city | hatch | 3 | 83.5 | 4,849 | 3.69 | +90.6% | 84.1/83.5, 84.0/82.1, 83.1/81.8 | -29%, -21%, -16% | 11 / 49 (0, 3, 8) | loses |
| Varsk* | 9 Upper deck | fastback | 3 | 93.7 | 6,581 | 4.37 | +18.4% | 95.2/93.7, 97.8/93.9, 96.0/93.3 | -14%, -1%, -5% | **0 / 60** | loses |
| Dovane | 13 Over and under | tourer | 2 | 57.9 | 1,897 | 2.19 | **-49.8%** | 60.2/57.9, 59.3/56.8, 62.7/59.0 | +9%, +4%, +18% | 23 / 37 (0, 14, 9) | loses |
| Halvik | 17 Knot yard | drift build | 2 | 70.2 | 1,234 | 1.18 | **-46.2%** | 58.4/70.2, 60.4/70.7, 60.3/69.4 | +156%, +228%, +163% | 46 / 14 (14, 12, 20) | loses |
| Sarrow | 21 Endless eight | fastback | 2 | 77.6 | 3,366 | 3.09 | +162% | 70.9/77.6, 73.6/75.9, 71.3/74.9 | +120%, +820%, +78% | 46 / 14 (13, 18, 15) | loses |

\* Varsk with this round's closest driving. Dovane, Halvik and Sarrow
were not searched (the chain stopped first), and all three fail the
driving bar.

How each rival does:

- **Kestrow:** headroom FAIL on pace. Staircase bottom. Sanity PASS.
- **Tolvo:** headroom FAIL on pace and points. Staircase PASS. Sanity
  PASS.
- **Varsk:** headroom FAIL. Staircase PASS. Sanity FAIL (no scripted
  player wins once).
- **Dovane and Halvik:** fail the staircase. Halvik and Sarrow pass
  headroom only because they are slow and crash.

**Known answers:**

- Two adjacent rivals swapped fails the staircase. It is caught on 4
  of 5 swaps. It is missed on Dovane and Halvik, because both are
  already below the rival before them.
- Kestrow given the strong driver's own numbers and car fails headroom
  (-29%): caught.
- Tolvo given the strong driver's own numbers and car fails headroom
  (-14%): caught.
- Halvik and Sarrow pass headroom, so the bar can pass.

**What Kestrow failing means for the staircase.** Kestrow is the bottom
step and the slowest scorer per second. He is also the quickest rival
for a player in the starter. Every rival above him must score faster
per second, so he can only be beaten on pace and points if he is
slower than Kestrow is against his own track. Tolvo and Varsk are not:
the strong driver finishes behind both. The scripted grip player does
beat Kestrow home (16 wins of 20) but slides too little to outscore him
by a quarter. So the ruler as written asks every later rival to be
easier on pace than the one rival the author approved.

## The measurements, each with its known answer

| # | measurement | result | known answer |
|---|---|---|---|
| 1 | nothing that exists has changed (`ladder2/determinism.js`) | PASS. Career 1 895 = 895, The vice 1,678 = 1,678, a Kestrow race 2,114 and 4,497 with both hashes the same | all 3 caught |
| 2 | Tolvo on, on a plateau (`ladder3/drive.js`) | **FAIL**, see the table below | main's Tolvo fails, 9 of 38 moves (15 of 180 runs): caught. He is the Tolvo in the game, so his row is the known answer |
| 3 | the ruler (`ladder3/ruler.js`) | **FAIL**, see the table above | swaps 4 of 5 caught, both twins caught |
| 4a | earning and states (`ladder/earning.js`) | PASS. 19 of 19 steps right with all six, 19 of 19 as shipped | third beaten without the second does not open the fourth: caught, and the converse opens it |
| 4b | layout (`ladder/layout.js`) | PASS at 390x844, 844x390, 800x450 and 1280x720: no title scroll, no overlap | cards pulled 30 px up: caught |
| 4c | contact, Kestrow and Tolvo (`driftrace/contact.js`) | as on `main`: Kestrow 3 fail, Tolvo 5 fail. Both fail PARK (held 1.2 s and 1.16 s against a 1 s bar) and the pin release known answers (cannot be judged). Tolvo's FOLLOW never gets past, and his scenarios never have a hard contact with a chain open. His record matches `review/ladder/contact-r2.json` key for key | not solid overlaps 2.8 m and 2.1 m: caught |
| 4d | frame time (`driftrace/perf.js r1 r2`) | PASS. Low tier JavaScript p95 at 6x throttle, worst 13.5 ms (bar 16.7) | 20 ms of busy work fails, p95 30.5 ms: caught |
| 4e | the save (`ladder/save.js`, `loop/quota.js`) | PASS. Main's save loads with 0 repairs and 0 changes; quota 6 of 6 | a wrong shape save: caught |
| 4f | the new player test (`ladder2/newplayer.js`) | as on `main`: 36 of 38 pass. The 2 fails are 5 music streams aborted on each size (`ERR_ABORTED`), most likely the sandbox's Chromium having no AAC decoder | its seeded profile lands on the title: caught on both sizes |
| 5 | frames | `review/ladder3/shots/`: the rivals screen (none earned, mid ladder, all beaten) at 390x844 and 1280x720, from the layout probe with `?rivals=all`. No new rival, so no side by side frames | |

Records are in `review/ladder3/records/`, `ruler.json` and `drive.json`.
Logs are in `review/ladder3/runs/`.

### Measure 2, the driving bar and the plateau

Over 20 disturbed runs plus the page run, then 38 one per cent moves of
5 runs each:

| rival | page run | 20 disturbed | plateau |
|---|---|---|---|
| Kestrow | 75.2 s, clean | 0 miss | 13 of 38 miss, 16 runs (reported only) |
| Tolvo (main) | 83.5 s, clean | 0 miss | **9 of 38, 15 runs: FAIL** |
| Varsk (this round) | 93.7 s, clean | 0 miss | **2 of 38, 2 runs: FAIL** (ANGLE_CAP and OUTSIDE down 1%: one hard hit each) |
| Dovane | 1 hard hit, a corner 14% | fail | 34 of 34 |
| Halvik | 4 hard hits, 25 km/h | fail | 34 of 34 |
| Sarrow | 8 hard hits, a corner 0% | fail | 34 of 34 |

The page and Node agree on every total. The world hashes differ, as
they always have, because the two engines' Math differs in the last
bit.

## What was tried

The search is `game/test/ladder3/search.js`, with logs in
`review/ladder3/runs/search/`. It is the last round's robust search
with:

- margins on the bar: a corner at least 40 per cent slid, at least
  46 km/h, no scrape at all, and the total within 15 per cent;
- a band on the multiple, in place of a cap on the total;
- pruning: a candidate already worse than the best is not run further.

`game/test/ladder3/candidate.js` checks a candidate on the real bar
and plateau.

**Tolvo:**

- **Round 1 (`r2-a`):** random, then local, kept to x2.12 to x2.5.
  Nothing clean.
- **Round 2 (`r2-b`, `r2-c`):** two starts, one from main's Tolvo
  (slower ranges) and one from the scripted slide player. The first
  got clean over 13 runs but stayed at x2.6 to x4.0. The slide start
  never stopped hitting.
- **Round 3 (`r2-d`, `r2-e`):** the staircase floor only, with no
  ceiling, so the plateau came first. The best passed 20 of 20, but 4
  of 38 moves missed (4 runs). Another passed 20 of 20 with 5 of 38
  missing (7 runs). Scoring better in the search did not mean scoring
  better on the plateau: one later best missed 14 of 38.

**Varsk:**

- **Round 1 (`r3-a`, `r3-b`):** from his own numbers, at x3.9 or more
  (the staircase over Tolvo). The best passed 19 of 20.
- **Round 2 (`r3-c`, `r3-d`):** 20 of 20, 2 of 38 missing. This is the
  Varsk now in the roster. Then the ruler: the strong driver is 1.5 to
  3.9 s behind him.
- **Round 3 (`r3-e`, `r3-f`):** the same, asking for a race of 99 to
  118 s so the strong driver could lead. Nothing got slower than
  92 s. Lowering his top speed alone (31, 29, 27, 25 m/s) gave 2 to 16
  hard hits and unslid corners every time.

## What this says about the brief

I am stopping here rather than working round it.

1. **The plateau** asks for 0 of 38 moves missing. No rival has ever
   reached it, Kestrow included (13 of 38). The best this round, 2 and
   4 of 38, each missed on one run in five, of the "one hard hit, a
   corner barely slid" kind. The look ahead driver is chaotic at this
   scale: a one per cent move picks another line through some corner.
   I have not shown that 0 of 38 is impossible, but three rounds of
   search per rival did not reach it.
2. **The headroom** needs a rival slower than the strong driver, yet
   faster per second than the rival before him. The bottom step,
   Kestrow, is already quicker than the strong driver, and so are the
   two rivals that drive well enough to measure.

So with this driver, a rival who drives well enough to pass the
plateau is too quick to pass the headroom, and nothing passes the
plateau. A decision for the author, not something to tune round:

- Allow a few scrapes or one miss in the plateau.
- Ask headroom on points only, or with a quicker car for the strong
  driver.
- Or give later rivals a slower car than the player's.

## For the author, on his own devices

- Whether Tolvo is too hard: no scripted or strong driver beats him by
  a quarter in the starter.
- Whether Kestrow feels beatable with thumbs. The machine beats him on
  points but not home first.
- Frame rate on the phone and the Chromebook. The sandbox draws in
  software, so the GPU cannot be measured here; JavaScript time only.

## Not done

- Rivals three to six live.
- Frames of new rivals.
- The title, rivals screen and results wording for six live (not
  needed with two).

## Deviations

1. **The strong driver is searched in the race, not solo.** The literal
   `reach.js` set is a lucky draw. On First slide it scores 6,089 from
   the grid centre, but only 3,903 from the player's slot with no rival
   at all. It loses every race (in `ruler.json` as `strongLiteral`). So
   he is searched from the player's slot, racing the rival, each set
   marked by its worst of three races, and seeded with the measuring
   players' numbers as whole drivers. Without the seeds his best
   against Kestrow finished 7 s behind.
2. The ruler takes the career laps for the three star rate, as written.
   The race uses his own laps.
3. The driving bar is the coded one (`driftrace/hands.js BAR`, two
   scrapes allowed), as in every earlier round. The search itself asked
   for none.
4. Varsk's driving changed (behind `?rivals=all` only). His style line
   "Late and aggressive" is not true of his angles (25.6 degrees on
   average). It is late: slides start within 3 m of a corner.
5. The contact probe was run for Kestrow and Tolvo, not new rivals.
   There are none.
6. The frames come from the layout probe, not `ladder/shots.js`.
7. Probes that rewrite other rounds' files were run and their files
   restored with `git checkout`. Their results are copied here.
