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
void end();
void vertex2i(GLint x, GLint y);
void vertex2f(GLfloat x, GLfloat y);
void vertex2d(GLdouble x, GLdouble y);
void vertex3i(GLint x, GLint y, GLint z);
void color4f(GLfloat r, GLfloat g, GLfloat b, GLfloat a);
void color3f(GLfloat r, GLfloat g, GLfloat b);
void color3d(GLdouble r, GLdouble g, GLdouble b);
void color3ub(GLubyte r, GLubyte g, GLubyte b);
void texCoord2f(GLfloat u, GLfloat v);
void enable(GLenum cap);
void disable(GLenum cap);
GLboolean isEnabled(GLenum cap);
void matrixMode(GLenum mode);
void loadIdentity();
void pushMatrix();
void popMatrix();
void translatef(GLfloat x, GLfloat y, GLfloat z);
void scalef(GLfloat x, GLfloat y, GLfloat z);
void ortho(GLdouble l, GLdouble r, GLdouble b, GLdouble t, GLdouble n,
           GLdouble f);
void pushAttrib(GLbitfield mask);
void popAttrib();
void texEnvi(GLenum target, GLenum name, GLint value);
void getTexEnviv(GLenum target, GLenum name, GLint *value);
void bindTexture(GLenum target, GLuint texture);
void blendFunc(GLenum src, GLenum dst);
void blendFuncSeparate(GLenum sr, GLenum dr, GLenum sa, GLenum da);
void scissor(GLint x, GLint y, GLsizei w, GLsizei h);
void lineWidth(GLfloat width);
void lineStipple(GLint factor, GLushort pattern);
void clear(GLbitfield mask);
void finish();
void deleteTextures(GLsizei count, const GLuint *textures);
void texSubImage2D(GLenum target, GLint level, GLint x, GLint y, GLsizei w,
                   GLsizei h, GLenum format, GLenum type, const void *pixels);
void texImage2D(GLenum target, GLint level, GLint internal, GLsizei w,
                GLsizei h, GLint border, GLenum format, GLenum type,
                const void *pixels);
void getIntegerv(GLenum name, GLint *value);
void genTextures(GLsizei count, GLuint *textures);
void texParameteri(GLenum target, GLenum name, GLint value);
void activeTexture(GLenum unit);
void pixelStorei(GLenum name, GLint value);
void clearColor(GLfloat r, GLfloat g, GLfloat b, GLfloat a);
void flush();
#else
inline void begin(GLenum mode) { glBegin(mode); }
inline void end() { glEnd(); }
inline void vertex2i(GLint x, GLint y) { glVertex2i(x, y); }
inline void vertex2f(GLfloat x, GLfloat y) { glVertex2f(x, y); }
inline void vertex2d(GLdouble x, GLdouble y) { glVertex2d(x, y); }
inline void vertex3i(GLint x, GLint y, GLint z) { glVertex3i(x, y, z); }
inline void color4f(GLfloat r, GLfloat g, GLfloat b, GLfloat a) {
  glColor4f(r, g, b, a);
}
inline void color3f(GLfloat r, GLfloat g, GLfloat b) { glColor3f(r, g, b); }
inline void color3d(GLdouble r, GLdouble g, GLdouble b) { glColor3d(r, g, b); }
inline void color3ub(GLubyte r, GLubyte g, GLubyte b) { glColor3ub(r, g, b); }
inline void texCoord2f(GLfloat u, GLfloat v) { glTexCoord2f(u, v); }
inline void enable(GLenum cap) { glEnable(cap); }
inline void disable(GLenum cap) { glDisable(cap); }
inline GLboolean isEnabled(GLenum cap) { return glIsEnabled(cap); }
inline void matrixMode(GLenum mode) { glMatrixMode(mode); }
inline void loadIdentity() { glLoadIdentity(); }
inline void pushMatrix() { glPushMatrix(); }
inline void popMatrix() { glPopMatrix(); }
inline void translatef(GLfloat x, GLfloat y, GLfloat z) {
  glTranslatef(x, y, z);
}
inline void scalef(GLfloat x, GLfloat y, GLfloat z) { glScalef(x, y, z); }
inline void ortho(GLdouble l, GLdouble r, GLdouble b, GLdouble t, GLdouble n,
                  GLdouble f) {
  glOrtho(l, r, b, t, n, f);
}
inline void pushAttrib(GLbitfield mask) { glPushAttrib(mask); }
inline void popAttrib() { glPopAttrib(); }
inline void texEnvi(GLenum target, GLenum name, GLint value) {
  glTexEnvi(target, name, value);
}
inline void getTexEnviv(GLenum target, GLenum name, GLint *value) {
  glGetTexEnviv(target, name, value);
}
inline void bindTexture(GLenum target, GLuint texture) {
  glBindTexture(target, texture);
}
inline void blendFunc(GLenum src, GLenum dst) { glBlendFunc(src, dst); }
inline void scissor(GLint x, GLint y, GLsizei w, GLsizei h) {
  glScissor(x, y, w, h);
}
inline void lineWidth(GLfloat width) { glLineWidth(width); }
inline void lineStipple(GLint factor, GLushort pattern) {
  glLineStipple(factor, pattern);
}
inline void clear(GLbitfield mask) { glClear(mask); }
inline void finish() { glFinish(); }
inline void deleteTextures(GLsizei count, const GLuint *textures) {
  glDeleteTextures(count, textures);
}
inline void texSubImage2D(GLenum target, GLint level, GLint x, GLint y,
                          GLsizei w, GLsizei h, GLenum format, GLenum type,
                          const void *pixels) {
  glTexSubImage2D(target, level, x, y, w, h, format, type, pixels);
}
inline void texImage2D(GLenum target, GLint level, GLint internal, GLsizei w,
                       GLsizei h, GLint border, GLenum format, GLenum type,
                       const void *pixels) {
  glTexImage2D(target, level, internal, w, h, border, format, type, pixels);
}
inline void getIntegerv(GLenum name, GLint *value) {
  glGetIntegerv(name, value);
}
inline void genTextures(GLsizei count, GLuint *textures) {
  glGenTextures(count, textures);
}
inline void texParameteri(GLenum target, GLenum name, GLint value) {
  glTexParameteri(target, name, value);
}
inline void pixelStorei(GLenum name, GLint value) {
  glPixelStorei(name, value);
}
inline void clearColor(GLfloat r, GLfloat g, GLfloat b, GLfloat a) {
  glClearColor(r, g, b, a);
}
#endif
} // namespace UplinkDraw
#endif
