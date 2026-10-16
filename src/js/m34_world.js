/* ================= the world: a small fishing town on a big sea =================
   120x90 tiles painted with the Gullhaven tile painters. The town sits in the north-west corner; the rest is open
   water with five islands. Walk the town and islands as your cat, sail your boat between them (bigger boats reach
   rougher water), beach it on an island and explore: dig X marks with a shovel, pick shells off the beaches,
   grapple wrecks for salvage. Catoshi sits on his golden chair in the square; his basket takes everything you bring. */
let MODE='world',SPOT=null,WLD=null;
const MW=120,MH=90,TW=40,TH=30;
const ISLANDS=[
  {k:'gull',n:'Gull Isle',x:60,y:13,r:4.6,kind:'sand',zone:'shallows'},
  {k:'kelpkey',n:'Kelp Key',x:24,y:50,r:3.8,kind:'sand',zone:'kelp'},
  {k:'wreckrock',n:'Wreck Rock',x:78,y:44,r:3.2,kind:'rock',zone:'wreck'},
  {k:'turtle',n:'Turtle Atoll',x:95,y:71,r:6.8,kind:'sand',zone:'blue'},
  {k:'stack',n:'Lone Stack',x:111,y:20,r:2.4,kind:'rock',zone:'deep'}];
const ZNEED={harbour:0,shallows:0,reef:0,kelp:0,estuary:0,wreck:1,blue:2,deep:3};
const SEAZONES=['harbour','shallows','reef','kelp','wreck','blue','deep'];
const SPOTDEF=[
  {k:'pier',n:'The Pier',zone:'harbour',ground:'pier',contest:1},
  {k:'beach',n:'The Beach',zone:'shallows',ground:'sand'},
  {k:'rocks',n:'Lighthouse Rocks',zone:'reef',ground:'rock'},
  ...ISLANDS.map(I=>({k:'isle_'+I.k,n:I.n,zone:I.zone,ground:I.kind==='rock'?'rock':'sand'})),
  ...SEAZONES.map(z=>({k:'sea_'+z,n:ZONES[z].n,zone:z,ground:'boat'}))];
const SPOTI=Object.fromEntries(SPOTDEF.map(s=>[s.k,s]));
const ZPOOL={};for(const z of ZONE_ORDER){ZPOOL[z]=[[],[],[],[],[]];for(const e of CAT){if(e.z!==z)continue;if(e.cat==='fish')ZPOOL[z][e.r].push(e);else if(e.cat==='legend')ZPOOL[z][4].push(e)}}
const FINDS={};for(const e of CAT){if(e.cat==='fish'||e.cat==='legend')continue;(FINDS[e.cat]=FINDS[e.cat]||[]).push(e)}
const WP={x:0,y:0,dir:0,fr:0,ft:0,path:[],pend:null,mark:null,boat:false,hd:0};
const NPCS=[];let worldCam={x:0,y:0};
const RUMOURS=['"The White Whale only shows itself to patient cats."','"Squid strips. Big fish. Trust me." - a gull','"Tap Catoshi\'s token three times, quick. Then look up."','"Every fishing ground has its own legend."','"Turtle Atoll hides two treasures a day. Bring a shovel."','"Birds diving at sea? Fish are schooling under them."','"Wreck Rock\'s masts still hold cargo. You\'ll want a grapple."','"A bigger boat means rougher water. Rougher water means stranger fish."'];
const NEIGHBOURS=[{n:'Old Nell',coat:'grey',lines:['"I fished these waters for forty years. Catoshi still won\'t share his chair."','"The Beach is kind to beginners."']},{n:'Barnaby',coat:'tabby',lines:['"I lost my good rod at Wreck Rock. If you find it, it\'s yours."','"Line strength matters more than you think."']},{n:'Miso',coat:'cream',lines:['"Have you been out to Turtle Atoll? The sand there sparkles."','"Let go when they run! Everyone forgets."']}];

/* ---------------- the land field: the town, then the islands ---------------- */
function townL(x,y){let a;if(x<20)a=21.6+Math.sin(x*.45)*.5+Math.sin(x*.17)*.4-y;else if(x<33.5)a=21-y;else a=25.2+Math.sin(y*.9)*.3-y;return Math.min(a,39.6-x+Math.sin(y*.7)*.3)}
const townKind=(x,y)=>x>=33?'rock':x>=20?'wall':'sand';
function islandAt(x,y){let best=null,bd=1e9;for(const I of ISLANDS){const d=Math.hypot(x-I.x,(y-I.y)*1.15)-I.r;if(d<bd){bd=d;best=I}}return best}
function worldL(x,y){let L=townL(x,y);for(const I of ISLANDS){const d=Math.hypot(x-I.x,(y-I.y)*1.15);const n=(NZ.at(x*9+I.x,y*9)-.5)*(I.kind==='rock'?.5:1.1)+Math.sin(Math.atan2(y-I.y,x-I.x)*3+I.x)*.5;L=Math.max(L,I.r-d+n)}return L}
const inTown=(x,y)=>x<41&&y<31;
const worldKind=(x,y)=>inTown(x,y)?townKind(x,y):islandAt(x,y).kind==='rock'?'rock':'sand';
const worldSandW=(x,y)=>inTown(x,y)?(x>=33?2.4:x>=20?0:3.2):islandAt(x,y).kind==='rock'?1.6:2;
function zoneAt(x,y){const n=(NZ.at(x*1.7,y*1.7)-.5)*6;if(x<44+n&&y<34+n)return'harbour';
  for(const I of ISLANDS)if(Math.hypot(x-I.x,y-I.y)<I.r+7+n*.5)return I.zone;
  const d=Math.hypot(x-18,(y-10)*1.15)+n*1.5+Math.sin(Math.atan2(y-10,x-18)*5)*3;if(d>98)return'deep';if(d>72)return'blue';return'reef'}
function paintWorld(S){const W=S.w,H=S.h;const B=mkBuf(W*16,H*16),foam=mkBuf(W*16,H*16);
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){const t=S.g[ty*W+tx];if(t==='o'||t==='pr'||t==='sa'||t==='rk')continue;drawTile(B,S,t,tx,ty)}
  grassEdges(B,S);
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){const t=S.g[ty*W+tx];if(!(t==='o'||t==='pr'||t==='sa'||t==='rk'||t==='g'))continue;
    const far=false;
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wx=tx*16+i,wy=ty*16+j,x=wx/16,y=wy/16;
      if(far){const z=zoneAt(x+(hash2(wx,wy,5)-.5)*1.4,y+(hash2(wx,wy,6)-.5)*1.4);B.set(wx,wy,seaPx(wx,wy,x,y,-4,z));continue}
      const L=worldL(x,y),kind=worldKind(x,y),sw=worldSandW(x,y);const isG=t==='g';if(L>=0&&isG&&L>sw+.5)continue;let col;
      if(L<0){const z=zoneAt(x+(hash2(wx,wy,5)-.5)*1.4,y+(hash2(wx,wy,6)-.5)*1.4);col=seaPx(wx,wy,x,y,L,z);const e=-L*16;
        if(kind!=='wall'){if(e<1.6)col=hash2(wx,wy,77)<.7?'#f4fbfb':'#d8f2f4';else if(e<3.5)col=mix(col,'#ffffff',.3);if(e>=1.6&&e<5&&hash2(wx,wy,78)<.5)foam.set(wx,wy,'#ffffff')}else if(e<3)col=mix(col,'#123a5a',.35)}
      else{const e=L*16;
        if(e>=sw*16){if(!isG)continue;const GP=grassPal(wx,wy);const ge=e-sw*16;col=ge<1?GP.lip:ge<2?GP.dk:grassAt(wx,wy)}
        else if(kind==='rock'){const v=NZ.at(wx*1.5,wy*1.5)*.6+hash2(wx>>1,wy>>1,5)*.4;col=e<1.5?'#3e3a4c':v>.66?'#b8b4c4':v>.45?'#9a96aa':v>.25?'#827e94':'#6a6680'}
        else{const rip=Math.sin(wx*.35+Math.sin(wy*.5)*1.5+wy*.9);col=e<4?'#c8ac78':e<9?'#d8bc88':rip>.86?'#f8ebc4':rip<-.92?'#dcc48e':'#eedcaa';if(e>=4&&hash2(wx,wy,467)<.012)col='#fff8ea';if(e>=4&&hash2(wx,wy,468)<.004)col='#f2a6a0';if(e>(sw-.3)*16)col=grassPal(wx,wy).lip}}
      B.set(wx,wy,col)}}
  for(let tx=20;tx<34;tx++)for(let j=0;j<6;j++)for(let i=0;i<16;i++){const wx=tx*16+i,wy=21*16-6+j;const st=PAL.stone;const bx=(wx+(j>2?4:0))%8;B.set(wx,wy,j===5?'#3e3a52':j===2||bx===7?st[2]:j===0?st[5]:st[4])}
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++)if(S.g[ty*W+tx]==='pr')pierTile(B,S,tx,ty);
  B.flush();foam.flush();S.ground=B.c;S.foam=foam.c}

