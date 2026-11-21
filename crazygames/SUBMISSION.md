# Submitting Drift Fever to CrazyGames

**Submitted on 21 November 2026 for a Basic Launch; awaiting review.**

Everything their Developer Portal asks for, in one place, made on 15
November 2026 from their own pages read that day
(docs.crazygames.com/requirements: intro, technical, gameplay, quality,
game-covers). Their portal is https://developer.crazygames.com/.

## The files

| What | File | Notes |
|---|---|---|
| The game | `drift-fever-crazygames.zip` | Made by `npm run build` then `npm run package:crazygames`, then the contents of `dist-crazygames/` zipped with `index.html` at the top. 90 files, 12.2 MB unzipped (their limits: 1,500 files, 250 MB). Not committed: make it again before uploading so it is the latest build. |
| Landscape cover, 1920x1080 | `brand/covers/crazygames-landscape.png` | The hero art with the title clear of their label zone (`compose.js --safe`). |
| Portrait cover, 800x1200 | `brand/covers/crazygames-portrait.png` | The hero art with the title clear of their label zone (`compose.js --safe`). |
| Square cover, 800x800 | `brand/covers/crazygames-square.png` | The hero art with the title clear of their label zone (`compose.js --safe`). |
| Landscape video, 1080p 16:9 | `brand/video/drift-fever-preview-landscape-1920x1080.mp4` | 18.3 s, silent, 26 MB (their limits: 15 to 20 s, 50 MB). Not committed. |
| Portrait video, 1080p 2:3 | `brand/video/drift-fever-preview-portrait-1080x1620.mp4` | 18.3 s, silent, 22 MB. Not committed. |

## The words

**Name:** Drift Fever

**Description**

> Drift Fever is a 3D arcade drift racing game you can play in seconds.
> Steer with two keys, hold one button to throw the car sideways, and
> chain slides together to build a multiplier that climbs for as long as
> you keep it going.
>
> Work through a 24 track career across three chapters, from wide
> learner circuits to banked hairpins and figure eights at night. Win
> stars to open new tracks, then take on six rival drivers in head to
> head drift races where the most points wins and getting home first
> counts for more.
>
> Spend the coins you earn in the garage: five cars from a friendly
> starter coupe to a wild drift build, power, grip and steering
> upgrades, and wheels, underglow, paint and tyre smoke to make the car
> your own. Then take it to the stunt park for donuts, slaloms, wall
> rides and 24 challenges with no timer.
>
> A new daily track every day, a track lab that builds a circuit from
> your settings and gives you a code to share, and a ghost of your best
> run to beat.

**Controls**

> Desktop
> - A / D or Left / Right arrow: steer
> - Space, Shift, W, S, Up or Down arrow: drift. Hold it while steering
>   to slide; hold it on its own to brake
> - R: restart the run
> - L or Tab: the challenge list in the stunt park
> - A gamepad works too: stick or d-pad to steer, A, B, X or a trigger
>   to drift
>
> Mobile
> - The two arrow buttons steer
> - The DRIFT / BRAKE button drifts while you steer and brakes on its
>   own

**Category:** Driving (their racing and car games). **Tags to pick from
what the portal offers:** drift, car, racing, 3D, driving, stunt,
upgrade, arcade.

**Orientation (mobile):** landscape and portrait both work; landscape
is the better one. Their site turns the phone for the player, so say
what the portal lets you say.

**Age rating:** fits PEGI 12: cars only, no violence, no chat, no
purchases, no accounts.

**Multiplayer, accounts, in game purchases, ads:** none.

## What the build does on CrazyGames

- Loads their SDK (v3) and tells it when play starts and stops. Seen
  working against their real script on 15 November, served from
  localhost, where their SDK runs in its "local" mode: it initialised
  (their version 3.8.0) and logged a gameplay start when a run began
  and a stop at the menu.
- Says "CrazyGames edition" under the title. The version on
  driftfever.com does not.
- Hides its own full screen button inside their frame (they forbid a
  custom one and provide theirs).
- A new player lands on the title, where the main button (CAREER,
  start here) is one click from a run of the first track. Their
  gameplay page asks for gameplay at once or one click at most. The
  controls are prompted during that first run and can be skipped.

## Checked against their requirements

| Their rule | Where it stands |
|---|---|
| 1,500 files, 250 MB | 90 files, 12.2 MB |
| Initial download 50 MB, 20 MB for the mobile homepage | 2.6 MB before the first run; the music (9.7 MB) streams after the first tap |
| Relative paths only | No absolute path in the page or its code |
| Legible at pixel ratio 1 in 16:9 frames | Ten sizes from 800x450 to 1920x1080, twelve views each: nothing off the frame, no button under 36 px, no text under 10 px (`game/test/ready/sizes.js`). Their pages give no list of sizes; these ten are this project's own |
| Keys follow the keyboard layout | Letters are read by position, so ZQSD works on AZERTY |
| No custom full screen button | Hidden inside a frame |
| No links out, no cross promotion | None in the game |
| `user-select: none` on the body | Yes |
| Safe areas in their app | The page pads by the device's safe areas |
| Sound resumes after an interruption on iOS | The sound resumes on every touch or key |
| The same physics at any refresh rate | The physics steps 120 times a second whatever the screen does |
| Do not detect touch by `ontouchstart` or `maxTouchPoints` | Neither is used; the touch buttons appear at the first touch |
| English | English only |
| Works on Chrome and Edge | Chrome's engine, here. Edge and Safari not tried |

## Not checked, and only the author can

- The frame rate on a real desktop graphics card.
- A Chromebook with 4 GB of memory: they disable a game on Chromium OS
  that does not run smoothly there.
- Safari. They disable a game on Safari if it does not work well.
- Their own preview tool in the Developer Portal, with the zip
  uploaded: the last check before submitting.

## The order to do it in

1. Make the zip again from the latest build.
2. In the Developer Portal, upload the zip and open their preview: play
   a run, check the frame sizes they offer, and look for a gameplay
   start in their requirements checker.
3. Fill in the name, description, controls, category and tags from
   above.
4. Upload the three covers and the two videos.
5. Submit for a Basic Launch.
