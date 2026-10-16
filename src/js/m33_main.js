/* ================= drawing, the frame loop, input and boot ================= */
const AMB=[];
function ambient(){AMB.length=0;for(let i=0;i<6;i++)AMB.push({e:rollFish(),x:Math.random()*VW,dep:Math.random(),v:(Math.random()<.5?-1:1)*(4+Math.random()*6)})}
function drawRot(img,cx,cy,ang,s,flip){g.save();g.translate(Math.round(cx),Math.round(cy));if(ang)g.rotate(ang);if(flip)g.scale(-1,1);const w=s||img.width,h=s?s*img.height/img.width:img.height;g.drawImage(img,-w/2,-h/2,w,h);g.restore()}
/* a sprite that sits in the far sea: crisp above the waterline, faint below it */
function drawClipped(img,x,y,wl,ang){const L=LAY;g.save();g.beginPath();g.rect(0,0,VW,wl);g.clip();if(ang)drawRot(img,x+img.width/2,y+img.height/2,ang);else g.drawImage(img,Math.round(x),Math.round(y));g.restore();
  g.save();g.beginPath();g.rect(0,wl,VW,L.surfY-wl);g.clip();g.globalAlpha=.28;if(ang)drawRot(img,x+img.width/2,y+img.height/2,ang);else g.drawImage(img,Math.round(x),Math.round(y));g.restore();g.globalAlpha=1;
  g.fillStyle='rgba(255,255,255,.75)';for(let i=0;i<img.width;i+=3)if(((i+Math.floor(now()*8))%5)<3)g.fillRect(Math.round(x)+i,wl,2,1)}
function rodTip(f){const b=f.bend||0;return{x:f.x+(f.lean||0)+29+b*.4,y:LAY.deckY-24+b*.9}}
function drawFisher(f,t){const L=LAY;const lx=Math.round(f.lean||0);const y0=L.deckY-26;const fr=f.blink<0?2:f.tail<0?1:0;g.drawImage(catSide(f.coat,fr),f.x+lx,y0);
  const tp=rodTip(f),bx0=f.x+lx+18,by0=L.deckY-10;const b=f.bend||0;
  g.fillStyle='#5a3a22';for(let i=0;i<=14;i++){const k=i/14;const x=bx0+(tp.x-bx0)*k,y=by0+(tp.y-by0)*k-(1-k)*k*(6-b*.8)*-.2+b*k*k*.6;g.fillRect(Math.round(x),Math.round(y),1,1)}
  g.fillStyle='#e8d0a0';g.fillRect(Math.round(tp.x),Math.round(tp.y),1,1);
  const line=(x1,y1,a=.75)=>{g.fillStyle=`rgba(240,230,210,${a})`;const n=Math.max(1,Math.ceil(Math.hypot(x1-tp.x,y1-tp.y)));for(let i=0;i<n;i++){const k=i/n;g.fillRect(Math.round(tp.x+(x1-tp.x)*k),Math.round(tp.y+(y1-tp.y)*k),1,1)}};
  if(f.cine){const o=f.cine;if(o.line)line(o.x,o.y-2,b>9?.95:.75);return}
  if(f.fv&&(f.st==='fight'||f.st==='auto'||RPLAY&&RPLAY.f===f)){const v=f.fv;line(v.x+(v.flip?v.s*.35:-v.s*.35),v.y,b>8?.95:.75);if(b>8&&((t*12)|0)%2)line(v.x+(v.flip?v.s*.35:-v.s*.35),v.y,.3);return}
  const bx=f.bob.x+lx,by=Math.round(f.bob.y);line(bx,by);
  if(by>=L.surfY-1&&f.st!=='pull'){g.fillStyle='rgba(240,230,210,.35)';g.fillRect(bx,by+2,1,22);g.fillStyle='#c8c8d0';g.fillRect(bx,by+24,1,2);g.fillRect(bx+1,by+25,1,1)}
  g.fillStyle='#f6f0e4';g.fillRect(bx-1,by-1,3,2);g.fillStyle='#e84a3a';g.fillRect(bx-1,by+1,3,2);
  if(f.st==='pull'&&f.fish)g.drawImage(catArt(f.fish.id),bx-8,by,16,16);
  if(f.me&&f.st==='bite'&&!f.autoCast){g.fillStyle='#000';g.fillRect(f.x+19,y0-14,9,11);g.fillStyle='#fff6e0';g.fillRect(f.x+20,y0-13,7,9);g.fillStyle='#e84a3a';g.fillRect(f.x+23,y0-12,1,4);g.fillRect(f.x+23,y0-6,1,1)}
  if(CT.on&&!f.me)drawTextO(g,String(f.n),f.x+14-textWM(String(f.n))/2,y0-11,'#fff6e0','#000')}
