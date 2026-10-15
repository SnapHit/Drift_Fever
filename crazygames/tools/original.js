/* THE ORIGINAL, BY COMMIT. The pinned original is index.html at the commit
   named in vendor/original/COMMIT. A byte copy of it sits beside the pin in
   vendor/original/index.html, because a deploy build cannot rely on the
   repository's history: Cloudflare's Workers build clones shallow and
   `git show <commit>:index.html` fails there.

   The copy is never trusted on its own word. Wherever the history is
   reachable (any full clone, a session after `git fetch`, CI with
   fetch-depth 0) the copy is compared with the history byte for byte and a
   mismatch stops everything. Where the history is not reachable the copy is
   used, and parity:check still compares its sha256 with the one the last
   passing parity run recorded from the history, so a hand edited copy fails
   the build either way.

   Re-vendoring is "write the new commit hash to COMMIT, run
   `npm run vendor:pin` to refresh the copy, run tools/vendor.js". */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
export const commit = fs.readFileSync(path.join(root, 'vendor', 'original', 'COMMIT'), 'utf8').trim();
export const copyPath = path.join(root, 'vendor', 'original', 'index.html');

/* index.html at the pinned commit from the repository history, or null when
   the history does not have it (shallow clone, no git). */
export function fromHistory() {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return execFileSync('git', ['show', commit + ':index.html'], { cwd: top, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

export function originalHtml() {
  const copy = fs.existsSync(copyPath) ? fs.readFileSync(copyPath, 'utf8') : null;
  const hist = fromHistory();
  if (hist !== null && copy !== null && hist !== copy)
    throw new Error('vendor/original/index.html does not match index.html at ' + commit + ' in the repository history. Run npm run vendor:pin.');
  if (hist !== null) return hist;
  if (copy !== null) return copy;
  throw new Error('no original: vendor/original/index.html is missing and the history does not have ' + commit + ' (shallow clone). Fetch the history and run npm run vendor:pin.');
}

/* npm run vendor:pin: write the copy from the history at the pinned commit. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--pin')) {
  const hist = fromHistory();
  if (hist === null) { console.error('cannot read index.html at ' + commit + ' from the history: run git fetch --unshallow first'); process.exit(1); }
  fs.writeFileSync(copyPath, hist);
  console.log('vendor/original/index.html written from ' + commit + ', ' + Buffer.byteLength(hist) + ' bytes');
}
