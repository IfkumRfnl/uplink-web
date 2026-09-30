/*
	Sound garden sound library
	SDL_mixer support
  */

// Now used instead of soundgarden_win32
//#ifndef WIN32
#ifdef USE_SDL

#include <stdio.h>
//#include <stdarg.h>

#ifndef WIN32
#include <unistd.h>
#endif // WIN32

#include <SDL/SDL_mixer.h>
#include <SDL/SDL.h>

#include "tosser.h"
#include "soundgarden.h"

#include "mmgr.h"


#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <string.h>

// Music is rendered offline by the original bundled MikMod UN05 decoder.
// Audio remains browser-native so original WAV effects can use SDL_mixer.
EM_JS(void, SgBrowserPlayMusic, (const char *track, int volume), {
  var state = Module['uplinkMusic'];
  if (!state) {
    state = Module['uplinkMusic'] = { audio: null, pending: false, failed: false };
    state.tryPlay = function() {
      var a = state.audio;
      if (!a || !state.pending) return;
      var promise = a.play();
      if (promise && promise.then) promise.then(function() {
        if (state.audio === a) state.pending = false;
      }).catch(function(error) {
        if (state.audio !== a) return;
        // A blocked autoplay request stays pending until a real user gesture.
        if (error.name === 'NotAllowedError') state.pending = true;
        else if (error.name !== 'AbortError') {
          state.failed = true; state.pending = false;
          console.error('Uplink music playback failed:', error);
        }
      });
    };
    var unlock = function() {
      if (typeof SDL !== 'undefined' && SDL.audioContext && SDL.audioContext.state === 'suspended')
        SDL.audioContext.resume().catch(function() {});
      state.tryPlay();
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('touchend', unlock, true);
  }
  if (state.audio) { state.audio.pause(); state.audio.removeAttribute('src'); state.audio.load(); }
  var name = UTF8ToString(track);
  var base = Module['uplinkMusicBaseURL'] || 'assets/music/';
  var a = new Audio(new URL(base + name + '.ogg', document.baseURI).href);
  a.loop = true; // Original Mix_PlayMusic(currentmod, -1) behavior.
  a.volume = Math.max(0, Math.min(1, volume / 128));
  a.preload = 'auto';
  state.audio = a; state.pending = true; state.failed = false;
  a.addEventListener('error', function() {
    if (state.audio === a) {
      state.failed = true; state.pending = false;
      console.error('Uplink original music asset unavailable:', a.src, a.error);
    }
  });
  state.tryPlay();
});
EM_JS(void, SgBrowserStopMusic, (), {
  var s = Module['uplinkMusic'];
  if (!s) return;
  s.pending = false; s.failed = false;
  var a = s.audio; s.audio = null;
  if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
});
EM_JS(void, SgBrowserMusicVolume, (int volume), {
  var s = Module['uplinkMusic'];
  if (s && s.audio) s.audio.volume = Math.max(0, Math.min(1, volume / 128));
});
EM_JS(int, SgBrowserMusicFinished, (), {
  var s = Module['uplinkMusic'];
  // Pending gesture/loading is not completion, avoiding playlist churn.
  return !s || !s.audio || s.failed || s.audio.ended ? 1 : 0;
});

static const char *SgBrowserTrackName(const char *filename)
{
  if (!filename) return NULL;
  static const char *names[] = { "a94final", "bluevalley", "myst2", "mystique", "serenity", "symphonic" };
  static const unsigned char headers[][18] = {
    {0x55,0x4e,0x30,0x35,0x09,0x16,0x00,0x00,0x00,0x21,0x00,0xbd,0x00,0x21,0x00,0x08,0x7d,0x0a},
    {0x55,0x4e,0x30,0x35,0x10,0x5d,0x00,0x00,0x00,0x63,0x00,0xba,0x01,0x1f,0x00,0x06,0x7d,0x00},
    {0x55,0x4e,0x30,0x35,0x0c,0x3b,0x00,0x00,0x00,0x36,0x00,0x26,0x01,0x26,0x00,0x06,0x80,0x01},
    {0x55,0x4e,0x30,0x35,0x0a,0x1c,0x00,0x00,0x00,0x1a,0x00,0x6e,0x00,0x20,0x00,0x06,0x7d,0x00},
    {0x55,0x4e,0x30,0x35,0x0e,0x18,0x00,0x00,0x00,0x0c,0x00,0x2d,0x00,0x24,0x00,0x06,0x8c,0x00},
    {0x55,0x4e,0x30,0x35,0x04,0x19,0x00,0x00,0x00,0x19,0x00,0x4f,0x00,0x1f,0x00,0x06,0x7d,0x04}
  };
  // RsArchiveFileOpen can return temp0.uni, so inspect the real module bytes
  // instead of guessing a track from the temporary filename.
  FILE *file = fopen(filename, "rb");
  if (!file) return NULL;
  unsigned char header[18];
  size_t count = fread(header, 1, sizeof(header), file); fclose(file);
  if (count != sizeof(header)) return NULL;
  for (int i=0; i<6; ++i)
    if (memcmp(header, headers[i], sizeof(header)) == 0) return names[i];
  return NULL;
}
#endif

static Mix_Music *currentmod = NULL;
static BTree <Mix_Chunk *> cache;					// Stores sounds already loaded

//static pthread_t mikmod_update_thread;
//static bool sg_thread_termination_requested = false;

//static void SgDebugPrintf( const char *fmt, ... );
static void * SgUpdateMikModThread( void *arg );

static void SgPrintActualSoundSettings();
static void SgPrintSDLMixerVersionInfo();
static void SgSetProcessPriority();

static int playerVolume = SDL_MIX_MAXVOLUME / 2;

static bool SgInitialised = false;

//#define _DEBUG

#ifdef _DEBUG
#define SgDebugPrintf(format,...) printf(format,__VA_ARGS__)
#else
#define SgDebugPrintf(format,...)
#endif

/*
static void SgDebugPrintf( const char *fmt, ... )
{
#ifdef _DEBUG
    va_list ap;
    va_start(ap, fmt);
    vprintf(fmt,ap);
    va_end(ap);
#endif
}
*/

void SgInitialise ()
{
  /* Initialise the SoundGarden library */

  SgPrintSDLMixerVersionInfo();

#ifdef _DEBUG
  if (SDL_Init(SDL_INIT_AUDIO|SDL_INIT_NOPARACHUTE) == -1) {
#else
  if (SDL_Init(SDL_INIT_AUDIO) == -1) {
#endif
    printf("SDL_Init error: %s\n", SDL_GetError());
    return;
  }

  int fragmentSize = 512;

  //if (Mix_OpenAudio(44100, MIX_DEFAULT_FORMAT, 2, fragmentSize)==-1) {
  if (Mix_OpenAudio(22050, MIX_DEFAULT_FORMAT, 2, fragmentSize)==-1) {
    printf("Mix_OpenAudio error: %s\n", Mix_GetError());
    return;
  }

  /* Allocate an appropriate number of mixing channels */
  Mix_AllocateChannels(16);
  
  /* Reserve the first channel for music effects */
  Mix_ReserveChannels(1);

  SgPrintActualSoundSettings();  
  
  SgSetProcessPriority();

  SgInitialised = true;
};

static void SgSetProcessPriority()
{
}

static void SgPrintSDLMixerVersionInfo()
{
  SDL_version compile_version;
  const SDL_version *link_version;

  MIX_VERSION(&compile_version);
  printf("Compiled with SDL_mixer version: %d.%d.%d\n", 
	 compile_version.major,
	 compile_version.minor,
	 compile_version.patch);
  link_version=Mix_Linked_Version();
  printf("Running with SDL_mixer version: %d.%d.%d\n", 
	 link_version->major,
	 link_version->minor,
	 link_version->patch);
}

static void SgPrintActualSoundSettings()
{
  if (!SgInitialised)
    return;

  // get and print the audio format in use
  int numtimesopened, frequency, channels;
  Uint16 format;
  numtimesopened=Mix_QuerySpec(&frequency, &format, &channels);
  if(!numtimesopened) {
    SgDebugPrintf("Mix_QuerySpec: %s\n",Mix_GetError());
  }
  else {
    char *format_str="Unknown";
    switch(format) {
    case AUDIO_U8: format_str="U8"; break;
    case AUDIO_S8: format_str="S8"; break;
    case AUDIO_U16LSB: format_str="U16LSB"; break;
    case AUDIO_S16LSB: format_str="S16LSB"; break;
    case AUDIO_U16MSB: format_str="U16MSB"; break;
    case AUDIO_S16MSB: format_str="S16MSB"; break;
    }
    printf("SDL_Mixer audio configuration: opened %d times, %dHz (%s) %d channels\n", 
	   numtimesopened, frequency, format_str, channels);
  }
}


void SgShutdown()
{
  if (!SgInitialised)
    return;

  SgStopMod();

  Mix_HaltChannel(-1); /* Stop playback on all channels */
  Mix_CloseAudio();
}

void SgPlaySound ( char *fullfilename, char *id, bool synchronised )
{
  if (!SgInitialised)
    return;

  Mix_Chunk *sample = NULL;
  char *sampleid = id ? id : fullfilename;

  if ( cache.LookupTree ( sampleid ) ) {

    // Sound sample already loaded into memory - start it playing
		
    sample = cache.GetData ( sampleid );
		
    if ( !sample ) {

      SgDebugPrintf ( "SoundGarden WARNING : Failed to load sound file from cache : %s\n", fullfilename );
      cache.RemoveData ( sampleid );
      return;

    }

  }
  else {

    // Load sample and place into cache

    sample = Mix_LoadWAV( fullfilename );
    if ( !sample ) {
      SgDebugPrintf ( "SoundGarden WARNING : Failed to load sound file %s\n (%s)", fullfilename, Mix_GetError() );
      return;
    }

    cache.PutData ( sampleid, sample );

  }

  Mix_VolumeChunk(sample, MIX_MAX_VOLUME / 4 );
  if ( Mix_PlayChannel(-1 /* First free unreserved channel */, sample, 0 /* number of loops */) == -1 ) {
    SgDebugPrintf("SoundGarden WARNING : Failed to play sound file %s\n (%s)\n", 
      fullfilename, Mix_GetError());
  }
}

static int musicVol()
{
	//return (int) ( playerVolume / 20.0 * ( MIX_MAX_VOLUME / 4.0 ) );
	return (int) ( playerVolume / 20.0 * ( MIX_MAX_VOLUME / 1.5 ) );
}

void SgPlayMod ( char *fullfilename )
{

  if (!SgInitialised)
    return;

  SgStopMod ();

#ifdef __EMSCRIPTEN__
  const char *track = SgBrowserTrackName(fullfilename);
  if (!track) {
    printf("SoundGarden: unknown original UN05 music file: %s\n", fullfilename ? fullfilename : "(null)");
    return;
  }
  SgBrowserPlayMusic(track, musicVol());
  return;
#else
  currentmod=Mix_LoadMUS(fullfilename);

  /* didn't work -> exit with errormsg. */

  if(currentmod==NULL){
    SgDebugPrintf("SoundGarden WARNING : Failed to load music file %s\n (%s)\n", 
      fullfilename, Mix_GetError());
    return;
  }

  /*  start playing the module: */
        
  Mix_VolumeMusic(musicVol());
	
  //Mix_PlayMusic(currentmod, 0 /* loops */);
  if ( Mix_PlayMusic(currentmod, -1 /* loops */) == -1 ) {
    SgDebugPrintf("SoundGarden WARNING : Failed to play music file %s\n (%s)\n", 
      fullfilename, Mix_GetError());
    return;
  }
        
  SgDebugPrintf ( "SoundGarden Playing Music : %s\n", fullfilename );
#endif

}

void SgSetModVolume ( int newvolume )
{
  if (!SgInitialised)
    return;

  SgDebugPrintf ( "SoundGarden Music Volume: %d\n", newvolume );
    
  playerVolume = newvolume;
#ifdef __EMSCRIPTEN__
  SgBrowserMusicVolume(musicVol());
#else
  Mix_VolumeMusic( musicVol() );
#endif
}

void SgStopMod ()
{
  if (!SgInitialised)
    return;

#ifdef __EMSCRIPTEN__
  SgBrowserStopMusic();
#else
  if (currentmod) {
    Mix_HaltMusic();
    Mix_FreeMusic(currentmod);  /* and free the module */
    currentmod = NULL;
  }
#endif
}

bool SgModFinished ()
{
  if (!SgInitialised)
    return false;

#ifdef __EMSCRIPTEN__
  return SgBrowserMusicFinished() != 0;
#else
  return !currentmod || !Mix_PlayingMusic ();
#endif
}

#endif
//#endif

