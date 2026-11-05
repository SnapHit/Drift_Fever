# Brief: more complex tracks (5 November 2026)

Branch `crazygames-tracks-2`. Folders: `game/src/tracks/`,
`game/src/physics/`, `game/test/tracks/`, `game/test/feel/` (to keep the
existing probes passing), `game/lab/tracks.html`, `review/tracks-2/`.
Read `../DESIGN.md`, `../CLAUDE.md`, `../BRIEF.md` (hard limits),
`review/tracks/REPORT.md`, `review/fury/REPORT.md` and
`review/loop/REPORT.md` first.

A visuals session runs at the same time in `game/src/render/` and
`game/src/env/`. Do not change those. It restyles the track by mesh
name, so the contract below matters.

## Goal

The author played the game and wants more complex tracks. He chose
three things:

1. **Busier corner sequences.** Longer chains of linked corners and
   more variety, fewer plain straights. Flowing left right sequences you
   can drift through without straightening, a long multi apex corner, a
   double hairpin, a corner that tightens, one that opens. Straights
   short and rarer, except one longer run on a circuit to breathe and
   build speed.
2. **Banked corners.** Some corners tilted towards the inside, so a car
   carries more speed through them. The physics must feel the bank: in
   a banked corner gravity's sideways share helps the tyres, so the car
   grips more and can drift faster. A flat car on a banked road reads
   wrong, so the car must also be drawn tilted with the road (give the
   scene the bank at the car's position through the world).
3. **Crossovers and bridges.** Some circuits cross themselves: a figure
   eight, the track passing over itself on a bridge. This needs
   elevation where the track climbs to the bridge and falls back, so
   the physics must follow the road's height at least through those
   sections, and the world must know which layer the car is on where
   two parts of the track share the same x and z (today `locate` takes
   the nearest centre sample, which would jump layers). Walls must
   belong to a layer too, so the car under the bridge never hits the
   bridge's barriers and the car on it never hits the road below.

Keep what works: the widths from `review/fury/REPORT.md` (corners about
30 per cent wider than the first generator), generation that stays
fast (median under 100 ms, worst under 600 ms, no fallbacks over 200
seeds per kind), determinism, and the feel the author tuned in
`game/src/tune.js` (do not retune the handling; bank grip is new
physics, tunable in one place).

## The mesh contract for the visuals session

`buildTrackMesh` keeps returning one group named `track`, and every
mesh in it is named for what it is: `road`, `kerb`, `wall`, `clip`
(clipping zone markers), `line` (start, finish, checkpoints), and new
`bridge` (the deck's underside and supports) and `ramp` (where the
track climbs). The visuals session replaces materials by these names.
Keep the names, add any new ones to this list in your report.

## Measure, each with a known answer that can fail

1. Busier: corners per kilometre, share of length in corners, longest
   straight, direction changes, before and after, over 200 seeds per
   kind. Known answer: the old generator must score lower.
2. Banking: on a banked corner the car's maximum steady grip speed is
   higher than on the same corner flat, by about what the bank angle
   predicts. Known answer: bank grip switched off gives the flat number.
3. Crossovers: share of circuits with one, and the scripted driver laps
   200 generated circuits (with crossovers) with no respawn, no layer
   jump (the world's layer never changes except along the ramps) and no
   contact with the other layer's walls. Known answer: the old nearest
   sample `locate` on a crossover track must jump layers.
4. Everything that passes today still passes: the feel probes, the loop
   probes (ghosts must still match frame for frame on the new tracks),
   the track validity and determinism probes, and `npm run build`.
5. Generation time and fallbacks, 200 seeds per kind.

## Deliver

Commits on `crazygames-tracks-2`, pushed after every step (usage limits
will interrupt you). Never push to `main`. Merge `main` in if it moves.
Australian spelling, no em or en dashes, no model names or session
identifiers in commits, code or comments. Finish with
`review/tracks-2/REPORT.md`: a phone readable summary, then the
measurements and known answers, screenshots of six tracks (from above
and riding) including a crossover and a banked corner, what is not
done, and every deviation.
