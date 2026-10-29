/* THE DEBUG READOUT, at ?debug=1: the backend and tier, the frame rate
   over the last second, the worst frame in the last two seconds, the
   physics time per frame and the steps it took, and the render submit
   time. Text only, refreshed four times a second. */
export function createDebug(root) {
  const el = document.createElement('pre');
  el.id = 'debug';
  root.appendChild(el);
  let frames = 0, acc = 0, worst = 0, worstAt = 0, physAcc = 0, physWorst = 0, stepsAcc = 0, submitAcc = 0, lastText = 0;
  const stats = { fps: 0, worstMs: 0, physMs: 0, physWorstMs: 0, steps: 0, submitMs: 0 };
  return {
    el, stats,
    frame(frameMs, physMs, steps, submitMs, info, t) {
      frames++; acc += frameMs; physAcc += physMs; stepsAcc += steps; submitAcc += submitMs;
      if (frameMs > worst || t - worstAt > 2000) { worst = frameMs; worstAt = t; }
      if (physMs > physWorst) physWorst = physMs;
      if (t - lastText >= 250 && frames > 0) {
        stats.fps = Math.round(1000 / (acc / frames)); stats.worstMs = worst; stats.physMs = physAcc / frames; stats.physWorstMs = physWorst; stats.steps = stepsAcc / frames; stats.submitMs = submitAcc / frames;
        el.textContent = info.backend + ' ' + info.tier + '  ' + stats.fps + ' fps  frame ' + (acc / frames).toFixed(1) + ' ms  worst ' + worst.toFixed(1) + ' ms\nphysics ' + stats.physMs.toFixed(2) + ' ms (' + stats.steps.toFixed(1) + ' steps, worst ' + physWorst.toFixed(2) + ')  submit ' + stats.submitMs.toFixed(1) + ' ms';
        frames = 0; acc = 0; physAcc = 0; stepsAcc = 0; submitAcc = 0; physWorst = 0; lastText = t;
      }
    },
  };
}
