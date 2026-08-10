/* THE ARCADE CABINET.

   One shared file for all seven content pages. Not copied into each
   page: seven copies is seven places to fix a bug.

   FOUR BEHAVIOURS, and they are the reasons the thing works.

   1. NOTHING LOADS UNTIL ASKED. The screen shows an attract panel and
      the iframe does not exist until somebody taps it. Four live
      canvases on one page would cook a phone, and these pages carry one
      each on a Chromebook.

   2. AN INTERSECTION OBSERVER unloads a cabinet that has scrolled away
      and keeps watching it, so it can come back when the reader
      scrolls back to it. Unloading is what keeps a long page cheap;
      still watching is what stops the reader having to ask twice.

   3. THE GROW BUTTON fills the viewport with the phone. On these pages
      that matters more than it does on snap-hit, because this is how
      somebody plays properly without leaving the page they landed on,
      so it is a labelled control across the width of the phone rather
      than a glyph in a corner.

   4. ONE AT A TIME. Starting a cabinet unloads any other that is
      running. Two live canvases on one page is the thing behaviour one
      exists to prevent, and a reader who taps two of them would get it
      anyway without this.

   The frame is same origin, "/", which is the game at the repo root
   serving double duty. index.html is not copied into a play/ folder:
   one file, one source of truth, and every future game update reaches
   all seven pages with no action here. */

(function () {
  'use strict';

  var SRC = '/';
  /* accelerometer and gyroscope are not strictly needed same origin,
     where the default self allowlist already covers them, and fullscreen
     is not used because grow is a fixed position layout rather than the
     fullscreen API. Declared anyway: it costs nothing, it says what the
     frame is allowed to do, and it keeps working if the frame is ever
     served from somewhere else. */
  var ALLOW = 'accelerometer; gyroscope; fullscreen';

  var cabs = [];
  var live = null;

  function screenOf(cab) { return cab.querySelector('.cab-screen'); }

  /* Build the frame. This is the only place one is ever created, and it
     is only ever called from a tap or from a revive. */
  function load(cab) {
    if (cab.__frame) return;
    // One at a time.
    if (live && live !== cab) unload(live);
    var f = document.createElement('iframe');
    f.src = SRC;
    f.title = 'Drift Fever';
    f.setAttribute('allow', ALLOW);
    /* The game reads the tilt sensor and writes localStorage, both of
       which need same origin, so there is deliberately no sandbox
       attribute: adding one would drop the frame into an opaque origin
       and silently break the daily, the ghost and tilt steering. It is
       our own file on our own domain. */
    f.setAttribute('scrolling', 'no');
    screenOf(cab).appendChild(f);
    cab.__frame = f;
    cab.classList.add('live');
    var attract = cab.querySelector('.cab-attract');
    if (attract) attract.hidden = true;
    live = cab;
  }

  /* Tear the frame out. The attract panel comes back, so the cabinet
     reads as a cabinet again rather than as a black hole, and the
     observer keeps watching so this is reversible. */
  function unload(cab) {
    if (!cab.__frame) return;
    cab.__frame.remove();
    cab.__frame = null;
    cab.classList.remove('live');
    if (cab.classList.contains('grown')) shrink(cab);
    var attract = cab.querySelector('.cab-attract');
    if (attract) attract.hidden = false;
    if (live === cab) live = null;
  }

  function grow(cab) {
    cab.classList.add('grown');
    document.body.classList.add('cab-grown');
    var b = cab.querySelector('.cab-grow');
    if (b) { b.textContent = 'CLOSE'; b.setAttribute('aria-pressed', 'true'); }
  }
  function shrink(cab) {
    cab.classList.remove('grown');
    document.body.classList.remove('cab-grown');
    var b = cab.querySelector('.cab-grow');
    if (b) { b.textContent = 'PLAY BIGGER'; b.setAttribute('aria-pressed', 'false'); }
  }

  function wire(cab) {
    cabs.push(cab);
    cab.__frame = null;
    /* WANTED is what makes reviving different from loading. A cabinet
       that has never been asked for stays dark for ever; one that was
       asked for and then scrolled away comes back on its own, because
       the reader already answered that question once. */
    cab.__wanted = false;

    var play = cab.querySelector('.cab-play');
    if (play) {
      play.addEventListener('click', function () {
        cab.__wanted = true;
        load(cab);
      });
    }
    /* The whole attract panel is the target, not just the button. A
       thumb aimed at a phone shaped screen lands anywhere on it, and
       "TAP TO PLAY" is an instruction about the screen. */
    var attract = cab.querySelector('.cab-attract');
    if (attract) {
      attract.addEventListener('click', function (e) {
        if (e.target === play) return;      // already handled
        cab.__wanted = true;
        load(cab);
      });
    }

    var g = cab.querySelector('.cab-grow');
    if (g) {
      g.addEventListener('click', function () {
        if (cab.classList.contains('grown')) shrink(cab); else grow(cab);
      });
    }
  }

  /* Escape leaves a grown cabinet, because a keyboard player who has
     grown one has no other obvious way out and the browser's own
     fullscreen habit is what their hand will reach for. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    for (var i = 0; i < cabs.length; i++) {
      if (cabs[i].classList.contains('grown')) shrink(cabs[i]);
    }
  });

  function start() {
    var list = document.querySelectorAll('.cab');
    for (var i = 0; i < list.length; i++) wire(list[i]);
    if (!list.length) return;

    if (!('IntersectionObserver' in window)) return;   // no observer, no unload

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var cab = entries[i].target;
        /* A GROWN CABINET IS NEVER UNLOADED. It is fixed to the
           viewport, so the article behind it can scroll out from under
           it, and unloading the thing somebody is playing because the
           page moved behind it would be absurd. */
        if (cab.classList.contains('grown')) continue;
        if (entries[i].isIntersecting) {
          if (cab.__wanted && !cab.__frame) load(cab);
        } else {
          unload(cab);
        }
      }
    }, {
      /* A generous margin, so a cabinet is not torn down the instant its
         last pixel leaves and rebuilt the instant it returns. Scrolling
         past one and back is the common case on these pages and it
         should cost nothing. */
      rootMargin: '200px 0px 200px 0px',
      threshold: 0
    });
    for (var j = 0; j < list.length; j++) io.observe(list[j]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
