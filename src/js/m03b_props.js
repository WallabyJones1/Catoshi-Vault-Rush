/* ================= ART: world props for the expanded map ================= */
const BLD2={
  bank:[7,3,3,{wall:'#eceaf2',roof:'#5d6d8f',flat:1,mat:'stone',door:3,win:[1,5],columns:[34,70],label:'BANK',labelBg:'#ffd24d',trim:'#ffffff',lamp:1,doorC:'#3f5f8f'}],
  furn:[6,3,3,{wall:'#d8a46c',mat:'siding',roof:'#8a4a3a',door:3,display:[0,4],displayKind:'furn',awning:['#5a8a6a','#f4ead8'],label:'FURNITURE',doorC:'#5a8a6a'}],
  appl:[6,3,3,{wall:'#a9bdd0',mat:'plaster',roof:'#3f4f6a',door:3,display:[0,4],displayKind:'appl',label:'APPLIANCES',labelBg:'#7fdcc0',hood:'#7fdcc0',doorC:'#3f4f6a'}],
  groc:[6,3,3,{wall:'#f4ead8',mat:'siding',roof:'#5f9a5a',door:3,display:[0,4],displayKind:'food',awning:['#5fae6a','#fff4e0'],label:'GROCER',doorC:'#5fae6a'}],
  hotel:[7,4,3,{wall:'#c97a62',mat:'brick',roof:'#3f5f8f',door:3,win:[1,5],win2:[1,3,5],floorband:1,curtain:'#ffd24d',label:'HOTEL',labelBg:'#ffd24d',hood:'#c7384a',lamp:1,plants:1,doorC:'#c7384a'}],
  lumber:[5,3,3,{wall:'#a8744a',mat:'logs',roof:'#5a6a3a',door:2,win:[0,4],chimney:1,label:'LUMBER',labelBg:'#ecc48e',doorC:'#6b4433'}],
  bait:[5,3,2,{wall:'#8fb4c4',mat:'planks',roof:'#3f7a8a',door:2,win:[0,4],label:'BAIT',labelBg:'#ffcf4a',doorC:'#3f6f7a'}],
  lodge:[6,3,3,{wall:'#9a92a8',mat:'stone',roof:'#5a4a6a',door:3,win:[1,5],chimney:1,label:'MINERS',hood:'#8a5d36',lamp:1,doorC:'#6b4433'}]};
const BLD3={
  police:[7,3,3,{wall:'#dfe6f0',roof:'#2f4f8f',flat:1,mat:'stone',door:3,win:[1,5],label:'POLICE',labelBg:'#6fb2ff',trim:'#ffffff',lamp:1,doorC:'#2f4f8f',hood:'#6fb2ff'}],
  diner:[6,3,3,{wall:'#f4efe4',mat:'plaster',roof:'#c7384a',door:3,display:[0,4],displayKind:'food',awning:['#c7384a','#ffffff'],label:'DINER',labelBg:'#ff7a6b',doorC:'#c7384a',lamp:1}],
  townhall:[8,4,3,{wall:'#f2ead8',roof:'#5a4a6a',flat:1,mat:'stone',door:4,win:[1,6],win2:[1,3,5,6],floorband:1,columns:[40,86],label:'TOWN HALL',labelBg:'#ffd24d',trim:'#ffffff',lamp:1,doorC:'#5a4a6a'}],
  pawn:[5,3,3,{wall:'#8a7a9a',mat:'brick',roof:'#3a3346',door:2,win:[0,4],label:'PAWN',labelBg:'#c39bff',doorC:'#3a3346',hood:'#c39bff'}],
  clinic:[6,3,3,{wall:'#f6f8fb',mat:'plaster',roof:'#4fae9c',door:3,win:[1,5],label:'CLINIC',labelBg:'#8fffb0',hood:'#e9675a',doorC:'#4fae9c',plants:1}]};
