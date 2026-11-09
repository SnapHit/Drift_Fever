# Brief: career chapters, 24 tracks (10 November 2026)

Branch `crazygames-chapters`. Folders: `game/` (except
`game/src/physics/`, `game/src/audio/`, `game/assets/` and
`game/src/tracks/generate.js`, which must not change), and
`review/chapters/`. Read `../CLAUDE.md` first: the Status section is the
history of every decision since `DESIGN.md`. Then read `../DESIGN.md`,
`../BRIEF.md` (the hard limits), `review/loop/REPORT.md`,
`review/retention/REPORT.md` and `briefs/RETENTION.md`.

## Why

The author has played the whole career. Eight tracks is too few for a
player who comes back: a good player finishes the ladder in an evening.
He asked for more career tracks. The reviewer's advice, which he took, is
to add structure rather than a longer list: three chapters of eight, each
opened by stars, each harder than the last. That gives stars a second
use, sending players back for a third star on tracks they have already
beaten.

## What to build

1. **Three chapters of eight tracks: Rookie, Pro and Legend.**
   - Rookie is today's eight tracks, unchanged: the same names, seeds,
     settings and order, and the same indices 0 to 7.
   - Pro is indices 8 to 15 and Legend is 16 to 23. Keep one flat list
     (`CAREER` in `game/src/loop/modes.js`) and the existing save keys
     (`career:N` and `save.state.career[N]`), so every save, ghost and
     mission flag from today keeps its meaning. Chapters are ranges over
     that list.
2. **Unlocking.**
   - Inside a chapter, a track opens with a star on the one before, as
     now.
   - The first track of Pro opens with `LOOP.CHAPTERS.OPEN[1]` stars won
     in Rookie, and the first of Legend with `OPEN[2]` stars won in Pro.
     First guesses: 12 and 14 (out of 24 in each). Both go in `LOOP`,
     for the author to tune.
3. **The new sixteen tracks.**
   - Each is a fixed seed with settings, generated through the options
     the generator already takes: kind, length, difficulty, the Lab's
     style weights (`LOOP.LAB.STYLES`) and `crossover: 'always'`.
   - Pro should feel a step up from Rookie and Legend a step up from Pro:
     longer runs, more banks, more figure eights, more technical and
     hairpin styles. Circuits and sprints alternate as now.
   - Each track gets an original name, never a competitor's game or a
     real place's trademark.
   - Choose the seeds by measurement, not taste. Every new track must be:
     - finished by the scripted careful driver and the scripted drifter
       with 0 respawns
     - generated in under 600 ms
     - given at least one star by the careful driver driving clean, as
       every Rookie track is now (`CLAUDE.md` Status, 8 November)
   - Record what each candidate seed measured and why it was kept or
     dropped.
4. **The career screen.**
   - The three chapters, each with its eight tracks, stars and mission
     pips, as the screen shows now.
   - A locked chapter shows how many more stars open it, for example
     "8 more Rookie stars to open Pro".
   - The tally in the header covers all 24 tracks and all 72 missions.
   - The screen must be usable by thumb at 390x844 and 844x390, and by
     mouse at 800x450 and 1280x720. Nothing may overlap anything else,
     measured by bounding boxes. The player's current chapter is in view
     when the screen opens.
5. **The heading and the results** (the reviewer added both on 10
   November; read `runHead` and the `unlock` field in `game/src/main.js`).
   - The countdown heading names the chapter, for example
     "CAREER · PRO · TRACK 3 OF 8".
   - The results card says when a run opens a chapter, for example "Pro
     unlocked: <first track's name>", with NEXT going to that track.
   - When a run leaves a chapter one or more stars short, it says how
     many more stars are needed.
6. **The title's career button** shows stars and missions out of the
   new totals.

## Keep

- Do not retune the handling, scoring, star rules, coin rules, missions,
  sound or generator defaults. They are the author's, set by play. Star
  targets for the new tracks come from the existing `starTargets`.
  Missions for them come from the existing `missionsFor`.
- Saves stay additive. A save from today's `main`, with stars, coins,
  missions and ghosts, must load with everything kept and with the right
  chapters open: someone with 12 Rookie stars sees Pro open on their
  first visit after this ships. A corrupted save and storage that throws
  must still play.
- Every probe in `game/test/` must still pass: feel, loop, tracks
  (including `tracks2.js`), visuals, cars and retention (including
  `retention/heading.js`).
  - `tracks2.js`'s busyness known answer already misses on `main`.
    Report it, do not fix it.
  - Some existing probes walk `CAREER` and assume eight tracks. Make each
    one walk the right list, and say in the report which you changed and
    why.
  - `loop/probes.js` takes about 40 minutes. Run it detached with
    `setsid nohup` and wait on the process, not on a grep of its output.
- Australian spelling, and no em or en dashes, in code, comments and
  copy. No model names or session identifiers in commits, code or
  comments. Commit as `git -c user.name="SnapHit"
  -c user.email="nathanhaslewood@gmail.com"` with no trailers.

## Measure, each with a known answer that can fail

1. **New tracks:** for all 16, both scripted drivers finish with 0
   respawns, the careful driver's clean run earns at least one star,
   generation time, the corner and feature mix, and the run length. A
   table, with the Rookie eight measured the same way for comparison.
   Known answer: a seed you rejected fails the check.
2. **The ladder:** chapters and tracks open exactly by the rules.
   - Known answer: Pro stays locked with one star fewer than
     `OPEN[1]`.
   - An old save opens the chapters its stars have earned.
3. **The screens:** career, heading and results at the four sizes, with
   no overlaps, measured. Screenshots in `review/chapters/`.
4. **Frame time:** JavaScript time at 6x CPU throttle on the longest
   Legend track, against Rookie 1 measured the same way.

## Deliver

Commits on `crazygames-chapters`, pushed after every step, because
usage limits may interrupt you. Never push to `main`.

Finish with `review/chapters/REPORT.md`:
- first, a phone-readable summary
- the measurements, each with its known answer
- the track table
- the screenshots
- what is not done
- every deviation from this brief

If anything in this brief turns out to be wrong, stop and say so rather
than working around it.
