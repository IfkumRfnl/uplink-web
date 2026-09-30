# Private cloud environment setup

Select the private personal repository `IfkumRfnl/uplink-web` when creating the coding environment. Use the authorized personal GitHub account. Do not substitute a work account or make the repository public.

## Linux prerequisites

- Git, Bash, Python 3, GCC/G++, and Node.js 20 or newer
- Emscripten 6.0.10 (downloaded by the setup script)
- Several GB of free disk for SDK, caches and builds
- Network access during setup for the official Emscripten SDK and its ports
- Optional browser smoke test: npm registry access plus Playwright Chromium and its OS libraries
- Optional asset regeneration only: Python Pillow 12.3.0, GCC, ffmpeg with libvorbis

The checked-in source and game content are sufficient; another source checkout, Steam installation, or original ZIP is unnecessary for the normal build.

## Setup command

From the repository root:

```sh
bash port/bootstrap.sh
npm run build
npm test
```

`npm run build` and `npm test` do not require npm dependency installation. They use the repository's shell/Python scripts and Emscripten. The first build can download the SDL, SDL_mixer and FreeType ports. The SDK is always expected under `toolchain/emsdk-main`.

Known successful build environment: Linux x86-64, Python 3.12.14, Node.js 24.19.0, Emscripten 6.0.10. These are observations, not proof that other environments pass. No compiled game bundles or SDK caches are committed.

## Browser check

In an environment that supports launching Chromium:

```sh
npm install --ignore-scripts
npx playwright install chromium
npm run smoke:game
npm run smoke:harness
```

If required OS libraries are missing, install the official Playwright browser dependencies using the environment's approved setup mechanism. An already installed compatible Chromium can be selected with `CHROMIUM_PATH=/absolute/path/to/chromium`. Do not weaken host security or sandbox settings to force execution.

For interactive private QA, run `npm run serve` and open `http://127.0.0.1:8000/game.html` using a supported local preview. Do not publish this copyrighted content as a workaround for unavailable preview.

The updated cloud environment supports localhost and Playwright Chromium/WebGL. Original registration, all three tutorial sections and the test mission, save/load and options reload have runtime evidence; see `port/CLOUD_RUNTIME_RESULTS.md`. Run `npm run test:browser-harness` for the separate harness integration checks. Remaining full-game QA is listed in the report.

## Suggested first manual checks

1. Confirm startup finishes and the original main menu renders without errors
2. Create a disposable test agent and enter the original tutorial
3. Exercise keyboard, mouse, window resize and repeated buttons
4. Confirm original sound effects and music after an explicit user interaction
5. Save, wait for the persistence status to finish, reload the same origin and load the test agent
6. Test a save failure/interruption with disposable data and confirm it does not silently report success

Do not use valuable existing saves for the first compatibility test. Keep console logs/screenshots private. Retain the distinction between successful compilation and verified runtime behavior.
