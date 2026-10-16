from playwright.sync_api import sync_playwright
import sys
out=sys.argv[1];import os;os.makedirs(out,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2); errs=[]
    pg.on('pageerror',lambda e:errs.append(e.stack[:400]))
    pg.goto('file:///home/claude/catoshi/dist/play.html'); pg.wait_for_timeout(3500)
    pg.click('.grid button[data-k="ginger"]'); pg.click('#shB .big'); pg.wait_for_timeout(400)
    pg.evaluate("enterSpot(WLD.spots.find(s=>s.k==='pier'))"); pg.wait_for_timeout(500)
    act=pg.locator('#act')
    act.dispatch_event('pointerdown'); pg.wait_for_timeout(450); pg.screenshot(path=out+'/f1_aim.png'); act.dispatch_event('pointerup')
    pg.wait_for_timeout(700); pg.screenshot(path=out+'/f2_wait.png')
    pg.evaluate("PL.fish=FPOOL[2][3];PL.kg=8;PL.cm=90;PL.biteAt=PL.t+.1;PL.nibbles=0"); pg.wait_for_timeout(300); pg.screenshot(path=out+'/f3_bite.png')
    pg.evaluate("press('btn')"); pg.wait_for_timeout(200)
    # simulate a player: hold unless running or tension high
    for i in range(160):
        st=pg.evaluate("(()=>{const X=PL.FT;if(!X)return PL.st;HOLD=!(X.running>0)&&X.T<.8;return PL.st})()")
        if st!='fight': break
        pg.wait_for_timeout(60)
        if i==20: pg.screenshot(path=out+'/f4_fight.png')
    print('state after fight',pg.evaluate("PL.st"), pg.evaluate("PL.FT?JSON.stringify({d:PL.FT.dist,T:PL.FT.T}):''"))
    pg.screenshot(path=out+'/f5_after.png')
    if pg.evaluate("PL.st")=='net':
        pg.evaluate("PL.FT.lp=PL.FT.lc;tryNet()"); pg.wait_for_timeout(1500); pg.screenshot(path=out+'/f6_land.png')
    pg.wait_for_timeout(4000); pg.screenshot(path=out+'/f7_card.png')
    print(errs[:3]); b.close()
