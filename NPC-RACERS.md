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
  rival at all. Measured, 2 frames in many thousands momentarily exceed it where the road narrows
  under a car already at the limit, worst 1.14 half widths, and it self corrects.
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
  23 August 2026.** It is a recording, not a rival: the line it drives was set on a run where none of
  this happened, so a collision with it is a collision with a past that cannot react, and a ghost
  that could shove the player off their line would destroy the comparison it exists for. They read as
  different things already — the ghost is a footprint and a roof with daylight between them and no
  sides, a racer is a closed opaque hull with wheels and a light bar.
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
