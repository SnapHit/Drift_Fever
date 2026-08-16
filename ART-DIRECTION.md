# Drift Fever: art direction

Written 12 August 2026. This supersedes BRIEF.md section 7 and VISUAL.md as the
statement of what the game should look like. Both of those remain useful for their
readability rules and their measured findings; this document sets the target.

---

## The target, in one line

**Art of Rally at night.** A road running through a real place in the dark, where the
road is the lit object and the world around it is silhouette.

---

## Why this and not the reference images

The owner's reference images are Art of Rally in daylight, and in a lighthouse scene
at dusk. A visual architecture investigation on 12 August established what transfers
and what does not, and the distinction matters enough to write down, because chasing
the wrong half wastes a month.

**REACHABLE.** Trees, houses, banners, hedges, marker posts, terrain that follows the
road and rolls, silhouette masses at three or four depths, a night palette, the
existing city given real height. These are flat shapes projected and filled, which is
exactly what this renderer does. The same investigation established there is room for
600 to 1,500 objects per frame once the batching defect is fixed.

**REVISED 13 AUGUST 2026. THIS SECTION USED TO SAY THE LIGHT WAS UNREACHABLE. IT WAS
WRONG, AND THE REASON IT WAS WRONG MATTERS.**

The original claim: per-object shading with a light direction is impossible because
Canvas 2D fills a shape with one flat colour, and therefore the limit is the shading
model rather than the speed.

The first half is false. A face can be filled with a colour chosen from its own normal,
which is exactly what flat shading is, and it is how every low-poly game of this kind
looks the way it does. The car already does this: drawBox spins each face normal into
world space every frame for the back-face cull, so the dot product is one array index
on a vector the loop already holds. Measured cost: 3.6ms off, 3.4ms on. Free.

The second half was true but only because of how the scenery happened to be built.
Scenery objects are 2D profiles from SCENERY_PROFILE, mirrored into a lit half and a
shade half. There are no faces out there to take a normal of. That is a property of
this particular implementation, not of Canvas 2D.

**SO THE TARGET IS NOW REAL GEOMETRY.** Scenery objects get faces with normals, shaded
against one world light. Depth sorting so objects occlude correctly. Cast shadows on
the ground. This is a renderer change and it is the thing that actually closes the gap
to the reference images, which nine sessions of palette and silhouette work did not.

**What is still unreachable:** volumetric light. A beam falling through air, headlight
cones on terrain, coloured bounce between surfaces. Those need per-pixel work and they
stay out of scope.

**The silhouette and depth structure remain necessary and are no longer sufficient.**

---

## The thing that makes it work anyway

The reason those reference frames are beautiful is composition and value structure
rather than the lighting model. A bright road winding through dark terrain, with a few
lit things placed deliberately, is entirely reachable.

**And the game already has the strongest asset for this: the car casts a glow pool on
the road.** With a dark world beyond and a lit road, the game reads as headlights in
the dark, which is exactly the emotional register of the reference images. That is
achievable, it uses what already exists, and it is the single idea the art direction
should be built around.

---

## The frame budget, which decides how far this goes

Gate 1 of the scenery work found the renderer's cost is quadratic in the number of
subpaths in a single fill, and fixing it took the throttled build from 21fps to 62fps.
That win is what funds real geometry.

Faces, normals and sorting cost more than flat profiles. The target is unchanged: 60fps
on a five-year-old Celeron Chromebook, which is the audience. Anything that cannot hold
that ships behind a constant defaulted off, with its cost measured and reported.

Object count is not the binding constraint. Subpaths per fill is. Keep every fill well
under 64 subpaths and the count stops mattering until the thousands.

## The value structure, which is not negotiable

The investigation's key argument: emptiness is currently doing real work. The road is
the only lit object in the frame, which is why the edge reads as strongly as it does
and why the car is findable in every biome. The moment there is terrain, the contrast
budget is shared, and every future visual decision gets harder. That is a permanent
tax, not a one-off cost.

So fill the world, but keep what emptiness was buying:

```
edge        brightest, always, in every biome
road        lit, and clearly separated from terrain
terrain     darker than road
sky/void    darkest
```

The near field stays sparse so the road still has air around it. **Aim for the road
being the lit object in a dark world, rather than one lit object among many.**

---

## What was rejected, and why it stays rejected

**Warm naturalistic daylight.** It is the reference image and it is the thing that was
asked for. It throws away the single readability advantage the game has, for a look
this renderer cannot reach anyway.

**A street-level laneway.** The camera is 2,200 units up with a 92 degree field of view
looking down at a road that fills most of the frame. Nothing about that composition
becomes a laneway without changing the camera, and changing the camera changes the
game.

**Continuous atmospheric perspective.** Real distance fog tints and desaturates every
object continuously by depth. Three or four discrete depth bands with their own palette
entries are affordable; they read as depth from a distance and as banding if anyone
looks closely. Acceptable trade, but not the same effect.

**A forest.** The reference images contain thousands of trees. There is room for
hundreds. The mid distance gets drawn as a few large silhouette masses rather than many
small objects, which is cheap because vertices inside a subpath are linear while
subpaths are quadratic, and it is also how flat-shaded games have always done it.

---

## What supersedes what

- **BRIEF.md section 7** asked for bright, saturated, never grey, and explicitly
  refused a dark neon palette. It was overruled once already, and this document is the
  second and final overrule: the game is dark by design and the readability half of
  section 7's argument is answered by the value structure above, which is measured
  after every visual change.
- **VISUAL.md** scoped everything to "a wet elevated road through a city seen across a
  dark gap" and ruled out a ground plane. That scoping is now withdrawn. Its per-item
  drawing methods, frame costs and readability warnings remain accurate and useful.
- **The batching convention in both documents is wrong.** "One more pass costs one more
  fill" is true of the call and false of the cost. Path cost grows with the square of
  subpath count. See the scenery architecture investigation.

---

## The rule that governs every decision below this line

The road edge is the brightest, most readable thing on screen, in all twelve biomes, at
maximum multiplier and full slip. It is measured after every visual change. Nothing
about beauty outranks it, because it is the difference between living and dying.
