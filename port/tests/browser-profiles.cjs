'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const {requestHandler} = require('./browser-smoke.cjs');
const {MAX_BACKUP_BYTES} = require('../../prototype/profile-backups.js');

(async () => {
  const server = http.createServer(requestHandler);
  let browser;
  fs.mkdirSync('qa/profiles', {recursive:true});
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,
      headless:true, args:['--enable-unsafe-swiftshader']});
    const context = await browser.newContext({viewport:{width:1200,height:1000}, acceptDownloads:true});
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(45000);
    page.on('pageerror', error=>errors.push(String(error)));
    const origin = `http://127.0.0.1:${server.address().port}/game.html`;
    const profilePath = '/persistent/.uplink/ProfileQA.usr';
    const tmpPath = '/persistent/.uplink/ProfileQA.tmp';
    async function ready() {
      await page.waitForFunction(()=>window.Module?.uplinkPersistence?.ready &&
        typeof MainLoop !== 'undefined' && MainLoop.currentFrameNumber > 10);
    }
    async function click(x,y,delay=700) {
      const box=await page.locator('#canvas').boundingBox();
      await page.mouse.click(box.x+x*box.width/1024,box.y+y*box.height/768);
      await page.waitForTimeout(delay);
    }
    async function openControls() {
      if (!await page.locator('#profile-control').evaluate(el=>el.open))
        await page.locator('#profile-control summary').click();
    }
    async function upload(name,buffer) {
      await openControls();
      await page.locator('#profile-import').setInputFiles({name,mimeType:'application/json',buffer});
      await page.waitForFunction(()=>!document.querySelector('#profile-import').disabled);
    }
    async function profileBytes() {
      return page.evaluate(path=>Array.from(Module.FS.readFile(path)),profilePath);
    }
    await page.addInitScript(()=>{
      if(sessionStorage.getItem('qa-restore-gated'))return;
      sessionStorage.setItem('qa-restore-gated','1');
      const original=indexedDB.open.bind(indexedDB);
      indexedDB.open=function(...args){
        const request=original(...args);
        if(args[0]==='/persistent')Object.defineProperty(request,'onsuccess',{
          configurable:true,
          set(callback){request.addEventListener('success',event=>{
            window.qaReleaseRestore=()=>{indexedDB.open=original;callback.call(request,event);};
          },{once:true});}
        });
        return request;
      };
    });
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof qaReleaseRestore==='function');
    await page.locator('#profile-control summary').click();
    assert.equal(await page.locator('#profile-import').isDisabled(),true);
    await page.evaluate(()=>qaReleaseRestore());await ready();
    await page.waitForFunction(()=>!document.querySelector('#profile-import').disabled);
    assert.equal(await page.locator('#profile-control').evaluate(el=>el.open),true);
    await page.locator('#profile-control summary').click();
    console.log('PASS: Saves opened during startup enables automatically after storage restore');
    await page.waitForTimeout(18000);
    console.log('Browser ready; creating profile');
    await click(320,380);await click(170,168);await click(320,390);await click(300,150);
    for(let i=0;i<12;i++)await page.keyboard.press('Backspace');
    await page.keyboard.type('ProfileQA');await click(300,180);await page.keyboard.type('cloud-test');
    await click(300,210);await page.keyboard.type('cloud-test');await click(320,410);
    await click(490,168);await click(320,390);await page.waitForTimeout(24000);
    await click(325,360);await page.waitForTimeout(2000);await click(325,360);await click(465,454);
    await click(10,10,2000);await page.evaluate(()=>Module.uplinkFlushSaves());
    await page.screenshot({path:'qa/profiles/created-profile.png',fullPage:true});
    fs.writeFileSync('qa/profiles/creation.log',await page.evaluate(()=>Module.FS.readFile('/persistent/.uplink/debug.log',{encoding:'utf8'})));
    await page.waitForFunction(path=>Module.FS.analyzePath(path).exists,profilePath);
    const original = await profileBytes();assert(original.length>100000);
    assert.equal(await page.evaluate(()=>Module._uplinkProfilesCanImport()),1);
    console.log('PASS: real game profile created and saved');
    await openControls();await page.locator('#profile-select').selectOption('ProfileQA.usr');
    const downloadEvent=page.waitForEvent('download');await page.locator('#profile-export').click();
    const download=await downloadEvent;assert.equal(download.suggestedFilename(),'ProfileQA.uplink-save');
    const contents=fs.readFileSync(await download.path());
    assert.deepEqual(Array.from(Buffer.from(JSON.parse(contents).data,'base64')),original);
    await page.waitForFunction(()=>!document.querySelector('#profile-export').disabled);
    // Browser file-picker cancellation resets the control for the next operation.
    await page.locator('#profile-import').dispatchEvent('cancel');
    assert.match(await page.locator('#profile-message').innerText(),/cancelled/);
    assert.deepEqual(await profileBytes(),original);
    const picker=page.waitForEvent('filechooser');await page.locator('#profile-import').click();
    await (await picker).setFiles([]);
    assert.deepEqual(await profileBytes(),original);
    page.once('dialog',dialog=>dialog.dismiss());await upload(download.suggestedFilename(),contents);
    assert.match(await page.locator('#profile-message').innerText(),/cancelled/);
    assert.deepEqual(await profileBytes(),original);
    console.log('PASS: download contains exact save wrapper; picker and overwrite cancellation preserve profile');
    // Move into a fresh browser context: no existing saves or IndexedDB.
    const moved=await browser.newContext({viewport:{width:1200,height:1000}});
    const target=await moved.newPage();target.setDefaultTimeout(45000);await target.goto(origin);
    await target.waitForFunction(()=>window.Module?.uplinkPersistence?.ready &&
      typeof MainLoop !== 'undefined' && MainLoop.currentFrameNumber > 10);
    // Original first-time registration precedes the login screen. Seed only
    // completed-onboarding options, never a profile, in this new browser.
    const options=await page.evaluate(()=>Array.from(Module.FS.readFile('/persistent/.uplink/options')));
    await target.evaluate(async bytes=>{
      Module.FS.writeFile('/persistent/.uplink/options',new Uint8Array(bytes));await Module.uplinkFlushSaves();
    },options);
    await target.reload();
    await target.waitForFunction(()=>window.Module?.uplinkPersistence?.ready &&
      typeof MainLoop !== 'undefined' && MainLoop.currentFrameNumber > 10);
    await target.waitForFunction(()=>Module._uplinkProfilesCanImport()===1);
    await target.locator('#profile-control summary').click();
    await target.locator('#profile-import').setInputFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer:contents});
    await target.waitForFunction(()=>!document.querySelector('#profile-import').disabled);
    assert.match(await target.locator('#profile-message').innerText(),/imported and saved/);
    assert.deepEqual(await target.evaluate(path=>Array.from(Module.FS.readFile(path)),profilePath),original);
    await target.reload();await target.waitForFunction(()=>window.Module?.uplinkPersistence?.ready &&
      typeof MainLoop !== 'undefined' && MainLoop.currentFrameNumber > 10);
    assert.deepEqual(await target.evaluate(path=>Array.from(Module.FS.readFile(path)),profilePath),original);
    await moved.close();
    console.log('PASS: backup imports into a browser with no profiles and restores exact bytes on reload');
    // A different valid wrapper stands in for a later saved revision. Import must
    // require the explicit matching-name dialog and remove stale recovery .tmp.
    const newer=Buffer.from(original);newer[newer.length-1]^=1;
    createHash('sha1').update(newer.subarray(29)).digest().swap32().copy(newer,9);
    await page.evaluate(async ({bytes,profilePath,tmpPath})=>{
      Module.FS.writeFile(profilePath,new Uint8Array(bytes));
      Module.FS.writeFile(tmpPath,new Uint8Array(bytes));await Module.uplinkFlushSaves();
    },{bytes:Array.from(newer),profilePath,tmpPath});
    page.once('dialog',dialog=>{assert.match(dialog.message(),/“ProfileQA”/);dialog.accept();});
    await upload(download.suggestedFilename(),contents);
    assert.match(await page.locator('#profile-message').innerText(),/imported and saved/);
    assert.deepEqual(await profileBytes(),original);
    assert.equal(await page.evaluate(path=>Module.FS.analyzePath(path).exists,tmpPath),false);
    for(let i=0;i<2;i++){
      page.once('dialog',dialog=>dialog.accept());await upload(download.suggestedFilename(),contents);
      assert.match(await page.locator('#profile-message').innerText(),/imported and saved/);
    }
    const again=page.waitForEvent('download');await page.locator('#profile-export').click();
    assert.equal(fs.readFileSync(await (await again).path(),'utf8'),contents.toString('utf8'));
    await page.waitForFunction(()=>!document.querySelector('#profile-import').disabled);
    console.log('PASS: explicit named overwrite, stale recovery cleanup and repeated import/export');
    const bad=[['ProfileQA.usr',Buffer.from(original)],['ProfileQA.uplink-save',contents.subarray(0,-20)],
      ['ProfileQA.uplink-save',Buffer.from('null')],['ProfileQA.uplink-save',Buffer.from('[]')],
      ['ProfileQA.uplink-save',Buffer.alloc(MAX_BACKUP_BYTES+1)]];
    for(const change of [{version:2},{bytes:'12'},{filename:'../ProfileQA.usr'},{filename:'Other.usr'},
      {sha256:'0'.repeat(64)},{data:'!'.repeat(JSON.parse(contents).data.length)}])
      bad.push(['ProfileQA.uplink-save',Buffer.from(JSON.stringify({...JSON.parse(contents),...change}))]);
    for(const [name,buffer] of bad){
      await upload(name,buffer);assert.match(await page.locator('#profile-message').innerText(),/Backup failed/);
      assert.deepEqual(await profileBytes(),original);assert.equal(await page.locator('#profile-import').inputValue(),'');
    }
    console.log('PASS: malformed, truncated, wrong-type, wrong-name, corrupt and oversized uploads leave saves unchanged');
    // Real aborted IndexedDB transaction: disk and MEMFS both retain the old
    // revision, with a failure message and an operational game loop.
    await page.evaluate(async ({bytes,profilePath,tmpPath})=>{
      Module.FS.writeFile(profilePath,new Uint8Array(bytes));Module.FS.writeFile(tmpPath,new Uint8Array(bytes));
      await Module.uplinkFlushSaves();
      window.qaTransaction=IDBDatabase.prototype.transaction;window.qaAborted=0;
      IDBDatabase.prototype.transaction=function(...args){const transaction=qaTransaction.apply(this,args);
        if(args[1]==='readwrite'){qaAborted++;queueMicrotask(()=>transaction.abort());}return transaction;};
    },{bytes:Array.from(newer),profilePath,tmpPath});
    page.once('dialog',dialog=>dialog.accept());await upload(download.suggestedFilename(),contents);
    assert.match(await page.locator('#profile-message').innerText(),/Backup failed/);
    assert.deepEqual(await profileBytes(),Array.from(newer));
    const failure=await page.evaluate(path=>({aborted:qaAborted,status:{...Module.uplinkPersistence},
      temporary:Array.from(Module.FS.readFile(path)),inert:Module.canvas.inert,frame:MainLoop.currentFrameNumber}),tmpPath);
    assert(failure.aborted && failure.status.lastError && !failure.status.pending && !failure.inert);
    assert.deepEqual(failure.temporary,Array.from(newer));
    await page.waitForFunction(frame=>MainLoop.currentFrameNumber>frame,failure.frame);
    await page.reload();await ready();assert.deepEqual(await profileBytes(),Array.from(newer));
    await openControls();page.once('dialog',dialog=>dialog.accept());await upload(download.suggestedFilename(),contents);
    assert.match(await page.locator('#profile-message').innerText(),/imported and saved/);
    await page.reload();await ready();assert.deepEqual(await profileBytes(),original);
    console.log('PASS: aborted storage transaction rolls back both files, survives reload and permits retry');
    // Use the imported profile through the original native login/password flow.
    await click(105,487,1800);await click(530,514);await page.keyboard.type('cloud-test');await click(588,556);
    await page.waitForTimeout(2500);await click(325,360,1500);
    const log=await page.evaluate(()=>Module.FS.readFile('/persistent/.uplink/debug.log',{encoding:'utf8'}));
    assert.match(log,/Loading profile[^\n]*success/);
    await openControls();
    const liveSave=await profileBytes();
    assert.equal(await page.evaluate(()=>Module._uplinkProfilesCanImport()),0);
    await page.locator('#profile-select').selectOption('ProfileQA.usr');
    const liveDownload=page.waitForEvent('download');await page.locator('#profile-export').click();
    const liveContents=JSON.parse(fs.readFileSync(await (await liveDownload).path(),'utf8'));
    assert.deepEqual(Array.from(Buffer.from(liveContents.data,'base64')),liveSave);
    await page.waitForFunction(()=>!document.querySelector('#profile-import').disabled);
    assert.equal(await page.evaluate(()=>Module._uplinkProfilesCanImport()),0);
    await upload(download.suggestedFilename(),contents);
    assert.match(await page.locator('#profile-message').innerText(),/login screen/);
    const state=await page.evaluate(()=>({abort:ABORT,gl:GLctx.getError(),status:Module.uplinkPersistence}));
    assert(!state.abort && !state.gl);assert.deepEqual(errors,[]);
    await page.screenshot({path:'qa/profiles/restored-profile.png',fullPage:true});
    fs.writeFileSync('qa/profiles/results.json',JSON.stringify({saveBytes:original.length,failure,state,errors},null,2));
    console.log('PASS: imported profile loads with original password; live export preserves the save and live import is rejected');
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
