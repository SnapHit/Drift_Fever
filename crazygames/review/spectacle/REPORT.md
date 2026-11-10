# Spectacle: report (10 November 2026)

Branch `crazygames-spectacle`, brief `briefs/SPECTACLE.md`. Presentation
only. Everything new is behind one switch: `?fx=0` is the game as it is
on `main`.

## In short, for a phone

- **The drift is a show.** Smoke billows out of the slide. It is warm
  in the low sun and red from the tail-lights at night, and it is
  thrown wide of the car so it never covers it. Red tail-light trails
  while sliding at dusk, at night and in the rain. Brake lights flare
  under DRIFT / BRAKE. The exhaust pops two to five flames when a slide
  ends. A wall hit flashes and throws a shower of bright sparks. Dark
  marks stay for the whole run. All of it climbs with the multiplier:
  from about x3 the rear tyres glow and shed embers, and at x4 and over
  the smoke is thicker and lasts longer and the trails are brighter.
- **Night is readable.** Career track 1, the first track every new
  player drives, is a night track. On `main` its road is black (0.4 to
  1.5 per cent luminance). Now every road has a row of lamps with warm
  pools of light baked onto the asphalt, flares on every lamp, and amber
  tape on the barriers that lights up as the headlights get near. The
  moon is brighter, the horizon has a city glow and the headlights
  reach further. In the rain the lamps and tail-lights show in the wet
  road and spray comes off the tyres. At dusk and dawn the sun is
  bigger with a halo, and there is a colour grade and a vignette.
- **The camera directs.** The countdown swings round the car from in
  front of it and lands on the chase camera well before GO. A big
  banked chain (x3 and over) kicks the view back and wider. A hard hit
  shakes harder. Crossing the line drops into slow motion while the
  camera swings side on, and it holds there behind the results.
  `TUNE.CAMERA` is untouched.
- **The score reacts.** The number by the car pops at each multiplier
  step, grows, and heats from cyan through green, yellow and orange to
  pink. A banked chain flies to the total, and the total pops as it
  lands. A lost chain breaks in two and falls. On the results the stars
  land one at a time and the coins count up, both in time with the
  sound cues that were already there. **The results card now fits
  844x390** in two columns, with GO AGAIN and NEXT on screen.
- **The world has life.** A painted start grid and a chequered line,
  more rubber on the racing line, camera flashes in the grandstands as
  the car slides past, flags that swing on the high tier, and fireworks
  over the finish when a star is won. Two banners carried a real place
  (NULLARBOR) and a plain word (SOUTHERLY). Both now carry invented
  names.
- **Quality adapts.** If at least half of the last 90 frames took more
  than 22 ms, the quality steps down one level: fewer particles, then
  no bloom, then 80 and then 65 per cent pixel ratio. It never steps
  back up. The low tier gets the whole show except the bloom and the
  swinging flags.
- **Measured and holding:**
  - Tapes replay to the same hash and score with the round on and with
    `?fx=0`.
  - Night passes its bar at every moment measured, on both tiers, and
    night on `main` fails it at every one.
  - Smoke hides at worst 5.0 per cent of the car's box.
  - The low tier's JavaScript p95 at 6x throttle is 4.4 to 5.3 ms
    (`main`: 2.6 to 4.5).
  - The layout is clean at all four sizes.
- **Not measurable here:** the GPU. The sandbox draws in software. The
  author has to judge the smoke's overdraw and the high tier's bloom
  on his phone and his Chromebook (list below).

Preview: https://drift-fever-crazygames.novlrgames.workers.dev/ (this
branch is not on it until it is merged; once it is, compare `/` with
`/?fx=0`).

## What was built

