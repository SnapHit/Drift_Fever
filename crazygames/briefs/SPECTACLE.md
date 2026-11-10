# Brief: spectacle (10 November 2026)

Branch `crazygames-spectacle`. Folders: `game/` and `review/spectacle/`.
These must not change: `game/src/physics/`, `game/src/tracks/generate.js`,
`game/src/loop/save.js`, `game/src/scoring/`, `game/assets/audio/` and
`game/src/audio/` (you may call the sound cues that exist). Read
`../CLAUDE.md` first: the Status section is the history of every
decision since `DESIGN.md`. Then read `../DESIGN.md`, `../BRIEF.md` (the
hard limits), `review/visuals/REPORT.md` and `review/fury/REPORT.md`.

## Why

The author has played the whole game and calls it great. He wants it
outstanding: as good as the best free drift game anywhere, and
spectacular. The reviewer compared it with the best reviewed free
browser drift game (Drift Hunters MAX, praised for its graphics, physics
and smooth frame rate) and looked at this game's own screenshots at both
tiers. The verdict:

- **The drift is not a show.** The smoke is grey blobs, the marks are
  faint, and nothing glows, trails or flashes. The camera is calm through
  the biggest moments of a run.
- **Night is the weakest preset.** It is nearly black at both tiers: the
  road ahead cannot be read and the world is a silhouette.
- **The world is plain.** The road is a flat dark slab and nothing moves.
- **The score does not react.** The numbers change, and that is all.

This game will not beat a simulator at realism and must not try. Its
lane is the best arcade drift game: stylised (`DESIGN.md` pillar 4, Art
of Rally as the reference), instant, thrilling every second. This round
is presentation only: how the game looks, moves and reacts. It is the
first of four rounds; rivals, the garage and a playground come later and
are not yours.

Do fewer things beautifully, not everything thinly. Look hard at your
own screenshots after every step, at both tiers. If a frame would not
make a player stop scrolling, it is not done.

## What to build, in priority order

Finish each before starting the next. If you run short, stop and report
what is left; do not half-do the later ones.

1. **The drift is a show.**
   - Smoke that billows, lingers and is lit by the scene: warm at dusk,
     red from the tail-lights at night. It thickens with the slide and
     with the chain.
   - Tyre marks that read clearly and stay for the whole run.
   - Sparks on scrapes and hits that are bright enough to matter.
   - Tail-light trails while sliding at dusk and at night, and brake
     lights that brighten under the brake.
   - An exhaust flame on the lift at the end of a slide.
   - The show escalates with the multiplier: at x1 it is modest, at x4
     and above it is unmistakable.
2. **Night and rain become the best-looking presets.**
   - Night: the road ahead reads at speed. Edge lines, kerbs and barriers
     catch the light; lamps pool light on the road; the headlights reach;
     the skyline, signs and gantries glow. Prefer cheap tricks (emissive
     surfaces, baked pools, bloom) to many real lights.
   - Rain: a wet road that shows the lights, and spray off the tyres.
   - Dusk and dawn: a colour grade and a sun worth looking at.
3. **The camera directs.**
   - The countdown shows off the car and the track (a short sweep that
     ends behind the car before GO). The countdown's length does not
     change and no control is taken.
   - Big moments land: a kick when a big chain is banked, a harder shake
     on a hard hit.
   - The finish: a beat of slow motion as the car crosses the line, with
     the camera swinging side on, then the results. Slow motion is only
     ever after the run has ended.
   - The values in `TUNE.CAMERA` were set by the author through play. Do
     not retune them. Everything you add is additive.
4. **The score reacts.**
   - The number by the car pops with weight, grows and changes colour
     with the chain. A banked chain flies to the total. A lost chain
     breaks.
   - The results: stars land one at a time, coins count up, using the
     sound cues that exist.
   - The results card fits 844x390 with GO AGAIN and NEXT reachable
     without scrolling. Today its bottom is at 526 px on a 390 px screen
     (`review/retention/heading.json` on `main`).
   - System fonts only. Nothing is downloaded.
