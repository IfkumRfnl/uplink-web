"""Compile the real browser UI texture helper and require crisp sampling."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = next(root.glob('uplink-source-code-*/uplink/src/app/opengl_interface.cpp')).read_text()
start = source.index('static void BindBrowserUITexture()')
helper = source[start:source.index('#endif', start)]
test = r"""
#include <cassert>
#include <map>
typedef unsigned int GLuint;
enum {GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE,
      GL_TEXTURE_MIN_FILTER, GL_TEXTURE_MAG_FILTER, GL_NEAREST, GL_LINEAR};
namespace UplinkDraw {
static int generations = 0;
static GLuint binding = 0;
static std::map<int,int> parameters;
void genTextures(int n, GLuint* texture) {assert(n == 1); *texture = ++generations;}
void bindTexture(int target, GLuint texture) {assert(target == GL_TEXTURE_2D); binding = texture;}
void texParameteri(int target, int name, int value) {assert(target == GL_TEXTURE_2D); parameters[name] = value;}
}
""" + helper + r"""
int main() {
    BindBrowserUITexture();
    GLuint texture = UplinkDraw::binding;
    assert(texture != 0 && UplinkDraw::generations == 1);
    assert(UplinkDraw::parameters[GL_TEXTURE_MIN_FILTER] == GL_NEAREST);
    assert(UplinkDraw::parameters[GL_TEXTURE_MAG_FILTER] == GL_NEAREST);
    assert(UplinkDraw::parameters[GL_TEXTURE_WRAP_S] == GL_CLAMP_TO_EDGE);
    assert(UplinkDraw::parameters[GL_TEXTURE_WRAP_T] == GL_CLAMP_TO_EDGE);
    UplinkDraw::binding = 0;
    UplinkDraw::parameters.clear();
    BindBrowserUITexture();
    assert(UplinkDraw::binding == texture && UplinkDraw::generations == 1);
    assert(UplinkDraw::parameters[GL_TEXTURE_MIN_FILTER] == GL_NEAREST);
    assert(UplinkDraw::parameters[GL_TEXTURE_MAG_FILTER] == GL_NEAREST);
}
"""
with tempfile.TemporaryDirectory(prefix='uplink-ui-texture-') as directory:
    source = Path(directory) / 'test.cpp'
    binary = Path(directory) / 'test'
    source.write_text(test)
    subprocess.run(['g++', '-std=c++98', '-Wall', '-Wextra', '-pedantic',
                    str(source), '-o', str(binary)], check=True)
    subprocess.run([str(binary)], check=True)
print('PASS: actual browser UI helper uses nearest/clamp sampling and reuses its texture')
