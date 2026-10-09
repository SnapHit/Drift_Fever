/* VENDOR THE SIMULATION.

   Reads the pinned Drift_Fever index.html under vendor/original, finds the
   game script, and slices out the simulation as the closure of a set of
   roots over the top level declaration graph, stopping at a cut set the
   renderer owns. Everything is mechanical and repeatable: re-vendoring is
   "replace vendor/original/index.html, update COMMIT, run this".

   The output is sim/drift-fever-sim.js, a factory that takes a hooks object
   and returns the simulation, plus sim/VENDOR.json describing exactly what
   was taken, what was cut, and what was replaced. Nothing in sim/ is edited
   by hand. The cut set and the few replacement bodies live in
   tools/vendor.config.js and are the only thing a human maintains.

   Usage:  node tools/vendor.js            emit the module
           node tools/vendor.js --report   list the closure and its boundary */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import config from './vendor.config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const srcPath = path.join(root, 'vendor', 'original', 'index.html');
const commit = fs.readFileSync(path.join(root, 'vendor', 'original', 'COMMIT'), 'utf8').trim();
const html = fs.readFileSync(srcPath, 'utf8');

/* The game script is the largest <script> in the file. */
const scripts = [];
const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) scripts.push({ src: m[1], at: m.index + m[0].indexOf(m[1]) });
const main = scripts.reduce((a, b) => (b.src.length > a.src.length ? b : a));
const lineOf = off => html.slice(0, main.at + off).split('\n').length;
const ast = acorn.parse(main.src, { ecmaVersion: 2022, sourceType: 'script', locations: true });

/* ---- the declaration index ------------------------------------------ */
const decls = [];
const byName = new Map();
const stmts = [];
function addDecl(name, kind, stmt) {
  const d = { name, kind, start: stmt.start, end: stmt.end, line: lineOf(stmt.start), endLine: lineOf(stmt.end),
              refs: new Set(), free: new Set(), writes: new Set(), stmt };
  byName.set(name, d); decls.push(d); return d;
}
for (const stmt of ast.body) {
  if (stmt.type === 'FunctionDeclaration') { addDecl(stmt.id.name, 'function', stmt); stmts.push({ stmt, names: [stmt.id.name] }); }
  else if (stmt.type === 'ClassDeclaration') { addDecl(stmt.id.name, 'class', stmt); stmts.push({ stmt, names: [stmt.id.name] }); }
  else if (stmt.type === 'VariableDeclaration') {
    const ns = [];
    for (const d of stmt.declarations) {
      if (d.id.type === 'Identifier') ns.push(d.id.name);
      else walk.simple(d.id, { Identifier(n) { ns.push(n.name); } });
    }
    for (const n of ns) addDecl(n, stmt.kind, stmt);
    stmts.push({ stmt, names: ns });
  } else {
    const d = addDecl('<stmt@' + lineOf(stmt.start) + '>', 'statement', stmt);
    d.label = main.src.slice(stmt.start, Math.min(stmt.end, stmt.start + 70)).replace(/\s+/g, ' ');
    stmts.push({ stmt, names: [d.name] });
  }
}
const memberAware = { ...walk.base,
  MemberExpression(n, st, c) { c(n.object, st, 'Expression'); if (n.computed) c(n.property, st, 'Expression'); },
  Property(n, st, c) { if (n.computed) c(n.key, st, 'Expression'); c(n.value, st, 'Expression'); },
  MethodDefinition(n, st, c) { if (n.computed) c(n.key, st, 'Expression'); c(n.value, st, 'Expression'); },
  PropertyDefinition(n, st, c) { if (n.computed) c(n.key, st, 'Expression'); if (n.value) c(n.value, st, 'Expression'); } };
for (const { stmt, names: owners } of stmts) {
  const local = new Set();
  walk.full(stmt, n => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') local.add(n.id.name);
    if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
      for (const p of n.params) walk.simple(p, { Identifier(q) { local.add(q.name); } });
      if (n.id) local.add(n.id.name);
    }
    if (n.type === 'CatchClause' && n.param) walk.simple(n.param, { Identifier(q) { local.add(q.name); } });
  });
  const refs = new Set(), free = new Set(), writes = new Set();
  walk.full(stmt, n => {
    let t = null;
    if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') t = n.left.name;
    if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier') t = n.argument.name;
    if (t && byName.has(t) && !local.has(t)) writes.add(t);
  });
  walk.full(stmt, n => {
    if (n.type !== 'Identifier') return;
    if (!byName.has(n.name)) { if (!local.has(n.name)) free.add(n.name); return; }
    if (owners.includes(n.name)) return;
    if (local.has(n.name)) return;
    refs.add(n.name);
  }, memberAware);
  for (const o of owners) { const d = byName.get(o); for (const r of refs) d.refs.add(r); for (const f of free) d.free.add(f); for (const w of writes) d.writes.add(w); }
}