/* ---------------- building the world ---------------- */
function townInit(){zoneOfXY=zoneAt;// the shared sea painter samples zones through this
  const S=newScene('world',MW,MH);const W=MW,idx=(x,y)=>y*W+x;S.zone=new Uint8Array(W*MH).fill(255);S.far=new Uint8Array(W*MH);S.reef=new Uint8Array(W*MH);
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<W;tx++){const x=tx+.5,y=ty+.5,L=worldL(x,y),i=idx(tx,ty);
    if(L<0){S.g[i]='o';S.sol[i]=1;S.zone[i]=ZONE_ORDER.indexOf(zoneAt(x,y));if(L<-2.2&&worldL(tx,ty)<-1.8&&worldL(tx+1,ty+1)<-1.8&&worldL(tx+1,ty)<-1.8&&worldL(tx,ty+1)<-1.8)S.far[i]=1}
    else if(L<worldSandW(x,y))S.g[i]=worldKind(x,y)==='rock'?'rk':'sa'}
  const set=(t,x0,y0,x1,y1)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=idx(x,y);S.g[i]=t;S.sol[i]=0;S.res[i]=1;S.far[i]=0}};
  // streets, the square, the quay, the pier and the dock
  set('w',3,17,32,18);set('w',18,15,19,19);set('w',6,3,6,16);set('w',30,4,30,16);set('w',9,8,12,8);set('w',24,8,28,8);
  set('p',12,7,24,15);set('k',20,19,33,20);set('w',3,19,19,19);
  set('pr',25,21,26,27);set('pr',22,27,29,28);set('pr',31,21,31,23);
  // buildings; every door gets a path to a street
  const doors={},bl=[];const B=(k,tx,ty,args)=>{const b=placeBuilding(S,tx,ty,...(args||GBLD[k]));doors[k]=b.door;bl.push(b);return b};
  B('tackle',7,13);B('boatyard',23,13,[7,3,3,Object.assign({},GBLD.boatyard[3],{label:'BOATYARD'})]);B('aquarium',7,4);B('tavern',25,4);
  B('harbourmaster',1,13,[5,3,3,Object.assign({},GBLD.harbourmaster[3],{label:'LICENCES'})]);
  const houseDoors=[];for(const[x,y,i]of[[1,8,0],[33,8,1],[33,13,2],[14,2,3]]){const[wall,roof]=HOUSES[i%HOUSES.length];const b=placeBuilding(S,x,y,4,2,2,{wall,mat:i%2?'planks':'siding',roof,door:1+(i%2),win:[i%2?0:3],flowers:i%2===0,chimney:i%2===1,doorC:['#e8604a','#3f86bd','#5aa070','#f0c040'][i]});bl.push(b);houseDoors.push(b.door)}
  const street=t=>t==='w'||t==='p'||t==='k';
  for(const b of bl){const dx=Math.floor(b.door.x/16),dy=Math.floor(b.door.y/16);if(street(S.g[idx(dx,dy)]))continue;
    const prev=new Map(),q=[[dx,dy]];prev.set(dx+','+dy,null);let end=null;
    while(q.length){const[x,y]=q.shift();if(street(S.g[idx(x,y)])){end=[x,y];break}for(const[ax,ay]of[[0,1],[1,0],[-1,0],[0,-1]]){const nx=x+ax,ny=y+ay,k=nx+','+ny;if(nx<0||ny<0||nx>=TW||ny>=TH||prev.has(k))continue;const i=idx(nx,ny);if(S.sol[i]||S.g[i]==='o')continue;prev.set(k,[x,y]);q.push([nx,ny])}}
    for(let c=end;c;c=prev.get(c[0]+','+c[1])){const i=idx(c[0],c[1]);if(!street(S.g[i])){S.g[i]='w';S.res[i]=1}}}
  // Catoshi's chair in the middle of the square, his basket beneath it
  const th=throneArt();const cx=18.5*16,cy=12*16;const throne={x:cx-th.width/2,y:cy-th.height+10,cx,cy};
  for(let y=9;y<=11;y++)for(let x=16;x<=20;x++)S.sol[idx(x,y)]=1;
  {const lh=artLighthouse(0);addProp(S,lh,36*16+8-18,23*16-104+6,{sy:23*16});for(let y=21;y<=22;y++)for(let x=35;x<=37;x++)S.sol[idx(x,y)]=1}
  for(const[x,y]of[[21,19],[29,19],[33,19]]){addProp(S,artLifebuoy(),x*16+1,y*16-12,{sy:y*16+12});S.sol[idx(x,y)]=1}
  for(const[x,y,k]of[[23,20,0],[28,20,1]]){addProp(S,artFishCrate(k),x*16-1,y*16+2,{sy:y*16+14});S.sol[idx(x,y)]=1}
  addProp(S,artBarrelC(),32*16+1,20*16-4,{sy:20*16+14});S.sol[idx(32,20)]=1;addProp(S,artRope(),27*16,20*16+2,{flat:1,sy:20*16});addProp(S,artAnchorDecor(),21*16,16*16-10,{sy:16*16+12});S.sol[idx(21,16)]=1;
  addProp(S,artNetRack(),20*16,17*16-12,{sy:17*16+12});
  addProp(S,artStall('#c8443a','bait'),14*16,19*16-10,{sy:20*16+12});S.sol[idx(14,19)]=1;S.sol[idx(15,19)]=1;S.sol[idx(16,19)]=1;
  addProp(S,artNoticeBoard(),23*16-6,9*16-12,{sy:9*16+12});S.sol[idx(23,9)]=1;
  for(const[x,y]of[[12,7],[24,7],[12,15],[24,15],[6,17],[30,17],[3,19],[18,6]]){if(S.sol[idx(x,y)])continue;addProp(S,artLamp(),x*16+2,y*16+14-33);S.sol[idx(x,y)]=1}
  for(const[x,y,c]of[[4,22,'#e8604a'],[12,22,'#3f86bd']]){if(S.g[idx(x,y)]!=='sa')continue;addProp(S,artUmbrella(c),x*16-8,y*16-26,{sy:y*16+14});addProp(S,artTowel(c),x*16+10,y*16-2,{flat:1,sy:y*16});S.sol[idx(x,y)]=1}
  if(S.g[idx(8,22)]==='sa'){addProp(S,artSandcastle(),8*16-1,22*16,{sy:22*16+14});S.sol[idx(8,22)]=1}
  for(const[x,y]of[[16,22],[2,23]])if(S.g[idx(x,y)]==='sa'){addProp(S,artDeckChair('#5aa070'),x*16+1,y*16-2,{sy:y*16+14});S.sol[idx(x,y)]=1}
  for(const[x,y,v]of[[2,21,0],[17,21,1]]){const i2=idx(x,y);if(S.g[i2]==='o'||S.sol[i2])continue;const im=artPalmC(v);addProp(S,im,x*16+8-18,y*16+16-48,{sy:y*16+14,sway:1});S.sol[i2]=1}
  const tr=rng(71);for(let i=0;i<160;i++){const x=Math.floor(tr()*TW),y=Math.floor(tr()*17);const i2=idx(x,y);if(S.g[i2]!=='g'||S.res[i2]||S.sol[i2])continue;if(!(y<2||x<1||x>37||(y===16&&tr()<.3)))continue;treeAt(S,x,y,tr()<.5?1:4)}
  for(let i=0;i<40;i++){const x=Math.floor(tr()*TW),y=2+Math.floor(tr()*15);const i2=idx(x,y);if(S.g[i2]!=='g'||S.res[i2]||S.sol[i2])continue;addProp(S,artBush(['#ff7a6b','#fbf1dc','#f08bbf','#ffd24d',null][i%5]),x*16-2,y*16,{sy:y*16+14});S.sol[i2]=1}
  // the islands: palms, rocks, birds, crabs; sea stacks, kelp and wrecks offshore
  const ir=rng(909);const islandTiles=I=>{const out=[];for(let y=Math.floor(I.y-I.r-3);y<I.y+I.r+3;y++)for(let x=Math.floor(I.x-I.r-3);x<I.x+I.r+3;x++){if(x<0||y<0||x>=MW||y>=MH)continue;const t=S.g[idx(x,y)];if(t!=='o')out.push([x,y,t])}return out};
  for(const I of ISLANDS){I.tiles=islandTiles(I);const land=I.tiles.filter(([x,y])=>!S.sol[idx(x,y)]);
    const put=(fn,n,want)=>{for(let k=0;k<n*6&&n>0;k++){const c=land[Math.floor(ir()*land.length)];if(!c)return;const[x,y,t]=c;const i2=idx(x,y);if(S.sol[i2]||(want&&!want.includes(t)))continue;fn(x,y);S.sol[i2]=1;n--}};
    if(I.kind==='sand'){put((x,y)=>{const im=artPalmC(ir()<.5?0:1);addProp(S,im,x*16+8-18,y*16+16-48,{sy:y*16+14,sway:1})},Math.round(I.r*1.2),['g','sa']);
      put((x,y)=>addProp(S,artBush(ir()<.5?'#ff7a6b':null),x*16-2,y*16,{sy:y*16+14}),Math.round(I.r*.8),['g']);
      put((x,y)=>addProp(S,artStarfishRock(),x*16,y*16+4,{sy:y*16+14}),2,['sa']);put((x,y)=>addProp(S,artCrabBeach(0),x*16+3,y*16+6,{sy:y*16+14,crab:1}),1,['sa'])}
    else{put((x,y)=>addProp(S,artGullPerch(0),x*16+2,y*16-4,{sy:y*16+14}),2,null);put((x,y)=>addProp(S,artPelican(),x*16,y*16-14,{sy:y*16+14}),1,null)}
    if(I.k==='turtle'){put((x,y)=>{const im=artStall('#3f86bd','tackle');addProp(S,im,x*16,y*16-10,{sy:y*16+12});I.hut={x:x*16+20,y:y*16+22}},1,['g'])}}
  const seaProp=(x,y,im,o)=>{const i2=idx(x,y);if(S.g[i2]!=='o')return false;addProp(S,im,x*16+8-im.width/2,y*16+16-im.height+3,Object.assign({sy:y*16+14},o||{}));S.sol[i2]=1;S.reef[i2]=1;S.far[i2]=0;return true};
  for(const[x,y,v]of[[82,38,1],[73,49,0],[106,26,1],[114,14,0],[108,40,0],[88,60,1],[52,30,0],[66,70,1]])seaProp(x,y,artSeaStack(v));
  const salvage=[];for(const[x,y]of[[83,46],[74,41],[80,51]]){const i2=idx(x,y);if(S.g[i2]!=="o")continue;const im=artWreckMast(salvage.length%2);addProp(S,im,x*16+8-im.width/2,y*16+16-im.height+3,{sy:y*16+14});salvage.push({x:x*16+8,y:y*16+22,k:'salv'+salvage.length})}
  const kelp=[];for(let k=0;k<26;k++){const a=ir()*Math.PI*2,d=4.6+ir()*4;const x=Math.round(24+Math.cos(a)*d),y=Math.round(50+Math.sin(a)*d*.9);if(S.g[idx(x,y)]==='o')kelp.push({x:x*16+8,y:y*16+8,f:ir()*4})}
  for(const[x,y,c]of[[42,24,'#e84a3a'],[42,30,'#ffd24d'],[48,22,'#e84a3a']]){const i2=idx(x,y);if(S.g[i2]==='o')addProp(S,artBuoy(c,0),x*16+2,y*16-6,{sy:y*16+12,buoy:c})}
  paintWorld(S);
  const walk=(x,y)=>x>=0&&y>=0&&x<MW&&y<MH&&!S.sol[idx(x,y)];
  const sailT=(x,y)=>x>=0&&y>=0&&x<MW&&y<MH&&S.g[idx(x,y)]==='o'&&!S.reef[idx(x,y)];
  const spot=(k,tx,ty)=>{let p=walk(tx,ty)?[tx,ty]:nearWalkS(S,walk,tx,ty);const s=Object.assign({},SPOTI[k],{tx:p[0],ty:p[1],x:p[0]*16+8,y:p[1]*16+12});let w=null;for(let r=1;r<4&&!w;r++)for(const[a,b]of[[0,r],[r,0],[-r,0],[0,-r],[r,r],[-r,r]])if(S.g[idx(p[0]+a,p[1]+b)]==='o'){w=[p[0]+a,p[1]+b];break}s.wx=(w?w[0]:p[0])*16+8;s.wy=(w?w[1]:p[1]+1)*16+8;return s};
  const spots=[spot('pier',26,28),spot('beach',10,23),spot('rocks',38,25)];
  for(const I of ISLANDS){const shore=I.tiles.filter(([x,y,t])=>(t==='sa'||t==='rk')&&walk(x,y)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>S.g[idx(x+a,y+b)]==='o'));const c=shore.sort((a,b)=>(a[1]-b[1])*3+(a[0]-b[0]))[Math.floor(shore.length*.7)]||[Math.round(I.x),Math.round(I.y)];spots.push(spot('isle_'+I.k,c[0],c[1]))}
  const dock={x:32*16+6,y:22*16+8};
  const inter=[];
  for(const s of spots)inter.push({x:s.x,y:s.y,r:22,label:s.contest?'FISH: THE PIER':'FISH HERE',name:s.n,fn:()=>enterSpot(s),spot:s});
  inter.push({x:cx,y:cy+28,r:24,label:'DROP CATCH',name:'Catoshi\'s basket',fn:depositFish,basket:1});
  inter.push({x:doors.tackle.x,y:doors.tackle.y,r:18,label:'TACKLE SHOP',name:'Tackle',fn:openShop},{x:doors.boatyard.x,y:doors.boatyard.y,r:18,label:'BOATYARD',name:'Boatyard',fn:openBoatyard},
    {x:doors.aquarium.x,y:doors.aquarium.y,r:18,label:'FISH LOG',name:'Aquarium',fn:openLog},{x:doors.tavern.x,y:doors.tavern.y,r:18,label:'RUMOURS',name:'Salty Gull',fn:()=>{sfx('quack');toast(pickOne(RUMOURS))}},
    {x:doors.harbourmaster.x,y:doors.harbourmaster.y,r:18,label:'LICENCE',name:'Harbourmaster',fn:openLicence},
    {x:23*16,y:10*16+6,r:18,label:'BOARD',name:'Catoshi\'s board',fn:openBoard},{x:15*16,y:20*16+12,r:18,label:'BAIT',name:'Bait stall',fn:openShop});
  inter.push({x:houseDoors[0].x,y:houseDoors[0].y,r:18,label:'HOME',name:'Your home',fn:()=>openPick(false)});
  houseDoors.slice(1).forEach((d,i)=>{const N=NEIGHBOURS[i%NEIGHBOURS.length];inter.push({x:d.x,y:d.y,r:18,label:'KNOCK',name:N.n+'\'s house',fn:()=>knock(N)})});
  const tu=ISLANDS.find(I=>I.k==='turtle');if(tu.hut)inter.push({x:tu.hut.x,y:tu.hut.y,r:20,label:'TRADER',name:'Atoll trader',fn:openShop});
  for(const v of salvage)inter.push({x:v.x,y:v.y,r:26,label:'SALVAGE',name:'Wreck',fn:()=>salvage_(v),sea:1,salv:v});
  WLD={S,spots,inter,throne,dock,walk,sail:sailT,kelp,salvage,schools:[],birds:[],idx};
  for(let i=0;i<5;i++)WLD.schools.push(newSchool());
  dailyFinds();
  const st=S.pos&&(S.pos.boat?sailT(Math.floor(S.pos.x/16),Math.floor(S.pos.y/16)):walk(Math.floor(S.pos.x/16),Math.floor(S.pos.y/16)))?S.pos:{x:18.5*16,y:16*16+10};WP.x=st.x;WP.y=st.y;WP.boat=!!(st.boat&&S.boat);WP.dir=3;
  if(!S.boatAt||!sailT(Math.floor(S.boatAt.x/16),Math.floor(S.boatAt.y/16)))S.boatAt={x:dock.x,y:dock.y};
  spawnNpcs()}
