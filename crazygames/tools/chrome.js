/* VENDOR THE CHROME.

   The simulation is one half of Drift_Fever's index.html and tools/vendor.js
   slices it out. This is the other half, minus the Canvas 2D world: the
   title screen, countdown, HUD, run card, share card, pause cover, tilt
   calibration and hint, the input handlers, the music and sound effects,
   the fullscreen and pad buttons, the boot splash and the frame function.
   Stage 2 wants all of it reproduced from the live game, text verbatim, on
   a transparent Canvas 2D layer above the 3D world, so it is sliced out the
   same way the simulation was rather than rewritten by hand.

   The output is public/chrome.js, a factory createChrome(SIM, WORLD, DOM)
   where SIM is a view of the simulation (every simulation variable as an
   accessor property, every simulation function as a method), WORLD is the
   3D renderer the cut world passes forward to, and DOM is the document.
   Every reference the chrome makes to a simulation name is rewritten to
   SIM.name, scope aware, so the original's own code reads and writes the
   vendored simulation through its access table. public/CHROME.json says
   what was taken, cut and replaced.

   Usage:  node tools/chrome.js            emit the module
           node tools/chrome.js --report   list the closure and its boundary */
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import config from './chrome.config.js';
import { root, commit, originalHtml } from './original.js';

const html = originalHtml();
const vendor = JSON.parse(fs.readFileSync(path.join(root, 'sim', 'VENDOR.json'), 'utf8'));
if (vendor.commit !== commit) throw new Error('sim/VENDOR.json is from ' + vendor.commit + ' but COMMIT says ' + commit + ': run npm run vendor first');

/* The game script is the largest <script> in the file. */
const scripts = [];
const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) scripts.push({ src: m[1], at: m.index + m[0].indexOf(m[1]) });
const main = scripts.reduce((a, b) => (b.src.length > a.src.length ? b : a));
const lineOf = off => html.slice(0, main.at + off).split('\n').length;
const ast = acorn.parse(main.src, { ecmaVersion: 2022, sourceType: 'script', locations: true });

