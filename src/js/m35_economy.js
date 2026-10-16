/* ================= the economy: pools, the house edge, licences, daily and weekly payouts =================
   Nothing is printed from thin air. Every $CATOSHI a cat spends is split between the prize pools and the house:
     Daily Pot   paid at 00:00 UTC: 70% to the top 10 licensed cats by points that day, 30% rolls into tomorrow
     Weekly Cup  paid Monday 00:00 UTC: 80% to the top 10 licensed cats by points that week, 20% rolls on
     Trip Fund   pays crew trip cheques; cheques average ~84% of the fee and scale with the fund's health
     House       the edge: 10-15% of everything; it pays Catoshi's gifts (Token Rain, bottles, the White Whale)
   Pools are the sum of every player's own ledger (contrib/<id>), so two players never overwrite each other. */
const SPLITS={
  licence:{daily:.30,weekly:.50,trips:.10,house:.10},
  shop:{daily:.30,weekly:.35,trips:.20,house:.15},
  auto:{daily:.45,weekly:.40,house:.15},
  trip:{trips:.85,weekly:.05,house:.10}};
const SPLIT_NAMES={licence:'Weekly licence',shop:'Boats, rods, reels, coolers and bait',auto:'Auto fishing fees',trip:'Crew trip fees'};
let LICENCE_PRICE=250,DAILY_PAY=.70,WEEKLY_PAY=.80,TRIP_TARGET=20000;const DAILY_ROLL=.30,WEEKLY_ROLL=.20;
const PRIZE_SPLIT=[30,20,14,10,8,6,4,3,3,2];
const CONTEST_PTS=[25,10,5,0];
function weekKey(d=new Date()){const t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-day);return t.toISOString().slice(0,10)}
const dayAgo=n=>dayKey(new Date(Date.now()-n*864e5));
const weekAgo=n=>weekKey(new Date(Date.now()-n*7*864e5));
const licensed=wk=>(S.lic||[]).includes(wk||weekKey());
function ledger(){if(!S.led)S.led={d:{},w:{},trips:0,house:0,tripsPaid:0,housePaid:0};return S.led}
function rollWeek(){const w=weekKey();if(S.week!==w){S.prevWeek=S.week||'';S.prevWpts=S.wpts||0;S.week=w;S.wpts=0;BOARD.dirty=true}}
function addPoints(p){S.today+=p;rollWeek();S.wpts=(S.wpts||0)+p;S.hist=S.hist||{};S.hist[S.day]=S.today;S.whist=S.whist||{};S.whist[S.week]=S.wpts;BOARD.dirty=true}
/* every purchase goes through here */
function spend(amount,kind){amount=Math.round(amount);if(S.bal<amount)return false;S.bal-=amount;const L=ledger(),sp=SPLITS[kind]||SPLITS.shop;const d=dayKey(),w=weekKey();
  if(sp.daily)L.d[d]=(L.d[d]||0)+amount*sp.daily;if(sp.weekly)L.w[w]=(L.w[w]||0)+amount*sp.weekly;if(sp.trips)L.trips+=amount*sp.trips;if(sp.house)L.house+=amount*sp.house;
  // keep ten days and four weeks of history
  for(const k of Object.keys(L.d))if(k<dayAgo(10))delete L.d[k];for(const k of Object.keys(L.w))if(k<weekAgo(4))delete L.w[k];
  if(sp.daily)POOLS.daily[d]=(POOLS.daily[d]||0)+amount*sp.daily;if(sp.weekly)POOLS.weekly[w]=(POOLS.weekly[w]||0)+amount*sp.weekly;POOLS.trips+=amount*(sp.trips||0);POOLS.house+=amount*(sp.house||0);
  LEDGER.dirty=true;dirty();refreshHud();return true}
/* Catoshi's gifts come out of the house reserve */
function payHouse(amount){let a=Math.round(amount);if(NET.db&&POOLS.at)a=Math.min(a,Math.max(0,Math.floor(POOLS.house)));if(a<=0)return 0;S.bal+=a;ledger().housePaid+=a;POOLS.house-=a;LEDGER.dirty=true;dirty();refreshHud();return a}
function payTripFund(amount){let a=Math.round(amount);if(POOLS.at)a=Math.max(0,Math.min(a,Math.floor(Math.max(0,POOLS.trips)*.5)));S.bal+=a;ledger().tripsPaid+=a;POOLS.trips-=a;LEDGER.dirty=true;dirty();refreshHud();return a}
const tripHealth=()=>POOLS.at?clamp(POOLS.trips/TRIP_TARGET,.5,1.25):1;

/* ---------------- the shared ledger and pool totals ---------------- */
const LEDGER={dirty:false,writing:false};
const POOLS={at:0,daily:{},weekly:{},trips:0,house:0,docs:[]};
async function flushLedger(){if(!LEDGER.dirty||LEDGER.writing||!NET.db||!NET.uid)return;LEDGER.dirty=false;LEDGER.writing=true;
  try{await NET.db.doc('contrib/'+NET.uid).set(JSON.parse(JSON.stringify(ledger())))}catch(e){}LEDGER.writing=false}
