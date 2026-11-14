#!/bin/sh
# THE PLAYGROUND ROUND'S MEASURES (briefs/PLAYGROUND.md), one after
# another: two heavy browser probes at once starve each other. From
# crazygames/, with PLAYWRIGHT_BROWSERS_PATH set. Each writes its
# results to review/park/ and ends "all passed" or "N failed".
#   sh game/test/park/run-all.sh          the round's own measures, 1 to 6
#   sh game/test/park/run-all.sh perf     measure 8, the frame cost (about a quarter of an hour, alone on the machine)
#   sh game/test/park/run-all.sh others   measure 7: the other rounds' probes that must still pass
fail=0
check() { echo "== $*"; out=$(node "$@" 2>&1); code=$?; echo "$out" | grep -E "^FAIL|failed|all passed" | tail -n 6; [ $code -eq 0 ] || fail=$((fail + 1)); }
if [ "${1:-}" = others ]; then
  check game/test/ladder2/determinism.js
  check game/test/play13/check.js
  check game/test/play13/career.js
  check game/test/play14/check.js
  check game/test/ready/pad.js
  check game/test/ready/keys.js
  npm run build > /dev/null 2>&1 || { echo "FAIL npm run build"; fail=$((fail + 1)); }
  check game/test/ready/sdk.js
  check game/test/ladder/earning.js
  check game/test/garage/buy.js
  check game/test/garage/layout.js
  echo "now restore the other rounds' review files: git checkout -- review/ladder2 review/play13 review/play14 review/ready review/ladder review/garage"
elif [ "${1:-}" = perf ]; then
  check game/test/park/perf.js cost
  check game/test/park/perf.js known
  check game/test/park/perf.js adapt
else
  check game/test/park/park.js
  check game/test/park/sight.js
  for part in donut eight slalom wall gate open tour known; do check game/test/park/challenges.js $part; done
  check game/test/park/paying.js
  check game/test/park/extras.js
  check game/test/park/saves.js
  check game/test/park/layout.js
fi
[ $fail -eq 0 ] && echo "every probe passed" || echo "$fail probes failed"
exit $fail