function drawRays(x,y,t){g.save();g.globalAlpha=.35;g.fillStyle='#ffd27a';for(let i=0;i<10;i++){const a=t*.8+i*Math.PI/5;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*70,y+Math.sin(a)*70);g.lineTo(x+Math.cos(a+.16)*70,y+Math.sin(a+.16)*70);g.fill()}g.restore()}
function draw(){if(MODE==="world"){drawWorld(now());return}drawPier()}
function drawPier(){const L=LAY,t=now();if(!bgCv)buildBg();g.drawImage(bgCv,0,0);const CAT_ON=false,GR=SPOT?SPOT.ground:'pier';
  // glints under the sun and along the far sea
  const sx=L.sx0+Math.round(L.stageW*.58);for(let y=L.horizon+2;y<L.surfY-2;y+=3){const w=Math.max(2,14-(y-L.horizon)*.12)+Math.sin(t*2+y)*3;g.fillStyle=y%2?'rgba(255,214,140,.75)':'rgba(255,190,110,.55)';g.fillRect(Math.round(sx-w/2+Math.sin(t*1.3+y*.7)*2),y,Math.round(w),1)}
  for(let i=0;i<14;i++){const gx=(i*71+Math.floor(t*6+i)*13)%VW,gy=L.horizon+6+((i*37)%Math.max(1,L.surfY-L.horizon-10));if((Math.floor(t*2+i))%3===0){g.fillStyle='rgba(255,220,170,.5)';g.fillRect(gx,gy,3,1)}}
  // boats away on trips
  let lane=0;for(const k of Object.keys(S.trips)){const tr=S.trips[k],T=TRIPI[tr.k];if(!T)continue;const p=clamp((Date.now()-tr.start)/(tr.end-tr.start),0,1);const img=boatSide(T.boat);
    const xs=L.sx0+20,xe=VW+20;let x,flip=false;if(p<.15)x=xs+(xe-xs)*(p/.15);else if(p<.85)x=null;else if(p<1){x=xe-(xe-xs)*((p-.85)/.15);flip=true}else{x=xs+lane*30;flip=true}
    if(x!=null){const y=L.horizon+16+lane*7-img.height+Math.round(Math.sin(t*2+lane)*1);g.save();if(flip){g.translate(Math.round(x)+img.width,y);g.scale(-1,1);g.drawImage(img,0,0)}else g.drawImage(img,Math.round(x),y);g.restore()}lane=(lane+1)%3}
  // the White Whale out in the harbour
  const wp=whalePose(t);if(wp&&!wp.under)drawClipped(wp.img,wp.x,wp.y,wp.clip,wp.ang);
  if(WH.st==='game'&&WG&&WG.up){const k=Math.min(1,WG.t/.25);drawClipped(whaleArt(Math.floor(t*4)),WG.x-4,WL()-6-k*12,WL());if(((t*6)|0)%2){g.fillStyle='#ffd24d';g.fillRect(WG.x+16,WL()-30,3,3)}}
  // underwater life
  for(const a of AMB){const im=catArt(a.e.id,'s');const y=L.surfY+30+a.dep*(VH-L.surfY-60);g.globalAlpha=.22;g.save();if(a.v>0){g.translate(Math.round(a.x)+16,Math.round(y));g.scale(-1,1);g.drawImage(im,0,0,16,16)}else g.drawImage(im,Math.round(a.x),Math.round(y),16,16);g.restore();g.globalAlpha=1}
  if(wp&&wp.under){g.globalAlpha=.5;g.drawImage(wp.img,Math.round(wp.x),Math.round(wp.y));g.globalAlpha=1}
  if(PL&&!PL.hide&&PL.sh&&(PL.st==='wait'||PL.st==='bite')&&PL.fish){const im=catArt(PL.fish.id,'s');g.globalAlpha=.5;const s=PL.fish.cat==='legend'?36:24;drawRot(im,PL.sh.x,PL.sh.y,0,s,PL.sh.x<PL.bob.x);g.globalAlpha=1}
  for(const f of fishers())if(f.fv&&!f.cine){g.globalAlpha=.92;drawRot(f.fv.img,f.fv.x,f.fv.y,Math.sin(t*14)*.15,f.fv.s,f.fv.flip);g.globalAlpha=1}
  for(let i=0;i<8;i++){const bx=(i*53+17)%VW,by=VH-14-((t*12+i*29)%(VH-L.surfY-16));g.fillStyle='rgba(200,235,255,.35)';g.fillRect(bx+Math.round(Math.sin(t*3+i)),Math.round(by),1,1)}
  // what the cats sit on: pier posts, mangrove roots, rock pillars
  if(GR==='pier')for(let x=L.sx0-(L.sx0%24)+4;x<L.pierEnd-2;x+=24){g.fillStyle='#4a2f20';g.fillRect(x,L.deckY+6,4,L.surfY-L.deckY-6);g.fillStyle='#3a2a2a';g.fillRect(x,L.surfY,4,VH-L.surfY);g.fillStyle='#2a1f22';g.fillRect(x+3,L.surfY,1,VH-L.surfY);g.fillStyle='#2f4a3a';g.fillRect(x,L.surfY+4,4,3)}
  // the water surface
  for(let x=0;x<VW;x++){const w=Math.round(Math.sin(x*.3+t*2.4)*.8+Math.sin(x*.07-t)*.6);g.fillStyle='#9fd0e0';g.fillRect(x,L.surfY+w,1,1);g.fillStyle='rgba(159,208,224,.35)';g.fillRect(x,L.surfY+w+1,1,1)}
  if(BOT){const by=L.surfY-5+Math.round(Math.sin(BOT.t*2.2)*1.2);drawRot(bottleImg(),BOT.x+7,by+4,Math.sin(BOT.t*1.7)*.25);if(((BOT.t*3)|0)%4===0){g.fillStyle='#fff6d0';g.fillRect(Math.round(BOT.x)+4,by,1,1)}}
  // the deck, or the bank
  drawLedge(GR,L,t);
  // Catoshi and his Rush token (only at his jetty); elsewhere a bucket for the catch
  if(!CAT_ON)drawBucket(L,t);
  if(CAT_ON){const cf=catoshiWave>0?2:catoshiBlink<0?1:0;g.drawImage(catoshiArt(cf),L.catoshiX-2,L.deckY-73);
  const ty=L.tokY+Math.round(Math.sin(t*2)*1);const gl=g.createRadialGradient(L.tokX+8,ty+8,2,L.tokX+8,ty+8,16);gl.addColorStop(0,'rgba(255,150,60,.55)');gl.addColorStop(1,'rgba(255,150,60,0)');g.fillStyle=gl;g.fillRect(L.tokX-10,ty-10,36,36);g.drawImage(rushToken(16),L.tokX,ty)}
  for(const f of fishers())drawFisher(f,t);
  // landing fish fly over everything
  for(const f of fishers())if(f.cine){const o=f.cine;const C=RPLAY&&RPLAY.f===f?RPLAY.C:CINE;if(!C)continue;if(o.rays)drawRays(o.x,o.y,t);drawRot(C.p.img,o.x,o.y,o.ang,C.p.s)}
  if(RAIN)drawRain(t);
  if(false)for(const c of RAIN.coins){const s=c.gold?16:12;const im=rushToken(s);const sq=Math.abs(Math.cos(t*4+c.sp));g.drawImage(im,Math.round(c.x+s/2-s*sq/2),Math.round(c.y),Math.max(2,Math.round(s*sq)),s);if(c.gold&&((t*8)|0)%2){g.fillStyle='#fff6d0';g.fillRect(Math.round(c.x+s/2),Math.round(c.y-2),1,1)}}
  partDraw();
  for(const e of FX){const k=e.t/e.d;if(e.k==='fly'){const x=e.x0+(e.x1-e.x0)*k,y=e.y0+(e.y1-e.y0)*k-Math.sin(k*Math.PI)*36;g.drawImage(e.img,Math.round(x-8),Math.round(y-8),16,16)}
    else if(e.k==='txt'){g.globalAlpha=1-k*k;drawTextO(g,e.s,Math.round(e.x),Math.round(e.y-k*12),e.col,'#000');g.globalAlpha=1}
    else if(e.k==='flee'){g.globalAlpha=.6*(1-k);drawRot(e.img,e.x+k*60,e.y+k*30,0,e.s,1);g.globalAlpha=1}}
}
/* replay caption, drawn in screen space so the camera never crops it (and the clip records it) */
function drawCaption(c){const R=RPLAY,t=now();const e=R.e;const cap=(R.rp.kind==='whale'?`${R.rp.name} vs the White Whale`:`${R.rp.name}  ${R.rp.cm} cm ${e.n}`).toUpperCase();
  const w=Math.min(VW-8,Math.max(textW(cap),textW('REPLAY'))+20),x=Math.round((VW-w)/2),y=50;
  c.fillStyle='rgba(16,13,12,.85)';c.fillRect(x,y,w,20);c.fillStyle='#f07a1e';c.fillRect(x,y,w,1);c.fillRect(x,y+19,w,1);
  if(((t*2)|0)%2===0){c.fillStyle='#ff4a3a';c.fillRect(x+6,y+4,3,3)}drawText(c,'REPLAY',x+12,y+3,'#ffb15a');drawText(c,cap,x+6,y+11,'#fff6e0');
  const wm="CATOSHI'S CATCH";drawText(c,wm,VW-textW(wm)-5,VH-9,'#ffd68c','#000')}

