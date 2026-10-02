#include "uplink_draw.h"
#include "image.h"
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <emscripten.h>
#include <emscripten/html5.h>
using namespace UplinkDraw;
static GLuint texture;
static Image *image;
static void sample(int x, int y, int r, int g, int b, int tolerance = 2);
static int uploads() { return EM_ASM_INT({ return Module.probeUploads; }); }
static void imageCacheProbe() {
  static bool tested = false;
  // The persistent mutated image must also survive both context restorations.
  if (!tested) {
    tested = true;
    image->Draw(0, 96);
    finish();
    sample(0, 96, 0, 0, 255);
    const int before = uploads();
    image->Draw(4, 96);
    image->DrawBlend(8, 96);
    finish();
    assert(uploads() == before);
    // Public in-place edits and an independent copy must have distinct pixels.
    image->pixels[8] = 255;
    image->pixels[9] = image->pixels[10] = 0;
    image->Draw(12, 96);
    finish();
    sample(12, 96, 255, 0, 0);
    assert(uploads() == before + 1);
    const int deleted = EM_ASM_INT({ return Module.probeDeletes; });
    {
      Image copy(*image);
      copy.pixels[8] = 0; copy.pixels[9] = 255;
      copy.Draw(16, 96);
      image->Draw(20, 96);
      finish();
      sample(16, 96, 0, 255, 0);
      sample(20, 96, 255, 0, 0);
    }
    assert(EM_ASM_INT({ return Module.probeDeletes; }) == deleted + 1);
    image->FlipAroundH();
    image->Scale(16, 16);
    image->SetAlpha(0.5);
    image->DrawBlend(24, 96);
    finish();
    sample(24, 96, 128, 0, 0, 3);
    image->SetAlpha(1);
    image->Draw(44, 96);
    finish();
    sample(44, 96, 255, 0, 0);
    image->CreateErrorBitmap();
    image->Draw(64, 96);
    finish();
    sample(64, 96, 255, 255, 255);
    // Reload replaces the old pixels and dimensions on the same texture handle.
    image->LoadTIF((char *)"/probe");
    image->SetAlphaBorder(0, 1, 0, 0);
    image->DrawBlend(8, 120);
    finish();
    sample(8, 121, 0, 0, 0);
  }
  const int before = uploads();
  image->Draw(0, 120);
  image->DrawBlend(4, 120);
  finish();
  sample(0, 120, 0, 0, 255);
  assert(uploads() <= before + 1);
}
static void quad(int x, int y, int w, int h) {
  begin(GL_QUADS);
  vertex2i(x, y);
  vertex2i(x, y + h);
  vertex2i(x + w, y + h);
  vertex2i(x + w, y);
  end();
}
static void sample(int x, int y, int r, int g, int b, int tolerance) {
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
  // Logical scissor edges are converted once, including fractional scales and
  // negative origins. Attribute restoration must never scale a box twice.
  setUIScale(1.5f);
  pushAttrib(GL_ALL_ATTRIB_BITS);
  enable(GL_SCISSOR_TEST);
  scissor(7, 40, 8, 8);
  color3ub(255, 255, 255);
  quad(0, 50, 40, 30);
  finish();
  sample(11, 60, 255, 255, 255);
  sample(22, 60, 255, 255, 255);
  sample(23, 60, 0, 0, 0);
  pushAttrib(GL_ALL_ATTRIB_BITS);
  scissor(-1, 40, 8, 8);
  popAttrib();
  GLint box[4];
  glGetIntegerv(GL_SCISSOR_BOX, box);
  assert(box[0] == 11 && box[1] == 60 && box[2] == 12 && box[3] == 12);
  popAttrib();
  setUIScale(1);
  imageCacheProbe();
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
  EM_ASM({
    Module.probeUploads = 0;
    Module.probeDeletes = 0;
    const upload = GLctx.texImage2D.bind(GLctx);
    GLctx.texImage2D = (...args) => { ++Module.probeUploads; return upload(...args); };
    const remove = GLctx.deleteTexture.bind(GLctx);
    GLctx.deleteTexture = (...args) => { ++Module.probeDeletes; return remove(...args); };
  });
  const unsigned char fixture[] = {2,0,0,0,2,0,0,0,
      255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,255,255};
  FILE *file = fopen("/probe.rgba", "wb");
  assert(file);
  fwrite(fixture, 1, sizeof(fixture), file);
  fclose(file);
  image = new Image;
  image->LoadTIF((char *)"/probe");
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
