# Drift Fever: wet neon night

A visual investigation against the live source at driftfever.com. 9 August 2026.

## The short version

The background is not plain rectangles because nobody drew a city. It is plain rectangles because the city has been given five per cent of the screen height to live in, and at forty pixels tall nothing can look like architecture. That one constant is the highest impact change in this document and it costs nothing, because the skyline sits entirely above the horizon and the file already establishes that anything above the horizon cannot take contrast away from the road.

Six of the eleven items below are free or near free, because the renderer is already batched to the point where an extra pass over geometry that is already walked costs one more fill. Two are worth measuring before committing. Three are a rebuild and I would not do them before September.

One finding worth stating early, because it changes what to build: the reference image supplied is not a picture of rain. Look at it again. There is almost no visible precipitation. Everything that reads as wet in that image is reflection, and every reflection is a vertical smear running down the frame from a light source toward the camera. That is exactly the shape a pseudo three dimensional projection produces for free, and it is why the reflection items in this document are cheap and the rain item is not worth building.

## What the source actually does

Read so the proposals sit inside the existing architecture rather than beside it.

The world draws in a fixed order: void fill, horizon glow band, skyline, ground grid, road, haze band, smoke, car, debris. Everything before the haze band is under a single shake translate.

The road is walked once per frame into seven parallel Float64Arrays of boundary values, then drawn from those arrays by around a dozen batched passes. Each pass opens one path, adds a quad per visible segment, and issues one fill. Per segment cost is therefore path construction, not draw calls.

Glow is universally two pass: the same shape wide and faint under the same shape solid. No shadowBlur anywhere. Any new lit thing must follow that pattern or it will look foreign.

The whole palette lives in one COLOUR object and is hue rotated twelve ways at biome change, with a pinned list for anything that must never move. Every cached fill string, colour ramp and radial gradient derived from the palette is rebuilt in one function, and the horizon and haze gradients are rebuilt by resize, which the biome change calls.

There is no ground. The file says so explicitly: the void is the whole background and the road is an object floating in it, with a thickness, a lit underside line, and a cliff wall down each side.

The car is a lofted hull of seven stations by eight ring points, back face culled, flat shaded per face band, plus four wheel boxes, three spoiler boxes, a rear light bar with a two pass glow, and two rim glow insets. It is around fifty small fills, which makes it by some distance the most expensive object per screen pixel in the frame.

The skyline is forty pre generated buildings, repeated horizontally over an eleven hundred pixel period, parallaxed against both lateral position and distance travelled. Roughly fifteen are in shot at any moment. Windows are a fixed grid per building with a fixed threshold each, lit by comparison against a single drift driven value.

## The no ground problem, stated plainly

The supplied reference is a street photographed at street level, with kerbs, pavements, shopfronts and building bases all standing on the same wet surface the car sits on. Drift Fever cannot become that image without a ground plane, and a ground plane is a rebuild that reverses a decision the file records as deliberate.

What is achievable is a different and still good image: a wet elevated road, lit from its own edges and from posts along it, running through a city seen across a dark gap. That is closer to an expressway at night than to a laneway, and it is the version that fits the architecture. Everything below is scoped to that, and I would not chase the laneway before September.

## How the costs below are worked out

The file contains its own calibration, which is more useful than anything I could estimate from outside. The edge bleed pass records that a filled version costing roughly 380 subpaths across three paths measured between two and five milliseconds a frame on the target class of machine, and that the rasteriser is paying for path complexity and bounding boxes rather than for lit pixels. That gives a working rate of very roughly five to thirteen microseconds per large subpath, and it says that the thing to count is subpaths weighted by bounding box area, not pixels.

So the cost labels used here are:

Free: under about 0.1 ms. Typically means adding rectangles to a path that is already being built, or a single full width fill with a cached gradient.

Cheap: 0.1 to 0.5 ms. One extra batched pass over a small or heavily culled subset of the geometry.

Moderate: 0.5 to 1.5 ms. One extra full pass over the road, or something comparable to redrawing the car.

Expensive: above 1.5 ms. Worth building only if it is measured first and the number comes back acceptable.

The budget is 16.7 ms. Do not treat that as the headroom, because the target machine is also running the browser, the filter extension and whatever else the school image loads. Treat the worst frame readout already in the game as the number that matters, not the average.

## Ranked by visual impact per unit of work

