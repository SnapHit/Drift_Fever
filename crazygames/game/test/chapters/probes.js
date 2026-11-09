/* THE CAREER CHAPTERS, MEASURED (briefs/CHAPTERS.md "Measure" 1 to 4),
   each with a known answer that can fail. Headless Chromium on the forced
   WebGL 2 path through the dev server, the frame loop stubbed and the
   page's own frame function called at 60 Hz (the loop probes' harness),
   writing review/chapters/*.json and review/chapters/shots/.

   node game/test/chapters/probes.js [tracks] [ladder] [saves] [screens] [perf]
   (no names: everything)

   1. tracks: all 24 career tracks through the real run structure
      (startRun, the countdown, the drive, the results), each driven by
      the scripted careful driver and the scripted drifter from an empty
      save; respawns counted at every physics step (off the track and
      stuck alike), wall contacts read at the line; generation timed in
      the page (the worst of three); the corner and feature mix and the
      run length. The check is seeds.js's, the one the seeds were chosen
      by. Known answer: seeds the search rejected, driven the same way,
      fail it. The readability rule (nothing occludes the road, in every
   theme) is checked on the same tracks in Node, as occlusion.js does.
   2. ladder: careerUnlocked against the rules written out again here,
      on fixed cases and 2,000 random saves, and the career screen's rows
      against them on 40 of those saves. Known answers: Pro stays locked
      with OPEN[1] - 1 Rookie stars and Legend with OPEN[2] - 1 Pro stars;
      a playing of a locked track is refused; a rule with OPEN off by one
      disagrees with the game.
   3. saves: two saves written by main's code (main-save.js): with 12
      Rookie stars Pro is open on the first visit after this ships, with
      11 it is not, and everything in them is kept with 0 fixes; a Pro
      track then plays and opens the next; a corrupted save and storage
      that throws still play and still show the career. And the size of
      a save with a scripted ghost on every one of the 24 tracks.
   4. screens: the career screen (three saves: Rookie, Pro and Legend
      current), a Pro countdown heading, and the results of a run that
      opens Pro and of one that leaves Rookie short, at 390x844, 844x390,
      800x450 and 1280x720: no two boxes overlap at any scroll position,
      every row reachable, the current chapter in view on opening, the
      title's career button out of 72. Known answers: a rule that pulls
      the chapter heads onto their rows is seen to overlap; a list left
      at the top does not show Legend.
   5. perf: JavaScript time per frame at 6x CPU throttle on the longest
      Legend track against Rookie 1 measured the same way (a ghost
      running, 420 frames from GO and 420 more half way through). Known
      answer: 20 ms of busy work per frame fails the budget. */
import fs from 'node:fs';
import path from 'node:path';
import * as R from '../retention/lib.js';
import { check, features, occlusionOf, GEN_MS, BANKED_MIN } from './seeds.js';
import { generateTrack } from '../../src/tracks/generate.js';
import { CAREER, CHAPTERS, careerSpec } from '../../src/loop/modes.js';
import { LOOP } from '../../src/tune.js';

const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const run = name => want.length === 0 || want.includes(name);
const reviewDir = path.join(R.root, 'review', 'chapters');
const shots = path.join(reviewDir, 'shots');
fs.mkdirSync(shots, { recursive: true });
const SIZES = [R.PORTRAIT, R.PHONE_LANDSCAPE, R.SMALL, R.LANDSCAPE];
const tagOf = vp => vp.width + 'x' + vp.height;
const touchFor = vp => vp.width < 900 && vp !== R.SMALL;
let failed = 0;
function verdict(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ': ' + detail : '')); if (!ok) failed++; return ok; }
const env = await R.start();
const started = new Date().toISOString();

/* A page with a given save in place before the game loads (blob: the
   string to store, or null for an empty store), once per tab, or with
   storage that throws. */
async function openWith(vp, opts) {
  const o = opts || {};
  const context = await env.browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: !!o.touch });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let init = '(function () { window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {}; })();';
  if (o.throwing) init += `Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage is off'); }, configurable: true });`;
  else init += `try { if (!sessionStorage.getItem('probe-set')) { localStorage.clear(); ${o.blob ? `localStorage.setItem(${JSON.stringify(o.key || 'driftfever.cg.save.v1')}, ${JSON.stringify(o.blob)});` : ''} sessionStorage.setItem('probe-set', '1'); } } catch (e) {}`;
  await page.addInitScript(init);
  await page.goto(env.url + '?renderer=webgl2' + (o.query ? '&' + o.query : ''), { waitUntil: 'load', timeout: 120000 });
  await R.waitReady(page);
  return { page, context, errors, close: () => context.close() };
}

/* Drive a spec to its results in the page with a scripted driver, the
   real run structure, no drawing. Respawns are counted at every physics
   step; contacts are read at the line. */
const DRIVE_SRC = `
  const Lp = window.__loop, F = window.__feel; F.draw = false;
  if (extra.reset) Lp.save.reset();
  Lp.startRun(extra.spec); F.setDriver(extra.driver);
  const w = F.world; let off = 0, stuck = 0, atLine = null, frames = 0;
  const step = w.stepWorld;
  w.stepWorld = inp => { const r = step(inp); if (w.respawned) { if (w.recovered) stuck++; else off++; } if (atLine === null && Lp.progress() && Lp.progress().finished) atLine = { hits: w.hits, hard: w.hardHits }; return r; };
  if (window.__clock === undefined) window.__clock = 1000;
  while (Lp.app.state !== 'results' && frames < extra.maxFrames) { window.__clock += 1000 / 60; F.frame(window.__clock); frames++; }
  w.stepWorld = step;
  const r = Lp.results();
  return { finished: !!r, frames, seconds: r ? +r.seconds.toFixed(2) : null, score: r ? r.score : null, stars: r ? r.stars : 0, targets: r ? r.targets : null, cleanSectors: r ? r.cleanSectors : '', contacts: atLine ? atLine.hits : w.hits, hard: atLine ? atLine.hard : w.hardHits, offTrack: off, stuck, respawns: off + stuck, unlock: r && r.unlock, note: r && r.note, nextIndex: r ? r.nextIndex : null };
`;
const drive = (page, spec, driver, reset) => page.evaluate(({ src, extra }) => new Function('extra', src)(extra), { src: DRIVE_SRC, extra: { spec, driver, reset: reset !== false, maxFrames: 60 * 400 } });
const DRIVERS = { careful: { drift: null }, drifter: { drift: '*' } };

