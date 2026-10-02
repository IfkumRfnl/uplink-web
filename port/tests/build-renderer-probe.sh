#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
mkdir -p "$ROOT/qa/probe"
"$ROOT/toolchain/emsdk-main/upstream/emscripten/em++" -std=gnu++98 -O1 -sASSERTIONS=1 \
  -I"$ROOT/uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404/lib/gucci" \
  -I"$ROOT/uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404/lib/mmgr" \
  "$ROOT/uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404/lib/gucci/image.cpp" \
  "$ROOT/port/webgl-renderer.cpp" "$ROOT/port/tests/renderer-probe.cpp" \
  -o "$ROOT/qa/probe/index.html"
