/* LADDER PRIORITY 4 (briefs/RIVALS-LADDER.md): THE PIN RELEASE, PROVED.
   The drift race round found that TANDEM.PIN_SLACK never acted in any of
   its four contact cases against Kestrow. It acts when a wall holds the
   player inside the rival: a swipe into his side with the wall close on
   the other side. Upper deck's narrow road gives that: the drift race's
   SWIPE case (driftrace/contact.js) against Varsk there. This runs that
   case with the pin release as the game has it and with it off
   (PIN_SLACK at a size no overlap reaches), and asks:
   - with it on, the boxes never overlap past the contact measure's
     0.3 m outside a release, and the release acted on some steps;
   - known answer: with it off, the same case overlaps past 0.3 m (the
     player is held inside him by the wall).
   Varsk is not in the game (TANDEM.LIVE); the rule is the same for every
   rival, so the case proves it for all of them.

   node game/test/ladder/pin.js   writes review/ladder/pin.json */
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.resolve(here, '..', '..', '..', 'review', 'ladder');
const slackArg = process.argv.indexOf('--slack');
if (slackArg > 0) {
  /* the child: one contact run against Varsk at this PIN_SLACK */
  const { TANDEM } = await import('../../src/tune.js');
  if (process.argv[slackArg + 1] !== 'game') TANDEM.PIN_SLACK = +process.argv[slackArg + 1];
  const out = process.argv[process.argv.indexOf('--out') + 1];
  process.argv = [process.argv[0], 'contact.js', 'r3', '--out', out];
  await import('../driftrace/contact.js');
} else {
  let failed = 0;
  const verdict = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; };
  const run = slack => {
    const out = path.join(outDir, 'pin-' + slack + '.json');
    try { execFileSync('node', [new URL(import.meta.url).pathname, '--slack', slack, '--out', out], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { /* contact.js exits 1 on any of its own failures; its record is what is read */ }
    const r = JSON.parse(fs.readFileSync(out, 'utf8')).scenarios.SWIPE;
    fs.unlinkSync(out);
    return r;
  };
  const on = run('game'), off = run('1000');
  verdict(on.maxOverlap <= 0.3 && on.passThroughSteps > 0, 'the pin release acts: swiping Varsk on Upper deck, it let the player through on ' + on.passThroughSteps + ' steps and the boxes overlapped at most ' + on.maxOverlap + ' m (bar 0.3), ' + on.contacts + ' contacts, ' + on.hardContacts + ' hard');
  verdict(off.maxOverlap > 0.3, 'known answer: with the pin release off the same swipe overlaps ' + off.maxOverlap + ' m (' + off.contacts + ' contacts, ' + off.hardContacts + ' hard): ' + (off.maxOverlap > 0.3 ? 'CAUGHT' : 'MISSED'));
  fs.writeFileSync(path.join(outDir, 'pin.json'), JSON.stringify({ on, off }, null, 1));
  console.log(failed ? failed + ' failed' : 'all passed');
  process.exit(failed ? 1 : 0);
}
