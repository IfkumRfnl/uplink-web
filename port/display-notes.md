# Game display settings and glyph sampling

The original game uses a fixed SDL video mode and logical screen coordinates.
The previous shell always passed 1024×768, with CSS `max-width:100%` shrinking
the canvas in smaller windows. That resampling can soften small text. Original
image blits already use nearest texture filtering. Browser FTGL glyph atlases
used linear minification/magnification filters, while the original UI projection
includes a 0.375-pixel translation. Linear filtering introduces an additional
interpolation pass over the native glyph rasterization.

`port/patch-ftgl.py` now sets nearest filters on the browser font atlases.
FreeType's glyph pixels, font sizes, spacing and native source files are unchanged.
No source image is enlarged to create artificial detail.

The collapsible Display control in `prototype/display.js` offers 800×600,
1024×768 (default), 1280×960 and 1600×1200. These are actual game resolutions,
passed through the original command-line options before SDL initializes.
Changing resolution flushes existing browser save files and reloads the page;
the control explicitly asks players to save progress first. Flushing does not
create an in-game save of unsaved progress. The SDL backend's screen-size setter
is a no-op, so changing the canvas backing buffer alone during play would break
the renderer's projection and UI coordinates.

Scaling applies immediately and preserves aspect ratio:

- Sharp selects the largest whole-device-pixel scale that fits the window.
- Fit fills the available space, allowing fractional scale with pixelated sampling.
- Native uses one physical device pixel per game pixel, fitting smaller windows.

All modes downscale when the window cannot fit the chosen resolution. That can
discard glyph detail; choosing a lower resolution or a larger window helps.
DPR affects presentation dimensions rather than silently multiplying SDL's
backing buffer. Resize, fullscreen and monitor/zoom DPR changes recalculate CSS
dimensions. Emscripten continues mapping input through the actual canvas bounds.
Resolution/scaling settings are validated and saved locally. Storage failure
retains working defaults or session-only scaling; a resolution restart is blocked
if settings cannot be saved or flushing fails.

The display work is stacked on the shell cleanup branch
`fix/game-shell-context-menu` (draft PR #2, commit d559cf5). Its removed footer/log,
canvas-only context-menu cancellation and enhanced Pages tests remain intact.
The Pages packager includes the new display script, and CI runs its browser test.

Validation commands:

```sh
npm run build
npm test
npm run test:browser-display
npm run prepare:pages
npm run test:pages
python3 port/verify-inventory.py
```

Browser screenshots and geometry/input results are generated under `qa/display/`.
Reference Library image transfer failed with `library file transfer failed:
download failed`; reference pixels were not inspected in this environment.
