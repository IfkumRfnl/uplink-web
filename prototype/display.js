'use strict';
// UI size sets logical coordinates at boot; display scaling only presents pixels.
window.UplinkDisplay = (() => {
  const resolutions = ['800x600', '1024x768', '1280x960', '1600x1200'];
  const scales = ['sharp', 'fit', 'native'];
  const uiSizes = [100, 125, 150, 200];
  let settings = {resolution: '1024x768', scale: 'sharp', uiSize: 100};
  try {
    const saved = JSON.parse(localStorage.getItem('uplink-display-v1'));
    if (resolutions.includes(saved?.resolution)) settings.resolution = saved.resolution;
    if (scales.includes(saved?.scale)) settings.scale = saved.scale;
    if (uiSizes.includes(saved?.uiSize)) settings.uiSize = saved.uiSize;
  } catch (_) { /* Browser storage may be unavailable. Defaults still work. */ }
  const [width, height] = settings.resolution.split('x').map(Number);
  function logicalSize(w, h, percent) {
    // Preserve the game's 4:3 aspect and at least its original 640×480 layout.
    const units = Math.max(160, Math.round(w * 100 / percent / 4));
    return [units * 4, units * 3];
  }
  function supportedUiSizes(w, h) {
    return uiSizes.filter(size => w * 100 / size >= 640 && h * 100 / size >= 480);
  }
  settings.uiSize = Math.min(settings.uiSize, supportedUiSizes(width, height).at(-1));
  const [logicalWidth, logicalHeight] = logicalSize(width, height, settings.uiSize);
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
      font:13px system-ui;background:#081726eF;border:1px solid #527487;border-radius:4px;
      max-height:calc(100vh - 16px);overflow:auto;}
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
    <label>UI size<select id="display-ui-size">${uiSizes.map(size => `<option value="${size}">${size}%</option>`).join('')}</select></label>
    <p>UI size enlarges text and controls within the game. Sharp and Native keep whole pixels; scroll when needed. Fit shows the whole game. Resolution or UI size changes restart the game; save your progress first.</p>
    <button type="submit">Apply display</button><button type="button" id="display-fullscreen">Fullscreen</button>
    <p id="display-message" role="status"></p></form>`;
  document.body.append(control);
  const resolution = control.querySelector('#display-resolution');
  const scale = control.querySelector('#display-scale');
  const uiSize = control.querySelector('#display-ui-size');
  const message = control.querySelector('#display-message');
  resolution.value = settings.resolution;
  scale.value = settings.scale;
  uiSize.value = String(settings.uiSize);
  function updateUiSizes() {
    const [w, h] = resolution.value.split('x').map(Number);
    const supported = supportedUiSizes(w, h);
    for (const option of uiSize.options) option.disabled = !supported.includes(Number(option.value));
    uiSize.value = String(Math.min(Number(uiSize.value), supported.at(-1)));
  }
  resolution.addEventListener('change', updateUiSizes);
  updateUiSizes();
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
    const scrollLeft = viewport.scrollLeft, scrollTop = viewport.scrollTop;
    canvas.style.width = canvas.style.height = '0px';
    const factor = presentationScale(width, height, viewport.clientWidth,
      viewport.clientHeight, dpr, settings.scale);
    canvas.style.width = `${width * factor / dpr}px`;
    canvas.style.height = `${height * factor / dpr}px`;
    viewport.scrollLeft = scrollLeft;
    viewport.scrollTop = scrollTop;
    alignCanvas();
  }
  let layoutFrame = 0;
  function scheduleLayout() {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      layout();
    });
  }
  control.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    updateUiSizes();
    const next = {resolution: resolution.value, scale: scale.value, uiSize: Number(uiSize.value)};
    const restart = next.resolution !== settings.resolution || next.uiSize !== settings.uiSize;
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
      if (restart && !saved) throw Error('Display settings could not be saved. Enable browser storage to change resolution or UI size.');
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
  // Defer writes outside ResizeObserver delivery and coalesce notifications.
  new ResizeObserver(scheduleLayout).observe(canvas);
  new ResizeObserver(scheduleLayout).observe(document.body);
  // Changing monitors/zoom can change DPR without a window resize.
  function watchDpr() {
    const query = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query.addEventListener('change', () => {layout(); watchDpr();}, {once:true});
  }
  watchDpr();
  layout();
  return {width, height, logicalWidth, logicalHeight,
    arguments: ['-graphics_fullscreen', '!graphics_screenwidth', String(logicalWidth),
      '!graphics_screenheight', String(logicalHeight)]};
})();