const HOUSE_STYLES=[['#8fd0c4','#4b6aa8'],['#f6dfb0','#c45a4a'],['#d8c6ea','#5f8a5a'],['#f4ead8','#8a4a3a'],['#a9c9e8','#3f5f8f'],['#ffd6c4','#b85a6a'],['#cfe8b0','#6a5a8e'],['#e8e0d0','#3a3346']];
const PLOT_TIERS=[{n:'Cottage',w:5,h:3,r:3,room:[14,10]},{n:'House',w:6,h:3,r:3,room:[16,11]},{n:'Villa',w:6,h:4,r:3,room:[18,12]},{n:'Lake House',w:6,h:4,r:3,room:[20,13]}];
function plotHouseArgs(tier,style){const[wall,roof]=HOUSE_STYLES[style%HOUSE_STYLES.length];const T=PLOT_TIERS[tier];
  const o={wall,roof,door:2,win:T.w===5?[0,4]:[0,5],flowers:1,doorC:roof,hood:'#fff4e0',lamp:1,plants:1,chimney:tier!==1};if(tier>=1)o.dormer=1;if(tier===2){o.win2=[0,2,5];o.floorband=1;o.mat='plaster'}if(tier===1)o.mat=style%2?'siding':'brick';if(tier===3){o.win2=[0,1,4,5];o.floorband=1;o.mat='logs';o.wall='#c99a63';o.curtain=wall;o.chimney=1}
  return[T.w,T.h,T.r,o]}
function artStatue(){const[c,x]=mk(30,46);ell(x,15,43,13,3,SHADOW);const S2=PAL.stone;
  R(x,3,30,24,13,K);R(x,4,31,22,11,S2[3]);R(x,4,31,22,2,S2[5]);R(x,4,40,22,2,S2[1]);R(x,8,34,14,5,'#d9a520');R(x,9,35,12,3,'#ffd24d');drawText(x,'REEL',10,35,'#5a3a10');
  const B=['#3f7a7a','#5aa0a0','#7fc4c4','#a9e2e2'];stamp(x,['....kkkk....','...kBCCBk...','...kBCCBk...','....kBBk....','..kkBCCBkk..','.kBCCCCCCBk.','kBCkBCCBkCBk','kBkkBCCBkkBk','.k.kBCCBk.k.','...kBCCBk...','...kBkkBk...','...kBk.kBk..','..kBBk.kBBk.','..kkkk.kkkk.'],{k:K,B:B[1],C:B[2]},9,3);
  R(x,6,16,18,3,K);R(x,7,16,16,1,S2[5]);R(x,7,17,16,1,S2[3]);R(x,8,19,14,11,K);R(x,9,19,12,11,S2[3]);R(x,9,19,2,11,S2[4]);R(x,18,19,3,11,S2[2]);R(x,9,19,12,1,S2[1]);R(x,12,22,6,5,S2[2]);R(x,13,23,4,3,S2[4]);
  for(let i=0;i<4;i++)P(x,10+i*3,6,B[3]);return c}
function artPoliceCar(){const[c,x]=mk(34,22);x.drawImage(artCar('#f4f6fa'),0,3);R(x,4,12,26,3,'#2f4f8f');R(x,14,1,8,3,K);R(x,15,1,3,2,'#ff4a4a');R(x,18,1,3,2,'#4a8aff');return c}
function artBars(w){const[c,x]=mk(w,40);for(let i=0;i<w;i+=6){R(x,i+1,0,3,40,K);R(x,i+2,0,1,40,'#9aa3b4')}R(x,0,2,w,3,K);R(x,0,3,w,1,'#9aa3b4');R(x,0,30,w,3,K);R(x,0,31,w,1,'#9aa3b4');return c}
function artBunk(){return pm(['kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kWWWWWWWWWWWWWWWWWWWWWWWWWWWWk','kWwwwwwwwwwwwwwwwwwwwwwwwwwwWk','kWwbbbbbbwwwwwwwwwwwwwwwwwwwWk','kWwbBBBBbwwwwwwwwwwwwwwwwwwwWk','kWwbbbbbbwwwwwwwwwwwwwwwwwwwWk','kWwwwwwwwwwwwwwwwwwwwwwwwwwwWk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kGGGGGGGGGGGGGGGGGGGGGGGGGGGGk','kggggggggggggggggggggggggggggk','kk.kk..................kk.kkk.'],{k:K,W:'#c9c4d4',w:'#e8e4ef',b:'#9aa3b4',B:'#fbf8ff',G:'#6b7286',g:'#4a5068'})}
function artBooth(col){const r=rampOf(col);const[c,x]=mk(40,30);ell(x,20,28,19,2.5,SHADOW);R(x,1,0,38,10,K);R(x,2,1,36,8,col);R(x,2,1,36,2,r[0]);R(x,1,9,38,4,K);R(x,2,10,36,2,r[2]);
  R(x,6,12,28,10,K);R(x,7,13,26,8,'#f4efe4');R(x,7,13,26,1,'#ffffff');R(x,7,20,26,1,'#c9c0b0');R(x,18,22,4,6,K);R(x,19,22,2,5,'#9a9aa8');
  R(x,9,15,6,4,'#e9675a');R(x,10,15,4,2,'#ffcf4a');R(x,24,15,5,4,'#8f5f43');R(x,25,15,3,1,'#fff4e0');R(x,1,22,38,7,K);R(x,2,23,36,5,col);R(x,2,23,36,1,r[0]);return c}