/* ---- 1. the tracks ---- */
if (run('tracks')) {
  console.log('\n== 1. tracks');
  const side = await openWith(R.SMALL, { query: 'title=1' });
  const { page } = side;
  /* generation time in the page: three rounds over every spec, each call a different spec from the last so the memo never answers */
  const seeds = JSON.parse(fs.readFileSync(path.join(reviewDir, 'seeds.json'), 'utf8'));
  const rejected = [];
  for (const s of seeds.slots) for (const t of s.tried) if (t.fails.length && !t.fails.every(f => /banked/.test(f)) && rejected.length < 4 && !rejected.some(r => r.index === s.index)) rejected.push({ index: s.index, seed: t.seed, nodeFails: t.fails });
  /* one rejected for banks alone too: the step up is part of the check */
  for (const s of seeds.slots) { const t = s.tried.find(t => t.fails.length === 1 && /banked/.test(t.fails[0])); if (t) { rejected.push({ index: s.index, seed: t.seed, nodeFails: t.fails }); break; } }
  const specs = CAREER.map((_, i) => careerSpec(i)).concat(rejected.map(r => ({ ...careerSpec(r.index), seed: r.seed })));
  const gen = await page.evaluate(specs => {
    const Lp = window.__loop, worst = specs.map(() => 0), feat = [];
    for (let round = 0; round < 3; round++) for (let k = 0; k < specs.length; k++) {
      const t0 = performance.now(); const t = Lp.trackFor(specs[k]); worst[k] = Math.max(worst[k], performance.now() - t0);
      if (round === 0) feat.push({ length: t.length, kind: t.kind, finishAlong: t.finish ? t.finish.along : null, corners: t.corners.map(c => ({ type: c.type, bank: c.bank })), bridges: (t.bridges || []).length, clips: (t.clips || []).length, difficulty: t.difficulty, attempts: t.attempts, fallback: !!t.fallback, version: t.version });
    }
    return { worst, feat };
  }, specs);
  const rows = [];
  for (let k = 0; k < specs.length; k++) {
    const spec = specs[k], f = gen.feat[k];
    const t = { kind: f.kind, length: f.length, finish: f.finishAlong === null ? null : { along: f.finishAlong }, corners: f.corners, bridges: Array(f.bridges).fill(0), clips: Array(f.clips).fill(0), difficulty: f.difficulty, attempts: f.attempts, fallback: f.fallback };
    const m = { seed: spec.seed, genMs: Math.round(gen.worst[k]), ...features(t) };
    /* the readability rule is plain data: checked in Node on the same generator output */
    m.occlusion = occlusionOf(generateTrack(spec.seed, { kind: spec.kind, difficulty: spec.difficulty, length: spec.length, ...(spec.options || {}) }));
    m.careful = await drive(page, spec, DRIVERS.careful);
    m.drifter = await drive(page, spec, DRIVERS.drifter);
    const fails = check(m, spec);
    const known = k >= CAREER.length ? rejected[k - CAREER.length] : null;
    rows.push({ index: spec.index, name: spec.name, chapter: CHAPTERS[spec.chapter].name, settings: { difficulty: spec.difficulty, length: spec.length, style: CAREER[spec.index].style || 'mixed', crossover: CAREER[spec.index].crossover || 'default' }, rejectedSeed: !!known, nodeFails: known ? known.nodeFails : undefined, ...m, fails });
    const r = rows[rows.length - 1];
    console.log((known ? 'rejected ' : '') + r.index + ' ' + r.name + ' seed ' + r.seed + ': ' + (fails.length ? fails.join(', ') : 'ok') + ' [gen ' + r.genMs + ' ms, ' + r.runMetres + ' m, ' + r.corners + ' corners, ' + r.banked + ' banked, ' + r.bridges + ' bridges; careful ' + r.careful.seconds + ' s ' + r.careful.score + '/' + (r.careful.targets || [])[0] + ' ' + r.careful.stars + ' stars ' + r.careful.contacts + ' contacts ' + r.careful.respawns + ' resp; drifter ' + r.drifter.seconds + ' s ' + r.drifter.score + ' ' + r.drifter.stars + ' stars ' + r.drifter.respawns + ' resp]');
  }
  const career = rows.filter(r => !r.rejectedSeed), known = rows.filter(r => r.rejectedSeed);
  const byChapter = CHAPTERS.map((ch, c) => {
    const rs = career.filter(r => r.index >= ch.from && r.index < ch.to), sum = f => rs.reduce((a, r) => a + f(r), 0), mean = f => +(sum(f) / rs.length).toFixed(1);
    const circ = rs.filter(r => r.kind === 'circuit'), spr = rs.filter(r => r.kind === 'sprint');
    return { chapter: ch.name, circuitRunMetres: Math.round(circ.reduce((a, r) => a + r.runMetres, 0) / circ.length), sprintRunMetres: Math.round(spr.reduce((a, r) => a + r.runMetres, 0) / spr.length), corners: sum(r => r.corners), banked: sum(r => r.banked), bankedShare: +(sum(r => r.banked) / sum(r => r.corners)).toFixed(2), bridges: sum(r => r.bridges), figureEights: rs.filter(r => r.kind === 'circuit' && r.bridges > 0).length, hairpins: sum(r => r.hairpins), technicalOrHairpinStyles: rs.filter(r => /technical|hairpins/.test(r.settings.style)).length, askedDifficulty: mean(r => r.settings.difficulty), measuredDifficulty: +(sum(r => r.measuredDifficulty) / rs.length).toFixed(2), carefulSeconds: mean(r => r.careful.seconds), drifterSeconds: mean(r => r.drifter.seconds), worstGenMs: Math.max(...rs.map(r => r.genMs)) };
  });
  console.log(JSON.stringify(byChapter));
  R.writeJson(path.join(reviewDir, 'tracks.json'), { started, rule: 'seeds.js check: nothing occludes the road in any theme, no plain layout, a bridge where a crossover is asked, generation under ' + GEN_MS + ' ms, both drivers finish with 0 respawns, the careful driver clean with a star, banked corners at least ' + BANKED_MIN.join(' / ') + ' by chapter', tracks: career, byChapter, knownAnswer: known, errors: side.errors });
  verdict('all 24 career tracks pass the check in the page (both drivers finish with 0 respawns, the careful driver clean with at least one star, generated under 600 ms, nothing occluding the road, the chapter\'s banks)', career.every(r => r.fails.length === 0), career.filter(r => r.fails.length).map(r => r.index + ' ' + r.name + ': ' + r.fails.join(', ')).join('; ') || career.length + ' of 24');
  verdict('known answer: every seed the search rejected fails the check in the page too', known.length >= 2 && known.every(r => r.fails.length > 0), known.map(r => r.seed + ' (' + r.name + '): ' + (r.fails.join(', ') || 'PASSED')).join('; '));
  const step = (a, b, f) => f(byChapter[b]) > f(byChapter[a]);
  verdict('each chapter a step up from the one before: longer runs, more banks, more figure eights, more technical and hairpin styles, harder asked', [0, 1].every(a => step(a, a + 1, c => c.circuitRunMetres + c.sprintRunMetres) && step(a, a + 1, c => c.banked) && step(a, a + 1, c => c.figureEights) && step(a, a + 1, c => c.technicalOrHairpinStyles) && step(a, a + 1, c => c.askedDifficulty)), byChapter.map(c => c.chapter + ' runs ' + c.circuitRunMetres + ' / ' + c.sprintRunMetres + ' m, banked ' + c.banked + ', eights ' + c.figureEights + ', styles ' + c.technicalOrHairpinStyles + ', difficulty ' + c.askedDifficulty).join('; '));
  const stepped = (a, b) => step(a, b, c => c.circuitRunMetres + c.sprintRunMetres) && step(a, b, c => c.banked) && step(a, b, c => c.figureEights) && step(a, b, c => c.technicalOrHairpinStyles) && step(a, b, c => c.askedDifficulty);
  verdict('known answer: the same comparison read backwards (Legend, then Pro, then Rookie) fails', !stepped(2, 1) && !stepped(1, 0), '');
  verdict('no page errors', side.errors.length === 0, side.errors.slice(0, 2).join(' | '));
  await side.close();
}

