# Browser-port isolated checks

From the `uplink-web` directory:

```sh
python3 port/tests/test-mainloop.py
node port/tests/test-persistence.js
python3 port/tests/test-options-save.py
node port/tests/test-audio.js
node port/tests/test-browser-smoke.cjs
```

Requires Python 3, a C++11 compiler (`g++` by default, or set `CXX`), and Node.js. The scripts work from any current directory. An optional first argument selects a different original source directory for test-mainloop.py or persistence.js file for test-persistence.js.

The main-loop test extracts the current Callback/timer/main-loop implementation from gucci_sdl.cpp and compiles it twice against SDL and Emscripten scheduler doubles. Temporary source and binaries are automatically removed. Checks include callback ordering, special keys, damage flags, exact/due timer behavior, quit short-circuiting, native termination, browser registration, and pre/post-frame cancellation. It does not compile the entire graphics backend or test actual browser input/GL.

The persistence test evaluates the actual pre-JS file in a Node VM. IDBFS completion is manually controlled, avoiding timing races. It verifies that startup blocks on restore; existing preRun survives; save paths are created; early saves wait; writes never overlap; pending counts track queued/in-flight work; promises wait for storage completion; a queued write succeeds after a preceding failure; and restore, mount, or folder-creation failures block startup and prevent writes.

Neither suite proves real browser IndexedDB reload persistence, rendering, audio, or gameplay. Those require the final browser build.

## Additional runtime-risk regression checks

- `test-options-save.py`: compiles the actual Options::Save body in native and browser modes against test doubles, checking that browser flushing happens after file close and encryption, and never after a failed open.
- `test-audio.js`: extracts the actual four EM_JS music functions, testing autoplay rejection/gesture retry, SDL context resume, volume limits, media errors, release on replacement/stop, and stale promise/event isolation with audio doubles. No real decoder or audible output is exercised.
- `test-browser-smoke.cjs`: tests the diagnostic runner's launch/page/close failure cleanup and malformed/traversal request rejection using doubles. It does not create sockets or launch Chromium.
- Main-loop checks also cover a ten-minute tick gap: overdue one-shot timers fire once, with original callback order, without being replayed on the next frame. This does not establish real hidden-tab timing or game-world progression.

The browser smoke runner closes the private server even when Chromium launch fails, rejects uncaught page errors, and exits nonzero on failure. A zero exit only means the limited diagnostic capture completed; no login, gameplay, audio, or storage assertions are implied.

## New runtime regressions

`test-vanbakel-draw.py` compiles the actual task-label renderer and checks GL begin/end around its four vertices, followed by text. `test-options-apply.py` compiles the actual Apply callback and checks browser serialization after applying an option while retaining native behavior. Both run in `npm test`.

`npm run test:browser-harness` runs Playwright against the separately labelled harness, asserting exact real C++ mouse/keyboard state, actual IndexedDB reload, WAV/OGG playback state, media replacement and resize/high-DPI input. It fails on page errors, failed assets and GL enum/operation errors. Its second-tab probe reports the actual visibility state and does not claim long hidden-tab coverage. It does not test original gameplay. See `port/CLOUD_RUNTIME_RESULTS.md` for the manual original game results.

`test-firsttime-save.py` checks browser onboarding serializes its completion flag through the original writer while native behavior stays unchanged. Both run in `npm test`.

`npm run test:browser-storage` injects an actual IndexedDB write abort, recovers and reloads, then blocks restoration and proves existing files survive. `npm run test:browser-lifecycle` obtains real hidden visibility, verifies ten seconds of suspended animation frames, resumes, and checks five seconds of lifecycle freezing against the original game main-loop counter. These short tests do not prove quota exhaustion or multi-minute campaign behavior.

Browser storage and lifecycle tests use Playwright’s installed browser when `CHROMIUM_PATH` is unset. The lifecycle test selects the `chromium` channel (full Chromium in new headless mode), because headless shell does not reproduce actual tab visibility. Install with `npx playwright install chromium`; custom installations may use Playwright’s standard `PLAYWRIGHT_BROWSERS_PATH`.

After staging with `python3 port/prepare-pages.py`, `npm run test:pages` checks the original game at a Pages-style subpath. It verifies that the bottom debug/save panel is absent, five repeated right-clicks translate into SDL right-button press/release pairs, canvas context menus are canceled, and context menus outside the canvas remain enabled. It also registers a profile, checks gesture audio, retires through the native game and waits for automatic persistence, then reloads and logs back into the saved profile. Screenshots and structured results are written under `qa/pages/`.

`npm run test:browser-display` exercises the actual game at DPR 1 and 2, four viewport sizes (1366×900, 1920×1080, 800×700, 390×844), all four display resolutions, three scaling modes, saved settings and fullscreen entry/exit. It observes pointer coordinates in events actually dequeued for the C++ SDL consumer, verifies WebGL backing dimensions and aspect ratio, and captures onboarding text with nearest sampling and the previous linear sampler. Evidence goes to `qa/display/`. These checks do not establish readability after unavoidable downscaling, browser coverage beyond Chromium, or comparative Windows font fidelity.

## Shader/buffer renderer

See [renderer design, regression checks and comparison instructions](../renderer-notes.md). The pixel/context probe and original-game screen/save/audio test run in CI. Their QA bundles and evidence stay under ignored `qa/`; production output is not overwritten.

## Logical UI/font size

`npm run test:browser-ui-scale` builds the isolated renderer QA bundle, then
checks the original game at 125/150/200% UI size, four backing resolutions and
integer/fractional DPR. It exercises actual pointer/keyboard events through
registration, gateway, desktop, map and Memory Banks, browser scrolling, two
context restores and saved UI-size restart. Read-only QA helpers report logical
screen/text metrics and existing button bounds. They are absent from production.
Evidence goes to ignored `qa/ui-scale/`. The font density, inverse glyph size,
logical metrics and native behavior checks run in `npm test`; fractional clip
pixels run in the renderer probe. See [implementation/provenance and limits](../display-notes.md#logical-ui-size).
