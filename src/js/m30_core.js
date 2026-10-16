/* ================= CATOSHI'S CATCH: rules, save, network, layout, UI helpers =================
   Cats fish off Catoshi's pier. Manual fishing uses bait and gear; auto fishing costs $CATOSHI per cast.
   Contests: 60 s against three rival cats, most fish wins Catoshi's prize. Trips: crew cats go to sea for a fee.
   Hidden: the White Whale, Token Rain (tap Catoshi's token), bottles drifting past. Big catches record a replay. */
const CATOSHI_CA='HrZh7koZFedTSHng4bVmhULwejpmVdSKUYxaf2N5im1b';
const PRICE=[3,6,15,50,400];
const RWEIGHT=[56,27,12,4.4,.6];
const CONTEST={secs:90,prize:[150,60,25,0]};
let AUTO_COST=2, AUTO_RATE=.85;const WHALE_PRIZE=300, BIG_WIN=15;
const POINTS=[1,2,5,15,50];
const REELS=[{n:'Sidecast Reel',price:0,pow:1,ico:'reel0',d:'Gets the job done.'},{n:'Spin Reel',price:300,pow:1.15,ico:'reel1',d:'Pulls a little harder in every fight.'},{n:'Baitcaster',price:1300,pow:1.3,ico:'reel2',d:'Strong, smooth and fast.'},{n:'Deep Reel',price:4200,pow:1.5,ico:'reel3',d:'For monsters from the deep.'}];
const COOLERS=[{n:'Esky',cap:10,price:0,ico:'ice0',d:'Holds 10 fish.'},{n:'Ice box',cap:20,price:600,ico:'ice1',d:'Holds 20 fish.'},{n:'Slurry tank',cap:40,price:3000,ico:'ice2',d:'Holds 40 fish.'}];
const BOATC=[{k:'row',price:400,spot:'estuary'},{k:'dinghy',price:1500,spot:'kelp'},{k:'skiff',price:5000,spot:'wreck'},{k:'trawler',price:15000,spot:'blue'},{k:'cutter',price:40000,spot:'deep'}];
const gearPow=()=>GEAR.rod[S.gear.rod].power;const bagCap=()=>COOLERS[S.cooler||0].cap;
const BAITS=[
  {k:'worm',n:'Beach worms',pack:25,price:20,lean:0,d:'Good for everyday fish.'},
  {k:'prawn',n:'Live prawns',pack:15,price:45,lean:1,d:'Better odds of uncommon and rare fish.'},
  {k:'squid',n:'Squid strips',pack:10,price:80,lean:2.2,d:'Big fish love squid. Best odds of a legend.'}];
const BAITI=Object.fromEntries(BAITS.map(b=>[b.k,b]));
const RODS=[
  {n:'Bamboo Rod',price:0,zone:1,spd:1,pow:1,ico:'rod0',d:'Where every cat starts.'},
  {n:'Carbon Rod',price:400,zone:1.2,spd:.9,pow:1.25,ico:'rod2',d:'Wider green zones and stronger pulls.'},
  {n:'Rush Rod',price:2000,zone:1.4,spd:.8,pow:1.5,ico:'rod4',d:'Catoshi\'s own design. The easiest fights.'}];
const TRIPS=[
  {k:'bay',n:'Bay Run',boat:'row',ms:60e3,fee:50,fish:[2,3],lean:0},
  {k:'reef',n:'Reef Run',boat:'skiff',ms:5*60e3,fee:200,fish:[3,5],lean:1},
  {k:'deep',n:'Deep Sea',boat:'trawler',ms:20*60e3,fee:750,fish:[4,7],lean:2}];