function artStool(){return pm(['.kkkkk.','kRRRRRk','krrrrrk','.kkkkk.','..kwk..','..kwk..','.kkkkk.'],{k:K,R:'#ff7a6b',r:'#c7384a',w:'#c9c4d4'})}
function artBoard(kind){const[c,x]=mk(36,26);ell(x,18,24,14,2,SHADOW);R(x,0,0,36,20,K);R(x,1,1,34,18,kind==='econ'?'#1f2a3a':'#a8744a');
  if(kind==='econ'){R(x,2,2,32,16,'#14202c');let y=13;for(let i=0;i<30;i++){y=clamp(y+((i*7)%5-2)*.8,4,15);P(x,3+i,Math.round(y),'#7fdcc0');P(x,3+i,Math.round(y)+1,'#3f8a7a')}drawText(x,'REEL',3,3,'#ffd24d')}
  else{for(const[px,py,col]of[[3,3,'#fff4e0'],[13,4,'#ffe590'],[23,3,'#c9f5e6'],[6,11,'#ffd6c4'],[18,11,'#fff4e0'],[27,10,'#e4e2ee']]){R(x,px,py,8,6,col);R(x,px+3,py,2,1,'#e9675a');R(x,px+1,py+2,6,1,'#9a8a7a');R(x,px+1,py+4,4,1,'#9a8a7a')}}
  R(x,4,20,2,5,K);R(x,30,20,2,5,K);return c}
function artStump(){return pm(['....kkkkkk....','..kkWwWWwWkk..','.kWwrrrrrrwWk.','.kWrwwwwwwrWk.','.kwrwWWWWwrwk.','.kWrwwwwwwrWk.','.kcWrrrrrrWck.','.kccWWwwWWcck.','kccccccccccck.','kkcckkkkkcckk.','.kk......kk...'],{k:'#4a2e28',W:'#ecc48e',w:'#c99a63',r:'#a8754d',c:'#8f5f43'})}
function artSapling(){return pm(['....k.......','...kGk.k....','..kGgkkGk...','..kGgGgGgk..','...kgGgGk...','....kkGkk...','.....kwk....','.....kwk....','....kkwkk...','...kddddk...','....kkkk....'],{k:'#24442f',G:'#79b85a',g:'#579a4f',w:'#8f5f43',d:'#7d5238'})}
function artSaleSign(price,tier){const t1='SALE',t2=String(price)+' ODD';const w=Math.max(textW(t1),textW(t2))+8;const[c,x]=mk(w,26);ell(x,w/2,24,6,1.5,SHADOW);R(x,w/2-2,13,4,11,K);R(x,w/2-1,13,2,10,PAL.wood[2]);
  const bc=['#e9675a','#ffcf4a','#c39bff','#6fb2ff'][tier]||'#e9675a',br=rampOf(bc);R(x,0,0,w,15,K);R(x,1,1,w-2,13,'#fff4e0');R(x,1,1,w-2,1,'#ffffff');R(x,1,1,w-2,5,bc);R(x,1,1,w-2,1,br[0]);drawText(x,t1,(w-textW(t1))/2|0,1,'#ffffff');drawText(x,t2,(w-textW(t2))/2|0,8,'#2b2130');return c}
