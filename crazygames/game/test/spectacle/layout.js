/* SPECTACLE MEASURE 6: LAYOUT. At 390x844, 844x390, 800x450 and
   1280x720, by bounding boxes:
   1. The HUD mid slide with the chain at x5 (the live number at its
      biggest) and as a banked chain flies to the total: the total, the
      readout, the lap and clock, the exit, full screen and sound buttons,
      the touch pads, the live number and the flying number are inside
      the view, and none of the fixed ones overlap each other; the live
      number and the flying one overlap none of the buttons or pads.
   2. The results card of a career run with NEXT: it fits the view with
      GO AGAIN and NEXT inside it and no scrolling, and no two of its
      parts overlap.
   Known answer: the results card with ?fx=0 (main) at 844x390 must fail
   (its bottom was 526 px on a 390 px screen, review/retention/heading.json).

   node game/test/spectacle/layout.js
   Writes review/spectacle/layout.json and shots/layout-*.png. */
import path from 'node:path';
import * as S from './lib.js';

const SIZES = [S.PORTRAIT, S.PHONE_LANDSCAPE, S.SMALL, S.LANDSCAPE];
const env = await S.start();
const out = { hud: {}, results: {} };

const BOXES = `
  const box = e => { if (!e || e.hidden) return null; const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
  const q = s => box(document.querySelector(s));
  /* the total is a full width block: its box is its text's, not the block's */
  const text = s => { const e = document.querySelector(s); if (!e || !e.firstChild) return null; const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect(); return r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
  return { W: innerWidth, H: innerHeight,
    total: text('#totalN'), readout: q('#readout'), runinfo: q('#runinfo'), exit: q('#exit'), fs: q('#fs'), snd: q('#snd'),
    padL: q('#touch .pad.left'), padR: q('#touch .pad.right'), liveN: q('#live.on #liveN'), liveM: q('#live.on #liveM'), fly: q('.fly') };
`;
const meets = (a, b) => a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
const inside = (a, W, H) => !a || (a.l >= -0.5 && a.t >= -0.5 && a.r <= W + 0.5 && a.b <= H + 0.5);

/* a tape of career 1 to the line, to bring each page to its results at once */
const rec = await S.page(env, S.LANDSCAPE, '');
await S.careerRun(rec.page, 0);
await S.until(rec.page, "f.state==='results'", 60 * 200, 120);
const tape = await rec.page.evaluate(() => { const r = window.__loop.results(); let left = r.steps; const cut = []; for (const e of window.__feel.tapeCopy()) { if (left <= 0) break; const n = Math.min(e.n, left); cut.push({ ...e, n }); left -= n; } return cut; });
await rec.close();