const TRIPI=Object.fromEntries(TRIPS.map(t=>[t.k,t]));
const FPOOL=[[],[],[],[],[]];for(const e of CAT){if(e.cat==='fish')FPOOL[e.r].push(e);else if(e.cat==='legend')FPOOL[4].push(e)}
const TREASURE=CAT.filter(e=>e.cat==='treasure');
const LINES={
  idle:['Bring me fish. The cat with the most wins my favour.','Start a contest. Sixty seconds. Most fish wins.','Send your crew to sea. Fortune favours the bold.','Fish for Rush tokens. A fair trade.','Today\'s top cat gets 1,000 $CATOSHI from me.','They say a white whale haunts this harbour.','Do not touch my token. Three times. Quickly.'],
  catch:['Mrrp. Acceptable.','A fine fish.','More.','Purrfect.','Keep them coming.'],
  rare:['Now THAT is a fish.','Ooh. Shiny.','Impressive. Very impressive.'],
  legend:['LEGENDARY. You have my full attention.']};
const BOTTLE_NOTES=['"The whale only shows itself to patient cats." - C.','"Squid for the big ones." - a wise fisher','"Tap the token thrice." - unsigned','"Gone fishing. Back never." - a gull','"Catoshi was here."'];
const pickOne=a=>a[Math.floor(Math.random()*a.length)];
function rollFish(lean=0,rnd=Math.random,zone){if(zone===undefined)zone=SPOT?SPOT.zone:null;const w=RWEIGHT.map((v,i)=>v*(1+lean*i*.45));let t=rnd()*w.reduce((a,b)=>a+b,0),r=0;for(;r<4;r++){t-=w[r];if(t<0)break}const zp=zone&&ZPOOL[zone]&&ZPOOL[zone][r];const p=zp&&zp.length?zp:FPOOL[r];return p[Math.floor(rnd()*p.length)]}
const fishCm=(e,q)=>Math.round(e.sz[0]+(e.sz[1]-e.sz[0])*q);
const kgOf=(e,cm)=>Math.max(.05,Math.round(.000012*cm*cm*cm*(e.r>=3?1.3:1)*100)/100);
// how dramatic the landing is: 0 flick, 1 leap, 2 heave, 3 epic
const landClass=(e,kg)=>e.cat==='legend'?3:(e.r>=3||kg>=12)?2:(e.r>=1||kg>=1.5)?1:0;

/* ---------------- save ---------------- */
let S=null;
const SAVE_KEY='catoshi-catch-v2';
function newSave(){return{v:2,coat:null,name:'',bal:500,day:dayKey(),today:0,prevDay:'',prevToday:0,total:0,wins:0,contests:0,trips:{},seen:{},sound:1,claimed:'',hint:0,
  gear:{rod:0,reel:0,line:0},tools:{shovel:0,grapple:0},boatAt:null,found:null,own:{rod:[1],reel:[1],line:[1]},pos:null,spot:null,lic:[],led:null,week:'',wpts:0,prevWeek:'',prevWpts:0,hist:{},whist:{},paidD:{},paidW:{},bag:[],basketToday:0,cooler:0,coolers:[1,0,0],reel:0,reels:[1,0,0,0],boats:{},boat:null,bait:{worm:25,prawn:3,squid:0},baitSel:'worm',rod:0,rods:[1,0,0],auto:false,freeWorms:'',rainAt:0,whales:0,replays:[],t:0}}
function fixSave(o){const s=Object.assign(newSave(),o||{});s.bait=Object.assign({worm:0,prawn:0,squid:0},s.bait);if(!Array.isArray(s.replays))s.replays=[];if(!Array.isArray(s.rods))s.rods=[1,0,0];if(!Array.isArray(s.bag))s.bag=[];if(!s.tools||typeof s.tools!=='object')s.tools={shovel:0,grapple:0};if(!s.gear||typeof s.gear!=='object')s.gear={rod:0,reel:0,line:0};if(!s.own||typeof s.own!=='object')s.own={rod:[1],reel:[1],line:[1]};for(const k of['rod','reel','line']){if(!Array.isArray(s.own[k]))s.own[k]=[1];s.gear[k]=clamp(s.gear[k]|0,0,GEAR[k].length-1)}if(!Array.isArray(s.lic))s.lic=[];for(const k of['hist','whist','paidD','paidW'])if(!s[k]||typeof s[k]!=='object')s[k]={};if(!Array.isArray(s.reels))s.reels=[1,0,0,0];if(!Array.isArray(s.coolers))s.coolers=[1,0,0];if(!s.boats||typeof s.boats!=='object')s.boats={};s.auto=false;return s}
function rollDay(){const d=dayKey();if(S.day!==d){S.prevDay=S.day;S.prevToday=S.today;S.today=0;S.basketToday=0;S.day=d;BOARD.dirty=true;if(typeof rollWeek==='function')rollWeek()}}
let saveTimer=null;
function dirty(){S.t=Date.now();clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,1500)}
function saveNow(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(S))}catch(e){}
  if(NET.db&&NET.uid&&!NET.saving){NET.saving=true;NET.db.doc('data/users/'+NET.uid+'/save').set(JSON.parse(JSON.stringify(S))).catch(()=>{}).finally(()=>{NET.saving=false})}}
