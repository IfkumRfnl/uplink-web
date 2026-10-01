"use strict";
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright");
(async () => {
  const root = path.resolve("qa/probe");
  const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, "http://local").pathname);
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end();
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".wasm")
          ? "application/wasm"
          : file.endsWith(".js")
            ? "text/javascript"
            : "text/html",
      );
      res.end(data);
    });
  });
  let browser;
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--enable-unsafe-swiftshader"],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (/Assertion|INVALID_|abort/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.waitForFunction(() => Module.rendererProbeFrames > 5);
    assert.deepEqual(errors, []);
    for (let i = 1; i <= 2; i++) {
      await page.evaluate(() => {
        window.qaLoss = GLctx.getExtension("WEBGL_lose_context");
        qaLoss.loseContext();
      });
      await page.waitForFunction(() => GLctx.isContextLost());
      await page.waitForTimeout(100);
      await page.evaluate(() => qaLoss.restoreContext());
      await page.waitForFunction(
        (expected) => Module.uplinkRendererRestores === expected,
        i,
      );
      await page.waitForFunction(() => Module.rendererProbeFrames > 10);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => GLctx.getError()), 0);
    }
    await page
      .locator("#canvas")
      .screenshot({ path: path.join(root, "restored.png") });
    fs.writeFileSync(
      path.join(root, "results.json"),
      JSON.stringify(
        {
          pixelAssertions:
            "sparse RGBA, quad triangulation, matrices, independent lines, clipping/attribute restoration, image REPLACE and alpha blending",
          contextRestores: 2,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: actual renderer pixels and two texture/program/buffer context restorations",
    );
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
