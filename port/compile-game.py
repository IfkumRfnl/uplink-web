from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess, re, sys, os
root=Path(__file__).resolve().parent.parent
src=root/'uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404'
out=root/'port/game-objects'; out.mkdir(exist_ok=True)
text=(src/'uplink/src/Makefile').read_text()
block=text.split('SOURCES=',1)[1].split('DEMO_CPPFLAGS',1)[0]
files=[src/'uplink/src'/s for s in re.findall(r'[\w/]+\.cpp',block)]
for lib, units in {'eclipse':'animation button eclipse','vanbakel':'task taskwrapper interface vanbakel','redshirt':'redshirt hash','bungle':'bungle','mmgr':'mmgr','gucci':'gucci gucci_sdl image','soundgarden':'soundgarden soundgarden_sdlmixer sgplaylist'}.items():
 for unit in units.split():
  p=src/'lib'/lib/(unit+'.cpp')
  if p.exists(): files.append(p)
files += [src/'contrib/unrar/sha1.cpp']
files += [src/'contrib/irclib'/v for v in ['irc.cpp','socket.cpp','CrossThreadsMessagingDevice.cpp','linux/windows.cpp','linux/missing.cpp','linux/winsock.cpp']]
files += list((src/'contrib/tcp4u.331/src').glob('*.c'))
flags=['-std=gnu++98','-fms-extensions','-O1','-w','-DUSE_SDL','-DUSE_FTGL','-DFULLGAME=1','-D_REENTRANT','-sUSE_SDL=1','-sUSE_FREETYPE=1']
incs=[root/'port/include',src/'contrib',src/'uplink/src',root/'port/ftgl/include',root/'port/ftgl/include/ftgl',src/'contrib/tcp4u.331/Include',src/'contrib/irclib',src/'contrib/irclib/linux',src/'contrib/unrar']+[src/'lib'/v for v in ['eclipse','tosser','soundgarden','vanbakel','gucci','bungle','redshirt','mmgr']]
flags+=['-I'+str(v) for v in incs]
def compile(p):
 name=str(p.relative_to(src)).replace('/','__'); obj=out/(name+'.o'); log=out/(name+'.log')
 if os.environ.get('UPLINK_REBUILD') != '1' and obj.exists() and obj.stat().st_mtime>p.stat().st_mtime: return (p,True,'cached')
 unitflags=flags if p.suffix=='.cpp' else [v for v in flags if v not in ['-std=gnu++98','-fms-extensions']] + ['-std=gnu89','-DUNIX']
 compiler='em++' if p.suffix=='.cpp' else 'emcc'
 proc=subprocess.run([str(root/'toolchain/emsdk-main/upstream/emscripten'/compiler),*unitflags,'-c',str(p),'-o',str(obj)],capture_output=True,text=True)
 log.write_text(proc.stdout+proc.stderr)
 return (p,proc.returncode==0,proc.stderr)
results=list(ThreadPoolExecutor(max_workers=6).map(compile,files))
failed=[r for r in results if not r[1]]
summary='\n\n'.join(str(p.relative_to(src))+'\n'+err for p,ok,err in failed)
(out/'failures.log').write_text(summary)
print(f'{len(results)-len(failed)}/{len(results)} translation units compiled; {len(failed)} failed')
print(summary[:18000])
sys.exit(bool(failed))
