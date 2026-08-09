# Drift Fever: retention design handoff

Written 9 August 2026. Self-contained. Companion to `BRIEF.md`, not a replacement for it. Where the two disagree, this document wins, and section 8 lists every place they disagree so nothing has to be inferred.

**What this is for.** Drift Fever is built and playable at https://driftfever.com. The core loop works. This document covers the layer above the core loop: the reasons a player comes back tomorrow rather than just finishing today's run. It is the output of a research pass on hyper-casual retention design followed by two passes of critical analysis, and it ends with a build list in section 7.

---

## 1. The state of the game, verified 9 August 2026

Read from the live file, not from memory.

**Live and working:**

- Pseudo-3D road on Lou's segment projection. 92 degree field of view, camera height 2200, `CAMERA_FOLLOW` at 0.55, draw distance 200 segments.
- Continuous steering value from -1 to +1 feeding keyboard, touch and tilt.
- Drift scoring with slip angle, tyre marks and a risk multiplier. Tiered callouts running up through NICE, GREAT, BLISTERING, SUPERB, UNREAL.
- Two modes: a daily seeded track with a fixed number, and a random track. Random tracks do not produce a ghost and cannot be finished.
- Ghost replay of the player's best daily run, with PASSED THE GHOST and GHOST OUTLASTED events.
- Gates, a clock, biome transitions, hazards, jumps, a track-complete finale with a victory donut.
- A one-continue mechanic, with a continued run explicitly barred from taking the record. The copy already says A CLEAN RUN IS THE ONE THAT COUNTS.
- Share button. Web Share API with a clipboard fallback and a visible-text fallback.
- Persistence: `best`, `far`, `daily.best`, `daily.day`, `daily.ghost`, `daily.time`, `music`, `sfx`, `tilt`, `tilthint`. All behind a `storeGet` / `storeSet` wrapper.
- Music and tyre sounds on by default, with a one-tap mute reachable immediately.

**Absent:** any goal or objective system, any unlock or cosmetic, any streak or return counter, any cross-session progress display, any local multiplayer.

**File size:** 696KB, of which 51% is comments. Real payload around 340KB, and comments compress away almost entirely over the wire. `BRIEF.md` section 6 set a 100KB ceiling. That ceiling has been broken and it does not matter: the relevant industry threshold for browser games is 20MB, so there are two orders of magnitude of headroom. Do not spend effort shrinking the file. Do not use this as licence to add assets either.

---

## 2. The research, condensed to what applies

### 2.1 Benchmarks, and why they are unusable as measurement here

Hyper-casual mobile games land near 33% Day 1 retention, 12% Day 7 and 4% Day 30, against a cross-genre median nearer 26% at Day 1. Hybrid-casual games, meaning the same accessible core with a persistent progression layer bolted on, roughly double Day 30 to 8 to 12%. That gap is the entire commercial argument for meta progression and it is the single most reproducible finding in the literature.

Browser portals report different and lower numbers because there is no install commitment. CrazyGames tells developers a strong game achieves 10 to 15% Day 1, that top titles convert over 80% of arrivals into a session of at least one minute, and that its audience skews heavily toward Chromebooks, to the point that games are disabled on Chrome OS if they do not run well on a 4GB machine. That last detail describes Drift Fever's exact audience.

**The constraint that matters more than any of these numbers: there is no telemetry and there will not be.** Zero external requests is project law, and it is also what keeps the filter surface clean. So Day 1, Day 7 and Day 30 cannot be measured, and neither can anything else. The benchmarks are useful for deciding what to build and useless for deciding whether it worked.

The practical consequence runs through everything below. **Prefer changes that are obviously correct on first principles over changes that would need an experiment to justify.** The only feedback available is cold players and one's own play, and cold players surface first-session problems well and seventh-day problems not at all.

### 2.2 The first sixty seconds

The consensus across web portals and mobile publishers is identical and unusually specific. A player decides inside 30 to 60 seconds. GameAnalytics puts it most bluntly: the first level of a hyper-casual game should be close to impossible to fail, so the player sees within ten seconds how to succeed. FTUE research finds that players who fail inside the first 60 seconds churn at dramatically higher rates, and that the window before a first loss is useful should be around three minutes.