function loadLocal(){try{const j=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(j&&j.v===2)return fixSave(j)}catch(e){}return null}

/* ---------------- shared board, feed and saves (db) ---------------- */
const NET={db:null,user:null,uid:null,dl:null,saving:false};
const BOARD={dirty:false,writing:false,docs:null,at:0,feed:null};
async function connect(){if(SERVER.on){if(!await serverConnect()){srvHud();return}}else{if(!window.claude||!window.claude.use)return;
  window.claude.use('downloads').then(d=>{NET.dl=d}).catch(()=>{});
  try{NET.db=await window.claude.use('db');NET.user=await window.claude.use('user');if(NET.user)NET.uid=await NET.user.id()}catch(e){NET.db=null}}
  if(!NET.db||!NET.uid)return;
  try{const snap=await NET.db.doc('data/users/'+NET.uid+'/save').get();if(snap.exists){const d=snap.data();if(d&&d.v===2&&(d.t||0)>(S.t||0)){S=fixSave(JSON.parse(JSON.stringify(d)));rollDay();onSaveSwapped()}}}catch(e){}
  BOARD.dirty=true;LEDGER.dirty=true;await fetchBoard();await fetchPools();
  // first visit: nothing old to claim
  if(!S.paidInit){S.paidInit=1;for(let n=1;n<=7;n++)S.paidD[dayAgo(n)]=1;for(let n=1;n<=3;n++)S.paidW[weekAgo(n)]=1;dirty()}
  checkPayouts()}
function boardDoc(){rollWeek();const keepD=Object.fromEntries(Object.entries(S.hist||{}).filter(([k])=>k>=dayAgo(8))),keepW=Object.fromEntries(Object.entries(S.whist||{}).filter(([k])=>k>=weekAgo(3)));
  return{name:S.name||COATI[S.coat].name,coat:S.coat,day:S.day,fish:S.today,prevDay:S.prevDay||'',prevFish:S.prevToday||0,week:S.week,wpts:S.wpts||0,hist:keepD,whist:keepW,lic:(S.lic||[]).slice(-3),t:Date.now()}}
async function flushBoard(){if(!BOARD.dirty||BOARD.writing||!NET.db||!NET.uid||!S.coat)return;BOARD.dirty=false;BOARD.writing=true;
  try{await NET.db.doc('board/'+NET.uid).set(boardDoc())}catch(e){}BOARD.writing=false}
async function fetchBoard(){if(!NET.db)return null;try{const q=await NET.db.collection('board').limit(500).get();BOARD.docs=q.docs.map(d=>Object.assign({id:d.id},d.data()));BOARD.at=Date.now()}catch(e){}
  try{const f=await NET.db.collection('wins').limit(200).get();const all=[];for(const d of f.docs){const v=d.data();for(const r of (v.items||[]))if(r&&r.fishId||r&&r.kind==='whale')all.push(Object.assign({uid:d.id},r))}all.sort((a,b)=>(b.at||0)-(a.at||0));BOARD.feed=all.slice(0,30)}catch(e){}
  return BOARD.docs}
