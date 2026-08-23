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

### 1. They rubber-band on PACE, not on line

An opponent that falls behind speeds up. One that is well ahead eases off. So passing one does not
remove it from the race — it stays in play, it comes back, and the competition lasts the whole
level rather than one moment.

**This is the whole value of the feature.** Everything else is support for it.

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

### 4. Three of them

Two or three that stay in play beats a field of eight the player never sees. Three is the number.

### 5. Random track first, then port

Ship on the random track. It has no comparability constraint, no daily records at risk, and no
ghost to confuse. Prove the feel there, then port to the daily.

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

The car is already drawn as eight projected corners with faces and normals, so three more are a
known cost.

---

## The open questions, answered by the build

- ~~What the pace law actually is, and how strong the rubber band can be before it reads as
  cheating.~~ **A free band, a pull that grows with the gap, and a release that runs on TIME.** A
  racer accrues give up while the player is clear of the free band and pays it back while they are
  not, so what switches the chase off is having been beaten for a sustained stretch rather than
  being a certain distance behind at an instant. A distance release was built first and measured and
  it cannot work: any band reading only the gap has a stable equilibrium where its boosted pace
  matches the player's, and the nearest racer sat there with a median gap of 3.4k and a ninetieth
  percentile of 3.4k. It also cannot be tuned out, because every player in this game is within about
  five per cent of every other, so any setting that lets a good player escape leaves an average one
  uncontested. Time separates them; distance cannot.
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
  **Still open.** Training is daily level one and the racers are random track only, so nothing
  introduces them yet.
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
