# Private Uplink asset preparation

These assets came from the user's local Steam installation. The original archives and prepared assets are included only in the private workbench. Original game content is retained for private feasibility testing; this preparation does not grant redistribution rights.

## Reproduce

From the workspace root:

    python uplink-web/prototype/prepare_assets.py uplink-inspect/Uplink.zip
    python uplink-web/prototype/build_music_decoder.py uplink-web/uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404/contrib/libmikmod-3.2.0-beta2
    python uplink-web/prototype/render_music.py uplink-web/prototype/music-build/libmikmod.so uplink-web/prototype/assets/music/bluevalley.uni uplink-web/prototype/assets/music/bluevalley.wav --seconds 45

The asset preparation requires Python Pillow. Decoder build uses GCC and the already supplied source, with generated configuration headers outside that source tree. It does not alter original C/C++ source files. The renderer uses Python ctypes and standard-library wave; it never initializes a real audio device.

## Archive format

The game uses ZIP archives via lib/bungle/bungle.cpp. In this installation, fonts, graphics, loading, music, sounds, and all patch .dat files are ZIPs without wrapping. data.dat starts with the 9-byte `REDSHIRT\0` marker followed by a ZIP with each byte XORed with 0x80 (equivalent to subtracting 128 modulo 256). The source also supports REDSHRT2: 9-byte marker plus 20-byte SHA-1 checksum followed by the same transform. The preparer skips that checksum but does not validate it; installation ZIP CRCs and final SHA-256 hashes are still checked/recorded. No REDSHRT2 archive occurred here.

Archive load order matches uplink/src/uplink.cpp: data, graphics, loading, sounds, music, fonts, patch, patch2, patch3. Patches overwrite matching logical names. Manifest includes archive origin, byte lengths, SHA-256, dimensions, and derived paths.

## Assets

- 347 originals: 280 TIFF graphics, 49 WAV effects, 6 UNIMOD songs, 2 TTF fonts, 10 text resources
- 280 PNG derivatives next to TIFFs
- 280 raw RGBA derivatives at `assets/rgba/<original path>.rgba`, for example `assets/rgba/graphics/mainmenu/uplinklogo.tif.rgba`
- RGBA binary format: little-endian uint32 width, uint32 height, then width × height × 4 RGBA bytes, bottom row first, matching TIFFRGBAImageGet orientation. All actual source alpha channels are opaque; runtime game color-key logic remains separate
- Main logo: `assets/graphics/mainmenu/uplinklogo.png`
- World map: `assets/graphics/worldmaplarge.png`
- Fonts: `assets/fonts/BATTLE3.TTF` and `assets/fonts/dungeon.TTF`
- UI audio: `assets/sounds/login.wav`, `assets/sounds/mouseclick.wav`

## Original music preservation

All six .uni files have the exact magic `UN05`: MikMod UNIMOD version 5, a tracker module containing pattern/track instructions, instruments and sample data. They are not a renamed PCM or MP3 file. The supplied `contrib/libmikmod-3.2.0-beta2/loaders/load_uni.c` explicitly recognizes and decodes UN04/UN05/UN06. In this environment ffmpeg/openmpt rejects UN05 directly.

The bundled MikMod source compiled successfully on native Linux. A 64-bit type configuration (`__arch64__`) is required here so ULONG remains 32-bit. The decoder can be built into Wasm for actual in-browser tracker playback, or music can be prerendered while retaining all original .uni files.

Verified generated music:

- `assets/music/bluevalley.wav`: 45-second preview, stereo 44.1 kHz 16-bit PCM, nonzero samples, peaks -23326/+21767
- `assets/music/bluevalley.ogg`: full playback to Player_Active completion, 720.933 seconds, Vorbis quality 5, approximately 14.3 MB. Full native PCM intermediate is `/tmp/bluevalley-full.wav`

For a full WAV omit `--seconds`; safety ceiling is 30 minutes. To compress a rendered WAV:

    ffmpeg -i full.wav -c:a libvorbis -q:a 5 bluevalley.ogg

`assets/music-derived-manifest.json` records both derived files. Music is rendered from the original track, never synthesized or replaced. LGPL obligations for distributing MikMod would need separate review before any publication; this is private testing only.

## Included-archive rebuild

From the repository root, `python3 prototype/prepare_from_archives.py` recreates extraction from `game-data/` without the installation ZIP. Pillow is required. The regenerated manifest identifies the temporary repository-archive input; per-archive and per-file hashes still match the originals.

To regenerate every complete OGG (GCC, Python 3 and ffmpeg required):

```sh
python3 prototype/build_music_decoder.py uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404/contrib/libmikmod-3.2.0-beta2
for file in prototype/assets/music/*.uni; do
  wav="${file%.uni}.wav"
  python3 prototype/render_music.py prototype/music-build/libmikmod.so "$file" "$wav"
  ffmpeg -y -i "$wav" -c:a libvorbis -q:a 5 "${file%.uni}.ogg"
done
```

All six complete OGG tracks are already included. Temporary WAV files and native decoder binaries are excluded from Git.
