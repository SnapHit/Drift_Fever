/* THE SEVEN CONTENT PAGES, BUILT FROM content/.

   Run: node build-pages.js

   content/ is the source of record. The writer's markdown is not
   rewritten, reworded or moved, and this exists so a built page can be
   diffed against what was written by rebuilding it rather than by
   reading two files side by side.

   THIS IS NOT A BUILD STEP FOR THE GAME. index.html is untouched by
   this script and by everything in it. BRIEF.md section 12's no build
   step rule is about the game file, which is still one self contained
   HTML file that fetches nothing but itself. These are pages ABOUT the
   game, they are committed as plain HTML, and the site serves them
   without running anything.

   The markdown in these seven files uses exactly six constructs:
   headings, paragraphs, bold, links, pipe tables and horizontal rules.
   No lists, no code blocks, no block quotes, no images. The converter
   handles those six and throws on anything it does not recognise
   rather than silently dropping it, because a page that quietly loses a
   paragraph is worse than a build that stops. */

var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var SITE = 'https://driftfever.com';
var OG_IMAGE = SITE + '/og-card.png';
var EMBED = /\[\[\s*GAME EMBED GOES HERE.*?\]\]/;

/* ------------------------------------------------------------------
   The cabinet's markup, in one place, so all seven pages carry the same
   thing and there is one place to change it.
   ------------------------------------------------------------------ */
function cabinet() {
  return [
    '<article class="cab">',
    '  <div class="cab-marquee">SNAPHIT</div>',
    '  <div class="cab-aperture">',
    '    <div class="cab-phone">',
    '      <span class="cab-vol"></span><span class="cab-vol two"></span>',
    '      <span class="cab-pwr"></span>',
    '      <div class="cab-screen">',
    '        <div class="cab-attract">',
    '          <p class="cab-name">DRIFT FEVER</p>',
    '          <button type="button" class="cab-play">TAP TO PLAY</button>',
    '          <p class="cab-sub">free, no sign up, nothing to install</p>',
    '        </div>',
    '      </div>',
    '      <button type="button" class="cab-grow" aria-pressed="false">PLAY BIGGER</button>',
    '    </div>',
    '  </div>',
    /* The control deck. Inline SVG: no request, scales to any width,
       and it is what makes the thing read as a cabinet rather than as a
       bordered iframe. Decorative, so it is hidden from assistive
       technology rather than described. */
    '  <svg class="cab-deck" viewBox="0 0 240 54" aria-hidden="true" focusable="false">',
    '    <rect x="0" y="0" width="240" height="54" rx="10" fill="#1d110a"/>',
    '    <rect x="0" y="0" width="240" height="54" rx="10" fill="none" stroke="#3a2416"/>',
    '    <ellipse cx="52" cy="40" rx="20" ry="7" fill="#0a0603"/>',
    '    <rect x="49" y="16" width="6" height="22" rx="3" fill="#5a3a1d"/>',
    '    <circle cx="52" cy="15" r="10" fill="#ff9a3c"/>',
    '    <circle cx="49" cy="12" r="3.2" fill="#ffd9a8" opacity="0.7"/>',
    '    <circle cx="140" cy="20" r="11" fill="#ffc266"/>',
    '    <circle cx="140" cy="20" r="7.5" fill="#e08a1e"/>',
    '    <circle cx="172" cy="20" r="11" fill="#4fd6e6"/>',
    '    <circle cx="172" cy="20" r="7.5" fill="#22a6b8"/>',
    '    <circle cx="156" cy="41" r="11" fill="#ff6b8a"/>',
    '    <circle cx="156" cy="41" r="7.5" fill="#d33f60"/>',
    '    <circle cx="204" cy="30" r="11" fill="#9ee27a"/>',
    '    <circle cx="204" cy="30" r="7.5" fill="#5fae3f"/>',
    '  </svg>',
    '  <div class="cab-coin"></div>',
    /* THE LINK BENEATH, AND IT IS KEPT RATHER THAN DROPPED. On snap-hit
       it points at the game's own site; here that would be this page's
       own domain, so it points at the game at the root and opens in a
       new tab, which leaves the page the reader arrived on intact.
       It stays because it is the ONLY route to the game without
       JavaScript: the attract panel is a button that a script turns
       into an iframe, and with scripts off it does nothing at all. */
    '  <p class="cab-under"><a class="cab-noscript" href="/" target="_blank" rel="noopener">Open Drift Fever in its own tab</a></p>',
    '</article>'
  ].join('\n');
}

