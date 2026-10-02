'use strict';
// New implementation informed by the profile-transfer idea in arisada's
// a28747ddc547e99ffb23290988b97838722768ad. No reference code is copied.
(function (root) {
  const MAX_SAVE_BYTES = 8 * 1024 * 1024;
  const MAX_BACKUP_BYTES = Math.ceil(MAX_SAVE_BYTES / 3) * 4 + 1024;
  const directory = '/persistent/.uplink/';
  const extension = '.uplink-save';
  function checkFilename(filename) {
    if (typeof filename !== 'string' || !/^[A-Za-z0-9_ -]{1,60}\.usr$/.test(filename) ||
        filename !== filename.trim() || filename.startsWith(' '))
      throw Error('Unsupported profile name. Use 1–60 letters, numbers, spaces, _ or -.');
    return filename.slice(0, -4);
  }
  async function digest(algorithm, data) {
    if (!root.crypto?.subtle) throw Error('Backup checksums require HTTPS or localhost.');
    return new Uint8Array(await root.crypto.subtle.digest(algorithm, data));
  }
  async function validateSave(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 64 || bytes.length > MAX_SAVE_BYTES)
      throw Error('Invalid save size (maximum 8 MiB).');
    if (String.fromCharCode(...bytes.subarray(0, 9)) !== 'REDSHRT2\0')
      throw Error('Unsupported save wrapper.');
    const payload = bytes.subarray(29);
    const hash = await digest('SHA-1', payload);
    // Redshirt2 stores the five SHA-1 words in WASM little-endian order.
    if (!hash.every((value, index) => value === bytes[9 + (index & ~3) + 3 - (index & 3)]))
      throw Error('Save checksum failed; the profile is corrupt or truncated.');
    const header = Uint8Array.from(payload.subarray(0, 14), value => (value + 128) & 255);
    const view = new DataView(header.buffer);
    if (String.fromCharCode(...header.subarray(0, 6)) !== 'SAV62\0' ||
        ![0, 1].includes(view.getInt32(6, true)) || ![-1, 1, 2, 3, 4].includes(view.getInt32(10, true)))
      throw Error('Unsupported save format. This backup requires browser-port SAV62.');
  }
  function base64(bytes) {
    let text = '';
    for (let offset = 0; offset < bytes.length; offset += 32768)
      text += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return root.btoa(text);
  }
  async function checksum(filename, bytes) {
    const name = new TextEncoder().encode(filename + '\0');
    const input = new Uint8Array(name.length + bytes.length);
    input.set(name); input.set(bytes, name.length);
    return Array.from(await digest('SHA-256', input), value => value.toString(16).padStart(2, '0')).join('');
  }
  async function encode(filename, bytes) {
    const name = checkFilename(filename);
    await validateSave(bytes);
    return {name: name + extension, text: JSON.stringify({format:'uplink-web-profile', version:1,
      filename, bytes:bytes.length, sha256:await checksum(filename, bytes), data:base64(bytes)}) + '\n'};
  }
  async function decode(file) {
    if (!file || typeof file.name !== 'string' || !Number.isInteger(file.size) ||
        file.size <= 0 || file.size > MAX_BACKUP_BYTES)
      throw Error('Invalid backup size (maximum 8 MiB of save data).');
    if (!file.name.endsWith(extension)) throw Error('Choose a .uplink-save backup exported by this browser port.');
    let backup;
    try { backup = JSON.parse(await file.text()); }
    catch (_) { throw Error('The backup is malformed or truncated.'); }
    if (!backup || typeof backup !== 'object' || Array.isArray(backup) ||
        Object.keys(backup).sort().join(',') !== 'bytes,data,filename,format,sha256,version' ||
        backup.format !== 'uplink-web-profile' || backup.version !== 1)
      throw Error('Unsupported backup format.');
    const name = checkFilename(backup.filename);
    if (file.name !== name + extension) throw Error('The backup filename must match its original profile name.');
    if (!Number.isInteger(backup.bytes) || backup.bytes < 64 || backup.bytes > MAX_SAVE_BYTES ||
        typeof backup.data !== 'string' || backup.data.length !== Math.ceil(backup.bytes / 3) * 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(backup.data) ||
        typeof backup.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(backup.sha256))
      throw Error('Invalid backup contents.');
    const bytes = Uint8Array.from(root.atob(backup.data), value => value.charCodeAt(0));
    if (bytes.length !== backup.bytes || base64(bytes) !== backup.data ||
        await checksum(backup.filename, bytes) !== backup.sha256)
      throw Error('Backup checksum failed; the file is corrupt or truncated.');
    await validateSave(bytes);
    return {filename:backup.filename, bytes};
  }
  function create(module, confirmOverwrite) {
    let busy = false;
    const fs = module.FS;
    function exists(path) { return fs.analyzePath(path).exists; }
    function read(path) {
      if (!fs.isFile(fs.lstat(path).mode)) throw Error('Profile path is not a regular file.');
      if (fs.stat(path).size > MAX_SAVE_BYTES) throw Error('Save exceeds the 8 MiB backup limit.');
      return fs.readFile(path).slice();
    }
    async function exclusive(operation) {
      if (busy) throw Error('A backup operation is already in progress.');
      busy = true;
      try {
        if (!module.uplinkPersistence?.ready || module.uplinkPersistence.rollbackFailed)
          throw Error('Save storage is unavailable. Reload after enabling browser storage.');
        return await operation();
      } finally { busy = false; }
    }
    return {
      list() {
        if (!module.uplinkPersistence?.ready) return [];
        return fs.readdir(directory).filter(filename => {
          try { checkFilename(filename); return fs.isFile(fs.lstat(directory + filename).mode); }
          catch (_) { return false; }
        }).sort();
      },
      exportProfile(filename) {
        return exclusive(async () => {
          checkFilename(filename);
          await module.uplinkFlushSaves();
          return encode(filename, read(directory + filename));
        });
      },
      importProfile(file) {
        return exclusive(async () => {
          const backup = await decode(file);
          if (!module._uplinkProfilesBeginImport())
            throw Error('Return to the login screen before importing a profile.');
          const canvas = module.canvas;
          const wasInert = canvas?.inert;
          if (canvas) { canvas.blur(); canvas.inert = true; }
          let committed = false;
          try {
            const target = directory + backup.filename;
            const temporary = target.slice(0, -4) + '.tmp';
            if (exists(target) || exists(temporary)) {
              if (!await confirmOverwrite(checkFilename(backup.filename))) return false;
            }
            let previous, previousTemporary, previousTime = 0, touched = false;
            const stage = directory + '.profile-import-stage';
            await module.uplinkPersistSaveChange(() => {
              // Capture inside the persistence queue, after earlier saves finish.
              previous = exists(target) ? read(target) : null;
              previousTime = previous ? fs.stat(target).mtime.getTime() : 0;
              previousTemporary = exists(temporary) ? read(temporary) : null;
              if (exists(stage)) throw Error('An unfinished import exists. Reload before importing.');
              touched = true;
              fs.writeFile(stage, backup.bytes);
              fs.rename(stage, target);
              // IDBFS compares mtimes, not contents. Same-millisecond repeated
              // overwrites must still produce a different persisted revision.
              const stamp = Math.max(Date.now(), previousTime + 1);
              fs.utime(target, stamp, stamp);
              if (previousTemporary) fs.unlink(temporary);
            }, () => {
              if (!touched) return;
              if (exists(stage)) fs.unlink(stage);
              if (previous) fs.writeFile(target, previous);
              else if (exists(target)) fs.unlink(target);
              if (previousTemporary) fs.writeFile(temporary, previousTemporary);
            });
            committed = true;
            return true;
          } finally {
            if (canvas) canvas.inert = wasInert;
            module._uplinkProfilesEndImport(committed ? 1 : 0);
          }
        });
      }
    };
  }
  const api = {create, encode, decode, MAX_SAVE_BYTES, MAX_BACKUP_BYTES};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UplinkProfileBackups = api;
})(globalThis);
