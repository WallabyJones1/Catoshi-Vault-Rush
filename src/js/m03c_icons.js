/* ================= ART: UI icons, gear, bait and boat icons (16x16) ================= */
function icon16(rows,pal){const[c,x]=mk(16,16);const w=Math.max(...rows.map(r=>r.length)),h=rows.length;stamp(x,rows,Object.assign({k:K},pal),Math.floor((16-w)/2),Math.floor((16-h)/2));return c}
const UI_ICON={
 bag:[['..kkkkkk..','.kk....kk.','.k......k.','kkkkkkkkkk','kBBBBBBBBk','kBbkkkkbBk','kBBkyykBBk','kBBBkkBBBk','kBBBBBBBBk','kddddddddk','.kkkkkkkk.'],{B:'#c98a52',b:'#e0b07a',d:'#8f5f43',y:'#ffd24d'}],
 build:[['.kkkkkk...','kHHHHHHk..','kHhhhhHkk.','kkkkkkHHk.','....kwkkk.','....kwk...','....kwk...','....kwk...','....kwk...','....kkk...'],{H:'#9d9ab3',h:'#c9c6d8',w:'#d39c64'}],
 map:[['kkkkkkkkkkk','kGGgkBBBbGk','kGgGkBBbGGk','kgGrrrBGGgk','kGrkGGGGgGk','krkGgGkkGGk','kGGgGkyykGk','kGgGGGkkGgk','kkkkkkkkkkk'],{G:'#7cc46a',g:'#579a4f',B:'#5ea9d8',b:'#8fd0ea',r:'#e9675a',y:'#ffd24d'}],
 jobs:[['...kkkk...','.kkkYYkkk.','kWWkkkkWWk','kWkkWWWWWk','kWWWWWWWWk','kWkkWWWWWk','kWWWWWWWWk','kWkkWWWWWk','kWWWWWWWWk','kkkkkkkkkk'],{W:'#fff4e0',Y:'#ffd24d'}],
 chat:[['.kkkkkkkk.','kWWWWWWWWk','kWkWkWkWWk','kWWWWWWWWk','kWWWWWWWWk','.kkWkkkkk.','..kWk.....','..kk......'],{W:'#ffffff'}],
 menu:[['...kkkk...','..kWWWWk..','kkkWkkWkkk','kWWkkkkWWk','kWkk..kkWk','kWkk..kkWk','kWWkkkkWWk','kkkWkkWkkk','..kWWWWk..','...kkkk...'],{W:'#e4e2ee'}],
 hand:[['...k.k....','..kWkWk...','..kWkWkk..','.kkWkWkWk.','kWkWWWWWk.','kWWWWWWWk.','.kWWWWWWk.','..kWWWWk..','...kkkk...'],{W:'#ffe0c8'}],
 door:[['.kkkkkkk.','kWWWWWWWk','kWkkkkkWk','kWkdddkWk','kWkdddkWk','kWkddykWk','kWkdddkWk','kWkdddkWk','kkkkkkkkk'],{W:'#ecc48e',d:'#8f5f43',y:'#ffd24d'}],
 sleep:[['......kkkk','........k.','.......k..','..kkk.kkkk','....k.....','...k......','..kkk.....'],{}],
 cook:[['..k.k.k...','.k.k.k....','..........','kkkkkkkkkk','kMmmmmmmMkkk','kmmmmmmmmkWk','.kkkkkkkk.kk'],{M:'#c9c6d8',m:'#6d6880',W:'#a8754d'}],
 shop:[['..kkkk..','.kyYYyk.','kyYyyYdk','kYyYyydk','kYyyyydk','kyyyyddk','.kddddk.','..kkkk..'],{y:'#ffd24d',Y:'#fff3b0',d:'#c98a1e'}],
 capsule:[['..kkkk..','.kRRRWk.','kRRRRRRk','kkkkkkkk','kCCCCCCk','kCCCCCdk','.kddddk.','..kkkk..'],{R:'#ff7a6b',W:'#ffd0c8',C:'#fbf1dc',d:'#d9cbb0'}],
 talk:[['.kkkkkkk.','kWWWWWWWk','kWkkkkkWk','kWWWWWWWk','kWkkkkWWk','.kkkWkkk.','...kk....'],{W:'#ffffff'}],
 store:[['kkkkkkkkkk','kWWWWWWWWk','kWddddddWk','kWkkkkkkWk','kWWWyyWWWk','kWddddddWk','kddddddddk','kkkkkkkkkk'],{W:'#d39c64',d:'#8f5f43',y:'#ffd24d'}],
 book:[['.kkkkkkkkkk.','kRRRRkRRRRRk','kRwwRkRwwwRk','kRRRRkRRRRRk','kRwwRkRwwwRk','kRRRRkRRRRRk','kRwwRkRRRRRk','kRRRRkRRYRRk','kkkkkkkkkkkk','.kddddddddk.'],{R:'#3f7a8a',w:'#bfe8e0',Y:'#ffd24d',d:'#2a4a52'}],
 coop:[['kk........','kWkkkkkk..','kWRRRWWWk.','kWRRRWWWWk','kWWWRRRRk.','kWkkkkkk..','kW........','kW........','kW........','kk........'],{W:'#e8e2d0',R:'#c8443a'}],
 rod:[['..........kk','.........kWk','........kWk.','.......kWk..','......kWk...','..kk.kWk...','.kGGkWk.....','.kGkkk......','.kkWk.......','kWWk........','kkk.........'],{W:'#c8a070',G:'#b8bcc8'}],
 boat:[['.....kk.....','.....kWk....','.....kWWk...','.....kWWWk..','.....kkkkkk.','kkkkkkkkkkkk','kRRRRRRRRRRk','.kRRRRRRRRk.','..kkkkkkkk..'],{W:'#fbf6ea',R:'#c86a3a'}],
 anchor:[['....kk....','...kWWk...','...kkkk...','kkkkWWkkkk','kWWWWWWWWk','kkkkWWkkkk','k...kWk..k','kWk.kWk.kWk','.kWkkWkkWk.','..kWWWWWk..','...kkkkk...'],{W:'#b8bcc8'}],
 pot:[['.kkkkkkkk.','kWkWkWkWWk','kkWkWkWkkk','kWkWkWkWWk','kkWkWkWkkk','kWkWkWkWWk','kkkkkkkkkk'],{W:'#c8a070'}],
 shovel:[['.......kk','......kWk','.....kWk.','....kWk..','..kkWk...','.kSSkk...','kSSSSk...','kSSSk....','.kkk.....'],{W:'#c8a070',S:'#b8bcc8'}],
 grapple:[['...kk...','..kWWk..','...kk...','...kk...','k..kk..k','kWkkkkWk','.kWWWWk.','..kkkk..'],{W:'#8a8a96'}],
 crew:[['..kkk.kkk..','.kSSSkSSSk.','.kSkSkSkSk.','.kSSSkSSSk.','kkkkkkkkkkk','kBBBkkkRRRk','kBBBBkRRRRk','kkkkkkkkkkk'],{S:'#f0c8a0',B:'#3f86bd',R:'#c8443a'}],
 shell:[['....kkk....','..kkPPPkk..','.kPpPpPpPk.','kPpPpPpPpPk','kpPpPpPpPpk','.kpPpPpPpk.','..kkpPpkk..','...kkkkk...'],{P:'#f4c8b0',p:'#e08a6a'}],
 reel:[['...kkkk...','..kYyyYk..','.kYyYYyYk.','kYyYkkYyYk','kyYk..kYyk','kyYk..kYyk','kYyYkkYyYk','.kYyYYyYk.','..kYyyYk..','...kkkk...'],{Y:'#ffd24d',y:'#c8901a'}],
 fuel:[['.kkkkkk..','kRRRRRRkk','kRkkkkRkWk','kRkRRkRkWk','kRkkkkRk.k','kRRRRRRk..','kRRRRRRk..','kkkkkkkk..'],{R:'#d83a3a',W:'#b8bcc8'}],
 hook:[['...kk..','..kWWk.','...kWk.','...kWk.','k..kWk.','kWkkWk.','.kWWk..','..kk...'],{W:'#b8bcc8'}],
 fish:[['.....kkkkk......','...kkFFFFFkk.kk.','..kFFFfFFFFFkFk.','.kWkFFFFFFFFkFk.','kFFFFFFFFFFFFk..','.kbbbbbbbbbbkFk.','..kkkkkkkkkk.kk.'],{F:'#5ea9d8',f:'#bfe8f4',b:'#d6f2f8',W:'#ffffff'}],
 trophy:[['kkkkkkkkkk','kYkYYYYkYk','kYkYyYYkYk','.kkYyYYkk.','..kYYYYk..','...kYYk...','...kYYk...','..kkkkkk..','..kyyyyk..','..kkkkkk..'],{Y:'#ffd24d',y:'#c8901a'}],
 sun:[['...k..k...','k..kyyk..k','.kkyYYykk.','..kYYYYk..','kkyYYYYykk','..kYYYYk..','.kkyYYykk.','k..kyyk..k','...k..k...'],{Y:'#ffd24d',y:'#ffb03a'}],
 moon:[['..kkkk..','.kWWkk..','kWWk....','kWWk....','kWWk....','kWWWk...','.kWWWkkk','..kkkk..'],{W:'#e8e4f4'}],
 cloud:[['...kkkk....','..kWWWWk...','.kWWWWWWkk.','kkWWWWWWWWk','kWWWWWWWWWk','kWWWWWWWWWk','.kkkkkkkkk.'],{W:'#e8eef4'}],
 rain:[['...kkkk....','..kWWWWk...','.kWWWWWWkk.','kWWWWWWWWWk','.kkkkkkkkk.','..b..b..b..','.b..b..b...'],{W:'#b8c4d4',b:'#5ea9d8'}],
 storm:[['...kkkk....','..kWWWWk...','.kWWWWWWkk.','kWWWWWWWWWk','.kkkkYkkkk.','....YY.....','...YY......','....Y......'],{W:'#7a849a',Y:'#ffd24d'}],
 fog:[['kkkkkkkkk.','.WWWWWWWWk','kkkkkkkkk.','.kWWWWWWWk','kkkkkkkkk.','.WWWWWWWWk','kkkkkkkkk.'],{W:'#d8dce4'}],
 wind:[['......kk..','kkkkkkWWk.','.WWWWWWWk.','kkkkkkkk..','.kkkkkkkk.','.WWWWWWWWk','..kkkkkWk.','......kk..'],{W:'#d8e4f0'}],
 tide:[['..........','.kk..kk...','kWWkkWWkk.','WkkWWkkWWk','..........','.kk..kk...','kBBkkBBkk.','BkkBBkkBBk'],{W:'#bfe8f4',B:'#5ea9d8'}],
 lamp:[['...kkk...','..kYYYk..','.kYyYYYk.','.kYYYYYk.','..kkkkk..','..kSSSk..','..kSSSk..','.kkkkkkk.'],{Y:'#fff0a0',y:'#ffffff',S:'#5a5a66'}],
 camera:[['..kkk.....','kkkWkkkkkk','kGGGGGGGGk','kGGkkkkGGk','kGkBBBBkGk','kGkBWBBkGk','kGGkkkkGGk','kkkkkkkkkk'],{G:'#5a5a66',W:'#ffffff',B:'#3f86bd'}],
 exchange:[['...kk.....','..kYYk....','.kYkkYkkk.','kYk..kRRk.','kYk.kRkkRk','.kkkRk..Rk','....kRkkRk','.....kRRk.','......kk..'],{Y:'#ffd24d',R:'#7fdcc0'}],
 lighthouse:[['...kk...','..kRRk..','..kYYk..','.kkkkkk.','..kRRk..','..kWWk..','..kRRk..','.kWWWWk.','.kRRRRk.','kkkkkkkk'],{R:'#d83a3a',W:'#fbf6ea',Y:'#ffd24d'}],
 net:[['k.k.k.k.k','.k.k.k.k.','k.k.k.k.k','.k.k.k.k.','k.k.k.k.k','.k.k.k.k.','kkkkkkkkk','...kWk...','...kWk...'],{W:'#c8a070'}],
 dive:[['..kkkk..','.kSSSSk.','kSkBBkSk','kSBWBBSk','kSkBBkSk','.kSSSSk.','..kSSk..','.kkkkkk.'],{S:'#c89a48',B:'#5ea9d8',W:'#ffffff'}],
 gift:[['..k...k..','.kRk.kRk.','..kRkRk..','kkkkkkkkk','kGGGRGGGk','kkkkkkkkk','.kGGRGGk.','.kGGRGGk.','.kkkkkkk.'],{R:'#d83a4a',G:'#7fdcc0'}],
 wallet:[['.kkkkkkkk.','kPPPPPPPPk','kPkkkkkkkk','kPkPPPPkYk','kPkkkkkkkk','kPPPPPPPPk','.kkkkkkkk.'],{P:'#8a5ac8',Y:'#ffd24d'}],
 x:[['kk.....kk','kWk...kWk','.kWk.kWk.','..kWkWk..','...kWk...','..kWkWk..','.kWk.kWk.','kWk...kWk','kk.....kk'],{W:'#fbf6ea'}]};