/* ---- the closure ----------------------------------------------------- */
const cut = new Map(Object.entries(config.cut));
const replace = new Map(Object.entries(config.replace));
const boundary = new Set([...cut.keys(), ...replace.keys()]);
for (const n of boundary) if (!byName.has(n)) throw new Error('vendor.config names ' + n + ' which is not a top level declaration');
const seen = new Set(), order = [], via = new Map();
const extraAst = acorn.parse(config.extra, { ecmaVersion: 2022, sourceType: 'script' });
const extraNames = new Set();
walk.full(extraAst, x => { if (x.type === 'Identifier' && byName.has(x.name)) extraNames.add(x.name); }, memberAware);
const q = [...config.roots, ...[...extraNames].filter(n => !config.roots.includes(n))];
for (const r of q) { if (!byName.has(r)) throw new Error('root ' + r + ' is not a top level declaration'); via.set(r, '<root>'); }
while (q.length) {
  const n = q.shift();
  if (seen.has(n)) continue;
  seen.add(n); order.push(n);
  if (cut.has(n)) continue;                 // a cut symbol is a stub: its own references do not count
  const d = byName.get(n);
  const refs = replace.has(n) ? replacementRefs(n) : d.refs;
  for (const r of refs) if (!seen.has(r)) { if (!via.has(r)) via.set(r, n); q.push(r); }
}
function replacementRefs(n) {
  // a replacement body may reference other top level names; parse it to find them
  const src = replace.get(n).src;
  const a = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
  const out = new Set();
  walk.full(a, x => { if (x.type === 'Identifier' && byName.has(x.name) && x.name !== n) out.add(x.name); }, memberAware);
  return out;
}
const inClosure = new Set(order);

/* Load time statements come along when everything they touch is inside the
   closure and nothing they touch is a browser global or a cut symbol. The
   boot statement is excluded by this rule on purpose: its simulation half
   is reproduced by boot() in the config. */
const BROWSER = new Set(config.browserGlobals);
const taken = [], left = [];
for (const d of decls) {
  if (d.kind !== 'statement') continue;
  const touches = [...d.refs];
  const bad = d.free.size ? [...d.free].filter(f => BROWSER.has(f)) : [];
  const outside = touches.filter(r => !inClosure.has(r));
  const domHandle = touches.filter(r => cut.has(r) && cut.get(r).as === 'value');
  const simWork = touches.some(r => inClosure.has(r) && !cut.has(r));
  const excluded = (config.excludeStatements || []).includes(d.line);
  if (touches.length && !bad.length && !outside.length && !domHandle.length && simWork && !excluded) taken.push(d);
  else if (domHandle.length && !outside.length) left.push({ d, bad: ['DOM handle: ' + domHandle.join(',')], outside });
  else if (excluded) left.push({ d, bad: ['excluded by config'], outside });
  else if (touches.some(r => inClosure.has(r))) left.push({ d, bad, outside });
}

