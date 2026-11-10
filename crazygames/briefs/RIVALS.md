# Brief: rivals and tandem (11 November 2026)

Branch `crazygames-rivals`. Folders: `game/` and `review/rivals/`. Read
`../CLAUDE.md` first: the Status section is the history of every
decision since `DESIGN.md`. Then read `../DESIGN.md`, `../BRIEF.md` (the
hard limits), `review/spectacle/REPORT.md`, `review/chapters/REPORT.md`
and `briefs/SPECTACLE.md` (the round before this one, and the way a
round is measured and reported).

## Why

The author played the spectacle round and said it looks great. This is
the second of four rounds towards his goal: the best free drift game
anywhere. The first made the game look the part. This one gives it the
thing the best known free drift games do not have: another car.

Today the player is alone on every track. The only other car is his own
ghost. Real drifting's signature is the tandem: two cars sideways, a
metre apart, the chase car shadowing the lead. No free browser drift
game does it well. A solo drift game is a score attack; a tandem is a
duel. That is the lane.

So this round adds rivals: named drivers who lead a run, and a tandem
battle in which the player chases one, scores for staying close while
both cars slide, and wins by outscoring him.

Do fewer things beautifully, not everything thinly. One battle that is
a thrill beats six that are a chore. Build the first rival on the first
track until chasing him is the best thing in the game, and only then
make the rest.

## The design, decided

- **A battle is one run.** The rival starts ahead of the player on the
  grid, staggered to one side. Both are released at GO. The rival drives
  his own line and drifts the corners. The player chases.
- **The rival is the same every time.** He is driven by a scripted
  driver in his own physics world, stepped in lockstep with the
  player's (as the ghost is, `game/src/loop/ghost.js`). He reads only
  his own world, never the player's, so his run does not depend on what
  the player does. No rubber band.
- **Tandem scoring.** While the player's slide is scoring, the rival is
  sliding too, and the player is close behind or alongside him, the
  player's points count more: more the closer, nothing past a far
  limit. Being ahead of the rival earns no tandem bonus. Everything else
  about the score (the chain, the multiplier, clean sectors, pace) is as
  it is.
- **The rival is solid.** The player cannot drive through him. Touching
  him hard is a hit like a wall hit: it loses the chain, shakes and
  sparks, and turns the tandem bonus off for a moment. The player's car
  never moves the rival.
- **The win.** The rival scores by the same rules as a solo run (no
  tandem bonus for him). The player wins if his total is at least the
  rival's. Both totals are on screen through the run.
- **Six rivals, two in each chapter**, each on a career track of his
  half of the chapter, chosen by measurement. Each has an invented
  name, one of the five cars with a paint, and a driving character
  (smooth and wide, fast and shallow, late and aggressive, and so on).
  They get harder.
- **Battles gate nothing that exists.** Tracks and chapters open exactly
  as they do today. A rival opens with a star on his track and a win
  over the rival before him. The career screen shows each rival as a
  card after his track. The first time a rival opens, the results screen
  that opened him offers the battle.
- **Rewards are coins**: a prize for the first win over each rival, and
  ordinary run coins every time. No cosmetics: the garage is the next
  round.
- **Circuits run fewer laps in a battle**, so a battle stays inside the
  60 to 120 s a run is meant to be.

