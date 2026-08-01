# Kickoff prompt for session one

Copy everything below into a new Claude Code session on this repo.

---

Read CLAUDE.md and BRIEF.md before doing anything.

This is session one. The goal is a crude playable demo and nothing else. Do not build the whole game.

Build only steps 1 and 2 of the build order in section 11:

1. The road and one control axis on a screen, playable.
2. Leaving the road kills you, with the scrape band from section 4.2 between "on the road" and "dead".

Plus two structural pieces that are cheap now and expensive later, from section 13:

- The continuous steering value from section 8.1. Keyboard and touch both write to it and ramp rather than snap. The update loop reads only that value.
- The tilt button and its permission plumbing, even if tilt itself does nothing useful yet. One code path, per section 8.2. Feature-detect and hide the button where there is no sensor.

Also include:

- Every feel constant in one named block at the top with a comment saying they are not to be casually changed. Include draw distance, field of view, steering ramp time and tilt smoothing.
- A frame rate counter I can toggle, so I can measure performance on a real device.

Deliberately leave out: scoring, the risk multiplier, escalating road features, biomes, the ghost, persistence, art direction, audio, and any menu.

Commit `index.html` to the root so GitHub Pages serves it.

When you are done, write a short note covering what is in the file, what you left out, and anything in the brief that turned out to be wrong or that you disagree with.
