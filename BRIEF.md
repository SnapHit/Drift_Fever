# Build brief: the drift game

Written 2 August 2026. Self-contained. A new conversation working from this does not need any prior context.

**Goal of the first session: a crude, playable demo. Nothing else.** Read section 11 before writing any code, because the build order is the part this project has already paid to learn.

---

## 1. What is being built

An original browser arcade game in the **one-button endless drift descent** genre. You steer a car along a procedurally generated road. Forward motion is automatic and accelerates. You steer left and right. Leaving the road kills you. Instant restart.

It is **not** a clone of any existing game, and it must not be named after one. It sits in a genre with enormous unserved search demand and very weak incumbents.

Constraints inherited from the wider project, non-negotiable:

- **One self-contained HTML file.** No build step, no dependencies, no framework, no assets, no network calls.
- **No accounts, no sign-up, no ads, no payments, no tracking. Not one external request, ever.**
- **Runs from a filesystem, a static host, or a phone.**

The same author already shipped `beakdown.fun`, a single-file arcade game descended from Joust, which survived a Hacker News traffic spike at zero cost. That architecture is proven. This is the second game built on it.

---

## 2. Why this genre, in numbers

United States, Google Ads exact match, pulled live 2 August 2026 via DataForSEO. KD is keyword difficulty, 0 to 100. Every SERP claim was read off a live desktop result page the same day, not inferred from difficulty scores.

The centre of gravity is not "car games". It is a single game name and the modifier layer around it.

| Term | US vol/mo | KD | Page one |
|---|---|---|---|
| drift boss | 2,240,000 | - | Coolmath and Math Playground own it |
| car games unblocked | 49,500 | 10 | Google Sites, MSN, a children's charity |
| unblocked car games | 49,500 | 11 | Google Sites, a GitHub Pages clone |
| drift hunters unblocked | 40,500 | 7 | Google Sites, GitLab, Bitbucket clones |
| drift boss unblocked | 27,100 | 1 | Google Sites, then a mortgage calculator |
| drive mad 2 | 14,800 | 11 | Poki, Fancade, exact-match domains |
| racing games unblocked | 12,100 | 11 | Portals and Google Sites |
| drift games unblocked | 8,100 | 6 | Google Sites, clone hosts |
| police chase game online | 8,100 | 9 | Mixed portals |

Deduplicated web-intent demand across the driving niche is **647,450 searches a month across 149 terms**.

**These are the weakest search results encountered anywhere in this research.** For "drift boss unblocked", position one is a Google Sites page and position two is `mortgagecalculator.org`; Coolmath, who made the game, sit at seven. For "unblocked car games", position three is `childline.org.uk`, a British child welfare charity ranking on an unrelated page. When a mortgage calculator and a children's charity outrank the actual publisher, the barrier is not authority. Nobody serious has bothered, because the traffic is worthless to advertisers. It is not worthless here, because the cost model is zero.

**A rejected alternative, recorded so it is not revisited.** A bullet heaven / Vampire Survivors-style auto-shooter was investigated and dropped. "Vampire survivors unblocked" is 260 a month in the US. The entire clean web-intent cluster for that genre is 10,930 a month across 24 terms, roughly one sixtieth of the driving niche. Decisively, Vampire Survivors was originally an HTML5 browser game and the free browser build is still live on itch.io, ranking first or second for its own unblocked terms. The gap is already filled by the original developer, for nothing.

---

## 3. The timing, which is not obvious and does matter

This niche is not seasonal in the ordinary sense. It collapses and rebuilds by a factor of fifty every year on the United States school calendar.

| Month | drift boss | drift hunters | vampire survivors |
|---|---|---|---|
| Jul 2025 | 90,500 | 27,100 | 40,500 |
| Sep 2025 | 5,000,000 | 450,000 | 60,500 |
| Dec 2025 | 2,740,000 | 201,000 | 60,500 |
| Jun 2026 | 550,000 | 33,100 | 74,000 |

Two conclusions. The driving audience genuinely is school children on managed devices, confirmed rather than assumed, because nothing else produces that curve. And the flat Vampire Survivors line shows that genre is adults on unfiltered machines, which is a second independent reason it was dropped.

**The practical consequence: the trough is now.** It is early August and the curve climbs steeply through September and October. A page needs to be indexed and aged before the peak, so the build window is weeks, not months.

