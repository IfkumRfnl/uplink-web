"""Compile the actual font API in both modes; check density, drawing and metrics."""
from pathlib import Path
import os
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = next(root.glob('uplink-source-code-*/lib/gucci/gucci.cpp')).read_text()
body = source[source.index('void GciDrawText ( int x, int y, char *text, int STYLE )'):
              source.index('void GciDeleteTrueTypeFont ( int index )')]
header = r'''
#include <cassert>
#include <cmath>
#include <cstdio>
#include <map>
using namespace std;
#define USE_FTGL
typedef int GLint;
enum {GL_TEXTURE_BINDING_2D, GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_TEXTURE_2D, GL_MODULATE};
float scale=1, drawnX=0, drawnY=0, inverseX=0, inverseY=0;
int nativeX=0, nativeY=0;
namespace UplinkDraw {
float uiScale(){return scale;}
void getIntegerv(int,int* p){*p=0;}
void getTexEnviv(int,int,int* p){*p=0;}
int isEnabled(int){return 0;}
void enable(int){} void disable(int){} void texEnvi(int,int,int){}
void pushMatrix(){} void popMatrix(){} void bindTexture(int,int){}
void translatef(float x,float y,float){drawnX=x;drawnY=y;}
void scalef(float x,float y,float){inverseX=x;inverseY=y;}
}
void glRasterPos2i(int x,int y){nativeX=x;nativeY=y;}
struct FTFace {};
FTFace face;
FTFace* RegisterFace(char*,char*){return &face;}
struct FTGLBitmapFont {
 unsigned point,dpi;
 FTGLBitmapFont(char*):point(0),dpi(0){}
 int Error(){return 0;}
 bool FaceSize(unsigned p,unsigned d){point=p;dpi=d;return true;}
 void Render(char*){}
 void BBox(char*,float& lx,float& ly,float& lz,float& ux,float& uy,float& uz){
   lx=ly=lz=uy=uz=0;ux=30*scale;
 }
};
map<int,FTGLBitmapFont*> fonts;
bool gci_truetypeenabled=true;
void GciDeleteTrueTypeFont(int i){delete fonts[i];fonts[i]=0;}
void GciFallbackDrawText(int,int,char*,int){assert(false);}
int GciFallbackTextWidth(char*,int){return 77;}
'''
test = r'''
int main(){
 for(int i=0;i<4;++i){
   const float sizes[]={1,1.25,1.5,2}; scale=sizes[i];
   assert(GciLoadTrueTypeFont(1,(char*)"font",(char*)"file",11));
   assert(fonts[1]->point==8); // Original point-size rounding, including 100%.
#ifdef __EMSCRIPTEN__
   assert(fonts[1]->dpi==unsigned(96*scale+.5));
   assert(GciTextWidth((char*)"sample",1)==30);
#else
   assert(fonts[1]->dpi==96);
   assert(GciTextWidth((char*)"sample",1)==int(30*scale+.5));
#endif
   GciDrawText(20,40,(char*)"sample",1);
#ifdef __EMSCRIPTEN__
   assert(drawnX==20 && drawnY==40);
   assert(fabs(inverseX*scale-1)<.00001 && fabs(inverseY*scale+1)<.00001);
#else
   assert(nativeX==20 && nativeY==40);
#endif
 }
 assert(GciTextWidth((char*)"missing",2)==77);
 GciDeleteTrueTypeFont(1);
}
'''
with tempfile.TemporaryDirectory(prefix='uplink-ui-scale-') as directory:
    work = Path(directory)
    (work / 'test.cpp').write_text(header + body + test)
    for mode, flags in [('native', []), ('browser', ['-D__EMSCRIPTEN__'])]:
        subprocess.run([os.environ.get('CXX', 'g++'), '-std=c++98', *flags,
                        str(work / 'test.cpp'), '-o', str(work / 'test')], check=True)
        subprocess.run([str(work / 'test')], check=True)
        print(mode + ': font density, logical metrics and drawing PASS')
