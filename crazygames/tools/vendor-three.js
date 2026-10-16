/* VENDOR THREE.JS. One file, built from the exact version package.json
   pins, minified, into public/vendor/, so the page imports it locally and
   makes no request anywhere else. Re-run after changing the pin. Records
   the version beside it for ASSETS.md and the build to check. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'three', 'package.json'), 'utf8'));
const pinned = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).devDependencies.three;
if (pinned !== pkg.version) throw new Error('package.json pins three ' + pinned + ' but node_modules has ' + pkg.version + ': run npm ci');
const outDir = path.join(root, 'public', 'vendor');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'three.webgpu.min.js');
buildSync({ entryPoints: [path.join(root, 'node_modules', 'three', 'build', 'three.webgpu.js')], bundle: true, format: 'esm', minify: true, outfile: out, logLevel: 'error', legalComments: 'none' });
const banner = '/* three.js ' + pkg.version + ', MIT licence, https://github.com/mrdoob/three.js. Built by tools/vendor-three.js from the npm package; do not edit. */\n';
fs.writeFileSync(out, banner + fs.readFileSync(out, 'utf8'));
fs.writeFileSync(path.join(outDir, 'THREE_VERSION'), pkg.version + '\n');
fs.copyFileSync(path.join(root, 'node_modules', 'three', 'LICENSE'), path.join(outDir, 'three.LICENSE'));
console.log('wrote public/vendor/three.webgpu.min.js, three ' + pkg.version + ', ' + fs.statSync(out).size + ' bytes');
