/* THE SPECTACLE SWITCH (briefs/SPECTACLE.md). Everything the spectacle
   round adds (the drift show, the dressed night and rain, the directing
   camera, the reacting score, the world's life and the adapting
   quality) is on unless the page is opened with ?fx=0, which shows the
   game exactly as it was before the round, so the two can be compared
   on a phone. ?fx=none goes further, as ?fx=0 did before the round:
   no particles at all. Presentation only: the physics, the input and
   the score never read this. */
const query = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');
const value = query.get('fx');

export const FX_ON = value !== '0' && value !== 'none';
export const FX_PARTICLES = value !== 'none';