function boardFor(day){if(!BOARD.docs)return[];return BOARD.docs.map(d=>({id:d.id,name:String(d.name||'Cat').slice(0,16),coat:COATI[d.coat]?d.coat:'ginger',fish:d.day===day?(d.fish|0):d.prevDay===day?(d.prevFish|0):0})).filter(r=>r.fish>0).sort((a,b)=>b.fish-a.fish)}
async function shareReplay(rp){if(!NET.db||!NET.uid){toast('Sign in to claude.ai to share');return false}
  try{const ref=NET.db.doc('wins/'+NET.uid);const cur=await ref.get();const items=(cur.exists&&Array.isArray(cur.data().items))?cur.data().items.slice(0,5):[];
    if(items.some(i=>i.at===rp.at)){toast('Already shared');return true}
    items.unshift(rp);await ref.set({name:S.name,coat:S.coat,items,t:Date.now()});rp.shared=1;dirty();toast('Shared to Big Catches');sfx('stamp');BOARD.at=0;return true}
  catch(e){toast('Could not share right now');return false}}

/* ---------------- view, camera and layout ---------------- */
const cv=$('cv'),g0=cv.getContext('2d');
let buf=null,g=null,VW=0,VH=0,SC=2,bgCv=null;
const LAY={};
const CAM={z:1,tz:1,fx:0,fy:0,tx:0,ty:0,shake:0,flash:0,flashCol:'#ffffff'};
function resize(){const w=innerWidth,h=innerHeight;SC=Math.max(2,Math.floor(Math.min(h/360,w/170)));VW=Math.ceil(w/SC);VH=Math.ceil(h/SC);
  cv.width=VW;cv.height=VH;cv.style.width=VW*SC+'px';cv.style.height=VH*SC+'px';g0.imageSmoothingEnabled=false;
  [buf,g]=mk(VW,VH);
  const L=LAY;L.deckY=Math.round(VH*.47);L.horizon=L.deckY-66;L.surfY=L.deckY+(SPOT&&SPOT.ground==='boat'?9:20);L.stageW=Math.min(VW,250);L.sx0=Math.floor((VW-L.stageW)/2);
  L.catoshiX=L.sx0+2;L.playerX=(SPOT&&SPOT.contest)?L.sx0+Math.round(L.stageW*.5)-15:L.sx0+Math.round(L.stageW*.28)-15;L.bucketX=L.playerX-22;const nR=L.stageW<230?2:3,r0=Math.max(2,L.sx0-10),gap=(L.playerX-r0)/nR;L.rivalX=[...Array(nR).keys()].map(i=>Math.round(r0+i*gap));L.pierEnd=(SPOT&&SPOT.ground==='pier')?VW:L.playerX+30;
  L.tokX=L.catoshiX+57;L.tokY=L.deckY-17;
  bgCv=null;placeSay();REC.resize()}
/* the scene is drawn at 1x into buf, then presented through the camera (zoom, shake, flash) */
function present(){let z=CAM.z;const sw=VW/z,sh=VH/z;let sx=clamp(CAM.fx-sw/2,0,VW-sw),sy=clamp(CAM.fy-sh/2,0,VH-sh);
  if(CAM.shake>0){sx+=(Math.random()-.5)*CAM.shake*2/z;sy+=(Math.random()-.5)*CAM.shake*2/z}
  g0.fillStyle='#000';g0.fillRect(0,0,VW,VH);g0.drawImage(buf,sx,sy,sw,sh,0,0,VW,VH);
  if(CAM.flash>0){g0.globalAlpha=Math.min(1,CAM.flash);g0.fillStyle=CAM.flashCol;g0.fillRect(0,0,VW,VH);g0.globalAlpha=1}
  CAM.view={sx,sy,sw,sh};if(RPLAY)drawCaption(g0);if(REC.on)REC.frame()}