const LOCAL_SEED={trips:20000,house:10000,d:{},w:{}};
async function fetchPools(){if(!NET.db){computePools([LOCAL_SEED,ledger()]);return}
  try{const q=await NET.db.collection('contrib').limit(1000).get();const docs=q.docs.map(d=>d.data());if(NET.uid&&!q.docs.some(d=>d.id===NET.uid))docs.push(ledger());computePools(docs)}catch(e){}}
function computePools(docs){const raw={},wraw={};let trips=0,house=0;
  for(const L of docs){if(!L)continue;for(const[k,v]of Object.entries(L.d||{}))raw[k]=(raw[k]||0)+(+v||0);for(const[k,v]of Object.entries(L.w||{}))wraw[k]=(wraw[k]||0)+(+v||0);
    trips+=(+L.trips||0)-(+L.tripsPaid||0);house+=(+L.house||0)-(+L.housePaid||0)}
  // each pot carries what the last one didn't pay out
  const daily={};let carry=0;for(let n=10;n>=0;n--){const k=dayAgo(n);daily[k]=(raw[k]||0)+carry;carry=daily[k]*DAILY_ROLL}
  const weekly={};carry=0;for(let n=4;n>=0;n--){const k=weekAgo(n);weekly[k]=(wraw[k]||0)+carry;carry=weekly[k]*WEEKLY_ROLL}
  Object.assign(POOLS,{daily,weekly,trips,house,at:Date.now(),docs:docs.length})}
const potToday=()=>POOLS.daily[dayKey()]||0,cupWeek=()=>POOLS.weekly[weekKey()]||0;

/* ---------------- rankings from the board's history ---------------- */
function rankFor(kind,key){if(!BOARD.docs)return[];return BOARD.docs.map(d=>{const h=kind==='d'?(d.hist||{}):(d.whist||{});let pts=+h[key]||0;if(kind==='d'&&!pts)pts=d.day===key?(d.fish|0):d.prevDay===key?(d.prevFish|0):0;
  return{id:d.id,name:String(d.name||'Cat').slice(0,16),coat:COATI[d.coat]?d.coat:'ginger',pts,lic:Array.isArray(d.lic)&&d.lic.includes(kind==='d'?weekKey(new Date(key+'T12:00:00Z')):key)}}).filter(r=>r.pts>0).sort((a,b)=>b.pts-a.pts)}
function prizeTable(rows,pool){const win=rows.filter(r=>r.lic).slice(0,10);const tot=PRIZE_SPLIT.slice(0,win.length).reduce((a,b)=>a+b,0)||1;return win.map((r,i)=>Object.assign({},r,{prize:Math.floor(pool*PRIZE_SPLIT[i]/tot)}))}
/* claim what you won: each cat pays itself its share of a closed pot, once */
function checkPayouts(){if(!NET.db||!NET.uid||!BOARD.docs||!POOLS.at||!S.coat)return;S.paidD=S.paidD||{};S.paidW=S.paidW||{};const wins=[];
  const ord=i=>(i+1)+(['st','nd','rd'][i]||'th');
  for(let n=1;n<=7;n++){const k=dayAgo(n);if(S.paidD[k])continue;S.paidD[k]=1;const tb=prizeTable(rankFor('d',k),(POOLS.daily[k]||0)*DAILY_PAY);const i=tb.findIndex(r=>r.id===NET.uid);if(i>=0&&tb[i].prize>0)wins.push({what:`Daily Pot, ${k}`,place:ord(i),amount:tb[i].prize})}
  for(let n=1;n<=3;n++){const k=weekAgo(n);if(S.paidW[k])continue;S.paidW[k]=1;const tb=prizeTable(rankFor('w',k),(POOLS.weekly[k]||0)*WEEKLY_PAY);const i=tb.findIndex(r=>r.id===NET.uid);if(i>=0&&tb[i].prize>0)wins.push({what:`Weekly Cup, week of ${k}`,place:ord(i),amount:tb[i].prize})}
  for(const k of Object.keys(S.paidD))if(k<dayAgo(12))delete S.paidD[k];for(const k of Object.keys(S.paidW))if(k<weekAgo(6))delete S.paidW[k];
  dirty();if(!wins.length)return;const total=wins.reduce((a,w)=>a+w.amount,0);S.bal+=total;dirty();refreshHud();sfx('jackpot');
  showSheet('payout','Catoshi pays out',b=>{b.append(portraitCatoshi());for(const w of wins)b.append(row(S.coat,w.what,`You came ${w.place}`,`+${fmt(w.amount)}`));
    b.append(el('div','payout',`+${fmt(total)}<small>$CATOSHI FROM THE POOLS</small>`),btn('big','Thank you, Catoshi',closeSheet))})}

