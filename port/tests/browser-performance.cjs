"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const crypto = require("node:crypto");
const { requestHandler } = require("./browser-smoke.cjs");
const out = path.resolve(process.env.PERF_OUTPUT || "qa/performance/baseline");
const bundle = path.resolve(process.env.PERF_BUNDLE || "qa/renderer");
const timingOnly = !!process.env.PERF_TIMING_ONLY;
assert(
  !(timingOnly && process.env.PERF_ISOLATE_FINISH),
  "Finish isolation needs GL instrumentation",
);
const duration = Number(process.env.PERF_SECONDS || 6),
  repeats = Number(process.env.PERF_REPEATS || 3);
const configs = [
  {
    name: "default",
    resolution: "1024x768",
    dpr: 1,
    viewport: { width: 1366, height: 900 },
    scale: "sharp",
  },
  {
    name: "hidpi",
    resolution: "1024x768",
    dpr: 2,
    viewport: { width: 1920, height: 1080 },
    scale: "sharp",
  },
  {
    name: "small",
    resolution: "800x600",
    dpr: 1,
    viewport: { width: 1366, height: 900 },
    scale: "sharp",
  },
  {
    name: "large-fit",
    resolution: "1280x960",
    dpr: 1,
    viewport: { width: 1920, height: 1080 },
    scale: "fit",
  },
  {
    name: "large-native",
    resolution: "1600x1200",
    dpr: 2,
    viewport: { width: 1920, height: 1080 },
    scale: "native",
  },
].filter(
  (c) =>
    !process.env.PERF_CONFIG ||
    process.env.PERF_CONFIG.split(",").includes(c.name),
);
assert(configs.length, "PERF_CONFIG must name a known display configuration");
assert(
  Number.isFinite(duration) &&
    duration > 0 &&
    Number.isInteger(repeats) &&
    repeats > 0,
);
function stats(values) {
  const s = [...values].sort((a, b) => a - b);
  return {
    n: s.length,
    median: s[Math.floor(s.length * 0.5)] || 0,
    p95: s[Math.floor(s.length * 0.95)] || 0,
    p99: s[Math.floor(s.length * 0.99)] || 0,
    max: s.at(-1) || 0,
    over25: s.filter((x) => x > 25).length,
    over50: s.filter((x) => x > 50).length,
  };
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = new URL(req.url, "http://local").pathname.slice(1);
    if (/^game\.(js|wasm|data)$/.test(file)) {
      res.setHeader(
        "Content-Type",
        file.endsWith(".wasm")
          ? "application/wasm"
          : file.endsWith(".js")
            ? "text/javascript"
            : "application/octet-stream",
      );
      return fs.createReadStream(path.join(bundle, file)).pipe(res);
    }
    if (file === "display.js" && process.env.PERF_DISPLAY) {
      res.setHeader("Content-Type", "text/javascript");
      return fs
        .createReadStream(path.resolve(process.env.PERF_DISPLAY))
        .pipe(res);
    }
    requestHandler(req, res);
  });
  let browser;
  const results = [];
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      headless: true,
      chromiumSandbox: true,
      channel: "chromium",
      executablePath: process.env.CHROMIUM_PATH,
    });
    const systemSession = await browser.newBrowserCDPSession();
    fs.writeFileSync(
      path.join(out, "system.json"),
      JSON.stringify(
        {
          browser: await browser.version(),
          system: await systemSession.send("SystemInfo.getInfo"),
          node: process.version,
          platform: process.platform,
          config: { duration, repeats, glInstrumentation: !timingOnly },
          bundle,
          bundleHashes: Object.fromEntries(
            ["game.js", "game.wasm", "game.data"].map((file) => [
              file,
              crypto
                .createHash("sha256")
                .update(fs.readFileSync(path.join(bundle, file)))
                .digest("hex"),
            ]),
          ),
        },
        null,
        2,
      ),
    );
    for (const cfg of configs) {
      const context = await browser.newContext({
        viewport: cfg.viewport,
        deviceScaleFactor: cfg.dpr,
      });
      await context.addInitScript((cfg) => {
        localStorage.setItem(
          "uplink-display-v1",
          JSON.stringify({ resolution: cfg.resolution, scale: cfg.scale }),
        );
        const epoch = performance.now();
        Date.now = () => 1770000000000 + Math.floor(performance.now() - epoch);
        window.qaObservers = { resize: 0, mutation: 0, time: 0 };
        for (const kind of ["ResizeObserver", "MutationObserver"]) {
          const Original = window[kind];
          window[kind] = class extends Original {
            constructor(callback) {
              super((...args) => {
                const t = performance.now();
                qaObservers[
                  kind === "ResizeObserver" ? "resize" : "mutation"
                ]++;
                callback(...args);
                qaObservers.time += performance.now() - t;
              });
            }
          };
        }
      }, cfg);
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`http://127.0.0.1:${server.address().port}/game.html`);
      await page.waitForFunction(
        () =>
          typeof MainLoop !== "undefined" && MainLoop.currentFrameNumber > 10,
        null,
        { timeout: 60000 },
      );
      async function click(x, y, delay = 700) {
        const b = await page.locator("#canvas").boundingBox();
        const [w, h] = cfg.resolution.split("x").map(Number);
        await page.mouse.click(
          b.x + (x * b.width) / w,
          b.y + (y * b.height) / h,
        );
        await page.waitForTimeout(delay);
      }
      await page.waitForTimeout(25000);
      await page.keyboard.press("Escape");
      await click(320, 380);
      await click(170, 168);
      await click(320, 390);
      await click(300, 150);
      for (let i = 0; i < 12; i++) await page.keyboard.press("Backspace");
      await page.keyboard.type("PerfQA");
      await click(300, 180);
      await page.keyboard.type("cloud-test");
      await click(300, 210);
      await page.keyboard.type("cloud-test");
      await page
        .locator("#canvas")
        .screenshot({ path: path.join(out, cfg.name + "-registration.png") });
      await click(320, 410);
      const mapScale = (Number(cfg.resolution.split("x")[0]) - 46) / 978;
      await click(23 + 467 * mapScale, 50 + 118 * mapScale);
      await click(320, 390);
      await page.waitForTimeout(24000);
      await click(325, 360);
      await click(325, 360);
      await click(465, 454);
      await page.waitForTimeout(2000);
      // Check the original HUD exists before accepting any gameplay measurements.
      assert.equal(
        await page.evaluate(() => Module._qaPerformanceButton(2)),
        1,
        "Original gameplay HUD is required",
      );
      assert.equal(
        await page.evaluate(() => Module._qaPerformanceButton(3)),
        1,
      );
      await page.evaluate((timingOnly) => {
        const gl = GLctx,
          debug = gl.getExtension("WEBGL_debug_renderer_info");
        window.qaGPU = {
          vendor: debug && gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
          renderer: debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
        };
        window.qaSample = null;
        window.qaSkipFinish = false;
        window.qaLongTasks = [];
        window.qaSaveWrites = [];
        const open = FS.open,
          write = FS.write,
          close = FS.close;
        FS.open = function (...args) {
          const stream = open.apply(this, args);
          if (qaSample && stream.path?.endsWith(".usr") && stream.flags & 3) {
            stream.qaSave = {
              time: performance.now(),
              path: stream.path,
              bytes: 0,
              writes: 0,
            };
            qaSaveWrites.push(stream.qaSave);
          }
          return stream;
        };
        FS.write = function (stream, ...args) {
          if (qaSample && stream.qaSave) {
            stream.qaSave.bytes += args[2];
            stream.qaSave.writes++;
          }
          return write.call(this, stream, ...args);
        };
        FS.close = function (stream) {
          if (stream.qaSave) stream.qaSave.end = performance.now();
          return close.call(this, stream);
        };
        new PerformanceObserver((list) => {
          if (qaSample)
            qaLongTasks.push(
              ...list
                .getEntries()
                .map((e) => ({ start: e.startTime, duration: e.duration })),
            );
        }).observe({ type: "longtask", buffered: false });
        for (const name of timingOnly
          ? []
          : [
              "drawArrays",
              "bufferData",
              "texImage2D",
              "createTexture",
              "deleteTexture",
              "finish",
            ]) {
          const original = gl[name].bind(gl);
          gl[name] = function (...args) {
            const s = qaSample,
              t = performance.now();
            if (s) {
              s.calls[name] = (s.calls[name] || 0) + 1;
              if (name === "bufferData")
                s.bytes.buffer +=
                  typeof args[1] === "number" ? args[1] : args[1].byteLength;
              if (name === "texImage2D")
                s.bytes.texture += args[3] * args[4] * 4;
            }
            const value =
              name === "finish" && qaSkipFinish ? undefined : original(...args);
            if (s)
              s.glTime[name] = (s.glTime[name] || 0) + performance.now() - t;
            return value;
          };
        }
        const original = MainLoop.runIter.bind(MainLoop);
        MainLoop.runIter = function (func) {
          const s = qaSample,
            t = performance.now();
          const x = Module._qaPerformanceAnimationX();
          original(func);
          if (s) {
            s.frames.push({
              start: t,
              duration: performance.now() - t,
              x,
              clock: Module._qaPerformanceTime(),
            });
          }
        };
      }, timingOnly);
      const session = await context.newCDPSession(page);
      for (const scene of ["desktop", "map", "memory"]) {
        if (scene === "map") {
          await page.evaluate(() => {
            qaLongTasks = [];
            qaSample = {
              frames: [],
              calls: {},
              glTime: {},
              bytes: { buffer: 0, texture: 0 },
              observerStart: { ...qaObservers },
              handleStart: {
                slots: GL.textures.length,
                live: GL.textures.filter(Boolean).length,
              },
            };
          });
          assert.equal(
            await page.evaluate(() => Module._qaPerformanceButton(0)),
            1,
            "HUD small map exists",
          );
          await page.waitForTimeout(2000);
          const opening = await page.evaluate(() => {
            const s = qaSample;
            qaSample = null;
            return { ...s, longTasks: qaLongTasks };
          });
          fs.writeFileSync(
            path.join(out, cfg.name + "-map-opening.json"),
            JSON.stringify(opening),
          );
          await page.evaluate(() => Module._qaFreezeMapLabels());
        }
        if (scene === "memory") {
          assert.equal(
            await page.evaluate(() => Module._qaPerformanceButton(1)),
            1,
          );
          assert.equal(
            await page.evaluate(() => Module._qaPerformanceButton(2)),
            1,
          );
        }
        await page.mouse.move(10, 10);
        await page.waitForTimeout(1500);
        await page.locator("#canvas").screenshot({
          path: path.join(out, cfg.name + "-" + scene + ".png"),
        });
        for (let repeat = 0; repeat < repeats; repeat++) {
          const variants = process.env.PERF_ISOLATE_FINISH
            ? ["normal", "skip-finish"]
            : ["normal"];
          for (const variant of variants) {
            await page.evaluate((variant) => {
              qaSkipFinish = variant === "skip-finish";
              qaLongTasks = [];
              qaSaveWrites = [];
              qaSample = {
                frames: [],
                calls: {},
                glTime: {},
                bytes: { buffer: 0, texture: 0 },
                observerStart: { ...qaObservers },
                handleStart: {
                  slots: GL.textures.length,
                  live: GL.textures.filter(Boolean).length,
                },
              };
              Module._qaPerformanceAnimation();
            }, variant);
            await page.waitForTimeout(
              (process.env.PERF_AUTOSAVE && scene === "memory"
                ? 65
                : duration) * 1000,
            );
            const raw = await page.evaluate(() => {
              const s = qaSample;
              qaSample = null;
              return {
                ...s,
                handleEnd: {
                  slots: GL.textures.length,
                  live: GL.textures.filter(Boolean).length,
                },
                heapBytes: HEAPU8.byteLength,
                jsHeapBytes: performance.memory?.usedJSHeapSize,
                saveWrites: qaSaveWrites,
                observerEnd: { ...qaObservers },
                longTasks: qaLongTasks,
                gpu: qaGPU,
                geometry: {
                  backing: [canvas.width, canvas.height],
                  css: canvas.getBoundingClientRect().toJSON(),
                  dpr: devicePixelRatio,
                },
                timing: {
                  mode: MainLoop.timingMode,
                  value: MainLoop.timingValue,
                },
                visibility: document.visibilityState,
              };
            });
            const intervals = raw.frames
              .slice(1)
              .map((f, i) => f.start - raw.frames[i].start);
            const n = raw.frames.length;
            const summary = {
              config: cfg,
              scene,
              repeat,
              variant,
              glInstrumentation: !timingOnly,
              frameIntervals: stats(intervals),
              callback: stats(raw.frames.map((f) => f.duration)),
              callbackHz:
                n /
                (process.env.PERF_AUTOSAVE && scene === "memory"
                  ? 65
                  : duration),
              callsPerFrame: Object.fromEntries(
                Object.entries(raw.calls).map(([k, v]) => [k, v / n]),
              ),
              glMsPerFrame: Object.fromEntries(
                Object.entries(raw.glTime).map(([k, v]) => [k, v / n]),
              ),
              bytesPerFrame: Object.fromEntries(
                Object.entries(raw.bytes).map(([k, v]) => [k, v / n]),
              ),
              observerDelta: Object.fromEntries(
                Object.entries(raw.observerEnd).map(([k, v]) => [
                  k,
                  v - raw.observerStart[k],
                ]),
              ),
              handles: { before: raw.handleStart, after: raw.handleEnd },
              heapBytes: raw.heapBytes,
              jsHeapBytes: raw.jsHeapBytes,
              longTasks: raw.longTasks,
              saveWrites: raw.saveWrites,
              gpu: raw.gpu,
              geometry: raw.geometry,
              timing: raw.timing,
              visibility: raw.visibility,
            };
            fs.writeFileSync(
              path.join(out, `${cfg.name}-${scene}-${repeat}-${variant}.json`),
              JSON.stringify(raw),
            );
            results.push(summary);
            fs.writeFileSync(
              path.join(out, "summary.json"),
              JSON.stringify(results, null, 2),
            );
            console.log(JSON.stringify(summary));
          }
        }
        if (process.env.PERF_TRACE) {
          await page.evaluate(() => {
            qaSkipFinish = false;
          });
          await session.send("Profiler.enable");
          await session.send("Profiler.start");
          const trace = [];
          session.on("Tracing.dataCollected", (e) => trace.push(...e.value));
          await session.send("Tracing.start", {
            categories: "devtools.timeline,blink,cc,gpu,viz",
            transferMode: "ReportEvents",
          });
          await page.waitForTimeout(3000);
          const profile = await session.send("Profiler.stop");
          fs.writeFileSync(
            path.join(out, cfg.name + "-" + scene + ".cpuprofile"),
            JSON.stringify(profile.profile),
          );
          const complete = new Promise((r) =>
            session.once("Tracing.tracingComplete", r),
          );
          await session.send("Tracing.end");
          await complete;
          fs.writeFileSync(
            path.join(out, cfg.name + "-" + scene + "-trace.json"),
            JSON.stringify({ traceEvents: trace }),
          );
        }
      }
      if (process.env.PERF_MEMORY) {
        const snapshots = [];
        await page.evaluate(() => Module._qaPerformanceButton(3));
        for (let cycle = 0; cycle < 10; cycle++) {
          for (const [scene, open, close] of [
            ["map", 0, 1],
            ["memory", 2, 3],
          ]) {
            assert.equal(
              await page.evaluate(
                (id) => Module._qaPerformanceButton(id),
                open,
              ),
              1,
            );
            await page.waitForTimeout(500);
            if (scene === "map")
              await page.evaluate(() => Module._qaFreezeMapLabels());
            snapshots.push(
              await page.evaluate(
                ({ cycle, scene }) => ({
                  cycle,
                  scene,
                  textures: Module._qaRendererTextureCount(),
                  recoveryPixelBytes: Module._qaRendererRecoveryBytes(),
                  liveGLTextures: GL.textures.filter(Boolean).length,
                  handleSlots: GL.textures.length,
                }),
                { cycle, scene },
              ),
            );
            assert.equal(
              await page.evaluate(
                (id) => Module._qaPerformanceButton(id),
                close,
              ),
              1,
            );
          }
        }
        fs.writeFileSync(
          path.join(out, cfg.name + "-texture-memory.json"),
          JSON.stringify(snapshots, null, 2),
        );
        for (const scene of ["map", "memory"]) {
          const last = snapshots.filter((s) => s.scene === scene).slice(-3);
          assert.equal(
            new Set(last.map((s) => s.textures + ":" + s.recoveryPixelBytes))
              .size,
            1,
            "Retained texture count/pixels must stabilize for " + scene,
          );
        }
      }
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => GLctx.getError()), 0);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
