# Drift Fever: can the road have a world beside it

> **SUPERSEDED IN PART, 13 AUGUST 2026.** This document's measurements are all still
> correct and its performance findings are the foundation everything since has been
> built on: the quadratic subpath cost, the far-field coalescing, cost being geometry
> rather than pixels, and the object ceiling.
>
> What is superseded is the DRAWING METHOD for scenery. This document specifies 2D
> profiles mirrored into a lit half and a shade half, and that is what shipped. It is
> also why the world reads as flat cut-outs: a mirrored profile has no faces, so it
> cannot be shaded from a light direction and cannot cast a shadow.
>
> Scenery is being rebuilt as real geometry with faces, normals, depth sorting and
> cast shadows. See ART-DIRECTION.md, revised the same day.
>
> Read this document for HOW MUCH can be afforded and HOW COST BEHAVES. Do not read
> its profile-and-mirror approach as the required implementation.


Visual architecture investigation, 16 August 2026.
Live game: https://driftfever.com

---

## The short version

The premise of the brief is that there is no frame budget for scenery. That is
correct today and wrong in principle. The measurement says the road is spending
somewhere between 60 and 70 per cent of its frame cost drawing 136 segments that
occupy 44 rows of a 768 row screen, and it is doing it in a way that gets
quadratically more expensive the more segments there are.

Fix that and the game gets roughly two and a half times faster with 0.4 per cent
of pixels changing. The scenery then costs a rounding error against what was
recovered.

So the answer to question one is not a ceiling. It is that the ceiling is
currently being consumed by something that is not on screen, and the entire
investigation turns on that.

Three things I measured that contradict what the project has been assuming:

**The road is not a handful of batched fills.** It issues 132 `fill()` calls and
builds about 3,600 subpaths and 11,600 `lineTo` calls per frame.

**Batching is the problem, not the solution.** VISUAL.md records that "one more
pass over geometry already walked costs one more fill". That is true of the fill
call and false of the cost. A single path holding 800 spread out subpaths takes
11.3ms. The same 800 subpaths split across 8 fills take 1.5ms, and across 100
fills take 0.8ms. Identical pixels, fourteen times faster. `edgeGlowPass` is the
most expensive thing in the game for exactly this reason.

**The void does not read as altitude.** I captured frames across four biomes.
There is no visible drop, no parallax against a floor, and no depth cue in the
slab edge at this camera height. The void reads as dark unlit ground that is
already there. Question five asks what filling it in trades away, and the honest
answer is that it trades away emptiness, not vertigo.

Everything below is measured unless it says otherwise.

---

## How these numbers were produced, and what transfers

I pulled the live file (971,681 bytes, 19,338 lines, single file, no base64
blobs), served it locally, and ran it in headless Chromium under Playwright with
`CanvasRenderingContext2D.prototype` instrumented to count every draw call, every
named painter wrapped in a timer, and CDP CPU throttling to stand in for weak
hardware. Frames were frozen for the pixel diffs by stubbing every update
function, so before and after shots are of the same world state.

**What transfers to a Celeron Chromebook:** draw call counts, subpath counts,
the shape of the cost curves, ratios between passes, and pixel diffs. These are
properties of the code and of Skia, not of my machine.

**What does not transfer:** absolute milliseconds. My container is a shared vCPU
and is meaningfully slower than your throttled profile. Your own measurement is
10fps at CPU x6. Mine is 6.8fps at x6 and 9.4fps at x4, so my x4 is roughly your
x6. Wherever I give a millisecond figure it is there so the ratio can be checked,
not so it can be quoted.

One thing worth knowing about the instrument: Canvas 2D command recording happens
on the main thread and rasterisation does not. `performance.now()` around a
painter measures the first and not the second. Where an effect is pure fill rate,
haze especially, the painter reads zero and the cost shows up only in the frame
rate. I have flagged that where it matters.

---

## 1. What is the frame budget, actually

### Where the time goes now

At 1366x768, DPR 1, throttle x4, driving:

