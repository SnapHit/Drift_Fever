/* ASSEMBLE site/, THE WEB ROOT driftfever.com SERVES.

   Since 15 November 2026 the game at driftfever.com/ is the 3D game
   built in crazygames/ (the author's decision), and the original one
   file game lives on at /classic/. wrangler.jsonc runs this before every
   deploy (its build command) and points the assets directory at site/.

   /               the 3D game: crazygames/dist/ as its own build makes it
                   (crazygames/tools/build-site.js), without its greybox, status and lab
                   pages. One change, to index.html: the preview's
                   noindex line becomes the canonical and share tags.
   /classic/       index.html at the repository root, the original game.
                   Three changes, all in the head: a base tag, so every
                   relative address in it (the music, the touch icon, the
                   links to the pages) still resolves at the root, and
                   the canonical and og:url say /classic/. CLASSIC_DELTA
                   is the bytes they add; publish-check.sh uses it.
   /music/         the four tracks, which both games play
   the rest        the seven content pages, their cabinet, the share
                   card, the touch icon, the sitemap and robots.txt

   THIS FILE IS THE ALLOWLIST NOW. Nothing reaches the web unless a line
   here copies it, which is the rule .assetsignore used to keep when the
   repository root was the web root. site/ is not committed.

   node build-site.js            builds crazygames/dist first, then site/
   node build-site.js --no-game  uses the crazygames/dist already there

   Nothing here fetches anything or needs a package installed. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = __dirname;
const cg = path.join(root, 'crazygames');
const dist = path.join(cg, 'dist');
const site = path.join(root, 'site');
const ORIGIN = 'https://driftfever.com';

const die = msg => { console.error('BUILD FAILED: ' + msg); process.exit(1); };

/* the 3D game's own build. Its parity check is not run here: that guards
   the greybox, which this site does not publish, and it needs packages
   installed, which this build must not. The preview's build and the
   parity workflow still run it on every push. */
if (!process.argv.includes('--no-game')) execFileSync(process.execPath, ['tools/build-site.js'], { cwd: cg, stdio: 'inherit' });
if (!fs.existsSync(path.join(dist, 'index.html'))) die('no crazygames/dist/index.html');

fs.rmSync(site, { recursive: true, force: true });
let files = 0, bytes = 0;
function copy(from, to) {
  if (!fs.existsSync(from)) die('missing ' + path.relative(root, from));
  if (fs.statSync(from).isDirectory()) { for (const f of fs.readdirSync(from)) copy(path.join(from, f), path.join(to, f)); return; }
  if (fs.existsSync(to)) die('two sources for /' + path.relative(site, to));
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  files++; bytes += fs.statSync(from).size;
}
function write(to, text) {
  if (fs.existsSync(to)) die('two sources for /' + path.relative(site, to));
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, text);
  files++; bytes += Buffer.byteLength(text);
}
/* replace exactly one occurrence, or stop: a tag that moved must not pass silently */
function swap(text, old, now, what) {
  if (text.split(old).length !== 2) die(what + ': expected exactly one "' + old + '"');
  return text.replace(old, now);
}

/* ---- the 3D game at the root ---- */
const LEAVE = ['greybox', 'status', 'lab', 'index.html', 'music'];
for (const f of fs.readdirSync(dist)) if (!LEAVE.includes(f)) copy(path.join(dist, f), path.join(site, f));
const SHARE = 'A real 3D drift game in your browser. Career, rivals, a garage and a stunt park. No downloads, nothing to install.';
const HEAD = [
  '<link rel="canonical" href="' + ORIGIN + '/">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">',
  '<meta name="apple-mobile-web-app-title" content="Drift Fever">',
  '<meta property="og:type" content="website">',
  '<meta property="og:url" content="' + ORIGIN + '/">',
  '<meta property="og:title" content="Drift Fever">',
  '<meta property="og:description" content="' + SHARE + '">',
  '<meta property="og:image" content="' + ORIGIN + '/og-card.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="Drift Fever">',
  '<meta name="twitter:description" content="' + SHARE + '">',
  '<meta name="twitter:image" content="' + ORIGIN + '/og-card.png">',
].join('\n');
let game = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
game = swap(game, '<meta name="robots" content="noindex">', HEAD, 'the 3D game');
write(path.join(site, 'index.html'), game);

/* ---- the original game at /classic/ ---- */
const BASE = '<base href="/">\n';
let classic = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const before = Buffer.byteLength(classic);
classic = swap(classic, '<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + BASE, 'the original game');
classic = swap(classic, '<link rel="canonical" href="' + ORIGIN + '/">', '<link rel="canonical" href="' + ORIGIN + '/classic/">', 'the original game');
classic = swap(classic, '<meta property="og:url" content="' + ORIGIN + '/">', '<meta property="og:url" content="' + ORIGIN + '/classic/">', 'the original game');
const CLASSIC_DELTA = 32;   // bytes the three changes add; publish-check.sh carries the same number
if (Buffer.byteLength(classic) - before !== CLASSIC_DELTA) die('the original game grew by ' + (Buffer.byteLength(classic) - before) + ' bytes, not ' + CLASSIC_DELTA);
write(path.join(site, 'classic', 'index.html'), classic);

/* ---- the rest of the site ---- */
for (const f of ['cabinet.js', 'cabinet.css', 'og-card.png', 'apple-touch-icon-180.png', 'sitemap.xml', 'robots.txt', 'music',
  'car-games-online', 'where-to-play-drift-hunters', 'browser-games-official-sites', 'drift-boss-one-button-games',
  'racing-games-online', 'drift-games-online', 'driving-games-online']) copy(path.join(root, f), path.join(site, f));

console.log('site/ assembled: ' + files + ' files, ' + (bytes / 1048576).toFixed(2) + ' MB: the 3D game at /, the original at /classic/');
