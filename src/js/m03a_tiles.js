/* ================= ART: extra ground tiles (world, caves, shop interiors) ================= */
const NOLIP=new Set(['m','c','cu','a','sa','cf','cw','mb','tl','ck','cp','sw','ss','sd','k','A','sn']);
const CAVE_THEMES=[
  {name:'Earth',floor:['#6b5442','#7d6450','#8f7560','#a3886f'],wall:['#2a1f22','#3e2f2e','#5a463e','#76604f']},
  {name:'Frost',floor:['#4f6478','#5f768c','#7189a0','#8aa3b8'],wall:['#1c2433','#2a3548','#425470','#5f7590']},
  {name:'Ember',floor:['#6a3a32','#7d4a3a','#925a44','#a8704e'],wall:['#23140f','#3a1f18','#5a2e22','#7a432e']},
  {name:'Crystal',floor:['#4e3f6e','#5e4d82','#6f5d96','#8573aa'],wall:['#1a1428','#2a2040','#43346a','#5f4c90']}];

/* ---------- terrain painters: faceted rock, snow, alpine grass, smooth lake shore ---------- */
const B4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];const bay=(x,y)=>(B4[(y&3)*4+(x&3)]+.5)/16;
const ROCKR=['#2a2333','#41364a','#594b58','#736363','#8f7f78','#ab9b8c','#c9baa4'];
function facet(wx,wy,cw,ch,seed){const cx=Math.floor(wx/cw),cy=Math.floor(wy/ch);let b=1e9,s2=1e9,bi=0,bj=0,fx=0,fy=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const gx=cx+i,gy=cy+j;const px=(gx+.15+hash2(gx,gy,seed)*.7)*cw,py=(gy+.15+hash2(gx,gy,seed+1)*.7)*ch;const d=Math.hypot(wx-px,(wy-py)*1.25);if(d<b){s2=b;b=d;bi=gx;bj=gy;fx=px;fy=py}else if(d<s2)s2=d}
  return{edge:(s2-b)/2,fx,fy,id:hash2(bi,bj,seed+2)}}
function rockLvl(wx,wy,v,cw=13,ch=9){const f=facet(wx,wy,cw,ch,411);let l=4.1+(f.id-.5)*1.5-((wx-f.fx)*.6+(wy-f.fy)*1.1)/7-v*2.2;
  if(f.edge<.9)l=Math.min(l-1.6,1.4);else if(f.edge<2&&wy<f.fy)l+=.9;else if(f.edge<2)l-=.5;return l}
function rockCol(wx,wy,l){return ROCKR[clamp(Math.floor(l+bay(wx,wy)-.5),0,6)]}
function plateauPx(wx,wy){const n=vnoise(wx,wy,11,3)*.75+vnoise(wx,wy,4,8)*.25+(hash2(wx,wy,5)-.5)*.1;const G=GRF;return n>.68?G.lt:n<.32?'#467f45':G.base}
function snowPx(wx,wy){const n=vnoise(wx,wy,16,431)*.7+vnoise(wx,wy,5,432)*.3;const l=n*3+(bay(wx,wy)-.5)*.6;let col=l>2.1?'#f7fafe':l>1.45?'#e6edf7':l>1?'#d3ddec':'#bccadf';
  const r=vnoise(wx,wy,15,433)*.8+vnoise(wx,wy,4,435)*.2;if(r>.8){const l2=rockLvl(wx,wy,0,9,7)+.8;col=r>.815?rockCol(wx,wy,l2):'#8a97b0'}else if(r>.77&&wy%2===0)col='#c4d0e2';if(hash2(wx,wy,434)<.004)col='#ffffff';return col}
