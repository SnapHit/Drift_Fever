/* THE SAVE. One localStorage key holds everything the device remembers:
   coins, the cars owned and their paint, the chosen car, the career's
   stars and best scores, the daily's best, and the ghosts (the best run
   of each track as its input tape). Every localStorage call is wrapped:
   with no storage, or storage that throws, the game plays from the
   defaults and forgets on reload. A saved blob that does not parse, or
   parses into the wrong shape, is repaired field by field to the
   defaults, never trusted and never a crash.

   Ghost tapes are stored compact: [[n, steer, throttle, brake, hb], ...]
   as the recorder's run length entries. */
import { LOOP } from '../tune.js';
import { ROSTER, PAINTS } from '../garage/roster.js';

export const KEY = 'driftfever.cg.save.v' + LOOP.SAVE_VERSION;

export function defaults() {
  return { v: LOOP.SAVE_VERSION, coins: 0, car: 'starter', cars: { starter: { paint: 'cyan' } }, career: {}, daily: {}, ghosts: {} };
}

const isNum = v => typeof v === 'number' && isFinite(v);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const carIds = new Set(ROSTER.map(c => c.id));
const paintIds = new Set(PAINTS.map(p => p.id));

/* A ghost record, or null if it is not one. */
export function validGhost(g) {
  if (!isObj(g)) return null;
  if (!isNum(g.score) || !isNum(g.steps) || g.steps < 1 || !Array.isArray(g.tape) || !g.tape.length) return null;
  if (!carIds.has(g.car)) return null;
  let steps = 0;
  for (const e of g.tape) {
    if (!Array.isArray(e) || e.length !== 5) return null;
    for (const v of e) if (!isNum(v)) return null;
    if (e[0] < 1 || e[0] !== Math.floor(e[0])) return null;
    steps += e[0];
  }
  if (steps !== g.steps) return null;
  return { score: g.score, best: isNum(g.best) ? g.best : 0, car: g.car, paint: paintIds.has(g.paint) ? g.paint : null, steps: g.steps, hash: typeof g.hash === 'string' ? g.hash : '', tape: g.tape, when: isNum(g.when) ? g.when : 0, seconds: isNum(g.seconds) ? g.seconds : 0 };
}

/* Repair anything into a valid save. Counts what it had to fix. */
export function repair(raw) {
  const d = defaults();
  let fixes = 0;
  const fix = () => { fixes++; };
  if (!isObj(raw)) { return { state: d, fixes: 1 }; }
  const s = defaults();
  if (isNum(raw.coins) && raw.coins >= 0) s.coins = Math.floor(raw.coins); else if (raw.coins !== undefined) fix();
  if (isObj(raw.cars)) {
    for (const id of Object.keys(raw.cars)) {
      if (!carIds.has(id) || !isObj(raw.cars[id])) { fix(); continue; }
      const paint = raw.cars[id].paint;
      s.cars[id] = { paint: paintIds.has(paint) ? paint : (fix(), ROSTER.find(c => c.id === id).paint) };
    }
  } else if (raw.cars !== undefined) fix();
  if (!s.cars.starter) s.cars.starter = { paint: 'cyan' };
  if (carIds.has(raw.car) && s.cars[raw.car]) s.car = raw.car; else if (raw.car !== undefined) fix();
  if (isObj(raw.career)) {
    for (const k of Object.keys(raw.career)) {
      const e = raw.career[k];
      if (!/^\d+$/.test(k) || !isObj(e) || !isNum(e.stars) || !isNum(e.best)) { fix(); continue; }
      s.career[k] = { stars: Math.max(0, Math.min(3, Math.floor(e.stars))), best: Math.max(0, Math.floor(e.best)) };
    }
  } else if (raw.career !== undefined) fix();
  if (isObj(raw.daily) && typeof raw.daily.date === 'string' && isNum(raw.daily.best)) s.daily = { date: raw.daily.date, best: Math.floor(raw.daily.best), stars: isNum(raw.daily.stars) ? Math.floor(raw.daily.stars) : 0 };
  else if (raw.daily !== undefined && !(isObj(raw.daily) && Object.keys(raw.daily).length === 0)) fix();
  if (isObj(raw.ghosts)) {
    for (const k of Object.keys(raw.ghosts)) { const g = validGhost(raw.ghosts[k]); if (g) s.ghosts[k] = g; else fix(); }
  } else if (raw.ghosts !== undefined) fix();
  return { state: s, fixes };
}

export function createSave(opts) {
  const o = opts || {};
  const store = o.storage !== undefined ? o.storage : (typeof localStorage !== 'undefined' ? localStorage : null);
  const status = { available: false, loaded: false, repaired: 0, lastError: null, writes: 0, failedWrites: 0 };
  let state = defaults();
  function load() {
    let raw = null;
    try { raw = store ? store.getItem(KEY) : null; status.available = !!store; } catch (e) { status.available = false; status.lastError = String(e); raw = null; }
    if (raw === null || raw === undefined) { state = defaults(); status.loaded = false; return state; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { status.repaired = 1; status.lastError = 'unreadable save'; state = defaults(); status.loaded = false; return state; }
    const r = repair(parsed);
    state = r.state; status.repaired = r.fixes; status.loaded = true;
    return state;
  }
  function write() {
    status.writes++;
    try { if (store) store.setItem(KEY, JSON.stringify(state)); } catch (e) { status.failedWrites++; status.lastError = String(e); }
  }
  load();
  return {
    status, KEY,
    get state() { return state; },
    reload: load,
    write,
    reset() { state = defaults(); write(); },
    /* the pieces of the game that change the save */
    addCoins(n) { state.coins = Math.max(0, Math.floor(state.coins + n)); write(); },
    ownsCar(id) { return !!state.cars[id]; },
    buyCar(id, price) { if (state.cars[id] || state.coins < price || !carIds.has(id)) return false; state.coins -= price; state.cars[id] = { paint: ROSTER.find(c => c.id === id).paint }; write(); return true; },
    chooseCar(id) { if (!state.cars[id]) return false; state.car = id; write(); return true; },
    setPaint(id, paint) { if (!state.cars[id] || !paintIds.has(paint)) return false; state.cars[id].paint = paint; write(); return true; },
    careerResult(index, stars, score) {
      const k = String(index), e = state.career[k] || { stars: 0, best: 0 };
      const improved = score > e.best;
      e.stars = Math.max(e.stars, stars); e.best = Math.max(e.best, Math.floor(score));
      state.career[k] = e; write();
      return improved;
    },
    dailyResult(date, stars, score) {
      if (state.daily.date !== date) state.daily = { date, best: 0, stars: 0 };
      const improved = score > state.daily.best;
      state.daily.best = Math.max(state.daily.best, Math.floor(score)); state.daily.stars = Math.max(state.daily.stars, stars);
      write();
      return improved;
    },
    ghost(key) { return state.ghosts[key] || null; },
    setGhost(key, record) {
      const g = validGhost(record);
      if (!g) return false;
      /* only one daily ghost is kept: today's */
      if (key.startsWith('daily:')) for (const k of Object.keys(state.ghosts)) if (k.startsWith('daily:') && k !== key) delete state.ghosts[k];
      state.ghosts[key] = g; write();
      return true;
    },
  };
}
