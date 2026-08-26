# NPC racers: agreed design, built on the random track

Agreed 16 August 2026. **Built 20 August 2026, on the random track.** All four stages ship: they
exist and race, the pace law, blocking, and contact. What follows is the agreed design, with the
open questions at the bottom now answered by the build rather than left open.

The constants are the `NPC_` block in `index.html` and every one of them is on the tuner, group 31.
The pace law is the part worth reading: it releases on TIME rather than on distance, and the note
there records why the distance version could not be made to work.

---

## Why, and what is wrong with the alternatives

The pace car does one job well and then stops. It teaches a first-time player what a ghost is,
by being called PACE CAR on run one and GHOST from run two. After that it is inert.

**A fixed-line racer would repeat that failure.** You pass it once and it is gone for the rest of
the level, which adds almost nothing. The problem is not that it is deterministic. The problem is
that it is **non-reactive**.

---

## The design

### 1. They respond on PACE, not on line

An opponent that falls behind speeds up. One that is well ahead eases off. So passing one does not
remove it from the race — it stays in play, it comes back, and the competition lasts the whole
level rather than one moment.

**This is the whole value of the feature.** Everything else is support for it.

**CORRECTED 21 August 2026, and the correction inverts the paragraph above.** "Falls behind speeds
up" is a band on POSITION, and it cannot be made to work. Two versions were built and measured and
both failed in opposite directions:

- **On distance.** Any law reading only the gap has a stable equilibrium wherever the racer's
  boosted pace matches the player's, and it sits there. The nearest racer's gap came back with a
  median of 3.4k and a ninetieth percentile of 3.4k — pinned to three digits for a whole run. That
  is the car that is always beside you whatever you do.
- **On time.** A release that let a racer stop chasing once it had been beaten for a sustained
  stretch fixed the pin, and produced the wrong game: a good player got away permanently. That is
  rubber-band difficulty with the sign flipped, help the weak and punish the strong, which the
  retention research kills under a different name.

**So the signal is HOW WELL THE PLAYER IS DRIVING, and never where anybody is.** A player driving
beautifully gets the full field on them; a player scraping every corner is driving away from a race
rather than toward one. The three outcomes fall out of one number:

| | |
|---|---|
| **Good** | chased hard, all race, and never escapes. Being chased IS the reward; the win is finishing ahead, not finishing alone. |
| **Mediocre** | a race they can win some of. Passed and repassed, not hounded. |
| **Poor** | not hounded and never alone. The field goes ahead and holds a pace that keeps it visible on the horizon. |

**This is not the adaptive difficulty section 4 kills.** The road does not change: same track, same
hazards, same widths, same warnings, same clock. Only the opponents respond, which is what opponents
are for, and BRIEF section 7 asks for exactly this under "difficulty offered, not imposed".

### 2. They BLOCK, they do not attack

They occupy road. The player has to pick a side, commit and thread past. That is the splitter
mechanic, which already exists and already works.

**No nudging, no bumping the player toward the edge, no aggression.** The reason is specific: the
core mechanic is a mercy gradient — scrape the edge, the bar drains, about 1.6 seconds to recover.
An opponent that pushes the player toward the edge is spending a resource the player was managing,
for a reason the player did not cause. That is the difference between hard and unfair, and BRIEF.md
section 4.3 records that unfair makes people close the tab.

It is also a comparability problem: a bump lands differently depending on where the player happened
to be, so two players on the same daily road could get materially different runs.

**The risk comes from the player's own line choice near the edge, not from contact.**

### 3. Contact is solid and tactile, and costs nothing

The player can bump into them. It must **feel** like a real race — a real, tactile knock, not a
soft absorb.

But it costs nothing: no damage, no spin, no loss of control, no sliding off the track. They are an
obstacle with a mind, not a hazard.

Getting the feel of that right without it becoming a penalty is the hard part of the build.

**Settled 22 August 2026, and the apparent tension was a misreading.** The first version shipped
"free" and not "solid": cars passed through one another, a median of 884 units merged between two
racers and 297 between the player and a racer. Two causes. There was **no racer-against-racer
contact at all** — the routine only ever compared a racer to the player, so three of the four cars
had nothing holding them apart. And where separating the player would have pushed them *outward*,
the push was refused and the overlap simply stayed.

