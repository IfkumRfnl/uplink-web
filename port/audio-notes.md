# Private original-audio browser adaptation

## Integration

Only `lib/soundgarden/soundgarden_sdlmixer.cpp` is changed. Every change is gated by `__EMSCRIPTEN__`; native SDL_mixer music behavior is retained. Sound effects still follow the existing original WAV/SDL_mixer path, including cache and volume. The modified translation unit independently compiled successfully with the game's current Emscripten flags.

Browser music uses HTML Audio. Six `.ogg` files must be served alongside the prototype at `assets/music/<original basename>.ogg`. These are HTTP-loaded, not Emscripten preloaded. Set `Module.uplinkMusicBaseURL` before playback to override the default relative `assets/music/` location. No remote/public hosting was performed.

All six are complete offline renderings of the original supplied `.uni` modules using supplied libmikmod 3.2.0-beta2 and its exact UN05 decoder. No replacement music or AI-generated audio is used. Player_Active reached completion before the renderer's 30-minute ceiling for every track:

| Original | Playback seconds |
| --- | ---: |
| a94final.uni | 189.85 |
| bluevalley.uni | 720.93 |
| myst2.uni | 445.54 |
| mystique.uni | 217.15 |
| serenity.uni | 164.49 |
| symphonic.uni | 250.50 |

Encoded with FFmpeg Vorbis quality 5. Original `.uni` modules remain intact. Approximately 37 MB of OGG assets total. The bluevalley.wav file is a separate 45-second test preview and is not used by the game bridge.

## Correct track identity

Original `SgPlaylist_NextSong`/`RandomSong` passes `RsArchiveFileOpen(songtitle)`, which can return `temp0.uni`. The browser adapter reads 18 bytes from that actual module and matches the known original UN05 header signature. All six supplied headers are distinct. It does not guess based on a temporary filename. Unknown/custom modules are explicitly reported and never substituted with another song. The 18-byte check is an identity convenience for known supplied assets, not cryptographic integrity checking.

## Semantics

- `SgPlayMod` stops previous music, selects the original track, and loops it like native `Mix_PlayMusic(..., -1)`
- Music volume follows existing `musicVol()` math and clamps to HTML Audio's 0–1 range
- `SgStopMod` pauses, clears source, releases loading, and clears pending state; stale promises cannot resurrect a stopped/replaced track
- `SgModFinished` does not treat gesture-blocked/loading playback as completion, preventing playlist churn; stop, media end, or an actual media error is completion
- Pointer, keyboard, and touch gestures retry blocked playback; they also resume the SDL AudioContext when suspended
- Browser autoplay policy is respected, not bypassed. Actual audible playback requires a user gesture and functioning browser audio output
- Decode preserves music content but exact PCM can differ from the historical native mixer settings/resampling. Vorbis is a lossy delivery format

## Verification and limits

Independent Emscripten compilation passed. All offline source modules decoded to nonempty PCM; full OGG files exist. Browser runtime playback, original WAV effects, fade transitions, and simultaneous WAV/music mixing still require the full game's browser test. Missing/unsupported media emits a console error. UN05 runtime decoding is not included; custom additional modules require conversion/mapping or a future Wasm MikMod build.

## Reproduce conversion

Use `prototype/build_music_decoder.py`, then `prototype/render_music.py` without `--seconds` to play until module completion, then `ffmpeg -i input.wav -c:a libvorbis -q:a 5 output.ogg`. Private asset and library rights remain applicable; no redistribution permission is implied.

The bridge now also passes `node port/tests/test-audio.js`, which exercises the real embedded JavaScript against deterministic Audio/DOM/SDL doubles for gesture retry, volume, replacement/stop resource release and stale asynchronous completion. Browser playback and decoder behavior remain unverified.
