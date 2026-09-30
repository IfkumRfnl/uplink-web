// Compile the actual browser Image implementation and include Redshirt's TU so
// the private sidecar helper can be exercised without substituting a test copy.
#include <assert.h>
#include <limits.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include "image.h"
#include "redshirt.cpp"

static const unsigned char sample[] = {
    2,0,0,0, 2,0,0,0,
    0,0,255,255, 255,255,255,255, // bottom scanline: blue, white
    255,0,0,255, 0,255,0,255      // top scanline: red, green
};

static void writeFile(const char *path, const unsigned char *bytes, size_t size)
{
    FILE *file = fopen(path, "wb");
    assert(file);
    assert(fwrite(bytes, 1, size, file) == size);
    assert(fclose(file) == 0);
}

static bool exists(const char *path)
{
    FILE *file = fopen(path, "rb");
    if (!file) return false;
    fclose(file);
    return true;
}

static void expectSample(Image &image)
{
    assert(image.Width() == 2 && image.Height() == 2);
    assert(memcmp(image.pixels, sample + 8, sizeof(sample) - 8) == 0);
}

static void expectError(Image &image)
{
    assert(image.Width() == 32 && image.Height() == 32);
    assert((unsigned char)image.GetPixelR(0,0) == 255);
    assert((unsigned char)image.GetPixelR(1,2) == 0);
}

int main()
{
    Image image;
    writeFile("/tmp/direct.tif.rgba", sample, sizeof(sample));
    image.LoadTIF((char*)"/tmp/direct.tif");
    expectSample(image);
    assert((unsigned char)image.GetPixelB(0,0) == 255);
    assert((unsigned char)image.GetPixelR(0,1) == 255);
    assert(image.GetRGBPixels()[2] == 255);
    image.Scale(3,3);
    assert(image.Width() == 3 && image.Height() == 3);
    for (int c = 0; c < 3; ++c) assert(image.pixels[(1 * 3 + 1) * 4 + c] == 128);
    assert(image.pixels[(1 * 3 + 1) * 4 + 3] == 255);
    assert((unsigned char)image.GetPixelB(0,0) == 255);
    assert((unsigned char)image.GetPixelR(0,2) == 255);
    assert(image.GetRGBPixels()[3 * 4] == 128); // regenerated RGB cache
    image.Scale(0,2); image.Scale(-1,2); image.Scale(INT_MAX,INT_MAX);
    assert(image.Width() == 3 && image.Height() == 3);
    image.Scale(1,1);
    assert(image.Width() == 1 && image.Height() == 1);
    assert(image.pixels[0] == 128 && image.pixels[1] == 128 && image.pixels[2] == 128);
    puts("PASS: bottom-up RGBA, bilinear scaling, alpha, cache invalidation, dimension guards");

    image.LoadTIF((char*)"/tmp/missing.tif"); expectError(image);
    image.LoadTIF(NULL); expectError(image);
    writeFile("/tmp/bad.tif.rgba", sample, 4); // truncated header
    image.LoadTIF((char*)"/tmp/bad.tif"); expectError(image);
    writeFile("/tmp/bad.tif.rgba", sample, sizeof(sample) - 1); // truncated pixels
    image.LoadTIF((char*)"/tmp/bad.tif"); expectError(image);
    const unsigned char zero[] = {0,0,0,0, 2,0,0,0};
    writeFile("/tmp/bad.tif.rgba", zero, sizeof(zero));
    image.LoadTIF((char*)"/tmp/bad.tif"); expectError(image);
    const unsigned char overflow[] = {255,255,255,127, 255,255,255,127};
    writeFile("/tmp/bad.tif.rgba", overflow, sizeof(overflow));
    image.LoadTIF((char*)"/tmp/bad.tif"); expectError(image);
    const unsigned char unsignedOverflow[] = {255,255,255,255, 1,0,0,0};
    writeFile("/tmp/bad.tif.rgba", unsignedOverflow, sizeof(unsignedOverflow));
    image.LoadTIF((char*)"/tmp/bad.tif"); expectError(image);
    puts("PASS: missing/null inputs, short headers/pixels, zero and overflowing dimensions");

    mkdir("/assets",0777); mkdir("/assets/rgba",0777); mkdir("/assets/rgba/graphics",0777);
    writeFile("/assets/rgba/graphics/test.tif.rgba", sample, sizeof(sample));
    image.LoadTIF((char*)"/game/graphics/test.tif"); expectSample(image);
    image.LoadTIF((char*)"graphics/test.tif"); expectSample(image);
    image.LoadTIF((char*)"C:\\game\\graphics\\test.tif"); expectSample(image);
    image.LoadTIF((char*)"/game/graphics/absent.tif"); expectError(image);
    image.LoadTIF((char*)"/game/notgraphics/test.tif"); expectError(image);
    image.LoadTIF((char*)"graphics/../graphics/test.tif"); expectError(image);
    image.LoadTIF((char*)"C:\\graphics\\..\\graphics\\test.tif"); expectError(image);
    // Explicit adjacent sidecar takes precedence over the fallback.
    mkdir("/game",0777); mkdir("/game/graphics",0777);
    const unsigned char singlePixel[] = {1,0,0,0, 1,0,0,0, 12,34,56,255};
    writeFile("/game/graphics/test.tif.rgba", singlePixel, sizeof(singlePixel));
    image.LoadTIF((char*)"/game/graphics/test.tif");
    assert(image.Width() == 1 && image.Height() == 1 && image.pixels[0] == 12);
    puts("PASS: exact fallback mapping, slash normalization, primary precedence, traversal rejection");

    const unsigned char originalTiff[] = {'I','I',42,0};
    writeFile("/tmp/temp0.tif", originalTiff, sizeof(originalTiff));
    RsCopyBrowserImageSidecar("/game/graphics/test.tif", "/tmp/temp0.tif");
    image.LoadTIF((char*)"/tmp/temp0.tif"); expectSample(image);
    FILE *original = fopen("/tmp/temp0.tif", "rb"); assert(original);
    unsigned char retained[sizeof(originalTiff)];
    assert(fread(retained,1,sizeof(retained),original) == sizeof(retained)); fclose(original);
    assert(memcmp(retained, originalTiff, sizeof(retained)) == 0);
    RsCopyBrowserImageSidecar("/game/graphics/absent.tif", "/tmp/temp0.tif");
    assert(!exists("/tmp/temp0.tif.rgba"));
    RsCopyBrowserImageSidecar("C:\\game\\graphics\\test.tif", "/tmp/temp0.tif");
    image.LoadTIF((char*)"/tmp/temp0.tif"); expectSample(image);
    RsCopyBrowserImageSidecar("/game/graphics/../graphics/test.tif", "/tmp/temp0.tif");
    assert(!exists("/tmp/temp0.tif.rgba"));
    RsCopyBrowserImageSidecar("/game/notgraphics/test.tif", "/tmp/temp0.tif");
    assert(!exists("/tmp/temp0.tif.rgba"));
    puts("PASS: archive temp sidecars, original TIFF retention, stale cleanup, traversal rejection");
    puts("All Image/Redshirt browser unit tests passed");
}
