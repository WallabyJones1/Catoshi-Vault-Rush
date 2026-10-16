/* ================= ART: the coast: boats, harbour props, beach and sea props, coastal buildings ================= */
/* ---------- boats: drawn top-down pointing east, then rotated to 16 headings ---------- */
const BOAT_SPEC={
  row:{L:24,B:11,deck:'#b8854f',trim:'#6b4433',cabin:null,motor:0,seats:[-4,5],oars:1},
  dinghy:{L:28,B:13,deck:'#d8d0c0',trim:'#8a8a96',cabin:null,motor:1,seats:[-2,6],console:0},
  skiff:{L:32,B:14,deck:'#e8e2d4',trim:'#2a4a6a',cabin:'console',motor:1,seats:[-5,4]},
  trawler:{L:40,B:17,deck:'#c8b898',trim:'#5a3a2a',cabin:'wheel',motor:2,seats:[-9,8],mast:1},
  cutter:{L:46,B:18,deck:'#e8e4dc',trim:'#c8a050',cabin:'bridge',motor:2,seats:[-12,6],rigs:1}};
function boatTop(k,paint,flag){const sp=BOAT_SPEC[k]||BOAT_SPEC.row;const hullC=paint||BOATI[k].hull;const W=sp.L+8,H=sp.B+8;const N=PN(W,H);const cx=W/2,cy=H/2,hl=sp.L/2,hb=sp.B/2;
  const H5=ramp5(hullC),D5=ramp5(sp.deck),T5=ramp5(sp.trim);
  // hull outline: pointed bow (east), squarish stern (west)
  const halfW=x=>{const u=(x-(cx-hl))/sp.L;if(u<0||u>1)return-1;if(u>.62){const s=(u-.62)/.38;return hb*Math.sqrt(Math.max(0,1-s*s*1.05))}return hb*(.86+.14*Math.min(1,u/.2))};
  for(let x=Math.floor(cx-hl);x<=Math.ceil(cx+hl);x++){const hw=halfW(x+.5);if(hw<0)continue;for(let y=Math.floor(cy-hw);y<=Math.ceil(cy+hw);y++){const dy=(y+.5-cy)/Math.max(.5,hw);if(Math.abs(dy)>1)continue;
    const rim=Math.abs(dy)>1-2.2/Math.max(2,hw)||x+.5>cx+hl-1.5||x-.5<cx-hl+1.2;N.px(x,y,rim?rampPick(H5,-dy*.7+.05):rampPick(D5,-dy*.35-.05+((x+(k==='row'?0:1))%4===0&&k==='row'?-.4:0)),1)}}
  // inner gunwale shadow line
  for(let x=Math.floor(cx-hl+2);x<cx+hl-2;x++){const hw=halfW(x+.5)-2;if(hw<1)continue;N.px(x,cy-hw,D5[4],2)}
  const mx=cx-hl;
  if(sp.oars){for(const s of[-1,1]){N.line(cx-1,cy+s*(hb-1),cx-6,cy+s*(hb+4),'#c8a070',1,3);N.line(cx-6,cy+s*(hb+4),cx-8,cy+s*(hb+5),'#e8c890',2,3)}for(const sx of[-6,3])N.rect(cx+sx,cy-hb+2,2,sp.B-4,D5[3],2)}
  if(sp.motor){const ml=sp.motor===2?5:4;N.rect(mx-ml+1,cy-2,ml,5,(i,j)=>j===0?'#5a5a66':j===4?'#1a1a22':'#2a2a34',3);N.px(mx-ml+1,cy-1,'#8a8a96',4)}
  if(sp.cabin==='console'){N.rect(cx-2,cy-3,6,7,(i,j)=>i===0?'#bfe6f0':j===0?'#ffffff':'#e0dcd4',3);N.rect(cx-3,cy-3,1,7,'#5a8aa0',4)}
  if(sp.cabin==='wheel'){N.rect(cx-6,cy-5,10,11,(i,j)=>j===0||i===0?'#ffffff':j===10?'#a8a49c':'#e8e4dc',3);N.rect(cx+3,cy-4,1,9,'#5a9ab8',4);N.rect(cx-6,cy-6,10,1,T5[2],4);N.rect(cx-14,cy-1,6,3,'#7a6a5a',2)}
  if(sp.cabin==='bridge'){N.rect(cx-10,cy-6,16,13,(i,j)=>j===0||i===0?'#ffffff':j===12?'#b0aca4':'#ecebe6',3);N.rect(cx+4,cy-5,2,11,'#3a5a7a',4);N.rect(cx-6,cy-4,7,9,(i,j)=>i===0||j===0?'#f8f8f6':'#d8d6d0',5);N.px(cx-3,cy,'#3a3a40',6)}
  if(sp.mast){N.ell(cx+6,cy,1.6,1.6,'#6b4433',6);N.line(cx+6,cy,cx-10,cy-hb-4,'#8a6a4a',1,6);N.line(cx+6,cy,cx-10,cy+hb+4,'#8a6a4a',1,6)}
  if(sp.rigs){for(const s of[-1,1])N.line(cx-4,cy+s*3,cx-16,cy+s*(hb+7),'#c8c8d0',1,6)}
  // bow number / stripe in trim colour
  for(let x=Math.floor(cx+hl*.35);x<cx+hl*.55;x++){const hw=halfW(x+.5);N.px(x,cy-hw+.5,T5[1],2);N.px(x,cy+hw-.5,T5[2],2)}
  if(flag){const F=COOPI[flag];if(F){const fx=sp.mast?cx+6:cx-hl+2,fy=cy;N.rect(fx-3,fy-1,4,3,F.col,7);N.px(fx-3,fy-1,F.lt,8)}}
  N.outline();return N}