| Pass | ms per frame | Share of render | Subpaths per frame | Fills |
|---|---|---|---|---|
| `edgeGlowPass` | 16.63 | 40.2% | 964 | 2 |
| `drawSlabUnderline` | 8.20 | 19.8% | 768 | 2 |
| `bandPass` | 4.65 | 11.2% | 768 | 4 |
| `drawWalls` | 4.59 | 11.1% | 398 | 1 |
| `drawSkyline` | 1.32 | 3.2% | 868 | 6.7 |
| `surfacePass` | 1.00 | 2.4% | 192 | 2 |
| `drawScore` | 0.98 | 2.4% | 3 | 4 |
| `drawCar` | 0.62 | 1.5% | 53 | 54 |
| everything else | ~3.4 | 8.2% | | |
| **`render()` total** | **41.41** | | **~3,600** | **~132** |

`render()` is 92 per cent of the frame. `drawRoad` is 92 per cent of `render()`.
Four passes are 82 per cent of `render()`.

### The cost is geometry, not pixels

This is the finding that decides the art direction, so it is worth stating
carefully. I ran the same scene at three resolutions:

| Viewport | Pixels | `render()` ms |
|---|---|---|
| 390 x 844 | 329,160 | 41.49 |
| 683 x 384 | 262,272 | 41.90 |
| 1366 x 768 | 1,049,088 | 41.41 |
| 1920 x 1080 | 2,073,600 | 44.10 |

An eight fold change in pixel count moves main thread cost by six per cent. The
road is not fill rate bound. It is bound by path construction and tessellation,
which scale with vertices and subpaths and not with area.

The practical consequence is large and counterintuitive: **big flat things are
nearly free and small detailed things are not.** A ground plane covering half the
screen costs less than forty roadside posts. That inverts the usual instinct
about what is expensive.

Rasterisation does still cost, it just happens off the main thread. At 1920x1080
`render()` was unchanged but frame rate fell from 14.1 to 6.5. So overdraw is
real, it simply does not appear where you would look for it.

### The far field is eating the budget

Draw distance sweep, everything else identical:

| `DRAW_DISTANCE_SEGMENTS` | `render()` ms |
|---|---|
| 50 | 6.53 |
| 100 | 13.13 |
| 150 | 24.50 |
| 200 (shipping) | 41.41 |

Doubling from 100 to 200 more than triples the cost. That superlinearity is the
whole story. Now the census of what those segments are:

- 192 segments visible.
- 136 of them are **under one screen pixel tall**, and between them they occupy
  **44 rows of a 768 row screen**.
- 109 are under half a pixel.
- The road occupies rows 267 to 772. The sub-pixel far field is rows 249 to 304.

Seventy-one per cent of the segments are drawing six per cent of the road's
screen height, and they are the expensive ones because cost grows with the square
of the subpath count in a single path.

### Why the square

I tested this directly rather than inferring it. 800 identical objects, identical
pixels, varying only how many `fill()` calls they were split across:

| Fills | Subpaths per fill | ms |
|---|---|---|
| 1 | 800 | 11.30 |
| 2 | 400 | 5.90 |
| 4 | 200 | 3.20 |
| 8 | 100 | 1.50 |
| 16 | 50 | 1.10 |
| 32 | 25 | 1.00 |
| 100 | 8 | 0.80 |
| 800 | 1 | 1.20 |

Cost is roughly proportional to subpaths squared, and splitting into K chunks
divides it by K until you hit per-call overhead somewhere around 8 to 25 subpaths
per fill. A separate sweep confirmed the mechanism: adding vertices *inside* a
subpath is linear, adding subpaths to a path is quadratic. Skia has to consider
every edge in a path against every scanline the path's bounding box covers, so a
path whose subpaths are scattered across 500 rows pays for all of them
everywhere.

The file's batching convention was built to avoid per-call overhead, which was
the right instinct for a handful of shapes and is the wrong one at 964.

### The two fixes, measured

Both were tested on a frozen frame so before and after are the same world.

**Fix A, coalesce the far field.** Walk the boundary tables once and merge any run
of segments spanning less than N screen pixels into a single quad. Every pass
then draws fewer, taller subpaths over the same geometry.

| Setting | `render()` ms | Pixels differing by more than 6 | Where |
|---|---|---|---|
| stock | 36.40 | — | — |
| merge under 1px | 14.96 | 2,232 of 1,049,088 (0.21%) | rows 249 to 304 |
| merge under 2px | 10.77 | 5,645 (0.54%) | rows 249 to 318 |
| merge under 3px | 8.84 | 13,342 (1.27%) | rows 249 to 335 |

