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
