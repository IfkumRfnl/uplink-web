#!/usr/bin/env python3
"""Regenerate prepared assets from this repository's original game-data archives."""
import pathlib
import subprocess
import sys
import tempfile
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
names = ['data.dat', 'graphics.dat', 'loading.dat', 'sounds.dat', 'music.dat', 'fonts.dat', 'patch.dat', 'patch2.dat', 'patch3.dat']
with tempfile.TemporaryDirectory(prefix='uplink-assets-') as directory:
    archive = pathlib.Path(directory) / 'repository-game-data.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as pack:
        for name in names:
            pack.write(root / 'game-data' / name, name)
    subprocess.run([sys.executable, str(root / 'prototype/prepare_assets.py'), str(archive), *sys.argv[1:]], check=True)
