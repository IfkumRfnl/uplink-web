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
    for (const dpr of [1, 2]) {
      const context = await browser.newContext({viewport:{width:1366,height:900}, deviceScaleFactor:dpr});
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
            if (['mousedown','mouseup'].includes(event.type) && result !== false)
              qaPointers.push([HEAP32[(ptr+20)>>2], HEAP32[(ptr+24)>>2]]);
            return result;
          };
        });
      }
      await observeSDL();
      async function geometry() {
        return page.evaluate(() => {
          const c = document.querySelector('#canvas'), box = c.getBoundingClientRect();
          return {width:c.width,height:c.height,w:box.width,h:box.height,
            dpr:devicePixelRatio,filter:getComputedStyle(c).imageRendering,
            backing:[GLctx.drawingBufferWidth, GLctx.drawingBufferHeight]};
        });
      }
      async function checkInput() {
        const g = await geometry(), box = await page.locator('#canvas').boundingBox();
        await page.mouse.click(box.x + 200 * box.width / g.width,
          box.y + 200 * box.height / g.height);
        await page.waitForTimeout(100); // SDL consumes queued DOM events on the next frame.
        const mouse = await page.evaluate(() => qaPointers.at(-1));
        assert(mouse, 'The C++ SDL consumer must receive a pointer event');
        assert(Math.abs(mouse[0] - 200) <= 1 && Math.abs(mouse[1] - 200) <= 1,
          `SDL input drift: ${mouse}`);
        assert.equal(g.filter, 'pixelated');
        assert.deepEqual(g.backing, [g.width,g.height]);
        assert(Math.abs(g.w/g.h - g.width/g.height) < 0.001);
        return g;
      }
      for (const viewport of [{width:1366,height:900},{width:1920,height:1080},
        {width:800,height:700},{width:390,height:844}]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(150);
        const g = await checkInput();
        assert(g.w <= viewport.width + 1 && g.h <= viewport.height + 1);
        const physicalScale = g.w * dpr / g.width;
        if (physicalScale >= 1) assert(Math.abs(physicalScale - Math.round(physicalScale)) < 0.001);
        results.push({dpr,viewport,geometry:g});
      }
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
      results.push({dpr,checks:'saved resolution/scaling, real SDL input, fullscreen entry/exit, no page/GL errors'});
      await context.close();
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log('PASS: DPR1/2, four viewport sizes, native game buffer, SDL pointer coordinates, saved settings, fullscreen');
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode=1;});
