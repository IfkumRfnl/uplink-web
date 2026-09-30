#!/usr/bin/env python3
"""Extract an owner's local Uplink installation into private browser assets.
No downloads or uploads. Originals remain byte-identical; TIFFs gain PNG copies.
Usage: python prepare_assets.py /path/to/Uplink.zip [--output /path/to/assets]
Requires Pillow for TIFF-to-PNG conversion.
"""
import argparse, collections, hashlib, io, json, pathlib, zipfile, struct
from PIL import Image
ARCHIVES = ['data.dat','graphics.dat','loading.dat','sounds.dat','music.dat','fonts.dat','patch.dat','patch2.dat','patch3.dat']

def unwrap(raw):
    if raw.startswith(b'REDSHIRT\0'):
        return bytes(x ^ 128 for x in raw[9:]), 'REDSHIRT (9-byte marker; payload byte XOR 0x80)'
    if raw.startswith(b'REDSHRT2\0'):
        return bytes(x ^ 128 for x in raw[29:]), 'REDSHRT2 (9-byte marker + 20-byte SHA-1; payload byte XOR 0x80)'
    return raw, 'ZIP'

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('installation_zip',type=pathlib.Path)
    p.add_argument('--output',type=pathlib.Path,default=pathlib.Path(__file__).parent/'assets')
    a=p.parse_args(); a.output.mkdir(parents=True,exist_ok=True)
    manifest={'private_use_only':True,'source_archive':a.installation_zip.name,'source_sha256':hashlib.sha256(a.installation_zip.read_bytes()).hexdigest(),'archive_load_order':ARCHIVES,'files':{},'archives':[]}
    with zipfile.ZipFile(a.installation_zip) as installation:
        for archive in ARCHIVES:
            matches=[n for n in installation.namelist() if pathlib.PurePosixPath(n).name==archive]
            if len(matches)!=1: raise ValueError(f'Expected one {archive}, found {matches}')
            raw=installation.read(matches[0]); decoded,fmt=unwrap(raw)
            with zipfile.ZipFile(io.BytesIO(decoded)) as pack:
                names=[n for n in pack.namelist() if not n.endswith('/')]
                manifest['archives'].append({'name':archive,'format':fmt,'sha256':hashlib.sha256(raw).hexdigest(),'entries':len(names)})
                for name in names:
                    path=pathlib.PurePosixPath(name.replace('\\','/'))
                    if path.is_absolute() or '..' in path.parts: raise ValueError(f'Unsafe path: {name}')
                    data=pack.read(name); target=a.output.joinpath(*path.parts)
                    target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
                    entry={'archive':archive,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
                    if str(path) in manifest['files']: entry['overrides_archive']=manifest['files'][str(path)]['archive']
                    if path.suffix.lower() in ('.tif','.tiff'):
                        image=Image.open(io.BytesIO(data)); png=target.with_suffix('.png'); image.save(png)
                        rgba=a.output/'rgba'/(str(path)+'.rgba')
                        rgba.parent.mkdir(parents=True,exist_ok=True)
                        rgba.write_bytes(struct.pack('<II',image.width,image.height)+image.convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM).tobytes())
                        entry.update(png=str(png.relative_to(a.output)),rgba=str(rgba.relative_to(a.output)),width=image.width,height=image.height,mode=image.mode)
                    if path.suffix.lower()=='.uni': entry.update(format='MikMod UNIMOD version 5',magic=data[:4].decode('ascii'))
                    manifest['files'][str(path)]=entry
    manifest['counts']=dict(collections.Counter(pathlib.PurePosixPath(n).suffix.lower() for n in manifest['files']))
    (a.output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'output':str(a.output),'counts':manifest['counts'],'files':len(manifest['files'])},indent=2))
if __name__=='__main__':main()