function camUpdate(dt){CAM.z+=(CAM.tz-CAM.z)*Math.min(1,dt*3);CAM.fx+=(CAM.tx-CAM.fx)*Math.min(1,dt*4);CAM.fy+=(CAM.ty-CAM.fy)*Math.min(1,dt*4);CAM.shake=Math.max(0,CAM.shake-dt*8);CAM.flash=Math.max(0,CAM.flash-dt*2.5)}
function camFocus(x,y,z){CAM.tx=x;CAM.ty=y;CAM.tz=z}
function camReset(){CAM.tz=1;CAM.tx=VW/2;CAM.ty=VH/2}
// screen px -> scene px (through the camera)
function toScene(ev){const r=cv.getBoundingClientRect();const v=CAM.view||{sx:0,sy:0,sw:VW,sh:VH};return{x:v.sx+(ev.clientX-r.left)/r.width*v.sw,y:v.sy+(ev.clientY-r.top)/r.height*v.sh}}
/* sky, far sea, headland, lighthouse and the water body, rendered once per size */
const SKY=['#2a1d3a','#4a2848','#7a3550','#b04e4e','#dc6e44','#f2964a','#ffbe6a'];
const SEA_BAND=['#d08458','#8a6070','#4a5a7a','#36587a','#2e5070'];
const DEEP=['#2a6684','#215673','#1a4763','#143a54','#0f2e45','#0b2438'];
function band(c,y0,y1,stops){const n=stops.length-1;for(let y=y0;y<y1;y++){const t=(y-y0)/Math.max(1,y1-y0-1)*n;const i=Math.min(n-1,Math.floor(t)),f=t-i;for(let x=0;x<VW;x++){const d=DITH[y&3][x&3]/16;c.fillStyle=stops[f>d?i+1:i];c.fillRect(x,y,1,1)}}}
const ZPAL={harbour:{sea:SEA_BAND,deep:DEEP,floor:'#3a3a40'},shallows:{sea:['#d8a070','#8ab8a8','#5ab0b0','#4aa0aa','#3a90a0'],deep:['#3a9cac','#2f8c9e','#287c90','#226c82','#1c5e74','#164e64'],floor:'#c8b080'},
  estuary:{sea:['#c88a58','#8a8a68','#6a7a62','#5a6c5a','#4a5e52'],deep:['#4a6a5a','#3f5f50','#355448','#2c4a40','#243f38','#1c3430'],floor:'#3a3428'},
  reef:{sea:['#d08458','#6a90a8','#3a90b8','#2f80b0','#2870a8'],deep:['#2a86a6','#227a9a','#1c6c8e','#165f82','#115276','#0c4468'],floor:'#d8c8a0'},
  kelp:{sea:['#c88050','#5a8080','#3f7070','#356468','#2c5a60'],deep:['#2f6a6a','#275e60','#205256','#1a464c','#143a42','#0f3038'],floor:'#2a3a30'},
  wreck:{sea:['#c87a50','#4a6a8a','#3a5a7a','#304e6e','#284462'],deep:['#2a4a6a','#22405e','#1c3652','#162c46','#11243a','#0c1c30'],floor:'#2a2a30'},
  blue:{sea:['#c88050','#3a6aa8','#2f5fa0','#285598','#224a8e'],deep:['#24509a','#1e468c','#193c7e','#143270','#102862','#0c2054'],floor:'#1a2a4a'},
  deep:{sea:['#a86a50','#2a3a6a','#24325e','#1e2a52','#182246'],deep:['#1c2650','#172044','#121a38','#0e152e','#0a1024','#070b1a'],floor:'#0e0e1a'}};
