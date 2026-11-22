/* WORDS AND LAYOUT (briefs/PRO-CONTROLS.md, measure 7). At 390x844,
   844x390, 800x450 and 1280x720, for Pro on keys, Pro on a pad, Easy on
   keys (the switch on, the toggle on Easy), the game with no switch, and
   touch: the title's hint says what that input does (and is hidden only
   where the title always hides it, in a short landscape frame), the
   CONTROLS toggle is there exactly when Pro is on the address and the
   input is not touch, every title button is 44 px or more high and inside
   the frame; then HOW TO PLAY's prompts, each left to time out so every
   one is seen: each is the right one for the input, its words and caps
   inside the frame, and SKIP 44 px or more high and inside.
   Known answer: the old "The car drives itself" line, read as Pro's hint,
   is caught as untrue.
   node game/test/controls/words.js   writes review/controls/words.json and shots */
import path from 'node:path';
import fs from 'node:fs';
import * as R from './lib.js';

const SIZES = [[390, 844], [844, 390], [800, 450], [1280, 720]];
const MODES = {
  'pro keys': { q: 'controls=pro&pro=b', toggle: true },
  'pro pad': { q: 'controls=pro&pro=b', pad: true, toggle: true },
  'easy keys': { q: 'controls=pro&pro=b', easy: true, toggle: true },
  'no switch': { q: '', toggle: false },
  touch: { q: 'controls=pro&pro=b', touch: true, toggle: false },
};
const OLD = 'Steer left and right. DRIFT / BRAKE with steering throws the tail out; on its own it brakes. The car drives itself.';
/* is this hint true to this input */
const HINT = {
  'pro keys': h => /W or Up drives/.test(h) && /S or Down brakes and then reverses/.test(h) && /SPACE is the handbrake/.test(h) && /countersteer/.test(h) && !/drives itself/.test(h),
  'pro pad': h => /RT drives/.test(h) && /LT brakes and then reverses/.test(h) && /A is the handbrake/.test(h) && !/drives itself/.test(h),
  'easy keys': h => /The arrows or A D steer/.test(h) && /SPACE with steering/.test(h) && /drives itself/.test(h),
  'no switch': h => h === OLD,
  touch: h => h === OLD,
};
const WANT_STEPS = { 'pro keys': ['drive', 'steer', 'drift', 'hold', 'brake'], 'pro pad': ['drive', 'steer', 'drift', 'hold', 'brake'], 'easy keys': ['steer', 'drift', 'brake'], 'no switch': ['steer', 'drift', 'brake'], touch: ['steer', 'drift', 'brake'] };
const shots = path.join(R.controlsDir, 'shots'); fs.mkdirSync(shots, { recursive: true });
const env = await R.start(), out = {};
const PAD = `window.__pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], connected: true, id: 'fed' };
  navigator.getGamepads = () => [window.__pad];
  const F = window.__feel; window.__clock = (window.__clock || 1000);
  window.__pad.buttons[15].pressed = true; window.__pad.buttons[15].value = 1; window.__clock += 17; F.frame(window.__clock);
  window.__pad.buttons[15].pressed = false; window.__pad.buttons[15].value = 0; window.__clock += 17; F.frame(window.__clock);`;
const TOUCH = `const F = window.__feel; window.__clock = (window.__clock || 1000); window.__clock += 17; F.frame(window.__clock); F.input.touch.show(); F.input.touch.press('left', true); F.input.touch.press('left', false); window.__clock += 17; F.frame(window.__clock);`;
const TITLE = `
  const W = innerWidth, H = innerHeight, L = window.__loop; L.action('title');
  const hintEl = document.querySelector('.title .hint'), cs = hintEl ? getComputedStyle(hintEl) : null, r = hintEl ? hintEl.getBoundingClientRect() : null;
  const buttons = [...document.querySelectorAll('#screens button')].filter(b => b.offsetParent !== null).map(b => { const q = b.getBoundingClientRect(); return { action: b.dataset.action, h: Math.round(q.height), inside: q.left >= -0.5 && q.top >= -0.5 && q.right <= W + 0.5 && q.bottom <= H + 0.5 }; });
  return { hint: hintEl ? hintEl.textContent : null, hintShown: !!(cs && cs.display !== 'none' && r.height > 0), hintInside: !!(r && r.left >= -0.5 && r.right <= W + 0.5 && r.bottom <= H + 0.5), toggle: buttons.find(b => b.action === 'controls') || null, buttons, source: window.__feel.input.record.source };`;