function artPlotLot(){const W=96,H=96;const[c,x]=mk(W,H);
  for(let i=0;i<6;i++)if(i%2===0)R(x,i*16,4,16,H-8,'rgba(255,255,240,.07)');else R(x,i*16,4,16,H-8,'rgba(20,40,20,.05)');
  const rope=(x0,y0,x1,y1)=>{const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));for(let k=0;k<=n;k++){const px=Math.round(x0+(x1-x0)*k/n),py=Math.round(y0+(y1-y0)*k/n+(y0===y1?Math.sin(k/n*Math.PI*3)*.6:0));if((k>>1)%3===2)continue;P(x,px,py,'#f3e6c4');P(x,px,py+1,'rgba(40,30,20,.35)')}};
  const L=3,T=6,Rr=W-4,B=H-5;rope(L,T,Rr,T);rope(L,B,Rr,B);rope(L,T,L,B);rope(Rr,T,Rr,B);
  const post=(px,py)=>{ell(x,px+1,py+1,3,1,'rgba(42,30,51,.25)');R(x,px-1,py-6,3,7,K);R(x,px,py-5,1,5,'#d19c68');R(x,px-1,py-7,3,2,'#e9675a');P(x,px,py-7,'#ff9f8a')};
  for(const[px,py]of[[L,T],[Rr,T],[L,B],[Rr,B],[W/2,T],[L,H/2],[Rr,H/2]])post(px,py);
  ell(x,W/2,B-2,12,3,'rgba(120,90,50,.22)');return c}
function artStake(){return pm(['.r.','rRr','kwk','kwk','kwk','kwk','kwk','.k.'],{k:K,r:'#e9675a',R:'#ff9f8a',w:'#d19c68'})}
function artNameSign(name){const s=String(name).slice(0,10);const w=textW(s)+8;const[c,x]=mk(w,22);ell(x,w/2,20,5,1.5,SHADOW);R(x,w/2-1,10,3,10,K);P(x,w/2,11,PAL.wood[2]);R(x,0,1,w,10,K);R(x,1,2,w-2,8,'#5b3a6e');R(x,1,2,w-2,1,'#7a52a0');drawText(x,s,4,4,'#ffd24d');return c}
function artRowboat(){return pm(['......kkkkkkkkkkkkkkkkkk......','...kkkWWWWWWWWWWWWWWWWWWkkk...','.kkWWwwwwwwwwwwwwwwwwwwwwWWkk.','kWWwkkkkwwwwwwwwwwwwwkkkkwwWWk','kWwwkddkwwwwwwwwwwwwwkddkwwwWk','.kWwwwwwwwwwwwwwwwwwwwwwwwwWk.','..kkccccccccccccccccccccccckk..','....kkkkkkkkkkkkkkkkkkkkkk....'],{k:'#3a2420',W:'#d39c64',w:'#b27b52',d:'#8f5f43',c:'#e9675a'})}
function artMineEntrance(){const[c,x]=mk(64,46);const W=PAL.wood;
  R(x,8,6,48,40,'#1c1424');for(let y=6;y<46;y++)R(x,10,y,44,1,y<14?'#2a2236':'#14101c');
  for(let k=0;k<6;k++){R(x,14+k*7,42-k,4,1,'#3a2c48')}
  R(x,4,4,8,42,K);R(x,5,5,6,41,W[3]);R(x,5,5,2,41,W[4]);R(x,52,4,8,42,K);R(x,53,5,6,41,W[2]);R(x,53,5,2,41,W[3]);
  R(x,0,0,64,9,K);R(x,1,1,62,7,W[3]);R(x,1,1,62,2,W[5]);R(x,1,6,62,2,W[1]);for(const bx of[6,30,54])R(x,bx,3,3,3,W[1]);
  const s='MINE';R(x,24,10,textW(s)+8,9,K);R(x,25,11,textW(s)+6,7,'#ffcf4a');drawText(x,s,28,12,'#2b2130');
  stamp(x,['.kk.','kyyk','kYyk','.kk.','..k.'],{k:K,y:'#ffd76a',Y:'#fff6c0'},14,12);stamp(x,['.kk.','kyyk','kYyk','.kk.','..k.'],{k:K,y:'#ffd76a',Y:'#fff6c0'},46,12);
  for(let y=30;y<46;y+=4){R(x,22,y,20,1,'#6b4433')}R(x,24,30,1,16,'#8f8aa6');R(x,39,30,1,16,'#8f8aa6');return c}
