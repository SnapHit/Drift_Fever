# Beautiful surroundings: report

Branch `crazygames-visuals`, brief `briefs/VISUALS.md`. Every number
below was measured by `game/test/visuals/probes.js` (headless Chromium,
forced WebGL 2 on SwiftShader) and `game/test/visuals/occlusion.js`
(Node, no browser), and the JSON and the screenshots beside this file
are what they wrote. Nothing under `game/src/tracks/`,
`game/src/physics/`, `game/src/tune.js`, `game/src/main.js` or
`public/` was changed.

## In short, for a phone

- The track now sits in a world. A dusk sky with the sun low and a
  warm glow round it, a purple band to a dark zenith, cloud streaks,
  stars at night; terrain that is flat beside the road and rolls into
  hills away from it, coloured by theme; a silhouette of mountains,
  peaks, mesas, a headland or a city skyline on the horizon, through
  haze; fog to the horizon colour so the ground fades into the sky.
- Five themes, chosen per track by its seed (`?theme=` overrides):
  **forest** (pines, round trees, bushes, farmhouses, barns, hay
  bales), **coastal** (palms, boulders, a cliff down to the sea on one
  side, sand along the shore), **desert** (red rock, cacti, mesas,
  dunes), **docks** (shipping containers in stacks, warehouses, gantry
  cranes, lamp posts, bollards, water off the quay, a skyline) and
  **mountain** (dense pines, boulders, snow above a line, cabins,
  peaks). Round every track: grandstands with crowds facing the big
  corners, light towers at the corner exits, flags and sponsor boards
  (made up names) along the straights, tyre stacks behind the outside
  of corners, and a DRIFT FEVER banner on the start gantry.
- Four presets, chosen per track by its seed, weighted so dusk is
  most common (`?preset=` overrides): **dusk** (default), **night**
  (moonlight, the road's edge paint glowing, lamp posts, towers,
  grandstand strip lights and the gantry lit, headlights on the car),
  **dawn** (a pale pink sky, the sun just up), **rain** (overcast,
  close fog, rain streaking past the camera, the road a wet standard
  material with specular reflections of the lights).
- Real lighting: a warm sun with shadows that follow the car (the cars,
  the barriers, the gantry and every prop over 2.5 m tall cast them on
  the low tier, everything on the high), a cool sky fill, ACES tone
  mapping.
- The track: asphalt with a procedural grain, concrete grain on the
  barriers, the clipping posts glowing orange, a worn racing line that
  leans to the inside through corners, tyre marks that stay for the
  run (1,400 quads on the low tier, 4,000 on the high). The track is
  styled by mesh name, so the tracks session's `edge`, `kerb`,
  `runoff`, `line`, `wall`, `clip`, `bridge`, `ramp` and `cut` meshes
  drop in when it merges; today's `road` and `barriers` are styled the
  same way.
- Effects: soft lit tyre smoke carried by the preset's wind, dust off
  the asphalt, sparks on a wall hit and while scraping, an exhaust
  flame while boosting, rain. Five particle pools, five draw calls.
- Two quality tiers. Low (the WebGL 2 fallback, and machines with four
  cores or fewer): 1024 shadow map over 72 m, 40 per cent of the
  scenery, 8 m terrain cells, no bloom. High: 2048 shadows over 104 m,
  all the scenery, 5 m cells, bloom through the renderer's post
  pipeline. `?tier=` forces one.
- Measured: the road edge is the brightest of edge, asphalt, barrier
  and ground beyond in all 40 screenshots (every theme and preset,
  both viewports), worst ratio 1.79, and an edge painted the ground
  colour fails at 0.54. No prop stands inside the barriers over 120
  track and theme pairs (least clearance 2.8 m); the ground is flat
  under and beside every road; 53 of 147,150 sight lines to the road
  ahead are blocked, none within 30 m, the nearest at 52 m, all by
  thin trackside things (boards, lamps, flags); a pine planted on the
  road is caught by both checks. JavaScript per frame at 6x CPU
  throttle is 8.2 ms p95 on the low tier (57 draw calls, 341k
  triangles) and 5.7 ms on the high (63 calls, 919k triangles); 20 ms
  of busy work flips the verdict. Initial download 1.36 MB over 49
  files, including three.js. The feel and loop probes still pass.
