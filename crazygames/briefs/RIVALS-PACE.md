# Brief: quicker rivals at the top of the ladder (14 November 2026)

Branch `crazygames-pace`. Folders: `game/src/rivals/roster.js`,
`game/test/pace/`, `review/pace/`. Read `../CLAUDE.md` first (the
Status section's last five entries are where this starts), then
`review/ladder3/REPORT.md`.

## Why

The author played the whole game from an empty browser and beat all six
rivals first time. His words: "the rivals are a little too slow,
especially the latter ones. I never had to play a race or a rival
twice." All six are in the game and stay in it. The economy was made
dearer in the same sitting, so a player now meets the later rivals in a
slower car than he did; do not overcorrect.

As they stand (own points, no lead bonuses; the multiple is his points
a second over his track's three star rate, `game/test/ladder3/ruler.js`):

| rival | setup | race s | own points | points/s | multiple |
|---|---|---|---|---|---|
| Kestrow | First slide, starter, 4 laps | 75.2 | 2,662 | 35 | 1.93 |
| Tolvo | Tight city, hatch, 3 laps | 83.5 | 4,849 | 58 | 3.68 |
| Varsk | Upper deck, fastback, 3 laps | 93.7 | 6,581 | 70 | 4.37 |
| Dovane | Over and under, tourer +2, 3 laps, Tolvo's driving | 94.0 | 4,086 | 43 | 2.91 |
| Halvik | High wire, drift build, 3 laps, his own driving | 92.1 | 4,338 | 47 | 3.28 |
| Sarrow | Endless eight, starter, 3 laps, Varsk's driving | 94.2 | 5,201 | 55 | 3.92 |

The last three came from a scan of existing setups
(`game/test/play13/scan.js`), not a search. Halvik is fragile: all 20
disturbed runs miss the driving bar, mostly by one hard hit.

## What to build

Search the driving of **Dovane, Halvik and Sarrow**, each on his own,
so the ladder climbs past Varsk. Kestrow, Tolvo and Varsk are not to
be changed.

Targets, as multiples: Dovane 4.6 or more, Halvik 4.9 or more, Sarrow
5.2 or more, and no rival above 6. If a target cannot be reached, keep
the highest clean setup found that beats what he has now, and say so.
The three are independent: one failing does not stop the others.

For each you may change his driving numbers, car, upgrade steps
(`up`), laps (race 60 to 120 s) and, as a last resort, his track
within his half of his chapter (Dovane 12 to 15, Halvik 16 to 19,
Sarrow 20 to 23). Prefer his present track. Sarrow belongs in a fast
car if a clean setup at his target exists in one; if not he stays in
the starter and his line stays. Keep each `style` line true of how he
drives.

The bars, which earlier rounds showed are the reachable ones:
- the undisturbed run, **in the page** (Chromium's arithmetic is the
  record; `game/test/play13/page.js` shows how): no respawn, no hard
  hit, at most two scrapes, the driving bar of
  `game/test/driftrace/hands.js` met, only a player's hands;
- of the 20 disturbed runs, at most 2 miss the bar;
- the plateau (`game/test/ladder2/plateau.js`): at most 4 of his 38
  one per cent moves miss. A zero-miss plateau has never been passed
  by anyone, Kestrow included; do not ask for it.

Budget: three search rounds for each rival. Start each search from the
best existing clean driving on his track (the scan's finds are in
`review/play13/scan.json`), and reuse `game/test/ladder3/search.js`,
`candidate.js` and `drive.js`. Searches run in Node; run two at once at
most (two cores). Long runs detached with `setsid nohup`.

## Keep

Everything a player sees apart from these three rivals' driving, cars,
laps and lines. `TANDEM`, the scoring, prices, the career, the save,
`physics/`, `audio/`. Every recorded run replays to the bit
(`game/test/ladder2/determinism.js`). Report worst cases and counts,
not medians. Do not lower a bar to pass.

Australian spelling; no em or en dashes; no model names or session
identifiers; commit as `git -c user.name="SnapHit"
-c user.email="nathanhaslewood@gmail.com"` with no trailers.

## Measure, each with a known answer that can fail

1. Nothing else changed: `ladder2/determinism.js` passes.
2. Each of the three: the bars above, with the numbers. Known answer:
   Halvik as he stands on `main` fails the disturbed bar.
3. The table above again for all six, in the page. Known answer: the
   table on `main` does not climb after Varsk.
4. `game/test/ladder/earning.js`, `game/test/play13/check.js` and
   `game/test/play13/career.js` still pass. Restore other rounds'
   review files with `git checkout` afterwards.

## Deliver

Commits on `crazygames-pace`, pushed after every step. Never push to
`main`. Finish with `review/pace/REPORT.md` (write it from the shell
if the file tool refuses): a phone-readable summary first, the table,
each rival's bars, what was tried and failed, every deviation.

If anything in this brief turns out to be wrong, stop and say so rather
than working around it.
