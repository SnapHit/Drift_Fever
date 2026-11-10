/* THE SAVE WHEN STORAGE IS FULL (10 November 2026). A browser that
   refuses a write used to leave nothing after it remembered, coins and
   stars included. Now the oldest ghosts go, one at a time, until the
   save fits; nothing else is ever dropped.

   In Node, against a storage that holds a set number of characters:
   1. With room: every write lands and no ghost is dropped.
   2. Full: the oldest ghosts are dropped and no newer one, the newest is
      kept, and the coins, stars, cars and missions written afterwards are
      there on a reload, which repairs nothing.
   3. Known answer: the same writes through a storage that refuses and has
      no guard to help it (every write thrown) drop no ghost, count the
      failures and keep the run's ghosts in memory.
   4. Known answer: a storage too small for the save with no ghosts at all
      drops nothing either.

   node game/test/loop/quota.js */
import { createSave, KEY } from '../../src/loop/save.js';

let failed = 0;
const verdict = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); };

/* localStorage with a cap on the characters it holds, or that always throws */
function storage(cap) {
  let held = null, refused = 0;
  return {
    getItem: () => held,
    setItem(k, v) { if (cap < 0 || String(v).length > cap) { refused++; const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } held = String(v); },
    removeItem() { held = null; },
    get size() { return held ? held.length : 0; }, get refused() { return refused; },
  };
}
/* a ghost of about `chars` characters, driven at `when` */
function ghost(when, chars) {
  const tape = [];
  for (let i = 0; i < Math.max(1, Math.round(chars / 16)); i++) tape.push([3, (i % 7) / 10, 1, 0, i % 2]);
  return { score: 100 + when, best: 10, car: 'starter', paint: 'cyan', steps: tape.length * 3, hash: 'h' + when, tape, when, seconds: 60 };
}
function play(store) {
  const save = createSave({ storage: store });
  for (let i = 0; i < 8; i++) save.setGhost('career:' + i, ghost(1000 + i, 4000));
  save.addCoins(777);
  save.careerResult(3, 2, 900);
  save.missionResult('career:3', [true, false, true]);
  return save;
}

/* 1. room for everything */
{
  const store = storage(10000000), save = play(store);
  verdict(save.status.ghostsDropped === 0 && save.status.failedWrites === 0 && Object.keys(save.state.ghosts).length === 8, 'with room: 8 ghosts kept, 0 dropped, 0 failed writes, ' + store.size + ' characters held');
}
/* 2. full: room for about four ghosts */
{
  const one = JSON.stringify(ghost(1, 4000)).length, cap = one * 4 + 1500;
  const store = storage(cap), save = play(store);
  const kept = Object.keys(save.state.ghosts).sort(), dropped = save.status.ghostsDropped;
  const newest = kept.includes('career:7'), oldestGone = !kept.includes('career:0');
  /* every kept ghost is newer than every dropped one */
  const keptWhen = kept.map(k => save.state.ghosts[k].when), ordered = Math.min(...keptWhen) === 1000 + dropped;
  verdict(dropped > 0 && kept.length + dropped === 8 && newest && oldestGone && ordered && save.status.failedWrites === 0, 'full (' + cap + ' characters, a ghost is ' + one + '): ' + dropped + ' oldest dropped, kept ' + kept.join(' ') + ', failed writes ' + save.status.failedWrites + ', refused ' + store.refused);
  const again = createSave({ storage: store });
  verdict(again.status.loaded && again.status.repaired === 0 && again.state.coins === 777 && again.state.career['3'].stars === 2 && again.state.career['3'].best === 900 && JSON.stringify(again.state.missions['career:3']) === '[1,0,1]' && Object.keys(again.state.ghosts).length === kept.length && !!again.state.cars.starter, 'reloaded: coins ' + again.state.coins + ', career 4 stars ' + again.state.career['3'].stars + ', missions ' + JSON.stringify(again.state.missions['career:3']) + ', ghosts ' + Object.keys(again.state.ghosts).length + ', repairs ' + again.status.repaired);
  verdict(store.size <= cap && JSON.parse(store.getItem(KEY)).coins === 777, 'the stored save fits and holds the last write: ' + store.size + ' of ' + cap);
}
/* 3. known answer: storage that throws on every write */
{
  const store = storage(-1), save = play(store);
  verdict(save.status.ghostsDropped === 0 && save.status.failedWrites > 0 && Object.keys(save.state.ghosts).length === 8 && save.state.coins === 777 && store.size === 0, 'known answer, every write refused: 0 ghosts dropped, ' + save.status.failedWrites + ' failed writes, 8 ghosts and the coins still in memory, nothing stored');
}
/* 4. known answer: too small even with no ghosts */
{
  const store = storage(40), save = play(store);
  verdict(save.status.ghostsDropped === 0 && save.status.failedWrites > 0 && Object.keys(save.state.ghosts).length === 8, 'known answer, 40 characters of storage: 0 ghosts dropped, ' + save.status.failedWrites + ' failed writes');
}
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