The resolution is that **the inward-only rule limits where the PLAYER may be put, not how much
separation may happen.** A racer has nowhere it must not be except off the road, so:

- **Racer against racer** is fully solid and symmetric — half the overlap each, nothing left over.
- **Player against racer** keeps the inward-only share unchanged, and **the racer takes all of the
  rest** instead of its own share.
- **Pinned** — racer inside, edge outside — the racer yields the whole distance, because the player
  is the one who can die. There is always room: the road is two half-widths across and `NPC_EDGE`
  keeps a racer inside 0.86 of one.

One more thing was wrong and it was geometric rather than structural: **the box test was axis-aligned
while the cars are sideways.** At 25° of slip a 600×880 body reaches 916 units across, so two cars
held exactly 600 apart were correctly separated by the arithmetic and visibly overlapping on screen.
The span is `|w·cos| + |l·sin|` now.

Median interpenetration is **zero** on both pair kinds, and the free guarantee measures exactly what
it did the day it was written: 0 outward pushes in 4986 forced contacts, and identical survival
pinned in the scrape band with contact on and off.

### 4. Three of them

Two or three that stay in play beats a field of eight the player never sees. Three is the number.

### 5. Random track first, then port

Ship on the random track. It has no comparability constraint, no daily records at risk, and no
ghost to confuse. Prove the feel there, then port to the daily.

**Ported 23 August 2026, to every real daily level. Training is excluded.** The port cost one
concession and it was found by measurement, not by argument: **on the daily the player is not pushed
by contact at all.** With the player takeable, the *road itself* moved on 2 of 140 daily roads.

The chain is real and it is not a bug in the racers. `carX` runs to `carFrac`, to `scraping`, to the
speed factor, to `position`, to *when* `topUpRoad` asks for more road — and `hazardFits` reads
`curveScale`, which `updateDifficulty` sets from elapsed time. So a player nudged a few units early
in a run reaches the generator at a different moment and can be handed a different corner. A road
that depends on being bumped is not a shared road.

The cars are still fully solid. This is a share, not a switch: the racer takes everything the player
does not, which on the daily is all of it. Measured separation is unchanged.

**And the inward-only rule had a hole the size of a splitter.** It was written against the road
*edge*; a splitter sits at x = 0, dead centre, so "only ever toward the middle" and "toward a
splitter" are the same direction. A push that would land the car inside a hazard band is now refused
exactly as an outward one is. Measured over 20,725 applied pushes: none left the car inside a hazard.

**The port is the part to be careful about.** The daily's premise is that everyone drives the same
road, which is what makes ghosts comparable and the share card meaningful. Racers on the daily must
be deterministic from the seed — same starting positions, same pace law, same behaviour for
everyone on the same date. Their reactions to the player will differ because the player differs,
and that is fine. Their existence and their inputs must not.

---

## Rejected, and why

**An on/off toggle.** Considered and declined. It means two games: records are not comparable
between them, the ghost means different things, the share card has to encode which mode was used,
and every future feature has to work both ways. That is a permanent tax on everything downstream.

A toggle usually exists because a feature is not good enough to be mandatory. If racers make the
game better they belong in it; if they need an escape hatch, the design is wrong and should be
fixed rather than made optional.

---

## What already exists to build on

**`ghostSynthesise` was recovered from `0bb4018` as instructed and is now the racers' driver**, at
`racerAim` and the integration in `racersUpdate`. It was not rewritten.

`ghostSynthesise` drives the real drift model — HEADING_SNAP_TIME, GRIP_TIME, CENTRIFUGAL,
STEER_RATE — over the real road with a lane-holding driver aimed at the inside of the corner it can
see. An NPC is that, with a different target line, a pace law, and a solid car instead of a
translucent one.

**And the body is the player's own car, settled 21 August 2026.** A racer is the same seven-station
hull with the same faces, wheels, seams and light bar, drawn by the same functions with `carT`
pointed elsewhere on the road; only the six body colours differ. That works because the shading here
is carried in those colours rather than in a light term, so a hue rotation preserves the light
direction exactly. The three are rotations of the PLAYER'S hue at 90, 180 and 270 degrees, which
keeps the separation alive in every biome for free and leaves the player on the maximum-separation
point the file protects. They are desaturated and lowered in contrast so the player stays the most
findable car on screen.

---

## The open questions, answered by the build

