// QA-only: deterministic placement for the original randomized map labels.
// This translation unit is not linked by npm run build or Pages packaging.
#include <emscripten.h>
#include "game/game.h"
#include "interface/interface.h"
#include "interface/localinterface/localinterface.h"
#include "interface/localinterface/hud_interface.h"
#include "interface/localinterface/worldmap/worldmap_layout.h"
extern "C" EMSCRIPTEN_KEEPALIVE void qaFreezeMapLabels() {
  WorldMapLayout *layout = game->GetInterface()->GetLocalInterface()->GetHUD()->wmi.layout;
  if (!layout) return;
  LList<WorldMapInterfaceLabel *> &labels = layout->GetLabels();
  for (int i = 0; i < labels.Size(); ++i) labels.GetData(i)->SetLabelPosition((i*3)%8);
  layout->layoutComplete = true;
}

// Read-only animation observations and repeatable movement through the real
// Eclipse implementation. Only present in the isolated QA bundle.
extern "C" EMSCRIPTEN_KEEPALIVE int qaPerformanceButton(int id) {
  const char *names[] = {"worldmap_smallmap", "worldmap_close", "hud_memory", "memory_title", "hud_mainmenu"};
  if (id < 0 || id >= 5) return 0;
  Button *button = EclGetButton((char *)names[id]);
  if (!button) return 0;
  button->MouseUp();
  return 1;
}
extern "C" EMSCRIPTEN_KEEPALIVE void qaPerformanceAnimation() {
  EclRemoveButton((char *)"qa_movement");
  EclRegisterButton(100, 100, 30, 20, (char *)"QA", (char *)"qa_movement");
  EclRegisterMovement((char *)"qa_movement", 500, 100, 2000);
}
extern "C" EMSCRIPTEN_KEEPALIVE int qaPerformanceAnimationX() {
  Button *button = EclGetButton((char *)"qa_movement");
  return button ? button->x : -1;
}
extern "C" EMSCRIPTEN_KEEPALIVE double qaPerformanceTime() {
  return EclGetAccurateTime();
}