At one pixel that is a 59 per cent cut in render cost for two thousand pixels
changing, every one of them inside the 55 row band immediately under the horizon
where the road is already a smear.

**Fix B, chunk the two big passes.** Split `edgeGlowPass` and `drawSlabUnderline`
into K depth chunks instead of one path each.

| Setting | `render()` ms | Pixels differing by more than 6 |
|---|---|---|
| stock | 21.62 | — |
| 2 chunks | 16.97 | 97 (0.009%) |
| 4 chunks | 13.97 | 300 (0.029%) |
| 8 chunks | 12.70 | 895 (0.085%) |
| 16 chunks | 11.60 | 1,668 (0.159%) |

There is a real caveat here. These two passes fill with `globalAlpha` below one,
and a single path merges overlapping subpaths before blending while separate
fills blend twice. That is what the 895 pixels are: faint double-blended seams at
the chunk joins. At 8 chunks one pixel in the frame moved by more than 40. It is
invisible, but it is not free the way the coalescing is, and it should be checked
by eye at maximum multiplier before it ships.

**Both together**, on the same frozen frame: 21.62ms to 8.08ms, a 63 per cent
cut, 4,054 pixels differing by more than 6 out of 1,049,088.

Across throttle rates, live:

| | stock | coalesce + chunk |
|---|---|---|
| x1 | 5.34ms, 43.6fps | 2.04ms, **60fps** |
| x6 | 30.70ms, 7.2fps | 11.08ms, 12.4fps |

### The hard ceiling you asked for

With the renderer as it ships today, the honest ceiling is **200 to 300 objects**,
and even that is money you do not have, because the game is already missing its
target.

With the two fixes in, the marginal cost of a correctly chunked roadside object
is about 1.4 microseconds at throttle x4 in my container, which is roughly one
thousandth of the stock road's cost per object at the same throttle. Measured:

| Objects added | Painter ms (x4) | `render()` ms |
|---|---|---|
| 0 | 0.00 | 7.50 |
| 400 | 0.70 | 8.27 |
| 800 | 1.10 | 9.35 |
| 1,600 | 2.40 | 10.46 |

**The ceiling is 1,000 to 1,500 objects of four to eight vertices per frame,
and the binding constraint is not the object count. It is subpaths per fill.**
Keep every fill under about 64 subpaths and object count stops being the variable
that matters until you are into the thousands. Put 1,000 objects into one path
and it costs seventeen milliseconds and the whole thing collapses.

The decisive number: fixed road plus 600 scenery objects runs at 13.09ms and
10.7fps at throttle x6, against the stock road today at 30.70ms and 7.2fps. **You
can have a ground plane and six hundred roadside objects and still be
comfortably faster than the game is right now.**

---

## 2. How a ground plane is built here, and what it costs

Three quarters of it already exists. `drawGrid` projects a wireframe floor 15,000
world units below the road, 44 rows deep and 15 columns wide, in one stroked
path. The projection, the row spacing and the parallax against travel are all
written and working. It is drawn as lines because the design decision was that
the void beside the road stays empty, not because the geometry was missing.

Four ways to fill it, measured at throttle x4:

| Approach | Painter ms | Notes |
|---|---|---|
| Flat `fillRect` from horizon to bottom | 0.00 | free, main thread; costs raster only |
| Ridge silhouette, ~50 vertices, 2 fills | 0.10 | free |
| Coalesced per-segment strips, 2 fills | 0.60 | terrain that follows the road's curve |
| Per-segment strips, 192 segments, 2 fills | 2.20 | same thing without coalescing |

The recommended build is the third. Reuse the `bx/by/bw` boundary tables the road
already fills, extend outward by a multiple of the half width, and emit two
alternating colour passes exactly the way `surfacePass` does. Because it rides
the same tables it inherits the curve, the camera, the shake and the coalescing
for nothing. It also inherits the rumble stripe alternation, which gives terrain
a sense of motion without a single extra vertex.

Elevation is affordable and is the cheapest big win in this section. The
projection has no vertical term per segment, but you do not need one. Displace
the outer edge of each terrain strip upward by a per segment height and leave the
inner edge on the road plane. That produces banking, embankments, cuttings and a
rolling verge, all from one extra number per segment and no extra subpaths. It is
not real 3D and it will not survive a hard look, but at the camera angle this
game uses there is nothing to look at it against.

