# Browser save persistence integration

## Integrated browser support

Link the real game with `--pre-js port/persistence.js -lidbfs.js -sFORCE_FILESYSTEM=1`.
Do not also install the prototype's separate IDBFS preRun hook: mounting the same `/persistent` directory twice is invalid.

The script mounts IDBFS at `/persistent`, sets `ENV.HOME=/persistent`, restores IndexedDB into the virtual filesystem before allowing main(), and creates the game's nested save directories. Existing Linux path logic then resolves to:

- `App::userpath`: `/persistent/.uplink/`
- `App::usertmppath`: `/persistent/.uplink/userstmp/`
- `App::userretirepath`: `/persistent/.uplink/usersold/`

If another browser-specific App::Set patch overrides these values, it must keep all three paths beneath `/persistent`; the parent directory `.uplink` is created by this script. A failed initial restore intentionally keeps main blocked to avoid replacing existing data with empty state. Reload after resolving the browser storage issue.

## Exported JavaScript hooks

- `Module.uplinkPersistenceReady`: Promise that resolves after initial restore and folder setup
- `Module.uplinkSaveCompleted()`: request a persistent flush after a game save has completed its C++ writes, encryption, and copy operations; returns a Promise
- `Module.uplinkFlushSaves()`: same flush operation, suitable for options/retirement or an explicit “Finish saving” control
- `Module.uplinkPersistence`: status object with root, ready, pending, lastError, and lastSavedAt

Flush requests are serialized. Requests made before initialization wait for restore. Failed writes reject their Promise and record an error; subsequent requests can retry. The Promise resolves only when `FS.syncfs(false)` reports success. Do not show “saved to browser storage” merely when the synchronous game save returns.

A C++ callsite guarded by `#ifdef __EMSCRIPTEN__` can use `<emscripten/emscripten.h>` and:

```cpp
EM_ASM({
    Module['uplinkSaveCompleted']().catch(function (error) {
        console.error('Could not persist Uplink save:', error);
    });
});
```

This is a JavaScript API export, not an EXPORTED_FUNCTIONS C symbol. It does not initiate a gameplay save by itself: it persists files that C++ has already written. An embedding page should also surface `lastError` and `pending`, and await flush completion before intentional reload/navigation. The game callback must not pretend this asynchronous flush has synchronously finished.

## Exact source anchors (line numbers may move during parallel port edits)

- `uplink/src/app/app.cpp`, `App::Set` (~108–140): existing non-Windows HOME-derived path selection
- `App::SaveGame` (~353–404): after `CopyGame(username, filenamereal)` in the successful `CopyFilePlain` branch; not after `game->Save(file)` because encryption/copy is still pending
- `App::RetireGame` (~407–435): after both `RemoveFile(filenametmp)` and `RemoveFile(filenamereal)` in the successful retirement branch
- `App::Close` (~499–544): after `options->Save(NULL)` as a fallback for options persistence; explicit per-options-save hook is preferable
- `uplink/src/options/options.cpp`, `Options::Save` (~490–529): after `RsEncryptFile(filename)` in the successful open/write branch
- `uplink/src/app/opengl.cpp` idle/game handling (~498), `uplink/src/interface/localinterface/hud_interface.cpp` (~97), `uplink/src/game/game.cpp` (~461), `uplink/src/game/scriptlibrary.cpp` (~1472), and `App::Update` (~609) delegate gameplay saving to App::SaveGame, so central hooking covers them
- `uplink/src/mainmenu/login_interface.cpp` (~130) delegates retirement to App::RetireGame

Do not rely on beforeunload/pagehide to finish asynchronous IndexedDB writes. No automatic unload flush or periodic writes are installed. Browser storage is origin-scoped and can be removed by the browser/user or unavailable in restricted/private contexts; it is not a cloud backup. A downloaded save export would be a separate feature.

## Verification performed

- JavaScript syntax passes `node --check`
- Node VM test doubles validate initial restore gating, flush-before-ready, serialization, pending counters, write-error reporting/recovery, and startup failure blocking
- Real IndexedDB reload persistence must still be verified in the browser using the final game build
- Browser-only SDL_ListModes guards were added to gucci_sdl.cpp for both list and closest-mode functions; its full Wasm object compiles successfully
- Browser-only completion hooks now exist in App::SaveGame, App::RetireGame, and Options::Save; the options hook runs after close/encryption and does not run on open failure. The original uplink.cpp authentication/startup entrypoint remains unchanged.
- `python3 port/tests/test-options-save.py` extracts the actual options save body and validates native and browser success/failure ordering.
