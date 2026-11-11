# Brief: the rivals ladder (12 November 2026)

Branch `crazygames-ladder`. Folders: `game/` and `review/ladder/`. Read
`../CLAUDE.md` first (the Status section is the history; the last three
entries are this round's context), then `briefs/DRIFT-RACE.md` and
`review/driftrace/REPORT.md` with its reviewer's note.

## Why

The author played the drift race against Kestrow: "it works much better
now". Then he asked when a race is offered, because he could not see
the pattern. There is none to see: the race is offered once, on the
results screen that first opens Kestrow, and after that lives in one
card between two rows of the career list. Five more rivals exist and
are switched off (`TANDEM.LIVE` 1), so the ladder has one rung.

His instruction, verbatim:

> Go ahead and integrate the other five opponents, plus give the
> opponent challenges a more visible home so players can choose to play
> those whenever they like. Note I like the idea that players need to
> earn the ability to play the opponent challenges.

So this round does two things: makes the other five rivals fit to
race under the drift race's rules, and gives rival races a home of
their own that a player can find, understand and come back to.

## The design, decided

- **Rivals have their own screen**, opened by a RIVALS button on the
  title, beside the career, the daily and the rest. It shows all six in
  ladder order from the first visit: a rival not yet earned is shown
  locked, with his name, his car in his paint, and exactly what earns
  him. Nothing about the ladder is hidden.
- **A race is earned, as now**: a star on his career track, and a win
  over the rival before him. Keep that rule. The locked card says it
  in the player's words ("Win a star on Hairpin heaven", "Beat
  Kestrow"), with what is already done ticked.
- **Once earned, a rival can be raced whenever the player likes**, from
  the rivals screen, as often as he likes, won or lost. A beaten rival
  shows the best margin and stays raceable.
- **The title's button carries the state**: how many are beaten of six,
  and a mark when a rival is open and not yet beaten, so there is
  always a reason to tap it. Before the first is earned it says what
  earns him.
- **The career keeps its cards and the results keep their offers**, and
  the offer is no longer once only: a career result on a rival's track
  offers his race whenever he is open and unbeaten, as the secondary
  button beside NEXT. A race's results name the next rival and either
  offer him or say what earns him, and offer the rivals screen.
- **Each rival is a character a player can tell apart**: name, car,
  paint, a one-line style that is true of how he drives, his track,
  his prize. Six different cars and paints where the roster allows
  (two rivals share the fastback today; change one if a rival can be
  made good in another car).
- **They get harder up the ladder**, measured, not asserted.
- **Nothing stored changes.** The `rivals` entry is as it is. Battles
  still gate nothing in the career.

Every number of taste goes in a named block with a one-line comment.

## What to build, in priority order

Finish each before starting the next. If you run short, stop and report
what is left; do not half-do the later ones.

1. **The rivals screen and the title button.** Built and measured with
   Kestrow alone first, so it is right before five more cards arrive.
   It fits 390x844, 844x390, 800x450 and 1280x720 with no page scroll
   on the title; the rivals screen may scroll its list, never its
   header or back button. Keyboard and gamepad reach every card, as the
   other screens do.
2. **The offers**: the repeating offer on a career result, the next
   rival on a race's results, the way back to the rivals screen.
3. **Rivals two to six, one at a time, in ladder order.** For each:
   choose his track in his half of his chapter and search his driving
   with a player's hands (`game/test/driftrace/search.js`), set his
   laps so a race is 60 to 120 s, measure him (measurements 2 and 3),
   and only then raise `TANDEM.LIVE` to include him. The ladder is a
   chain, so stop raising it at the first rival who cannot be made to
   pass; report him and what you tried, and leave the ones after him
   built and measured behind `?rivals=all`.
4. **Two things the last round left failing**, if time remains:
   - a player parked on the rival's line is carried for 1.2 s against
     a bar of 1 s;
   - the pin release (`TANDEM.PIN_SLACK`) never acts in any scenario.
     Either build the scenario that proves it or remove it and say so.

## Keep

Everything in the Keep sections of `briefs/RIVALS.md` and
`briefs/DRIFT-RACE.md` holds: every existing run untouched to the bit;
the author's blocks (`TUNE.VEHICLE`, `TUNE.ASSIST`, `TUNE.CAMERA`,
`TUNE.SCORING`'s existing numbers, star targets, coins, prices, the
chapters' thresholds) not retuned; the save only gains; names invented
and searched; `physics/vehicle.js`, `physics/driver.js`, `audio/` and
`assets/audio/` unchanged; career seeds unchanged.

**Kestrow is the author's now.** He played him and approved. Do not
change his driving, his laps, the lead and line shares
(`TANDEM.LEAD_SHARE` 2.2, `LINE_SHARE` 1.0) or the close bonus. If a
later rival cannot be made fair without changing a shared number, stop
and say so; give that rival a number of his own in the roster instead
if that is honest.

Every scripted player uses only a player's controls. Report worst
cases and counts, not medians. Do not lower a bar to pass; report the
failure.

The probes: `tracks2.js`'s busyness known answer, `cars/render.js` and
one low tier moment of `spectacle/night.js` on Crossover fail on
`main`; report, do not fix. The long suites (`loop/probes.js` about 45
minutes, `retention/probes.js` about 25) run detached with `setsid
nohup`; wait on the process; restore other rounds' review files with
`git checkout`. Run probes from `crazygames/` with
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.

Australian spelling; no em or en dashes; no model names or session
identifiers; commit as `git -c user.name="SnapHit"
-c user.email="nathanhaslewood@gmail.com"` with no trailers.

## Not yours

- New race rules, the rival reacting to the player, rivals on the
  daily, the Lab or free drift, more than six rivals.
- Cosmetics or rewards other than coins (the garage round is next).
- A rival's sound, portraits drawn as images (his car in his paint is
  his portrait), leaderboards, multiplayer.

