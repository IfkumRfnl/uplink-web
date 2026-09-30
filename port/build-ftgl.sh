#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
EM="$ROOT/toolchain/emsdk-main/upstream/emscripten"
SRC="$ROOT/uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404/contrib/FTGL-2.1.2"
BUILD="$ROOT/port/ftgl"
mkdir -p "$BUILD/obj" "$BUILD/include/ftgl" "$BUILD/src"
cp "$SRC"/include/*.h "$BUILD/include/ftgl/"
sed -i 's/static void FTTextureGlyph::ResetActiveTexture/static void ResetActiveTexture/' "$BUILD/include/ftgl/FTTextureGlyph.h"
cp "$SRC"/src/*.cpp "$BUILD/src/"
python3 "$ROOT/port/patch-ftgl.py"
# Only texture font and common core; polygon paths need GLU tessellation.
for UNIT in FTCharmap FTGlyphContainer FTGlyph FTTextureGlyph FTGLTextureFont FTPoint FTFont FTSize FTLibrary FTFace; do
 "$EM/em++" -std=gnu++98 -O1 -sUSE_FREETYPE=1 -I"$BUILD/include/ftgl" -c "$BUILD/src/$UNIT.cpp" -o "$BUILD/obj/$UNIT.o"
done
"$EM/emar" rcs "$BUILD/libftgl.a" "$BUILD"/obj/*.o
