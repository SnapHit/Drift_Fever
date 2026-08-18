# NPC racers: agreed design, not yet built

Agreed 16 August 2026. Logged for a future session. Nothing here is implemented.

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

`ghostSynthesise` drives the real drift model — HEADING_SNAP_TIME, GRIP_TIME, CENTRIFUGAL,
STEER_RATE — over the real road with a lane-holding driver aimed at the inside of the corner it can
see. An NPC is that, with a different target line, a pace law, and a solid car instead of a
translucent one.

The car is already drawn as eight projected corners with faces and normals, so three more are a
known cost.

---

## Open questions for the build session

- What the pace law actually is, and how strong the rubber band can be before it reads as cheating.
- Whether they can leave the road, and what happens if they do.
- Whether they interact with hazards and jumps or ignore them.
- How they are introduced to the player, since the tutorial currently teaches the pace car.
- Whether the pace car survives alongside them or is replaced by them.
