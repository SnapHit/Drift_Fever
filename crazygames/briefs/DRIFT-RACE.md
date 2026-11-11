# Brief: the drift race (11 November 2026)

Branch `crazygames-driftrace`. Folders: `game/` and `review/driftrace/`.
Read `../CLAUDE.md` first (the Status section is the history), then
`briefs/RIVALS.md` and `review/rivals/REPORT.md`: this round rebuilds
the rules of what that round built, and keeps most of its code.

## Why

The author played the tandem battle against Kestrow and found it
counterintuitive, in his words:

> as a player in a one on one match against an opponent I naturally
> expected it to be some kind of race, i.e. getting ahead of the
> opponent is beneficial. But the rewards weren't given for being ahead
> - the opposite is true. So the problem is twofold: the experience
> goes against what any player would expect in a race, and it's
> impossible to stay behind the opponent because the player can't
> control their own speed.

Both are right, and the second is structural. The player has a
steering value and one button: the throttle is always on, there is no
brake, and DRIFT with no steering stops the car (`game/src/input/`).
The rival's driver lifts and brakes (`rivals/driver.js` writes
`throttle` and `brake`), and so did the scripted chaser that judged the
battle fair. A fairness test passed by a driver with controls the
player does not have proved nothing about the player.

He chose the replacement: **a drift race.** Start side by side. The
highest score wins, with a bonus for being ahead at each checkpoint and
for crossing the line first. Sliding close to the rival in any position
pays extra.

## The design, decided

- **It is a race you win on points.** Both cars start level, side by
  side, and are released at GO. The score is the solo score (drift,
  clean sectors, pace) plus the race's bonuses. The higher total wins;
  a tie is the player's.
- **Being ahead pays.** At each checkpoint and each lap's line, the car
  that reaches it first banks a lead bonus. The first across the finish
  banks a larger one. The player always knows his place (1st or 2nd)
  and the gap.
- **Close pays, in any position.** While both cars are sliding and are
  close, ahead, behind or alongside, the player's drift points count
  more. It is a garnish, not the decider: with it at nothing a good
  run still wins.
- **The rival plays by the same rules and has the same hands.** He
  banks lead bonuses when he is first. He does not get the close
  bonus (his driving never reads the player's world, so he cannot seek
  it). And from this round **his driver gives only what a player's
  hands can give**: the throttle always on, no brake, DRIFT with or
  without steering. `createRival`'s `opts.hands` already forces this
  for a measurement (`game/test/stars/reach.js`); make it the rule, and
  make the driver plan with it rather than be overruled by it. His
  pace is then a pace the player's car can match by driving, not by
  lifting.
- **He is still his own world.** Stepped in lockstep, reading only his
  own world, the same every time, never moved by the player. His
  driving hash does not depend on the player; his total now does (the
  lead bonuses), and that is fine.
- **He is still solid**, and a hard touch still costs the chain. The
  player is never trapped behind him: keep the pin release, and prove
  it this time (measurement 4).
- **Kestrow first, and only Kestrow until he is right.** `TANDEM.LIVE`
  stays 1. The other five wait behind `?rivals=all` until each passes
  under the new rules.
- **A race is 60 to 120 s.** Set the laps per track so it is (First
  slide at two laps was 45 s).
- **Words.** It is a DRIFT RACE everywhere the player reads. No
  "tandem" in copy. The countdown's one line says how to win in the
  player's terms (outscore him; lead at the gates and the line for a
  bonus). Nothing on screen ever tells the player that being ahead is
  bad.
- **What is stored stays.** A `rivals` entry from the tandem rules
  keeps its `won` and `best`. No migration.

Every number (the lead bonuses, the finish bonus, the close zone and
bonus, the laps, the grid) is a first guess in a named block with a
one-line comment. Rename `TANDEM` only if it costs nothing stored;
otherwise keep the name and say what it now holds.

## What to build, in priority order

Finish each before starting the next. If you run short, stop and report
what is left.

1. **A rival with a player's hands.** Kestrow on First slide, driven
   through the same three controls as the player, clean and robust
   (the bar of `review/rivals/REPORT.md` measurement 2), sliding every
   corner. Search his driving again under the constraint. His finish
   time must sit inside the range a player can drive: see measurement
   3.
2. **The race rules.** The level grid; the lead bonus at checkpoints
   and lap lines and the finish bonus, for both cars; the close bonus
   in any position; the removal of the ahead rule and everything that
   tells the player to stay back. With no rival, score and physics are
   the same to the bit, as now.
