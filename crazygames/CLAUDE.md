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

## The one rule that governs everything else

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
tools/original.js        reads that index.html out of the repository history
tools/vendor.js          slices the simulation out of the original, mechanically
tools/vendor.config.js   the renderer boundary: roots, the cut set, replacements
sim/drift-fever-sim.js   GENERATED: createSim(hooks). Do not edit
sim/VENDOR.json          GENERATED: what was taken, cut and replaced, with lines
parity/                  the parity test. README.md explains it
parity/stamp.json        the last passing run, with the hashes of what it covered
parity/REPORT.md         the last passing run's summary
public/                  the preview page; the renderer arrives here in stage 2
tools/build-site.js      assembles dist/, the web root the preview Worker serves
wrangler.jsonc           the preview Worker. dist/ is the assets directory
ci/parity.yml            the live parity test for GitHub Actions; see SETUP.md
```

## Commands

```
npm ci                                   once; Chromium: npx playwright install chromium
npm run vendor                           regenerate sim/ from vendor/original
npm run vendor:report                    the closure, the cut set, what was left behind
npm run parity                           the full parity test, 28 days, ~minutes
npm run parity:quick                     3 days, ~15 seconds, for iterating
npm run parity -- --stamp                full run, and on a pass write stamp.json and REPORT.md
npm run parity:check                     no browser: is the stamp current for these files
node parity/diagnose.js --group "level 2" --key "drive L2 20261001 centre" --quick
                                         where do the two sides part, and on which fields
node parity/render-feedback.js --days 1  does drawing feed back into the original's simulation (slow)
npm run build                            parity:check, then dist/
```

The parity test runs both sides in one headless Chromium on purpose:
Node's Math library differs from Chromium's in the last bit of `sin` and
`exp`, and the comparison is exact. `PLAYWRIGHT_BROWSERS_PATH` or
`PARITY_CHROMIUM` points it at a browser; otherwise Playwright's own. It
reads the original out of git, so a shallow clone needs
`git fetch --unshallow` first.

## Re-vendoring, when the game changes

1. Write the commit hash of the root `index.html` to vendor from into
   `vendor/original/COMMIT`. Nothing is copied.
2. `npm run vendor:report`. Read the whole report: anything new under
   "browser globals still reachable" or "taken declarations referencing
   suspect names" is a boundary decision, made in `tools/vendor.config.js`.
3. `npm run vendor`, then `npm run parity:quick`, then diagnose and fix the
   config until it passes, then `npm run parity -- --stamp`.
4. Commit the pin, the config, the generated module, the stamp and the
   report together, with the commit hash in the message.

The boundary is decided one name at a time, in the config, with a reason.
A cut symbol becomes a stub that forwards to a hook of the same name. A
replaced symbol keeps its simulation half and hands its renderer half to a
hook; the original lines are cited beside the replacement. A function that
turns out to do both (the landing lays tyre marks into the road and throws
grit at the screen in the same body) is replaced, never cut.

## Hard constraints, from the brief, which apply to every change

- Every mechanic in BRIEF.md "Preserved exactly" is preserved exactly. The
  parity test is the proof and it is part of the build.
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
- Commit straight to `main`, one push at a time. Pushing to `main` is the
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
session. The preview URL is the Worker's `workers.dev` address, kept
private with Cloudflare Access (one time PIN to the author's email).
`SETUP.md` has the exact steps, for the parts only the author can do.

The live site never serves this folder: the root `.assetsignore` is an
allowlist and `crazygames/` is not on it. `/crazygames/` on driftfever.com
is a 404 and that is checked after a deploy.

The deploy build checks the parity stamp rather than running the browser
test, because the Workers build image is not guaranteed to have Chromium: a
push that changes the module, the original's pin or the test without a
fresh passing stamp does not deploy. `ci/parity.yml` runs the test live in
GitHub Actions once copied to the repository's `.github/workflows/`.

## Status

- Stage 1: done. The simulation is vendored and parity is proven; see
  `parity/REPORT.md`.
- Stage 2 is next: the greybox renderer. It consumes `createSim(hooks)` and
  never feeds back into it.