const boatCache=new Map();
// heading index 0..15 (0 = east, clockwise because y points down)
function boatImg(k,h,paint,flag){const key=k+h+(paint||'')+(flag||'');let c=boatCache.get(key);if(c)return c;let base=boatCache.get('pn'+k+(paint||'')+(flag||''));if(!base){base=boatTop(k,paint,flag);boatCache.set('pn'+k+(paint||'')+(flag||''),base)}
  const ang=h/16*Math.PI*2;const S=Math.ceil(Math.max(base.w,base.h)*1.05)+2;let O;if(h===0){O=PN(S,S);for(let y=0;y<base.h;y++)for(let x=0;x<base.w;x++){const v=base.c[y*base.w+x];if(v)O.px(x+(S-base.w)/2,y+(S-base.h)/2,v)}}
  else{const P2=PN(S,S);for(let y=0;y<base.h;y++)for(let x=0;x<base.w;x++){const v=base.c[y*base.w+x];if(v)P2.px(x+Math.floor((S-base.w)/2),y+Math.floor((S-base.h)/2),v)}O=rotPN(P2,ang,S,S)}
  c=O.canvas();boatCache.set(key,c);return c}
// the side view for shops and cards
function boatSide(k,paint){const sp=BOAT_SPEC[k]||BOAT_SPEC.row;const L=sp.L+10,H=26;const N=PN(L+4,H+6);const hull=ramp5(paint||BOATI[k].hull);const x0=2,y0=H-10;
  N.poly([[x0,y0],[x0+L,y0-3],[x0+L-6,y0+7],[x0+5,y0+7]],(x,y)=>rampPick(hull,-(y-y0)*.18+.2),2);N.rect(x0,y0-1,L,1,'#fbf6ea',3);N.rect(x0+5,y0+5,L-12,1,ramp5('#c84a3a')[2],3);
  if(sp.cabin==='console')N.rect(x0+L*.45,y0-7,6,6,(i,j)=>j<2?'#bfe6f0':'#ffffff',2);
  if(sp.cabin==='wheel'){N.rect(x0+L*.3,y0-10,12,9,(i,j)=>j>1&&j<5&&i%4!==0?'#5a9ab8':'#ffffff',2);N.line(x0+L*.65,y0-1,x0+L*.65,y0-20,'#6b4433',1,2);N.line(x0+L*.65,y0-18,x0+L*.25,y0-6,'#8a6a4a',1,1)}
  if(sp.cabin==='bridge'){N.rect(x0+L*.25,y0-9,18,8,(i,j)=>j>1&&j<4&&i%5!==0?'#3a5a7a':'#ffffff',2);N.rect(x0+L*.32,y0-14,10,5,(i,j)=>j<2?'#d8d6d0':'#ffffff',3);N.line(x0+L*.3,y0-14,x0+L*.1,y0-22,'#c8c8d0',1,1)}
  if(sp.motor)N.rect(x0-2,y0-3,4,8,(i,j)=>j<3?'#3a3a44':'#1a1a22',3);if(sp.oars)N.line(x0+L*.45,y0-2,x0+L*.2,y0+9,'#c8a070',1,4);
  N.outline();return N.canvas()}