The corollary matters as much as the rule. Failure has to feel fair, and a death screen that says only that you died teaches nothing. The player has to leave the screen knowing what went wrong.

### 2.3 Juice has an optimum and it is possible to be over it

This is the most important finding for Drift Fever specifically, and it cuts against instinct.

Kao and colleagues ran the largest study on the subject, N=3018, comparing four mechanically identical versions of the same game at None, Medium, High and Extreme levels of visual and audio embellishment. Both None and Extreme produced significantly decreased play time, significantly decreased player experience, significantly decreased intrinsic motivation and significantly decreased performance, relative to Medium and High. Extreme was as bad as None on every measure.

An earlier study found players rated a juicy build higher while scoring materially worse in it. A 2024 CHI paper argues the mechanism: amplified feedback can impede action-outcome binding, and legible binding is a precondition for feeling competent.

Drift Fever has an explicit razzmatazz layer: callouts, world-reacts-to-multiplier, skyline windows lighting with drift intensity, a victory donut. It also has a persistent cold-player complaint about camera wobble that has survived multiple attempted fixes. Those two facts sitting next to each other are worth taking seriously. Wobble is the exact symptom the CHI paper describes, which is feedback that breaks the player's sense that their input caused the outcome.

**The action is not to strip the razzmatazz. Medium-to-High beat None decisively.** The action is to verify the game is not sitting at Extreme, and specifically that no effect ever obscures the road edge, which in this game is the difference between living and dying.

### 2.4 The meta layer, and the one model that fits

Alto's Adventure is the closest analogue in the literature and it is nearly a perfect template. It has no daily rewards, no leaderboard, no social features and no currency loop worth the name. It has 180 hand-crafted goals across 60 levels, of which exactly three are active at any time, and when all three are complete a new set arrives. Goals are things like travelling a set distance, crossing a set number of gaps, or landing a specific trick. Reviewers noted at the time that the goals give nothing tangible, and that they are nevertheless the reason the game holds players longer than its peers.

Crossy Road is the second reference and it contributes one idea. Its unlockable characters are purely cosmetic, they do not alter play, and several of them change the entire visual world. Its creators have said plainly that retention was the number one goal and that monetisation was deliberately minimal. Its most interesting characters are not bought at all: they are unlocked by completing hidden objectives during play.

Both systems are free of servers, accounts and currency. Both are directly portable to a single HTML file.

### 2.5 The daily ritual and the shareable artefact

Wordle is the reference for daily play, and the useful lesson is not the puzzle. Daily scarcity produces an appointment rather than a feed: there is always another one coming and never another one right now. Players spend three to five minutes and leave satisfied.

The growth engine was separate from the retention engine. The share grid, which is compact, spoiler-free and comparable because everyone had the same puzzle, is what took the game from roughly 90 daily players in November 2021 to millions by mid-January 2022. Commentators are consistent that without the grid the game would have stayed a personal-site curiosity. The grid works because it shows the shape of an attempt rather than reducing it to a number, which leaves something for the recipient to ask about.

Drift Fever already has the harder half of this. It has a daily seeded track with a track number, so every player has the same road. What it shares is plain text: a track number, a point total, a time and a URL. That is a score, not a shape.

### 2.6 Dynamic difficulty adjustment does not hold up

`BRIEF.md` section 7.7 proposes letting the margin for error widen or narrow quietly based on how the player is doing. The evidence for this is weaker than the brief assumes.

A 2024 within-subjects study comparing performance-based, emotion-based and hybrid DDA against static difficulty found no approach demonstrably better than static on engagement or game experience. A 2025 review reached a similar conclusion: difficulty levels and perceived stress varied across methods while engagement, excitement and enjoyment stayed flat.

Flow theory itself is not in doubt. What is in doubt is whether adaptive systems reach it better than a well-tuned fixed curve. In a game with no telemetry and a hand-tuned constants block, that is a bad bet.

### 2.7 The school audience, one specific note

Two-player-on-one-keyboard browser games are documented as producing students crowding around a single Chromebook, and teachers report this as the behaviour that gets a game noticed. Given that content filters block only after a domain is reported and manually categorised, a mechanic whose signature behaviour is a visible cluster of children around one screen is a direct threat to the distribution model.

