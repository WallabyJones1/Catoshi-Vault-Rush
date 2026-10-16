/* ================= the world: Gullhaven and its eight fishing grounds =================
   160x120 tiles. The town sits on the west coast around a walled harbour; a mangrove river runs out to the north,
   a long sandy bay curves along the south, and the sea gets deeper (and stranger) the further east you go.
   Land and sea come from one continuous field (tile units, positive = land) so the shoreline is smooth at the
   pixel level and the gameplay tiles agree with what you see. */
const WORLD_W=160,WORLD_H=120;
let WORLD=null,scene=null;const SCENES={};
function newScene(name,w,h){return{name,w,h,g:new Array(w*h).fill('g'),sol:new Uint8Array(w*h),res:new Uint8Array(w*h),props:[],acts:[],water:[],spots:{},keepers:[],lights:[]}}
function addProp(S,img,x,y,o={}){const p=Object.assign({img,x,y,sy:y+img.height},o);if(o.sy!==undefined)p.sy=o.sy;S.props.push(p);return p}
function solidRect(S,x0,y0,x1,y1){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(x>=0&&y>=0&&x<S.w&&y<S.h)S.sol[y*S.w+x]=1}
function reserve(S,x0,y0,x1,y1){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(x>=0&&y>=0&&x<S.w&&y<S.h)S.res[y*S.w+x]=1}
function placeBuilding(S,tx,ty,w,h,r,o){const img=artBuilding(w,h,r,o);if(o.chimney)(S.chimneys=S.chimneys||[]).push({x:tx*16+w*16-13,y:(ty-r)*16-2});(S.shadows=S.shadows||[]).push([tx,ty,w,h,r]);const p=addProp(S,img,tx*16,(ty-r)*16,{sy:(ty+h)*16-1});solidRect(S,tx,ty,tx+w-1,ty+h-1);reserve(S,tx,ty-r,tx+w-1,ty+h);(S.wins=S.wins||[]).push({x:tx*16,y:(ty-r)*16,w:w*16,h:(h+r)*16,o});return{p,door:{x:(tx+o.door)*16+8,y:(ty+h)*16+6},tx,ty,w,h}}
const treeArt=new Map();function treeImg(v){if(!treeArt.has(v))treeArt.set(v,artTree(v));return treeArt.get(v)}
function treeAt(S,tx,ty,v){const img=treeImg(v);addProp(S,img,tx*16-14,(ty+1)*16-47,{sy:(ty+1)*16-3,sway:1});S.sol[ty*S.w+tx]=1;S.res[ty*S.w+tx]=1}
function act(S,x,y,r,label,icon,fn,o={}){S.acts.push(Object.assign({x,y,r,label,icon,act:fn},o))}
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
/* ---------- the land field ---------- */
// a small tileable noise texture keeps the per-pixel painting fast on phones
const NZ=(()=>{const n=128,a=new Float32Array(n*n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let v=0,amp=.5,f=1;for(let o=0;o<3;o++){const s=16/f;v+=amp*vnoise((x%n)*1,(y%n)*1,s,700+o);amp/=2;f*=2}a[y*n+x]=v/.875}return{n,a,at(x,y){return a[(((y|0)%n+n)%n)*n+(((x|0)%n+n)%n)]}}})();
const COAST={};
function buildCoast(){const W=WORLD_W,H=WORLD_H,P=16;
  // west coast x position for every pixel row (tile units)
  const cx=new Float32Array(H*P),sy=new Float32Array(W*P),rv=new Float32Array(W*P),rw=new Float32Array(W*P);
  const CP=[[-4,68],[0,68],[8,66],[16,63],[24,61],[30,59],[33,59.5],[36,64],[39,67],[41.5,65],[43.4,57.5],[44,56],[84,56],[86,55.5],[90,53],[95,47],[100,42],[106,40],[124,40]];
  const cat=(y)=>{let i=1;while(i<CP.length-2&&CP[i+1][0]<y)i++;const p0=CP[i-1],p1=CP[i],p2=CP[i+1],p3=CP[Math.min(CP.length-1,i+2)];const t=clamp((y-p1[0])/(p2[0]-p1[0]),0,1);const t2=t*t,t3=t2*t;
    return .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)};
  for(let i=0;i<H*P;i++){const y=i/P;let c=cat(y);const flat=y>=43.6&&y<84.5;
    if(!flat)c+=(vnoise(0,y,5,601)-.5)*2.2+(vnoise(0,y,13,602)-.5)*3*smooth(0,6,Math.min(Math.abs(y-44),Math.abs(y-84)));cx[i]=c}
  // southern shore: the long beach, then a rocky point, then open water
  for(let i=0;i<W*P;i++){const x=i/P;let s;if(x<40)s=100;else if(x<100)s=108+Math.sin(x*.09)*1.5-smooth(40,52,x)*3+smooth(52,60,x)*3;else if(x<107)s=108-smooth(99,103,x)*8+smooth(104,108,x)*8;else s=200;
    s+=(vnoise(x,0,6,611)-.5)*1.6;sy[i]=s;
    // the river: meanders east from the hills into the estuary bay
    rv[i]=17+Math.sin(x*.11)*2.5+(vnoise(x,0,9,621)-.5)*3;rw[i]=x<10?1.6:1.8+smooth(10,60,x)*2.6+(vnoise(x,0,5,622)-.5)*.8}
  COAST.cx=cx;COAST.sy=sy;COAST.rv=rv;COAST.rw=rw;
  COAST.islands=[{x:90,y:52,r:3.2},{x:118,y:30,r:1.6,rock:1},{x:124,y:62,r:1.3,rock:1},{x:113,y:74,r:1.4,rock:1}]}
