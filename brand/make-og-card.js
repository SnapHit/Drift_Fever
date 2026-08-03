const { chromium } = require('playwright');
const fs = require('fs');

/* The Open Graph card, rendered by the GAME'S OWN drawBrand off the
   GAME'S OWN path data, so the card cannot drift out of sync with what
   the title screen shows. Re-run this if the artwork ever changes. */
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:1200,height:630}, deviceScaleFactor:1});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(600);
  const png = await p.evaluate(() => {
    window.requestAnimationFrame = function(){return 0;};
    const W = 1200, H = 630;
    canvas.width = W; canvas.height = H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLOUR.VOID;
    ctx.fillRect(0, 0, W, H);
    /* STRAIGHT THROUGH drawBrand, NOT drawBrandInk. The game caches each
       mark into an offscreen bitmap and blits it, which is right for a
       screen redrawn sixty times a second and wrong here: this renders
       once, has no frame budget at all, and a card is looked at far
       closer than a title screen. Drawing the vectors directly avoids a
       rasterise and a blit for no gain.

       Ink width at seventy per cent of the card, which leaves 180 either
       side and a hair more top and bottom. The ink shares are what turns
       that into a box, because both viewBoxes carry an asymmetric margin
       and centring the box would visibly not centre the letters. */
    const art = BRAND.wordmark;
    const inkW = W * 0.70;
    const boxW = inkW / (art.ink.r - art.ink.l);
    const boxH = boxW * art.h / art.w;
    const inkH = boxH * (art.ink.b - art.ink.t);
    drawBrand(ctx, art,
              W / 2 - ((art.ink.l + art.ink.r) / 2 - 0.5) * boxW,
              H / 2 - ((art.ink.t + art.ink.b) / 2 - 0.5) * boxH,
              boxW);
    return { url: canvas.toDataURL('image/png'),
             inkW: inkW, inkH: +inkH.toFixed(1),
             marginX: (W - inkW) / 2, marginY: +((H - inkH) / 2).toFixed(1) };
  });
  const data = png.url.split(',')[1];
  fs.writeFileSync(require('path').resolve(__dirname, '..', 'og-card.png'), Buffer.from(data, 'base64'));
  console.log(JSON.stringify({ inkW: png.inkW, inkH: png.inkH,
                               marginX: png.marginX, marginY: png.marginY,
                               bytes: Buffer.from(data, 'base64').length }));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
