'use strict';
// No Chromium launch and no listening socket: cleanup/error paths use doubles.
const assert = require('node:assert/strict');
const {run, requestHandler} = require('./browser-smoke.cjs');
function serverDouble() {
  return {listening:false, closes:0, once(){}, listen(port, host, done){this.listening=true;done();}, address(){return {port:12345};}, close(done){this.listening=false;this.closes++;done();}};
}
(async()=>{
  for (const url of ['/%E0%A4%A', '/../prototype-secret/private.dat', '/../']) {
    const res={code:0,ended:false,writeHead(code){this.code=code;},end(){this.ended=true;}};
    requestHandler({url},res);assert(res.ended);assert([400,403].includes(res.code));
  }
  const first=serverDouble();
  await assert.rejects(run('game.html',{createServer:()=>first,chromium:{launch:async()=>{throw Error('launch denied');}}}),/launch denied/);
  assert.equal(first.closes,1);
  const second=serverDouble();let browserClosed=0;
  await assert.rejects(run('game.html',{createServer:()=>second,chromium:{launch:async()=>({newPage:async()=>{throw Error('page failure');},close:async()=>{browserClosed++;}})}}),/page failure/);
  assert.equal(browserClosed,1);assert.equal(second.closes,1);
  const third=serverDouble();
  await assert.rejects(run('game.html',{createServer:()=>third,chromium:{launch:async()=>({newPage:async()=>{throw Error('page failure');},close:async()=>{throw Error('close failure');}})}}),/close failure/);
  assert.equal(third.closes,1);
  await assert.rejects(run('../bad'),/Expected/);
  console.log('PASS: smoke harness launch/page/close failure cleanup, bad URL and traversal rejection; no browser attempted');
})().catch(error=>{console.error(error);process.exitCode=1;});
