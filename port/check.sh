#!/usr/bin/env bash
# Non-browser checks. This script cannot establish actual browser gameplay.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
python3 port/tests/test-mainloop.py
node port/tests/test-persistence.js
node port/tests/test-profile-backups.cjs
python3 port/tests/test-options-save.py
python3 port/tests/test-game-autosave.py
python3 port/tests/test-options-apply.py
python3 port/tests/test-vanbakel-draw.py
python3 port/tests/test-firsttime-save.py
node port/tests/test-audio.js
node port/tests/test-browser-smoke.cjs
python3 port/tests/test-game-renderer-qa.py
python3 port/tests/test-font-raster.py
python3 port/tests/test-ui-scale.py
python3 port/tests/test-ui-texture.py
python3 port/tests/test-image-ownership.py
node port/tests/test-display-layout.cjs
bash port/tests/run-image-tests.sh
for output in prototype/game.js prototype/prototype.js; do
  [[ -f "$output" ]] || { echo "Missing $output; run npm run build first" >&2; exit 1; }
  node --check "$output"
done
node port/tests/test-renderer-link.cjs
node - <<'JS'
const fs = require('fs');
for (const output of ['prototype/game.wasm', 'prototype/prototype.wasm']) {
  if (!WebAssembly.validate(fs.readFileSync(output))) throw new Error(output + ': invalid WebAssembly');
  console.log(output + ': WebAssembly validation PASS');
}
console.log('Non-browser checks passed. Rendering, audio, gameplay and reload persistence remain separate browser checks.');
JS
