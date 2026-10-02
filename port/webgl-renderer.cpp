// Uplink's ordered 2D draw stream -> GLES2 buffers and a single explicit
// program. No GL immediate/fixed-function entry points are exported or linked
// here.
#include "uplink_draw.h"
#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <emscripten/html5.h>
#include <map>
#include <vector>
namespace UplinkDraw {
struct Matrix {
  float v[16];
  Matrix() { identity(); }
  void identity() {
    memset(v, 0, sizeof(v));
    v[0] = v[5] = v[10] = v[15] = 1;
  }
};
static Matrix projection, model;
static GLenum matrixTarget = GL_MODELVIEW;
static std::vector<Matrix> projectionStack, modelStack;
static Matrix &matrix() {
  return matrixTarget == GL_PROJECTION ? projection : model;
}
static void multiply(Matrix &a, const Matrix &b) {
  Matrix result;
  for (int c = 0; c < 4; ++c)
    for (int r = 0; r < 4; ++r) {
      result.v[c * 4 + r] = 0;
      for (int k = 0; k < 4; ++k)
        result.v[c * 4 + r] += a.v[k * 4 + r] * b.v[c * 4 + k];
    }
  a = result;
}
struct Vertex {
  float p[4], uv[2];
  unsigned char colour[4];
};
static std::vector<Vertex> primitive, batch;
static GLenum primitiveMode, batchMode = GL_TRIANGLES;
static unsigned char colour[4] = {255, 255, 255, 255};
static float uv[2] = {0, 0};
static bool textured = false;
static GLint environment = GL_MODULATE;
static GLuint program = 0, buffer = 0;
static GLint textureModeLocation;
static GLuint shader(GLenum type, const char *source) {
  GLuint id = glCreateShader(type);
  glShaderSource(id, 1, &source, 0);
  glCompileShader(id);
  GLint ok;
  glGetShaderiv(id, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    char log[2048];
    glGetShaderInfoLog(id, sizeof(log), 0, log);
    fprintf(stderr, "Uplink shader compile failed: %s\n", log);
    abort();
  }
  return id;
}
static void initialize() {
  const char *vs = "attribute vec4 aPosition; attribute vec2 aUV; attribute "
                   "vec4 aColour; varying vec2 vUV; varying vec4 vColour; void "
                   "main(){ gl_Position=aPosition; vUV=aUV; vColour=aColour; }";
  const char *fs =
      "precision mediump float; uniform sampler2D uTexture; uniform int uMode; "
      "varying vec2 vUV; varying vec4 vColour; void main(){ if(uMode==0) "
      "gl_FragColor=vColour; else { vec4 texel=texture2D(uTexture,vUV); "
      "gl_FragColor=uMode==2 ? texel : texel*vColour; } }";
  GLuint v = shader(GL_VERTEX_SHADER, vs), f = shader(GL_FRAGMENT_SHADER, fs);
  program = glCreateProgram();
  glAttachShader(program, v);
  glAttachShader(program, f);
  glBindAttribLocation(program, 0, "aPosition");
  glBindAttribLocation(program, 1, "aUV");
  glBindAttribLocation(program, 2, "aColour");
  glLinkProgram(program);
  GLint ok;
  glGetProgramiv(program, GL_LINK_STATUS, &ok);
  if (!ok) {
    char log[2048];
    glGetProgramInfoLog(program, sizeof(log), 0, log);
    fprintf(stderr, "Uplink program link failed: %s\n", log);
    abort();
  }
  glDeleteShader(v);
  glDeleteShader(f);
  textureModeLocation = glGetUniformLocation(program, "uMode");
  glUseProgram(program);
  glUniform1i(glGetUniformLocation(program, "uTexture"), 0);
  glGenBuffers(1, &buffer);
}
static bool contextIsLost();
void flush() {
  if (contextIsLost()) {
    batch.clear();
    return;
  }
  if (batch.empty())
    return;
  if (!program)
    initialize();
  glUseProgram(program);
  glBindBuffer(GL_ARRAY_BUFFER, buffer);
  glBufferData(GL_ARRAY_BUFFER, batch.size() * sizeof(Vertex), &batch[0],
               GL_STREAM_DRAW);
  glEnableVertexAttribArray(0);
  glEnableVertexAttribArray(1);
  glEnableVertexAttribArray(2);
  glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, sizeof(Vertex),
                        (void *)offsetof(Vertex, p));
  glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex),
                        (void *)offsetof(Vertex, uv));
  glVertexAttribPointer(2, 4, GL_UNSIGNED_BYTE, GL_TRUE, sizeof(Vertex),
                        (void *)offsetof(Vertex, colour));
  glUniform1i(textureModeLocation,
              textured ? (environment == GL_REPLACE ? 2 : 1) : 0);
  glDrawArrays(batchMode, 0, batch.size());
  batch.clear();
}
void begin(GLenum mode) {
  if (!primitive.empty())
    abort();
  primitiveMode = mode;
}
static void vertex(float x, float y, float z) {
  Vertex v;
  float input[4] = {x, y, z, 1}, intermediate[4] = {0, 0, 0, 0};
  for (int r = 0; r < 4; ++r)
    for (int c = 0; c < 4; ++c)
      intermediate[r] += model.v[c * 4 + r] * input[c];
  for (int r = 0; r < 4; ++r) {
    v.p[r] = 0;
    for (int c = 0; c < 4; ++c)
      v.p[r] += projection.v[c * 4 + r] * intermediate[c];
  }
  memcpy(v.uv, uv, sizeof(uv));
  memcpy(v.colour, colour, sizeof(colour));
  primitive.push_back(v);
}
void vertex2i(GLint x, GLint y) { vertex(x, y, 0); }
void vertex2f(GLfloat x, GLfloat y) { vertex(x, y, 0); }
void vertex2d(GLdouble x, GLdouble y) { vertex(x, y, 0); }
void vertex3i(GLint x, GLint y, GLint z) { vertex(x, y, z); }
void end() {
  GLenum mode = primitiveMode == GL_QUADS ? GL_TRIANGLES : primitiveMode;
  // Strips/loops are independent draws, so never connect separate primitives.
  bool independent = mode == GL_LINE_STRIP || mode == GL_LINE_LOOP;
  if (mode != batchMode || independent ||
      batch.size() + primitive.size() > 32768)
    flush();
  batchMode = mode;
  if (primitiveMode == GL_QUADS) {
    for (size_t i = 0; i + 3 < primitive.size(); i += 4) {
      static const int indices[] = {0, 1, 2, 0, 2, 3};
      for (int k = 0; k < 6; ++k)
        batch.push_back(primitive[i + indices[k]]);
    }
  } else
    batch.insert(batch.end(), primitive.begin(), primitive.end());
  primitive.clear();
  if (independent)
    flush();
}
void color4f(GLfloat r, GLfloat g, GLfloat b, GLfloat a) {
  float c[] = {r, g, b, a};
  for (int i = 0; i < 4; ++i)
    colour[i] = (unsigned char)(std::max(0.f, std::min(1.f, c[i])) * 255);
}
void color3f(GLfloat r, GLfloat g, GLfloat b) { color4f(r, g, b, 1); }
void color3d(GLdouble r, GLdouble g, GLdouble b) { color4f(r, g, b, 1); }
void color3ub(GLubyte r, GLubyte g, GLubyte b) {
  colour[0] = r;
  colour[1] = g;
  colour[2] = b;
  colour[3] = 255;
}
void texCoord2f(GLfloat u, GLfloat v) {
  uv[0] = u;
  uv[1] = v;
}
void matrixMode(GLenum mode) { matrixTarget = mode; }
void loadIdentity() { matrix().identity(); }
void pushMatrix() {
  (matrixTarget == GL_PROJECTION ? projectionStack : modelStack)
      .push_back(matrix());
}
void popMatrix() {
  std::vector<Matrix> &stack =
      matrixTarget == GL_PROJECTION ? projectionStack : modelStack;
  if (stack.empty())
    abort();
  matrix() = stack.back();
  stack.pop_back();
}
void translatef(GLfloat x, GLfloat y, GLfloat z) {
  Matrix m;
  m.v[12] = x;
  m.v[13] = y;
  m.v[14] = z;
  multiply(matrix(), m);
}
void scalef(GLfloat x, GLfloat y, GLfloat z) {
  Matrix m;
  m.v[0] = x;
  m.v[5] = y;
  m.v[10] = z;
  multiply(matrix(), m);
}
void ortho(GLdouble l, GLdouble r, GLdouble b, GLdouble t, GLdouble n,
           GLdouble f) {
  Matrix m;
  m.v[0] = 2 / (r - l);
  m.v[5] = 2 / (t - b);
  m.v[10] = -2 / (f - n);
  m.v[12] = -(r + l) / (r - l);
  m.v[13] = -(t + b) / (t - b);
  m.v[14] = -(f + n) / (f - n);
  multiply(matrix(), m);
}

