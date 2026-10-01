"""Compile the generated browser glyph TU; exercise its real atlas upload."""
from pathlib import Path
import os
import shlex
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = root / 'uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404/contrib/FTGL-2.1.2/src'
with tempfile.TemporaryDirectory(prefix='uplink-font-raster-') as directory:
    work = Path(directory)
    build = work / 'ftgl/src'
    build.mkdir(parents=True)
    for name in ['FTTextureGlyph.cpp', 'FTGLTextureFont.cpp']:
        shutil.copyfile(source / name, build / name)
    shutil.copyfile(root / 'port/patch-ftgl.py', work / 'patch-ftgl.py')
    subprocess.run(['python3', str(work / 'patch-ftgl.py')], check=True)
    font = (build / 'FTGLTextureFont.cpp').read_text()
    glyph = (build / 'FTTextureGlyph.cpp').read_text()
    assert 'FT_LOAD_NO_HINTING' not in font
    assert 'FT_LOAD_TARGET_MONO' in font
    assert 'FT_LOAD_TARGET_MONO' in (source / 'FTGLBitmapFont.cpp').read_text()
    assert 'FT_RENDER_MODE_NORMAL' not in glyph
    assert 'FT_RENDER_MODE_MONO' in glyph
    assert 'FT_RENDER_MODE_MONO' in (source / 'FTBitmapGlyph.cpp').read_text()
    assert 'GL_TEXTURE_MIN_FILTER, GL_NEAREST' in font
    assert 'GL_TEXTURE_MAG_FILTER, GL_NEAREST' in font
    (build / 'FTTextureGlyph.h').write_text(r"""
#pragma once
#include <vector>
#include <cassert>
#include <cstring>
typedef int GLint;
typedef int GLsizei;
typedef unsigned int GLuint;
enum {FT_RENDER_MODE_MONO = 2, FT_PIXEL_MODE_MONO = 1, FT_PIXEL_MODE_GRAY = 2,
      FT_PIXEL_MODE_GRAY2 = 3, FT_PIXEL_MODE_GRAY4 = 4,
      ft_glyph_format_bitmap = 7, GL_UNPACK_ALIGNMENT = 10, GL_TEXTURE_2D = 11,
      GL_RGBA = 12, GL_UNSIGNED_BYTE = 13, GL_QUADS = 14};
struct FT_Bitmap {int width, rows, pitch; unsigned char* buffer; int pixel_mode;};
struct Glyph {FT_Bitmap bitmap; int format, bitmap_left, bitmap_top, error;};
typedef Glyph* FT_GlyphSlot;
inline int FT_Render_Glyph(FT_GlyphSlot glyph, int mode) {
    assert(mode == FT_RENDER_MODE_MONO);
    return glyph->error;
}
struct FTPoint {
    float x, y;
    FTPoint(float x = 0, float y = 0): x(x), y(y) {}
    float X() const {return x;} void X(float v) {x = v;}
    float Y() const {return y;} void Y(float v) {y = v;}
};
struct FTGlyph {
    int err; FTPoint advance;
    FTGlyph(FT_GlyphSlot): err(0), advance(7, 0) {}
};
class FTTextureGlyph: public FTGlyph {
    int destWidth, destHeight, glTextureID;
    FTPoint uv[2], pos;
public:
    static GLint activeTextureID;
    FTTextureGlyph(FT_GlyphSlot, int, int, int, GLsizei, GLsizei);
    ~FTTextureGlyph();
    const FTPoint& Render(const FTPoint&);
};
""")
    (build / 'uplink_draw.h').write_text(r"""
#pragma once
#include "FTTextureGlyph.h"
namespace UplinkDraw {
static std::vector<unsigned char> uploaded;
static int unpack = 4, uploadCount = 0;
inline void getIntegerv(int name, GLint* value) {assert(name == GL_UNPACK_ALIGNMENT); *value = unpack;}
inline void pixelStorei(int name, int value) {assert(name == GL_UNPACK_ALIGNMENT); unpack = value;}
inline void bindTexture(int, int) {}
inline void texSubImage2D(int, int, int x, int y, int w, int h, int format, int type, const void* pixels) {
    assert(x == 3 && y == 4 && format == GL_RGBA && type == GL_UNSIGNED_BYTE && unpack == 1);
    const unsigned char* bytes = static_cast<const unsigned char*>(pixels);
    uploaded.assign(bytes, bytes + w * h * 4); ++uploadCount;
}
inline void translatef(float, float, float) {}
inline void begin(int) {}
inline void texCoord2f(float, float) {}
inline void vertex2f(float, float) {}
inline void end() {}
}
""")
    (build / 'test.cpp').write_text(r"""
#include "FTTextureGlyph.cpp"
static void check(const unsigned char* alpha, int count) {
    assert(UplinkDraw::uploaded.size() == static_cast<unsigned>(count * 4));
    for (int i = 0; i < count; ++i) {
        for (int c = 0; c < 3; ++c) assert(UplinkDraw::uploaded[i * 4 + c] == 255);
        assert(UplinkDraw::uploaded[i * 4 + 3] == alpha[i]);
    }
    assert(UplinkDraw::unpack == 4);
}
int main() {
    // Width crosses a byte boundary; padded pitch must not become image pixels.
    unsigned char bytes[] = {0xAA,0x80,0xEE,0xEE, 0x55,0x40,0xEE,0xEE};
    Glyph glyph = {{10,2,4,bytes,FT_PIXEL_MODE_MONO},ft_glyph_format_bitmap,1,5,0};
    FTTextureGlyph positive(&glyph, 1, 3, 4, 16, 16);
    const unsigned char expected[] = {255,0,255,0,255,0,255,0,255,0,
                                     0,255,0,255,0,255,0,255,0,255};
    check(expected,20);
    assert(positive.Render(FTPoint()).X() == 7);
    // FreeType keeps buffer at the allocation base for a negative-pitch bitmap.
    glyph.bitmap.pitch = -4;
    FTTextureGlyph negative(&glyph, 1, 3, 4, 16, 16);
    const unsigned char reversed[] = {0,255,0,255,0,255,0,255,0,255,
                                     255,0,255,0,255,0,255,0,255,0};
    check(reversed,20);
    // Existing embedded grayscale bitmaps keep their one-byte coverage values.
    unsigned char gray[] = {0,128,255,99};
    FT_Bitmap grayBitmap = {3,1,4,gray,FT_PIXEL_MODE_GRAY};
    glyph.bitmap = grayBitmap;
    FTTextureGlyph embedded(&glyph, 1, 3, 4, 16, 16);
    check(gray,3);
    unsigned char gray2[] = {0x1B,0x40};
    FT_Bitmap gray2Bitmap = {5,1,2,gray2,FT_PIXEL_MODE_GRAY2};
    glyph.bitmap = gray2Bitmap;
    FTTextureGlyph packed2(&glyph, 1, 3, 4, 16, 16);
    const unsigned char expected2[] = {0,85,170,255,85};
    check(expected2,5);
    unsigned char gray4[] = {0x08,0xF0};
    FT_Bitmap gray4Bitmap = {3,1,2,gray4,FT_PIXEL_MODE_GRAY4};
    glyph.bitmap = gray4Bitmap;
    FTTextureGlyph packed4(&glyph, 1, 3, 4, 16, 16);
    const unsigned char expected4[] = {0,136,255};
    check(expected4,3);
    int count = UplinkDraw::uploadCount;
    glyph.bitmap.pixel_mode = 99;
    FTTextureGlyph unsupported(&glyph, 1, 3, 4, 16, 16);
    assert(UplinkDraw::uploadCount == count);
    glyph.bitmap.pixel_mode = FT_PIXEL_MODE_GRAY;
    glyph.error = 1;
    FTTextureGlyph failed(&glyph, 1, 3, 4, 16, 16);
    assert(UplinkDraw::uploadCount == count);
    glyph.error = 0; glyph.bitmap.width = 0;
    FTTextureGlyph empty(&glyph, 1, 3, 4, 16, 16);
    assert(UplinkDraw::uploadCount == count);
}
""")
    subprocess.run([os.environ.get('CXX', 'g++'), '-std=c++98', '-Wall', '-Wextra', '-pedantic',
                    *shlex.split(os.environ.get('CXXFLAGS', '')),
                    '-I' + str(build), str(build / 'test.cpp'), '-o', str(work / 'test')], check=True)
    subprocess.run([str(work / 'test')], check=True)
print('PASS: native mono hinting, packed MONO/GRAY2/GRAY4, allocation-base negative pitch, gray, unsupported/empty/error glyphs')
