# The rest of the ladder: report (12 November 2026)

Brief: `briefs/RIVALS-LADDER-2.md`. Branch `crazygames-ladder2`.

## Summary

- **The round stopped at priority 1. Two of six rivals are live, as
  before** (`TANDEM.LIVE` 2). Nothing a player sees has changed.
- **Why:** the brief's staircase (27 wins of 60 against Kestrow, falling
  to 12 against Sarrow) was anchored on the old measuring players. With
  players made fair on pace, Kestrow himself scores 18, not 27, so the
  band has no honest answer for Tolvo. See the reviewer's note.
- **Done:** measuring players searched for all six rivals' tracks (pass
  on First slide only); the plateau probe (main's Tolvo fails it, and so
  does Kestrow); all six rivals measured as they stand; the new player
  test, built and passing but for one check.
- **Not done:** Tolvo reworked; Varsk, Dovane, Halvik and Sarrow
  searched or live; the SOON wording.

## Reviewer's note

The fault is the brief's, not the build's.

1. The band's top was a number from the old players, and the brief then
   asked for new players. The anchor moved the moment they existed.
2. Priority 1 asked for players fair on **pace** (finish within a
   spread). The search did that, and the slide and mixed players got
   quicker by sliding less: against Kestrow they fell from 12 and 6 wins
   to 1 and 1, while the grip player rose from 9 to 16 and now leads him
   all the way in 20 of 20. A ruler tuned for pace is not a better
   ruler for a race won on points.
3. Varsk to Sarrow fail the driving bar as they stand (hard hits, 2 to
   20 of 20 disturbed runs miss). That is independent of any ruler and
   is the larger part of the work left. The brief put it third.

Proposed for the next round, for the author to accept or not:
- Search each remaining rival's driving first (clean, on a plateau).
- Set difficulty without scripted opponents: each rival's own points a
  second as a multiple of his track's three star rate, rising up the
  ladder, with a lap pace the strong driver with a player's hands
  (`game/test/stars/reach.js`) can beat. Both come from targets the
  author set by play.
- Keep the scripted players only as a sanity check: someone wins,
  someone loses, a parked player loses.

## Priority 1: the measuring players

Searched per track and car, in `PLAYERS.AT` (`game/src/rivals/players.js`),
used only when a probe passes `at`; no game code does, so every recorded
run is unchanged. Tools in `game/test/ladder2/` (`solo.js`, `players.js`,
`search.js`).

The bar, set before measuring: all 21 solo runs finish with no respawn;
the slowest run of any player at most 10 per cent slower than the
fastest of any; each drives as named (slide player slides at least 30
per cent of every corner; mixed player the same on drift corners; grip
player at most 10 per cent of its points from drift). Known answer,
caught: the players' own numbers fail the spread (19.2 per cent on First
slide, 21.0 on Upper deck).

Worst of 21 runs ("+1", "+2": upgrade steps of each in the starter):

| track (car) | grip s | slide s | mixed s | spread | named way | result |
|---|---|---|---|---|---|---|
| 1 First slide, 4 laps | 73.8 to 74.1 | 73.7 to 76.2 | 76.7 to 79.8 | 8.2% | yes | PASS |
| 5 Tight city | 84.6 to 88.1 | 75.6 to 80.6 | 80.3 to 83.3 | 16.6% | no | FAIL |
| 9 Upper deck (+1) | 89.1 to 89.5 | 92.1 to 94.1 | 91.6 to 93.5 | 5.7% | no | FAIL |
| 13 Over and under (+1) | 96.9 to 97.1 | 88.9 to 89.7 | 84.0 to 90.1 | 15.5% | no | FAIL |
| 17 Knot yard (+2) | 100.4 to 101.2 | 107.9 to 108.8 | 102.6 to 108.0 | 8.4% | no | FAIL |
| 21 Endless eight (+2) | 98.1 to 98.8 | 106.4 to 107.2 | 102.8 to 105.0 | 9.3% | no | FAIL |

No respawn anywhere. On Tight city and Over and under the grip player
is the slow one (it must stay under the scoring angle on hairpins of 22
to 34 m). No bar was lowered.

## Priority 2: the plateau

`plateau.js`: each driving number one per cent up and down, 5 disturbed
runs each. Tolvo on main: 9 of 38 moves miss (15 of 180 runs). Known
answer caught. Kestrow: 13 of 38 miss. He is the author's and is
reported only, but it means he may drive differently on some device.

## The ladder as it stands (this round's players, nothing searched)

