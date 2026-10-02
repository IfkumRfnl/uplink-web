#!/usr/bin/env python3
"""Compile actual game-loop source against lightweight SDL/scheduler test doubles."""
from pathlib import Path
import os, re, subprocess, sys, tempfile
root = Path(__file__).resolve().parents[2]
source_root = Path(sys.argv[1]) if len(sys.argv) > 1 else next(root.glob('uplink-source-code-*'))
src=(source_root / 'lib/gucci/gucci_sdl.cpp').read_text()
body=src[src.index('class Callback {'):src.index('void GciRestoreScreenSize()')]
coordinate=src[src.index('static int GciLogicalCoordinate('):src.index('static bool gciRedisplay')]
keys=sorted(set(re.findall(r'\b(?:SDLK|SDL|KMOD)_[A-Z0-9][A-Z0-9_]*\b', body)))
header='''#include <list>
#include <vector>
#include <cassert>
using namespace std;
typedef unsigned short Uint16;
typedef void GciCallbackT(int);
unsigned ticks=100;
unsigned SDL_GetTicks(){ return ticks; }
bool finished=false, displayDamaged=false;
struct SDL_Event { int type; struct { struct {int unicode,mod,sym;} keysym; } key; struct {int x,y;} motion; struct {int button,type,x,y;} button; };
vector<SDL_Event> events; unsigned nextEvent=0;
int SDL_PollEvent(SDL_Event* e){ if(nextEvent==events.size()) return 0; *e=events[nextEvent++]; return 1; }
void SDL_GetMouseState(int*x,int*y){*x=12;*y=13;}
int sdlKeyToGucci(int x){ return x; }
int sdlButtonToGucci(int x){return x;}
int sdlMouseEventToGucci(int x){return x;}
vector<int> trace;
float testScale=1;
namespace UplinkDraw { float uiScale(){return testScale;} }
vector<int> coordinates;
void display(){trace.push_back(1);}
void keyboard(unsigned char,int x,int y){trace.push_back(2);coordinates.push_back(x);coordinates.push_back(y);}
void special(int,int x,int y){trace.push_back(3);coordinates.push_back(x);coordinates.push_back(y);}
void motion(int x,int y){trace.push_back(4);coordinates.push_back(x);coordinates.push_back(y);}
void passive(int x,int y){trace.push_back(5);coordinates.push_back(x);coordinates.push_back(y);}
void mouse(int,int,int x,int y){trace.push_back(6);coordinates.push_back(x);coordinates.push_back(y);}
void idle(){trace.push_back(8);}
void timer(int v){trace.push_back(v);}
void (*gciDisplayHandlerP)()=display;
void (*gciIdleHandlerP)()=idle;
void (*gciKeyboardHandlerP)(unsigned char,int,int)=keyboard;
void (*gciSpecialHandlerP)(int,int,int)=special;
void (*gciMotionHandlerP)(int,int)=motion;
void (*gciPassiveMotionHandlerP)(int,int)=passive;
void (*gciMouseHandlerP)(int,int,int,int)=mouse;
void (*scheduled)()=0; int cancelled=0;
void emscripten_set_main_loop(void(*f)(),int fps,int infinite){assert(fps==0 && infinite==1); scheduled=f;}
void emscripten_cancel_main_loop(){++cancelled;}
'''
header+='enum {'+','.join(f'{k}={i+1}' for i,k in enumerate(keys))+'};\n'
test='''
int main(){
#ifdef __EMSCRIPTEN__
  testScale=1.5;
  assert(GciLogicalCoordinate(15)==10);
  assert(GciLogicalCoordinate(16)==10);
#else
  assert(GciLogicalCoordinate(16)==16);
#endif
#ifdef __EMSCRIPTEN__
  GciMainLoop(); assert(scheduled==GciMainLoopIteration); assert(trace.empty());
#endif
  SDL_Event e={}; e.type=SDL_KEYDOWN;e.key.keysym.unicode=65;events.push_back(e);
  e.type=SDL_MOUSEMOTION;e.motion.x=300;e.motion.y=450;events.push_back(e);
  e.type=SDL_MOUSEBUTTONDOWN;e.button.x=301;e.button.y=451;events.push_back(e);
  GciTimerFunc(0,timer,7);++ticks;GciMainLoopIteration();
  assert((trace==vector<int>{1,2,4,5,6,7,8}));assert(timerEvents.empty());
#ifdef __EMSCRIPTEN__
  assert((coordinates==vector<int>{8,8,200,300,200,300,200,300}));
#else
  assert((coordinates==vector<int>{12,13,300,450,300,450,301,451}));
#endif
  // Timers are not invoked at the exact expiry time (original strict > behavior).
  trace.clear();events.clear();nextEvent=0;
  GciTimerFunc(10,timer,9);ticks+=10;GciMainLoopIteration();
  assert((trace==vector<int>{1,8}));assert(timerEvents.size()==1);
  trace.clear();++ticks;GciMainLoopIteration();
  assert((trace==vector<int>{1,9,8}));assert(timerEvents.empty());
  trace.clear();e.type=SDL_KEYDOWN;e.key.keysym.unicode=0;events.push_back(e);
  e.type=SDL_VIDEOEXPOSE;events.push_back(e);GciMainLoopIteration();
  assert((trace==vector<int>{1,3,8}));assert(displayDamaged);
  // A suspended/background frame fires each overdue one-shot timer only once.
  trace.clear();events.clear();nextEvent=0;
  GciTimerFunc(10,timer,11);GciTimerFunc(20,timer,12);ticks+=600000;
  GciMainLoopIteration();assert((trace==vector<int>{1,11,12,8}));assert(timerEvents.empty());
  trace.clear();GciMainLoopIteration();assert((trace==vector<int>{1,8}));
  // A due timer remains queued if quit is processed first.
  GciTimerFunc(0,timer,10);++ticks;
  trace.clear();events.clear();nextEvent=0;e.type=SDL_QUIT;events.push_back(e);
  GciMainLoopIteration();assert(finished);assert((trace==vector<int>{1}));assert(timerEvents.size()==1);
#ifdef __EMSCRIPTEN__
  assert(cancelled==1);trace.clear();GciMainLoopIteration();assert(cancelled==2);assert(trace.empty());
#else
  trace.clear();nextEvent=0;GciMainLoop();assert(finished);assert((trace==vector<int>{1}));
#endif
}
'''
with tempfile.TemporaryDirectory(prefix='uplink-loop-test-') as temporary:
 source = Path(temporary) / 'test.cpp'
 binary = Path(temporary) / 'test'
 source.write_text(header+coordinate+body+test)
 for mode,flags in [('native',[]),('browser',['-D__EMSCRIPTEN__'])]:
  subprocess.run([os.environ.get('CXX','g++'),'-std=c++11',*flags,str(source),'-o',str(binary)],check=True)
  subprocess.run([str(binary)],check=True)
  print(mode+': callback order, timers, quit and scheduler checks PASS')