```
game/src/fx.js               the switch: ?fx=0 (the round off, the game as on main), ?fx=none (no particles, what ?fx=0 meant before)
game/src/env/show.js         SHOW: the heat, trails, brake lights and halos, the exhaust pop, hit flashes, tyre glow and embers; the smoke, spray and spark numbers
game/src/env/dressing.js     DRESS: the lamp row, pools of light, barrier tape, flares, wet reflections, start grid, crowd flashes, swinging flags, fireworks
game/src/camera/director.js  DIRECTOR: the countdown sweep, the bank kick, the hard hit shake, the slow motion and side on swing at the finish
game/src/env/particles.js    a colour per particle over its life, growth that slows, the car clearance; createGlows (camera facing quads placed every frame)
game/src/env/effects.js      the show's smoke (billowing, lit, thrown out of the slide), rain spray, brighter sparks, a density the adaptation sets
game/src/env/presets.js      PRESET_SHOW: what each preset becomes with the round on
game/src/env/sky.js          the sun's size and glow read from the preset; a halo round the disc
game/src/env/textures.js     the puff sprite; SPONSORS_SHOW (two invented names)
game/src/render/scene.js     wiring; LOOK.MARK_SHOW, RUBBER_SHOW, HEADLIGHT_SHOW, ADAPT; the high tier's grade; the adaptation
game/src/ui/hud.js           HUD_SHOW: the live number's pop, growth and heat, the bank's flight, the loss's break
game/src/ui/screens.js       the results card in two columns (side by side on a short landscape screen), the coin counter
game/src/main.js             the director, the slow motion after the line, the fireworks, the coin count, the frame clock for the adaptation
game/index.html              the CSS for all of the above, under body.fx
game/test/spectacle/         lib.js and one probe per measurement: determinism, night, smoke, perf, adapt, layout, shots
```

Every number of taste is in a named block with a one-line comment:
`SHOW`, `DRESS`, `DIRECTOR`, `HUD_SHOW` and `PRESET_SHOW`, plus new
entries in `LOOK` (`MARK_SHOW`, `RUBBER_SHOW`, `HEADLIGHT_SHOW`,
`ADAPT`). Nothing in `TUNE` or `LOOP` changed. Nothing under
`physics/`, `tracks/generate.js`, `loop/save.js`, `scoring/`, `audio/`
or `assets/audio/` changed.

Initial download: 2.32 MB over 71 files (`main`: 2.25 MB over 67). The
game makes no requests, and the fonts are the system's.

## Measurements, each with its known answer

All of these ran in headless Chromium on SwiftShader (forced WebGL 2),
through the game's own frame function at a synthetic 60 Hz. `runs/`
holds the log of the last run of each, and the JSON files beside this
report hold the numbers.

### 1. Determinism (`determinism.json`)

`node game/test/spectacle/determinism.js`. Career 1 and the longest
Legend track (The vice, 2,508 m over three laps). The scripted drifter
drives live runs through the game's frame function with everything new
running: the effects, the show, the dressing, the director with its
slow motion, and the adaptation. Every 30th frame is drawn.

| | career 1 | The vice |
|---|---|---|
| live run, round on: score, steps | 895, 8,396 | 1,678, 15,062 |
| its tape replayed, round on: hash, score | same, 895 | same, 1,678 |
| its tape replayed, `?fx=0`: hash, score | same, 895 | same, 1,678 |
| live run, `?fx=0`: score, steps, hash | 895, 8,396, same | 1,678, 15,062, same |
| inputs identical up to the line (step) | yes (8,356) | yes (15,022) |

The slow motion after the line takes the same physics steps. They are
only drawn over more frames.

Known answer: the tape with one steering entry in the middle turned the
other way replays to a different hash on both tracks. CAUGHT.

### 2. Night reads (`night.json`, `shots/night-*.png`)

`node game/test/spectacle/night.js`. Career 1 (night, docks) and
career 3, four moments each at speed. Each moment is drawn at dusk and
at night from the same pose, at 1280x720, on both tiers, with the round
on and with `?fx=0`. At 20, 40 and 80 m ahead the probe reads two
points: the edge line (the brightest pixel within two of its projected
point) and the asphalt 2.6 m inside it.

The bar was set before measuring. Against dusk at the same moment and
tier, at every distance:
- the road's luminance at night is at least 0.6 of dusk's (a black
  road shows no marks, no rubber, no grid and no shape);
- the edge is at least 1.35 times the road (the visuals probe's
  margin);
