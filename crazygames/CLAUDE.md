# Project instructions for crazygames/

This folder is **Drift Fever: CrazyGames edition**, a port of the live game
at driftfever.com onto a real 3D renderer for CrazyGames. One simulation,
two renderers. **Read `BRIEF.md` in full before writing any code.** It is
the source of truth, its stages are the build order, and every hard limit
in it is a hard limit here.

It lives inside the Drift_Fever repository as a separate build. The live
game is `index.html` at the repository root (one self-contained file,
Canvas 2D, served by the root Worker). **A crazygames session changes
nothing outside `crazygames/`.** Gameplay changes happen in the root
`index.html` first, in their own session under the root `CLAUDE.md`, and
are re-vendored here by commit. If the renderer appears to need a gameplay
change, stop and say so.

## New direction, 29 October 2026: read DESIGN.md first

The author played the stage 2 greybox and decided the live game's design
does not suit CrazyGames. **The edition is now a new game under the same
name, described in `DESIGN.md`**: a real 3D drift game for teenagers. It
lives in `game/`, ships at `/` on the preview, and is built in the order
DESIGN.md gives, from briefs in `briefs/`.

- The parity rule below now applies only to the greybox (`public/`,
  `sim/`, `parity/`), which stays playable at `/greybox/` for comparison.
  The new game is not bound to the live game's mechanics.
- Everything in "Hard constraints" still applies to the new game, except
  the first bullet (mechanics preserved).
- Parallel sessions each work on their own branch and only in the folders
  their brief names. The reviewer merges to `main`. Never push to `main`
  from a brief's session.
- `tools/build-site.js` copies everything under `game/` into `dist/`
  except `test/` folders, `*.test.js` and folders holding a `.noship`
  file; `game/later/` does not count towards the initial download.

## The one rule that governs the greybox

**The vendored simulation is identical to the original, and the parity test
is what says so.** `sim/drift-fever-sim.js` is generated. Nobody edits it by
hand, ever. A gameplay difference between this build and driftfever.com is
a bug in whichever one changed last, and the parity test fails the build
until it is resolved.

## Layout

```
BRIEF.md                 the brief, verbatim, the source of truth
CLAUDE.md                this file
vendor/original/COMMIT   the commit of the root index.html the simulation is vendored from
vendor/original/index.html  a byte copy of index.html at that commit, for shallow deploy clones
tools/original.js        reads the original: history when reachable, checked against the copy
tools/vendor.js          slices the simulation out of the original, mechanically
tools/vendor.config.js   the renderer boundary: roots, the cut set, replacements
sim/drift-fever-sim.js   GENERATED: createSim(hooks). Do not edit
sim/VENDOR.json          GENERATED: what was taken, cut and replaced, with lines
parity/                  the parity test. README.md explains it
parity/stamp.json        the last passing run, with the hashes of what it covered
parity/REPORT.md         the last passing run's summary
tools/chrome.js          slices the chrome out of the original, mechanically: overlays, input, audio, the frame
tools/chrome.config.js   the world boundary: the Canvas 2D world is cut, render() is replaced
tools/page.template.html the shipped page, around the original's markup
tools/vendor-three.js    bundles the pinned three.js into public/vendor/
tools/serve.js           the dev server: public/ at the root, sim/ and the music beside it
public/index.html        GENERATED: the shipped page. Do not edit
public/chrome.js         GENERATED: createChrome(SIM, WORLD, DOM), the original's chrome verbatim. Do not edit
public/chrome.css        GENERATED: the original's stylesheet. Do not edit
public/CHROME.json       GENERATED: what was taken, cut and replaced, with lines
public/game.js           the host: makes the simulation, the world and the chrome, wires the hooks
public/world.js          the 3D world: three.js, plain shapes, every tunable in WORLD at the top
public/vendor/           three.js, pinned and bundled locally, with its licence
probes/                  the stage 2 measurements: screen agreement, visibility, frame budget, the review set
review/stage-2/          the stage 2 report, its numbers and the screenshot set
ASSETS.md                every asset, with source and licence
tools/build-site.js      assembles dist/, the web root the preview Worker serves: the game at /, status at /status/
wrangler.jsonc           the preview Worker. dist/ is the assets directory
ci/parity.yml            reference copy; the live one is /.github/workflows/crazygames-parity.yml
```

## Commands

```
npm ci                                   once; Chromium: npx playwright install chromium
npm run vendor                           regenerate sim/ from vendor/original
npm run vendor:report                    the closure, the cut set, what was left behind
npm run vendor:pin                       rewrite vendor/original/index.html from the history at COMMIT
npm run parity                           the full parity test, 28 days, ~minutes
npm run parity:quick                     3 days, ~15 seconds, for iterating
npm run parity -- --stamp                full run, and on a pass write stamp.json and REPORT.md
npm run parity:check                     no browser: is the stamp current for these files
node parity/diagnose.js --group "level 2" --key "drive L2 20261001 centre" --quick
                                         where do the two sides part, and on which fields
node parity/render-feedback.js --days 1  does drawing feed back into the original's simulation (slow)
npm run chrome                           regenerate public/chrome.js, chrome.css and index.html from vendor/original
npm run chrome:report                    the chrome closure, its cut set, the simulation names it writes
npm run vendor:three                     rebuild public/vendor/three.webgpu.min.js from the pinned package
npm run serve                            the greybox page at http://127.0.0.1:8787/
npm run probe:screen                     stage 2 "Done" 2: what is drawn against the simulation's numbers
npm run probe:visibility                 stage 2 "Done" 3: road visible ahead, hazards and jumps against the original
npm run probe:perf                       stage 2 "Done" 4: JavaScript time per frame under CPU throttling
npm run probe:shots                      the review set, greybox and live game side by side
npm run build                            parity:check, then dist/ (prints the initial download, fails above 20MB)
```

The parity test now also drives the shipped page (`public/`) through its
own frame function with the 3D renderer attached, by key and pointer
events as well as by the tapes (K8), and checks it is viewport
independent (K9). Any change under `public/` makes the stamp stale, so a
change to the renderer ends with `npm run parity -- --stamp` and a commit
of the stamp, exactly as a change to the module does.

The parity test runs both sides in one headless Chromium on purpose:
Node's Math library differs from Chromium's in the last bit of `sin` and
`exp`, and the comparison is exact. `PLAYWRIGHT_BROWSERS_PATH` or
`PARITY_CHROMIUM` points it at a browser; otherwise Playwright's own.

