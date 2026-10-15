/* THE ORIGINAL, BY COMMIT. This folder lives inside the Drift_Fever
   repository, so the pinned original is not a copy: it is index.html at the
   commit named in vendor/original/COMMIT, read straight out of the
   repository's history. Re-vendoring is "write the new commit hash to
   COMMIT and run tools/vendor.js". A shallow clone that lacks the commit
   fails here with a clear message rather than quietly testing against
   nothing. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
export const commit = fs.readFileSync(path.join(root, 'vendor', 'original', 'COMMIT'), 'utf8').trim();

export function originalHtml() {
  let top;
  try { top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch (e) { throw new Error('crazygames/ must sit inside the Drift_Fever git repository: ' + e.message); }
  try {
    return execFileSync('git', ['show', commit + ':index.html'], { cwd: top, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    throw new Error('cannot read index.html at ' + commit + ' from the repository history. A shallow clone will not have it: run git fetch --unshallow (or check out with fetch-depth 0). ' + e.message.split('\n')[0]);
  }
}
