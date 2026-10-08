from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import struct,zlib,json
W,H=1200,2214
im=Image.new('RGBA',(W,H),'#0a0908');d=ImageDraw.Draw(im)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for y in range(630):
 t=y/630;d.line((0,y,1200,y),fill=(int(25+19*t),int(21+13*t),int(18+8*t),255))
# Quiet silhouetted dunes keep the score legible.
d.polygon([(0,495),(170,445),(320,480),(450,438),(680,510),(910,410),(1200,435),(1200,630),(0,630)],fill='#31291f')
d.polygon([(0,560),(220,510),(490,590),(760,520),(1000,580),(1200,530),(1200,630),(0,630)],fill='#211c16')
d.rounded_rectangle((52,45,76,88),radius=7,fill='#f26b35')
d.text((96,42),'CATOSHI / VAULT RUSH',font=ImageFont.truetype(font,32),fill='#f2efe9')
d.line((60,114,1140,114),fill='#57402c',width=2)
d.line((60,548,1140,548),fill='#57402c',width=1)
d.text((60,579),'CATOSHIRUSH.FUN',font=ImageFont.truetype(font,20),fill='#8d8880')
sheet=Image.open('catoshi-clean-actions.png').convert('RGBA');hero=sheet.crop((19,104,359,399));hero.thumbnail((390,340),Image.Resampling.LANCZOS)
im.alpha_composite(hero,(790,235))
# Font atlas below the share picture: ASCII 32..126, 9 columns x 11 rows.
# Embedded pixels mean the production server needs no fonts/native packages.
f=ImageFont.truetype(font,96)
chars=[chr(code) for code in range(32,127)]
metrics={'size':96,'advance':{c:f.getlength(c) for c in chars},
         'kern':{a+b:f.getlength(a+b)-f.getlength(a)-f.getlength(b) for a in chars for b in chars
                 if abs(f.getlength(a+b)-f.getlength(a)-f.getlength(b))>.01}}
Path('share-font-v2.json').write_text(json.dumps(metrics,separators=(',',':')))
for code in range(32,127):
 idx=code-32;x=(idx%9)*128;y=630+(idx//9)*144
 d.rectangle((x,y,x+127,y+143),fill=(0,0,0,0));d.text((x+1,y+3),chr(code),font=f,fill='white',stroke_width=0)
def chunk(k,v):return struct.pack('>I',len(v))+k+v+struct.pack('>I',zlib.crc32(k+v)&0xffffffff)
pixels=im.tobytes();scan=b''.join(b'\0'+pixels[y*W*4:(y+1)*W*4] for y in range(H))
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',W,H,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
Path('share-art-v1.png').write_bytes(png)
