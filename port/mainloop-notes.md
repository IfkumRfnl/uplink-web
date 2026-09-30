# Browser main-loop adaptation

Changed only `lib/gucci/gucci_sdl.cpp` in the original source tree.

- One `GciMainLoopIteration` contains the original frame body, preserving display → SDL events → due timers → idle callback order and the existing early-stop behavior.
- Native builds retain a blocking `while (!finished)` scheduler.
- Emscripten builds schedule the iteration using `emscripten_set_main_loop(..., 0, 1)`. The zero rate selects browser animation frames; the simulated infinite loop prevents the caller from immediately executing game cleanup.
- Browser frames cancel when `finished` becomes true, including when screen restoration happens between frames.
- SDL_GetError local pointers are now const-correct for current SDL headers.
- Removed only unused native frame-rate locals and their commented-out throttling code. The original loop did not enforce 35 fps.

## Checks completed

1. The full modified file compiles to a Wasm object with Emscripten 6.0.10:

   `em++ -c lib/gucci/gucci_sdl.cpp -o /tmp/uplink-gucci-sdl.o -DUSE_SDL -Ilib/tosser -Ilib/mmgr -Ilib/gucci -std=c++11 -sUSE_SDL=1`

2. A temporary C++ harness extracts the actual callback/timer/loop implementation, supplies SDL/scheduler test doubles, and compiles/runs both the native and `__EMSCRIPTEN__` browser branches. Both pass display/input/timer/idle order, timer removal, quit skipping timers and idle, native loop termination, browser registration, and cancellation before and after frames.

These are compilation and isolated behavior checks, not an end-to-end browser gameplay validation.

## Startup and lifecycle findings for the wider port

- `uplink/src/uplink.cpp:RunUplink` calls `br_find_exe(NULL)` on non-Windows. Linux executable discovery cannot be assumed in the browser virtual filesystem; use a browser-specific executable path without changing native behavior.
- `RunUplink` calls `Cleanup_Uplink` immediately after `Run_Game`. The browser scheduler must not return normally at registration. The browser quit path cancels scheduling; it does not resume the unwound native call stack or invoke that trailing cleanup. Any persistent-save flush or complete module teardown on browser quit needs an explicit separate lifecycle hook.
- `GciListScreenModes` assumes `SDL_ListModes` returns an array. SDL also permits NULL (no modes) and `(SDL_Rect **)-1` (any mode), both unsafe to index. This call occurs before graphics creation via `GciGetClosestScreenMode`; check the Emscripten SDL behavior at startup. Not changed in this main-loop patch.
- `App::Set` derives save folders from HOME. Configure a writable browser filesystem/HOME and persist it explicitly if durable saves are required; ordinary in-memory filesystem saves vanish on reload.
- `Init_App` under DEBUGLOG_ENABLED redirects stdout/stderr into the virtual filesystem, which can hide browser diagnostics. Choose debug settings deliberately.
- Desktop OpenGL fixed-function calls need Emscripten legacy GL emulation; SDL is version 1 here. Sound initialization and autoplay must be tested after a user gesture.
- Fullscreen requests at startup may be refused without a browser user gesture; prefer a windowed prototype setting.
- No Steam, licensing, code-card, or authentication logic was changed or bypassed. No source uploads, publication, remotes, or repository operations were performed.