// signed land field (tile units): > 0 land, < 0 water
function landF(x,y){const P=16;const yi=clamp(Math.floor(y*P),0,WORLD_H*P-1),xi=clamp(Math.floor(x*P),0,WORLD_W*P-1);
  let L=Math.max(COAST.cx[yi]-x,y-COAST.sy[xi]);
  for(const I of COAST.islands){const d=Math.hypot(x-I.x,(y-I.y)*1.2);L=Math.max(L,I.r-d+(I.rock?0:(NZ.at(x*9,y*9)-.5)*.8))}
  if(y<36){const r=Math.abs(y-COAST.rv[xi])-COAST.rw[xi]*(1+smooth(50,64,x)*1.6);L=Math.min(L,r)}
  return L}
// what lines this stretch of coast
function shoreKind(x,y){const n=(NZ.at(x*3,y*3)-.5)*4;if(x>98&&x<108&&y>96)return'rock';for(const I of COAST.islands)if(I.rock&&Math.hypot(x-I.x,y-I.y)<I.r+2)return'rock';
  if(y<31+n)return x<66+n?'mud':'sand';if(y<43.5&&x>48)return'rock';if(y>=43.5&&y<84.6&&x<58)return'wall';return'sand'}
function sandWidth(x,y){if(y>=30&&y<44&&x>48)return 6.5+NZ.at(x*4,y*4)*2.5;if(x>98&&x<108&&y>96)return 3;if(y<34)return x<64?1.8:1.4;if(y>96)return 4.5+NZ.at(x*3,7)*1.5;if(y>84)return 2.6;return 1.6}
function zoneOfXY(x,y){const n=(NZ.at(x*2.3,y*2.3)-.5)*8,m=(NZ.at(x*1.1+40,y*1.1)-.5)*10;
  if(x>=57&&x<74.5&&y>=43.5&&y<85)return'harbour';
  if(x>=147+n*.4)return'deep';if(x>=133+n*.7)return'blue';
  if(Math.hypot(x-62,(y-15)*1.25)<27+m||(y<30&&x<56))return'estuary';
  if(Math.hypot(x-120,(y-106)*1.1)<24+m&&x>98)return'kelp';
  if(y>=86+n*.6&&x<102+m)return'shallows';
  if(x>=107+n)return y>94+m?'kelp':'wreck';
  return'reef'}
function depthAt(x,y,L,z){const d=-L;switch(z){case'harbour':return 2+Math.min(3,d*.35);case'estuary':return .8+Math.min(3,d*.3);case'shallows':return .6+Math.min(5,d*.35);
  case'reef':return 3+Math.min(6,d*.12)-(NZ.at(x*4,y*4)>.62?2.5:0);case'kelp':return 6+Math.min(6,d*.15);case'wreck':return 10+Math.min(10,d*.1);case'blue':return 30+(x-132)*2;default:return 80+(x-146)*6}}
/* ---------- painting the ground ---------- */
const SEA={harbour:['#7ad0d4','#4ab0c8','#3a96c0','#3284b0'],estuary:['#8ab49a','#6a9e8e','#548a80','#467a74'],shallows:['#9ae4dc','#6ad0d4','#48b6cc','#3a9cc2'],reef:['#7adcd8','#4ac4d0','#36aac8','#2c94bc'],
  kelp:['#5aa49c','#3e8c8c','#307682','#286474'],wreck:['#3a86ac','#2f72a0','#2a6292','#245484'],blue:['#2a62a8','#24529a','#20468a','#1c3a7a'],deep:['#1c2c66','#18245a','#141c4c','#10163e']};
