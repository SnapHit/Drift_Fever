# Parity report

Original: SnapHit/Drift_Fever at cd06dd5acaa3517a43aa2f34d94fea8e0b0ba1de. Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36. Time zone Australia/Sydney. Days 20261001 to 20261028.

PASS: 196 roads and 878 drives (3496807 frames) over 28 days x 6 levels x 5 tapes plus endless, identical on both sides; 305 finishes, 1805 off road, 189 hits, 0 ran out, 310 continues, 1427 taps; K1 ok, K2 ok, K3 ok, K4 ok, K5 ok; 96s

## Known answers

- K1_days_differ: pass (L1: 28/28 distinct roads, 28/28 distinct driver drives, 28/28 distinct centre drives, 28/28 distinct hug drives, 28/28 distinct swing drives, 28/28 distinct chaos drives; L2: 28/28 distinct roads, 28/28 distinct driver drives, 28/28 distinct centre drives, 28/28 distinct hug drives, 28/28 distinct swing drives, 28/28 distinct chaos drives; L3: 28/28 distinct roads, 28/28 distinct driver drives, 28/28 distinct centre drives, 28/28 distinct hug drives, 28/28 distinct swing drives, 28/28 distinct chaos drives; L4: 28/28 distinct roads, 28/28 distinct driver drives, 28/28 distinct centre drives, 28/28 distinct hug drives, 28/28 distinct swing drives, 28/28 distinct chaos drives; L5: 28/28 distinct roads, 28/28 distinct driver drives, 28/28 distinct centre drives, 28/28 distinct hug drives, 28/28 distinct swing drives, 28/28 distinct chaos drives; L6: 28/28 distinct roads, 28/28 distinct driver drives, 28/28 distinct centre drives, 28/28 distinct hug drives, 28/28 distinct swing drives, 28/28 distinct chaos drives)
- K2_perturbation_fails: pass physics HEADING_BUILD_TIME 0.20 to 0.21: first mismatch at frame 126 of 3935/3935; generator CHECKPOINT_EVERY 1300 to 1301: hash 27995950 vs 1489758450, segments 2831/2831, hazards 2/2, jumps 5/5
- K3_viewport_independent: pass
- K4_day_took: pass
- K5_frame_loop_dead: pass

## Coverage

| group | jobs | frames | finishes | deaths | continues |
|---|---|---|---|---|---|
| level 1 | 168 | 502209 | 112 | 0 | 0 |
| level 2 | 168 | 471310 | 24 | 88 | 21 |
| level 3 | 168 | 521190 | 0 | 112 | 56 |
| level 4 | 168 | 559356 | 0 | 112 | 58 |
| level 5 | 168 | 621596 | 0 | 112 | 58 |
| level 6 | 168 | 671883 | 0 | 114 | 61 |
| endless | 56 | 106794 | 0 | 28 | 55 |
| routes | 6 | 25200 | 0 | 2 | 0 |
| fresh player, eased ramp | 4 | 17269 | 3 | 1 | 1 |

## Hooks fired on the module side

```
{"recomputeCamera":1,"endTiltCal":436,"tuneStart":415,"clearDebris":436,"applyBiome":893,"calibrateTilt":436,"audioSting":3299,"updateSmoke":383619,"updateDebris":421773,"audioChain":7389,"scoreHeatColour":2965,"addShake":50063,"landImpact":363,"audioLanding":363,"stopTiltHint":52,"buildShareCardSoon":380,"audioFinishHit":52,"finaleShells":132,"audioFanfareWave":132,"audioCrash":328,"explode":29,"rebuildDerivedColours":3}
```
