# Focused runtime-risk review

2026-09-30. Static review plus isolated tests, not a browser gameplay pass.

## Fixed and verified

Options::Save originally wrote and encrypted its file only in MEMFS. Unlike game-save/retirement paths, it never requested IDBFS persistence. Settings-only sessions could therefore lose changes on reload. A browser-only completion hook now flushes after encryption. Native behavior and failed-open behavior are unchanged. The actual function body passes tests in native/browser modes; the complete game recompiles and links.

The browser diagnostic runner previously left its server running if Chromium launch or page setup failed. It now releases resources in finally blocks and returns failure on uncaught page errors. Tests exercise failure paths with doubles; no blocked browser was retried.

## Reviewed without changing original game semantics

- IDBFS initial restore gates startup; mount/restore/folder failures block startup to prevent empty-state overwrite. Flushes serialize and expose completion/error promises. Existing deterministic tests cover early requests, write failure and retry. Real IndexedDB transactions/reload, quota exhaustion and origin changes remain browser tests.
- Music bridge uses browser HTML Audio for preconverted original tracks, so no live UN05 decoder is retained by the game. Tests exercise the actual EM_JS bridge: gesture retry, SDL resume request, volume clamp, replacement/stop resource release, stale promise/error isolation. Real codec support, gesture policies and audible WAV/music mixing remain browser tests.
- Main-loop tests cover delayed ticks and prove each overdue one-shot timer runs once in original ordering. Browser animation frames may be suspended in hidden tabs. Original Date::Update advances one discrete step per qualifying update rather than catching up the full elapsed wall time; background game progression must be observed before deciding whether to introduce a pause policy. No such gameplay change was made.
- Texture/image tests cover original sidecar pixels and scaling. The legacy GL shim and FTGL depend on Emscripten-specific fixed-function emulation. Actual atlas glyph rendering, nonzero texture-unit interactions, resize/high-DPI and visual state restoration remain unverified. Font rendering currently assumes the normal game renderer's texture-unit/matrix setup; the GL shim implements a subset, not every GL_ALL_ATTRIB_BITS state. No speculative rendering rewrite was made.

## Browser checks still needed

1. Original startup and legitimate login/tutorial; capture console and virtual debug.log.
2. Change only options, allow flush to complete, then reload same origin and verify restoration. Repeat game save and retirement; induce storage failure and ensure it is reported.
3. Switch tabs for several minutes during timers/gameplay, return, inspect timer order, clock progression and responsive input.
4. Compare original fonts/images/alpha blending, repeated rendering, resize and high-DPI.
5. Trigger music and effects with a user gesture; change tracks repeatedly and stop during loading; verify no stale playback and both outputs remain audible.

Do not depend on beforeunload to complete asynchronous writes. Concurrent tabs are not coordinated by this adapter and can overwrite the same origin's persistent state; use one active game tab until that behavior is addressed. The current page does not automatically surface every background flush state in its footer; inspect Module.uplinkPersistence or the explicit Flush saves result during QA. Browser saves are local storage, not cloud backup.
