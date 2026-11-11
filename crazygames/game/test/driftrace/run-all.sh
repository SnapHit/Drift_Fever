#!/bin/sh
# Every probe in game/test, one after another, on this branch, each log in
# review/driftrace/runs/ and the exit codes in runs/summary.txt. Run from
# crazygames/ with PLAYWRIGHT_BROWSERS_PATH set; detached, it takes about
# two hours (loop/probes.js about 45 minutes, retention/probes.js about 25).
# The probes rewrite other rounds' review files; restore those with git
# checkout before committing.
#   setsid nohup sh game/test/driftrace/run-all.sh [driftrace|others|all] &
set -u
OUT=review/driftrace/runs
mkdir -p "$OUT"
WHICH=${1:-all}
run() {
  name=$(echo "$*" | sed 's|game/test/||; s|\.js||g; s| |_|g; s|/|-|g; s|--||g')
  echo "== $* ($(date -u +%H:%M:%S))" >> "$OUT/summary.txt"
  node "$@" > "$OUT/$name.log" 2>&1
  echo "$* exit $?" >> "$OUT/summary.txt"
}
if [ "$WHICH" = driftrace ] || [ "$WHICH" = all ]; then
  run game/test/driftrace/hands.js
  run game/test/driftrace/racing.js
  run game/test/driftrace/contact.js
  run game/test/driftrace/determinism.js
  run game/test/driftrace/save.js
  run game/test/driftrace/camera.js
  run game/test/driftrace/layout.js
  run game/test/driftrace/perf.js
  run game/test/driftrace/shots.js
fi
if [ "$WHICH" = others ] || [ "$WHICH" = all ]; then
  run game/test/loop/quota.js
  run game/test/feel/handling.js
  run game/test/feel/corners.js
  run game/test/feel/probes.js
  run game/test/tracks/probes.js
  run game/test/tracks/tracks2.js
  run game/test/visuals/occlusion.js
  run game/test/visuals/occlusion.js --career
  run game/test/visuals/probes.js
  run game/test/cars/measure.js
  run game/test/cars/render.js
  run game/test/retention/codes.js
  run game/test/retention/heading.js
  run game/test/chapters/probes.js
  run game/test/stars/ghost.js
  run game/test/spectacle/determinism.js
  run game/test/spectacle/night.js
  run game/test/spectacle/smoke.js
  run game/test/spectacle/adapt.js
  run game/test/spectacle/layout.js
  run game/test/spectacle/perf.js
  run game/test/retention/probes.js
  run game/test/loop/probes.js
fi
echo "ALL DONE ($(date -u +%H:%M:%S))" >> "$OUT/summary.txt"
