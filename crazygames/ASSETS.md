# Assets

Every asset in this build, with its source and licence. Commercial use
licences only, CC0 preferred. No AI generated images. Stage 2 is a greybox
and ships no textures and no models: the only third party asset is the
renderer library.

| Asset | Where | Source | Version | Licence |
|---|---|---|---|---|
| three.js | `public/vendor/three.webgpu.min.js` | npm package `three`, https://github.com/mrdoob/three.js | 0.184.0, pinned exactly in `package.json`, bundled and minified by `tools/vendor-three.js` with esbuild | MIT, copy in `public/vendor/three.LICENSE` |
| Music, four tracks | copied from the repository's `music/` folder into `dist/music/` at build time, read only | the live game's own tracks | as in the repository | as in the repository |
| The chrome: title screen, HUD, run card, share card, icons, the SnapHit lockups | `public/chrome.js`, `public/chrome.css`, `public/index.html`, generated from the live game's `index.html` by `tools/chrome.js` | this repository | commit in `vendor/original/COMMIT` | this repository |

Why 0.184.0 and not the newest: 0.185 and 0.186 pass a texture view
`swizzle` string to WebGPU that Chromium 141 rejects as not of type
`GPUTextureComponentSwizzle`, and the renderer throws on the WebGPU path
rather than falling back (measured here in the headless Chromium the
parity test runs). Browsers between the arrival of WebGPU and that spec
change would get a blank game. 0.184.0 does not send it.
