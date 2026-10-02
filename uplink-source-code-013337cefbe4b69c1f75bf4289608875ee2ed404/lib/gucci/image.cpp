#include "uplink_draw.h"
// Image.cpp: implementation of the Image class.
//
//////////////////////////////////////////////////////////////////////

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef WIN32
#include <windows.h>
#endif

#ifdef __EMSCRIPTEN__
#define GL_GLEXT_PROTOTYPES
#endif
#include <GL/gl.h>
#ifdef __EMSCRIPTEN__
#include <GL/glext.h>
#endif
#ifdef __EMSCRIPTEN__
#include <stdint.h>
#include <limits.h>
#include <emscripten.h>
typedef uint32_t uint32;
#else
#include <GL/glu.h>
#include "tiff.h"
#include "tiffio.h"
#endif

#include "image.h"

#include "mmgr.h"

#ifdef __EMSCRIPTEN__
// Redshirt may return a filesystem-prefixed graphics path. Resolve only an
// exact graphics/ component beneath the known converted-asset root. Archive
// temp0.tif names have no asset identity; Redshirt must preserve the source path.
static FILE *OpenBrowserImageFallback ( const char *filename )
{
    const size_t length = strlen(filename);
    char *normalized = new char[length + 1];
    for (size_t i = 0; i <= length; ++i)
        normalized[i] = filename[i] == '\\' ? '/' : filename[i];
    const char *graphics = NULL;
    bool safe = true;
    for (const char *part = normalized; *part;) {
        const char *end = strchr(part, '/');
        const size_t count = end ? (size_t)(end - part) : strlen(part);
        if (count == 2 && part[0] == '.' && part[1] == '.') {
            safe = false;
            break;
        }
        if (!graphics && count == 8 && strncmp(part, "graphics", 8) == 0 && end)
            graphics = part;
        if (!end) break;
        part = end + 1;
    }
    FILE *file = NULL;
    if (safe && graphics && graphics[9]) {
        const size_t pathSize = sizeof("/assets/rgba/") + strlen(graphics) + sizeof(".rgba");
        char *path = new char[pathSize];
        snprintf(path, pathSize, "/assets/rgba/%s.rgba", graphics);
        file = fopen(path, "rb");
        delete [] path;
    }
    delete [] normalized;
    return file;
}

// WebGL has no glDrawPixels. Keep the source bottom-up and map its last
// scanline to the top of the game's top-left-origin orthographic viewport.
static void DrawBrowserImage ( int x, int y, int width, int height,
                               Image *image, bool blend )
{
    if (width <= 0 || height <= 0) return;
    GLint activeTexture, binding, unpackAlignment, textureEnv;
    GLint srcRGB, dstRGB, srcAlpha, dstAlpha;
    UplinkDraw::getIntegerv(GL_ACTIVE_TEXTURE, &activeTexture);
    UplinkDraw::activeTexture(GL_TEXTURE0);
    UplinkDraw::getIntegerv(GL_TEXTURE_BINDING_2D, &binding);
    UplinkDraw::getIntegerv(GL_UNPACK_ALIGNMENT, &unpackAlignment);
    UplinkDraw::getTexEnviv(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, &textureEnv);
    // Texture sampling enable is explicit renderer state, not a WebGL capability.
    const bool textureEnabled = UplinkDraw::isEnabled(GL_TEXTURE_2D) != 0;
    const GLboolean blendEnabled = UplinkDraw::isEnabled(GL_BLEND);
    const GLboolean cullEnabled = UplinkDraw::isEnabled(GL_CULL_FACE);
    UplinkDraw::getIntegerv(GL_BLEND_SRC_RGB, &srcRGB);
    UplinkDraw::getIntegerv(GL_BLEND_DST_RGB, &dstRGB);
    UplinkDraw::getIntegerv(GL_BLEND_SRC_ALPHA, &srcAlpha);
    UplinkDraw::getIntegerv(GL_BLEND_DST_ALPHA, &dstAlpha);

    image->BindBrowserTexture();
    UplinkDraw::enable(GL_TEXTURE_2D);
    // REPLACE reproduces glDrawPixels without modifying the current GL color.
    UplinkDraw::texEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_REPLACE);
    UplinkDraw::disable(GL_CULL_FACE);
    if (blend) {
        UplinkDraw::enable(GL_BLEND);
        UplinkDraw::blendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    } else {
        UplinkDraw::disable(GL_BLEND);
    }
    UplinkDraw::begin(GL_QUADS);
    UplinkDraw::texCoord2f(0, 1); UplinkDraw::vertex2i(x, y);
    UplinkDraw::texCoord2f(0, 0); UplinkDraw::vertex2i(x, y + height);
    UplinkDraw::texCoord2f(1, 0); UplinkDraw::vertex2i(x + width, y + height);
    UplinkDraw::texCoord2f(1, 1); UplinkDraw::vertex2i(x + width, y);
    UplinkDraw::end();

    UplinkDraw::bindTexture(GL_TEXTURE_2D, binding);
    UplinkDraw::pixelStorei(GL_UNPACK_ALIGNMENT, unpackAlignment);
    UplinkDraw::texEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, textureEnv);
    if (!textureEnabled) UplinkDraw::disable(GL_TEXTURE_2D);
    if (cullEnabled) UplinkDraw::enable(GL_CULL_FACE);
    UplinkDraw::blendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha);
    if (blendEnabled) UplinkDraw::enable(GL_BLEND); else UplinkDraw::disable(GL_BLEND);
    UplinkDraw::activeTexture(activeTexture);
}
#endif