5. **The world has life.**
   - A road surface with detail: a painted start grid, rubber on the
     racing line.
   - A crowd at the grandstands, with camera flashes as the car slides
     past. Flags that move on the high tier. Fireworks at the finish when
     a star is won.
   - Banners carry invented names only: no real brand, place or game.
6. **Quality that adapts.**
   - Today the tier is chosen once, by core count and backend
     (`LOOK.TIERS` in `game/src/render/scene.js`). Add adaptation by
     measured frame time: sustained slow frames step the quality down
     (density, bloom, pixel ratio). It never steps up during a run.
   - Most players are on phones and Chromebooks, so on the low tier. The
     spectacle must not be a high tier feature: the low tier gets the
     cheap wins (marks, sparks, trails, the score, a readable night).

## Keep

- **The run is untouched.** Nothing here may change the car's inputs,
  the physics steps or the score. A recorded tape must replay to the
  same hash and the same score with every new effect on.
- **The car stays the most readable thing on screen** (`DESIGN.md`
  pillar 4). Its own smoke must never hide it or the road ahead.
- **Every number of taste goes in a named block** (`FX`, `LOOK`,
  `TUNE`), with a one-line comment, for the author to tune.
- **One switch turns the round off.** `?fx=0` shows the game as it is on
  `main` today, so the author can compare the two on his phone.
- The hard limits in `BRIEF.md`: no external requests, 20 MB initial
  load, original designs, 60 fps on the low tier.
- Every probe in `game/test/` must still pass: feel, loop (including
  `loop/quota.js`), tracks, visuals, cars, retention and chapters.
  - `tracks2.js`'s busyness known answer already misses on `main`.
    Report it, do not fix it.
  - `loop/probes.js` takes about 40 minutes. Run it detached with
    `setsid nohup` and wait on the process, not on a grep of its output.
- Australian spelling, and no em or en dashes, in code, comments and
  copy. No model names or session identifiers in commits, code or
  comments. Commit as `git -c user.name="SnapHit"
  -c user.email="nathanhaslewood@gmail.com"` with no trailers.

## Measure, each with a known answer that can fail

1. **Determinism:** a recorded tape on career 1 and on the longest
   Legend track replays to the same hash and score with the effects on,
   and with `?fx=0`. Known answer: a tape with one input changed does
   not.
2. **Night reads:** the contrast between the road and its edge at 20, 40
   and 80 m ahead of the car, at night, at both tiers, against dusk.
   Known answer: night on `main` fails the bar you set.
3. **The car reads:** the share of the car's screen box hidden by its
   own smoke through a long slide, at both tiers and in portrait. Set a
   bar. Known answer: a smoke setting that breaks it.
4. **Frame time:** JavaScript time at 6x CPU throttle on the low tier,
   on career 1 and the longest Legend track, against `main` measured the
   same way; draw calls and triangles per tier against `main`.
   - The sandbox draws in software, so the GPU cannot be measured here.
     Say so. List every effect by what it costs the GPU, so the author
     knows what to judge on his phone and his Chromebook.
5. **Adaptation:** forced slow frames step the quality down. Known
   answer: fast frames do not.
6. **Layout:** the HUD with the new score elements, and the results
   card, at 390x844, 844x390, 800x450 and 1280x720: no overlaps, measured
   by bounding boxes, and the results buttons inside the view.
7. **Before and after:** the same seed and the same moment on `main`
   (`?fx=0`) and on this branch, at both tiers, in all four presets, at
   1280x720 and 390x844, side by side in `review/spectacle/`. Include a
   mid-slide frame at a high multiplier, a wall hit, the countdown, the
   finish and the results.

## Deliver

Commits on `crazygames-spectacle`, pushed after every step, because
usage limits may interrupt you. Never push to `main`.

Finish with `review/spectacle/REPORT.md`:
- first, a phone-readable summary
- the measurements, each with its known answer
- the before and after frames
- what the author should judge on his own devices
- what is not done
- every deviation from this brief

If anything in this brief turns out to be wrong, stop and say so rather
than working around it.