function drawLedge(GR,L,t){const pe=L.pierEnd;
  if(GR==='boat'){const b=boatSide(S.boat||'row');const bx=Math.round(L.playerX+15-b.width/2),by=L.surfY+7-b.height;g.drawImage(b,bx,by);return}
  if(GR==='pier'){g.fillStyle='#000';g.fillRect(0,L.deckY-1,pe+1,10);for(let x=0;x<pe;x++){const seam=(x+3)%7===0;g.fillStyle=seam?'#6a4228':((x*13)%11<2?'#b07a4c':'#a06c40');g.fillRect(x,L.deckY,1,4)}
    g.fillStyle='#c89060';g.fillRect(0,L.deckY,pe,1);g.fillStyle='#5a3a24';g.fillRect(0,L.deckY+4,pe,4);g.fillStyle='#3f2818';g.fillRect(0,L.deckY+7,pe,1);return}
  const P={sand:['#f0d8a0','#d8b878','#b89458','#e8c888'],mud:['#7a8a4a','#5a4a32','#3f3424','#6a7a3a'],rock:['#a8a8b0','#7a7a86','#55555f','#8f8f99']}[GR];
  // the bank runs out to just past the cat, then falls away into the water
  for(let x=0;x<pe+6;x++){const edge=x>pe-4?(x-(pe-4))*1.6:0;const top=L.deckY+Math.round(edge)+(GR==='rock'?Math.round(Math.sin(x*.7)*1.2+Math.sin(x*.23)*1.5):0);const bot=L.surfY+(GR==='sand'?3:6)-Math.round(edge*.4);
    if(top>=bot)continue;g.fillStyle='#000';g.fillRect(x,top-1,1,1);g.fillStyle=P[0];g.fillRect(x,top,1,2);g.fillStyle=P[3];g.fillRect(x,top+2,1,2);
    for(let y=top+4;y<bot;y++){const d=DITH[y&3][x&3]/16;const k=(y-top)/(bot-top);g.fillStyle=k>d+.35?P[2]:P[1];g.fillRect(x,y,1,1)}}
  if(GR==='mud'){for(let x=4;x<pe;x+=9){g.fillStyle='#3a5a2a';g.fillRect(x,L.deckY-2,1,2);g.fillRect(x+2,L.deckY-3,1,3);g.fillStyle='#4a3a28';for(let y=L.surfY;y<L.surfY+26+(x%3)*6;y++)g.fillRect(x+Math.round(Math.sin(y*.3+x)*1.5),y,1,1)}}
  if(GR==='rock'){for(let x=6;x<pe;x+=17){g.fillStyle='#3f4450';g.fillRect(x,L.surfY,7,VH-L.surfY);g.fillStyle='#4f5562';g.fillRect(x+1,L.surfY,2,VH-L.surfY);g.fillStyle='#2f5a4a';g.fillRect(x,L.surfY+5,7,3)}}
  if(GR==='sand'){for(let x=8;x<pe;x+=26){g.fillStyle='#f4ead0';g.fillRect(x,L.deckY+1,2,1);g.fillStyle='#ff9a6a';g.fillRect(x+9,L.deckY+2,1,1)}}}
