'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let library; const bytes=new ArrayBuffer(256);
const immediate={mode:7,vertexCounter:0,vertexData:new Float32Array(bytes),vertexDataU8:new Uint8Array(bytes),clientColor:new Float32Array([1,1,1,1]),VERTEX:0,COLOR:2,components:[],addRendererComponent(...v){if(!this.components.some(c=>c[0]===v[0]))this.components.push(v)}};
const context={GLImmediate:immediate,GLctx:{FLOAT:5126,UNSIGNED_BYTE:5121},GL:{MAX_TEMP_BUFFER_SIZE:256},assert,addToLibrary(x){library=x}};
vm.runInNewContext(fs.readFileSync('port/gl-immediate.js','utf8'),context);
context.uplinkImmediateVertex=library.$uplinkImmediateVertex;
// Actual Memory Banks pattern: colour set outside begin, changed after two vertices.
library.glColor4f(.8,.2,.2,.5);library.glVertex2f(0,0);library.glVertex2f(0,20);
library.glColor4f(.3,.3,.8,.5);library.glVertex2f(30,20);library.glVertex2f(30,0);
assert.equal(immediate.vertexCounter,20);
assert.deepEqual([...immediate.vertexDataU8.slice(16,20)],[204,51,51,127]);
assert.deepEqual([...immediate.vertexDataU8.slice(36,40)],[204,51,51,127]);
assert.deepEqual([...immediate.vertexDataU8.slice(56,60)],[76,76,204,127]);
assert.deepEqual([...immediate.vertexDataU8.slice(76,80)],[76,76,204,127]);
assert.equal(immediate.components.length,2);
console.log('PASS: immediate vertices retain current colour across sparse mid-primitive colour changes');