Items one to nine are one build session. They touch two functions, drawSkyline and drawRoad, plus a small addition to drawPylons. Items ten and eleven touch drawCar, are the two with real measurement risk, and should be a second session.

## The proposals

### 1. Give the skyline room

**What it is.** The tallest building in the game is five per cent of screen height. On a phone that is about forty pixels. The horizon sits at 0.32 of screen height, so there are roughly twenty eight per cent of the screen of completely empty void above the city. Raise the ceiling into that space and the same forty buildings become a skyline instead of a serrated edge.

**How it is drawn.** It is one constant. SKYLINE_MAX_HEIGHT from 0.05 to somewhere around 0.16 to 0.20, and SKYLINE_MIN_HEIGHT lifted a little with it so the short blocks do not vanish by comparison. Nothing else changes. Every subsequent item in the skyline group is worth two or three times as much once this has been done, because they all have somewhere to happen.

**Frame cost.** Free. Identical subpath count, taller rectangles, and the fill is against a flat void so there is no overdraw penalty worth measuring.

**Closest rule.** None of the road rules. The skyline is above the horizon and the file already argues at length that this is why the city can be lit as brightly as it likes. The real risk is different: the HUD lives at the top of the screen and taller buildings will start passing behind the score and the clock. Check that the score still reads at the top of a tall building with lit windows, and if it does not, the fix is the existing text shadow rather than a shorter city.

### 2. Reflection streaks from the pylons

**What it is.** Every lit thing on a wet surface throws a long soft smear toward the viewer. There are already lit posts down both edges of the road at fixed segment intervals, with a two pass glow. Give each one a streak running from its base down the screen toward the camera and the road is wet. This is the single best ratio in the document and it invents no new objects.

**How it is drawn.** In pylonPath the projected base position, outboard offset and width of every visible post are already computed. In the same loop, add a second path with one tapering quad per post: top edge at the post base at the post width, bottom edge some segments nearer the camera at two or three times the width, drawn inboard of the post so it lands on the road surface and not on the void. Fill it once, flat, at low alpha, in the pylon glow colour. Draw it after surfacePass and before the edge and lip passes, so the lip is always painted over the top of it.

for each visible pylon segment n:

x  = bx[n] + side * bw[n] * (EDGE_OUT + PYLON_OUT)

m  = n - REFLECT_SEGMENTS          // nearer the camera

quad from (x -+ w0, by[n]) to (bx[m] -+ w1, by[m]), pulled inboard

**Frame cost.** Free. Around three to six posts are in shot at once, so this is a handful of subpaths in one extra fill.

**Closest rule.** Nothing over the drivable road ahead. A streak is on the road, and if it is long enough and bright enough it will start reading as a lane marking or, worse, as an edge. Keep it outboard of the lane dash fraction, keep it under the shoulder in luminance, and make its length a constant so it can be tuned down by playing rather than argued about.

### 3. Second skyline layer, further and slower

**What it is.** One city at one parallax rate is a backdrop. Two cities at two rates is depth, and it is the oldest trick in the genre because it works at any resolution and costs nothing.

**How it is drawn.** drawSkyline already takes its period, parallax, drift, base and height range from constants. Call the same loop twice with a second set: a longer period so the far buildings are wider apart, a lower parallax and drift so they slide more slowly, a lower height range so they sit shorter, a base a pixel or two higher up the screen, and a darker fill somewhere between the void and the near silhouette. Draw the far layer first. Give it no windows, no roof line and no signage, because distance is mostly the absence of detail.

**Frame cost.** Free. It is one more fill of about fifteen small rectangles near the horizon, where bounding boxes are at their smallest.

**Closest rule.** None. Both layers are above the horizon. Watch only that the far layer stays clearly above the void in value and clearly below the near layer, or the two will merge into one noisy band, which is the audit finding in miniature.

### 4. Building shape variety

**What it is.** Every building is one rectangle. Real skylines are setbacks, crowns, masts and water towers, and the difference between the two readings is entirely in the top ten per cent of the silhouette.

**How it is drawn.** The generation loop at load already assigns each building a height and a window grid from its own seeded generator. Give each one a shape class from the same generator: plain, setback, which is a second narrower rectangle on top, crowned, which is a much narrower short rectangle, or masted, which is a one or two pixel wide spike. Then the draw loop pushes two or three rectangles per building into the same path rather than one. Everything stays batched and everything stays in one fill.