---

## 4. The five design pillars

Drift Boss is the incumbent and it is mediocre. It forces a non-skippable tutorial on every single run, the control is unpleasant, and it is punishingly easy to die. The first three pillars fix those. The last two are the reason this is not a clone.

### 4.1 Give the player a neutral

Drift Boss binds hold to right and release to left. There is no third state, so the car is always turning and every moment is a correction. That is the structural cause of the bad control, not a tuning problem: you cannot hold a line because holding a line does not exist.

The fix is not a second button, which would break the one-axis constraint that makes it work on a phone. It is three states from one axis:

| Input | Left | Neutral | Right |
|---|---|---|---|
| Touch | Hold left half of screen | Not touching | Hold right half of screen |
| Keyboard | Left arrow or A | Nothing held | Right arrow or D |
| Tilt | Tilt left past deadzone | Inside deadzone | Tilt right past deadzone |

Bind both cases of the letter keys. A caps lock steering bug of exactly this kind exists in the author's other game.

**The consequence to accept:** a neutral makes the game easier, so difficulty must come from somewhere legible instead. Road geometry, speed, and the escalating features in 4.5. That is a better trade, because difficulty from a hostile control scheme reads as the game being broken, while difficulty from a narrowing road reads as the game being hard.

### 4.2 Make mistakes recoverable and graded

Failure in Drift Boss is binary. You are on the road or you are dead, and a single frame of inattention ends a two minute run.

Replace the cliff with a gradient, three bands rather than two:

- **On the road.** Normal.
- **Scraping the edge.** Sparks, screen shake, a speed penalty, and the score multiplier climbing rather than falling. Roughly a third of a second to correct.
- **Off the road.** Run over.

This is coyote time for drifting. It converts a punishing binary into a skill gradient, and it creates the risk surface that 4.4 is built on. A player who can scrape and recover feels skilled; a player who dies instantly feels cheated, and the difference between those two feelings is the retention rate of the game.

Whether there are additionally lives or recoveries per run is a tuning question to be answered by playing.

### 4.3 Let the player see the future

Drift Boss shows roughly a second and a half of upcoming road. At the speeds it reaches that is reaction time, not planning time, which is why it feels unfair rather than hard. Unfair makes people close the tab; hard makes them retry.

**Hold the time horizon constant, not the distance horizon.** As speed rises, pull the camera back and up so the player always sees about three and a half seconds of road ahead whatever the speed. The distance shown grows; the thinking time does not shrink.

This is confirmed by the best-reviewed modern game in the genre. Reviewers of Art of Rally consistently praise its high camera for two reasons: it shows off the art, and it lets you see the upcoming corners. Camera is a gameplay system here, not presentation.

### 4.4 Score the risk, not the distance

This is the pillar that makes it a different game rather than a better clone, and it is the most important item on the list.

Distance scoring tells the player one thing: stay away from the edge. So the optimal play is the timid play, and the scoring system argues against the thing that makes drifting fun.

Invert it. Score proximity to the edge, drift angle and chain length. A multiplier that climbs while drifting, climbs faster the closer to the edge, peaks inside the scrape band from 4.2, and resets on straightening or crashing. Bank it at checkpoints or lose it on death.

Emotionally, the edge stops being the thing you avoid and becomes the thing you court. Nothing in this browser niche does this. Drift Hunters has drift scoring but is a heavy WebGL free-roam simulator; Drift Boss is a reflex test with a distance counter. The space between them is empty.

This also answers the observed market gap: every site competing for the sequel terms advertises progression, shops and power-ups, because the originals have none. A live multiplier is progression inside the run and is far cheaper than a shop.

### 4.5 Change the shape of the run, and give them someone to chase

Two things, because they answer the same question: why is run twenty different from run two.

**Escalate by kind, not only by speed.** The Beakdown spec records this lesson at length: enemy count froze at wave 5, everything else froze at wave 32, and a player reported it felt repetitive. Speed-only escalation fails the same way faster. Introduce new road features on a timer, each a new thing to learn: narrowing sections, gaps to jump, forks where the player picks a branch, moving hazards, a pursuer, night or weather sections that change visibility. Plus a biome change on a timer so it reads as a new place, exactly what arenas do in Beakdown.

