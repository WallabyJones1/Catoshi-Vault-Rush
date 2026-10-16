/* ================= the sea's rules (shared with the server) =================
   Time, tide, weather, moon and season come from the clock alone, so every phone and the server agree.
   One real second is one town minute: a town day lasts 24 real minutes. Tides turn every 6 town hours.
   The moon runs a full cycle each real week; each season lasts one real week in a 4-week year.
   The Harbour Cup runs on real UTC days. */
const T_EPOCH=Date.UTC(2026,0,5); // a Monday, first day of spring, new moon
const SEASONS=['spring','summer','autumn','winter'];
const SKIES=['calm','windy','rain','fog','storm'];
function hsh(a,b=0,c=0){let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul(c|0,1442695041);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296}
function skyAt(block,season){const r=hsh(block,77,season);const W=season===3?[.34,.2,.18,.1,.18]:season===1?[.52,.2,.12,.06,.1]:season===2?[.4,.26,.14,.1,.1]:[.42,.2,.18,.12,.08];let x=r;for(let i=0;i<5;i++){if(x<W[i])return SKIES[i];x-=W[i]}return'calm'}
function envAt(t){t=t==null?Date.now():t;const sec=Math.floor(t/1000);const min=sec%1440;const hour=min/60;const tday=Math.floor(sec/1440);
  const day=Math.floor(t/864e5),dmin=Math.floor((t%864e5)/60000);
  const wk=Math.floor((t-T_EPOCH)/(7*864e5));const si=((wk%4)+4)%4;const season=SEASONS[si];
  const moonPhase=(((t-T_EPOCH)/(7*864e5))%1+1)%1;const moon=moonPhase<1/14||moonPhase>13/14?'newmoon':Math.abs(moonPhase-.5)<1/14?'fullmoon':'';
  // tide: high at 00:00 and 12:00, low at 06:00 and 18:00 (town time)
  const tl=Math.cos(hour/12*2*Math.PI),rising=Math.sin(hour/12*2*Math.PI)<0;
  const tideState=tl>.6?'high':tl<-.6?'low':rising?'rising':'falling';const king=moon==='fullmoon'&&tl>.6;
  // weather: a new spell every 4 town hours (4 real minutes)
  const block=Math.floor(sec/240);const sky=skyAt(block,si);const prev=skyAt(block-1,si);const after=sky!=='storm'&&prev==='storm';const nextSky=skyAt(block+1,si);
  const wind=sky==='storm'?1:sky==='windy'?.7:sky==='rain'?.45:sky==='fog'?.05:.2;
  const odd={zone:ZONE_ORDER[Math.floor(hsh(wk,404)*8)],on:moon==='fullmoon'&&(hour>=23.5||hour<.5)};
  return{t,min,hour,tday,day,dmin,wk,season,si,moon,moonPhase,tide:tl,rising,tideState,king,sky,after,nextSky,blockLeft:240-(sec%240),wind,odd}}
function timeOK(w,h){switch(w){case'day':return h>=6.5&&h<17.5;case'night':return h>=19||h<5.5;case'dawn':return h>=4.5&&h<7.5;case'dusk':return h>=16.5&&h<19.5;
  case'dawn/dusk':return(h>=4.5&&h<7.5)||(h>=16.5&&h<19.5);case'dusk/night':return h>=16.5||h<5.5;case'midnight':return h>=23||h<1;default:return true}}
function tideOK(w,E){switch(w){case'rising':return E.rising;case'falling':return!E.rising;case'high':return E.tide>.45;case'low':return E.tide<-.45;case'kingtide':return E.king;default:return true}}
function skyOK(w,E){if(!w)return true;if(w==='afterstorm')return E.after;return E.sky===w}
// can this entry turn up right now, here, with this gear? (bait is a preference, never a gate)
function condOK(e,E,ctx){const p=e.cp;ctx=ctx||{};const g=ctx.gear||{};
  if(p.time&&!timeOK(p.time,E.hour))return false;if(p.tide&&!tideOK(p.tide,E))return false;if(!skyOK(p.sky,E))return false;
  if(p.season&&E.season!==p.season)return false;if(p.moon&&E.moon!==p.moon)return false;
  if(p.method.includes('deepreel')&&!g.deepreel)return false;if(p.method.includes('lamp')&&!(g.lamp&&timeOK('night',E.hour)))return false;
  if(p.where&&!(ctx.near&&ctx.near[p.where]))return false;
  if(p.flags.includes('oddone'))return E.odd.on&&ctx.zone===E.odd.zone;
  if(p.flags.includes('spawn'))return E.moon==='fullmoon'&&E.season==='summer'&&timeOK('night',E.hour);
  if(p.flags.includes('gift'))return false;
  return true}
