/* RIVALS MEASURE 6: LAYOUT. At 390x844, 844x390, 800x450 and 1280x720,
   by bounding boxes, every element inside the view and none of these
   overlapping:
   1. The battle's countdown: its heading and line, the count, the two
      totals, the readout, the lap and clock, the buttons, the pads.
   2. The HUD mid chase, the tandem counting: the same fixed elements,
      and the closeness meter, the live score and the rival's tag, which
      must not meet any button, pad, total or each other.
   3. The results, won and lost: the card fits with no scrolling,
      REMATCH, the next thing and MENU inside the view, no two parts
      meeting.
   4. The career with the rival cards: each card inside the list, its
      own parts not meeting, and no card meeting a row or a chapter head.
   Known answer: a rule pulling the rival cards 30 px up onto the row
   above makes them meet.

   node game/test/rivals/layout.js   writes review/rivals/layout.json and shots/layout-*.png */
import path from 'node:path';
import * as R from './lib.js';

const SIZES = [R.PORTRAIT, R.PHONE_LANDSCAPE, R.SMALL, R.LANDSCAPE];
const env = await R.start();
const out = { countdown: {}, hud: {}, results: {}, career: {} };
const BOXES = `
  const box = e => { if (!e || e.hidden) return null; const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
  const q = s => box(document.querySelector(s));
  const text = s => { const e = document.querySelector(s); if (!e || !e.firstChild) return null; const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect(); return r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
  return { W: innerWidth, H: innerHeight, total: text('#totalN'), vs: q('#vs'), readout: q('#readout'), runinfo: q('#runinfo'), exit: q('#exit'), fs: q('#fs'), snd: q('#snd'), padL: q('#touch .pad.left'), padR: q('#touch .pad.right'),
    heading: q('#missions'), count: text('#count'), meter: q('#meter'), liveN: q('#live.on #liveN'), liveM: q('#live.on #liveM'), tag: q('#tag'), arrow: q('#arrow'), prompt: q('#prompt1') };
`;
const meets = (a, b) => a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
const inside = (a, W, H) => !a || (a.l >= -0.5 && a.t >= -0.5 && a.r <= W + 0.5 && a.b <= H + 0.5);
const FIXED = ['total', 'vs', 'readout', 'runinfo', 'exit', 'fs', 'snd', 'padL', 'padR'];
function check(b, moving) {
  const clash = [];
  const all = [...FIXED, ...moving];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (meets(b[all[i]], b[all[j]]) && !(all[i] === 'liveN' && all[j] === 'liveM')) clash.push(all[i] + '/' + all[j]);
  const outside = all.filter(k => !inside(b[k], b.W, b.H));
  return { clash, outside };
}

/* the two tapes, recorded once: a lost battle (the careful driver) and a won one (the chase driver with the bonus raised, for this probe only) */
async function record(driver, bonus) {
  const pg = await R.page(env, R.LANDSCAPE, '');
  await pg.page.evaluate(b => { if (b) window.__loop.TANDEM.BONUS = b; }, bonus);
  await R.battleRun(pg.page, 'r1', driver);
  await R.until(pg.page, "f.state==='results'", 60 * 200, 120);
  const r = await pg.page.evaluate(() => { const r = window.__loop.results(); let left = r.steps; const cut = []; for (const e of window.__feel.tapeCopy()) { if (left <= 0) break; const n = Math.min(e.n, left); cut.push({ ...e, n }); left -= n; } return { tape: cut, won: r.won, score: r.score, rival: r.rival.total }; });
  await pg.close();
  return r;
}
const lost = await record({ drift: null }, 0), won = await record({ chase: true }, 40);
console.log('tapes: lost ' + lost.score + ' to ' + lost.rival + ' (' + (lost.won ? 'won' : 'lost') + '), won ' + won.score + ' to ' + won.rival + ' (' + (won.won ? 'won' : 'lost') + ')');

