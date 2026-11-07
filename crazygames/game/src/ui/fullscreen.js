/* FULL SCREEN. The Fullscreen API on the whole page, with the webkit
   prefix for older Safari and Chromium. Not every browser offers it (an
   iPhone's Safari does not, for anything but video), so the buttons are
   shown only where it works. Entering must happen inside a tap. */
const doc = document, root = document.documentElement;

export function fullscreenSupported() {
  try { return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled) && !!(root.requestFullscreen || root.webkitRequestFullscreen); } catch (e) { return false; }
}
export function isFullscreen() { return !!(doc.fullscreenElement || doc.webkitFullscreenElement); }

export function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      const p = doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen && doc.webkitExitFullscreen();
      if (p && p.catch) p.catch(() => {});
    } else {
      const p = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen && root.webkitRequestFullscreen();
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) { /* refused: the game plays on in the page */ }
}

/* calls fn(isFullscreen) whenever it changes */
export function onFullscreenChange(fn) {
  const h = () => fn(isFullscreen());
  doc.addEventListener('fullscreenchange', h);
  doc.addEventListener('webkitfullscreenchange', h);
}

/* the icon: four corners out, or in when already full screen */
export function fullscreenIcon(on) {
  const d = on
    ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'
    : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