- the edge is at least 0.6 of dusk's.

| | moments passing | night road over dusk road, median, 20 / 40 m |
|---|---|---|
| low tier, round on | 8 of 8 | 2.55 / 3.65 |
| high tier, round on | 8 of 8 | 1.91 / 2.63 |
| low tier, `?fx=0` (main) | 0 of 8 | 0.14 / 0.09 |
| high tier, `?fx=0` (main) | 0 of 8 | 0.15 / 0.08 |

The edge line is 0.89 to 0.95 luminance at night with the round on (on
`main` 0.82 to 0.84; at dusk 0.85 to 0.87), and edge over road is never
under 1.35. At 80 m the edge is hidden by a crest, a bend or a barrier
at 3 of the 8 moments on each tier. The other 5 pass at 80 m too.

Known answer: night with `?fx=0` (main) fails the bar at every moment,
on both tiers. Its road is 0.2 to 1.5 per cent luminance, against 5 to
7 at dusk. CAUGHT.

The first run of this probe failed with the round on, and the bar
caught it. The pools of light were set in the wrong units and washed
the road nearly white (0.6 to 0.9), so the edge no longer stood out.
They are now set in linear light, about seven times dimmer, and the
asphalt gives back a little baked moonlight between the pools.

### 3. The car reads through its smoke (`smoke.json`, `shots/smoke-*.png`)

`node game/test/spectacle/smoke.js`. Career 1, a slide with the chain
held at x5 (the most smoke the show makes), eight frames five apart, on
both tiers, at 1280x720 and 390x844. Each frame is drawn three times:
as it is, with the smoke hidden, and with the car hidden too. A pixel
counts as hidden when the smoke changed it by more than 40 of 255 in
any channel. The share is reported of the car's screen box, as the
brief asks, and of the car's own pixels, because a box round a car at
40 degrees is half road.

The bar was set before measuring: at most 12 per cent in the worst
frame and 5 per cent as the median, for both shares.

| | box: worst, median | car itself: worst, median |
|---|---|---|
| low 1280x720 | 4.6, 2.9 | 3.4, 0.2 |
| low 390x844 | 2.6, 1.0 | 0.8, 0.0 |
| high 1280x720 | 5.0, 1.0 | 1.1, 0.0 |
| high 390x844 | 1.7, 0.7 | 0.1, 0.0 |

Known answer: without its clearance and at twice the thickness, the
smoke hides 38 per cent of the box (49 of the car itself). CAUGHT.

The first runs failed (11 to 15 per cent). Thinning the smoke along the
camera's whole line to the car fixed the number but erased the smoke
behind the car. The shipped clearance thins a puff only as far as it
covers the car on the screen, and the smoke is thrown out of the slide,
so it billows beside the car's path.

### 4. Frame time (`perf.json`)

`node game/test/spectacle/perf.js`. Measured the way the visuals probe
measures it: 390x844, the scripted drifter, 300 frames with the first 30
left out, 6x CPU throttle through CDP, and "JS without submit" (the
frame less `renderer.render`, which on SwiftShader is the whole
rasterisation). The chain is held at x5 so the show is at its heaviest.
Career 1 is a night track at the docks, and The vice is rain on the
coast.

| | JS p95, ms (main) | draw calls (main) | triangles (main) |
|---|---|---|---|
| low, career 1 | 4.4 (4.5) | 76 (65) | 176,117 (163,609) |
| low, The vice | 4.6 (2.6) | 72 (63) | 198,707 (192,919) |
| low, career 1 again | 5.3 (3.0) | 76 (65) | 176,117 (163,609) |
| high, career 1 | 6.2 (4.4) | 78 (67) | 452,163 (427,839) |
| high, career 1 again | 6.5 (3.7) | 78 (67) | 452,175 (427,839) |

"Again" is the same configuration measured a second time, to show the
noise: the same low tier run read 4.4 and 5.3 ms. An earlier run of this
probe read 5.4 to 6.3 ms for the low tier. The worst frames, up to
98 ms, are single SwiftShader stalls, as in earlier reports.

