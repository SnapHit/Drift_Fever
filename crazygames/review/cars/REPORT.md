# The five cars as models: report

Branch `crazygames-cars`, DESIGN.md build step 3 (in parallel), brief
`briefs/CARS.md`. Every number below was measured by the probes in
`game/test/cars/`; the JSON beside this file is what they wrote.

## Summary

- Five original low poly cars, built procedurally in three.js code:
  no models, no textures, no images. Each body is a loft of nine point
  cross-sections along the car, flat shaded, with real wheel wells,
  glass, lamps, trim and a few bolt-ons; each car is a file of about
  2 KB of numbers. Nothing in them is drawn from or named after a real
  car.
  1. **Starter coupe** (`starter`), cyan: compact, balanced. Built to the
     physics exactly: wheelbase 2.55, track 1.60, wheel radius 0.33,
     body 4.40 by 1.83 m inside the 4.40 by 1.84 m collision box, on its
     centre.
  2. **Light hatch** (`hatch`), yellow: 3.72 m on a 2.32 m wheelbase, the
     shortest, upright, roof spoiler, mud flaps, white wheels.
  3. **Grand tourer** (`tourer`), deep red: 4.84 m on 2.86 m, the longest,
     with the lowest roof of the road cars, cabin set back, full width
     lamp bar, quad exhausts.
  4. **Fastback** (`fastback`), orange red: long flat bonnet with a
     bulge, sloping deck to a ducktail, rear hips 100 mm wider than the
     front, rear tyres 60 mm wider than the fronts.
  5. **Drift build** (`driftbuild`), pink: roof 1.11 m, box flares,
     splitter, canards, skirts, diffuser, bronze deep dish wheels and a
     big wing on uprights with end plates.
- `createCar(THREE, id, options)` in `game/src/cars/index.js` meets the
  contract (below); `CARS` lists the five in order.
- Every car is 1,988 to 2,468 triangles, 9 draw calls, 5 materials. All
  five plus the builder are 37,571 bytes (14,707 gzipped), against
  100 KB.
- Every car passes 22 of 22 geometry checks: class ranges, wheels on the
  ground (worst 0 mm at rest, never below over a whole turn), nothing
  else below 50 mm, no body inside a tyre straight or at full lock, the
  tyres inside the body's width, facing -Z, the origin where the
  contract puts it, every part closed and outwards. 19 of 19 known
  answers caught, including the brief's own (wheels moved up must fail
  the ground check: caught; and moved down: caught).
- The renderer agrees: three.js reports exactly the geometry's triangles
  and draw calls for every car, underglow off and on.
- **Not met: my own "readable at 30 m" threshold, straight from
  behind.** In a 35 degree slide every pair of cars differs by at least
  15 per cent of their silhouette (closest 0.152). Straight from behind,
  three pairs are under it (starter and fastback 0.116, tourer and drift
  build 0.132, fastback and drift build 0.142). At 30 m on a phone at
  the low tier a car is 30 to 38 pixels wide, and straight from behind
  every car is a car shaped box; I stopped tuning rather than turn the
  shapes into caricatures. Each car's own paint separates them easily,
  but paint is a cosmetic the player can change. See measurement 3.
- **A renderer anomaly, found taking the shots, not resolved:** on the
  WebGL 2 fallback in SwiftShader, after a frame with the car drawn
  sliding from the chase camera, the starter's near rear wheel vanishes
  from later frames on the same page, although its draw call is still
  issued. `game/test/cars/vanish.js` reproduces it every time. Whether a
  real GPU does the same is unknown. See below.

## The contract

`createCar(THREE, id, options)` returns

```
{ id, group, body, wheels: { fl, fr, rl, rr }, lights, underglow,
  setPaint(colour), setUnderglow(colour or null), dims, dispose() }
```

- Units metres, Y up, facing -Z, origin on the ground at the middle of
  the wheelbase (measured: 0 mm off in x and z for all five).
- `group` is what the game adds to the scene and moves; `body` is the
  main mesh (paint, glass and trim as three material groups).
- **Each wheel is `{ pivot, mesh }`**, as the feel prototype's scene
  uses: steer `pivot.rotation.y`, spin `mesh.rotation.x`. The pivot sits
  at the axle at wheel radius height, so a wheel spun to any angle stays
  on the ground (measured over 360 steps).