/* ---- 2. the ladder ---- */
/* The rules as the brief writes them, again, here: a chapter's first
   track opens with OPEN[c] stars in the chapter before (the first track
   of all is always open); any other opens with a star on the one before. */
function oracle(career, open, i) {
  const c = Math.floor(i / 8);
  if (i === 0) return true;
  if (i % 8 === 0) { let n = 0; for (let k = (c - 1) * 8; k < c * 8; k++) n += (career[k] || { stars: 0 }).stars; return n >= open[c]; }
  return !!career[i - 1] && career[i - 1].stars >= 1;
}
if (run('ladder')) {
  console.log('\n== 2. ladder');
  const side = await openWith(R.SMALL, { query: 'title=1' });
  const { page } = side;
  const OPEN = LOOP.CHAPTERS.OPEN;
  const fixed = await page.evaluate(OPEN => {
    const Lp = window.__loop, S = Lp.save, open = i => Lp.careerUnlocked(S.state, i), r = {};
    S.reset(); window.__feel.draw = false;
    r.fresh = Array.from({ length: 24 }, (_, i) => open(i));
    /* OPEN[1] - 1 Rookie stars, spread over the first tracks (so every Rookie track up to them is open) */
    const give = (from, n) => { let k = from; while (n > 0) { const s = Math.min(3, n); S.careerResult(k, s, 100); n -= s; k++; } };
    give(0, OPEN[1] - 1);
    r.proShort = { track8: open(8), track9: open(9) };
    Lp.action('play-career', '8'); r.refused = Lp.app.state !== 'countdown';
    Lp.action('title');
    give(7, 1);  // one more, on the last Rookie track
    r.proOpen = { track8: open(8), track9: open(9), track16: open(16) };
    S.careerResult(8, 1, 100); r.inChapter = { track9: open(9), track10: open(10) };
    /* OPEN[2] - 1 Pro stars */
    S.reset(); give(0, 24); give(8, OPEN[2] - 1);
    r.legendShort = { track16: open(16) };
    give(15, 1);
    r.legendOpen = { track16: open(16), track17: open(17) };
    Lp.action('play-career', '16'); r.startsWhenOpen = Lp.app.state === 'countdown' && Lp.app.spec.index === 16;
    Lp.action('title'); S.reset();
    return r;
  }, OPEN);
  const fixedOk = fixed.fresh[0] && fixed.fresh.slice(1).every(v => !v) && !fixed.proShort.track8 && fixed.refused && fixed.proOpen.track8 && !fixed.proOpen.track9 && !fixed.proOpen.track16 && fixed.inChapter.track9 && !fixed.inChapter.track10 && !fixed.legendShort.track16 && fixed.legendOpen.track16 && !fixed.legendOpen.track17 && fixed.startsWhenOpen;
  verdict('fixed cases: a fresh save opens track 1 only; ' + (OPEN[1] - 1) + ' Rookie stars keep Pro locked and its first track refuses to play; ' + OPEN[1] + ' open Pro 1 and only it; a star on Pro 1 opens Pro 2; ' + (OPEN[2] - 1) + ' Pro stars keep Legend locked, ' + OPEN[2] + ' open it and it plays', fixedOk, JSON.stringify(fixed));
  /* random saves */
  let rng = 0x9e3779b9;
  const rand = () => { rng ^= rng << 13; rng >>>= 0; rng ^= rng >>> 17; rng ^= rng << 5; rng >>>= 0; return rng / 4294967296; };
  const saves = [];
  for (let k = 0; k < 2000; k++) {
    const career = {}, bias = rand();
    for (let i = 0; i < 24; i++) if (rand() < 0.4 + bias * 0.6) career[i] = { stars: Math.floor(rand() * 4), best: 100 };
    saves.push(career);
  }
  const game = await page.evaluate(saves => saves.map(c => { const st = { career: Object.fromEntries(Object.entries(c).map(([k, v]) => [String(k), v])) }; return Array.from({ length: 24 }, (_, i) => window.__loop.careerUnlocked(st, i)); }), saves);
  let disagree = 0, offByOne = 0, opened = { pro: 0, legend: 0 };
  for (let k = 0; k < saves.length; k++) for (let i = 0; i < 24; i++) {
    const want = oracle(saves[k], OPEN, i);
    if (want !== game[k][i]) disagree++;
    if (oracle(saves[k], [0, OPEN[1] + 1, OPEN[2] + 1], i) !== game[k][i]) offByOne++;
    if (want && i === 8) opened.pro++; if (want && i === 16) opened.legend++;
  }
  verdict('2,000 random saves: careerUnlocked agrees with the rules on every track', disagree === 0, disagree + ' disagreements of 48,000; Pro open in ' + opened.pro + ', Legend in ' + opened.legend);
  verdict('known answer: the rules with OPEN one higher disagree with the game', offByOne > 0, offByOne + ' disagreements');
  /* the career screen's rows on 40 of them */
  let rowsWrong = 0, rowsChecked = 0, headsWrong = 0;
  for (let k = 0; k < 40; k++) {
    const shown = await page.evaluate(c => { const S = window.__loop.save; S.reset(); for (const [i, e] of Object.entries(c)) S.careerResult(+i, e.stars, e.best); window.__loop.action('career'); return { rows: [...document.querySelectorAll('.career .row')].map(b => !b.disabled), heads: [...document.querySelectorAll('.career .chapter')].map(s => ({ locked: s.classList.contains('locked'), text: s.querySelector('.chead small').textContent })) }; }, saves[k]);
    for (let i = 0; i < 24; i++) { rowsChecked++; if (shown.rows[i] !== oracle(saves[k], OPEN, i)) rowsWrong++; }
    for (let c = 1; c < 3; c++) { let n = 0; for (let i = (c - 1) * 8; i < c * 8; i++) n += (saves[k][i] || { stars: 0 }).stars; const locked = n < OPEN[c], need = OPEN[c] - n; const h = shown.heads[c]; if (h.locked !== locked || (locked && !h.text.startsWith(need + ' more '))) headsWrong++; }
  }
  verdict('the career screen on 40 random saves: every row enabled exactly when the rules open it, every locked chapter says how many more stars', rowsWrong === 0 && headsWrong === 0 && rowsChecked === 960, rowsWrong + ' rows wrong of ' + rowsChecked + ', ' + headsWrong + ' chapter heads wrong');
  verdict('no page errors', side.errors.length === 0, side.errors.slice(0, 2).join(' | '));
  R.writeJson(path.join(reviewDir, 'ladder.json'), { started, open: OPEN, fixed, random: { saves: saves.length, disagree, offByOne, opened }, screen: { saves: 40, rowsChecked, rowsWrong, headsWrong }, errors: side.errors });
  await side.close();
}

