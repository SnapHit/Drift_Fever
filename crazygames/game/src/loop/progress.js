/* PROGRESS THROUGH A RUN. Reads where the car is along the track
   (world.along) and keeps the lap count, the checkpoints passed and
   whether the run is finished. A circuit's lap counts when the car
   crosses the start line forwards having passed every checkpoint in
   order since the last crossing, so a respawn or a shortcut cannot count
   one; a sprint finishes at its finish line. Pure arithmetic on the
   world's state, stepped at the physics rate, so a replay progresses the
   same. */
export function createProgress(track, laps) {
  const length = track.length, line = track.startLine || 0, circuit = track.kind === 'circuit';
  /* checkpoints measured from the start line, in order */
  const cps = (track.checkpoints || []).map(c => circuit ? ((c - line) % length + length) % length : c).sort((a, b) => a - b);
  const finishAt = circuit ? null : (track.finish ? track.finish.along : length - 2);
  const p = { lap: 0, laps, nextCp: 0, cps: cps.length, finished: false, pos: 0, remaining: 0, crossings: 0, prevPos: null, finishedAtStep: -1 };
  function reset() { p.lap = 0; p.nextCp = 0; p.finished = false; p.pos = 0; p.prevPos = null; p.crossings = 0; p.finishedAtStep = -1; p.remaining = total(); }
  function total() { return circuit ? laps * length : finishAt; }
  function step(world) {
    if (p.finished) return;
    const s = world.along;
    if (circuit) {
      const pos = ((s - line) % length + length) % length;
      if (p.prevPos !== null && p.prevPos - pos > length / 2) {
        // a forward crossing of the line
        p.crossings++;
        if (p.nextCp >= cps.length) { p.lap++; p.nextCp = 0; }
        if (p.lap >= laps) { p.finished = true; p.finishedAtStep = world.step; }
      }
      while (p.nextCp < cps.length && pos >= cps[p.nextCp] && pos < cps[p.nextCp] + length / 2) p.nextCp++;
      p.prevPos = pos; p.pos = pos;
      p.remaining = Math.max(0, (laps - p.lap) * length - pos);
    } else {
      while (p.nextCp < cps.length && s >= cps[p.nextCp]) p.nextCp++;
      p.pos = s;
      p.remaining = Math.max(0, finishAt - s);
      if (s >= finishAt && p.nextCp >= cps.length) { p.finished = true; p.finishedAtStep = world.step; p.lap = 1; }
    }
  }
  reset();
  return { state: p, step, reset, total };
}
