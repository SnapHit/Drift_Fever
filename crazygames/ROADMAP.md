# Drift Fever: the road to outstanding

Written 22 November 2026, the day CrazyGames rejected the game at Basic
Launch review ("The overall quality of the game does not yet meet the
expectations of our platform"). The author's decision the same day: keep
developing it until it succeeds. **Two things are fixed: it works
instantly in a browser, and it is called Drift Fever. Everything else is
open to change.**

## What the evidence says

Their email names no fault, so this is our own reading, with the
evidence for each point. None of it is confirmed by them.

**1. The game does not look like its cover.** The cover is our own car,
same shape, same wheels, drawn with glossy paint, reflections, a wet
track, floodlights and thick smoke. The game draws that car with nothing
to reflect: there is no environment lighting anywhere in the renderer
(no environment map, no reflection), so the paint reads flat and dark,
and most of the world is lit with a non reflective material. In a race
the car is about 8 per cent of the screen's width, the fields either
side are empty, and career track 1, the first thing a new player drives,
is at night. Their quality page asks that "the name and imagery on
CrazyGames should accurately reflect the gameplay", and our cover
promised a game we do not yet draw. (`review/start/` and
`brand/reference/` against `brand/art/`.)

The good news is in the same picture: the gap is light, paint, road,
smoke and camera, all things the renderer can do. The car's shape is
already the cover's.

**2. On a keyboard the driving is shallow.** The car drives itself:
the throttle is always on, there is no brake, and W, S, Up, Down, Space
and Shift all do the one DRIFT button. In a drift the assist holds the
angle for you. That suits thumbs on a phone. On a desktop, which is most
of CrazyGames' audience, the two leading driving games there both give
the player the car: PolyTrack ("WASD / arrow keys = drive", 8.9, 481K
likes, HTML5, low poly) and Drift Hunters (WASD or arrows, Space for the
handbrake, 9.3, 440K likes, Unity, desktop only). The physics already
models throttle, brake, weight transfer and a handbrake; the input layer
switches them off.

**3. The first minute is weak.** A reviewer gets a menu, then a night
track, prompts, and a small car that accelerates by itself. Their submit
page says players decide "in the first few minutes", and their FAQ says
accepted games have "a clear goal, smooth and polished gameplay, and
quick onboarding".

**4. Unknowns we can now measure.** Frame rate on a desktop graphics
card was never measured; `?bench=1` now does it on any device in 35
seconds. Sound quality against the leaders is untested by anyone but
the author. Whether six modes on the title help or scatter is untested
with strangers.

**What is already strong and stays:** loads in 2.6 MB (their QA tool
measured 0.5 MB before the first run), plays on phones, deterministic
physics with ghosts, 24 track career, six rivals, garage with
upgrades and cosmetics, stunt park, daily track, track lab, gamepad
menus, their SDK wired in.

## The target

**It looks like its cover, drives like a drift game on a keyboard, wins
a stranger over inside 60 seconds, and still loads in two.**

## The rounds

Each round is a brief in `briefs/`, built on its own branch by a
separate session, behind a switch on the address until the author has
played it, then made the default. One round's brief is written when the
round before has been played, not before.

**Round 1, in parallel:**

- **1A, the look** (`briefs/COVER-LOOK.md`). Light the world with an
  environment so everything reflects; clear coat paint, glass, chrome
  and rubber on the cars; a wet, reflective road with the lights in it;
  floodlight towers, light pools and a denser venue; thick lit smoke; a
  closer, lower camera; antialiasing; the first track and the title at
  floodlit dusk, as on the cover. Switch: `?look=2`. Measured against
  the cover side by side and by the bench on the author's devices.
- **1B, the controls** (`briefs/PRO-CONTROLS.md`). On a keyboard and a
  gamepad: throttle, brake and reverse, handbrake, steering, with a
  lighter assist so throttle and countersteer hold the slide. Touch
  stays exactly as it is, proved to the bit. Switch: `?controls=pro`,
  with three handling variants for the author to choose from by play.

**Round 2, the first minute.** A live title: the hero car drifting under
floodlights behind one big PLAY. Track 1 rebuilt as a place to learn to
drift by doing it, a star inside the first run, coins and a garage
moment inside three minutes, the rest of the game in view but not in the
way. Everything retuned to the new controls (star targets, rivals, park
levels) by the author's play. Optional, his call: first party counts on
driftfever.com (our own Worker, no outside service, no personal data) to
see where real visitors stop.

**Round 3, the sound.** Engine, gears, turbo, tyres on each surface,
impacts, music that fits, one mix. Better recordings may cost money: his
call.

**Round 4, competition.** A leaderboard for the daily track and every
career track, with the best run as a ghost to race, as PolyTrack does.
Needs a small backend on driftfever.com (Cloudflare, likely within the
free allowance): his call.

**Round 5, prove it and relaunch.** Five people who have never seen it
play on a desktop with a keyboard, watched, not helped. The bench on a
desktop, a phone, an iPhone and a 4 GB Chromebook. New covers and video
drawn by the game itself, so the imagery is honest. Then resubmit.
Their FAQ allows it "only if you've made clear improvements", and warns
that small changes get the same answer.

## Before resubmitting, all of these

1. Side by side, the game's own frame and the cover: the author says
   that is the game.
2. The bench: at least 60 fps median and under 5 per cent stutter on
   the default tier on the author's desktop and phone.
3. Of five strangers: four drift on purpose inside 30 seconds, four
   play five minutes unasked, four can say what the goal is.
4. No known bug in the first ten minutes.
5. Covers and video drawn from the game.

## Where it stands (23 November 2026)

- **Round 1 is in and is the default** on driftfever.com since the
  evening of 22 November, by the author's word after playing the look
  on his phone: the look (`?look=1` for the old one) and Pro controls on
  a keyboard or gamepad (variant a until he picks; `?controls=easy` for
  the old ones). Since then: the paint fix, and the boot no longer
  flashes the race HUD before the title.
- **Round 2 is merged behind `?first=2`** (`briefs/FIRST-MINUTE.md`,
  `review/first/REPORT.md`), by the author's go-ahead of 23 November,
  waiting for his play on his phone. New evidence went into it: a
  friend of his played it and called the initial experience of the
  first race track "clunky", and his reading is that the first car
  needs to be more enjoyable to play with. Measured, the clunk was the
  starter on touch (held steer capped at 46 km/h, walls stopping it
  dead, camera cuts) and mid run builds; on keys, Pro a is rougher
  still for a newcomer and round 2 did not change it.
- He cannot play on a desktop for a while, so the Pro variant and the
  bench wait, and round 2 is judged on his phone first.
- He has emailed CrazyGames' developer support asking what fell short.

## Decisions waiting on the author

- Pick a Pro variant on a keyboard (`?pro=b`, `?pro=c`), when he has a
  desktop.
- Run `?bench=1&adapt=0` on his desktop and phone and send the result.
- CrazyGames' answer, when it comes, goes into the next brief.
- Later: first party counts (round 2), paid sounds (round 3), a backend
  (round 4).