/* ---- the declaration index, as vendor.js builds it ---------------- */
const decls = [];
const byName = new Map();
const stmts = [];
function addDecl(name, kind, stmt) {
  const d = { name, kind, start: stmt.start, end: stmt.end, line: lineOf(stmt.start), endLine: lineOf(stmt.end), refs: new Set(), free: new Set(), writes: new Set(), stmt };
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

/* ---- who owns what ------------------------------------------------ */
/* Simulation names: everything the simulation took, replaced, stubbed as
   a hook or appended, read off VENDOR.json so the two tools cannot
   disagree. The three stubbed VALUES (the pause button, the icons and
   the palette) are the chrome's: the real ones are declared here and the
   host hands them to the simulation through its setter. */
const cut = new Map(Object.entries(config.cut));
const replace = new Map(Object.entries(config.replace));
for (const n of [...cut.keys(), ...replace.keys()]) if (!byName.has(n)) throw new Error('chrome.config names ' + n + ' which is not a top level declaration');
const simOwned = new Set();
for (const t of vendor.taken) simOwned.add(t.name);
for (const t of vendor.replaced) simOwned.add(t.name);
for (const n of config.extraSimFunctions) simOwned.add(n);
const simValues = vendor.cut.filter(t => t.as === 'value').map(t => t.name);
const simStatementLines = new Set(vendor.statements.map(s => s.line));
/* The simulation's hooks. A hook the world owns (cut here as 'world') is
   reached through the simulation's stub, so a chrome reference to it is
   SIM.name like any other simulation name. A hook the chrome owns keeps
   its original body here, and the host wires the simulation's hook to it:
   the sound effects, the music, the tilt calibration, the share card. */
const chromeHooks = [];
for (const t of vendor.cut) {
  if (t.as !== 'hook') continue;
  if (cut.has(t.name)) { if (cut.get(t.name).as !== 'world') throw new Error('hook ' + t.name + ' is cut as ' + cut.get(t.name).as + '; a cut hook must be the world\'s'); simOwned.add(t.name); }
  else chromeHooks.push(t.name);
}
for (const n of cut.keys()) if (simOwned.has(n) && !vendor.cut.some(t => t.name === n)) throw new Error('chrome.config cuts ' + n + ', which the simulation owns');

/* ---- the closure ------------------------------------------------- */
const seen = new Set(), order = [], via = new Map();
function parseRefs(src) {
  const a = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
  const out = new Set();
  walk.full(a, x => { if (x.type === 'Identifier' && byName.has(x.name)) out.add(x.name); }, memberAware);
  return out;
}
const q = [];
for (const r of config.roots) { if (!byName.has(r)) throw new Error('root ' + r + ' is not a top level declaration'); via.set(r, '<root>'); q.push(r); }
for (const r of chromeHooks) { via.set(r, '<simulation hook>'); q.push(r); }
/* Every load time statement that is not the simulation's and not excluded
   is a root: the event listeners, the boot wiring, the one off set up. */
const excluded = new Map(Object.entries(config.excludeStatements || {}).map(([l, r]) => [+l, r]));
for (const l of excluded.keys()) if (!decls.some(d => d.kind === 'statement' && d.line === l)) throw new Error('excludeStatements names L' + l + ', which is not a load time statement');
for (const d of decls) {
  if (d.kind !== 'statement') continue;
  if (simStatementLines.has(d.line) || excluded.has(d.line)) continue;
  via.set(d.name, '<statement>'); q.push(d.name);
}
/* The extra code from the config is a root too: its references are
   followed, and it is emitted after the taken code, rewritten the same way. */
const extraAst = acorn.parse(config.extra || '', { ecmaVersion: 2022, sourceType: 'script' });
const extraNames = new Set();
walk.full(extraAst, x => { if (x.type === 'Identifier' && byName.has(x.name)) extraNames.add(x.name); }, memberAware);
for (const r of extraNames) if (!simOwned.has(r) && !via.has(r)) { via.set(r, '<extra>'); q.push(r); }
while (q.length) {
  const n = q.shift();
  if (seen.has(n)) continue;
  seen.add(n); order.push(n);
  if (cut.has(n)) continue;
  const d = byName.get(n);
  const refs = replace.has(n) ? parseRefs(replace.get(n).src) : d.refs;
  for (const r of refs) {
    if (simOwned.has(r)) continue;            // reached through SIM, not taken
    if (!seen.has(r)) { if (!via.has(r)) via.set(r, n); q.push(r); }
  }
}
const inClosure = new Set(order);
for (const n of simValues) if (!inClosure.has(n)) { inClosure.add(n); order.push(n); via.set(n, '<simulation value>'); }

/* ---- the rewrite: simulation names become SIM.name, scope aware ---- */
function hoisted(fnNode) {
  const names = new Set();
  for (const p of fnNode.params) walk.simple(p, { Identifier(q) { names.add(q.name); } });
  if (fnNode.body.type !== 'BlockStatement') return names;
  const scan = node => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'FunctionDeclaration') { names.add(node.id.name); return; }
    if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') return;
    if (node.type === 'VariableDeclaration' && node.kind === 'var') for (const d of node.declarations) walk.simple(d.id, { Identifier(q) { names.add(q.name); } });
    for (const k in node) { const v = node[k]; if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v.type === 'string') scan(v); }
  };
  scan(fnNode.body);
  return names;
}
function blockNames(stmtsList) {
  const names = new Set();
  for (const s of stmtsList || []) {
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') for (const d of s.declarations) walk.simple(d.id, { Identifier(q) { names.add(q.name); } });
    if (s.type === 'ClassDeclaration') names.add(s.id.name);
    if (s.type === 'FunctionDeclaration') names.add(s.id.name);
  }
  return names;
}
function rewriteSim(stmt, ownNames) {
  const edits = [];
  const bound = (st, name) => st.some(s => s.has(name));
  const mark = (node, st) => { if (!bound(st, node.name) && simOwned.has(node.name) && !ownNames.includes(node.name)) edits.push([node.start, node.end, 'SIM.' + node.name]); };
  const withScope = (st, names) => (names.size ? st.concat([names]) : st);
  const fn = (node, st, c) => {
    const inner = withScope(st, hoisted(node));
    if (node.type === 'FunctionExpression' && node.id) inner.push(new Set([node.id.name]));
    if (node.body.type === 'BlockStatement') { const bl = withScope(inner, blockNames(node.body.body)); for (const s of node.body.body) c(s, bl, 'Statement'); }
    else c(node.body, inner, 'Expression');
  };
  const visitors = {
    Identifier(node, st) { mark(node, st); },
    AssignmentExpression(node, st, c) {
      if (node.left.type === 'Identifier') mark(node.left, st);
      else if (node.left.type === 'MemberExpression') c(node.left, st, 'Expression');
      else { walk.simple(node.left, { Identifier(q) { if (simOwned.has(q.name) && !bound(st, q.name)) throw new Error('destructuring assignment to simulation name ' + q.name + ' at L' + lineOf(q.start)); } }); c(node.left, st, 'Pattern'); }
      c(node.right, st, 'Expression');
    },
    UpdateExpression(node, st, c) { if (node.argument.type === 'Identifier') mark(node.argument, st); else c(node.argument, st, 'Expression'); },
    Property(node, st, c) {
      if (node.computed) c(node.key, st, 'Expression');
      if (node.shorthand && node.value.type === 'Identifier') {
        if (!bound(st, node.value.name) && simOwned.has(node.value.name)) edits.push([node.start, node.end, node.value.name + ': SIM.' + node.value.name]);
        return;
      }
      c(node.value, st, 'Expression');
    },
    MemberExpression(node, st, c) { c(node.object, st, 'Expression'); if (node.computed) c(node.property, st, 'Expression'); },
    MethodDefinition(node, st, c) { if (node.computed) c(node.key, st, 'Expression'); c(node.value, st, 'Expression'); },
    PropertyDefinition(node, st, c) { if (node.computed) c(node.key, st, 'Expression'); if (node.value) c(node.value, st, 'Expression'); },
    FunctionDeclaration: fn, FunctionExpression: fn, ArrowFunctionExpression: fn,
    BlockStatement(node, st, c) { const bl = withScope(st, blockNames(node.body)); for (const s of node.body) c(s, bl, 'Statement'); },
    SwitchStatement(node, st, c) { c(node.discriminant, st, 'Expression'); const all = []; for (const cs of node.cases) all.push(...cs.consequent); const bl = withScope(st, blockNames(all)); for (const cs of node.cases) { if (cs.test) c(cs.test, bl, 'Expression'); for (const s of cs.consequent) c(s, bl, 'Statement'); } },
    ForStatement(node, st, c) { const bl = withScope(st, node.init && node.init.type === 'VariableDeclaration' ? blockNames([node.init]) : new Set()); if (node.init) c(node.init, bl, node.init.type === 'VariableDeclaration' ? 'Statement' : 'Expression'); if (node.test) c(node.test, bl, 'Expression'); if (node.update) c(node.update, bl, 'Expression'); c(node.body, bl, 'Statement'); },
    ForInStatement(node, st, c) { forX(node, st, c); }, ForOfStatement(node, st, c) { forX(node, st, c); },
    CatchClause(node, st, c) { const names = new Set(); if (node.param) walk.simple(node.param, { Identifier(q) { names.add(q.name); } }); const bl = withScope(st, names); c(node.body, bl, 'Statement'); },
    ClassDeclaration(node, st, c) { if (node.superClass) c(node.superClass, st, 'Expression'); c(node.body, st); },
    ClassExpression(node, st, c) { if (node.superClass) c(node.superClass, st, 'Expression'); c(node.body, st); },
  };
  function forX(node, st, c) {
    const bl = withScope(st, node.left.type === 'VariableDeclaration' ? blockNames([node.left]) : new Set());
    if (node.left.type === 'VariableDeclaration') c(node.left, bl, 'Statement'); else if (node.left.type === 'Identifier') mark(node.left, bl); else c(node.left, bl, 'Pattern');
    c(node.right, bl, 'Expression'); c(node.body, bl, 'Statement');
  }
  walk.recursive(stmt, [], visitors);
  edits.sort((a, b) => b[0] - a[0]);
  let src = main.src.slice(stmt.start, stmt.end);
  for (const [s, e, t] of edits) src = src.slice(0, s - stmt.start) + t + src.slice(e - stmt.start);
  return { src, edits: edits.length };
}

