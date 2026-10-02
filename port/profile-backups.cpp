// Browser shell bridge. Imports never parse a save into the live Game object.
#include <emscripten.h>
#include "app/app.h"
#include "game/game.h"
#include "mainmenu/mainmenu.h"

extern "C" {
EMSCRIPTEN_KEEPALIVE int uplinkProfilesCanImport()
{
    if (!app || app->Closed() || app->nextLoadGame || !game || game->IsRunning() ||
        !app->mainmenu || app->mainmenu->InScreen() != MAINMENU_LOGIN) return 0;
    return 1;
}

EMSCRIPTEN_KEEPALIVE int uplinkProfilesBeginImport()
{
    if (!uplinkProfilesCanImport()) return 0;
    emscripten_pause_main_loop();
    return 1;
}

EMSCRIPTEN_KEEPALIVE void uplinkProfilesEndImport(int committed)
{
    if (committed) app->mainmenu->RunScreen(MAINMENU_LOGIN);
    emscripten_resume_main_loop();
}
}
