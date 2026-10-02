from pathlib import Path
p=Path(__file__).resolve().parent/'ftgl/src/FTTextureGlyph.cpp'
s=p.read_text().replace('glPushClientAttrib( GL_CLIENT_PIXEL_STORE_BIT);','GLint oldUnpackAlignment; glGetIntegerv(GL_UNPACK_ALIGNMENT, &oldUnpackAlignment);').replace('glPixelStorei( GL_UNPACK_LSB_FIRST, GL_FALSE);','').replace('glPixelStorei( GL_UNPACK_ROW_LENGTH, 0);','').replace('glPopClientAttrib();','glPixelStorei(GL_UNPACK_ALIGNMENT, oldUnpackAlignment);')
p.write_text(s)

# Match the native FTGLBitmapFont: hinted, monochrome glyphs at the original
# point size. Nearest sampling alone cannot sharpen an unhinted grayscale
# raster. Keep browser-only FTGL changes in the generated build copy.
p=p.with_name('FTGLTextureFont.cpp')
s=('#define GL_GLEXT_PROTOTYPES\n' + p.read_text()).replace('FT_LOAD_NO_HINTING', 'FT_LOAD_TARGET_MONO').replace('GL_TEXTURE_MAG_FILTER, GL_LINEAR', 'GL_TEXTURE_MAG_FILTER, GL_NEAREST').replace('GL_TEXTURE_MIN_FILTER, GL_LINEAR', 'GL_TEXTURE_MIN_FILTER, GL_NEAREST').replace('GL_CLAMP)', 'GL_CLAMP_TO_EDGE)').replace('glPushAttrib( GL_ENABLE_BIT | GL_COLOR_BUFFER_BIT);','''GLboolean oldBlend = glIsEnabled(GL_BLEND);
    GLint oldSrcRGB, oldDstRGB, oldSrcAlpha, oldDstAlpha;
    glGetIntegerv(GL_BLEND_SRC_RGB, &oldSrcRGB); glGetIntegerv(GL_BLEND_DST_RGB, &oldDstRGB);
    glGetIntegerv(GL_BLEND_SRC_ALPHA, &oldSrcAlpha); glGetIntegerv(GL_BLEND_DST_ALPHA, &oldDstAlpha);''').replace('glPopAttrib();','''glBlendFuncSeparate(oldSrcRGB, oldDstRGB, oldSrcAlpha, oldDstAlpha);
    if (!oldBlend) glDisable(GL_BLEND);''')
# Hinting can round a scaled glyph beyond the truncated face bounding box.
# Reserve whole-pixel extents and padding between atlas rows, as between columns.
s = '#include <cmath>\n' + s
s = s.replace('static_cast<int>( charSize.Height())', 'static_cast<int>(std::ceil(charSize.Height())) + padding')
s = s.replace('static_cast<int>( charSize.Width())', 'static_cast<int>(std::ceil(charSize.Width())) + padding')
p.write_text(s)

# WebGL ALPHA samples have zero RGB; legacy emulation modulates all four
# channels. White RGBA glyph texels preserve the original text colour.
p=p.with_name('FTTextureGlyph.cpp')
s=p.read_text().replace('FT_RENDER_MODE_NORMAL', 'FT_RENDER_MODE_MONO')
s=s.replace('FT_Bitmap      bitmap = glyph->bitmap;', '''FT_Bitmap      bitmap = glyph->bitmap;
    if (bitmap.pixel_mode != FT_PIXEL_MODE_MONO &&
        bitmap.pixel_mode != FT_PIXEL_MODE_GRAY &&
        bitmap.pixel_mode != FT_PIXEL_MODE_GRAY2 &&
        bitmap.pixel_mode != FT_PIXEL_MODE_GRAY4) {
        err = 0x13; // Unsupported glyph format; never interpret color/LCD bytes as alpha.
        return;
    }''')
s=s.replace('glTexSubImage2D( GL_TEXTURE_2D, 0, xOffset, yOffset, destWidth, destHeight, GL_ALPHA, GL_UNSIGNED_BYTE, bitmap.buffer);', '\n'.join([
    'unsigned char* rgba = new unsigned char[destWidth * destHeight * 4];',
    'for (int y = 0; y < destHeight; ++y) for (int x = 0; x < destWidth; ++x) {',
    '    int i = (y * destWidth + x) * 4;',
    '    rgba[i] = rgba[i+1] = rgba[i+2] = 255;',
    '    const unsigned char* row = bitmap.buffer + (bitmap.pitch < 0',
    '        ? (destHeight - 1 - y) * (-bitmap.pitch) : y * bitmap.pitch);',
    '    switch (bitmap.pixel_mode) {',
    '    case FT_PIXEL_MODE_MONO:',
    '        rgba[i+3] = (row[x >> 3] & (0x80 >> (x & 7))) ? 255 : 0; break;',
    '    case FT_PIXEL_MODE_GRAY2:',
    '        rgba[i+3] = ((row[x >> 2] >> (6 - 2 * (x & 3))) & 3) * 85; break;',
    '    case FT_PIXEL_MODE_GRAY4:',
    '        rgba[i+3] = ((row[x >> 1] >> (4 - 4 * (x & 1))) & 15) * 17; break;',
    '    default: rgba[i+3] = row[x]; break;',
    '    }',
    '}',
    'glTexSubImage2D(GL_TEXTURE_2D, 0, xOffset, yOffset, destWidth, destHeight, GL_RGBA, GL_UNSIGNED_BYTE, rgba);',
    'delete [] rgba;'
]))
p.write_text(s)
p=p.with_name('FTGLTextureFont.cpp')
s=p.read_text().replace('int totalMemory = textureWidth * textureHeight;', 'int totalMemory = textureWidth * textureHeight * 4;').replace('memset( textureMemory, 0, totalMemory);', 'for (int i = 0; i < totalMemory; i += 4) { textureMemory[i] = textureMemory[i+1] = textureMemory[i+2] = 255; textureMemory[i+3] = 0; }').replace('GL_ALPHA, textureWidth, textureHeight, 0, GL_ALPHA', 'GL_RGBA, textureWidth, textureHeight, 0, GL_RGBA')
p.write_text(s)

# Submit glyphs and atlas mutations through the explicit renderer API.
import re
for p in (Path(__file__).resolve().parent/'ftgl/src').glob('*.cpp'):
    text=p.read_text()
    names=['Begin','End','Vertex2f','TexCoord2f','Translatef','Enable','Disable','IsEnabled','BlendFunc','BlendFuncSeparate','BindTexture','DeleteTextures','TexImage2D','TexSubImage2D','GetIntegerv','GenTextures','TexParameteri','PixelStorei']
    for name in names:
        text=re.sub(r'\bgl'+name+r'(?=\s*\()', 'UplinkDraw::'+name[0].lower()+name[1:], text)
    p.write_text('#include "uplink_draw.h"\n'+text)
