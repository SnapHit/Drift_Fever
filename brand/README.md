# Brand assets

The artwork itself lives in `index.html`. **The copies in there are the shipped
ones.** These files are the delivery vehicle they came from and the tooling
that regenerates the two things the game cannot draw for itself.

Two different techniques, on purpose:

- The **Drift Fever** marks are path data in the `BRAND` block beside the
  palette, drawn with `Path2D` on the canvas, because the wordmark has to sit
  in the game's own layout and its treatment is three plain draws.
- The **SnapHit** lockups are inline SVG markup in the body, shown as HTML
  overlays above the canvas, because their neon bloom is layered stroked
  copies at several opacities and rebuilding that in canvas would be a lot of
  code for no gain. They also stay sharp at any device pixel ratio for free.

- `snaphit-lockup.svg` — the publisher lockup: joystick, SNAPHIT, STUDIOS,
  INSTANT. PLAY. Inlined whole into `index.html` as the boot splash.
- `snaphit-lockup-no-glyph.svg` — the same without the joystick. Inlined
  **cropped to the SNAPHIT wordmark alone** as the end-screen credit: measured,
  the taglines need the lockup to be 46% of a 390-wide screen before
  INSTANT. PLAY. reaches a readable cap height, which is a billboard on the
  screen the score lives on. Shipping text nobody can read is worse than
  shipping less of it.
- `wordmark-path-data.txt` — DRIFT over FEVER, two lines.
- `icon-path-data.txt` — the single heavy italic D, which is the wordmark's
  own first letter, so the two cannot drift apart.
- `make-favicon.js` — rewrites the `<link rel="icon">` href in `index.html`
  from `icon-path-data.txt`. Run from the repo root with `node`.
- `make-og-card.js` — renders `og-card.png` at 1200x630 by driving the game's
  own `drawBrandInk` in a headless browser, so the share card is made by the
  same code that draws the title screen. Needs `playwright`.

Neither script is a build step. `index.html` in the repo is the artefact and
is served as-is; these only ever edit it in place, and the game never runs
either of them.

## If the artwork is replaced

1. Drop in the new `.txt` files.
2. Copy the `viewBox`, the draw order numbers and the `d` string into the
   `BRAND` block in `index.html`.
3. **Re-measure the `ink` shares.** They are the bounds of the drawn ink
   inside the viewBox, measured off a real render, and the layout positions
   the marks by them rather than by the box. They are not derivable from the
   `d` string, because the `d` string says nothing about where the stroke and
   the offset shadow land.
4. `node brand/make-favicon.js` and `node brand/make-og-card.js`.

## The two real PNGs in the repo root

`apple-touch-icon-180.png` and `og-card.png` are the deliberate exception to
the zero requests rule. Neither is ever fetched by the game's own code: the
first is read only when somebody adds the page to their home screen, and the
second only by a social scraper. Loading and playing a full run still makes
exactly one request, for `index.html`.