function nearWalkS(S,walk,tx,ty){for(let r=0;r<8;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;if(walk(tx+dx,ty+dy))return[tx+dx,ty+dy]}return null}
const nearWalk=(tx,ty)=>nearWalkS(WLD.S,WLD.walk,tx,ty);
function spawnNpcs(){NPCS.length=0;if(!WLD)return;WLD.inter=WLD.inter.filter(i=>!i.npc);const spots=[[24,17],[29,17]];const say=['"Send me out to sea! I\'ll bring back a cheque."','"The Trip Fund is looking healthy today."','"I know a spot past Kelp Key. Just say the word."'];
  homeCrew().slice(0,2).forEach((k,i)=>{const p=nearWalk(spots[i][0],spots[i][1]);if(!p)return;const n={coat:k,x:p[0]*16+8,y:p[1]*16+10,dir:0,fr:0,ft:0,path:[],wait:1e9,hub:spots[i],line:say[i]};NPCS.push(n);
    WLD.inter.push({x:n.x,y:n.y,r:18,label:'CREW TRIP',name:COATI[k].name,fn:()=>{toast(COATI[k].name+': '+pickOne(say));chooseTrip(k)},npc:1})})}
function newSchool(){for(let k=0;k<40;k++){const x=6+Math.random()*(MW-12),y=6+Math.random()*(MH-12);if(WLD.sail(Math.floor(x),Math.floor(y))&&!(x<44&&y<34))return{x:x*16,y:y*16,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,life:60+Math.random()*90}}return{x:60*16,y:40*16,vx:2,vy:1,life:60}}

