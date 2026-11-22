# Brief: the first minute (23 November 2026)

Branch `crazygames-first-minute`, from `main`. Round 2 of `ROADMAP.md`.
Folders: anything under `game/` the work needs, with three limits: no
`render/envmap.js` and no `cars/build.js` (the reviewer is changing how
the cars reflect, on `main`, while you work); in `render/scene.js` only
what the title's backdrop needs, kept small; nothing a rival's own
driving reads (`rivals/roster.js` numbers, `rivals/rival.js`), except
what rule 3 below allows. New: `game/test/first/`, `review/first/`.
Nothing outside `crazygames/`. Never push to `main`.

Read `../CLAUDE.md` first, all of it (the Status entries of 22 and 23
November most of all), then `../ROADMAP.md`, then `../DESIGN.md`.

## Why

CrazyGames rejected the game for overall quality on 22 November. Their
pages say players decide "in the first few minutes", and their FAQ asks
for "a clear goal, smooth and polished gameplay, and quick onboarding".
Round 1 changed the look and the keyboard controls. The first minute is
unchanged, and the only outside player feedback since is against it: a
friend of the author's played it and called **"the initial experience
of the first race track" "clunky"**. The author's reading: **"we might
need to make the first car a player gets a bit more enjoyable to play
with."** Nobody knows yet what clunky means here. Finding out is the
first job, by measurement, before anything is changed.

The author cannot play on a desktop for a while. **Everything in this
round must be judged first on his phone (a Pixel 9, WebGPU, touch, so
Easy controls).** Keyboard players get Pro variant a by default until he
picks one; measure keys too, but touch comes first.

**The goal: a stranger opens driftfever.com on a phone, and within one
minute is sliding the starter car through track 1 on purpose, enjoying
it, with a star on the way and a reason to open the garage; nothing
clunky between opening the page and the first results.**

## What to build, in priority order

Everything behind `?first=2` until the author has played it. Without
the switch the game is exactly `main`'s.

1. **Find the clunk, then fix it.** Drive the first run as a newcomer
   does (from an empty save, cold, CAREER start here, the prompts on)
   with scripted hands that play like a stranger's thumbs: late,
   over-long and over-short presses, the steering buttons held into a
   wall, DRIFT / BRAKE pressed when unsure (on its own it brakes). Then
   measure everything a player could feel as clunky, at least:
   - hitches: frames far over budget in the first 30 s of the first run
     on both backends, and where they come from (a material, smoke,
     sparks or a trail first drawn mid race and built then; the
     director's camera moves; the adaptive quality stepping down);
   - the steering: how quickly a tap turns the car, how far a held
     button turns it, whether a tap is too much or too little at the
     speeds track 1 is driven;
   - the speed: time to pace from the grid, speed lost per wall touch,
     time spent crawling after a mistake (DRIFT / BRAKE on its own
     brakes the car to a crawl);
   - the walls: how often a newcomer's line meets one on track 1, how
     hard, and what the camera and the car do then;
   - the drift: how easily a newcomer's press starts one, how long it
     holds, how it ends (a snap back or a spin feels clunky; a slide
     that comes and goes with the button feels good);
   - the first run's interruptions: the prompts, the countdown, slow
     motion, the camera sweep.
   Say in the report which of these were clunky, with numbers, before
   changing anything. Then fix what is. **The starter car's handling may
   change** for this (more responsive steering, an easier slide, a
   kinder wall, more pace, whatever the numbers point at), as a new
   handling of the starter behind the switch, never `TUNE` for every
   car. Keep the slide a skill: a held, linked chain still has to be
   earned. Look at the director's moves and the prompts too: a cut that
   jars or a prompt that blocks the road is clunk as much as the car.
2. **A star in the first run, and a reason to open the garage.** A
   newcomer's first run of track 1 earns a star more often than not,
   and three stars stay a skill. The results then give a reason to open
   the garage within three minutes of opening the page: something the
   coins already buy, shown, one press away. Stars and coins already
   won are never taken away.
3. **Track 1 as a place to learn to drift.** If the numbers from 1 say
   track 1 itself is the clunk (a corner too tight for a first slide, a
   wall where a newcomer's line goes, the first corner too soon), change
   track 1: its layout, seed or width, so its corners teach the slide by
   doing it. If track 1 changes, Kestrow's race is on it: measure him
   on the new track against the rivals' bar in `CLAUDE.md` (the 13 and
   14 November entries: a clean run, at most 2 of 20 disturbed runs and
   4 of 38 one per cent moves missing) and keep his difficulty where
   the author left it for a newcomer in the starter. A stored best,
   stars and missions on track 1 stay, as `was` in `CAREER` does it.
   If track 1 is not the clunk, leave it and say so.
4. **A live title.** The title's backdrop becomes a scene in motion: a
   car drifting under the floodlights behind the menu, driven by the
   look-ahead driver, framed so it reads behind the buttons and never
   under them. The menu stays exactly as the author approved it (the
   new player's CAREER start here across the top, every row edge to
   edge, `.menu.fresh`). Cheap: within the low tier's budget, and still
   if the device cannot afford it.

Not this round: retuning star targets, rivals or park levels to Pro
(the author's play first), sound (round 3), a backend or leaderboards
(round 4), counting visitors (his call, not made).

## Rules

1. **The switch.** `?first=2` turns everything on. Without it every
   frame of the title and a race is `main`'s (`look/switch.js` against
   `main`), and every recorded run, ghost and rival race replays to the
   bit (`park/same.js`, `controls/easy.js`).
2. **Ghosts and saves.** A run on the new starter handling records it,
   and its ghost replays with it; an old ghost of the starter is not
   raced against the new handling (the roster's `rev` does this per
   car). Saves are additive; nothing in a save is changed or dropped.
3. **Rivals drive as they do.** A rival who drives the starter (look in
   `rivals/roster.js`) keeps the handling he drives today, to the bit,
   whatever the player's starter becomes. Every rival race is the same
   to the bit with and without the switch, except Kestrow's if track 1
   changes under priority 3.
4. **Instant.** The initial download stays at or under 4 MB, and the
   first frame is no later than `main`'s. Nothing is fetched before the
   first tap that `main` does not fetch.
5. **Both backends, both tiers.** Everything new is drawn and read back
   on WebGL 2 and WebGPU (`game/test/webgpu/lib.js`). The Pixel 9 has
   drawn nothing for geometry built unlike the particles: build new
   geometry as the particles are, and list in the report everything his
   phone must confirm.
6. **Presentation and feel only where this brief says.** Score rules,
   park levels, prices and the other cars' handling are not changed.
   Star targets only on track 1, under priority 2.
7. Australian spelling, no em or en dashes, every tunable named in a
   block at the top of its file with a comment, model names and session
   identifiers never in commits, code or comments.

## Measures, each with a known answer that can fail

1. **The clunk.** A newcomer probe in `game/test/first/`: the first run
   from an empty save, scripted thumbs at 390x844 (touch) and keys at
   1280x720, several disturbed runs each, before (`main` from git, as
   `look/switch.js` and `start/boot.js` do it) and after, the same
   inputs on both. A table of every number in priority 1. Known answer:
   a deliberately clunkier setting (the steering slowed to half, say)
   reads as worse on the probe's own numbers.
2. **Hitches.** Frames over 50 ms in the first 30 s of a cold first
   run, on both backends, before and after. Known answer: a material
   built mid run on purpose is caught as a hitch.
3. **A star in the first run.** The newcomer's first runs of track 1:
   at least 7 of 10 disturbed runs earn a star; the careful scripted
   driver still earns no more than two clean. Known answer: `main`'s
   targets with the same hands, reported.
4. **The garage within three minutes.** From an empty save, by real
   presses: title, first run, results, garage, with something
   affordable on show, inside 180 s of game time. Known answer: the
   same path on `main`, reported, and the probe failing if the results'
   pointer is removed.
5. **The live title.** The backdrop moves (pixels change frame to
   frame), the car is in the backdrop's frame and never behind a
   button, and every button's text keeps its contrast over it (the
   lowest contrast over 60 frames). Cost on the low tier: draw calls
   and the game's own work per frame against `main`'s title, within 10
   per cent. Known answer: the car placed under the menu on purpose is
   caught.