for (const [w, h] of SIZES) {
  const tag = w + 'x' + h;
  for (const [mode, M] of Object.entries(MODES)) {
    const pg = await R.openPage(env, { width: w, height: h }, M.q + '&title=1', { touch: !!M.touch });
    const page = pg.page;
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); S.setOnboarded(); window.__feel.draw = false; });
    if (M.easy) await page.evaluate(() => window.__loop.controls.setEasyPreferred(true));
    if (M.pad) await page.evaluate(new Function(PAD));
    if (M.touch) await page.evaluate(new Function(TOUCH));
    const t = await page.evaluate(new Function(TITLE));
    const short = h <= 500 && w > h;   // the title has always hidden its hint in a short landscape frame
    const hintOk = HINT[mode](t.hint || '') && (t.hintShown ? t.hintInside : short);
    const toggleOk = M.toggle ? !!(t.toggle && t.toggle.h >= 44 && t.toggle.inside) : !t.toggle;
    const small = t.buttons.filter(b => b.h < 44 || !b.inside);
    R.verdict(hintOk && toggleOk && small.length === 0, tag + ' ' + mode + ': the hint ' + (t.hintShown ? 'shown' : 'hidden') + ' and true to the input (' + (t.hint || '').slice(0, 48) + '...), the toggle ' + (t.toggle ? t.toggle.h + ' px' : 'absent') + ', all ' + t.buttons.length + ' title buttons 44 px and inside' + (small.length ? ' EXCEPT ' + small.map(b => b.action + ' ' + b.h + (b.inside ? '' : ' outside')).join(', ') : '') + ' (source ' + t.source + ')');
    await page.evaluate(() => { window.__feel.draw = true; });
    await R.runFrames(page, 1);
    await page.screenshot({ path: path.join(shots, tag + '-' + mode.replace(' ', '-') + '-title.png') });
    await page.evaluate(() => { window.__feel.draw = false; });
    /* HOW TO PLAY, every prompt left to time out */
    const p = await page.evaluate(() => {
      const L = window.__loop, F = window.__feel, W = innerWidth, H = innerHeight, seen = [];
      L.action('onboard'); L.skipCountdown();
      let last = '';
      for (let i = 0; i < 60 * 70 && L.onboard.active; i++) {
        window.__clock += 1000 / 60; F.frame(window.__clock);
        const st = L.onboard.state.step;
        if (st && st !== last) {
          const el = document.querySelector('#onboard .prompt'), r = el.getBoundingClientRect(), sk = document.querySelector('#skip'), s = sk.getBoundingClientRect();
          seen.push({ step: st, text: el.querySelector('b') ? el.querySelector('b').textContent : '', caps: [...el.querySelectorAll('kbd')].map(k => k.textContent), inside: r.left >= -0.5 && r.top >= -0.5 && r.right <= W + 0.5 && r.bottom <= H + 0.5, skipH: Math.round(s.height), skipInside: s.left >= 0 && s.top >= 0 && s.right <= W + 0.5 && s.bottom <= H + 0.5 || sk.hidden });
        }
        last = st || last;
        if (seen.length >= 5) break;
      }
      return { seen, mode: L.onboard.state.mode, profile: L.profile() };
    });
    out[tag + ' ' + mode] = { title: t, prompts: p };
    const steps = p.seen.map(s => s.step), want = WANT_STEPS[mode];
    const wordsOk = p.seen.every(s => (mode.startsWith('pro') ? !/DRIFT \/ BRAKE/.test(s.text) : true) && (mode === 'pro pad' ? !/\bW\b|SPACE/.test(s.text) : true) && (mode === 'touch' ? s.caps.length === 0 : s.caps.length > 0));
    const layoutOk = p.seen.every(s => s.inside && (s.skipH >= 44 && s.skipInside));
    R.verdict(JSON.stringify(steps) === JSON.stringify(want) && wordsOk && layoutOk, tag + ' ' + mode + ': the prompts ' + steps.join(', ') + ' (' + p.seen.map(s => '"' + s.text + '"' + (s.caps.length ? ' [' + s.caps.join(' ') + ']' : '')).join('; ') + '), each inside the frame, SKIP ' + (p.seen[0] ? p.seen[0].skipH : '?') + ' px');
    await pg.close();
  }
}
/* the known answer */
const caught = !HINT['pro keys'](OLD) && !HINT['pro pad'](OLD);
R.verdict(caught, 'known answer: the old "The car drives itself" line read as Pro\'s hint is untrue: ' + (caught ? 'CAUGHT' : 'MISSED'));
await env.close();
process.exit(R.finish('words', out) ? 1 : 0);