- ~~What the pace law actually is, and how strong the rubber band can be before it reads as
  cheating.~~ **It reads driving quality and nothing positional.** See section 1 above, which
  records the two laws that were built and thrown away first and why neither could work. The signal
  is a rolling share of recent time spent OFF the edge, raised to a power because a scrape costs
  more than the time it takes, with the multiplier as a small second term. The multiplier alone was
  tried first and is a bad measure of quality here: measured, the mediocre driver ran a HIGHER
  multiplier than the good one, 9.20 against 8.26, because sawing about is very sideways and
  sideways is what it pays. At the top of the range a racer runs at 0.996 of what the player is
  actually covering ground at, which is what makes "never escapes" true rather than hoped for: a
  fixed top speed cannot follow a good player.
- ~~Whether they can leave the road, and what happens if they do.~~ **They cannot.** Clamped at
  `NPC_EDGE`, on the same rule the player has: the wall takes the sideways speed pushing into it and
  nothing else. A rival the player watches fall off is a worse advertisement for the mechanic than no
  rival at all. It used to be approximate: the clamp read the half width from the segment the car was
  on at the TOP of the frame and applied it after the car had moved a hundred and fifty units, so on
  road that narrows it held the car to the old width. Measured 23 August 2026, that let a racer sit
  at 1.02 half widths for a single frame. The clamp now reads the width where the car actually is and
  the worst reading over eight runs is 0.86 exactly, which is `NPC_EDGE`, with the forced known
  answer landing on 1.45 exactly.
- ~~Whether they interact with hazards and jumps or ignore them.~~ **They take every jump and they go
  round hazards.** The launch is the player's own arithmetic with the player's own constants, lip
  loss included, so a racer's flight is the same flight and lands on the same road `jumpRunout`
  reserves. Hazards get the latched side avoidance the probe harness learned the hard way; measured
  they clear four in five. Neither costs them anything: giving a racer a bar to drain would be
  inventing a mechanic nobody can see.
- How they are introduced to the player, since the tutorial currently teaches the pace car.
  **Still open, and now more pressing.** They are on the daily as of 23 August 2026 but training
  still excludes them, so a first-time player meets three opponents with no warning at the start of
  level two.
- ~~What happens to the ghost once there are solid cars as well.~~ **It does not collide, decided
  23 August 2026, and it is the player's own hull from 24 August.** It is a recording, not a rival: the line it drives was set on a run where none of
  this happened, so a collision with it is a collision with a past that cannot react, and a ghost
  that could shove the player off their line would destroy the comparison it exists for. They read as
  different things already. **The two slab shape went on 24 August**: the ghost is the player's own
  hull now, drawn through the same `drawCarBody` the racers use. That spent two of the three axes
  that were carrying the distinction, so two more replaced them: it is painted in the PLAYER'S OWN
  colours, which is the one quarter of the hue wheel the three racers cannot occupy, and it has no
  shadow and no tail bar, both of which are claims that a physical object is present. Measured across
  all twelve biomes at three distances, the change a body makes to the pixels it covers is 21 to 25
  for the ghost and 29 to 47 for a racer, non overlapping, and peak luminance is 107 against 187
  because a racer's brightest pixel is its lit tail bar and the ghost has none.
- ~~Whether a hazard should wreck them.~~ **It does, from 23 August 2026, and they come back.** Out
  for 1.6s, rejoining 5200 units behind the player, then 9 seconds of recovery pace which closes that
  to about 2600. They are never eliminated: three opponents that can be knocked out means a good
  player finishes alone, which is the outcome the pace law exists to prevent. The recovery boost is
  the only positional term in the file and it cannot fire without a wreck having happened first.
- **Contact is solid, tactile and free, and the third of those is a rule rather than a tuning.** The
  share of a bump that would move the PLAYER further from the centre line is spent on the racer
  instead, so the player is only ever pushed inward. Contact therefore cannot start a scrape, drain
  the bar or end a run, at any value of any constant. Nothing touches forward speed either way.
- ~~Whether the pace car survives alongside them or is replaced by them.~~ Settled 17 August 2026:
  the pace car is gone. It was passed in the first ten seconds and never seen again, so it added
  nothing after that. NPCs replace it outright.