for (const vp of SIZES) {
  const tag = R.tagOf(vp), touch = vp.width < 900 && vp !== R.SMALL;
  {
    const pg = await R.page(env, vp, '', { touch });
    const p = pg.page;
    await p.evaluate(() => { const S = window.__loop.save; S.reset(); S.setOnboarded(); S.careerResult(0, 1, 500); });
    await R.battleRun(p, 'r1', { chase: true });
    await R.runFrames(p, 30);
    const cd = await p.evaluate(new Function(BOXES));
    const c1 = check(cd, ['heading', 'count']);
    out.countdown[tag] = { ...cd, ...c1 };
    await R.shot(p, path.join(R.rivalShots, 'layout-countdown-' + tag + '.png'));
    R.verdict(!c1.clash.length && !c1.outside.length && !!cd.heading && !!cd.vs, tag + ' countdown: ' + (c1.clash.length ? 'overlaps ' + c1.clash.join(', ') : 'no overlaps') + (c1.outside.length ? ', outside ' + c1.outside.join(', ') : ''));
    /* mid chase, the tandem counting */
    const f = await p.evaluate(() => { const F = window.__feel, A = window.__loop.app; for (let j = 0; j < 60 * 60; j++) { window.__clock += 1000 / 60; F.frame(window.__clock); const t = window.__loop.tandem(); if (A.state === 'drive' && t.mult > 1.3 && F.scoring.state.chain >= 1 && j > 30) return { j, mult: t.mult }; } return null; });
    await R.runFrames(p, 2);
    const hb = await p.evaluate(new Function(BOXES));
    const c2 = check(hb, ['meter', 'liveN', 'liveM', 'tag', 'arrow', 'prompt']);
    out.hud[tag] = { ...hb, ...c2, found: f };
    await R.shot(p, path.join(R.rivalShots, 'layout-hud-' + tag + '.png'));
    R.verdict(!!f && !c2.clash.length && !c2.outside.length && !!hb.meter && !!hb.liveN, tag + ' HUD mid chase, the tandem at x' + (f ? f.mult.toFixed(1) : '-') + ': ' + (c2.clash.length ? 'overlaps ' + c2.clash.join(', ') : 'no overlaps') + (c2.outside.length ? ', outside ' + c2.outside.join(', ') : '') + '; meter ' + (hb.meter ? 'shown' : 'NOT shown') + ', live score ' + (hb.liveN ? 'shown' : 'NOT shown') + ', tag ' + (hb.tag ? 'shown' : 'hidden'));
    await pg.close();
  }
  for (const [name, t, bonus] of [['won', won, 40], ['lost', lost, 0]]) {
    const pg = await R.page(env, vp, '', { touch });
    const p = pg.page;
    await p.evaluate(b => { const S = window.__loop.save; S.reset(); S.setOnboarded(); S.careerResult(0, 1, 500); if (b) window.__loop.TANDEM.BONUS = b; }, bonus);
    await p.evaluate(tape => { window.__loop.replayRun(window.__loop.battleSpec('r1'), tape); }, t.tape);
    await R.runFrames(p, 90);
    const r = await p.evaluate(() => {
      const s = document.querySelector('#screens.on .screen.results'); if (!s) return null;
      const box = e => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
      const card = s.querySelector('.card'), again = s.querySelector('[data-action="again"]'), next = s.querySelector('.row2 button:not([data-action="title"])'), menu = s.querySelector('[data-action="title"]');
      const parts = [...card.querySelectorAll(':scope > *, :scope > .col > *')].filter(e => !e.classList.contains('col') && e.getBoundingClientRect().height > 0).map(e => ({ what: e.className || e.tagName, ...box(e) }));
      const scr = document.getElementById('screens');
      return { W: innerWidth, H: innerHeight, won: card.classList.contains('won'), card: box(card), again: box(again), next: next ? box(next) : null, nextWhat: next ? next.textContent.trim().slice(0, 30) : null, menu: box(menu), parts, scrolls: scr.scrollHeight > scr.clientHeight + 1 || s.scrollHeight > s.clientHeight + 1 };
    });
    await p.screenshot({ path: path.join(R.rivalShots, 'layout-results-' + name + '-' + tag + '.png'), timeout: 180000 });
    const clash = [];
    if (r) for (let i = 0; i < r.parts.length; i++) for (let j = i + 1; j < r.parts.length; j++) if (meets(r.parts[i], r.parts[j])) clash.push(r.parts[i].what + '/' + r.parts[j].what);
    const ok = r && r.won === (name === 'won') && r.next && inside(r.card, r.W, r.H) && inside(r.again, r.W, r.H) && inside(r.next, r.W, r.H) && inside(r.menu, r.W, r.H) && !r.scrolls && !clash.length;
    out.results[tag + ' ' + name] = { ...r, clash, ok };
    R.verdict(ok, tag + ' results ' + name + ': card ' + (r ? Math.round(r.card.t) + ' to ' + Math.round(r.card.b) + ' of ' + r.H + ' px' : 'missing') + ', REMATCH bottom ' + (r ? Math.round(r.again.b) : '-') + ', ' + (r && r.nextWhat) + ' bottom ' + (r && r.next ? Math.round(r.next.b) : 'none') + ', MENU bottom ' + (r ? Math.round(r.menu.b) : '-') + ', scrolls ' + (r && r.scrolls) + (clash.length ? ', overlaps ' + clash.join(', ') : ', no overlaps'));
    await pg.close();
  }
  /* the career with its cards: one beaten, one open, the rest locked */
  for (const bad of [false, true]) {
    if (bad && vp !== R.PORTRAIT) continue;
    const pg = await R.page(env, vp, '', { touch });
    const p = pg.page;
    const c = await p.evaluate(bad => {
      const S = window.__loop.save; S.reset(); S.setOnboarded();
      for (let i = 0; i < 12; i++) S.careerResult(i, 2, 600 + i);
      const R0 = window.__loop.RIVALS; if (R0[0]) S.rivalResult(R0[0].id, true, 412);
      if (bad) { const st = document.createElement('style'); st.textContent = '.career .rivalcard { margin-top: -30px !important; }'; document.head.appendChild(st); }
      window.__loop.action('career');
      const list = document.querySelector('.career .list'), box = e => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
      const meets = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
      const res = { cards: 0, meetings: [], outside: [], states: [] };
      for (const card of list.querySelectorAll('.rivalcard')) {
        card.scrollIntoView({ block: 'center' });
        res.cards++;
        res.states.push((card.classList.contains('beaten') ? 'beaten' : card.classList.contains('locked') ? 'locked' : 'open') + ':' + card.textContent.replace(/\s+/g, ' ').trim().slice(0, 60));
        const cb = box(card), lb = box(list);
        if (cb.l < lb.l - 0.5 || cb.r > lb.r + 0.5) res.outside.push(card.dataset.arg);
        const parts = [...card.querySelectorAll(':scope > span')].map(box);
        for (let i = 0; i < parts.length; i++) { for (let j = i + 1; j < parts.length; j++) if (meets(parts[i], parts[j])) res.meetings.push('inside ' + card.dataset.arg); if (parts[i].l < cb.l - 0.5 || parts[i].r > cb.r + 0.5) res.meetings.push('part outside ' + card.dataset.arg); }
        for (const o of list.querySelectorAll('.row, .chead')) if (meets(cb, box(o))) res.meetings.push(card.dataset.arg + ' meets ' + o.textContent.replace(/\s+/g, ' ').trim().slice(0, 20));
      }
      return res;
    }, bad);
    if (!bad) { await p.evaluate(() => { const c = document.querySelector('.career .rivalcard'); if (c) c.scrollIntoView({ block: 'center' }); }); await p.screenshot({ path: path.join(R.rivalShots, 'layout-career-' + tag + '.png'), timeout: 180000 }); }
    out.career[tag + (bad ? ' known answer' : '')] = c;
    if (!bad) R.verdict(c.cards > 0 && !c.meetings.length && !c.outside.length, tag + ' career: ' + c.cards + ' rival cards (' + c.states.map(s => s.split(':')[0]).join(', ') + '), ' + (c.meetings.length ? 'meetings ' + c.meetings.slice(0, 3).join('; ') : 'nothing meets'));
    else R.verdict(c.meetings.length > 0, tag + ' known answer: the cards pulled 30 px up meet: ' + c.meetings.length + ' meetings: ' + (c.meetings.length ? 'CAUGHT' : 'MISSED'));
    await pg.close();
  }
}
R.writeJson(path.join(R.rivalsDir, 'layout.json'), out);
await env.close();
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
