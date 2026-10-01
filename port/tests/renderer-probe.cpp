#include "uplink_draw.h"
#include <cassert>
#include <cstdlib>
#include <emscripten.h>
#include <emscripten/html5.h>
using namespace UplinkDraw;
static GLuint texture;
static void quad(int x, int y, int w, int h) {
  begin(GL_QUADS);
  vertex2i(x, y);
  vertex2i(x, y + h);
  vertex2i(x + w, y + h);
  vertex2i(x + w, y);
  end();
}
static void sample(int x, int y, int r, int g, int b, int tolerance = 2) {
  unsigned char p[4];
  glReadPixels(x, 128 - y - 1, 1, 1, GL_RGBA, GL_UNSIGNED_BYTE, p);
  assert(abs(p[0] - r) <= tolerance && abs(p[1] - g) <= tolerance &&
         abs(p[2] - b) <= tolerance);
}
static void render() {
  clearColor(0, 0, 0, 1);
  clear(GL_COLOR_BUFFER_BIT);
  matrixMode(GL_PROJECTION);
  loadIdentity();
  ortho(0, 128, 128, 0, -1, 1);
  matrixMode(GL_MODELVIEW);
  loadIdentity();
  disable(GL_TEXTURE_2D);
  disable(GL_BLEND);
  disable(GL_SCISSOR_TEST);
  color4f(.8, .2, .2, .5);
  begin(GL_QUADS);
  vertex2i(0, 0);
  vertex2i(0, 32);
  color4f(.3, .3, .8, .5);
  vertex2i(32, 32);
  vertex2i(32, 0);
  end();
  color3ub(0, 255, 0);
  quad(40, 0, 20, 20);
  begin(GL_TRIANGLES);
  vertex2i(40, 40);
  vertex2i(60, 40);
  vertex2i(40, 60);
  end();
  pushMatrix();
  translatef(64, 32, 0);
  scalef(2, 2, 1);
  color3ub(255, 255, 0);
  quad(0, 0, 10, 10);
  popMatrix();
  pushAttrib(GL_ALL_ATTRIB_BITS);
  enable(GL_SCISSOR_TEST);
  scissor(0, 64, 8, 8);
  color3ub(255, 0, 255);
  quad(0, 56, 20, 20);
  popAttrib();
  enable(GL_TEXTURE_2D);
  bindTexture(GL_TEXTURE_2D, texture);
  texEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_REPLACE);
  enable(GL_BLEND);
  blendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  color3ub(255, 0, 0);
  texCoord2f(.5, .5);
  quad(90, 0, 20, 20);
  disable(GL_TEXTURE_2D);
  disable(GL_BLEND);
  color3ub(0, 255, 255);
  begin(GL_LINE_LOOP);
  vertex2i(90, 50);
  vertex2i(110, 50);
  vertex2i(110, 70);
  vertex2i(90, 70);
  end();
  begin(GL_LINE_STRIP);
  vertex2i(90, 80);
  vertex2i(110, 80);
  end();
  finish();
  // Skip reads during actual context loss. Restoration recreates the texture
  // and pipeline, then these same assertions must pass again.
  if (emscripten_is_webgl_context_lost(emscripten_webgl_get_current_context()))
    return;
  sample(0, 16, 202, 51, 53, 4);
  sample(31, 16, 78, 76, 202, 4);
  sample(45, 10, 0, 255, 0);
  sample(44, 44, 0, 255, 0);
  sample(100, 75, 0, 0, 0);
  sample(70, 40, 255, 255, 0);
  sample(2, 60, 255, 0, 255);
  sample(10, 60, 0, 0, 0);
  sample(100, 10, 50, 100, 25);
  EM_ASM(
      { Module.rendererProbeFrames = (Module.rendererProbeFrames || 0) + 1; });
}
int main() {
  EmscriptenWebGLContextAttributes attrs;
  emscripten_webgl_init_context_attributes(&attrs);
  attrs.majorVersion = 1;
  attrs.antialias = 0;
  attrs.alpha = 0;
  attrs.depth = 0;
  EMSCRIPTEN_WEBGL_CONTEXT_HANDLE context =
      emscripten_webgl_create_context("#canvas", &attrs);
  assert(context > 0);
  emscripten_webgl_make_context_current(context);
  emscripten_set_canvas_element_size("#canvas", 128, 128);
  glViewport(0, 0, 128, 128);
  GLint textureLimit;
  getIntegerv(GL_MAX_TEXTURE_SIZE, &textureLimit);
  assert(textureLimit > 0);
  genTextures(1, &texture);
  bindTexture(GL_TEXTURE_2D, texture);
  pixelStorei(GL_UNPACK_ALIGNMENT, 1);
  texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
  texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
  texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
  texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
  const unsigned char pixel[] = {100, 200, 50, 128};
  texImage2D(GL_TEXTURE_2D, 0, GL_RGBA, 1, 1, 0, GL_RGBA, GL_UNSIGNED_BYTE,
             pixel);
  emscripten_set_main_loop(render, 0, 1);
}