/* ---------------- daily finds: X marks to dig, shells on the beaches ---------------- */
function dailyFinds(){const r=rng(parseInt(S.day.replace(/-/g,''),10));const S2=WLD.S;WLD.digs=[];WLD.shells=[];
  for(const I of ISLANDS){if(I.kind!=='sand')continue;const land=I.tiles.filter(([x,y,t])=>WLD.walk(x,y)&&(t==='g'||t==='sa'));const n=I.k==='turtle'?2:1;for(let k=0;k<n;k++){const c=land[Math.floor(r()*land.length)];if(c)WLD.digs.push({x:c[0]*16+8,y:c[1]*16+10,k:I.k+k})}}
  const beaches=[];for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const i=y*MW+x;if(S2.g[i]==='sa'&&!S2.sol[i]&&[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>S2.g[(y+b)*MW+x+a]==='o'))beaches.push([x,y])}
  for(let k=0;k<9&&beaches.length;k++){const c=beaches.splice(Math.floor(r()*beaches.length),1)[0];WLD.shells.push({x:c[0]*16+4+r()*8,y:c[1]*16+6+r()*6,k:'s'+k})}
  S.found=S.found&&S.found.day===S.day?S.found:{day:S.day,keys:[]}}
const foundToday=k=>S.found.keys.includes(k);
function addFind(e,how){const pts=Math.max(1,Math.round(POINTS[e.r]*(e.cat==='treasure'?2:1)));S.bag.push({id:e.id,cm:0,kg:0,pay:0,pts,r:e.r,find:1});S.seen[e.id]=Math.max(S.seen[e.id]||0,1);dirty();refreshHud();
  sfx(e.r>=3?'jackpot':'coin');const C=$('card');C.innerHTML='';C.classList.remove('win');C.append(cvOf(catArt(e.id)),el('h3','',esc(e.n)),el('div','rar',`${how.toUpperCase()}  ${CRAR[e.r].toUpperCase()}`),el('div','info',`<b>+${pts} points</b>`),el('div','rar',`IN YOUR BAG  ${S.bag.length}/${bagCap()}`));
  C.querySelector('.rar').style.color=`var(--r${e.r})`;C.hidden=false;C.classList.remove('pop');void C.offsetWidth;C.classList.add('pop');clearTimeout(addFind.t);addFind.t=setTimeout(()=>{C.hidden=true},2200)}
function pickFind(list,bias=0){const w=[56,27,12,4.4,.6].map((v,i)=>v*(1+bias*i*.5));const pool=list.filter(Boolean);let t=Math.random()*pool.reduce((a,e)=>a+w[Math.min(4,e.r)],0);for(const e of pool){t-=w[Math.min(4,e.r)];if(t<0)return e}return pool[0]}
function bagRoom(){if(S.bag.length>=bagCap()){toast('Your bag is full. Take it to Catoshi\'s basket.');sfx('error');return false}return true}
function digAt(d){if(foundToday(d.k))return toast('Already dug here today');if(!S.tools.shovel){toast('You need a shovel. The Tackle shop sells them.');sfx('error');return}if(!bagRoom())return;
  d.prog=(d.prog||0)+1;sfx('chop');for(let i=0;i<6;i++)PART.push({x:d.x-worldCam.x+(Math.random()-.5)*8,y:d.y-worldCam.y,vx:(Math.random()-.5)*50,vy:-40-Math.random()*40,life:.6,t:0,g:220,col:Math.random()<.5?'#c8ac78':'#8a6a48',s:2});CAM.shake=1;
  if(d.prog<4){popText(['DIG','DIG!','ALMOST'][d.prog-1],d.x-worldCam.x-8,d.y-worldCam.y-30,'#ffd24d',.6);return}
  S.found.keys.push(d.k);const e=pickFind([...FINDS.treasure,...(Math.random()<.2?FINDS.pearl:[])],1.2);addFind(e,'Dug up');sparkle(d.x-worldCam.x,d.y-worldCam.y,14);setWorldAct()}
function pickShell(sh){if(foundToday(sh.k)||!bagRoom())return;S.found.keys.push(sh.k);const e=pickFind(Math.random()<.12?[...FINDS.pearl,...FINDS.coral]:Math.random()<.15?FINDS.junk:FINDS.shell);addFind(e,'Beachcombed');setWorldAct()}
function salvage_(v){if(foundToday(v.k))return toast('Nothing left here today');if(!S.tools.grapple){toast('You need a grapple. The Tackle shop sells them.');sfx('error');return}if(!bagRoom())return;
  S.found.keys.push(v.k);sfx('clang');CAM.shake=2;const e=pickFind([...FINDS.curio,...FINDS.treasure,...FINDS.junk,...(FINDS.set||[])],.8);addFind(e,'Salvaged');setWorldAct()}
function knock(N){sfx('door');const key='knock_'+N.n;let msg=pickOne(N.lines);if(!foundToday(key)){S.found.keys.push(key);const g=Math.random();if(g<.4){S.bait.prawn+=4;msg+=' (They give you 4 live prawns.)'}else if(g<.7){S.bait.worm+=8;msg+=' (They give you 8 worms.)'}dirty();refreshHud()}
  showSheet('knock',N.n,b=>{b.append(portraitCat(N.coat),el('p','note',esc(msg)),btn('big','Bye!',closeSheet))})}