const sizeClass=e=>e.sz?(e.sz[1]<32?0:e.sz[1]<90?1:e.sz[1]<220?2:3):0;
function pickW(list,r){let tot=0;for(const x of list)tot+=x[1];if(tot<=0)return null;let v=r*tot;for(const x of list){v-=x[1];if(v<=0)return x[0]}return list[list.length-1][0]}
const RARW=[60,25,10,3.6,.2];
function baitMul(bk,e){const B=BAIT[bk]||BAIT.dough;let m=B.r[Math.min(3,e.r)]||1;const shape=String(e.art).split('|')[0];if(B.like&&B.like.includes(shape))m*=1.5;if(B.z&&B.z[e.z])m*=B.z[e.z];if(e.cp.bait){m*=e.cp.bait===bk?4:.35}if(bk==='weedbait'&&e.cp.bait!=='weedbait')m*=.3;return m}
function legendCandidates(ctx){const E=ctx.env;return CAT.filter(e=>e.cat==='legend'&&(e.z===ctx.zone||e.z==='unknown')&&condOK(e,E,ctx))}
// what could take the hook on this cast: fish, a legend, a snag find, a lost relic or junk
function hookTable(ctx){const E=ctx.env,z=ctx.zone,g=ctx.gear||{},out=[];const rodT=g.rodT||0;
  for(const e of CAT){
    if(e.cat==='fish'){if(e.z!==z||e.how==='pot'||!condOK(e,E,ctx))continue;let w=RARW[e.r]*(1+rodT*.12*e.r)*baitMul(ctx.bait,e);
      if(ctx.shadowR!=null)w*=sizeClass(e)===ctx.shadowR?3:Math.abs(sizeClass(e)-ctx.shadowR)===1?.5:.15;
      if(BAIT[ctx.bait]&&BAIT[ctx.bait].night&&timeOK('night',E.hour))w*=BAIT[ctx.bait].night;out.push([e,w])}
    else if(e.cat==='legend'){if(rodT<2)continue;if((e.z!==z&&e.z!=='unknown')||!condOK(e,E,ctx))continue;out.push([e,(ctx.bait==='livebait'?.6:.3)*(1+rodT*.25)])}
    else if(e.how==='snag'){if(e.z!==z||!condOK(e,E,ctx))continue;out.push([e,[3,1.4,.55,.18,.05][e.r]*(1-(g.hookSnag||0)*.35)])}
    else if(e.how==='hook'&&e.cat!=='junk'){if(e.z!==z||!condOK(e,E,ctx))continue;out.push([e,[1.6,.7,.3,.1][e.r]||.1])}
    else if(e.cat==='junk'){const zw=z==='harbour'?1.6:z==='deep'||z==='blue'?.25:.8;out.push([e,[2.2,.6,.2][e.r]*zw*(ctx.bait==='dough'?1.4:1)])}}
  // junk is about 6-10% of what bites (more in the harbour), never most of it
  let fw=0,jw=0;for(const x of out){if(x[0].cat==='junk')jw+=x[1];else if(x[0].cat==='fish')fw+=x[1]}
  const relic=Math.max(.15,Math.min(1,fw/40));for(const x of out)if(x[0].cat!=='fish'&&x[0].cat!=='junk'&&x[0].cat!=='legend')x[1]*=relic;const want=Math.max(1.2,fw*(z==='harbour'?.1:.06));if(jw>0)for(const x of out)if(x[0].cat==='junk')x[1]*=want/jw;
  return out}
