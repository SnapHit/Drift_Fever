/* LADDER MEASURE 5 (briefs/RIVALS-LADDER.md): LAYOUT. At 390x844,
   844x390, 800x450 and 1280x720, by bounding boxes:
   - the title, its RIVALS button in each state (none earned, one
     waiting, all beaten): the page does not scroll, nothing overlaps,
     every button inside the view;
   - the rivals screen, none earned, some, all beaten: the header and its
     back button never scroll (only the list does), every card inside the
     list's width, no two cards meeting, a card's own parts (portrait,
     name, state) not meeting and inside the card, and every card
     reachable by scrolling the list;
   - a career result with the offer beside NEXT, and a race's results,
     won with the next rival open, won with the next to earn, won with
     none after him, and lost: the card does not scroll, no two of its
     parts meet, every button inside the view.
   Touch targets: every button on these screens at least 44 px each way.
   The race results come from a real race against the rival, ended at
   once by the probe hook (finishNow: he is run on to his line); for the
   won cases the same results are shown as a win by the margin a close
   race has (the card's words are the game's, its totals are not a real
   race's).
   Known answer: the rival cards pulled 30 px up meet.

   node game/test/ladder/layout.js   writes review/ladder/layout.json and shots/layout-*.png */
import path from 'node:path';
import * as R from './lib.js';

const SIZES = [R.PORTRAIT, R.PHONE_LANDSCAPE, R.SMALL, R.LANDSCAPE];
const env = await R.start();
const out = {};
const MEASURE = `
  const box = e => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height }; };
  const meets = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
  const shown = e => { if (!e) return false; const st = getComputedStyle(e); const q = e.getBoundingClientRect(); return st.display !== 'none' && st.visibility !== 'hidden' && q.width > 0 && q.height > 0; };
  const W = innerWidth, H = innerHeight, inside = a => a.l >= -0.5 && a.t >= -0.5 && a.r <= W + 0.5 && a.b <= H + 0.5;
  const scr = document.getElementById('screens'), s = scr.querySelector('.screen');
  const res = { screen: s.className, W, H, pageScrolls: scr.scrollHeight > scr.clientHeight + 1, clash: [], outside: [], small: [], buttons: 0 };
  const name = e => (e.dataset && (e.dataset.rival || e.dataset.action)) || e.className || e.tagName;
  const pairs = (list, tag) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (meets(box(list[i]), box(list[j]))) res.clash.push(tag + ': ' + name(list[i]) + '/' + name(list[j])); };
  /* every button: its size, and inside the view (a card in the list: once scrolled to) */
  for (const b of s.querySelectorAll('button')) {
    if (!shown(b)) continue;
    res.buttons++;
    const inList = b.closest('.list');
    if (inList) b.scrollIntoView({ block: 'nearest' });
    const q = box(b);
    if (q.w < 44 - 0.5 || q.h < 44 - 0.5) res.small.push(name(b) + ' ' + Math.round(q.w) + 'x' + Math.round(q.h));
    if (!inside(q)) res.outside.push(name(b));
  }
  if (s.classList.contains('title')) {
    pairs([...s.children].filter(e => shown(e) && !e.classList.contains('menu') && !e.classList.contains('opts')).concat([...s.querySelectorAll('.menu > button, .opts > button')].filter(shown)), 'title');
    for (const e of [...s.children].filter(shown)) if (!inside(box(e))) res.outside.push(name(e));
  } else if (s.classList.contains('rivals')) {
    const head = s.querySelector('header'), back = s.querySelector('.back'), list = s.querySelector('.list');
    list.scrollTop = 0; const h0 = box(head), b0 = box(back);
    list.scrollTop = list.scrollHeight; const h1 = box(head), b1 = box(back);
    res.headerMoves = Math.abs(h0.t - h1.t) > 0.5 || Math.abs(b0.t - b1.t) > 0.5;
    res.listScrolls = list.scrollHeight > list.clientHeight + 1;
    list.scrollTop = 0;
    const cards = [...list.querySelectorAll('.rcard')];
    res.cards = cards.length;
    pairs(cards, 'cards');
    const lb = box(list);
    for (const c of cards) {
      const cb = box(c);
      if (cb.l < lb.l - 0.5 || cb.r > lb.r + 0.5) res.outside.push(c.dataset.rival + ' wider than the list');
      const parts = [...c.querySelectorAll(':scope > .pic, :scope > .who, :scope > .st')];
      pairs(parts, c.dataset.rival);
      for (const p of parts) { const pb = box(p); if (pb.l < cb.l - 0.5 || pb.r > cb.r + 0.5 || pb.t < cb.t - 0.5 || pb.b > cb.b + 0.5) res.clash.push(c.dataset.rival + ' ' + p.className + ' outside the card'); }
      for (const t of c.querySelectorAll('.who > *, .st > *')) { const tb = box(t); if (tb.r > cb.r + 0.5 || tb.b > cb.b + 0.5) res.clash.push(c.dataset.rival + ' text outside the card'); }
    }
    /* the header leaves room on its right for the coin badge (padding-right), so the badge is checked against the header's parts, not its box */
    pairs([s.querySelector('.rule'), list, s.querySelector('.coins'), ...head.children].filter(shown), 'screen');
    pairs([head, s.querySelector('.rule'), list].filter(shown), 'screen');
    res.states = cards.map(c => ['off', 'locked', 'open', 'beaten'].find(k => c.classList.contains(k)));
  } else if (s.classList.contains('results')) {
    const card = s.querySelector('.card');
    res.cardScrolls = s.scrollHeight > s.clientHeight + 1;
    const parts = [...card.querySelectorAll(':scope > *, :scope > .col > *')].filter(e => !e.classList.contains('col') && shown(e));
    pairs(parts, 'card');
    pairs([...card.querySelectorAll('.row2 > button')].filter(shown), 'row');
    if (!inside(box(card))) res.outside.push('card');
    /* a button's name on one line: a name broken across lines (KESTRO / W) is a fault the boxes alone do not see */
    for (const b of card.querySelectorAll('button > b')) { const lh = parseFloat(getComputedStyle(b).fontSize) * 1.5; if (shown(b) && b.getBoundingClientRect().height > lh) res.clash.push('the name "' + b.textContent + '" wraps'); }
    res.buttonsText = [...card.querySelectorAll('button')].filter(shown).map(b => b.innerText.replace(/\\s+/g, ' ').trim());
    res.lines = [...card.querySelectorAll('.unlock')].map(e => e.innerText.replace(/\\s+/g, ' ').trim());
  }
  return res;
`;
const judge = r => !r.pageScrolls && !r.clash.length && !r.outside.length && !r.small.length && !r.headerMoves && !r.cardScrolls;

