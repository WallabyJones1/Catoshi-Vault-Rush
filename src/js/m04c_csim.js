/* ================= the five co-ops and the Harbour Cup (shared with the server) =================
   Each co-op has an AI captain and an AI crew that fish every day, so the Cup race is never empty. Their points
   follow the captain's style and come from the clock alone (the same on every phone and on the server).
   Real players' points are added on top. Prize pools come only from licence and co-op fees; in play mode a
   simulated town buys licences so the pools move, in live mode only real fees count. */
const COOPS=[
  {id:'brine',n:'Brine and Barrel Co.',s:'Brine & Barrel',col:'#c8443a',lt:'#f4e6c8',dk:'#6a2420',zones:['harbour','shallows'],style:'Steady volume: many common fish, every day.',perk:'One extra hold slot',perkK:'hold',captain:'Captain Marg Tully',motto:'Fill the hold. Then fill it again.',base:3680,vary:.14,crew:38,split:{fleet:35,bait:15,workshop:15,dividends:25,reserve:10},hall:'#e8d8b8'},
  {id:'gullwing',n:'Gullwing Fleet',s:'Gullwing',col:'#4aa0e0',lt:'#ffffff',dk:'#22507a',zones:['blue'],style:'Big pelagics, fast boats, boom or bust.',perk:'Boats 10% faster',perkK:'speed',captain:'Skipper Ray Okafor',motto:'Further out, faster back.',base:2934,vary:.55,crew:26,split:{fleet:45,bait:10,workshop:15,dividends:20,reserve:10},hall:'#dbe8f4'},
  {id:'reef',n:'Reefkeepers',s:'Reefkeepers',col:'#ff7a6b',lt:'#3fc0b0',dk:'#1f5a5a',zones:['reef'],style:'Collectors: discoveries and rare finds.',perk:'Better Logbook hints',perkK:'hints',captain:'Warden Iris Bell',motto:'Know every fish by name.',base:3426,vary:.3,crew:30,split:{fleet:20,bait:15,workshop:25,dividends:25,reserve:15},hall:'#f4dcd0'},
  {id:'deep',n:'Deepline Union',s:'Deepline',col:'#4a4aa0',lt:'#b08af0',dk:'#1c1c44',zones:['deep','wreck'],style:'Night crews and legendary hunters.',perk:'Free deck-lamp oil at night',perkK:'lamp',captain:'Old Silas Crane',motto:'The big ones swim at night.',base:3093,vary:.45,crew:22,split:{fleet:30,bait:25,workshop:10,dividends:15,reserve:20},hall:'#d8d4ec'},
  {id:'mob',n:'Mangrove Mob',s:'Mangrove Mob',col:'#7a8a3a',lt:'#a8885a',dk:'#3a3a1a',zones:['estuary'],style:'Pots and crabs: small, steady money.',perk:'One extra pot',perkK:'pot',captain:'Ma Dugan',motto:'Set it, forget it, eat crab.',base:3611,vary:.2,crew:34,split:{fleet:15,bait:30,workshop:10,dividends:35,reserve:10},hall:'#e4dcc0'}];