**Give them a ghost.** Store the position trace of the player's best run and replay it as a translucent car ahead. Nearly free: a compressed array in localStorage wrapped in try/catch. A visible rival converts an abstract number into a race you can see, and it solves the two-player cold start problem, because the second player is always yourself.

This is genre convention rather than invention. Absolute Drift ships ghosts of the world's best players and of your own previous best; Art of Rally runs daily and weekly leaderboard challenges. The two most admired games in this space both concluded a visible rival is what brings players back, and no browser game in the unblocked niche implements it. Proven and unoccupied is a rare combination, so build it early rather than treating it as a stretch goal.

---

## 5. Not pillars, but non-negotiable

- **No tutorial, ever.** The first ten seconds of the actual game are the tutorial: wide road, low speed, one gentle curve that teaches hold-to-turn without a word. The Beakdown spec records that words were tried for the height rule and removed because the visual taught it better.
- **Restart on the same input, instantly.** No menu, no button to hunt for. If leaving the death screen takes more than one action, the one-more-go loop is broken.
- **No audio in the demo.** If audio ever ships it defaults off and stays off across sessions. Beakdown proved procedural audio works with zero external requests, so this is a later addition rather than a permanent constraint, but the default is not negotiable for a classroom audience.
- **Every feel constant in one named block**, including any multiplier used inside the update loop. Beakdown's spec identifies a bare inline `3.2` as the single most likely thing in that file to be broken by accident. Do not repeat it.

---

## 6. The audience, which drives every technical constraint

**School children on managed Chromebooks, playing through a content filter.** This is not a guess about who searches "unblocked"; it is what the word means, and the seasonality data in section 3 confirms it empirically.

**Hardware.** Low-end Chromebooks, often Celeron or similar with integrated graphics, some five or more years old.

- Target a stable 60fps on weak integrated graphics. Measure it, do not assume it.
- Canvas 2D only. No WebGL.
- Cap device pixel ratio at 2.
- Clamp the frame delta so a stutter does not teleport the player off the road.

**Input.** Keyboard first. School trackpads are poor and many sessions are keyboard-only. Touch as a first-class equal: left and right halves of the screen, no virtual stick, no buttons. Any key starts a run from the title screen.

**Network.** Zero external requests. Not one. No CDN, no font service, no analytics in the game file. Whole thing under about 100KB. No loading screen; playable the moment the page paints.

**Filter surface.** No popups, no interstitials, no fullscreen prompts, no cookie banners, no external redirects. Filters like GoGuardian, Securly and Lightspeed block only after a domain is reported and manually categorised, so a clean single-purpose site stays uncategorised longer than a portal.

---

## 7. Look and feel

Seven things recur across the arcade racing lineage, from the Sega cabinets that defined the genre to the modern indie drift games most admired for art direction.

1. **Bright, saturated, optimistic. Never grey.** There is a named aesthetic for this: Sega blue sky, the high-saturation open-horizon look running through OutRun, Daytona USA and Crazy Taxi, understood as a philosophy rather than an accident. Arcade racing sells exhilaration, and desaturation kills it. The current browser driving market has forgotten this entirely, which is a free gap.
2. **Speed comes from everything except the speedometer.** Field of view, camera position, motion blur, camera shake and the rate roadside objects flick past. Arcade racers exaggerate all of these; simulators deliberately do not, and that difference is the genre distinction. The Canvas 2D equivalents are all cheap: camera height and pullback, stripe frequency, roadside object density, speed lines, particle trails, velocity-scaled shake.
3. **The horizon is the emotional anchor.** Every memorable arcade racer has a visible horizon with something on it. It gives the player a fixed point to read curvature and elevation against.
4. **A high camera, so the turn can be seen coming.** See 4.3.
5. **Flat, minimalist stylisation beats fidelity, and it is the cheap option.** Absolute Drift and Art of Rally are both widely praised for their looks and both are flat-shaded low-poly with no texture detail; one description of Art of Rally is that everything appears cut and folded from paper. They compete on palette, silhouette and composition. **That is exactly what a single file with no assets produces. The constraint is the style.**
6. **Ghosts are the genre standard.** See 4.5.
7. **Difficulty offered, not imposed.** Art of Rally is praised for a sliding scale of handling and damage assists. Rather than a difficulty menu, let the margin for error widen or narrow quietly based on how the player is doing.