function artLadderUp(){return pm(['k......k','kWkkkkWk','kW....Wk','kWkkkkWk','kW....Wk','kWkkkkWk','kW....Wk','kWkkkkWk','kW....Wk','kWkkkkWk','kW....Wk','kWkkkkWk','kw....wk','kk....kk'],{k:'#3a2420',W:'#d39c64',w:'#8f5f43'})}
function artLadderDown(){const[c,x]=mk(18,16);ell(x,9,8,8.5,6.5,'#0a0710');ell(x,9,8,7,5,'#14101c');R(x,5,3,1,10,'#d39c64');R(x,12,3,1,10,'#d39c64');for(let y=4;y<13;y+=3)R(x,5,y,8,1,'#b27b52');R(x,1,6,2,4,'#5a463e');R(x,15,6,2,4,'#5a463e');return c}
const ORE={stone:{n:'Stone',c:null},copper:{n:'Copper',c:['#8a3f1f','#e0874a','#ffc08a']},iron:{n:'Iron',c:['#4a5468','#c9d4e8','#ffffff']},gold:{n:'Gold',c:['#8a5a10','#ffd24d','#fff3b0']},gem:{n:'Gem',c:['#5a1a5a','#ff6fd0','#ffd6f4']},coal:{n:'Coal',c:['#0e0b12','#3a3346','#6d6880']}};
const oreCache=new Map();
function artOre(kind,hp,theme){const key=kind+hp+(theme?theme.name:'');if(oreCache.has(key))return oreCache.get(key);const[c,x]=mk(22,18);ell(x,11,15,10,2.5,SHADOW);
  const cl=hp>=3?[{x:8,y:10,r:7,ry:6},{x:14,y:9,r:7,ry:6.5},{x:11,y:7,r:6}]:hp===2?[{x:8,y:11,r:6.5,ry:5},{x:14,y:10,r:6.5,ry:5.5}]:[{x:11,y:12,r:7,ry:4.5}];
  const ramp=theme?[theme.wall[0],theme.wall[1],theme.wall[2],theme.floor[3],hshift(theme.floor[3],.12),hshift(theme.floor[3],.25)]:PAL.stone;
  x.drawImage(blobs(22,17,cl,ramp,{seed:kind.length*7+hp,noise:.12,vgrad:.3}),0,0);const o=ORE[kind];
  if(o&&o.c){const yo=hp>=3?4:hp===2?7:9;const pal={k:o.c[0],a:o.c[1],A:o.c[2]};stamp(x,['.k.','kak','kAk','kak','kkk'],pal,5,yo+1);stamp(x,['.k.','kak','kAk','kkk'],pal,12,yo);stamp(x,['.k','kA','kk'],pal,16,yo+5)}
  if(hp<3){P(x,10,8+(3-hp),ramp[0]);P(x,11,9+(3-hp),ramp[0])}
  oreCache.set(key,c);return c}
function artHedge(n){const W=n*16,H=22;const[c,x]=mk(W,H);R(x,1,H-4,W-2,3,'rgba(42,30,51,.22)');const circ=[];for(let i=0;i<n*2+1;i++)circ.push({x:4+i*(W-8)/(n*2),y:10+((i*7)%3)-1,r:5.6+((i*5)%3)*.5});
  x.drawImage(canopy(W,H-3,circ.concat([{x:W/2,y:12,r:Math.min(W/2-2,8),ry:6}]),PAL.leaf,{seed:n*13,cr:2.4,step:3.2}),0,0);return c}
function artPicnic(){const[c,x]=mk(34,24);const W=PAL.wood;ell(x,17,21,16,3,SHADOW);
  R(x,2,6,30,2,K);R(x,3,6,28,1,W[4]);for(const by of[16,4]){R(x,1,by+0,32,4,K);R(x,2,by+1,30,2,W[3]);R(x,2,by+1,30,1,W[4])}
  R(x,3,9,28,6,K);R(x,4,9,26,4,W[3]);R(x,4,9,26,1,W[5]);for(let i=6;i<30;i+=6)R(x,i,9,1,4,W[2]);R(x,4,13,26,1,W[1]);R(x,6,15,2,5,K);R(x,26,15,2,5,K);
  R(x,10,8,6,2,'#e9675a');R(x,11,8,4,1,'#ff9f8a');P(x,20,8,'#ffcf4a');P(x,21,8,'#ffcf4a');return c}
function artBin(){return pm(['.kkkkkk.','kMMMMMMk','kkkkkkkk','.kGgGgk.','.kGgGgk.','.kGgGgk.','.kGgGgk.','.kkkkkk.'],{k:K,M:'#7a8a96',G:'#5f9a6a',g:'#4a7f56'})}
function artUmbrella(col){const r=rampOf(col);const[c,x]=mk(30,34);ell(x,15,32,7,1.6,SHADOW);R(x,14,10,2,22,K);R(x,14,11,1,20,'#e8e0d0');
  for(let y=0;y<10;y++){const hw=Math.round(3+y*1.25);for(let i=-hw;i<=hw;i++){const seg=Math.floor((i+hw)/(hw*2+1)*6);x.fillStyle=y===9||Math.abs(i)===hw?K:(seg%2?'#fff4e0':(y<3?r[0]:col));x.fillRect(15+i,y+1,1,1)}}P(x,15,0,K);return c}
