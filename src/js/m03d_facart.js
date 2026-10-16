/* ================= ART: co-op emblems, crests, flags, banners and pennants ================= */
const COOP_EMB={ // 5x5 emblems stitched onto flags, sails and banners
  brine:['.xxx.','x.o.x','xxxxx','x.o.x','.xxx.'],
  gullwing:['.....','xx.xx','.xxx.','..x..','.....'],
  reef:['x.x.x','x.x.x','.xxx.','..x..','.xxx.'],
  deep:['..x..','xxxxx','..x..','x.x.x','.xxx.'],
  mob:['x...x','.xxx.','xxoxx','.xxx.','x.x.x']};
const facArtCache=new Map();
function facCached(key,fn){if(!facArtCache.has(key))facArtCache.set(key,fn());return facArtCache.get(key)}
// 16x16 icon: the emblem big on a round badge
function coopIcon(id){return facCached('ic'+id,()=>{const C=COOPI[id];const[c,x]=mk(16,16);ell(x,8,8,7.5,7.5,K);ell(x,8,8,6.5,6.5,C.col);ell(x,7,6,4,3,shade(C.col,.15));const em=COOP_EMB[id];
  for(let j=0;j<5;j++)for(let i=0;i<5;i++)if(em[j][i]!=='.'){R(x,3+i*2,3+j*2,2,2,em[j][i]==='o'?C.dk:C.lt);P(x,4+i*2,4+j*2,em[j][i]==='o'?C.dk:shade(C.lt,-.12))}return c})}
function coopAnyIcon(){return facCached('any',()=>{const[c,x]=mk(16,16);COOPS.forEach((f,i)=>{const a=i/5*6.283-1.57,px=8+Math.cos(a)*5-2.5,py=8+Math.sin(a)*5-2.5;R(x,px|0,py|0,5,5,K);R(x+0,(px|0)+1,(py|0)+1,3,3,f.col)});return c})}
/* a shield crest for panels: 24x28 */
function coopCrest(id){return facCached('cr'+id,()=>{const F=COOPI[id];const[c,x]=mk(24,28);
  for(let y=0;y<26;y++){const inset=y<16?0:Math.round((y-16)*1.05);R(x,1+inset,1+y,22-inset*2,1,K)}
  for(let y=1;y<25;y++){const inset=y<16?0:Math.round((y-16)*1.05);if(22-inset*2-2<=0)continue;R(x,2+inset,1+y,20-inset*2,1,y<3?shade(F.col,.25):y>19?F.dk:F.col)}
  R(x,11,4,2,19,'rgba(255,255,255,.12)');const em=COOP_EMB[id];for(let j=0;j<5;j++)for(let i=0;i<5;i++)if(em[j][i]!=='.'){R(x,5+i*3,6+j*3,3,3,em[j][i]==='o'?F.dk:F.lt);R(x,6+i*3,8+j*3,2,1,shade(F.lt,-.2))}return c})}
/* a waving flag on a pole */
function artFacFlag(id,f){return facCached('fl'+(id||'none')+f,()=>{const F=id?COOPI[id]:null;const[c,x]=mk(20,34);ell(x,3,33,4,1.5,SHADOW);R(x,2,0,3,34,K);R(x,3,1,1,32,'#c9c6d8');R(x,2,0,3,2,'#ffd24d');
  const col=F?F.col:'#e8e4ef',dk=F?F.dk:'#8a8299',lt=F?shade(F.col,.3):'#ffffff';const em=id?COOP_EMB[id]:null;
  for(let j=0;j<11;j++)for(let i=0;i<14;i++){const off=Math.round(Math.sin(i*.55+f*1.6)*1.3);const edge=j===0||j===10||i===13;let cc=edge?K:j<2?lt:j>8?dk:col;
    if(em&&j>=3&&j<8&&i>=4&&i<9&&em[j-3][i-4]!=='.')cc=em[j-3][i-4]==='o'?dk:F.lt;P(x,5+i,3+j+off,cc)}return c})}
/* hanging cloth banner: 14x26 */
function artFacBanner(id){return facCached('bn'+id,()=>{const F=COOPI[id];const[c,x]=mk(14,26);R(x,0,0,14,2,K);R(x,1,0,12,1,'#c9a24a');
  for(let y=2;y<24;y++){for(let i=0;i<12;i++){const tip=y>19&&Math.abs(i-5.5)<(y-19)*1.5;if(tip)continue;const edge=i===0||i===11;P(x,1+i,y,edge?K:i<2?shade(F.col,.25):i>9?F.dk:F.col)}}
  const em=COOP_EMB[id];for(let j=0;j<5;j++)for(let i=0;i<5;i++)if(em[j][i]!=='.')R(x,2+i*2,7+j*2,2,2,em[j][i]==='o'?F.dk:F.lt);
  for(let y=20;y<24;y++){const w=(y-19)*1.5;P(x,Math.round(6.5-w),y,K);P(x,Math.round(6.5+w),y,K)}return c})}
/* a little pennant for boat masts: 9x6 */
function coopPennant(id){return facCached('pn'+id,()=>{const F=COOPI[id];return pm(['kkkkkkk..','kCCCCCCkk','kCLLCCCCk','kCCCCCCkk','kkkkkkk..'],{k:K,C:F.col,L:F.lt})})}
function artDonationBox(id){const F=COOPI[id];const[c,x]=mk(16,18);ell(x,8,17,7,1.5,SHADOW);R(x,1,4,14,12,K);R(x,2,5,12,10,F.dk);R(x,2,5,12,2,F.col);R(x,5,4,6,2,K);R(x,6,3,4,1,'#ffd24d');R(x,6,9,4,4,'#ffd24d');R(x,7,10,2,2,F.dk);return c}
function artTrophy(){return pm(['..kkkkkk..','kkyYYYYykk','kyky..ykyk','kyk.yy.kyk','.kkyYYykk.','...kyyk...','....kk....','...kYYk...','..kkkkkk..','..kyyyyk..','..kkkkkk..'],{k:K,y:'#d9a520',Y:'#ffe590'})}
/* co-op colours on the arms, and a cap band in your colours */
function drawBands(c,x,y,dir,col,head){x=Math.round(x);y=Math.round(y);if(dir==='left'||dir==='right'){R(c,x-1,y-8,3,2,col)}else{R(c,x-6,y-8,2,2,col);R(c,x+4,y-8,2,2,col)}
  if(head){R(c,x-7,y-19,14,2,col);P(c,x-7,y-19,K);P(c,x+6,y-19,K)}}
const UI_FLAG=[['k.........','kkkkkkk...','kRRRRRRk..','kRRWRRRRk.','kRRRRRRk..','kkkkkkk...','k.........','k.........','k.........','kk........'],{R:'#ff7a6b',W:'#fff4e0'}];
Object.assign(UI_ICON,{flag:UI_FLAG});