#ifdef __EMSCRIPTEN__
void Image::BindBrowserTexture()
{
    if (!browserTexture) {
        UplinkDraw::genTextures(1, &browserTexture);
        UplinkDraw::bindTexture(GL_TEXTURE_2D, browserTexture);
        UplinkDraw::texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        UplinkDraw::texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        UplinkDraw::texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        UplinkDraw::texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    } else {
        UplinkDraw::bindTexture(GL_TEXTURE_2D, browserTexture);
    }
    GLint unpackAlignment;
    UplinkDraw::getIntegerv(GL_UNPACK_ALIGNMENT, &unpackAlignment);
    UplinkDraw::pixelStorei(GL_UNPACK_ALIGNMENT, 1);
    // The renderer compares against its recovery pixels, so public pixels and
    // every Image mutator remain observable without a second CPU-side cache.
    UplinkDraw::texImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0,
                          GL_RGBA, GL_UNSIGNED_BYTE, pixels);
    UplinkDraw::pixelStorei(GL_UNPACK_ALIGNMENT, unpackAlignment);
}
#endif

//////////////////////////////////////////////////////////////////////
// Construction/Destruction
//////////////////////////////////////////////////////////////////////

Image::Image()
{

#ifdef __EMSCRIPTEN__
    browserTexture = 0;
#endif
	pixels = NULL;
	rgb_pixels = NULL;

}

Image::Image( const Image& img )
{

#ifdef __EMSCRIPTEN__
    browserTexture = 0;
#endif
	width = img.width;
	height = img.height;
	alpha = img.alpha;

	pixels = NULL;
	if ( img.pixels ) {
		pixels = new unsigned char [ width * height * 4 ];
		memcpy ( pixels, img.pixels, width * height * 4 );
	}

	rgb_pixels = NULL;
	if ( img.rgb_pixels ) {
	    rgb_pixels = new unsigned char [ width * height * 3 ];
		memcpy ( rgb_pixels, img.rgb_pixels, width * height * 3 );
	}

}

Image::~Image()
{
#ifdef __EMSCRIPTEN__
    if (browserTexture) UplinkDraw::deleteTextures(1, &browserTexture);
#endif

	if ( pixels )
		delete [] pixels;
	if ( rgb_pixels )
		delete [] rgb_pixels;

}

