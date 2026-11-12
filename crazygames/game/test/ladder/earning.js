/* LADDER MEASURE 4 (briefs/RIVALS-LADDER.md): EARNING AND THE SCREEN'S
   STATES. From an empty save, in the page, scripted: each rival's star
   won, a race lost to him, then a race won, in ladder order, through the
   same save calls a career run and a race make (careerResult,
   rivalResult). After the empty save and after every step:
   - the title's button: its words (what earns the first before any is
     earned; how many beaten; who is waiting) and its mark (shown exactly
     when a rival is earned and not beaten);
   - every rival's card on the rivals screen: its state, its words (what
     earns him, each ticked when done), and whether it races;
   - and the five ways into a race, each only for an earned rival: the
     rivals screen's card, the career's card, the offer on a career result
     on his track (a run of it ended at once by the probe hook), the next
     rival on the previous rival's race results, and the action itself
     (window.__loop.action('battle', id)).
   What is earned is worked out here from the steps taken, not read from
   the game: a star on his track and a win over the one before, and in
   the game (rivalsLive).
   Every earned rival is checked raceable after a loss and after a win.
   Then once for real: from an empty save the scripted drifter wins a
   star on career 1 and its results offer Kestrow; with the game's own
   TANDEM.LIVE, a rival past it is never raceable by any route.
   Known answer: a save with a win over the third and none over the
   second does not open the fourth; and the same check, with the second
   beaten as well, finds the fourth open (so it can fail).

   node game/test/ladder/earning.js   writes review/ladder/earning.json */
import path from 'node:path';
import * as R from './lib.js';

const env = await R.start();
const out = { steps: [], real: {}, live: {}, knownAnswer: {} };
const read = pg => pg.page.evaluate(src => new Function(src)(), R.READ_LADDER);

/* what should be true, from the steps taken */
function expected(model, live) {
  return model.rivals.map((r, k) => {
    const earned = k < live && model.star[k] && (k === 0 || model.won[k - 1]);
    return { earned, state: k >= live ? 'off' : !earned ? 'locked' : model.won[k] ? 'beaten' : 'open', needs: [{ text: 'Win a star on ' + r.trackName, done: model.star[k] }, ...(k ? [{ text: 'Beat ' + model.rivals[k - 1].name, done: model.won[k - 1] }] : [])] };
  });
}
/* every route into a race, for every rival, as the page answers */
async function routes(pg) {
  return pg.page.evaluate(() => {
    const L = window.__loop, A = L.app, res = {};
    for (let k = 0; k < L.RIVALS.length; k++) {
      const d = L.RIVALS[k], r = {};
      /* the action itself */
      L.action('title'); L.action('battle', d.id); r.action = A.state === 'countdown' && A.spec && A.spec.rival === d.id; L.action('title');
      /* the offer on a career result on his track */
      L.startRun(L.careerSpec(d.track)); const cr = L.finishNow();
      r.offer = !!(cr && cr.offer && cr.offer.id === d.id) && !!document.querySelector('.results [data-action="battle"][data-arg="' + d.id + '"]');
      /* the next rival on the previous rival's race results, when the previous is earned (a race against him, ended at once) */
      r.next = null;
      if (k > 0) {
        const p = L.RIVALS[k - 1];
        L.action('title'); L.action('battle', p.id);
        if (A.state === 'countdown') { const rr = L.finishNow(); r.next = !!(rr && rr.next && rr.next.id === d.id && rr.next.open) && !!document.querySelector('.results [data-action="battle"][data-arg="' + d.id + '"]'); r.nextNeeds = rr && rr.next && rr.next.needs ? rr.next.needs.map(n => n.text + (n.done ? ' done' : '')) : null; }
      }
      L.action('title');
      res[d.id] = r;
    }
    return res;
  });
}
const nf = n => n.toLocaleString('en-AU');