- **A first-ever run now has no ghost and nothing explains what a ghost is.** The pace car was doing
  that job by being named PACE CAR on run one and GHOST from run two. Whatever introduces the racers
  has to carry that lesson too, because the daily records, the ghost margin and CHASING YOUR LAST
  RUN all assume the player knows what a ghost is.

---

## What the pile-up actually was, 23 August 2026

The author sent a frame with four cars stacked across the road, each overlapping its neighbour by
about half a body, and it turned out to be three separate faults with one symptom.

**The one that mattered was a frame of stale yaw.** `separatePlayer` asks how much road each car
takes up, and both answers are functions of the player's yaw: at twenty degrees the footprint is
1037 long and 875 wide against 880 and 600 straight ahead. `drift.headingAngle`, which `carYaw`
reads, was computed BELOW the call to `racersUpdate`, so every contact test in the file ran against
the yaw the car had a frame earlier. That is worst exactly when it matters, because a car that is
sideways is a car mid flick, which is when the yaw moves fastest and the footprint is widest, and it
is also most of this game. The test that failed was the LENGTH one: two cars that did not overlap
along the road a frame ago were never asked about their width, so a whole car width of interpenetration
was simply never seen. Moving five lines above the call took the deepest overlap left anywhere in
eight daily runs from 570 units to 47, and four abreast from a real event to none.

**The aiming was recreating what the separator was asked to fix.** The aim was a SUM: a racing line
term reaching 0.70 of the half width, shared identically by all three racers, PLUS a lane at 0.46.
In a corner the racing line moved the whole field the same way at once and the sum asked for 1.16 of
a half width on a road that ends at 1, so all three clamped to the same place. The lane is now the
anchor and the racing line gets whatever room is left inside `NPC_EDGE`, and the lane band went to
0.66 because three lanes at 0.46 span 2116 world units and three sideways cars need about 2700.

**And the queue costs a car its place, not its pace.** A racer pinned at `NPC_EDGE` with somebody in
its width has nowhere to be pushed, so it lifts to `NPC_YIELD` and slots into file. The first version
of that was a straight handicap and it caused the author's second complaint: the pace law reads
driving quality and never the gap, deliberately, so there is nothing in it that notices a car has
fallen behind. A lift of eight per cent taken on seven per cent of frames is half a per cent of a
whole run, which over ninety seconds is five thousand units, and measured it took a good driver's
time in reach from 74 per cent to 58 and let them escape twice in eight runs. What a lift costs is
now banked in world units and run back off once the road ahead is clear, which restores the chase to
72 per cent in reach and no escapes in eight while keeping four abreast at none.

So the answer to "were they falling behind because of the pace law" is no: it was traffic, and for
one session it was traffic I had invented.

## The sparks, 23 August 2026

They fired and could not be seen, and the count was never the problem. Measured on a 390 wide phone,
a spark drew 1.4 pixels across, and a FULL FORCE burst of fourteen painted 81 pixels of ink against a
graze's 23, because every extra particle landed inside the same small square. Size first, then the
throw, then the count: a spark is now about four pixels across at rest and up to eight on a hard hit,
`NPC_SPARK_BIG` scales the size with the force so a real hit is a bigger burst and not just a denser
one, and `NPC_SPARK_HOT` brings a share of the burst out in the car's own hot light colour, scaled by
the SQUARE of the force so a graze has none of it. Peak ink went from 23 / 48 / 81 pixels at graze,
half and full force to 247 / 830 / 1885, in a 69 by 58 pixel spread instead of 14 by 17.

The rate ceiling did not move and must not: `NPC_SPARK_GAP` is what stops three cars leaning on each
other from filling the screen. The measured firing rate is 8.2 bursts a second on a mediocre run
against 8.6 before, and the peak share of the particle pool held by sparks is 16 per cent against 7,
so the explosion still has 84 per cent of it to come apart into.

---

## The separator was one dimensional, 23 August 2026

The author sent three frames from the daily with one racer buried most of a body deep inside the
player's car, while purple, pink and green never overlapped each other in any of them. The pair that
failed was the one pair with a special rule, in the mode where that rule is strongest.

**The push direction is set by which side the racer is on, and it does not care whether there is
road there.** The comment above used to argue that there is always room, because a car is 600 wide
and `NPC_EDGE` keeps a racer inside 0.86 of the half width. That argument is about a player pinned at
the LIP and it is false everywhere else. Turn it round: the RACER is at 0.86 and the PLAYER is at
0.82, inboard of it and driving outward. The push is outward, into a wall the racer is already
against, and the clamp eats the lot. On the daily the player cannot take a share either, so nothing
resolves at all.