### The obvious art direction to refuse

Synthwave. Neon grid, magenta and cyan, chrome type, sun on the horizon. It is literally named after OutRun and every drift game on itch.io reaches for it, so it buys no distinctiveness. Worse, it is dark, which means a dark road against a dark sky. The Beakdown spec records paying for exactly this mistake: platforms had to be lightened across all twelve arenas and given a bright lip because players were losing them against the background. A game where the road edge is the difference between living and dying cannot repeat that.

**Go the other way.** High-key saturated daylight and dusk palettes, flat shading, a dark road with bright verges so the drivable surface is unmistakable, and a biome shift that changes the whole colour scheme. Brighter is more readable, more distinctive in this market, more cheerful for the actual audience, and it makes a better preview card.

### Specific effects worth building, all cheap

- **Tyre marks that persist on the road behind you.** The highest-value single effect in a drift game, because it is a visible record of skill rather than decoration, and it draws the player's own line back to them.
- Sparks and a colour shift on entering the scrape band, so the risk state is legible without UI.
- A trail behind the car. The Beakdown spec records that trails materially helped readability of fast diagonal movement on a small screen.
- Screen shake and hit stop, scaled to whether it was a scrape or a crash. Both are already proven in the author's other game.
- Roadside object density rising with speed. The cheapest speed cue that exists.
- The car as a high-contrast silhouette, detail in the lighting rather than the shape.

**A caution that comes up repeatedly in the sources:** overdoing shake, field of view distortion and post-processing tips straight into disorientation and motion sickness. Less is more, and the threshold is lower on a phone held close to the face than on a monitor. Every one of these values is a named constant, tuned low, and tested on a real phone.

### One idea worth stealing outright

OutRun opened by letting the player choose a radio station before the run started. It took two seconds and it is one of the most fondly remembered moments in arcade history.

That solves a real problem. Audio must default to off for this audience, but a mute button reads as a setting and nobody enables audio from a settings screen. A radio dial on the start screen, where picking a station is how you opt in, reframes it: silence is a choice made by not touching it rather than a limitation. It also gives the start screen a second reason to exist, alongside the tilt button.

---

## 8. Tilt controls

Tilt is an **opt-in option behind an explicit button**. The default is always keyboard and touch, and the game must be fully playable by someone who never touches the tilt button.

### 8.1 The one decision that must be made before any physics is written

Gyro is analogue. Keyboard and touch are digital. Build the game around three discrete states and bolt tilt on later, and you either quantise tilt into uselessness or end up with two feel models and two sets of constants.

**So: the physics consumes a single continuous steering value from -1 to +1, and digital input is a special case of it.** Keyboard and touch ramp toward the extreme over roughly a tenth of a second rather than snapping. Tilt writes the value directly. The update loop reads one variable and does not know where it came from.

Get this right and adding tilt is an afternoon. Get it wrong and adding tilt means retuning the entire feel block, which is precisely what the build order says never to do. **This is the only decision in this brief that is expensive to reverse.**

### 8.2 Permission, on both platforms

Write **one code path, not two.** Call `DeviceOrientationEvent.requestPermission()` if it exists, fall back to adding the listener directly if it does not, and treat a denied result as a first-class outcome everywhere.

The reason this matters now: Chrome filed its Intent to Ship for the DeviceOrientation permission request API on 17 June 2026, targeting milestone 151 on desktop and Android. The rollout is two-phase. Currently the method exists and returns granted without prompting, so nothing visibly changes. In phase two Chrome flips the sensor permission default from Allow to Ask, and a page that registers an orientation listener without calling `requestPermission()` first receives no events at all. That is what Safari has done on iOS since 2019. An "iOS gets the permission dance, Android just listens" implementation will break silently at some future Chrome update with no error and no console message.

### 8.3 The gotchas, in the order they will bite

