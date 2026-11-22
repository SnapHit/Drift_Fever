/* THE FIRST MINUTE'S SWITCH (briefs/FIRST-MINUTE.md, 23 November
   2026). ?first=2 turns on round 2: the starter's new handling (FIRST in
   tune.js), the results' way to the garage and the live title. Without
   it every frame and every run is the game as it was. Behind the switch
   until the author has played it on his phone. */
const query = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');

export const FIRST_ON = query.get('first') === '2';
