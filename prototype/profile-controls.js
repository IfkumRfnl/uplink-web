'use strict';
(() => {
  const panel = document.getElementById('display-control');
  const control = document.createElement('section');
  control.id = 'profile-control';
  control.setAttribute('aria-labelledby', 'profile-heading');
  control.innerHTML = `<h2 id="profile-heading">Save backups</h2>
    <p>Back up a last saved profile. Import a browser-port backup at the login screen; your profile password stays the same.</p>
    <label>Profile <select id="profile-select"></select></label>
    <button id="profile-export" type="button">Export backup</button>
    <label>Import backup <input id="profile-import" type="file" accept=".uplink-save"></label>
    <p id="profile-message" role="status"></p>`;
  const style = document.createElement('style');
  style.textContent = `#profile-control {padding:12px;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;border-top:1px solid #527487;}
    #profile-control h2 {margin:0;font-size:13px;}
    #profile-control p {margin:0;font-size:12px;line-height:1.4;}
    #profile-control label {display:grid;gap:4px;min-width:0;}
    #profile-control select,#profile-control button,#profile-control input {width:100%;min-width:0;max-width:100%;font:inherit;
      color:inherit;background:#163241;border:1px solid #527487;padding:5px;box-sizing:border-box;}`;
  document.head.append(style);
  panel.append(control);
  const select = control.querySelector('#profile-select');
  const exportButton = control.querySelector('#profile-export');
  const input = control.querySelector('#profile-import');
  const message = control.querySelector('#profile-message');
  let service, busy = false;
  function getService() {
    if (!window.Module?.uplinkPersistence?.ready) throw Error('Wait for save storage to finish loading.');
    return service ||= UplinkProfileBackups.create(Module, name =>
      window.confirm(`Replace the saved profile “${name}” with this backup? Its current save will be overwritten.`));
  }
  function refresh() {
    const value = select.value;
    select.replaceChildren();
    try {
      for (const filename of getService().list()) select.add(new Option(filename.slice(0, -4), filename));
      if ([...select.options].some(option => option.value === value)) select.value = value;
      exportButton.disabled = busy || !select.options.length;
      input.disabled = busy;
      if (message.textContent === 'Wait for save storage to finish loading.') message.textContent = '';
    } catch (error) {
      exportButton.disabled = true; input.disabled = true; message.textContent = error.message;
    }
  }
  async function run(operation) {
    if (busy) return;
    busy = true; exportButton.disabled = input.disabled = true;
    try { await operation(); }
    catch (error) { message.textContent = `Backup failed: ${error.message || error}`; }
    finally { busy = false; input.value = ''; refresh(); }
  }
  panel.addEventListener('toggle', () => { if (panel.open) refresh(); });
  exportButton.onclick = () => run(async () => {
    const backup = await getService().exportProfile(select.value);
    const url = URL.createObjectURL(new Blob([backup.text], {type:'application/json'}));
    try {
      const link = document.createElement('a'); link.href = url; link.download = backup.name;
      document.body.append(link); link.click(); link.remove();
      message.textContent = 'Backup download started.';
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  });
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) { message.textContent = 'Import cancelled.'; return; }
    run(async () => {
      message.textContent = 'Checking backup…';
      message.textContent = await getService().importProfile(file)
        ? 'Profile imported and saved. Select it in the login screen.' : 'Import cancelled; the existing profile is unchanged.';
    });
  };
  input.addEventListener('cancel', () => { input.value = ''; message.textContent = 'Import cancelled.'; });
  // The shell loads before game.js creates its restore promise. Once all page
  // scripts have loaded, subscribe even if Display is already open.
  window.addEventListener('load', () => {
    window.Module?.uplinkPersistenceReady?.then(refresh, () => {
      refresh();
      message.textContent = 'Save storage unavailable. Reload after enabling browser storage.';
    });
  }, {once:true});
  refresh();
})();