/* ---------- harbour, beach and sea props ---------- */
const coastCache=new Map();function cc(key,fn){let c=coastCache.get(key);if(!c){c=fn();coastCache.set(key,c)}return c}
function artBuoy(col,f){return cc('buoy'+col+f,()=>{const N=PN(12,18);const r=ramp5(col);const bob=f%2;N.ell(6,13+bob,5,2.5,'#e4f7fb',0);N.rect(5,1+bob,2,5,'#3a3a40',1);N.ell(6,2+bob,1.6,1.6,f===2?'#fff6c0':ramp5('#ffd24d')[3],2);N.poly([[2,12+bob],[4,5+bob],[8,5+bob],[10,12+bob]],(x,y)=>rampPick(r,-(x-5)*.2+.1),1);N.rect(3,9+bob,6,1,'#fbf6ea',2);N.outline();return N.canvas()})}
function artPotFloat(col){return cc('pf'+col,()=>{const N=PN(10,10);N.ell(5,7,4,2,'#d6f2f8',0);N.ell(5,5,3,3,ramp5(col),1);N.line(5,2,5,0,'#3a3a40',1,2);N.outline();return N.canvas()})}
function artBollard(){return cc('boll',()=>{const N=PN(10,14);N.ell(5,12,4,1.5,SHADOW_C,0);N.rect(2,4,6,8,(i,j)=>rampPick(IRON,-(i-2)*.3+.1),1);N.ell(5,4,4,2,IRON,2);N.line(1,9,9,7,'#c8a070',1,3);N.outline();return N.canvas()})}
const SHADOW_C='#2a3a4a';
function artLifebuoy(){return cc('lifeb',()=>{const N=PN(14,26);N.rect(6,8,2,17,WOOD[2],0);N.ell(7,9,6,6,(nx,ny,l)=>{const d=Math.hypot(nx,ny);if(d<.5)return null;const a=Math.atan2(ny,nx);return((a+3.2)/(Math.PI/2)|0)%2?rampPick(ramp5('#e8402a'),l):rampPick(ramp5('#fbf6ea'),l)},1);N.outline();return N.canvas()})}
function artNetRack(){return cc('netr',()=>{const N=PN(36,26);for(const x of[2,32])N.rect(x,2,2,23,WOOD[3],1);N.rect(1,2,34,2,WOOD[2],2);for(let y=4;y<20;y++)for(let x=4;x<32;x++){const sag=Math.sin((x-4)/28*Math.PI)*3;if(y>4+sag+((x*7)%5===0?1:0)&&y<18+sag&&((x+y)%3===0||(x-y+60)%3===0))N.px(x,y,(x+y)%2?'#5a8a7a':'#6a9a8a',2)}N.px(10,12,'#e04a3a',3);N.px(24,14,'#f0d040',3);N.outline();return N.canvas()})}
function artFishCrate(kind){return cc('fc'+kind,()=>{const N=PN(18,14);N.rect(1,4,16,9,(i,j)=>rampPick(WOOD,j===0?.4:-.2-j*.05),1);N.rect(1,8,16,1,WOOD[4],2);
  const cols=kind===1?['#e8604a','#f08a6a']:kind===2?['#d8e4ec','#a8b8c8']:['#8ab0c8','#c8d8e4'];for(let i=0;i<5;i++)N.ell(4+i*2.6,4,2.2,1.2,ramp5(cols[i%2]),3);for(let i=0;i<6;i++)N.px(2+i*2.7,3,'#e8fbff',4);N.outline();return N.canvas()})}