**Readability risk: moderate, and it is the important one in this document.**
Rule one says the road edge must be the brightest thing on screen. Right now the
edge is bright against a near black void, which is the easiest contrast job there
is. Put mid value terrain beside it and that margin shrinks everywhere. This is
the same failure Beakdown paid for with platforms against arenas, and it is
recorded in BRIEF.md section 7 as the reason synthwave was refused.

The mitigation is structural, not a tuning pass: **terrain must be darker in
value than the road surface, and the road surface must stay darker than the
edge.** Three bands, monotonic, in every one of the twelve biomes. Rank the
luminance of edge, surface and terrain across all twelve before shipping and
treat any biome where the order breaks as a bug rather than a preference.

---

## 3. How roadside scenery is built

### Drawing

One pass per object family, chunked. Walk the visible boundary range, for each
segment carrying an object compute its screen position from `bx`, `by`, `bw` and
`bh` exactly as `drawPylons` already does, emit its subpaths, and call `fill()`
every 32 to 64 subpaths rather than once at the end.

Depth sorting is free. The road is already walked from the horizon toward the
camera and the passes already run in that order, so objects emitted in segment
order are in painter order. Do not build a sort.

Culling is already there and needs one addition. `bw[n] < GLOW_CULL_PX` breaks the
loop when the road is under 2.5 pixels wide. Scenery wants a second test on
projected object height, because a tree that is 0.4 pixels tall costs a full
subpath and paints nothing. Cull under about 1.5 pixels of projected height and a
large fraction of the far field disappears before it is ever built.

Silhouette is the whole art direction here. At the sizes these objects occupy,
between two and forty pixels tall for almost all of them, shape reads and detail
does not. Four to eight vertices per object. Trees as a trunk quad plus a
triangle, hedges as a run of quads sharing edges, banners as two posts and a
rectangle, buildings as a box with one lit face. Anything more is paying vertices
for something nobody can see, and it walks straight into the finding you are
acting on, that extreme embellishment tests as badly as none.

### Determinism, which is where this can go wrong quietly

The generator is Mulberry32 with state in `rngState`, seeded from the local date
hash, consumed in generation order by the phrase builder. `addSegment` pushes
plain objects onto a stream that is extended ahead of the camera and trimmed
behind it.

**Do not call `rng()` from the phrase builder to place scenery.** Every draw
shifts the state for every subsequent draw, so adding one tree call changes every
corner on the track from that point on. The daily stops being the same road for
two people on different builds, the ghost stops being comparable, and it will
present as a mysterious desync rather than as an obvious break.

Use a pure hash of the seed and the segment index instead:

```
h = mix(seed, segmentIndex, familySalt)  ->  32 bit
```

This is stateless, order independent, gives a different stream per object family
from the salt, and is unaffected by trimming, by draw distance, or by how far
ahead generation happens to have run. It is also the only version that stays
correct if you ever generate segments in a different order.

Attach the result at `addSegment` time as one or two integers on the segment
object, not as a list of object records. A packed integer holding family, side,
lateral offset and a size bucket is enough to reconstruct everything at draw
time, costs almost nothing to store, and is trimmed with the segment that carries
it so nothing accumulates over a run.

Nothing in this may read elapsed time, frame count, `Date.now()` or the camera
position. Scenery must be a pure function of seed and segment index, exactly as
the road is.

**Readability risk: low if the rule is absolute.** Nothing stands inboard of the
road edge, nothing crosses the road plane, nothing is emitted in the near field
tall enough to occlude the road ahead. That last one is the trap: a tree at
segment 4 on a left hand bend can cover the apex. The cheapest correct fix is a
minimum distance before any object may be tall, so the near field carries only low
objects.

---

## 4. What haze costs, and whether it can be afforded

Cheap on the main thread and not free overall.

| Full width gradient bands over the far road | Painter ms | fps |
|---|---|---|
| 0 | 0.00 | 10.3 |
| 1 | 0.00 | 9.1 |
| 2 | 0.00 | 7.9 |
| 4 | 0.00 | 6.6 |

Zero recorded cost, and about half a frame per second each in this container. It
is pure overdraw, it happens off the main thread, and it is therefore the one
effect in this document whose cost will scale with the player's screen and pixel
ratio rather than with the geometry. On a phone at DPR 2 it will cost
proportionally more than these numbers suggest. Cache the gradient object, rebuild
it only on resize and biome change, and one band is affordable.

