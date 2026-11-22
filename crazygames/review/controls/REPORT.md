# Round 1B: real controls on a keyboard and a gamepad

Brief: `briefs/PRO-CONTROLS.md`. Branch `crazygames-controls`, head
126097f. Everything is behind the address: `?controls=pro` (or `?pro=a`,
`b`, `c`, which also picks the variant). Without it the game is exactly
main's, measured to the bit. Touch is always Easy.

## What each key and trigger does

| Input | Pro | Easy (as before) |
| --- | --- | --- |
| W or Up | throttle, ramps to full in 0.25 s | DRIFT / BRAKE |
| S or Down | brake (full in 0.15 s); held at a standstill, reverse | DRIFT / BRAKE |
| A D or Left Right | steer | steer |
| Space or Shift | handbrake | DRIFT / BRAKE |
| R | restart | restart |
| Pad right trigger | throttle, analogue (half is half) | DRIFT |
| Pad left trigger | brake, then reverse, analogue | DRIFT |
| Pad stick or d-pad | steer | steer |
| Pad A or X | handbrake | DRIFT |
| Pad B | nothing in a run (back in menus) | DRIFT |
| Pad Y or start | restart | restart |

Letters go by where the key sits, so ZQSD drives on AZERTY, and the
prompts and the hint print what that keyboard prints. The throttle lets
go in 0.12 s and the brake in 0.08 s; the ramps are counted in physics
steps (`TUNE.CONTROLS`). Pad triggers are not ramped. On Pro the car
does not drive itself: nothing moves until the throttle. Menus by pad
are as before. The title gets one toggle, CONTROLS PRO / EASY, shown
only with the switch on and not on touch, remembered on the device
under its own key (`driftfever.cg.controls`), never in the save.

## How Pro handles

The throttle sets the slide, countersteer catches it. In a drift the
existing drift controller now holds the angle the throttle asks for,
less what countersteer takes off, instead of the angle the steering
asks for; the throttle also takes rear grip in a slide, so lifting gives
it back. Full throttle with no countersteer asks for more than 90
degrees: a spin. Too much countersteer, or lifting, straightens it.
Steering into the slide adds angle only with the throttle on.

## The three variants (starter coupe, 20 m/s handbrake entry)