function buildBg(){const[c,x]=mk(VW,VH);const L=LAY;const Z=ZPAL[SPOT?SPOT.zone:'harbour']||ZPAL.harbour;const zk=SPOT?SPOT.zone:'harbour';
  band(x,0,L.horizon,SKY);
  const sx=L.sx0+Math.round(L.stageW*.58),sy=L.horizon-4;ell(x,sx,sy,19,19,'#ffcf7a');ell(x,sx,sy,16,16,'#ffe1a0');ell(x,sx,sy,12,12,'#fff0c8');
  x.fillStyle='#4a2a48';for(let i=0;i<VW;i++){const h=Math.max(0,Math.round(7*Math.sin(i*.045+1)+5*Math.sin(i*.11)+3-(i>VW*.45?12:0)));if(h>0)x.fillRect(i,L.horizon-h,1,h)}
  band(x,L.horizon,L.surfY,Z.sea);
  if(zk==='harbour'||zk==='reef')try{const lh=artLighthouse();const rx=VW-lh.width-4;x.drawImage(lh,rx,L.horizon+8-lh.height);x.globalAlpha=.22;x.globalCompositeOperation='source-atop';x.fillStyle='#ff9a50';x.fillRect(rx,0,lh.width,L.horizon+8);x.globalCompositeOperation='source-over';x.globalAlpha=1}catch(e){}
  band(x,L.surfY,VH,Z.deep);
  x.fillStyle=Z.floor;x.fillRect(0,VH-10,VW,10);for(let i=0;i<VW;i+=3){x.fillStyle=i%2?shade(Z.floor,.12):shade(Z.floor,-.15);x.fillRect(i,VH-11-((i*7)%3),2,2)}
  if(zk==='reef')for(let k=0;k<VW;k+=19){const kx=(k*29)%VW,col=['#ff8a7a','#ffb15a','#c87ad8','#7ad8c8'][k%4];ell(x,kx,VH-12,4+(k%3),3+(k%4),col);ell(x,kx+5,VH-15,2,4,shade(col,-.2))}
  if(zk==='shallows')for(let k=0;k<VW;k+=23){const kx=(k*31)%VW;x.fillStyle=k%2?'#ff9a6a':'#f4e8d0';x.fillRect(kx,VH-12,3,2);x.fillRect(kx+1,VH-13,1,4)}
  const kelpN=zk==='kelp'?9:zk==='estuary'?0:37;if(kelpN)for(let k=0;k<VW;k+=kelpN){const kx=(k*53)%VW;for(let y=VH-10;y>VH-(zk==='kelp'?110:48)-(k%20);y--){x.fillStyle=y%4<2?'#1f5a45':'#18493a';x.fillRect(kx+Math.round(Math.sin(y*.25)*1.5),y,2,1)}}
  bgCv=c}

/* ---------------- particles ---------------- */
const PART=[];
function splash(x,y,n=10,pow=1,col){for(let i=0;i<n;i++){const a=-Math.PI/2+(Math.random()-.5)*1.6;const v=(25+Math.random()*45)*pow;PART.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.5+Math.random()*.6*pow,t:0,g:140,col:col||(Math.random()<.5?'#dff4ff':'#9fd0e0'),s:Math.random()<.25*pow?2:1})}}
function sparkle(x,y,n=8,col='#ffe08a'){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=15+Math.random()*35;PART.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.5+Math.random()*.5,t:0,g:0,col,s:1,tw:1})}}
function coinBurst(x,y,n=14){for(let i=0;i<n;i++){const a=-Math.PI/2+(Math.random()-.5)*2.2,v=40+Math.random()*60;PART.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1.4,t:0,g:160,coin:1})}}
function ripple(x,y,r=12){PART.push({x,y,ring:r,life:.9,t:0,vx:0,vy:0,g:0})}
function partUpdate(dt){for(let i=PART.length-1;i>=0;i--){const p=PART[i];p.t+=dt;if(p.t>=p.life){PART.splice(i,1);continue}p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}}
function partDraw(){for(const p of PART){const k=p.t/p.life;
  if(p.ring){g.strokeStyle=`rgba(220,240,255,${.6*(1-k)})`;g.lineWidth=1;g.beginPath();g.ellipse(Math.round(p.x),Math.round(p.y),p.ring*(.3+k),p.ring*(.3+k)*.3,0,0,Math.PI*2);g.stroke();continue}
  if(p.coin){g.drawImage(rushToken(8),Math.round(p.x-4),Math.round(p.y-4));continue}
  if(p.tw&&((p.t*20)|0)%2)continue;g.fillStyle=p.col;g.fillRect(Math.round(p.x),Math.round(p.y),p.s,p.s)}}
const FX=[];
function flyFish(img,x0,y0){const cat=false;FX.push({k:'fly',img,x0,y0,x1:cat?LAY.catoshiX+30:LAY.bucketX+6,y1:cat?LAY.deckY-20:LAY.deckY-10,t:0,d:.7})}
function popText(s,x,y,col='#fff6e0',d=1){FX.push({k:'txt',t:0,d,s,x,y,col})}

