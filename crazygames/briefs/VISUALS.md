# Brief: beautiful surroundings (5 November 2026)

Branch `crazygames-visuals`. Folders: `game/src/render/`, a new
`game/src/env/`, `game/index.html` (styles only), `game/later/` (assets
that load after the first playable frame), `game/lab/` (a new
`scenery.html`), `game/test/visuals/`, `review/visuals/`, and
`ASSETS.md`. Read `../DESIGN.md`, `../CLAUDE.md`, `../BRIEF.md` (its art
direction and hard limits) and `review/loop/REPORT.md` first.

A tracks session runs at the same time in `game/src/tracks/` and
`game/src/physics/`. Do not change those. It keeps the track's meshes
named `road`, `kerb`, `wall`, `clip`, `line`, and adds `bridge` and
`ramp`; style the track by replacing materials by name in the scene, so
its work drops in when it merges. Merge `main` in when it does.

## Goal

The author wants beautiful visuals surrounding the tracks. Today the
track sits on a flat dark plane. Make the world around it something a
teenager on CrazyGames would screenshot.

Art direction, from BRIEF.md: stylised realism at dusk, Art of Rally the
reference, not photorealism. Real lighting, shadows, fog, bloom, tyre
smoke, on well made low poly shapes.

- **Lighting and sky.** A dusk sky with a sun low on the horizon, warm
  key light and cool fill, real shadows from the cars and roadside
  objects, distance fog, bloom on lights. Then presets: dusk (default),
  night (headlights, lit grandstands and lamp posts), dawn, rain (wet
  road reflections if affordable). A preset per track, chosen by seed,
  and a `?preset=` override.
- **Terrain and scenery, built procedurally around each track.** Ground
  that rolls into hills away from the track, never onto it. Themes by
  seed: forest and hills, coastal (water, cliffs), desert canyon, city
  docks or industrial, mountain pass with snow. Trees, rocks,
  grandstands with crowds, tyre walls, flags, light towers, banners,
  sponsor boards with made up names, a start gantry, distant mountains
  or skyline. Instanced, so thousands of trees cost little.
- **The track itself.** Asphalt with subtle texture, painted kerbs, worn
  racing line, tyre marks that stay, wall materials by kind.
- **Effects.** Better tyre smoke (soft, lit, drifting with the wind),
  sparks on wall hits, dust off track, a heat shimmer or exhaust flame
  when boosting.

## Hard rules

- The readability rule in `crazygames/CLAUDE.md`: the road edge and the
  track must read clearly against everything around it, the player's car
  must be the most findable car, and nothing may occlude the road ahead.
  Scenery stays back from the barriers.
- Performance: a quality tier system. The lowest tier holds the
  JavaScript frame budget at 6x CPU throttle on forced WebGL 2 (as
  `game/test/loop/probes.js` measures) and keeps draw calls modest.
  High tier on WebGPU may add shadows at higher resolution, bloom, more
  trees. Report draw calls, triangles and frame time per tier.
- Initial download stays under 20 MB; aim under 5 MB. Heavier assets go
  in `game/later/` and stream in after the first playable frame.
- Procedural first. Any downloaded asset (texture, model) must be CC0 or
  another commercial use licence, recorded in `ASSETS.md` with source
  and licence. No AI generated images as assets. No external requests
  at runtime: everything ships in the build.
- Do not retune the handling in `game/src/tune.js`, and keep every
  existing probe passing (`game/test/feel/`, `game/test/loop/`).

## Measure, each with a known answer that can fail

1. Readability: the road edge's contrast against its surroundings in
   each preset, measured on screenshots. Known answer: a road edge
   painted the terrain colour must fail.
2. Nothing occludes the road ahead: no scenery inside the barriers or
   above the road within the camera's view, over the generated tracks.
   Known answer: a tree planted on the road must be caught.
3. Frame time and draw calls per tier, as above, with a known answer.
4. Initial download size.
5. The existing probes still pass.

## Deliver

Commits on `crazygames-visuals`, pushed after every step (usage limits
will interrupt you). Never push to `main`. Australian spelling, no em or
en dashes, no model names or session identifiers in commits, code or
comments. Finish with `review/visuals/REPORT.md`: a phone readable
summary, then measurements and known answers, and a screenshot set:
every theme and every preset, from the chase camera mid drift, in 390x844
and 1280x720, plus a few wide beauty shots. Note what is not done and
every deviation.