Bar: the low tier's p95 under 16.7 ms with the round on. PASS, worst
5.3 ms. Known answer: 20 ms of busy work per frame gives a p95 of
26.6 ms. CAUGHT.

The round adds:
- up to about 2 ms of JavaScript p95 at 6x (the particles are built on
  the CPU, plus the glows and the ribbons);
- 9 to 11 draw calls (new ones: glows, trails, lamp posts and their
  heads, pools, tape, grid, sun halo; smoke, sparks and flame were
  already pools);
- 6,000 to 24,000 triangles (the lamp posts).

### What costs the GPU, for the author to judge on his devices

The sandbox cannot measure this. In order of likely cost:

1. **Smoke overdraw.** Up to 110 soft blended quads on the low tier
   (260 on the high), each growing to 3 or 4 m. The worst case is a
   long slide at x4 with the camera behind it. Nothing within 1.2 m of
   the camera is drawn, and smoke fades in by 4 m. If it is slow, the
   first knob is `SHOW.SMOKE.POOL.low`, then `SHOW.SMOKE.RATE`.
2. **The high tier's post pass**: bloom (12 taps) and the grade, over
   the full screen. The adaptation turns it off at its second step.
3. **Pools of light** at night and in the rain: additive quads on the
   road, 12 to 18 m across, one per lamp and tower, with overdraw where
   they overlap. `DRESS.LAMP_EVERY` spaces them out.
4. **Glows**: up to 160 small additive quads (flares, halos, crowd
   flashes, wet reflections).
5. **The headlight**: the spot light now reaches 110 m (70 on `main`)
   and lights every surface in its cone, at night and in the rain.
6. **The low tier's vignette**: a full screen CSS gradient over the
   canvas.
7. Small: the trails (two ribbons, at most 70 quads), the tape, the
   grid, the marks (more of them, but only the new quad is uploaded),
   and the fireworks (only behind the results).

### 5. Adaptation (`adapt.json`)

`node game/test/spectacle/adapt.js`. The probe feeds the game's frame
function the clock a browser would give it.

- 1,200 frames at 25 fps step the quality down to level 4: in three
  steps on the low tier (it has no bloom to drop) and four on the high
  tier. Density goes to 0.55, the pixel ratio from 1 to 0.65, and the
  bloom turns off on the high tier. PASS.
- 900 fast frames afterwards do not step it back up. PASS.
- One slow frame in six for 1,500 frames is a hitch and leaves it at
  level 0. PASS.
- With `?fx=0` nothing adapts. PASS.
- Known answer: 900 frames at 60 fps leave it at level 0 on both
  tiers. CAUGHT.

### 6. Layout (`layout.json`, `shots/layout-*.png`)

`node game/test/spectacle/layout.js`. At 390x844, 844x390, 800x450 and
1280x720.

- **The HUD**, mid slide at x5 (where the live number is biggest) and
  while a banked chain flies to the total: every element is inside the
  view. The total, the readout, the lap and clock, the three buttons
  and the touch pads do not overlap each other. Neither the live number
  nor the flying number overlaps any button or pad. PASS at all four
  sizes.
- **The results card** of a career run with NEXT fits the view with no
  scrolling and no overlapping parts:

| size | card, top to bottom | GO AGAIN bottom | NEXT bottom |
|---|---|---|---|
| 390x844 | 65 to 622 | 530 | 602 |
| 844x390 | 55 to 334 | 227 | 295 |
| 800x450 | 85 to 364 | 257 | 325 |
| 1280x720 | 57 to 640 | 548 | 620 |

Known answer: the card with `?fx=0` (main) at 844x390 ends at 501 px of
390, NEXT at 489, and the screen scrolls. CAUGHT.

This measure turned up two problems. One was in the game: the card's
border and padding overflowed a 390 px screen by 2 px each side. That
also happens on `main`, and it is fixed with the round on. The other was
in the probe's first version, which measured the total's full width
block instead of its text.

### 7. Before and after (`pairs/`)

