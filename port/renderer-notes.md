# Uplink browser renderer

The browser build now uses an explicit GLES 2 / WebGL 1 shader-and-buffer pipeline in `port/webgl-renderer.cpp`. The original C++ game, Eclipse/VanBakel UI, FreeType/FTGL glyph metrics and game scheduling remain in place. `uplink/src/uplink.cpp` is unchanged. Original draw sites submit through `lib/gucci/uplink_draw.h`; its desktop aliases retain the native OpenGL calls.

## Inventory and chosen baseline

The compiled game and texture-font subset require:

| Original operation | Browser implementation |
| --- | --- |
| Quads and triangles | CPU quad triangulation, interleaved VBO, `glDrawArrays(GL_TRIANGLES)` |
| Lines, independent line loops and strips | Supported WebGL line modes; flush loops/strips independently to avoid connecting distinct primitives |
| Sparse colour changes, including Memory Banks | Every vertex carries normalized RGBA8, preserving the previous browser colour quantization |
| Texture UVs; REPLACE and MODULATE | One fragment shader with explicit solid/image/font mode; one texture unit |
| Model/projection stacks, ortho, translate and scale | CPU matrix transforms into four-component clip coordinates before batching |
| Blend enable and separate RGB/alpha factors | Explicit tracked state, applied with supported GLES calls |
| Scissor rectangles; depth/cull enable; line width | Explicit state, flushed before changing draw-affecting values |
| UI state save/restore | Focused renderer state snapshots; no GL attribute-stack binding |
| Image blits | Bottom-up RGBA texture quads; REPLACE preserves untinted image colour; nearest sampling; original CPU scale/flip/alpha updates |
| Fonts | Original FTGL RGBA atlases, nearest sampling, original glyph advances and flipped text transform |
| Presentation | Flush before SDL swap, clear, finish and texture mutation/deletion |

WebGL 1 is sufficient: no instancing, MRT, integer textures, VAOs, 32-bit indices or other WebGL 2 features are needed. This keeps the existing SDL context baseline and avoids introducing a WebGL 2-only requirement. All attribute pointers refer to a bound GPU buffer. The renderer does not enable FULL_ES2/FULL_ES3 or client-array emulation. See [Emscripten's supported modes](https://emscripten.org/docs/porting/multimedia_and_graphics/OpenGL-support.html) and the [WebGL 1 specification](https://registry.khronos.org/webgl/specs/latest/1.0/).

The submission API intentionally retains primitive builders, current colour and matrix/state scopes to preserve the original game's ordering. It is not a general OpenGL emulator: there is one authored shader program, no fixed-function shader generator, and no browser binding to glBegin/glEnd, matrix stacks or glPushAttrib. Adjacent compatible triangles/lines share a batch; transforms and colours can change within it because they are baked into vertices. State changes and independent strips/loops flush without reordering. Batches are bounded.

The existing browser's solid rendering of stippled lines is retained. Native initialization's unused lighting/fog/alpha-test/texture-1D switches have no renderer implementation. No new dashed-line fidelity is claimed; line widths retain the device's WebGL support limits.

## Texture and context lifecycle

Logical texture handles are stable across context loss. Only live textures retain tightly packed CPU backing plus their sampler parameters; deletion releases that backing. FTGL subimage updates also update the retained atlas. Temporary Image textures still upload/delete for each draw, preserving mutability without introducing a cache invalidation scheme.

On context loss, incomplete draw batches are discarded and Emscripten handle-table entries are released. On restoration, live font/map/UI textures, samplers, blend/scissor/cull/depth/line/background state are recreated; the shader and VBO are rebuilt lazily. The game and save state are retained, rather than reloading the page. This costs CPU backing memory for live textures and copies during uploads. Game scheduling continues during the temporary rendering interruption.

## Verification and reproduction

`npm run build` produces the normal game and harness. `npm test` includes binary validation and `test-renderer-link.cjs`: both bundles must contain direct WebGL draw bindings and the authored shaders, and must omit GLImmediate, legacy glBegin/glMatrixMode bindings and the immediate-mode warning. Link scripts and Image tests must omit LEGACY_GL_EMULATION. Old `gl-compat.cpp`, `gl-immediate.js` and the obsolete shim test have been removed. Native-only historical GL code and documentation are not evidence of a browser dependency.

`npm run test:browser-renderer-probe` compiles the actual renderer into a small pixel-asserting WebGL test. It checks sparse gradients, triangulation, triangles, matrices, clipping/attribute restoration, separate line primitives, image REPLACE/alpha blending, texture-limit queries and two actual WEBGL_lose_context restorations. CI runs this alongside the existing browser checks.

`npm run test:browser-renderer` builds a QA-only game variant and exercises registration, gateway selection, desktop, map, Memory Banks, File Copier, mission details, all three tutorial screens, context recovery, original saves/password reload and advancing music. The extra `renderer-game-qa.cpp` pins the original map label positions for a deterministic visual fixture. It is not linked in production and changes no authentication or gameplay. Rebuild with `npm run build` afterwards before packaging.

For comparison, build latest-main `dbb5cd0` in a detached worktree using the same SDK, then run `bash port/tests/build-game-renderer-qa.sh /path/to/baseline-worktree`. Copy its game.js/game.wasm/game.data into qa/baseline, then run `QA_RENDERER_PHASE=baseline node port/tests/browser-renderer.cjs`, followed by the candidate test. The same viewport, device scale, synthetic agent, actions, fixed clock origin and map fixture are used. Timing samples run sequentially, without another browser workload. GPU draw/upload counters and MainLoop.runIter callback durations include the original glFinish synchronization; they are not a hardware GPU benchmark.

See [WEBGL_RENDERER_RESULTS.md](WEBGL_RENDERER_RESULTS.md) for measured sizes/timings, committed comparisons and coverage limits.