const COOPI=Object.fromEntries(COOPS.map(c=>[c.id,c]));
const CSIM={
  // AI crew points for a coop on a UTC day, up to minute m (0..1440)
  ai(id,day,m){const C=COOPI[id];const ci=COOPS.indexOf(C);const tot=C.base*(1+C.vary*(hsh(day,ci,11)*2-1));let all=0,got=0;const q=Math.floor(m/15),fr=(m%15)/15;
    for(let i=0;i<96;i++){const hr=i/4;const w=(.55+hsh(day,ci*97+i,12)*.9)*(hr>=4&&hr<8||hr>=17&&hr<21?1.5:hr<3?.5:1)*(id==='deep'&&(hr>=19||hr<5)?1.6:1);all+=w;if(i<q)got+=w;else if(i===q)got+=w*fr}
    let p=tot*got/all;if(id==='deep'||id==='gullwing'){const big=hsh(day,ci,13);if(big<.35){const at=Math.floor(hsh(day,ci,14)*1440);if(m>=at)p+=id==='deep'?420:260}}return Math.round(p)},
  standings(day,m,real){real=real||{};const rows=COOPS.map(C=>{const ai=this.ai(C.id,day,m),rl=Math.round((real[C.id]||0)*10)/10;return{id:C.id,ai,real:rl,pts:ai+rl}});rows.sort((a,b)=>b.pts-a.pts);rows.forEach((r,i)=>r.place=i);return rows},
  // the simulated town's fees (play mode): licences and co-op joins spread over the day
  inflow(day,m,fees){fees=fees||{};const L=CFG.LICENCE,CO=CFG.COOP,F=CFG.CUPFEED;const out={cup:0,bounty:0,machine:0,treasury:{},lic:0,joins:{},flows:{licence:0,coop:0,crew:0,exchange:0,machine:0,derby:0,cosmetic:0}};const fl=out.flows;
    const at=(i,s)=>Math.floor(hsh(day,i,s)*1440)<=m;
    const nl=4+Math.floor(hsh(day,1,21)*7);for(let i=0;i<nl;i++){if(!at(i,22))continue;out.lic++;fl.licence+=L.fee*L.split.cup;out.bounty+=L.fee*L.split.bounty;out.machine+=L.fee*L.split.machine}
    COOPS.forEach((C,ci)=>{const nj=1+Math.floor(hsh(day,ci,23)*4);out.treasury[C.id]=0;out.joins[C.id]=0;const fee=fees[C.id]!=null?fees[C.id]:CO.feeDefault[C.id];
      for(let i=0;i<nj;i++){if(!at(ci*31+i,24))continue;out.joins[C.id]++;out.treasury[C.id]+=fee*CO.split.treasury;fl.coop+=fee*CO.split.cup}});
    // the rest of the simulated town: crew trips, Shells bought with $REEL, machine pulls, derby entries, paint jobs
    const nc=6+Math.floor(hsh(day,2,25)*14);for(let i=0;i<nc;i++)if(at(i,26))fl.crew+=CFG.CREW.trips[i%3].fee*CFG.CREW.split.cup;
    const nx=8+Math.floor(hsh(day,3,27)*16);for(let i=0;i<nx;i++)if(at(i,28))fl.exchange+=(2000+Math.floor(hsh(day,i,29)*12)*1000)*F.exchange;
    const np=15+Math.floor(hsh(day,4,30)*40);for(let i=0;i<np;i++)if(at(i,31))fl.machine+=CFG.MACHINE.tiers[i%5].price*F.machine;
    const nd=4+Math.floor(hsh(day,5,32)*10);for(let i=0;i<nd;i++)if(at(i,33))fl.derby+=CFG.DERBY.entry*F.derby;
    const nk=Math.floor(hsh(day,6,34)*3);for(let i=0;i<nk;i++)if(at(i,35))fl.cosmetic+=(i%2?CFG.COSMETIC.paint:CFG.COSMETIC.boatName)*F.cosmetic;
    for(const k in fl){fl[k]=Math.round(fl[k]);out.cup+=fl[k]}return out},
  derbyField(day){const n=4+Math.floor(hsh(day,5,32)*10);const sp=derbySpecies(day);const out=[];for(let i=0;i<n;i++)out.push(Math.round((sp.sz[0]+(sp.sz[1]-sp.sz[0])*Math.pow(hsh(day,i,41),.8)*.96)*10)/10);return out.sort((a,b)=>b-a)},
  payout(pool,rows){const pot=pool*CFG.CUP.payoutFrac;return rows.map((r,i)=>{const prize=pot*CFG.CUP.places[i];return{id:r.id,place:i,prize,members:prize*CFG.CUP.memberShare,treasury:prize*(1-CFG.CUP.memberShare)}})},
  // how a co-op spends its treasury: the AI captain's plan, pulled toward the members' votes
  split(id,votes){const C=COOPI[id];const K=CFG.COOP.buckets;const acc={};let W=3;for(const k of K)acc[k]=C.split[k]*3;
    for(const v of votes||[]){const w=Math.sqrt((v.act||0)+1);W+=w;for(const k of K)acc[k]+=(v.split&&v.split[k]||0)*w}
    const out={};let s=0;for(const k of K){out[k]=Math.round(acc[k]/W);s+=out[k]}out.reserve+=100-s;return out},
  fee(id,votes,cur){const f=(votes||[]).map(v=>v.fee).filter(x=>typeof x==='number'&&x>=0).sort((a,b)=>a-b);if(f.length>=3)return Math.min(CFG.COOP.feeCap,f[Math.floor(f.length/2)]);return cur!=null?cur:CFG.COOP.feeDefault[id]},
  fleetLevel(amt){return Math.min(5,Math.floor(Math.log2(1+(amt||0)/60000)))},
  crew(id,day){const C=COOPI[id];return C.crew+Math.floor(hsh(day,COOPS.indexOf(C),31)*8)}};
