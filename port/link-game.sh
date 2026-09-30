#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
"$ROOT/port/build-game.sh"
PRELOAD=()
for asset in "$ROOT"/game-data/*.dat; do PRELOAD+=(--preload-file "$asset@/$(basename "$asset")"); done
PRELOAD+=(--preload-file "$ROOT/prototype/assets/rgba@/assets/rgba")
"$ROOT/toolchain/emsdk-main/upstream/emscripten/em++" -O1 -sUSE_SDL=1 -sUSE_SDL_MIXER=1 -sUSE_FREETYPE=1 -sLEGACY_GL_EMULATION=1 -sALLOW_MEMORY_GROWTH=1 -sASSERTIONS=1 -Wl,--error-limit=0 "$ROOT"/port/game-objects/*.o "$ROOT/port/ftgl/libftgl.a" "$ROOT/port/gl-compat.cpp" "${PRELOAD[@]}" --pre-js "$ROOT/port/persistence.js" -lidbfs.js -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,IDBFS,callMain -sSTACK_SIZE=1048576 "$@" -o "$ROOT/prototype/game.js"