/* ---------------- A* on the tile grid (land, or water when sailing) ---------------- */
function findPath(sx,sy,tx,ty,ok){const S=WLD.S,W=S.w,H=S.h;ok=ok||WLD.walk;if(!ok(tx,ty))return null;const N=W*H,start=sy*W+sx,goal=ty*W+tx;if(start===goal)return[];
  const gs=new Float32Array(N).fill(1e9),came=new Int32Array(N).fill(-1),closed=new Uint8Array(N);const heap=[];
  const hcost=i=>{const x=i%W,y=(i/W)|0;const dx=Math.abs(x-tx),dy=Math.abs(y-ty);return Math.max(dx,dy)+.41*Math.min(dx,dy)};
  const push=(i,f)=>{heap.push([f,i]);let c=heap.length-1;while(c>0){const p=(c-1)>>1;if(heap[p][0]<=heap[c][0])break;[heap[p],heap[c]]=[heap[c],heap[p]];c=p}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let c=0;for(;;){const l=c*2+1,r=l+1;let m=c;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===c)break;[heap[m],heap[c]]=[heap[c],heap[m]];c=m}}return top};
  gs[start]=0;push(start,hcost(start));let n=0;
  while(heap.length&&n++<30000){const[,i]=pop();if(i===goal)break;if(closed[i])continue;closed[i]=1;const x=i%W,y=(i/W)|0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(!ok(nx,ny))continue;if(dx&&dy&&(!ok(x+dx,y)||!ok(x,y+dy)))continue;
      const j=ny*W+nx,ng=gs[i]+(dx&&dy?1.41:1);if(ng<gs[j]){gs[j]=ng;came[j]=i;push(j,ng+hcost(j))}}}
  if(came[goal]<0)return null;const out=[];for(let i=goal;i!==start;i=came[i])out.push([(i%W)*16+8,((i/W)|0)*16+10]);return out.reverse()}
const boatTier=()=>Math.max(0,BOATC.findIndex(b=>b.k===S.boat));
const sailOK=(x,y)=>WLD.sail(x,y)&&ZNEED[ZONE_ORDER[WLD.S.zone[y*MW+x]]]<=boatTier();
function walkTo(px,py,pend){const tx=Math.floor(px/16),ty=Math.floor(py/16);const ok=WP.boat?sailOK:WLD.walk;const exact=ok(tx,ty);
  let t=exact?[tx,ty]:nearWalkS(WLD.S,ok,tx,ty);if(!t)return false;
  const p=findPath(Math.floor(WP.x/16),Math.floor(WP.y/16),t[0],t[1],ok);if(!p){toast(WP.boat?'Your boat can\'t get there':'Can\'t get there');return false}
  WP.path=p;if(p.length&&exact){const last=p[p.length-1];last[0]=px;last[1]=py}WP.pend=pend||null;WP.mark={x:px,y:py,t:0};return true}

/* ---------------- moving: tap to go, or the thumb stick ---------------- */
const JOY={on:false,sx:0,sy:0,dx:0,dy:0,id:null,moved:false,keys:{}};
const boatSpeed=()=>[56,66,78,92,108][boatTier()]||56;
function stepAlong(o,dt,spd){if(!o.path.length)return false;const[tx,ty]=o.path[0];const dx=tx-o.x,dy=ty-o.y,d=Math.hypot(dx,dy);const s=spd*dt;
  if(d<=s){o.x=tx;o.y=ty;o.path.shift()}else{o.x+=dx/d*s;o.y+=dy/d*s}
  o.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);if(o===WP&&d>.1)WP.hd=((Math.round(Math.atan2(dy,dx)/(Math.PI*2)*16)%16)+16)%16;o.ft+=dt;if(o.ft>.14){o.ft=0;o.fr=o.fr===1?2:1}return true}
function stickMove(dt){let dx=JOY.dx,dy=JOY.dy;const k=JOY.keys;if(k.L)dx=-1;if(k.R)dx=1;if(k.U)dy=-1;if(k.D)dy=1;const m=Math.hypot(dx,dy);if(m<.15)return false;if(m>1){dx/=m;dy/=m}
  WP.path=[];WP.pend=null;const spd=(WP.boat?boatSpeed():72)*Math.min(1,m);const ok=WP.boat?sailOK:WLD.walk;const foot=WP.boat?0:-2;
  const nx=WP.x+dx*spd*dt,ny=WP.y+dy*spd*dt;let moved=false;
  if(ok(Math.floor(nx/16),Math.floor((WP.y+foot)/16))){WP.x=nx;moved=true}if(ok(Math.floor(WP.x/16),Math.floor((ny+foot)/16))){WP.y=ny;moved=true}
  if(!moved&&WP.boat){const z=zoneAt((WP.x+dx*16)/16,(WP.y+dy*16)/16);if(ZNEED[z]>boatTier()&&WLD.sail(Math.floor((WP.x+dx*16)/16),Math.floor((WP.y+dy*16)/16))){const need=BOATC[ZNEED[z]];if(!stickMove.warned||now()-stickMove.warned>3){stickMove.warned=now();toast(`Too rough for your ${BOATI[S.boat].n}. ${ZONES[z].n} needs a ${BOATI[need.k].n}.`)}}}
  WP.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);WP.hd=((Math.round(Math.atan2(dy,dx)/(Math.PI*2)*16)%16)+16)%16;WP.ft+=dt;if(WP.ft>.14){WP.ft=0;WP.fr=WP.fr===1?2:1}return true}

/* ---------------- update ---------------- */
let nearInter=null,act2=null;
function worldUpdate(dt,t){const moving=stickMove(dt)||stepAlong(WP,dt,WP.boat?boatSpeed():72);
  if(!moving){WP.fr=0;if(WP.pend){const p=WP.pend;WP.pend=null;if(Math.hypot(WP.x-p.x,WP.y-p.y)<=(p.r||20)+12)p.fn()}}
  if(WP.mark){WP.mark.t+=dt;if(WP.mark.t>.8||!moving)WP.mark=null}
  for(const n of NPCS){if(!stepAlong(n,dt,30)){n.fr=0;n.wait-=dt;if(n.wait<=0){n.wait=3+Math.random()*6;const p=nearWalk(n.hub[0]+Math.round((Math.random()-.5)*8),n.hub[1]+Math.round((Math.random()-.5)*6));if(p){const path=findPath(Math.floor(n.x/16),Math.floor(n.y/16),p[0],p[1]);if(path&&path.length<24)n.path=path}}}}
  for(const s of WLD.schools){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(s.life<0||!WLD.sail(Math.floor(s.x/16),Math.floor(s.y/16))){Object.assign(s,newSchool())}}
  if(Math.random()<dt*.05&&WLD.birds.length<3)WLD.birds.push({x:worldCam.x-30,y:worldCam.y+20+Math.random()*VH*.5,v:18+Math.random()*12,f:0});for(let i=WLD.birds.length-1;i>=0;i--){const b=WLD.birds[i];b.x+=b.v*dt;b.f+=dt;if(b.x>worldCam.x+VW+40)WLD.birds.splice(i,1)}
  // what's in reach
  let best=null,bd=1e9;const can=it=>(!!it.sea)===WP.boat;
  for(const it of WLD.inter){if(!can(it))continue;const d=Math.hypot(it.x-WP.x,it.y-WP.y);if(d<it.r&&d<bd){bd=d;best=it}}
  if(!WP.boat){for(const d of WLD.digs){if(foundToday(d.k))continue;const dd=Math.hypot(d.x-WP.x,d.y-WP.y);if(dd<18&&dd<bd){bd=dd;best={x:d.x,y:d.y,r:18,label:'DIG',name:'X marks the spot',fn:()=>digAt(d)}}}
    for(const s of WLD.shells){if(foundToday(s.k))continue;const dd=Math.hypot(s.x-WP.x,s.y-WP.y);if(dd<16&&dd<bd){bd=dd;best={x:s.x,y:s.y,r:16,label:'PICK UP',name:'Something shiny',fn:()=>pickShell(s)}}}
    const B=S.boatAt;if(S.boat&&B){const dd=Math.hypot(B.x-WP.x,B.y-WP.y);if(dd<30&&dd<bd){bd=dd;best={x:B.x,y:B.y,r:30,label:'BOARD BOAT',name:BOATI[S.boat].n,fn:boardBoat}}}}
  if(best&&nearInter&&best.x===nearInter.x&&best.y===nearInter.y&&best.label===nearInter.label)best=nearInter;
  let a2=null;if(WP.boat){const tx=Math.floor(WP.x/16),ty=Math.floor(WP.y/16);for(const[a,b]of[[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1],[0,2],[2,0],[-2,0],[0,-2]])if(WLD.walk(tx+a,ty+b)){a2={label:'GO ASHORE',fn:()=>goAshore(tx+a,ty+b)};break}if(!best)best={x:WP.x,y:WP.y,r:9,label:'FISH HERE',name:'',fn:fishAtSea,seaFish:1}}
  if(best!==nearInter||(a2&&a2.label)!==(act2&&act2.label)){nearInter=best;act2=a2;setWorldAct()}
  S.pos={x:Math.round(WP.x),y:Math.round(WP.y),boat:WP.boat}}