function seaPx(wx,wy,x,y,L,z){// colour zone sampled with a jitter so neighbouring grounds dither into each other
  let jz=zoneOfXY(x+(hash2(wx,wy,31)-.5)*3,y+(hash2(wx,wy,32)-.5)*3);if(jz==='harbour'||z==='harbour')jz=z;const P=SEA[jz]||SEA.reef;const n=NZ.at(wx*.7,wy*.7)*.6+NZ.at(wx*2.1+50,wy*2.1)*.4;const sh=-L;
  let k=sh<1.2?0:sh<3?1:sh<7?2:3;if(jz==='deep'||jz==='blue'||jz==='wreck'){k=n>.72?1:n<.28?3:2}else if(k>=2)k=n>.7?1:n<.3?3:2;
  if(jz==='reef'&&sh>2&&NZ.at(wx*.9+17,wy*.9)>.66)k=Math.max(0,k-1);
  let col=P[k];if(n>.8&&k<3&&k>0)col=P[k-1];
  if(x>146&&x<147.6)col=mix(col,'#0c1030',.3);
  if(jz==='kelp'&&NZ.at(wx*1.6+9,wy*1.6)>.66)col=mix(col,'#4a5a2a',.45);
  if(jz==='reef'&&sh>3&&NZ.at(wx*1.3+33,wy*1.3)>.74)col=hash2(wx>>2,wy>>2,9)<.5?mix(col,'#e88a8a',.35):mix(col,'#f0c880',.3);
  if(jz==='wreck'&&NZ.at(wx*1.8+71,wy*1.8)>.78)col=mix(col,'#3a4a5a',.45);
  return col}
function paintWorldGround(S){const W=S.w,H=S.h;const B=mkBuf(W*16,H*16);const foam=mkBuf(W*16,H*16),tide=mkBuf(W*16,H*16);
  // land tiles first, with the usual tile painters
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){const t=S.g[ty*W+tx];if(t==='o'||t==='pr'||t==='bw'||t==='sk')continue;if(t==='sa'||t==='mud'||t==='rk')continue;drawTile(B,S,t,tx,ty)}
  grassEdges(B,S);
  // then every coastal and sea pixel from the field
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){const t=S.g[ty*W+tx];if(!(t==='o'||t==='pr'||t==='bw'||t==='sk'||t==='sa'||t==='mud'||t==='rk'||t==='g'||t==='gb'))continue;
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=tx*16+i,wy=ty*16+j,x=wx/16,y=wy/16;const L=landF(x,y);const kind=shoreKind(x,y);const sw=sandWidth(x,y);
      const isG=t==='g'||t==='gb';if(L>=0&&!isG&&t!=='sa'&&t!=='mud'&&t!=='rk')continue;if(L>=0&&isG&&L>sw+.5&&kind!=='rock')continue;
      let col;
      if(L<0){const z=zoneOfXY(x,y);col=seaPx(wx,wy,x,y,L,z);const e=-L*16;
        if(kind!=='wall'){if(e<1.6)col=hash2(wx,wy,77)<.7?'#f4fbfb':'#d8f2f4';else if(e<3.5)col=mix(col,'#ffffff',.3);if(e<9)tide.set(wx,wy,'#5ab8cc')}
        else if(e<2)col=mix(col,'#123a5a',.35);
        if(kind!=='wall'&&e>=1.6&&e<5&&hash2(wx,wy,78)<.5)foam.set(wx,wy,'#ffffff')}
      else{const e=L*16;
        if(e>=sw*16&&kind!=='rock'){if(!isG)continue;const ge=e-sw*16;const GP=grassPal(wx,wy);col=ge<1?GP.lip:ge<2?GP.dk:grassAt(wx,wy)}
        else if(kind==='mud'){col=NZ.at(wx*2,wy*2)>.6?'#7a6a50':e<5?'#5e5240':'#6e604a';if(NZ.at(wx*3+5,wy*3)>.72)col='#86a0a0'}
        else if(kind==='rock'){if(e>=sw*16){if(!isG)continue;const GP=grassPal(wx,wy);const ge=e-sw*16;col=ge<1?'#5a566a':ge<2?GP.dk:grassAt(wx,wy);B.set(wx,wy,col);continue}const v=NZ.at(wx*1.5,wy*1.5)*.6+hash2(wx>>1,wy>>1,5)*.4;col=e<1.5?'#3e3a4c':v>.66?'#b8b4c4':v>.45?'#9a96aa':v>.25?'#827e94':'#6a6680';if(e<3)col=mix(col,'#4a5a6a',.3);if(NZ.at(wx*2.2+40,wy*2.2)>.78&&e>6)col=mix('#3f9ac0','#8ad8d8',NZ.at(wx*5,wy*5))}
        else if(kind==='wall'){if(!isG)continue;col=grassAt(wx,wy)}
        else{const rip=Math.sin(wx*.35+Math.sin(wy*.5)*1.5+wy*.9);col=e<4?'#c8ac78':e<9?'#d8bc88':rip>.86?'#f8ebc4':rip<-.92?'#dcc48e':'#eedcaa';if(e>=4&&hash2(wx,wy,467)<.012)col='#fff8ea';if(e>=4&&hash2(wx,wy,468)<.005)col='#f2a6a0';if(e<9)tide.set(wx,wy,'#7ac8cc');
          if(e>(sw-.3)*16){const GP=grassPal(wx,wy);col=GP.lip}}
        if(!col)continue}
      B.set(wx,wy,col)}}
  // sea wall along the harbour promenade
  for(let ty=43;ty<85;ty++){const tx=55;for(let j=0;j<16;j++)for(let i=8;i<16;i++){const wx=tx*16+i,wy=ty*16+j;const st=PAL.stone;const bx=(i+(Math.floor(wy/6)%2)*4)%8,by=wy%6;B.set(wx,wy,i>=14?'#3e3a52':by===5||bx===7?st[2]:by===0?st[5]:st[4])}}
  // piers and breakwalls over the water
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){const t=S.g[ty*W+tx];if(t==='pr')pierTile(B,S,tx,ty);else if(t==='bw')wallTile(B,S,tx,ty)}
  B.flush();foam.flush();tide.flush();S.ground=B.c;S.foam=foam.c;S.tideC=tide.c}
