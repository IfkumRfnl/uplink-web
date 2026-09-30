from pathlib import Path
p=Path(__file__).resolve().parent/'ftgl/src/FTTextureGlyph.cpp'
s=p.read_text().replace('glPushClientAttrib( GL_CLIENT_PIXEL_STORE_BIT);','GLint oldUnpackAlignment; glGetIntegerv(GL_UNPACK_ALIGNMENT, &oldUnpackAlignment);').replace('glPixelStorei( GL_UNPACK_LSB_FIRST, GL_FALSE);','').replace('glPixelStorei( GL_UNPACK_ROW_LENGTH, 0);','').replace('glPopClientAttrib();','glPixelStorei(GL_UNPACK_ALIGNMENT, oldUnpackAlignment);')
p.write_text(s)
p=p.with_name('FTGLTextureFont.cpp')
s=p.read_text().replace('GL_CLAMP)', 'GL_CLAMP_TO_EDGE)').replace('glPushAttrib( GL_ENABLE_BIT | GL_COLOR_BUFFER_BIT);','''GLboolean oldBlend = glIsEnabled(GL_BLEND);
    GLint oldSrc, oldDst;
    glGetIntegerv(GL_BLEND_SRC, &oldSrc); glGetIntegerv(GL_BLEND_DST, &oldDst);''').replace('glPopAttrib();','''glBlendFunc(oldSrc, oldDst);
    if (!oldBlend) glDisable(GL_BLEND);''')
p.write_text(s)
