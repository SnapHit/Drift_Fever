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
import { ROSTER, PAINTS, upgradeLevels, UPGRADE_STATS } from '../garage/roster.js';
import { RIVALS } from '../rivals/roster.js';

export const KEY = 'driftfever.cg.save.v' + LOOP.SAVE_VERSION;

export function defaults() {
  /* starPay: the one-off back pay of the new star bonus for stars won
     before it existed (8 November 2026) has been made, or was never owed.
     onboarded: the first-run onboarding has been seen or skipped (added
     8 November 2026; a save from before it has finished runs, which also
     counts, see needsOnboarding). missions: per track key, which of its
     three missions have been done. lab: the Track Lab's best per code for
     the last LOOP.LAB.KEEP codes driven, and the last code shown (both
     added 8 November 2026). */
  /* rivals (added 11 November 2026, briefs/RIVALS.md): per rival id,
     { won, best, when }: whether he has been beaten, the best margin
     over him in any battle (negative while never beaten), and when the
     last battle was. A save from before it has none, which is not a
     fix. */
  return { v: LOOP.SAVE_VERSION, coins: 0, car: 'starter', cars: { starter: { paint: 'cyan', up: upgradeLevels() } }, career: {}, daily: {}, ghosts: {}, starPay: true, onboarded: false, missions: {}, lab: { codes: {}, last: '' }, rivals: {} };
}

/* Has this save ever finished a run: a career result or a daily result. */
export function finishedRuns(state) { return Object.keys(state.career).length > 0 || typeof state.daily.date === 'string'; }

const isNum = v => typeof v === 'number' && isFinite(v);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const carIds = new Set(ROSTER.map(c => c.id));
const paintIds = new Set(PAINTS.map(p => p.id));
const rivalIds = new Set(RIVALS.map(r => r.id));

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
  return { score: g.score, best: isNum(g.best) ? g.best : 0, car: g.car, paint: paintIds.has(g.paint) ? g.paint : null, steps: g.steps, hash: typeof g.hash === 'string' ? g.hash : '', tape: g.tape, when: isNum(g.when) ? g.when : 0, seconds: isNum(g.seconds) ? g.seconds : 0, gen: isNum(g.gen) ? g.gen : 1, rev: isNum(g.rev) ? g.rev : 1, up: upgradeLevels(g.up), ...(isNum(g.seed) ? { seed: g.seed } : {}) };
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
      s.cars[id] = { paint: paintIds.has(paint) ? paint : (fix(), ROSTER.find(c => c.id === id).paint), up: upgradeLevels(raw.cars[id].up) };
    }
  } else if (raw.cars !== undefined) fix();
  if (!s.cars.starter) s.cars.starter = { paint: 'cyan', up: upgradeLevels() };
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
  s.starPay = raw.starPay === true;   // a save from before the back pay has not had it
  s.onboarded = raw.onboarded === true;   // missing on a save from before onboarding: not a fix, see finishedRuns
  if (isObj(raw.missions)) {
    for (const k of Object.keys(raw.missions)) {
      const e = raw.missions[k];
      if (!/^(career:\d+|daily:\d{4}-\d{2}-\d{2})$/.test(k) || !Array.isArray(e) || e.length !== 3 || !e.every(v => v === 0 || v === 1)) { fix(); continue; }
      s.missions[k] = e.slice();
    }
  } else if (raw.missions !== undefined) fix();
  if (isObj(raw.lab)) {
    if (isObj(raw.lab.codes)) {
      for (const k of Object.keys(raw.lab.codes)) {
        const e = raw.lab.codes[k];
        if (!/^[0-9A-Z]{12}$/.test(k) || !isObj(e) || !isNum(e.best) || !isNum(e.when)) { fix(); continue; }
        s.lab.codes[k] = { best: Math.max(0, Math.floor(e.best)), stars: isNum(e.stars) ? Math.max(0, Math.min(3, Math.floor(e.stars))) : 0, when: e.when };
      }
    } else if (raw.lab.codes !== undefined) fix();
    if (typeof raw.lab.last === 'string' && /^([0-9A-Z]{12})?$/.test(raw.lab.last)) s.lab.last = raw.lab.last; else if (raw.lab.last !== undefined) fix();
  } else if (raw.lab !== undefined) fix();
  if (isObj(raw.rivals)) {
    for (const k of Object.keys(raw.rivals)) {
      const e = raw.rivals[k];
      if (!rivalIds.has(k) || !isObj(e) || typeof e.won !== 'boolean' || !isNum(e.best) || !isNum(e.when)) { fix(); continue; }
      s.rivals[k] = { won: e.won, best: Math.round(e.best), when: e.when };
    }
  } else if (raw.rivals !== undefined) fix();
  return { state: s, fixes };
}

