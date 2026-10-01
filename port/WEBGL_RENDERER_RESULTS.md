# WebGL renderer validation

Compared against main `dbb5cd0554bd9c1a4a7cf7d7c2823f06626b4107`, using the same Emscripten 6.0.10 toolchain, assets and Chromium 151.0.7922.173 on Debian 13. These are local measurements with Chromium's SwiftShader software GPU, not hardware performance predictions. No site was deployed.

The game now uses the authored WebGL 1 / GLES2 shader and interleaved vertex buffer described in [renderer-notes.md](renderer-notes.md). WebGL 1 covers the original 2D game's needs and retains a broader supported baseline; there is no requirement for WebGL 2 features. Quads become triangles, sparse vertex colours preserve gradients, and explicit matrices, texture modes, blend/scissor state and font atlas sampling preserve the original rendering semantics. Adjacent compatible triangles and independent lines batch together. Strip/loop boundaries retain their own draws.

## Visual evidence

[Machine-readable comparison](evidence/webgl/visual-comparison.json) records zero differing stable pixels in all 16 comparisons, including context restoration. Full screenshots remain visible side by side (baseline left, candidate right): [login](evidence/webgl/login.png), [password login](evidence/webgl/password-login.png), [registration](evidence/webgl/registration.png), [gateway](evidence/webgl/gateway.png), [desktop](evidence/webgl/desktop.png), [world map](evidence/webgl/world-map.png), [Memory Banks](evidence/webgl/memory-banks.png), [software menu](evidence/webgl/software-menu.png), [File Copier](evidence/webgl/software.png), [mission details](evidence/webgl/mission.png), [tutorial menu](evidence/webgl/tutorial-menu.png), [tutorial one](evidence/webgl/tutorial-one.png), [tutorial two](evidence/webgl/tutorial-two.png), [tutorial three](evidence/webgl/tutorial-three.png), [reloaded game](evidence/webgl/reloaded.png).

Only the clock/CPU/task area `[0,0,444,50)` and changing footer `[0,748,1024,768)` are excluded from stable-pixel assertions. Full-frame differences are also recorded, so these exclusions are reviewable. A QA-only helper fixes the original random map-label solver's positions through its existing layout methods. That helper is absent from production bundles. Original authentication/gameplay code is unchanged. The renderer probe separately asserts real GPU-readback pixels for gradients, triangles/quads, transforms, clipping, textures, blending, lines and restoration of resources twice.

Reproduce with `npm run test:browser-renderer-probe`, then `npm run test:browser-renderer`. The latter links a QA-only game variant; run `npm run build` afterwards to restore production outputs. For comparison with main, use the detached baseline build described in [renderer-notes.md](renderer-notes.md), then run `python3 port/tests/compare-renderer.py` (requires Pillow).

## Measurements

Sequential three-second samples of the same scenes, viewport and DPR, with no concurrent browser test. Callback timings wrap the game's actual main-loop callback; they include its original synchronizing calls and are not isolated GPU timers. Raw data: [baseline](evidence/webgl/baseline-results.json), [candidate](evidence/webgl/after-results.json).

| Scene | Draws/frame before → after | Callback median ms before → after | Callback P95 ms before → after |
| --- | ---: | ---: | ---: |
| Desktop | 622 → 76 | 29.6 → 0.8 | 37.2 → 1.1 |
| World map | 769 → 99 | 34.0 → 0.9 | 40.2 → 1.2 |
| Memory Banks | 801 → 138 | 41.3 → 1.1 | 52.6 → 1.7 |

The candidate maintained 180 frames per sample; baseline produced 74, 63 and 56 respectively. Vertex-buffer upload volume increased: desktop 66,112 → 104,384 bytes/frame; map 81,952 → 128,744; Memory Banks 85,200 → 134,344. Explicit expanded triangles trade upload volume for fewer draws and removal of the legacy state machinery. Retained CPU texture backing supports context recovery and adds memory cost; total heap usage was not benchmarked.

Production build sizes, with no QA helper, are recorded with SHA-256 hashes in [build-measurements.json](evidence/webgl/build-measurements.json). Gzip uses Python's default level 9 consistently.

| Asset | Bytes before → after | Gzip bytes before → after |
| --- | ---: | ---: |
| game.js | 594,637 → 420,539 | 138,742 → 107,392 |
| game.wasm | 2,395,842 → 2,413,470 | 761,267 → 768,029 |
| game.data | 41,256,391 → 41,256,391 | 23,452,084 → 23,452,084 |

## Checks and limits

Passed production build (236 compilation units), aggregate unit checks and Wasm validation; source/link checks confirm no legacy emulation dependency or warning. Actual-browser tests passed for renderer pixels and two context recoveries; original game registration/login, real save/reload, advancing music and original WAV/OGG playback; repeated right-click input; DPR 1/2 and four viewport sizes; 800×600, 1024×768, 1280×960 and 1600×1200 resolutions; persisted fit/sharp/native scaling, fullscreen and pointer mapping; storage failure recovery; hidden/frozen-tab recovery; and local Pages subpath assets/save/audio. Candidate recorded no page errors, WebGL errors or legacy warnings.

This pass exercises tutorial screens and mission details plus launching File Copier. It does not replay a completed tutorial/test mission or a full campaign. Native desktop compilation, Firefox, Safari, mobile and hardware GPUs remain untested. The original browser's solid rendering of line stipple remains unchanged. Existing desktop/Steam save compatibility was not newly tested. Codex GitHub review is quota-limited; no bot review is claimed. This change is submitted as a draft for review, without merging or deployment.