function artBarrelC(){return cc('barrel',()=>{const N=PN(14,18);N.ell(7,16,6,1.6,SHADOW_C,0);N.ell(7,9,5.5,8,(nx,ny,l)=>Math.abs(ny)>.5&&Math.abs(ny)<.62?IRON[2]:rampPick(WOOD,l),1);N.ell(7,2.5,5,1.8,WOOD[1],2);N.outline();return N.canvas()})}
function artRope(){return cc('rope',()=>{const N=PN(14,10);for(let r=5;r>0;r-=1.2)for(let a=0;a<6.28;a+=.15)N.px(7+Math.cos(a)*r*1.2,5+Math.sin(a)*r*.6,(a*3|0)%2?'#d8b880':'#b8945a',1);N.outline();return N.canvas()})}
function artAnchorDecor(){return cc('anch',()=>{const N=PN(20,24);N.ell(10,22,8,1.5,SHADOW_C,0);FIND.anchor(N);N.outline();return N.canvas()})}
function artCrabPot(){return cc('cpot',()=>{const N=PN(16,12);N.rect(1,3,14,8,(i,j)=>(i+j)%2?'#7a5a3a':null,1);N.rect(1,3,14,1,'#5a3a2a',2);N.rect(1,10,14,1,'#5a3a2a',2);for(const x of[1,14])N.rect(x,3,1,8,'#5a3a2a',2);N.ell(8,6,2,2,'#2a1a14',0);N.outline();return N.canvas()})}
function artDeckChair(col){return cc('dc'+col,()=>{const N=PN(14,16);N.line(2,15,10,3,WOOD[3],1,1);N.line(12,15,5,6,WOOD[3],1,1);N.poly([[4,5],[10,3],[12,11],[6,13]],(x,y)=>((x+y)>>1)%2?col:'#fbf6ea',2);N.outline();return N.canvas()})}
function artTowel(col){return cc('tw'+col,()=>{const N=PN(14,22);N.rect(1,1,12,20,(i,j)=>((j>>1)%3===0)?'#fbf6ea':col,0);return N.canvas()})}
function artSandcastle(){return cc('sandc',()=>{const N=PN(18,16);const S5=ramp5('#e4c890');N.rect(2,7,14,8,(i,j)=>rampPick(S5,-(i-3)*.08),1);for(const x of[2,8,13])N.rect(x,3,3,5,(i,j)=>rampPick(S5,j===0?.5:-(i)*.1),2);for(const x of[2,4,8,10,13,15])N.px(x,2,S5[1],2);N.rect(7,10,4,5,S5[4],3);N.line(9,0,9,3,'#5a3a2a',1,3);N.rect(10,0,3,2,'#e04a3a',3);N.outline();return N.canvas()})}
function artRescueFlag(f){return cc('rf'+f,()=>{const N=PN(12,22);N.rect(2,2,1,19,'#c8c8d0',1);for(let j=0;j<8;j++)for(let i=0;i<8;i++){const off=Math.round(Math.sin(i*.6+f*1.7));N.px(3+i,2+j+off,j<4?'#e8402a':'#f0d040',2)}N.outline();return N.canvas()})}
function artSeaStack(v){return cc('stack'+v,()=>{const W=v?26:20,H=v?24:18;const N=PN(W,H);const R5=ramp5('#7a7488');N.ell(W/2,H-4,W/2-1,4,'#e4f7fb',0);
  const cl=v?[{x:9,y:12,r:7},{x:16,y:10,r:6},{x:12,y:7,r:5}]:[{x:10,y:10,r:7},{x:8,y:7,r:4}];for(const b of cl)N.ell(b.x,b.y,b.r,b.r*.9,(nx,ny,l)=>rampPick(R5,l+(ny<-.6?.2:0)),1);for(let i=0;i<5;i++)N.px(4+hash2(i,v,3)*(W-8),H-7+hash2(i,2,v)*2,'#e8e0d0',2);N.outline();return N.canvas()})}
function artPalmC(v){return cc('palm'+v,()=>{const N=PN(36,48);const T5=ramp5('#8a6a4a'),L5=ramp5(v?'#4a9a4a':'#3f8a4a');N.ell(18,46,7,1.6,SHADOW_C,0);N.tube(t=>[18+Math.sin(t*1.6)*4*(v?1:-1)*t,46-t*30],t=>2.4-t*.8,(t,sd,l)=>((t*30|0)%3===0)?T5[3]:rampPick(T5,-sd*.8),40,1);
  const tx=18+Math.sin(1.6)*4*(v?1:-1),ty=16;for(let i=0;i<7;i++){const a=i/7*6.28+.3;const len=10+hash2(i,v,4)*4;N.tube(t=>[tx+Math.cos(a)*len*t,ty+Math.sin(a)*len*t*.6+t*t*6],t=>2.2*(1-t)+.6,(t,sd,l)=>rampPick(L5,-sd*.6+(t<.3?.2:0)),24,3)}N.ell(tx,ty+1,2,2,ramp5('#6a4a2a'),4);N.outline();return N.canvas()})}