function drawRain(t){for(const c of RAIN.coins){const s=c.gold?16:12;const im=rushToken(s);const sq=Math.abs(Math.cos(t*4+c.sp));g.drawImage(im,Math.round(c.x+s/2-s*sq/2),Math.round(c.y),Math.max(2,Math.round(s*sq)),s);if(c.gold&&((t*8)|0)%2){g.fillStyle='#fff6d0';g.fillRect(Math.round(c.x+s/2),Math.round(c.y-2),1,1)}}}
function drawBucket(L,t){const x=L.bucketX,y=L.deckY-11;g.fillStyle='#000';g.fillRect(x-1,y-1,14,13);g.fillStyle='#8a96a8';g.fillRect(x,y,12,11);g.fillStyle='#b8c4d4';g.fillRect(x+1,y+1,3,9);g.fillStyle='#5a6678';g.fillRect(x,y,12,2);
  g.fillStyle='#000';for(let i=0;i<10;i++){const a=Math.PI+i/9*Math.PI;g.fillRect(Math.round(x+6+Math.cos(a)*6),Math.round(y-1+Math.sin(a)*5),1,1)}
  const BN=(S.bag||[]).length;if(BN>0){g.fillStyle='#e8c84a';g.fillRect(x+3,y-3,2,3);g.fillStyle='#6fb2ff';g.fillRect(x+7,y-4,2,4);const s=BN+'/'+bagCap();drawText(g,s,x+6-textW(s)/2,y-11,'#fff6e0','#000')}}