const SAVES = {
  none: 'S.reset(); S.setOnboarded();',
  some: 'S.reset(); S.setOnboarded(); for (let i = 0; i < 9; i++) S.careerResult(i, 1, 500); S.rivalResult("r1", true, 412); S.rivalResult("r2", false, -230);',
  beaten: 'S.reset(); S.setOnboarded(); for (let i = 0; i < 24; i++) S.careerResult(i, 1, 500); for (const d of window.__loop.RIVALS) S.rivalResult(d.id, true, 300 + d.prize / 10);',
  waiting: 'S.reset(); S.setOnboarded(); S.careerResult(0, 1, 500);',
};
async function screen(p, save, action, after) {
  await p.evaluate(({ save, action }) => { const S = window.__loop.save; new Function('S', save)(S); window.__loop.action(action); }, { save, action });
  if (after) await p.evaluate(after);
  await R.runFrames(p, 2);
  return p.evaluate(new Function(MEASURE));
}

for (const vp of SIZES) {
  const tag = R.tagOf(vp), touch = vp.width < 900 && vp !== R.SMALL;
  const pg = await R.openPage(env, vp, '?rivals=all&title=1', { touch });
  const p = pg.page;
  await p.evaluate(() => { window.__feel.draw = true; });
  const shoot = async name => p.screenshot({ path: path.join(R.ladderShots, 'layout-' + name + '-' + tag + '.png'), timeout: 180000 });
  /* the title, its button in each state */
  for (const st of ['none', 'waiting', 'beaten']) {
    const r = await screen(p, SAVES[st], 'title');
    out[tag + ' title ' + st] = r;
    R.verdict(judge(r), tag + ' title, rivals ' + st + ': ' + (r.pageScrolls ? 'SCROLLS' : 'no scroll') + ', ' + r.buttons + ' buttons' + (r.clash.length ? ', overlaps ' + r.clash.join(', ') : ', no overlaps') + (r.outside.length ? ', outside ' + r.outside.join(', ') : '') + (r.small.length ? ', small ' + r.small.join(', ') : ''));
    await shoot('title-' + st);
  }
  /* the rivals screen */
  for (const st of ['none', 'some', 'beaten']) {
    const r = await screen(p, SAVES[st], 'rivals');
    out[tag + ' rivals ' + st] = r;
    R.verdict(judge(r) && r.cards === 6, tag + ' rivals screen, ' + st + ' (' + r.states.join(' ') + '): ' + r.cards + ' cards, the list ' + (r.listScrolls ? 'scrolls' : 'fits') + ', the header ' + (r.headerMoves ? 'MOVES' : 'stays') + (r.pageScrolls ? ', the PAGE scrolls' : '') + (r.clash.length ? ', overlaps ' + r.clash.slice(0, 4).join(', ') : ', no overlaps') + (r.outside.length ? ', outside ' + r.outside.join(', ') : '') + (r.small.length ? ', small ' + r.small.join(', ') : ''));
    await shoot('rivals-' + st);
  }
  /* a career result with the offer: career 1 run and ended at once, Kestrow earned and not beaten */
  {
    await p.evaluate(() => { const S = window.__loop.save; S.reset(); S.setOnboarded(); S.careerResult(0, 1, 500); const L = window.__loop; L.startRun(L.careerSpec(0)); L.finishNow(); });
    await R.runFrames(p, 60);
    const r = await p.evaluate(new Function(MEASURE));
    out[tag + ' career result offer'] = r;
    const offer = r.buttonsText.find(t => /^KESTROW race him/.test(t));
    R.verdict(judge(r) && !!offer, tag + ' career result with the offer ("' + offer + '" in ' + r.buttonsText.join(' | ') + '): ' + (r.cardScrolls || r.pageScrolls ? 'SCROLLS' : 'no scroll') + (r.clash.length ? ', overlaps ' + r.clash.join(', ') : ', no overlaps') + (r.outside.length ? ', outside ' + r.outside.join(', ') : '') + (r.small.length ? ', small ' + r.small.join(', ') : ''));
    await shoot('career-offer');
  }
  /* a race's results */
  const RACES = [
    ['won-next', 'r1', 'S.reset(); S.setOnboarded(); for (let i = 0; i < 8; i++) S.careerResult(i, 1, 500);', true],
    ['won-toearn', 'r1', 'S.reset(); S.setOnboarded(); S.careerResult(0, 1, 500);', true],
    ['won-last', 'r6', SAVES.beaten, true],
    ['lost', 'r2', 'S.reset(); S.setOnboarded(); for (let i = 0; i < 8; i++) S.careerResult(i, 1, 500); S.rivalResult("r1", true, 300);', false],
  ];
  for (const [name, id, save, won] of RACES) {
    await p.evaluate(({ id, save, won }) => {
      const L = window.__loop, S = L.save; new Function('S', save)(S);
      if (won) S.rivalResult(id, true, 137);   // the win saved first, so the next rival is read as it is after a win
      L.action('battle', id); const r = L.finishNow();
      if (won) { Object.assign(r, { won: true, score: r.rival.total + 137, margin: 137, first: true, prize: L.RIVALS.find(d => d.id === id).prize }); L.screens.results(r); }
    }, { id, save, won });
    await R.runFrames(p, 60);
    const r = await p.evaluate(new Function(MEASURE));
    out[tag + ' race ' + name] = r;
    R.verdict(judge(r), tag + ' race results ' + name + ' (' + r.lines.join(' / ') + ' :: ' + r.buttonsText.join(' | ') + '): ' + (r.cardScrolls || r.pageScrolls ? 'SCROLLS' : 'no scroll') + (r.clash.length ? ', overlaps ' + r.clash.join(', ') : ', no overlaps') + (r.outside.length ? ', outside ' + r.outside.join(', ') : '') + (r.small.length ? ', small ' + r.small.join(', ') : ''));
    await shoot('race-' + name);
  }
  /* the known answer, once */
  if (vp === R.PORTRAIT) {
    const r = await screen(p, SAVES.some, 'rivals', () => { const st = document.createElement('style'); st.textContent = '.rcard + .rcard { margin-top: -30px !important; }'; document.head.appendChild(st); });
    R.verdict(r.clash.some(c => /^cards/.test(c)), 'known answer: the rival cards pulled 30 px up meet: ' + (r.clash.some(c => /^cards/.test(c)) ? 'CAUGHT (' + r.clash.filter(c => /^cards/.test(c)).length + ')' : 'MISSED'));
    out.knownAnswer = r.clash;
  }
  await pg.close();
}
R.writeJson(path.join(R.ladderDir, 'layout.json'), out);
await env.close();
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