function artMangrove(v){return cc('mang'+v,()=>{const N=PN(34,36);const L=ramp5('#3f6a3a'),T=ramp5('#6a5a42');for(let i=0;i<6;i++){const x=6+i*4.4;N.tube(t=>[x+(17-x)*t*.8,34-t*14],t=>.9,(t,sd,l)=>rampPick(T,-sd),20,1)}
  N.ell(17,12,14,10,(nx,ny,l)=>rampPick(L,l+(hash2(Math.round(nx*8),Math.round(ny*8),v)<.25?.3:0)),2);N.ell(10,15,7,5,L,3);N.ell(24,14,8,6,L,3);for(let i=0;i<6;i++)N.px(6+hash2(i,v,8)*22,6+hash2(i,9,v)*12,'#8ac080',4);N.outline();return N.canvas()})}
function artReedsC(){return cc('reedc',()=>{const N=PN(16,18);for(let i=0;i<7;i++){const x=2+i*2;N.line(x,17,x+(i%2?1:-1),4+i%3,i%2?'#6a8a3a':'#8aa04a',1,1);if(i%2===0)N.rect(x-1+(i%2?1:-1),3+i%3,2,3,'#7a5a3a',2)}N.outline();return N.canvas()})}
function artKelpTop(f){return cc('kelp'+f,()=>{const N=PN(18,14);for(let i=0;i<5;i++){const a=i*1.3+f;N.tube(t=>[9+Math.cos(a)*7*t,7+Math.sin(a)*5*t],t=>1.6-t,(t,sd,l)=>rampPick(ramp5('#8a7a3a'),-sd*.6),14,1)}N.ell(9,7,2,2,ramp5('#a08a3a'),2);return N.canvas()})}
function artWreckMast(v){return cc('wm'+v,()=>{const N=PN(30,34);N.ell(15,30,12,3,'#e4f7fb',0);N.line(15,31,v?20:11,2,'#5a4a3a',2,1);N.line(v?6:4,12,v?26:24,v?8:14,'#5a4a3a',1,2);if(v){N.line(20,2,26,14,'#8a7a6a',1,1)}N.poly([[8,30],[22,30],[18,26],[10,26]],ramp5('#4a3a2a')[2],1);N.outline();return N.canvas()})}
function artGullPerch(f){return cc('gp'+f,()=>{const N=PN(12,10);N.ell(6,6,4,2.4,ramp5('#f4f4f8'),1);N.ell(3,4,2,1.8,ramp5('#ffffff'),2);N.px(1,4,'#f0a030',3);N.px(2,3,'#141018',3);N.rect(7,5,4,2,'#9aa0b0',2);N.px(6,8+(f%2),'#f0a030',1);N.px(7,8,'#f0a030',1);N.outline();return N.canvas()})}
function artPelican(){return cc('pel',()=>{const N=PN(16,18);N.ell(9,11,5,4,ramp5('#f0f0f4'),1);N.tube(t=>[6-t*1,9-t*6],()=>1.4,()=>'#f8f8fc',10,2);N.ell(5,3,2.2,2,ramp5('#ffffff'),3);N.poly([[3,3],[-2,5],[3,5]],'#f0b040',4);N.rect(9,15,1,3,'#e0a030',0);N.rect(11,15,1,3,'#e0a030',0);N.px(5,2,'#141018',5);N.outline();return N.canvas()})}
function artCrabBeach(f){return cc('cb'+f,()=>{const N=PN(12,9);N.ell(6,5,3.5,2.4,ramp5('#e8604a'),2);for(const s of[-1,1]){N.line(6+s*3,5,6+s*5,3+(f%2),'#c8402a',1,1);N.line(6+s*3,6,6+s*5,8,'#c8402a',1,1);N.px(6+s*2,2,'#141018',3)}N.outline();return N.canvas()})}
function artStarfishRock(){return cc('sfr',()=>{const N=PN(18,12);N.ell(9,7,8,4.5,ramp5('#8a8496'),1);const pts=[];for(let i=0;i<10;i++){const a=i/10*6.28,r=i%2?1.4:3.4;pts.push([10+Math.cos(a)*r,6+Math.sin(a)*r])}N.poly(pts,'#e8783a',2);N.outline();return N.canvas()})}
function artFishShadow(r){return cc('sh'+r,()=>{const w=[8,12,18,26][r],h=[3,5,7,10][r];const[c,x]=mk(w+4,h+2);x.globalAlpha=.42;ell(x,(w+4)/2-1,(h+2)/2,w/2,h/2,'#12243a');x.fillStyle='#12243a';x.beginPath();x.moveTo(w-1,(h+2)/2);x.lineTo(w+4,1);x.lineTo(w+4,h+1);x.fill();return c})}
function artBirds(f){return cc('birds'+f,()=>{const[c,x]=mk(24,14);for(let i=0;i<4;i++){const bx=3+i*5+(i%2),by=3+(i*7)%8;const up=(f+i)%2;P(x,bx,by,K);P(x,bx-1,by-up,K);P(x,bx+1,by-up,K);P(x,bx-2,by-1+up,'#fbf6ea');P(x,bx+2,by-1+up,'#fbf6ea')}return c})}
function artDebris(){return cc('debr',()=>{const N=PN(26,14);N.ell(13,8,12,5,'#e4f7fb',0);N.line(3,9,22,6,WOOD[2],3,1);N.line(6,7,12,11,WOOD[3],2,1);N.ell(18,9,3,2,ramp5('#e8402a'),2);N.outline();return N.canvas()})}
function artSchool(f){return cc('sch'+f,()=>{const[c,x]=mk(30,18);for(let i=0;i<14;i++){const bx=3+hash2(i,1,f)*24,by=3+hash2(i,2,f)*12;R(x,bx,by,2,1,'#c8e4f0');P(x,bx+2,by,'#8ab8d0')}return c})}
function artSalvageSpot(f){return cc('salv'+f,()=>{const N=PN(20,14);const r=3+f*2;for(let a=0;a<6.28;a+=.25)N.px(10+Math.cos(a)*r*1.6,7+Math.sin(a)*r*.7,f>1?'#bfe8f4':'#e4f7fb',0);N.ell(10,7,2.6,1.6,ramp5('#f0d040'),2);N.px(10,4,'#3a3a40',2);N.px(10,5,'#3a3a40',2);N.outline();return N.canvas()})}
function artPotBuoyOwned(col){return artPotFloat(col)}
function artLighthouse(lit){return cc('lh'+lit,()=>{const W=36,H=104;const N=PN(W,H);const st=['#e8402a','#fbf6ea'];
  N.ell(18,H-4,16,4,SHADOW_C,0);N.rect(5,H-14,26,10,(i,j)=>rampPick(ramp5('#8a8496'),j===0?.4:-(i-6)*.04),1);N.rect(9,H-24,18,10,(i,j)=>rampPick(ramp5('#d8d4cc'),-(i-4)*.08),2);N.rect(15,H-21,6,8,'#5a3a2a',3);
  for(let y=26;y<H-24;y++){const t=(y-26)/(H-50);const hw=6+t*4;for(let x=Math.floor(18-hw);x<18+hw;x++){const band=Math.floor((y-26)/11)%2;const lit2=-(x-18+hw*.4)/hw;N.px(x,y,rampPick(ramp5(st[band]),lit2*.9),2)}}
  for(const y of[46,64])N.rect(16,y,4,5,(i,j)=>j===0?'#2a1a14':'#5a9ab8',3);
  N.rect(8,22,20,4,(i,j)=>rampPick(IRON,j===0?.4:-.2),3);for(let x=8;x<28;x+=2)N.px(x,21,IRON[2],3);N.rect(11,10,14,12,(i,j)=>i%4===0?'#3a3a40':lit?(j<6?'#fff8c0':'#ffd85a'):(j<6?'#d8eef4':'#a8c8d8'),3);
  N.poly([[9,10],[18,2],[27,10]],(x,y)=>rampPick(ramp5('#3a4a5a'),-(x-14)*.08),3);N.px(18,1,'#ffd24d',4);N.outline();return N.canvas()})}
