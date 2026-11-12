#!/bin/sh
# waits for one queue to finish, then runs the next
until grep -q "QUEUE DONE $1" review/ladder2/runs/search/done.txt; do sleep 15; done
sh game/test/ladder2/queue.sh "$2"
