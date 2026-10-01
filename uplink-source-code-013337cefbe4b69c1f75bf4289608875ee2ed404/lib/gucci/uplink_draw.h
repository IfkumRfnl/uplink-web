#ifndef UPLINK_DRAW_H
#define UPLINK_DRAW_H
#ifdef WIN32
#include <windows.h>
#endif
#define GL_GLEXT_PROTOTYPES
#include <GL/gl.h>
namespace UplinkDraw {
#ifdef __EMSCRIPTEN__
void begin(GLenum mode);
#else
inline void begin(GLenum mode) { glBegin(mode); }
#endif
#ifdef __EMSCRIPTEN__
void end();
#else
inline void end() { glEnd(); }
#endif
#ifdef __EMSCRIPTEN__
void vertex2i(GLint x, GLint y);
#else
inline void vertex2i(GLint x, GLint y) { glVertex2i(x, y); }
#endif
#ifdef __EMSCRIPTEN__
void vertex2f(GLfloat x, GLfloat y);
#else
inline void vertex2f(GLfloat x, GLfloat y) { glVertex2f(x, y); }
#endif
#ifdef __EMSCRIPTEN__
void vertex2d(GLdouble x, GLdouble y);
#else
inline void vertex2d(GLdouble x, GLdouble y) { glVertex2d(x, y); }
#endif
#ifdef __EMSCRIPTEN__
void vertex3i(GLint x, GLint y, GLint z);
#else
inline void vertex3i(GLint x, GLint y, GLint z) { glVertex3i(x, y, z); }
#endif
#ifdef __EMSCRIPTEN__
void color4f(GLfloat r, GLfloat g, GLfloat b, GLfloat a);
#else
inline void color4f(GLfloat r, GLfloat g, GLfloat b, GLfloat a) {
  glColor4f(r, g, b, a);
}
#endif
#ifdef __EMSCRIPTEN__
void color3f(GLfloat r, GLfloat g, GLfloat b);
#else
inline void color3f(GLfloat r, GLfloat g, GLfloat b) { glColor3f(r, g, b); }
#endif
#ifdef __EMSCRIPTEN__
void color3d(GLdouble r, GLdouble g, GLdouble b);
#else
inline void color3d(GLdouble r, GLdouble g, GLdouble b) { glColor3d(r, g, b); }
#endif
#ifdef __EMSCRIPTEN__
void color3ub(GLubyte r, GLubyte g, GLubyte b);
#else
inline void color3ub(GLubyte r, GLubyte g, GLubyte b) { glColor3ub(r, g, b); }
#endif
#ifdef __EMSCRIPTEN__
void texCoord2f(GLfloat u, GLfloat v);
#else
inline void texCoord2f(GLfloat u, GLfloat v) { glTexCoord2f(u, v); }
#endif
#ifdef __EMSCRIPTEN__
void enable(GLenum cap);
#else
inline void enable(GLenum cap) { glEnable(cap); }
#endif
#ifdef __EMSCRIPTEN__
void disable(GLenum cap);
#else
inline void disable(GLenum cap) { glDisable(cap); }
#endif
#ifdef __EMSCRIPTEN__
GLboolean isEnabled(GLenum cap);
#else
inline GLboolean isEnabled(GLenum cap) { return glIsEnabled(cap); }
#endif
#ifdef __EMSCRIPTEN__
void matrixMode(GLenum mode);
#else
inline void matrixMode(GLenum mode) { glMatrixMode(mode); }
#endif
#ifdef __EMSCRIPTEN__
void loadIdentity();
#else
inline void loadIdentity() { glLoadIdentity(); }
#endif
#ifdef __EMSCRIPTEN__
void pushMatrix();
#else
inline void pushMatrix() { glPushMatrix(); }
#endif
#ifdef __EMSCRIPTEN__
void popMatrix();
#else
inline void popMatrix() { glPopMatrix(); }
#endif
#ifdef __EMSCRIPTEN__
void translatef(GLfloat x, GLfloat y, GLfloat z);
#else
inline void translatef(GLfloat x, GLfloat y, GLfloat z) {
  glTranslatef(x, y, z);
}
#endif
#ifdef __EMSCRIPTEN__
void scalef(GLfloat x, GLfloat y, GLfloat z);
#else
inline void scalef(GLfloat x, GLfloat y, GLfloat z) { glScalef(x, y, z); }
#endif
#ifdef __EMSCRIPTEN__
void ortho(GLdouble l, GLdouble r, GLdouble b, GLdouble t, GLdouble n,
           GLdouble f);
#else
inline void ortho(GLdouble l, GLdouble r, GLdouble b, GLdouble t, GLdouble n,
                  GLdouble f) {
  glOrtho(l, r, b, t, n, f);
}
#endif
#ifdef __EMSCRIPTEN__
void pushAttrib(GLbitfield mask);
#else
inline void pushAttrib(GLbitfield mask) { glPushAttrib(mask); }
#endif
#ifdef __EMSCRIPTEN__
void popAttrib();
#else
inline void popAttrib() { glPopAttrib(); }
#endif
#ifdef __EMSCRIPTEN__
void texEnvi(GLenum target, GLenum name, GLint value);
#else
inline void texEnvi(GLenum target, GLenum name, GLint value) {
  glTexEnvi(target, name, value);
}
#endif
#ifdef __EMSCRIPTEN__
void getTexEnviv(GLenum target, GLenum name, GLint *value);
#else
inline void getTexEnviv(GLenum target, GLenum name, GLint *value) {
  glGetTexEnviv(target, name, value);
}
#endif
#ifdef __EMSCRIPTEN__
void bindTexture(GLenum target, GLuint texture);
#else
inline void bindTexture(GLenum target, GLuint texture) {
  glBindTexture(target, texture);
}
#endif
#ifdef __EMSCRIPTEN__
void blendFunc(GLenum src, GLenum dst);
#else
inline void blendFunc(GLenum src, GLenum dst) { glBlendFunc(src, dst); }
#endif
#ifdef __EMSCRIPTEN__
void blendFuncSeparate(GLenum sr, GLenum dr, GLenum sa, GLenum da);
#endif
#ifdef __EMSCRIPTEN__
void scissor(GLint x, GLint y, GLsizei w, GLsizei h);
#else
inline void scissor(GLint x, GLint y, GLsizei w, GLsizei h) {
  glScissor(x, y, w, h);
}
#endif
#ifdef __EMSCRIPTEN__
void lineWidth(GLfloat width);
#else
inline void lineWidth(GLfloat width) { glLineWidth(width); }
#endif
#ifdef __EMSCRIPTEN__
void lineStipple(GLint factor, GLushort pattern);
#else
inline void lineStipple(GLint factor, GLushort pattern) {
  glLineStipple(factor, pattern);
}
#endif
#ifdef __EMSCRIPTEN__
void clear(GLbitfield mask);
#else
inline void clear(GLbitfield mask) { glClear(mask); }
#endif
#ifdef __EMSCRIPTEN__
void finish();
#else
inline void finish() { glFinish(); }
#endif
#ifdef __EMSCRIPTEN__
void deleteTextures(GLsizei count, const GLuint *textures);
#else
inline void deleteTextures(GLsizei count, const GLuint *textures) {
  glDeleteTextures(count, textures);
}
#endif
#ifdef __EMSCRIPTEN__
void texSubImage2D(GLenum target, GLint level, GLint x, GLint y, GLsizei w,
                   GLsizei h, GLenum format, GLenum type, const void *pixels);
#else
inline void texSubImage2D(GLenum target, GLint level, GLint x, GLint y,
                          GLsizei w, GLsizei h, GLenum format, GLenum type,
                          const void *pixels) {
  glTexSubImage2D(target, level, x, y, w, h, format, type, pixels);
}
#endif
#ifdef __EMSCRIPTEN__
void texImage2D(GLenum target, GLint level, GLint internal, GLsizei w,
                GLsizei h, GLint border, GLenum format, GLenum type,
                const void *pixels);
#else
inline void texImage2D(GLenum target, GLint level, GLint internal, GLsizei w,
                       GLsizei h, GLint border, GLenum format, GLenum type,
                       const void *pixels) {
  glTexImage2D(target, level, internal, w, h, border, format, type, pixels);
}
#endif
#ifdef __EMSCRIPTEN__
void getIntegerv(GLenum name, GLint *value);
#else
inline void getIntegerv(GLenum name, GLint *value) {
  glGetIntegerv(name, value);
}
#endif
#ifdef __EMSCRIPTEN__
void genTextures(GLsizei count, GLuint *textures);
#else
inline void genTextures(GLsizei count, GLuint *textures) {
  glGenTextures(count, textures);
}
#endif
#ifdef __EMSCRIPTEN__
void texParameteri(GLenum target, GLenum name, GLint value);
#else
inline void texParameteri(GLenum target, GLenum name, GLint value) {
  glTexParameteri(target, name, value);
}
#endif
#ifdef __EMSCRIPTEN__
void activeTexture(GLenum unit);
#endif
#ifdef __EMSCRIPTEN__
void pixelStorei(GLenum name, GLint value);
#else
inline void pixelStorei(GLenum name, GLint value) {
  glPixelStorei(name, value);
}
#endif
#ifdef __EMSCRIPTEN__
void clearColor(GLfloat r, GLfloat g, GLfloat b, GLfloat a);
#else
inline void clearColor(GLfloat r, GLfloat g, GLfloat b, GLfloat a) {
  glClearColor(r, g, b, a);
}
#endif
#ifdef __EMSCRIPTEN__
void flush();
#endif
} // namespace UplinkDraw
#endif