function rollSize(e,r){if(!e.sz)return 0;const[a,b]=e.sz;return Math.round((a+(b-a)*Math.pow(r,1.7))*10)/10}
function rollVariant(e,r){if(e.cat!=='fish'||e.release)return'';return r<1/400?'g':r<1/400+1/250?'a':''}
const KG_SHAPE={eel:.25,ribbon:.12,gar:.3,oar:.15,saw:.6,shark:.75,ray:1.4,guitar:.9,deep:1.55,grouper:1.7,disc:1.3,tuna:1.4,mahi:1.1,marlin:.8,sail:.7,flathead:.8,puffer:1.8,angler:1.4,wobbe:.7,seahorse:.08,dragon:.08,lantern:.8,squid:.5,cuttle:.9,octo:.6,hump:1.7,bat:1.4,boar:1.4,dory:1.2,idol:1,clown:1.1,jacket:1,trigger:1.3,parrot:1.4,lion:1.1,flying:.6,chimaera:.6,gulper:.3,odd:1};
function fishKg(e,cm){if(!cm)return 0;const sh=String(e.art).split('|')[0];if(sh==='crab')return Math.round(cm*cm*cm*.00026*100)/100;if(sh==='lobster')return Math.round(cm*cm*cm*.00009*100)/100;const k=KG_SHAPE[sh]||1;return Math.round(.0105*k*Math.pow(cm,3)/1000*100)/100}
function rollHook(ctx,rnd){rnd=rnd||Math.random;const e=pickW(hookTable(ctx),rnd());if(!e)return null;const cm=rollSize(e,rnd());const v=rollVariant(e,rnd());return{e,cm,v,kg:fishKg(e,cm)}}
function sizeFrac(e,cm){if(!e.sz||e.sz[1]<=e.sz[0])return .5;return clamp01((cm-e.sz[0])/(e.sz[1]-e.sz[0]))}
const clamp01=v=>v<0?0:v>1?1:v;
function catchPoints(e,cm,v){if(e.cat==='junk')return .5;const base=CFG.CUP.rarW[e.r];const s=.75+.75*sizeFrac(e,cm);return Math.round(base*s*(v==='g'?3:v==='a'?2:1)*10)/10}
const isTrophy=(e,cm)=>(e.cat==='fish'||e.cat==='legend')&&sizeFrac(e,cm)>=.9;
/* pots: soak, then haul */
function potTable(zone,E,bait){const out=[];for(const e of CAT){if(e.how!=='pot'||(e.z!==zone))continue;if(!condOK(e,E,{zone}))continue;out.push([e,[30,18,8,3,1][e.r]*(bait==='crabbait'?1.8:1)])}
  out.push([CATI.seaweed_clump,6],[CATI.tin_can,3]);if(zone==='estuary'||zone==='harbour')out.push([CATI.toadfish,8]);if(zone==='kelp')out.push([CATI.herring_cale,5]);if(zone==='wreck')out.push([CATI.moray_eel,3]);return out}
function rollPot(zone,E,bait,soak,rnd){rnd=rnd||Math.random;const n=soak<POTS.soakMin?0:Math.min(3,1+Math.floor(rnd()*(1+soak/POTS.soakMin)));const got=[];const T=potTable(zone,E,bait);for(let i=0;i<n;i++){const e=pickW(T,rnd());if(e)got.push({id:e.id,cm:rollSize(e,rnd())})}return got}
/* beachcombing: low tide opens the beach and the rock pools */
function combTable(where,E){const out=[];const low=E.tide<.1;for(const e of CAT){if(e.how!=='comb'||e.z!==where)continue;if(!condOK(e,E,{zone:where}))continue;out.push([e,[30,12,4.5,1.2,.2][e.r]*(low?1:.35)])}
  if(where==='rocks')out.push([{id:'oyster'},low?14:5]);out.push([CATI.plastic_bag,4],[CATI.tin_can,3],[CATI.seaweed_clump,6]);return out}
