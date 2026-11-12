# Brief: the rest of the ladder, second attempt (12 November 2026)

Branch `crazygames-ladder3`. Folders: `game/` and `review/ladder3/`.
Read `../CLAUDE.md` first (the Status section; its last entry is where
this round starts), then `review/ladder2/REPORT.md` with its reviewer's
note, and `briefs/RIVALS-LADDER.md` for the bars this brief refers to.

## Why

The last round (`briefs/RIVALS-LADDER-2.md`) stopped at its first
priority and the brief was at fault: it graded rivals by how often
three scripted players beat them, then spent the round rebuilding those
players, and never reached the rivals. Two of six are in the game. The
author agreed to this round's plan on 12 November: **the rivals'
driving first, and difficulty set from numbers he tuned by play, not
from scripted opponents.**

Varsk, Dovane, Halvik and Sarrow fail the driving bar as they stand
(hard hits; 2 to 20 of 20 disturbed runs miss). Tolvo passes 20 of 20
but is on a knife edge: 9 of his 38 one per cent moves miss
(`game/test/ladder2/plateau.js`).

## The ruler, decided

No rival is graded by the scripted players' win counts any more. For
each rival, three numbers, all deterministic:

- **His rate**: his own points (drift, clean and pace; no leads, no
  line) divided by his race time, as a multiple of his track's **three
  star rate**: the track's three star target divided by a career run's
  time at par pace (the run's length over `SCORING.PAR_SPEED`). Write
  the definition down once in the probe and use it for all six.
- **The staircase**: Kestrow's multiple, measured as he is, is the
  bottom step. Each rival's multiple is at least 5 per cent above the
  rival's before him.
- **Headroom and pace**: the strong driver with a player's hands
  (`game/test/stars/reach.js`, `opts.hands`), in the car a player would
  plausibly own by then (say which and why), racing him: finishes ahead
  of him, and outscores him by at least a quarter. So a win is there
  for a player who drives well, on pace and on points.

If Kestrow's own headroom or pace fails that, report it and change
nothing of his; say what it means for the staircase.

The three scripted players (`rivals/players.js`, their own numbers or
`PLAYERS.AT` where it passed; say which) are a sanity check only: over
20 disturbed races each, at least one race is won and at least one
lost across the 60, and a player who never moves loses. Report the
counts; they gate nothing else.

## What to build, in priority order

Finish each before the next. **Budget yourself**: the last round spent
eight hours on one priority. Give each rival at most three rounds of
search; if he does not pass, the chain stops at him: report what you
tried, leave him and those after him behind `?rivals=all`, and go on to
priorities 3 and 4 with the rivals who are live.

1. **Tolvo on a plateau.** Search his driving so every driving number
   moved one per cent up and down still passes the driving bar (the
   ladder brief's measurement 2: no respawn, hard hit or wall contact,
   every corner slid, 0 of 20 disturbed runs missing, 0 changed
   inputs). Place him on the staircase. His track, laps, car and
   driving may change; a 60 to 120 s race. If no plateau is found in
   three rounds, keep the Tolvo on `main` exactly, say so, and go on:
   he is live and the author has not asked for him to be removed.
2. **Varsk, Dovane, Halvik, Sarrow, in that order.** For each: his
   track in his half of his chapter; his driving searched with a
   player's hands for the driving bar and the plateau; laps for a 60 to
   120 s race; then the ruler. Only then raise `TANDEM.LIVE`. Two
   rivals share the fastback; give one another car if he can be made
   good in it. Each rival's one line style must be true of how he
   drives.
3. **With however many are live**: the ladder round's measurements 4
   (earning and the screen's states), 5 (layout), 6 (contact), 7 (frame
   time) and 8 (the save) again; `game/test/ladder2/newplayer.js` still
   passes as it does on `main`. If all six are live, nothing on the
   title, the rivals screen or the results still speaks of rivals who
   are not in the game.
4. **Frames**, in `review/ladder3/shots/`: each new rival side by side
   with the player mid slide, by day and at night; the rivals screen
   with the new count live, none earned, mid ladder and all beaten, at
   390x844 and 1280x720. Look hard at every one.

## Keep

Everything in the Keep sections of `briefs/RIVALS.md`,
`briefs/DRIFT-RACE.md`, `briefs/RIVALS-LADDER.md` and
`briefs/RIVALS-LADDER-2.md`. In short: every existing run untouched to
the bit; the author's blocks not retuned; star targets, coins, prices
and thresholds unchanged; the save only gains; `physics/vehicle.js`,
`physics/driver.js`, `audio/`, `assets/audio/` and career seeds
unchanged; **Kestrow's driving and laps, `TANDEM.LEAD_SHARE`,
`LINE_SHARE` and the close bonus unchanged**; the rivals screen, the
title and the offers as the author approved them.

Every scripted driver uses only a player's controls. Report worst cases
and counts, not medians. Do not lower a bar to pass; report the
failure.

The probes that fail on `main`, to report and not fix:
`ladder/rivals.js` and `ladder2/rivals.js` (superseded by this round's
ruler), `ladder2/players.js measure` off First slide,
`ladder2/newplayer.js`'s aborted music check, `driftrace/racing.js`,
`driftrace/contact.js`, `tracks2.js`, `cars/render.js`, one low tier
moment of `spectacle/night.js`. The long suites run detached with
`setsid nohup`; wait on the process; restore other rounds' review files
with `git checkout`, taking care not to delete this round's own logs.
Run probes from `crazygames/` with
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.

Australian spelling; no em or en dashes; no model names or session
identifiers; commit as `git -c user.name="SnapHit"
-c user.email="nathanhaslewood@gmail.com"` with no trailers.

## Not yours

The measuring players (do not search them again). New race rules, a
new rivals screen, the newcomer's confusions listed in the last report,
gamepad menus, more than six rivals, cosmetics, sound, anything for the
garage round.

## Measure, each with a known answer that can fail

1. **Nothing that exists has changed.** `game/test/ladder2/determinism.js`
   against `review/ladder2/main.json`: the same hashes and totals.
2. **Each rival from Tolvo on drives well, on a plateau.** The driving
   bar over 20 disturbed runs, and each driving number one per cent up
   and down, 5 disturbed runs each, none missing. Known answer: the
   Tolvo on `main` fails the plateau.
3. **The ruler**, one table for all six: track, car, laps, race time,
   his points, his multiple, the step from the rival before, the strong
   driver's time and total against him, and the sanity counts. Known
   answers: two rivals swapped fails the staircase; a rival given the
   strong driver's own driving fails the headroom.
4. **Priority 3's measurements**, with their known answers as in the
   ladder brief.
5. **Frames**, as priority 4.

## Deliver

Commits on `crazygames-ladder3`, pushed after every step. Never push to
`main`.

Finish with `review/ladder3/REPORT.md`: a phone-readable summary first
(how many are live, and who stopped the chain if anyone); the ruler's
table; the measurements with their known answers; what the author
should judge on his own devices; what is not done; every deviation. If
the file tool refuses to write the report, write it from the shell.

If anything in this brief turns out to be wrong, stop and say so rather
than working around it.