- `lights.head` and `lights.tail` are meshes with their own emissive
  materials; `lights.set(head, tail)` takes 0 (off) to 1 (on).
- `setPaint(0xRRGGBB)`, `setUnderglow(0xRRGGBB or null)`. The underglow
  is a 10 triangle additive quad ring just above the ground, off by
  default, one extra draw call when on.
- `dims`: `length`, `width`, `height` measured from what is drawn (the
  underglow excluded), `halfLength`, `halfWidth`, `centreZ` (the drawn
  box's middle from the origin; the starter's is -0.025, the physics'
  centre of mass), `wheelbase`, `track`, `wheelRadius`, `tyreFront`,
  `tyreRear`, `frontAxle`, `rearAxle`.
- `options`: `paint`, `underglow` (both 0xRRGGBB, optional).

## What was built

```
game/src/cars/index.js        createCar, CARS, carSpec
game/src/cars/build.js        the builder: the loft, the arches, lamps, trim, extras, wheels, underglow
game/src/cars/starter.js      the five, as numbers
game/src/cars/hatch.js
game/src/cars/tourer.js
game/src/cars/fastback.js
game/src/cars/driftbuild.js
game/lab/cars.html            the turntable
game/test/cars/lib.js         opens the lab in headless Chromium
game/test/cars/measure.js     measurements 1 and 2, no browser
game/test/cars/render.js      the renderer's counts, the fetched code, the 30 m silhouettes, the shots
game/test/cars/vanish.js      the renderer anomaly
```

`game/lab/cars.html` is the turntable: the five under the game's own
lights and colours (`LOOK` in `render/scene.js`), a button per car and
one for all five, paint and underglow swatches plus a colour picker,
views (turntable, chase, 30 m, three quarter), lights on and off, drag
to turn, and a table of each car's triangles, draw calls and size,
measured by rendering each car alone. It is laid out for a phone
(`shots/lab-phone.png`, 390 by 844). Being under `game/` it ships at
`/lab/cars.html` on the preview and counts in the build's initial
download figure (a 14 KB page; the car code it loads is the code the
game will load).

## Measurements