6. **Rivals and replays.** `park/same.js`, `controls/easy.js`, the
   Kestrow tape, all six rivals' races with and without the switch.
   Known answer: a rival's tune moved one per cent is caught.
7. **Nothing else changed.** `look/switch.js`, `start/check.js`,
   `start/boot.js`, `play15/check.js`, `ready/sizes.js`,
   `bench/check.js`, `controls/words.js`. Restore other rounds' review
   files with `git checkout -- review/<round>` after running their
   probes.

Look at your own frames after every step, on a phone's portrait and at
1280x720. If a stranger watching the first minute would not want to
keep playing, it is not done.

## How to run things here

- From `crazygames/`, with `PLAYWRIGHT_BROWSERS_PATH=/home/claude/pw`.
  The sandbox has 2 cores: timing numbers are only fair side by side in
  one run, and stable only with the GPU process and the page pinned to
  separate cores (`look/cost.js` shows how).
- The probes stub the frame loop and advance the game with
  `R.runFrames` (`game/test/feel/lib.js`), which asks for Easy unless a
  probe names `controls` or `pro`. Inputs go in through
  `window.__feel.inject`. A probe that needs the real loop (hitches)
  opens the page itself, as `start/boot.js` does.
- On the WebGPU pages (`game/test/webgpu/lib.js`) Playwright's own
  `waitForFunction` can wait forever: poll with `page.evaluate`, as
  `start/boot.js` does. A WebGPU page in software sometimes never gets
  its device: a fresh browser per page, and retry.
- `start/check.js` stops on its park screenshot's 30 s timeout in
  software; raise that one timeout for a run, do not commit it.
- A foreground command dies at ten minutes: split long probes, or run
  them in the background.
- Work in your own worktree; `crazygames/node_modules` there is a
  symlink, never commit it. Commit with the author name and email the
  existing commits use (`git log -1 --format='%an %ae'`), small commits,
  no trailers. **Push the branch after every working step.** Merge
  `main` into the branch before the report, and again if it moves.

## When done

`review/first/REPORT.md`, short, for a phone: what the clunk was (the
numbers from priority 1, before and after), what changed and why, a
before and after strip of the first minute at 390x844 (title, the first
corner, results), the table of measures with their known answers,
everything his Pixel 9 must confirm, what was cut and why, and every
deviation from this brief. Then a play guide for his phone: open
driftfever.com/?first=2 in a private tab (an empty save), play the
first run, then the same in a private tab without the switch, and the
one question: is the first minute better, and is anything still
clunky? If the report file cannot be written, put its full text in your
final message. Do not add a Status entry to `CLAUDE.md`; the reviewer
does that at the merge. If something in this brief turns out to be
wrong, stop that part and say so in the report; do not work around it.