| Issue | What happens | What to do |
|---|---|---|
| Permission is gesture-bound | `requestPermission()` must be called synchronously inside a click or touch handler. Call it after an `await`, or on load, and it silently fails. | The tilt button's handler calls it directly as its first statement. No async work before it. |
| HTTPS is required | No orientation events at all on `file://` or plain http. | Test on a deployed preview URL. Plan the dev loop around this from the start. |
| Denial is sticky | Once denied, Safari will not ask again for that origin. The button appears to do nothing. | Handle denial explicitly with a short message. Never let the button fail silently. |
| Grants do not persist | Most iOS versions require a fresh gesture every page load. | Persist the preference in localStorage, not the grant. Re-request on first gesture next session. |
| Desktop has no sensor | The button exists and does nothing. | Feature-detect and hide the button entirely. |
| Orientation remapping | `gamma` is left-right tilt in portrait. Rotate to landscape and `gamma` and `beta` swap roles. | Read `screen.orientation.angle` and remap, or lock to portrait. |
| Cheap Android handsets | Some have no real gyroscope and derive orientation from the accelerometer, which is noticeably noisier. | The smoothing filter matters more here than on iPhone. |
| Iframes | `gyroscope` and `accelerometer` default to a `'self'` allowlist. Same-origin iframes inherit access; cross-origin ones get nothing. | Same-domain content pages work automatically. A portal embed will not, and you cannot make it. Detect and hide the button. Note the feature names must be semicolon-separated in an `allow` attribute; spaces are parsed as an origin list. |

### 8.4 Calibration and smoothing, which decide whether it feels good

- **Nobody holds a phone flat.** Capture a zero point when tilt is enabled and again at the start of every run, and treat all tilt as relative to that posture. Without this it is unplayable lying on a couch, which is where phones are.
- Offer a recalibrate action that cannot be triggered by accident.
- The raw event is noisy at 60Hz. Smooth it, and make the smoothing a named feel constant.
- A deadzone around centre, so the neutral state from 4.1 exists on tilt too.
- Sensitivity needs a sane default and probably three presets. Wrist range varies enormously.

### 8.5 Testing

**This is the real risk.** The author does not own an iPhone and iOS is where every gotcha lives. Chrome DevTools can emulate device orientation and covers the Android-shaped cases, but the permission flow specifically cannot be emulated. Access to a real iPhone has been arranged. Build the button and the plumbing in the first session even if it does nothing yet, so the permission path is exercised early rather than discovered late.

---

## 9. The technical route

The pseudo-3D road technique is thoroughly documented and does not need inventing.

- **Lou's Pseudo 3D Page**, `extentofthejam.com/pseudo/`, explains the segmented road system and the projection maths, plus case studies of how the original arcade machines did it.
- **Jake Gordon's javascript-racer series**, `jakesgordon.com`, is a working HTML5 canvas implementation built on Lou's approach, walked through in stages: straight roads, then curves, then hills, then sprites.

The method: the road is an array of segments with world coordinates. Each frame, project each segment from world space to screen space using similar triangles, draw from the horizon toward the camera, and clip anything already covered. Curves are faked by offsetting the camera x by a steadily increasing amount per segment rather than computing real geometry, which is why it is so cheap.

**On the size budget:** someone built a pseudo-3D racer for the JS13K jam, which caps entries at 13KB, roughly a third of what Beakdown occupies. The 100KB ceiling is luxurious for this technique.

Two cautions. Segment count times draw distance is the frame budget, so draw distance belongs in the named feel block. And the projection has a field of view term, which is the same lever the sense-of-speed research keeps pointing at, so treat it as a feel constant rather than a rendering detail.

---

## 10. Naming and legal

**Do not call it Drift Boss 2, Drift Hunters 2, or anything of that shape.** Drift Boss belongs to Coolmath Games, who are a large commercial operator that actively defends its catalogue and sells advertising against those exact terms. That is a materially worse passing-off exposure than the comparable Slope situation, where the owner has visibly not bothered.

The relevant law, and it is genuinely useful: in **Tetris Holding v Xio Interactive** (New Jersey, 2012) the court held plainly that game mechanics and rules are **not** protected by copyright, only the audio-visual expression of them. Taking the endless drift mechanic is fine. Reproducing another game's look, palette, obstacle design and specific presentation is not.

**Anchor on the category terms instead.** "Car games unblocked" and "drift games unblocked" describe a category, not a product. They carry more volume than the sequel terms, lower difficulty, and no trademark attached, and a page targeting them can be honest without linking to a competitor in the first line. That is unusually convenient.