`node game/test/spectacle/shots.js` made 80 pairs, with `main (?fx=0)`
on the left and this branch on the right. They cover both tiers, all
four presets, and 1280x720 and 390x844. The files are named
`TIER-SIZE-PRESET-MOMENT.jpg`. The moments are:
- `countdown`: the sweep's first second;
- `slide`: mid slide, with the chain held at x5;
- `hit`: steered into the barrier;
- `finish`: 14 frames after the line, as the slow motion and the swing
  begin;
- `results`: the card, after the stars have landed, with the fireworks
  behind.

Six full size pairs are in `pairs/full/`. Both sides of each pair come
from the same run. Only the particles differ pixel for pixel, because
they are random.

`?fx=0` was also checked against `main` itself. A countdown frame drawn
from a worktree of `main` and one drawn from this branch with `?fx=0`
are identical: 0 of 921,600 pixels differ. With the round on, 98.8 per
cent differ.

In the `finish` pairs the whole run's callouts stack up over the
picture, on both sides. That is the probe, not the game: it reaches the
line by a tape replay that draws no frames, so the HUD then shows the
run's last callouts all at once. A player never sees this.

### 8. Every probe in `game/test/`

RESULTS_PROBES

## What the author should judge on his own devices

- **Frame rate** on the phone and the Chromebook, at night (career 1 is
  a night track), mid slide at x4 and over. The smoke and the pools are
  the risks. Does the adaptation step in? The only visible signs are
  softer pixels and fewer puffs. If it steps in on a device that was
  smooth, `LOOK.ADAPT.SLOW_MS` is the knob.
- **The smoke**: is it enough, or too little now that it keeps off the
  car? The knobs are in `SHOW.SMOKE` (`RATE`, `ALPHA`, `THROW`,
  `CLEAR`).
- **The countdown sweep**: does it show off the car, and does it ever
  pass through a grandstand or a barrier? It stays over the road by
  design, but it was only looked at on career 1.
- **The slow motion at the line**: about a second (it was 0.35 s). Is
  that a beat or a wait? `DIRECTOR.SLOW`.
- **Night**: are the lamps and pools too much, or too yellow? `DRESS`.
- **The score**: do the heat colours of the number (pink at x5) work,
  and can the bank's flight to the total be followed?
- **Real WebGPU**: none of this has run on it, only on the forced
  WebGL 2 path.

## Not done

- **The skyline's windows.** At night the horizon glows and the signs
  and gantries are lit as before, but the city skyline is still a
  silhouette, with no lit windows.
- **The low tier's sparks** were judged by eye only. The low tier has no
  bloom, so their glow comes from the sprite and the hit flash.
- **Rain reflections of the car's headlights** in the road ahead. The
  lamps and the tail-lights do show in the wet road.
- **Sight lines past the new lamp row.** `game/test/visuals/occlusion.js`
  only places the scenery from `env/scenery.js`, so it does not see the
  new lamps. They stand where the docks' own lamps do (4.5 m behind the
  barrier), but nobody has measured their sight lines.

## Deviations from the brief

- **`?fx=0` changed meaning.** It already existed on `main`, where it
  turned the particles off. The brief makes it "the game as on main",
  so the old meaning moved to `?fx=none`.
- **Slow motion begins at the line.** It runs during the 0.35 s the game
  already spends between the line and the results
  (`LOOP.FINISH_SETTLE`). The race is decided and the score settled at
  the line (the open chain is banked there), so I read "after the run
  has ended" as "after the line". The steps are the same, but the settle
  now lasts about 1.2 s of wall time instead of 0.35 s.
- **The results card fix is part of the round.** With `?fx=0` the card
  still scrolls at 844x390, as it does on `main`.
- **The night bar is mine.** The brief asks for one to be set. It is:
  the road at least 0.6 of dusk's, the edge at least 1.35 times the road
  and at least 0.6 of dusk's, at 20, 40 and 80 m.
- **The smoke measure covers two shares.** It reports the car's box, as
  asked, and the car's own pixels, with the same bar on both.
- **`app.results` has a new field**, `finished: true`, set with the
  round on or off. The director reads it.
