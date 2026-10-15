/* Assemble dist/, the web root the Worker serves. Stage 1 ships a single
   status page with the parity report inlined, so the preview URL says what
   state the project is in. Nothing here fetches anything. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let stamp = null, report = '';
try { stamp = JSON.parse(fs.readFileSync(path.join(root, 'parity', 'stamp.json'), 'utf8')); } catch (e) {}
try { report = fs.readFileSync(path.join(root, 'parity', 'REPORT.md'), 'utf8'); } catch (e) {}
let html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
html = html.replace('<!--PARITY-->', stamp
  ? `<p class="${stamp.pass ? 'ok' : 'bad'}">Parity ${stamp.pass ? 'PASS' : 'FAIL'}, stamped ${esc(stamp.when)} against Drift_Fever ${esc(stamp.commit.slice(0, 7))}.</p><pre>${esc(report)}</pre>`
  : '<p class="bad">No parity stamp.</p>');
fs.writeFileSync(path.join(dist, 'index.html'), html);
for (const f of fs.readdirSync(path.join(root, 'public'))) if (f !== 'index.html') fs.copyFileSync(path.join(root, 'public', f), path.join(dist, f));
console.log('dist/ assembled: ' + fs.readdirSync(dist).join(', '));