| | a Helped | b Balanced | c Raw |
| --- | --- | --- | --- |
| Hold (Easy is 40) | 30 | 18 | 10 |
| Angle law, deg (base, full throttle, countersteer) | -5, 100, 70 | -10, 100, 65 | -10, 100, 65 |
| Rear grip in a drift, lifted / full throttle | 0.6 / 0.3 | 0.9 / 0.35 | 0.9 / 0.4 |
| Spin control and angle limiter | lighter than Easy | none | none |
| Grip help on the road | as Easy | countersteer 0.3, traction 1.2 | countersteer 0.15, rear grip x0.9 |
| Angle at half countersteer, throttle 0.7 / 0.85 / full | 18 / 33 / 46 | 19 / 32 / 48 | 26 / 35 / 51 |
| W held with full countersteer (the keyboard's hold) | 23 | 27 | 34 |
| Full throttle, no countersteer: spins after | 2.6 s | 1.5 s | 1.1 s |
| The same, steering held into the slide | 2.0 s | 1.4 s | 1.0 s |
| Lifting closes the slide in | 0.3 to 0.7 s | 0.3 to 0.7 s | 0.6 to 0.8 s |
| Too much countersteer | straightens | straightens | flips into the other slide |

Numbers in `PROFILES` in `tune.js`; full tables in `slide.json`. Easy,
same inputs: countersteer ends the slide at every throttle, nothing
spins. Slides much past 50 degrees scrub to a pivot in this model, so
each law keeps countersteered slides under about 50 and spins only with
none.

On the five cars plain and fully upgraded (Node, same trials): 25 of 30
pass measures 3 and 4. Four misses are fully upgraded cars whose slide
straightens at half countersteer and 0.7 throttle (hatch on c, fastback
on b and c, drift build on c); the fifth, the upgraded hatch on a, does
not spin with the wheel let go. W plus full countersteer holds under 15
degrees or straightens in 12 of the 30 (upgraded cars, the light hatch):
those need part countersteer, by tapping. Balance per car is round 2's.

## Measures (each with a known answer that can fail)

All in `game/test/controls/`, results in this folder.

1. **Easy unchanged** (`easy.js`): main from git and this branch in one
   browser, the two recorded tapes, the Kestrow race tape and two live
   runs, for no switch, the switch with the toggle on Easy, and the
   switch on touch: all the same to the bit. On Pro, Kestrow's own run is
   the same to the bit (tape and live race). Known answer: Easy's
   `DRIFT_HOLD` moved 1% disagrees on 5 of 5. CAUGHT.
2. **Keys** (`keys.js`): W full in 30 steps (set 30), back in 14; S brakes
   25 to 11 m/s in 0.5 s and reverses at -9.8 m/s; space locks the rear
   (handbrake 1, rear wheel still); AZERTY by position, arrows, shift,
   caps; the toggle makes W DRIFT again. Known answer: throttle key
   unbound fails. CAUGHT.
3. **The throttle steers the slide** (`slide.js`): table above. Known
   answer: Easy shows no rise. CAUGHT.
4. **A slide can be lost** (`slide.js`): every variant spins inside 3 s,
   Easy never. Known answer: c with Easy's anti-spin numbers is
   unspinnable. CAUGHT.
5. **Ghosts** (`ghosts.js`): a Pro run's best keeps its own ghost
   (`pro:career:0`) with controls, variant and rev; it replays to its
   run's hash, to another as Easy, and survives a reload; Pro races
   Pro's ghost, Easy Easy's (Pro falls back to the Easy one); main's
   saved ghost replays the same on main and here. Known answer: profile
   dropped, the replay misses and the slot refuses it. CAUGHT.
6. **Gamepad** (`pad.js`): half RT is 0.5 in the record, the physics and
   the tape; LT brakes and reverses; stick past its dead zone, d-pad, A
   and X, Y and start; Easy's pad as before; Pro's title by d-pad,
   toggle included. Known answer: triggers swapped. CAUGHT.
7. **Words** (`words.js`): 390x844, 844x390, 800x450, 1280x720, for Pro
   keys, Pro pad, Easy keys, no switch and touch: hint true to the input,
   toggle exactly where it belongs, every title button and SKIP 44 px
   and inside, every prompt the right one and inside. Known answer: the
   old "drives itself" line as Pro's hint. CAUGHT.
8. **Nothing else changed**: `easy.js` (rerun), `play15/check.js`,
   `bench/check.js`, `ready/keys.js`, `ready/pad.js`, `ready/sizes.js`
   all pass. `start/check.js` stops on its park screenshot's 30 s
   timeout, on this branch and identically on main's own copy in this
   browser (software drawing, with another session's probes running);
   with that one timeout raised (not committed) it passes in full on
   both, line for line the same. Other rounds' review files restored
   with `git checkout`.

**Driven by keys on three career tracks** (`career.js`, `driver.js`): a
careful scripted player pressing real keys, 60 times a second, through
the game's own input, on First slide, Harbour run and Crossover in the
starter, each to the finish. Its numbers were searched per variant in
Node.

| | First slide | Harbour run | Crossover |
| --- | --- | --- | --- |
| a: sliding / slides held 1.5 s+ / hard hits | 20 s / 6 / 0 | 9 s / 2 / 0 | 66 s / 18 / 1 |
| b | 35 s / 12 / 1 | 10 s / 2 / 0 | 60 s / 16 / 3 |
| c | 23 s / 7 / 2 | 9 s / 2 / 0 | 52 s / 17 / 0 |
| Same keys on Easy's handling | 2 to 3 s / 0 | 1 to 2 s / 0 | 5 to 9 s / 0 |

No spins, no respawns, every run finished. Known answer: Easy's handling
falls short. CAUGHT. Scores on First slide: 1,382 to 1,736 (Easy's
scripted drifter 895).

## Changes to vehicle.js, and why

Profile numbers alone could not do it: in a drift the controller held
the angle the steering asked for, so the throttle had no authority
(measured: angle flat with throttle, countersteer ended the slide).
Raw physics gave a cliff between straightening and spinning, and strong
automatic countersteer made the player steer into the slide again.
Two terms, both reading `TUNE.ASSIST` numbers that are 0, inside `if`s
that never run on Easy:

- **The Pro angle law**, in the drift controller's target:
  `POWER_BASE + throttle x (POWER_ANGLE + POWER_STEER x into) -
  POWER_STEER x counter^POWER_CURVE`, from the slewed steering, so a
  tapped key is part countersteer.
- **Power oversteer**: in a drift the throttle takes `POWER_SLIDE` of
  the rear's grip.

## Deviations from the brief

- Measures 3 and 4 run on the stunt park's ground with its pillars and
  walls removed: the trials travel up to 137 by 171 m. Same physics,
  same handling object the game builds.
- "Past 90 degrees" is read as the signed angle between nose and
  travel; the physics' own slip angle folds back at 90.
- Measure 3's throttle levels are 0.7, 0.85 and full, at half
  countersteer, where slides are held.
- A slide slower than 8 m/s counts as a pivot, not a held slide.
- The hint is hidden in short landscape frames (844x390, 800x450, so
  CrazyGames' smallest frame), as it always was: that is
  `game/index.html`, outside this round. Pro keys show there only in the
  first run's prompts and HOW TO PLAY.
- A save already onboarded (the author's) never sees Pro's prompts
  unless HOW TO PLAY is pressed.
- GO AGAIN still reads "DRIFT / BRAKE, Enter or R"; space still does it.
- Added: a Pro run with no Pro best races the Easy ghost (as Easy).
- `?pro=x` alone turns Pro on; `?controls=pro` alone is variant a, the
  first, not a pick. The bench is always Easy.
- The careful driver's numbers differ per variant (searched).
- Not done: tuning per car, rival balance on Pro, a mid-run switch from
  keys to touch (it keeps the run's handling with Easy's hands).

## Play guide

After the merge, on the preview or driftfever.com, on a keyboard:

- https://drift-fever-crazygames.novlrgames.workers.dev/?controls=pro&pro=a
- the same with `&pro=b`, then `&pro=c`
- Easy to compare: the title's CONTROLS toggle, or no switch.

On each:

1. **Stunt park first.** Hold W, tap space while steering to throw the
   tail out, then hold W and steer against the slide. Let go of the
   countersteer at full throttle and it spins (slowest on a); lift and
   it straightens. Tap W and the countersteer to hold the angle you want.
2. **Career track 1.** Slide all three corners.
3. **A rival**, Kestrow. Rivals are unchanged; balance on Pro is round 2.

HOW TO PLAY shows Pro's prompts. A gamepad works the same with the
triggers.

**The one question: which variant, or what is wrong with all three?**
