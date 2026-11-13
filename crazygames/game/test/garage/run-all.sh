#!/bin/sh
# THE GARAGE ROUND'S MEASURES (briefs/GARAGE.md), in the brief's order.
# From crazygames/, with PLAYWRIGHT_BROWSERS_PATH set where Chromium is
# not Playwright's own. Each writes review/garage/<name>.json and its
# shots; each exits 1 if a bar or a known answer fails. The frame cost
# probes draw every frame in software at 6x throttle and take about
# five minutes a race, so they are split: run them one at a time, alone
# on the machine, or their numbers mean nothing.
set -e
node game/test/garage/layout.js          # 1  the layout at four sizes
node game/test/garage/looks.js race      # 2  every cosmetic shows, in a race at night and by day
node game/test/garage/looks.js showroom  # 2  and in the showroom
node game/test/garage/readable.js low    # 3  the readability rule with the glow on
node game/test/garage/readable.js high   # 3  and on the high tier
node game/test/garage/buy.js             # 4  buying
node game/test/garage/saves.js           # 5  saves, against main's own save code
node game/test/garage/controls.js        #    keyboard, touch, gamepad, the drag
node game/test/garage/wearing.js         #    ghosts and rivals wear their own
node game/test/garage/adapt.js           # 7  the quality still adapts
if [ "$1" = "perf" ]; then
  node game/test/garage/perf.js low      # 7  frame cost, about 30 minutes
  node game/test/garage/perf.js high     #    about 15 minutes
  node game/test/garage/perf.js known    #    about 15 minutes
fi