The real problem with haze is not the frame cost. It is rule two.

The planning horizon is 3.5 seconds. Haze works by lowering contrast with
distance, which is precisely the mechanism that makes distant road unreadable.
Applied naively it makes the game unfair in exactly the way BRIEF.md section 4.3
is about, and the file has already measured this once: the heat horizon glow was
restricted to above the horizon line because deepening the band below it moved
surface against void contrast between 1.7 and 3.3 seconds out by 4.8 the wrong
way.

There is a version that works, and it is the inverse of the usual one.
**Haze the scenery, not the road.** Draw the terrain and object passes, then lay
the haze band, then draw the road's edge, lip and glow passes on top of it. Depth
then reads through the scenery going soft while the thing the player steers by
stays at full contrast. That is not physically correct and it does not matter,
because it is the same trick the file already uses to keep the lip out of the
glow band.

The pass ordering cost is one reordering, not one extra fill.

**Readability risk: high if drawn over the road, low if drawn under the edge
passes.** Measure surface against void contrast at 1.7 and 3.3 seconds before and
after, the same way it was measured for the horizon glow, and treat any loss as
disqualifying.

---

## 5. What this trades away

The brief asks me to argue this honestly rather than assume the new thing is
better. Having looked at frames from four biomes, I think the premise needs
correcting first.

**The void does not currently read as altitude.** There is no visible drop
anywhere in those frames. The slab side that `drawWalls` paints is a few pixels
of dark edge at this camera height and reads as a kerb rather than a cliff. The
floor grid at 15,000 units below is faint enough to read as ground mist. There is
no parallax cue between the road and anything beneath it, because there is
nothing beneath it that moves at a different rate. What is actually on screen is
a road on dark unlit ground with a strip of city on the horizon and roughly a
quarter of the screen of empty field between them.

So the trade is not vertigo against beauty. It is emptiness against density, and
that is a genuinely different argument with two real things on the losing side.

**What is genuinely lost.** Emptiness is doing work. The road is the only lit
object in the frame, which is why the edge reads as strongly as it does and why
the car is findable in every biome. The moment there is terrain, the contrast
budget is shared, and every future visual decision gets harder rather than
easier. That is a permanent tax, not a one off cost.

The second loss is compositional. The current frames are unusual for this niche
in a way that will survive being seen at thumbnail size, because a bright road on
black is a strong silhouette. Art of Rally's look does not thumbnail nearly as
well, and a share card and a portal tile are both thumbnails. The retention work
has a visual share glyph in it, so this is not a small consideration.

**What is not lost, despite the brief's framing.** Vertigo, because it is not
there. Distinctiveness through emptiness is also partly illusory: an empty field
beside a road is what an unfinished pseudo-3D racer looks like, and a cold player
is at least as likely to read it as missing as to read it as deliberate. Carl's
cold-player feedback is the right instrument for that question and I do not have
it.

**My read.** Fill it, but keep the value structure that emptiness was buying.
Terrain darker than road, road darker than edge, and the near field kept sparse
so the road still has air around it. Aim for the road being the lit object in a
dark world rather than one lit object among many. That is closer to Art of Rally
at night than to Art of Rally at noon, and it keeps the thing that currently
works.

The version I would refuse is warm naturalistic daylight. It is the reference
image, it is the thing being asked for, and it throws away the single readability
advantage the game currently has for a look this renderer cannot reach anyway.
Section 7 of the answer covers why.

---

## 6. One rebuild or a sequence

A sequence, and it is not close.

The renderer work in section one is a prerequisite and should ship on its own,
before any scenery exists, for a reason beyond ordering. It is a pure performance
change with a pixel diff attached, so it can be verified as correct in a way that
no visual change can. If it ships bundled with terrain and the frame rate moves,
you will not know which half did it.

Proposed order, each stop playable and revertible, each behind a constant that
can go to zero:

**Stop 1. Far field coalescing.** One function, applied to the boundary tables
before any pass consumes them. Threshold as a named `FEEL` constant, default 1.0
pixels. Expect roughly a 55 to 60 per cent cut in render cost. Verify with a pixel
diff against a frozen frame and with the worst frame readout on the real device.
This is the highest value change in the document and it has nothing to do with
scenery.

