#!/usr/bin/env python3
"""Verify committed project inputs against the repository inventory (not build outputs)."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'repository-manifest.json').read_text())
failures = []
for entry in manifest['files']:
    relative = Path(entry['path'])
    if relative.is_absolute() or '..' in relative.parts:
        failures.append(f"unsafe path: {relative}")
        continue
    file = root / relative
    if not file.is_file():
        failures.append(f"missing: {relative}")
        continue
    content = file.read_bytes()
    if len(content) != entry['bytes'] or hashlib.sha256(content).hexdigest() != entry['sha256']:
        failures.append(f"changed: {relative}")
if failures:
    raise SystemExit('\n'.join(failures))
print(f"PASS: {len(manifest['files'])} inventoried project files match their recorded SHA-256 values")
