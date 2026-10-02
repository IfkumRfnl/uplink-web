// QA-only: deterministic placement for the original randomized map labels.
// This translation unit is not linked by npm run build or Pages packaging.
#include <emscripten.h>
#include "game/game.h"
#include "app/app.h"
#include "app/opengl.h"
#include "options/options.h"
#include "gucci.h"
#include "uplink_draw.h"
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

// Read-only QA state for actual DOM pointer interaction at any UI density.
extern "C" EMSCRIPTEN_KEEPALIVE void qaUiSnapshot() {
  EM_ASM({ Module.qaUi = ({width:$0,height:$1,scale:$2,mouse:[$3,$4],textWidth:$5,buttons:{}}); },
    app->GetOptions()->GetOptionValue("graphics_screenwidth"),
    app->GetOptions()->GetOptionValue("graphics_screenheight"),
    UplinkDraw::uiScale(), get_mouseX(), get_mouseY(),
    GciTextWidth((char *)"abcdefghijklmnopqrstuvwxyz", HELVETICA_12));
}
extern "C" EMSCRIPTEN_KEEPALIVE void qaUiButton() {
  char name[512];
  EM_ASM({ stringToUTF8(Module.qaButtonName, $0, 512); }, name);
  Button *button = EclGetButton(name);
  EM_ASM({ Module.qaButton = null; });
  if (button)
    EM_ASM({ Module.qaButton = ({x:$0,y:$1,w:$2,h:$3,caption:UTF8ToString($4)}); },
      button->x, button->y, button->width, button->height, button->caption);
}
