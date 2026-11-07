# Wiring the new tracks and the world into the game: report

7 November 2026, done by the reviewer after merging `crazygames-tracks-2`
and `crazygames-visuals`. Both sessions left the game asking for flat
tracks. This change switches the rest on and fixes what that exposed.

## In short, for a phone

- The game now asks for the full track: banked corners and, on longer
  circuits, figure eights over a bridge. The car, the ghost, the camera,
  the tyre marks, the smoke and sparks all follow the road's height,
  and the car tilts with the road.
- Career track 3 is now **Crossover**, a 772 m figure eight (seed 1303,
  asked for 820 m). Without it no career track had a bridge: a figure
  eight needs a lap of at least 760 m and the career circuits were 600 m.
- A scripted lap of Crossover, three laps in portrait: 103.5 s, no
  respawns, 5 wall contacts (3 hard). The car is 3.5 m up on the deck,
  pitched 4.2 degrees on the ramp, rolled 14.2 degrees on the steepest
  bank, and 1.5 m down in the cutting under the bridge. Shots are in
  this folder.
- Saved ghosts carry the generator version they were recorded on and
  are ignored on a different one. Nothing stored was deleted, and coins,
  cars, stars and unlocks are untouched.

## Fixed on the way

1. **Bank steps.** A banked piece with no ramps (the middle of a multi
   apex corner) met its neighbour's ramp, which starts from nothing. That
   gave a step of up to 13.3 degrees in two metres on 271 of 400 tracks,
   a twist in the road and a jolt in the car. The bank is now smoothed
   once more over the whole track: 0 of 400 have a step over 3 degrees,
   and the worst is 2.59. That changes every track, so the generator is
   now **version 3**.
2. **Ground showing through the road.** The terrain sat at the nearest
   centre sample's height, ignoring the bank. Its nearest sample came
   from a coarse grid, so it could be another part of the track. Its flat
   triangles also cut across a banked road's low edge. The terrain now
   follows the bank, refines the nearest sample, and drops 1 m under the
   road and its run-off. It stays at ground level beside a bridge, and is
   held down along the cutting. Barriers reach 1.2 m below their base so
   none floats over the lowered ground.
3. **Water over the road.** The sea was one 2,400 m plane at -1.5 m under
   the whole track, and a cutting or a banked corner's low edge went
   under it. It now lies only on the sea's side.
4. **Props on a figure eight.** Furniture placed outside one lobe's
   corner could land on the other lobe's road: a grandstand was 6 m
   inside a barrier and blocked sight lines within 30 m. On a track with
   a crossing, every prop is now checked against every sample.
5. **The racing line** floated up to a metre above a banked road. It now
   lies on it. The menu's orbit camera also follows the start line's
   height.
6. **The edge line** (merge of visuals) stood half under a barrier on the
   road's edge, and the clipping zone glowed brighter than it. The
   generator names the whole judged barrier `clip`, not only its posts.
   The edge now stands 0.25 m in from the edge, and the clip glow is 0.35
   (was 0.9).

## Measured

| Probe | Result |
|---|---|
| Track probes, 200 seeds per kind, with Chromium | all pass; 0 invalid, 0 fallbacks, determinism Node and Chromium |
| Tracks 2 measurements (B, K, X, T) | all pass, every known answer caught; 200 crossover circuits lapped, 0 respawns, 0 layer jumps |
| Occlusion, 28 tracks plus 4 figure eights, 5 themes | 0 props inside barriers (least 1.17 m); ground never above the road, drawn triangles included, worst 0.054 m (budget 0.06); 0 sight lines blocked within 30 m, 0.15% in all |
| Readability, 40 shots | edge brightest by 1.66 at worst (needs 1.35), at least 10 samples a shot; known answer caught at 1.00 |
| Visuals perf, low tier, 6x CPU | JavaScript p95 4.9 ms, 66 draw calls |
| Initial download | 1.42 MB |
| Feel probes | all pass; Node handling byte identical |
| Loop probes | all 22 verdicts pass: the ghost replays frame for frame, career 1 to 6 and the daily run to a results screen with 0 respawns (Crossover 103.5 s), saves survive throwing storage and a corrupt save, JavaScript p95 3.2 ms at 6x |

Corner wall probe, scripted drifter, 80 tracks, per km:

| | contacts | hard | stalls | mean km/h |
|---|---|---|---|---|
| 5 Nov, first generator | 3.06 | 1.46 | 0.07 | 78 |
| busier, flat | 4.74 | 2.72 | 0.43 | 72 |
| busier, banked (the game now) | 4.56 | 2.64 | 0.61 | 74 |

The busier tracks are harder for the scripted drifter, and making their
new corners 2 m wider or their links longer barely moved it. It is a
proxy, not a player. Play decides.

## Probe changes, stated plainly

- Occlusion: tracks are generated as the game asks for them, plus four
  certain figure eights. The road check is now one sided (ground above
  the road fails; lower is right under a bridge or beside a cutting),
  and it also checks the drawn triangles. Beyond the road edge through a
  cutting it is exempt, because the ground rises to the cutting's walls
  there. The known answer lifts the ground 1.5 m (was 0.5), since the
  ground now sits a metre down.
- Readability: samples are placed on the banked road. A sample whose
  edge point is hidden behind the track (a barrier, a crest, a bank) is
  skipped, by ray cast. Samples are every metre (was 2). The known
  answer also turns off the edge's glow.
- Corner probe: drives the tracks as the game asks for them; `--flat`
  gives the old flat tracks.

## Not done

- Nobody has driven a bank or a bridge with thumbs.
- Crossovers appear only on circuits of 760 m or more: one career track
  and some daily circuits.
- Under a bridge the camera now stays 0.6 m below the deck's underside
  (`CAMERA.BRIDGE_CLEAR`), easing down as it nears the deck. Without that
  the portrait camera went through the deck. Measured on Crossover: 41
  frames under the deck in each orientation, the camera never above
  0.6 m under it, and never closer than 3.7 m above the car. It looks
  right in `camera-under-deck-390x844.png`, but nobody has seen it on a
  phone yet.