---

## 3. Pass one: the audit

Every candidate the research generates, before any filtering. Fifteen items.

1. A goals system on the Alto model, three active at a time, persistent across sessions.
2. Cosmetic car unlocks earned by completing goal sets.
3. A daily streak counter.
4. A Wordle-style visual share glyph replacing the plain-text share.
5. A juice audit against the Medium-to-High optimum.
6. A guaranteed-success opening: the first twenty seconds genuinely unfailable.
7. A restart friction audit: inputs required between death and the next run.
8. Local two-player on one keyboard.
9. A progress or garage screen showing unlocks and stats.
10. Near-miss framing on the death screen: distance from personal best, stated numerically.
11. Dynamic difficulty adjustment per `BRIEF.md` 7.7.
12. Reinforcing bounded runs: the daily track as a fixed-length appointment.
13. A next-unlock progress indicator on the death screen.
14. A seeded default ghost so a first-time player has a rival on run one.
15. Explicit failure attribution on death: what went wrong, in three words.

---

## 4. Pass two: the attack

Each candidate tested against four filters. Does the evidence actually support it. Does it survive zero servers, zero accounts and one file. Does it survive the classroom. What does it cost in the first thirty seconds, which is the only thing that cannot be traded away.

**Five items die.**

**Item 11, dynamic difficulty. Killed.** The evidence does not support it, it is close to impossible to debug in a hand-tuned constants block with no telemetry, and it is actively destructive here: an adaptive difficulty curve makes the daily track non-comparable between players, which breaks both the ghost and the share glyph. The two best retention features in the game depend on everyone driving the same road. Keep one narrow non-adaptive concession instead, folded into item 6: the first three runs a browser has ever seen are easier. That is onboarding, not adaptation, and it is deterministic.

**Item 8, local two-player. Killed.** Split-screen doubles the per-frame draw cost on the exact hardware that defines the target, which is a low-end Chromebook that portals will disable a game over. Worse, the behaviour it produces is a visible cluster of children around one screen, which is how a domain gets reported and categorised. The cost is very high, the distribution risk is real, and the retention benefit is speculative.

**Item 9, a garage screen. Killed as a screen, kept as content.** `BRIEF.md` section 12 rules out menus and it is right to. Every screen between arrival and driving costs conversion, and conversion to a first minute of play is the metric portals put first. The goals and the unlock progress do need somewhere to live, and the answer is that they live in space that already exists: the death screen, which the player already reads, and the title screen, which they already pass through. No new screen.

**Item 3, a daily streak. Killed and replaced.** Three reasons, in order of how much they should matter.

The design reason is decisive on its own: the audience disappears on weekends and vanishes for the entire American summer, by a factor of fifty. A consecutive-day counter aimed at that audience is a machine for telling children they have failed, every Monday, and once a year for three months. It will be broken far more often than it is held.

The second reason is that a streak's motive force is loss aversion, and there is no gentle version of it. Everything else on this list motivates by showing progress. A streak motivates by threatening to delete it.

The third reason is that this is a game for children with no monetisation, no accounts, no notifications and no ads. Nearly every genuinely predatory retention mechanic in the industry is unavailable to this architecture by accident, which is a real advantage. The streak is the one coercive lever that would still work, and it is not worth picking up.

**Replace it with a cumulative count.** Tracks finished, total. It only ever goes up, it survives a summer, and it produces exactly the same trophy at the top of the title screen without the punishment.

**Item 5 changes shape.** Not a cut, an audit. The evidence says None is as bad as Extreme, so stripping effects would be a mistake. The single test is legibility of the road edge under maximum drift multiplier, and the standing camera wobble complaint is the reason to run it.

**Everything else survives**, with the following amendments.

*Item 1, goals.* Strongest item on the list, but three constraints emerge under attack. Every goal must be drift-positive; a goal that rewards driving carefully argues against the thing that makes the game fun, which is the same error `BRIEF.md` 4.4 identifies in distance scoring. Every goal must be readable in about four words on a phone by a ten-year-old. And the whole system must degrade to nothing when `localStorage` is unavailable, which on locked-down school profiles it frequently is. Goals still generate and still complete inside a session; only the memory is lost.