export function createSave(opts) {
  const o = opts || {};
  const status = { available: false, loaded: false, repaired: 0, lastError: null, writes: 0, failedWrites: 0, ghostsDropped: 0 };
  /* even reading the localStorage property can throw (a sandboxed frame,
     storage switched off), so the store itself is taken inside a try */
  let store = null;
  try { store = o.storage !== undefined ? o.storage : (typeof localStorage !== 'undefined' ? localStorage : null); } catch (e) { store = null; status.lastError = String(e); }
  let state = defaults();
  function load() {
    let raw = null;
    try { raw = store ? store.getItem(KEY) : null; status.available = !!store; } catch (e) { status.available = false; status.lastError = String(e); raw = null; }
    if (raw === null || raw === undefined) { state = defaults(); status.loaded = false; return state; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { status.repaired = 1; status.lastError = 'unreadable save'; state = defaults(); status.loaded = false; return state; }
    const r = repair(parsed);
    state = r.state; status.repaired = r.fixes; status.loaded = true;
    /* the back pay, once: the new star bonus for every career star won
       before it existed */
    if (!state.starPay) {
      let n = 0; for (const k of Object.keys(state.career)) n += state.career[k].stars;
      status.backPay = n * LOOP.NEW_STAR_BONUS;
      state.coins += status.backPay; state.starPay = true; write();
    }
    return state;
  }
  /* the Lab keeps the last LOOP.LAB.KEEP codes driven: older bests and
     their ghosts are dropped, so the save stays small */
  function trimLab() {
    const codes = Object.keys(state.lab.codes).sort((a, b) => state.lab.codes[b].when - state.lab.codes[a].when);
    for (const k of codes.slice(LOOP.LAB.KEEP)) { delete state.lab.codes[k]; delete state.ghosts['lab:' + k]; }
    for (const k of Object.keys(state.ghosts)) if (k.startsWith('lab:') && !state.lab.codes[k.slice(4)]) delete state.ghosts[k];
  }
  /* Storage that is full refuses the whole save, and then nothing after
     it is remembered, coins and stars included (a ghost on every career
     track came to 2.2 million characters, review/chapters/REPORT.md). So
     when a write is refused the oldest ghosts go, one at a time, until
     it fits (10 November 2026, the author's decision). Stars, coins,
     cars and missions are never touched. A ghost is only dropped once a
     write without it has succeeded: if the save is refused even with no
     ghosts the storage is broken, not full, and nothing is dropped. */
  function write() {
    status.writes++;
    if (!store) return;
    try { store.setItem(KEY, JSON.stringify(state)); return; } catch (e) { status.lastError = String(e); }
    const oldest = Object.keys(state.ghosts).sort((a, b) => state.ghosts[a].when - state.ghosts[b].when || (a < b ? -1 : 1));
    const kept = Object.assign({}, state.ghosts);
    for (let n = 0; n < oldest.length; n++) {
      delete kept[oldest[n]];
      try {
        store.setItem(KEY, JSON.stringify(Object.assign({}, state, { ghosts: kept })));
        state.ghosts = kept; status.ghostsDropped += n + 1;
        return;
      } catch (e) { status.lastError = String(e); }
    }
    status.failedWrites++;
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
    buyCar(id, price) { if (state.cars[id] || state.coins < price || !carIds.has(id)) return false; state.coins -= price; state.cars[id] = { paint: ROSTER.find(c => c.id === id).paint, up: upgradeLevels() }; write(); return true; },
    /* one step of an upgrade on an owned car, at the price of that step */
    buyUpgrade(id, stat) {
      const car = state.cars[id];
      if (!car || !UPGRADE_STATS.includes(stat)) return false;
      const lv = upgradeLevels(car.up), price = LOOP.UPGRADE_PRICES[lv[stat]];
      if (price === undefined || state.coins < price) return false;
      state.coins -= price; lv[stat]++; car.up = lv; write(); return true;
    },
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
    /* the first visit: no run ever finished and the onboarding not yet seen or skipped */
    needsOnboarding() { return !state.onboarded && !finishedRuns(state); },
    setOnboarded() { if (!state.onboarded) { state.onboarded = true; write(); } },
    /* a run's missions: done is [bool x3]; returns the indices newly done,
       which are the ones that pay. Only today's daily is kept. */
    missionResult(key, done) {
      const prev = state.missions[key] || [0, 0, 0];
      const fresh = [];
      const next = prev.map((v, i) => { const now = v || done[i] ? 1 : 0; if (now && !v) fresh.push(i); return now; });
      if (key.startsWith('daily:')) for (const k of Object.keys(state.missions)) if (k.startsWith('daily:') && k !== key) delete state.missions[k];
      state.missions[key] = next; write();
      return fresh;
    },
    /* a Lab run's best for its code; the oldest codes beyond LOOP.LAB.KEEP go, ghosts and all */
    labResult(code, stars, score) {
      const e = state.lab.codes[code] || { best: 0, stars: 0, when: 0 };
      const improved = score > e.best;
      e.best = Math.max(e.best, Math.floor(score)); e.stars = Math.max(e.stars, stars); e.when = Date.now();
      state.lab.codes[code] = e;
      trimLab(); write();
      return improved;
    },
    labBest(code) { return state.lab.codes[code] || null; },
    /* a battle's result: won once is won for good; best is the best margin (player less rival) */
    rivalResult(id, won, margin) {
      const e = state.rivals[id] || { won: false, best: -Infinity, when: 0 };
      const first = won && !e.won;
      e.won = e.won || !!won; e.best = Math.round(Math.max(e.best, margin)); e.when = Date.now();
      state.rivals[id] = e; write();
      return first;
    },
    setLabLast(code) { if (state.lab.last !== code) { state.lab.last = code; write(); } },
    ghost(key) { return state.ghosts[key] || null; },
    setGhost(key, record) {
      const g = validGhost(record);
      if (!g) return false;
      /* only one daily ghost is kept: today's */
      if (key.startsWith('daily:')) for (const k of Object.keys(state.ghosts)) if (k.startsWith('daily:') && k !== key) delete state.ghosts[k];
      state.ghosts[key] = g;
      if (key.startsWith('lab:')) trimLab();
      write();
      return true;
    },
  };
}
