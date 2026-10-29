# Brief: the drift track generator (DESIGN.md build step 2, in parallel)

Branch `crazygames-tracks`. Folder: `crazygames/game/src/tracks/`,
`crazygames/game/test/tracks/` and `crazygames/game/lab/tracks.html` only.
Read `../DESIGN.md`, `../CLAUDE.md` and `../BRIEF.md` first.

## Goal

A seeded generator for short drift courses, as plain data, plus a mesh
builder and a lab page to look at them. Another session is building the
car and its physics at the same time; it will drive on what you make.

## The data contract, `generateTrack(seed, options)`

Pure JavaScript, no three.js, no DOM, deterministic for a seed. Units
metres, Y up. Returns:

- `kind`: `'circuit'` or `'sprint'`; `length` in metres.
- `centre`: an array of samples every 2 metres along the racing line
  area, each `{ x, y, z, heading, bank, width }` (width is the full
  drivable width there).
- `walls`: left and right wall polylines (and gaps where there is
  run-off), each point `{ x, y, z }`, with a `kind` per span
  (`'concrete'`, `'tyres'`, `'fence'`).
- `clips`: drift judging zones: `{ from, to, side, kind }` in metres along
  the track, kind `'inner'` (clip the apex) or `'outer'` (get close to the
  outside wall).
- `start`: position and heading; `checkpoints`: metres along the track;
  `finish` for sprints.
- `bounds` and a `difficulty` estimate.

Options: `kind`, target `length` (default 600 to 1200 m), `difficulty`
0 to 1. Design for drifting: chains of linked corners, hairpins, fast
sweepers, transitions left to right, chicanes, at sensible widths (10 to
18 m) for a car about 4.4 m long. No self-overlap, no wall closer than
the width, gentle enough elevation that a car never takes off.

`dailySeed(date)` gives the same seed for the same local date everywhere.

## Also

- `buildTrackMesh(track, THREE)`: road, kerbs, walls and clipping point
  markers as plain-material meshes, for both the lab and the game.
- `game/lab/tracks.html`: a page that shows a track from above and in 3D,
  with seed and options controls, so the author can browse them on a
  phone.

## Measure, each with a known answer that can fail

1. Determinism: the same seed gives byte-identical output; a different
   seed gives a different track.
2. Validity over 1,000 seeds per kind: no self-overlap, walls never
   closer than the drivable width, length within the target, every
   corner's radius inside the stated range. Known answer: a hand-broken
   track must fail each check.
3. Drift character: the share of the length in corners, the number of
   direction changes, the longest straight. Report distributions.

## Deliver

Commits on `crazygames-tracks`, pushed often. Do not push to `main` and
do not touch files outside your folders. Finish with
`review/tracks/REPORT.md`: summary first, then measurements, known
answers and screenshots of six tracks.