function pierTile(B,S,tx,ty){const Wd=PAL.wood;const at=(x,y)=>tileT(S,x,y);const horiz=at(tx-1,ty)==='pr'||at(tx+1,ty)==='pr';
  for(let j=0;j<16;j++)for(let i=0;i<16;i++){const a=horiz?i:j,b=horiz?j:i;const p=(horiz?ty*16+j:tx*16+i)%4;let col=p===0?Wd[1]:p===3?Wd[2]:Wd[4];if(((horiz?tx*16+i:ty*16+j)+(horiz?(ty*16+j)>>2:(tx*16+i)>>2)*5)%16===0)col=Wd[1];B.set(tx*16+i,ty*16+j,col)}
  const edge=(dx,dy)=>{const t=at(tx+dx,ty+dy);return t!=='pr'&&t!=='k'&&t!=='w'&&t!=='p'};
  if(edge(0,1))for(let i=0;i<16;i++){B.set(tx*16+i,ty*16+15,Wd[0]);B.set(tx*16+i,ty*16+14,Wd[1]);if(ty+1<S.h)for(let k=0;k<4;k++)B.set(tx*16+i,ty*16+16+k,mix(B.get?'#2a6a8a':'#2a6a8a','#123a5a',.3+k*.1))}
  if(edge(0,-1))for(let i=0;i<16;i++)B.set(tx*16+i,ty*16,Wd[5]);if(edge(-1,0))for(let j=0;j<16;j++)B.set(tx*16,ty*16+j,Wd[1]);if(edge(1,0))for(let j=0;j<16;j++){B.set(tx*16+15,ty*16+j,Wd[0]);B.set(tx*16+16,ty*16+j,'#2a5a7a')}
  if((tx+ty)%3===0&&edge(0,1)){for(let k=0;k<3;k++)for(let i=6;i<10;i++)B.set(tx*16+i,ty*16+16+k,i<7?Wd[3]:Wd[1])}}
function wallTile(B,S,tx,ty){const R5=['#5a566a','#6e6a80','#86829a','#a09cb2','#bcb8cc'];for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=tx*16+i,wy=ty*16+j;const cx=Math.floor(wx/7)*7+3+Math.floor(hash2(Math.floor(wx/7),Math.floor(wy/6),4)*2),cy=Math.floor(wy/6)*6+3;const d=Math.hypot((wx-cx)/3.6,(wy-cy)/3.1);let col;
    if(d>1.05)col=R5[0];else{const l=-(wx-cx)*.2-(wy-cy)*.3+.3;col=l>.5?R5[4]:l>.1?R5[3]:l>-.3?R5[2]:R5[1]}B.set(wx,wy,col)}
  const at=(x,y)=>tileT(S,x,y);for(const[dx,dy]of[[0,1],[0,-1],[1,0],[-1,0]]){if(at(tx+dx,ty+dy)!=='o')continue;for(let k=0;k<16;k++)for(let q=0;q<2;q++){const i=dx===0?k:dx>0?16+q:-1-q,j=dy===0?k:dy>0?16+q:-1-q;if(hash2(tx*16+i,ty*16+j,90)<.6)B.set(tx*16+i,ty*16+j,'#e8f8f8')}}}
