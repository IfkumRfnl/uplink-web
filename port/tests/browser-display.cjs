'use strict';
// Actual game/SDL presentation, input and saved display settings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const {requestHandler} = require('./browser-smoke.cjs');
(async () => {
  const server = http.createServer(requestHandler);
  let browser;
  const out = path.resolve('qa/display');
  fs.mkdirSync(out, {recursive:true});
  const results = [];
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,
      headless:true, args:['--enable-unsafe-swiftshader']});
    for (const dpr of [1, 1.25, 1.5, 1.75, 2]) {
      const context = await browser.newContext({viewport:{width:1366,height:900}, deviceScaleFactor:dpr});
      await context.addInitScript(() => {
        window.qaWindowErrors = [];
        window.addEventListener('error', event => qaWindowErrors.push(event.message));
        window.qaResizeCalls = 0;
        const Original = window.ResizeObserver;
        window.ResizeObserver = class extends Original {
          constructor(callback) {super((entries, observer) => {
            ++qaResizeCalls;
            callback(entries, observer);
          });}
        };
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(`http://127.0.0.1:${server.address().port}/game.html`);
      await page.waitForFunction(() => window.Module?.uplinkPersistence?.ready &&
        typeof MainLoop !== 'undefined' && MainLoop.currentFrameNumber > 10);
      async function observeSDL() {
        await page.evaluate(() => {
          window.qaPointers = [];
          const original = SDL.makeCEvent;
          SDL.makeCEvent = function(event, ptr) {
            const result = original.call(this, event, ptr);
            if (['mousedown','mouseup'].includes(event.type) && result !== false) {
              const canvas = document.querySelector('#canvas'), box = canvas.getBoundingClientRect();
              qaPointers.push({
                actual:[HEAP32[(ptr+20)>>2], HEAP32[(ptr+24)>>2]],
                expected:[Math.trunc((event.pageX - window.scrollX - box.left) * canvas.width / box.width),
                  Math.trunc((event.pageY - window.scrollY - box.top) * canvas.height / box.height)]
              });
            }
            return result;
          };
        });
      }
      await observeSDL();
      async function geometry() {
        return page.evaluate(() => {
          const c = document.querySelector('#canvas'), box = c.getBoundingClientRect();
          const v = document.querySelector('#display-viewport'), visible = v.getBoundingClientRect();
          return {width:c.width,height:c.height,w:box.width,h:box.height,x:box.x,y:box.y,
            viewport:{w:visible.width,h:visible.height,clientWidth:v.clientWidth,clientHeight:v.clientHeight,
              scrollLeft:v.scrollLeft,scrollTop:v.scrollTop,scrollWidth:v.scrollWidth,scrollHeight:v.scrollHeight},
            dpr:devicePixelRatio,filter:getComputedStyle(c).imageRendering,
            backing:[GLctx.drawingBufferWidth, GLctx.drawingBufferHeight]};
        });
      }
      async function checkInput() {
        assert.deepEqual(await page.evaluate(() => qaWindowErrors), []);
        const g = await geometry(), box = await page.locator('#canvas').boundingBox();
        // The fixed form can cover the target in narrow windows. Keep this an
        // actual canvas click, then restore the form for subsequent selections.
        const open = await page.locator('#display-control').evaluate(el => el.open);
        if (open) await page.locator('#display-control summary').click();
        await page.evaluate(() => {qaPointers = [];});
        await page.mouse.click(box.x + 200 * box.width / g.width,
          box.y + 200 * box.height / g.height);
        // Require fresh down/up events; a previous successful click cannot mask
        // missing events after a resize. Wait for consumption instead of racing CI.
        await page.waitForFunction(() => qaPointers.length >= 2);
        const pointers = await page.evaluate(() => qaPointers);
        for (const pointer of pointers)
          assert.deepEqual(pointer.actual, pointer.expected, 'SDL must map the actual dispatched event through the canvas bounds');
        const mouse = pointers.at(-1).actual;
        // Chromium rounds mouse events to CSS pixels. Downscaled Fit can turn
        // one CSS pixel into several game pixels; SDL then truncates to integers.
        assert(Math.abs(mouse[0] - 200) <= 1 + g.width / box.width &&
          Math.abs(mouse[1] - 200) <= 1 + g.height / box.height,
          `SDL input drift: ${mouse}`);
        assert.equal(g.filter, 'pixelated');
        assert.deepEqual(g.backing, [g.width,g.height]);
        assert(Math.abs(g.w/g.h - g.width/g.height) < 0.001);
        for (const origin of [g.x, g.y])
          assert(Math.abs(origin * g.dpr - Math.round(origin * g.dpr)) < 0.04,
            `Fractional physical-pixel origin: ${JSON.stringify(g)}`);
        if (open) await page.locator('#display-control summary').click();
        return g;
      }
      async function checkCssRestoration(mode) {
        const before = await geometry();
        const restoration = await page.evaluate(async () => {
          const c = document.querySelector('#canvas'), v = document.querySelector('#display-viewport');
          const start = qaResizeCalls, samples = [];
          // SDL may change only CSS dimensions, leaving backing attributes intact.
          c.style.width = c.width + 'px';
          c.style.height = c.height + 'px';
          for (let i = 0; i < 60; ++i) {
            await new Promise(requestAnimationFrame);
            const box = c.getBoundingClientRect();
            samples.push({w:box.width,h:box.height,x:box.x,y:box.y,
              scrollLeft:v.scrollLeft,scrollTop:v.scrollTop});
          }
          return {samples,resizeCalls:qaResizeCalls-start,errors:qaWindowErrors};
        });
        const settled = restoration.samples.at(-1);
        assert.equal(settled.w, before.w);
        assert.equal(settled.h, before.h);
        assert.equal(settled.scrollLeft, before.viewport.scrollLeft, 'CSS restoration must preserve horizontal scroll');
        assert.equal(settled.scrollTop, before.viewport.scrollTop, 'CSS restoration must preserve vertical scroll');
        assert.deepEqual(restoration.errors, [], 'Capture window errors, including ResizeObserver delivery errors');
        assert(restoration.resizeCalls < 6, 'Resize observers must settle after CSS restoration');
        for (const sample of restoration.samples.slice(-30)) {
          assert.deepEqual(sample, settled, 'Canvas sizing/origin/scroll must not oscillate');
          for (const origin of [sample.x, sample.y])
            assert(Math.abs(origin*dpr-Math.round(origin*dpr)) < 0.04);
        }
        const after = await checkInput();
        results.push({dpr,mode,checks:'CSS-only SDL restoration; stable sizing, pixel origins and scroll; no window errors',
          before,after,restoration});
      }
      for (const viewport of [{width:1367,height:901},{width:1920,height:1080},
        {width:800,height:700},{width:390,height:844}]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(150);
        const g = await checkInput();
        assert(g.viewport.w <= viewport.width + 1 && g.viewport.h <= viewport.height + 1);
        const physicalScale = g.w * dpr / g.width;
        assert(physicalScale >= 0.999 && Math.abs(physicalScale - Math.round(physicalScale)) < 0.001);
        assert(Math.abs(g.w * dpr - g.width * Math.round(physicalScale)) < 0.05);
        assert(Math.abs(g.h * dpr - g.height * Math.round(physicalScale)) < 0.05);
        results.push({dpr,viewport,geometry:g});
      }
      // An oversized sharp canvas remains 1:1 and scrollable on both axes.
      await page.setViewportSize({width:390,height:300});
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        const v = document.querySelector('#display-viewport');
        v.scrollLeft = 63; v.scrollTop = 67;
      });
      await page.waitForTimeout(150);
      const scrolled = await checkInput();
      assert(scrolled.viewport.scrollLeft > 0 && scrolled.viewport.scrollTop > 0);
      results.push({dpr,checks:'fresh SDL down/up after horizontal and vertical canvas scroll',geometry:scrolled});
      await checkCssRestoration('sharp');
      await page.locator('#display-control summary').click();
      await page.selectOption('#display-scale', 'fit');
      await page.getByRole('button',{name:'Apply display'}).click();
      const fitted = await checkInput();
      assert(fitted.w <= fitted.viewport.clientWidth + 1 && fitted.h <= fitted.viewport.clientHeight + 1);
      assert(fitted.viewport.scrollLeft === 0 && fitted.viewport.scrollTop === 0);
      // Native also remains 1:1 in an undersized viewport.
      await page.selectOption('#display-scale', 'native');
      await page.getByRole('button',{name:'Apply display'}).click();
      const smallNative = await checkInput();
      assert(Math.abs(smallNative.w * dpr / smallNative.width - 1) < 0.001);
      await page.evaluate(() => {
        const v = document.querySelector('#display-viewport');
        v.scrollLeft = 63; v.scrollTop = 67;
      });
      await page.waitForTimeout(150);
      const nativeScrolled = await geometry();
      assert(nativeScrolled.viewport.scrollLeft > 0 && nativeScrolled.viewport.scrollTop > 0);
      await checkCssRestoration('native');
      await page.selectOption('#display-scale', 'sharp');
      await page.getByRole('button',{name:'Apply display'}).click();
      await page.locator('#display-control summary').click();
      await page.setViewportSize({width:1366,height:1000});
      await page.locator('#display-control summary').click();
      await page.selectOption('#display-scale', 'fit');
      await page.getByRole('button',{name:'Apply display'}).click();
      await checkInput();
      await page.reload();
      await page.waitForFunction(() => window.Module?.uplinkPersistence?.ready &&
        typeof MainLoop !== 'undefined' && MainLoop.currentFrameNumber > 10);
      await observeSDL();
      assert.equal(await page.locator('#display-scale').inputValue(), 'fit');
      await page.locator('#display-control summary').click();
      await page.selectOption('#display-scale', 'sharp');
      await page.selectOption('#display-resolution', '800x600');
      await page.getByRole('button',{name:'Apply display'}).click();
      await page.waitForFunction(() => document.querySelector('#canvas').width === 800 &&
        window.Module?.uplinkPersistence?.ready && typeof MainLoop !== 'undefined' && MainLoop.currentFrameNumber > 10);
      await observeSDL();
      assert.equal((await checkInput()).height,600);
      await page.locator('#display-control summary').click();
      await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
      await page.waitForFunction(() => !!document.fullscreenElement);
      await checkInput();
      await page.evaluate(() => document.exitFullscreen());
      await page.waitForFunction(() => !document.fullscreenElement);
      await checkInput();
      await page.locator('#display-control summary').click();
      await page.waitForTimeout(25000); // Allow the original boot/onboarding animation to finish.
      await page.screenshot({path:path.join(out,`sharp-dpr${dpr}.png`),fullPage:true});
      if (dpr === 1) {
        // Image blits create and delete their textures each draw. The remaining
        // nearest textures include the retained FTGL glyph atlases. Compare the old sampler
        // on those same glyph pixels without rebuilding or touching image filters.
        const atlasCount = await page.evaluate(() => {
          const oldBinding = GLctx.getParameter(GLctx.TEXTURE_BINDING_2D);
          let count = 0;
          for (const texture of GL.textures.filter(Boolean)) {
            GLctx.bindTexture(GLctx.TEXTURE_2D, texture);
            // The emulation also retains default textures unrelated to FTGL.
            if (GLctx.getTexParameter(GLctx.TEXTURE_2D, GLctx.TEXTURE_MAG_FILTER) !== GLctx.NEAREST)
              continue;
            GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_MAG_FILTER, GLctx.LINEAR);
            GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_MIN_FILTER, GLctx.LINEAR);
            count++;
          }
          GLctx.bindTexture(GLctx.TEXTURE_2D, oldBinding);
          return count;
        });
        assert(atlasCount > 0);
        await page.mouse.move(20,20);
        await page.waitForTimeout(500);
        await page.screenshot({path:path.join(out,'linear-font-comparison.png'),fullPage:true});
        results.push({atlasCount, comparison:'same native glyph pixels with previous linear sampling'});
      }
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => GLctx.getError()),0);
      await page.locator('#display-control summary').click();
      await page.selectOption('#display-scale', 'native');
      await page.getByRole('button',{name:'Apply display'}).click();
      const native = await geometry();
      assert(Math.abs(native.w * dpr / native.width - 1) < 0.001);
      await checkInput();
      for (const value of ['1280x960', '1600x1200']) {
        await page.selectOption('#display-resolution', value);
        await page.getByRole('button',{name:'Apply display'}).click();
        await page.waitForFunction(expected => document.querySelector('#canvas').width === expected &&
          window.Module?.uplinkPersistence?.ready && typeof MainLoop !== 'undefined' && MainLoop.currentFrameNumber > 10,
          Number(value.split('x')[0]));
        await observeSDL();
        const g = await checkInput();
        assert.equal(g.height, Number(value.split('x')[1]));
        results.push({dpr,resolution:value,geometry:g});
        await page.locator('#display-control summary').click();
      }
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => GLctx.getError()),0);
      results.push({dpr,checks:'saved resolution/scaling, real SDL input, fullscreen entry/exit, no page/GL errors'});
      await context.close();
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log('PASS: integer/fractional DPR, sharp/native scrolling, fitted bounds, pixel origins, SDL input, saved settings, fullscreen');
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode=1;});