/* ---- the report --------------------------------------------------- */
const BROWSER = new Set(config.browserGlobals || []);
if (process.argv.includes('--report')) {
  let bytes = 0;
  for (const n of order) if (!cut.has(n) && !replace.has(n)) bytes += byName.get(n).end - byName.get(n).start;
  console.log('closure: ' + order.length + ' declarations, ' + bytes + ' bytes taken, ' + order.filter(n => cut.has(n)).length + ' cut, ' + order.filter(n => replace.has(n)).length + ' replaced');
  console.log('\n--- simulation names the chrome writes (through SIM setters):');
  const w = new Map();
  for (const n of order) { if (cut.has(n) || replace.has(n)) continue; for (const x of byName.get(n).writes) if (simOwned.has(x)) w.set(x, (w.get(x) || []).concat(n)); }
  for (const [k, v] of [...w.entries()].sort()) console.log('  ' + k.padEnd(22) + ' by ' + v.join(', '));
  console.log('\n--- chrome declarations whose initialiser reads simulation state at load:');
  for (const n of order) { const d = byName.get(n); if (cut.has(n) || replace.has(n) || d.kind === 'function' || d.kind === 'statement') continue; const hit = [...d.refs].filter(r => simOwned.has(r)); if (hit.length) console.log('  ' + n.padEnd(26) + 'L' + d.line + '  ' + hit.join(',')); }
  console.log('\n--- simulation hooks the chrome owns (the host wires hooks[name] = chrome.fn[name]):');
  console.log('  ' + chromeHooks.join(', '));
  console.log('\n--- cut symbols reached, with the first path to each:');
  for (const n of order) if (cut.has(n)) console.log('  ' + n.padEnd(26) + 'L' + byName.get(n).line + '  via ' + via.get(n) + '   [' + cut.get(n).reason + ']');
  console.log('\n--- replaced symbols reached:');
  for (const n of order) if (replace.has(n)) console.log('  ' + n.padEnd(26) + 'L' + byName.get(n).line + '  via ' + via.get(n) + '   [' + replace.get(n).reason + ']');
  console.log('\n--- cut/replace names in the config that nothing reaches:');
  for (const n of [...cut.keys(), ...replace.keys()]) if (!inClosure.has(n)) console.log('  ' + n);
  console.log('\n--- load time statements taken:');
  for (const n of order) { const d = byName.get(n); if (d.kind === 'statement') console.log('  L' + d.line + '  ' + d.label); }
  console.log('\n--- load time statements excluded by config:');
  for (const d of decls) if (d.kind === 'statement' && excluded.has(d.line)) console.log('  L' + d.line + '  ' + d.label + '   [' + excluded.get(d.line) + ']');
  console.log('\n--- top level declarations in neither half (dropped):');
  for (const d of decls) if (!simOwned.has(d.name) && !inClosure.has(d.name) && d.kind !== 'statement' && !simValues.includes(d.name)) console.log('  ' + d.kind.padEnd(9) + d.name.padEnd(28) + 'L' + d.line);
  if (process.argv.includes('--list')) { console.log('\n--- everything taken:'); for (const n of order) if (!cut.has(n) && !replace.has(n)) { const d = byName.get(n); console.log('  ' + d.kind.padEnd(9) + n.padEnd(28) + 'L' + d.line + '  via ' + via.get(n)); } }
  process.exit(0);
}