const tileT=(Sc,tx,ty)=>(tx<0||ty<0||tx>=Sc.w||ty>=Sc.h)?'':Sc.g[ty*Sc.w+tx];
/* ---------- the town plan ---------- */
const GBLD={ // building art: [w, wallRows, roofRows, options]
  market:[8,3,3,{wall:'#e8e2d0',mat:'planks',roof:'#3f7a8a',door:4,win:[1,6],awning:['#3f86bd','#fbf6ea'],label:'FISH MARKET',labelBg:'#bfe8f4',lamp:1,doorC:'#2f6a7a'}],
  tackle:[5,3,3,{wall:'#f4d890',mat:'siding',roof:'#c8443a',door:2,win:[0,4],awning:['#c8443a','#fbf6ea'],label:'TACKLE',labelBg:'#fff4e0',doorC:'#8a3a2a',lamp:1}],
  boatyard:[7,3,3,{wall:'#a8b8c4',mat:'planks',roof:'#5a4a3a',door:3,win:[1,5],label:'BOATYARD',labelBg:'#e8e2d0',doorC:'#3a4a5a',barn:1}],
  exchange:[6,3,3,{wall:'#e8e4dc',mat:'stone',roof:'#3a5a7a',flat:1,door:3,win:[1,5],columns:[22,66],label:'EXCHANGE',labelBg:'#ffd24d',trim:'#ffffff',lamp:1,doorC:'#2a4a6a'}],
  aquarium:[7,3,3,{wall:'#bfe8f4',mat:'plaster',roof:'#2a6a9a',door:3,win:[1,5],label:'AQUARIUM',labelBg:'#7fdcc0',doorC:'#2a5a8a',hood:'#3f9ac0',plants:1}],
  tavern:[6,3,3,{wall:'#c88a5a',mat:'logs',roof:'#4a3a3a',door:3,win:[1,5],label:'SALTY GULL',labelBg:'#fbf1dc',chimney:1,lamp:1,doorC:'#5a2a1a',curtain:'#e8a040'}],
  harbourmaster:[5,3,3,{wall:'#fbf6ea',mat:'siding',roof:'#2a4a6a',door:2,win:[0,4],label:'LICENCES',labelBg:'#ffd24d',doorC:'#2a4a6a',shutter:'#3f86bd'}],
  home:[4,2,2,{wall:'#bfe8e0',mat:'siding',roof:'#3f7a8a',door:1,win:[3],flowers:1,chimney:1,doorC:'#e8604a'}]};