/* ---- the report ------------------------------------------------------ */
const SUSPECT = config.suspectPattern ? new RegExp(config.suspectPattern) : null;
if (process.argv.includes('--report')) {
  let bytes = 0;
  for (const n of order) if (!boundary.has(n)) bytes += byName.get(n).end - byName.get(n).start;
  console.log('closure: ' + order.length + ' declarations, ' + bytes + ' bytes taken, ' + [...order].filter(n => cut.has(n)).length + ' cut, ' + [...order].filter(n => replace.has(n)).length + ' replaced');
  console.log('\n--- browser globals still reachable (must be empty):');
  for (const n of order) { if (boundary.has(n)) continue; const bad = [...byName.get(n).free].filter(f => BROWSER.has(f)); if (bad.length) console.log('  ' + n + ' L' + byName.get(n).line + ': ' + bad.join(',') + '  via ' + via.get(n)); }
  console.log('\n--- taken declarations referencing suspect names:');
  for (const n of order) { if (boundary.has(n)) continue; const d = byName.get(n); const hit = [...d.refs].filter(r => SUSPECT && SUSPECT.test(r) && !boundary.has(r)); if (hit.length) console.log('  ' + n.padEnd(26) + 'L' + d.line + '  ' + hit.join(',') + '   via ' + via.get(n)); }
  console.log('\n--- cut symbols reached, with the first path to each:');
  for (const n of order) if (cut.has(n)) console.log('  ' + n.padEnd(26) + 'L' + byName.get(n).line + '  via ' + via.get(n) + '   [' + cut.get(n).reason + ']');
  console.log('\n--- replaced symbols reached:');
  for (const n of order) if (replace.has(n)) console.log('  ' + n.padEnd(26) + 'L' + byName.get(n).line + '  via ' + via.get(n) + '   [' + replace.get(n).reason + ']');
  console.log('\n--- cut/replace names in the config that nothing reaches:');
  for (const n of boundary) if (!inClosure.has(n)) console.log('  ' + n);
  console.log('\n--- load time statements taken:');
  for (const d of taken) console.log('  L' + d.line + '  ' + d.label);
  console.log('\n--- load time statements touching the closure but left behind:');
  for (const { d, bad, outside } of left) console.log('  L' + d.line + '  ' + d.label + '   browser:' + bad.join(',') + ' outside:' + outside.join(','));
  if (process.argv.includes('--list')) { console.log('\n--- everything taken:'); for (const n of order) if (!boundary.has(n)) { const d = byName.get(n); console.log('  ' + d.kind.padEnd(9) + n.padEnd(28) + 'L' + d.line + '  via ' + via.get(n)); } }
  process.exit(0);
}

/* ---- emit ------------------------------------------------------------ */
function rewrite(src) {
  for (const [from, to] of config.rewrites) src = src.replace(new RegExp(from, 'g'), to);
  return src;
}
const pieces = [];
const emitted = new Set();
const manifest = { commit, source: 'vendor/original/index.html', scriptStartLine: lineOf(0), roots: config.roots,
                   taken: [], cut: [], replaced: [], statements: [], rewrites: config.rewrites };
// source order, so const/let initialisation order is the original's
const inOrder = decls.filter(d => (inClosure.has(d.name) && !boundary.has(d.name)) || taken.includes(d));
inOrder.sort((a, b) => a.start - b.start);
for (const d of inOrder) {
  const key = d.start + ':' + d.end;
  if (emitted.has(key)) continue;         // one VariableDeclaration can declare several names
  emitted.add(key);
  const owners = decls.filter(x => x.start === d.start && x.end === d.end).map(x => x.name);
  const dropped = owners.filter(n => !inClosure.has(n) && d.kind !== 'statement');
  if (dropped.length && d.kind !== 'statement') {
    // a declaration list where only some names are in the closure: take it whole, note it
    for (const n of dropped) if (!inClosure.has(n)) { inClosure.add(n); via.set(n, '<shares a declaration with ' + owners.find(o => inClosure.has(o) && !dropped.includes(o)) + '>'); }
  }
  const text = rewrite(main.src.slice(d.start, d.end));
  pieces.push('/* L' + d.line + ' */ ' + text);
  if (d.kind === 'statement') manifest.statements.push({ line: d.line, label: d.label });
  else for (const n of owners) manifest.taken.push({ name: n, kind: byName.get(n).kind, line: d.line, endLine: d.endLine, via: via.get(n) });
}
const stubs = [];
for (const n of order) {
  if (!cut.has(n)) continue;
  const c = cut.get(n), d = byName.get(n);
  manifest.cut.push({ name: n, kind: d.kind, line: d.line, via: via.get(n), reason: c.reason, as: c.as });
  if (c.as === 'hook') stubs.push('function ' + n + '(...a) { return H.' + n + ' ? H.' + n + '(...a) : undefined; }   // L' + d.line + ', ' + c.reason);
  else if (c.as === 'value') stubs.push('let ' + n + ' = ' + c.init + ';   // L' + d.line + ', ' + c.reason);
  else throw new Error('cut ' + n + ' has no "as"');
}
const replaced = [];
for (const n of order) {
  if (!replace.has(n)) continue;
  const r = replace.get(n), d = byName.get(n);
  manifest.replaced.push({ name: n, kind: d.kind, line: d.line, endLine: d.endLine, via: via.get(n), reason: r.reason });
  replaced.push('/* L' + d.line + ' REPLACED: ' + r.reason + ' */\n' + r.src.trim());
}
const vars = [], fns = [];
for (const d of inOrder) {
  if (d.kind === 'statement') continue;
  for (const o of decls.filter(x => x.start === d.start && x.end === d.end)) {
    if (o.kind === 'function' || o.kind === 'class') fns.push(o.name);
    else vars.push(o);
  }
}
for (const n of order) if (cut.has(n)) { const c = cut.get(n); if (c.as === 'hook') fns.push(n); else vars.push({ name: n, kind: 'let' }); }
for (const n of order) if (replace.has(n)) { const d = byName.get(n); if (d.kind === 'function') fns.push(n); else vars.push({ name: n, kind: d.kind }); }
for (const st of extraAst.body) if (st.type === 'FunctionDeclaration') fns.push(st.id.name);
const accessors = vars.map(v => '  ' + JSON.stringify(v.name) + ': [() => ' + v.name + ', ' + (v.kind === 'const' ? 'null' : '(v) => { ' + v.name + ' = v; }') + ']');
const fnTable = fns.map(n => '  ' + JSON.stringify(n) + ': ' + n);

