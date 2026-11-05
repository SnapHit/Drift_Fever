# Wider corners, faster, more sense of speed (5 November 2026)

After play: too easy to hit walls in corners and stall; it should feel
much faster and more furious.

## Summary

- Corners about 30 per cent wider: hairpins 19 to 22 m (were 15 to 17),
  tight corners 18 to 20 (14 to 16), straights 12.5 to 14 (11.5 to 13).
- Hard wall hits need 6 m/s (was 4) and keep 75 per cent of the speed
  (was 55).
- Faster: 0 to 100 km/h 2.75 s (was 3.37), top speed 184 km/h (168),
  drifts settle at 86 km/h (72).
- More sense of speed: field of view widens 0.5 degrees per m/s (0.35), a
  fine camera rumble above 108 km/h, speed streaks from 100 km/h.
- A drift exit boost (the slingshot) is built into the physics, so ghosts
  stay exact, but **off by default**: with it on, the scripted drifter
  hit walls 1.5 to 2.4 times as often. `?tune=1`, "drift boost s".

## Measurements

`game/test/feel/corners.js` (`corners.json`): 60 generated tracks, both
kinds, difficulty 0.3 and 0.7, the scripted driver drifting every corner.

| | contacts/km | hard hits/km | stalls/km | mean km/h |
|---|---|---|---|---|
| before (original widths and tune) | 2.74 | 1.66 | 0.20 | 75 |
| after, boost off (shipped) | 3.06 | 1.46 | 0.07 | 78 |
| after, boost on (1.0 to 2.0 s) | 4.5 to 4.7 | 2.1 to 2.6 | 0.17 to 0.22 | 78 |

The scripted driver caps its own speed and plans corners for a fixed
grip, so it understates the speed gain and cannot anticipate a boost;
these numbers are a proxy, not a player.

Generation at the shipped widths, 60 tracks: 36 ms median, 230 ms worst,
no fallbacks (original 13 and 148). The first, wider attempt (hairpins
26 to 30 m) fell back on 6 of 12 tracks and took about 3 s each, and was
dropped.

All feel probes (`feel-probes.log`) and loop probes (`loop-probes.log`)
pass, with every known answer caught: replay bit identical, the driver
laps without contact, the drift through hairpin 2 holds 2.35 s, the car
stays on screen in every frame at both viewports, ghosts match frame for
frame, runs finish on generated tracks, saves survive. JavaScript p95 at
6x throttle 3.8 ms (feel) and 5.3 ms (generated circuit with a ghost).

Track validity (`game/test/tracks/probes.js --seeds 200 --only 1,2,3`):
determinism, validity of 200 circuits and 200 sprints (0 invalid, 0
fallbacks) and drift character pass. One check fails: 1 of 100 circuits
asked for at exactly 1,200 m fell back to the default course (which is
valid). The game asks for 600 to 1,200 m, not 1,200 exactly. The full
1,000-seed run was not repeated.
