#!/usr/bin/env python3
"""Compare renderer QA captures; requires Pillow. Preserve full frames for review."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

def different_pixels(diff):
    red, green, blue = diff.split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    return sum(maximum.histogram()[1:])


root = Path(__file__).resolve().parents[2]
out = root / 'port/evidence/webgl'
out.mkdir(parents=True, exist_ok=True)
results = {}
for before in sorted((root / 'qa/baseline').glob('*.png')):
    after = root / 'qa/after' / before.name
    if not after.exists():
        continue
    a, b = Image.open(before).convert('RGB'), Image.open(after).convert('RGB')
    assert a.size == b.size
    diff = ImageChops.difference(a, b)
    full = different_pixels(diff)
    # Original clock, CPU/task meters and footer change with elapsed simulation time.
    ImageDraw.Draw(diff).rectangle((0, 0, 443, 49), fill=0)
    ImageDraw.Draw(diff).rectangle((0, 748, 1023, 767), fill=0)
    stable = different_pixels(diff)
    results[before.stem] = {'fullFrameDifferentPixels': full, 'stableDifferentPixels': stable}
    assert stable == 0, (before.name, stable)
    pair = Image.new('RGB', (a.width * 2, a.height + 24), '#222222')
    pair.paste(a, (0, 24)); pair.paste(b, (a.width, 24))
    draw = ImageDraw.Draw(pair)
    draw.text((8, 5), f'{before.stem}: main baseline', fill='white')
    draw.text((a.width + 8, 5), 'shader/buffer renderer', fill='white')
    pair.save(out / before.name)
a = Image.open(root / 'qa/after/before-context-loss.png').convert('RGB')
b = Image.open(root / 'qa/after/after-context-restore.png').convert('RGB')
diff = ImageChops.difference(a, b)
ImageDraw.Draw(diff).rectangle((0, 0, 443, 49), fill=0)
ImageDraw.Draw(diff).rectangle((0, 748, 1023, 767), fill=0)
results['context-restoration'] = {'stableDifferentPixels': different_pixels(diff)}
assert results['context-restoration']['stableDifferentPixels'] == 0
(out / 'visual-comparison.json').write_text(json.dumps({'excludedDynamicRectangles': [[0,0,444,50],[0,748,1024,768]], 'scenes':results}, indent=2)+'\n')
print(f'PASS: {len(results)} comparisons have identical stable pixels')
