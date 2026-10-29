# Brief: the five cars as models (DESIGN.md build step 3, in parallel)

Branch `crazygames-cars`. Folder: `crazygames/game/src/cars/`,
`crazygames/game/test/cars/` and `crazygames/game/lab/cars.html` only.
Read `../DESIGN.md`, `../CLAUDE.md` and `../BRIEF.md` first.

## Goal

Five original low-poly cars, built procedurally in three.js code (no
downloaded models, no textures that are not generated in code, no AI
generated images), in the stylised realism the design asks for (Art of
Rally is the reference). Never a recognisable real car, and never named
after one. Another session is building the physics at the same time.

## The contract, `createCar(THREE, id, options)`

Returns `{ group, body, wheels: { fl, fr, rl, rr }, lights, setPaint(colour),
setUnderglow(colour or null), dims }`. Units metres, Y up, the car facing
-Z, its origin on the ground at the centre of the wheelbase. `dims` gives
length, width, height, wheelbase, track width and wheel radius, which the
physics will read. Wheels are separate objects the game can spin and
steer. Headlights and tail lights are meshes with emissive materials the
game can switch.

## The five, each with a clear character

1. **Starter**, cyan by default: a compact, balanced coupe, friendly.
2. **Light and twitchy:** a small, short-wheelbase hatch or roadster.
3. **Heavy and smooth:** a long, wide grand tourer.
4. **Raw power:** a muscular fastback with wide rear arches.
5. **The prize:** a low, wide, aggressive drift build with a big wing.

Each readable as itself from the chase camera at 30 metres. Aim for
800 to 3,000 triangles per car, a handful of materials, and code that
loads in well under 100 KB for all five.

## Also

`game/lab/cars.html`: a turntable of the five, with paint and underglow
pickers, viewable on a phone, and the triangle and draw call count for
each car.

## Measure

1. Triangles, draw calls and code size per car.
2. Dimensions within sensible ranges for the class (length 3.6 to 4.9 m,
   and so on), and the wheels touching the ground plane. Known answer: a
   car with its wheels moved up must fail the ground check.

## Deliver

Commits on `crazygames-cars`, pushed often. Do not push to `main` and do
not touch files outside your folders. Finish with `review/cars/REPORT.md`:
summary first, then the measurements and screenshots of each car from the
chase camera angle and in a three-quarter view.
