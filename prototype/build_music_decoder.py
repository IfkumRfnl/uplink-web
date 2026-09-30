#!/usr/bin/env python3
"""Compile the installation's bundled MikMod decoder locally. No downloads."""
import argparse,pathlib,subprocess
p=argparse.ArgumentParser();p.add_argument('mikmod_source',type=pathlib.Path);p.add_argument('--output',type=pathlib.Path,default=pathlib.Path(__file__).parent/'music-build');a=p.parse_args();s=a.mikmod_source;b=a.output;b.mkdir(parents=True,exist_ok=True)
h=(s/'include/mikmod.h.in').read_text()
for k,v in {'@LIBMIKMOD_MAJOR_VERSION@':'3','@LIBMIKMOD_MINOR_VERSION@':'2','@LIBMIKMOD_MICRO_VERSION@':'0','@DOES_NOT_HAVE_SIGNED@':''}.items():h=h.replace(k,v)
(b/'mikmod.h').write_text(h);(b/'mikmod_build.h').write_text('#include "mikmod.h"\n')
(b/'config.h').write_text('\n'.join('#define '+x+' 1' for x in ['HAVE_UNISTD_H','HAVE_MEMORY_H','HAVE_MALLOC_H','HAVE_STRDUP','HAVE_STRSTR','HAVE_STRCASECMP','HAVE_SNPRINTF','HAVE_SETENV','HAVE_SRANDOM','STDC_HEADERS','HAVE_FCNTL_H'])+'\n')
sources=[str(f) for sub in ['playercode','mmio','loaders'] for f in (s/sub).glob('*.c')]+[str(s/'drivers'/n) for n in ['drv_nos.c','drv_raw.c','drv_wav.c','drv_stdout.c']]
subprocess.run(['gcc','-w','-shared','-fPIC','-O2','-D__arch64__','-DHAVE_CONFIG_H','-I'+str(b),'-I'+str(s/'include'),*sources,'-lm','-o',str(b/'libmikmod.so')],check=True)
print(b/'libmikmod.so')
