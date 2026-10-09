# Drift Fever: CrazyGames edition

## Goal

The same game, every mechanic preserved, with a full-scale visual uplift on
a real 3D renderer. Target look: stylised realism at dusk. Real lighting,
shadows, fog, bloom and particle smoke on well-made low-poly models. Art of
Rally is the reference, not photorealism.

## Hard limits (CrazyGames, verified October 2026)

- Initial download 20MB or less. That is the mobile homepage threshold and
  it is the real target. 50MB is the absolute ceiling.
- Total 250MB or less. 1,500 files or fewer.
- PEGI 12.
- Everything beyond the initial download streams in after the first
  playable frame.

## Platform

- three.js WebGPURenderer, with its automatic WebGL 2 fallback. About 17% of
  players will get the fallback, and a large share of the audience is on
  school Chromebooks, so the fallback is a first-class path, not an
  afterthought.
- Quality tiers, chosen automatically. The lowest tier must hold 60fps on
  WebGL 2 on a five-year-old Chromebook. Measure it, do not assume it.
- Portrait and landscape, phone to desktop.

## Architecture: one simulation, two renderers

The simulation is extracted from Drift_Fever's index.html into a module this
repo vendors: road generation, the daily seed, physics and drift, scoring,
racers, contact, hazards, jumps, checkpoints, records, the tutorial script.
The renderer consumes it and never feeds back into it.

A PARITY TEST is part of the build. It runs Drift_Fever's index.html and the
vendored module on the same seeds and the same input tapes and compares road
hashes and drive traces. If they diverge, the build fails. It carries a
known-answer case: perturb one constant and confirm it fails.

Drift_Fever stays a single self-contained file. It does not import this
module. Gameplay changes happen there first and are re-vendored here.

## Preserved exactly

Daily track seeded from the local date. Training plus five real levels on
the 2, 3, 4, 5, 6 gate ladder. The drift: build 0.20, exit 0.50, yaw gain
1.75, pivot 210. Three racers with the form-based pace law, solid contact
that is free by construction and never pushes the player outward or into a
hazard. Hazard and jump warning runs, landing reservations, sight-line
clauses. The tutorial script and its coaching lines. The 3,2,1 countdown at
0.70. The title screen route from pause. One input to restart on every path.
The four music tracks and how they are handled, silent with the button off
on failure. Records, ghosts, the share card, car unlocks.

If the renderer appears to need a gameplay change, stop and ask.

## Art direction

- Stylised realism. PBR materials, real shadows, fog for depth, bloom,
  volumetric-feeling smoke from the tyres.
- Dusk is the default. The twelve hue-rotated biomes are replaced by time of
  day and weather presets: dusk, night, dawn, rain. Real lighting makes hue
  rotation obsolete.
- THE CAR IS AN ORIGINAL DESIGN, fixed cyan as in the live game. Never a
  recognisable real car. Racers are the same original body in their fixed
  colours.
- A real chase camera, high, like Art of Rally. The roughly 3.5 seconds of
  visible road ahead is a core pillar and is measured, not assumed.
- Roadside world: hills, fields, trees, farmhouses, fences, signs, the city
  skyline on the horizon. Landmarks keep their coupling to the distance
  signs. Signs stay metric, matching the run card.

## The readability rule, unchanged

The road edge is the brightest and most saturated thing on screen in every
preset. The road reads against the terrain. The player's car is the most
findable car. Nothing occludes the road ahead. Every visual change is
measured against this.

## Assets

Commercial-use licences only, CC0 preferred. Record every asset's source and
licence in ASSETS.md. Compressed: KTX2 textures, Draco or meshopt geometry.
No AI-generated images used as assets. Procedural where it is cheaper.

## CrazyGames integration

- Basic Launch first: no SDK, no ads.
- The SDK sits behind an adapter that is a no-op until Full Launch. This
  build is the one place the zero-external-requests and no-ads rules do not
  apply, and only through that adapter.
- At Full Launch: gameplayStart and gameplayStop events, a rewarded ad for a
  continue (currently free), and midgame ads only between levels, never
  mid-run.

## How work is done

- Every claim is measured. Every probe carries a known-answer case that can
  fail. The original project found more than a dozen harness defects where a
  probe passed for the wrong reason, usually because it was not driving what
  it thought it was driving.
- Pick the statistic that can see the failure. A median repeatedly reported
  a pass on this project when a small number of cases were failing badly.
- Commit straight to main, one push at a time.

## Stages

1. Extract the simulation, vendor it, and prove parity.
2. Greybox renderer at full gameplay parity: plain shapes, real 3D, correct
   camera, every mechanic playable. Frame budget measured on the low tier.
3. Art: lighting, presets, models, materials, effects, the original car.
4. Size and performance pass against the 20MB and 60fps targets.
5. CrazyGames packaging and Basic Launch submission.
6. SDK and Full Launch, when invited.