const uiCache=new Map();function uiIcon(k){if(uiCache.has(k))return uiCache.get(k);let c;if(UI_ICON[k]){const[rows,pal]=UI_ICON[k];c=icon16(rows,Object.assign({k:K},pal))}else c=gearIcon(k);uiCache.set(k,c);return c}
// gear: rods, reels, line, hooks, engines, tanks, ice, sonar, lamps; tier tints the metal
const TIER_COL=[['#b8bcc8','#e4e2ee','#7c7894'],['#c8a070','#ecc48e','#8f5f43'],['#5ea9d8','#bfe8f4','#2f6596'],['#ffd24d','#fff3b0','#c98a1e'],['#ff6fd0','#ffd6f4','#a83a90']];
function gearIcon(key){const m=/^(rod|reel|line|hook|engine|tank|ice|sonar|lamp|bait|boat)(?:_?)([a-z0-9]*)$/.exec(key);if(!m)return icon16(UI_ICON.hand[0],UI_ICON.hand[1]);const kind=m[1],arg=m[2];const t=Math.max(0,Math.min(4,parseInt(arg)||0));const[A,B,C]=TIER_COL[t];
  switch(kind){case'rod':return icon16(UI_ICON.rod[0],{W:A,G:'#3a3a40'});
    case'reel':return icon16(['...kkkk...','..kAAaAk..','.kAaBBaAk.','kAaBkkBaAk','kAaBkkBaAk','kAaaBBaaAk','.kAaaaaAk.','..kkkkkkkk','.......kGk','.......kk.'],{A,a:C,B,G:'#3a3a40'});
    case'line':return icon16(['..kkkkkk..','.kAAAAAAk.','kkkkkkkkkk','kBBBBBBBBk','kBbBbBbBBk','kBBBBBBBBk','kkkkkkkkkk','.kAAAAAAk.','..kkkkkk..'],{A:'#8a6a4a',B:A,b:B});
    case'hook':return icon16(UI_ICON.hook[0],{W:A});
    case'engine':return icon16(['.kkkkkk.','kAAAAAAk','kABBBBAk','kAAAAAAk','.kkAAkk.','..kAAk..','..kAAk..','.kkAAkk.','kCCkkCCk','.kk..kk.'],{A:'#3a3a40',B,C:A});
    case'tank':return icon16(UI_ICON.fuel[0],{R:A,W:'#b8bcc8'});
    case'ice':return icon16(['kkkkkkkkkk','kWWWWWWWWk','kkkkkkkkkk','kAAAAAAAAk','kABBkkBBAk','kAAAAAAAAk','kAAAAAAAAk','kkkkkkkkkk'],{W:'#fbf6ea',A,B:'#ffffff'});
    case'sonar':return icon16(['.kkkkkkkk.','kGGGGGGGGk','kGkkkkkkGk','kGkBbBBkGk','kGkBBbBkGk','kGkbBBBkGk','kGkkkkkkGk','kGGGGGGGGk','.kkkkkkkk.'],{G:'#5a5a66',B:'#1f4a3a',b:A});
    case'lamp':return icon16(UI_ICON.lamp[0],{Y:t?'#ffffff':'#fff0a0',y:'#ffffff',S:A});
    case'bait':return baitIcon(arg);case'boat':return boatIcon(arg)}}
