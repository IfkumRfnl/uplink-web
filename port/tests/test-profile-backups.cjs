'use strict';
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const backups = require('../../prototype/profile-backups.js');
const dir = '/persistent/.uplink/';
function save(seed = 1) {
  const plain = Buffer.alloc(128, seed);
  plain.write('SAV62\0', 0, 'binary'); plain.writeInt32LE(0, 6); plain.writeInt32LE(1, 10);
  const payload = Uint8Array.from(plain, value => (value + 128) & 255);
  const hash = createHash('sha1').update(payload).digest();
  return Uint8Array.from(Buffer.concat([Buffer.from('REDSHRT2\0', 'binary'),
    Buffer.from(hash).swap32(), payload]));
}
function file(backup) { return {name:backup.name, size:Buffer.byteLength(backup.text), text:async()=>backup.text}; }
function environment() {
  const files = new Map(), events = [];
  const m = {uplinkPersistence:{ready:true}, canImport:true, failPersist:false, failRename:false,
    canvas:{inert:false, blur(){events.push('blur');}},
    _uplinkProfilesBeginImport(){events.push('begin'); return Number(m.canImport);},
    _uplinkProfilesEndImport(success){events.push(['end',success]);},
    async uplinkFlushSaves(){events.push('flush'); if(m.failPersist) throw Error('quota');},
    async uplinkPersistSaveChange(change,rollback){try {change();await m.uplinkFlushSaves();}catch(e){rollback();throw e;}},
    FS:{
      analyzePath(path){return {exists:files.has(path)};},
      isFile(mode){return mode===1;}, lstat(path){assert(files.has(path));return {mode:1};},
      stat(path){return {size:files.get(path).length,mtime:new Date(0)};},
      utime(path,atime,mtime){assert(files.has(path));assert(mtime>0);},
      readFile(path){assert(files.has(path));return files.get(path).slice();},
      readdir(){return ['.', '..', ...[...files.keys()].map(path=>path.slice(dir.length))];},
      writeFile(path,bytes){files.set(path,bytes.slice());},
      rename(from,to){if(m.failRename)throw Error('rename failed');files.set(to,files.get(from));files.delete(from);},
      unlink(path){assert(files.delete(path));}
    }};
  return {m, files, events};
}
(async () => {
  const original = save();
  const backup = await backups.encode('Test_Agent-1.usr', original);
  assert.deepEqual((await backups.decode(file(backup))).bytes, original);
  const t = environment(); let confirmations=[];
  const service = backups.create(t.m, async name=>{confirmations.push(name);return true;});
  assert.equal(await service.importProfile(file(backup)), true);
  assert.deepEqual(t.files.get(dir+'Test_Agent-1.usr'),original);
  assert.equal(t.m.canvas.inert,false);
  assert.deepEqual(service.list(),['Test_Agent-1.usr']);
  assert.deepEqual(await service.exportProfile('Test_Agent-1.usr'),backup);
  // Existing .tmp recovery saves must not shadow the imported profile later.
  t.files.set(dir+'Test_Agent-1.tmp',save(2));
  for(let count=0;count<3;count++)assert.equal(await service.importProfile(file(backup)),true);
  assert.deepEqual(confirmations,Array(3).fill('Test_Agent-1'));
  assert(!t.files.has(dir+'Test_Agent-1.tmp'));
  const cancelled = backups.create(t.m, async()=>false);
  const previous=save(3);t.files.set(dir+'Test_Agent-1.usr',previous);
  assert.equal(await cancelled.importProfile(file(backup)),false);
  assert.deepEqual(t.files.get(dir+'Test_Agent-1.usr'),previous);
  assert.deepEqual(t.events.at(-1),['end',0]);
  t.m.failPersist=true;t.files.set(dir+'Test_Agent-1.tmp',save(4));
  await assert.rejects(service.importProfile(file(backup)),/quota/);
  assert.deepEqual(t.files.get(dir+'Test_Agent-1.usr'),previous);
  assert.deepEqual(t.files.get(dir+'Test_Agent-1.tmp'),save(4));
  assert(!t.files.has(dir+'.profile-import-stage'));
  assert.equal(t.m.canvas.inert,false);
  const newBackup=await backups.encode('New.usr',save(5));
  await assert.rejects(service.importProfile(file(newBackup)),/quota/);
  assert(!t.files.has(dir+'New.usr'));
  t.m.failPersist=false;t.m.failRename=true;
  await assert.rejects(service.importProfile(file(newBackup)),/rename/);
  assert(!t.files.has(dir+'New.usr'));assert(!t.files.has(dir+'.profile-import-stage'));
  t.m.failRename=false;
  const write=t.m.FS.writeFile;
  t.m.FS.writeFile=(path,bytes)=>{
    if(path.endsWith('.profile-import-stage')){write(path,bytes.subarray(0,4));throw Error('partial staging write');}
    throw Error('Untouched profiles must not be rewritten during staging recovery');
  };
  await assert.rejects(service.importProfile(file(backup)),/partial staging write/);
  assert.deepEqual(t.files.get(dir+'Test_Agent-1.usr'),previous);
  assert.deepEqual(t.files.get(dir+'Test_Agent-1.tmp'),save(4));
  assert(!t.files.has(dir+'.profile-import-stage'));
  t.m.FS.writeFile=write;
  t.m.failRename=false;t.m.canImport=false;
  await assert.rejects(service.importProfile(file(newBackup)),/login screen/);
  assert(!t.files.has(dir+'New.usr'));
  t.m.canImport=true;
  assert.equal(await service.importProfile(file(newBackup)),true);
  const recoveryOnly=await backups.encode('Recovery.usr',save(6));
  t.files.set(dir+'Recovery.tmp',save(7));
  assert.equal(await cancelled.importProfile(file(recoveryOnly)),false);
  assert.deepEqual(t.files.get(dir+'Recovery.tmp'),save(7));
  assert(!t.files.has(dir+'Recovery.usr'));
  assert.equal(await service.importProfile(file(recoveryOnly)),true);
  assert(!t.files.has(dir+'Recovery.tmp'));
  const invalid = [null, {name:'x.usr',size:10,text:async()=>''},
    {...file(backup),size:backups.MAX_BACKUP_BYTES+1,text:async()=>{throw Error('must not read');}},
    file({...backup,text:backup.text.slice(0,-20)}), file({...backup,text:'[]'}),
    file({...backup,text:'null'}), file({...backup,text:'"wrong-type"'})];
  function altered(changes,name=backup.name){return file({name,text:JSON.stringify({...JSON.parse(backup.text),...changes})});}
  invalid.push(altered({version:2}),altered({format:'other'}),altered({bytes:'128'}),
    altered({bytes:backups.MAX_SAVE_BYTES+1}),altered({filename:'../escape.usr'}),
    altered({filename:'a\\escape.usr'}),altered({filename:'a.usr/escape'}),
    altered({filename:'x'.repeat(61)+'.usr'}),altered({filename:' Test.usr'}),
    altered({filename:'Other.usr'}),altered({data:'!'.repeat(JSON.parse(backup.text).data.length)}),
    altered({sha256:'0'.repeat(64)}),altered({extra:true}),file({...backup,name:'../Test_Agent-1.uplink-save'}));
  const before=JSON.stringify([...t.files]);
  for(const input of invalid)await assert.rejects(service.importProfile(input));
  assert.equal(JSON.stringify([...t.files]),before,'invalid backups must make no filesystem changes');
  for(const filename of ['../x.usr','a/b.usr','a\\b.usr','x.usr/..','.usr','x.usr.tmp','a\0.usr'])
    await assert.rejects(backups.encode(filename,original));
  for(const bytes of [original.slice(0,-1),new Uint8Array(128),new Uint8Array(backups.MAX_SAVE_BYTES+1)])
    await assert.rejects(backups.encode('Test.usr',bytes));
  const wrongVersion=save();wrongVersion[29]=0;
  // Re-checksummed payload with unsupported content still fails save-format validation.
  wrongVersion.set(createHash('sha1').update(wrongVersion.subarray(29)).digest().swap32(),9);
  await assert.rejects(backups.encode('Test.usr',wrongVersion),/save format/);
  let release;
  const blocked=backups.create(t.m,()=>new Promise(resolve=>{release=resolve;}));
  const pending=blocked.importProfile(file(backup));
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(blocked.importProfile(file(backup)),/already in progress/);
  await assert.rejects(blocked.exportProfile('Test_Agent-1.usr'),/already in progress/);
  release(false);await pending;
  console.log('PASS: backup round trips, names/types/sizes/checksums, cancellation, overwrite, rollback, live-game guard and repeated operations');
})().catch(error=>{console.error(error);process.exitCode=1;});
