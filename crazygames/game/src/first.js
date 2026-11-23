/* THE FIRST MINUTE'S SWITCH (briefs/FIRST-MINUTE.md, 23 November
   2026): round 2, the starter's new handling on Easy (FIRST in tune.js),
   the results' way to the garage and the live title. Behind ?first=2
   until the author had played it on his phone; the default since the
   afternoon of 23 November, by his word ("I love it, make it the
   default"). ?first=1 is the game as it was before the round, every
   frame and every run; ?first=2 still means on. Off in Node, where the
   probes' own physics runs (scans, searches, rivals' bars) were made
   without it and have no page to ask. */
const query = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;

export const FIRST_ON = !!query && query.get('first') !== '1';