// Retain only the renderer's explicit state and live texture resources. Logical
// texture handles remain stable when WebGL destroys its objects on context
// loss.
struct Texture {
  GLuint gpu;
  GLint width, height, internal, format, type;
  std::vector<unsigned char> pixels;
  std::map<GLenum, GLint> parameters;
  Texture()
      : gpu(0), width(0), height(0), internal(GL_RGBA), format(GL_RGBA),
        type(GL_UNSIGNED_BYTE) {}
};
static std::map<GLuint, Texture> textures;
static GLuint nextTexture = 1, boundTexture = 0;
static GLenum activeUnit = GL_TEXTURE0;
static GLint unpack = 4, maximumTextureSize = 0;
static bool lost = false, callbacksInstalled = false;
static bool contextIsLost() { return lost; }
static std::map<GLenum, bool> capabilities;
static GLint sourceRGB = GL_ONE, destRGB = GL_ZERO, sourceAlpha = GL_ONE,
             destAlpha = GL_ZERO, clip[4] = {0, 0, 0, 0};
static GLfloat strokeWidth = 1, background[4] = {0, 0, 0, 0};
static bool unused(GLenum cap) {
  return cap == GL_ALPHA_TEST || cap == GL_FOG || cap == GL_LIGHTING ||
         cap == GL_LOGIC_OP || cap == GL_TEXTURE_1D || cap == GL_LINE_STIPPLE;
}
static EM_BOOL contextLost(int, const void *, void *) {
  lost = true;
  batch.clear();
  primitive.clear();
  // Free Emscripten's handle-table entries as well as dropping GPU objects.
  // WebGL permits deletion while lost; actual GPU deletion is then a no-op.
  if (program)
    glDeleteProgram(program);
  if (buffer)
    glDeleteBuffers(1, &buffer);
  for (std::map<GLuint, Texture>::iterator i = textures.begin();
       i != textures.end(); ++i) {
    if (i->second.gpu)
      glDeleteTextures(1, &i->second.gpu);
    i->second.gpu = 0;
  }
  program = buffer = 0;
  return EM_TRUE;
}
static EM_BOOL contextRestored(int, const void *, void *) {
  lost = false;
  glActiveTexture(GL_TEXTURE0);
  glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
  for (std::map<GLuint, Texture>::iterator i = textures.begin();
       i != textures.end(); ++i) {
    Texture &tex = i->second;
    glGenTextures(1, &tex.gpu);
    glBindTexture(GL_TEXTURE_2D, tex.gpu);
    for (std::map<GLenum, GLint>::iterator p = tex.parameters.begin();
         p != tex.parameters.end(); ++p)
      glTexParameteri(GL_TEXTURE_2D, p->first, p->second);
    if (tex.width && tex.height)
      glTexImage2D(GL_TEXTURE_2D, 0, tex.internal, tex.width, tex.height, 0,
                   tex.format, tex.type, &tex.pixels[0]);
  }
  glBindTexture(GL_TEXTURE_2D, boundTexture ? textures[boundTexture].gpu : 0);
  glPixelStorei(GL_UNPACK_ALIGNMENT, unpack);
  glBlendFuncSeparate(sourceRGB, destRGB, sourceAlpha, destAlpha);
  glScissor(clip[0], clip[1], clip[2], clip[3]);
  glLineWidth(strokeWidth);
  glClearColor(background[0], background[1], background[2], background[3]);
  for (std::map<GLenum, bool>::iterator i = capabilities.begin();
       i != capabilities.end(); ++i) {
    if (i->second)
      glEnable(i->first);
    else
      glDisable(i->first);
  }
  GLint viewport[4];
  glGetIntegerv(GL_VIEWPORT, viewport);
  glViewport(0, 0, viewport[2], viewport[3]);
  EM_ASM({
    Module.uplinkRendererRestores = (Module.uplinkRendererRestores || 0) + 1;
  });
  return EM_TRUE;
}
static void installCallbacks() {
  if (callbacksInstalled)
    return;
  callbacksInstalled = true;
  glGetIntegerv(GL_MAX_TEXTURE_SIZE, &maximumTextureSize);
  emscripten_set_webglcontextlost_callback(
      "#canvas", 0, EM_TRUE, (em_webgl_context_callback)contextLost);
  emscripten_set_webglcontextrestored_callback(
      "#canvas", 0, EM_TRUE, (em_webgl_context_callback)contextRestored);
}
void enable(GLenum cap) {
  if (cap == GL_TEXTURE_2D) {
    if (!textured)
      flush();
    textured = true;
  } else if (!unused(cap)) {
    if (!capabilities[cap])
      flush();
    capabilities[cap] = true;
    if (!lost)
      glEnable(cap);
  }
}
void disable(GLenum cap) {
  if (cap == GL_TEXTURE_2D) {
    if (textured)
      flush();
    textured = false;
  } else if (!unused(cap)) {
    if (capabilities[cap])
      flush();
    capabilities[cap] = false;
    if (!lost)
      glDisable(cap);
  }
}
GLboolean isEnabled(GLenum cap) {
  return cap == GL_TEXTURE_2D ? textured
                              : (unused(cap) ? GL_FALSE : capabilities[cap]);
}
void texEnvi(GLenum, GLenum, GLint value) {
  if (environment != value)
    flush();
  environment = value;
}
void getTexEnviv(GLenum, GLenum, GLint *value) { *value = environment; }
void getIntegerv(GLenum name, GLint *value) {
  switch (name) {
  case GL_MAX_TEXTURE_SIZE:
    if (!maximumTextureSize && !lost)
      glGetIntegerv(GL_MAX_TEXTURE_SIZE, &maximumTextureSize);
    *value = maximumTextureSize;
    break;
  case GL_MATRIX_MODE:
    *value = matrixTarget;
    break;
  case GL_TEXTURE_BINDING_2D:
    *value = boundTexture;
    break;
  case GL_ACTIVE_TEXTURE:
    *value = activeUnit;
    break;
  case GL_UNPACK_ALIGNMENT:
    *value = unpack;
    break;
  case GL_BLEND_SRC_RGB:
    *value = sourceRGB;
    break;
  case GL_BLEND_DST_RGB:
    *value = destRGB;
    break;
  case GL_BLEND_SRC_ALPHA:
    *value = sourceAlpha;
    break;
  case GL_BLEND_DST_ALPHA:
    *value = destAlpha;
    break;
  case GL_SCISSOR_BOX:
    memcpy(value, clip, sizeof(clip));
    break;
  default:
    glGetIntegerv(name, value);
    break;
  }
}
void activeTexture(GLenum unit) {
  if (unit != GL_TEXTURE0) {
    fprintf(stderr, "Uplink renderer only supports texture unit 0\n");
    abort();
  }
  activeUnit = unit;
  if (!lost)
    glActiveTexture(unit);
}
void genTextures(GLsizei n, GLuint *ids) {
  installCallbacks();
  for (int i = 0; i < n; ++i) {
    ids[i] = nextTexture++;
    Texture &tex = textures[ids[i]];
    if (!lost)
      glGenTextures(1, &tex.gpu);
  }
}
void bindTexture(GLenum target, GLuint texture) {
  if (texture && !textures.count(texture)) {
    fprintf(stderr, "Unknown Uplink texture %u\n", texture);
    abort();
  }
  if (boundTexture != texture)
    flush();
  boundTexture = texture;
  if (!lost)
    glBindTexture(target, texture ? textures[texture].gpu : 0);
}
void texParameteri(GLenum target, GLenum name, GLint value) {
  if (!boundTexture)
    abort();
  Texture &tex = textures[boundTexture];
  if (tex.parameters[name] != value)
    flush();
  tex.parameters[name] = value;
  if (!lost)
    glTexParameteri(target, name, value);
}
void pixelStorei(GLenum name, GLint value) {
  if (name != GL_UNPACK_ALIGNMENT)
    abort();
  unpack = value;
  if (!lost)
    glPixelStorei(name, value);
}
void blendFunc(GLenum s, GLenum d) { blendFuncSeparate(s, d, s, d); }
void blendFuncSeparate(GLenum sr, GLenum dr, GLenum sa, GLenum da) {
  if (sourceRGB != (GLint)sr || destRGB != (GLint)dr ||
      sourceAlpha != (GLint)sa || destAlpha != (GLint)da)
    flush();
  sourceRGB = sr;
  destRGB = dr;
  sourceAlpha = sa;
  destAlpha = da;
  if (!lost)
    glBlendFuncSeparate(sr, dr, sa, da);
}
void scissor(GLint x, GLint y, GLsizei w, GLsizei h) {
  if (clip[0] != x || clip[1] != y || clip[2] != w || clip[3] != h)
    flush();
  clip[0] = x;
  clip[1] = y;
  clip[2] = w;
  clip[3] = h;
  if (!lost)
    glScissor(x, y, w, h);
}
void lineWidth(GLfloat width) {
  if (strokeWidth != width)
    flush();
  strokeWidth = width;
  if (!lost)
    glLineWidth(width);
}
void lineStipple(GLint, GLushort) {
} // Retain the previous browser's solid lines.
void clearColor(GLfloat r, GLfloat g, GLfloat b, GLfloat a) {
  background[0] = r;
  background[1] = g;
  background[2] = b;
  background[3] = a;
  if (!lost)
    glClearColor(r, g, b, a);
}
void clear(GLbitfield mask) {
  flush();
  if (!lost)
    glClear(mask);
}
void finish() {
  flush();
  if (!lost)
    glFinish();
}
void deleteTextures(GLsizei n, const GLuint *ids) {
  flush();
  for (int i = 0; i < n; ++i) {
    std::map<GLuint, Texture>::iterator tex = textures.find(ids[i]);
    if (tex == textures.end())
      continue;
    if (!lost)
      glDeleteTextures(1, &tex->second.gpu);
    textures.erase(tex);
    if (boundTexture == ids[i])
      boundTexture = 0;
  }
}
static int bytesPerPixel(GLenum format, GLenum type) {
  if (type != GL_UNSIGNED_BYTE || (format != GL_RGBA && format != GL_RGB))
    abort();
  return format == GL_RGBA ? 4 : 3;
}
void texImage2D(GLenum target, GLint level, GLint internal, GLsizei w,
                GLsizei h, GLint border, GLenum format, GLenum type,
                const void *pixels) {
  if (!boundTexture || level || border || w < 0 || h < 0)
    abort();
  Texture &tex = textures[boundTexture];
  int bpp = bytesPerPixel(format, type),
      stride = (w * bpp + unpack - 1) / unpack * unpack;
  // Images keep an owned texture. Compare the actual bytes, rather than the
  // source pointer: Image exposes mutable pixels and callers can edit in place.
  // Recovery already retains packed pixels, so this needs no additional copy.
  if (pixels && w > 0 && h > 0 && tex.width == w && tex.height == h &&
      tex.internal == internal && tex.format == (GLint)format &&
      tex.type == (GLint)type && tex.pixels.size() == size_t(w * h * bpp)) {
    bool identical = true;
    for (int y = 0; y < h && identical; ++y)
      identical = memcmp(&tex.pixels[y * w * bpp],
                         (const unsigned char *)pixels + y * stride,
                         w * bpp) == 0;
    if (identical)
      return;
  }
  // Pending geometry must use the previous contents before a real mutation.
  flush();
  tex.width = w;
  tex.height = h;
  tex.internal = internal;
  tex.format = format;
  tex.type = type;
  tex.pixels.resize(w * h * bpp);
  for (int y = 0; y < h; ++y) {
    if (pixels)
      memcpy(&tex.pixels[y * w * bpp],
             (const unsigned char *)pixels + y * stride, w * bpp);
    else
      memset(&tex.pixels[y * w * bpp], 0, w * bpp);
  }
  if (!lost)
    glTexImage2D(target, level, internal, w, h, border, format, type, pixels);
}
void texSubImage2D(GLenum target, GLint level, GLint x, GLint y, GLsizei w,
                   GLsizei h, GLenum format, GLenum type, const void *pixels) {
  if (!boundTexture || level || !pixels)
    abort();
  flush();
  Texture &tex = textures[boundTexture];
  int bpp = bytesPerPixel(format, type),
      stride = (w * bpp + unpack - 1) / unpack * unpack;
  if (format != (GLenum)tex.format || type != (GLenum)tex.type || x < 0 ||
      y < 0 || x + w > tex.width || y + h > tex.height)
    abort();
  for (int row = 0; row < h; ++row)
    memcpy(&tex.pixels[((row + y) * tex.width + x) * bpp],
           (const unsigned char *)pixels + row * stride, w * bpp);
  if (!lost)
    glTexSubImage2D(target, level, x, y, w, h, format, type, pixels);
}
struct State {
  bool texture;
  GLint env, mode, binding, active, box[4], sr, dr, sa, da;
  unsigned char colour[4];
  GLfloat width;
  std::map<GLenum, bool> caps;
};
static std::vector<State> states;
void pushAttrib(GLbitfield) {
  State s;
  s.texture = textured;
  s.env = environment;
  s.mode = matrixTarget;
  s.binding = boundTexture;
  s.active = activeUnit;
  s.sr = sourceRGB;
  s.dr = destRGB;
  s.sa = sourceAlpha;
  s.da = destAlpha;
  s.width = strokeWidth;
  s.caps = capabilities;
  memcpy(s.colour, colour, 4);
  memcpy(s.box, clip, sizeof(clip));
  states.push_back(s);
}
void popAttrib() {
  if (states.empty())
    abort();
  State s = states.back();
  states.pop_back();
  flush();
  activeTexture(s.active);
  bindTexture(GL_TEXTURE_2D, s.binding);
  textured = s.texture;
  environment = s.env;
  matrixTarget = s.mode;
  memcpy(colour, s.colour, 4);
  for (std::map<GLenum, bool>::iterator i = capabilities.begin();
       i != capabilities.end(); ++i) {
    if (s.caps[i->first])
      enable(i->first);
    else
      disable(i->first);
  }
  blendFuncSeparate(s.sr, s.dr, s.sa, s.da);
  scissor(s.box[0], s.box[1], s.box[2], s.box[3]);
  lineWidth(s.width);
}
} // namespace UplinkDraw
