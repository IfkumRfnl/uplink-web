#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TARGET=${1:-$ROOT}
SRC="$TARGET/uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404"
mkdir -p "$TARGET/qa/renderer"
INCLUDES=(-I"$SRC/uplink/src")
for lib in gucci tosser eclipse vanbakel bungle mmgr redshirt soundgarden; do INCLUDES+=(-I"$SRC/lib/$lib"); done
"$TARGET/toolchain/emsdk-main/upstream/emscripten/em++" -std=gnu++98 -O1 -fno-access-control \
  -DUSE_SDL -DUSE_FTGL -DFULLGAME=1 "${INCLUDES[@]}" \
  -c "$ROOT/port/tests/renderer-game-qa.cpp" -o "$TARGET/qa/renderer/fixture.o"
UPLINK_GAME_OUTPUT="$TARGET/qa/renderer/game.js" bash "$TARGET/port/link-game.sh" "$TARGET/qa/renderer/fixture.o"