void Image::LoadRAW ( char *filename, int sizex, int sizey )
{

	width = sizex;
	height = sizey;

	if ( rgb_pixels ) {
		delete [] rgb_pixels;
		rgb_pixels = NULL;
	}

	if ( pixels )
		delete [] pixels;
	pixels = new unsigned char [sizex * sizey * 4];

	FILE *file = fopen ( filename, "rb" );

	if ( !file ) {
		printf ( "GUCCI Error - failed to load RAW image %s\n", filename );
		//exit(255);
		CreateErrorBitmap ();
		return;
	}

	for ( int y = 0; y < sizey; ++y ) {
		for ( int x = 0; x < sizex; ++x ) {

			for ( int i = 0; i < 3; ++i ) {
				
				int thechar = fgetc ( file );
				pixels [((height-y-1) * width + x) * 4 + i] = (unsigned char) thechar;

			}

			pixels [((height-y-1) * width + x) * 4 + 3] = alpha;

		}
	}

	fclose ( file );

}

void Image::LoadTIF ( char *filename )
{

#ifdef __EMSCRIPTEN__
    if (!filename) { CreateErrorBitmap(); return; }
    // Asset preparation writes <original filename>.rgba: LE u32 width/height,
    // followed by tightly packed bottom-up RGBA bytes, matching libtiff output.
    const size_t pathSize = strlen(filename) + sizeof(".rgba");
    char *path = new char[pathSize];
    snprintf(path, pathSize, "%s.rgba", filename);
    FILE *file = fopen(path, "rb");
    delete [] path;
    if (!file) file = OpenBrowserImageFallback(filename);
    unsigned char header[8];
    uint32 w = 0, h = 0;
    bool valid = file && fread(header, 1, sizeof(header), file) == sizeof(header);
    if (valid) {
        for (int i = 0; i < 4; ++i) {
            w |= ((uint32)header[i]) << (8 * i);
            h |= ((uint32)header[i + 4]) << (8 * i);
        }
        valid = w > 0 && h > 0 && w <= INT_MAX && h <= INT_MAX
             && (uint64_t)w * h <= INT_MAX / 4;
    }
    unsigned char *raster = NULL;
    if (valid) {
        const size_t size = (size_t)w * h * 4;
        raster = new unsigned char[size];
        valid = fread(raster, 1, size, file) == size;
    }
    if (file) fclose(file);
    if (!valid) {
        delete [] raster;
        printf("GUCCI Error - failed to load browser RGBA image %s\n", filename);
        CreateErrorBitmap();
        return;
    }
    delete [] rgb_pixels;
    rgb_pixels = NULL;
    delete [] pixels;
    pixels = raster;
    width = (int)w;
    height = (int)h;
#else
    char emsg[1024];		
	TIFFRGBAImage img;

    TIFF *tif = TIFFOpen(filename, "r");
    if ( !tif ) {
        printf ( "GUCCI Error - failed to load TIF %s\n", filename );
		CreateErrorBitmap ();
		return;
	}

    TIFFRGBAImageBegin (&img, tif, 0, emsg);
    int npixels = img.width * img.height;    
	uint32 *raster = new uint32 [npixels * sizeof(uint32)];
    
	TIFFRGBAImageGet(&img, raster, img.width, img.height);

	// Now convert the TIFF data into RAW data

	width = img.width;
	height = img.height;

	if ( rgb_pixels ) {
		delete [] rgb_pixels;
		rgb_pixels = NULL;
	}

	if ( pixels )
		delete [] pixels;
	pixels = (unsigned char *) raster;

	// Close down all those horrible TIF structures

    TIFFRGBAImageEnd(&img);
	TIFFClose ( tif );
#endif

}

void Image::SetAlpha ( float newalpha )
{

	alpha = (unsigned char) ( newalpha * 256.0 );
	unsigned char a = (unsigned char) ( newalpha * 255.0 );
	
	if ( pixels ) {

		for ( int x = 0; x < width; ++x ) 
			for ( int y = 0; y < height; ++y )
				pixels [( y * width + x) * 4 + 3] = a;

	}

}

void Image::SetAlphaBorderRec ( int x, int y, unsigned char a, unsigned char r, unsigned char g, unsigned char b )
{

	if ( 0 <= x && x < width && 0 <= y && y < height ) {
		unsigned char *curpixel = &pixels [( y * width + x) * 4];
		if ( curpixel[3] != a && curpixel[0] == r && curpixel[1] == g && curpixel[2] == b ) {
			curpixel[3] = a;
			SetAlphaBorderRec ( x - 1, y, a, r, g, b );
			SetAlphaBorderRec ( x + 1, y, a, r, g, b );
			SetAlphaBorderRec ( x, y - 1, a, r, g, b );
			SetAlphaBorderRec ( x, y + 1, a, r, g, b );
		}
	}

}

