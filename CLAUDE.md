# Project instructions

This repo holds one browser game: a single self-contained HTML file, served by GitHub Pages, played mostly on phones.

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

## Working style

- Small changes, one at a time. The author plays every change on a phone before the next one.
- **Do not design ahead.** Do not add a feature because the brief mentions it later. Build the current step, stop, and hand back.
- If something in the brief turns out to be wrong or contradicts what you find, **stop and say so** rather than working around it. Disagreement has been right more than once on this project.
- Australian spelling in comments and copy. No em or en dashes.

## Deploy

`index.html` at the repo root is served directly by GitHub Pages. There is nothing to build. Committing to the deployed branch is the deploy.
