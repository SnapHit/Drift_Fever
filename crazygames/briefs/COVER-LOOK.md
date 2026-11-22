# Brief: make it look like the cover (22 November 2026)

Branch `crazygames-look`. Folders: `game/src/render/`, `game/src/env/`,
`game/src/cars/` (materials and lamps only, never a shape or a size),
`game/src/camera/`, `game/src/fx.js`, `game/src/tune.js` (the `CAMERA`
block and new look blocks only), `game/index.html` (only if the post
pass needs it), `tools/vendor-three.js` (only to bundle a three.js node
the look needs), `game/test/look/` (new), `review/look/` (new).
Nothing in `physics/`, `input/`, `scoring/`, `loop/`, `rivals/`,
`park/` or `ui/`. Nothing outside `crazygames/`. Never push to `main`.

Read `../CLAUDE.md` first, all of it, then `../ROADMAP.md`, then
`../DESIGN.md`. Round 1B (`briefs/PRO-CONTROLS.md`) runs at the same
time on its own branch in other folders: do not touch its folders.

## Why

CrazyGames rejected the game on 22 November for overall quality. Our
reading (ROADMAP.md, point 1): the cover shows our own car, same shape
and wheels, with glossy paint, reflections, a wet floodlit track and
thick smoke; the game draws it with nothing to reflect (there is no
environment map anywhere in the renderer), mostly non reflective
materials in the world, the car about 8 per cent of the screen wide in a
race, empty fields beside the track, and the first track at night.
Their quality page asks that the imagery "accurately reflect the
gameplay". Put `brand/art/hero-landscape.jpg` beside
`brand/reference/action-night-landscape.png` and
`review/play13/shots/1280x720-race.png` before you start: that gap is
this round.

**The goal: a frame of the game, at the cover's angle, that the author
looks at and says "that is the cover". And a race that looks like a
game a stranger would want to play, at the same frame rate.**

## What to build, in priority order

Each item behind `?look=2` until the author has played it. Without the
switch the game draws exactly as on `main`.

1. **Light the world with an environment.** Per track and preset, make
   an environment map from the game's own sky (the dome, the sun or the
   glow, and the big bright shapes such as floodlight heads), filtered
   for rough and smooth surfaces, and give it to the scene, so every
   standard material reflects its surroundings. Made at load from what
   is already drawn: no image downloaded. Rebuilt when the track or the
   preset changes, never per frame.
