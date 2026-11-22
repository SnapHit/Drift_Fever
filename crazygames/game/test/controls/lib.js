/* SHARED BY THE CONTROLS PROBES (briefs/PRO-CONTROLS.md). The ladder
   probes' harness (headless Chromium through the dev server, the frame
   loop stubbed, the page advanced at a synthetic 60 Hz) and what this
   round's measures need: a page on a profile, the review folder, a
   verdict that counts failures. Run one at a time from crazygames/ with
   PLAYWRIGHT_BROWSERS_PATH pointing at a folder holding
   chromium-<n>/chrome-linux/chrome. */
import path from 'node:path';
import fs from 'node:fs';
import * as L from '../ladder/lib.js';

export * from '../ladder/lib.js';
export const controlsDir = path.join(L.root, 'review', 'controls');
fs.mkdirSync(controlsDir, { recursive: true });
export const VARIANTS = ['a', 'b', 'c'];
/* the address for a profile: 'easy' is the game with no switch at all */
export const queryFor = p => (p === 'easy' ? '' : 'controls=pro&pro=' + p);

let failed = 0;
export function verdict(ok, text) { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; }
export const failures = () => failed;
export function finish(name, data) {
  if (data) fs.writeFileSync(path.join(controlsDir, name + '.json'), JSON.stringify(data, null, 1));
  console.log(failed ? failed + ' failed' : 'all passed');
  return failed;
}

/* An empty save with the prompts done, on the title, on profile p's address. */
export async function profilePage(env, vp, p, extra) {
  return L.emptyPage(env, vp || { width: 1280, height: 720 }, queryFor(p) + (extra ? '&' + extra : ''));
}

/* Keys as a player presses them, by position (code) and print (key). */
export const KEY = `
  const down = (key, code) => window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
  const up = (key, code) => window.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true }));
  const frames = n => { const F = window.__feel; if (window.__clock === undefined) window.__clock = 1000; for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); } };
`;
