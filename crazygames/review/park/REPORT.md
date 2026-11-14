# The playground: a stunt park with challenges (14 November 2026)

Brief: `briefs/PLAYGROUND.md`. Branch `crazygames-playground`. Probes in
`game/test/park/` (`run-all.sh`), results and shots here.

## What was built

- **Free drift is now a stunt park**, 300 by 200 m (3.64 times the old
  car park), walled, flat. From the start, facing north: a gate dead
  ahead, the donut pillar ahead to the left, the figure eight's two
  pillars ahead to the right, the cone line across the far side; a long
  curved orange wall in the west and a narrow gate in the south west.
  `shots/plan.png` is the park from above with the lines the scripted
  hands drive.
- **Eight challenges, three levels each, 24 levels, 7,500 coins in
  all**, each level paid once. No timer, no start button: the game
  counts as you drive ("DONUTS 3" with three pips, under the total),
  and a level is won the moment its count is reached: a notice, the
  readout turns to the level and its coins, fireworks, the star and
  coin sounds.
- **A list of the challenges**: from the title's button (now STUNT
  PARK, "free drift · 7 of 24") and from a button in the park's HUD
  (also L or Tab on a keyboard, the top face button on a gamepad).
  Opened from the park, the park waits exactly as it was.
- **Markers**: each place's name stands high on its own pillar, beam
  or pole as a band of letters in the place's colour, with paint on
  the ground (rings, loops, the cone line, the wall's lane, the gates'
  chevrons). A place whose gold is won is dimmed.
- A pillar between the camera and the car fades to 16 per cent in 0.07 s.
- The park's time of day moves on each visit (dusk, night, dawn). At
  night: lamps round the outside, pools of light on every place, the
  bands and paint lit.
- A first visit shows one line on what the park is, once.
- Knocked cones stand up again once the car is 45 m away.

Physics, cars and score rules are untouched (no file under `physics/`,
`scoring/`, `cars/`, `rivals/` or `tracks/` changed).

## The challenges, and what the scripted hands reached

The hands (`game/test/park/hands.js`) have a phone's controls only:
throttle always on, no brake, steering hard left, straight or hard
right, and the one button. Every drive starts from the park's own
start, through the real game. "Again" is the count made a second time
in Node from the recorded positions by a different method.

| Challenge | Bronze | Silver | Gold | Coins | Hands reached (judge / again) | Car |
|---|---|---|---|---|---|---|
| Donuts (turns in one slide) | 1 | 4 | 10 | 100, 250, 500 | 11 / 11 | starter |
| Figure eight (links in one chain) | 2 | 4 | 8 | 120, 300, 600 | 10 / 10 | starter |
| Slalom (cones, alternate sides) | 3 | 5 | 7 | 120, 300, 600 | 6 / 6; gold 7 / 7 | starter; gold: hatch fully upgraded |
| Wall ride (m beside the wall) | 20 | 60 | 140 | 100, 280, 570 | 229 / 232 | starter |
| Gate crasher (km/h, sideways) | 55 | 85 | 110 | 80, 220, 500 | 71 and 93; gold 127 (all equal again) | starter; gold: fastback fully upgraded |
| Long slide (m, unbroken) | 100 | 400 | 1,200 | 80, 200, 450 | 1,399 / 1,399 | starter |
| Big chain (points banked) | 400 | 2,500 | 10,000 | 80, 220, 450 | 20,843 / 20,843 | starter |
| Grand tour (places in one chain) | 2 | 4 | 6 | 150, 380, 850 | 6 / 6 | starter |