/* ---------------- sheets + little UI helpers ---------------- */
const SHEET={kind:null,forced:false};
function showSheet(kind,title,build,forced){SHEET.kind=kind;SHEET.forced=!!forced;$('shT').textContent=title;const b=$('shB');b.innerHTML='';build(b);b.scrollTop=0;$('sheet').hidden=false;$('veil').hidden=false;$('shX').hidden=!!forced;hideCard(true)}
function closeSheet(){if(SHEET.forced&&!S.coat)return;$('sheet').hidden=true;$('veil').hidden=true;SHEET.kind=null;SHEET.forced=false}
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
function btn(cls,text,fn){const b=el('button',cls);b.textContent=text;b.onclick=e=>{e.stopPropagation();sfx('click');fn()};return b}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function cvOf(img,w,h,css){const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.className='pix';if(css)c.style.cssText=css;c.getContext('2d').drawImage(img,0,0);return c}
const faceCv=k=>cvOf(catFace(k));
const coinCv=()=>cvOf(rushToken(16),16,16,'width:16px;height:16px');
function row(coat,title,sub,num){const r=el('div','row');r.append(coat?faceCv(coat):el('span'));const t=el('div','tx');t.append(el('b','',esc(title)));if(sub)t.append(el('small','',esc(sub)));r.append(t);if(num!=null&&num!=='')r.append(el('span','num',esc(num)));return r}
function portraitCatoshi(){const p=el('div','portrait');p.append(cvOf(catoshiArt(2),0,0,'width:120px;height:128px'));return p}
function portraitCat(k){const p=el('div','portrait');p.append(cvOf(catSide(k),0,0,'width:120px;height:112px'));return p}
let toastT=null;function toast(t){const T=$('toast');T.textContent=t;T.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>T.hidden=true,1600)}
let sayT=null;let catoshiWave=0,catoshiBlink=3;
function say(t,ms=3500,wave=0){if(MODE!=='world')return;$('sayTx').textContent=t;$('say').classList.remove('off');clearTimeout(sayT);sayT=setTimeout(()=>$('say').classList.add('off'),ms);if(wave)catoshiWave=wave;placeSay()}
function placeSay(){const s=$('say');if(!WLD||MODE!=='world')return;const T=WLD.throne;const x=(T.cx-worldCam.x-60),y=(T.y-worldCam.y-2);const off=y<20||y>VH-40||x<-160||x>VW;s.style.visibility=off?'hidden':'visible';s.style.left=clamp(x*SC,8,innerWidth-200)+'px';s.style.bottom=Math.max(60,(VH-y)*SC)+'px'}
function refreshHud(){if(!S)return;$('bal').textContent=fmt(S.bal);if(S.coat){$('whoName').textContent=S.name||COATI[S.coat].name;const x=$('whoFace').getContext('2d');x.clearRect(0,0,24,22);x.drawImage(catFace(S.coat),0,0)}
  $('whoSub').textContent=`${S.today} FISH TODAY`;$('sndBtn').textContent=S.sound?'SOUND ON':'SOUND OFF';
  const bc=$('baitIco').getContext('2d');bc.clearRect(0,0,16,16);const bi=baitIcon(S.baitSel);bc.drawImage(bi,Math.floor((16-bi.width)/2),Math.floor((16-bi.height)/2));$('baitN').textContent=S.bait[S.baitSel]||0;$('whoSub').textContent=`${fmt(S.today)} PTS  BAG ${(S.bag||[]).length}/${bagCap()}`;
  $('autoBtn').classList.toggle('on',!!S.auto);$('autoBtn').innerHTML=S.auto?`AUTO ON<small>${AUTO_COST} / CAST</small>`:`AUTO<small>${AUTO_COST} / CAST</small>`;
  const back=Object.keys(S.trips).some(k=>Date.now()>=S.trips[k].end);$('nTrips').classList.toggle('on',back)}