**Frame cost.** Free. Roughly forty five small rectangles instead of fifteen, in the pass that is already the cheapest in the frame.

**Closest rule.** None. The one thing to avoid is a mast so thin it disappears at device pixel ratio one and shimmers at two. Clamp the minimum width to one pixel the way the window fill already does.

### 5. Window glow pass and a cool minority

**What it is.** Lit windows are currently flat amber squares at a capped alpha. Two changes make them read as light rather than as paint. First, give them the same two pass treatment everything else lit in this game gets. Second, make a minority of them a cool white or pale blue, because every night city photograph ever taken has two colour temperatures in it and one is what makes it look like a lighting diagram.

**How it is drawn.** In the same window loop, build two paths instead of one: a wide path where each rectangle is inflated by a pixel or two, and the existing tight path. Fill the wide one first at roughly a third of the alpha, then the tight one. For the cool minority, use the per window threshold that already exists: any window whose threshold falls in a chosen band goes into a third path filled in the cool colour. That is three fills for the whole city and no new state.

**Frame cost.** Free. The window pass is already conditional on the city being lit at all, and window rectangles are a few pixels each.

**Closest rule.** None directly. The existing comment justifies the amber as the road edge fire spreading to the city, and a cool minority weakens that argument slightly. Keep the minority small, around ten to fifteen per cent, and keep the cool colour dimmer than the amber so the warm reading still dominates.

### 6. City halo on the horizon band

**What it is.** A city at night lights the sky above it. The horizon glow band already exists, is already cached as a gradient, and is already filled twice when the multiplier is up. A third fill of the same band, keyed to the city glow rather than to the multiplier, gives the sky a source.

**How it is drawn.** One extra fillRect of the existing horizon gradient over the upper half of the band only, at an alpha driven by the same city glow value the windows use. The upper half restriction is not decoration: the file records that deepening the lower half of that band lit the void behind the far road and destroyed the surface against void contrast at the planning horizon, which is the one measurement in the file that came out badly the wrong way. Do not repeat it.

**Frame cost.** Free. One fillRect of a cached gradient over a band a few per cent of screen height tall.

**Closest rule.** Road surface separated in value from the void, and only if the upper half restriction is not respected. Above the line it cannot cost anything.

### 7. Wet sheen on the far road

**What it is.** Wet asphalt is a mirror at a grazing angle and matte underfoot. That is Fresnel, and it is why photographs of wet streets are blinding in the distance and ordinary in the foreground. It happens to be the most convenient possible fact for this game, because the far road is where the sheen belongs and the far road is also where the segments are smallest and cheapest.

**How it is drawn.** One more pass in the same shape as surfacePass, over the far segments only, with fillStyle set to a vertical linear gradient cached at resize. The gradient runs from a pale tint at the horizon to fully transparent about a third of the way down to the camera. Canvas takes a gradient as the fill style of an arbitrary path, so this really is one extra batched fill and no clipping. Cull it by projected half width: stop adding segments once the road is wider than some threshold, which is exactly the opposite of the existing glow cull and stops the pass before it reaches the expensive near geometry.

WET_SHEEN_FROM   // projected half width above which the sheen stops

WET_SHEEN_ALPHA  // ceiling on the gradient, tuned by playing

**Frame cost.** Cheap. Half or fewer of the road segments, all of them small.

**Closest rule.** The edge must be the brightest thing on screen. This lifts the road surface in exactly the region where the edge lip is thinnest and hardest to read, which is the worst place to reduce the contrast step. The file already has form here, having measured the lip falling from 207 to 182 in luminance when a glow alpha was raised carelessly. Sample the lip and the surface at two and at three seconds out before and after, and if the gap narrows, the sheen alpha comes down. That measurement is the acceptance test for this item.

### 8. Neon signage on the buildings

**What it is.** The vertical purple sign in the reference image is doing more work than anything else in that photograph. It is the cue that says city street at night rather than city at night. A handful of them across the skyline, mostly vertical, some horizontal, two pass glowed.

**How it is drawn.** At load, tag a small number of buildings as sign carriers and give each a fixed offset, orientation and length from the same seeded generator the windows use. At draw time that is one wide faint path and one solid path across all visible signs, so two fills for the whole city. No text, no glyphs, no font: a bar of light reads as a sign at this scale and anything more legible would be a distraction sitting above the road.

