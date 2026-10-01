"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const { chromium } = require("playwright");
const { requestHandler } = require("./browser-smoke.cjs");
(async () => {
  const out = path.resolve("qa", process.env.QA_RENDERER_PHASE || "after");
  fs.mkdirSync(out, { recursive: true });
  for (const file of fs.readdirSync(out))
    if (file.endsWith(".png") || file === "results.json")
      fs.unlinkSync(path.join(out, file));
  const server = http.createServer((req, res) => {
    const filename = new URL(req.url, "http://local").pathname.slice(1);
    if (
      process.env.QA_RENDERER_PHASE === "baseline" &&
      /^game\.(js|wasm|data)$/.test(filename)
    ) {
      res.setHeader(
        "Content-Type",
        filename.endsWith(".wasm")
          ? "application/wasm"
          : filename.endsWith(".js")
            ? "text/javascript"
            : "application/octet-stream",
      );
      return fs.createReadStream(path.join(out, filename)).pipe(res);
    }
    requestHandler(req, res);
  });
  let browser;
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--enable-unsafe-swiftshader"],
    });
    const context = await browser.newContext({
      viewport: { width: 1200, height: 1000 },
      deviceScaleFactor: 1,
    });
    await context.addInitScript(() => {
      const start = performance.now();
      Date.now = () => 1770000000000 + Math.floor(performance.now() - start);
      const Original = window.Audio;
      window.qaAudio = [];
      window.Audio = function (...args) {
        const a = new Original(...args);
        qaAudio.push(a);
        return a;
      };
      window.Audio.prototype = Original.prototype;
      window.qaGPU = { draws: 0, vertices: 0, uploads: 0, uploadBytes: 0 };
      const gl = WebGLRenderingContext.prototype;
      for (const name of [
        "drawArrays",
        "drawElements",
        "bufferData",
        "bufferSubData",
      ]) {
        const original = gl[name];
        gl[name] = function (...args) {
          if (name === "bufferData" || name === "bufferSubData") {
            qaGPU.uploads++;
            const data = args[name === "bufferData" ? 1 : 2];
            qaGPU.uploadBytes += data?.byteLength || 0;
          } else {
            qaGPU.draws++;
            qaGPU.vertices += (name === "drawArrays" ? args[2] : args[1]) || 0;
          }
          return original.apply(this, args);
        };
      }
    });
    const page = await context.newPage(),
      errors = [],
      warnings = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (/GL immediate|INVALID_|Assertion|Uplink.*fail/.test(m.text()))
        warnings.push(m.text());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/game.html`);
    await page.waitForTimeout(25000);
    async function snap(name) {
      await page.mouse.move(10, 10);
      await page.waitForTimeout(2500);
      await page
        .locator("#canvas")
        .screenshot({ path: path.join(out, name + ".png") });
      console.log("scene", name);
    }
    async function click(x, y, delay = 700) {
      const b = await page.locator("#canvas").boundingBox();
      await page.mouse.click(
        b.x + (x * b.width) / 1024,
        b.y + (y * b.height) / 768,
      );
      await page.waitForTimeout(delay);
    }
    async function measure(name) {
      const result = await page.evaluate(async () => {
        const start = performance.now(),
          old = { ...qaGPU },
          frame = MainLoop.currentFrameNumber;
        const durations = [];
        const runIter = MainLoop.runIter;
        MainLoop.runIter = function (...args) {
          const before = performance.now();
          try {
            return runIter.apply(this, args);
          } finally {
            durations.push(performance.now() - before);
          }
        };
        await new Promise((r) => setTimeout(r, 3000));
        MainLoop.runIter = runIter;
        durations.sort((a, b) => a - b);
        return {
          milliseconds: performance.now() - start,
          frames: MainLoop.currentFrameNumber - frame,
          draws: qaGPU.draws - old.draws,
          uploads: qaGPU.uploads - old.uploads,
          uploadBytes: qaGPU.uploadBytes - old.uploadBytes,
          callbackMeanMs:
            durations.reduce((a, b) => a + b, 0) / durations.length,
          callbackMedianMs: durations[Math.floor(durations.length * 0.5)],
          callbackP95Ms: durations[Math.floor(durations.length * 0.95)],
        };
      });
      return { name, ...result };
    }
    await page.keyboard.press("Escape");
    await snap("login");
    await click(320, 380);
    await click(170, 168);
    await click(320, 390);
    await click(300, 150);
    for (let i = 0; i < 12; i++) await page.keyboard.press("Backspace");
    await page.keyboard.type("RenderQA");
    await click(300, 180);
    await page.keyboard.type("cloud-test");
    await click(300, 210);
    await page.keyboard.type("cloud-test");
    await snap("registration");
    await click(320, 410);
    await snap("gateway");
    await click(490, 168);
    await click(320, 390);
    await page.waitForTimeout(24000);
    await click(325, 360);
    await page.waitForTimeout(2000);
    await click(325, 360);
    await click(465, 454);
    await snap("desktop");
    const performanceResults = [await measure("desktop")];
    fs.writeFileSync(
      path.join(out, "performance.json"),
      JSON.stringify(performanceResults, null, 2),
    );
    await page.waitForTimeout(2500);
    await snap("tutorial-one");
    // Freeze only the label-placement fixture after the original map opens.
    // The QA helper is absent from production builds and changes no gameplay.
    await click(850, 80);
    await page.evaluate(() => {
      if (!Module._qaFreezeMapLabels)
        throw Error("Use build-game-renderer-qa.sh");
      Module._qaFreezeMapLabels();
    });
    await snap("world-map");
    performanceResults.push(await measure("world-map"));
    await click(611, 581);
    await click(98, 737);
    await snap("memory-banks");
    performanceResults.push(await measure("memory-banks"));
    fs.writeFileSync(
      path.join(out, "performance.json"),
      JSON.stringify(performanceResults, null, 2),
    );
    await click(30, 720);
    await snap("software-menu");
    const canvas = await page.locator("#canvas").boundingBox();
    await page.mouse.move(
      canvas.x + (50 * canvas.width) / 1024,
      canvas.y + (582 * canvas.height) / 768,
    );
    await page.waitForTimeout(700);
    await click(165, 582);
    await snap("software");
    await page.mouse.click(canvas.x + 10, canvas.y + 10, { button: "right" });
    await page.waitForTimeout(500);
    await click(975, 737);
    await snap("mission");
    await click(455, 406);
    await snap("tutorial-menu");
    await click(240, 444);
    await snap("tutorial-two");
    await click(455, 406);
    await click(240, 460);
    await snap("tutorial-three");
    if (process.env.QA_RENDERER_PHASE !== "baseline") {
      assert.deepEqual(warnings, []);
      await snap("before-context-loss");
      for (let count = 1; count <= 2; count++) {
        await page.evaluate(() => {
          window.qaContextExtension = GLctx.getExtension("WEBGL_lose_context");
          qaContextExtension.loseContext();
        });
        await page.waitForFunction(() => GLctx.isContextLost());
        await page.waitForTimeout(150);
        await page.evaluate(() => qaContextExtension.restoreContext());
        await page.waitForFunction(
          (expected) => Module.uplinkRendererRestores === expected,
          count,
        );
        await page.waitForTimeout(500);
      }
      await snap("after-context-restore");
      assert.equal(await page.evaluate(() => GLctx.getError()), 0);
    }
    const state = await page.evaluate(() => ({
      ready: Module.uplinkPersistence.ready,
      abort: ABORT,
      gl: GLctx.getError(),
      files: Module.FS.readdir("/persistent/.uplink"),
      audio: qaAudio.map((a) => ({
        paused: a.paused,
        time: a.currentTime,
        error: a.error?.code,
      })),
    }));
    await page.evaluate(async () => {
      Module.FS.writeFile("/persistent/renderer-marker", "shader-save");
      await Module.uplinkFlushSaves();
    });
    await click(10, 10, 2000);
    await page.evaluate(() => Module.uplinkFlushSaves());
    const saved = await page.evaluate(() =>
      Module.FS.readFile("/persistent/.uplink/RenderQA.usr"),
    );
    fs.writeFileSync(path.join(out, "RenderQA.usr"), Buffer.from(saved));
    await page.reload();
    await page.waitForTimeout(18000);
    assert.equal(
      await page.evaluate(() =>
        Module.FS.readFile("/persistent/renderer-marker", { encoding: "utf8" }),
      ),
      "shader-save",
    );
    await click(105, 487, 1800);
    await click(530, 514);
    await page.keyboard.type("cloud-test");
    await snap("password-login");
    await click(588, 556);
    await page.waitForTimeout(2500);
    await click(325, 360);
    await snap("reloaded");
    const log = await page.evaluate(() =>
      Module.FS.readFile("/persistent/.uplink/debug.log", { encoding: "utf8" }),
    );
    assert.match(
      log,
      /Loading profile from [^\n]*\.usr\.\.\.(?:[^\n]*\n)?success/,
    );
    assert(!log.includes("App::LoadGame, Failed"));
    fs.writeFileSync(path.join(out, "debug.log"), log);
    assert.deepEqual(errors, []);
    assert.equal(state.gl, 0);
    assert(!state.abort);
    assert(state.audio.some((a) => !a.paused && a.time > 0 && !a.error));
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify({ state, errors, warnings, performanceResults }, null, 2),
    );
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
