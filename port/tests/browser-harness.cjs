'use strict';
// Actual browser integration checks for the separate platform probe.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');const {requestHandler}=require('./browser-smoke.cjs');
(async()=>{const server=http.createServer(requestHandler);let browser;const out=path.resolve(__dirname,'../../qa');fs.mkdirSync(out,{recursive:true});const results=[];try{
await new Promise((ok,no)=>{server.on('error',no);server.listen(0,'127.0.0.1',ok)});
browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1200,height:1000},deviceScaleFactor:2});
await context.addInitScript(()=>{const OriginalAudio=window.Audio;window.qaMedia=[];window.Audio=function(...args){const a=new OriginalAudio(...args);qaMedia.push(a);return a};window.Audio.prototype=OriginalAudio.prototype;});
const page=await context.newPage(),errors=[],badResources=[],glErrors=[];
page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))badResources.push(r.url())});page.on('console',m=>{if(/INVALID_ENUM|INVALID_OPERATION|Assertion failed/.test(m.text()))glErrors.push(m.text())});
await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
await page.waitForFunction(()=>document.querySelector('#status').textContent==='Running original C++ platform components');
await page.waitForTimeout(1000);
async function click(x,y){const b=await page.locator('#canvas').boundingBox();await page.mouse.click(b.x+x*b.width/800,b.y+y*b.height/600);await page.waitForTimeout(200)}
await click(100,350);await page.keyboard.type('cloud');await click(100,350);await click(100,350);
await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved to IndexedDB');
const saved=await page.evaluate(()=>Module.FS.readFile('/persistent/probe.txt',{encoding:'utf8'}));assert.match(saved,/^3\nbrowser-agentcloud\n$/);results.push('PASS: real mouse/repeated clicks and keyboard produce exact C++ probe contents');
await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Running original C++ platform components');
assert.equal(await page.evaluate(()=>Module.FS.readFile('/persistent/probe.txt',{encoding:'utf8'})),saved);results.push('PASS: actual IndexedDB restores exact probe after same-origin reload');
await page.screenshot({path:path.join(out,'harness-restored-hidpi.png'),fullPage:true});
await click(100,410);await page.waitForFunction(()=>qaMedia.at(-1)?.ended,{},{timeout:10000});let wav=await page.evaluate(()=>{const a=qaMedia.at(-1);return{duration:a.duration,error:a.error?.code,src:a.src}});assert(wav.duration>0&&!wav.error);results.push('PASS: original WAV decoded and reached end after browser gesture');
await click(250,410);await page.waitForFunction(()=>qaMedia.at(-1)?.currentTime>0.2);const music=await page.evaluate(()=>{const a=qaMedia.at(-1);return{duration:a.duration,error:a.error?.code,paused:a.paused,src:a.src}});assert(music.duration>60&&!music.error&&!music.paused);results.push('PASS: original OGG music decoded and playhead advances after gesture');
await click(250,410);await page.waitForFunction(()=>qaMedia.at(-1)?.currentTime>0.1);assert.equal(await page.evaluate(()=>qaMedia.filter(a=>!a.paused).length),1);results.push('PASS: replacing harness music leaves one active media element');
await page.setViewportSize({width:700,height:900});await click(100,350);await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved to IndexedDB');assert.match(await page.evaluate(()=>Module.FS.readFile('/persistent/probe.txt',{encoding:'utf8'})),/^7\nbrowser-agentcloud\n$/);results.push('PASS: resized/high-DPI canvas maps clicks to original C++ coordinates');
await page.screenshot({path:path.join(out,'harness-resized.png'),fullPage:true});
const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();const visibility=await page.evaluate(()=>document.visibilityState);await page.waitForTimeout(5000);await page.bringToFront();await other.close();await click(100,350);results.push('PASS: input remains responsive after second-tab interval; observed visibility='+visibility+' (not proof of multi-minute hidden-tab timing)');
assert.deepEqual(errors,[]);assert.deepEqual(badResources,[]);assert.deepEqual(glErrors,[]);results.push('PASS: no uncaught errors, failed assets or GL enum/operation errors');
fs.writeFileSync(path.join(out,'harness-results.json'),JSON.stringify({results,wav,music,errors,badResources,glErrors},null,2));console.log(results.join('\n'));
}finally{if(browser)await browser.close();if(server.listening)await new Promise(ok=>server.close(ok))}})().catch(e=>{console.error(e);process.exitCode=1});
