from pathlib import Path
p=Path(__file__).resolve().parent/'ftgl/src/FTTextureGlyph.cpp'
s=p.read_text().replace('glPushClientAttrib( GL_CLIENT_PIXEL_STORE_BIT);','GLint oldUnpackAlignment; glGetIntegerv(GL_UNPACK_ALIGNMENT, &oldUnpackAlignment);').replace('glPixelStorei( GL_UNPACK_LSB_FIRST, GL_FALSE);','').replace('glPixelStorei( GL_UNPACK_ROW_LENGTH, 0);','').replace('glPopClientAttrib();','glPixelStorei(GL_UNPACK_ALIGNMENT, oldUnpackAlignment);')
p.write_text(s)

# The atlas is rasterized at the game's native font size. Linear sampling
# softens those glyphs (unlike native bitmap blits); browser presentation
# scaling is handled separately, without changing font metrics or layout.
p=p.with_name('FTGLTextureFont.cpp')
s=('#define GL_GLEXT_PROTOTYPES\n' + p.read_text()).replace('GL_TEXTURE_MAG_FILTER, GL_LINEAR', 'GL_TEXTURE_MAG_FILTER, GL_NEAREST').replace('GL_TEXTURE_MIN_FILTER, GL_LINEAR', 'GL_TEXTURE_MIN_FILTER, GL_NEAREST').replace('GL_CLAMP)', 'GL_CLAMP_TO_EDGE)').replace('glPushAttrib( GL_ENABLE_BIT | GL_COLOR_BUFFER_BIT);','''GLboolean oldBlend = glIsEnabled(GL_BLEND);
    GLint oldSrcRGB, oldDstRGB, oldSrcAlpha, oldDstAlpha;
    glGetIntegerv(GL_BLEND_SRC_RGB, &oldSrcRGB); glGetIntegerv(GL_BLEND_DST_RGB, &oldDstRGB);
    glGetIntegerv(GL_BLEND_SRC_ALPHA, &oldSrcAlpha); glGetIntegerv(GL_BLEND_DST_ALPHA, &oldDstAlpha);''').replace('glPopAttrib();','''glBlendFuncSeparate(oldSrcRGB, oldDstRGB, oldSrcAlpha, oldDstAlpha);
    if (!oldBlend) glDisable(GL_BLEND);''')
p.write_text(s)

# WebGL ALPHA samples have zero RGB; legacy emulation modulates all four
# channels. White RGBA glyph texels preserve the original text colour.
p=p.with_name('FTTextureGlyph.cpp')
s=p.read_text().replace('glTexSubImage2D( GL_TEXTURE_2D, 0, xOffset, yOffset, destWidth, destHeight, GL_ALPHA, GL_UNSIGNED_BYTE, bitmap.buffer);', '\n'.join([
    'unsigned char* rgba = new unsigned char[destWidth * destHeight * 4];',
    'for (int y = 0; y < destHeight; ++y) for (int x = 0; x < destWidth; ++x) {',
    '    int i = (y * destWidth + x) * 4;',
    '    rgba[i] = rgba[i+1] = rgba[i+2] = 255;',
    '    rgba[i+3] = bitmap.buffer[y * bitmap.pitch + x];',
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
