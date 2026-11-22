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

/* THE COVER LOOK (briefs/COVER-LOOK.md, 22 November 2026): the game
   drawn as its cover is. Behind ?look=2 until the author had played it
   on his phone; the default since the evening of 22 November, by his
   word. An environment lighting every reflective surface, clear coat
   paint, a wet floodlit road, a denser venue, thick lit smoke, a closer
   and lower camera, antialiasing. ?look=1 shows the game as it was
   before the round, every frame the same to the pixel. Presentation only:
   the physics, the input and the score never read this. It rides on
   the spectacle round, so ?fx=0 turns it off as well. */
export const LOOK_ON = FX_ON && query.get('look') !== '1';
