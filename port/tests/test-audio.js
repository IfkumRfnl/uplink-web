#!/usr/bin/env node
'use strict';
// Exercise the actual EM_JS bridge. No browser/audio/network claims are made.
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const src=fs.readFileSync(path.join(root,fs.readdirSync(root).find(s=>s.startsWith('uplink-source-code-')),'lib/soundgarden/soundgarden_sdlmixer.cpp'),'utf8');
const functions=[...src.matchAll(/EM_JS\((?:void|int), (SgBrowser\w+), \([^\n]*\), \{\n([\s\S]*?)\n\}\);/g)];
assert.equal(functions.length,4);
const listeners={},audios=[],errors=[];
let resumed=0;
class Audio {
  constructor(src){this.src=src;this.requests=[];this.events={};this.ended=false;audios.push(this);}
  play(){return new Promise((resolve,reject)=>this.requests.push({resolve,reject}));}
  pause(){this.paused=true;}
  removeAttribute(name){assert.equal(name,'src');this.src='';}
  load(){this.released=true;}
  addEventListener(name,f){this.events[name]=f;}
}
const ctx={Module:{},Audio,URL,UTF8ToString:s=>s,console:{error(...args){errors.push(args);}},
  SDL:{audioContext:{state:'suspended',resume(){resumed++;return Promise.resolve();}}},
  document:{baseURI:'https://example.invalid/private/game.html',addEventListener(name,f){assert(!listeners[name]);listeners[name]=f;}}};
for(const [,name,body] of functions) vm.runInNewContext(`function ${name}(track, volume) {${body}}`,ctx);
// Volume's sole parameter differs from the playback signature.
const volumeBody=functions.find(x=>x[1]==='SgBrowserMusicVolume')[2];
vm.runInNewContext(`function SgBrowserMusicVolume(volume) {${volumeBody}}`,ctx);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  assert.equal(ctx.SgBrowserMusicFinished(),1);
  ctx.SgBrowserPlayMusic('bluevalley',64);const first=audios[0];
  assert.equal(first.src,'https://example.invalid/private/assets/music/bluevalley.ogg');
  assert.equal(first.volume,0.5);assert(first.loop);assert.equal(ctx.SgBrowserMusicFinished(),0);
  first.requests[0].reject({name:'NotAllowedError'});await tick();
  assert(ctx.Module.uplinkMusic.pending);assert.equal(ctx.SgBrowserMusicFinished(),0);
  listeners.pointerdown();assert.equal(resumed,1);assert.equal(first.requests.length,2);
  first.requests[1].resolve();await tick();assert.equal(ctx.Module.uplinkMusic.pending,false);
  ctx.SgBrowserMusicVolume(256);assert.equal(first.volume,1);
  ctx.SgBrowserMusicVolume(-10);assert.equal(first.volume,0);
  ctx.SgBrowserPlayMusic('myst2',128);const second=audios[1];
  assert(first.paused && first.released);assert.equal(first.src,'');
  ctx.SgBrowserPlayMusic('serenity',128);const third=audios[2];
  second.requests[0].reject({name:'NotSupportedError'});second.events.error();await tick();
  assert.equal(ctx.Module.uplinkMusic.audio,third);assert.equal(ctx.Module.uplinkMusic.failed,false);
  third.requests[0].resolve();await tick();assert.equal(ctx.Module.uplinkMusic.pending,false);
  third.events.error();assert.equal(ctx.SgBrowserMusicFinished(),1);assert.equal(errors.length,1);
  ctx.SgBrowserPlayMusic('mystique',128);const fourth=audios[3];
  ctx.SgBrowserStopMusic();fourth.requests[0].resolve();await tick();
  assert.equal(ctx.Module.uplinkMusic.audio,null);assert.equal(ctx.Module.uplinkMusic.pending,false);
  assert(fourth.paused && fourth.released);assert.equal(ctx.SgBrowserMusicFinished(),1);
  const count=audios.length;listeners.keydown();assert.equal(audios.length,count);
  console.log('PASS: original EM_JS audio bridge, gesture retry, SDL resume, volume, replacement/stop release, stale promises/events, media errors');
})().catch(e=>{console.error(e);process.exitCode=1;});