/* ---- 3. saves ---- */
if (run('saves')) {
  console.log('\n== 3. saves');
  const out = {};
  const KEEP = ['coins', 'car', 'cars', 'career', 'daily', 'ghosts', 'starPay', 'onboarded', 'missions', 'lab'];
  for (const n of [12, 11]) {
    const file = JSON.parse(fs.readFileSync(path.join(reviewDir, 'main-save-' + n + '.json'), 'utf8'));
    const blob = JSON.parse(file.blob);
    const side = await openWith(R.SMALL, { blob: file.blob, key: file.key });
    const { page } = side;
    const st = await page.evaluate(() => ({ state: window.__loop.app.state, status: JSON.parse(JSON.stringify(window.__loop.save.status)), save: JSON.parse(JSON.stringify(window.__loop.save.state)), button: (document.querySelector('[data-action="career"] small') || {}).textContent || '' }));
    const kept = KEEP.filter(k => JSON.stringify(st.save[k]) !== JSON.stringify(blob[k]));
    await page.evaluate(() => window.__loop.action('career'));
    const screen = await page.evaluate(() => { const list = document.querySelector('.career .list'), lr = list.getBoundingClientRect(); return { rows: [...document.querySelectorAll('.career .row')].map(b => !b.disabled), heads: [...document.querySelectorAll('.career .chapter')].map(s => { const h = s.querySelector('.chead').getBoundingClientRect(); return { locked: s.classList.contains('locked'), text: s.querySelector('.chead small').textContent, inView: h.top >= lr.top - 0.5 && h.bottom <= lr.bottom + 0.5 }; }) }; });
    const r = out['stars' + n] = { from: file.from, rookieStars: file.rookieStars, title: st.state, button: st.button, repaired: st.status.repaired, changed: kept, rows: screen.rows.map(v => v ? 1 : 0).join(''), heads: screen.heads };
    if (n === 12) {
      verdict('a save from main with 12 Rookie stars loads with everything kept, 0 fixes, the title first', st.state === 'title' && st.status.loaded && st.status.repaired === 0 && kept.length === 0, 'changed: [' + kept.join(', ') + '], fixes ' + st.status.repaired + ', the career button "' + st.button + '"');
      verdict('and Pro is open on the first visit: Pro 1 playable, Pro 2 not, Legend locked with "' + screen.heads[2].text + '", the screen opened at Pro', screen.rows[8] && !screen.rows[9] && !screen.heads[1].locked && screen.heads[2].locked && /^14 more Pro stars to open Legend$/.test(screen.heads[2].text) && screen.heads[1].inView, r.rows);
      /* it plays: Pro 1 with the careful driver, a star, Pro 2 opens; the old ghost on career 1 still drives */
      const pro = await drive(page, { ...careerSpec(8) }, DRIVERS.careful, false);
      const after = await page.evaluate(() => ({ open9: window.__loop.careerUnlocked(window.__loop.save.state, 9), career0: window.__loop.save.state.career['0'] }));
      await page.evaluate(() => { window.__loop.startRun(window.__loop.careerSpec(0)); });
      const ghost = await page.evaluate(() => !!window.__loop.app.ghost);
      await page.evaluate(() => window.__loop.action('title'));
      r.pro = { ...pro, open9: after.open9, oldGhostDrives: ghost };
      verdict('then Pro 1 plays to a star and opens Pro 2, the Rookie results kept and the old ghost still driving', pro.finished && pro.stars >= 1 && after.open9 && JSON.stringify(after.career0) === JSON.stringify(blob.career['0']) && ghost, 'score ' + pro.score + ', stars ' + pro.stars + ', unlock "' + (pro.unlock && pro.unlock.text) + '", note "' + (pro.note && pro.note.text) + '"');
    } else {
      verdict('known answer: the save from main with 11 Rookie stars keeps Pro locked ("' + screen.heads[1].text + '"), everything kept, the screen at Rookie', !screen.rows[8] && screen.heads[1].locked && screen.heads[1].text === '1 more Rookie star to open Pro' && screen.heads[0].inView && kept.length === 0 && st.status.repaired === 0, r.rows);
    }
    r.errors = side.errors;
    verdict('no page errors (' + n + ' stars)', side.errors.length === 0, side.errors.slice(0, 2).join(' | '));
    await side.close();
  }
  /* a corrupted save */
  {
    const bad = JSON.stringify({ v: 1, coins: 50, career: { '0': { stars: 3, best: 900 }, '1': { stars: 'three', best: 5 }, '8': { stars: 9, best: 200 }, '30': { stars: 3, best: 10 }, 'x': { stars: 1, best: 1 } }, missions: { 'career:9': [1, 0, 1], 'career:12': [1, 'x', 0], 'career:99': [1, 1, 1] }, ghosts: { 'career:8': { score: 5, steps: 2, car: 'starter', tape: [[1, 0, 1, 0, 0], [1, 'x', 1, 0, 0]] } }, onboarded: true, starPay: true });
    const side = await openWith(R.SMALL, { blob: bad });
    const { page } = side;
    const st = await page.evaluate(() => ({ status: JSON.parse(JSON.stringify(window.__loop.save.status)), career: JSON.parse(JSON.stringify(window.__loop.save.state.career)), missions: JSON.parse(JSON.stringify(window.__loop.save.state.missions)) }));
    await page.evaluate(() => window.__loop.action('career'));
    const rows = await page.evaluate(() => [...document.querySelectorAll('.career .row')].map(b => b.disabled ? 0 : 1).join(''));
    const runR = await drive(page, careerSpec(1), DRIVERS.careful, false);
    await page.evaluate(() => window.__loop.action('career'));
    const rows2 = await page.evaluate(() => document.querySelectorAll('.career .row').length);
    out.corrupted = { status: st.status, career: st.career, missions: st.missions, rows, run: runR, rowsAfter: rows2, errors: side.errors };
    verdict('a corrupted save loads repaired, the career shows 24 rows (Pro locked on 3 Rookie stars), a track plays to its results, no page errors', st.status.repaired > 0 && st.career['8'].stars === 3 && !st.career['1'] && rows.length === 24 && rows[8] === '0' && runR.finished && rows2 === 24 && side.errors.length === 0, st.status.repaired + ' fixes, rows ' + rows + ', run ' + runR.score);
    await side.close();
  }
  /* storage that throws */
  {
    const side = await openWith(R.SMALL, { throwing: true });
    const { page } = side;
    const first = await page.evaluate(() => ({ state: window.__loop.app.state, available: window.__loop.save.status.available }));
    const runR = await drive(page, careerSpec(0), DRIVERS.drifter, false);
    await page.evaluate(() => window.__loop.action('career'));
    const rows = await page.evaluate(() => [...document.querySelectorAll('.career .row')].map(b => b.disabled ? 0 : 1).join(''));
    out.throwing = { first, run: runR, rows, errors: side.errors };
    verdict('storage that throws: the first visit lands in a run, a run finishes, the career shows 24 rows with the next track open, no page errors', first.state === 'countdown' && !first.available && runR.finished && rows.length === 24 && (runR.stars < 1 || rows[1] === '1') && side.errors.length === 0, 'stars ' + runR.stars + ', rows ' + rows);
    await side.close();
  }
  /* the save with a ghost on every one of the 24 tracks: the scripted drifter's tapes, which change the steering every step and compress worst (thumbs hold a button for seconds) */
  {
    const side = await openWith(R.SMALL, { query: 'title=1' });
    const { page } = side;
    for (let i = 0; i < CAREER.length; i++) await drive(page, careerSpec(i), DRIVERS.drifter, i === 0);
    const size = await page.evaluate(() => { const S = window.__loop.save; const blob = localStorage.getItem(S.KEY) || ''; return { ghosts: Object.keys(S.state.ghosts).filter(k => k.startsWith('career:')).length, chars: blob.length, stored: blob.length > 0 && blob === JSON.stringify(S.state), failedWrites: S.status.failedWrites, writes: S.status.writes }; });
    out.fullCareer = { ...size, errors: side.errors };
    verdict('a ghost on all 24 tracks: the save is written whole, no write failed (' + (size.chars / 1e6).toFixed(2) + ' million characters)', size.ghosts === 24 && size.stored && size.failedWrites === 0 && side.errors.length === 0, size.writes + ' writes, ' + size.ghosts + ' career ghosts');
    await side.close();
  }
  R.writeJson(path.join(reviewDir, 'saves.json'), { started, ...out });
}

