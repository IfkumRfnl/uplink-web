# Cloud runtime results — 2026-09-30

Real browser evidence exists. This remains an experimental private port, not a finished game or a full gameplay/fidelity pass.

Checkout: `a815ec753eadbbbe295c6636912cb1f4c70cafb7`, 6,125 tracked files, clean before work. No AGENTS.md or applicable local agent skills were present. Official Emscripten 6.0.10 and Playwright 1.62.1/Chromium 151.0.7922.34 installed successfully. Localhost sockets, HTTP, WebGL 1 and dependency downloads work in this updated cloud environment. Software WebGL used `--enable-unsafe-swiftshader`; no public deployment or remote Git write occurred.

## Observed checks

| Check | Result and boundary |
| --- | --- |
| Complete original game build | PASS: 236/236 translation units, zero failures; full game and separate harness link |
| Isolated suites | PASS: ten suites covering main loop, persistence queue, Options::Save, browser Options Apply, VanBakel draw contract, music bridge, smoke-runner cleanup, Image/Redshirt, sparse immediate colours and onboarding persistence; both generated JS syntax and Wasm validation pass |
| Original startup | PASS after fixes: original integrity check, all nine data archives, fonts, SDL audio and main menu complete |
| Original registration | PASS: mouse/keyboard name and password entry, London gateway selection, original startup sequence and desktop |
| Original tutorial | PASS: all three original tutorial sections; buy and run Password Breaker/Trace Tracker, bounce simulated connections, copy and submit the original test-mission file, receive original completion and rating messages |
| Normal mission | PASS: accepted Gamma Inc. contract, broke the simulated e-trade server password, deleted `e-t-data-58567`, sent the original completion reply; original employer message confirms completion and 1,800 credits |
| Save/reload/login | PASS: original C++ agent creation/save, completed IDBFS flush, same-origin reload, agent listed, password login, original `Loading profile ... success` and “Welcome back to your Gateway”; repeat after all tutorial sections and the normal mission retains completion email, 2,700-credit balance and the recovered storage marker |
| Agent retirement | PASS: original confirmation retires the disposable progress agent, removes its active `.usr`, copies `.usr`/`.tmp` into `usersold`, completes the flush; same-origin reload keeps it absent from the roster and retains the 1,303,700-byte retired save |
| Options-only change | PASS: disable music, Apply Changes, completed flush, reload, original options load success, checkbox remains off and music stays stopped |
| Original audio | PASS for browser decode/playback state: OGG music advances beyond 60 seconds after a click; original WAV effects contain nonzero decoded PCM, WebAudio state resumes from suspended to running. Human listening/mix quality not assessed |
| Game resize/input | PASS observed 1200→700→1200 viewport and repeated tutorial clicks; retained 1024×768 internal game resolution. Full graphics-mode changes untested |
| Separate harness | PASS: eight browser check groups, exact C++ keyboard/click state, IndexedDB reload, WAV completion, OGG playhead, replacement, resize at device scale 2, no uncaught/failed-asset/GL enum-operation errors |
| Background timing | PASS for short suspension: genuinely `hidden` for ten seconds with no additional animation frames, visible resume; five-second lifecycle freeze pauses the original main-loop frame counter and resumes without GL/page errors. Multi-minute game-world behavior remains untested |
| Storage interruption/quota failure | PASS for actual IndexedDB transaction abort, error reporting, recovered flush and reload; blocked restore stops original startup and retains existing saved data after recovery. Quota exhaustion remains untested |
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

9. Sparse original immediate-mode colours could produce a fractional vertex count in Emscripten 6.0.10 and abort Memory Banks. The browser shim emits current RGBA for every immediate vertex; actual Memory Banks and all tutorial file operations now run. A regression exercises the original colour sequence.
10. Original onboarding sets `game_firsttime=0` without saving options until native exit. Browser completion now invokes the original options writer, preventing onboarding from recurring after a browser reload. Actual onboarding/logoff/reload and native/browser regression checks pass.

`uplink/src/uplink.cpp` stays byte-for-byte unchanged: SHA-256 `edffd042eb4a8251d5011767c5e91ea2e25b3a5d7bc220edd70f0a11cbb245d2`. No authentication, code-card or integrity bypass was introduced. Licences and original data files were not modified.

## Evidence and reproduction

Local screenshots/logs/actions are in ignored `qa/`: `game-map-repaired.png`, `game-tutorial.png`, `game-final-loaded-agent.png`, `game-options-restored-off.png`, `harness-restored-hidpi.png`, `harness-resized.png`, `harness-results.json`, `session-actions.jsonl`, `session-logs.json`. Session logs intentionally include the earlier reproduced failures; they must not be presented as a failure-free final run. Later successful screenshots and original debug-log entries identify repaired behavior.

Run `npm run build`, `npm test`, and `CHROMIUM_PATH=/path/to/chromium npm run test:browser-harness`. The interactive game path remains `prototype/game.html`; the harness is `prototype/index.html`. Browser harness results are independent of gameplay. Original dashed lines still degrade to solid. Comprehensive original Windows visual comparison, performance profiling, audible mix assessment, long hidden-tab timing remain open.

The newly supplied `Uplink(1).zip` Library item was resolved, but its authorized materialization helper returned `download failed`, both in the normal sandbox and an approved escalation. No bundled binary was run. Its contents/hashes were therefore not compared; the included source/assets proved sufficient for the repairs above.

Repairs are checkpointed in local commits `7792a61` and `d28eff3`; additional browser integration tests and evidence are retained locally. No identity was selected for a remote write, no remote write was attempted, and Git author metadata was not used as identity evidence.

Library evidence upload was also attempted with the current batch helper; it failed before file creation with HTTP 401. Native Library screenshot IDs are therefore unavailable. The local evidence ZIP and individual screenshots remain intact.

## Follow-up evidence

`qa/followup/` contains tutorial-one-complete, test-mission-complete, tutorial-three-complete, memory-fixed, normal-mission-details, normal-completion-message, progress-reloaded-finances, progress-reloaded-memory-mission, write-aborted, storage-recovered, restore-blocked, onboarding-reload and background-resumed screenshots, plus storage, onboarding and lifecycle JSON results. The original game session actions record actual gameplay independently of the harness. Historical session errors include the reproduced pre-fix immediate-colour abort.

Run `npm run test:browser-storage` and `npm run test:browser-lifecycle` against the built original game. Lifecycle testing disables Playwright’s focus-emulation override on its own CDP session to obtain a genuine hidden state; production browser code is unchanged. The current Library read API succeeds, but the upload helper’s prior HTTP 401 remains a delivery limitation; it was not repeatedly retried.

The gameplay action log contains ordinary trace warnings, a rejected premature mission notice, and missed test clicks. Final original employer confirmation and the reloaded 2,700-credit balance prove the normal mission result. Synthetic right-button events were used to cancel active tool targeting; trusted right-button input itself was not separately verified. A disposable browser-generated progress save is retained in `qa/followup/cloud-qa-progress.usr`; Steam/native compatibility is untested.

Retirement was tested through the original confirmation UI after its name animation completed. Screenshots and action results show the active roster and retired files before/after reload. A nonfatal original debug diagnostic (`HUDInterface::HighlightToolbarButton, invalid button : hud_message 5`) appeared during progressed-agent loading; the desktop, mission email and balance restored successfully. Broader tutorial-highlight cleanup is not established by these checks.
