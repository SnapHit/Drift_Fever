/* SHARED BY THE LADDER PROBES (briefs/RIVALS-LADDER.md). The drift race
   round's harness (headless Chromium through the dev server, the frame
   loop stubbed, the page advanced at a synthetic 60 Hz), writing to
   review/ladder/. */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../rivals/lib.js';

export * from '../rivals/lib.js';
export const ladderDir = path.join(R.root, 'review', 'ladder');
export const ladderShots = path.join(ladderDir, 'shots');
fs.mkdirSync(ladderShots, { recursive: true });

/* A page with an empty save, the onboarding done, on the title. query
   adds to the address (?rivals=all for the whole ladder). */
export async function emptyPage(env, vp, query) {
  const pg = await R.openPage(env, vp, (query || '') + '&title=1');
  await pg.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); S.setOnboarded(); window.__loop.action('title'); });
  return pg;
}

/* What the title's button, the rivals screen and the career's rival
   cards say and allow, read off the page. */
export const READ_LADDER = `
  const L = window.__loop, out = {};
  L.action('title');
  const b = document.querySelector('.rivalsbtn');
  out.button = b ? { head: b.querySelector('b').textContent, line: b.querySelector('small').textContent, mark: !!b.querySelector('.mark') } : null;
  L.action('rivals');
  out.cards = [...document.querySelectorAll('.rcard')].map(c => ({ id: c.dataset.rival, state: ['off', 'locked', 'open', 'beaten'].find(s => c.classList.contains(s)), action: c.dataset.action || null, text: c.innerText.replace(/\\s+/g, ' ').trim(), needs: [...c.querySelectorAll('.st.lockd small')].map(s => ({ text: s.textContent.slice(2), done: s.classList.contains('done') })), focusable: c.tabIndex >= 0 && !c.disabled }));
  L.action('career');
  out.career = [...document.querySelectorAll('.career .rivalcard')].map(c => ({ id: c.dataset.arg, enabled: !c.disabled }));
  L.action('title');
  return out;
`;
