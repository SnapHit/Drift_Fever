/* THE MENUS BY GAMEPAD (CrazyGames readiness, 14 November 2026). Every
   screen is buttons carrying data-action, rebuilt whole on each action,
   so this keeps a focus by the button's action and argument, not by its
   element, and finds it again after a rebuild.

   D-pad or left stick moves the focus to the nearest button that way; A
   presses it; B goes back (the screen's back arrow, or MENU on the
   results). In a run, the back button (select, view, share) leaves for
   the title, or skips the first run's prompts while they show. The ring
   is drawn only once a pad has been used and goes when a pointer or a
   key is, so a mouse or touch player never sees it.

   update(t, pads) is called once a frame by the host with the time in
   ms; pads defaults to navigator.getGamepads(), and the probes pass
   their own. owns() is true while the pad is the menus' device, when
   the host leaves the face buttons to this and not to "go again". */
export const PADNAV = {
  STICK: 0.55,        // stick deflection that counts as a direction
  REPEAT_FIRST: 380,  // ms a held direction waits before it repeats
  REPEAT: 150,        // ms between repeats after that
  ACROSS: 2.2,        // how much dearer a pixel off the axis is than one along it, choosing the next button
};

export function createPadNav(screensEl, opts) {
  const o = opts || {};
  let active = false, key = null, cur = null, dir = null, dirT = 0, repeats = 0;
  const was = { a: true, b: true, back: true };   // held at the start counts as already pressed
  const drop = () => { if (active) { active = false; paint(null); } };
  window.addEventListener('pointerdown', drop, { capture: true, passive: true });
  window.addEventListener('keydown', drop, { capture: true, passive: true });

  const keyOf = b => b.dataset.action + '|' + (b.dataset.arg || '');
  const open = () => screensEl.classList.contains('on');
  function buttons() {
    return [...screensEl.querySelectorAll('button[data-action]')].filter(b => !b.disabled && b.offsetParent !== null);
  }
  function paint(b) {
    if (cur && cur !== b) cur.classList.remove('padfocus');
    cur = b;
    if (b) { b.classList.add('padfocus'); if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  /* the focused button on this screen as it stands: the one with the kept
     key, else the screen's main button, else its first that is not the
     back arrow */
  function resolve(list) {
    let b = key && list.find(x => keyOf(x) === key);
    if (!b) b = list.find(x => x.classList.contains('primary')) || list.find(x => !x.classList.contains('back')) || list[0] || null;
    key = b ? keyOf(b) : null;
    return b;
  }
  function move(d) {
    const list = buttons(), from = resolve(list);
    if (!from) return;
    const r = from.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bestS = Infinity;
    for (const b of list) {
      if (b === from) continue;
      const q = b.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
      const along = d === 'left' ? -dx : d === 'right' ? dx : d === 'up' ? -dy : dy;
      const across = Math.abs(d === 'left' || d === 'right' ? dy : dx);
      /* a button overlapping this one on the cross axis is "that way" however little it leads */
      const overlap = d === 'left' || d === 'right' ? q.bottom > r.top + 1 && q.top < r.bottom - 1 : q.right > r.left + 1 && q.left < r.right - 1;
      if (along <= 1 || !overlap && across > along * 2) continue;
      const s = along + across * PADNAV.ACROSS;
      if (s < bestS) { bestS = s; best = b; }
    }
    if (best) { key = keyOf(best); paint(best); } else paint(from);
  }

  function read(pads) {
    const out = { dir: null, a: false, b: false, back: false, any: false };
    for (const p of pads || []) {
      if (!p || !p.buttons) continue;
      const btn = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
      const x = (p.axes && p.axes[0]) || 0, y = (p.axes && p.axes[1]) || 0, T = PADNAV.STICK;
      let d = btn(14) ? 'left' : btn(15) ? 'right' : btn(12) ? 'up' : btn(13) ? 'down' : null;
      if (!d && (Math.abs(x) > T || Math.abs(y) > T)) d = Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
      if (d && !out.dir) out.dir = d;
      out.a = out.a || btn(0); out.b = out.b || btn(1); out.back = out.back || btn(8);
    }
    out.any = !!out.dir || out.a || out.b || out.back;
    return out;
  }

  function update(t, pads) {
    let list;
    try { list = pads || (navigator.getGamepads ? navigator.getGamepads() : []); } catch (e) { list = []; }
    const p = read(list);
    const edge = { a: p.a && !was.a, b: p.b && !was.b, back: p.back && !was.back };
    was.a = p.a; was.b = p.b; was.back = p.back;
    if (!open()) {
      dir = null; if (cur) paint(null);
      if (edge.back && o.onBack) { active = true; o.onBack(); }
      return;
    }
    if (p.any && !active) {
      /* the first touch of the pad on a screen only shows the ring, on the
         main button; it presses nothing */
      active = true; dir = p.dir; dirT = t; repeats = 0; paint(resolve(buttons()));
      return;
    }
    if (!active) return;
    if (!cur || !cur.isConnected) paint(resolve(buttons()));   // the screen was rebuilt
    if (p.dir !== dir) { dir = p.dir; dirT = t; repeats = 0; if (dir) move(dir); }
    else if (dir && t - dirT >= (repeats ? PADNAV.REPEAT : PADNAV.REPEAT_FIRST)) { dirT = t; repeats++; move(dir); }
    if (edge.a && (!o.canPress || o.canPress())) { const b = resolve(buttons()); if (b) b.click(); }
    else if (edge.b) {
      const b = screensEl.querySelector('button.back') || screensEl.querySelector('.results button[data-action="title"]');
      if (b && !b.disabled) { key = null; b.click(); }
    }
  }

  return { update, owns: () => active && open(), get active() { return active; }, get key() { return key; },
    /* for the probes: put the focus on a button by its key */
    focus(k) { key = k; active = true; paint(resolve(buttons())); } };
}
