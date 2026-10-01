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