Run with `node game/test/cars/measure.js` (about 2 s) and
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node game/test/cars/render.js`
(about 70 s). The renderer probe runs on the forced WebGL 2 path in
headless Chromium with SwiftShader: the sandbox has no GPU.

### 1. Triangles, draw calls and code size

| Car | Triangles | Draw calls | Materials | With underglow | Spec file | gzip |
|---|---|---|---|---|---|---|
| starter | 1,988 | 9 | 5 | 1,998 / 10 | 1,935 B | 986 B |
| hatch | 2,036 | 9 | 5 | 2,046 / 10 | 1,651 B | 869 B |
| tourer | 2,468 | 9 | 5 | 2,478 / 10 | 1,651 B | 871 B |
| fastback | 2,084 | 9 | 5 | 2,094 / 10 | 1,752 B | 896 B |
| driftbuild | 2,300 | 9 | 5 | 2,310 / 10 | 2,174 B | 1,029 B |

The 9 calls are the body's three groups, the headlights, the tail
lights and four wheels. The five materials are paint, glass, trim
(vertex coloured: everything dark or metal, and the tyres and rims),
headlight and tail light. The builder and index are 28,408 B (10,056
gzipped); everything 37,571 B (14,707 gzipped), against the brief's
100 KB.

The renderer agrees exactly: for every car three.js's `info.render`
reports the geometry's triangles and calls, and 10 more triangles and 1
more call with the underglow on (the empty scene's one call for the
background is subtracted). The page fetched the seven car files at
exactly their sizes on disk, 37,571 B.

Known answers:

| Case | Expected | Got | Caught |
|---|---|---|---|
| a 12 triangle box in its own material added to the starter (geometry counter) | +12, +1 call, +1 material | +12, +1, +1 | yes |
| the same box, read from the renderer | +12, +1 call | +12, +1 | yes |
| the tourer lofted every 50 mm | over 3,000 | 4,336 | yes |
| 10,000 bytes appended to a copy of build.js | +10,000 | +10,000 | yes |
| three.js counted as if it were car code | over the limit | 1,034,378 B | yes |
| the fetched code compared with build.js left out | disagree | disagree | yes |

### 2. Dimensions and the ground

Measured from the built car (the wheels' own vertices for wheelbase,
track and radius, not the numbers they were built from).

| Car | Length | Width | Height | Wheelbase | Track | Wheel R | Roof |
|---|---|---|---|---|---|---|---|
| starter | 4.40 | 1.83 | 1.31 | 2.55 | 1.60 | 0.33 | 1.31 |
| hatch | 3.72 | 1.68 | 1.42 | 2.32 | 1.48 | 0.30 | 1.42 |
| tourer | 4.84 | 1.98 | 1.20 | 2.86 | 1.66 | 0.35 | 1.19 |
| fastback | 4.74 | 2.00 | 1.41 | 2.76 | 1.62 | 0.35 | 1.41 |
| driftbuild | 4.57 | 1.99 | 1.46 | 2.62 | 1.70 | 0.34 | 1.11 |

(The drift build's height is its wing; its roof is the lowest.)

General ranges, every car: length 3.6 to 4.9, width 1.6 to 2.0, height
1.1 to 1.5, wheelbase 2.2 to 2.95, track 1.4 to 1.75, wheel radius 0.28
to 0.38, wheelbase 55 to 66 per cent of the length, each overhang 0.55
to 1.15 m. All pass. The class checks, all pass:

- starter: inside the physics box and on its centre; wheelbase, track
  and radius equal to `TUNE.VEHICLE` within 1 mm.
- hatch: 3.6 to 3.9 m, wheelbase 2.2 to 2.45, the shortest of the five.
- tourer: 4.6 to 4.9 m, at least 1.9 m wide, wheelbase at least 2.75,
  the longest of the five.
- fastback: 4.5 to 4.9 m, rear tyres at least 40 mm wider than the
  front (60), body at least 60 mm wider at the rear axle (100).
- drift build: roof at most 1.22 (1.114), the lowest, at least 1.95 m
  wide (1.99), a wing at least 50 mm above the roof (346).

The ground and the body, every car:

- Each wheel's lowest point at rest: 0 mm from the ground, worst of
  twenty wheels.
- Over a whole turn in 360 steps: never below the ground; the most a
  wheel lifts is what its polygon allows, R(1 - cos(pi/segments)),
  4 to 8 mm.
- Nothing but the tyres below 50 mm: lowest body point 70 mm (the
  hatch's mud flaps) to 150 mm.
- No point of the body (vertices, face and edge middles) inside any
  tyre, wheels straight and at the physics' full lock of 32 degrees.
- Every tyre's outer face inside the body's side at its axle (worst
  5 mm inside).
- Facing -Z: headlights ahead of the front axle, which is at negative z;
  tail lights behind the rear.
- Every part (the body, each bolt-on, each wheel) closed with its faces
  outwards: positive signed volume.

Known answers, each must fail the check it is aimed at:

| Case | Check | Got | Caught |
|---|---|---|---|
| the starter's wheels moved up 30 mm (the brief's case) | wheels touching the ground | 30 mm | yes |
| the starter's wheels moved down 30 mm | wheels touching the ground | 30 mm | yes |
| a 6 segment wheel judged as a 15 segment one | over a whole turn | lifts 44 mm, allows 7 | yes |
| the drift build's splitter at 20 mm | nothing below 50 mm | 20 mm | yes |
| the starter stretched to 5.2 m | length | 5.24 | yes |
| the hatch on a 1.2 m track | track | 1.20 | yes |
| the starter 60 mm wider | class (physics box) | 1.89 | yes |
| the starter on a 2.60 m wheelbase | class (physics box) | 2.60 | yes |
| the fastback with no hips and equal tyres | class | equal | yes |
| the drift build without its wing | class | no wing | yes |
| the starter on wheels 80 mm bigger in the same arches | body inside a tyre | 268 points | yes |
| the starter on a track 120 mm wider | tyres inside the body | 55 mm out | yes |
| the starter turned round | facing -Z | reversed | yes |
| the starter built 200 mm forward of its origin | origin | -0.2 m | yes |
| the starter's body turned inside out | closed and outwards | body inverted | yes |

Two checks caught real defects during the work: the full lock check
found 34 body points in each front tyre at 32 degrees (the front wells
were deepened), and narrowing the fastback left its front tyres 13 mm
outside the body until its front arches were flared. The probe itself
had a sign error in the starter's expected box centre, caught because
the starter failed a check it visibly met; fixed and re-run.

### 3. Readable as itself at 30 m

The brief asks for each car to be readable as itself from the chase
camera at 30 m. I measured it as: each car alone from the chase
camera's height and pitch, 30 m back, on a phone (390 by 844, pixel
ratio 1, the low tier), drawn flat white on black, and every pair
compared by 1 - IoU of their silhouettes. The 0.15 threshold is mine;
the brief gives none.

| Pair, closest five | Straight | 35 degree slide |
|---|---|---|
| starter / fastback | **0.116** | 0.172 |
| tourer / drift build | **0.132** | 0.152 |
| fastback / drift build | **0.142** | 0.243 |
| tourer / fastback | 0.151 | 0.180 |
| starter / tourer | 0.192 | 0.159 |

The other five pairs are 0.176 to 0.344 straight and 0.197 to 0.324 in
a slide; the hatch is the most distinct (at least 0.197 against every
other car). Sizes at 30 m: 30 to 38 by 24 to 28 pixels straight, 59 to
72 by 25 to 29 in a slide.

The first run had the tourer and the fastback at 0.049, nearly the
same silhouette. Three rounds of shape changes (the fastback taller and
narrower at the shoulders with a ducktail, the tourer lower and wider
with a narrower glasshouse, the drift build slammed with a full width
wing) brought every pair over the line in a slide, and left three
straight pairs short of it.

Known answers: the starter against itself (0.000) and against itself
repainted pink (0.000) must fail: both caught. The starter's mask holds
762 pixels, between 0.05 and 5 per cent of the screen: it is the car and
only the car.

### The renderer anomaly

Taking the shots in one page, the near rear wheel was missing from
every three-quarter view. `game/test/cars/vanish.js` isolates it: on a
fresh page the starter's near rear wheel shows 406 rim pixels; after
one frame of the car drawn from the chase camera turned 35 degrees, the
same view shows 0, while the renderer still counts its draw call and
the wheel's transform and visibility are unchanged. Giving the wheel a
fresh copy of its geometry brings it back (406). It is not frustum
culling (turning culling off does not help) and not the shared material
(a separate one does not help). It looks like a stale GPU buffer in
three.js 0.184.0's WebGL 2 backend under SwiftShader; I have not found
the cause, and the renderer is outside this brief's folders. Known
answers: the wheel hidden on purpose reads 0 (caught as missing) and a
fresh page reads 406 (caught as present).

The shots and silhouettes are therefore each taken on a fresh page with
the sliding view last. The silhouette numbers were identical before
and after that change, so the masks were never affected.
**The game draws the car sliding every frame, so this matters if it
happens on real hardware.** Run `vanish.js` on a real GPU (WebGL 2 and
WebGPU) before the cars go into the game.

## Screenshots

All in `shots/`, taken by `render.js`, under the game's lights:

- Chase camera, at rest (1280 by 720, cropped to 800 by 480):
  `starter-chase.png`, `hatch-chase.png`, `tourer-chase.png`,
  `fastback-chase.png`, `driftbuild-chase.png`.
- Chase camera, the car turned 35 degrees as in a slide: `*-chase-slide.png`.
- Three quarter from the front: `*-three-quarter.png`; from the rear:
  `*-rear-three-quarter.png`.
- At 30 m on a phone: `*-30m.png` and `*-30m-slide.png`.
- All five: `all-three-quarter.png`, `all-turntable.png`,
  `all-underglow.png` (magenta underglow).
- The lab on a phone, 390 by 844 at pixel ratio 2: `lab-phone.png`.

## Not done, and what the next session should know

- The 30 m threshold straight from behind, above.
- The anomaly, above: unexplained, not tested on a GPU.
- Nothing is wired into the game: `render/scene.js` still draws the
  block car, as the brief intends. When the cars go in, `main.js`'s
  `carOnScreen` call hard codes a height of 1.45 m; each car's `dims`
  has the real one (1.20 to 1.46).
- Only the starter fits the current physics. The others carry their own
  wheelbase, track and size in `dims` for the physics to read once it
  has per car vehicles; until then they would drive on the starter's
  numbers with their wheels in the wrong places.
- Wheel colour is part of each car's design and is not switchable
  through the contract (DESIGN.md lists wheels as a cosmetic; not
  designed ahead here).
- No `ASSETS.md` entry: there is no asset, and the file is outside this
  brief's folders.
- Only judged in SwiftShader screenshots, never on a phone screen or a
  GPU. The look (flat shaded, Art of Rally as the reference) is the
  author's call on a phone, through the lab.
