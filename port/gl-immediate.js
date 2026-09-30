// Keep legacy current colour as state; emit it for every immediate vertex.
// Emscripten 6.0.10 emits colour only on glColor inside begin/end, creating
// uneven records when Uplink changes colour halfway through a primitive.
addToLibrary({
  glColor4f__deps: ['$GLImmediate'],
  glColor4f: function(r, g, b, a) {
    GLImmediate.clientColor.set([r, g, b, a].map(function(v) { return Math.max(0, Math.min(1, v)); }));
  },
  $uplinkImmediateVertex__deps: ['$GLImmediate'],
  $uplinkImmediateVertex: function(x, y, z, w) {
    assert(GLImmediate.mode >= 0);
    var i = GLImmediate.vertexCounter;
    GLImmediate.vertexData[i++] = x;
    GLImmediate.vertexData[i++] = y;
    GLImmediate.vertexData[i++] = z;
    GLImmediate.vertexData[i++] = w;
    GLImmediate.addRendererComponent(GLImmediate.VERTEX, 4, GLctx.FLOAT);
    var start = i << 2;
    for (var c = 0; c < 4; ++c) GLImmediate.vertexDataU8[start+c] = GLImmediate.clientColor[c] * 255;
    GLImmediate.vertexCounter = i + 1;
    GLImmediate.addRendererComponent(GLImmediate.COLOR, 4, GLctx.UNSIGNED_BYTE);
    assert(GLImmediate.vertexCounter << 2 < GL.MAX_TEMP_BUFFER_SIZE);
  },
  glVertex2f__deps: ['$uplinkImmediateVertex'],
  glVertex2f: function(x, y) { uplinkImmediateVertex(x, y, 0, 1); },
  glVertex3f__deps: ['$uplinkImmediateVertex'],
  glVertex3f: function(x, y, z) { uplinkImmediateVertex(x, y, z, 1); },
  glVertex4f__deps: ['$uplinkImmediateVertex'],
  glVertex4f: function(x, y, z, w) { uplinkImmediateVertex(x, y, z, w); }
});
