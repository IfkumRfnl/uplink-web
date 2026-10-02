# Browser image texture reuse

Measured 2026-10-02 against deployed main `d9f1aa9d608c93d9b91c7fc5d08a1700cd17b1a5`. This change removes steady repeated image texture allocation/upload/deletion and steady handle-table growth. It does not establish that the user's deployed stutter is resolved.

## Method

Emscripten 6.0.10, full Chromium 151.0.7922.34 with its sandbox enabled, ANGLE/SwiftShader on a cloud AMD EPYC environment. GPU compositing is software. Hardware GPUs and the user's browser/settings have not been reproduced.

Original-game registration and onboarding lead to desktop, large world map and Memory Banks. A QA-only helper observes a two-second movement through the real Eclipse implementation; map labels are fixed for steady comparisons. Each scene has three six-second samples. Timings below are medians of the three run statistics, including p95/p99, rather than pooled percentiles. Separate three-second CDP traces capture CPU/render/compositing work. Callback timing excludes later browser compositing; frame starts include its effect on pacing. The rate is C++ callbacks per second, not a measure of compositor presentation FPS. The original evidence's legacy `fps` field has this callback-rate meaning; the runner now calls it `callbackHz`. Raw frames and stalls are retained.

| Configuration | Game buffer | Viewport | DPR | Scaling |
| --- | --- | --- | ---: | --- |
| default | 1024×768 | 1366×900 | 1 | Sharp |
| hidpi | 1024×768 | 1920×1080 | 2 | Sharp |
| small | 800×600 | 1366×900 | 1 | Sharp |
| large-fit | 1280×960 | 1920×1080 | 1 | Fit |
| large-native | 1600×1200 | 1920×1080 | 2 | Native |

All 45 before/45 after samples use matched backing/CSS geometry, DPR and scenes. The QA movement runs in both bundles. GL call wrappers count work and time each call; the baseline makes more calls, so it pays more instrumentation overhead. Small callback differences in these instrumented runs cannot establish a speedup. A separate matched control disables all GL wrappers. These sequential cloud runs are descriptive measurements, not hardware performance predictions or statistically controlled presentation-rate gains.

## Results

All candidate steady samples have **zero** texture creates, uploads, deletes and handle-table growth. At 1024×768:

| Scene | Uploads/frame before→after | Texture bytes/frame before→after | Callback median ms before→after | Callback interval p95 / p99 ms before→after |
| --- | ---: | ---: | ---: | --- |
| Desktop | 25→0 | 224,964→0 | 1.0→0.9 | 16.8 / 16.9→16.8 / 17.1 |
| Map | 25→0 | 39,752→0 | 1.1→1.1 | 16.8 / 20.3→16.8 / 22.8 |
| Memory Banks | 27→0 | 226,764→0 | 1.3→1.2 | 16.8 / 18.9→16.8 / 17.1 |

An 800×600 Memory Banks sample grew Emscripten's texture table from 92,967 to 102,714 slots in six seconds, while only six textures remained live. Candidate tables remain at roughly 70–75 slots with 27–30 live textures in steady samples. Screen transitions can still allocate/delete textures and extend the handle table. Reuse removes churn; it retains an uploaded GPU texture and the renderer's recovery pixel copy until each drawn Image is destroyed.

The GL-wrapper-free control has 18 matched samples per bundle at default and large-native. Default callback medians are desktop 1.0→0.8 ms, map 0.9→1.0 ms and Memory Banks 1.1→1.1 ms. Large-native map callback median remains 1.1 ms while interval p95/p99 rises 29.5/32.6→30.0/37.7 ms. Its desktop and Memory Banks callback rates change 56.7→57.3 and 49.8→51.5/s. This control supports no general pacing or callback-speed improvement.

Ten map/Memory Banks transition cycles in both modes stabilize at 28/30 live textures. Retained renderer recovery pixels are 2,070,968 bytes for the map and 2,257,980/2,527,684 bytes for Memory Banks (default/large-native). These exclude original Image pixels and GPU allocation overhead. The handle table still grows four slots per cycle; texture reuse removes steady churn, rather than all transition growth. Longer-session memory behavior remains open.

Draw counts and vertex upload bytes are unchanged. Default C++ callback pacing remains approximately 60 callbacks/s, with occasional stalls in both versions. The controlled movement advances on about 120 frames over two seconds. Captions and other deliberately timed effects retain their original cadence.

Larger-mode pacing is mixed. At 1600×1200, median C++ callback rate/s was desktop 56.5→55.3, map 41.8→45.5 and Memory Banks 48.8→53.7. At 1280×960 Fit, map p95 increased 19.1→20.7 ms despite lower callback median. Do not attribute these changes solely to the cache. Software compositor/readback work dominates: 1600×1200 desktop layer-update median was 14.93→15.63 ms against callback trace median 1.28→1.19 ms. These nested trace events must not be added together.

Steady ResizeObserver/MutationObserver counts are zero in every candidate and baseline sample. The initial default-resolution A/B with glFinish skipped showed no pacing benefit; synchronization is retained. PR6's observer path is not a measured steady bottleneck here. This is not a complete comparison against pre-sharpness main 8fc628f.

Real autosaves were observed. Enclosing callbacks reached 34.3 ms before and 41.0 ms after; texture reuse does not remove synchronous save serialization. Map-opening transients, frame p95/p99, >25/>50 ms stalls and full traces are included in the private evidence, rather than hidden in average callback numbers.

## Implementation and validation

Image owns its texture; copies start with an independent handle and destruction releases it. Shallow copy assignment is unavailable in C++98; compile-time checks cover native and browser modes. Uploads compare actual bytes with the renderer's existing recovery pixels, preserving public in-place edits, reload, scaling, flipping and alpha changes. A real mutation flushes pending geometry before replacing pixels. Nearest sampling, font rasterization, resolutions, animation scheduling and glFinish remain unchanged. Incremental compilation now tracks image.h because its browser layout changes.

Validation: full 236-TU build, npm test, inventory verification, real image pixel/lifecycle checks and two context restorations pass. All 16 original-game visual comparisons pass with unchanged stable pixels; save/audio behavior, two context restorations and display/input checks also pass. See the PR for exact-head CI.

## Reproduction and evidence

Build with the pinned SDK, then `bash port/tests/build-game-renderer-qa.sh`. Run `PERF_OUTPUT=qa/performance/after PERF_TRACE=1 npm run bench:browser`. `PERF_CONFIG` selects the named configurations above; defaults are six seconds and three repetitions. `PERF_TIMING_ONLY=1` disables GL instrumentation; `PERF_MEMORY=1` adds ten map/Memory Banks transition cycles and asserts that retained texture count and recovery pixel bytes stabilize (QA bundle only). Optional `PERF_ISOLATE_FINISH=1` records the diagnostic skip-finish control, and `PERF_AUTOSAVE=1 PERF_REPEATS=1` extends Memory Banks to 65 seconds. Keep profiling jobs separate from builds and other browser tests.

For before/after work, preserve the baseline QA `game.js`, `game.wasm`, `game.data` together and select them with `PERF_BUNDLE=/path/to/baseline`. Serve the same display.js and use identical settings. The runner requires Chromium's sandbox; an environment that blocks it needs an approved sandbox-capable execution route, rather than disabling the browser sandbox.

Raw timings, screenshots, system/GPU metadata, CPU profiles, traces and correctness results remain in ignored qa/. Only the runner and this concise summary are committed. The full 15-scene comparison table and analysis are preserved privately with the evidence archive. Hardware/browser reproduction and longer sessions remain open.
