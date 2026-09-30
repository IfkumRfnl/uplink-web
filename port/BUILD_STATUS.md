# Uplink private browser build status

Verified 2026-09-30T08:23:01.498889+00:00

## Build results

- Official Emscripten SDK 6.0.10 installed locally under `toolchain/emsdk-main`; standalone C++ Wasm smoke test executed successfully with Node.
- Forced recompilation with `UPLINK_REBUILD=1 port/link-game.sh`: **236/236 translation units compiled; 0 failed**.
- Final complete gameplay link succeeded, including original gameplay, TCP4u, IRC, SHA1, GUCCI/Eclipse, SDL_mixer adapter, FTGL texture renderer and official FreeType port.
- JavaScript syntax checks passed for final `prototype/game.js` and `port/persistence.js`.
- Node `WebAssembly.validate` returned true for final `prototype/game.wasm`.
- `prototype/game.js`: 595,745 bytes
- `prototype/game.wasm`: 2,398,323 bytes
- `prototype/game.data`: 26,855,599 bytes

## Commands

From `uplink-web`, run `port/build-ftgl.sh` to rebuild the copied FTGL texture library, then `UPLINK_REBUILD=1 port/link-game.sh` for a fresh game build. Without `UPLINK_REBUILD=1`, game objects are reused when source timestamps are unchanged. Use forced rebuild after header or build-flag changes.

`port/build-game.sh` compiles only. `port/link-game.sh` compiles and links to `prototype/game.js`. The browser entry page is `prototype/game.html`.

## Packaged assets

The link script preloads the nine staged original Steam data archives from `uplink-web/game-data/*.dat` at virtual filesystem root: data.dat, fonts.dat, graphics.dat, loading.dat, music.dat, patch.dat, patch2.dat, patch3.dat, sounds.dat. It also preloads `prototype/assets/rgba` as `/assets/rgba`.

Six full original music conversions are served separately over HTTP from `prototype/assets/music/*.ogg`; they are not embedded in game.data. Original .uni modules are preserved. See audio-notes.md for verified full-track conversion details and custom-module limits.

## Compatibility and integrity

- Browser executable path supplied as `/uplink`; native x86 stack walking skipped only for WebAssembly.
- Original main/startup/authentication file `uplink/src/uplink.cpp` is byte-for-byte identical to source.zip. SHA256: `edffd042eb4a8251d5011767c5e91ea2e25b3a5d7bc220edd70f0a11cbb245d2`.
- No login or gameplay substitution and no fake networking success.
- SaveGame and RetireGame success paths call the persistence adapter after local save/copy completion. Options::Save also flushes after file close/encryption, fixing loss of options-only changes on reload.
- Legacy GL compatibility preserves the renderer-used blend, texture enable/binding/environment, active texture unit, scissor, color, line width, matrix mode, depth and cull state. Texture enable is obtained from Emscripten's legacy emulation state rather than unsupported WebGL capability queries.
- Original solid/dashed line code links, but dashed line stippling currently degrades to solid rendering and emits an explicit warning.

## Runtime verification remains blocked

**No browser gameplay pass is claimed.** The browser rejected the confirmed local HTTP server with `ERR_BLOCKED_BY_CLIENT`, so original login/tutorial progression, game rendering, input, audible music/effects and real IndexedDB reload persistence remain unverified.

TCP4u and IRC code compile, but ordinary browser environments do not provide native direct TCP connectivity. No proxy service or fake connectivity is installed. Music playback needs a permitted user gesture; unknown/custom modules fail explicitly. Saves are browser-origin-local and require successful asynchronous IDBFS completion; they are not cloud backups. Original startup redirects stdout/stderr to its debug.log, so runtime debugging may require reading that virtual file.

This is a private technical build. No public hosting or redistribution permission is implied.

## Focused runtime-risk review (2026-09-30)

- Fixed the missing options-save persistence hook; native save behavior remains unchanged. Actual function-body tests cover successful close/encryption/flush order and failed-open behavior.
- Incremental final rebuild/link passed with 236/236 translation units; regenerated JavaScript syntax and Wasm validation passed. Existing image, persistence, and main-loop suites passed; audio-bridge and smoke-runner regression suites also passed.
- Added long-gap timer tests and deterministic Audio/DOM tests, including gesture retry and stale play/error completion after track replacement or stop.
- Diagnostic browser script now always cleans up its server/browser, including launch failure, rejects malformed/traversal request paths, and fails on uncaught page errors. No blocked browser launch was retried.
- See runtime-review.md for the remaining evidence-bounded runtime risks. No browser pass is claimed.
