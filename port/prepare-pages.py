"""Stage only the built game and required external music for GitHub Pages."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', default='_site')
args = parser.parse_args()
root = Path.cwd()
destination = Path(args.output)
if destination.exists() and any(destination.iterdir()):
    raise SystemExit('Pages output directory must be empty; choose a new --output.')
inputs = [(root / 'prototype' / name, name) for name in
          ('game.html', 'display.js', 'game.js', 'game.wasm', 'game.data')]
music = sorted((root / 'prototype/assets/music').glob('*.ogg'))
if len(music) != 6:
    raise SystemExit('Expected all six original music tracks.')
inputs += [(path, 'assets/music/' + path.name) for path in music]
for source, name in inputs:
    if not source.is_file() or not source.stat().st_size:
        raise SystemExit('Missing built game asset: ' + str(source))
destination.mkdir(parents=True, exist_ok=True)
for source, name in inputs:
    target = destination / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
shutil.copyfile(destination / 'game.html', destination / 'index.html')
(destination / '.nojekyll').touch()
files = []
for path in sorted(destination.rglob('*')):
    if path.is_file():
        data = path.read_bytes()
        files.append({'path': str(path.relative_to(destination)), 'bytes': len(data),
                      'sha256': hashlib.sha256(data).hexdigest()})
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
(destination / 'build.json').write_text(json.dumps({
    'commit': revision, 'emscripten': '6.0.10', 'entry': 'index.html', 'files': files
}, indent=2) + '\n')
print(f'Pages artifact: {destination}, {len(files)} files, '
      f'{sum(item["bytes"] for item in files):,} bytes; commit {revision}')
