import { CAREER, careerSpec } from '../../src/loop/modes.js';
import { trackFor } from '../../src/ground/source.js';
import { driveRun } from './run.js';
for (let i = 0; i < CAREER.length; i++) {
  const spec = careerSpec(i), tr = trackFor(spec);
  const a = driveRun(tr, 'careful'), b = driveRun(tr, 'drifter');
  console.log(i, spec.name, tr.kind, tr.length, 'careful', a.finished, a.seconds, a.score, a.stars, a.targets.join('/'), 'cl', a.cleanSectors + '/' + a.sectors, 'c', a.contacts, 'r', a.respawns, '| drifter', b.finished, b.seconds, b.score, b.stars, 'c', b.contacts, 'r', b.respawns);
}