/* ---- emit --------------------------------------------------------- */
function applyRewrites(src) {
  for (const [from, to] of config.rewrites || []) src = src.replace(new RegExp(from, 'g'), to);
  return src;
}
const manifest = { commit, source: 'index.html at ' + commit + ', from the repository history', roots: config.roots, hooks: chromeHooks, worldHooks: [...cut.keys()].filter(n => cut.get(n).as === 'world'), taken: [], cut: [], replaced: [], statements: [], simRefs: 0 };
const pieces = [];
const emitted = new Set();
const inOrder = decls.filter(d => inClosure.has(d.name) && !cut.has(d.name));
inOrder.sort((a, b) => a.start - b.start);
const vars = [], fns = [];
for (const d of inOrder) {
  const key = d.start + ':' + d.end;
  if (emitted.has(key)) continue;
  emitted.add(key);
  if (replace.has(d.name)) {
    /* A replaced body goes in at its own place in the source order, so a
       replaced const is initialised where the original was. */
    const r = replace.get(d.name);
    manifest.replaced.push({ name: d.name, kind: d.kind, line: d.line, endLine: d.endLine, via: via.get(d.name), reason: r.reason });
    const a = acorn.parse(r.src, { ecmaVersion: 2022, sourceType: 'script' });
    let src = '';
    for (const st of a.body) { const { src: s2, edits } = rewriteSimIn(r.src, st, [d.name]); src += s2; manifest.simRefs += edits; }
    pieces.push('/* L' + d.line + ' REPLACED: ' + r.reason + ' */\n' + src.trim());
    if (d.kind === 'function') fns.push(d.name); else vars.push({ name: d.name, kind: d.kind });
    continue;
  }
  const owners = decls.filter(x => x.start === d.start && x.end === d.end).map(x => x.name);
  for (const n of owners) if (!inClosure.has(n)) { inClosure.add(n); via.set(n, '<shares a declaration with ' + owners.find(o => inClosure.has(o) && o !== n) + '>'); }
  const { src, edits } = rewriteSim(d.stmt, owners);
  manifest.simRefs += edits;
  pieces.push('/* L' + d.line + (edits ? ', ' + edits + ' SIM ref' + (edits === 1 ? '' : 's') : '') + ' */ ' + applyRewrites(src));
  if (d.kind === 'statement') manifest.statements.push({ line: d.line, label: d.label });
  else for (const n of owners) { manifest.taken.push({ name: n, kind: byName.get(n).kind, line: d.line, endLine: d.endLine, via: via.get(n), simRefs: edits }); if (byName.get(n).kind === 'function' || byName.get(n).kind === 'class') fns.push(n); else vars.push({ name: n, kind: byName.get(n).kind }); }
}
const stubs = [];
for (const n of order) {
  if (!cut.has(n)) continue;
  const c = cut.get(n), d = byName.get(n);
  manifest.cut.push({ name: n, kind: d.kind, line: d.line, via: via.get(n), reason: c.reason, as: c.as });
  if (c.as === 'world') { stubs.push('function ' + n + '(...a) { return WORLD.' + n + ' ? WORLD.' + n + '(...a) : undefined; }   // L' + d.line + ', ' + c.reason); fns.push(n); }
  else if (c.as === 'noop') { stubs.push('function ' + n + '() {}   // L' + d.line + ', ' + c.reason); fns.push(n); }
  else if (c.as === 'value') { stubs.push('let ' + n + ' = ' + c.init + ';   // L' + d.line + ', ' + c.reason); vars.push({ name: n, kind: 'let' }); }
  else throw new Error('cut ' + n + ' has no "as"');
}
const extras = [];
for (const st of extraAst.body) {
  const { src, edits } = rewriteSimIn(config.extra, st, []);
  manifest.simRefs += edits;
  extras.push(src.trim());
  if (st.type === 'FunctionDeclaration') fns.push(st.id.name);
  else if (st.type === 'VariableDeclaration') for (const d of st.declarations) if (d.id.type === 'Identifier') vars.push({ name: d.id.name, kind: st.kind });
}
/* A replacement body is rewritten the same way, against its own text. */
function rewriteSimIn(text, stmt, ownNames) {
  const saved = main.src;
  main.src = text;
  try { return rewriteSim(stmt, ownNames); } finally { main.src = saved; }
}
const accessors = vars.map(v => '  ' + JSON.stringify(v.name) + ': [() => ' + v.name + ', ' + (v.kind === 'const' ? 'null' : '(v) => { ' + v.name + ' = v; }') + ']');
const fnTable = fns.map(n => '  ' + JSON.stringify(n) + ': ' + n);

