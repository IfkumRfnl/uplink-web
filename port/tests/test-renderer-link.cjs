"use strict";
const fs = require("node:fs"),
  assert = require("node:assert/strict");
for (const name of ["game", "prototype"]) {
  const source = fs.readFileSync(`prototype/${name}.js`, "utf8");
  for (const marker of [
    "GLImmediate",
    "GL_FIXED_FUNCTION",
    "_glBegin",
    "_glMatrixMode",
    "using emscripten GL immediate mode emulation",
  ])
    assert(
      !source.includes(marker),
      `${name}: obsolete emulation remains: ${marker}`,
    );
  assert(
    source.includes("GLctx.drawArrays"),
    `${name}: direct WebGL draws must be linked`,
  );
  const wasm = fs.readFileSync(`prototype/${name}.wasm`);
  for (const shader of ["aPosition", "aUV", "aColour", "uTexture", "uMode"])
    assert(
      wasm.includes(Buffer.from(shader)),
      `${name}: explicit shader missing: ${shader}`,
    );
}
for (const file of [
  "port/link-game.sh",
  "port/build-prototype.sh",
  "port/tests/run-image-tests.sh",
])
  assert(
    !fs.readFileSync(file, "utf8").includes("LEGACY_GL_EMULATION"),
    `${file}: obsolete linker flag`,
  );
console.log(
  "PASS: game and harness link direct WebGL draws and explicit shaders, with no legacy emulation",
);