Measured, with a driver written to close on racers: 1468 frames on the daily deeper than 120 units,
the worst 957 which is more than a whole car, unbroken runs of up to 78 frames, and **one hundred per
cent of them with the racer hard against `NPC_EDGE`**. Raising `NPC_EDGE` to 0.99 nearly halved it,
which no other explanation predicts.

**So what across cannot fix is fixed along.** `squeezeOut` runs once after every lateral pass, asks
what is ACTUALLY still overlapping rather than predicting which case it was, and sheds the remainder
along the road at `NPC_SQUEEZE_RATE` of the player's ground speed. A car with no road beside it still
has road in front of it and behind it. It moves the racer's z and nothing else, so the free
guarantee is untouched by construction on the third axis as much as on the first two, and it does
not touch pace: a lift was tried, cost three times the handicap that caused the falling-behind
complaint, and bought nothing measurable.

Two smaller faults fell out of the same investigation and both are absolute rules that were only
approximately true. A racer respawning from a wreck was placed at `NPC_LANE_SPREAD` of the road's
BASE half width, an absolute 1518 units, so a car rejoining on a narrow section sat at 0.87 of the
local half width against an `NPC_EDGE` of 0.86. And the line that spends a racer's sideways speed
after a bump had its sign inverted against the convention `separateRacers` has always used: it threw
away the speed of a car that was already leaving and kept the speed of one driving in, so the
separator pushed a car out and its own velocity carried it straight back. With both fixed, the worst
residual overlap anywhere is 331 units on the tighter axis and **no merge survives more than a single
frame**.

## The pace law had its sign inverted for every real player, 23 August 2026

Third report of the same thing: pass them and they never challenge you again. It was not the
separator. Measured before and after the fix above, on the same eight roads, the pace column is
identical to three digits and the comeback count went from one to one.

**`NPC_PACE_LOW` was 0.88 of `FEEL.SPEED`, an absolute number, and everything else in the law was
relative.** 0.88 of full speed is quick against a car doing 0.62 in the scrape band and slow against
a car doing 1.00 on clean road. So for anybody whose own speed stays near full, a DROP in form made
the field SLOWER, and the law ran backwards. It only ever looked right because it was calibrated
against the harness policies, which sit in the scrape band 19 and 45 per cent of a run by
construction.

**No person does that.** Drivers written to behave like people rather than like control laws --
reaction lag, a wandering target, lapses of attention, and the sense to concentrate on an obstacle --
scrape between 1 and 7 per cent of a run across the whole range from expert to poor. Every one of
them read 0.75 to 0.89 on the form signal, against 0.87 for the perfect control law, and the whole
of that range moved the racers' pace by 0.65 per cent.

Both ends of the band are a share of the player's own pace now. At form one the field runs at the
player's pace and the race is decided on the road; at form zero it runs faster, goes ahead, and the
horizon leash holds it there as something to chase, which is the third rule word for word.
`NPC_FORM_POWER` went from 5 to 16 at the same time, because a signal whose realistic range is 0.75
to 0.89 has no resolution left after `NPC_PACE_CURVE` compresses it again.

Measured over twenty runs, with only the anchor moved back to 0.88 as the known answer:

| | player leads all three | retakes a minute |
|---|---|---|
| anchor 0.88, the old law | 84 per cent | 0.12 |
| both ends relative | 19 per cent | 0.47 |

**And there is a real trade here, stated rather than tuned around.** `NPC_PACE_MATCH` sets what a top
form player's field runs at as a share of their own pace, and no value of it gives a good player both
a big lead and a field that keeps coming back: below one they pull away smoothly and nobody returns,
at one they are in the pack all race. At 0.99 the good driver leads 33 per cent of the run and is
retaken 0.19 times a minute; at 0.995, 19 per cent and 0.47. The spec asks for the second, because
being chased is the reward and the win is finishing ahead at the line rather than finishing alone.
One constant moves it if playing says otherwise.

A corner and straight line pace bias was built during this work and removed. The note in the
constants block records why: it worked, and once the band was relative it carried nothing.