const out = `/* GENERATED by tools/chrome.js. DO NOT EDIT.
   Drift Fever's chrome, vendored from SnapHit/Drift_Fever index.html at
   commit ${commit}: the title screen, countdown, HUD, run card,
   share card, pause cover, tilt calibration, the input handlers, the music
   and sound effects, the pad buttons, the boot splash and the frame
   function, text verbatim. The Canvas 2D world is cut and forwards to the
   3D renderer. public/CHROME.json lists what was taken, cut and replaced.

   createChrome(SIM, WORLD, DOM):
     SIM    the simulation view: every simulation variable as an accessor
            property and every simulation function as a method. Every
            reference the original made to a simulation name has been
            rewritten to SIM.name, so this code reads and writes the vendored
            module and nothing else.
     WORLD  the 3D renderer, which the cut world passes call into.
     DOM    the document the original's chrome markup lives in. */
export function createChrome(SIM, WORLD, DOM) {
  'use strict';
  const document = DOM;

  /* ---- the renderer boundary: the world, cut ---- */
${stubs.map(s => '  ' + s).join('\n')}

  /* ---- the chrome, in source order, replaced bodies in their places ---- */
${pieces.map(s => s.split('\n').map(l => '  ' + l).join('\n')).join('\n\n')}

  /* ---- extra, from the config ---- */
${extras.map(s => s.split('\n').map(l => '  ' + l).join('\n')).join('\n\n')}

  /* ---- access ---- */
  const __vars = {
${accessors.join(',\n')}
  };
  const __fns = {
${fnTable.join(',\n')}
  };
  function get(name) { const a = __vars[name]; if (!a) throw new Error('no such chrome state: ' + name); return a[0](); }
  function set(name, v) { const a = __vars[name]; if (!a) throw new Error('no such chrome state: ' + name); if (!a[1]) throw new Error(name + ' is a constant'); a[1](v); }
  return { get, set, fn: __fns, names: Object.keys(__vars), commit: ${JSON.stringify(commit)} };
}
/* The simulation hooks whose bodies live here, for the host to wire. */
export const CHROME_HOOKS = ${JSON.stringify(chromeHooks)};
`;
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'chrome.js'), out);
manifest.bytes = out.length;
manifest.counts = { taken: manifest.taken.length, cut: manifest.cut.length, replaced: manifest.replaced.length, statements: manifest.statements.length, simRefs: manifest.simRefs };
fs.writeFileSync(path.join(root, 'public', 'CHROME.json'), JSON.stringify(manifest, null, 1));

