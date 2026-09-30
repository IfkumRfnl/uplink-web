# Cloud runtime results — 2026-09-30

Real browser evidence exists. This remains an experimental private port, not a finished game or a full gameplay/fidelity pass.

Checkout: `a815ec753eadbbbe295c6636912cb1f4c70cafb7`, 6,125 tracked files, clean before work. No AGENTS.md or applicable local agent skills were present. Official Emscripten 6.0.10 and Playwright 1.62.1/Chromium 151.0.7922.34 installed successfully. Localhost sockets, HTTP, WebGL 1 and dependency downloads work in this updated cloud environment. Software WebGL used `--enable-unsafe-swiftshader`; no public deployment or remote Git write occurred.

## Observed checks

| Check | Result and boundary |
| --- | --- |
| Complete original game build | PASS: 236/236 translation units, zero failures; full game and separate harness link |
| Isolated suites | PASS: main loop, persistence queue, Options::Save, browser Options Apply, VanBakel draw contract, music bridge, smoke-runner cleanup, Image/Redshirt; both generated JS syntax and Wasm validation pass |
| Original startup | PASS after fixes: original integrity check, all nine data archives, fonts, SDL audio and main menu complete |
| Original registration | PASS: mouse/keyboard name and password entry, London gateway selection, original startup sequence and desktop |
| Original tutorial | PASS for entry and first Next interactions; Tutorial Daemon and highlighted HUD control render. Full tutorial/mission completion untested |
| Save/reload/login | PASS: original C++ agent creation/save, completed IDBFS flush, same-origin reload, agent listed, password login, original `Loading profile ... success` and “Welcome back to your Gateway” |
| Options-only change | PASS: disable music, Apply Changes, completed flush, reload, original options load success, checkbox remains off and music stays stopped |
| Original audio | PASS for browser decode/playback state: OGG music advances beyond 60 seconds after a click; original WAV effects contain nonzero decoded PCM, WebAudio state resumes from suspended to running. Human listening/mix quality not assessed |
| Game resize/input | PASS observed 1200→700→1200 viewport and repeated tutorial clicks; retained 1024×768 internal game resolution. Full graphics-mode changes untested |
| Separate harness | PASS: eight browser check groups, exact C++ keyboard/click state, IndexedDB reload, WAV completion, OGG playhead, replacement, resize at device scale 2, no uncaught/failed-asset/GL enum-operation errors |
| Background timing | INCONCLUSIVE: headless second-tab check stayed `visible`; input recovered but this does not prove actual hidden-tab suspension or multi-minute world/timer behavior |
| Storage interruption/quota failure | UNTESTED in actual browser; isolated restore/write failure tests pass |
| Steam/native save compatibility | UNTESTED; disposable browser-created agents only |
| Real TCP/IRC | UNSUPPORTED: native direct TCP is unavailable in ordinary browsers; simulated in-game server connections are distinct and do run |

## Repairs proven by runtime failures

1. Link script omitted `world.dat`. It now preloads the original standard `Installer/data/world.dat` (SHA-256 `0666e5dafd6fdcf9cb37b40c6f0a91a188a8c029420e40d3d963752bf997b257`). The standard code-card requirement is retained; the alternative download installer file was not selected.
2. FTGL ALPHA atlases sampled black RGB under legacy WebGL modulation. Browser copies use white RGBA glyph texels with original coverage, restoring the intended text colour.
3. Legacy blend-source/destination queries are invalid in WebGL. Separate RGB/alpha factors now round-trip; current colour is read from the pinned emulation state rather than unsupported `GL_CURRENT_COLOR` querying.
4. Emscripten's `Mix_Linked_Version` and `Mix_VolumeChunk` abort. Browser logging now accurately identifies the compatibility backend, and all original quarter-volume effects use supported channel gain. Native audio branches remain unchanged.
5. Original hardcoded GL texture name 1 may already have been deleted; native GL implicitly creates it on bind but WebGL does not. Browser textured UI allocates its own texture, uses valid matching formats and NPOT-compatible clamp/filter settings. The gateway world map now renders.
6. Original `Svb_textbutton_draw` lacked `glBegin` before four vertices and `glEnd`, crashing the desktop in Emscripten. The missing quad begin is restored, with an actual-function regression test.
7. Generic Apply Changes updated memory without invoking Options::Save. Browser Apply now serializes through the original writer and existing IDBFS hook; its actual callback is tested in native/browser modes.
8. Harness music referenced an excluded WAV derivative. It now uses the committed original-music OGG. Page save status now shows restore, pending, success and failures; bundle loading no longer claims that game startup succeeded.

`uplink/src/uplink.cpp` stays byte-for-byte unchanged: SHA-256 `edffd042eb4a8251d5011767c5e91ea2e25b3a5d7bc220edd70f0a11cbb245d2`. No authentication, code-card or integrity bypass was introduced. Licences and original data files were not modified.

## Evidence and reproduction

Local screenshots/logs/actions are in ignored `qa/`: `game-map-repaired.png`, `game-tutorial.png`, `game-final-loaded-agent.png`, `game-options-restored-off.png`, `harness-restored-hidpi.png`, `harness-resized.png`, `harness-results.json`, `session-actions.jsonl`, `session-logs.json`. Session logs intentionally include the earlier reproduced failures; they must not be presented as a failure-free final run. Later successful screenshots and original debug-log entries identify repaired behavior.

Run `npm run build`, `npm test`, and `CHROMIUM_PATH=/path/to/chromium npm run test:browser-harness`. The interactive game path remains `prototype/game.html`; the harness is `prototype/index.html`. Browser harness results are independent of gameplay. Original dashed lines still degrade to solid. Comprehensive original Windows visual comparison, performance profiling, audible mix assessment, tutorial completion, long hidden-tab timing, retirement and interrupted-storage recovery remain open.

The newly supplied `Uplink(1).zip` Library item was resolved, but its authorized materialization helper returned `download failed`, both in the normal sandbox and an approved escalation. No bundled binary was run. Its contents/hashes were therefore not compared; the included source/assets proved sufficient for the repairs above.

Changes are retained locally as a patch/worktree. No identity was selected for a remote write, no remote write was attempted, and Git author metadata was not used as identity evidence.

Library evidence upload was also attempted with the current batch helper; it failed before file creation with HTTP 401. Native Library screenshot IDs are therefore unavailable. The local evidence ZIP and individual screenshots remain intact.