Note for context: the author's existing site already carries three content pages built on the Flappy Bird trademark, recorded there as a keeping-it-live risk. Adding Coolmath as a second aggrieved party is avoidable and should be avoided.

Storage keys, internal names and file names use the eventual game name, never a competitor's.

---

## 11. Build order, which is the lesson this project paid for

The author's existing game succeeded where four previous concepts died, and the recorded reason is the order, not the idea: it was built crude in a single pass, played immediately, and worked.

1. **The road and one control axis on a screen. Play it.** If steering along the road is not pleasant with nothing else present, nothing built on top will save it.
2. Leaving the road kills you. The scrape band from 4.2.
3. Speed escalation and the speed-scaled camera from 4.3. Play it. This is where it becomes a game or does not.
4. Score and instant restart.
5. Only now, the risk multiplier from 4.4. Play it.
6. Escalating road features and biomes.
7. Art direction.
8. Persistence and the ghost, wrapped in try/catch.

**Set the feel constants early, verify them by playing, then do not touch them again while changing anything else.** On the existing game every later version was diffed against the constants block to prove they had not moved.

**Do not design anything before playing the change.**

---

## 12. What not to do

A list of failures rather than a list of good examples, deliberately. Examples in a brief get read as the boundary of acceptable answers and constrain the output.

- Do not clone Drift Boss, Drift Hunters, or any other existing game in look, palette, obstacle design or presentation.
- Do not name the game after someone else's game.
- Do not use a synthwave neon palette. See section 7.
- Do not design progression, art direction or a feature list before there is something playable to play.
- Do not add audio in the demo.
- Do not add a single external request, for any reason, including fonts and analytics.
- Do not build authored levels. The generation is the game.
- Do not add menus, settings screens, difficulty selection or a pause between attempts.
- Do not build the steering as three discrete states. See 8.1.
- Do not write two permission code paths. See 8.2.
- Do not use localStorage without wrapping every call in try/catch. School networks and locked-down profiles frequently make storage unavailable, and the game must degrade to playing perfectly with no memory rather than throwing.
- Do not optimise for a development machine's frame rate.
- Do not build a second copy of the game for the content pages later. One file, one source of truth, framed where needed, same origin.

---

## 13. What the first session should hand back

- One self-contained HTML file, playable.
- The feel constants in a single named block with a comment saying they are not to be casually changed, including draw distance, field of view, tilt smoothing and every multiplier used inside the update loop.
- The steering value abstraction from 8.1, and the tilt button plumbing, even if tilt itself is not yet tuned.
- A short note covering: what is in the file, what was deliberately left out, the measured frame rate on the weakest machine available, and anything in this brief that turned out to be wrong.

**If something here contradicts what you find while building, stop and say so rather than working around it.** Disagreement has been right more than once on this project.

---

## 14. Open questions, deliberately not settled

These are to be answered by playing rather than in advance. Putting answers here would constrain the build for no reason.

- ~~The game's name.~~ Settled in session ten: the game is **Drift Fever**. It was called Tailflick between sessions one and nine.
- Whether the multiplier banks at checkpoints or only on death.
- What the escalating road features are, and in what order they appear.
- Whether there are lives, recoveries, or neither.
- Whether the ghost is your best run, your last run, or a choice.
- Whether a seeded daily run, where everyone drives the same road and ghosts are directly comparable, is worth building.
- The art direction in detail, within the constraints of section 7.
- Whether it lives on a new domain or alongside the existing game. The existing domain uses a `.fun` TLD, which carries slightly higher blanket-block rates with school filters. Not urgent, worth knowing.

---

## 15. The content cluster that follows the game

Not the first session's job, but the game is being built to serve it, so the shape matters.

One game, several pages, each targeting a query and each carrying the playable game, framed from the same origin so tilt keeps working.

**Two rules that are already project law:**

1. The page never claims to be the game the searcher typed. It says plainly and early what it is and is not, and links out to the original where one exists.
2. Any named game appears in the title and H1 referentially, describing what the reader searched for and never what is on the page.

**One constraint worth understanding.** Content filters keyword-match URLs, not just domains. A path containing "unblocked" is a clear signal to a filter, and the audience is behind those filters. URL keywords are a weak ranking factor while titles, headings and body copy are strong ones, so the word belongs in the title and out of the path.
