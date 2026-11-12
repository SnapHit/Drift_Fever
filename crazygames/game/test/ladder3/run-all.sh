#!/bin/sh
# The third ladder round's measurements after the search
# (briefs/RIVALS-LADDER-3.md measures 1 and 4: priority 3), one after
# another, each log in review/ladder3/runs/ and the exit codes in
# runs/summary.txt. Run from crazygames/ with PLAYWRIGHT_BROWSERS_PATH
# set, detached. The probes rewrite other rounds' review files; their
# results are copied into review/ladder3/ and the originals restored
# with git checkout before committing.
#   setsid nohup sh game/test/ladder3/run-all.sh &
set -u
OUT=review/ladder3/runs
mkdir -p "$OUT"
run() {
  name=$(echo "$*" | sed 's|game/test/||; s|\.js||g; s| |_|g; s|/|-|g; s|--||g; s|review-ladder3-||g')
  echo "== $* ($(date -u +%H:%M:%S))" >> "$OUT/summary.txt"
  node "$@" > "$OUT/$name.log" 2>&1
  echo "$* exit $?" >> "$OUT/summary.txt"
}
run game/test/ladder2/determinism.js
run game/test/ladder/earning.js
run game/test/ladder/layout.js
run game/test/driftrace/contact.js r1 --out review/ladder3/contact-r1.json
run game/test/driftrace/contact.js r2 --out review/ladder3/contact-r2.json
run game/test/driftrace/perf.js r1 r2
run game/test/ladder/save.js
run game/test/loop/quota.js
run game/test/ladder2/newplayer.js
echo "ALL DONE ($(date -u +%H:%M:%S))" >> "$OUT/summary.txt"