/* ---------------- the loop ---------------- */
let last=0,tick=0;
function update(dt){const t=now();srvTick();
  if(MODE==='world')worldUpdate(dt,t);else{if(RPLAY)replayUpdate(dt,t);else plUpdate(dt,t);rivUpdate(dt,t)}
  whaleUpdate(dt,t);if(RAIN)rainUpdate(dt);bottleUpdate(dt,t);
  if(CT.on){const left=Math.max(0,CT.end-t);const tt=$('race').querySelector('.t');if(tt)tt.textContent=Math.ceil(left);if(left<=0)endContest()}
  for(let i=FX.length-1;i>=0;i--){FX[i].t+=dt;if(FX[i].t>=FX[i].d)FX.splice(i,1)}
  partUpdate(dt);camUpdate(dt);
  if(catoshiWave>0)catoshiWave-=dt;catoshiBlink-=dt;if(catoshiBlink<-.15)catoshiBlink=2+Math.random()*4;
  for(const f of fishers()){f.blink-=dt;if(f.blink<-.15)f.blink=2+Math.random()*5;f.tail-=dt;if(f.tail<-.6)f.tail=1+Math.random()*3}
  for(const a of AMB){a.x+=a.v*dt;if(a.x<-40)a.x=VW+30;if(a.x>VW+40)a.x=-30}
  tick-=dt;if(tick<=0){tick=1;rollDay();refreshHud();
    if(SHEET.kind==='trips'){for(const c of document.querySelectorAll('.chip.go')){const ms=+c.dataset.end-Date.now();if(ms<=0){openTrips();break}c.textContent=fmtLeft(ms)}}
    if(MODE==='fish'&&Math.random()<.035&&!CT.on&&!RPLAY&&$('say').classList.contains('off'))say(pickOne(LINES.idle),4000)}}
