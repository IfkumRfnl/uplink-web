#!/bin/bash
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404"
EMXX="$ROOT/toolchain/emsdk-main/upstream/emscripten/em++"
"$EMXX" -std=gnu++98 -O1 -w -DUSE_SDL -DUSE_FTGL -sUSE_SDL=1 -sUSE_FREETYPE=1 -sALLOW_MEMORY_GROWTH=1 -sASSERTIONS=1 \
-I"$SRC/lib/gucci" -I"$SRC/lib/tosser" -I"$SRC/lib/mmgr" -I"$SRC/lib/eclipse" -I"$ROOT/port/ftgl/include/ftgl" \
"$ROOT/port/prototype.cpp" "$ROOT/port/webgl-renderer.cpp" "$SRC/lib/gucci/gucci.cpp" "$SRC/lib/gucci/gucci_sdl.cpp" "$SRC/lib/gucci/image.cpp" \
"$SRC/lib/eclipse/eclipse.cpp" "$SRC/lib/eclipse/button.cpp" "$SRC/lib/eclipse/animation.cpp" "$ROOT/port/ftgl/libftgl.a" \
--preload-file "$ROOT/prototype/assets/fonts@/assets/fonts" --preload-file "$ROOT/prototype/assets/rgba@/assets/rgba" \
-lidbfs.js -sEXPORTED_RUNTIME_METHODS=FS,IDBFS,addRunDependency,removeRunDependency -o "$ROOT/prototype/prototype.js"