*Item 2, unlocks.* Subordinate to goals, and the Crossy Road version needs one correction. Its unlocks run through a coin-fed prize machine, which is a currency loop and a random-reward loop, and neither belongs here. Take the other half of that game instead: cars unlocked by achievement, cosmetic only, several of which change the palette of the world. One hard constraint: every unlockable car must pass the contrast rule from `BRIEF.md` section 7, because a car the player cannot instantly pick out against the road is a readability regression sold as a reward.

*Item 4, the share glyph.* Promote it. This is the highest-leverage item in the document and it is not really a retention feature at all, it is the growth engine, and the Wordle history says the growth engine and the game are separate products. It is also cheap. It must be spoiler-free, compact enough to sit in a message, and legible as a shape rather than a number.

*Item 14, seeded ghost.* Survives, narrowly. The concern is a second ghost system to maintain. The resolution is that it is not a second system: generate one slow run from the daily seed, feed it through the existing ghost renderer, and discard it permanently the moment the player has a real run of their own. The problem it solves is real, since the best retention feature in the game is currently invisible to every first-time player.

---

## 5. What survived, ranked

By expected effect per unit of risk.

1. Goals system, three active, persistent, drift-positive.
2. Share glyph replacing plain-text share.
3. Near-miss framing and failure attribution on the death screen.
4. Guaranteed-success opening, plus easier first three runs ever.
5. Cosmetic car unlocks driven by goal completion.
6. Seeded default ghost for run one.
7. Cumulative tracks-finished count, replacing any notion of a streak.
8. Juice legibility audit.
9. Restart friction audit.

---

## 6. Why this is the right shape

The diagnostic framing in the retention literature is that a low Day 1 is a first-session problem, a low Day 7 is a habit problem, and a low Day 30 is a depth problem.

Drift Fever's first session is in good shape. The loop is fast, the restart is close to instant, the controls are validated by a cold player who understood them without explanation, and the file loads instantly.

**Day 7 is the problem, and Day 7 is a habit problem.** The daily track is already the right habit mechanism and it is under-exploited. Everything in section 5 either strengthens the daily appointment, gives the player a visible reason to still be here on Thursday, or makes the game spread. Nothing in it adds a system that needs feeding.

---

## 7. Build list

In order. Play after each. Do not batch.

### 7.1 Goals

Three active at a time, shown on the death screen and on the title screen. When all three complete, a new set is drawn and the completion is celebrated once, briefly.

Draw from a hand-written bank of at least forty. Every goal must be drift-positive or neutral, never drift-discouraging. Every goal must fit in roughly four words. Examples of the shape, not a specification: hold a drift through three gates, finish today's track clean, reach the tier above BLISTERING, pass your ghost before gate four, land two clean jumps in a run.

Progress persists via the existing `storeGet` / `storeSet` wrapper under a new prefix. When storage is unavailable the system runs identically inside the session and simply forgets between sessions. Do not gate anything else behind goal progress.

**Acceptance:** a cold player who has never seen the game can state, without help, what one of their three goals is after their second run.

### 7.2 Share glyph

Replace the plain-text share body with a compact visual shape, keeping the track number and the URL.

The shape should encode the run gate by gate using block characters, so a reader can see where it went wrong without being told the answer. Something on the order of one glyph per gate, with distinct glyphs for a clean pass, a scrape and the gate where the run ended. Keep it under six lines and under about thirty characters wide so it survives a group chat.

Keep the score line. The score is what one player says to another; the shape is what makes them ask about it.

**Acceptance:** paste a shared result into a message thread on a phone. It must fit without wrapping and it must be obvious at a glance that two different results are different.

### 7.3 Death screen: near miss and attribution

Two lines, both short.

Attribution first: what ended the run, in three or four words, positioned where the eye already goes. Off the road, hit a hazard, clock ran out. The player leaves knowing what to fix.

Near miss second, and only when it is genuinely near: the numeric gap to their best. Forty metres short of your best. Two hundred points off. Suppress it entirely when the gap is large, because the mechanic works on proximity and reporting a distant miss is just a reminder that they are bad at it.

**Acceptance:** neither line delays the restart input by a single frame.

