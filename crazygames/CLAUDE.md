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
session. The preview URL is the Worker's `workers.dev` address. It is public and
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
  real GPU. In progress: the track generator (`crazygames-tracks`) and the
  game loop (`briefs/GAME-LOOP.md`, `crazygames-loop`).