function artWindmill(f){const[c,x]=mk(48,72);ell(x,24,69,13,3,SHADOW);const W=PAL.wood;
  for(let y=30;y<70;y++){const hw=Math.round(6+(y-30)*.14);R(x,24-hw-1,y,hw*2+2,1,K);R(x,24-hw,y,hw*2,1,y%6<1?W[2]:W[3]);R(x,24-hw,y,2,1,W[4])}R(x,20,56,8,13,K);R(x,21,57,6,12,'#5a3826');R(x,22,40,4,5,K);R(x,23,41,2,3,'#ffe590');
  R(x,15,24,18,8,K);R(x,16,25,16,6,'#c45a4a');R(x,16,25,16,2,'#e07a5a');
  const cx=24,cy=28,a0=f/4*Math.PI/2;for(let i=0;i<4;i++){const a=a0+i*Math.PI/2;const ux=Math.cos(a),uy=Math.sin(a);for(let d=3;d<24;d++){const px=cx+ux*d,py=cy+uy*d;P(x,Math.round(px),Math.round(py),K);if(d>8){for(let s2=1;s2<=4;s2++){const qx=px-uy*s2,qy=py+ux*s2;P(x,Math.round(qx),Math.round(qy),s2===4||d===23?K:(d+s2)%3?'#fbf1dc':'#d9cfb8')}}}}ell(x,cx,cy,3,3,K);ell(x,cx,cy,2,2,'#ffd24d');return c}
function artFlag(f){const[c,x]=mk(16,22);R(x,1,0,2,22,K);P(x,1,0,'#ffd24d');for(let j=0;j<8;j++){const w=12;for(let i=0;i<w;i++){const off=Math.round(Math.sin(i*.6+f*1.5)*1.2);P(x,3+i,2+j+off,j<1||j>6||i===w-1?K:j<4?'#6fb2ff':'#fbf1dc')}}return c}
function artTorch(f){const[c,x]=mk(10,18);R(x,4,8,2,9,K);R(x,4,9,1,7,'#8f5f43');R(x,2,14,6,2,K);R(x,3,14,4,1,'#6b6680');
  const fl=[['..y...','.yYy..','.YWYy.','.yWWy.','..YY..'],['...y..','..yYy.','.yYWY.','.yWWy.','..YY..'],['..y...','.yYy..','.yYWy.','.YWWy.','..yY..']][f%3];stamp(x,fl,{y:'#ff7a3a',Y:'#ffb84a',W:'#fff3b0'},2,3);return c}
