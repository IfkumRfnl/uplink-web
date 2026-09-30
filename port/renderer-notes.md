# Browser Image renderer

Only `__EMSCRIPTEN__` branches in the original `lib/gucci/image.cpp` were changed. Native libtiff loading, GLU scaling, and glDrawPixels drawing remain intact.

- `Image::LoadTIF(name)` loads `name + ".rgba"`: two little-endian unsigned 32-bit dimensions followed by tightly packed bottom-up RGBA8 pixels. Missing, truncated, zero-sized, or overflowing image dimensions produce the existing error bitmap.
- Browser scaling is CPU bilinear interpolation at pixel centers. Nonpositive or overflowing requested dimensions are ignored.
- `Draw` and `DrawBlend` upload RGBA8 to a temporary texture and draw an immediate-mode quad under Emscripten legacy GL emulation. Top vertices use texture v=1; bottom vertices v=0. This matches the game's top-left coordinates and TIFF's bottom-up source scanlines.
- Texture filtering is nearest for exact pixel blits, with clamp-to-edge for NPOT WebGL textures. Blended draws retain the original SRC_ALPHA / ONE_MINUS_SRC_ALPHA behavior.
- GL_REPLACE avoids tinting images with the current drawing color and leaves that color untouched. The helper restores active texture unit, unit-0 texture binding/environment/enable, unpack alignment, culling, blend enable, and separate RGB/alpha blend factors.
- Emscripten's `glIsEnabled(GL_TEXTURE_2D)` does not query its emulated enable state. A small EM_ASM_INT query uses `GLImmediate.TexEnvJIT.getTexUnitType(0)` from the installed toolchain instead. Link with `-sLEGACY_GL_EMULATION=1`.
- Temporary texture uploads ensure changes from SetAlpha, flips, and scaling are immediately reflected without changing the Image class layout. A persistent invalidated texture cache would be a future performance optimization.

## Verification

Compiled `image.cpp` successfully with the installed Emscripten toolchain. A standalone Node-hosted WebAssembly test also passed actual RGBA loading, bottom-up source pixel order, a 2x2-to-3x3 bilinear center value of 128 for RGB, nonpositive-scale rejection, and missing-file fallback. Browser visual verification remains the parent prototype's integration step.
