# Drift Fever

A single-file browser drift game. One HTML file, no build step, no dependencies. Work in progress.

- `index.html` is the game. It is the whole thing.
- `BRIEF.md` is the design brief and the source of truth.
- `CLAUDE.md` is the standing instruction set for Claude Code sessions.
- `SESSION-1-PROMPT.md` is the kickoff prompt for the first build session.
- `brand/` is the wordmark and icon path data, and the tooling that turns it
  into the favicon and the share card. See `brand/README.md`.
- `music/` is four original tracks, AAC in m4a, played in order and
  looping. Music is ON by default from session thirty nine, which
  reverses BRIEF.md sections 5 and 6 deliberately. What makes it safe is
  in the FEEL block beside the TUNE_ constants: nothing is fetched before
  the title screen, the title screen says music is coming and where the
  mute is, a mute is remembered forever, nothing ever waits on audio, and
  a blocked fetch falls back to the procedural track that is still there.
  Track titles live in the `TUNES` array in `index.html`.
- `og-card.png` and `apple-touch-icon-180.png` are for scrapers and for iOS
  home screens. The game itself never fetches either one.
