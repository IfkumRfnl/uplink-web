#!/usr/bin/env python3
"""Reject shallow Image assignment through the real C++98 header."""
from pathlib import Path
import os
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
include = next(root.glob('uplink-source-code-*/lib/gucci'))
with tempfile.TemporaryDirectory(prefix='uplink-image-ownership-') as temporary:
    source = Path(temporary) / 'test.cpp'
    for mode, flags in [('native', []), ('browser', ['-D__EMSCRIPTEN__'])]:
        for body, allowed in [
            ('Image a; Image b(a);', True),
            ('Image a, b; a = b;', False),
            ('struct Derived : Image {}; Derived a, b; a = b;', False),
        ]:
            source.write_text('#include "image.h"\nvoid check() {' + body + '}\n')
            result = subprocess.run(
                [os.environ.get('CXX', 'g++'), '-std=c++98', '-fsyntax-only',
                 '-I' + str(include), *flags, str(source)],
                capture_output=True, text=True,
            )
            if allowed:
                assert result.returncode == 0, result.stderr
            else:
                assert result.returncode != 0, 'Shallow assignment must not compile'
                assert 'private' in result.stderr and 'operator=' in result.stderr, result.stderr
        print(mode + ': C++98 copy construction allowed; direct/derived assignment rejected PASS')