function frame(ts){const t=ts/1000;const dt=Math.min(.05,last?t-last:.016);last=t;if(S&&g&&WLD){update(dt);draw();present()}requestAnimationFrame(frame)}
setInterval(()=>{flushBoard()},12000);

/* ---------------- input ---------------- */
function canvasDown(ev){ev.preventDefault();audioUnlock();if(!S||!S.coat||!$('sheet').hidden||RPLAY||!WLD)return;if(RAIN){rainHit(toScene(ev));return}if(MODE==='world'){const p=toScene(ev);Object.assign(JOY,{on:true,moved:false,sx:p.x,sy:p.y,dx:0,dy:0,ev:{clientX:ev.clientX,clientY:ev.clientY},id:ev.pointerId});return}const p=toScene(ev),L=LAY;
  const inR=(r,m=6)=>r&&p.x>=r.x-m&&p.x<=r.x+r.w+m&&p.y>=r.y-m&&p.y<=r.y+r.h+m;
  if(WH.st==='game'){if(inR(whaleRect(),8))whaleHit();return}
  if(WH.st==='breach')return;
  if(['swim','surface','dive'].includes(WH.st)&&inR(whaleRect())){whaleGameStart();return}
  if(BOT&&PL.st!=='fight'&&PL.st!=='land'&&inR({x:BOT.x,y:L.surfY-8,w:14,h:10},8)){bottleOpen();return}
  press('canvas')}
function onSaveSwapped(){if(S.coat){PL=mkFisher(S.coat,LAY.playerX,true);RIV=[];if(MODE==='fish')seatRivals();else spawnNpcs();if(SHEET.kind==='pick'&&SHEET.forced)closeSheet()}else openPick(true);refreshHud()}