- Honest caveats: the GPU half of a frame cannot be measured in this
  sandbox (SwiftShader rasterises on the CPU), so 60 fps on a five
  year old Chromebook is not proven here; the triangle and draw call
  counts are what a real GPU would be given. The bloom and the high
  tier ran only on the forced WebGL 2 path here, never on WebGPU. The
  banked, elevated and crossover tracks of the tracks session have not
  been seen under this scenery.

## What was built

```
game/src/env/rng.js          seeded random and value noise (decoration only; the physics reads none of it)
game/src/env/presets.js      dusk, night, dawn, rain: sky colours, sun, fill, fog, exposure, lamps, wet, wind
game/src/env/themes.js       forest, coastal, desert, docks, mountain: palette, relief, backdrop, props per hectare, keep-outs
game/src/env/terrain.js      the height grid, the distance field to the road, the sea, the clearance to the barrier line
game/src/env/scenery.js      where every prop stands, and the trackside furniture, as plain data
game/src/env/props.js        the props as merged vertex coloured geometry, lit parts apart
game/src/env/sky.js          the dome, the sun, stars, clouds, the horizon backdrop
game/src/env/textures.js     asphalt and concrete grain, the sponsor atlas, the banner, the sprites, on canvases
game/src/env/trackstyle.js   materials by mesh name, UVs from positions, the racing line
game/src/env/particles.js    one pool of camera facing quads with a per vertex alpha
game/src/env/effects.js      smoke, dust, sparks, exhaust, rain
game/src/env/world.js        assembles terrain, water, backdrop, instanced props, boards and sky for a track
game/src/render/scene.js     wires it: lights and shadows that follow the car, presets, tiers, marks, bloom
game/lab/scenery.html        the lab: any seed, theme, preset and tier; ride, orbit or look down
game/test/visuals/probes.js  readability, perf per tier, download, the shots
game/test/visuals/occlusion.js  nothing inside the barriers, the ground flat, sight lines
ASSETS.md                    everything is procedural; the sponsor names are made up
```

Draw calls on the low tier, forest at dusk, mid drift: 57 in all,
of which the world is 22 (terrain 1, backdrop 1, sky 3, 12 prop
kinds with 3 lit parts, boards 2), the track 2, the gantry 4, the car
and its lamps about 9, marks and the racing line 2, effects 2 to 5,
and the shadow pass the rest. The lab's stats line shows the same
numbers live.

### How the world is placed

The terrain is a grid over the track's bounds plus 520 m. Its height
is hills from seeded noise, masked by the distance from the road
edge: dead flat (3 cm under the road) within 16 m of the edge plus its
run-off, full height by 110 m. The distance field is a 6 m grid of
the nearest centre sample (dead reckoning, two sweeps), interpolated,
and `wallClearance` refines it against the track's own wall points
for the probe and the furniture. Coastal and docks themes drop the
ground to a sea on a seeded side beyond the track, with a water plane
at -1.5 m.

Props are scattered by density per hectare with a keep-out per kind
from the road edge (trees 11 m, buildings 22 to 30 m, bushes and
rocks 5 m), thinned or thickened within 60 m of the road, rejected in
the water and, for buildings, on a slope. Trackside furniture is
placed from the track: grandstands on the outside of the biggest
corners facing the apex, 7 m behind the wall; towers at corner exits;
flags every 14 m and boards every 26 m on straights, alternating
sides; tyre stacks behind the outside wall of corners; lamp posts
every 42 m where the theme has them. Every kind is one
`InstancedMesh` (two with lit parts); the boards' printed faces are
one merged mesh over a canvas atlas.

### Readability by design

The edge line is painted by the track builder's vertex colours and
left exactly as it is; the road material is Lambert, so a low sun
does not put a specular sheen on the asphalt or the ground (with
standard materials it did, and the sheen was brighter than the edge;
that was the first failing run). The road's bright paint also emits a
share of its own colour in every preset (0.6 by day, 0.75 at night),
through a node material whose emissive is the vertex colour masked
by its brightness, so the edge beats sunlit sand and a sunlit barrier
face under any light.

## Measurements, each with its known answer