function rollComb(where,E,rnd){rnd=rnd||Math.random;const e=pickW(combTable(where,E),rnd());return e?{id:e.id,cm:0}:null}
function openOyster(E,rnd){rnd=rnd||Math.random;if(rnd()>.34)return null;const list=catOf('pearl').filter(e=>condOK(e,E,{})).map(e=>[e,[0,40,14,4,1.2][e.r]]);return pickW(list,rnd())}
/* salvage: grapple a wreck site */
function salvTable(zone,E){const out=[];for(const e of CAT){if(e.how!=='salvage'||e.z!==zone)continue;if(!condOK(e,E,{zone}))continue;out.push([e,[20,12,5,1.4,.3][e.r]])}out.push([CATI.tangled_line,6],[CATI.old_boot,3]);return out}
function rollSalvage(zone,E,rnd){rnd=rnd||Math.random;const e=pickW(salvTable(zone,E),rnd());return e?{id:e.id,cm:0}:null}
const CHESTS=new Set(['driftwood_crate','lost_tackle_box','barnacled_chest','smuggler_s_lockbox','captain_s_strongbox','royal_navy_coffer','pirate_doubloon_chest','sunken_altar_chest']);
// what is inside a chest (opened with the capsule crack-open)
function chestLoot(e,rnd){rnd=rnd||Math.random;const r=e.r;const shells=Math.round(FIND_PRICE.treasure[r]*(1+rnd()*1.2));const items=[];
  const coins=catOf('set').filter(c=>c.set==='coins'&&c.how!=='gift'&&c.r<=r+1);if(rnd()<.35+r*.12)items.push(coins[Math.floor(rnd()*coins.length)].id);
  if(rnd()<.18+r*.1){const p=catOf('pearl').filter(c=>c.r<=r+1&&c.id!=='moon_pearl');items.push(p[Math.floor(rnd()*p.length)].id)}
  if(rnd()<.12+r*.05){const l=catOf('set').filter(c=>c.set==='lures'&&c.r<=r+1);items.push(l[Math.floor(rnd()*l.length)].id)}
  if(r>=2&&rnd()<.3){const cu=catOf('curio').filter(c=>c.r<=r);items.push(cu[Math.floor(rnd()*cu.length)].id)}
  return{shells,items}}
/* crew trips: the server (or your phone in play mode) rolls the haul when the trip ends */
function crewHaul(o,rnd){rnd=rnd||Math.random;const T=CFG.CREW.trips[o.trip];if(!T)return[];const n=Math.max(1,Math.round(T.rolls*(o.nft?CFG.CREW.nftBonus+.1*(o.rar||0):1)*(.8+rnd()*.4)));const out=[];
  const rodT=Math.min(4,Math.floor((o.lvl||1)/3)+(o.nft&&o.rar>=2?1:0));
  for(let i=0;i<n;i++){if(rnd()>.72)continue;const t=o.start+(i+rnd())/n*T.min*60000;const ctx={zone:o.zone,bait:'prawn',gear:{rodT,hookSnag:.5},env:envAt(t),near:{}};
    const tab=hookTable(ctx).filter(([e])=>e.cat==='fish'||e.cat==='junk');const e=pickW(tab,rnd());if(!e)continue;const cm=rollSize(e,rnd());out.push({id:e.id,cm,v:'',kg:fishKg(e,cm)})}
  return out}
// the $REEL cheque a crew brings back from the Crew Fund. o = {nft, rar, lvl, trip}
const LUCK_MEAN=(()=>{let s=0,w=0;for(const[m,k]of CFG.CREW.luck){s+=m*k;w+=k}return s/w})();
function crewRtp(o){const C=CFG.CREW;const base=o.nft?C.rtp.nft[o.rar||0]:C.rtp.hand;return base*(C.trips[o.trip]||C.trips[0]).rtp*(1+Math.min(C.lvlCap,Math.max(0,(o.lvl||1)-1)*C.lvlK))}
// below target the cheques shrink (down to half); above it they grow (up to 1.25x) until the surplus is paid back out
function crewFundHealth(fund){return Math.min(1.25,.5+.5*Math.max(0,fund)/CFG.CREW.fund.target)}
function crewCheque(o,fund,rnd){rnd=rnd||Math.random;const C=CFG.CREW;const T=C.trips[o.trip]||C.trips[0];const m=pickW(C.luck,rnd())/LUCK_MEAN;const health=crewFundHealth(fund);
  let amt=Math.round(T.fee*crewRtp(o)*m*health);amt=Math.max(0,Math.min(amt,Math.floor(Math.max(0,fund)/C.fund.safety)));return{amt,m:Math.round(m*LUCK_MEAN*10)/10,health}}
/* the daily Big Fish Derby: one species a day, longest fish after entering wins half the entries */
function derbySpecies(day){const pool=CAT.filter(e=>e.cat==='fish'&&e.r<=1&&e.how==='fish'&&!e.cp.where&&!e.cp.season&&!e.cp.moon&&!e.cp.sky&&!e.release&&['harbour','shallows','estuary','reef','kelp'].includes(e.z));return pool[Math.floor(hsh(day,606)*pool.length)]}
