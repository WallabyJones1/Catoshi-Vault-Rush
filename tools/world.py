"""World smoke test: python3 tools/world.py outdir"""
import sys, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));out=sys.argv[1];os.makedirs(out,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2); errs=[]
    pg.on('pageerror',lambda e:errs.append(e.stack[:500]))
    pg.goto('file://'+ROOT+'/dist/play.html')
    for i in range(40):
        pg.wait_for_timeout(250)
        if pg.evaluate("!!window.WLD||typeof WLD!=='undefined'&&!!WLD"): break
    print('world built after ~',(i+1)*250,'ms')
    shot=lambda n: pg.screenshot(path=f'{out}/{n}.png')
    pg.click('.grid button[data-k="calico"]'); pg.click('#shB .big'); pg.wait_for_timeout(500); shot('w01_square')
    pg.evaluate("WP.x=3*16;WP.y=11*16;WP.path=[]"); pg.wait_for_timeout(300); shot('w02_home')
    pg.evaluate("S.bal=99999;S.boats.skiff=1;S.boat='skiff';S.tools.shovel=1;S.tools.grapple=1;S.boatAt={x:WLD.dock.x,y:WLD.dock.y};WP.x=31*16+8;WP.y=22*16;WP.path=[]"); pg.wait_for_timeout(400); shot('w03_dock')
    pg.evaluate("boardBoat()"); pg.wait_for_timeout(300)
    # drive the stick east for a moment
    pg.evaluate("JOY.dx=1;JOY.dy=.3"); pg.wait_for_timeout(1500); pg.evaluate("JOY.dx=0;JOY.dy=0"); shot('w04_sailing')
    for I in ['gull','kelpkey','wreckrock','turtle','stack']:
        pg.evaluate(f"(()=>{{const I=ISLANDS.find(i=>i.k==='{I}');let best=null;for(let r=I.r+1;r<I.r+5&&!best;r+=.5)for(let a=0;a<6.28;a+=.2){{const x=Math.floor(I.x+Math.cos(a)*r),y=Math.floor(I.y+Math.sin(a)*r);if(WLD.sail(x,y)){{best=[x,y];break}}}}WP.x=best[0]*16+8;WP.y=best[1]*16+8;WP.path=[]}})()")
        pg.wait_for_timeout(500); shot(f'w05_{I}')
    pg.evaluate("act2&&act2.fn()"); pg.wait_for_timeout(400); shot('w06_ashore')
    pg.evaluate("const d=WLD.digs.find(d=>d.k.startsWith('turtle'));WP.x=d.x;WP.y=d.y;WP.path=[]"); pg.wait_for_timeout(300); shot('w07_xmark')
    pg.evaluate("const d=WLD.digs.find(d=>d.k.startsWith('turtle'));for(let i=0;i<4;i++)digAt(d)"); pg.wait_for_timeout(300); shot('w08_dug')
    pg.evaluate("const s=WLD.shells[0];WP.x=s.x;WP.y=s.y;WP.path=[];pickShell(s)"); pg.wait_for_timeout(300); shot('w09_shell')
    pg.evaluate("WP.boat=true;const v=WLD.salvage[0];WP.x=v.x;WP.y=v.y+10;WP.path=[]"); pg.wait_for_timeout(400); shot('w10_salvage'); pg.evaluate("salvage_(WLD.salvage[0])"); pg.wait_for_timeout(300)
    pg.evaluate("openMap()"); pg.wait_for_timeout(300); shot('w11_map'); pg.evaluate("closeSheet()")
    pg.evaluate("fishAtSea()"); pg.wait_for_timeout(600); shot('w12_seafish'); pg.evaluate("leaveSpot()"); pg.wait_for_timeout(300); shot('w13_back')
    pg.evaluate("WP.boat=false;WP.x=25*16;WP.y=17*16;WP.path=[]"); pg.wait_for_timeout(300); shot('w14_crew')
    print('bag',pg.evaluate("S.bag.map(b=>b.id).join(',')"))
    print('errors:',errs[:5]); b.close()
