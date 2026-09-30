// Emscripten --pre-js. Link with -lidbfs.js and -sFORCE_FILESYSTEM=1.
(function () {
  'use strict';
  var root = '/persistent';
  var status = Module['uplinkPersistence'] = {
    root: root,
    ready: false,
    pending: 0,
    lastError: null,
    lastSavedAt: null
  };
  var resolveReady, rejectReady;
  var ready = Module['uplinkPersistenceReady'] = new Promise(function (resolve, reject) {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Report restore failure even if the embedding page does not await readiness.
  ready.catch(function (error) { console.error('Uplink save restore failed:', error); });
  var queue = Promise.resolve();

  // Call only after C/C++ has closed/copied/encrypted the save file. Resolves
  // after IDBFS finishes its IndexedDB transaction, not just the MEMFS write.
  Module['uplinkFlushSaves'] = function () {
    status.pending++;
    var operation = queue.catch(function () {}).then(function () {
      return ready;
    }).then(function () {
      return new Promise(function (resolve, reject) {
        FS.syncfs(false, function (error) {
          if (error) reject(error);
          else resolve();
        });
      });
    }).then(function () {
      status.lastError = null;
      status.lastSavedAt = new Date().toISOString();
    }, function (error) {
      status.lastError = String(error);
      throw error;
    });
    queue = operation;
    return operation.then(function () {
      status.pending--;
      return status.lastSavedAt;
    }, function (error) {
      status.pending--;
      throw error;
    });
  };
  Module['uplinkSaveCompleted'] = Module['uplinkFlushSaves'];

  var preRun = Module['preRun'] || [];
  if (typeof preRun === 'function') preRun = [preRun];
  preRun.push(function () {
    var dependency = 'uplink-restore-saves';
    addRunDependency(dependency);
    try {
      FS.mkdirTree(root);
      FS.mount(IDBFS, {}, root);
      ENV.HOME = root;
      FS.syncfs(true, function (error) {
        if (error) {
          status.lastError = String(error);
          rejectReady(error);
          // Leave startup blocked: proceeding could overwrite existing saves
          // with an empty filesystem after a failed IndexedDB restore.
          if (Module['setStatus']) Module['setStatus']('Save storage unavailable. Reload after enabling browser storage.');
          return;
        }
        try {
          FS.mkdirTree(root + '/.uplink/userstmp');
          FS.mkdirTree(root + '/.uplink/usersold');
          status.ready = true;
          resolveReady();
          removeRunDependency(dependency);
        } catch (setupError) {
          status.lastError = String(setupError);
          rejectReady(setupError);
          if (Module['setStatus']) Module['setStatus']('Save folder setup failed. Reload after checking browser storage.');
        }
      });
    } catch (error) {
      status.lastError = String(error);
      rejectReady(error);
      if (Module['setStatus']) Module['setStatus']('Save storage unavailable. Reload after enabling browser storage.');
    }
  });
  Module['preRun'] = preRun;
})();