void Image::SetAlphaBorder ( float newalpha, float testred, float testgreen, float testblue )
{

	unsigned char a = (unsigned char) ( newalpha * 255.0 );
	unsigned char r = (unsigned char) ( testred * 255.0 );
	unsigned char g = (unsigned char) ( testgreen * 255.0 );
	unsigned char b = (unsigned char) ( testblue * 255.0 );
	
	if ( pixels ) {

		for ( int x = 0; x < width; ++x ) {
			SetAlphaBorderRec ( x, 0, a, r, g, b );
			SetAlphaBorderRec ( x, height - 1, a, r, g, b );
		}

		for ( int y = 0; y < height; ++y ) {
			SetAlphaBorderRec ( 0, y, a, r, g, b );
			SetAlphaBorderRec ( width - 1, y, a, r, g, b );
		}

	}

}

float Image::GetAlpha ()
{

	return float ( alpha / 256.0 );

}

int Image::Width ()
{
	
	return width;

}

int Image::Height ()
{

	return height;

}

void Image::FlipAroundH ()
{

	if ( pixels ) {

		unsigned char *newpixels = new unsigned char [width * height * 4];
		
		for ( int y = 0; y < height; ++y ) {

			unsigned char *source = pixels + y * width * 4;
			unsigned char *dest = newpixels + (width * (height-1) * 4) - (y * width * 4);

			memcpy ( (void *) dest, (void *) source, width * 4 );

		}

		if ( rgb_pixels ) {
			delete [] rgb_pixels;
			rgb_pixels = NULL;
		}

		delete [] pixels;
		pixels = newpixels;

	}

}

void Image::Scale ( int newwidth, int newheight )
{

#ifdef __EMSCRIPTEN__
    if (newwidth <= 0 || newheight <= 0 || width <= 0 || height <= 0 ||
        (uint64_t)newwidth * newheight > INT_MAX / 4) return;
#endif
	if ( pixels ) {

		unsigned char *newpixels = new unsigned char [newwidth * newheight * 4];

#ifdef __EMSCRIPTEN__
        // Pixel-center bilinear scaling, independent of unavailable GLU APIs.
        for (int y = 0; y < newheight; ++y) {
            float sy = (y + 0.5f) * height / newheight - 0.5f;
            if (sy < 0) sy = 0;
            if (sy > height - 1) sy = (float)(height - 1);
            int y0 = (int)sy, y1 = y0 + 1 < height ? y0 + 1 : y0;
            float fy = sy - y0;
            for (int x = 0; x < newwidth; ++x) {
                float sx = (x + 0.5f) * width / newwidth - 0.5f;
                if (sx < 0) sx = 0;
                if (sx > width - 1) sx = (float)(width - 1);
                int x0 = (int)sx, x1 = x0 + 1 < width ? x0 + 1 : x0;
                float fx = sx - x0;
                for (int c = 0; c < 4; ++c) {
                    float a = pixels[(y0 * width + x0) * 4 + c] * (1 - fx)
                            + pixels[(y0 * width + x1) * 4 + c] * fx;
                    float b = pixels[(y1 * width + x0) * 4 + c] * (1 - fx)
                            + pixels[(y1 * width + x1) * 4 + c] * fx;
                    newpixels[(y * newwidth + x) * 4 + c] =
                        (unsigned char)(a * (1 - fy) + b * fy + 0.5f);
                }
            }
        }
#else
/*
		for ( int x = 0; x < newwidth; ++x ) {
			for ( int y = 0; y < newheight; ++y ) {

				int scaleX = ((float) x / (float) newwidth) * width;
				int scaleY = ((float) y / (float) newheight) * height;

				for ( int i = 0; i < 4; ++i )
					newpixels [ (y * newwidth + x) * 4 + i ] = pixels [ (scaleY * width + scaleX) * 4 + i ];

			}
		}
*/
		int result = gluScaleImage ( GL_RGBA, width, height, GL_UNSIGNED_BYTE, pixels, newwidth, newheight, GL_UNSIGNED_BYTE, newpixels );
		char *resultc = (char *) gluErrorString ( (GLenum) result );
#endif

		if ( rgb_pixels ) {
			delete [] rgb_pixels;
			rgb_pixels = NULL;
		}

		delete [] pixels;
		pixels = newpixels;

		width = newwidth;
		height = newheight;

	}
		
}

