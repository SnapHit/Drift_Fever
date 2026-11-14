# Project instructions

This repo holds **Drift Fever**, served at driftfever.com by a **Cloudflare Worker** and played mostly on phones. It is two games:

- **The 3D game, at `driftfever.com/`** since 15 November 2026, by the author's decision: he thinks it far the better game and is sharing it. It is built in `crazygames/`, which has its own `CLAUDE.md`, and that file governs every change to it. The same build goes to CrazyGames and to the preview Worker.
- **The original, at `driftfever.com/classic/`**: `index.html` at the repository root, one self-contained file, Canvas 2D. **Everything below this list, down to "Deploy", is about the original** and still binds every change to it. It is finished unless the author says otherwise.

`build-site.js` puts the two together into `site/` before every deploy. Saves of both games live in the browser under the one origin with different key prefixes (`driftfever.` and `driftfever.cg.`), so the move to `/classic/` lost nobody's progress.

**The game is called Drift Fever.** This settles the first open question in `BRIEF.md` section 14, which was written before the name was chosen. Treat the name as decided, not open. Use it for the page title, the `localStorage` key prefix, and every internal name.

It was called Tailflick until session ten. Nothing should still say so.

**`crazygames/` is a separate build with its own `CLAUDE.md`**: the 3D game. Its greybox still vendors the original's simulation from `index.html` (`crazygames/vendor/`), so a change to `index.html` makes that folder's parity stamp stale until it is re-vendored.

**Read `BRIEF.md` in full before writing any code.** It is the design brief and it is the source of truth. Section 11 is the build order and it is not optional. Section 12 lists things not to do.

## Hard constraints, which apply to every change

- **One self-contained HTML file** at `index.html`. No build step, no dependencies, no framework, no assets, no imports.
- **Zero external requests.** Not one, ever. No CDN, no fonts, no analytics. A single blocked request is a broken game for this audience.
- **Canvas 2D only.** No WebGL. Target a stable 60fps on a five-year-old Celeron Chromebook.
- **Every feel constant in one named block at the top**, including any multiplier used inside the update loop. Nothing tunable may live inline in the game logic.
- **The physics reads one steering value from -1 to +1.** Keyboard, touch and tilt all write to it. Nothing in the update loop may read an input source directly. See BRIEF.md section 8.1.
- **Every `localStorage` call wrapped in try/catch.** The game must play perfectly with no memory rather than throw.
- **No audio.** No menus, no settings screen, no pause, no tutorial.
- Bind both cases of letter keys, so caps lock does not produce dead keys.
- **Never name anything after a competitor's game.** See BRIEF.md section 10.

## Working style

- Small changes, one at a time. The author plays every change on a phone before the next one.
- **Do not design ahead.** Do not add a feature because the brief mentions it later. Build the current step, stop, and hand back.
- If something in the brief turns out to be wrong or contradicts what you find, **stop and say so** rather than working around it. Disagreement has been right more than once on this project.
- Australian spelling in comments and copy. No em or en dashes.

## Deploy, and read this before touching anything about hosting

**The site is a Cloudflare Worker, not GitHub Pages.** It is deployed from this repo with `npx wrangler deploy`, configured by `wrangler.jsonc`, and holds `driftfever.com` and `www.driftfever.com` as custom domains.

**PUSHING TO `main` IS THE DEPLOY.** Corrected 15 August 2026, and this paragraph previously said the opposite, which sent several sessions hunting for a Cloudflare API token that does not exist.

The Worker builds from this repo automatically on every push to `main`, and the site is live within a couple of minutes. You do not need to run `wrangler deploy` and you do not need credentials. If your environment refuses `CONNECT` to driftfever.com or reports no `CLOUDFLARE_API_TOKEN`, that is a limitation of the sandbox and not a failed deploy — every session that reported "pushed only" in fact went live, byte-identical to the repo.

`./publish-check.sh` is still the right verification when it can reach the site. Its first checks compare the live byte counts against the repo's: `/classic/` against `index.html` plus the 32 bytes the build adds, and `/src/main.js` against `crazygames/game/src/main.js`. When the proxy blocks it, say so and move on rather than treating connection failures as findings about the site.

**Jekyll never runs.** There is no `_config.yml` and it would do nothing if there were: it is a Pages mechanism and Pages is not the host. It was deleted in session fifty three because it was inert AND because Cloudflare's project auto-detection read it as a Ruby project and failed every deploy for days. Do not add it back. The underscore prefix on `_content/` and `_reference/` is likewise now only a naming convention: it protects nothing on its own.

**`wrangler.jsonc` points the assets directory at `site/`, and its build command, `node build-site.js`, assembles `site/` before every deploy.** `site/` is not committed. The build needs Node and nothing installed: it runs the 3D game's own `crazygames/tools/build-site.js`, takes that game without its greybox, status and lab pages for the root, and adds the original at `/classic/`, the seven content pages, their cabinet, the music, the share card, the touch icon, the sitemap and `robots.txt`. A failed build fails the deploy and the site stays as it was.

**`build-site.js` is the allowlist and it must stay one.** Nothing reaches the web unless a line there copies it, so it fails closed: **a new page or asset is not served until it is added there.** Until 15 November 2026 the repository root was the web root and `.assetsignore` did this job; that once published the whole of `.git`. `.assetsignore` is read by nothing now and is kept only as a guard if the assets directory is ever pointed back at the root.

**What the build changes, and nothing else.** The original's head gains a `<base href="/">` (so its music, touch icon and links resolve from `/classic/`) and its canonical and `og:url` say `/classic/`: 32 bytes, checked by the build and by `publish-check.sh`. The 3D game's `noindex` line, which the preview keeps, becomes the canonical, share and touch icon tags. Both games carry the same inline favicon, the orange D, by the author's word.

**The share card, `og-card.png`, is the 3D game's cover** since 15 November 2026: the drift build mid slide under the wordmark, made in `crazygames/brand/` (`covers/hero-share.png`, from key art the author generated from pictures of the game's own car; `crazygames/CLAUDE.md` has the rule and its one exception). Every page of the site shares it, the original and the seven pages included. `brand/make-og-card.js` still draws the original game's card and would overwrite it: do not run it without the author's word; the old card is in the history.

**The seven pages' cabinet frames `/classic/`**, not the front page: the 3D game's controls do not fit a frame that small. Its two ways out go to `/`.

To see exactly what a deploy would publish, without deploying:

```
npx wrangler deploy --dry-run --outdir /tmp/out
```

It runs the build and prints the file count. `ls -R site` is then exactly what would be published.

The author plays every change on a phone at driftfever.com, so **a change is not finished until it is on `main`.** The deploy follows automatically. The preview Worker (`crazygames/wrangler.jsonc`) deploys from the same push and stays as the CrazyGames build's own address.