const HOUSES=[['#f4e4c8','#c8443a'],['#d8e8f4','#2a4a6a'],['#f8d8c8','#7a5a4a'],['#e8f0d8','#3f7a5a'],['#fbf6ea','#3f86bd'],['#f0e0a8','#8a5a3a'],['#e4d8f0','#5a4a7a']];
function coopHallArgs(C){return[5,3,3,{wall:C.hall,mat:'planks',roof:C.dk,door:2,win:[0,4],label:C.s.toUpperCase().slice(0,12),labelBg:C.col,doorC:C.col,lamp:1,awning:[C.col,C.lt==='#ffffff'?'#fbf6ea':C.lt]}]}
function genWorld(){buildCoast();
  const S=newScene('world',WORLD_W,WORLD_H);const W=S.w,H=S.h;const idx=(x,y)=>y*W+x;S.kind='world';
  const set=(t,x0,y0,x1,y1,res=1)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(x<0||y<0||x>=W||y>=H)continue;S.g[idx(x,y)]=t;if(res)S.res[idx(x,y)]=1}};
  S.zone=new Uint8Array(W*H).fill(255);S.depth=new Float32Array(W*H);S.nav=new Uint8Array(W*H);
  // classify every tile from the field
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){const x=tx+.5,y=ty+.5;const L=landF(x,y);const i=idx(tx,ty);
    if(L<0){S.g[i]='o';S.sol[i]=1;S.res[i]=1;const z=zoneOfXY(x,y);S.zone[i]=ZONE_ORDER.indexOf(z);S.depth[i]=depthAt(x,y,L,z);S.nav[i]=1;if(L<-.8)S.water.push(i)}
    else{const k=shoreKind(x,y),sw=sandWidth(x,y);if(L<sw){S.g[i]=k==='mud'?'mud':k==='rock'?'rk':k==='wall'?'g':'sa';S.res[i]=1}}}
  GZONE=(wx,wy)=>{const x=wx/16,y=wy/16;return y<12||(x<10&&y>88)?.8:0};
  // harbour: breakwalls, the entrance, and three jetties
  const bw=(x0,y0,x1,y1)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=idx(x,y);S.g[i]='bw';S.sol[i]=0;S.nav[i]=0;S.res[i]=1}};
  bw(64,43,74,43);bw(74,43,74,56);bw(57,85,74,85);bw(74,70,74,85);
  const pier=(x0,y0,x1,y1)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=idx(x,y);S.g[i]='pr';S.sol[i]=0;S.nav[i]=0;S.res[i]=1}};
  pier(56,50,66,51);pier(56,62,68,63);pier(56,74,66,75);pier(56,57,57,57);
  // streets: north street (co-op row), the quay, main street into the square, south street, the beach boardwalk
  set('w',4,30,51,31);set('w',46,30,51,88);set('k',52,44,55,84);set('w',30,6,32,92);
  set('w',6,56,33,58);set('p',34,50,45,64);set('w',34,45,51,46);set('w',34,38,45,38);set('w',30,71,51,72);
  set('w',6,82,51,83);set('k',40,84,43,96);set('w',51,32,58,33);
  set('w',26,53,27,55);set('w',18,53,19,55);set('w',24,65,25,66);set('w',4,65,33,66);
  // the bridge over the river
  for(let x=30;x<=32;x++)for(let y=6;y<=26;y++){const i=idx(x,y);if(landF(x+.5,y+.5)<.6){S.g[i]='pr';S.nav[i]=0}}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=idx(x,y);const t=S.g[i];S.sol[i]=(t==='o'||t==='sk')?1:0}
  // sea stacks and rocks in the wreck grounds (block boats)
  const stack=(x,y,v)=>{const i=idx(x,y);if(S.g[i]!=='o')return;S.g[i]='sk';S.nav[i]=0;S.sol[i]=1;const im=artSeaStack(v);addProp(S,im,x*16+8-im.width/2,y*16+16-im.height+3,{sy:y*16+14})};
  for(const[x,y,v]of[[110,22,1],[115,38,0],[120,50,1],[109,64,0],[127,18,0],[126,44,1],[112,80,0],[131,70,0],[104,92,1],[101,98,0],[79,47,0],[96,62,0]])stack(x,y,v);
  for(const I of COAST.islands)if(I.rock)stack(Math.round(I.x),Math.round(I.y),1);
  // buildings (doors face south onto the streets)
  const SP={};const B=(k,tx,ty,args)=>{SP[k]=placeBuilding(S,tx,ty,...(args||GBLD[k]));return SP[k]};
  COOPS.forEach((C,i)=>{SP['hall_'+C.id]=placeBuilding(S,[5,11,17,34,40][i],27,...coopHallArgs(C))});
  B('boatyard',38,35);B('market',38,42);B('exchange',24,50);B('tavern',16,50);B('aquarium',22,62);B('tackle',40,68);B('harbourmaster',34,68);B('home',22,80);
  const hs=[[24,27],[6,50],[10,62],[30,62],[8,80],[14,80],[28,80],[34,80],[16,40],[8,40],[22,40],[36,18],[22,16],[14,18],[16,94],[26,94],[8,94]];
  hs.forEach(([x,y],i)=>{const[wall,roof]=HOUSES[i%HOUSES.length];let ok=true;for(let yy=y-2;yy<=y+2;yy++)for(let xx=x;xx<x+4;xx++)if(S.res[idx(xx,yy)]||S.g[idx(xx,yy)]!=='g')ok=false;if(!ok)return;
    const h=placeBuilding(S,x,y,4,2,2,{wall,mat:i%2?'planks':'siding',roof,door:1+(i%2),win:[i%2?0:3],flowers:i%3===0,chimney:i%2===0,doorC:['#e8604a','#3f86bd','#5aa070','#f0c040'][i%4],curtain:i%3===1?'#f08bbf':null});(S.houses=S.houses||[]).push(h.door)});
  // the lighthouse on the headland
  {const lh=[artLighthouse(0),artLighthouse(1)];const lx=60,ly=37;addProp(S,lh[0],lx*16+8-18,(ly+1)*16-104+6,{sy:(ly+1)*16,anim:()=>lh[AMB&&AMB.dark>.35?1:0]});solidRect(S,lx-1,ly-1,lx+1,ly);S.lighthouse={x:lx*16+8,y:(ly-5)*16};SP.lighthouse={door:{x:lx*16+8,y:(ly+1)*16+6}}}
  // the square: the Founding Fisher machine, the tide board and the notice board
  {const mach=mk(64,112);addProp(S,mach[0],39*16,55*16-112,{sy:55*16-1,anim:t=>{mach[1].clearRect(0,0,64,112);drawMachine(mach[1],0,0,t,typeof machineIdleState==='function'?machineIdleState(t):{});return mach[0]}});solidRect(S,39,53,42,54);S.spots.machine={x:41*16,y:55*16+8}}
  addProp(S,artTideBoard(),35*16,52*16-14,{sy:52*16+12});S.sol[idx(35,52)]=1;S.spots.tide={x:35*16+13,y:53*16+4};
  addProp(S,artNoticeBoard(),44*16-6,52*16-12,{sy:52*16+12});S.sol[idx(44,52)]=1;S.spots.notice={x:44*16+8,y:53*16+4};
  // harbour furniture
  addProp(S,artFuelPump(),54*16+1,58*16-8,{sy:58*16+12});S.sol[idx(54,58)]=1;S.spots.fuel={x:54*16+8,y:59*16+4};
  addProp(S,artStall('#3f86bd','bait'),49*16,47*16-10,{sy:48*16+12});solidRect(S,49,47,51,47);S.spots.bait={x:50*16+8,y:48*16+10};
  addProp(S,artNetRack(),50*16,70*16-12,{sy:70*16+12});solidRect(S,50,69,51,69);
  for(const[x,y]of[[52,46],[52,53],[52,60],[52,72],[52,82]]){addProp(S,artLifebuoy(),x*16+1,y*16-12,{sy:y*16+12});S.sol[idx(x,y)]=1}
  for(const[x,y,k]of[[53,48,0],[53,65,1],[53,77,2]]){addProp(S,artFishCrate(k),x*16-1,y*16+2,{sy:y*16+14});S.sol[idx(x,y)]=1}
  for(const[x,y]of[[53,55],[53,70]]){addProp(S,artBarrelC(),x*16+1,y*16-4,{sy:y*16+14});S.sol[idx(x,y)]=1}
  addProp(S,artAnchorDecor(),43*16-2,63*16-10,{sy:63*16+12});S.sol[idx(43,63)]=1;
  for(const[x,y]of[[34,50],[45,50],[34,64],[45,64],[47,44],[47,60],[47,72],[31,44],[31,66],[13,40],[13,64],[13,82],[52,50],[52,62],[52,74]]){if(S.sol[idx(x,y)])continue;const lamp=artLamp();addProp(S,lamp,x*16+2,y*16+14-33);S.sol[idx(x,y)]=1;S.lights.push({x:x*16+8,y:y*16-12,r:40,c:'rgba(255,200,120,'})}
  // berths along the jetties (player and co-op boats tie up here)
  S.berths=[];for(const[y,x0,x1]of[[52,57,66],[61,57,68],[64,57,68],[73,57,66],[49,57,66],[76,57,66]])for(let x=x0;x<=x1;x+=3)if(S.g[idx(x,y)]==='o')S.berths.push({tx:x,ty:y,x:x*16+8,y:y*16+8,dir:y===49||y===61||y===73?'n':'s'});
  // the beach: umbrellas, towels, flags, a sandcastle, crabs; the estuary: mangroves and reeds; palms around the bay
  const sandSpots=[];for(let y=96;y<H;y++)for(let x=36;x<104;x++)if(S.g[idx(x,y)]==='sa'&&landF(x+.5,y+.5)>1.8)sandSpots.push([x,y]);
  const rnd=rng(4242);const pickSand=()=>sandSpots.length?sandSpots[Math.floor(rnd()*sandSpots.length)]:null;
  for(let i=0;i<7;i++){const p=pickSand();if(!p)break;const[x,y]=p;if(S.sol[idx(x,y)])continue;const col=['#e8604a','#3f86bd','#f0c040','#5aa070'][i%4];addProp(S,artUmbrella(col),x*16-8,y*16-26,{sy:y*16+14});S.sol[idx(x,y)]=1;if(i%2===0)addProp(S,artTowel(col),x*16+10,y*16-2,{flat:1,sy:y*16})}
  for(let i=0;i<3;i++){const p=pickSand();if(p&&!S.sol[idx(p[0],p[1])]){addProp(S,artDeckChair(['#3f86bd','#e8604a','#5aa070'][i]),p[0]*16+1,p[1]*16-2,{sy:p[1]*16+14});S.sol[idx(p[0],p[1])]=1}}
  {const p=pickSand();if(p){addProp(S,artSandcastle(),p[0]*16-1,p[1]*16,{sy:p[1]*16+14});S.sol[idx(p[0],p[1])]=1}}
  const rf=[0,1,2,3].map(artRescueFlag);for(const[x,y]of[[58,100],[78,104]]){if(S.g[idx(x,y)]!=='sa')continue;addProp(S,rf[0],x*16+2,y*16-8,{sy:y*16+12,anim:t=>rf[Math.floor(t*4)%4]});S.sol[idx(x,y)]=1}
  for(let i=0;i<40;i++){const x=Math.floor(rnd()*64),y=Math.floor(rnd()*34);const i2=idx(x,y);if(S.g[i2]!=='mud'||S.sol[i2])continue;const im=artMangrove(i%3);addProp(S,im,x*16+8-17,y*16+16-34,{sy:y*16+14,sway:1});S.sol[i2]=1}
  for(let i=0;i<50;i++){const x=Math.floor(rnd()*64),y=Math.floor(rnd()*34);const i2=idx(x,y);if(S.g[i2]!=='mud'&&S.g[i2]!=='g'||S.sol[i2]||S.res[i2]&&S.g[i2]==='g')continue;if(landF(x+.5,y+.5)>4)continue;addProp(S,artReedsC(),x*16,y*16-2,{sy:y*16+14});}
  for(const[x,y,v]of[[36,94,0],[46,94,1],[52,92,0],[56,96,1],[90,51,0],[64,104,1],[84,106,0],[96,104,1],[8,60,0],[28,46,1]]){const i2=idx(x,y);if(S.sol[i2]||S.g[i2]==='o'||S.g[i2]==='pr')continue;const im=artPalmC(v);addProp(S,im,x*16+8-18,y*16+16-48,{sy:y*16+14,sway:1});S.sol[i2]=1}
  // trees in the hills and the southern bush
  const tr=rng(77);for(let i=0;i<260;i++){const x=Math.floor(tr()*W),y=Math.floor(tr()*H);const i2=idx(x,y);if(S.g[i2]!=='g'||S.res[i2]||S.sol[i2])continue;const L=landF(x+.5,y+.5);if(L<3)continue;
    const wild=y<11||(y>96&&x<40)||(x<8);if(!wild&&tr()<.85)continue;treeAt(S,x,y,wild?(tr()<.5?3:tr()<.5?0:2):(tr()<.5?1:4))}
  for(let i=0;i<60;i++){const x=Math.floor(tr()*60),y=Math.floor(tr()*H);const i2=idx(x,y);if(S.g[i2]!=='g'||S.res[i2]||S.sol[i2])continue;addProp(S,artBush(['#ff7a6b','#fbf1dc','#f08bbf',null][i%4]),x*16-2,y*16,{sy:y*16+14});S.sol[i2]=1}
  // fixed salvage sites (bubbles over wrecks, a lockbox in the mangroves, a coffer and an altar further out)
  S.salvage=[{tx:114,ty:30,zone:'wreck'},{tx:118,ty:56,zone:'wreck'},{tx:111,ty:72,zone:'wreck'},{tx:124,ty:24,zone:'wreck'},{tx:72,ty:20,zone:'estuary'},{tx:138,ty:46,zone:'blue'},{tx:152,ty:60,zone:'deep'},{tx:150,ty:28,zone:'deep'}];
  for(const s of S.salvage){s.x=s.tx*16+8;s.y=s.ty*16+8;if(S.g[idx(s.tx,s.ty)]!=='o'){s.dead=1;continue}const v=s.tx%2;const im=artWreckMast(v);if(s.zone==='wreck')addProp(S,im,s.x-15+20,s.y-34+6,{sy:s.y+6})}
  // beach and rock-pool combing ground
  S.combTiles={beach:[],rocks:[]};for(let y=0;y<H;y++)for(let x=0;x<W;x++){const t=S.g[idx(x,y)];if(S.sol[idx(x,y)])continue;const L=landF(x+.5,y+.5);if(t==='sa'&&L<2.2&&y>84)S.combTiles.beach.push([x,y]);if(t==='rk')S.combTiles.rocks.push([x,y])}
  paintWorldGround(S);
  // where things are
  const d=k=>SP[k].door;S.spots.spawn={x:50*16+8,y:56*16+8};S.spots.home=d('home');S.spots.market=d('market');S.spots.tackle=d('tackle');S.spots.boatyard=d('boatyard');S.spots.exchange=d('exchange');S.spots.aquarium=d('aquarium');S.spots.tavern=d('tavern');S.spots.harbourmaster=d('harbourmaster');S.spots.lighthouse=d('lighthouse');
  for(const C of COOPS)S.spots['hall_'+C.id]=SP['hall_'+C.id].door;S.SP=SP;
  return S}