**Frame cost.** Cheap. Perhaps four to eight signs in shot, two fills.

**Closest rule.** The car must stay findable against all twelve biome hues. This is the one item that wants to introduce a saturated colour family, and the palette already spends three of them: warm road, cool car, pinned pink for hazards and pinned green for jumps. A fifth family that hue rotates will eventually land on the car. Two ways out, and I would take the first: derive the sign colour from the current biome by a fixed rotation, so it always sits a known distance from everything else on the wheel, or pin it and accept that it collides with one biome in twelve. Either way keep signs above the horizon only, where they cannot compete with anything that matters.

### 9. Street lamps and light pools

**What it is.** Real light sources at road level, which is what the brief is asking for and what the game currently has none of. Every fourth marker post becomes a lamp: the existing post, a lit head at the top, a two pass glow around the head, and a pool of light on the road below it.

**How it is drawn.** The post geometry is already computed in pylonPath, so the head is a small rectangle at the top of every nth marker post added to two batched paths, wide and faint then solid. The pool is the pattern the car already uses: a radial gradient built once per palette rebuild, filled through a translate and scale, so each pool is a single fill and allocates nothing. Cache the gradients in the same function that builds the car pool gradients, so a biome change cannot leave a stale colour behind.

ctx.translate(poolX, poolY); ctx.scale(rx, rx * LAMP_POOL_SQUASH);

ctx.fillStyle = LAMP_POOL_GRADS[i]; ctx.arc(0,0,1,0,TAU); ctx.fill();

**Frame cost.** Cheap to moderate. Three to five lamps in shot, so three to five radial gradient fills plus two small batched fills. Radial gradients cost more per pixel than flat fills, so the size of the pool is the cost, not the count. Keep the pool inside about a road half width and this stays cheap.

**Closest rule.** Nothing over the drivable road ahead, and this is the item that comes closest to breaking it outright. A pool of light is by definition on the road. Two constraints make it survivable: the pool must be warm neutral rather than a new hue, and it must not reach the centre line, so its horizontal extent is clamped against the projected half width rather than being a fixed world size. If a pool ever gets bright enough to be mistaken for the lit edge, it has failed regardless of how good it looks.

### 10. Curved car silhouette

**What it is.** Exactly the request: the same projected corner points, joined by curves instead of straight lines, so the car keeps its existing motion, roll, yaw, culling and shading and gains a smooth body. This is achievable and it is worth doing, with one caveat that has to be understood before it is built.

**How it is drawn.** The hull is six rings of eight quads. Each quad shares two of its edges with its neighbours. If a shared edge is curved by one face and not the other, or curved differently, a crack opens along it and the car will show hairline gaps that flicker as it rolls. The rule that avoids this is that the control point for an edge must be a pure function of that edge alone, computed identically from either side. In practice: bulge each ring direction edge outward along its own screen space perpendicular by a fixed fraction of its length, and leave the station to station edges straight. Both faces sharing that edge then generate the same quadratic and the hull stays watertight.

mid = midpoint(a, b);  n = perpendicular(b - a) normalised

ctrl = mid + n * CAR_HULL_BULGE * length(b - a)   // same from both faces

ctx.quadraticCurveTo(ctrl.x, ctrl.y, b.x, b.y)

**Frame cost.** Moderate. Around twenty five hull faces are visible at once and each goes from four straight edges to two straight and two flattened curves. Curve flattening is real tessellation work, so budget somewhere between 1.3 and 1.8 times the current hull cost. The hull is roughly half the car, so this is a fraction of a millisecond, but it lands on the most expensive object in the frame and should be measured rather than assumed.

**Important caveat.** This curves the interior seams as well as the outer boundary, because at this ring density most edges are interior most of the time. The car is about fifty pixels across. Curved interior seams at fifty pixels can read as mush rather than as smoothness, and the file already records that flat tones alone did not separate the roof from the boot and that the fold lines are what make the car read as folded paper. Build it behind a constant, set that constant to zero, play it, and raise it until it stops looking like a car. If the answer is that any value above zero is worse, that is a real result and the honest thing is to leave it at zero rather than ship a soft car.

**Closest rule.** The car must stay instantly findable against twelve hues. Findability comes from value and from silhouette, and softening a silhouette spends some of it. The existing warm car in a cool world discipline is doing most of the work and is not affected, so this is a small risk, but it is the direction of the risk.

