# Brief: the feel prototype (DESIGN.md build step 1)

Branch `crazygames-feel`. Folder: `crazygames/game/`, except
`game/src/tracks/` and `game/src/cars/`, which other sessions own.
Read `../DESIGN.md`, `../CLAUDE.md` and `../BRIEF.md` (hard limits) first.

## Goal

A car that is fun to throw sideways, playable at the preview URL on a
phone, a Chromebook and a desktop. Plain shapes. The author judges it by
playing, and nothing else proceeds until the car is fun. This is the most
important piece of the whole game: spend the effort here.

## Build

- `game/index.html` and ES modules under `game/src/`. three.js through the
  import map `"three": "./vendor/three.webgpu.min.js"` (the build copies
  the pinned copy there). WebGPU with the WebGL 2 fallback, `?renderer=webgl2`
  to force it. No external requests. No bundler needed unless you can show
  it pays.
- **Vehicle model** in `game/src/physics/`: your own arcade model, units
  metres and seconds, Y up. Rear-wheel drive, a tyre grip curve per axle,
  weight transfer, handbrake, countersteer assist, a hidden assist level.
  Fixed step (for example 120 Hz) with interpolation for drawing, and
  deterministic for a given input stream: the same inputs from the same
  start give the same run, bit for bit, in the same browser. Every
  tunable in one exported block. A physics library only if you measure
  that it beats your own on feel, size and determinism.
- **Test ground:** an open car park with cones, and a short closed test
  track (a few hairpins, a fast sweeper, a chicane, walls on both sides).
  Hand-made is fine; the track generator is another session's job. Solid
  walls: a hard hit costs speed and the chain and never ends the run.
- **Camera** in `game/src/camera/`: chase camera on the car's heading with
  lag, swings to show the drift angle, field of view widens with speed,
  shake on hits. The car must never slide off screen or be hidden.
- **Controls** in `game/src/input/`: keyboard (arrows or WASD, space
  handbrake, both letter cases), touch (steer with thumbs, automatic
  throttle, brake and handbrake buttons, big targets), gamepad. One
  restart input.
- **Drift scoring** in `game/src/scoring/`: points from angle and speed
  while above a minimum angle, a chain multiplier, banked on straightening,
  lost on a hard hit, a proximity bonus near marked walls. Live score by
  the car, a running total, callouts.
- **Tuning panel** at `?tune=1`: sliders for the key physics, camera and
  assist constants, applied live, remembered on the device, with a line
  of current values to screenshot. The author will tune by playing.
- `?debug=1`: backend, frame rate, worst frame, physics step time.

## Measure, each with a known answer that can fail

1. Determinism: replay a recorded input stream and get the identical
   end state. Known answer: perturb one input frame and see it differ.
2. The car is drivable by a scripted driver around the test track without
   leaving it, and a scripted drift input holds an angle above 30 degrees
   for at least two seconds through the sweeper. Report the numbers.
3. The camera keeps the car fully on screen in every frame of those
   drives, in 390x844 and 1280x720.
4. JavaScript frame time at 4x and 6x CPU throttle on forced WebGL 2,
   p95 and worst.

## Deliver

Merge-ready commits on `crazygames-feel`, pushed often. Do not push to
`main`. Finish with `review/feel/REPORT.md`: phone-readable summary first,
then measurements, known answers, screenshots of the car mid-drift in both
viewports, what you would tune next, and anything not done.
