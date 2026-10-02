#!/usr/bin/env python3
"""Exercise Game's actual constructor, new/load/save and update with a fake clock."""
from pathlib import Path
import os
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = next(root.glob('uplink-source-code-*')) / 'uplink/src/game'
cpp = (source / 'game.cpp').read_text()


def method(signature):
    start = cpp.index(signature)
    brace = cpp.index('{', start)
    depth = 1
    end = brace + 1
    while depth:
        depth += (cpp[end] == '{') - (cpp[end] == '}')
        end += 1
    return cpp[start:end] + '\n'


# Use the real member layout; replace only the serialization base with doubles.
header = (source / 'game.h').read_text().replace('#include "app/uplinkobject.h"', '')
doubles = r'''
#include <cassert>
#include <cstdio>
#include <cstring>
#include <new>
#include <ctime>
static time_t now = 1700000000;
time_t testTime(time_t *out) { if (out) *out = now; return now; }
#define time testTime
#define UplinkAssert assert
#define UplinkSafeStrcpy strcpy
const char SAVEFILE_VERSION[] = "SAV62";
struct UplinkObject {
  void LoadID(FILE *) {} void LoadID_END(FILE *) {}
  void SaveID(FILE *) {} void SaveID_END(FILE *) {}
};
struct ModuleDouble {
  int updates = 0;
  void Update() { ++updates; }
  bool Load(FILE *) { return true; } void Save(FILE *) {}
};
struct Interface : ModuleDouble { void Create() {} };
struct View : ModuleDouble { void Initialise() {} };
struct Date {
  void SetDate(int) {} void AdvanceDay(int) {} void AdvanceHour(int) {}
  void AdvanceMinute(int) {} bool Before(Date *) { return false; }
};
const int GAME_START_DATE = 0;
struct Player { char handle[16] = "AutosaveQA"; };
struct Plot { void Initialise() {} };
struct World : ModuleDouble {
  Player player; Date date; Plot plotgenerator, demoplotgenerator;
  Player *GetPlayer() { return &player; }
};
struct GameObituary : ModuleDouble {};
struct NumberGenerator { static int RandomNumber(int) { return 0; } };
struct WorldGenerator {
  static void LoadDynamicsGatewayDefs() {} static void GenerateAll() {}
  static void GenerateSimpleStartingMissionA() {}
  static void GenerateSimpleStartingMissionB() {}
};
struct NotificationEvent { static void ScheduleStartingEvents() {} };
void *RsArchiveFileOpen(const char *) { return NULL; }
void SgPlaySound(void *, const char *, bool) {}
struct Option { int value = 0; };
struct Options { Option option; Option *GetOption(const char *) { return &option; } };
struct App {
  int saves = 0; Options options;
  Options *GetOptions() { return &options; }
  void SaveGame(const char *handle) { assert(!strcmp(handle, "AutosaveQA")); ++saves; }
} appObject, *app = &appObject;
bool FileReadData(void *data, size_t size, size_t count, FILE *file) {
  return fread(data, size, count, file) == count;
}
void SaveDynamicString(const char *s, FILE *file) {
  size_t size = s ? strlen(s) + 1 : 0;
  fwrite(&size, sizeof(size), 1, file);
  if (size) fwrite(s, size, 1, file);
}
bool LoadDynamicStringPtr(char **s, FILE *file) {
  size_t size;
  if (!FileReadData(&size, sizeof(size), 1, file)) return false;
  delete[] *s; *s = size ? new char[size] : NULL;
  return !size || FileReadData(*s, size, 1, file);
}
'''
methods = ''.join(method(signature) for signature in [
    'Game::Game ()', 'Game::~Game ()', 'void Game::NewGame ()',
    'void Game::SetGameSpeed (', 'bool Game::IsRunning ()',
    'Interface *Game::GetInterface ()', 'View *Game::GetView ()',
    'World *Game::GetWorld ()', 'bool Game::Load (', 'void Game::Save (',
    'void Game::Update ()', 'const char *Game::GetLoadedSavefileVer ()',
])
test = r'''
Game *game;
struct Probe : Game { time_t LastSave() const { return lastsave; } };
void tick(Probe &g) { if (g.IsRunning()) g.Update(); } // App::Update's guard
int main() {
  // Nonzero placement storage makes omission of initialization deterministic.
  alignas(Probe) unsigned char storage[sizeof(Probe)];
  memset(storage, 0xa5, sizeof(storage));
  Probe &g = *new (storage) Probe;
  game = &g;
  const time_t start = now;
  assert(g.LastSave() == start && !g.IsRunning());
  g.NewGame(); tick(g);
  assert(app->saves == 0);
  now = start + 60; tick(g); assert(app->saves == 0);
  now = start + 61; tick(g);
  assert(app->saves == 1 && g.LastSave() == now);
  tick(g); assert(app->saves == 1);
  now += 60; tick(g); assert(app->saves == 1);
  ++now; tick(g); assert(app->saves == 2 && g.LastSave() == now);

  // Successful load and new-game reuse retain this process-local schedule.
  FILE *saved = tmpfile(); assert(saved);
  g.Save(saved); rewind(saved);
  assert(fseek(saved, sizeof(SAVEFILE_VERSION), SEEK_SET) == 0);
  const time_t previousSave = g.LastSave();
  now += 10; assert(g.Load(saved));
  assert(g.LastSave() == previousSave); tick(g); assert(app->saves == 2);
  g.NewGame(); assert(g.LastSave() == previousSave);
  tick(g); assert(app->saves == 2);
  fclose(saved);

  // Pause/game-over prevent App from updating. Resuming after a long gap
  // makes one save, with no replay of missed minutes on subsequent frames.
  g.SetGameSpeed(GAMESPEED_PAUSED); now += 600;
  tick(g); assert(app->saves == 2 && g.LastSave() == previousSave);
  g.SetGameSpeed(GAMESPEED_GAMEOVER); tick(g); assert(app->saves == 2);
  g.SetGameSpeed(GAMESPEED_NORMAL); tick(g);
  assert(app->saves == 3 && g.LastSave() == now);
  tick(g); assert(app->saves == 3);

  // A failed load is replaced by a fresh Game in App::LoadGame.
  FILE *empty = tmpfile(); assert(empty);
  assert(!g.Load(empty)); fclose(empty); g.~Probe();
  now += 100; memset(storage, 0x5a, sizeof(storage));
  Probe &replacement = *new (storage) Probe; game = &replacement;
  assert(replacement.LastSave() == now && !replacement.IsRunning());

  // Menu/onboarding time counts toward the existing wall-clock minute.
  const time_t constructed = now;
  now += 120; tick(replacement); assert(app->saves == 3);
  replacement.NewGame(); assert(replacement.LastSave() == constructed);
  tick(replacement); assert(app->saves == 4 && replacement.LastSave() == now);
  tick(replacement); assert(app->saves == 4);
  replacement.~Probe();
}
'''
with tempfile.TemporaryDirectory(prefix='uplink-autosave-test-') as temporary:
    program, binary = Path(temporary) / 'test.cpp', Path(temporary) / 'test'
    program.write_text(doubles + header + 'extern Game *game;\n' + methods + test)
    for mode, flags in [('native', []), ('browser', ['-D__EMSCRIPTEN__'])]:
        subprocess.run([os.environ.get('CXX', 'g++'), '-std=c++11', *flags,
                        str(program), '-o', str(binary)], check=True)
        subprocess.run([str(binary)], check=True)
        print(mode + ': initialized autosave clock, minute boundary, new/load reuse, pause/resume and replacement PASS')