The original is read from git when the history has the pinned commit, and
the copy in `vendor/original/index.html` must then match it byte for byte
or everything stops. In a shallow clone (Cloudflare's deploy build clones
shallow, which is why the copy exists) the copy is used, and
`parity:check` still compares its sha256 with the one the last passing run
recorded from the history.

## Re-vendoring, when the game changes

1. Write the commit hash of the root `index.html` to vendor from into
   `vendor/original/COMMIT`, then `npm run vendor:pin` to refresh the copy.
2. `npm run vendor:report`. Read the whole report: anything new under
   "browser globals still reachable" or "taken declarations referencing
   suspect names" is a boundary decision, made in `tools/vendor.config.js`.
3. `npm run vendor`, then `npm run parity:quick`, then diagnose and fix the
   config until it passes, then `npm run parity -- --stamp`.
4. Commit the pin, the copy, the config, the generated module, the stamp and the
   report together, with the commit hash in the message.

The boundary is decided one name at a time, in the config, with a reason.
A cut symbol becomes a stub that forwards to a hook of the same name. A
replaced symbol keeps its simulation half and hands its renderer half to a
hook; the original lines are cited beside the replacement. A function that
turns out to do both (the landing lays tyre marks into the road and throws
grit at the screen in the same body) is replaced, never cut.

## Hard constraints, from the brief, which apply to every change

- Greybox only: every mechanic in BRIEF.md "Preserved exactly" is
  preserved exactly. The parity test is the proof and it is part of the build.
- Initial download 20MB or less; 250MB and 1,500 files total; PEGI 12.
- three.js WebGPURenderer with the WebGL 2 fallback as a first class path.
  The lowest quality tier holds 60fps on WebGL 2 on a five year old
  Chromebook, measured.
- The readability rule: the road edge is the brightest and most saturated
  thing on screen in every preset, the road reads against the terrain, the
  player's car is the most findable car, nothing occludes the road ahead.
- The car is an original design, fixed cyan. Never a recognisable real car.
  Never name anything after a competitor's game.
- Assets: commercial use licences only, CC0 preferred, every one recorded
  in `ASSETS.md` with source and licence. No AI generated images as assets.
- Zero external requests and no ads, except through the CrazyGames SDK
  adapter, which is a no-op until Full Launch.
- Signs stay metric, matching the run card.

## How work is done

- Every claim is measured. Every probe carries a known-answer case that can
  fail, and a probe that passes for the wrong reason is a defect of the
  probe. The parity test's known answers are K1 to K5 in `parity/README.md`.
- Pick the statistic that can see the failure. A median hides a few bad
  cases; report the worst case and the count.
- One stage at a time, in the brief's order. Do not design ahead.
- The reviewer commits straight to `main`, one push at a time; brief sessions use their branch. Pushing to `main` is the
  deploy, of the live site and of this preview. A change is not finished
  until it is on `main`. Nothing outside `crazygames/` is touched.
- Australian spelling in comments and copy. No em or en dashes.
- Model names and session identifiers never go into commits, code or
  comments.

## Deploy

The preview is a second Cloudflare Worker that imports this same
repository with its root directory set to `crazygames/`. Its
`wrangler.jsonc` points the assets directory at `dist/`, which
`npm run build` assembles after `parity:check` passes; the build command
is `npm ci && npm run build` and the deploy command `npx wrangler deploy`.
Every push to `main` deploys the live site from the repository root and
the preview from here, with no credentials in the repository or in any
session. The preview URL is https://drift-fever-crazygames.novlrgames.workers.dev/ and every reply to the author ends with it, by his request on 8 November 2026. It is public and
unlisted, by the author's decision on 16 October 2026: no Cloudflare Access.
`SETUP.md` has the exact steps, for the parts only the author can do.

The live site never serves this folder: the root `.assetsignore` is an
allowlist and `crazygames/` is not on it. `/crazygames/` on driftfever.com
is a 404 and that is checked after a deploy.

The deploy build checks the parity stamp rather than running the browser
test, because the Workers build image is not guaranteed to have Chromium: a
push that changes the module, the original's pin or the test without a
fresh passing stamp does not deploy. GitHub Actions runs the full test live
(`/.github/workflows/crazygames-parity.yml`, enabled 16 October 2026) on
every push to `main` or a `crazygames-*` branch that touches this folder.

## Status

- Stage 1: done. The simulation is vendored and parity is proven; see
  `parity/REPORT.md`.
- Stage 2: done and merged 24 October 2026; camera fixed after play on 28
  October. Results in `review/stage-2/REPORT.md`. Now the reference at
  `/greybox/`.
- 29 October 2026: new direction, `DESIGN.md`. The feel prototype
  (`briefs/FEEL.md`) is merged and live at `/`; results in
  `review/feel/REPORT.md`, probes in `game/test/feel/`, handling tuned
  over three rounds of play.
- 31 October 2026: the five car models (`briefs/CARS.md`) are merged:
  `game/src/cars/`, the turntable at `/lab/cars.html`, results in
  `review/cars/REPORT.md`. Open: three pairs are hard to tell apart straight
  from behind at 30 m, and a rear wheel vanishes after a sliding frame in
  the sandbox's software WebGL 2 (`game/test/cars/vanish.js`), untested on a
  real GPU.
- 31 October 2026: the track generator (`briefs/TRACKS.md`) is merged:
  `game/src/tracks/`, the browser at `/lab/tracks`, results in
  `review/tracks/REPORT.md`. For the game loop: the physics is flat, so use
  `{ elevation: 0 }` until the car follows the road's height; draw tracks
  with `buildTrackMesh`, not scene.js's closed loop; generate once per
  track (worst 521 ms).
- 31 October 2026: the game loop (`briefs/GAME-LOOP.md`) is merged and live
  at `/`: title, daily drift with a ghost, an eight track career with
  stars, free drift, a garage with coins, the five cars and paint. Results
  in `review/loop/REPORT.md`, probes in `game/test/loop/`, run settings in
  `LOOP` in `tune.js`. Open: star targets, coins and prices are unbalanced
  first guesses for the author to set by play; the countdown releases the
  car at GO; no upgrades or tilt; the vanishing rear wheel shows in the
  software renderer.
- 5 November 2026, after play: corners about 30 per cent wider, softer
  hard hits, a faster car, more sense of speed (field of view, rumble,
  streaks). A drift exit boost is in the physics but off by default
  (`BOOST_MAX` 0). Results in `review/fury/REPORT.md`, the corner probe in
  `game/test/feel/corners.js`.
