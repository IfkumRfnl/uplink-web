'use strict';
// Original game plus read-only QA helpers. Actions are real DOM/SDL events.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {chromium} = require('playwright');
const {requestHandler} = require('./browser-smoke.cjs');
(async () => {
  const out = path.resolve('qa/ui-scale');
  fs.mkdirSync(out, {recursive:true});
  const server = http.createServer((req, res) => {
    const file = new URL(req.url, 'http://local').pathname.slice(1);
    if (/^game\.(js|wasm|data)$/.test(file)) {
      res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' :
        file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
      return fs.createReadStream(path.resolve('qa/renderer', file)).pipe(res);
    }
    requestHandler(req, res);
  });
  let browser;
  const results = [];
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,
      headless:true, args:['--enable-unsafe-swiftshader']});
    for (const config of [
      {resolution:'800x600',uiSize:125,dpr:1},
      {resolution:'1024x768',uiSize:125,dpr:1.5},
      {resolution:'1280x960',uiSize:150,dpr:2},
      {resolution:'1600x1200',uiSize:200,dpr:1.25}
    ]) {
      const context = await browser.newContext({viewport:{width:1366,height:1000},deviceScaleFactor:config.dpr});
      await context.addInitScript(settings => {
        if (!localStorage.getItem('uplink-display-v1'))
          localStorage.setItem('uplink-display-v1', JSON.stringify(settings));
        window.qaErrors = [];
        window.addEventListener('error', event => qaErrors.push(event.message));
        // Glyph uploads must never overwrite pixels of an earlier cached glyph.
        const rectangles = new WeakMap();
        window.qaAtlasOverlaps = [];
        const original = WebGLRenderingContext.prototype.texSubImage2D;
        WebGLRenderingContext.prototype.texSubImage2D = function(...args) {
          if (args.length===9) {
            const texture=this.getParameter(this.TEXTURE_BINDING_2D);
            const box={x:args[2],y:args[3],w:args[4],h:args[5]};
            const previous=rectangles.get(texture)||[];
            for(const p of previous) if(box.x<p.x+p.w && p.x<box.x+box.w &&
              box.y<p.y+p.h && p.y<box.y+box.h) qaAtlasOverlaps.push({box,previous:p});
            previous.push(box);rectangles.set(texture,previous);
          }
          return original.apply(this,args);
        };
      }, {...config,scale:'fit'});
      const page = await context.newPage(), errors = [], warnings = [];
      page.on('pageerror', e => {errors.push(String(e));console.log(config,e.stack);});
      page.on('console', m => {if (/INVALID_|Assertion|abort\(/.test(m.text())) warnings.push(m.text());});
      const prefix = `${config.resolution}-${config.uiSize}-dpr${config.dpr}`;
      async function state() {
        return page.evaluate(() => {Module._qaUiSnapshot(); return Module.qaUi;});
      }
      async function button(name) {
        return page.evaluate(name => {
          Module.qaButtonName = name; Module._qaUiButton(); return Module.qaButton;
        },name);
      }
      async function waitButton(name) {
        try {
          await page.waitForFunction(name => {
            Module.qaButtonName = name; Module._qaUiButton(); return Module.qaButton?.x >= 0;
          },name);
        } catch(error) {
          await page.locator('#canvas').screenshot({path:path.join(out,`${prefix}-failure.png`)});
          console.log('failed button',name,await state(),await page.evaluate(() => qaAtlasOverlaps));
          throw error;
        }
      }
      async function click(x,y,delay=700) {
        const s = await state(), box = await page.locator('#canvas').boundingBox();
        await page.mouse.click(box.x+x*box.width/s.width, box.y+y*box.height/s.height);
        await page.waitForTimeout(delay);
      }
      async function clickButton(name,delay=700) {
        await waitButton(name);
        const b = await button(name);
        await click(b.x+b.w/2,b.y+b.h/2,delay);
      }
      async function snap(name) {
        await page.mouse.move(10,10);
        await page.waitForTimeout(700);
        await page.locator('#canvas').screenshot({path:path.join(out,`${prefix}-${name}.png`)});
        console.log(prefix,name);
      }
      await page.goto(`http://127.0.0.1:${server.address().port}/game.html`);
      await page.waitForFunction(() => window.Module?.uplinkPersistence?.ready &&
        typeof MainLoop !== 'undefined' && MainLoop.currentFrameNumber > 10);
      await page.waitForTimeout(25000);
      await page.keyboard.press('Escape');
      const initial = await state();
      const geometry = await page.evaluate(() => ({
        width:canvas.width,height:canvas.height,logical:[UplinkDisplay.logicalWidth,UplinkDisplay.logicalHeight],
        backing:[GLctx.drawingBufferWidth,GLctx.drawingBufferHeight]
      }));
      const physical = config.resolution.split('x').map(Number);
      assert.deepEqual([geometry.width,geometry.height],physical);
      assert.deepEqual(geometry.backing,physical);
      assert.deepEqual([initial.width,initial.height],geometry.logical);
      assert(Math.abs(initial.scale-physical[0]/initial.width)<1e-6);
      assert(initial.textWidth > 80 && initial.textWidth < 250, 'Text measurements remain logical');
      await snap('onboarding');
      // Real motion through the canvas must reach C++ in logical coordinates.
      const b = await page.locator('#canvas').boundingBox();
      await page.mouse.move(b.x+200*b.width/initial.width,b.y+200*b.height/initial.height);
      await page.waitForTimeout(150);
      const pointer = (await state()).mouse;
      assert(pointer.every(v => Math.abs(v-200)<3),`logical mouse drift: ${pointer}`);
      await click(320,380);
      await click(170,168);
      await click(320,390);
      await waitButton('nametext 0 0');
      await clickButton('nametext 0 0');
      for (let i=0;i<12;i++) await page.keyboard.press('Backspace');
      await page.keyboard.type('ScaleQA');
      await clickButton('passwordtext 0 0'); await page.keyboard.type('cloud-test');
      await clickButton('passwordtext2 0 0'); await page.keyboard.type('cloud-test');
      assert.equal((await button('nametext 0 0')).caption,'ScaleQA');
      await snap('registration');
      assert.deepEqual(await page.evaluate(() => qaAtlasOverlaps),[],'Glyphs must not overwrite the atlas');
      await click(320,410);
      await snap('gateway');
      await clickButton('nearestgateway_location 0'); await click(320,390);
      await page.waitForTimeout(24000);
      await click(325,360); await page.waitForTimeout(2000); await click(325,360);
      await click(465,454);
      await waitButton('hud_memory');
      await snap('desktop');
      await clickButton('worldmap_smallmap');
      await page.waitForTimeout(1500);
      await page.evaluate(() => Module._qaFreezeMapLabels());
      await snap('map');
      await clickButton('worldmap_close');
      await clickButton('hud_memory');
      await waitButton('memory_title');
      await snap('memory');
      // Exercise both-axis browser scrolling with the same original game alive.
      await page.locator('#display-control summary').click();
      await page.selectOption('#display-scale','native');
      await page.getByRole('button',{name:'Apply display'}).click();
      await page.locator('#display-control summary').click();
      await page.setViewportSize({width:390,height:300});
      await page.waitForTimeout(150);
      await page.evaluate(() => {const v=document.querySelector('#display-viewport');v.scrollLeft=63;v.scrollTop=67;});
      await page.waitForTimeout(150);
      const scroll = await page.evaluate(() => {
        const v=document.querySelector('#display-viewport'); return [v.scrollLeft,v.scrollTop];
      });
      assert(scroll[0]>0 && scroll[1]>0);
      const box=await page.locator('#canvas').boundingBox();
      await page.mouse.move(box.x+200*box.width/initial.width,box.y+200*box.height/initial.height);
      await page.waitForTimeout(150);
      assert((await state()).mouse.every(v => Math.abs(v-200)<4));
      await page.setViewportSize({width:1366,height:1000});
      // Changing DPR/zoom while alive must only change presentation, never the
      // logical projection, font density, backing size or pointer conversion.
      if(config.dpr===1.5) {
        const cdp=await context.newCDPSession(page);
        await cdp.send('Emulation.setDeviceMetricsOverride',{
          width:1366,height:1000,deviceScaleFactor:1.75,mobile:false
        });
        await page.waitForFunction(() => devicePixelRatio===1.75);
        await page.waitForTimeout(150);
        const zoomed=await page.locator('#canvas').boundingBox();
        assert(Math.abs(zoomed.width-physical[0]/1.75)<.05);
        for(const origin of [zoomed.x,zoomed.y])
          assert(Math.abs(origin*1.75-Math.round(origin*1.75))<.04);
        await page.mouse.move(zoomed.x+200*zoomed.width/initial.width,zoomed.y+200*zoomed.height/initial.height);
        await page.waitForTimeout(150);
        const afterZoom=await state();
        assert.equal(afterZoom.scale,initial.scale);
        assert(afterZoom.mouse.every(v=>Math.abs(v-200)<4));
        assert.deepEqual(await page.evaluate(() => [canvas.width,canvas.height]),physical);
        await cdp.detach();
      }
      await page.locator('#display-control summary').click();
      await page.selectOption('#display-scale','fit');
      await page.getByRole('button',{name:'Apply display'}).click();
      await page.locator('#display-control summary').click();
      await snap('before-loss');
      for (let count=1;count<=2;count++) {
        await page.evaluate(() => {window.qaLoss=GLctx.getExtension('WEBGL_lose_context');qaLoss.loseContext();});
        await page.waitForFunction(() => GLctx.isContextLost());
        await page.waitForTimeout(150);
        await page.evaluate(() => qaLoss.restoreContext());
        await page.waitForFunction(count => Module.uplinkRendererRestores===count,count);
      }
      await snap('restored');
      assert.equal((await state()).scale,initial.scale);
      // A failed queued-save flush or unavailable display storage must leave
      // the running scale intact and show an actionable message.
      if(config.uiSize===200) {
        await page.locator('#display-control summary').click();
        await page.selectOption('#display-ui-size','100');
        await page.evaluate(() => {
          window.qaFlush=Module.uplinkFlushSaves;
          Module.uplinkFlushSaves=()=>Promise.reject(Error('QA flush rejected'));
        });
        await page.getByRole('button',{name:'Apply display'}).click();
        await page.waitForFunction(() => document.querySelector('#display-message').textContent==='QA flush rejected');
        assert.equal((await state()).scale,initial.scale);
        await page.evaluate(() => {
          Module.uplinkFlushSaves=qaFlush;
          window.qaSetItem=Storage.prototype.setItem;
          Storage.prototype.setItem=function(){throw Error('QA display storage unavailable');};
        });
        await page.getByRole('button',{name:'Apply display'}).click();
        await page.waitForFunction(() => document.querySelector('#display-message').textContent.includes('Enable browser storage'));
        assert.equal((await state()).scale,initial.scale);
        await page.evaluate(() => {Storage.prototype.setItem=qaSetItem;});
      }
      assert.equal(await page.evaluate(() => GLctx.getError()),0);
      // Restart through the actual Display control; the saved UI size survives.
      await page.locator('#display-control summary').click();
      await page.selectOption('#display-ui-size','100');
      await page.getByRole('button',{name:'Apply display'}).click();
      await page.waitForFunction(() => Module?._qaUiSnapshot && Module.uplinkPersistence?.ready &&
        document.querySelector('#display-ui-size').value==='100' &&
        UplinkDisplay.logicalWidth===UplinkDisplay.width && MainLoop.currentFrameNumber>10);
      const reset=await state();
      assert.equal(reset.scale,1);
      assert.deepEqual([reset.width,reset.height],physical);
      await page.locator('#display-control summary').click();
      await page.selectOption('#display-ui-size',String(config.uiSize));
      await page.getByRole('button',{name:'Apply display'}).click();
      await page.waitForFunction(size => Module?._qaUiSnapshot && Module.uplinkPersistence?.ready &&
        document.querySelector('#display-ui-size').value===String(size) &&
        UplinkDisplay.logicalWidth<UplinkDisplay.width && MainLoop.currentFrameNumber>10,config.uiSize);
      assert.equal((await state()).scale,initial.scale);
      assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
      assert.deepEqual(await page.evaluate(() => qaErrors),[]);
      assert.deepEqual(await page.evaluate(() => qaAtlasOverlaps),[],'Hinted glyph atlas rectangles must not overlap');
      results.push({config,initial,geometry,scroll,checks:'registration, gateway, desktop, map, memory, real logical input, scrolling, two context restores, UI-size restart and settings reload',
        dprChange:config.dpr===1.5,restartFailureChecks:config.uiSize===200});
      await context.close();
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log('PASS: original game at 125/150/200%, four resolutions and integer/fractional DPR');
  } finally {
    if(browser) await browser.close();
    if(server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error);process.exitCode=1;});