**Stop 2. Chunk `edgeGlowPass` and `drawSlabUnderline`.** Chunk size as a
constant, default 64 subpaths. Expect another 15 to 25 per cent. Check the alpha
seams by eye at maximum multiplier in the two or three brightest biomes before
accepting it. Revert this one alone if the seams read.

Stop here and re-measure. Everything after this spends the budget those two
recovered, and if they did not recover it on real hardware then nothing below is
affordable and the answer to the whole investigation changes.

**Stop 3. Ground plane, flat.** Terrain strips from the existing tables, two
alternating colours, no elevation, no objects. Rank luminance across all twelve
biomes. This is the change that decides whether the look is going to work, and it
is one function.

**Stop 4. Elevation on the outer edge.** One height value per segment from the
seeded hash, outer edge only. No new subpaths.

**Stop 5. Near and mid objects.** One family first, probably posts or trees,
chunked, with the determinism rule from section three. Get one family right
before adding a second.

**Stop 6. Haze under the edge passes.** Reorder, one cached gradient, contrast
measured at 1.7 and 3.3 seconds.

**Stop 7. Everything else,** by whatever the previous six have shown to be cheap.

Two of these are rebuilds rather than additions and should be flagged as such:
stop 1 touches the code path every road pass depends on, and stop 6 changes pass
ordering. Stops 3, 4 and 5 are additions and are individually revertible.

---

## 7. The honest ceiling

Reachable, and I would say confidently reachable: terrain either side of the road
that follows its curve and rolls, dark against a darker sky, with a scattered
population of simple silhouettes at three or four depths, a soft haze band behind
the road edge, and the existing city on the horizon given the height it should
already have had. Depth cued by value and by density falling off with distance.
That is a real world beside the road, and it is a large improvement on an empty
field.

Not reachable, and I would rather say so now:

**Warm naturalistic light.** Art of Rally's light is doing per object shading with
a consistent light direction and coloured bounce. Every equivalent here is a flat
fill chosen from a ramp. You can fake a light direction by giving each object a
lit face and a shade face, and that is worth doing, but it will read as a
decision rather than as light. Naturalism is the specific thing flat fills cannot
buy.

**Atmospheric perspective in the full sense.** Real distance fog tints and
desaturates every object continuously by depth. You can afford three or four
discrete depth bands with their own palette entries, which reads as depth from a
distance and as banding if anyone looks. That is an acceptable trade and it is not
the same effect.

**Density.** The reference images have thousands of trees. You have room for
somewhere between 600 and 1,500 four vertex objects. That is enough for a
populated verge and not enough for a forest. The gap gets covered by drawing the
mid distance as a few large silhouette masses rather than as many small objects,
which is cheap because vertices inside a subpath are linear, and it is also how
flat-shaded games have always done it.

**A street level laneway.** VISUAL.md ruled this out and it was right to. The
camera is 2,200 units up with a 92 degree field of view looking down at a road
that fills most of the frame. Nothing about that composition can become a laneway
without changing the camera, and changing the camera changes the game.

Rated against the reference images: **the silhouette and the depth structure are
reachable, the light is not.** If the target is "this looks like a real place at
night with a road running through it", that is achievable this month. If the
target is a specific frame from Art of Rally in daylight, it is not achievable at
all in Canvas 2D with no assets, and no amount of frame budget changes that,
because the limit is the shading model rather than the speed.

I would rather you heard that now than after the ground plane is in.

---

## Ranked by visual impact per unit of work

| # | Item | Impact | Work | Frame cost | Rule at risk | Type |
|---|---|---|---|---|---|---|
| 1 | Far field coalescing | none directly, funds everything | one function | **minus 55 to 60%** | none, 0.21% of pixels | rebuild |
| 2 | Chunk glow and underline | none directly | two functions | **minus 15 to 25%** | none, 0.085% of pixels | rebuild |
| 3 | Ground plane, flat strips | very high | one function | ~0.6ms at x4 | edge contrast, high | addition |
| 4 | Skyline ceiling constant | high | one constant | zero | none, above horizon | addition |
| 5 | Elevation on outer edge | high | one hash, one term | ~zero | none | addition |
| 6 | Near objects, one family | high | one pass plus generator | ~0.4ms per 300 | occlusion of road ahead | addition |
| 7 | Mid distance silhouette masses | high | one pass | ~0.1ms | horizon contrast | addition |
| 8 | Haze under the edge passes | medium | reorder plus one fill | raster only | planning horizon, high | rebuild |
| 9 | Second and third object families | medium | per family | ~0.4ms per 300 | noise | addition |
| 10 | Discrete depth bands in palette | medium | palette work | zero | banding | addition |
| 11 | Warm naturalistic relight | high if it worked | very large | unknown | everything | not recommended |

