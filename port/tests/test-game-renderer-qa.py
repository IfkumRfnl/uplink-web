#!/usr/bin/env python3
"""Check QA output isolation with compiler doubles, not an actual game build."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / 'port/tests/build-game-renderer-qa.sh'
current = (ROOT / 'port/link-game.sh').read_text()
modern = '-o "${UPLINK_GAME_OUTPUT:-$ROOT/prototype/game.js}"'
legacy = '-o "$ROOT/prototype/game.js"'
assert current.rstrip().endswith(modern)
scripts = [current, current.replace(modern, legacy)]
if len(sys.argv) > 1:
    scripts.append(Path(sys.argv[1]).read_text())  # Optional pinned baseline.

COMPILER = '''#!/usr/bin/env python3
import os, pathlib, sys
args = sys.argv[1:]
output = pathlib.Path(args[args.index('-o') + 1])
compile_only = '-c' in args
output.write_bytes(b'QA fixture' if compile_only else b'QA bundle')
if not compile_only:
    for extension in ('.wasm', '.data'):
        output.with_suffix(extension).write_bytes(b'QA asset')
if os.environ['QA_FAIL'] == ('compile' if compile_only else 'link'):
    sys.exit(23)
'''

cases = 0
for script in scripts + [current.replace(modern, '-o "$ROOT/prototype/other.js"')]:
    recognized = script in scripts
    for existing in (False, True):
        for failure in ('none', 'compile', 'link'):
            with tempfile.TemporaryDirectory(prefix='renderer qa ') as temporary:
                target = Path(temporary)
                for directory in ('port', 'prototype', 'toolchain/emsdk-main/upstream/emscripten'):
                    (target / directory).mkdir(parents=True)
                linker = target / 'port/link-game.sh'
                linker.write_text(script)
                build = target / 'port/build-game.sh'
                build.write_text('#!/usr/bin/env bash\nexit 0\n')
                build.chmod(0o755)
                compiler = target / 'toolchain/emsdk-main/upstream/emscripten/em++'
                compiler.write_text(COMPILER)
                compiler.chmod(0o755)
                if existing:
                    for extension in ('js', 'wasm', 'data'):
                        (target / f'prototype/game.{extension}').write_bytes(b'production ' + extension.encode())
                def production_hashes():
                    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                            for p in (target / 'prototype').iterdir()}
                before = production_hashes()
                result = subprocess.run(['bash', str(HELPER), str(target)],
                                        env={**os.environ, 'QA_FAIL': failure},
                                        capture_output=True, text=True)
                assert production_hashes() == before, result.stderr
                assert linker.read_text() == script
                expected = 0 if recognized else 1
                if failure == 'compile' or (recognized and failure == 'link'):
                    expected = 23
                assert result.returncode == expected, result.stderr
                if recognized and failure == 'none':
                    for extension in ('js', 'wasm', 'data'):
                        assert (target / f'qa/renderer/game.{extension}').is_file()
                if not recognized and failure != 'compile':
                    assert 'Unrecognized link-game.sh output' in result.stderr
                    assert not (target / 'qa/renderer/game.js').exists()
                cases += 1
print(f'PASS: {cases} QA output isolation cases; production hashes and linker unchanged')