function cliffTile(B,S,tx,ty,snowy){const x0=tx*16,y0=ty*16;const T=snowy?'cu':'c';const at=(i,j)=>tileAt(S,i,j);
  let top=ty;while(at(tx,top-1)===T)top--;let bot=ty;while(at(tx,bot+1)===T)bot++;const ty0=top*16,ty1=(bot+1)*16;
  for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=x0+i,wy=y0+j;const v=(wy-ty0)/(ty1-ty0);let col=rockCol(wx,wy,rockLvl(wx,wy,v));
    const hang=ty0+2+Math.floor(vnoise(wx,0,4,441)*3+vnoise(wx,0,2,442)*1.6);
    if(wy<hang)col=snowy?(wy===hang-1?'#bccadf':wy<ty0+1?'#ffffff':'#eef3fa'):(wy===hang-1?'#2f5a3c':(wy<ty0+1?GRF.lt:GRF.base));
    else if(wy===hang)col=snowy?'#8a97b0':'#2a2333';else if(wy===hang+1&&!snowy)col=ROCKR[1];
    if(snowy&&wy>=hang&&wy<hang+7&&vnoise(wx,wy,3,443)>.7&&wy<hang+3+vnoise(wx,0,3,444)*4)col='#dfe7f2';
    if(wy>=ty1-2)col=wy===ty1-1?ROCKR[0]:ROCKR[1];
    B.set(wx,wy,col)}}
function cliffShadow(B,S){const W=S.w;for(let ty=1;ty<S.h;ty++)for(let tx=0;tx<W;tx++){const up=S.g[(ty-1)*W+tx];if(up!=='c'&&up!=='cu')continue;const t=S.g[ty*W+tx];if(t==='c'||t==='cu')continue;
  for(let i=0;i<16;i++){const wx=tx*16+i;const d=3+Math.floor(vnoise(wx,ty,4,451)*3);for(let j=0;j<d;j++){const k=(ty*16+j)*B.w+wx;const v=B.u[k];const f=j===0?.62:j<d-1?.74:.86;const r=v&255,g=v>>8&255,b=v>>16&255;B.u[k]=(255<<24)|((b*f*1.04|0)<<16)|((g*f|0)<<8)|(r*f*.96|0)}
    if(hash2(wx,ty,452)<.05){const k=(ty*16+d+1)*B.w+wx;B.u[k]=c32(ROCKR[4]);B.u[k+1]=c32(ROCKR[3]);B.u[k+B.w]=c32(ROCKR[2]);B.u[k+B.w+1]=c32(ROCKR[1])}}}}
/* lake: continuous field so the shoreline is smooth instead of tile-stepped */
const LWAT=['#93d6ee','#72c1e6','#58aadb','#4794cd','#3b7fbd','#3269a8','#2c5994'];
function lakeTile(B,S,tx,ty,L){const x0=tx*16,y0=ty*16;
  for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=x0+i,wy=y0+j;const x=wx/16,y=wy/16;const d=L.d(x,y);const dx=(x-L.cx)/L.rx,dy=(y-L.cy)/L.ry;const rr=Math.hypot(dx,dy)||1e-3;
    const g=Math.hypot(dx/L.rx,dy/L.ry)/rr/(rr/Math.max(d,1e-3))/16;const e=(d-1)/g;const sw=L.sw(x);const sandPx=(sw-1)/g;let col;
    if(e<0){const dep=clamp((1-d)/.5,0,1)*5.4+(vnoise(wx,wy,38,461)-.5)*.9;let k=clamp(Math.floor(dep+(bay(wx,wy)-.5)*.95),0,6);
      const cx=Math.floor(wx/22),cy=Math.floor(wy/9),hh=hash2(cx,cy,462);if(hh<.32&&d<.96){const sy=cy*9+Math.floor(hash2(cx,cy,463)*7),sx=cx*22+Math.floor(hash2(cx,cy,464)*13),ln=3+Math.floor(hash2(cx,cy,465)*6);if(wy===sy&&wx>=sx&&wx<sx+ln)k=Math.max(0,k-2);if(wy===sy+1&&wx>sx&&wx<sx+ln-1&&k<6)k=Math.min(6,k+1)}
      col=LWAT[k];if(e>-1.3)col=vnoise(wx,wy,4,466)>.32?'#e4f7fb':LWAT[0];else if(e>-2.6)col='#bfe8f4';else if(e>-3.6&&bay(wx,wy)>.5)col='#bfe8f4'}
    else if(e<sandPx){if(e<1.4)col='#c2a06a';else if(e<2.6)col='#d3b67e';else{const rip=Math.sin(wx*.35+Math.sin(wy*.5)*1.5+wy*.9);col=rip>.85?'#f6e8be':rip<-.92?'#dcc48e':'#ecd8a4';if(hash2(wx,wy,467)<.012)col='#fff8ea';if(hash2(wx,wy,468)<.005)col='#f2a6a0'}
      if(sandPx-e<1.6&&sandPx>4)col='#d6bd88'}
    else{const ge=e-sandPx;const GP=grassPal(wx,wy);col=ge<1?GP.lip:ge<2?GP.dk:grassAt(wx,wy)}
    B.set(wx,wy,col)}}