### 11. Car reflected in the road

**What it is.** The strongest single image available to this game, and the one that would make the screenshot look like the reference photograph. A car with a lit rear bar, sitting on a wet road, throws its own light back at the camera underneath itself.

**How it is drawn.** Do not attempt a mirror. Draw the car a second time, before the real car, under a transform that flips it about its contact point and squashes it, at low alpha. Because drawCar computes screen positions from world coordinates every frame, a canvas transform applied around the call inherits everything: the yaw, the roll, the pitch, the slip, the whole thing, with no duplicated logic.

ctx.save();

ctx.translate(0, contactY); ctx.scale(1, -CAR_REFLECT_SQUASH);

ctx.translate(0, -contactY); ctx.globalAlpha = CAR_REFLECT_ALPHA;

drawCar(w, h);   // same object, upside down and faded

ctx.restore();

**The clipping problem.** A reflection that hangs off the side of the road onto the void destroys the surface against void separation, which is the second readability rule. The obvious answer is to clip to the road surface path, and the obvious answer is wrong: clipping to a two hundred subpath path is expensive and unpredictable across drivers. Use a rectangular clip instead, sized from the projected half width at the car segment, which is already sitting in the boundary arrays. Rectangular clips are cheap everywhere.

**Frame cost.** Moderate to expensive. It doubles the most expensive object in the frame, and the car is around fifty small fills. Expect somewhere between 0.8 and 2.0 ms depending on how much of the reflection survives the clip. Two ways to halve it if the number comes back badly: skip the wheels and the spoiler in the reflection pass, since neither is legible upside down at low alpha, or skip the reflection entirely while the car is airborne, when there is nothing under it to reflect in anyway. The second is free correctness as well as free performance.

**Closest rule.** Nothing over the drivable road ahead. The reflection is directly under the car, which is the least harmful place on the road for it to be, since the player has already committed to that ground. It must not extend forward of the car, only backward toward the camera, and the squash constant is what controls that.

## What I would not build, and why

### Rain

One batched stroke of a hundred or so short lines is genuinely cheap, so cost is not the objection. The objections are that rain covers the drivable road ahead by definition, that it is animated noise laid over the exact region the player is reading for survival information, and that it is precisely the kind of extreme embellishment the audit found tests as badly as none at all. Set against that, the reference image the whole exercise is built on has essentially no visible rain in it. The wetness there is entirely reflection. Build the reflections and the rain is unnecessary; build the rain and the reflections still have to be built. It is the worst ratio on the list.

### A ground plane, kerbs and pavements

This is the only route to the street level laneway image, and it is a rebuild rather than an addition. It reverses a design decision the file records deliberately, the road floating in a void with a thickness and a lit underside is the current identity, and it would touch the wall pass, the underline, the bleed, the grid and the void fill at once. It also compresses the value range: the void being nearly black is what gives the road surface its separation, and putting a mid grey street in the gap spends that. Not before September.

### Any full screen post effect

Bloom by reading pixels back, blur by ctx.filter, chromatic aberration, vignette by gradient over the whole frame. The first two are unaccelerated or slow on exactly the driver class being targeted, and a full frame readback at device pixel ratio two on a Celeron is several milliseconds on its own. The existing two pass glow convention is the correct answer for this renderer and it already looks like bloom.

### A true mirrored skyline in the road

There is nowhere to put it. The skyline is above the horizon and the road converges to the horizon from below, so a geometrically correct reflection would land beyond the vanishing point. The wet sheen in item seven is the honest substitute: it says the surface is reflective without claiming to reflect anything specific.

### Animated ripples, caustics or a normal mapped surface

These need per pixel work. Canvas 2D cannot do per pixel work at sixty frames per second on this hardware. Not a judgement call.

## Wiring notes that will bite

These are not proposals, they are the things this codebase punishes.

Every new colour goes in COLOUR and nowhere else, so it rides the hue wheel. If it must not rotate, it goes in PALETTE_FIXED with a comment saying why. A colour defined outside COLOUR will be correct in biome one and wrong in the other eleven.

Every cached fill string built from a COLOUR value must be rebuilt in rebuildDerivedColours. That function exists precisely because a cached fill that missed a rotation puts the last biome colour in the middle of this one, in the places the eye is already looking.

