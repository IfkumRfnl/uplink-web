#!/usr/bin/env python3
"""Test the actual completed-onboarding options transition in both builds."""
from pathlib import Path
import subprocess,tempfile
root=Path(__file__).resolve().parents[2]
s=next(root.glob('uplink-source-code-*/uplink/src/game/scriptlibrary.cpp')).read_text()
body=s.split('// Put this line in to disable "first time" after one game',1)[1].split('void ScriptLibrary::Script43',1)[0]
program='''#include <cassert>
#include <cstddef>
int saved=0,value=1,screen=0;
struct Options {void SetOptionValue(const char*,int v){value=v;}void Save(void*){assert(value==0);++saved;}};
struct App {Options options;Options* GetOptions(){return &options;}} appObj,*app=&appObj;
struct Remote {void RunScreen(int v){screen=v;}};
struct Interface {Remote remote;Remote* GetRemoteInterface(){return &remote;}};
struct Game {Interface interface;Interface* GetInterface(){return &interface;}} gameObj,*game=&gameObj;
void completeOnboarding(){'''+body+'''
int main(){completeOnboarding();assert(value==0&&screen==6);
#ifdef __EMSCRIPTEN__
assert(saved==1);
#else
assert(saved==0);
#endif
}
'''
with tempfile.TemporaryDirectory() as t:
 p=Path(t)/'test.cpp';p.write_text(program)
 for flags in [[],['-D__EMSCRIPTEN__']]:
  subprocess.run(['g++',*flags,str(p),'-o',t+'/test'],check=True);subprocess.run([t+'/test'],check=True)
print('PASS: completed onboarding serializes original options in browser; native transition unchanged')
