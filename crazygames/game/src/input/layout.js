/* WHAT THE KEYS PRINT. The game reads letters by where the key sits
   (input.js), so what to call a key depends on the keyboard: the key at
   W prints Z on AZERTY, the one at A prints Q. Where the browser can say
   (Chromium's keyboard map, a local lookup, no request) the labels follow
   it; elsewhere they are the QWERTY letters. Moved here from the prompts
   on 22 November 2026 so the title's hint can use it too. */
const LAYOUT = {};
try {
  if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => {
    for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) { const v = m.get(c); if (v && v.length === 1) LAYOUT[c] = v.toUpperCase(); }
  }).catch(() => {});
} catch (e) {}

/* The label for the key at code, else fallback (its QWERTY letter). */
export function keyLabel(code, fallback) { return LAYOUT[code] || fallback; }