function drawTileX(B,S,type,tx,ty){
  if(S.lakes&&(type==='a'||type==='A'||type==='sa'||type==='g')){for(const L of S.lakes){if(Math.abs(tx+.5-L.cx)<L.rx*1.45&&Math.abs(ty+.5-L.cy)<L.ry*1.45){const d=L.d(tx+.5,ty+.5);if(d<L.sw(tx+.5)+.16&&(type!=='g'||d>.9)){lakeTile(B,S,tx,ty,L);return true}}}}
  if(type==='c'||type==='cu'){cliffTile(B,S,tx,ty,type==='cu');return true}
  if(type==='m'){const x0=tx*16,y0=ty*16;for(let j=0;j<16;j++)for(let i=0;i<16;i++)B.set(x0+i,y0+j,plateauPx(x0+i,y0+j));return true}
  if(type==='sn'){const x0=tx*16,y0=ty*16;for(let j=0;j<16;j++)for(let i=0;i<16;i++)B.set(x0+i,y0+j,snowPx(x0+i,y0+j));return true}
  const x0=tx*16,y0=ty*16;const set=(i,j,col)=>B.set(x0+i,y0+j,col);const h=(i,j,s=0)=>hash2(x0+i,y0+j,s);const at=(i,j)=>tileAt(S,i,j);
  if(type==='sa'){const wet=[at(tx,ty-1),at(tx,ty+1),at(tx-1,ty),at(tx+1,ty)].some(t=>t==='a'||t==='A');
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=x0+i,wy=y0+j;const rip=Math.sin(wx*.35+Math.sin(wy*.5)*1.5+wy*.9);let col=rip>.85?'#f6e8be':rip<-.92?'#dcc48e':'#ecd8a4';if(h(i,j,4)<.012)col='#fff8ea';if(h(i,j,5)<.006)col='#f2a6a0';set(i,j,col)}
    if(wet){for(let j=0;j<16;j++)for(let i=0;i<16;i++){const d=Math.min(at(tx,ty-1)[0]==='a'||at(tx,ty-1)==='A'?j:99,at(tx,ty+1)==='a'||at(tx,ty+1)==='A'?15-j:99,at(tx-1,ty)==='a'||at(tx-1,ty)==='A'?i:99,at(tx+1,ty)==='a'||at(tx+1,ty)==='A'?15-i:99);if(d<4)set(i,j,d<2?'#c9ad78':'#d8be88')}}
    return true}
  if(type==='dr'){const horiz=at(tx-1,ty)==='dr'||at(tx+1,ty)==='dr';
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){const a=horiz?j:i;const n=vnoise(x0+i,y0+j,6,17);let col=n>.7?'#d8b688':n<.25?'#b48d62':'#c8a476';if(a===3||a===4||a===11||a===12)col=n>.6?'#b48d62':'#a8835a';if(a===5||a===13)col='#d8b688';if(h(i,j,7)<.03)col='#8f8aa6';if((a===7||a===8)&&h(i,j,9)<.08)col='#6aa85a';set(i,j,col)}return true}
  if(type==='A'){const Wt=PAL.water;for(let j=0;j<16;j++)for(let i=0;i<16;i++){const n=vnoise(x0+i,y0+j,10,23);set(i,j,n>.72?Wt[3]:n<.3?'#2a5f8f':Wt[2])}
    for(const[dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){if(at(tx+dx,ty+dy)!=='a')continue;for(let k=0;k<16;k++)for(let d=0;d<4;d++){const i=dx===0?k:(dx<0?d:15-d),j=dy===0?k:(dy<0?d:15-d);if(((i+j)&1)&&d<3)set(i,j,Wt[3])}}return true}
  if(type==='k'){const W=PAL.wood;const wUp=at(tx,ty-1)!=='k',wDn=at(tx,ty+1)!=='k';
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){const p=i%4;let col=p===0?W[2]:p===1?W[5]:p===3?W[3]:W[4];if(p===0)col=W[1];if((j===4||j===12)&&p===2)col=W[2];set(i,j,col)}
    if(wUp)for(let i=0;i<16;i++){set(i,0,W[5]);set(i,1,W[4])}
    if(wDn){for(let i=0;i<16;i++){set(i,13,W[2]);set(i,14,W[1]);set(i,15,W[0])}if(tx%2===0){for(let j=12;j<16;j++){set(1,j,W[0]);set(2,j,W[1])}}}
    return true}
  if(type==='m'||type==='sn'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wy=y0+j,wx=x0+i;const snowT=type==='sn'?1:clamp((7*16-wy)/48,0,1);const n=vnoise(wx,wy,7,51)+(hash2(wx,wy,52)-.5)*.2;let col;
      if(n<snowT){col=vnoise(wx,wy,4,53)>.6?'#ffffff':'#e8eef8';if(vnoise(wx,wy,5,54)<.25)col='#c9d4e8'}else{const m=vnoise(wx,wy,5,55);col=m>.68?'#a4ab8e':m<.3?'#6f7a5c':'#8a937a';if(hash2(wx,wy,56)<.04)col='#5c6650'}set(i,j,col)}return true}
  if(type==='c'){const top=at(tx,ty-1)!=='c',bot=at(tx,ty+1)!=='c';
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=x0+i;const col4=Math.floor((wx+Math.floor(vnoise(wx,y0+j,9,61)*4))/5);const ci=(wx+Math.floor(vnoise(wx,y0+j,9,61)*4))%5;let col=ci===0?'#b3abc4':ci===4?'#5f5874':'#8a8299';if(hash2(col4,Math.floor((y0+j)/7),62)<.3&&(y0+j)%7===0)col='#56506a';if(hash2(wx,y0+j,63)<.04)col='#a39cb4';set(i,j,col)}
    if(top){for(let i=0;i<16;i++){set(i,0,'#4a5240');set(i,1,'#c9cfd8');set(i,2,'#a39cb4');set(i,3,'#6d6680')}}
    if(bot){for(let i=0;i<16;i++){set(i,13,'#56506a');set(i,14,'#3e3a52');set(i,15,'#2e2a3e');if(h(i,0,64)<.3)set(i,12,'#8a8299')}}
    return true}
  if(type==='cf'||type==='cw'){const T=S.theme||CAVE_THEMES[0];const WR=T._wr||(T._wr=[T.wall[0],T.wall[1],mix(T.wall[1],T.wall[2],.5),T.wall[2],mix(T.wall[2],T.wall[3],.5),T.wall[3],mix(T.wall[3],'#ffffff',.18)]);
    if(type==='cf'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=x0+i,wy=y0+j;const n=vnoise(wx,wy,6,71)+(h(i,j,72)-.5)*.15;let col=n>.68?T.floor[3]:n<.3?T.floor[1]:T.floor[2];if(h(i,j,73)<.02)col=T.floor[0];
        const cr=Math.abs(vnoise(wx,wy,13,78)-.5);if(cr<.018)col=T.floor[0];else if(cr<.03&&n>.4)col=T.floor[1];set(i,j,col)}
      for(let k=0;k<2;k++)if(h(k,5,74)<.45){const px=2+(h(k,0,74)*11|0),py=2+(h(k,1,74)*11|0);set(px,py,T.floor[3]);set(px+1,py,T.floor[3]);set(px,py+1,T.floor[1]);set(px+1,py+1,T.floor[0]);set(px+2,py+1,T.floor[1])}
      if(at(tx,ty-1)==='cw')for(let i=0;i<16;i++){set(i,0,T.floor[0]);set(i,1,T.floor[0]);if(h(i,0,79)<.6)set(i,2,T.floor[1])}
      if(at(tx-1,ty)==='cw')for(let j=0;j<16;j++)set(0,j,T.floor[1]);if(at(tx+1,ty)==='cw')for(let j=0;j<16;j++)set(15,j,T.floor[1]);
      return true}
    const below=at(tx,ty+1)==='cf';
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=x0+i,wy=y0+j;let col;
      if(below&&j>=5){const v=(j-5)/11;let l=rockLvl(wx,wy,0,10,7)-1.2+v*.6;col=WR[clamp(Math.floor(l+bay(wx,wy)-.5),0,6)];if(j===5)col=WR[5];if(j===6&&h(i,j,77)<.5)col=WR[4];if(j===15)col=WR[0]}
      else{const n=vnoise(wx,wy,5,75)+(h(i,j,76)-.5)*.2;col=n>.66?WR[2]:n<.3?WR[0]:WR[1];if(h(i,j,80)<.015)col=WR[3]}
      set(i,j,col)}
    if(at(tx-1,ty)==='cf')for(let j=0;j<16;j++){set(0,j,WR[4]);set(1,j,WR[3])}if(at(tx+1,ty)==='cf')for(let j=0;j<16;j++)set(15,j,WR[0]);
    return true}
  if(type==='mb'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=x0+i,wy=y0+j;let col=((tx+ty)&1)?'#f2eef6':'#e6e0ee';const v=Math.abs(Math.sin(wx*.3+vnoise(wx,wy,8,81)*6)+Math.cos(wy*.2));if(v<.05)col='#c9c0d8';if(i===0||j===0)col='#fbf8ff';if(i===15||j===15)col='#cfc8dc';set(i,j,col)}return true}
  if(type==='tl'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){const bx=i&7,by=j&7;let col=(((i>>3)+(j>>3))&1)?'#e6eef4':'#dbe6f0';if(bx===7||by===7)col='#b9c6d2';else if(bx===0||by===0)col='#f6fafd';set(i,j,col)}return true}
  if(type==='ck'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){const q=((i>>3)+(j>>3))&1;let col=q?'#f7efe0':'#7fbf9a';if((i&7)===0||(j&7)===0)col=q?'#fffaf0':'#94d0ae';if((i&7)===7||(j&7)===7)col=q?'#e2d6c0':'#62a07e';set(i,j,col)}return true}
  if(type==='cp'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){let col='#b84a5a';if(((i+j)%8)===0)col='#c95a6a';if(i%8===4&&j%8===4)col='#ffd24d';set(i,j,col)}return true}
  if(type==='sw'){const T=S.theme||{wall:'#f3dcc0',trim:'#c48a6c',wain:'#a8745a'};const wr=rampOf(T.wall),tr=rampOf(T.wain);
    if(ty===0){for(let j=0;j<16;j++)for(let i=0;i<16;i++)set(i,j,j<2?'#6a5a8e':j>13?'#2e2440':'#4a3c68');return true}
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wy=(ty-1)*16+j;let col=T.wall;if(T.pattern==='stripe'&&((x0+i)%8)<2)col=wr[2];if(T.pattern==='dots'&&((x0+i+4)%8)===0&&(wy%8)===3)col=wr[0];if(T.pattern==='panel'&&((x0+i)%16===0))col=wr[2];
      if(ty===1&&j<2)col=wr[3];
      if(ty===2){if(j===6)col=tr[0];else if(j===7)col=tr[3];else if(j>7&&j<14){const px=(x0+i)%16;col=(px===0||j===8)?tr[0]:(px===15||j===13)?tr[2]:T.wain}else if(j>=14)col=j===14?tr[3]:'#2e2440'}
      set(i,j,col)}return true}
  if(type==='ss'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){let col='#2e2440';const inner=tx===0?i>=13:i<=2;if(inner)col=(tx===0?i===13:i===2)?'#6a5a8e':'#4a3c68';set(i,j,col)}return true}
  if(type==='sd'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){let col='#8f6440';if(j>=3&&j<=13){col=((i+j)%4<2)?'#c7384a':'#a82e3e';if(j===3||j===13)col='#7a2030'}set(i,j,col)}return true}
  return false}

