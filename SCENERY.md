Read CLAUDE.md, BRIEF.md, ART-DIRECTION.md and SCENERY.md before starting.
Commit directly to main. Pushing to main deploys.

SCENERY.md is a measured investigation of this renderer, run against the live
build with every canvas method instrumented. Its numbers are reproducible.
ART-DIRECTION.md is the new visual target and supersedes BRIEF.md section 7.

THIS SESSION IS PERFORMANCE ONLY. No visual features. No scenery. No ground
plane. Two changes, both revertible, both behind named FEEL constants.

IT SHOULD LOOK IDENTICAL WHEN YOU ARE DONE. That is the point. It funds
everything that comes after it.

WHY. drawRoad is 92% of render(). Four passes are 82% of drawRoad. The cost
is not fill rate: an eight-fold change in viewport pixel count moves render
cost by six per cent. It is path tessellation, and it grows with the SQUARE
of the number of subpaths in a single path. Measured: 800 subpaths in one
fill takes 11.3ms, the same 800 split across 8 fills take 1.5ms, identical
pixels.

The file's batching convention was built to avoid per-call overhead. That was
right for a handful of shapes and is wrong at 964.

Separately, 136 of the 192 visible segments are under one screen pixel tall
and together occupy 44 rows of a 768 row screen.

CHANGE 1: FAR FIELD COALESCING.
After the visibility walk in drawRoad and BEFORE any pass consumes bvis,
walk the boundary tables once and merge any run of segments spanning less
than SEG_MERGE_PX screen pixels into a single quad: clear bvis on the
absorbed segments and extend the surviving anchor's far boundary
(by, bx, bw, bt, bf, bh at anchor+1) to the last absorbed segment's.

New FEEL constant SEG_MERGE_PX, default 1.0, in the LIVE group so it can be
tuned while driving. Zero must be exactly the current drawing.

Expected: render cost down 55 to 60 per cent. Measured pixel change at 1.0px
was 2,232 pixels differing by more than 6 out of 1,049,088, all inside rows
249 to 304, the band immediately under the horizon.

CHANGE 2: CHUNK THE TWO LARGEST PASSES.
edgeGlowPass and drawSlabUnderline each build one path of 964 and 768
subpaths and issue one fill. Split each into depth chunks of at most
PATH_CHUNK_SUBPATHS subpaths, calling fill() per chunk. Same geometry, same
order, same colours.

New FEEL constant PATH_CHUNK_SUBPATHS, default 64. A value of 0 or Infinity
must reproduce the current single-fill behaviour exactly.

CAUTION, AND CHECK THIS BY EYE. Both passes fill at globalAlpha below 1. One
path merges overlapping subpaths before blending; separate fills blend
twice, so chunk joins can double-blend. Measured at 8 chunks this was 895
pixels of 1,049,088 and one pixel moved by more than 40. Check it at MAXIMUM
MULTIPLIER in the three brightest biomes. If a seam reads, raise
PATH_CHUNK_SUBPATHS until it does not, and report the value where it broke.

DO NOT change: any other FEEL constant, the projection, DRAW_DISTANCE_SEGMENTS,
the generator, the RNG, pass ordering, or any colour.

Re-run the full regression suite. A check that has always passed and starts
failing is the most important finding in your report. Pay particular
attention to daily28: the coalescing touches the visibility walk, and the
daily road must still generate byte-identical across devices.

REPORT BACK:
- Worst frame in ms over a 60 second run on the weakest machine available,
  before and after each change separately and both together, same pinned seed
  and same biome.
- Mean frame rate for the same three cases.
- A frozen-frame pixel diff for each change: pixels differing by more than 6
  out of the frame total, and the row range they occupy.
- The road edge luminance ranking across all twelve biomes, before and after,
  confirming the edge still ranks first.
- The value of PATH_CHUNK_SUBPATHS at which alpha seams became visible, if
  they did.
- Anything in the above that turned out to be wrong on real hardware.