2. **The cars' materials.** Clear coat paint with a sharp top coat over
   the colour (the cover's glossy amber), reflective glass, dark chrome
   and satin black trim, rubber tyres that read as tyres, metallic rims,
   headlights and tail-lights bright enough to bloom. Every paint and
   every wheel design in the garage must still read as itself. The
   showroom gets the same materials and its own studio environment.
3. **The road.** Asphalt with grain and a surface that catches light:
   normal and roughness detail generated at load, no download. On wet
   and night presets, a wet track: the lights mirrored in it as long
   soft streaks under each lamp and floodlight (the standard trick, an
   additive quad per light), patches of standing water. Tyre marks sit
   on it darker and drier.
4. **The venue.** The cover's floodlight towers: bright heads that
   bloom, light pools on the track under them, as many as a track
   needs to read at night. A denser trackside within about 60 m of the
   road: barriers with stripes, tyre walls, catch fencing, grandstands
   with a crowd, gantries, banners carrying the game's own invented
   sponsors. Instanced, culled, cheap. Fewer empty fields in shot.
5. **The first impression.** Career track 1 and the title's backdrop at
   floodlit dusk, as on the cover (a sunset sky, lights on), on both
   tiers. Other tracks keep their presets.
6. **Smoke.** The cover's smoke: thick, billowing, lit from above and
   darker underneath, tinted by the lamps and the underglow nearby,
   lingering behind a long slide. Built as the particles already are
   (see Rules).
7. **The camera.** Closer and lower, so the car is the subject: in a
   race at 1280x720 the car about 14 to 18 per cent of the screen's
   width (now about 8), in portrait about the same share of the
   width, the road ahead still readable at speed, the drift swing
   still showing the car's angle. In `TUNE.CAMERA`, every number
   commented.
8. **Clean edges and a finish.** Antialiasing on both tiers (the low
   tier draws at a pixel ratio of 1 with none today), a colour grade
   per preset, the bloom tuned to the new lights.

## Rules

- **Presentation only.** Nothing the physics or the score reads may
  change. Recorded runs and the Kestrow race replay to the bit:
  `game/test/park/same.js` against `main`.
- **The switch.** `?look=2` turns everything on. Without it every frame
  is the same as `main`'s, pixel for pixel, at a fixed step on both
  tiers (prove it).
- **Instant.** The initial download stays at or under 4 MB (now 2.59
  MB; `npm run build` prints it). Textures and environment maps are
  made at load. Any asset added is recorded in `ASSETS.md` with its
  source and licence, CC0 preferred, and loads after the first frame.
- **Both backends.** Every new material and mesh drawn on WebGL 2 AND
  on WebGPU in the sandbox (`game/test/webgpu/lib.js`), each read back
  off the screen. The author's Pixel 9 drew nothing for a ribbon with
  one four part attribute and no texture: build new geometry as the
  particles are (a texture, `alpha`, `tint`, `uv`), and list in the
  report everything new his phone must confirm.
- **The low tier keeps its cost.** On the low tier, draw calls and the
  game's own work per frame within 10 per cent of `main`'s in the same
  race; whatever costs more is high tier only. The high tier may cost
  more, and says how much.
- **Readability.** The road ahead is never hidden (extend
  `visuals/occlusion.js` to the new trackside and the new camera); the
  player's car is the most findable car; the road reads against what is
  beside it in every preset. The old rule that the road edge is the
  most saturated thing on screen was already found untrue (garage
  round); keep its brightness half.
- **three.js 0.184 nodes** such as FXAA or SMAA are not in the vendored
  bundle. Either extend `tools/vendor-three.js` to bundle what you use
  and report the bytes, or write it in TSL as the bloom is.
- Australian spelling, no em or en dashes, every tunable named in a
  block at the top of its file, model names and session identifiers
  never in commits, code or comments.

## Measures, each with a known answer that can fail

1. **Reflections.** In the showroom and in a race, the paint on the
   bonnet shows the environment: the spread of brightness across those
   pixels with the environment on is at least twice that with it off.
   Known answer: with the environment removed the probe fails.
2. **The cover pair.** `game/test/brand/capture.js` with the cover's
   camera, the drift build in amber on tri-blades with the violet glow,
   `?look=2`, beside the cover art, at 1920x1080:
   `review/look/cover-pair.png`. And the same before the round. For the
   author's eye; no number stands in for it.
3. **Car on screen.** The car's projected width as a share of the
   screen, in a race at 1280x720, 844x390 and 390x844, over 600 frames:
   median between 14 and 18 per cent in landscape. Known answer: the
   camera on `main` measures about 8 and fails.
4. **The road ahead.** The occlusion probe on every career track with
   the new camera and trackside. Known answer: a barrier placed on the
   racing line is caught.
5. **Clean edges.** A straight high contrast edge (a kerb against the
   asphalt) at 1280x720 on the low tier: the count of stair steps along
   it falls by at least half. Known answer: antialiasing off fails.
6. **Cost.** On the low tier, draw calls, triangles and the game's own
   work per frame against `main` in the same race on three tracks (day,
   dusk, night), within 10 per cent; on the high tier, reported.
   Known answer: 500 extra meshes added to the scene are caught.
7. **Both backends.** Each new thing drawn and read back on WebGL 2 and
   on WebGPU, both tiers. Known answer: a mesh hidden on purpose reads
   as missing.
8. **The switch.** Pixel identical frames without `?look=2`, both
   tiers, three presets. Known answer: a one pixel change is caught.
9. **Nothing else changed.** `park/same.js`, `play15/check.js`,
   `start/check.js`, `bench/check.js`, `ready/sizes.js`,
   `garage/readable.js` (updated for the new look where its premise
   changed, and say why) all pass. Restore other rounds' review files
   with `git checkout -- review/<round>` after running their probes.

Look hard at your own shots after every step, in every preset, at
1280x720 and on a phone's portrait. If a stranger seeing a frame of the
race would not want to play, it is not done.

## How to run things here

- From `crazygames/`, with `PLAYWRIGHT_BROWSERS_PATH` pointing at a
  folder holding `chromium-<n>/chrome-linux/chrome` (the probes'
  `findChromium` does not know `chrome-linux64`; make a folder of
  symlinks if the browser sits elsewhere).
- Pages advance with `R.runFrames` (`game/test/feel/lib.js`); the frame
  loop is stubbed in the probes. `game/test/webgpu/lib.js` runs the
  WebGPU backend. `game/test/brand/capture.js` draws stills at any
  camera on the high tier at twice the size.
- A foreground command dies at ten minutes: split long probes, or run
  them in the background.
- `crazygames/node_modules` in a worktree is a symlink: never commit it.
- Commit with the author name and email the existing commits use
  (`git log -1 --format='%an %ae'`), small commits, no trailers. **Push
  the branch after every working step**: a machine was once lost with a
  round's work on it. Keep screenshots out of the history until the
  last commit.

## When done

`review/look/REPORT.md`, short, for a phone: the cover pair first, then
before and after shots of a race in day, dusk and night at 1280x720 and
390x844, a table of the measures with their known answers, the costs
per tier, the initial download, everything new his Pixel 9 must
confirm, what was cut and why, and every deviation from this brief. Ask
the author to run `?bench=1&adapt=0&look=2` and `?bench=1&adapt=0` on
his desktop and his phone and to send both results. Do not add a Status
entry to `CLAUDE.md`; the reviewer does that at the merge. If something
in this brief turns out to be wrong, stop that part and say so in the
report; do not work around it.