function artBeam(len,a){const[c,x]=mk(len*2,len*2);const g=x.createRadialGradient(len,len,4,len,len,len);g.addColorStop(0,'rgba(255,246,190,.55)');g.addColorStop(1,'rgba(255,246,190,0)');x.fillStyle=g;x.beginPath();x.moveTo(len,len);x.arc(len,len,len,a-.18,a+.18);x.closePath();x.fill();return c}
function artJettyPost(){return cc('jpost',()=>{const N=PN(6,14);N.rect(1,0,4,13,(i,j)=>rampPick(WOOD,i===0?.4:i===3?-.6:0),1);N.rect(1,8,4,5,(i,j)=>(i+j)%2?'#4a7a6a':'#3a5a4a',2);N.outline();return N.canvas()})}
function artStall(col,kind){return cc('stall'+col+kind,()=>{const N=PN(40,34);const A=ramp5(col);N.rect(3,14,34,14,(i,j)=>rampPick(WOOD,j<2?.4:-.2),1);N.rect(3,26,34,2,WOOD[4],2);for(const x of[3,35])N.rect(x,4,2,24,WOOD[3],2);
  for(let i=0;i<9;i++)N.rect(1+i*4.3,2,4.3,7,(ii,jj)=>rampPick(ramp5(i%2?col:'#fbf6ea'),jj<2?.4:-.1),3);for(let i=0;i<9;i++)N.px(3+i*4.3,9,i%2?A[3]:'#d8d0c0',3);
  if(kind==='fish')for(let i=0;i<6;i++){N.ell(7+i*5,14,2.5,1.4,ramp5(['#8ab0c8','#e8604a','#c8c8d0'][i%3]),4);N.px(5+i*5,13,'#141018',5)}
  if(kind==='ice')for(let i=0;i<14;i++)N.px(5+i*2.2,15+(i%2),'#e8fbff',4);if(kind==='bait')for(let i=0;i<4;i++)N.rect(6+i*8,12,6,3,ramp5(['#d8806a','#f0a080','#6a9a4a','#a8b8c8'][i]),4);
  N.outline();return N.canvas()})}