/* ---------------- boot ---------------- */
function start(data){
  S=(data&&data.save&&data.save.v===2)?fixSave(data.save):(loadLocal()||newSave());rollDay();
  resize();camReset();CAM.z=1;CAM.fx=CAM.tx;CAM.fy=CAM.ty;ambient();
  PL=mkFisher(S.coat||'ginger',LAY.playerX,true);if(!S.coat)PL.hide=true;
  for(const[id,k]of[['nContest','trophy'],['nTrips','boat'],['nShop','rod2'],['nBoard','book']]){const c=$(id).querySelector('canvas');const im=k==='rod2'?gearIcon(k):uiIcon(k);c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0)}
  {const c=$('nCats').querySelector('canvas');c.width=24;c.height=22;c.getContext('2d').drawImage(catFace('ginger'),0,0)}
  $('balIco').getContext('2d').drawImage(rushToken(16),0,0);
  ACT.addEventListener('pointerdown',e=>{e.preventDefault();audioUnlock();if(MODE==='world'){if(nearInter&&$('sheet').hidden){sfx('click');nearInter.fn()}return}press('btn')});for(const ev of['pointerup','pointercancel','pointerleave'])ACT.addEventListener(ev,release);
  cv.addEventListener('pointerdown',canvasDown);for(const ev of['pointerup','pointercancel'])cv.addEventListener(ev,release);
  cv.addEventListener('pointermove',e=>{if(!JOY.on||e.pointerId!==JOY.id)return;const p=toScene(e);let dx=(p.x-JOY.sx)/20,dy=(p.y-JOY.sy)/20;const m=Math.hypot(dx,dy);if(m>.35)JOY.moved=true;if(m>1){dx/=m;dy/=m}if(JOY.moved){JOY.dx=dx;JOY.dy=dy}});
  for(const evn of['pointerup','pointercancel'])cv.addEventListener(evn,e=>{if(!JOY.on||e.pointerId!==JOY.id)return;const tap=!JOY.moved&&evn==='pointerup';JOY.on=false;JOY.dx=JOY.dy=0;if(tap&&MODE==='world'&&$('sheet').hidden)worldTap(JOY.ev)});
  $('act2').addEventListener('pointerdown',e=>{e.preventDefault();audioUnlock();if(act2&&$('sheet').hidden){sfx('click');act2.fn()}});
  addEventListener('keydown',e=>{if(document.activeElement&&document.activeElement.tagName==='INPUT')return;if(e.code==='Escape'){closeSheet();return}if(!$('sheet').hidden||!WLD)return;
    if(MODE==='world'){if(worldKeys(e,true)){e.preventDefault();return}if((e.code==='Space'||e.code==='Enter')&&nearInter){e.preventDefault();nearInter.fn()}return}
    if((e.code==='Space'||e.code==='Enter')){e.preventDefault();if(!e.repeat)press('key')}
});
  addEventListener('keyup',e=>{if(MODE==='world'&&worldKeys(e,false))return;if(e.code==='Space'||e.code==='Enter')release()});
  $('autoBtn').onclick=()=>{sfx('click');toggleAuto()};
  $('baitBtn').onclick=()=>{sfx('click');openShop()};
  $('nContest').onclick=()=>{sfx('click');if(MODE==='world'){goTo('Catoshi\'s basket');return}CT.on?toast('Contest running!'):startContest()};
  $('nTrips').onclick=()=>{sfx('click');if(MODE==='world')openMap();else openBag()};$('nShop').onclick=()=>{sfx('click');if(MODE==='world')openBag();else openShop()};$('nBoard').onclick=()=>{sfx('click');openBoard()};
  $('nCats').onclick=()=>{sfx('click');if(MODE==='fish')return leaveSpot();openPick(false)};
  $('whoBtn').onclick=()=>$('nCats').onclick();
  $('walletBtn').onclick=()=>{sfx('click');walletButton()};$('emoteBtn').onclick=()=>{sfx('click');if(SERVER.ready)openEmotes()};srvHud();
  $('sndBtn').onclick=()=>{S.sound=S.sound?0:1;audioUnlock();dirty();refreshHud();sfx('click')};
  $('shX').onclick=closeSheet;$('veil').onclick=()=>{if(!SHEET.forced)closeSheet()};
  addEventListener('resize',()=>{resize();camReset();if(PL){PL.x=LAY.playerX;PL.bob.x=PL.x+29}if(MODE==='fish')seatRivals();ambient()});
  refreshHud();setAct('CAST');$('act').hidden=true;
  $('loading').hidden=false;requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{townInit();$('loading').hidden=true;setMode();if(!S.coat)openPick(true);else toast(S.total?'Welcome back to Gullhaven':'Catoshi waits on his golden chair in the square')},0)));
  try{window.claude&&window.claude.hot&&window.claude.hot.snapshot&&window.claude.hot.snapshot(()=>({save:S}))}catch(e){}
  requestAnimationFrame(frame);connect()}