function setWorldAct(){if(MODE!=='world')return;$('act').hidden=!nearInter;const a2=$('act2');a2.hidden=!act2;if(act2)a2.textContent=act2.label;
  if(nearInter){const bag=(S.bag||[]).length;setAct(nearInter.basket?(bag?`DROP ${bag}`:'BASKET'):nearInter.label,nearInter.basket&&bag?'hot':'')}}
function boardBoat(){if(!S.boat)return;WP.boat=true;WP.x=S.boatAt.x;WP.y=S.boatAt.y;WP.path=[];sfx('splash');toast(`Aboard the ${BOATI[S.boat].n}. Drag to steer, or tap where to go.`);nearInter=null;setWorldAct()}
function goAshore(tx,ty){S.boatAt={x:WP.x,y:WP.y};WP.boat=false;WP.x=tx*16+8;WP.y=ty*16+10;WP.path=[];sfx('thud');const I=islandAt(tx,ty);if(!inTown(tx,ty)&&I)toast(`Ashore on ${I.n}`);nearInter=null;act2=null;setWorldAct()}
function fishAtSea(){const z=zoneAt(WP.x/16,WP.y/16);const sp=Object.assign({},SPOTI['sea_'+z]);sp.school=WLD.schools.some(s=>Math.hypot(s.x-WP.x,s.y-WP.y)<48);enterSpot(sp)}
function worldTap(ev){const p=toScene(ev);const wx=p.x+worldCam.x,wy=p.y+worldCam.y;const T=WLD.throne;
  if(!WP.boat&&Math.abs(wx-(T.x+83))<9&&Math.abs(wy-(T.y+38))<9){tokenTap();return}
  if(!WP.boat&&wx>T.x+14&&wx<T.x+78&&wy>T.y-4&&wy<T.y+70&&Math.hypot(T.cx-WP.x,T.cy+28-WP.y)<70){say(S.bag.length?'Put them in my basket.':pickOne(LINES.idle),3500,2);return}
  if(!WP.boat){for(const n of NPCS)if(Math.abs(n.x-wx)<10&&wy>n.y-18&&wy<n.y+4){sfx('purr');chooseTrip(n.coat);return}
    const B=S.boatAt;if(S.boat&&B&&Math.hypot(B.x-wx,B.y-wy)<16){if(Math.hypot(B.x-WP.x,B.y-WP.y)<30)boardBoat();else{const t=nearWalkS(WLD.S,WLD.walk,Math.floor(B.x/16),Math.floor(B.y/16));if(t)walkTo(t[0]*16+8,t[1]*16+10,{x:B.x,y:B.y,r:30,fn:boardBoat})}return}}
  for(const it of WLD.inter)if(!!it.sea===WP.boat&&Math.hypot(it.x-wx,(it.y-6)-wy)<14){if(Math.hypot(it.x-WP.x,it.y-WP.y)<it.r){it.fn();return}walkTo(it.x,it.y,it);sfx('click');return}
  walkTo(wx,wy,null)}
function worldKeys(e,down){const m={ArrowLeft:'L',KeyA:'L',ArrowRight:'R',KeyD:'R',ArrowUp:'U',KeyW:'U',ArrowDown:'D',KeyS:'D'}[e.code];if(!m)return false;JOY.keys[m]=down;return true}
function goTo(name){const it=WLD.inter.find(i=>i.name===name);if(!it)return;if(WP.boat){toast('Sail back to town and go ashore first');return}if(Math.hypot(it.x-WP.x,it.y-WP.y)<it.r)it.fn();else walkTo(it.x,it.y,it)}