/* ---- 4. the screens ---- */
/* Every box on the career screen, in the page: the header's parts and
   the coin badge, and inside the list every chapter head and every row
   (and inside each row its number, name and stars or lock), each cut to
   the list's box. At every scroll position in 24 px steps no two visible
   boxes may meet (a row and its own parts aside), and nothing in the
   list may meet the header or the badge. Then every row scrolled into
   view must be what document.elementFromPoint finds at its centre. */
const CAREER_LAYOUT_SRC = `
  const screen = document.querySelector('.screen.career'), list = screen.querySelector('.list');
  const R = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const meets = (a, b) => a && b && a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  const cut = (r, c) => { const o = { left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) }; return o.right > o.left && o.bottom > o.top ? o : null; };
  const fixed = [...screen.querySelectorAll('header .back, header h2, header .tally'), screen.querySelector('.coins')].filter(Boolean);
  const heads = [...list.querySelectorAll('.chead')], rows = [...list.querySelectorAll('.row')];
  const start = list.scrollTop;
  let meetings = [], positions = 0, inside = 0;
  const vp = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  for (const f of fixed) for (const g of fixed) if (f !== g && f.compareDocumentPosition(g) & 4 && meets(R(f), R(g))) meetings.push(f.className + ' / ' + g.className);
  for (const f of fixed) { const r = R(f); if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) inside++; }
  const max = list.scrollHeight - list.clientHeight;
  for (let y = 0; y <= max + 24; y += 24) {
    list.scrollTop = Math.min(y, max); positions++;
    const L = R(list);
    const boxes = heads.concat(rows).map(el => ({ el, r: cut(R(el), L) })).filter(b => b.r);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) if (meets(boxes[i].r, boxes[j].r)) meetings.push('at ' + list.scrollTop + ': ' + (boxes[i].el.textContent.trim().slice(0, 20)) + ' / ' + (boxes[j].el.textContent.trim().slice(0, 20)));
      for (const f of fixed) if (meets(boxes[i].r, R(f))) meetings.push('at ' + list.scrollTop + ': ' + boxes[i].el.textContent.trim().slice(0, 20) + ' under ' + f.className);
    }
    for (const row of rows) { const parts = [...row.querySelectorAll(':scope > span')].map(R); for (let i = 0; i < parts.length; i++) { for (let j = i + 1; j < parts.length; j++) if (meets(parts[i], parts[j])) meetings.push('inside ' + row.textContent.trim().slice(0, 20)); const rr = R(row); if (parts[i].left < rr.left - 0.5 || parts[i].right > rr.right + 0.5) meetings.push('outside ' + row.textContent.trim().slice(0, 20)); } }
  }
  list.scrollTop = start;
  const unreachable = [];
  for (const row of rows) { row.scrollIntoView({ block: 'nearest' }); const r = R(row); const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); if (!hit || !(hit === row || row.contains(hit))) unreachable.push(row.dataset.arg); }
  list.scrollTop = start;
  return { positions, meetings: [...new Set(meetings)].slice(0, 12), meetingCount: meetings.length, fixedOutside: inside, unreachable, rows: rows.length, rowHeight: rows.length ? Math.round(R(rows[0]).bottom - R(rows[0]).top) : 0, listHeight: Math.round(list.clientHeight), ok: meetings.length === 0 && inside === 0 && unreachable.length === 0 && rows.length === 24 };
`;
/* Is chapter c's head, and the first row under it, inside the list's box as the screen opened. */
const CURRENT_SRC = `
  const list = document.querySelector('.career .list'), L = list.getBoundingClientRect();
  const sec = list.querySelector('.chapter[data-chapter="' + extra.c + '"]'), h = sec.querySelector('.chead').getBoundingClientRect(), r = sec.querySelector('.row').getBoundingClientRect();
  return { scrollTop: list.scrollTop, head: h.top >= L.top - 0.5 && h.bottom <= L.bottom + 0.5, firstRow: r.top >= L.top - 0.5 && r.bottom <= L.bottom + 0.5 };
`;
/* The results card: no two of its parts meet, each inside the card, the
   buttons reachable. */
