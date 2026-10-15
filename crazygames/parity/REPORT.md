# Parity report

Original: SnapHit/Drift_Fever at cd06dd5acaa3517a43aa2f34d94fea8e0b0ba1de. Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36. Time zone Australia/Sydney. Days 20261001 to 20261028.

PASS: 196 roads and 1086 drives (4757947 frames) over 28 days x 6 levels x 6 tapes, plus endless, routes, records across 6 reloads and the real frame, identical on both sides; 469 finishes, 168 next levels, 1920 off road, 240 hits, 6 ran out, 386 continues, 1558 taps; K1 ok, K2 ok, K3 ok, K4 ok, K5 ok, K6 ok, K7 ok; 268s

## Known answers

- K1_days_differ: pass (L1: 28/28 distinct roads, 28/28 driver, 28/28 keys, 28/28 centre, 28/28 hug, 28/28 swing, 28/28 chaos; L2: 28/28 distinct roads, 28/28 driver, 28/28 keys, 28/28 centre, 28/28 hug, 28/28 swing, 28/28 chaos; L3: 28/28 distinct roads, 28/28 driver, 28/28 keys, 28/28 centre, 28/28 hug, 28/28 swing, 28/28 chaos; L4: 28/28 distinct roads, 28/28 driver, 28/28 keys, 28/28 centre, 28/28 hug, 28/28 swing, 28/28 chaos; L5: 28/28 distinct roads, 28/28 driver, 28/28 keys, 28/28 centre, 28/28 hug, 28/28 swing, 28/28 chaos; L6: 28/28 distinct roads, 28/28 driver, 28/28 keys, 28/28 centre, 28/28 hug, 28/28 swing, 28/28 chaos)
- K2_perturbation_fails: pass physics HEADING_BUILD_TIME 0.20 to 0.21: first mismatch at frame 126 of 3934/3934; generator CHECKPOINT_EVERY 1300 to 1301: hash 27995950 vs 1489758450, segments 2831/2831, hazards 2/2, jumps 5/5
- K3_viewport_independent: pass
- K4_day_rolled: pass (both sides boot on 20000101; every job reports the day rolled from, equal on both sides, and the first job of every group rolled from the sentinel)
- K5_frame_loop_dead: pass
- K6_real_frame: pass
- K7_every_ending_reached: pass {"offRoad":1920,"hits":240,"ranOut":6,"finishes":469,"continues":386,"nextLevel":168}

## Coverage

| group | jobs | frames | finishes | next levels | deaths | continues |
|---|---|---|---|---|---|---|
| level 1 | 196 | 590176 | 168 | 28 | 0 | 0 |
| level 2 | 196 | 578682 | 80 | 28 | 328 | 22 |
| level 3 | 196 | 683256 | 56 | 28 | 395 | 59 |
| level 4 | 196 | 773223 | 56 | 28 | 400 | 66 |
| level 5 | 196 | 885380 | 55 | 28 | 410 | 76 |
| level 6 | 196 | 992773 | 47 | 26 | 449 | 100 |
| endless | 84 | 174694 | 0 | 0 | 168 | 59 |
| routes | 6 | 25200 | 0 | 0 | 0 | 0 |
| records across reloads | 18 | 23922 | 4 | 2 | 6 | 0 |
| ran out of time | 3 | 8877 | 0 | 0 | 6 | 3 |
| fresh player, eased ramp | 4 | 17270 | 3 | 0 | 4 | 1 |
| real frame | 3 | 4500 | 0 | 0 | 0 | 0 |

## Hooks fired on the module side, level 6

```
{"recomputeCamera":1,"endTiltCal":550,"tuneStart":444,"clearDebris":550,"applyBiome":1426,"calibrateTilt":550,"audioSting":12436,"updateSmoke":854228,"updateDebris":939511,"audioChain":17243,"scoreHeatColour":5475,"addShake":72435,"landImpact":1015,"audioLanding":1015,"stopTiltHint":47,"buildShareCardSoon":496,"audioFinishHit":47,"finaleShells":184,"audioFanfareWave":184,"audioCrash":449,"explode":47,"rebuildDerivedColours":3}
```
