/* ================= the Founding Fisher machine: odds (shared with the server) =================
   Five capsules. The NFT chance rises with the price so a Founding Fisher costs about 200,000 $REEL of pulls on
   average, whichever capsule you pick. Every other capsule pays a multiple of its price from the prize pool:
   0.3x or 0.5x back, or a 2x or 5x win. A win is only offered while the pool could pay it several times over,
   and a pool above its target pays wins twice as often until it drains back down. */
const MACH={pool:CFG.MACHINE.seed,drop:CFG.MACHINE.drop.n,minted:new Set()};
// the 500 are released in drops of 100, each with the same rarity mix (60 common, 25 uncommon, 12 rare, 3 legendary)
const DROP_ORDER=(()=>{const by=[[],[],[],[]];for(let id=1;id<=SUPPLY;id++)by[RARITY[id]].push(id);const r=rng(90210);
  for(const a of by)for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  const nd=SUPPLY/CFG.MACHINE.drop.size,out=[];for(let d=0;d<nd;d++){const part=[];for(const a of by){const k=a.length/nd;part.push(...a.slice(Math.round(d*k),Math.round((d+1)*k)))}for(let i=part.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[part[i],part[j]]=[part[j],part[i]]}out.push(...part)}return out})();
function dropIds(n){return DROP_ORDER.slice(0,Math.min(SUPPLY,Math.max(1,n)*CFG.MACHINE.drop.size))}
function machLeft(){let n=0;for(const id of dropIds(MACH.drop))if(!MACH.minted.has(id))n++;return n}
function machHot(){const T=CFG.MACHINE.target;return clamp01((MACH.pool-T)/T)}
// [{kind:'nft',p},{kind:'mult',m,p,off}] for capsule ti, given the pool as it stands (after this pull's share is added)
function machOdds(ti,pool){const M=CFG.MACHINE,T=M.tiers[ti];pool=pool==null?MACH.pool:pool;const q=machLeft()>0?T.nft:0;const hot=machHot();
  const ws=M.mults.map(([m,w])=>{const can=m<=1||pool>=m*T.price*M.safety;return{kind:'mult',m,w:w*(m>1?1+hot:1),off:!can}});
  let lost=0;for(const o of ws)if(o.off){lost+=o.w;o.w=0}const half=ws.find(o=>o.m===.5);half.w+=lost;
  const tot=ws.reduce((s,o)=>s+o.w,0);const out=[];if(q>0)out.push({kind:'nft',p:q});for(const o of ws)out.push({kind:'mult',m:o.m,p:(1-q)*o.w/tot,off:o.off});return out}
function machRoll(ti,r){const odds=machOdds(ti);let x=r;for(const o of odds){if(x<o.p)return{kind:o.kind,m:o.m};x-=o.p}const l=odds[odds.length-1];return{kind:l.kind,m:l.m}}
// expected $REEL back per capsule (not counting the NFT) and the average spend per NFT
function machStats(ti){const T=CFG.MACHINE.tiers[ti];const o=machOdds(ti);const back=o.filter(x=>x.kind==='mult').reduce((s,x)=>s+x.p*x.m,0);const q=(o.find(x=>x.kind==='nft')||{p:0}).p;return{back,q,perNft:q?T.price/q:0,netPerNft:q?T.price*(1-back)/q:0}}
const NFT_PICK_W=[6,3,1.2,.4];
function machPickNft(rnd){rnd=rnd||Math.random;const ids=dropIds(MACH.drop).filter(id=>!MACH.minted.has(id));if(!ids.length)return null;return pickW(ids.map(id=>[id,NFT_PICK_W[RARITY[id]]]),rnd())}