- 7 November 2026: busier tracks with banked corners and figure eight
  crossovers (`briefs/TRACKS-2.md`, `review/tracks-2/REPORT.md`) and the
  world around them (`briefs/VISUALS.md`, `review/visuals/REPORT.md`) are
  merged and wired into the game: the car, ghost, camera, marks and
  effects follow the road's height and tilt, and the game asks for the
  full track. Career track 3 is now "Crossover", a 772 m figure eight.
  Fixed on the way, in `review/wiring/REPORT.md`: a bank step of up to 14
  degrees in two metres (generator version 3), ground showing through
  banked roads, props on the other lobe of a figure eight, the edge line
  half hidden under barriers, and saved ghosts from an older generator.
  Open: the scripted driver stalls more on the busier, banked tracks
  (0.61 stalls per km against 0.07 on 5 November); nobody has driven a
  bank or a bridge with thumbs yet.
- 8 November 2026, after play: stars were too hard to earn (four or five
  goes for one star on career 1, none in four on career 2). The first
  star now asks about 45 per cent fewer points, eased further on harder
  tracks (`LOOP.STAR_RATE` 0.3, `STAR_HARD_EASE` 0.3), and the second
  and third are 2 and 3.5 times the first. Career 1 is now 440, 890 and
  1,550; career 2 is 210, 420 and 730.
- 8 November 2026, after play: a whole career earned too little to buy a
  car. Coins are now 0.1 a point (was 0.02), 30 a star (was 25), and 100
  more for each star newly won on a track or the day's daily, shown on
  the results screen.
- 8 November 2026, after play: car upgrades. Every owned car can buy
  three steps each of power, grip and steering (`LOOP.UPGRADE_PRICES`
  250, 500 and 900; effects in `LOOP.UPGRADE`), saved per car and
  recorded with each ghost so it replays the car it was. The four paid
  cars had been left slower than the starter by the 5 November speed-up;
  each is now at least as quick, more so the dearer it is (`rev: 2` in
  the roster ignores their old ghosts). A one-off back pay credits 100
  coins for each career star won before the new star bonus (`starPay`
  in the save).
- 8 November 2026, after play: the run was neither a race nor a drift
  test. Now both pay. Clean driving scores: each sector (between
  checkpoints, and the line) with no wall contact pays its share of 65
  per cent of the first star, and the finish pays 40 per cent of it at
  par pace (`SCORING.PAR_SPEED` 18 m/s), more the faster, so a clean run
  at par is one star; the results split drift, clean and pace. Drift
  chains build faster (`CHAIN_STEP` 1.2 s, was 2) and survive 1.5 s of
  straight (`BANK_GAP`), so they link across corners. Corners are 10 to
  30 per cent longer in radius and 3 m wider, and the links between them
  10 to 26 m (generator version 4). Career 3 Crossover is seed 1327. The
  scripted careful driver now earns exactly one star on every career
  track clean; the scripted drifter one or two.
- 8 November 2026, after play: a full screen button, in the HUD beside
  the exit and on the title (`game/src/ui/fullscreen.js`), shown only
  where the browser allows it (not on an iPhone's Safari). On CrazyGames
  their player has its own.
- 8 November 2026: sound, first pass: the engine and the tyres,
  synthesised with Web Audio in `game/src/audio/sound.js` (every level in
  `SOUND`), nothing downloaded. The engine's note follows the revs through
  six gears and rises with wheelspin; the tyres squeal and hiss with the
  drift angle and speed. It starts on the first tap, pauses while the
  page is hidden, and a sound button in the HUD and on the title mutes it
  (remembered on the device). Hits, scrapes, score and UI sounds and
  music are not done. After a listen the same day the engine was
  rebuilt as a deep V8 (it sounded like a fly), and after a second listen
  ("still buzzy, pitch too high") rebuilt again from exhaust pulses, not
  oscillators: each firing strikes fixed low resonances, rendered into
  six seamless loops at set revs as the sound starts and crossfaded
  (`renderEngineLoop`, `SOUND.V8`), revs 650 to 3,900. An AudioWorklet
  would be the natural home but hangs in the sandbox's headless
  Chromium, so it could not be tested here.
  After play the same morning the tyres "sound like a whistle": the
  squeal is now a pre-rendered screech loop (`renderScreechLoop`,
  `SOUND.SCREECH`): four inharmonic partials of noise with wandering
  pitch, chopped by a random stick and slip at 35 to 110 Hz, over a
  broadband scrub. The author offered to find recordings; a CC0
  recording would beat any synthesis.
- 8 November 2026: the synthesis is gone. The author found two Pixabay
  recordings (engine start and idle, a car drifting), recorded in
  `ASSETS.md`; `game/assets/audio/` holds the starter, a seamless idle
  loop and a seamless drift loop cut from them (24 kHz mono WAV, 460 KB,
  fetched after the first tap). The idle loop is pitched up to 2.1 times
  with the revs; the starter plays at each countdown.
- 8 November 2026: the rest of the sound. Three more Pixabay recordings
  from the author (an engine roaring, two crashes): the engine blends
  from the idle loop into a load loop cut from the roar as the revs rise,
  the whole roar plays at GO, and wall hits play a crash by force. The
  barrier grind and the score and menu sounds (countdown, GO, chain
  banked and lost, clean sector, stars, coins, taps) are synthesised.
  The music is the live game's four tracks, copied to `dist/music/` and
  streamed after the first tap, with its own switch on the title. A
  limiter sits last so nothing clips.
  After play the same day: the load loop and the launch now come from
  the author's supercar revs recording (four steady stretches flattened
  to one pitch and joined), and the effects are about 5 dB quieter
  (`SOUND.MASTER` 0.4); the music's level stayed.
  After more play: the engine sounds a further 4.5 dB down, and the
  DRIFT button reads DRIFT BRAKE (on its own it brakes), with the hints
  to match.
- 8 November 2026: the button reads DRIFT / BRAKE. The title carries the
  SnapHit Studios lockup at the top and the live game's orange and red
  Drift Fever wordmark (`game/assets/brand/`), sized by screen height so
  it fits 390x844, 1280x720 and CrazyGames' 800x450 without scrolling;
  the primary button is orange to match. The full screen button hides
  inside another page's frame: CrazyGames' requirements forbid a custom
  one (docs.crazygames.com/requirements/gameplay, checked 8 November).