/* The markup and the stylesheet come along too, verbatim, so the DOM the
   chrome measures and the stylesheet that lays it out are the original's.
   Everything after the <body> tag and before the <script> is the chrome's
   markup; the <style> block is its stylesheet. */
const style = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
/* The fine print is driftfever.com's own site navigation and does not
   belong in another publisher's build; the chrome treats its absence as
   the framed case, which the original already handles. */
body = body.replace(/\s*<footer id="more">[\s\S]*?<\/footer>/, '');
const icon = (/<link rel="icon"[^>]*>/.exec(html) || [''])[0];
const page = fs.readFileSync(path.join(root, 'tools', 'page.template.html'), 'utf8')
  .replace('<!--ICON-->', icon)
  .replace('<!--CHROME-->', '<!-- The chrome markup, from index.html at ' + commit + ' -->' + body.trim());
fs.writeFileSync(path.join(root, 'public', 'chrome.css'), '/* GENERATED by tools/chrome.js from index.html at ' + commit + '. DO NOT EDIT. */' + style);
fs.writeFileSync(path.join(root, 'public', 'index.html'), '<!-- GENERATED by tools/chrome.js from tools/page.template.html and index.html at ' + commit + '. DO NOT EDIT. -->\n' + page);
console.log('wrote public/chrome.js (' + out.length + ' bytes): ' + manifest.counts.taken + ' declarations taken, ' + manifest.counts.cut + ' cut, ' + manifest.counts.replaced + ' replaced, ' + manifest.counts.statements + ' load time statements, ' + manifest.simRefs + ' references rewritten to SIM; public/chrome.css and public/index.html');
