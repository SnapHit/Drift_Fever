# Brief: a reason to come back (8 November 2026)

Branch `crazygames-retention`. Folders: `game/` (except `game/src/physics/`,
`game/src/audio/` and `game/assets/`, which are tuned by play and must
not change), `review/retention/`. Read `../DESIGN.md`, `../CLAUDE.md`
(the Status section is the history of every decision since the design),
`../BRIEF.md` (hard limits) and `../ASSETS.md` first, then
`review/loop/REPORT.md` and `review/wiring/REPORT.md`.

## Why

The author has played the game for a week and it plays well. Before it
goes to CrazyGames, where there is one chance with the reviewers and one
chance with each new player, he wants it to be something people come
back to. He chose three things, to be built in this order, each pushed
and working before the next:

1. **First-run onboarding.**
2. **Track missions.**
3. **Track Lab**, a track creator with shareable codes.

## What CrazyGames asks (checked against docs.crazygames.com on 8 November 2026)

- New users land in gameplay immediately; if that is not feasible, at
  most one click before gameplay (`/requirements/gameplay/`).
- Onboarding should land new users directly in play, teach only the core
  mechanics, be skippable, and carry it with visuals rather than text;
  controls shown with a keyboard overlay or gestures (`/requirements/quality/`).
- Text readable at a devicePixelRatio of 1 on 16:9 frames including
  800x450 and 1080x607, and on phones. Desktop is the main target.
- No custom full screen button inside their player (already hidden in
  a frame). Avoid Escape and browser shortcuts as game keys.

Read those two pages yourself (WebFetch) before you design, and say in the
report if anything here is out of date.

## 1. First-run onboarding

- On the first visit (no save, or a save that has never finished a run),
  skip the title: go straight into a run of career track 1 with zero
  clicks. The title appears after that run's results.
- During that run, short visual prompts at the moment they apply: steer
  (left and right, or the keys), DRIFT / BRAKE with steering to slide,
  DRIFT / BRAKE on its own to brake, and what the chain and the clean
  bonus are, each shown once and gone when done. On a keyboard show the
  keys (arrows or WASD, space); on touch point at the buttons. One
  visible SKIP. Never pause the car to explain.
- Remembered in the save (an additive field; see "Saves"). A way to see
  it again from the title is welcome but not required.

## 2. Track missions

- Every career track and the daily drift get three missions, chosen
  deterministically from the track (its seed and its features), drawn
  from a small set such as: hold one drift for N seconds, bank a chain of
  N points, a clean lap or a clean run, clip N clipping zones, finish
  under a time, reach a multiplier of xN. Targets scale with the track
  and its difficulty and must be reachable: prove each mission kind is
  completable by the scripted drivers on some tracks and not trivially on
  all.
- Missions are judged from the simulation and scoring state at the
  physics rate, so a replay of the same input tape completes the same
  missions. Prove it.
- Rewards: each mission pays coins the first time it is completed
  (`LOOP`, a first guess the author will tune) and counts towards a
  mission tally shown on the career list and the title. Missions do not
  change star targets, unlocks or the existing coin rules.
- Show a track's missions without adding a click before gameplay (for
  example on the countdown) and their state on the results screen, with
  a "mission complete" callout and sound cue in the run (use the existing
  `sound.ui` tones; do not add audio files).

## 3. Track Lab

- A TRACK LAB entry on the title. A screen, usable by thumb in portrait
  and landscape and by mouse at 800x450, where a player shapes a track:
  circuit or sprint; length (short, medium, long); style (flowing,
  technical, hairpins, mixed); banked corners on or off; crossover on or
  off (only offered where a figure eight is possible, which needs a long
  circuit); scenery theme; time of day. A plan view from above (reuse the
  drawing in `game/lab/tracks.html`), a NEW LAYOUT button for another
  seed with the same settings, and DRIVE.
- Style needs the generator to take feature weights as an option. Add it
  so that a track asked for without the option is byte identical to
  today's (generator version 4): prove it on 400 seeds.
- Every Lab track has a short code that fully determines it (settings
  and seed), shown on the screen and the results, copyable, and as a
  link (`?track=CODE`). Opening a link lands in that track with at most
  one click. A malformed or tampered code must be rejected with a plain
  message, never a crash or a broken track.
- Lab tracks keep a best score and a ghost per code, for the last few
  codes driven (cap it; the save must stay small). Coins from Lab runs
  are reduced so the Lab is not a coin farm (half rate, no new star
  bonus; a first guess in `LOOP`).

## Saves

Players already have saves with coins, cars, upgrades, stars and ghosts.
Every change is additive: new fields with defaults, repaired field by
field by `repair()` like the rest, never a version bump that throws a save
away. An old save must load with everything kept. Prove it with a save
from today's `main`, a corrupted save, and storage that throws.

## Keep

- The handling, scoring constants, sound and track generation by default
  are the author's, tuned by play. Do not retune them.
- Every probe in `game/test/` must still pass: feel, loop, tracks
  (including `tracks2.js`), visuals (readability, occlusion, perf,
  download). Run them all before you finish; `game/test/loop/probes.js`
  takes about 40 minutes, so run it detached.
- Australian spelling, no em or en dashes, in code, comments and copy. No
  model names or session identifiers in commits, code or comments.
  Commit as `-c user.name="SnapHit" -c user.email="nathanhaslewood@gmail.com"`
  with no trailers.

## Measure, each with a known answer that can fail

1. First visit to gameplay: clicks counted from page load to a moving
   car, first visit and returning visit. Known answer: a forced title
   first must count one.
2. Onboarding shown once, skippable, gone on the next visit.
3. Missions: each kind completed by a scripted run somewhere, the same
   missions completed on a replay of the tape, and a perturbed tape that
   changes the outcome.
4. Track codes: encode then decode gives the same track (hash of the
   centre line) for 1,000 random settings; every malformed code of a
   fuzzed set is rejected; the default generator unchanged on 400 seeds.
5. Saves: old, corrupted and throwing storage, as above.
6. Screens readable at 390x844, 844x390, 800x450 and 1280x720:
   screenshots of every new screen and prompt in `review/retention/`.
7. JavaScript frame time at 6x throttle unchanged within noise.

## Deliver

Commits on `crazygames-retention`, pushed after every step (usage limits
will interrupt you; push so nothing is lost). Never push to `main`.
Finish with `review/retention/REPORT.md`: a phone-readable summary first,
then the measurements and known answers, the screenshots, what is not
done, and every deviation from this brief.
