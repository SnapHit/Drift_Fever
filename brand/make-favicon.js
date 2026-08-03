/* Regenerates the favicon href in index.html from icon-path-data.txt.
   Run with node from the repo root: node brand/make-favicon.js

   THE GAME NEVER RUNS THIS. It is a one off that writes a string into the
   head, and it exists so the tab icon cannot drift away from the path
   data the game draws. There is still no build step: index.html in the
   repo is the artefact and this only ever edits it in place.

   Fully URL encoded on purpose. An SVG data URI carries angle brackets,
   quotes and a hash in every colour, and a raw hash truncates an href at
   the fragment. Encoding everything outside the unreserved set removes
   the whole class of argument for the sake of a few hundred bytes. */
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/icon-path-data.txt', 'utf8');
const vb = src.match(/viewBox="([-\d. ]+)"/)[1].trim().split(/\s+/).map(Number);
const order = src.match(/Draw order:.*/)[0];
const off = order.match(/translate (\d+),(\d+)/);
const width = order.match(/width (\d+)/)[1];
const d = src.split('path d:')[1].trim();
if (/\n/.test(d)) throw new Error('the d string spans lines');

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '">' +
  '<g fill-rule="evenodd" stroke-linejoin="round" stroke-linecap="round"' +
  ' stroke-width="' + width + '">' +
  '<path transform="translate(' + off[1] + ' ' + off[2] + ')"' +
  ' fill="#a8300a" stroke="#a8300a" d="' + d + '"/>' +
  '<path fill="none" stroke="#ef5a17" d="' + d + '"/>' +
  '<path fill="#fbbf45" d="' + d + '"/>' +
  '</g></svg>';

const href = 'data:image/svg+xml,' + encodeURIComponent(svg)
  .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
if (/["#]/.test(href)) throw new Error('href is not safe inside an attribute');

const file = __dirname + '/../index.html';
const html = fs.readFileSync(file, 'utf8');
const line = /<link rel="icon" href="[^"]*">/;
if (!line.test(html)) throw new Error('no favicon link to replace');
fs.writeFileSync(file, html.replace(line, '<link rel="icon" href="' + href + '">'));
console.log('favicon written,', href.length, 'chars');
