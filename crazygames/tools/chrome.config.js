/* THE CHROME BOUNDARY, decided on purpose, one name at a time. See
   tools/chrome.js. The simulation's names come from sim/VENDOR.json and
   are never listed here: any reference to one is rewritten to SIM.name.

   roots     entry points, besides every load time statement the
             simulation did not take.
   cut       names the world owns. 'world' forwards to WORLD.name, 'noop'
             does nothing, 'value' is a fixed initialiser.
   replace   bodies written here, next to the line they replace. */
export default {
  roots: ['frame', 'render', 'resize'],
  /* Appended to the simulation by vendor.config.js, so they are
     simulation functions although VENDOR.json does not list them. */
  extraSimFunctions: ['step', 'endBoot', 'boot'],
  cut: {
    // the Canvas 2D world, pass by pass, as render() called it
    drawSkyline:        { as: 'world', reason: 'the city on the horizon is 3D now' },
    drawGrid:           { as: 'world', reason: 'the grid under the road is 3D now' },
    drawRoad:           { as: 'world', reason: 'the road, the terrain, the scenery, the hazards, the jumps, the gates and the other cars are 3D now' },
    drawSmoke:          { as: 'world', reason: 'tyre smoke is a 3D particle' },
    drawCar:            { as: 'world', reason: 'the car is 3D now' },
    drawCarReflection:  { as: 'world', reason: 'the car reflection is 3D now' },
    drawDebris:         { as: 'world', reason: 'debris and fireworks are 3D particles' },
    // the effects the simulation drives through hooks, which the world owns
    spawnSmoke:         { as: 'world', reason: 'tyre smoke is a 3D particle' },
    updateSmoke:        { as: 'world', reason: 'tyre smoke is a 3D particle' },
    clearSmoke:         { as: 'world', reason: 'tyre smoke is a 3D particle' },
    updateDebris:       { as: 'world', reason: 'debris and fireworks are 3D particles' },
    finaleShells:       { as: 'world', reason: 'fireworks are 3D particles' },
    fireworkLaunch:     { as: 'world', reason: 'fireworks are 3D particles' },
    fireworkBurst:      { as: 'world', reason: 'fireworks are 3D particles' },
    addShake:           { as: 'world', reason: 'camera shake is a camera offset in the world' },
    // bakers and tables the world passes used
    spriteBuildAtlas:   { as: 'noop', reason: 'sprite atlas for the Canvas 2D scenery' },
    spriteRebakeSigns:  { as: 'noop', reason: 'sprite atlas for the Canvas 2D scenery' },
    buildCarPaints:     { as: 'noop', reason: 'car paints for the Canvas 2D car' },
    buildDepthLut:      { as: 'noop', reason: 'depth shading table for the Canvas 2D world' },
    buildMaterialLut:   { as: 'noop', reason: 'material table for the Canvas 2D scenery' },
    measureChrome:      { as: 'noop', reason: 'the debug readout is the world overlay now' },
  },
  replace: {
    ctx: { reason: 'the overlay canvas is transparent over the 3D canvas, so it keeps its alpha', src: `
const ctx = canvas.getContext('2d');` },
    syncMore: { reason: 'the fine print is not in this build, so the reconcile has nothing to show or hide; the one line guard is the framed case the original already has', src: `
function syncMore() {
  if (framed || !moreEl) return;
  const want = state === TITLE && !paused && !tiltCalOnScreen();
  if (want === moreShown) return;
  moreShown = want;
  moreEl.classList.toggle('away', !want);
}` },
    render: { reason: 'the world is the 3D canvas underneath; the overlay passes are the original\'s, in its order', src: `
function render() {
  const w = view.w, h = view.h;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  /* The original wrote camHeight here, with a viewport term, which is the
     one path from the renderer into the generator the extraction found.
     The 3D camera follows camLift on its own and writes nothing back. */
  WORLD.render(w, h);
  drawScrapeFlash(w, h);
  drawSpectacleFlash(w, h);
  drawBar(w, h);
  drawScore(w, h);
  drawModeMark(w, h);
  drawCallout(w, h);
  drawCountdown(w, h);
  drawOverlay(w, h);
  drawPauseCover(w, h);
  drawTiltCal(w, h);
  drawTiltHint(w, h);
  drawTuneName(w, h);
  syncBoot();
  syncCredit();
  syncMore();
  syncSkip();
  drawHud(w, h);
}` },
  },
  /* Load time statements left behind, by line, with the reason. */
  excludeStatements: {
    14225: 'the skyline shapes are the world',
    20820: 'the sprite registry is the world',
    22063: 'the car box points are the world',
    22172: 'the station ring points are the world',
    22427: 'drawBox is the world',
    22445: 'faceInset is the world',
    27507: 'the debris pool is the world',
    30986: 'the booting class is set by createChrome\'s caller, which owns the splash timing',
    30990: 'boot: the simulation\'s boot()',
    30991: 'boot: the simulation\'s boot()',
    30992: 'boot: the simulation\'s boot()',
    30993: 'boot: the simulation\'s boot()',
    30994: 'boot: tiltAssert is a self check of the tilt formula and setDebug is called by the host',
    30997: 'boot: the simulation\'s boot()',
    30998: 'boot: the simulation\'s boot()',
    30999: 'boot: the host calls resize once the world exists',
    31000: 'boot: the host starts the frame loop',
  },
  rewrites: [],
  /* Appended inside the factory after the taken code. The chrome halves of
     the functions the simulation replaced, cited line by line, so the host
     can wire each simulation hook to the half the simulation handed over. */
  extra: `
/* L6643 buildBiomes, the palette half. The simulation keeps the count and
   the ground hue per biome; the palettes themselves are built here, into
   a list of the chrome's own, from the same rules and the same base. */
let BIOME_PALETTES = [];
function buildBiomePalettes() {
  if (!PALETTE_BASE) {
    PALETTE_BASE = {};
    for (const k in COLOUR) PALETTE_BASE[k] = COLOUR[k];
  }
  const wasVoid = rgbOf(PALETTE_BASE.VOID);
  if (!ROLE_BASE) ROLE_BASE = buildRoleBase(PALETTE_BASE, wasVoid);
  BIOME_ROLE_BAND = FEEL.ROAD_ABOVE_TERRAIN >= 0.5 ? BIOME_ROLE_BAND_ROAD_ABOVE
                                                   : BIOME_ROLE_BAND_DEFAULT;
  const n = clamp(Math.round(FEEL.BIOME_COUNT), 1, BIOME_PALETTE.length);
  BIOME_PALETTES = [];
  for (let i = 0; i < n; i++) {
    const rec = BIOME_PALETTE[i];
    const b = {};
    b.VOID = PALETTE_BASE.VOID;
    const nowVoid = wasVoid;
    for (const k in PALETTE_BASE) {
      if (k === 'VOID') continue;
      if (PALETTE_FIXED[k]) { b[k] = PALETTE_BASE[k]; continue; }
      const role = biomeRole(k);
      const spec = rec[role];
      if (!spec) { b[k] = PALETTE_BASE[k]; continue; }
      const src = ROLE_BASE[role];
      const c = rgbOf(PALETTE_BASE[k]), a = c[3];
      const rr = a >= 1 ? c[0] : c[0] * a + wasVoid[0] * (1 - a);
      const gg = a >= 1 ? c[1] : c[1] * a + wasVoid[1] * (1 - a);
      const bb = a >= 1 ? c[2] : c[2] * a + wasVoid[2] * (1 - a);
      const hsl = rgbToHsl(rr, gg, bb);
      const hue = (role === 'gnd' ? terrainGreenHue(spec[0]) : spec[0])
                + (hsl[0] - src.hue);
      const sat = clamp(hsl[1] * spec[1], 0, 1);
      const band = BIOME_ROLE_BAND[role];
      let wantL = byteLuma(rr, gg, bb);
      if (band) {
        const span = src.hi - src.lo;
        const f = span > 0.01 ? (wantL - src.lo) / span : 0.5;
        wantL = band[0] + f * (band[1] - band[0]);
      }
      b[k] = roleColour(PALETTE_BASE[k], hue, sat, wantL, wasVoid, nowVoid);
    }
    BIOME_PALETTES.push(b);
  }
}
/* L6804 applyBiome, the chrome half: the simulation has already set the
   biome index and the hue memory and hands the index here. */
function applyBiomeChrome(i) {
  if (!BIOME_PALETTES.length) buildBiomePalettes();
  const b = BIOME_PALETTES[((i % BIOME_PALETTES.length) + BIOME_PALETTES.length) % BIOME_PALETTES.length];
  for (const k in b) COLOUR[k] = b[k];
  rebuildDerivedColours();
  buildCarPaints();
  if (view.h) resize();
}
/* L9862 stopTiltHint, the chrome half: the simulation remembers, this clears the ring. */
function stopTiltHintChrome(remember) {
  tiltHintLeft = 0;
  tiltBtn.classList.remove('hint');
}
/* L8454 recomputeCamera, the chrome half: the horizon and the cached gradients move with it. */
function recomputeCameraChrome() {
  if (view.h) resize();
}
`,
};