function artTideBoard(){return cc('tboard',()=>{const N=PN(26,30);N.rect(4,14,2,15,WOOD[3],0);N.rect(20,14,2,15,WOOD[3],0);N.rect(1,1,24,16,(i,j)=>i===0||j===0||i===23||j===15?WOOD[3]:'#24344e',1);for(let i=0;i<20;i++){const y=9+Math.round(Math.sin(i/20*Math.PI*2)*4);N.px(3+i,y,'#7fdcc0',2)}N.px(5,4,'#ffd24d',3);N.px(6,4,'#ffd24d',3);N.outline();return N.canvas()})}
function artFuelPump(){return cc('fpump',()=>{const N=PN(14,22);N.ell(7,20,6,1.5,SHADOW_C,0);N.rect(2,4,10,16,(i,j)=>rampPick(ramp5('#d83a3a'),-(i-2)*.12+.1),1);N.rect(4,7,6,4,'#e8f4f0',2);N.px(5,8,'#2a2a30',3);N.px(7,8,'#2a2a30',3);N.rect(2,3,10,2,'#fbf6ea',2);N.line(12,9,13,16,'#2a2a30',1,2);N.outline();return N.canvas()})}
function artNoticeBoard(){return cc('nb',()=>{const N=PN(28,28);for(const x of[3,23])N.rect(x,12,2,15,WOOD[3],0);N.rect(1,1,26,15,(i,j)=>i===0||j===0||i===25||j===14?WOOD[2]:'#d8b888',1);for(let i=0;i<4;i++)N.rect(3+i*6,3+(i%2)*2,5,7,['#fbf6ea','#f4e4c0','#e8f0f8','#fbf6ea'][i],2);for(let i=0;i<4;i++)N.px(5+i*6,3+(i%2)*2,'#d83a3a',3);N.outline();return N.canvas()})}
function artMachineSign(){return cc('msign',()=>{const N=PN(30,12);N.rect(0,0,30,11,(i,j)=>j===0||j===10||i===0||i===29?'#ff6fd0':'#2a1838',1);return N.canvas()})}