const BAIT_PAL={dough:['#f4e4c0','#d8c090'],worm:['#d8806a','#a8504a'],prawn:['#f0a080','#c86a50'],pilchard:['#a8b8c8','#5a6a7a'],squid:['#f4e8f0','#c8a8c0'],weedbait:['#6a9a4a','#3a6a2a'],crabbait:['#d86a3a','#a84a2a'],squidjig:['#ff8ad0','#c84aa0'],popper:['#f0a040','#c86a1a'],metal:['#d8dce8','#8a8ea0'],livebait:['#7ab0d0','#3a6a8a'],glow:['#8af0ff','#3ab0c8']};
function baitIcon(k){const[A,B]=BAIT_PAL[k]||BAIT_PAL.dough;const L=BAIT[k]&&BAIT[k].lure;
  if(k==='dough')return icon16(['..kkkkk..','.kAAAAAk.','kAAaAAAak','kAaAAaAAk','kAAAAAaAk','.kAaAAAk.','..kkkkk..'],{A,a:B});
  if(k==='worm')return icon16(['.kk....kk..','kAAk..kAAk.','kAkAkkAkAk.','.kAAAAAkkAk','..kkkkk.kAk','.........kk'],{A});
  if(L)return icon16(['......kk.','.....kAk.','..kkkAAk.','.kAAAAak.','kAAaaak..','kAaak....','.kkk.....','.kSk.....','kSk......'],{A,a:B,S:'#b8bcc8'});
  return icon16(['.....kkkkk..','...kkAAAAAkk','..kAAaaaAAkA','.kWkAAAAAAkA','kAAAAAAAAk.A','.kaaaaaaak.k','..kkkkkkk...'],{A,a:B,W:'#ffffff'})}
