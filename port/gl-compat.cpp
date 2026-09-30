// Browser compatibility for the subset of legacy GL state used by Uplink.
#define GL_GLEXT_PROTOTYPES
#include <GL/gl.h>
#include <vector>
#include <emscripten.h>
#include <cstdio>
struct UplinkGLState {
 GLboolean blend, texture, scissor, depth, cull;
 GLint blendSrcRGB, blendDstRGB, blendSrcAlpha, blendDstAlpha, binding, scissorBox[4], matrixMode, textureEnv, activeTexture;
 GLfloat colour[4], lineWidth;
};
static std::vector<UplinkGLState> uplinkGLStates;
static void setEnable(GLenum cap, GLboolean value) { if(value) glEnable(cap); else glDisable(cap); }
extern "C" void glPushAttrib(GLbitfield) {
 UplinkGLState s;
 s.blend=glIsEnabled(GL_BLEND);
 glGetIntegerv(GL_ACTIVE_TEXTURE,&s.activeTexture);
 s.texture=EM_ASM_INT({ return GLImmediate.TexEnvJIT.getTexUnitType($0) === 0x0DE1 ? 1 : 0; }, s.activeTexture-GL_TEXTURE0);
 glGetTexEnviv(GL_TEXTURE_ENV,GL_TEXTURE_ENV_MODE,&s.textureEnv);
 s.scissor=glIsEnabled(GL_SCISSOR_TEST); s.depth=glIsEnabled(GL_DEPTH_TEST); s.cull=glIsEnabled(GL_CULL_FACE);
 glGetIntegerv(GL_BLEND_SRC_RGB,&s.blendSrcRGB); glGetIntegerv(GL_BLEND_DST_RGB,&s.blendDstRGB);
 glGetIntegerv(GL_BLEND_SRC_ALPHA,&s.blendSrcAlpha); glGetIntegerv(GL_BLEND_DST_ALPHA,&s.blendDstAlpha);
 glGetIntegerv(GL_TEXTURE_BINDING_2D,&s.binding); glGetIntegerv(GL_SCISSOR_BOX,s.scissorBox);
 glGetIntegerv(GL_MATRIX_MODE,&s.matrixMode); EM_ASM({ HEAPF32.set(GLImmediate.clientColor, $0 >> 2); }, s.colour); glGetFloatv(GL_LINE_WIDTH,&s.lineWidth);
 uplinkGLStates.push_back(s);
}
extern "C" void glPopAttrib(void) {
 if(uplinkGLStates.empty()) { std::fputs("Uplink GL attribute stack underflow\n",stderr); return; }
 UplinkGLState s=uplinkGLStates.back(); uplinkGLStates.pop_back();
 glActiveTexture(s.activeTexture); glTexEnvi(GL_TEXTURE_ENV,GL_TEXTURE_ENV_MODE,s.textureEnv);
 setEnable(GL_BLEND,s.blend); setEnable(GL_TEXTURE_2D,s.texture); setEnable(GL_SCISSOR_TEST,s.scissor); setEnable(GL_DEPTH_TEST,s.depth); setEnable(GL_CULL_FACE,s.cull);
 glBlendFuncSeparate(s.blendSrcRGB,s.blendDstRGB,s.blendSrcAlpha,s.blendDstAlpha); glBindTexture(GL_TEXTURE_2D,s.binding); glScissor(s.scissorBox[0],s.scissorBox[1],s.scissorBox[2],s.scissorBox[3]);
 glMatrixMode(s.matrixMode); glColor4fv(s.colour); glLineWidth(s.lineWidth);
}
extern "C" void glVertex2d(GLdouble x, GLdouble y) { glVertex2f((GLfloat)x,(GLfloat)y); }
extern "C" void glLineStipple(GLint,GLushort) {
 static bool warned=false;
 if(!warned) { std::fputs("Uplink browser prototype: legacy dashed lines currently render solid\n",stderr); warned=true; }
}