## Measure, each with a known answer that can fail

1. **Nothing that exists has changed.** `main`'s tapes replay to the
   same hash and score; a Kestrow race's tape recorded on `main`
   replays to the same hashes and both totals. Known answers as before.
2. **Each new rival drives well, robustly, with a player's hands.** The
   drift race's measurement 2, for each: no respawn, hard hit or wall
   contact, every corner slid, 0 of 20 disturbed runs missing the bar,
   the guard counting 0 changed inputs.
3. **Each new rival is a race, and the ladder climbs.** With the three
   scripted players (grip, slide, mixed), 20 disturbed races each, in
   the car you name for him (the starter with no upgrades for the
   Rookie pair; for Pro and Legend, say which car and upgrades a player
   would plausibly own by then, and why):
   - no player wins 20 of 20 and none loses 20 of 20 across all three:
     at least two of the three win at least 3 of 20;
   - no player is ahead all the way, or behind all the way, in every
     race;
   - a player who never moves loses;
   - **the ladder climbs**: across the six, the scripted players' total
     wins fall from each rival to the next, or his own total as a
     multiple of his track's three star target rises. Report both for
     all six in one table. Known answer: with two rivals swapped in the
     order, the check fails.
4. **Earning and the screen's states.** From an empty save, scripted:
   the title's button and every card's state and words at each step of
   earning and beating all six in order; a rival is never raceable
   before he is earned (by the button, the card, the career card, the
   offer or a direct action); every earned rival stays raceable after
   a win and after a loss. Known answer: a save with a win over the
   third and none over the second does not open the fourth.
5. **Layout.** The title, the rivals screen (none earned, some, all
   beaten), the career result with an offer, and a race's results (won
   with a next rival, won with none, lost), at 390x844, 844x390,
   800x450 and 1280x720, by bounding boxes: no overlaps, every button
   inside the view, the title does not scroll. Touch targets at least
   44 px.
6. **Contact**, for each new rival: the drift race's measurement 4.
7. **Frame time**: the worst new rival against the same track solo, as
   before. The GPU cannot be measured here; say so.
8. **The save.** `main`'s save loads with nothing repaired and nothing
   changed. `loop/quota.js` passes.
9. **Frames**, in `review/ladder/shots/`: the title with the button in
   each of its states; the rivals screen none earned, mid ladder and
   all beaten; each new rival side by side with the player mid slide,
   by day and at night; the offers. At 1280x720, 390x844 and 844x390.
   Look hard at every one: six cards that read as six characters, not
   six rows.

## Deliver

Commits on `crazygames-ladder`, pushed after every step. Never push to
`main`.

Finish with `review/ladder/REPORT.md`: a phone-readable summary first;
the measurements with their known answers; the ladder table; the
frames; what the author should judge on his own devices; what is not
done; every deviation from this brief.

If anything in this brief turns out to be wrong, stop and say so rather
than working around it.
