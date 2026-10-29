/* THE DEV SERVER FOR THE NEW GAME. Serves game/ at the root exactly as
   the build lays it out in dist/, with three.js at /vendor/ from the
   pinned copy in public/vendor/. The probes open the page through this;
   `node game/test/feel/serve.js [port]` runs it for a browser. Nothing
   under test/ is served. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..', '..', '..');       // crazygames/
const gameDir = path.join(root, 'game');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/plain' };

export function resolveGame(url) {
  const u = decodeURIComponent(url.split('?')[0]);
  if (u === '/' || u === '/index.html') return path.join(gameDir, 'index.html');
  if (u.startsWith('/vendor/')) return path.join(root, 'public', 'vendor', u.slice(8));
  if (/^\/(test|tests)\//.test(u)) return null;
  const p = path.normalize(path.join(gameDir, u));
  if (!p.startsWith(gameDir)) return null;
  return p;
}

export function handler() {
  return (req, res) => {
    const p = resolveGame(req.url);
    if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(p));
  };
}

export async function serveGame() {
  const server = http.createServer(handler());
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, url: 'http://127.0.0.1:' + server.address().port + '/' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = +(process.argv[2] || 8788);
  http.createServer(handler()).listen(port, '127.0.0.1', () => console.log('the game at http://127.0.0.1:' + port + '/'));
}
