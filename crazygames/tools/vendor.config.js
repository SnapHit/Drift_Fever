/* THE RENDERER BOUNDARY, decided on purpose, one name at a time.

   roots     the simulation's entry points. Everything they reach is taken.
   cut       names the renderer owns. Each becomes a stub: a function that
             forwards to the hook of the same name if the host supplies one,
             or a value with a fixed initialiser.
   replace   mixed functions whose simulation half is kept and whose
             renderer half is handed to a hook. The replacement body is
             written here, next to the line it replaces, and the parity test
             is what proves it equivalent.
   rewrites  textual rewrites applied to every taken declaration. Only one:
             Math.random becomes a hook, so a host can seed it. */
export default {
  roots: [
    // a run, from every door
    'startRun', 'continueRun', 'startOrRestart', 'spendRestartWanted', 'startDaily', 'startEndless',
    'startNextLevel', 'leaveRun', 'switchMode', 'skipTraining', 'setPaused', 'togglePause',
    // the frame, in the order frame() calls it
    'update', 'updateScore', 'updateClock', 'updateSpectacle', 'ghostUpdate', 'updateBar',
    // the input value the physics reads, and the one writer that is pure
    'steering', 'updateSteering', 'held', 'clearHeldInput',
    // records, cars, the day
    'rollDayIfNeeded', 'loadRunsEver', 'loadFinishedEver', 'loadTrainedEver', 'recFor', 'dayTotals',
    'pickCar', 'nextCar', 'carsUnlocked', 'carUnlocked', 'activeCar',
    'localDayStamp', 'dailySeedFor', 'levelSeedFor', 'trackNumber', 'levelGatesFor', 'isTraining',
    // things the renderer and the harness read about the road
    'segAt', 'segHeight', 'topUpRoad', 'resetRoad', 'updateDifficulty', 'refreshTrackLength',
    'gateSegment', 'canContinue', 'countHolding', 'finaleActive', 'finaleRunning', 'finaleReveal',
    // the title screen's routing rule, and the ends of a run by name
    'startTitleRoute', 'startMode', 'titleRouteLevel', 'nextLevel', 'crash', 'finishRun', 'skipFinale', 'canSkipTraining'
  ],
  cut: {
    // audio
    audioSting:      { as: 'hook', reason: 'sound effect' },
    audioCrash:      { as: 'hook', reason: 'sound effect' },
    audioLanding:    { as: 'hook', reason: 'sound effect' },
    audioChain:      { as: 'hook', reason: 'sound effect' },
    audioFinishHit:  { as: 'hook', reason: 'sound effect' },
    audioFanfareWave:{ as: 'hook', reason: 'sound effect' },
    tuneStart:       { as: 'hook', reason: 'music, an <audio> element' },
    tuneWake:        { as: 'hook', reason: 'music, an <audio> element' },
    // the screen
    addShake:        { as: 'hook', reason: 'camera shake is drawn, never read by the physics' },
    spawnSmoke:      { as: 'hook', reason: 'tyre smoke particles, screen space' },
    updateSmoke:     { as: 'hook', reason: 'tyre smoke particles, screen space' },
    clearSmoke:      { as: 'hook', reason: 'tyre smoke particles, screen space' },
    updateDebris:    { as: 'hook', reason: 'debris and firework particles, screen space' },
    finaleShells:    { as: 'hook', reason: 'fireworks' },
    rebuildDerivedColours: { as: 'hook', reason: 'palette ramps and cached fills' },
    buildCarPaints:  { as: 'hook', reason: 'palette' },
    resize:          { as: 'hook', reason: 'canvas size, gradients, DOM measurement' },
    measureChrome:   { as: 'hook', reason: 'DOM measurement' },
    buildShareCardSoon: { as: 'hook', reason: 'the share card is drawn to an offscreen canvas' },
    scoreHeatColour: { as: 'hook', reason: 'a colour picked off a ramp for the callout; the renderer colours its own text' },
    showNote:        { as: 'hook', reason: 'DOM toast' },
    // tilt is an input source; the simulation reads steering.value only
    calibrateTilt:   { as: 'hook', reason: 'device orientation input' },
    endTiltCal:      { as: 'hook', reason: 'device orientation input' },
    // DOM handles
    pauseBtn:        { as: 'value', init: '{ innerHTML: "", classList: { toggle() {} } }', reason: 'DOM button' },
    ICON:            { as: 'value', init: '{}', reason: 'SVG icon markup' },
    // the palette: callers pass COLOUR.X as a colour; the simulation carries the role name instead
    COLOUR:          { as: 'value', init: 'new Proxy({}, { get: (t, k) => (typeof k === "string" ? k : undefined) })', reason: 'palette; colour roles stand in for colours' },
  },
  replace: {
    storeGet: { reason: 'localStorage becomes a hook; the prefix is kept', src: `
function storeGet(key) {
  try { return H.storeGet(STORAGE_PREFIX + key); }
  catch (e) { return null; }
}` },
    storeSet: { reason: 'localStorage becomes a hook; the prefix is kept', src: `
function storeSet(key, value) {
  try { H.storeSet(STORAGE_PREFIX + key, value); }
  catch (e) { /* no memory is fine, the game still plays */ }
}` },
    localDayStamp: { reason: 'the clock becomes a hook, so a host or a test can pick the day', src: `
function localDayStamp(when) {
  const d = when || H.now();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}` },
    applyBiome: { reason: 'the biome index and the hue memory are simulation state; the palette swap and the resize are the renderer', src: `
function applyBiome(i) {
  if (!BIOMES.length) buildBiomes();
  biome = ((i % BIOMES.length) + BIOMES.length) % BIOMES.length;
  lastBiomeHue = biomeHue(biome);
  if (H.applyBiome) H.applyBiome(biome);
}` },
    stopTiltHint: { reason: 'the hint is UI, but finishing a run is what remembers that it need never show again, and that memory lives in the store with the records', src: `
function stopTiltHint(remember) {
  if (H.stopTiltHint) H.stopTiltHint(remember);
  if (remember) storeSet('tilthint', '1');
}` },
    recomputeCamera: { reason: 'the camera depth and height the sight line clause reads are simulation inputs; the gradients that move with them are the renderer', src: `
function recomputeCamera() {
  CAMERA_DEPTH = 1 / Math.tan((FEEL.FIELD_OF_VIEW_DEG / 2) * Math.PI / 180);
  camHeight = FEEL.CAMERA_HEIGHT;
  if (H.recomputeCamera) H.recomputeCamera();
}` },
    buildBiomes: { reason: 'only the biome count and the ground hue per biome are simulation inputs: the shuffle keeps hues apart. The palettes themselves are the renderer', src: `
function buildBiomes() {
  const n = clamp(Math.round(FEEL.BIOME_COUNT), 1, BIOME_PALETTE.length);
  BIOMES = [];
  BIOME_HUE = [];
  for (let i = 0; i < n; i++) {
    BIOMES.push({ index: i });
    BIOME_HUE.push(BIOME_PALETTE[i].gnd[0]);
  }
  biomeBag.length = 0;
  biomeRecent.length = 0;
  lastBiomeHue = -999;
}` },
    landImpact: { reason: 'the touchdown is made of parts: grit and smoke are the renderer, the tyre marks it lays into the road and the world flare it starts are simulation state the renderer reads back', src: `
function landImpact(q, tier, bad, localHalf) {
  if (H.landImpact) H.landImpact(q, tier, bad, localHalf);
  if (!bad) {
    const axleZ = rearAxleZ();
    const idx = Math.floor(axleZ / FEEL.SEGMENT_LENGTH);
    const now = rearWheelOffsets(carX);
    const l = now.left, r = now.right;
    for (let i = idx - 1; i <= idx + 1; i++) {
      const seg = segAt(i);
      if (!seg) continue;
      if (seg.ma === 0) { seg.ml0 = l / seg.hw; seg.mr0 = r / seg.hw; }
      seg.ml1 = l / seg.hw;
      seg.mr1 = r / seg.hw;
      const a = FEEL.JUMP_LAND_MARK * (0.55 + 0.45 * q);
      if (a > seg.ma) seg.ma = a;
    }
    lastMarkSeg = idx;
  }
  if (tier === 2) landFlare = FEEL.JUMP_LAND_FLARE * q;
}` },
    explode: { reason: 'the hit stop and the flash timer are simulation state; the debris is the renderer', src: `
function explode() {
  addShake(FEEL.EXPLODE_SHAKE_PX);
  hitStop = FEEL.HIT_STOP_TIME;
  explodeFlash = FEEL.EXPLODE_FLASH_TIME;
  if (H.explode) H.explode();
}` },
    clearDebris: { reason: 'the hit stop and the flash timer are simulation state; the debris pool is the renderer', src: `
function clearDebris() {
  hitStop = 0;
  explodeFlash = 0;
  if (H.clearDebris) H.clearDebris();
}` },
  },
  /* Load time statements reproduced by boot() instead of being taken as they
     stand, because the original interleaves them with resize() and the
     first requestAnimationFrame. */
  excludeStatements: [30990, 30991, 30992, 30993, 30997, 30998],
  rewrites: [
    ['Math\\.random\\(\\)', 'H.random()'],
  ],
  browserGlobals: ['document', 'window', 'navigator', 'performance', 'setTimeout', 'setInterval', 'getComputedStyle',
                   'innerHeight', 'innerWidth', 'Path2D', 'Blob', 'ClipboardItem', 'File', 'Audio', 'console', 'Promise',
                   'requestAnimationFrame', 'localStorage', 'location', 'screen', 'matchMedia', 'Image', 'OffscreenCanvas'],
  suspectPattern: '^(draw|sprite|SPR_|ctx$|view$|canvas$|carParts|.*Gradient|.*El$|.*Btn$|ICON|COLOUR|audio|tune|music|sfx|bake|hud|say|show|paint|glyph|font|text|PALETTE|ROLE|rgb|hsl)',
  /* Appended inside the factory after the taken code. step() is frame()'s
     simulation half, in frame()'s order, so a host or a test advances the
     world exactly as the original does. boot() is the boot statement's
     simulation half. */
  extra: `
function step(dt) {
  // frame()'s simulation half, in frame()'s order: the pause gate first
  if (paused) { clearHeldInput(); return; }
  spendRestartWanted();
  if (hitStop > 0) {
    hitStop -= dt;
    deadFor += dt;
    return;
  }
  // the one steering value, ramped from held keys and touch or copied from
  // tilt, exactly where frame() does it. The host writes held.* or tilt.*
  updateSteering(dt);
  update(dt);
  updateScore(dt);
  updateClock(dt);
  updateSpectacle(dt);
  ghostUpdate(dt);
  updateBar(dt);
}
/* The host calls this when its own splash has ended: the original's boot
   chrome is DOM and is not vendored, and update() wakes the music on the
   title screen only once both of these say the splash is over. */
function endBoot() {
  bootFlash = 0;
  bootShown = false;
}
function boot() {
  // the boot statement's simulation half, L30990 to L30998 of the original
  loadRunsEver();
  loadFinishedEver();
  loadTrainedEver();
  recomputeCamera();
  updateDifficulty();
  resetRoad(nextSeed());
}
boot();
`
};
