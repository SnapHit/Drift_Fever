#!/bin/sh
# Runs the searches listed in a job file (one command line each, the
# log's name first), two at a time, each log in review/ladder2/runs/search/.
#   setsid nohup sh game/test/ladder2/queue.sh jobs.txt &
OUT=review/ladder2/runs/search
mkdir -p "$OUT"
grep -v '^#' "$1" | grep . | xargs -P "${JOBS:-2}" -I{} sh -c 'set -- {}; name=$1; shift; node "$@" > '"$OUT"'/$name.log 2>&1; echo "$name exit $?" >> '"$OUT"'/done.txt'
echo "QUEUE DONE $1" >> "$OUT/done.txt"