for (const vp of SIZES) {
  const tag = S.tagOf(vp), touch = vp.width < 900 && vp !== S.SMALL;
  /* 1. the HUD */
  {
    const pg = await S.page(env, vp, '', { touch });
    const p = pg.page;
    await S.careerRun(p, 0);
    await S.slideAt(p, 5, 12);
    const mid = await p.evaluate(new Function(BOXES));
    await S.shot(p, path.join(S.shotsDir, 'layout-hud-' + tag + '.png'));
    /* to the bank: the next banked drift chain, and a frame as it flies */
    let fly = null;
    for (let k = 0; k < 60 * 20 && !fly; k += 2) { await S.runFrames(p, 2); const b = await p.evaluate(new Function(BOXES)); if (b.fly) fly = b; }
    const fixed = ['total', 'readout', 'runinfo', 'exit', 'fs', 'snd', 'padL', 'padR'];
    const clash = [];
    for (let i = 0; i < fixed.length; i++) for (let j = i + 1; j < fixed.length; j++) if (meets(mid[fixed[i]], mid[fixed[j]])) clash.push(fixed[i] + '/' + fixed[j]);
    for (const m of ['liveN', 'liveM']) for (const f of ['exit', 'fs', 'snd', 'padL', 'padR', 'readout', 'runinfo']) if (meets(mid[m], mid[f])) clash.push(m + '/' + f);
    if (fly) for (const f of ['exit', 'fs', 'snd', 'padL', 'padR', 'readout']) if (meets(fly.fly, fly[f])) clash.push('fly/' + f);
    const outside = [...fixed, 'liveN', 'liveM'].filter(k => !inside(mid[k], vp.width, vp.height));
    out.hud[tag] = { mid, fly: fly && fly.fly, clash, outside };
    S.verdict(!clash.length && !outside.length && !!mid.liveN, tag + ' HUD mid slide at x5' + (fly ? ' and as a bank flies to the total' : ' (no bank flew within 20 s)') + ': ' + (clash.length ? 'overlaps ' + clash.join(', ') : 'no overlaps') + (outside.length ? ', outside the view ' + outside.join(', ') : '') + '; live number ' + (mid.liveN ? Math.round(mid.liveN.r - mid.liveN.l) + 'x' + Math.round(mid.liveN.b - mid.liveN.t) + ' px' : 'not shown'));
    await pg.close();
  }
  /* 2. the results card */
  for (const fx of ['on', '0']) {
    if (fx === '0' && vp !== S.PHONE_LANDSCAPE) continue;
    const pg = await S.page(env, vp, fx === '0' ? 'fx=0' : '', { touch });
    const p = pg.page;
    await p.evaluate(t => { window.__loop.replayRun(window.__loop.careerSpec(0), t); }, tape);
    await S.runFrames(p, 90);
    const r = await p.evaluate(() => {
      const s = document.querySelector('#screens.on .screen.results'); if (!s) return null;
      const box = e => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
      const card = s.querySelector('.card'), again = s.querySelector('[data-action="again"]'), next = s.querySelector('[data-action="play-career"]');
      const parts = [...card.querySelectorAll(':scope > *, :scope > .col > *')].filter(e => !e.classList.contains('col') && e.getBoundingClientRect().height > 0).map(e => ({ what: e.className || e.tagName, ...box(e) }));
      const scr = document.getElementById('screens');
      return { W: innerWidth, H: innerHeight, card: box(card), again: box(again), next: next ? box(next) : null, parts, scrolls: scr.scrollHeight > scr.clientHeight + 1 || s.scrollHeight > s.clientHeight + 1 };
    });
    await p.screenshot({ path: path.join(S.shotsDir, 'layout-results-' + tag + (fx === '0' ? '-fx0' : '') + '.png'), timeout: 180000 });
    const clash = [];
    if (r) for (let i = 0; i < r.parts.length; i++) for (let j = i + 1; j < r.parts.length; j++) if (meets(r.parts[i], r.parts[j])) clash.push(r.parts[i].what + '/' + r.parts[j].what);
    const ok = r && r.next && inside(r.card, r.W, r.H) && inside(r.again, r.W, r.H) && inside(r.next, r.W, r.H) && !r.scrolls && !clash.length;
    out.results[tag + (fx === '0' ? ' fx=0' : '')] = { ...r, clash, ok };
    if (fx === 'on') S.verdict(ok, tag + ' results: card ' + (r ? Math.round(r.card.t) + ' to ' + Math.round(r.card.b) + ' of ' + r.H + ' px' : 'missing') + ', GO AGAIN bottom ' + (r ? Math.round(r.again.b) : '-') + ', NEXT bottom ' + (r && r.next ? Math.round(r.next.b) : 'none') + ', scrolls ' + (r && r.scrolls) + (clash.length ? ', overlaps ' + clash.join(', ') : ', no overlaps'));
    else S.verdict(!ok, tag + ' known answer, ?fx=0 (main): card bottom ' + (r ? Math.round(r.card.b) : '-') + ' of ' + (r && r.H) + ' px, NEXT bottom ' + (r && r.next ? Math.round(r.next.b) : 'none') + ', scrolls ' + (r && r.scrolls) + ': ' + (!ok ? 'CAUGHT' : 'MISSED'));
    await pg.close();
  }
}
S.writeJson(path.join(S.reviewDir, 'layout.json'), out);
await env.close();
console.log(S.failures() ? S.failures() + ' failed' : 'all passed');
process.exit(S.failures() ? 1 : 0);
