#!/usr/bin/env bash
set -euo pipefail
TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$TEST_DIR/../.." && pwd)"
SOURCE_ROOT="${SOURCE_ROOT:-$ROOT/uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404}"
EMXX="${EMXX:-$ROOT/toolchain/emsdk-main/upstream/emscripten/em++}"
if [[ -z "${NODE:-}" ]]; then
  NODE="$(find "$ROOT/toolchain/emsdk-main/node" -type f -path '*/bin/node' -print -quit)"
fi
[[ -x "$EMXX" && -x "$NODE" ]] || { echo 'Set EMXX and NODE to installed Emscripten and Node executables' >&2; exit 1; }
BUILD="$(mktemp -d "${TMPDIR:-/tmp}/uplink-image-tests.XXXXXX")"
trap 'rm -rf "$BUILD"' EXIT
"$EMXX" -std=gnu++11 -Wno-writable-strings -sASSERTIONS=1 \
  -sENVIRONMENT=node -sSINGLE_FILE=1 \
  -I"$SOURCE_ROOT/lib/gucci" -I"$SOURCE_ROOT/lib/mmgr" \
  -I"$SOURCE_ROOT/lib/redshirt" -I"$SOURCE_ROOT/lib/bungle" -I"$SOURCE_ROOT/lib/tosser" \
  "$ROOT/port/webgl-renderer.cpp" "$SOURCE_ROOT/lib/gucci/image.cpp" "$TEST_DIR/image_sidecar_test.cpp" \
  -o "$BUILD/image-tests.js"
"$NODE" "$BUILD/image-tests.js"