const CARD_SRC = `
  const s = document.querySelector('#screens.on .screen.results'); if (!s) return null;
  const card = s.querySelector('.card'), C = card.getBoundingClientRect();
  const parts = [...card.children].filter(e => e.getBoundingClientRect().height > 0);
  const R = el => el.getBoundingClientRect(), meets = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  const meetings = [];
  for (let i = 0; i < parts.length; i++) { for (let j = i + 1; j < parts.length; j++) if (meets(R(parts[i]), R(parts[j]))) meetings.push(parts[i].className + ' / ' + parts[j].className); const r = R(parts[i]); if (r.left < C.left - 0.5 || r.right > C.right + 0.5) meetings.push(parts[i].className + ' outside the card'); }
  const coins = document.querySelector('#screens .coins'); if (coins) for (const p of parts) if (meets(R(p), R(coins))) meetings.push(p.className + ' under the coins');
  const buttons = [...card.querySelectorAll('button')], unreachable = [];
  for (const b of buttons) { b.scrollIntoView({ block: 'nearest' }); const r = R(b); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!hit || !(hit === b || b.contains(hit))) unreachable.push(b.dataset.action); }
  document.getElementById('screens').scrollTop = 0;
  const u = card.querySelector('.unlock'), n = card.querySelector('.chapnote'), next = card.querySelector('[data-action="play-career"]');
  return { label: (card.querySelector('.runlabel') || {}).textContent || '', unlock: u ? u.textContent.trim() : '', unlockDone: u ? u.classList.contains('done') : null, note: n ? n.textContent.trim() : '', next: next ? next.dataset.arg : null, nextPrimary: next ? next.classList.contains('primary') : false, scrolls: document.getElementById('screens').scrollHeight > innerHeight + 1, meetings, unreachable, ok: meetings.length === 0 && unreachable.length === 0 };
`;
const evalSrc = (page, src, extra) => page.evaluate(({ src, extra }) => new Function('extra', src)(extra), { src, extra: extra || null });
async function shot(page, name) {
  await page.evaluate(() => { window.__feel.draw = true; });
  await R.runFrames(page, 2, 'return 0;');
  await page.screenshot({ path: path.join(shots, name + '.png'), timeout: 240000 });
  await page.evaluate(() => { window.__feel.draw = false; });
}
/* stars spread from a track on: n stars, three a track */
const GIVE_SRC = `const S = window.__loop.save; let k = extra.from, n = extra.n; while (n > 0) { const s = Math.min(3, n); S.careerResult(k, s, 300 + k); n -= s; k++; }`;

