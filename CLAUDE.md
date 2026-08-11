# Project instructions

This repo holds one browser game: **Drift Fever**, a single self-contained HTML file, served by a **Cloudflare Worker**, played mostly on phones.

**The game is called Drift Fever.** This settles the first open question in `BRIEF.md` section 14, which was written before the name was chosen. Treat the name as decided, not open. Use it for the page title, the `localStorage` key prefix, and every internal name.

It was called Tailflick until session ten. Nothing should still say so.

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

**Committing to `main` is NOT the deploy.** It used to be, under Pages. It is not any more. A commit that is never deployed is a change the author cannot play, and the live site once sat three sessions behind because of exactly this. Push, then deploy, then run `./publish-check.sh`.

**Jekyll never runs.** There is no `_config.yml` and it would do nothing if there were: it is a Pages mechanism and Pages is not the host. It was deleted in session fifty three because it was inert AND because Cloudflare's project auto-detection read it as a Ruby project and failed every deploy for days. Do not add it back. The underscore prefix on `_content/` and `_reference/` is likewise now only a naming convention: it protects nothing on its own.

**`wrangler.jsonc` points the assets directory at `.`, so the repo root is the web root.** Every file in this repository is a candidate for a public URL unless `.assetsignore` says otherwise, and that once included the whole of `.git`, meaning every commit ever made.

**`.assetsignore` is an allowlist and it must stay one.** `/*` hides everything and the lines under it name the eighteen files that are the site. A denylist fails open, which is how `.git` and `.jekyll-cache` reached the web. **A new page or asset is not served until it is added there.**

To see exactly what a deploy would publish, without deploying:

```
npx wrangler deploy --dry-run --outdir /tmp/out
```

It prints the file count. `WRANGLER_LOG=debug` additionally lists every path and every `Ignoring asset:` line, which is a complete answer either way.

The author plays every change on a phone at driftfever.com, so **a change is not finished until it is deployed and `./publish-check.sh` is clean.**
