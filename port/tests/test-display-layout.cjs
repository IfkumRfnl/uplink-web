'use strict';
// Exercise the production sizing/alignment functions without a browser or GL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../prototype/display.js'), 'utf8');
const uiStart = source.indexOf('function logicalSize(');
const uiEnd = source.indexOf('settings.uiSize = Math.min', uiStart);
const ui = vm.runInNewContext('const uiSizes=[100,125,150,200];' + source.slice(uiStart,uiEnd) +
  ';({logicalSize,supportedUiSizes})');
for (const [w,h] of [[800,600],[1024,768],[1280,960],[1600,1200]]) {
  for (const size of ui.supportedUiSizes(w,h)) {
    const [lw,lh] = ui.logicalSize(w,h,size);
    assert(lw >= 640 && lh >= 480 && lw * 3 === lh * 4);
    assert(Math.abs(w/lw - size/100) < .01);
    if (size === 100) assert.deepEqual([lw,lh],[w,h]);
  }
}
assert.deepEqual(Array.from(ui.supportedUiSizes(800,600)),[100,125]);
assert.deepEqual(Array.from(ui.supportedUiSizes(1024,768)),[100,125,150]);
const start = source.indexOf('function presentationScale(');
const end = source.indexOf('function layout()', start);
assert(start > 0 && end > start);
const helpers = vm.runInNewContext(source.slice(start, end) +
  ';({presentationScale,pixelOffset})');
for (const dpr of [1,1.25,1.5,1.75,2]) {
  for (const [w,h] of [[800,600],[1024,768],[1600,1200]]) {
    for (const [availableWidth,availableHeight] of [[1367,855],[1920,1034],[390,254],[250,180]]) {
      const sharp = helpers.presentationScale(w,h,availableWidth,availableHeight,dpr,'sharp');
      assert(sharp >= 1 && Number.isInteger(sharp));
      assert.equal(helpers.presentationScale(w,h,availableWidth,availableHeight,dpr,'native'),1);
      const fit = helpers.presentationScale(w,h,availableWidth,availableHeight,dpr,'fit');
      assert(w * fit / dpr <= availableWidth + 1e-8);
      assert(h * fit / dpr <= availableHeight + 1e-8);
      const maximum = Math.min(availableWidth*dpr/w,availableHeight*dpr/h);
      if (maximum >= 1) {
        assert(sharp <= maximum + 1e-6);
        assert(sharp + 1 > maximum);
      } else assert.equal(sharp,1);
    }
  }
  // Include centered odd-width positions and origins after fractional-DPR scrolling.
  for (const position of [0,46,46.375,171.5,341.75,-63,-67.25,1e4+.125]) {
    const offset = helpers.pixelOffset(position,dpr);
    assert(Math.abs(offset*dpr) <= .5 + 1e-9);
    const physical = (position+offset)*dpr;
    assert(Math.abs(physical-Math.round(physical)) < 1e-8);
  }
}
assert(source.includes("viewport.addEventListener('scroll', alignCanvas"));
assert(source.includes("viewport.style.overflow = settings.scale === 'fit' ? 'hidden' : 'auto'"));
console.log('PASS: fractional DPR, whole-pixel Sharp/Native, fitting bounds and scrolled pixel-origin alignment');