3. **The race on screen.** Place and gap, readable without looking
   away from the cars; both totals; a pop when a lead bonus is banked
   by either car, coloured by who got it; the close bonus while it
   counts; the name tag and the off-screen arrow as they are. The
   countdown heading and line. The results: who won, both totals, what
   each part was worth for each car (drift, clean, pace, leads, line,
   close), REMATCH. The career card's words. All of it fits 844x390.
4. **The other five**, one at a time, each only if he passes.

## Keep

Everything in the Keep section of `briefs/RIVALS.md` still holds: every
existing run untouched to the bit; no retuning of the author's blocks,
star targets, coins, prices or thresholds; the save only gains; names
invented; every number of taste in a named block; `physics/vehicle.js`,
`physics/driver.js`, `audio/` and `assets/audio/` unchanged; Australian
spelling; no em or en dashes; no model names or session identifiers;
commit as `git -c user.name="SnapHit"
-c user.email="nathanhaslewood@gmail.com"` with no trailers.

Two career seeds changed on `main` on 11 November 2026 (Harbour run is
1248, Crossover is 1422; `was` in `CAREER`). Do not change career
seeds.

The probes: `tracks2.js`'s busyness known answer and `cars/render.js`
fail on `main`; report, do not fix. The long suites (`loop/probes.js`
about 45 minutes, `retention/probes.js` about 25) run detached with
`setsid nohup`; wait on the process; restore the review files they
rewrite with `git checkout`. Run probes from `crazygames/` with
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. Rework the probes in
`game/test/rivals/` for the new rules rather than leaving stale ones
passing.

## Not yours

- The rival reacting to the player (blocking, defending, chasing).
- Rivals on the daily, in the Lab or in free drift. More than six.
- Cosmetics, a rival's sound, leaderboards, multiplayer.

## Measure, each with a known answer that can fail

Every scripted player in these measurements uses **only the player's
controls**. A measurement that lifts or brakes is a defect.

1. **Nothing that exists has changed.** `main`'s tapes replay to the
   same hash and score; a race's tape replays to the same hashes and
   totals. Known answers as in the rivals round.
2. **The rival drives well, robustly, with a player's hands.** As the
   rivals round's measurement 2, plus: over his whole run the brake is
   never above nothing and the throttle never below full except in
   DRIFT with no steering. Known answer: the old Kestrow fails that.
3. **The race is a race.** Build three scripted players with the
   player's hands: one that drives the racing line and never slides,
   one that slides every corner, one that mixes. For Kestrow, in the
   starter with no upgrades, report for each: finish time against his,
   the share of the run spent ahead, lead bonuses won, both totals,
   who wins.
   - The place changes hands at least once in the mixed player's run,
     and no player is ahead or behind for all of every run: if one is,
     the rival's pace is wrong.
   - The mixed player wins. A player who never moves loses.
   - With the lead and line bonuses at nothing, report who wins; with
     the close bonus at nothing, the mixed player still wins.
   - Say plainly what a player who leads all the way but never slides
     gets, and what one who slides well but trails all the way gets.
     The author decides whether those are right; give him the numbers.
4. **Contact and passing.** The player runs into his tail, swipes his
   side, parks on his line, and follows directly behind him for a lap
   at a higher speed: boxes never overlap past the tolerance, a hard
   contact loses the chain, the player is never stuck for more than a
   second, and in the following case the player gets past. The rival's
   driving hash is the same with and without the player. Known answer:
   with the pin release off, the following case fails.
5. **Frame time.** As the rivals round's measurement 5.
6. **Layout.** Countdown, HUD, both results and the career card at
   390x844, 844x390, 800x450 and 1280x720, by bounding boxes.
7. **The camera.** Through the countdown's sweep the camera is inside
   neither car and both are in view at GO, side by side.
8. **The save.** A save from `main` (with a tandem `rivals` entry)
   loads with nothing repaired and nothing changed.
9. **Frames**, in `review/driftrace/shots/`: the grid, side by side
   mid slide, the player ahead, the player behind, a lead bonus
   banked, a contact, the finish, results won and lost, the career
   card; by day and at night, at 1280x720, 390x844 and 844x390. Look
   hard at every one.

## Deliver

Commits on `crazygames-driftrace`, pushed after every step. Never push
to `main`.

Finish with `review/driftrace/REPORT.md`: a phone-readable summary
first; the measurements with their known answers; the frames; what the
author should judge on his own devices; what is not done; every
deviation from this brief.

If anything in this brief turns out to be wrong, stop and say so rather
than working around it.
