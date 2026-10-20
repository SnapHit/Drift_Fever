/* Assemble dist/, the web root the Worker serves.

   /            the game: the shipped page from public/, the simulation
                module under sim/, three.js under vendor/
   /music/      the four tracks, copied read only from the repository's
                music/ folder; loaded after the first playable frame
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
fs.mkdirSync(path.join(dist, 'status'), { recursive: true });
fs.mkdirSync(path.join(dist, 'sim'), { recursive: true });
fs.mkdirSync(path.join(dist, 'vendor'), { recursive: true });
fs.mkdirSync(path.join(dist, 'music'), { recursive: true });
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* The game. The initial download is exactly this list. */
const INITIAL = ['index.html', 'chrome.css', 'game.js', 'chrome.js', 'world.js', 'vendor/three.webgpu.min.js'];
for (const f of INITIAL) fs.copyFileSync(path.join(root, 'public', f), path.join(dist, f));
fs.copyFileSync(path.join(root, 'sim', 'drift-fever-sim.js'), path.join(dist, 'sim', 'drift-fever-sim.js'));
fs.copyFileSync(path.join(root, 'public', 'vendor', 'three.LICENSE'), path.join(dist, 'vendor', 'three.LICENSE'));
const initialFiles = [...INITIAL, 'sim/drift-fever-sim.js'];
let initial = 0;
for (const f of initialFiles) initial += fs.statSync(path.join(dist, f)).size;

/* The music, from the repository, read only. */
const musicDir = path.join(root, '..', 'music');
let music = 0, tracks = 0;
if (fs.existsSync(musicDir)) for (const f of fs.readdirSync(musicDir)) { if (!/\.(mp3|m4a|ogg)$/i.test(f)) continue; fs.copyFileSync(path.join(musicDir, f), path.join(dist, 'music', f)); music += fs.statSync(path.join(musicDir, f)).size; tracks++; }

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
console.log('initial download: ' + (initial / 1048576).toFixed(2) + ' MB (' + initial + ' bytes) over ' + initialFiles.length + ' files: ' + initialFiles.map(f => f + ' ' + fs.statSync(path.join(dist, f)).size).join(', '));
console.log('music: ' + (music / 1048576).toFixed(2) + ' MB over ' + tracks + ' tracks, loaded after the first playable frame');
const LIMIT = 20 * 1048576;
if (initial > LIMIT) { console.error('BUILD FAILED: the initial download is over 20MB'); process.exit(1); }
if (totalBytes > 250 * 1048576 || total.length > 1500) { console.error('BUILD FAILED: over 250MB or 1,500 files in all'); process.exit(1); }
