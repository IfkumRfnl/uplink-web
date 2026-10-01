'use strict';
// Keep SDL's drawing buffer and coordinates native. Only scale its presentation.
window.UplinkDisplay = (() => {
  const resolutions = ['800x600', '1024x768', '1280x960', '1600x1200'];
  const scales = ['sharp', 'fit', 'native'];
  let settings = {resolution: '1024x768', scale: 'sharp'};
  try {
    const saved = JSON.parse(localStorage.getItem('uplink-display-v1'));
    if (resolutions.includes(saved?.resolution)) settings.resolution = saved.resolution;
    if (scales.includes(saved?.scale)) settings.scale = saved.scale;
  } catch (_) { /* Browser storage may be unavailable. Defaults still work. */ }
  const [width, height] = settings.resolution.split('x').map(Number);
  const canvas = document.getElementById('canvas');
  canvas.width = width;
  canvas.height = height;
  const viewport = document.createElement('div');
  viewport.id = 'display-viewport';
  canvas.before(viewport);
  viewport.append(canvas);
  const style = document.createElement('style');
  style.textContent = `
    #display-viewport {width:100%;overflow:auto;position:relative;overscroll-behavior:contain;}
    #canvas {max-width:none; image-rendering:pixelated;position:relative;}
    #display-control {position:fixed;right:8px;top:8px;z-index:20;color:#c6e1ec;
      font:13px system-ui;background:#081726eF;border:1px solid #527487;border-radius:4px;}
    #display-control summary {cursor:pointer;padding:6px 10px;}
    #display-control form {padding:8px 12px;display:grid;gap:10px;width:230px;}
    #display-control label {display:grid;gap:4px;}
    #display-control select,#display-control button {font:inherit;color:inherit;
      background:#163241;border:1px solid #527487;padding:6px;margin:0;}
    #display-control p {margin:0;font-size:12px;line-height:1.4;}
  `;
  document.head.append(style);
  const control = document.createElement('details');
  control.id = 'display-control';
  control.innerHTML = `<summary>Display</summary><form>
    <label>Game resolution<select id="display-resolution">${resolutions.map(r => `<option value="${r}">${r.replace('x', ' × ')}</option>`).join('')}</select></label>
    <label>Scaling<select id="display-scale"><option value="sharp">Sharp · whole pixels</option><option value="fit">Fit window</option><option value="native">Native · 1 device pixel</option></select></label>
    <p>Sharp and Native keep whole pixels; scroll when the game is larger than the window. Fit shows the whole game. Resolution changes restart the game; save your progress first.</p>
    <button type="submit">Apply display</button><button type="button" id="display-fullscreen">Fullscreen</button>
    <p id="display-message" role="status"></p></form>`;
  document.body.append(control);
  const resolution = control.querySelector('#display-resolution');
  const scale = control.querySelector('#display-scale');
  const message = control.querySelector('#display-message');
  resolution.value = settings.resolution;
  scale.value = settings.scale;
  function presentationScale(w, h, availableWidth, availableHeight, dpr, mode) {
    const fit = Math.min(availableWidth * dpr / w, availableHeight * dpr / h);
    if (mode === 'native') return 1;
    if (mode === 'sharp') return Math.max(1, Math.floor(fit + 1e-6));
    return fit;
  }
  function pixelOffset(position, dpr) {
    return Math.round(position * dpr) / dpr - position;
  }
  function alignCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.left = canvas.style.top = '0px';
    const box = canvas.getBoundingClientRect();
    canvas.style.left = `${pixelOffset(box.left, dpr)}px`;
    canvas.style.top = `${pixelOffset(box.top, dpr)}px`;
  }
  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const chrome = ['header', 'footer', '#log'].reduce((sum, selector) => {
      const el = document.querySelector(selector);
      if (!el || getComputedStyle(el).display === 'none') return sum;
      const css = getComputedStyle(el);
      return sum + el.getBoundingClientRect().height + parseFloat(css.marginTop || 0) + parseFloat(css.marginBottom || 0);
    }, 0);
    viewport.style.top = '0px';
    const offset = pixelOffset(viewport.getBoundingClientRect().top, dpr);
    viewport.style.top = `${offset}px`;
    viewport.style.height = `${Math.max(1, window.innerHeight - chrome - Math.max(0, offset))}px`;
    viewport.style.overflow = settings.scale === 'fit' ? 'hidden' : 'auto';
    // Clear old scrollbars before measuring. A previous oversized resolution
    // must not reduce the available space for a now-fitting whole-pixel scale.
    canvas.style.width = canvas.style.height = '0px';
    const factor = presentationScale(width, height, viewport.clientWidth,
      viewport.clientHeight, dpr, settings.scale);
    canvas.style.width = `${width * factor / dpr}px`;
    canvas.style.height = `${height * factor / dpr}px`;
    alignCanvas();
  }
  control.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const next = {resolution: resolution.value, scale: scale.value};
    const restart = next.resolution !== settings.resolution;
    const button = control.querySelector('[type=submit]');
    button.disabled = true;
    try {
      if (restart) {
        if (!window.Module?.uplinkPersistence?.ready) throw Error('Wait for the game to finish loading.');
        await Module.uplinkFlushSaves();
      }
      let saved = true;
      try { localStorage.setItem('uplink-display-v1', JSON.stringify(next)); }
      catch (_) { saved = false; }
      if (restart && !saved) throw Error('Display settings could not be saved. Enable browser storage to change resolution.');
      settings = next;
      layout();
      if (restart) location.reload();
      else message.textContent = saved ? 'Display saved.' : 'Applied for this session; browser storage is unavailable.';
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  };
  control.querySelector('#display-fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) { message.textContent = 'Fullscreen is unavailable in this browser.'; }
  };
  window.addEventListener('resize', layout);
  viewport.addEventListener('scroll', alignCanvas, {passive:true});
  document.addEventListener('fullscreenchange', layout);
  // SDL can assign canvas inline sizes when its video mode initializes.
  new MutationObserver(layout).observe(canvas, {attributes:true, attributeFilter:['width', 'height']});
  // SDL can also restore inline CSS dimensions after initializing/fullscreen.
  new ResizeObserver(layout).observe(canvas);
  new ResizeObserver(layout).observe(document.body);
  // Changing monitors/zoom can change DPR without a window resize.
  function watchDpr() {
    const query = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query.addEventListener('change', () => {layout(); watchDpr();}, {once:true});
  }
  watchDpr();
  layout();
  return {arguments: ['-graphics_fullscreen', '!graphics_screenwidth', String(width),
    '!graphics_screenheight', String(height)]};
})();
