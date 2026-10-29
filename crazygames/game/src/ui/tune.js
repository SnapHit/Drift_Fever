/* THE TUNING PANEL, at ?tune=1. A slider for each entry in PANEL,
   applied to TUNE as it moves, remembered on the device under one
   localStorage key, with a line of the current values at the top to
   screenshot and a reset. Every localStorage call is wrapped: the panel
   works with no memory at all. The panel folds to a tab so the game is
   still playable with it open on a phone. */
import { TUNE, PANEL, tuneGet, tuneSet, tuneDefaults } from '../tune.js';

const KEY = 'driftfever.cg.tune.v2';   // v2 from 29 October 2026: saves from before the handling rework are ignored

export function loadSavedTune() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const saved = JSON.parse(raw);
    let n = 0;
    for (const [path] of PANEL) if (typeof saved[path] === 'number' && isFinite(saved[path])) { tuneSet(path, saved[path]); n++; }
    return n;
  } catch (e) { return 0; }
}
function save() {
  try {
    const out = {};
    const d = tuneDefaults();
    for (const [path] of PANEL) { const [g, k] = path.split('.'); if (tuneGet(path) !== d[g][k]) out[path] = tuneGet(path); }
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch (e) { /* no memory: the panel still works for this page */ }
}

export function createTunePanel(root, onChange) {
  const el = document.createElement('div');
  el.id = 'tune';
  el.innerHTML = `<div id="tuneBar"><button type="button" id="tuneFold">tune</button><pre id="tuneLine"></pre></div><div id="tuneBody"></div>`;
  root.appendChild(el);
  const body = el.querySelector('#tuneBody'), line = el.querySelector('#tuneLine'), fold = el.querySelector('#tuneFold');
  const rows = [];
  for (const [path, label, min, max, step] of PANEL) {
    const row = document.createElement('label');
    row.innerHTML = `<span class="l">${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><span class="v"></span>`;
    const input = row.querySelector('input'), val = row.querySelector('.v');
    input.value = tuneGet(path);
    val.textContent = fmt(tuneGet(path));
    input.addEventListener('input', () => { tuneSet(path, +input.value); val.textContent = fmt(+input.value); save(); refreshLine(); if (onChange) onChange(path); });
    body.appendChild(row);
    rows.push({ path, input, val });
  }
  const reset = document.createElement('button');
  reset.type = 'button'; reset.textContent = 'reset all';
  reset.addEventListener('click', () => { const d = tuneDefaults(); for (const r of rows) { const [g, k] = r.path.split('.'); tuneSet(r.path, d[g][k]); r.input.value = d[g][k]; r.val.textContent = fmt(d[g][k]); } save(); refreshLine(); if (onChange) onChange(null); });
  body.appendChild(reset);
  fold.addEventListener('click', () => el.classList.toggle('open'));
  function fmt(v) { return (Math.round(v * 1000) / 1000).toString(); }
  function refreshLine() {
    const d = tuneDefaults();
    const changed = [];
    for (const [path] of PANEL) { const [g, k] = path.split('.'); if (tuneGet(path) !== d[g][k]) changed.push(path.toLowerCase().replace('vehicle.', 'v.').replace('assist.', 'a.').replace('camera.', 'c.').replace('scoring.', 's.') + '=' + fmt(tuneGet(path))); }
    line.textContent = changed.length ? changed.join(' ') : 'defaults';
  }
  refreshLine();
  return { el, refreshLine };
}

void TUNE;