/* ---------------- the licence ---------------- */
function buyLicence(){const w=weekKey();if(licensed(w))return toast('You already have this week\'s licence');if(!spend(LICENCE_PRICE,'licence')){toast('Not enough $CATOSHI');sfx('error');return}
  S.lic=(S.lic||[]).filter(k=>k>=weekAgo(3));S.lic.push(w);BOARD.dirty=true;dirty();sfx('stamp');toast('Licensed for this week');if(SHEET.kind==='treasury')openTreasury();else if(SHEET.kind==='licence')closeSheet()}
function openLicence(){showSheet('licence','Harbourmaster',b=>{const w=weekKey();const have=licensed(w);
  b.append(el('p','lead',`Anyone can fish in Gullhaven. To win a share of the <b>Daily Pot</b> or the <b>Weekly Cup</b> you need this week's fishing licence.`));
  b.append(el('p','odds',`A licence costs <b>${LICENCE_PRICE} $CATOSHI</b> and lasts until Monday 00:00 UTC. ${SPLITS.licence.daily*100}% of it goes into the Daily Pot, ${SPLITS.licence.weekly*100}% into the Weekly Cup, ${SPLITS.licence.trips*100}% into the Trip Fund and ${SPLITS.licence.house*100}% to the house.`));
  b.append(have?el('div','payout','LICENSED<small>THIS WEEK</small>'):btn('big',`Buy this week's licence (${LICENCE_PRICE})`,buyLicence));b.append(btn('sm','HOW THE POOLS WORK',openTreasury))})}

/* ---------------- Catoshi's treasury: every pool, in the open ---------------- */
async function openTreasury(){const draw=b=>{const ms=Date.parse(dayKey()+'T00:00:00Z')+864e5-Date.now();const wms=Date.parse(weekKey()+'T00:00:00Z')+7*864e5-Date.now();
  const pool=(name,val,sub)=>{const r=el('div','row pool');r.append(coinCv());const t=el('div','tx');t.append(el('b','',name),el('small','',sub));r.append(t,el('span','num',fmt(Math.floor(val))));return r};
  b.append(el('p','lead','Every $CATOSHI spent in Gullhaven goes into these pools. Nothing is printed from thin air, and the house keeps a small cut so Catoshi can keep paying out.'));
  b.append(pool('Daily Pot',potToday(),`Pays in ${Math.floor(ms/36e5)}h ${Math.floor(ms%36e5/6e4)}m: ${DAILY_PAY*100}% to the top 10 licensed cats by points today`));
  b.append(pool('Weekly Cup',cupWeek(),`Pays in ${Math.floor(wms/864e5)}d ${Math.floor(wms%864e5/36e5)}h: ${WEEKLY_PAY*100}% to the top 10 licensed cats this week`));
  b.append(pool('Trip Fund',POOLS.trips,`Pays crew trip cheques. Health ${Math.round(tripHealth()*100)}%`));
  b.append(pool('House',POOLS.house,'Catoshi\'s reserve. Pays for Token Rain, bottles and the White Whale'));
  if(!NET.db)b.append(el('p','odds','Pools are shared between players when you are signed in to claude.ai. Right now you only see your own spending.'));
  b.append(el('h4','sec','WHERE THE MONEY GOES'));
  const tb=el('div','split');tb.append(el('span','h',''),el('span','h','DAILY'),el('span','h','WEEKLY'),el('span','h','TRIPS'),el('span','h','HOUSE'));
  for(const[k,sp]of Object.entries(SPLITS)){tb.append(el('span','',SPLIT_NAMES[k]));for(const f of['daily','weekly','trips','house'])tb.append(el('span','n',sp[f]?Math.round(sp[f]*100)+'%':'-'))}
  b.append(tb);
  b.append(el('h4','sec','HOW PRIZES ARE SPLIT'));
  b.append(el('p','odds',`Top 10 licensed cats share the payout: ${PRIZE_SPLIT.map((p,i)=>`${i+1}${['st','nd','rd'][i]||'th'} ${p}%`).join(', ')}. With fewer than 10 winners the shares scale up so the whole payout goes out. What is not paid (${DAILY_ROLL*100}% daily, ${WEEKLY_ROLL*100}% weekly) rolls into the next pot. Points come from fish in Catoshi's basket and from contest places (${CONTEST_PTS.slice(0,3).join(', ')} points). Auto-caught fish score ${Math.round(AUTO_RATE*100)}%.`));
  b.append(el('p','odds',`<b>The house edge.</b> The house keeps 10% to 15% of spending, and trip cheques average about 84% of the fee before the fund's health is applied. That margin is what lets the pools keep paying while players win.`));
  b.append(licensed()?el('p','lead','<b>You are licensed this week.</b>'):btn('big',`Buy this week's licence (${LICENCE_PRICE})`,buyLicence))};
  showSheet('treasury','Catoshi\'s treasury',draw);if(NET.db&&Date.now()-POOLS.at>8000){await fetchPools();if(SHEET.kind==='treasury')showSheet('treasury','Catoshi\'s treasury',draw)}}
setInterval(()=>{flushLedger()},10000);
