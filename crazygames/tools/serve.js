/* THE DEV SERVER. Serves the greybox page as the Worker would serve dist/,
   straight from the sources: public/ at the root, the simulation module
   under /sim/, the music under /music/ from the repository's own folder,
   read only. The parity test and the probes open the page through this;
   `node tools/serve.js` runs it by hand for a browser. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/plain' };

export function resolvePublic(url) {
  const u = decodeURIComponent(url.split('?')[0]);
  if (u === '/' || u === '/index.html') return path.join(root, 'public', 'index.html');
  if (u.startsWith('/sim/')) return path.join(root, 'sim', u.slice(5));
  if (u.startsWith('/music/')) return path.join(root, '..', 'music', u.slice(7));
  if (u.startsWith('/status/')) return null;
  const p = path.normalize(path.join(root, 'public', u));
  if (!p.startsWith(path.join(root, 'public'))) return null;
  return p;
}

export function handler(extra) {
  return (req, res) => {
    const u = req.url.split('?')[0];
    if (extra && extra[u]) { const [body, type] = extra[u]; res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof body === 'function' ? body() : body); return; }
    const p = resolvePublic(req.url);
    if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(p));
  };
}

export async function servePublic(extra) {
  const server = http.createServer(handler(extra));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, url: 'http://127.0.0.1:' + server.address().port + '/' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = +(process.argv[2] || 8787);
  http.createServer(handler()).listen(port, '127.0.0.1', () => console.log('greybox at http://127.0.0.1:' + port + '/'));
}
