#!/usr/bin/env node
'use strict';
// Deterministic IDBFS test doubles; no browser, IndexedDB or external writes.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../persistence.js'), 'utf8');
const drain = () => new Promise(resolve => setImmediate(resolve));
function setup(options = {}) {
  const calls = [], folders = [], errors = [], statuses = [], dependencies = new Set();
  let previousPreRun = 0, active = 0, maxActive = 0;
  const context = {Module: {preRun() {previousPreRun++;}, setStatus(s){statuses.push(s);}}, ENV: {}, IDBFS: {},
    console: {error(...args){errors.push(args);}}, Promise, Date,
    addRunDependency(id){assert(!dependencies.has(id));dependencies.add(id);},
    removeRunDependency(id){assert(dependencies.delete(id));},
    FS: {
      mkdirTree(dir){if(options.failMkdir && dir.includes('.uplink')) throw Error('mkdir failure');folders.push(dir);},
      mount(type, settings, dir){assert.equal(dir,'/persistent');if(options.failMount)throw Error('mount failure');},
      syncfs(populate, callback){active++;maxActive=Math.max(active,maxActive);calls.push({populate,callback,done:false});}
    }
  };
  vm.runInNewContext(source, context, {filename: 'persistence.js'});
  for(const hook of context.Module.preRun) hook();
  assert.equal(previousPreRun,1, 'existing preRun is preserved');
  function complete(index, error = null) {
    const call = calls[index];assert(call && !call.done);call.done=true;active--;call.callback(error);
  }
  return {m:context.Module, context, calls, folders, errors, statuses, dependencies, complete,
    get maxActive(){return maxActive;}};
}
async function successAndRecovery() {
  const t = setup(), m=t.m;
  assert.equal(m.uplinkPersistence.ready,false);assert.equal(t.dependencies.size,1);
  assert.equal(t.context.ENV.HOME,'/persistent');assert.equal(t.calls[0].populate,true);
  let resolved=false;
  const early=m.uplinkSaveCompleted().then(()=>{resolved=true;});
  await drain();assert.equal(t.calls.length,1);assert.equal(m.uplinkPersistence.pending,1);assert(!resolved);
  t.complete(0);await m.uplinkPersistenceReady;await drain();
  assert.equal(t.dependencies.size,0);assert(m.uplinkPersistence.ready);
  assert(t.folders.includes('/persistent/.uplink/userstmp'));assert(t.folders.includes('/persistent/.uplink/usersold'));
  assert.equal(t.calls.length,2);assert.equal(t.calls[1].populate,false);
  const second=m.uplinkFlushSaves(), third=m.uplinkSaveCompleted();
  assert.equal(m.uplinkPersistence.pending,3);await drain();assert.equal(t.calls.length,2);
  assert.equal(m.uplinkPersistence.lastSavedAt,null);assert(!resolved);
  t.complete(1);await early;await drain();assert(resolved);assert.equal(m.uplinkPersistence.pending,2);
  assert.equal(t.calls.length,3);assert.ok(m.uplinkPersistence.lastSavedAt);
  t.complete(2);await second;await drain();assert.equal(m.uplinkPersistence.pending,1);assert.equal(t.calls.length,4);
  t.complete(3);await third;assert.equal(m.uplinkPersistence.pending,0);assert.equal(t.maxActive,1);
  // A queued success must still run after a previous write rejected.
  const failed=m.uplinkFlushSaves(), rejection=assert.rejects(failed,/quota/);
  const recovery=m.uplinkFlushSaves();assert.equal(m.uplinkPersistence.pending,2);
  await drain();assert.equal(t.calls.length,5);t.complete(4,Error('quota exceeded'));
  await rejection;await drain();assert.equal(m.uplinkPersistence.pending,1);
  assert.match(m.uplinkPersistence.lastError,/quota/);assert.equal(t.calls.length,6);
  t.complete(5);await recovery;assert.equal(m.uplinkPersistence.pending,0);assert.equal(m.uplinkPersistence.lastError,null);
  assert.equal(t.maxActive,1);
}
async function restoreFailure(options = {}) {
  const t=setup(options),m=t.m;
  const readyFailure=assert.rejects(m.uplinkPersistenceReady);
  const early=m.uplinkFlushSaves(), flushFailure=assert.rejects(early);
  if(!options.failMount) t.complete(0, options.failMkdir ? null : Error('restore failure'));
  await readyFailure;await flushFailure;await drain();
  assert.equal(t.dependencies.size,1,'startup must remain blocked');assert.equal(m.uplinkPersistence.ready,false);
  assert.equal(m.uplinkPersistence.pending,0);assert.ok(m.uplinkPersistence.lastError);
  assert.equal(t.calls.filter(c=>!c.populate).length,0,'failed restore must never trigger a write');
  await assert.rejects(m.uplinkFlushSaves());assert.equal(m.uplinkPersistence.pending,0);
  assert.equal(t.calls.filter(c=>!c.populate).length,0);assert(t.errors.length);assert(t.statuses.length);
}
async function transactionalChange() {
  const t=setup(),m=t.m,events=[];
  t.complete(0);await m.uplinkPersistenceReady;
  const failed=m.uplinkPersistSaveChange(()=>events.push('change'),()=>events.push('rollback'));
  const rejection=assert.rejects(failed,/quota/);
  const later=m.uplinkFlushSaves();await drain();
  assert.deepEqual(events,['change']);assert.equal(t.calls.length,2);
  t.complete(1,Error('quota'));await rejection;await drain();
  assert.deepEqual(events,['change','rollback']);assert.equal(t.calls.length,3);
  t.complete(2);await later;assert.equal(m.uplinkPersistence.pending,0);
  const mutationFailed=m.uplinkPersistSaveChange(()=>{events.push('partial');throw Error('write failure');},()=>events.push('recovered'));
  await assert.rejects(mutationFailed,/write failure/);
  assert.deepEqual(events.slice(-2),['partial','recovered']);assert.equal(t.calls.length,3);
  const committed=m.uplinkPersistSaveChange(()=>events.push('commit'),()=>{throw Error('must not roll back');});
  await drain();t.complete(3);await committed;
  const unrecoverable=m.uplinkPersistSaveChange(()=>{throw Error('partial');},()=>{throw Error('rollback failure');});
  await assert.rejects(unrecoverable,/Save recovery failed/);
  assert.equal(m.uplinkPersistence.rollbackFailed,true);
  await assert.rejects(m.uplinkFlushSaves(),/Reload before saving/);
  assert.equal(t.calls.length,4,'failed rollback must block subsequent persistence');
}
(async()=>{
  await successAndRecovery();
  await transactionalChange();
  await restoreFailure();await restoreFailure({failMount:true});await restoreFailure({failMkdir:true});
  console.log('PASS: restore gating, pending queue states, serialized writes, queued recovery, restore/mount/folder failures');
})().catch(error=>{console.error(error);process.exitCode=1;});
