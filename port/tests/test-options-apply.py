#!/usr/bin/env python3
"""Compile the real browser Apply callback: serialize changed options for reload."""
from pathlib import Path
import subprocess
import tempfile
root=Path(__file__).resolve().parents[2]
src=next(root.glob('uplink-source-code-*/uplink/src/mainmenu/genericoptions_interface.cpp')).read_text()
body=src.split('void GenericOptionsInterface::ApplyClick',1)[1].split('void GenericOptionsInterface::ToggleBoxDraw',1)[0]
header=r'''
#include <cassert>
#include <cstdio>
#include <cstring>
#define UplinkAssert assert
#define UplinkSnprintf snprintf
struct Button { char *caption; };
struct Option { int value; } option={1};
static int saves=0;
struct Options { Option* GetOption(const char*) {return &option;} void Save(void*) {assert(option.value==0);++saves;} } options;
struct GenericOptionsInterface { static void ApplyClick(Button*); void ChangeOptionValue(const char*,int v) {option.value=v;} } screen;
struct MainMenu { void* GetMenuScreen(){return &screen;} } menu;
struct App { MainMenu* GetMainMenu(){return &menu;} Options* GetOptions(){return &options;} } application, *app=&application;
Button* EclGetButton(const char*name){static char n[]="musicenabled",v[]="0";static Button namebutton={n},valuebutton={v};
if (!strcmp(name,"generic_option 0"))return &namebutton;if(!strcmp(name,"generic_value 0"))return &valuebutton;return 0;}
'''.replace('static void ApplyClick(Button*);','static void ApplyClick(Button*); const char *optionTYPE="sound";')
footer=r'''
int main(){GenericOptionsInterface::ApplyClick(0);assert(option.value==0);
#ifdef __EMSCRIPTEN__
assert(saves==1);
#else
assert(saves==0);
#endif
}
'''
with tempfile.TemporaryDirectory() as tmp:
    source=Path(tmp)/'apply.cpp';source.write_text(header+'void GenericOptionsInterface::ApplyClick'+body+footer)
    for mode in ['native','browser']:
        binary=Path(tmp)/mode
        subprocess.run(['g++','-std=c++11',*(['-D__EMSCRIPTEN__'] if mode=='browser' else []),str(source),'-o',str(binary)],check=True)
        subprocess.run([str(binary)],check=True)
        print(mode+': actual Apply callback updates option; browser serializes it PASS')