- 9 November 2026: a reason to come back (`briefs/RETENTION.md`,
  `review/retention/REPORT.md`). A first visit lands in a run of career
  track 1 with no click, with prompts for steer, slide and brake at the
  moments they apply and one SKIP (`game/src/ui/onboard.js`); HOW TO PLAY
  on the title runs it again. Every career track and the daily has three
  missions from its seed and features, judged at the physics rate, 60
  coins each the first time (`LOOP.MISSIONS`). Track Lab builds a track
  from settings, gives it a twelve character code and a `?track=` link,
  keeps a best and a ghost for the last six codes and pays half rate
  (`LOOP.LAB`). Saves are additive; the generator is unchanged without
  the new options. Open: mission targets, coins and the Lab rate are
  first guesses for play; the hold and chain missions were reached by
  the scripted drivers on 1 and 2 of 9 tracks; WASD does not follow an
  AZERTY layout (CrazyGames' quality page asks for it); `tracks2.js`'s
  busyness known answer misses on main too since generator version 4.
- 10 November 2026, after play: a new player landed in career track 1
  did not know it was a career. Every run's countdown now carries a
  heading over the missions ("CAREER · TRACK 1 OF 8" and the track's
  name; DAILY DRIFT; TRACK LAB and the code), the onboarding run
  included, and a career run's results say "Track 2 of 8 unlocked" with
  NEXT as the main button, or "Win a star to unlock track 2 of 8".
  Measured at four sizes by `game/test/retention/heading.js`.
- 10 November 2026, career chapters (`briefs/CHAPTERS.md`,
  `review/chapters/REPORT.md`): the career is 24 tracks in three chapters
  of eight, Rookie (the old eight, unchanged, indices 0 to 7), Pro and
  Legend, one flat `CAREER` list so every save key keeps its meaning.
  Pro opens with 12 Rookie stars and Legend with 14 Pro stars
  (`LOOP.CHAPTERS.OPEN`, first guesses). The sixteen new seeds were
  chosen by measurement: both scripted drivers finish with 0 respawns,
  the careful driver earns a star clean, nothing occludes the road, and
  each chapter has more banks, hairpins and figure eights than the last.
  "Tangle" was renamed "Over and under" (CrazyGames lists Tangle Master).
  Open: the thresholds want play; the new circuits run 91 to 143 s,
  over DESIGN.md's 60 to 120 s; a save with a scripted ghost on all 24
  tracks is 2.2 million characters, and a failed write saves nothing
  after it; at 844x390 the results card scrolls to reach its buttons (as
  it did before chapters).
- 10 November 2026: the save survives full storage. A refused write
  used to leave nothing after it remembered, coins and stars included.
  Now the oldest ghosts go, one at a time, until the save fits
  (`write` in `game/src/loop/save.js`, the author's decision); stars,
  coins, cars and missions are never touched, and nothing is dropped
  when the storage is broken, not full. Measured in Node by
  `game/test/loop/quota.js`.
- 11 November 2026, the spectacle round (`briefs/SPECTACLE.md`,
  `review/spectacle/REPORT.md`): presentation only, nothing read by the
  physics or the score. Smoke, tail-light trails, brake lights, exhaust
  flames, sparks and marks that climb with the multiplier
  (`SHOW` in `env/show.js`); lamps with pools of light, barrier tape, a
  start grid, flags, camera flashes and fireworks (`DRESS` in
  `env/dressing.js`), so night tracks read; a camera director over the
  chase camera for the countdown sweep, the banked chain's kick, the
  hard hit and slow motion with a side on view from the line
  (`DIRECTOR` in `camera/director.js`; `TUNE.CAMERA` untouched); a score
  that pops, heats and flies to the total (`HUD_SHOW`); a results card
  in two columns that fits 844x390. One switch in `game/src/fx.js`:
  `?fx=0` is the game as it was before the round, and `?fx=none` is
  what `?fx=0` used to mean (no particles). Quality adapts
  (`LOOK.ADAPT` in `render/scene.js`, `?adapt=0` turns it off): half of
  the last 90 frames over 22 ms steps down through fewer particles, no
  bloom, then 80 and 65 per cent pixel ratio; it never steps back up,
  but if the steps bought no shorter frames (a device capped at 30
  frames a second) it gives everything back once and stops. Probes in
  `game/test/spectacle/`. Open for play, since the sandbox draws in
  software: frame rate on the phone and the Chromebook at night mid
  slide; whether the smoke is enough by day and too pink at night
  (`SHOW.SMOKE`); whether a second of slow motion is a beat or a wait
  (`DIRECTOR.SLOW`); the lamps' strength and colour; nothing has run on
  real WebGPU. Not done: lit windows in the night skyline, headlights
  reflected in a wet road, sight lines past the new lamp row
  (`visuals/occlusion.js` does not place it). When the bloom is dropped
  on the high tier the colour grade goes with it.
- 11 November 2026, the rivals round (`briefs/RIVALS.md`,
  `review/rivals/REPORT.md`): a tandem battle. A named rival leads a
  run of his career track in his own physics world, stepped in lockstep
  with the player's and driven live by a look-ahead driver
  (`game/src/rivals/`); he reads only his own world, so he is the same
  every time and the player never moves him. The player's drift points
  count up to 2.5 times while both slide and the player is close behind
  or beside him (`TANDEM` in `tune.js`, `scoring/tandem.js`); he is
  solid, and a hard touch loses the chain. The player wins with a total
  at least his. Battles gate nothing, pay coins and a first-win prize,
  earn no stars or missions, keep no ghost, and add `rivals` to the
  save. With no rival every run is the same to the bit (main's tapes
  replay). **Only the first rival, Kestrow on career 1, is in the
  game** (`TANDEM.LIVE` 1): he passed every measure and the scripted
  chaser beats him 9 times in 12 in the starter, 0 in 12 with the bonus
  at nothing. The other five (Tolvo, Varsk, Dovane, Halvik, Sarrow) are
  built and wait behind `?rivals=all`: under small disturbances 2 to 6
  runs in 20 miss the driving bar each, the chaser never beats Tolvo or
  Varsk, and it beats Dovane without the tandem. Open for play: whether
  chasing Kestrow is a thrill (the chase camera sits high, so he looks
  small), the zone and bonus numbers, frame rate in a battle on real
  devices, a First slide battle is about 45 s. Not done: the lead run
  (the rival chasing), a rival's sound. `lab/cars.html` is broken on
  main too (it reads `LOOK.SUN_DIR`, which is gone). Two rounds are
  proposed and not started: garage, playground.
- 11 November 2026, after play of the tandem battle: three findings.
  (1) **The battle is counterintuitive and is to be rebuilt as a drift
  race** (`briefs/DRIFT-RACE.md`, the author's choice): a one on one
  reads as a race, the tandem paid for staying behind, and the player
  cannot hold station because he has no throttle or brake (steering
  and one button; the rival's driver and the scripted chaser both
  lifted and braked, so the fairness measurement proved nothing about
  a player). Start level, highest score wins, a bonus for leading at
  each checkpoint and the line, close slides pay in any position, and
  the rival gets only a player's controls. Not started.
  (2) Nothing said what a clipping zone was. The mission now reads
  "Slide close to N orange walls" and the callout "ORANGE WALL x2".
  (3) "The corners aren't sharp enough to get a drift going" on Harbour
  run. A drift corner is one of at most 42 m radius turning at least 85
  degrees (`game/test/stars/slot.js`); Harbour run and Crossover had
  none, every other career track has two or more. Both have new seeds,
  the author's choice over lower targets: Harbour run 1248 (four drift
  corners) and Crossover 1422 (six), each passing the chapters round's
  bar, and the plain scripted drifter now earns two stars on each. `was`
  in `CAREER` names the old seed: stars, bests and missions stay, and a
  ghost with no seed of its own on those slots is ignored (new career
  ghosts record their seed; `game/test/stars/ghost.js`). Three stars
  was never impossible, though: the look-ahead driver held to a
  player's controls (`opts.hands` in `rivals/rival.js`) scores 2 to
  6.9 times the three star target in the starter on all 24 tracks
  (`game/test/stars/reach.js`, `review/stars/reach.jsonl`), by linking
  one chain through a whole run. So the targets are reachable by a
  machine and nobody knows yet whether by thumbs.
- 12 November 2026, the drift race (`briefs/DRIFT-RACE.md`,
  `review/driftrace/REPORT.md`): the tandem battle rebuilt as a race
  won on points. Both cars start level; the score is the solo score
  plus a lead bonus to the first car through each checkpoint and lap
  line and a larger one to the first across the finish
  (`scoring/lead.js`; `TANDEM.LEAD_SHARE` 2.2 and `LINE_SHARE` 1.0 of
  the first star), and close slides pay the player up to 1.6 times in
  any position. The rival banks leads too. **His driver now has only a
  player's hands** (throttle always on, no brake; a guard in
  `rivals/rival.js` counts 0 inputs changed over his race), and so has
  every scripted player in `game/test/driftrace/`. Kestrow runs four
  laps of First slide in 75 s for 2,662 of his own. The report's
  numbers were measured at the round's first shares (0.45 and 0.3), at
  which a player who led all the way and never slid lost 1,182 to
  2,680, so leading was worth nothing; the reviewer raised them so that
  player about ties (2,672 to 2,662) and any sliding wins it, and a
  player who slides well but trails all the way now loses narrowly
  (4,196 to 4,585). At these numbers, over 20 disturbed races, the grip
  player wins 9, the slide player 12 and the mixed player 6. Still
  failing the brief's bar: the mixed player does not win every race,
  the place does not change hands in 3 of 20 mixed races, a player
  parked on his line is carried for 1.2 s (bar 1 s), and the pin
  release never acts in any scenario. Only Kestrow is in the game; the
  other five drive with a player's hands now and are unmeasured. Open
  for play: whether the race feels like one, the size of the lead
  bonus, contact into the first corner from a level start, the camera's
  move from the grid into the chase view, frame rate (JavaScript p95
  15.1 ms of 16.7 at 6x throttle with a scripted player). Kestrow
  steers at depths a gamepad can give and a phone cannot (a phone's
  steering is -1, 0 or +1). `spectacle/night.js` fails one low tier
  moment on Crossover since its new seed.
- 13 November 2026, the rivals ladder (`briefs/RIVALS-LADDER.md`,
  `review/ladder/REPORT.md`), after the author could not see when a
  race was offered (once, then one card in the career list). Rivals
  have their own screen behind a RIVALS button on the title: all six in
  ladder order, each with his car in his paint drawn by the game's
  renderer (`ui/portraits.js`), his style, track, laps and prize, and
  one of four states: what earns him (ticked as done), RACE, BEATEN
  with the best margin and still raceable, or SOON for one not in the
  game. Earning is as it was, a star on his track and a win over the
  rival before, now a strict chain (a win counts only over a rival who
  was earned). The title's button shows how many are beaten and a RACE
  mark when one is earned and unbeaten. A career result on a rival's
  track offers his race every time he is earned and unbeaten; a race's
  results name the next rival and offer him or say what earns him.
  **Two rivals are in the game** (`TANDEM.LIVE` 2): Kestrow, and Tolvo
  on Tight city in the hatch over three laps (83.5 s, 4,849 of his own;
  in the starter the scripted grip player beats him 0 times in 20, the
  slide player 3, the mixed player 8). Tolvo's corner entry speed was
  set by hand and is on a knife edge (26.2 passes, 26.0 and 26.3 fail),
  though 20 disturbed runs all pass. The ladder stops at Varsk, who
  fails: on every Pro circuit the scripted slide player is 14 to 17 s
  slower over three laps than the other two, so no rival pace gives all
  three a race. That is a fault of the measuring players, not shown to
  be one of the rival. Dovane, Halvik and Sarrow were measured and not
  searched again; Halvik and Sarrow are far too easy (Sarrow scores
  856). The four wait behind `?rivals=all`. The pin release is proved
  (`game/test/ladder/pin.js`). The parked player's 1.2 s hold is the
  game's own stuck recovery (`TUNE.ASSIST.RECOVER_AFTER`), not the
  rival. No screen is reachable by gamepad. Next for the ladder:
  scripted players that are a fair measure on Pro and Legend tracks,
  then rivals three to six. Two rounds are proposed and not started:
  garage, playground.
- 12 November 2026, the rest of the ladder (`briefs/RIVALS-LADDER-2.md`,
  `review/ladder2/REPORT.md`): **stopped at its first priority; still
  two rivals in the game, nothing a player sees changed.** The brief
  was at fault. Its staircase (the three scripted players' wins of 60
  falling from 27 against Kestrow to 12 against Sarrow) was anchored on
  the old players and then asked for new ones: with players searched
  per track to finish within 10 per cent of each other, Kestrow scores
  18 (grip 16, slide 1, mixed 1), because the slide and mixed players
  got quicker by sliding less. A ruler tuned for pace is a poor ruler
  for a race won on points. Kept from the round: `PLAYERS.AT` in
  `rivals/players.js` (per track players, used only by probes; pass on
  First slide alone); `game/test/ladder2/plateau.js` (each driving
  number one per cent either way: Tolvo misses 9 of 38 moves, Kestrow
  13 of 38); all six measured as they stand (Varsk to Sarrow fail the
  driving bar itself, whatever the ruler); and the new player test,
  `game/test/ladder2/newplayer.js`: the shipped build from an empty
  profile by real touches at 390x844 and keys at 1280x720, replaying
  rehearsed presses, `--origin` for the deployed build. It passes but
  for aborted music streams, most likely the sandbox's Chromium having
  no AAC decoder. What it found for a newcomer is in the report (a
  rival offered before the title is seen, "0 LEVEL", the race table,
  Tolvo's track locked without saying so, four SOON cards, 36 px HUD
  buttons). Next for the ladder, if the author agrees: search each
  remaining rival's driving first, and set difficulty by his own
  points a second against his track's three star rate and a pace the
  strong driver with a player's hands can beat, with the scripted
  players only as a sanity check.
- 13 November 2026, the ladder's second attempt
  (`briefs/RIVALS-LADDER-3.md`, `review/ladder3/REPORT.md`): **still
  two rivals in the game, nothing a player sees changed.** Tolvo found
  no plateau in three rounds (best 4 of 38 one per cent moves missing,
  main's 9), so he is unchanged. The chain stopped at Varsk: his
  closest driving (20 of 20 disturbed runs, 2 of 38 moves missing) is
  in the roster behind `?rivals=all`; the strong driver finishes 1.5
  to 4.5 s behind him and scores up to 14 per cent less. Two things
  learnt, both about the bars and not the rivals. One: a zero-miss
  plateau has never been passed by anyone, Kestrow included (13 of
  38); the look-ahead driver picks another line when a number moves
  one per cent, so the bar should allow a miss or two or the driver
  needs changing. Two: "finish first AND outscore him by a quarter"
  asks for opposite things, because sliding scores and costs time. The
  strong driver outscores Kestrow by 20 to 46 per cent and is 3.5 to
  7.9 s behind; the grip player gets home first and scores less.
  Judge headroom on the total a player can reach (points plus what
  getting home first is worth), not on both at once. Kept: the ruler
  (`game/test/ladder3/ruler.js`: multiples of the three star rate
  1.93, 3.69, 4.37, 2.19, 1.18, 3.09 up the ladder, so Dovane and
  Halvik are below Kestrow as they stand), `drive.js`, `search.js`,
  `candidate.js`. Do not start a third search round on the same bars.
- 13 November 2026, after play with all six (`?rivals=all`, the best
  car fully upgraded): the author's decisions, and `review/play13/`.
  (1) **All six rivals are in the game** (`TANDEM.LIVE` 6); they "work
  well and just need tweaking", and from here they are tuned by his
  play, not by a machine ruler. Nothing is SOON. Known as they stand:
  Dovane and Halvik score slower than Kestrow, Sarrow scores 856 when
  nobody is near him, and those three hit walls in some runs.
  (2) He led Varsk all the way, was 12 s clear at the line, and lost
  5,029 to 6,581 while the HUD said "HE LEADS" over "1ST +11.1 s". Two
  changes. The words: the pill is the points gap ("1,637 PTS BEHIND",
  "MOST POINTS WINS" on the grid, never "leads"), the place under the
  car adds what first is worth as things stand ("+1,765 AT THE LINE"),
  and the grid's heading and the results say most points wins. The
  rule: **leading counts for more**, his reasons being that it is what
  a player expects and that it rewards an earned, upgraded car. When
  the player is first home he is paid for every second he is clear of
  the rival (`TANDEM.MARGIN_SHARE` 0.25 of the first star a second, up
  to `MARGIN_CAP` 12 s; `lead.margin`, shown in the First home row).
  That race would now be won by 357. The rival is not paid it, so a
  player who trails scores exactly as before and Kestrow's balance for
  a newcomer is untouched; recorded races replay to the same totals.
  Both numbers are first guesses for play.
  (3) Newcomer fixes: HUD buttons 44 px (were 36), SKIP 44 high, the
  career's back arrow no longer squeezed; a locked rival whose track
  the career has not opened says so on his card ("Rookie track 5, not
  open yet"). `game/test/play13/check.js` measures all of it at three
  sizes. The author plays in a normal browser with a full save, so the
  true new player run is still to come, by him.
- 13 November 2026, **rivals are complete, by the author's word**: he
  beat all six in the best car fully upgraded. His best margins showed
  the ladder upside down (Kestrow +1,672, Tolvo +1,276, Varsk +262,
  Dovane +1,139, Halvik +3,632, Sarrow +3,668), so the last three were
  reset from a scan, not a search (`game/test/play13/scan.js`: every
  track of each one's half of his chapter, every car, upgrade step and
  proven driving; `review/play13/scan.json`, `page.json`). Dovane:
  Tolvo's driving in the tourer with two upgrade steps, three laps of
  Over and under, 94.0 s for 4,086, clean, 0 of 20 disturbed runs miss
  (was 1,897 with 2 hard hits). Halvik: his own driving moved from
  Knot yard to High wire, three laps, 92.1 s for 4,338 with one scrape
  (was 1,234 with 5 hard hits); fragile, all 20 disturbed runs miss
  the bar, mostly by one hard hit, so another browser's arithmetic may
  put him into a wall. Sarrow: Varsk's driving in the plain starter,
  three laps of Endless eight, 94.2 s for 5,201, clean, 0 of 20 miss
  (was the fastback with 9 hard hits); his line is now "Beats you in
  the starter coupe". Points a second: 35, 58, 70, 43, 47, 55, so
  Varsk is still the peak and Dovane is still below Tolvo. Halvik now
  needs a star on High wire. Stored best margins over the old three
  stay in a save and flatter the new ones. Still unknown: whether a
  newcomer in the starter can beat Tolvo.
- 13 November 2026, the author's plan for the end: **when everything
  else is done this game becomes the one served at driftfever.com and
  the original moves to a sub URL.** He thinks it far the better game
  and means to promote it. Not started. It breaks two rules above on
  purpose (this folder never served from driftfever.com; a crazygames
  session changes nothing outside `crazygames/`), so it is its own
  session under the root `CLAUDE.md`, which must be rewritten with it,
  and needs his go-ahead at the time: the root Worker's assets
  directory, `.assetsignore` and `publish-check.sh` all change, saves
  on the old game live under the root origin and must keep working at
  its new address, and old links to the root game should still land
  somewhere sensible.
- 14 November 2026, after the author's own new player run (incognito,
  from an empty save; he beat all six rivals and calls the game
  excellent). Four findings.
  (1) No path from a race's results back into the career: the results
  now carry it. After a win with no new rival to race, NEXT TRACK (the
  first open track never finished, else the first short of three
  stars) is the main button; otherwise CAREER sits under REMATCH
  (`careerNext` in `main.js`).
  (2) He never needed tracks 6 to 8 of Rookie or Pro. **A chapter now
  opens only when every track of the one before has been finished, as
  well as its stars** (`tracksToOpen`, `chapterNeeds` in
  `loop/modes.js`); a save with a run already in a chapter keeps it.
  (3) Too easy: he had the fastback bought and upgraded by the start
  of Pro and never drove anything twice. First step, the economy: cars
  2,500, 5,500, 10,000 and 16,000 (were 900, 1,800, 3,200, 6,000) and
  upgrade steps 400, 900 and 1,800 (were 250, 500, 900); the payout is
  unchanged, about 7,500 for one clean pass of a chapter, and owned
  cars stay owned. Second step, quicker later rivals:
  `briefs/RIVALS-PACE.md`, a background build. Star targets are left
  alone until both are played. All first guesses for play.
  (4) His chosen paint sometimes does not show in a race. Not found by
  reading (every run reads the saved paint); paint is kept per car, so
  a newly bought car starts in its own colour. Deferred by him.
  `game/test/play13/career.js` measures 1 to 3. Not rerun: the
  chapters and garage rounds' own probes, which may now disagree with
  the new rule and prices.
- 14 November 2026, the pace round (`briefs/RIVALS-PACE.md`,
  `review/pace/REPORT.md`): quicker later rivals, two of three. Each
  was searched on his own for more points a second and passes all
  three bars (a clean run in the page, at most 2 of 20 disturbed runs
  and 4 of 38 one per cent moves missing). Dovane: the plain fastback,
  three laps of Over and under, 83.8 s for 6,961, x5.55 of the three
  star rate (was x2.90). Sarrow: the starter with one step of each
  upgrade, three laps of Endless eight, 77.9 s for 5,914, x5.40 (was
  x3.93). **Halvik missed his target** (x4.9): the best that passes
  the bars is the plain hatch over two laps of High wire, 68.6 s for
  3,509, x3.57 (was x3.29 and fragile; he is now robust), and his line
  is "Short and sharp in the light hatch". So the ladder reads 1.93,
  3.69, 4.37, 5.55, 3.57, 5.40: it climbs to Dovane, dips at Halvik,
  and Sarrow sits just under Dovane. High wire and Knot yard were the
  only circuits open to Halvik (the other two in his half are sprints
  under 60 s); a harder Halvik needs another track or a longer search.
  What moved the searches was starting from random drivings
  (`game/test/pace/explore.js`), not from the old ones. Nobody has
  raced the new three: whether a player can beat Dovane at 83 points
  a second is for play. Stored best margins over the old three stay
  in a save.
- 14 November 2026, CrazyGames readiness, first two pieces
  (`game/test/ready/`, `review/ready/`). Their pages were read the same
  day: the quality guidelines ask that keys follow the keyboard's
  layout (their example is ZQSD on AZERTY); nothing on the gameplay,
  technical or quality pages asks for a gamepad, so pad menus are a
  nicety, not a requirement. (1) Letters are bound by where the key
  sits (`e.code` in `input/input.js`), so ZQSD works on AZERTY with no
  rebinding, and the first run's key caps print what the keys at A and
  D print where the browser can say (Chromium's keyboard map).
  (2) Every menu works by gamepad (`ui/padnav.js`, `PADNAV`): d-pad or
  stick moves a focus ring to the nearest button that way, A presses,
  B goes back; in a run the back button (select) leaves for the title
  or skips the first run's prompts. The ring shows only once a pad is
  used. `ready/pad.js` proves every enabled button on title, career,
  rivals, garage and lab is reachable at three sizes. Not measured: the
  results screen by pad, and a real controller (the probe feeds button
  states). Still to do for readiness: the SDK adapter (their script is
  an external request and their SDK throws on any other domain, so it
  must load only when the game is on CrazyGames; the Basic launch needs
  one "Gameplay start" event), frame
  rate on a real GPU and a 4 GB Chromebook, the ten iframe sizes from
  800x450 to 1920x1080 at pixel ratio 1.
- 14 November 2026, after the author's second empty save run: Kestrow
  and Tolvo fell to the starter, Varsk only to a bought and upgraded
  grand tourer, which he had about enough coins for ("just about
  perfect"). Dovane could not be beaten in the best car he could
  afford. Three changes, `game/test/play14/check.js`.
  (1) Nothing told him to buy a car. A lost race with a rival not yet
  beaten now points at the garage (`garageTip` in `main.js`): from the
  first loss when the rival's car is dearer than the player's ("Varsk
  drives the fastback."), else from the second loss to him in a visit
  (`LOOP.GARAGE_TIP_LOSSES`). It names the dearest car the coins will
  buy, else says an upgrade is affordable, else says to earn coins in
  the career. From the second loss, with something to buy, GARAGE is
  the results' main button. Losses are counted for the visit, not
  saved.
  (2) Dovane "just a little" too fast: his slide gain is 1.3, was 1.5:
  83.3 s for 6,464, x5.18 (was 6,961, x5.55), 0 of 20 disturbed runs
  and 0 of 38 moves miss. The ladder reads 1.93, 3.69, 4.37, 5.18,
  3.57, 5.40.
  (3) Touching him wiped the player's chain and cost him nothing. **A
  hard touch with the rival now banks the chain** as it stands
  (`TANDEM.HIT_BANKS`); the multiplier starts again and the speed loss
  is as it was. A wall still loses it. The recorded Kestrow race
  replays to the same totals. Halvik and Sarrow are still unplayed
  since the pace round.
- 14 November 2026, the CrazyGames SDK adapter (`game/src/sdk/`,
  `game/test/ready/sdk.js`). **The preview and driftfever.com never
  load their script**: it is an outside request, and their SDK is
  "disabled" (every call throws) on any domain but theirs and
  localhost. The build says where it is hosted in one line,
  `src/sdk/host.js` (`'web'`), and only **`npm run package:crazygames`**
  (after `npm run build`) writes `'crazygames'`, into
  `dist-crazygames/`: the new game alone, without the greybox, status
  and lab pages, 84 files and 12.1 MB with the music. That folder,
  zipped, is the upload; it is not committed. In their player the
  adapter loads their v3 script, awaits `init`, and sends
  `gameplayStart` when a run begins (the countdown included) and
  `gameplayStop` at its results or a menu, each once; what the game
  asked for while the script loaded is sent when it is ready. Their
  optional loading events are not sent (the boot is over before their
  SDK is ready). No ads, banners, user or data module. A blocked
  script, a rejected init, a disabled environment or a throwing call
  each leave the game as it is on the web, measured with a stand-in
  SDK. Not measured: their real script, which needs their QA tool or a
  localhost run of the package by the author. Their docs give no list
  of their domains, so the host is a build line, not a guess at a
  hostname. Readiness still open: their ten frame sizes, frame rate on
  a real GPU and a 4 GB Chromebook.

- 14 November 2026, the garage round (`briefs/GARAGE.md`,
  `review/garage/REPORT.md`), the author's scope: cosmetics and a
  showroom, **nothing that changes how a car drives**. The garage is
  now the picked car on a turntable in a studio of its own
  (`garage/showroom.js`), dragged to turn, with six sections beside or
  under it: Cars, Paint, Wheels, Glow, Smoke, Upgrades. A press
  previews, BUY buys; previews never reach a save or a race. Five
  wheel designs (`cars/wheels.js`), five underglow colours and five
  smoke colours (`SHOW.UNDERGLOW`, `smokeColours` in `env/show.js`),
  bought and kept per car (`wheels`, `glow`, `smoke`, `own` on each
  car in the save; `garage/cosmetics.js`), prices in `LOOP.COSMETICS`:
  all fifteen on one car are 7,500, the dearest 1,200, first guesses
  for play. Ghosts record their look; Varsk, Dovane, Halvik and Sarrow
  wear wheels (`look` in `rivals/roster.js`), drawn only. Recorded
  runs and the Kestrow race replay to the bit; an old save loads
  unchanged; a save from this build loads in the build before it, but
  that build writes the cosmetics away and the coins do not come back
  (a rollback only). Paint now previews first and needs PAINT IT, and
  is still not kept once changed (60 again), which sits oddly beside
  OWNED wheels. **The readability rule's "most saturated" half was
  never true**: the road edge measures 0.08 to 0.19 of full
  colourfulness and kerbs, walls and tail-lights 0.55 to 0.81 with no
  glow at all, so the glow is held to brightness (edge at least x1.11
  brighter) and to adding 15 per cent less to the road than the edge
  stands over it (`game/test/garage/readable.js`); margins at night
  are thin. Probes in `game/test/garage/` (`run-all.sh`). Open for
  play, all drawn in software here: whether the showroom makes him
  want the next wheel, wheels at race distance on a phone (about 12
  pixels across, told apart by colour), glow strength, Rose smoke
  against the standard red at night, the prices, frame rate (no
  JavaScript cost the probe can see; GPU cost unmeasured). Next: the
  playground round (a stunt park with challenges), approved.
- 14 November 2026, the playground round (`briefs/PLAYGROUND.md`,
  `review/park/REPORT.md`), the author's scope: a stunt park with
  challenges, no timer. Free drift's ground is now a 300 by 200 m
  walled park (`park/layout.js`, drawn by `env/park.js`): a gate ahead
  of the start, a donut pad, twin pillars for a figure eight, seven
  cones, a long curved orange wall, a second gate. Eight challenges
  (`park/challenges.js`, numbers and coins in `LOOP.PARK`): donuts,
  figure eight, slalom, wall ride, gate crasher, long slide, big
  chain, grand tour, each with bronze, silver and gold, 24 levels
  paying 7,500 in all, each once (`park` in the save; a higher level
  first pays the lower with it). A level is won the moment its count
  is reached, with a live readout under the total. The title's button
  is STUNT PARK and opens the list, where DRIVE starts the park (one
  press more than before); a HUD button, L or Tab, or a pad's top face
  button opens the list in the park. The physics, cars, rivals and
  score rules are untouched. Scripted hands with a phone's inputs
  reached all 24 levels, gold in the plain starter on six of eight
  (slalom gold needed the upgraded hatch, gate gold the upgraded
  fastback), so gold is patience more than car for a machine. Brief
  deviations forced by the physics: every solid is round and 4 m
  through (thin walls cannot be built: the physics pushes back points
  up to 2.5 m behind a face), the long wall is curved, the cones are
  30 m apart. **`ladder2/determinism.js` fails on a newer Chromium, on
  main too**: its stored hashes in `review/ladder2/main.json` were
  recorded in another Chromium build, and the physics is the same to
  the bit only within one browser build. `game/test/park/same.js` is
  the measure now: main (from git) and the working copy side by side
  in one browser. It also means a rival's race can differ a little
  between browsers, as the 13 November entry feared for Halvik. The
  sandbox's browsers moved the same day: point
  `PLAYWRIGHT_BROWSERS_PATH` at a folder holding
  `chromium-<n>/chrome-linux/chrome` (the probes' `findChromium` does
  not know `chrome-linux64`). The first writing of this round was lost
  with the machine before any push: **brief sessions push after every
  working step.** Open for play: whether three things to try are seen
  within five seconds (the park is sparse at night at speed), the
  targets and coins, the curved wall's 2.5 m lane on a phone, the
  pillar fade, list first then DRIVE. Not measured: a real GPU, a
  phone, thumbs, the high tier's frame cost.
- 15 November 2026, after the author's third empty save run and his
  first of the stunt park ("brilliant" in the drift build fully
  upgraded). Three changes, `game/test/play15/check.js`.
  (1) **A rival's drift counts at a share** (`TANDEM.RIVAL_DRIFT` 1,
  `driftShare` in `rivals/roster.js`, `points()` in `rivals/rival.js`).
  In the fastback he found Varsk's and Dovane's pace "more or less
  perfect" and their drift points about double his own: Varsk beaten
  only just after many tries, Dovane never. Their driving is untouched;
  the race counts Varsk's drift at 0.9 (6,001 of his own, was 6,581),
  Dovane's at 0.75 (5,043, was 6,464) and Sarrow's, unplayed at his new
  pace, at 0.8 (4,874, was 5,914). Kestrow, Tolvo and Halvik count in
  full. His own scoring and hash never know of it. The lesson: a
  machine with a player's hands links slides a thumb cannot, so a
  rival's points a second say nothing about what a player can match.
  (2) **Pro and Legend ask 1.5 times the star targets**
  (`LOOP.CHAPTERS.STAR_SCALE`, `starScale` in `loop/modes.js`): in the
  fastback he won three stars on every Pro track, with double the
  points on some. Only a career run's targets move; clean sectors, the
  pace, leads and missions still come from the plain first star, races
  and the daily are not scaled, and stars already won are kept. Legend
  has not been played at either scale.
  (3) The wall ride: he never passed 20 m. Its lane is 6 m (was 2.5)
  and its levels 15, 40 and 90 m (were 20, 60, 140).
  All first guesses for play. Open: `.github/workflows/
  crazygames-parity.yml` has failed since GitHub's runner moved to
  Ubuntu 26.04 (the pinned Playwright cannot install there); it is
  outside this folder and waits for the author's word. Deploys are
  not affected.
