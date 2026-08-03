# Brand assets

The artwork itself lives in `index.html`, as path data in the `BRAND` block
beside the palette. **That block is the shipped copy.** These files are the
delivery vehicle it came from and the tooling that regenerates the two things
the game cannot draw for itself.

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