Items 1 and 2 are the only ones that pay rather than cost, and item 4 is free and
was already identified in VISUAL.md. Those three first.

---

## Where I disagree with the existing documents

**VISUAL.md, on batching.** "The renderer is batched hard enough that one more
pass over geometry already walked costs one more fill." The fill call is one. The
cost is quadratic in the subpaths in it. This is why `edgeGlowPass` is the most
expensive thing in the game and why several proposals in that document were
probably cheaper on paper than they will be in practice. Anything in that list
that adds a pass over all 192 segments should be re-costed after stops 1 and 2,
at which point most of them genuinely will be nearly free.

**VISUAL.md, on the ground plane.** It records the absence as a deliberate design
decision and scopes around it. The decision was deliberate but the projection
substrate for a ground plane already exists in `drawGrid` and has done all along,
so the cost of reversing it is much lower than that document assumed. I think that
scoping was correct given what was known and is wrong given what is measured.

**The brief, on frame budget.** "There is negative headroom before you add
anything." True as shipped, false as achievable. There is roughly two and a half
times the current throughput available before any art direction question is
reached.

**The brief, on the void.** "The most distinctive thing about the game, a road
floating at altitude with vertigo beneath." I could not find that in any frame I
captured. It reads as dark ground. I may be wrong about how it feels in motion on
a phone, which I cannot test, and if a cold player has described vertigo then
trust that over this.

**BRIEF.md section 4.3, on draw distance.** The 3.5 second planning horizon is
measured in time and enforced through `DRAW_DISTANCE_SEGMENTS`, but 136 of the 192
segments serving it are under a pixel tall. The planning horizon is currently
being delivered by about 56 segments and paid for with 192. Coalescing keeps the
horizon and stops paying for the rest, which is why it is free rather than a
trade.

---

## Measurement protocol

Everything above needs confirming on the real device, because my absolute numbers
do not transfer. The instrument already exists: the worst frame readout behind the
FPS toggle.

For each stop, on the weakest available machine, in the same biome, on a pinned
seed:

1. Worst frame in milliseconds over a full 60 second run, before and after.
2. Mean frame rate over the same run.
3. Pixel diff of a frozen frame, before and after, reporting pixels differing by
   more than 6 out of the total and the row range they fall in.
4. Luminance ranking of edge, road surface and terrain across all twelve biomes,
   with any biome where the order is not monotonic recorded as a failure.
5. Surface against void contrast at 1.7 and 3.3 seconds ahead, for stops 6 and 8
   specifically.

Any stop that fails 4 or 5 gets reverted rather than tuned.

---

## Prompt for the coder

```
Read https://driftfever.com. Single self-contained HTML file, Canvas 2D,
pseudo-3D segment projection. Everything below has been measured and the
numbers are reproducible with the game's own worst-frame readout.

THIS SESSION IS PERFORMANCE ONLY. No visual features. No scenery. No ground
plane. Two changes, both revertible, both behind named FEEL constants.

WHY. drawRoad is 92% of render(). Four passes are 82% of drawRoad. The cost
is not fill rate: an eight-fold change in viewport pixel count moves render
cost by six per cent. It is path tessellation, and it grows with the SQUARE
of the number of subpaths in a single path. Measured: 800 subpaths in one
fill takes 11.3ms, the same 800 split across 8 fills take 1.5ms, identical
pixels.

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
249 to 304, which is the band immediately under the horizon.

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

REPORT BACK:
- Worst frame in ms over a 60 second run on the weakest machine available,
  before and after each change separately and both together, same pinned seed
  and same biome.
- Mean frame rate for the same three cases.
- A frozen-frame pixel diff for each change: pixels differing by more than 6
  out of the frame total, and the row range they occupy.
- The road edge luminance ranking across all twelve biomes, before and after,
  confirming hard limit one still holds.
- The value of PATH_CHUNK_SUBPATHS at which alpha seams became visible, if
  they did.
- Anything in the above that turned out to be wrong on real hardware.
```

---

https://driftfever.com
