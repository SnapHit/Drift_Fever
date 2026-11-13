/* The package uploaded to CrazyGames: the new game alone, from dist/
   (run npm run build first), into dist-crazygames/. It is dist/ without
   the greybox, the status page and the lab's developer pages, with one
   line changed: src/sdk/host.js says 'crazygames', which is what lets the
   SDK adapter load their script. Checks their limits (1,500 files, 250 MB;
   docs.crazygames.com/requirements/technical, read 14 November 2026).
   Nothing here fetches anything. Upload the folder's contents, zipped. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist'), out = path.join(root, 'dist-crazygames');
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('no dist/: run npm run build first'); process.exit(1); }
const LEAVE = ['greybox', 'status', 'lab'];
fs.rmSync(out, { recursive: true, force: true });
let files = 0, bytes = 0;
function copy(rel) {
  const src = path.join(dist, rel);
  if (fs.statSync(src).isDirectory()) { for (const f of fs.readdirSync(src)) copy(rel ? rel + '/' + f : f); return; }
  fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
  fs.copyFileSync(src, path.join(out, rel));
  files++; bytes += fs.statSync(src).size;
}
for (const f of fs.readdirSync(dist)) if (!LEAVE.includes(f)) copy(f);
const hostFile = path.join(out, 'src', 'sdk', 'host.js');
const was = fs.readFileSync(hostFile, 'utf8'), now = was.replace("export const HOST = 'web';", "export const HOST = 'crazygames';");
if (now === was) { console.error('src/sdk/host.js has no HOST line to change'); process.exit(1); }
fs.writeFileSync(hostFile, now);
console.log('dist-crazygames/: ' + files + ' files, ' + (bytes / 1048576).toFixed(2) + ' MB, host crazygames');
if (files > 1500 || bytes > 250 * 1048576) { console.error('over the limit of 1,500 files or 250 MB'); process.exit(1); }
