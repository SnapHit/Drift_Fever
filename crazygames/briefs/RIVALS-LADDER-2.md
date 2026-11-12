# Brief: the rest of the ladder (12 November 2026)

Branch `crazygames-ladder2`. Folders: `game/` and `review/ladder2/`.
Read `../CLAUDE.md` first (the Status section; its last entry is where
this round starts), then `briefs/RIVALS-LADDER.md` and
`review/ladder/REPORT.md`.

## Why

The rivals screen is live and the author is pleased with it. Two of six
rivals are in the game. His instruction, verbatim:

> I think what I'd like to do is have you finish off the remaining
> drivers, then test the entire experience end to end in an incognito
> browser so I can simulate the full experience of a new player.

So this round gets rivals three to six into the game, and builds the
test that plays the game as a new player would, from an empty browser.

The last round stopped at Varsk for a reason that is not his fault: on
every Pro circuit the scripted slide player is 14 to 17 s slower over
three laps than the grip and mixed players, so no rival pace gave all
three a race. The measuring players were tuned on First slide in the
starter and are a poor measure anywhere harder. Fix the measure first.

Two more things from review:
- **Tolvo is on a knife edge.** His corner entry speed was set by hand:
  26.2 passes, 26.0 and 26.3 fail. A rival whose driving breaks under a
  one per cent change of his own number will break on some device.
- **Tolvo is a cliff.** The scripted players beat Kestrow 27 times in
  60 and Tolvo 11 in 60. The second rival should be a step, not a wall.

## What to build, in priority order

Finish each before starting the next. If you run short, stop and report.

1. **Measuring players that are a fair measure on every track.** The
   three scripted players (grip, slide, mixed; `rivals/players.js`),
   each with only a player's hands, made good on the track they are
   measuring on: search each player's numbers per track and car, as the
   rivals' are searched. A measuring player must finish every one of
   20 disturbed solo runs with no respawn, and on any track the three
   must finish within a spread you set and justify (the slide player
   is slower, but not a quarter of a minute slower). Kestrow's numbers
   with the players as they are stay the record for Kestrow; report
   what the new players make of him beside them, and change nothing of
   his.
2. **Tolvo, made robust and a step.** Search him again for a plateau:
   every one of his driving numbers moved one per cent either way still
   passes measure 2. Aim his difficulty at the band in measure 3. He
   has not been played by the author, so his track, laps, car and
   driving may all change.
3. **Varsk, Dovane, Halvik, Sarrow, in that order,** each as the last
   brief's priority 3: his track in his half of his chapter, his
   driving searched with a player's hands for a plateau, his laps for a
   60 to 120 s race, measured, and only then `TANDEM.LIVE` raised. The
   chain rule holds: stop at the first who cannot be made to pass, and
   say what you tried. Two rivals share the fastback; give one another
   car if he can be made good in it.
4. **The new player test** (`game/test/ladder2/newplayer.js`): the game
   played from an empty browser profile by real input events only (taps
   at a phone's size, keys at a desktop's), never by calling into the
   game. See measurement 6.
5. **When all six are live**, the SOON state has no card left to show:
   make sure nothing on the title, the rivals screen or the results
   still speaks of rivals who are not in the game.

## Keep

Everything in the Keep sections of `briefs/RIVALS.md`,
`briefs/DRIFT-RACE.md` and `briefs/RIVALS-LADDER.md` holds. In short:
every existing run untouched to the bit; the author's blocks not
retuned; the save only gains; `physics/vehicle.js`, `physics/driver.js`,
`audio/`, `assets/audio/` and career seeds unchanged; Kestrow's driving
and laps, `TANDEM.LEAD_SHARE`, `LINE_SHARE` and the close bonus
unchanged; the rivals screen, the title and the offers as the author
approved them, apart from priority 5.

Every scripted player uses only a player's controls. Report worst cases
and counts, not medians. Do not lower a bar to pass.

The probes that fail on `main`, to report and not fix:
`ladder/rivals.js` (rivals three to six, until this round passes them),
`driftrace/racing.js`, `driftrace/contact.js`, `tracks2.js`,
`cars/render.js`, one low tier moment of `spectacle/night.js`. The long
suites run detached with `setsid nohup`; wait on the process; restore
other rounds' review files with `git checkout`, and take care not to
delete this round's own logs when you do. Run probes from `crazygames/`
with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.

Australian spelling; no em or en dashes; no model names or session
identifiers; commit as `git -c user.name="SnapHit"
-c user.email="nathanhaslewood@gmail.com"` with no trailers.

## Not yours

New race rules, a new rivals screen, gamepad menus, rivals outside the
career's tracks, more than six, cosmetics, sound, anything for the
garage round.

## Measure, each with a known answer that can fail

1. **Nothing that exists has changed.** `main`'s tapes and a Kestrow
   race's tape replay to the same hashes and totals.
2. **Each rival from Tolvo on drives well, robustly, on a plateau.**
   The ladder brief's measurement 2, plus the plateau: each driving
   number one per cent up and one per cent down, 5 disturbed runs each,
   none missing the bar. Known answer: the Tolvo on `main` fails the
   plateau.
3. **Each is a race, and the ladder is a staircase.** With this round's
   measuring players, 20 disturbed races each, in the car you name:
   - at least two of the three players win at least 3 of 20, none wins
     20 of 20, and none is ahead or behind all the way in every race;
   - **the band**: the three players' wins together, out of 60, fall
     from rival to rival and stay inside 27 for Kestrow sliding down to
     about 12 for Sarrow, each within 5 of the straight line between.
     Report the table for all six. Known answers: two rivals swapped
     fails; the Tolvo on `main` is outside his band.
   - a player who never moves loses to every rival.
4. **Earning, the screen's states, layout and the save**: the ladder
   round's measurements 4, 5 and 8 again with six live.
5. **Contact and frame time**: for each new rival, the ladder round's
   measurements 6 and 7. The parked player's hold is the game's own
   1.2 s stuck recovery; report it, it is not a failure of the rival.
6. **A new player, end to end, by real input only.** From an empty
   profile (no storage) at 390x844 with touch and again at 1280x720
   with keys, on the build as it ships (no test query, no call into the
   game except to read what happened):
   - the first visit lands in the onboarding run; its prompts appear;
     the run ends in results;
   - from there, by taps alone: the title, the career, a run of track
     one, its results, the offer of Kestrow when a star is won, the
     race, its results, the rivals screen and back;
   - a second visit (same profile) lands on the title with the progress
     kept;
   - every screen on the way: no page error, no console error, no
     request to another host, nothing overlapping, no button outside
     the view, nothing that scrolls the page on the title.
   The input may be scripted to drive well enough to finish (a player's
   controls only, sent as real pointer and key events). Report what a
   new player sees at each step with a frame of each, the time from
   load to the first playable frame, and anything that would confuse
   someone who has never seen the game. Known answer: with storage
   seeded as a returning player's, the first-visit check fails.
7. **Frames**, in `review/ladder2/shots/`: each new rival side by side
   with the player mid slide, by day and at night; the rivals screen
   with six live at each stage; the new player's journey step by step
   at 390x844.

## Deliver

Commits on `crazygames-ladder2`, pushed after every step. Never push to
`main`.

Finish with `review/ladder2/REPORT.md`: a phone-readable summary first;
the measurements with their known answers; the ladder table; the new
player's journey with what would confuse him; what the author should
judge on his own devices; what is not done; every deviation.

If anything in this brief turns out to be wrong, stop and say so rather
than working around it.