if (run('screens')) {
  console.log('\n== 4. screens');
  const out = {};
  const CAREER_SAVES = {
    rookie: { setup: [{ from: 0, n: 5 }], current: 0 },
    pro: { setup: [{ from: 0, n: 13 }, { from: 8, n: 4 }], current: 1 },
    legend: { setup: [{ from: 0, n: 24 }, { from: 8, n: 18 }, { from: 16, n: 2 }], current: 2 },
  };
  for (const vp of SIZES) {
    const tag = tagOf(vp), touch = touchFor(vp), o = out[tag] = {};
    const side = await openWith(vp, { touch, query: 'title=1' });
    const { page } = side;
    await page.evaluate(() => { window.__feel.draw = false; });
    for (const [name, s] of Object.entries(CAREER_SAVES)) {
      await page.evaluate(() => { window.__loop.save.reset(); window.__loop.action('title'); });
      for (const g of s.setup) await evalSrc(page, GIVE_SRC, g);
      await page.evaluate(() => { const S = window.__loop.save; S.addCoins(12345); for (let i = 0; i < 20; i += 3) S.missionResult('career:' + i, [true, i % 2 === 0, true]); window.__loop.action('career'); });
      const cur = await evalSrc(page, CURRENT_SRC, { c: s.current });
      await shot(page, 'career-' + name + '-' + tag);
      const lay = await evalSrc(page, CAREER_LAYOUT_SRC);
      o['career-' + name] = { current: cur, layout: lay };
      verdict(tag + ' career, ' + name + ' current: no boxes meet at any of ' + lay.positions + ' scroll positions, all 24 rows reachable', lay.ok, lay.meetingCount + ' meetings ' + JSON.stringify(lay.meetings.slice(0, 3)) + ', unreachable ' + JSON.stringify(lay.unreachable) + ', rows ' + lay.rowHeight + ' px in a ' + lay.listHeight + ' px list');
      verdict(tag + ' career, ' + name + ' current: its head and first row in view as the screen opens', cur.head && cur.firstRow, JSON.stringify(cur));
      if (name === 'legend') {
        const top = await page.evaluate(() => { document.querySelector('.career .list').scrollTop = 0; return 0; });
        const atTop = await evalSrc(page, CURRENT_SRC, { c: 2 });
        o.knownCurrent = atTop;
        verdict(tag + ' known answer: the list left at the top does not show Legend', !atTop.head, JSON.stringify(atTop));
        /* a rule that pulls each chapter head onto its first row */
        await page.evaluate(() => { const st = document.createElement('style'); st.id = 'probe-bad'; st.textContent = '.career .chead { margin-bottom: -26px !important; }'; document.head.appendChild(st); });
        const bad = await evalSrc(page, CAREER_LAYOUT_SRC);
        await page.evaluate(() => document.getElementById('probe-bad').remove());
        o.knownLayout = { meetingCount: bad.meetingCount, sample: bad.meetings.slice(0, 3) };
        verdict(tag + ' known answer: chapter heads pulled onto their rows are seen to meet', bad.meetingCount > 0, bad.meetingCount + ' meetings');
      }
      const title = await page.evaluate(() => { window.__loop.action('title'); return document.querySelector('[data-action="career"] small').textContent; });
      const want = await page.evaluate(() => { const S = window.__loop.save.state; let st = 0, m = 0; for (let i = 0; i < 24; i++) { st += (S.career[String(i)] || { stars: 0 }).stars; for (const v of S.missions['career:' + i] || []) m += v; } return st + '/72 stars · ' + m + '/72 missions'; });
      o['title-' + name] = title;
      verdict(tag + ' the title\'s career button: "' + title + '"', title === want, 'want "' + want + '"');
      if (name === 'pro') await shot(page, 'title-' + tag);
    }
    /* the heading over a Pro countdown */
    await page.evaluate(() => { window.__loop.save.reset(); window.__loop.startRun(window.__loop.careerSpec(10)); });
    await R.runFrames(page, 60, 'return 0;');
    await page.waitForTimeout(600);   // the box fades in over 0.3 s of real time
    const box = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden || (!e.offsetParent && getComputedStyle(e).position !== 'fixed')) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null; }, sel);
    const head = await page.evaluate(() => { const m = document.getElementById('missions'); return { shown: !m.hidden, label: (m.querySelector('i') || {}).textContent || '', name: (m.querySelector('strong') || {}).textContent || '', state: window.__loop.app.state }; });
    const hb = await box('#missions'), others = { score: await box('#total'), left: await box('#touch button[data-b="left"]'), right: await box('#touch button[data-b="right"]'), hb: await box('#touch button[data-b="hb"]'), exit: await box('#exit'), lap: await box('#runinfo'), speed: await box('#readout') };
    const meet = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const hits = Object.entries(others).filter(([, b]) => meet(hb, b)).map(([k]) => k);
    const inside = hb && hb.left >= 0 && hb.top >= 0 && hb.right <= vp.width && hb.bottom <= vp.height;
    await shot(page, 'heading-pro-' + tag);
    o.heading = { head, box: hb, hits };
    verdict(tag + ' the countdown heading names the chapter: "' + head.label + '" "' + head.name + '"', head.shown && head.state === 'countdown' && head.label === 'CAREER · PRO · TRACK 3 OF 8' && head.name === CAREER[10].name, '');
    verdict(tag + ' and it lies inside the view, clear of the score, the lap and clock, the speed, the pads and the exit', inside && hits.length === 0, JSON.stringify(hits));
    /* the results of a run that opens Pro: OPEN[1] - 1 Rookie stars on the first tracks, then a careful clean run on the next open one */
    for (const known of [false, true]) {
      const short = known ? 2 : 1;
      await page.evaluate(() => { window.__loop.save.reset(); window.__loop.action('title'); });
      await evalSrc(page, GIVE_SRC, { from: 0, n: LOOP.CHAPTERS.OPEN[1] - short });
      const idx = await page.evaluate(() => { const S = window.__loop.save.state; let i = 0; while (S.career[String(i)]) i++; return i; });
      const r = await drive(page, careerSpec(idx), DRIVERS.careful, false);
      await page.evaluate(() => { window.__feel.draw = true; });
      await R.runFrames(page, 2, 'return 0;');
      const card = await evalSrc(page, CARD_SRC);
      await page.screenshot({ path: path.join(shots, (known ? 'results-short-' : 'results-pro-') + tag + '.png'), timeout: 240000 });
      await page.evaluate(() => { window.__feel.draw = false; });
      o[known ? 'resultsShort' : 'resultsPro'] = { track: idx, run: { score: r.score, stars: r.stars }, card };
      const lay = card && card.ok;
      if (!known) verdict(tag + ' a star that makes ' + LOOP.CHAPTERS.OPEN[1] + ' Rookie stars: "' + (card && card.unlock) + '", "' + (card && card.note) + '", NEXT to Pro 1 and primary', r.stars === 1 && card && card.unlock === '\u{1F513} Pro unlocked: ' + CAREER[8].name && card.unlockDone && card.next === '8' && card.nextPrimary, 'track ' + (idx + 1));
      else verdict(tag + ' known answer, one star fewer: "' + (card && card.unlock) + '", "' + (card && card.note) + '", NEXT to the next Rookie track', r.stars === 1 && card && !/Pro unlocked/.test(card.unlock) && card.note === '1 more Rookie star to open Pro' && card.next === String(idx + 1), 'track ' + (idx + 1));
      verdict(tag + ' the card\'s parts do not meet and every button is reachable' + (known ? ' (short)' : ''), lay, card && JSON.stringify(card.meetings) + ' ' + JSON.stringify(card.unreachable) + ', scrolls ' + card.scrolls);
    }
    /* the last Rookie track with Pro still locked: the shortfall and no NEXT */
    await page.evaluate(() => { window.__loop.save.reset(); window.__loop.action('title'); });
    await evalSrc(page, GIVE_SRC, { from: 0, n: 3 });
    const last = await drive(page, careerSpec(7), DRIVERS.careful, false);
    const lastCard = await evalSrc(page, CARD_SRC);
    o.resultsLast = { run: { score: last.score, stars: last.stars }, card: lastCard };
    verdict(tag + ' the last Rookie track with Pro locked: "' + (lastCard && lastCard.note) + '", no NEXT', lastCard && lastCard.note === (LOOP.CHAPTERS.OPEN[1] - 3 - last.stars) + ' more Rookie stars to open Pro' && lastCard.next === null && lastCard.ok, JSON.stringify(lastCard && lastCard.meetings));
    verdict(tag + ' no page errors', side.errors.length === 0, side.errors.slice(0, 2).join(' | '));
    o.errors = side.errors;
    await side.close();
  }
  R.writeJson(path.join(reviewDir, 'screens.json'), { started, ...out });
}