/* ------------------------------------------------------------------
   Markdown, the six constructs these files actually use.
   ------------------------------------------------------------------ */
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function attr(s) {
  return esc(s).replace(/"/g, '&quot;');
}

/* Inline: bold, links, backtick code. Escaped FIRST, so any stray angle
   bracket in the copy is text rather than markup, and the tags this
   emits are added afterwards. */
function inline(s) {
  var out = esc(s);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, href) {
    /* EVERY OUTBOUND LINK GETS target and rel. Internal links, which
       are the hub and spoke the writer placed inside the paragraphs,
       stay in the same tab: sending a reader to another page of this
       site in a new tab would be rude and would break the back button
       as a way home. */
    var external = /^https?:\/\//i.test(href);
    return '<a href="' + attr(href) + '"'
         + (external ? ' target="_blank" rel="noopener"' : '') + '>'
         + text + '</a>';
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function tableRow(line) {
  var cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.map(function (c) { return c.trim(); });
}

function convert(md, slug) {
  var lines = md.split('\n');
  var html = [];
  var i = 0;
  var sawH1 = false;
  var sawEmbed = false;

  while (i < lines.length) {
    var line = lines[i];

    if (!line.trim()) { i++; continue; }

    // The game embed placeholder.
    if (EMBED.test(line)) {
      html.push(cabinet());
      sawEmbed = true;
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) { html.push('<hr>'); i++; continue; }

    var h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      var level = h[1].length;
      if (level === 1) {
        if (sawH1) throw new Error(slug + ': a second H1, "' + h[2] + '"');
        sawH1 = true;
      }
      html.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>');
      i++;
      continue;
    }

    // A pipe table: a header row, a divider row, then body rows.
    if (line.trim().charAt(0) === '|' && i + 1 < lines.length
        && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      var head = tableRow(line);
      i += 2;
      var body = [];
      while (i < lines.length && lines[i].trim().charAt(0) === '|') {
        body.push(tableRow(lines[i]));
        i++;
      }
      var t = ['<div class="tw"><table>', '<thead><tr>'];
      head.forEach(function (c) { t.push('<th>' + inline(c) + '</th>'); });
      t.push('</tr></thead><tbody>');
      body.forEach(function (row) {
        t.push('<tr>');
        row.forEach(function (c) { t.push('<td>' + inline(c) + '</td>'); });
        t.push('</tr>');
      });
      t.push('</tbody></table></div>');
      html.push(t.join('\n'));
      continue;
    }

    /* A paragraph, which is every remaining line. Consecutive non blank
       lines join, because the writer wraps some paragraphs. */
    var para = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s/.test(lines[i])
           && lines[i].trim().charAt(0) !== '|' && !/^---+\s*$/.test(lines[i])
           && !EMBED.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    html.push('<p>' + inline(para.join(' ')) + '</p>');
  }

  if (!sawH1) throw new Error(slug + ': no H1');
  if (!sawEmbed) throw new Error(slug + ': no game embed placeholder');
  return html.join('\n');
}

/* ------------------------------------------------------------------
   The page shell.
   ------------------------------------------------------------------ */
function page(meta, body) {
  var url = SITE + meta.slug;
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<title>' + esc(meta.title) + '</title>',
    '<meta name="description" content="' + attr(meta.description) + '">',
    '<link rel="canonical" href="' + attr(url) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Drift Fever">',
    '<meta property="og:url" content="' + attr(url) + '">',
    '<meta property="og:title" content="' + attr(meta.title) + '">',
    '<meta property="og:description" content="' + attr(meta.description) + '">',
    '<meta property="og:image" content="' + attr(OG_IMAGE) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + attr(meta.title) + '">',
    '<meta name="twitter:description" content="' + attr(meta.description) + '">',
    '<meta name="twitter:image" content="' + attr(OG_IMAGE) + '">',
    '<link rel="icon" href="/apple-touch-icon-180.png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">',
    '<link rel="stylesheet" href="/cabinet.css">',
    '</head>',
    '<body>',
    '<main>',
    body,
    '</main>',
    '<script src="/cabinet.js"></script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

/* ------------------------------------------------------------------ */
function build() {
  var dir = path.join(ROOT, 'content');
  var files = fs.readdirSync(dir).filter(function (f) {
    return /^[1-7]-.*\.md$/.test(f);
  }).sort();

  var built = [];
  files.forEach(function (f) {
    var raw = fs.readFileSync(path.join(dir, f), 'utf8');
    var title = raw.match(/^\*\*Title tag:\*\*\s*(.+)$/m);
    var desc = raw.match(/^\*\*Meta description:\*\*\s*(.+)$/m);
    var slug = raw.match(/^\*\*URL slug:\*\*\s*`([^`]+)`/m);
    if (!title || !desc || !slug) throw new Error(f + ': missing title, description or slug');

    /* THE FRONT MATTER IS NOT PAGE CONTENT and the writer labelled it
       so. Everything up to and including the first horizontal rule is
       the header block; the page starts after it. */
    var cut = raw.indexOf('\n---');
    if (cut < 0) throw new Error(f + ': no rule after the header block');
    var body = raw.slice(raw.indexOf('\n', cut + 1) + 1);

    var meta = { title: title[1].trim(), description: desc[1].trim(),
                 slug: slug[1].trim() };

    /* THE ONE RULE ABOUT PATHS. Content filters keyword match URLs and
       this audience is behind those filters, so the word goes in the
       title, the headings and the body and never in a path. Checked
       here rather than trusted, because it is the single change that
       would quietly cost the whole exercise. */
    if (/unblocked/i.test(meta.slug)) {
      throw new Error(f + ': the slug contains the word that may not be in a path');
    }

    var out = page(meta, convert(body, meta.slug));
    /* AS slug/index.html, NOT slug.html. The slugs the writer chose are
       extensionless and the copy's own internal links use them that way,
       and a static host does not serve /car-games-online from a file
       called car-games-online.html: it serves it from a directory with
       an index in it. Written as slug.html the canonical URL on every
       page would have been a 404 and every internal link with it. */
    var outDir = path.join(ROOT, meta.slug.replace(/^\//, ''));
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    var file = meta.slug.replace(/^\//, '') + '/index.html';
    fs.writeFileSync(path.join(outDir, 'index.html'), out);
    built.push({ file: file, slug: meta.slug, bytes: Buffer.byteLength(out),
                 title: meta.title });
  });

  built.forEach(function (b) {
    console.log(String(b.bytes).padStart(7) + '  ' + b.file.padEnd(34) + b.title);
  });
  console.log(built.length + ' pages built');
}

build();