Run: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node game/test/visuals/probes.js`
(about 45 minutes; name a probe to run one) and
`node game/test/visuals/occlusion.js` (10 s).

### 1. Readability (`readability.json`, `shots/`)

Every theme on its own career track (forest 1, coastal 2, desert 3,
docks 4, mountain 5), every preset, 1280x720 and 390x844, from the
chase camera at a frame mid drift (over 25 degrees, over 10 m/s).
On each screenshot, points from the track's own geometry 4 to 40 m
ahead of the car, every 2 m, both sides, are projected into pixels
(those under the HUD or off screen dropped): the edge line (the
brightest pixel within two of its point, since the line is a few
pixels wide at distance and the barrier may stand on its outer
half), the asphalt 2.6 m inside the edge, the barrier's face, and the
ground beyond the barrier where the camera sees over it. The edge's
median luminance over the brightest neighbour's median must be at
least 1.35.

| preset | ratio, least to most over the 10 shots |
|---|---|
| dusk | 1.82 to 3.85 |
| night | 5.33 to 26.9 |
| dawn | 1.79 to 3.77 |
| rain | 1.99 to 4.45 |

40 of 40 pass; worst 1.79 (coastal, dawn, 390x844); fewest samples 15
(portrait, where the HUD takes the top of the frame). PASS.

Known answer: the builder's edge colour set to the theme's ground
colour and the track rebuilt: ratio 0.54. CAUGHT.

### 2. Nothing occludes the road ahead (`occlusion.json`)

24 generated tracks (12 circuits, 12 sprints, seeds 2000 + 7k) by
every theme, 120 pairs, in Node with the same placement the scene
draws.

- Inside the barriers: every instance's footprint (a circle's rim, or
  a box's corners for buildings, stands, containers, cranes and
  boards) against the barrier line read from the track's wall points
  at the nearest sample. 0 inside; least clearance 2.80 m (a tyre
  stack). PASS.
- The ground flat under and beside the road: at every centre sample,
  across the road and 2 m past each edge, the terrain is at the flat
  level. Worst rise 0.000 m. PASS.
- Sight lines: from the chase camera's position every 10 m along the
  track to the road's centre every 4 m ahead to 60 m, against every
  prop's volume and the terrain. 53 of 147,150 blocked (0.04 per
  cent; worst track 0.61 per cent), none within 30 m, the nearest at
  52 m; the blockers were boards (36), lamp posts (12) and flags (5),
  thin things beside the road where it curves. Budget: none within
  30 m and at most 2 per cent. PASS.
- Known answers: a pine planted on the road's centre is inside the
  barriers (clearance -10.28 m) and blocks 39 sight lines, 19 of them
  within 30 m, the nearest at 4 m. CAUGHT. The terrain lifted half a
  metre under the road: worst rise 0.5 m. CAUGHT.

### 3. Frame time and draw calls per tier (`perf.json`)

Forced WebGL 2, 390x844, career 1 (a generated circuit, forest at
dusk), the scripted driver drifting, 300 frames with the first 30
reported apart, DevTools CPU throttle through CDP. "JS without submit"
is everything in the frame but `renderer.render`, which is the number
the verdict uses; on SwiftShader the submit is the whole software
rasterisation on the main thread (hundreds of milliseconds here) and
says nothing about a GPU.

| tier | throttle | JS without submit p95 / worst | physics p95 | draw calls (worst) | triangles | first frames worst |
|---|---|---|---|---|---|---|
| low | 1x | 0.6 / 15.8 ms | 0.3 | 57 (60) | 341,475 | 863 ms |
| low | 6x | 8.2 / 73.1 ms | 4.0 | 57 (60) | 341,475 | 2,908 ms |
| high | 1x | 0.7 / 6.9 ms | 0.3 | 63 (64) | 912,871 | 937 ms |
| high | 6x | 5.7 / 15.7 ms | 3.2 | 63 (64) | 918,631 | 2,257 ms |

Low tier JavaScript p95 at 6x under 16.7 ms: PASS. The first frames
are shader compiles and the world reaching the GPU, once, behind the
countdown. The high tier here holds 1,090 pines, 671 trees, 1,006
bushes and the rest in 22 draw calls.

Known answers: 20 ms of busy work in every physics step at 6x: p95
8.2 to 28.1 ms, the verdict flips. CAUGHT. One more instanced mesh
(50 boxes, casting) in the scene: 57 to 59 draw calls, one for the
mesh and one for its shadow. CAUGHT.

The low tier's worst frame (73 ms at 6x, 15.8 at 1x) is a single
frame; the sandbox's CPU throttle makes the odd frame slow, and the
loop report before this work showed the same (8.3 ms worst at 6x).
Profiled apart: `scene.update` (marks, effects, the shadow box, the
cones) is 0.2 ms at 1x; the frame outside the render is 0.3 ms.

### 4. Initial download (`download.json`)

`tools/build-site.js`: 49 files, 1.36 MB including three.js (1.0 MB
of it). An independent count of the same rule (everything under
`game/` but tests and `later/`, plus three.js) agrees: 1,426,605
bytes. Under the 5 MB aim and the 20 MB limit. PASS. No file was added
to `game/later/`: everything is procedural and there is nothing to
stream.

Known answer: a megabyte under `game/later/` leaves the count at
1.36 MB; the same megabyte under `game/lab/` makes it 2.36 MB. CAUGHT.

### 5. The existing probes

`feel-probes.log` and `loop-probes.log` beside this file hold the
full runs on this branch; see the end of each for the verdicts.
`npm run build` passes (parity stamp holds, 49 files, 1.36 MB).

## Screenshots

`shots/` holds, for every theme and preset, `THEME-PRESET-1280x720.png`
and `THEME-PRESET-390x844.png` from the chase camera mid drift (40
files), `known-answer-edge-1280x720.png` (the edge painted the ground
colour, which fails), five wide beauty shots on the high tier with
bloom (`wide-forest-dusk`, `wide-coastal-dawn`, `wide-docks-night`,
`wide-mountain-dusk`, `wide-desert-rain`) and the title screen's orbit
view for each of those (`title-*`).

## Not done, and deviations from the brief

- **The GPU is not measured.** The sandbox rasterises in software;
  draw calls and triangles are reported per tier, and the JavaScript
  budget holds, but 60 fps on a five year old Chromebook on the low
  tier has to be confirmed on one. If it does not hold, the first
  things to cut are in `LOOK.TIERS.low` in `scene.js`: the shadow map
  (1024, or off), `sceneryShare` (0.4) and `terrainCell` (8).
- **WebGPU was never run.** Headless Chromium here has no WebGPU, so
  the high tier and its bloom ran on the forced WebGL 2 path. The
  bloom is a small single pass (12 taps of the scene's bright parts
  through the renderer's post pipeline), not the addon's multi pass
  bloom, which is not in the vendored bundle.
- **Wet road reflections are specular only.** There is no environment
  map, so the rain preset's road reflects the sun and the sky fill as
  highlights, not the scenery. Rain streaks fall round the camera.
- **No heat shimmer.** The exhaust flame while boosting is built
  (`BOOST_MAX` is 0 in the tune, so it never shows today); a shimmer
  needs a distortion pass and was left.
- **Wall materials by kind** are the builder's vertex colours
  (concrete, tyres, fence) under one concrete grain; the kinds are not
  given their own textures.
- **The shadows freeze under the probe harness without a workaround.**
  The renderer refreshes a shadow map once per frame of its own
  requestAnimationFrame loop, which the probes stub, so `scene.render`
  moves the renderer's frame counter itself (`renderer._nodes.
  nodeFrame.update()`, a private field) when it has not moved since
  the last render. In a browser the loop moves it and the line does
  nothing. Noted because it reaches into the renderer.
- **The world is rebuilt per track, once** (about 130 ms for the
  terrain and placement at 8 m cells, 2 to 10 ms for the props), and
  kept across GO AGAIN; a change of preset or theme through
  `setLook` rebuilds it.
- **Elevation.** The terrain's flat band follows each centre sample's
  own height, so an elevated road from the tracks session keeps its
  ground, and the probes read the road's height, but no banked or
  crossover track has been drawn under this scenery yet; `main` had
  not moved when this report was written, so nothing was merged in.
- **A push reached `main` by mistake and was undone.** The first
  three commits of this work were made in a working copy another
  session was also using; it had switched the checked out branch to
  `main` between my commands, so my `git push` on 5 November sent
  them to `main` (900415a) rather than the branch. On finding this,
  the commits were replayed onto `crazygames-visuals` from a private
  clone and `main` was restored to exactly ad6cfc6 with a lease on
  its commit, so nothing else was touched; the preview will have
  deployed those commits for the hours between. All later work is on
  the branch only.
- `package.json` is outside the brief's folders, so the probes run with
  `node game/test/visuals/probes.js` and `node game/test/visuals/occlusion.js`.