async function walk(query, live, label) {
  const pg = await R.emptyPage(env, R.LANDSCAPE, query);
  const info = await pg.page.evaluate(() => window.__loop.RIVALS.map(d => ({ id: d.id, name: d.name, track: d.track, trackName: window.__loop.careerSpec(d.track).name })));
  const model = { rivals: info, star: info.map(() => false), won: info.map(() => false) };
  const steps = [{ what: 'empty save' }];
  for (let k = 0; k < info.length; k++) { steps.push({ what: 'a star on ' + info[k].trackName, star: k }); steps.push({ what: 'lost to ' + info[k].name, lose: k }); steps.push({ what: 'beat ' + info[k].name, win: k }); }
  let bad = 0;
  const log = [];
  for (const st of steps) {
    /* the step, through the calls a run and a race make; a race's result is saved only when he was raceable, as the game only starts one then */
    await pg.page.evaluate(st => {
      const S = window.__loop.save, d = window.__loop.RIVALS;
      if (st.star !== undefined) S.careerResult(d[st.star].track, 1, 999);
      /* a race's result, saved only when he is raceable, as the game only starts a race then */
      if (st.lose !== undefined) { window.__loop.action('battle', d[st.lose].id); if (window.__loop.app.state === 'countdown') S.rivalResult(d[st.lose].id, false, -120); window.__loop.action('title'); }
      if (st.win !== undefined) { window.__loop.action('battle', d[st.win].id); if (window.__loop.app.state === 'countdown') S.rivalResult(d[st.win].id, true, 150 + st.win); window.__loop.action('title'); }
    }, st);
    const live0 = await pg.page.evaluate(() => window.__loop.TANDEM.LIVE);
    if (st.star !== undefined) model.star[st.star] = true;
    const exp0 = expected(model, live);
    if (st.lose !== undefined && !exp0[st.lose].earned) st.skipped = true;
    if (st.win !== undefined) { if (exp0[st.win].earned) model.won[st.win] = true; else st.skipped = true; }
    const exp = expected(model, live);
    const seen = await read(pg), rt = await routes(pg);
    const wrong = [];
    /* the title's button */
    const earnedAny = exp.some(e => e.earned), beaten = exp.filter(e => e.state === 'beaten').length, ready = exp.map((e, k) => e.state === 'open' ? info[k].name : null).filter(Boolean);
    const wantLine = !earnedAny ? 'Win a star on ' + info[0].trackName + ' to race ' + info[0].name : beaten + '/' + live + ' beaten' + (ready.length ? ' · ' + ready[0] + ' is waiting' : beaten === live ? ' · every one' : '');
    if (seen.button.line !== wantLine) wrong.push('button says "' + seen.button.line + '", want "' + wantLine + '"');
    if (seen.button.mark !== ready.length > 0) wrong.push('button mark ' + seen.button.mark);
    /* every card, every route */
    for (let k = 0; k < info.length; k++) {
      const c = seen.cards[k], e = exp[k], r = rt[info[k].id], cc = seen.career.find(x => x.id === info[k].id);
      if (!c || c.id !== info[k].id) { wrong.push('card ' + k + ' missing or out of order'); continue; }
      if (c.state !== e.state) wrong.push(info[k].name + ' card ' + c.state + ', want ' + e.state);
      if (!c.focusable) wrong.push(info[k].name + ' card not reachable by the keyboard');
      if (!!c.action !== e.earned) wrong.push(info[k].name + ' card races: ' + !!c.action);
      if (e.state === 'locked' && JSON.stringify(c.needs) !== JSON.stringify(e.needs)) wrong.push(info[k].name + ' needs ' + JSON.stringify(c.needs) + ', want ' + JSON.stringify(e.needs));
      if (k < live && (!cc || cc.enabled !== e.earned)) wrong.push(info[k].name + ' career card ' + (cc ? (cc.enabled ? 'races' : 'locked') : 'missing'));
      if (k >= live && cc) wrong.push(info[k].name + ' has a career card but is not in the game');
      if (r.action !== e.earned) wrong.push(info[k].name + ' by the action: ' + r.action);
      if (r.offer !== (e.state === 'open')) wrong.push(info[k].name + ' offer on his track\'s result: ' + r.offer + ', want ' + (e.state === 'open'));
      if (r.next !== null && exp[k - 1].earned && r.next !== e.earned) wrong.push(info[k].name + ' as the next rival offered: ' + r.next + ', want ' + e.earned);
    }
    if (wrong.length) bad++;
    log.push({ step: st.what + (st.skipped ? ' (not raceable, not saved)' : ''), button: seen.button, cards: seen.cards.map(c => ({ id: c.id, state: c.state, races: !!c.action, text: c.text })), routes: rt, wrong });
    console.log((wrong.length ? 'FAIL ' : 'ok   ') + label + ' ' + st.what + ': button "' + seen.button.head.replace('RACE', ' +mark') + ' / ' + seen.button.line + '"; cards ' + seen.cards.map(c => c.state).join(' ') + (wrong.length ? ' :: ' + wrong.join('; ') : ''));
    void live0;
  }
  await pg.close();
  return { bad, steps: log.length, log };
}

