#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TARGET=$(cd "${1:-$ROOT}" && pwd)
SRC="$TARGET/uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404"
mkdir -p "$TARGET/qa/renderer"
INCLUDES=(-I"$SRC/uplink/src")
for lib in gucci tosser eclipse vanbakel bungle mmgr redshirt soundgarden; do INCLUDES+=(-I"$SRC/lib/$lib"); done
"$TARGET/toolchain/emsdk-main/upstream/emscripten/em++" -std=gnu++98 -O1 -fno-access-control \
  -DUSE_SDL -DUSE_FTGL -DFULLGAME=1 "${INCLUDES[@]}" \
  -c "$ROOT/port/tests/renderer-game-qa.cpp" -o "$TARGET/qa/renderer/fixture.o"
# The pinned baseline predates UPLINK_GAME_OUTPUT. Adapt only its exact output
# suffix in memory; keep $0 so its ROOT still resolves to the target worktree.
LINK_SCRIPT=$(<"$TARGET/port/link-game.sh")
OLD_OUTPUT='-o "$ROOT/prototype/game.js"'
QA_OUTPUT='-o "${UPLINK_GAME_OUTPUT:-$ROOT/prototype/game.js}"'
if [[ $LINK_SCRIPT == *"$OLD_OUTPUT" ]]; then
  LINK_SCRIPT="${LINK_SCRIPT%"$OLD_OUTPUT"}$QA_OUTPUT"
elif [[ $LINK_SCRIPT != *"$QA_OUTPUT" ]]; then
  echo "Unrecognized link-game.sh output; refusing to risk production files" >&2
  exit 1
fi
UPLINK_GAME_OUTPUT="$TARGET/qa/renderer/game.js" bash -c "$LINK_SCRIPT" \
  "$TARGET/port/link-game.sh" -DUPLINK_RENDERER_QA "$TARGET/qa/renderer/fixture.o"
