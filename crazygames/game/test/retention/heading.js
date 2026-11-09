/* THE RUN HEADING AND THE UNLOCK LINE (after play, 10 November 2026: a
   new player landed in career track 1 did not know it was a career).
   Over every run's countdown a heading says which run it is, "CAREER ·
   TRACK 1 OF 8" and the track's name, also on the onboarding run; the
   results of a career run say a track just opened, or what opens the
   next.

   Measured at 390x844, 844x390, 800x450 and 1280x720, on a first visit:
   1. The heading is shown over the countdown, reads CAREER and TRACK 1 OF
      8, lies wholly inside the viewport, does not overlap the score,
      the onboarding prompt or the touch pads, and is gone a few seconds
      after GO.
   2. The scripted drifter finishes career 1 with a star: the results say
      "Track 2 of 8 unlocked", NEXT is the primary button, and the card
      fits the viewport.
   3. Known answer: the same run with the star levels a hundred times
      larger (not STAR_RATE: the clean and pace bonuses scale with it, so
      a clean run would still earn the first star): no star, the line reads "Win a star to unlock track 2 of
      8", no NEXT, GO AGAIN the primary.
   Screenshots in review/retention/shots/heading-*.png and
   unlock-*.png.

   node game/test/retention/heading.js */
import path from 'node:path';
import * as R from './lib.js';

const SIZES = [R.PORTRAIT, R.PHONE_LANDSCAPE, R.SMALL, R.LANDSCAPE];
const shots = path.join(R.reviewDir, 'shots');
const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
let failed = 0;
const verdict = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); };

const env = await R.start();
const out = {};
for (const vp of SIZES) {
  const tag = vp.width + 'x' + vp.height, touch = vp.width < 900 && vp !== R.SMALL;
  for (const known of [false, true]) {
    const pg = await R.openPage(env, vp, { firstVisit: true, touch });
    const { page } = pg;
    const box = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null; }, sel);
    /* the targets are set as a run starts, so the known answer restarts the first visit's run; the levels, not the rate, since the clean and pace pay scales with the rate */
    if (known) await page.evaluate(() => { const Lp = window.__loop; Lp.LOOP.STAR_LEVELS = Lp.LOOP.STAR_LEVELS.map(k => k * 100); Lp.startRun(Lp.careerSpec(0), { onboard: true }); });
    await R.runFrames(page, 90, 'return 0;');
    const head = await page.evaluate(() => { const m = document.getElementById('missions'); return { shown: !m.hidden, label: (m.querySelector('i') || {}).textContent || '', name: (m.querySelector('strong') || {}).textContent || '', state: window.__loop.app.state }; });
    const hb = await box('#missions'), tb = await box('#total'), pb = await box('#onboard .prompt'), lb = await box('#touch button[data-b="left"]'), rb = await box('#touch button[data-b="hb"]');
    if (!known) {
      await page.screenshot({ path: path.join(shots, 'heading-' + tag + '.png'), timeout: 180000 });
      verdict(head.shown && head.state === 'countdown' && /CAREER/.test(head.label) && /TRACK 1 OF 8/.test(head.label) && head.name === 'First slide', tag + ' heading over the first visit countdown: "' + head.label + '" "' + head.name + '"');
      const inside = hb && hb.left >= 0 && hb.top >= 0 && hb.right <= vp.width && hb.bottom <= vp.height;
      verdict(inside && !overlap(hb, tb) && !overlap(hb, pb) && !overlap(hb, lb) && !overlap(hb, rb), tag + ' heading inside the view and clear of the score, the prompt and the pads: ' + JSON.stringify(hb && { l: Math.round(hb.left), t: Math.round(hb.top), r: Math.round(hb.right), b: Math.round(hb.bottom) }));
    }
    await page.evaluate(() => { window.__feel.draw = false; window.__feel.setDriver({ drift: '*' }); });
    const after = await R.runFrames(page, 60 * 7, 'return { s: window.__loop.app.state, h: !document.getElementById("missions").hidden };');
    const goAt = after.findIndex(f => f.s === 'drive');
    if (!known) verdict(goAt >= 0 && !after[after.length - 1].h, tag + ' heading gone after GO (GO at frame ' + goAt + ' of the last 420, hidden at the end ' + !after[after.length - 1].h + ')');
    const r = await R.driveToResults(page, 60 * 240);
    await page.evaluate(() => { window.__feel.draw = true; });
    await R.runFrames(page, 30, 'return 0;');
    const res = await page.evaluate(() => {
      const s = document.querySelector('#screens.on .screen.results'); if (!s) return null;
      const u = s.querySelector('.unlock'), next = s.querySelector('[data-action="play-career"]'), again = s.querySelector('[data-action="again"]'), card = s.querySelector('.card').getBoundingClientRect();
      return { label: (s.querySelector('.runlabel') || {}).textContent || '', unlock: u ? u.textContent.trim() : '', unlockDone: u ? u.classList.contains('done') : null, next: !!next, nextPrimary: next ? next.classList.contains('primary') : false, againPrimary: again.classList.contains('primary'), stars: s.querySelectorAll('.stars .on').length, cardBottom: card.bottom, scroll: s.scrollHeight > s.clientHeight + 1, H: innerHeight };
    });
    await page.screenshot({ path: path.join(shots, (known ? 'unlock-none-' : 'unlock-') + tag + '.png'), timeout: 180000 });
    (out[tag] = out[tag] || {})[known ? 'known' : 'run'] = { head, results: res, finished: r.finished };
    if (!known) verdict(r.finished && res && res.stars >= 1 && /^\S*\s*Track 2 of 8 unlocked: Harbour run$/.test(res.unlock) && res.unlockDone && res.nextPrimary && !res.againPrimary && /CAREER/.test(res.label), tag + ' a star on career 1: "' + (res && res.unlock) + '", NEXT primary ' + (res && res.nextPrimary) + ', stars ' + (res && res.stars) + ', the card scrolls ' + (res && res.scroll));
    else verdict(r.finished && res && res.stars === 0 && res.unlock === 'Win a star to unlock track 2 of 8' && !res.next && res.againPrimary, tag + ' known answer, no star: "' + (res && res.unlock) + '", NEXT shown ' + (res && res.next) + ', GO AGAIN primary ' + (res && res.againPrimary));
    verdict(pg.errors.length === 0, tag + (known ? ' known answer' : '') + ' no page errors' + (pg.errors.length ? ': ' + pg.errors.slice(0, 2).join(' | ') : ''));
    await pg.close();
  }
}
R.writeJson(path.join(R.reviewDir, 'heading.json'), out);
await env.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
