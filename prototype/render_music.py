#!/usr/bin/env python3
"""Render original UN05 music using bundled MikMod, with no network dependencies.
Usage: python render_music.py <libmikmod.so> <input.uni> <output.wav> [--seconds 60]
Omit --seconds to render until the module ends (hard safety ceiling 30 minutes).
"""
import argparse,ctypes,pathlib,wave
p=argparse.ArgumentParser(description=__doc__);p.add_argument('library');p.add_argument('source');p.add_argument('output');p.add_argument('--seconds',type=float,default=1800);a=p.parse_args()
m=ctypes.CDLL(str(pathlib.Path(a.library).resolve()))
m.MikMod_RegisterDriver.argtypes=[ctypes.c_void_p];m.MikMod_RegisterDriver(ctypes.addressof(ctypes.c_char.in_dll(m,'drv_nos')))
m.MikMod_RegisterAllLoaders()
ctypes.c_ushort.in_dll(m,'md_mode').value=0x0001|0x0002|0x0008|0x0200
ctypes.c_ushort.in_dll(m,'md_mixfreq').value=44100
m.MikMod_Init.argtypes=[ctypes.c_char_p]
m.MikMod_strerror.restype=ctypes.c_char_p
if m.MikMod_Init(b''):raise RuntimeError(m.MikMod_strerror(ctypes.c_int.in_dll(m,'MikMod_errno').value))
m.Player_Load.argtypes=[ctypes.c_char_p,ctypes.c_int,ctypes.c_int];m.Player_Load.restype=ctypes.c_void_p
mod=m.Player_Load(str(pathlib.Path(a.source).resolve()).encode(),64,0)
if not mod:raise RuntimeError(m.MikMod_strerror(ctypes.c_int.in_dll(m,'MikMod_errno').value))
m.Player_Start.argtypes=[ctypes.c_void_p];m.Player_Start(mod)
m.VC_WriteBytes.argtypes=[ctypes.c_void_p,ctypes.c_uint];m.VC_WriteBytes.restype=ctypes.c_uint
buf=ctypes.create_string_buffer(16384);total=0;limit=int(a.seconds*44100)*4
with wave.open(a.output,'wb') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(44100)
 while m.Player_Active() and total<limit:
  n=m.VC_WriteBytes(buf,min(len(buf),limit-total));w.writeframesraw(buf.raw[:n]);total+=n
m.Player_Stop();m.Player_Free.argtypes=[ctypes.c_void_p];m.Player_Free(mod);m.MikMod_Exit()
print(f'Rendered {total/176400:.2f}s of original module into {a.output}')