function artCrystal(col){const r=rampOf(col);return pm(['....k.....','...kAk..k.','...kak.kAk','.k.kak.kak','kAkkak.kak','kakkakkkak','kakkaakkak','.kkaaaakk.','..kkkkkkk.'],{k:r[3],a:col,A:r[0]})}
function artMushrooms(){return pm(['..kkk.......','.kRWRk..kk..','kRRRRRkkRRk.','.kkwwk.kRWRk','..kwwk..kwk.','..kkkk..kkk.'],{k:'#3a2420',R:'#e9675a',W:'#fff4e0',w:'#f4ead8'})}
function artMinecart(){return pm(['..kkkkkkkkkkkkkkkk..','.kGyGcYGcyGGcYGGcGk.','kMMMMMMMMMMMMMMMMMMk','kMmmmmmmmmmmmmmmmmMk','kMmkkmmmmmmmmmkkmmMk','kmmmmmmmmmmmmmmmmmmk','.kkkkkkkkkkkkkkkkkk.','..kTtk........kTtk..','...kk..........kk...'],{k:K,M:'#9d9ab3',m:'#6d6880',G:'#8a8299',y:'#ffd24d',Y:'#fff3b0',c:'#e0874a',T:'#3a3346',t:'#8f8aa6'})}
function artBeamV7(){return pm(['kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk','kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kWwk........................kWwk','kWwk........................kWwk','kWwk........................kWwk','kWwk........................kWwk','kWwk........................kWwk','kWwk........................kWwk','kWwk........................kWwk','kWwk........................kWwk','kkkk........................kkkk'],{k:'#2a1810',W:'#b27b52',w:'#6b4433'})}
function artBerryBush(col,picked){const[c,x]=mk(22,17);ell(x,11,15,10,2.2,SHADOW);x.drawImage(canopy(22,15,[{x:6.5,y:9,r:5.5},{x:15.5,y:9,r:5.5},{x:11,y:7,r:6.5}],PAL.leaf,{seed:31,cr:2.6,step:3.4}),0,0);if(!picked){const r2=rampOf(col);for(const[a,b]of[[5,6],[11,4],[16,8],[8,10],[13,11],[15,5],[6,11]]){P(x,a,b,col);P(x,a+1,b,r2[2]);P(x,a,b-1,r2[0])}}return c}
function artReeds(){return pm(['.b..b.','.b.bb.','.g.bg.','.gg.g.','g.gg.g','.ggg..','..g...'],{b:'#7a4e33',g:'#3f7a45'})}
function artBarrel(){return pm(['.kkkkkkkk.','kWWWWWWWWk','kfffffffWk','kMMMMMMMMk','kwwwwwwwwk','kWWWWWWWwk','kMMMMMMMMk','kwwwwwwwwk','.kkkkkkkk.'],{k:'#3a2420',W:'#d39c64',w:'#a8754d',M:'#6d6880',f:'#8fcfe3'})}
function artLanternPost(){return pm(['.kkkkk.','kyYYYyk','kYwwwYk','kyYYYyk','.kkkkk.','...k...','...k...','...k...','...k...','...k...','...k...','...k...','...k...','..kkk..','.kkkkk.'],{k:'#2e2433',y:'#ffd76a',Y:'#ffeaa0',w:'#fff6d0'})}
/* shop interior props */
function artCounter(w,top,front){const[c,x]=mk(w,22);const tr=rampOf(top),fr=rampOf(front);R(x,0,0,w,22,K);R(x,1,1,w-2,6,top);R(x,1,1,w-2,1,tr[0]);R(x,1,6,w-2,1,tr[2]);R(x,1,7,w-2,14,front);R(x,1,7,w-2,1,fr[2]);for(let px=6;px<w-4;px+=12){R(x,px,10,8,8,fr[2]);R(x,px+1,11,6,6,front);R(x,px+1,11,6,1,fr[0])}R(x,1,20,w-2,1,fr[3]);return c}
function artRegister(){return pm(['..kkkkkkk.','.kgggggggk','.kGGGGGGGk','kkkkkkkkkk','kMmMmMmMmk','kmMmMmMmMk','kkkkkkkkkk'],{k:K,g:'#0f1a14',G:'#8fffb0',M:'#c9c6d8',m:'#9d9ab3'})}
function artShelfUnit(kind){const[c,x]=mk(32,34);ell(x,16,32,15,2,SHADOW);const W=PAL.wood;R(x,0,0,32,33,K);R(x,1,1,30,31,W[2]);R(x,1,1,30,1,W[4]);
  const goods={food:[['#e9675a','#ff9f8a'],['#ffcf4a','#fff0a0'],['#7cc46a','#b6f0a0'],['#ff9b3d','#ffc08a']],furn:[['#7a6fe0','#a9a0f2'],['#d39c64','#ecc48e'],['#5b9be0','#8fbff0']],appl:[['#e4e2ee','#ffffff'],['#3a3346','#6d6880'],['#7fdcc0','#c9f5e6']],bank:[['#ffd24d','#fff3b0'],['#c9d4e8','#ffffff']]}[kind]||[['#c39bff','#e8dcff']];
  for(const y of[2,12,22]){R(x,2,y,28,8,W[0]);R(x,2,y+8,28,2,W[4]);for(let i=0;i<6;i++){const g=goods[(i+y)%goods.length];if(kind==='food'){ell(x,5+i*4.4,y+5,2,2,g[0]);P(x,4+i*4.4|0,y+4,g[1])}else{R(x,3+i*4.4|0,y+2,3,6,g[0]);R(x,3+i*4.4|0,y+2,3,1,g[1])}}}return c}