function boatIcon(k){const b=BOATI[k]||BOATS[0];return icon16(UI_ICON.boat[0],{W:'#fbf6ea',R:b.hull})}
/* extra furniture / appliances */
Object.assign(FURN,{chair:{n:'Wood Chair',w:1,h:1},desk:{n:'Writing Desk',w:2,h:1},wardrobe:{n:'Wardrobe',w:2,h:1},chest:{n:'Storage Chest',w:1,h:1},easel:{n:'Easel',w:1,h:1},stove:{n:'Stove',w:1,h:1},radio:{n:'Radio',w:1,h:1},computer:{n:'Computer',w:2,h:1},washer:{n:'Washer',w:1,h:1},fan:{n:'Fan',w:1,h:1},neon:{n:'ODD Neon Sign',w:2,h:1,odd:1},crystal:{n:'Crystal Lamp',w:1,h:1,odd:1},jukebox:{n:'Jukebox',w:1,h:1,odd:1},throne:{n:'Velvet Throne',w:1,h:1,odd:1}});
function artFurnX(k){const W=PAL.wood;
  if(k==='neon'){const[c,x]=mk(32,22);ell(x,16,21,14,1.5,SHADOW);R(x,1,2,30,17,K);R(x,2,3,28,15,'#1a1030');for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]])drawTextM(x,'REEL',8+dx,6+dy,'rgba(255,111,208,.35)');drawTextM(x,'REEL',8,6,'#ff9fe0');R(x,4,15,24,1,'#6fe8ff');P(x,3,4,'#6fe8ff');P(x,28,4,'#6fe8ff');R(x,6,19,2,3,K);R(x,24,19,2,3,K);return c}
  if(k==='crystal'){const[c,x]=mk(14,26);ell(x,7,24,6,1.6,SHADOW);R(x,3,19,8,5,K);R(x,4,20,6,3,'#5a4d70');R(x,4,20,6,1,'#8a7fa8');const cr=[['....kk....','...kAk....','..kAak....','.kAaakk...','.kAaaAk...','kAaaaAak..','kAaaaaak..','.kaaaak...','..kkkk....'],{k:K,A:'#e4fbff',a:'#7fe8f0'}];x.drawImage(pm(...cr),2,9);x.globalAlpha=.4;ell(x,7,13,6,6,'#7fe8f0');x.globalAlpha=1;return c}
  if(k==='jukebox'){const[c,x]=mk(16,28);ell(x,8,26,7,1.8,SHADOW);R(x,1,4,14,22,K);R(x,2,5,12,20,'#c7384a');ell(x,8,6,7,5,K);ell(x,8,6,6,4,'#c7384a');R(x,4,4,8,6,'#ffd24d');R(x,5,5,6,4,'#fff3b0');for(let i=0;i<3;i++)R(x,3+i*4,12,2,7,['#ff6fd0','#7fe8f0','#ffcf4a'][i]);R(x,3,20,10,4,K);for(let i=0;i<4;i++)R(x,4+i*2,21,1,2,'#5a4d70');R(x,2,25,12,1,'#8a2030');return c}
  if(k==='throne'){const[c,x]=mk(16,28);ell(x,8,26,7,1.8,SHADOW);R(x,2,0,12,20,K);R(x,3,1,10,18,'#d9a520');R(x,4,2,8,15,'#8a2a5a');R(x,5,3,6,13,'#b8407a');P(x,8,0,'#ffd24d');P(x,4,0,'#ffd24d');P(x,11,0,'#ffd24d');R(x,1,15,14,6,K);R(x,2,16,12,4,'#b8407a');R(x,2,16,12,1,'#d86aa0');R(x,1,20,14,2,'#d9a520');R(x,2,22,2,4,K);R(x,12,22,2,4,K);return c}
  if(k==='chair')return pm(['..kkkkkkkk..','..kWWWWWWk..','..kwkkkkwk..','..kWWWWWWk..','..kwkkkkwk..','..kWWWWWWk..','.kkkkkkkkkk.','.kWWWWWWWWk.','.kwwwwwwwwk.','.kkkkkkkkkk.','.kdk....kdk.','.kdk....kdk.','.kkk....kkk.'],{k:'#3a2420',W:W[4],w:W[3],d:W[2]});
  if(k==='desk')return pm(['kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk','kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kdddddddddkkkkkkkkkkkkkkdddddddk','kdkkkkkkdk............kdkkkkkdk.','kddddyddddk...........kddddyddk.','kdkkkkkkdk............kdkkkkkdk.','kddddyddddk...........kddddyddk.','kkkkkkkkkk............kkkkkkkkk.'].map(r=>r.padEnd(32,'.').slice(0,32)),{k:'#3a2420',W:W[4],w:W[3],d:W[2],y:'#ffd24d'});
  if(k==='wardrobe'){const[c,x]=mk(32,36);ell(x,16,34,15,2,SHADOW);R(x,0,0,32,34,K);R(x,1,1,30,32,W[3]);R(x,1,1,30,2,W[4]);R(x,15,3,2,30,K);for(const dx of[3,18]){R(x,dx,4,11,26,W[2]);R(x,dx+1,5,9,24,W[3]);R(x,dx+1,5,9,1,W[4])}P(x,13,18,'#ffd24d');P(x,18,18,'#ffd24d');R(x,1,31,30,2,W[1]);return c}
  if(k==='chest')return pm(['.kkkkkkkkkkkkk.','kWWWWWWWWWWWWWk','kwwwwwwwwwwwwwk','kMMMMMMyMMMMMMk','kkkkkkkYkkkkkkk','kWWWWWWyWWWWWWk','kwwwwwwwwwwwwwk','kMMMMMMMMMMMMMk','kwwwwwwwwwwwwwk','kkkkkkkkkkkkkkk'],{k:'#3a2420',W:W[4],w:W[3],M:'#8f8aa6',y:'#ffd24d',Y:'#fff3b0'});
  if(k==='easel')return pm(['..kkkkkkkkkk..','..kBBBBBBBBk..','..kBBByyBBBk..','..kBgGgBBBBk..','..kgGgGgGBBk..','..kGgGgGgGgk..','..kkkkkkkkkk..','...kwk..kwk...','...kwkkkkwk...','..kwk....kwk..','..kwk....kwk..','.kwk......kwk.','.kkk......kkk.'],{k:'#3a2420',B:'#9fd6ea',y:'#fff0a0',g:'#579a4f',G:'#7cc46a',w:W[3]});
  if(k==='stove')return pm(['kkkkkkkkkkkkkkkk','kWWWWWWWWWWWWWWk','kWkkkWWWWWWkkkWk','kWkrkWWWWWWkrkWk','kWkkkWWWWWWkkkWk','kddddddddddddddk','kWyWyWyWWWWWWWWk','kkkkkkkkkkkkkkkk','kWkkkkkkkkkkkkWk','kWkggggggggggkWk','kWkgGgggggggGkWk','kWkggggggggggkWk','kWkkkkkkkkkkkkWk','kWWWWWWWWWWWWWWk','kddddddddddddddk','kkkkkkkkkkkkkkkk'],{W:'#e4e2ee',d:'#9d9ab3',r:'#e9675a',y:'#3a3346',g:'#2a2236',G:'#ff9b3d'});
  if(k==='radio')return pm(['..........k.','.........k..','kkkkkkkkkkkk','kRRRRRRRRRRk','kRkkkkkRyRRk','kRkmmmkRRRRk','kRkmMmkRyRRk','kRkkkkkRRRRk','kddddddddddk','kkkkkkkkkkkk'],{R:'#e9675a',m:'#3a3346',M:'#6d6880',y:'#ffd24d',d:'#b5473c'});
  if(k==='computer')return pm(['.........kkkkkkkkkkkkkk.........','.........kbbbbbbbbbbbbk.........','.........kbBBbbbbbbbbbk.........','.........kbBbbbgbbbbbbk.........','.........kbbbbbbbbbbbbk.........','.........kkkkkkkkkkkkkk.........','..............kkkk..............','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kWWWWWWWWWkMMMMMMMMMkWWWWWWWWWWk','kwwwwwwwwwkkkkkkkkkkkwwwwwwwwwwk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kdk..........................kdk','kdk..........................kdk','kkk..........................kkk'],{b:'#2a3d66',B:'#7fdcc0',g:'#ffd24d',W:W[4],w:W[3],d:W[2],M:'#c9c6d8'});
  if(k==='washer')return pm(['kkkkkkkkkkkkkk','kWWWWWWWWWWWWk','kWkkWWWWWyrWWk','kddddddddddddk','kWWWWkkkkWWWWk','kWWWkbbbbkWWWk','kWWkbBbbbbkWWk','kWWkbbbbbbkWWk','kWWkbbbbbBkWWk','kWWWkbbbbkWWWk','kWWWWkkkkWWWWk','kWWWWWWWWWWWWk','kddddddddddddk','kkkkkkkkkkkkkk'],{W:'#ffffff',d:'#b5c0cc',b:'#5ea9d8',B:'#d6f2f8',y:'#7fdcc0',r:'#e9675a'});
  if(k==='fan')return pm(['..kkkkkkk..','.kMkkkkkMk.','kMkbbkbbkMk','kMkbbkbbkMk','kMkkkYkkkMk','kMkbbkbbkMk','kMkbbkbbkMk','.kMkkkkkMk.','..kkkkkkk..','.....k.....','.....k.....','.....k.....','.....k.....','.....k.....','...kkkkk...','..kMMMMMk..','..kkkkkkk..'],{M:'#e4e2ee',b:'#9fd6ea',Y:'#ffd24d'});
  return null}

