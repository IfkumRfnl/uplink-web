# Game display settings and glyph sampling

The original game uses a fixed SDL video mode and logical screen coordinates.
The previous shell always passed 1024×768, with CSS `max-width:100%` shrinking
the canvas in smaller windows. That resampling can soften small text. Original
image blits already use nearest texture filtering. Browser FTGL glyph atlases
used linear minification/magnification filters, while the original UI projection
includes a 0.375-pixel translation. Linear filtering introduces an additional
interpolation pass over the native glyph rasterization.

`port/patch-ftgl.py` sets nearest filters on the browser font atlases.
The follow-on raster fix also matches the native FTGLBitmapFont's
`FT_LOAD_TARGET_MONO` hinting and `FT_RENDER_MODE_MONO` output, rather than
the browser texture font's unhinted grayscale output. Packed monochrome bits
are expanded to white RGBA texels with 0/255 alpha; embedded GRAY, GRAY2 and
GRAY4 bitmaps retain their coverage values. Negative-pitch bitmaps are decoded
from the allocation-base buffer in reversed row order. Color/LCD formats are
rejected rather than interpreted as alpha. Point sizes and font files stay the same, but
hinted glyph shapes and advances can differ from the earlier browser rendering.
This restores source-native font appearance, rather than proving a subjective
readability improvement.

The retained browser UI texture helper also uses nearest sampling, matching
direct Image blits. It previously used linear filtering for textured image
buttons, so those images could remain soft even with sharp canvas presentation.
The zoomable map backdrop and CPU Image::Scale interpolation are unchanged.
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

- Sharp selects the largest fitting whole-device-pixel scale, with a minimum of one.
- Fit fills the available space, allowing fractional scale with pixelated sampling.
- Native always uses one physical device pixel per game pixel.

Sharp and Native use a scrollable viewport when the game is larger than the
window, keeping the fixed Display controls accessible. Fit shows the entire
game and can downscale; that can discard glyph detail. The canvas origin is
snapped to physical pixels on layout and scrolling, including fractional DPR.
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

Focused raster regressions: `python3 port/tests/test-font-raster.py` compiles
the generated FTTextureGlyph translation unit against test doubles and checks
packed 1-bit alpha, padded/negative pitch, embedded gray and empty/error glyphs.
`python3 port/tests/test-ui-texture.py` compiles the actual browser UI helper
and checks nearest/clamp parameters and repeated texture binding.
`node port/tests/test-display-layout.cjs` covers sizing/alignment functions for
integer and fractional DPR and undersized windows. These are included in
`npm test`; they do not establish full Wasm or browser behavior. The browser
display suite additionally checks fractional DPR, pixel origins, fitted bounds,
both-axis scrolling and fresh SDL pointer events after scrolling.

CSS-only sizing changes from SDL also trigger relayout. ResizeObserver
notifications schedule a coalesced animation-frame callback so layout never
writes during observer delivery. Layout retains both scroll offsets while
temporarily clearing canvas dimensions to measure available space. Browser
regressions explicitly simulate CSS-only restoration in Sharp and Native,
capture window errors (including observer-loop notifications), and check
stable dimensions, physical-pixel origins and scroll offsets across frames.