function artVault(){const[c,x]=mk(36,36);const st=PAL.stone;R(x,0,0,36,36,K);R(x,1,1,34,34,st[2]);R(x,1,1,34,1,st[4]);ell(x,18,18,15,15,K);ell(x,18,18,14,14,'#c9c6d8');ell(x,17,17,12,12,'#e4e2ee');ell(x,18,18,9,9,'#9d9ab3');ell(x,18,18,3,3,K);ell(x,18,18,2,2,'#ffd24d');for(let a=0;a<6;a++){const ang=a/6*Math.PI*2;for(let d=3;d<9;d++)P(x,Math.round(18+Math.cos(ang)*d),Math.round(18+Math.sin(ang)*d),K)}for(let a=0;a<12;a++)P(x,Math.round(18+Math.cos(a/12*6.283)*12),Math.round(18+Math.sin(a/12*6.283)*12),'#6d6880');return c}
function artDisplayFridge(){return pm(['kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk','kWkkkkkkkkkkkkkkkWkkkkkkkkkkkkWk','kWkgrgyggbgggogkWWkgbggrggyggkWk','kWkgrgyggbgggogkWWkgbggrggyggkWk','kWkkkkkkkkkkkkkkWWkkkkkkkkkkkkWk','kWkggoggrgggbggkWWkgygggbggrgkWk','kWkggoggrgggbggkWWkgygggbggrgkWk','kWkkkkkkkkkkkkkkWWkkkkkkkkkkkkWk','kWkgbgggyggrgggkWWkgrggoggbggkWk','kWkgbgggyggrgggkWWkgrggoggbggkWk','kWkkkkkkkkkkkkkkWWkkkkkkkkkkkkWk','kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk','kddddddddddddddddddddddddddddddk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk'],{k:K,W:'#e4e2ee',g:'#bfe6f0',r:'#e9675a',y:'#ffcf4a',b:'#5b9be0',o:'#ff9b3d',d:'#9d9ab3'})}
function artCrates(){const[c,x]=mk(34,18);ell(x,17,16,16,2,SHADOW);for(const[ox,col]of[[0,'#e9675a'],[17,'#ffcf4a']]){R(x,ox,4,17,12,K);R(x,ox+1,5,15,10,PAL.wood[3]);R(x,ox+1,9,15,1,PAL.wood[1]);for(let i=0;i<4;i++){ell(x,ox+3+i*3.6,4,2,2,K);ell(x,ox+3+i*3.6,4,1.4,1.4,col);P(x,ox+2+i*3.6|0,3,lite(col,.3))}}return c}
function artBreadRack(){return pm(['kkkkkkkkkkkkkkkkkkkkkkkk','kWWWWWWWWWWWWWWWWWWWWWWk','kWkbbBkkbbBkkbbBkkbbBkWk','kWbBBBbbBBBbbBBBbbBBBbWk','kWkkkkkkkkkkkkkkkkkkkkWk','kWkcccckkcccckkcccckkcWk','kWcCCCCccCCCCccCCCCccCWk','kWkkkkkkkkkkkkkkkkkkkkWk','kwwwwwwwwwwwwwwwwwwwwwwk','kk....................kk'],{k:'#3a2420',W:'#b27b52',w:'#8f5f43',b:'#c98a3a',B:'#e8b25a',c:'#f2d38a',C:'#fff0c0'})}
function artBell(){return pm(['..k..','.kyk.','kyYyk','kkkkk'],{k:K,y:'#ffd24d',Y:'#fff3b0'})}
function artKeyRack(){const[c,x]=mk(28,16);R(x,0,0,28,16,K);R(x,1,1,26,14,PAL.wood[3]);for(let i=0;i<6;i++){P(x,4+i*4,4,'#c9c6d8');R(x,4+i*4,5,1,4,'#ffd24d');P(x,4+i*4,9,'#ffd24d')}return c}
function artPalm(){const[c,x]=mk(20,30);ell(x,10,28,6,1.6,SHADOW);stamp(x,['.kkkkkkk.','kTTTTTTTk','kttttttTk','.kttttTk.','.kkkkkkk.'],{k:K,T:'#e08a5f',t:'#b8603f'},5,23);R(x,9,10,2,14,'#8f5f43');for(let a=0;a<7;a++){const ang=-Math.PI*(.1+a*.13);for(let d=0;d<9;d++){const px=10+Math.cos(ang)*d*1.1,py=10+Math.sin(ang)*d*.8+d*d*.05;P(x,px|0,py|0,d<3?'#3f7a45':'#579a4f');P(x,(px|0),(py|0)+1,'#24442f')}}return c}

