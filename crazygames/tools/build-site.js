/* Assemble dist/, the web root the Worker serves.

   /            the new game (DESIGN.md), everything under game/ except
                tests, with three.js under vendor/
   /greybox/    the stage 2 greybox: the shipped page from public/, the
                simulation module under sim/, three.js under vendor/, and
                the four tracks under music/, copied read only from the
                repository's music/ folder
   /status/     the parity status page with the last stamped report

   Prints the initial download: every file the page loads before its first
   playable frame, and fails above the 20MB CrazyGames limit. Nothing here
   fetches anything. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
const gb = path.join(dist, 'greybox');
fs.mkdirSync(path.join(dist, 'status'), { recursive: true });
fs.mkdirSync(path.join(gb, 'sim'), { recursive: true });
fs.mkdirSync(path.join(gb, 'vendor'), { recursive: true });
fs.mkdirSync(path.join(gb, 'music'), { recursive: true });
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* The greybox. Its initial download is exactly this list. */
const INITIAL = ['index.html', 'chrome.css', 'game.js', 'chrome.js', 'world.js', 'vendor/three.webgpu.min.js'];
for (const f of INITIAL) fs.copyFileSync(path.join(root, 'public', f), path.join(gb, f));
fs.copyFileSync(path.join(root, 'sim', 'drift-fever-sim.js'), path.join(gb, 'sim', 'drift-fever-sim.js'));
fs.copyFileSync(path.join(root, 'public', 'vendor', 'three.LICENSE'), path.join(gb, 'vendor', 'three.LICENSE'));
const initialFiles = [...INITIAL, 'sim/drift-fever-sim.js'];
let initial = 0;
for (const f of initialFiles) initial += fs.statSync(path.join(gb, f)).size;

/* The new game: everything under game/ except tests and anything a
   folder marks as not shipped (a .noship file beside it). three.js comes
   from the same pinned copy as the greybox. Its initial download is
   counted as everything shipped except game/later/, which is reserved for
   what loads after the first playable frame. */
const gameDir = path.join(root, 'game');
let gameInitial = 0, gameFiles = 0;
const skip = (rel) => /(^|\/)(test|tests|__tests__)(\/|$)|\.test\.[cm]?js$/.test(rel);
function copyGame(rel) {
  const src = path.join(gameDir, rel);
  if (fs.statSync(src).isDirectory()) {
    if (fs.existsSync(path.join(src, '.noship'))) return;
    for (const f of fs.readdirSync(src)) copyGame(rel ? rel + '/' + f : f);
    return;
  }
  if (skip(rel) || rel.endsWith('.noship')) return;
  fs.mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true });
  fs.copyFileSync(src, path.join(dist, rel));
  gameFiles++;
  if (!rel.startsWith('later/')) gameInitial += fs.statSync(src).size;
}
if (fs.existsSync(gameDir)) copyGame('');
fs.mkdirSync(path.join(dist, 'vendor'), { recursive: true });
fs.copyFileSync(path.join(root, 'public', 'vendor', 'three.webgpu.min.js'), path.join(dist, 'vendor', 'three.webgpu.min.js'));
fs.copyFileSync(path.join(root, 'public', 'vendor', 'three.LICENSE'), path.join(dist, 'vendor', 'three.LICENSE'));
gameInitial += fs.statSync(path.join(dist, 'vendor', 'three.webgpu.min.js')).size;

/* The music, from the repository, read only. */
const musicDir = path.join(root, '..', 'music');
let music = 0, tracks = 0;
if (fs.existsSync(musicDir)) for (const f of fs.readdirSync(musicDir)) { if (!/\.(mp3|m4a|ogg)$/i.test(f)) continue; fs.copyFileSync(path.join(musicDir, f), path.join(gb, 'music', f)); music += fs.statSync(path.join(musicDir, f)).size; tracks++; }

/* The status page. */
let stamp = null, report = '';
try { stamp = JSON.parse(fs.readFileSync(path.join(root, 'parity', 'stamp.json'), 'utf8')); } catch (e) {}
try { report = fs.readFileSync(path.join(root, 'parity', 'REPORT.md'), 'utf8'); } catch (e) {}
let html = fs.readFileSync(path.join(root, 'tools', 'status.template.html'), 'utf8');
html = html.replace('<!--PARITY-->', stamp
  ? `<p class="${stamp.pass ? 'ok' : 'bad'}">Parity ${stamp.pass ? 'PASS' : 'FAIL'}, stamped ${esc(stamp.when)} against Drift_Fever ${esc(stamp.commit.slice(0, 7))}.</p><p>Initial download ${(initial / 1048576).toFixed(2)} MB over ${initialFiles.length} files; music ${(music / 1048576).toFixed(1)} MB over ${tracks} tracks, after the first playable frame.</p><pre>${esc(report)}</pre>`
  : '<p class="bad">No parity stamp.</p>');
fs.writeFileSync(path.join(dist, 'status', 'index.html'), html);

const total = fs.readdirSync(dist, { recursive: true }).map(f => path.join(dist, f)).filter(f => fs.statSync(f).isFile());
const totalBytes = total.reduce((s, f) => s + fs.statSync(f).size, 0);
console.log('dist/ assembled: ' + total.length + ' files, ' + (totalBytes / 1048576).toFixed(2) + ' MB in all');
console.log('new game: ' + gameFiles + ' files, initial download ' + (gameInitial / 1048576).toFixed(2) + ' MB including three.js');
console.log('greybox initial download: ' + (initial / 1048576).toFixed(2) + ' MB (' + initial + ' bytes) over ' + initialFiles.length + ' files: ' + initialFiles.map(f => f + ' ' + fs.statSync(path.join(gb, f)).size).join(', '));
console.log('music: ' + (music / 1048576).toFixed(2) + ' MB over ' + tracks + ' tracks, loaded after the first playable frame');
const LIMIT = 20 * 1048576;
if (initial > LIMIT || gameInitial > LIMIT) { console.error('BUILD FAILED: an initial download is over 20MB'); process.exit(1); }
if (totalBytes > 250 * 1048576 || total.length > 1500) { console.error('BUILD FAILED: over 250MB or 1,500 files in all'); process.exit(1); }
