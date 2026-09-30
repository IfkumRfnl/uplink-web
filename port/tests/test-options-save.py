#!/usr/bin/env python3
"""Exercise the actual options save body with filesystem/encryption test doubles."""
from pathlib import Path
import os, subprocess, tempfile
root = Path(__file__).resolve().parents[2]
src = (next(root.glob('uplink-source-code-*')) / 'uplink/src/options/options.cpp').read_text()
body = src[src.index('void Options::Save ( FILE *file )'):src.index('void Options::Print ()')]
header = r'''
#include <cstdio>
#include <cstring>
#include <cassert>
#include <vector>
using namespace std;
vector<int> trace;
bool failOpen = false;
struct App { const char *userpath; } appObject = {"/test/"}, *app = &appObject;
struct UplinkObject {};
template<typename T> struct BTree {};
const char SAVEFILE_VERSION[] = "test";
struct Options { BTree<UplinkObject *> options; char themeName[16] = "graphics"; void Save(FILE *); };
void MakeDirectory(const char *) {}
#define UplinkSnprintf snprintf
FILE *testOpen(const char *, const char *) { trace.push_back(1); return failOpen ? NULL : tmpfile(); }
int testClose(FILE *f) { trace.push_back(2); return fclose(f); }
void RsEncryptFile(const char *) { trace.push_back(3); }
void SaveID(FILE *) {}
void SaveID_END(FILE *) {}
void SaveBTree(BTree<UplinkObject *> *, FILE *) {}
#define fopen testOpen
#define fclose testClose
#define EM_ASM(...) trace.push_back(4)
'''
test = r'''
int main() {
  Options o; o.Save(NULL);
#ifdef __EMSCRIPTEN__
  assert((trace == vector<int>{1, 2, 3, 4}));
#else
  assert((trace == vector<int>{1, 2, 3}));
#endif
  trace.clear(); failOpen = true; o.Save(NULL);
  assert((trace == vector<int>{1}));
}
'''
with tempfile.TemporaryDirectory(prefix='uplink-options-test-') as temporary:
    source, binary = Path(temporary)/'test.cpp', Path(temporary)/'test'
    source.write_text(header + body + test)
    for mode, flags in [('native', []), ('browser', ['-D__EMSCRIPTEN__'])]:
        subprocess.run([os.environ.get('CXX', 'g++'), '-std=c++11', *flags, str(source), '-o', str(binary)], check=True)
        subprocess.run([str(binary)], check=True)
        print(mode + ': options persistence after close/encryption; no flush on failed open PASS')