Every number here (the zone, the bonus, the stagger, the laps, the
prizes, each rival's driving) goes in a named block with a one-line
comment, as first guesses for the author to set by play. Put the run
numbers in `TANDEM` in `game/src/tune.js` and the rivals themselves in
`game/src/rivals/`.

## What to build, in priority order

Finish each before starting the next. If you run short, stop and report
what is left; do not half-do the later ones.

1. **A rival worth chasing.**
   - A lead car that looks like a good driver: committed entries, long
     held slides, clean exits, no wall hits, no stalls, no respawns. The
     scripted drifter in `game/src/physics/driver.js` is the starting
     point; it earns one or two stars today and stalls on some tracks.
     Leave that file as it is (every measurement since the feel round
     uses it, and the career seeds were chosen by it). Build the rival's
     driver in `game/src/rivals/`, from a copy if that helps.
   - His pace is one the player's car can stay with. The first rival
     must be chaseable in the starter car with no upgrades.
   - He gets the show: smoke, marks, tail-light trails, brake lights,
     the lot, so that following him at night is the best frame in the
     game. Watch the cost; a second car's particles may need their own
     density.
   - **He must drive the same on every device, near enough.** The
     physics calls `Math.sin` and `Math.cos`, which engines round
     differently in the last bit (`game/src/tracks/dmath.js` explains).
     A recorded tape would drift apart from its walls on another engine;
     a driver that steers by what it sees corrects itself. So drive him
     live, and prove he is robust: see measurement 2.
2. **The tandem.**
   - The zone and the bonus, in `game/src/scoring/`. With no rival the
     score must be the same to the last point.
   - The solid rival. With no rival the physics must be the same to the
     last bit. `game/src/physics/vehicle.js` does not change.
   - The HUD: both totals, how close the player is (the player must be
     able to read "closer" and "too far" without looking away from the
     cars), the tandem bonus while it counts, callouts for the best
     moments. A tag with the rival's name over his car. When the rival
     is out of view, which way and how far.
   - After the rival finishes he is no longer solid and fades away, so
     he is never an obstacle at the line. If the player finishes first,
     run the rival's world on to his finish before the result is shown.
   - The readability rule still holds: the player's car is the most
     findable car. The rival never wears the paint the player is
     wearing.
3. **The battle, in the game.**
   - The countdown says what this is and what to do, in a heading and
     one line. The first battle ever adds one prompt at the moment it
     applies (stay close while you both slide). No tutorial screen.
   - The camera: the countdown's sweep shows both cars and passes
     through neither. The finish beat still works.
   - The results: who won, both totals, what the tandem was worth, the
     coins, with REMATCH and the next thing to do as buttons. It fits
     844x390 without scrolling.
   - The career screen's rival cards: locked (and what opens him), open,
     beaten (with the best margin).
   - The save: an additive entry for rivals (won, best, when), checked
     and repaired on load like the rest of the save. A save from `main`
     loads with nothing repaired and nothing changed. No ghost is kept
     for a battle.
4. **The other five rivals.** Each on a track he drives cleanly, each
   with a character the player can see in how he drives, each measured
   like the first.

## Keep

- **Every run that exists is untouched.** The daily, the career, free
  drift and the Lab play and score exactly as on `main`. A tape recorded
  on `main` replays to the same hash and score on this branch.
- **The car and the camera are the author's.** Do not retune
  `TUNE.VEHICLE`, `TUNE.ASSIST`, `TUNE.CAMERA`, `TUNE.SCORING`'s existing
  numbers, star targets, coins, prices or the chapters' thresholds.
- **Nothing a player has stored changes.** The save only gains.
- **Every number of taste goes in a named block**, with a one-line
  comment.
- The hard limits in `BRIEF.md` and `../CLAUDE.md`: no external
  requests, 20 MB initial load, original designs, 60 fps on the low
  tier, PEGI 12.
- **Names are invented.** No rival is named after a real driver, a real
  team, a real brand or a character from another game. Search before
  you settle each one, and say in the report what you searched.
- Every probe in `game/test/` must still pass: feel, loop (including
  `loop/quota.js`), tracks, visuals, cars, retention, chapters and
  spectacle.
  - `tracks2.js`'s busyness known answer already misses on `main`.
    Report it, do not fix it.
  - `loop/probes.js` takes about 45 minutes and `retention/probes.js`
    about 25. Run them detached with `setsid nohup` and wait on the
    process, not on a grep of its output. They rewrite screenshots in
    `review/loop/` and `review/retention/`: restore those with
    `git checkout`, do not commit them.
  - The retention perf check compares against a stored figure for
    `main` that is stale (3.6 ms; `main` reads about 4.2 today). If it
    fails by a hair, rerun `node game/test/retention/probes.js perf`
    alone on a quiet machine before believing it.
- The sandbox draws in software (forced WebGL 2). Run probes from
  `crazygames/` with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. The
  harness in `game/test/spectacle/lib.js` is the newest; build on it.
- Australian spelling, and no em or en dashes, in code, comments and
  copy. No model names or session identifiers in commits, code or
  comments. Commit as `git -c user.name="SnapHit"
  -c user.email="nathanhaslewood@gmail.com"` with no trailers.

## Not yours

- The rival chasing the player (a lead run). Say in the report what it
  would take and whether you would build it.
- Rivals on the daily, in the Lab or in free drift. More than six.
- Cosmetics, liveries, wheels, anything for the garage.
- A sound for the rival's engine or tyres. You may call the sound cues
  that exist; `game/src/audio/` and `game/assets/audio/` do not change.
- Leaderboards, multiplayer, anything that needs a server.

## Measure, each with a known answer that can fail

1. **Nothing that exists has changed.** Tapes recorded on `main` on
   career 1 and The vice replay on this branch to the same hash and
   score. A battle's tape replays to the same hash and the same two
   totals. Known answers: a tape with one input changed does not; a
   rival with one driving number changed gives a different rival hash.
2. **The rival drives well, and robustly.** For each rival on his
   track: respawns, hard hits, wall contacts, the lowest speed after the
   launch, the share of each corner spent sliding, his total. Then the
   same under at least 20 small disturbances (the start a few
   centimetres off, the grip half a per cent off): the worst case and
   the count, not the median. Set the bar. Known answer: a driver you
   have made too fast fails it.
3. **The battle is fair.** Build a scripted chase driver for the
   measurements (it follows the rival and slides when he does). Report,
   for each rival:
   - the chase driver's share of the rival's sliding time spent in the
     zone, and whether it wins, in the starter with no upgrades for the
     Rookie rivals; for Pro and Legend, say which car and upgrades it
     needs
   - the careful driver (no drifting) loses to every rival
   - a player who does not move loses
   - Known answer: the same chase run with the tandem bonus set to
     nothing loses to the first rival, so the tandem decides the battle.
4. **Contact.** Scripted: the player runs into the rival's tail, swipes
   his side, and parks on his line. In each: the two cars' boxes never
   overlap by more than a tolerance you set, a hard contact loses the
   chain, the player is not thrown off the track, is not stuck for more
   than a second, and no number goes NaN. The rival's hash is the same
   with the player there and with no player. Known answer: with the
   rival not solid, the overlap check fails.
5. **Frame time.** JavaScript p95 at 6x CPU throttle on the low tier in
   a battle against the first and the last rival, against the same
   track solo; draw calls and triangles per tier, with and without the
   rival. The GPU cannot be measured here: say so, and list what the
   second car costs it.
6. **Layout.** The battle's countdown, HUD and both results (won and
   lost), and the career screen with rival cards, at 390x844, 844x390,
   800x450 and 1280x720: no overlaps, measured by bounding boxes, and
   every button inside the view.
7. **The camera.** Through the countdown's sweep the camera is never
   inside either car, and both cars are in view at GO.
8. **The save.** A save written on `main` loads with nothing repaired
   and every value the same. A rivals entry of the wrong shape is
   repaired and the game runs. `loop/quota.js` passes. Known answer:
   the wrong shaped save fails the invariants raw.
9. **Frames**, in `review/rivals/shots/`: the countdown, a chase mid
   slide close in, the same too far back, a contact, the rival's
   finish, the results won and lost, the career with its cards; by day
   and at night, at 1280x720, 390x844 and 844x390. Look hard at every
   one. If the close chase at night would not make a player stop
   scrolling, it is not done.

## Deliver

Commits on `crazygames-rivals`, pushed after every step, because usage
limits may interrupt you. Never push to `main`.

Finish with `review/rivals/REPORT.md`:
- first, a phone-readable summary
- the measurements, each with its known answer
- the frames
- what the author should judge on his own devices
- what is not done
- every deviation from this brief
- your view on the lead run

If anything in this brief turns out to be wrong, stop and say so rather
than working around it.
