from pathlib import Path
import zipfile,difflib,json,hashlib
root=Path(__file__).resolve().parent.parent
source=root/'uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404'
changes=[]; patches=[]; original_paths=set()
with zipfile.ZipFile(root/'source.zip') as z:
 for info in z.infolist():
  parts=info.filename.split('/',1)
  if len(parts)<2 or info.is_dir():continue
  rel=parts[1]; original_paths.add(rel); p=source/rel
  if not p.is_file():continue
  original=z.read(info);current=p.read_bytes()
  if original==current:continue
  changes.append({'path':rel,'original_sha256':hashlib.sha256(original).hexdigest(),'modified_sha256':hashlib.sha256(current).hexdigest()})
  before=original.decode('utf-8',errors='replace').splitlines(True);after=current.decode('utf-8',errors='replace').splitlines(True)
  # normalize newlines in patch so changes remain human readable
  before=[s.rstrip('\r\n')+'\n' for s in before];after=[s.rstrip('\r\n')+'\n' for s in after]
  patches.extend(difflib.unified_diff(before,after,fromfile='a/'+rel,tofile='b/'+rel))
# Include authored additions in the source tree, so the patch also restores
# the renderer submission header when applied to a fresh original archive.
for p in sorted(source.rglob('*')):
 if not p.is_file(): continue
 rel=p.relative_to(source).as_posix()
 if rel in original_paths: continue
 current=p.read_bytes()
 changes.append({'path':rel,'original_sha256':None,'modified_sha256':hashlib.sha256(current).hexdigest()})
 after=[line.rstrip('\r\n')+'\n' for line in current.decode('utf-8').splitlines(True)]
 patches.extend(difflib.unified_diff([],after,fromfile='/dev/null',tofile='b/'+rel))
(root/'port/uplink-browser.patch').write_text(''.join(patches))
(root/'port/source-changes.json').write_text(json.dumps(changes,indent=2)+'\n')
print(f'{len(changes)} source files changed; auth/main entrypoint unchanged:', not any(x['path']=='uplink/src/uplink.cpp' for x in changes))
