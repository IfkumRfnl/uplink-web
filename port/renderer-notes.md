# Browser renderer

`port/webgl-renderer.cpp` draws the original C++ game with one authored GLES2/WebGL 1 shader, an interleaved vertex buffer and explicit state. `lib/gucci/uplink_draw.h` routes browser submissions to it and retains direct OpenGL aliases for native builds. Gameplay, authentication, FTGL glyph metrics and game scheduling are unchanged. Neither browser bundle links legacy immediate-mode emulation.

## Design

WebGL 1 covers the game's actual 2D requirements without introducing a WebGL 2-only dependency. There is no client-array emulation or fixed-function shader generator. See [Emscripten's supported modes](https://emscripten.org/docs/porting/multimedia_and_graphics/OpenGL-support.html).

- Quads become triangles. Each vertex carries transformed clip coordinates, UVs and RGBA8 colour, preserving sparse colour changes such as Memory Banks gradients. Compatible adjacent triangles and independent lines batch together; strips/loops flush separately and retain ordering.
- CPU model/projection stacks implement ortho, translate and scale. Explicit state handles texture REPLACE/MODULATE, blending, scissor clipping, depth/cull enable, line width and UI save/restore. State changes, presentation and texture mutations flush pending geometry.
- Original FTGL atlases and Image RGBA uploads keep their nearest sampling and existing metrics/scaling/alpha behavior. Live textures retain CPU pixels and sampler parameters; deletion releases them. Context recovery rebuilds textures, shader and buffer without reloading game/save state.

The previous browser's solid rendering of stippled lines is retained. Unused native lighting/fog/alpha-test initialization remains a browser no-op. Context recovery adds CPU texture backing memory, which has not been benchmarked.

## Regression checks

- `npm test`: compiled JS/Wasm contain direct WebGL draws and authored shaders, with no legacy bindings or warning text. Image and task-label checks retain their original behavior assertions.
- `npm run test:browser-renderer-probe`: real pixel readback for sparse gradients, quads/triangles, transforms, clipping/state restoration, textures/blending and independent lines; the same assertions run after each of two forced context restorations.
- `npm run test:browser-renderer`: original game login/registration, gateway, desktop/map, Memory Banks, software/File Copier, mission details, all three tutorial screens, audio, context recovery and real profile save/password reload. A QA-only helper fixes random map-label placement. Its bundle and captures stay under ignored `qa/renderer/`; production outputs are untouched.

CI runs these and the existing storage/lifecycle/display/Pages-subpath checks. Generated screenshots, results and logs are CI artifacts retained for three days, rather than checked-in output. The full-screen test captures evidence; it is not a completed tutorial/mission or campaign replay.

For baseline comparisons, build main `dbb5cd0` with the same SDK in a detached worktree, then run `bash port/tests/build-game-renderer-qa.sh /path/to/worktree`. Copy its `qa/renderer/game.{js,wasm,data}` to this checkout's `qa/baseline/`; run `QA_RENDERER_PHASE=baseline node port/tests/browser-renderer.cjs`, then the candidate test. `python3 port/tests/compare-renderer.py` (Pillow) writes paired screenshots and comparisons to `qa/renderer-comparison/`.

## Initial migration measurements

Emscripten 6.0.10, Chromium 151 on Debian 13 with SwiftShader, matching viewport/DPR and sequential three-second samples. These are software-rendered callback measurements including original synchronization, not hardware GPU predictions.

| Scene | Draws/frame before → after | Callback median ms before → after |
| --- | ---: | ---: |
| Desktop | 622 → 76 | 29.6 → 0.8 |
| Map | 769 → 99 | 34.0 → 0.9 |
| Memory Banks | 801 → 138 | 41.3 → 1.1 |

Expanded triangles increase vertex uploads: 66,112→104,384 / 81,952→128,744 / 85,200→134,344 bytes/frame respectively. Production JS shrank 594,637→420,539 bytes (gzip 138,742→107,392); Wasm grew 2,395,842→2,413,470 (gzip 761,267→768,029); 41,256,391 bytes of data were unchanged.

All 16 original comparisons had identical stable pixels, including context recovery. Only changing HUD `[0,0,444,50)` and footer `[0,748,1024,768)` rectangles were excluded; full frames and unmasked difference counts are preserved by the comparison tool. Login, registration, gateway and password-login frames were wholly identical. Firefox/Safari/mobile, hardware GPUs, native compilation and complete campaign replay remain untested.