/* the whole ladder, all six in the game */
const all = await walk('?rivals=all', 6, 'all six');
R.verdict(all.bad === 0, 'earning all six in order from an empty save (?rivals=all): ' + (all.steps - all.bad) + ' of ' + all.steps + ' steps right: the title\'s button, every card\'s state and words, and every route into a race open exactly for an earned rival, after losses and wins');
out.all = all;
/* as the game ships: TANDEM.LIVE */
const envLive = await (async () => { const pg = await R.emptyPage(env, R.LANDSCAPE, ''); const n = await pg.page.evaluate(() => window.__loop.TANDEM.LIVE); await pg.close(); return n; })();
const shipped = await walk('', envLive, 'as shipped');
R.verdict(shipped.bad === 0, 'as shipped (TANDEM.LIVE ' + envLive + '): ' + (shipped.steps - shipped.bad) + ' of ' + shipped.steps + ' steps right; a rival past it shows as not in the game yet and is never raceable by any route');
out.live = { live: envLive, bad: shipped.bad, steps: shipped.steps, log: shipped.log };

/* once for real: the scripted drifter wins a star on career 1 from an empty save, and its results offer Kestrow beside NEXT */
{
  const pg = await R.emptyPage(env, R.LANDSCAPE, '');
  await R.careerRun(pg.page, 0);
  await R.until(pg.page, "f.state==='results'", 60 * 200, 120);
  const r = await pg.page.evaluate(() => { const r = window.__loop.results(); const b = document.querySelector('.results .row2 [data-action="battle"]'), n = document.querySelector('.results .row2 [data-action="play-career"]'); return { stars: r.stars, score: r.score, offer: r.offer, button: b ? b.innerText.replace(/\s+/g, ' ') : null, besideNext: !!(b && n && b.parentElement === n.parentElement) }; });
  R.verdict(r.stars >= 1 && r.offer && r.offer.id === 'r1' && r.besideNext, 'a real career 1 run from an empty save (' + nf(r.score) + ', ' + r.stars + ' star): the results offer Kestrow as "' + r.button + '" beside NEXT');
  /* and a second run on the same track offers him again (the offer repeats while he is unbeaten) */
  const again = await pg.page.evaluate(() => { const L = window.__loop; L.startRun(L.careerSpec(0)); const r = L.finishNow(); return r.offer; });
  R.verdict(!!(again && again.id === 'r1' && !again.fresh), 'the next career 1 result offers him again, no longer "just earned"');
  out.real = { first: r, again };
  await pg.close();
}

/* the known answer: a win over the third and none over the second does not open the fourth */
{
  const pg = await R.emptyPage(env, R.LANDSCAPE, '?rivals=all');
  const k = await pg.page.evaluate(() => {
    const L = window.__loop, S = L.save, d = L.RIVALS;
    for (const r of d) S.careerResult(r.track, 3, 99999);
    S.rivalResult(d[0].id, true, 100); S.rivalResult(d[2].id, true, 100);   // the third beaten (a stored win), the second not
    L.action('battle', d[3].id); const acted = L.app.state === 'countdown'; L.action('title');
    L.action('rivals'); const card = document.querySelector('.rcard[data-rival="' + d[3].id + '"]');
    return { acted, state: card.className, races: !!card.dataset.action, needs: [...card.querySelectorAll('.st.lockd small')].map(s => s.textContent) };
  });
  R.verdict(!k.acted && !k.races && /locked/.test(k.state), 'known answer: a save with a win over the third and none over the second does not open the fourth: ' + (!k.acted && !k.races ? 'held (' + k.needs.join(', ') + ')' : 'OPENED'));
  /* and the same check sees an open fourth when there is one: the second beaten too */
  const caught = await pg.page.evaluate(() => {
    const L = window.__loop, d = L.RIVALS;
    L.save.rivalResult(d[1].id, true, 100);
    L.action('battle', d[3].id); const acted = L.app.state === 'countdown'; L.action('title');
    L.action('rivals'); const card = document.querySelector('.rcard[data-rival="' + d[3].id + '"]');
    return { acted, races: !!card.dataset.action };
  });
  R.verdict(caught.acted && caught.races, 'known answer: the same check with the second beaten as well finds the fourth open, so it can fail: ' + (caught.acted && caught.races ? 'CAUGHT' : 'MISSED'));
  out.knownAnswer = { held: k, broken: caught };
  await pg.close();
}

R.writeJson(path.join(R.ladderDir, 'earning.json'), out);
await env.close();
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