Every new gradient must be built in resize, which the biome change already calls. A gradient built once at load will be the wrong colour from the first biome change onward, and the wrong size from the first rotation onward.

Every new feel constant goes in the FEEL block with the rest, per the standing rule about inline multipliers. Anything meant to be judged by playing should also go in the TUNABLES table so it can be tuned on the phone rather than by editing and reloading.

Do not curve the shared polygon helper. It is used by the hull, the boxes, the light bar, the hazards and the jumps. Curving it curves everything. The hull needs its own curved quad function.

Anything drawn on the road surface belongs in the pass order between surfacePass and the edge and lip passes, so the lip is always painted last and always wins. Anything drawn after the edge passes can darken the brightest thing on screen, which is the failure the hard limits exist to catch.

The skyline generator uses its own seeded random, deliberately, because drawing from the road generator would move the road and break pinned seeds. Any new load time generation for signs, shapes or window colours must use that same separate stream.

## Suggested order for the session

Grouped so each stop is playable and each is separately revertible.

Stop one, skyline. Items one, three, four, five, six. All in drawSkyline and its load time generator. Nothing here can touch the road, so this is the safe block and it should go first. Play it. If the background alone does not now read as a city, nothing after this will fix that.

Stop two, the wet road. Items two and seven. Both in the road pass list. Play it, and take the lip against surface luminance measurement at two and three seconds out before moving on.

Stop three, lights. Items eight and nine. Signs above the horizon, lamps and pools at road level. Play it on a phone in a dark room, which is the only place a lighting change can be judged.

Stop four, only if the frame rate is still clean. Items ten and eleven, the car. Behind constants that default to off, so the session can end with them at zero and nothing is lost.

## Proving it did not cost anything

The game already has a frame rate readout with a worst frame figure behind the debug toggle, and the live tunables persist. Use it properly rather than eyeballing it.

Take the worst frame figure on the weakest available machine before touching anything, on the daily seed with the seed pinned, so the road is identical between runs.

Take it again after each stop, on the same pinned seed, at the same point in the run. A biome change reallocates gradients and rebuilds ramps, so measure across at least one gate crossing or the most expensive frame in the game will be missed.

The number that fails is the worst frame, not the average. A pass that averages fine and spikes to thirty milliseconds on the frame where the city lights up is a pass that stutters exactly when the player is drifting hardest.

If a stop costs more than about a millisecond of worst frame, the first lever is not deleting the feature, it is DRAW_DISTANCE_SEGMENTS. But that constant is also the planning horizon the whole design rests on, so lowering it is a design change and should be argued rather than done quietly.


https://driftfever.com

## Summary table

| Item | What it buys | Frame cost | Closest rule it threatens |
|---|---|---|---|
| 1. Give the skyline room | The single biggest change in the document. The city is currently a 40 pixel strip. | Free | None. It is all above the horizon. |
| 2. Reflection streaks from the pylons | The road reads as wet. This is the effect people actually mean by wet. | Free | Nothing over the drivable road. |
| 3. Second skyline layer, further and slower | Depth. Two parallax rates is the whole trick. | Free | None. |
| 4. Building shape variety | Architecture instead of a bar chart. | Free | None. |
| 5. Window glow pass and a cool minority | Windows that read as light sources rather than dots. | Free | None. |
| 6. City halo on the horizon band | Light spilling off the city, which is what a night sky over a city looks like. | Free | Road surface against void, far field. |
| 7. Wet sheen on the far road | Grazing angle specular. The road stops being matte. | Cheap | Edge stays brightest, far field. |
| 8. Neon signage on the buildings | The most recognisable single cue in the reference image. | Cheap | Car findable against twelve hues. |
| 9. Street lamps and light pools | Real light sources at street level, and something for the road to reflect. | Cheap to moderate | Nothing over the drivable road. |
| 10. Curved car silhouette | The object the player stares at for the whole run stops being faceted. | Moderate | Car findable against twelve hues. |
| 11. Car reflected in the road | The strongest single image available. It is the reference photo. | Moderate to expensive | Nothing over the drivable road. |

---

## The player's car changes colour and he lost it, 24 August 2026

The first feedback from a real player of the released game, verbatim: "I was a bit surprised that
your car changes colour when you go from one section to the next, it could be confusing, maybe an
arrow could be added to show which car is yours as it can get confusing when you get used to a car
and it suddenly changes yellow."

