'use strict';
// Original-game integration check for a staged subpath or a live Pages URL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');

(async () => {
  let server, browser;
  const output = path.resolve('qa/pages');
  fs.mkdirSync(output, {recursive: true});
  try {
    let url = process.argv[2];
    if (!url) {
      const root = path.resolve(process.env.UPLINK_PAGES_DIR || '_site');
      const mime = {'.html':'text/html', '.js':'text/javascript', '.wasm':'application/wasm',
                    '.data':'application/octet-stream', '.ogg':'audio/ogg', '.json':'application/json'};
      server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (!pathname.startsWith('/uplink-web/')) { res.writeHead(404); return res.end(); }
        const relative = decodeURIComponent(pathname.slice('/uplink-web/'.length)) || 'index.html';
        const file = path.resolve(root, relative);
        if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
        fs.readFile(file, (error, data) => {
          if (error) { res.writeHead(404); return res.end(); }
          res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
          res.end(data);
        });
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      url = `http://127.0.0.1:${server.address().port}/uplink-web/`;
    }
    browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH,
      channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader']});
    const context = await browser.newContext({viewport: {width:1200, height:1000}});
    await context.addInitScript(() => {
      window.qaMusic = [];
      const OriginalAudio = window.Audio;
      window.Audio = function(...args) { const audio = new OriginalAudio(...args); qaMusic.push(audio); return audio; };
      window.Audio.prototype = OriginalAudio.prototype;
    });
    const page = await context.newPage(), errors = [], failed = [], resources = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('response', response => {
      resources.push({url: response.url(), status: response.status()});
      if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failed.push(response.url());
    });
    await page.goto(url);
    await page.waitForTimeout(25000);
    const build = await page.evaluate(async () => {
      const response = await fetch('build.json');
      if (!response.ok) throw Error('Build manifest unavailable');
      return response.json();
    });
    const initial = await page.evaluate(() => ({ready: Module.uplinkPersistence.ready,
      abort: ABORT, gl: GLctx.getError(), frames: MainLoop.currentFrameNumber}));
    assert(initial.ready && !initial.abort && !initial.gl && initial.frames > 5);
    const layout = await page.evaluate(() => ({
      footer: !!document.querySelector('footer, #flush, #debug, #save-status, #log'),
      canvas: document.querySelector('#canvas').getBoundingClientRect().toJSON(),
      viewport: document.querySelector('#display-viewport').getBoundingClientRect().toJSON(),
      bodyHeight: document.body.getBoundingClientRect().height
    }));
    assert.equal(layout.footer, false, 'Game page must not show the debug/save strip');
    assert.equal(layout.bodyHeight, layout.viewport.bottom, 'No shell panel below the scrollable game viewport');
    await page.evaluate(() => {
      window.qaRightButtons = [];
      window.qaContextMenus = [];
      document.addEventListener('contextmenu', event => qaContextMenus.push({
        target: event.target.id || event.target.tagName, prevented: event.defaultPrevented
      }));
      // Observe events actually dequeued and translated for the C++ SDL consumer.
      const makeCEvent = SDL.makeCEvent;
      SDL.makeCEvent = function(event, ptr) {
        const result = makeCEvent.call(this, event, ptr);
        if (event.button === 2 && ['mousedown', 'mouseup'].includes(event.type) && result !== false)
          qaRightButtons.push({type: event.type, button: HEAPU8[ptr + 16]});
        return result;
      };
    });
    const canvasBox = await page.locator('#canvas').boundingBox();
    for (let i = 0; i < 5; i++) {
      await page.mouse.click(canvasBox.x + 50, canvasBox.y + 50, {button:'right'});
      await page.waitForTimeout(100);
    }
    await page.waitForFunction(() => qaRightButtons.length === 10);
    await page.locator('header').click({button:'right'});
    const rightClick = await page.evaluate(() => ({
      buttons: qaRightButtons, menus: qaContextMenus, state: SDL.buttonState
    }));
    assert.deepEqual(rightClick.buttons, Array.from({length:5}, () => [
      {type:'mousedown', button:3}, {type:'mouseup', button:3}
    ]).flat());
    assert.equal(rightClick.state & 4, 0, 'Right button must release between clicks');
    assert.equal(rightClick.menus.filter(event => event.target === 'canvas').length, 5);
    assert(rightClick.menus.filter(event => event.target === 'canvas').every(event => event.prevented));
    assert(rightClick.menus.some(event => event.target !== 'canvas' && !event.prevented),
      'Browser context menu must remain enabled outside the game');
    await page.keyboard.press('Escape');
    await page.screenshot({path: path.join(output, 'menu.png'), fullPage:true});
    async function click(x, y, delay = 900) {
      const box = await page.locator('#canvas').boundingBox();
      await page.mouse.click(box.x + x * box.width / 1024, box.y + y * box.height / 768);
      await page.waitForTimeout(delay);
    }
    await click(320,380); await click(170,168); await click(320,390); await click(300,150);
    for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type('PagesQA', {delay:80});
    await click(300,180); await page.keyboard.type('cloud-test', {delay:80});
    await click(300,210); await page.keyboard.type('cloud-test', {delay:80});
    await click(320,410); await click(490,168); await click(320,390);
    await page.waitForTimeout(24000);
    await click(325,360); await page.waitForTimeout(2000); await click(325,360);
    await page.waitForTimeout(1200);
    await click(465,454);
    await page.waitForFunction(() => qaMusic.some(audio => !audio.paused && audio.currentTime > 0.25));
    const audio = await page.evaluate(() => qaMusic.filter(a => !a.paused).map(a => ({
      src:a.src, time:a.currentTime, duration:a.duration, error:a.error?.code || null
    })));
    assert(audio.length && audio.every(a => a.duration > 60 && !a.error));
    assert(audio.every(a => new URL(a.src).pathname.startsWith(new URL('.', url).pathname)));
    await page.screenshot({path:path.join(output, 'desktop.png'), fullPage:true});
    await page.evaluate(async () => {
      Module.FS.writeFile('/persistent/pages-qa-marker.txt', 'live-pages-reload');
      await Module.uplinkFlushSaves();
    });
    const beforeRetire = await page.evaluate(() => Module.uplinkPersistence.lastSavedAt);
    await click(10,10); await page.waitForTimeout(1500);
    await page.waitForFunction(previous => Module.uplinkPersistence.pending === 0 &&
      Module.uplinkPersistence.lastSavedAt > previous, beforeRetire);
    const saved = await page.evaluate(() => Module.FS.stat('/persistent/.uplink/PagesQA.usr').size);
    assert(saved > 100000);
    await page.reload(); await page.waitForTimeout(18000);
    await click(105,487,1800); await click(530,514);
    await page.keyboard.type('cloud-test', {delay:80}); await click(588,556);
    await page.waitForTimeout(2500); await click(325,360); await page.waitForTimeout(1500);
    const restored = await page.evaluate(() => ({
      marker:Module.FS.readFile('/persistent/pages-qa-marker.txt', {encoding:'utf8'}),
      profileBytes:Module.FS.stat('/persistent/.uplink/PagesQA.usr').size,
      log:Module.FS.readFile('/persistent/.uplink/debug.log', {encoding:'utf8'}).slice(-1400),
      storage:Module.uplinkPersistence, abort:ABORT, gl:GLctx.getError()
    }));
    assert.equal(restored.marker, 'live-pages-reload');
    assert.match(restored.log, /Loading profile[^\n]*success/);
    assert(!restored.abort && !restored.gl && !restored.storage.lastError);
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    await page.screenshot({path:path.join(output, 'reloaded.png'), fullPage:true});
    const result = {url, buildCommit:build.commit, initial, layout, rightClick, savedBytes:saved, audio, restored, errors, failed, resources};
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
