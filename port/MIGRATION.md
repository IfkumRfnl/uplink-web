# Continue in a browser-capable environment

This archive contains changes, not original copyrighted source/assets.

1. Obtain the original source archive at https://codeload.github.com/vb6mmorpg/uplink-source-code/zip/013337cefbe4b69c1f75bf4289608875ee2ed404 . Save as source.zip and extract beside port/ into uplink-source-code-013337cefbe4b69c1f75bf4289608875ee2ed404.
2. Before applying port/uplink-browser.patch, normalize CRLF to LF in the files listed in port/source-changes.json. Apply with `patch -p1` inside the source directory. Preserve the original source ZIP for provenance.
3. Materialize the user's existing Uplink.zip Library item (libfile_0ca815074d5c8191a3e51c3e1ceeaf7a) through the current Library workflow. It contains the Steam assets. Extract its nine .dat files into game-data/ (flat).
4. Install official Emscripten 6.0.10 under toolchain/emsdk-main using the official emsdk instructions; scripts expect upstream/emscripten/em++. Do not run the old game's installer/build scripts.
5. Run prototype/prepare_assets.py with the Steam ZIP path. Python Pillow is needed.
6. Build music decoder via prototype/build_music_decoder.py with the bundled contrib/libmikmod-3.2.0-beta2 path. Render each assets/music/*.uni through prototype/render_music.py to temporary WAV, then encode the complete result using ffmpeg libvorbis quality 5 to assets/music/<basename>.ogg. Keep all original .uni files. The scripts and manifests document exact formats. This is faithful offline rendering, not live UN05 browser decoding.
7. Run port/build-ftgl.sh, port/build-prototype.sh and port/link-game.sh. Run port/tests/test-mainloop.py, test-persistence.js and run-image-tests.sh.
8. Install official Playwright Chromium if absent. Run `node port/tests/browser-smoke.cjs index.html` and `node port/tests/browser-smoke.cjs game.html`. The script starts its own private server in the same process namespace. It uses CHROMIUM_PATH when set, /usr/bin/chromium when present, otherwise Playwright's bundled browser.
9. Fix runtime failures before claiming gameplay works. Test original login/tutorial only through legitimate existing authentication behavior. Never fake Steam/auth/code-card outcomes. Follow through graphics, repeated input, real audio, save then reload, error logs and screenshots.

Latest attempts here reached successful game compile/link and unit checks. Built-in Chromium rejects localhost via its extension; separate authorized Playwright could not launch because the execution sandbox rejects its required local socket. Neither failure demonstrates a game runtime defect. No browser pass is claimed.

No GitHub mutations, publication, or transfer of the complete source/assets is included. Authentication/startup original uplink.cpp must remain unchanged unless a legitimate authorized platform adaptation has been reviewed; no bypasses.