He is right and it is our own doing. The body colour is derived per biome at the point of MAXIMUM
HUE SEPARATION from the palette, which is the correct rule for FINDABILITY and was measured as such
in every biome after every visual change. **Findable and identifiable are not the same property and
only the first was ever measured.** Measured over the twelve biomes the player's `CAR_TOP` hue visits
190, 30, 13, 196, 0, 100, 38, 292, 182, 52, 213 and 172 degrees, which is the whole wheel, and the
tail light went round with it. Nothing about the car was constant.

**The body must keep turning, so the constant is the light.** Every tail light colour and the car's
own glow ramp are in `PALETTE_FIXED` now, so no biome touches them. Two things follow: the player's
car has a pale tail bar and sits in a warm amber pool of its own light in every one of the twelve
biomes, and no player car uses `CAR_LIGHT`, which is red and is what every racer uses. One sentence
covers it at any distance: the white lights are yours.

**This overturns a decision that was written down**, and the note on `CAR_RIM_DARK` said it plainly:
the car's cosmetics are in `COLOUR` and not in `PALETTE_FIXED` "so they turn with the world like every
other part of the car. A rim that ignored the wheel would be the one object on screen that belongs to
no biome." Belonging to no biome is the point. The car belongs to the player, not to the place. The
rims and the seams are still trim and still turn; the lights do not.

**Findability is unchanged, and that is measured rather than asserted.** The same body, at the same
place on the same road, rendered in each of the four palettes and differenced against the road behind
it: the player's paint stands out most in 11 of 12 biomes, is the most saturated in 12 and the highest
contrast against the void in 12, which is exactly what it read before the change. The known answer,
turning the racers' desaturation off, drops the first of those from 11 to 6, so the measurement can
see the rule it checks.

**No arrow.** It was his suggestion and it is worth saying why not: a permanent marker over the car
is HUD in the world, which this game has kept out, and it answers "where is my car" when the question
he actually asked was "which one is mine". A light on the car answers the second and adds nothing to
the frame that is not a car.

---

## The title screen in landscape, 24 August 2026

Reported from a phone held sideways: the training button drawn on top of the new-tracks line, and the
two lines under the wordmark drawn through each other. Portrait was fine.

**The cause is that nothing on that screen is narrower in landscape.** Every size in the stack is a
fraction of `s`, the SMALLER screen dimension, which is the same 390 whichever way a phone is held. So
the stack is exactly as tall in landscape as in portrait and is simply asked to fit in half the height.
Measured at 844 by 390 before the fix: `MUSIC IS ON` sixteen pixels through the `SKIP THE TRAINING`
button, the music sentence seven pixels through the training caption, the track line four pixels
through the unlock ladder. Every landscape viewport tested collided, from 640 by 360 to 1024 by 768.
No phone portrait one did.

**Landscape gets two columns**, on the argument `HUD_BAR_RATIO` already won for the HUD. The wordmark
and the prompt stay centred and stay the hero; under them the information rows go left and the button
groups go right, which uses the width the portrait layout leaves empty. The bottom row does not move.
The wordmark is measured against the TALLER of the two columns, which is what makes them fit rather
than hope to: the first attempt let it take everything the information rows had given up and the
button column then ran 78 pixels into `RANDOM TRACK`.

`TITLE_WIDE_RATIO` is 1.30 and not the HUD's 1.35 deliberately. The HUD asks whether a thin strip fits
across the top, which needs width. This asks whether two columns fit under a wordmark, which is forced
by a shortage of height. 4 by 3 is 1.333 and is a real landscape shape, being a Chromebook and a tablet
held sideways, so the cutoff goes below it rather than above.

**And a tablet held upright is the same bug without the landscape.** At 768 by 1024, `s` is 768 while
the height is only 1024, so the portrait stack overflows by two pixels. The wordmark is already at its
floor there, so the honest answer is one row fewer: the unlock ladder stands down. It is chosen rather
than picked, being the only purely informational row on the screen, and it already disappears by itself
once every car is earned. Same rule the fine print follows: take the room the screen can spare.

Measured after, across eight viewports and all five full screen states: every one clear, tightest
clearance 3 to 57 pixels and nearest approach to a screen edge 13 to 88. The death, pause, level
complete and day complete screens were clear before and are untouched. Phone portrait layout is
identical box for box.
