// Private feasibility harness. Original GUCCI, Eclipse and Image run in Wasm.
// This is deliberately not presented as the Uplink game or login screen.
#include <cstdio>
#include <cstring>
#include <sys/stat.h>
#include <GL/gl.h>
#include <SDL/SDL.h>
#include <emscripten.h>
#include "gucci.h"
#include "eclipse.h"
static Image logo, world;
static char agent[64]="browser-agent";
static int clicks=0,frames=0,mx=0,my=0;
static char status[128]="Ready. Type a name, then save and reload.";
EM_JS(void,flush_save,(),{FS.syncfs(false,function(err){document.getElementById('save-status').textContent=err?'Save failed: '+err:'Saved to IndexedDB';});});
EM_JS(void,play_sound,(int music),{window.playOriginalAudio(!!music);});
static void text(int x,int y,const char*s){GciDrawText(x,y,(char*)s,6);}
static void save(){FILE*f=fopen("/persistent/probe.txt","w");if(!f){strcpy(status,"SAVE FAILED");return;}fprintf(f,"%d\n%s\n",clicks,agent);fclose(f);flush_save();strcpy(status,"Saved. Reload the browser to verify.");}
static void clicked(Button*b){++clicks;if(!strcmp(b->name,"save"))save();else play_sound(!strcmp(b->name,"music"));}
static void drawButton(Button*b,bool hi,bool down){glDisable(GL_TEXTURE_2D);glColor3f(hi?.12:.06,hi?.36:.2,hi?.46:.28);glBegin(GL_QUADS);glVertex2i(b->x,b->y);glVertex2i(b->x+b->width,b->y);glVertex2i(b->x+b->width,b->y+b->height);glVertex2i(b->x,b->y+b->height);glEnd();glColor3f(.55,.9,1);text(b->x+12,b->y+26,b->caption);}
static void motion(int x,int y){mx=x;my=y;const char*names[]={"save","wav","music"};EclUnHighlightButton();for(int i=0;i<3;i++){Button*b=EclGetButton((char*)names[i]);if(x>=b->x&&x<b->x+b->width&&y>=b->y&&y<b->y+b->height)EclHighlightButton(b->name);}}
static void mouse(int button,int state,int x,int y){motion(x,y);if(button!=GCI_LEFT_BUTTON)return;const char*names[]={"save","wav","music"};for(int i=0;i<3;i++){Button*b=EclGetButton((char*)names[i]);if(x>=b->x&&x<b->x+b->width&&y>=b->y&&y<b->y+b->height){if(state==GCI_DOWN){EclClickButton(b->name);b->MouseDown();}else{b->MouseUp();EclUnClickButton();}return;}}EclUnClickButton();}
static void key(unsigned char c,int,int){size_t n=strlen(agent);if(c==8||c==127){if(n)agent[n-1]=0;}else if(c>=32&&c<127&&n<50){agent[n]=c;agent[n+1]=0;}}
static void render(){frames++;glClearColor(.015,.035,.065,1);glClear(GL_COLOR_BUFFER_BIT);glMatrixMode(GL_PROJECTION);glLoadIdentity();glOrtho(0,800,600,0,-1,1);glMatrixMode(GL_MODELVIEW);glLoadIdentity();glColor4f(1,1,1,1);logo.DrawBlend(50,35);glColor3f(.35,.75,.85);text(50,160,"PRIVATE BROWSER FEASIBILITY BUILD");glColor3f(.65,.8,.85);text(50,190,"Original C++ GUCCI / Eclipse / Image + original assets");text(50,216,"Technical harness only. Gameplay and Steam authentication not loaded.");world.DrawBlend(410,268);glColor3f(.65,.9,1);text(50,280,"Keyboard input:");text(50,310,agent);EclDrawAllButtons();glColor3f(.65,.9,1);char buf[160];snprintf(buf,sizeof(buf),"C++ frames: %d  |  clicks: %d  |  pointer: %d,%d",frames,clicks,mx,my);text(50,500,buf);text(50,532,status);text(50,565,"Save test uses Emscripten filesystem + browser IndexedDB");GciSwapBuffers();}
int main(){mkdir("/persistent",0777);FILE*f=fopen("/persistent/probe.txt","r");if(f){fscanf(f,"%d\n%63[^\n]",&clicks,agent);fclose(f);strcpy(status,"Restored previous probe from IndexedDB.");}GciInitGraphicsLibrary(0);char*e=GciInitGraphics("Uplink private browser prototype",GCI_DOUBLE|GCI_RGB,800,600,32,60,0,0);if(e){puts(e);return 1;}GciEnableTrueTypeSupport();if(!GciLoadTrueTypeFont(6,(char*)"dungeon",(char*)"/assets/fonts/dungeon.TTF",16)){puts("FONT FAILED");return 2;}logo.LoadTIF((char*)"/assets/rgba/graphics/mainmenu/uplinklogo.tif");world.LoadTIF((char*)"/assets/rgba/graphics/worldmaplarge.tif");world.Scale(340,180);EclReset(800,600);EclRegisterDefaultButtonCallbacks(drawButton,clicked,0,0);EclRegisterButton(50,335,300,42,(char*)"Save probe",(char*)"save");EclRegisterButton(50,390,140,42,(char*)"Play WAV",(char*)"wav");EclRegisterButton(205,390,145,42,(char*)"Play music",(char*)"music");GciDisplayFunc(render);GciPassiveMotionFunc(motion);GciMouseFunc(mouse);GciKeyboardFunc(key);GciMainLoop();return 0;}
