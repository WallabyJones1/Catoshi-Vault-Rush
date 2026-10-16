"""python3 tools/sheet.py <expr-or-file> out.png [scale]; loads src/js/m*.js (no boot) and evaluates expr returning a dataURL"""
import sys, os, base64, io, glob
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP=os.environ.get('SKIP','m90').split(',')
MODS=[m for m in sorted(glob.glob(ROOT+'/src/js/m*.js')) if os.path.basename(m)[:3] not in SKIP]
expr=open(sys.argv[1]).read() if os.path.exists(sys.argv[1]) else sys.argv[1]
out=sys.argv[2]; scale=int(sys.argv[3]) if len(sys.argv)>3 else 3
src="'use strict';\nvar S={sound:1};\n"+'\n'.join(open(m).read() for m in MODS)
html='<html><body style="background:#222"><script>'+src+'\nwindow.__SHEET=()=>{'+expr+'};</script></body></html>'
tmp=os.environ.get('SP','/tmp')+'/sheet.html'
open(tmp,'w').write(html)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+tmp)
    try: url=pg.evaluate('window.__SHEET()')
    except Exception as e: print('ERR',e,errs); sys.exit(1)
    im=Image.open(io.BytesIO(base64.b64decode(url.split(',')[1])))
    im=im.resize((im.width*scale,im.height*scale),Image.NEAREST); im.save(out)
    print(errs or 'ok', out, im.size); b.close()
