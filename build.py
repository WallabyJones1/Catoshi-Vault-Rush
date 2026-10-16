"""Build Catoshi's Catch: concatenates src/js/m*.js into src/template.html -> dist/catoshi.html (artifact body), dist/index.html + dist/play.html (served by server.js) and dist/catoshicatch/index.html (the website, catoshirush.fun/catoshicatch)."""
import glob, os, sys
ROOT=os.path.dirname(os.path.abspath(__file__)); SRC=os.path.join(ROOT,'src')
def asc(s): return ''.join(c if ord(c)<128 else ('\\u%04x'%ord(c) if ord(c)<0x10000 else ''.join('\\u%04x'%u for u in (0xD800+((ord(c)-0x10000)>>10),0xDC00+((ord(c)-0x10000)&0x3FF)))) for c in s)
def html_asc(s): return ''.join(c if ord(c)<128 else '&#%d;'%ord(c) for c in s)
mods=sorted(glob.glob(os.path.join(SRC,'js','m*.js')))
js="\n'use strict';\n"+'\n'.join(open(m,encoding='utf8').read() for m in mods)
js=asc(js)
if '</script' in js.lower(): sys.exit('module contains </script')
tpl=html_asc(open(os.path.join(SRC,'template.html'),encoding='utf8').read())
out=tpl.replace('/*@@FONTS@@*/',open(os.path.join(SRC,'fonts.css'),encoding='utf8').read()).replace('/*@@JS@@*/',js)
os.makedirs(os.path.join(ROOT,'dist'),exist_ok=True)
open(os.path.join(ROOT,'dist','catoshi.html'),'w',encoding='ascii').write(out)
page=('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+out+'\n</body></html>')
for n in ('play.html','index.html'):open(os.path.join(ROOT,'dist',n),'w',encoding='ascii').write(page)
# the website copy: unlisted (noindex), solo until SERVER_URL below is set to the hosted server.js address
SERVER_URL=os.environ.get('CATOSHI_SERVER','')
site=('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  '<meta name="robots" content="noindex,nofollow"><meta name="catoshi-server" content="'+SERVER_URL+'"></head><body>\n'+out+'\n</body></html>')
os.makedirs(os.path.join(ROOT,'dist','catoshicatch'),exist_ok=True)
open(os.path.join(ROOT,'dist','catoshicatch','index.html'),'w',encoding='ascii').write(site)
print('built',len(mods),'modules,',len(out)//1024,'KB')
