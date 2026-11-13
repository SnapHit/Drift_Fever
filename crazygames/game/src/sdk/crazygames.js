/* THE CRAZYGAMES SDK ADAPTER (their HTML5 SDK v3; docs.crazygames.com/sdk,
   read 14 November 2026).

   It does nothing at all unless the build says it is hosted on
   CrazyGames (sdk/host.js). Their script is an outside request and their
   SDK is "disabled" on every domain but theirs and localhost, where every
   call throws, so the preview and driftfever.com never load it: the zero
   outside requests rule holds everywhere except inside their player.

   In their player it loads their script, waits for init, and sends the
   game events their Basic and Full launches ask for:
     gameplayStart   when a run begins (the countdown is the run; their
                     Basic launch needs this one)
     gameplayStop    when it ends: results, a menu
   Their loading events are optional and are not sent: the game boots
   beside their script, not after it, so the boot is usually over before
   their SDK is ready to hear of it.
   No ads, no banners, no user or data module: ads are not allowed in a
   Basic launch and none are wanted until the author decides otherwise.

   Nothing here can stop the game. The script failing to load (a blocker),
   init rejecting, the environment reading disabled, a call throwing: each
   leaves the adapter quiet and the game as it is on the web. What the
   game asked for while the script was still loading is sent, in order,
   once it is ready. */
import { HOST } from './host.js';

export const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

export function createSdk() {
  /* the probes set window.__sdkHost before the page's script runs */
  const host = (typeof window !== 'undefined' && window.__sdkHost) || HOST;
  const st = { host, on: host === 'crazygames', state: host === 'crazygames' ? 'loading' : 'off', environment: null, playing: false, sent: [], error: null };
  let game = null, wantPlaying = false;
  function call(name) {
    try { game[name](); st.sent.push(name); } catch (e) { st.error = name + ': ' + (e && (e.code || e.message) || e); }
  }
  /* bring their side to what the game last asked for */
  function sync() {
    if (st.state !== 'ready') return;
    if (wantPlaying !== st.playing) { st.playing = wantPlaying; call(wantPlaying ? 'gameplayStart' : 'gameplayStop'); }
  }
  function fail(why) { st.state = 'failed'; st.error = String(why); }
  if (st.on) {
    try {
      const s = document.createElement('script');
      s.src = SDK_URL; s.async = true;
      s.onerror = () => fail('their script did not load');
      s.onload = async () => {
        try {
          const S = window.CrazyGames && window.CrazyGames.SDK;
          if (!S) return fail('their script loaded with no SDK');
          await S.init();
          st.environment = S.environment;
          if (S.environment !== 'crazygames' && S.environment !== 'local') { st.state = 'disabled'; return; }
          game = S.game; st.state = 'ready'; sync();
        } catch (e) { fail(e && (e.code || e.message) || e); }
      };
      document.head.appendChild(s);
    } catch (e) { fail(e && e.message || e); }
  }
  return {
    state: st,
    /* called every frame with whether a run is on; only a change is sent */
    playing(v) { v = !!v; if (v === wantPlaying) return; wantPlaying = v; sync(); },
  };
}