void Image::ScaleToOpenGL ()
{

	int twidth, theight;

	if		( width <= 32 )  twidth = 64;
	else if ( width <= 128 ) twidth = 128;
	else					 twidth = 256;

	if		( height <= 32 )  theight = 64;
	else if ( height <= 128 ) theight = 128;
	else					  theight = 256;

	Scale ( twidth, theight );

}

void Image::Draw ( int x, int y )
{

	if ( pixels ) {

#ifdef __EMSCRIPTEN__
        DrawBrowserImage(x, y, width, height, this, false);
#else
		UplinkDraw::pushAttrib ( GL_ALL_ATTRIB_BITS );
		UplinkDraw::disable ( GL_BLEND );

		glRasterPos2i ( x, y + height );
		glDrawPixels ( width, height, GL_RGBA, GL_UNSIGNED_BYTE, pixels );

		UplinkDraw::popAttrib ();
#endif

	}

}

unsigned char *Image::GetRGBPixels()
{

	if ( pixels ) {

		if ( rgb_pixels == NULL ) {
			rgb_pixels = new unsigned char [ width * height * 3 ];

			for ( int x = 0; x < width; ++x ) 
				for ( int y = 0; y < height; ++y ) 
					for ( int i = 0; i < 3; ++i)
						rgb_pixels[3 * (y * width + x) + i] = pixels[4 * (y * width + x) + i];
		}

	}

	return rgb_pixels;

}

void Image::DrawBlend ( int x, int y )
{

	if ( pixels ) {

#ifdef __EMSCRIPTEN__
        DrawBrowserImage(x, y, width, height, this, true);
#else
		UplinkDraw::pushAttrib ( GL_ALL_ATTRIB_BITS );

		UplinkDraw::blendFunc ( GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA );
		UplinkDraw::enable ( GL_BLEND );

		glRasterPos2i ( x, y + height );
		glDrawPixels ( width, height, GL_RGBA, GL_UNSIGNED_BYTE, pixels );

		UplinkDraw::popAttrib ();
#endif

	}

}

void Image::CreateErrorBitmap ()
{

	width = 32;
	height = 32;
	uint32 *newimage = new uint32 [ width * height * sizeof(uint32) ];

	uint32 WHITE = 0xFFFFFFFF;
	uint32 BLACK = 0xFF000000;

	for ( int x = 0; x < width; ++x ) {
		for ( int y = 0; y < height; ++y ) {

			if ( x == 0 || y == 0 || x == width - 1 || y == height - 1 || x == y || x + y == width )
				newimage [y * width + x] = WHITE;

			else
				newimage [y * width + x] = BLACK;

		}
	}
	
	if ( rgb_pixels ) {
		delete [] rgb_pixels;
		rgb_pixels = NULL;
	}

	if ( pixels )
		delete [] pixels;
	pixels = (unsigned char *) newimage;

}

char Image::GetPixelR ( int x, int y )
{

	if ( pixels ) {

		if ( x < 0 || x >= width ||
	  		 y < 0 || y >= height )

			 return -1;

		else

			return ( pixels [(y * width + x) * 4] );

	}

	 return -1;

}

char Image::GetPixelG ( int x, int y )
{

	if ( pixels ) {

		if ( x < 0 || x >= width ||
	  		 y < 0 || y >= height )

			 return -1;

		else

			return ( pixels [(y * width + x) * 4 + 1] );

	}

	 return -1;

}

char Image::GetPixelB ( int x, int y )
{

	if ( pixels ) {

		if ( x < 0 || x >= width ||
	  		 y < 0 || y >= height )

			return -1;

		else

			return ( pixels [(y * width + x) * 4 + 2] );

	}

	 return -1;

}