/* ---------------- drawing the world ---------------- */
function drawWorld(t){const W=WLD.S;const mw=W.w*16,mh=W.h*16;const cx=clamp(Math.round(WP.x-VW/2),0,mw-VW),cy=clamp(Math.round(WP.y-12-VH*.45),0,mh-VH);worldCam.x=cx;worldCam.y=cy;
  g.fillStyle='#2e5070';g.fillRect(0,0,VW,VH);g.drawImage(W.ground,-cx,-cy);
  const f=(Math.sin(t*1.6)+1)/2;g.globalAlpha=.25+f*.55;g.drawImage(W.foam,-cx+Math.round(f*1.5),-cy+Math.round(f));g.globalAlpha=1;
  const x0=Math.floor(cx/16),y0=Math.floor(cy/16),x1=Math.ceil((cx+VW)/16),y1=Math.ceil((cy+VH)/16);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){if(tx<0||ty<0||tx>=W.w||ty>=W.h)continue;const i=ty*W.w+tx;if(W.g[i]!=='o')continue;const h=hash2(tx,ty,91);const ph=(t*.7+h*7)%7;
    if(ph<1.2){const gx=tx*16-cx+2+(hash2(tx,ty,92)*9|0)+Math.round(Math.sin(t+h*6)*2),gy=ty*16-cy+3+(hash2(tx,ty,93)*10|0);g.fillStyle=W.zone[i]>=6?'#5a7ac0':'#c8f0f8';g.fillRect(gx,gy,ph<.35||ph>.85?2:4,1)}}
  const inV=(x,y,m=40)=>x-cx>-m&&x-cx<VW+m&&y-cy>-m&&y-cy<VH+m;
  // kelp, fish schools with diving birds, fishing-spot ripples
  for(const k of WLD.kelp)if(inV(k.x,k.y))g.drawImage(artKelpTop(Math.floor(t*2+k.f)%4),Math.round(k.x-cx-8),Math.round(k.y-cy-8));
  for(const s of WLD.schools)if(inV(s.x,s.y,60)){const sc=artSchool(Math.floor(t*4)%4);g.drawImage(sc,Math.round(s.x-cx-sc.width/2),Math.round(s.y-cy-sc.height/2));const bd=artBirds(Math.floor(t*6)%2);g.drawImage(bd,Math.round(s.x-cx-bd.width/2+Math.sin(t)*6),Math.round(s.y-cy-30+Math.cos(t*1.3)*3))}
  for(const s of WLD.spots)if(inV(s.wx,s.wy)){const k=(t*.8)%1;g.strokeStyle=`rgba(255,240,200,${.8*(1-k)})`;g.lineWidth=1;g.beginPath();g.ellipse(s.wx-cx,s.wy-cy,3+k*9,(3+k*9)*.5,0,0,Math.PI*2);g.stroke()}
  for(const v of WLD.salvage)if(inV(v.x,v.y)&&!foundToday(v.k)){const sp=artSalvageSpot(Math.floor(t*3)%3);g.drawImage(sp,Math.round(v.x-cx-sp.width/2),Math.round(v.y-cy-sp.height/2))}
  // the moored boat, or you sailing it
  const boatAt=(x,y,h)=>{const b=boatImg(S.boat,h);g.drawImage(b,Math.round(x-cx-b.width/2),Math.round(y-cy-b.height/2+Math.sin(t*1.5)))};
  if(S.boat&&!WP.boat&&S.boatAt&&inV(S.boatAt.x,S.boatAt.y))boatAt(S.boatAt.x,S.boatAt.y,4);
  const L=[];for(const p of W.props){if(p.flat)continue;let im=p.anim?p.anim(t):p.img;if(p.crab)im=artCrabBeach(Math.floor(t*3)%2);if(p.buoy)im=artBuoy(p.buoy,Math.floor(t*2)%2);if(!im)continue;if(p.x-cx>VW+8||p.y-cy>VH+8||p.x+im.width-cx<-8||p.y+im.height-cy<-8)continue;L.push([p.sy,()=>g.drawImage(im,Math.round(p.x-cx),Math.round(p.y-cy))])}
  for(const p of W.props)if(p.flat&&p.img&&inV(p.x,p.y))g.drawImage(p.img,Math.round(p.x-cx),Math.round(p.y-cy));
  // X marks and shells
  for(const d of WLD.digs)if(!foundToday(d.k)&&inV(d.x,d.y)){g.fillStyle='#8a2a1a';for(let i=-3;i<=3;i++){g.fillRect(Math.round(d.x-cx+i),Math.round(d.y-cy+i-4),2,2);g.fillRect(Math.round(d.x-cx+i),Math.round(d.y-cy-i-4),2,2)}}
  for(const s of WLD.shells)if(!foundToday(s.k)&&inV(s.x,s.y)){if(((t*3+s.x)|0)%3===0){g.fillStyle='#fffbe8';g.fillRect(Math.round(s.x-cx),Math.round(s.y-cy-2),1,5);g.fillRect(Math.round(s.x-cx-2),Math.round(s.y-cy),5,1)}g.fillStyle='#f4c8b0';g.fillRect(Math.round(s.x-cx-1),Math.round(s.y-cy),3,2)}
  const shadow=(x,y,w=5)=>{g.fillStyle='rgba(0,0,0,.22)';g.fillRect(Math.round(x-w),Math.round(y-1),w*2,2);g.fillRect(Math.round(x-w+1),Math.round(y-2),w*2-2,4)};
  const T=WLD.throne;if(inV(T.cx,T.cy,80)){L.push([T.cy+4,()=>{g.fillStyle='rgba(0,0,0,.2)';g.fillRect(Math.round(T.x+8-cx),Math.round(T.cy+4-cy),76,6);g.drawImage(throneArt(),Math.round(T.x-cx),Math.round(T.y-cy));
    g.drawImage(catoshiArt(catoshiWave>0?2:catoshiBlink<0?1:0),Math.round(T.x+14-cx),Math.round(T.y-6-cy));g.drawImage(rushToken(12),Math.round(T.x+77-cx),Math.round(T.y+32-cy+Math.sin(t*2)))}]);
    L.push([T.cy+30,()=>g.drawImage(basketArt(Math.min(6,S.basketToday||0)),Math.round(T.cx-17-cx),Math.round(T.cy+12-cy))])}
  for(const n of NPCS)if(inV(n.x,n.y))L.push([n.y,()=>{shadow(n.x-cx,n.y-cy);g.drawImage(catWalk(n.coat,n.dir,n.fr),Math.round(n.x-cx-10),Math.round(n.y-cy-18))}]);
  if(S.coat)L.push([WP.y,()=>{if(WP.boat){boatAt(WP.x,WP.y,WP.hd);const fc=catFace(S.coat);g.drawImage(fc,Math.round(WP.x-cx-6),Math.round(WP.y-cy-13),12,11)}else{shadow(WP.x-cx,WP.y-cy);g.drawImage(catWalk(S.coat,WP.dir,WP.fr),Math.round(WP.x-cx-10),Math.round(WP.y-cy-18))}
    const n=(S.bag||[]).length;if(n){const s=String(n);g.fillStyle='#f07a1e';g.fillRect(Math.round(WP.x-cx+5),Math.round(WP.y-cy-22),textW(s)+4,7);drawText(g,s,Math.round(WP.x-cx+7),Math.round(WP.y-cy-21),'#1a0e06')}}]);
  if(SERVER.ready)pushOthers(L,cx,cy,t);
  L.sort((a,b)=>a[0]-b[0]);for(const[,fn]of L)fn();
  for(const b of WLD.birds){const im=artBirds(Math.floor(b.f*6)%2);g.drawImage(im,Math.round(b.x-cx),Math.round(b.y-cy))}
  if(WP.mark){const k=WP.mark.t/.8;g.strokeStyle=`rgba(255,177,90,${1-k})`;g.beginPath();g.ellipse(WP.mark.x-cx,WP.mark.y-cy,3+k*5,(3+k*5)*.5,0,0,Math.PI*2);g.stroke()}
  const tag=(text,x,y,col)=>{const tl=text.toUpperCase();const w=textW(tl)+6;g.fillStyle='rgba(16,13,12,.75)';g.fillRect(Math.round(x-w/2),Math.round(y),w,9);drawText(g,tl,Math.round(x-w/2+3),Math.round(y+2),col||'#fff6e0')};
  for(const s of WLD.spots)if(inV(s.x,s.y))tag(s.n,s.x-cx,s.y-cy-34,s.contest?'#ffb15a':'#fff6e0');
  if(nearInter&&!nearInter.spot&&nearInter.name)tag(nearInter.name,nearInter.x-cx,nearInter.y-cy-36);
  partDraw();if(RAIN)drawRain(t);
  for(const e of FX)if(e.k==='txt'){const k=e.t/e.d;g.globalAlpha=1-k*k;drawTextO(g,e.s,Math.round(e.x),Math.round(e.y-k*12),e.col,'#000');g.globalAlpha=1}
  // when your bag has something in it, point the way home to Catoshi
  if((S.bag||[]).length&&!nearInter?.basket){const dx=T.cx-WP.x,dy=T.cy+20-WP.y,d=Math.hypot(dx,dy);if(d>90){const ax=VW/2+dx/d*Math.min(60,VW/2-14),ay=VH*.45+dy/d*Math.min(60,VH*.4);g.save();g.translate(Math.round(ax),Math.round(ay));g.rotate(Math.atan2(dy,dx));g.fillStyle='#ffb15a';g.fillRect(-6,-1,8,3);g.beginPath();g.moveTo(2,-4);g.lineTo(7,1);g.lineTo(2,6);g.fill();g.restore()}}
  // the thumb stick
  if(JOY.on&&JOY.moved){g.globalAlpha=.55;g.strokeStyle='#fff6e0';g.lineWidth=1;g.beginPath();g.arc(JOY.sx,JOY.sy,20,0,Math.PI*2);g.stroke();g.fillStyle='#f07a1e';g.beginPath();g.arc(JOY.sx+JOY.dx*16,JOY.sy+JOY.dy*16,7,0,Math.PI*2);g.fill();g.globalAlpha=1}
  placeSay()}

/* ---------------- Catoshi's basket: bring your catch home for points ---------------- */
function depositFish(){const bag=S.bag||[];if(!bag.length){say(S.total?'Your bag is empty. Go and catch me something.':'Catch fish at the pier, then bring them here.',3500,2);return}
  let pts=0;for(const f of bag)pts+=f.pts;const n=bag.length;const best=bag.reduce((a,b)=>b.pts>a.pts?b:a,bag[0]);
  addPoints(pts);S.basketToday=(S.basketToday||0)+n;S.bag=[];dirty();refreshHud();setWorldAct();
  sfx('jackpot');catoshiWave=2.5;coinBurst(WLD.throne.cx-worldCam.x,WLD.throne.cy-worldCam.y,Math.min(30,8+n*2));
  say(n>=8?'A feast! You spoil me.':best.r>=3?'Magnificent. Truly.':pickOne(LINES.catch),3500,2);
  showSheet('basket','Catoshi\'s basket',b=>{const h=el('div','haul');for(const f of bag.slice(0,30)){const c=cvOf(catArt(f.id));c.title=`${CATI[f.id]?CATI[f.id].n:''}`;h.append(c)}
    b.append(portraitCatoshi(),h,el('div','payout',`+${fmt(pts)} points<small>FOR ${n} ${n===1?'THING':'THINGS'}</small>`),
      el('p','lead',`You have <b>${fmt(S.today)}</b> points today and <b>${fmt(S.wpts||0)}</b> this week. The top 10 licensed cats share the Daily Pot (now <b>${fmt(Math.floor(potToday()))}</b>) and the Weekly Cup (now <b>${fmt(Math.floor(cupWeek()))}</b>).${licensed()?'':' <b>You need this week\'s licence to win a share.</b>'}`),licensed()?el('span'):btn('sm','GET A LICENCE',openLicence),btn('big','Back to it',closeSheet))})}

/* ---------------- moving between the world and a fishing scene ---------------- */
function enterSpot(sp){if(!sp)return;closeSheet();SPOT=sp;S.spot=sp.k;MODE='fish';WP.path=[];WP.pend=null;JOY.on=false;JOY.dx=JOY.dy=0;
  CAM.flash=1;CAM.flashCol='#000';resize();camReset();CAM.z=1;CAM.fx=CAM.tx;CAM.fy=CAM.ty;
  PL=mkFisher(S.coat,LAY.playerX,true);RIV=[];if(sp.contest)seatRivals();ambient();
  $('say').classList.add('off');$('act2').hidden=true;setMode();sfx('splash');toast(sp.school?`${sp.n}: fish are schooling here!`:sp.n);dirty()}