const out = `/* GENERATED by tools/vendor.js. DO NOT EDIT.
   Drift Fever simulation, vendored from SnapHit/Drift_Fever index.html at
   commit ${commit}. Gameplay changes happen in Drift_Fever and are
   re-vendored here; see CLAUDE.md. sim/VENDOR.json lists what was taken,
   what was cut at the renderer boundary and what was replaced.

   The factory takes a hooks object. Every hook is optional; a missing hook
   is a no-op, and the simulation runs with no memory, no clock, no audio
   and no screen. The hooks a host will want:
     now()                 a Date, for the local day stamp
     random()              a 0..1 uniform, where the original used Math.random
     storeGet(k)/storeSet(k, v)   persistent memory, prefixed keys
     applyBiome(i)         the biome index changed
     and one per cut symbol, named after it, for effects. */
export function createSim(hooks) {
  'use strict';
  const H = Object.assign({}, hooks || {});
  const __store = new Map();
  if (!H.storeGet) H.storeGet = k => (__store.has(k) ? __store.get(k) : null);
  if (!H.storeSet) H.storeSet = (k, v) => { __store.set(k, String(v)); };
  if (!H.now) H.now = () => new Date();
  if (!H.random) H.random = () => Math.random();

  /* ---- the renderer boundary: stubs for cut symbols ---- */
${stubs.map(s => '  ' + s).join('\n')}

  /* ---- replaced bodies ---- */
${replaced.map(s => s.split('\n').map(l => '  ' + l).join('\n')).join('\n\n')}

  /* ---- the simulation, in source order ---- */
${pieces.map(s => s.split('\n').map(l => '  ' + l).join('\n')).join('\n\n')}

  /* ---- extra, from the config ---- */
${config.extra.trim().split('\n').map(l => '  ' + l).join('\n')}

  /* ---- access ---- */
  const __vars = {
${accessors.join(',\n')}
  };
  const __fns = {
${fnTable.join(',\n')}
  };
  function get(name) { const a = __vars[name]; if (!a) throw new Error('no such state: ' + name); return a[0](); }
  function set(name, v) { const a = __vars[name]; if (!a) throw new Error('no such state: ' + name); if (!a[1]) throw new Error(name + ' is a constant'); a[1](v); }
  return { get, set, fn: __fns, hooks: H, names: Object.keys(__vars), commit: ${JSON.stringify(commit)} };
}
`;
fs.mkdirSync(path.join(root, 'sim'), { recursive: true });
fs.writeFileSync(path.join(root, 'sim', 'drift-fever-sim.js'), out);
manifest.bytes = out.length;
manifest.counts = { taken: manifest.taken.length, cut: manifest.cut.length, replaced: manifest.replaced.length, statements: manifest.statements.length };
fs.writeFileSync(path.join(root, 'sim', 'VENDOR.json'), JSON.stringify(manifest, null, 1));
console.log('wrote sim/drift-fever-sim.js (' + out.length + ' bytes): ' + manifest.counts.taken + ' declarations taken, ' + manifest.counts.cut + ' cut, ' + manifest.counts.replaced + ' replaced, ' + manifest.counts.statements + ' load time statements');