/* ---- 5. perf ---- */
if (run('perf')) {
  console.log('\n== 5. perf');
  const FRAMES = 420, WARM = 30, BUDGET = 16.7;
  /* the longest Legend track by run metres */
  const side0 = await openWith(R.SMALL, { query: 'title=1' });
  const lengths = await side0.page.evaluate(specs => specs.map(s => { const t = window.__loop.trackFor(s); return t.kind === 'circuit' ? t.length * window.__loop.LOOP.LAPS : t.finish.along; }), CAREER.map((_, i) => careerSpec(i)).slice(16));
  await side0.close();
  const longest = 16 + lengths.indexOf(Math.max(...lengths));
  async function measure(index, throttle, loadMs, skipSeconds) {
    const side = await openWith(R.PORTRAIT, { query: 'title=1' });
    const { page } = side;
    /* a ghost first, so the measured run has one */
    await drive(page, careerSpec(index), DRIVERS.drifter, true);
    const hasGhost = await page.evaluate(i => !!window.__loop.save.ghost('career:' + i), index);
    await page.evaluate(i => { window.__loop.startRun(window.__loop.careerSpec(i)); window.__feel.setDriver({ drift: '*' }); window.__feel.draw = false; }, index);
    await R.runFrames(page, 200, 'return 0;');
    if (skipSeconds) await R.runFrames(page, skipSeconds * 60, 'return 0;');
    const cdp = await side.context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.evaluate(({ loadMs }) => {
      const F = window.__feel; F.draw = true;
      if (loadMs) { const step = F.world.stepWorld; F.world.stepWorld = inp => { const t0 = performance.now(); let g = 0; while (performance.now() - t0 < loadMs / 2 && g++ < 1e9) {} return step(inp); }; }
    }, { loadMs: loadMs || 0 });
    const frames = await R.runFrames(page, FRAMES, 'return { ms: F.info().frameMs, phys: F.info().physMs, submit: F.scene.info().submitMs, steps: F.info().steps, ghost: !!window.__loop.ghostState() && !window.__loop.ghostState().done, state: window.__loop.app.state, along: F.world.along };');
    const info = await page.evaluate(() => window.__feel.scene.info());
    const track = await page.evaluate(() => ({ name: window.__loop.app.track.name, length: window.__loop.app.track.length, kind: window.__loop.app.track.kind }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await side.close();
    const body = frames.slice(WARM);
    return { index, name: CAREER[index].name, throttle, loadMs: loadMs || 0, skipSeconds: skipSeconds || 0, track, along: [Math.round(body[0].along), Math.round(body[body.length - 1].along)], hasGhost, ghostFrames: body.filter(f => f.ghost).length, driving: body.filter(f => f.state === 'drive').length, backend: info.backend, tier: info.tier, drawCalls: info.drawCalls, jsWithoutSubmit: R.stat(body.map(f => f.ms - f.submit)), physics: R.stat(body.map(f => f.phys)), frame: R.stat(body.map(f => f.ms)), submit: R.stat(body.map(f => f.submit)), errors: side.errors };
  }
  const runs = [];
  for (const [index, skip] of [[0, 0], [longest, 0], [0, 40], [longest, 60]]) {
    const r = await measure(index, 6, 0, skip);
    runs.push(r);
    console.log(r.name + (skip ? ' (after ' + skip + ' s)' : ' (from GO)') + ' at 6x: JS without submit p95 ' + r.jsWithoutSubmit.p95 + ' worst ' + r.jsWithoutSubmit.worst + ' ms; physics p95 ' + r.physics.p95 + '; ghost in ' + r.ghostFrames + ' frames; along ' + r.along.join(' to ') + ' m; ' + r.backend + ' ' + r.tier + ', ' + r.drawCalls + ' draw calls');
  }
  const loaded = await measure(longest, 6, 20, 0);
  const rookie = runs.filter(r => r.index === 0), legend = runs.filter(r => r.index === longest);
  const worstP95 = rs => Math.max(...rs.map(r => r.jsWithoutSubmit.p95));
  const NOISE = 1.5;
  verdict('JavaScript p95 at 6x on the longest Legend track (' + CAREER[longest].name + ', ' + Math.max(...lengths) + ' m of run) under 16.7 ms with a ghost running', legend.every(r => r.jsWithoutSubmit.p95 < BUDGET && r.hasGhost && r.ghostFrames > 0), legend.map(r => r.jsWithoutSubmit.p95 + ' ms (worst ' + r.jsWithoutSubmit.worst + ')').join(', '));
  verdict('and within ' + NOISE + ' ms of Rookie 1 measured the same way', worstP95(legend) - worstP95(rookie) <= NOISE, 'Legend ' + worstP95(legend) + ' against Rookie 1 ' + worstP95(rookie) + ' ms');
  verdict('known answer: 20 ms of busy work per frame fails the budget', loaded.jsWithoutSubmit.p95 >= BUDGET, loaded.jsWithoutSubmit.p95 + ' ms');
  R.writeJson(path.join(reviewDir, 'perf.json'), { started, note: 'headless Chromium, forced WebGL 2 on SwiftShader, 390x844, low tier; JS without submit is the frame less renderer.render', longest: { index: longest, name: CAREER[longest].name, runMetres: Math.max(...lengths) }, runs, knownAnswer: loaded });
}

await env.close();
console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exit(failed ? 1 : 0);
