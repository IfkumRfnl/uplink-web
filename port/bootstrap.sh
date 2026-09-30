#!/usr/bin/env bash
# Explicit setup entrypoint. Downloads only the official Emscripten SDK.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SDK="$ROOT/toolchain/emsdk-main"
VERSION=6.0.10
for command in git python3 node g++; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done
if [[ ! -e "$SDK" ]]; then
  mkdir -p "$ROOT/toolchain"
  git clone https://github.com/emscripten-core/emsdk.git "$SDK"
fi
[[ -x "$SDK/emsdk" ]] || { echo "Expected official emsdk checkout at $SDK" >&2; exit 1; }
if [[ ! -x "$SDK/upstream/emscripten/em++" ]] || ! "$SDK/upstream/emscripten/em++" --version | head -1 | grep -Fq "$VERSION"; then
  "$SDK/emsdk" install "$VERSION"
  "$SDK/emsdk" activate "$VERSION"
fi
# The emsdk environment script may reference unset variables.
set +u
source "$SDK/emsdk_env.sh"
set -u
"$SDK/upstream/emscripten/em++" --version | head -1
printf '\nSDK ready. Run npm run build, then npm test.\n'