### 7.4 Opening

The first twenty seconds of any run must be genuinely unfailable. Not easy. Unfailable. Wide road, no hazards, no jumps, curvature low enough that the car cannot leave the road at the starting speed even with the steering held hard over. Verify by holding a direction from the first frame and confirming survival to twenty seconds.

Separately, and deterministically, the first three runs this browser has ever seen ramp more gently. Store the run count. When storage is unavailable, every run is a first run, which is the correct failure direction.

**Acceptance:** a player holding one direction from the first frame is still alive at twenty seconds.

### 7.5 Car unlocks

Six to ten cars, cosmetic only, no effect on handling. Unlocked by completing goal sets, one car per set for the first several sets. At least two should change the palette of the world, on the Crossy Road model, because that is what makes the reward feel larger than a colour swatch.

Every car must remain instantly readable against every biome. The yellow car reads because it is the single warm object in a cool world; any car that breaks that rule breaks the game. Test each against every biome before shipping it.

No currency. No randomness. No prize machine.

**Acceptance:** every unlockable car passes a squint test against every biome.

### 7.6 Seeded ghost for run one

When there is no stored ghost for today's track, synthesise one from the daily seed at a deliberately beatable pace and run it through the existing ghost renderer. Label it so it is not mistaken for a real rival. Discard it permanently once the player records a real run.

**Acceptance:** a player on their first ever run sees and beats a ghost.

### 7.7 Cumulative count

A tracks-finished total on the title screen. Monotonic. No consecutive-day logic anywhere in the file.

### 7.8 Juice legibility audit

Under maximum drift multiplier, in every biome, at maximum speed: is the road edge unambiguous. If any effect obscures it, that effect is turned down, not removed.

While in there, revisit `CAMERA_FOLLOW` against the standing wobble complaint. The literature suggests wobble is not a camera bug so much as feedback that breaks the player's sense that their input caused the outcome, so check what else is moving the frame at the same time.

**Acceptance:** a cold player, at maximum multiplier, can point at the road edge on a paused frame.

### 7.9 Restart friction

Count the inputs between death and the car moving again. The target is one. If it is more than one, that is the highest-value fix on this list and it should be done first.

---

## 8. Where this document overrules BRIEF.md

Listed explicitly so the build conversation does not stop to flag a contradiction.

- **Section 6, 100KB ceiling.** Void. The real threshold is 20MB. Do not optimise for size.
- **Section 7.7, difficulty offered not imposed.** Void as written. The evidence does not support adaptive difficulty. Replaced by the deterministic three-run onboarding ramp in 7.4.
- **Section 5, no audio.** Already overruled by the owner in a previous session, with mitigations in place. Not reopened here. The classroom argument remains real and the one-tap mute must stay reachable from the first frame.
- **Section 12, no menus.** Upheld. Goals and unlocks live on existing screens.
- **Section 14, open questions.** The name is settled. The multiplier banks at gates. The ghost is the player's best on today's track. The seeded daily run is built and is the centre of the retention design rather than an optional extra.

---

## 9. What not to do

- No streak, in any form, under any name.
- No currency, no coins, no prize machine, no randomised reward.
- No new screens.
- No adaptive difficulty.
- No local multiplayer.
- No external request, for any reason. This kills leaderboards, cloud saves and analytics, and that is accepted.
- No effect that can obscure the road edge.
- No goal that rewards driving carefully.
- Do not strip the razzmatazz. None tested as badly as Extreme.

---

## 10. Residual honesty

Three things worth stating plainly.

**None of this is measurable.** Every number in section 2 is a design input, not a target, because there is no way to observe whether any of it worked. Cold players will tell you about the first session. Nothing will tell you about the seventh day. Build the things that are right on principle and stop looking for a way to prove it.

**The goals system is the item most likely to be wrong.** It is the largest addition and the one with the most surface area, and a badly written goal bank will feel like homework rather than a reason to play. If it has to be cut, cut it and keep the share glyph, which is cheaper and has the better historical evidence behind it.

**Timing is a real constraint.** Search volume in this niche climbs steeply from now through September and October. A page needs to be indexed and aged before that peak. Shipping seven items in August beats shipping nine in October.