function leaveSpot(){if(!['idle','show'].includes(PL.st)||CT.on||RAIN||RPLAY||WH.st==='game'||WH.st==='breach')return toast('Finish what you are doing first');
  hideCard(true);$('card').hidden=true;MODE='world';SPOT=null;S.spot=null;S.auto=false;CAM.flash=1;CAM.flashCol='#000';resize();camReset();CAM.z=1;CAM.fx=CAM.tx;CAM.fy=CAM.ty;
  WH={st:'none',next:now()+40+Math.random()*40,t:0};BOT=null;spawnNpcs();nearInter=null;act2=null;setMode();dirty();
  if((S.bag||[]).length>=bagCap())toast(`Bag full. Take your catch to Catoshi's basket`)}
function setMode(){const fish=MODE==='fish';$('autoBtn').hidden=!fish;$('baitBtn').hidden=!fish;$('act').hidden=fish?false:!nearInter;$('act2').hidden=fish||!act2;
  if(fish)setAct('CAST');else setWorldAct();
  const nb=(id,label,im)=>{const b=$(id);b.lastChild.textContent=label;const c=b.querySelector('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0)};
  if(fish){nb('nContest','CONTEST',uiIcon('trophy'));nb('nTrips','BAG',uiIcon('bag'));nb('nShop','SHOP',gearIcon('rod2'));nb('nCats',SPOT&&SPOT.ground==='boat'?'SAIL ON':'LEAVE',uiIcon('door'))}
  else{nb('nContest','CATOSHI',catoshiMini(0));nb('nTrips','MAP',uiIcon('map'));nb('nShop','BAG',uiIcon('bag'));nb('nCats','CATS',catFace(S.coat||'ginger'))}
  $('nContest').classList.toggle('dimmed',fish&&!(SPOT&&SPOT.contest));refreshHud()}

/* ---------------- the boatyard ---------------- */
function openBoatyard(){showSheet('boatyard','Boatyard',b=>{
  b.append(el('p','lead','Your boat waits at the dock. Board it, then drag to steer or tap where to sail. Fish anywhere at sea, and beach it on an island to explore. Bigger boats handle rougher water.'));
  b.append(btn('big','Crew fishing trips',openTrips));b.append(el('h4','sec','BOATS'));
  BOATC.forEach((B,i)=>{const owned=S.boats[B.k];const reach=SEAZONES.filter(z=>ZNEED[z]===i).map(z=>ZONES[z].n).join(', ');const r=iconRow(boatSide(B.k),BOATI[B.k].n,i===0?'Sails the harbour, shallows, reef and kelp.':`Adds ${reach||'faster sailing'}.`);let a;
    if(S.boat===B.k)a=el('span','chip go','YOURS');else if(owned)a=btn('sm','USE',()=>{S.boat=B.k;dirty();openBoatyard()});
    else{a=btn('sm buy',fmt(B.price),()=>{if(!spend(B.price,'shop')){toast('Not enough $CATOSHI');sfx('error');return}S.boats[B.k]=1;S.boat=B.k;if(!S.boatAt)S.boatAt={x:WLD.dock.x,y:WLD.dock.y};sfx('horn');dirty();refreshHud();toast(`Your ${BOATI[B.k].n} is waiting at the dock`);openBoatyard()});a.prepend(coinCv());a.disabled=S.bal<B.price}
    r.querySelector('.ico canvas').style.cssText=`width:${Math.min(80,boatSide(B.k).width*1.5)}px;height:auto`;r.querySelector('.ico').style.width='84px';r.append(a);b.append(r)})})}
/* ---------------- the Aquarium: everything you've found ---------------- */
function openLog(){showSheet('log','Aquarium',b=>{const ids=Object.keys(S.seen||{});const all=CAT.filter(e=>e.cat==='fish'||e.cat==='legend');
  b.append(el('p','lead',`You have found <b>${ids.length}</b> of <b>${CAT.length}</b> things. Each stretch of water has its own fish and its own legend; the islands hide treasure, shells and wreckage.`));
  for(const z of SEAZONES){const list=all.filter(e=>e.z===z);if(!list.length)continue;b.append(el('h4','sec',`${ZONES[z].n.toUpperCase()}  ${list.filter(e=>S.seen[e.id]).length}/${list.length}`));
    const gr=el('div','haul');for(const e of list){const got=S.seen[e.id];const c=cvOf(catArt(e.id,got?'':'s'));c.title=got?`${e.n}, best ${got} cm`:'Not caught yet';gr.append(c)}b.append(gr)}
  for(const k of['treasure','shell','pearl','coral','curio','junk']){const list=FINDS[k]||[];if(!list.length)continue;b.append(el('h4','sec',`${k.toUpperCase()}  ${list.filter(e=>S.seen[e.id]).length}/${list.length}`));const gr=el('div','haul');for(const e of list){const got=S.seen[e.id];const c=cvOf(catArt(e.id,got?'':'s'));c.title=got?e.n:'Not found yet';gr.append(c)}b.append(gr)}})}
function openBag(){const bag=S.bag||[];showSheet('bag','Your bag',b=>{b.append(el('p','lead',`<b>${bag.length}</b> of <b>${bagCap()}</b>. Take it all to the basket under Catoshi's chair in the town square to score points.`));
  if(bag.length){const h=el('div','haul');for(const f of bag){const c=cvOf(catArt(f.id));c.title=`${f.pts} pts`;h.append(c)}b.append(h);b.append(el('div','payout',`${fmt(bag.reduce((a,f)=>a+f.pts,0))} points<small>WHEN YOU DROP THEM IN CATOSHI'S BASKET</small>`))}
  b.append(el('p','odds',`Tools: shovel ${S.tools.shovel?'yes':'no'}, grapple ${S.tools.grapple?'yes':'no'}. Boat: ${S.boat?BOATI[S.boat].n:'none'}.`))})}
/* ---------------- the map ---------------- */
function openMap(){showSheet('map','Map',b=>{const W=WLD.S;const sc=Math.min(2.6,(Math.min(innerWidth,460)-40)/MW);const[c,x]=mk(Math.round(MW*sc*1.2),Math.round(MH*sc*1.2));x.imageSmoothingEnabled=true;x.drawImage(W.ground,0,0,c.width,c.height);
  const k=c.width/(MW*16);const dot=(px,py,col,r=2)=>{x.fillStyle='#000';x.fillRect(Math.round(px*k)-r-1,Math.round(py*k)-r-1,r*2+2,r*2+2);x.fillStyle=col;x.fillRect(Math.round(px*k)-r,Math.round(py*k)-r,r*2,r*2)};
  dot(WLD.throne.cx,WLD.throne.cy,'#ffd24d',3);if(S.boat&&!WP.boat)dot(S.boatAt.x,S.boatAt.y,'#7ab8ff');for(const d of WLD.digs)if(!foundToday(d.k)&&S.tools.shovel)dot(d.x,d.y,'#e84a3a');for(const s of WLD.schools)dot(s.x,s.y,'#ffffff',1);dot(WP.x,WP.y,'#f07a1e',3);
  x.font='bold 9px system-ui';x.textAlign='center';for(const I of ISLANDS){x.fillStyle='#000';x.fillText(I.n,I.x*16*k+1,(I.y+I.r+2.5)*16*k+1);x.fillStyle='#fff6e0';x.fillText(I.n,I.x*16*k,(I.y+I.r+2.5)*16*k)}
  c.style.cssText=`width:${c.width}px;max-width:100%;height:auto;border:2px solid #000;align-self:center`;b.append(c);
  b.append(el('p','odds','You are orange. Gold is Catoshi\'s chair, blue your moored boat, white dots are fish schools.'+(S.tools.shovel?' Red dots are today\'s X marks.':' With a shovel, today\'s X marks show here too.')+' Darker water is rougher and needs a bigger boat.'))})}
