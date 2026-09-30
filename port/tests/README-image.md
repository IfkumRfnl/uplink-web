# Image and Redshirt browser unit tests

Run from any directory:

```sh
/path/to/uplink-web/port/tests/run-image-tests.sh
```

The script uses this workspace's Emscripten SDK and Node. Override `EMXX`, `NODE`, and `SOURCE_ROOT` for a different installation. It compiles the actual `lib/gucci/image.cpp` browser branch and includes the actual Redshirt translation unit to exercise its private sidecar helper. No copied implementation or mocked filesystem is used. Files are created in the test module's transient Emscripten filesystem; host build products use a temporary directory removed on exit.

Coverage:
- Bottom-up 2x2 RGBA order, bilinear 3x3 center, corner preservation, alpha, one-pixel resize, RGB cache regeneration
- Zero, negative, and overflowing scale requests
- Missing/null filename; short header/payload; zero, signed-overflow, and allocation-overflow dimensions
- Exact graphics path fallback, POSIX/Windows separators, missing fallback, adjacent-file precedence
- Rejection of parent-directory traversal and nonmatching directory names
- Converted archive-image copying beside temporary TIFFs, retention of original TIFF bytes, stale-sidecar removal

Expected outcome: four PASS groups and `All Image/Redshirt browser unit tests passed`. Missing-image diagnostics are expected from negative cases. The toolchain's GL-emulation warnings are expected as well.

These are WebAssembly data-path tests. They do not create a browser/WebGL context, test textured-quad rendering, or verify archive decompression end-to-end; those remain browser/game integration checks.