| rival | track | car | laps | race s | his total | grip | slide | mixed | of 60 | line |
|---|---|---|---|---|---|---|---|---|---|---|
| Kestrow | 1 First slide | starter | 4 | 75.2 | 2,662 | 16 | 1 | 1 | 18 (old players: 27) | 27 |
| Tolvo | 5 Tight city | hatch | 3 | 83.5 | 4,849 | 0 | 8 | 7 | 15 | 24 |
| Varsk | 9 Upper deck | fastback | 3 | 91.2 | 4,333 | 0 | 5 | 0 | 5 | 21 |
| Dovane | 13 Over and under | tourer | 2 | 57.9 | 1,897 | 0 | 1 | 2 | 3 | 18 |
| Halvik | 17 Knot yard | drift build | 2 | 70.2 | 1,234 | 19 | 19 | 13 | 51 | 15 |
| Sarrow | 21 Endless eight | fastback | 2 | 77.6 | 3,366 | 11 | 16 | 18 | 45 | 12 |

A player who never moves loses to all six.

## The seven measurements

| # | measurement | result |
|---|---|---|
| 1 | nothing that exists has changed | PASS. Career 1 (895), The vice (1,678) and a Kestrow race (2,114 to 4,497) replay to the same hashes and totals; 3 known answers caught |
| 2 | each rival from Tolvo on, on a plateau | FAIL. Tolvo 9 of 38; Varsk to Sarrow fail the driving bar itself |
| 3 | each is a race; the band | FAIL. 18, 15, 5, 3, 51, 45 against 27, 24, 21, 18, 15, 12 |
| 4 | earning, states, layout, save with six live | not done: six are not live |
| 5 | contact and frame time | not done: no new rival |
| 6 | a new player, end to end | PASS except the test's own extra check (music streams aborted, below) |
| 7 | frames | the new player's journey only, 16 at each size |

## The new player test

`game/test/ladder2/newplayer.js`. The shipped build, no query, a new
empty browser context per profile; real touches at 390x844, keys and
mouse at 1280x720; the browser clock stepped 16 ms a frame. A throwaway
rehearsal drives with the scripted mixed player and writes down its
presses; the test replays those presses in a fresh profile and reads
the game only to report. Every run matched its rehearsal. Known answer
caught: a profile seeded with a returning player's save lands on the
title. `--origin https://host` runs it against a deployed build and
writes to `review/ladder2/live/`.

The journey:
1. First visit, no click: the onboarding countdown on First slide.
2. Prompts in order: steer, slide, clean sector, brake, chain banked.
3. Results: 1,712 points, three stars, +680 coins, "Track 2 of 8
   unlocked". Buttons: GO AGAIN, NEXT, KESTROW ("race him, just
   earned"), MENU.
4. MENU: the title; RIVALS carries the RACE mark.
5. CAREER, track one again, its results offer Kestrow.
6. The race: lost 1,637 to 4,145. "Next, Tolvo: Win a star on Tight
   city, Beat Kestrow".
7. RIVALS: Kestrow RACE, best -2,508; Tolvo locked; four SOON.
8. Second visit: the title, 3 stars kept.

Checks: no page or console error; 151 requests, none to another host;
16 screens with no overlap and no button outside the view; the title
never scrolls. Five music streams on the phone and four on the desktop
are aborted right after the first touch (`ERR_ABORTED`); the test's own
"no failed request" check fails on that. The count matches the
music's own retry (each of the four files once, then stop), which is
what a browser with no AAC decoder does; the sandbox's Chromium has
none. Most likely the sandbox, not the game; not proved.

What would confuse a newcomer:
- A rival offered on the very first results, before he has seen the
  title.
- "0 LEVEL" beside "VS KESTROW" on the grid (it means level with him).
- The race results table: "Leads 440 5/15", "First home +603".
- Tolvo asks for a star on Tight city, which is locked behind tracks 2
  to 4, and the card does not say so.
- Four SOON cards.
- Small targets: the HUD's exit, full screen and sound buttons are
  36x36 px, SKIP 72x40, the career back arrow 33x44.
- The desktop title's hint says "DRIFT / BRAKE", not SPACE.

## For the author to judge by hand

- Whether the first-visit Kestrow offer is a reward or a puzzle.
- Whether a clean grip line beats Kestrow every time with thumbs.
- "0 LEVEL" and the 36 px buttons on his phone.
- Frame rate: the GPU cannot be measured here.

## Deviations

1. Stopped with priority 1 unfinished; 2, 3 and 5 not started.
2. Priority 4 run ahead of 2 and 3.
3. `PLAYERS.AT` lives in the game module, used only by probes.
4. The test's presses come from a rehearsal that reads the car.
5. Menu taps read where the button is drawn.
6. The browser clock is paused and stepped.
7. Two bars added: "named way" and "no failed request".
8. The long suites and earlier rounds' probes were not run; the only
   game code change is an unused table and an optional argument.
