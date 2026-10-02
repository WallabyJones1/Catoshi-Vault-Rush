"""Assemble the approved ten-pose sheet; runtime serves prebuilt media only.
Development dependency: Pillow with WebP support. Run from the project root.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import math

ROOT = Path(__file__).resolve().parents[1]
POSES = [(33,75,351,289),(429,72,351,292),(830,78,339,286),(1210,71,354,293),(1604,70,348,294),
         (35,417,350,307),(426,425,354,297),(825,430,344,290),(1215,428,349,294),(1601,430,351,291)]
HOLDS = [460,360,160,380,350,550,320,360,160,520]
sheet = Image.open(ROOT / 'catoshi-home-loop-v1.png').convert('RGBA')
frames = []
for i, (x,y,w,h) in enumerate(POSES):
    frame = Image.new('RGBA', (320,320))
    ImageDraw.Draw(frame).ellipse((74,284,254,294), fill=(232,161,58,20))
    width = 250
    crop = sheet.crop((x,y,x+w,y+h)).resize((width,round(width*h/w)), Image.Resampling.LANCZOS)
    baseline = 280 + round(math.sin(i / 10 * math.tau) * 3)
    frame.alpha_composite(crop, (164-width//2,baseline-crop.height))
    frames.append(frame)
frames[0].save(ROOT / 'catoshi-home-still-v2.png', optimize=True)
frames[0].save(ROOT / 'catoshi-home-v2.webp', save_all=True, append_images=frames[1:],
               duration=HOLDS, loop=0, lossless=True, method=6)
# Single shared palette, transparent slot zero, complete-frame disposal:
# avoid trails and inconsistent palette colors in the fallback animation.
atlas = Image.new('RGB', (320*10,320), (10,9,8))
for i, frame in enumerate(frames):
    atlas.paste(frame, (i*320,0), frame)
palette = atlas.quantize(colors=255)
gifs = []
for frame in frames:
    rgb = Image.new('RGB', frame.size, (10,9,8));rgb.paste(frame,mask=frame.getchannel('A'))
    indexed = rgb.quantize(palette=palette, dither=Image.Dither.NONE)
    colors = indexed.getpalette()[:255*3]
    indices = bytes(index+1 if alpha>=64 else 0 for index,alpha in zip(indexed.tobytes(),frame.getchannel('A').tobytes()))
    output = Image.frombytes('P',frame.size,indices)
    output.putpalette([10,9,8]+colors)
    gifs.append(output)
gifs[0].save(ROOT / 'catoshi-home-v2.gif', save_all=True, append_images=gifs[1:],
             duration=HOLDS, loop=0, transparency=0, disposal=2, optimize=False)
for filename in ['catoshi-home-v2.webp','catoshi-home-v2.gif']:
    animation = Image.open(ROOT / filename)
    assert animation.n_frames == 10 and animation.info['loop'] == 0
    print(filename, animation.n_frames, (ROOT / filename).stat().st_size, 'bytes')
