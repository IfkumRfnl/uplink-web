# Uplink private browser port workbench

Status: original C++ gameplay compiles and links to WebAssembly. Actual browser execution, login/tutorial, audio output and reload persistence have **not yet been verified**. This is a private feasibility build, not a finished port.

## Inputs and identity

- Original source: vb6mmorpg/uplink-source-code, commit 013337cefbe4b69c1f75bf4289608875ee2ed404
- Game assets: user's Steam Uplink.zip, nine original .dat archives
- Emscripten 6.0.10; no Rust/Zig gameplay rewrite
- Original uplink/src/uplink.cpp remains byte-for-byte unchanged, including its existing authentication/integrity paths
- Windows Steam authentication DLL is not runnable in a browser. This build uses the original non-Windows C++ platform path; it does not emulate a successful Steam authentication result

## Local entry points

- prototype/game.html: compiled original game, experimental
- prototype/index.html: separate, explicitly labeled technical harness for original C++ graphics/input, WAV/music, and IndexedDB probe
- port/BUILD_STATUS.md: precise successful checks and remaining gaps

Serve the `prototype` directory with a private local HTTP server. Open game.html for the original game or index.html for the isolated platform probe. Do not open through file://; Wasm asset fetching and IndexedDB require a normal origin. Do not publicly host these copyrighted assets/source.

## Reproduce from a fresh clone

This repository includes the original source tree, all nine Steam `.dat` archives, prepared graphics/fonts/audio, authored port support, and tests. No separate Steam ZIP or source checkout is needed to build. Generated game bundles, SDK binaries, caches and native binary artifacts are excluded. Keep the pinned source directory name unchanged.

On Linux, install Git, Python 3, GCC/G++, Node.js, and Emscripten **6.0.10** from the official emsdk repository:

    mkdir -p toolchain
    git clone https://github.com/emscripten-core/emsdk.git toolchain/emsdk-main
    toolchain/emsdk-main/emsdk install 6.0.10
    toolchain/emsdk-main/emsdk activate 6.0.10
    source toolchain/emsdk-main/emsdk_env.sh
    bash port/build-ftgl.sh
    bash port/build-prototype.sh
    bash port/link-game.sh

The build may download Emscripten's SDL, SDL_mixer and FreeType ports on first use. Project source and content are included; external compiler/toolchain installation still requires network access.

Then serve privately on your own machine:

    python3 -m http.server 8000 --bind 127.0.0.1 --directory prototype

Open `http://127.0.0.1:8000/game.html` for the game or `/index.html` for the platform probe. Neither has completed browser QA yet. Do not expose this server publicly.

See `CLOUD_SETUP.md` for a compact cloud setup command and a browser QA checklist. `npm run bootstrap`, `npm run build`, and `npm test` are convenience entrypoints.

### Checks

    npm test

The aggregate command runs main-loop, persistence-queue, options-save, audio-bridge, smoke-runner cleanup, and Image/Redshirt checks, then validates generated JavaScript and Wasm.

Optional browser diagnostic requires Playwright 1.62.1 (`npm install --ignore-scripts`) and an environment that permits launching Chromium (`npx playwright install chromium`); run `npm run smoke:game`. This script captures logs/screenshots, not comprehensive gameplay assertions. Read `port/tests/README.md` and `README-image.md` for coverage boundaries. Current environment blocked Chromium startup with an OS socket permission error; actual gameplay, rendering, sound and persistence remain unverified.

### Asset preparation and provenance

Prepared assets are committed so no conversion is needed for normal builds. To recreate extraction from the included archives, run:

    python3 -m pip install -r requirements-assets.txt
    python3 prototype/prepare_from_archives.py

Full music conversion additionally requires GCC and ffmpeg; see `prototype/ASSET_PREPARATION.md`. Existing complete OGG derivatives are included. Original UN05 tracker files remain included and unmodified.

## Browser adaptations

- Original GUCCI event iteration scheduled with Emscripten's browser main loop
- TIFF originals converted to bottom-up RGBA at preparation time; original Image API preserves pixel/alpha/scaling logic and draws texture quads
- FTGL texture-font glyph atlases replace unsupported bitmap glyph drawing
- Original Eclipse buttons and gameplay remain C++
- Save directories retain original layout under /persistent/.uplink; IDBFS restores before startup, flushes serialized writes after game save/retire and successful options writes
- Original WAV effects use SDL_mixer; six original UN05 tracker modules rendered by bundled MikMod to complete OGG files for browser music. This is original music rendered offline, not browser-native UN05 decoding
- Existing native TCP/IRC sources compile, but real external networking has not been demonstrated and is not a supported promise of this prototype

## Remaining limits

- Browser runtime QA pending because built-in browser currently rejects private localhost preview; diagnostic work continues
- Original login, tutorial and gameplay have not been entered
- Existing Steam save compatibility is not runtime tested
- Dashed lines currently render solid and emit a diagnostic
- Full visual fidelity/performance, resize/high-DPI behavior, audio mixing, repeated input, interrupted save recovery and browser persistence require runtime checks
- No public hosting; this workbench is intended only for the private personal repository

## Repository inventory

`repository-manifest.json` records paths, byte lengths and SHA-256 values for the staged project files (excluding the manifest itself). Run `python3 port/verify-inventory.py` after restoring the backup or cloning to verify those inputs. Intentional source edits require an updated inventory.

## Review changes

With the optional original `source.zip` download restored, run `python port/create-change-bundle.py` to regenerate port/uplink-browser.patch and source-changes.json against the exact downloaded source archive. This records every modified original source file and hashes; it is separate from authored build/support files. Asset preparation provenance is in prototype/assets/manifest.json and prototype/ASSET_PREPARATION.md.
