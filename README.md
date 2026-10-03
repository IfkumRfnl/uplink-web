# Play Uplink in your browser

**[Play now →](https://ifkumrfnl.github.io/uplink-web/)**

An experimental browser port of the original C++ Uplink game, with WebGL graphics, mouse and keyboard input, original sound effects and music, and local saves.

## How to play

1. Open the link in a desktop browser with WebAssembly and WebGL support. Allow the game bundle to download and wait for the original menu to appear.
2. Create an agent through the original registration screens, or load an existing browser profile. Start with the in-game tutorial to learn the tools and missions.
3. Click the game to enable browser audio. Use the original mouse and keyboard controls; right-clicks on the game canvas go to the game.

The game autosaves periodically and saves when you log out through its menu. Saves and options stay in this browser on this site's origin; they do not sync across devices. Use one active game tab and export backups before clearing browser data or moving browsers.

## Display and save backups

Open **Display** in the top-right corner:

- **UI size** enlarges in-game text and controls: 100%, 125%, 150%, or 200%, subject to the selected resolution.
- **Sharp** keeps whole-pixel scaling; **Native** uses one device pixel per game pixel. Both allow scrolling when the game is larger than the window. **Fit window** shows the whole game and may reduce detail.
- **Game resolution** offers 800×600, 1024×768, 1280×960, and 1600×1200. Resolution or UI-size changes restart the game: save your progress first. Scaling changes apply immediately. Fullscreen is available here too.
- Under **Save backups**, select a profile and choose **Export backup** to download its last saved state. Unsaved progress is not included.

To restore or move a backup, reach the original login screen, open **Display → Save backups**, and choose **Import backup**. Keep the `.uplink-save` filename unchanged. Replacing a matching profile requires confirmation naming that profile; its password stays the same. On a new browser, complete the original first-time registration and log out once before importing. Use backups from your own known-good profiles. See [backup format and safeguards](port/profile-backups-notes.md).

## Known limitations

- This is an experimental port. Chromium has runtime coverage; broad gameplay, cross-browser and hardware-GPU fidelity checks remain incomplete.
- Browser storage can be unavailable or cleared. Saves are local, so keep downloaded backups and allow saves/imports to finish before closing the tab.
- Steam/native save compatibility has not been verified. Browser backups use this port's supported format.
- Real TCP/IRC connections are unsupported in ordinary browsers; the game's simulated server connections work.
- Stippled lines currently render as solid lines. Detailed rendering and test boundaries are in [renderer notes](port/renderer-notes.md) and [runtime results](port/CLOUD_RUNTIME_RESULTS.md).

## Build locally

On Linux, install Git, Bash, Python 3, GCC/G++, and Node.js 20 or newer. Setup downloads official Emscripten **6.0.10**; the first build may also download its SDL, SDL_mixer and FreeType ports. Network access and several GB of free disk space are needed. Source and prepared game assets are included; generated game bundles are not committed.

```sh
git clone https://github.com/IfkumRfnl/uplink-web.git
cd uplink-web
bash port/bootstrap.sh
npm run build
npm run serve
```

Open **http://127.0.0.1:8000/game.html**. Serve over HTTP rather than opening `file://`. `/index.html` is a separate technical harness, not the game landing page.

For checks after building:

```sh
npm test
python3 port/verify-inventory.py
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser-profiles
npm run test:browser-ui-scale
npm run prepare:pages
npm run test:pages
```

The browser checks require an environment that can launch Chromium and its OS dependencies. `npm run build` and `npm test` do not require npm dependency installation. See [test coverage](port/tests/README.md), [display behavior](port/display-notes.md), and [Pages packaging](port/PAGES.md). Main deploys to GitHub Pages only after CI passes.

## Rights and provenance

Uplink is an Introversion Software game. The source basis is `vb6mmorpg/uplink-source-code` at commit `013337cefbe4b69c1f75bf4289608875ee2ed404`; game content comes from the owner's Steam installation. Prepared asset provenance is recorded in [the asset manifest](prototype/assets/manifest.json) and [preparation notes](prototype/ASSET_PREPARATION.md).

Public repository visibility and a playable browser build do not grant an open-source license or redistribution rights. No blanket MIT or other license is applied. Original copyrights, [developer-license terms](uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404/docs/license.html), [EULA](uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404/tools/IntroversionEULA.txt), and third-party notices remain in force. See [rights and provenance](RIGHTS.md).
