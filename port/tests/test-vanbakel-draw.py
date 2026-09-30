#!/usr/bin/env python3
"""Exercise the actual task-label renderer's GL begin/end contract."""
from pathlib import Path
import subprocess
import tempfile
root = Path(__file__).resolve().parents[2]
source = next(root.glob('uplink-source-code-*/lib/vanbakel/interface.cpp')).read_text()
body = source.split('void Svb_textbutton_draw', 1)[1].split('void Svb_column_draw', 1)[0]
program = r'''
#include <cassert>
struct Button { int x, y, width, height; char *caption; };
const int GL_QUADS=7, HELVETICA_10=0;
static bool active=false; static int vertices=0, labels=0;
void glBegin(int mode) { assert(!active && mode==GL_QUADS); active=true; }
void glEnd() { assert(active && vertices==4); active=false; }
void glVertex2i(int,int) { assert(active); ++vertices; }
void glColor4f(float,float,float,float) {}
void GciDrawText(int,int,char*,int) { assert(!active); ++labels; }
void Svb_textbutton_draw''' + body + r'''
int main() { char text[]="Task"; Button button={5,6,50,20,text};
Svb_textbutton_draw(&button,false,false); assert(!active && vertices==4 && labels==1); }
'''
with tempfile.TemporaryDirectory() as tmp:
    src=Path(tmp)/'draw.cpp'; binary=Path(tmp)/'draw'; src.write_text(program)
    subprocess.run(['g++','-std=c++11',str(src),'-o',str(binary)],check=True)
    subprocess.run([str(binary)],check=True)
print('PASS: actual VanBakel task label emits four vertices inside begin/end, then text')