**All 24 levels were reached.** Bronze and silver of every challenge
in the plain starter. Gold in the plain starter for six; the slalom's
gold needed the hatch and the gate's gold the fastback, both fully
upgraded (the starter's best: 6 cones, 93 km/h). 0 wall contacts in
every drive, 0 inputs a phone could not make. The fastback's gate
drive knocked one cone on its way round (not at the gate).

## Measures

| # | Measure | Result | Known answer |
|---|---|---|---|
| 1 | The park (`park.js`) | PASS. 3.64 times the old area. A flood over every spot the car fits (2.63 m clear) reaches all 44 places asked and all 224,021 cells: nothing walled off. Driven on grip to six places, 0 contacts. 504 flat out drives at 84 points of the outer wall, two cars, three starts: 0.00 m outside, 0.00 m into a solid (top 209 km/h). Stuck recovery in 38 places: always on open ground, at least 0.76 m clear, and drives off. | A 14 m gap cut in the wall: the driver gets 14 m outside, CAUGHT. The flood does not enter a pillar. A recovery put inside a pillar, CAUGHT. |
| 2 | Sight (`sight.js`) | PASS. Tour, donuts, eight, gate, wall ride, landscape and portrait: the car hidden for 0 s in nine of ten laps, 0.117 s in one. Worst case made for each of 7 solids, 4 ways: 0.117 s (limit 0.333). | Fade off: up to 1.57 s, 28 of 28 over, CAUGHT. |
| 3 | Each challenge, each level (`challenges.js`) | PASS. Table above; judge and second count agree in all 11 drives. | A slide broken mid donut: the count falls 1 to 0, best 2 not 4. A wall touched: the ride's count is 0 on the next step. Cones knocked: the count is 0 after each knock. The guard counts 12 of 12 half steer inputs. A recording with a quarter cut out: 3 turns against 4, CAUGHT. |
| 4 | Paying (`paying.js`) | PASS. Bronze paid once (and only the levels won: 480 coins for donut bronze, slide bronze, chain bronze and silver); again after the title: 0; after a reload: 0. Gate at 93 km/h with bronze never won pays bronze and silver together (300); a bronze pass after: 0. | Storage cleared: the same drive pays 480 again. Bronze first then silver pays 80 then 220, not 300. |
| 5 | Saves (`saves.js`, Node, against `origin/main`'s `save.js`) | PASS. An old save loads unchanged, 0 repairs, nothing won. This build's save loads in main without throwing. Pay once at the save, lower levels with a higher. Unknown ids and levels repaired. Full storage: ghosts go, park levels and coins stay. `loop/quota.js` passes. | One coin taken, CAUGHT. A loader made to throw, CAUGHT. Wiped levels pay again. |
| 6 | Layout (`layout.js`) at 390x844, 844x390, 800x450, 1280x720 | PASS. List: no button under 44 px, nothing scrolls sideways, all 8 cards reachable, nothing cut off, DRIVE on screen. In the park: list button 84 by 44; over a donut drive the readout, welcome, button and notice are over the car on 0 of 2,400 frames at every size. | The readout moved over the car, CAUGHT at every size. |
| 7 | Nothing else changed | PASS, all ten: `ladder2/determinism.js`, `play13/check.js`, `play13/career.js`, `play14/check.js`, `ready/pad.js` (now with the park's list), `ready/keys.js`, `ready/sdk.js` after `npm run build`, `ladder/earning.js`, `garage/buy.js`, `garage/layout.js`. | their own |
| 8 | Frame cost (`perf.js`), low tier, night, 6x throttle, JS without submit | PASS. Park, mid slide round the donut pillar (sliding 270 of 270 frames): p95 5.7, 5.4, 5.5 ms; median 1.6, 1.3, 1.4. Career track 1: p95 7.5, 8.0, 5.3; median 1.5, 1.8, 1.3. Worst frames 10.6 to 20.1 (park) and 14.2 to 21.1 (career); frames over 16.7 ms: 0, 1, 1 and 1, 1, 0 of 270. 75 draw calls against 76, 131,429 triangles against 176,117. Quality still steps down to level 4 on both tiers. | 3 ms of busy work: median 1.4 to 4.4. 20 ms: p95 29.1, fails the budget. 900 frames at 60 fps step nothing. |
|   | The rest (`extras.js`) | PASS. Welcome once. List by touch, L, Tab, gamepad. Gold dims its place only. Cosmetics show. The adapter sees the park as play and the list as not. Cones stand up again. A drive changes only the save's park field and coins. | one each |

## Deviations from the brief, and decisions

1. **The long wall is curved**, not straight. A held slide carves a
   circle of 20 to 29 m, so beside a straight wall the hands managed
   14 m; round the inside of a curve a slide can follow it, tail to
   the wall, lap after lap (about 65 m a lap).
2. **Every solid is round and 4 m through.** The physics tests six
   points of the car against a wall's faces and pushes back a point up
   to 2.5 m behind a face, so a square corner could stand a metre
   inside the car, and a wall thinner than about 3.2 m would pull a
   car through. A thin wall or a square post cannot be built without
   touching the physics.
3. **The slalom is seven cones 30 m apart.** At 20 m the car could not
   change sides in time.
4. **The title's button opens the list, and DRIVE on it starts the
   park**: one more press to drive than before. The brief asks for the
   list from that button; say if it should drive at once instead.
5. **A level is won when its count is reached**, not when the slide
   ends (the chain's when it banks).
6. **Three challenges have no place of their own** (long slide, big
   chain, grand tour): they are park wide.
7. **Markers are bands of letters high on the solids**, not low signs.
   The cone line's is on a slim pole 16 m behind the line that is not
   solid (a car passes through it); the wall's two stand on its tips.
8. **Cones standing up again** is the host writing to the world, in
   free drift only (`restandCones`). The judge only reads.
9. `env/dressing.js` now builds the fireworks for a ground with no
   road; `game/test/ready/pad.js` has the new screen added.
10. The old 150 by 110 car park stays for `?ground=park`, which the
    feel probes drive.
11. The gate drives use a flick thrown at a set point (button and
    steering held 0.3 s, steering 1.2 s more): still a phone's inputs.
12. Headline on the title at 844x390 and 800x450 takes two lines, as
    DAILY DRIFT does there; one line at 390 and 1280.

## What failed or was cut

- Nothing in the brief's list was cut.
- The cone known answer is the weakest: driving down the cone line the
  hands knocked only 2 cones, and legitimately passed 3 others.
- A save from this build read and written back by main loses the park
  field, so every level could be won and paid again (a rollback only).

## Not measured

- A real GPU, a phone, a Chromebook: everything was drawn in software.
- Thumbs. A machine with a phone's inputs reaches gold on six
  challenges in the plain starter.
- The high tier's frame cost; a real controller (the probe feeds
  button states); the list by keyboard arrows (buttons take Tab focus
  as the browser gives it).
- The park in the rain (it is never chosen; `?preset=rain` draws it).

## For the author to judge by eye

- Whether three things to try are seen within five seconds
  (`shots/*-start-*.png`, `*-5s-*.png`). In portrait the gate fills
  the view and the two pillars sit at its edges.
- The targets and coins, all first guesses. Gold is patience more than
  car for donuts, wall, slide and chain (25 to 100 s of unbroken
  sliding); the slide and the chain are won by circling anywhere.
- Whether the curved wall reads as "the long wall", and whether its
  2.5 m lane is fair on a phone.
- The pillars' fade when one passes between camera and car.
- The bands' lettering at distance, and the park at night.
- The readout's place: under the total, and on a phone on its side at
  the left under the buttons.
- Whether the list first, then DRIVE, is one press too many.
