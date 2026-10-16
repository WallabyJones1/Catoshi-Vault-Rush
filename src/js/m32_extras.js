/* ================= contests, trips, shop, cats, board, and the hidden things: the White Whale, Token Rain, bottles, replays ================= */

/* ---------------- contest ---------------- */
const CT={on:false,end:0};
function startContest(){if(CT.on)return;if(busy())return;if(!(SPOT&&SPOT.contest))return toast('Contests happen at the Pier');seatRivals();if(!RIV.length){toast('Your rivals are all at sea.');return}
  CT.on=true;CT.end=now()+CONTEST.secs;PL.n=0;PL.kg=0;
  for(const r of RIV){r.n=0;r.kg=0;r.skill=.7+Math.random()*.32;r.st='wait';r.next=now()+3+Math.random()*6/r.skill}
  sfx('whistle');toast('Go! Most fish in 90 seconds wins.');renderRace(true);$('race').hidden=false;$('nContest').classList.add('on')}
function endContest(){CT.on=false;$('race').hidden=true;$('nContest').classList.remove('on');
  if(['aim','cast','wait','bite','fight','net'].includes(PL.st)){PL.st='idle';PL.fv=null;PL.FT=null;mgHide();setAct('CAST')}
  const all=[{coat:S.coat,name:S.name||COATI[S.coat].name,n:PL.n,kg:PL.kg,me:true},...RIV.map(r=>({coat:r.coat,name:COATI[r.coat].name,n:r.n,kg:r.kg}))].sort((a,b)=>b.n-a.n||b.kg-a.kg);
  const place=all.findIndex(a=>a.me),prize=CONTEST_PTS[place]||0;S.contests++;if(place===0)S.wins++;if(prize)addPoints(prize);dirty();refreshHud();BOARD.dirty=true;
  sfx(place===0?'jackpot':'horn');catoshiWave=2.5;if(place===0)coinBurst(PL.x+14,LAY.deckY-30,18);
  showSheet('results','Contest results',b=>{
    b.append(portraitCatoshi(),el('p','lead',place===0?`<b>${esc(all[0].name)}</b> brought Catoshi the most fish. Catoshi is pleased with you.`:`<b>${esc(all[0].name)}</b> brought Catoshi the most fish. You came ${['1st','2nd','3rd','4th'][place]}.`));
    all.forEach((a,i)=>{const r=row(a.coat,`${i+1}. ${a.name}${a.me?' (you)':''}`,`${a.kg.toFixed(1)} kg`,`${a.n} fish`);if(a.me)r.classList.add('me');if(i===0)r.classList.add('gold');b.append(r)});
    if(prize)b.append(el('div','payout',`+${fmt(prize)} points<small>FOR ${['1ST','2ND','3RD'][place]} PLACE. POINTS WIN YOU A SHARE OF THE POOLS.</small>`));
    b.append(btn('big','Another contest',()=>{closeSheet();startContest()}))})}
function renderRace(build){const R=$('race');const list=[{f:PL,me:true},...RIV.map(f=>({f}))];
  if(build){R.innerHTML='';R.append(el('span','t','60'));for(const{f,me}of list){const c=el('span','c'+(me?' me':''));c.append(faceCv(f.coat));c.append(el('span','',String(f.n)));R.append(c)}}
  else{const cs=R.querySelectorAll('.c span');list.forEach((o,i)=>{if(cs[i])cs[i].textContent=o.f.n})}}

/* ---------------- trips ---------------- */
function tripState(k){const t=S.trips[k];if(!t||!TRIPI[t.k])return null;return Object.assign({},t,{trip:TRIPI[t.k],done:Date.now()>=t.end})}
function sendTrip(coat,k){const T=TRIPI[k];if(S.bal<T.fee){toast('Not enough $CATOSHI');sfx('error');return}if(S.trips[coat])return;
  if(!spend(T.fee,'trip'))return;S.trips[coat]={k,start:Date.now(),end:Date.now()+T.ms};dirty();refreshHud();sfx('horn');seatRivals();
  say(`${COATI[coat].name} is off on the ${T.n}. Bring back something shiny.`,3000,0);openTrips()}
function tripRoll(T){const r=secureRand();let mult,tier;
  if(r<.01){mult=10;tier='jackpot'}else if(r<.05){mult=2.5+secureRand()*1.5;tier='big'}else if(r<.17){mult=1.3+secureRand()*.6;tier='good'}else if(r<.50){mult=.6+secureRand()*.4;tier='ok'}else{mult=.1+secureRand()*.4;tier='low'}mult*=tripHealth();
  const n=T.fish[0]+Math.floor(secureRand()*(T.fish[1]-T.fish[0]+1));const fish=[];if(tier==='jackpot')fish.push(pickOne(FPOOL[4]));
  while(fish.length<n){let f=rollFish(T.lean+(tier==='big'?2:0),secureRand,null);if(f.cat==='legend'&&tier!=='jackpot')f=pickOne(FPOOL[3]);fish.push(f)}
  return{mult,tier,pay:Math.round(T.fee*mult),fish}}
function collectTrip(coat){const t=tripState(coat);if(!t||!t.done)return;const res=tripRoll(t.trip);delete S.trips[coat];res.pay=payTripFund(res.pay);res.mult=res.pay/t.trip.fee;dirty();refreshHud();seatRivals();
  sfx(res.tier==='jackpot'||res.tier==='big'?'jackpot':'coin');if(res.tier==='jackpot'){catoshiWave=3;coinBurst(VW/2,VH/2,26)}
  showSheet('trip',`${COATI[coat].name} is back`,b=>{b.append(portraitCat(coat));
    if(res.tier==='jackpot')b.append(el('div','jack','CATOSHI\'S JACKPOT  10x'));else if(res.tier==='big')b.append(el('div','jack','BIG HAUL'));
    b.append(el('p','lead',`Back from the <b>${t.trip.n}</b> with ${res.fish.length} fish.`));
    const h=el('div','haul');for(const f of res.fish){const c=cvOf(catArt(f.id));c.title=f.n;h.append(c)}b.append(h);
    b.append(el('div','payout',`+${fmt(res.pay)}<small>$CATOSHI  (${res.mult.toFixed(res.mult<10?2:0)}x THE ${fmt(t.trip.fee)} FEE)</small>`));
    b.append(btn('big','Collect',openTrips))})}
function openTrips(){showSheet('trips','Fishing trips',b=>{
  b.append(el('p','lead','Send a cat from your crew out to sea. Each trip costs a fee in <b>$CATOSHI</b>. The crew come back with a haul and a share of the catch money.'));
  b.append(el('p','odds',`Cheques come from the Trip Fund, which gets 85% of every trip fee. Half of trips pay back <b>10% to 50%</b>, a third pay <b>60% to 100%</b>, about <b>1 in 8</b> pays 1.3 to 1.9x, <b>1 in 25</b> is a big haul at 2.5 to 4x, and <b>1 in 100</b> hits Catoshi\'s jackpot: <b>10x</b> and a legendary fish. On average a trip returns about 84% of its fee, scaled by the fund's health (now ${Math.round(tripHealth()*100)}%). No cheque can be more than half the fund.`));
  for(const cd of COATS){if(cd.k===S.coat)continue;const t=tripState(cd.k);let sub='At home',chip=null;
    if(t){if(t.done){sub=`Back from the ${t.trip.n}`;chip=btn('chip back','COLLECT',()=>collectTrip(cd.k))}else{sub=`On the ${t.trip.n}`;chip=el('span','chip go',fmtLeft(t.end-Date.now()));chip.dataset.end=t.end}}
    else chip=btn('sm','SEND',()=>chooseTrip(cd.k));
    const r=row(cd.k,cd.name,sub);r.append(chip);b.append(r)}})}
function chooseTrip(coat){showSheet('trips2',`Send ${COATI[coat].name}`,b=>{b.append(portraitCat(coat),el('p','lead','Pick a trip. Longer trips cost more and bring back more fish.'));
  const tg=el('div','trips');for(const T of TRIPS){const bt=el('button','px');const bc=boatSide(T.boat);bt.append(cvOf(bc,0,0,`width:${bc.width}px`),el('b','',T.n),el('small','',`${T.ms/60e3} min`));
    const fee=el('span','fee');fee.append(coinCv(),document.createTextNode(fmt(T.fee)));bt.append(fee);bt.disabled=S.bal<T.fee;bt.onclick=()=>{sfx('click');sendTrip(coat,T.k)};tg.append(bt)}
  b.append(tg,btn('sm','BACK',openTrips))})}
const fmtLeft=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return s>=60?`${Math.floor(s/60)}m ${String(s%60).padStart(2,'0')}s`:`${s}s`};

/* ---------------- shop: bait, rods, auto fishing ---------------- */
function iconRow(img,title,sub){const r=el('div','row');const c=cvOf(img,0,0,`width:${img.width*2}px;height:${img.height*2}px`);const w=el('span','ico');w.append(c);r.append(w);const t=el('div','tx');t.append(el('b','',esc(title)));if(sub)t.append(el('small','',sub));r.append(t);return r}
function gearRows(b,list,owned,cur,setCur,title){b.append(el('h4','sec',title));list.forEach((R,i)=>{const r=iconRow(gearIcon(R.ico),R.n,R.d);let a;
    if(cur===i)a=el('span','chip go','EQUIPPED');else if(owned[i])a=btn('sm','EQUIP',()=>{setCur(i);dirty();refreshHud();openShop()});
    else{a=btn('sm buy',fmt(R.price),()=>{if(!spend(R.price,'shop')){toast('Not enough $CATOSHI');sfx('error');return}owned[i]=1;setCur(i);sfx('buy');dirty();refreshHud();openShop()});a.prepend(coinCv());a.disabled=S.bal<R.price}
    r.append(a);b.append(r)})}
function openShop(){showSheet('shop','Tackle shop',b=>{
  b.append(el('p','lead','Fishing by hand costs one bait per cast. Better bait brings rarer fish. Rods, reels and line decide how big a fish you can land. A bigger cooler carries more fish home to Catoshi.'));
  b.append(el('h4','sec','BAIT'));
  for(const B of BAITS){const r=iconRow(baitIcon(B.k),B.n,`${B.d} You have <b>${S.bait[B.k]||0}</b>.`);const col=el('div','col');
    col.append(btn('sm'+(S.baitSel===B.k?' on':''),S.baitSel===B.k?'USING':'USE',()=>{S.baitSel=B.k;dirty();refreshHud();openShop()}));
    const buy=btn('sm buy',`+${B.pack}  ${B.price}`,()=>{if(!spend(B.price,'shop')){toast('Not enough $CATOSHI');sfx('error');return}S.bait[B.k]=(S.bait[B.k]||0)+B.pack;sfx('buy');dirty();refreshHud();openShop()});buy.prepend(coinCv());buy.disabled=S.bal<B.price;col.append(buy);r.append(col);b.append(r)}
  const G=(k,title,desc)=>gearRows(b,GEAR[k].map((g,i)=>({n:g.n,price:g.price,ico:k+i,d:desc(g)})),S.own[k],S.gear[k],i=>{S.gear[k]=i},title);
  G('rod','RODS',g=>`Power ${g.power}. Cast ${Math.round(g.cast*100)}%. More power wins longer fights.`);G('reel','REELS',g=>`Drag ${g.drag}, speed ${g.speed}. Drag eases the tension, speed brings fish in.`);G('line','LINE',g=>`Strength ${g.str}. Strong line survives the runs of big fish.`);gearRows(b,COOLERS,S.coolers,S.cooler||0,i=>{S.cooler=i},'COOLERS');
  b.append(el('h4','sec','TOOLS'));
  for(const[k,n,price,d]of[['shovel','Shovel',150,'Dig up treasure at the X marks on the islands.'],['grapple','Grapple',400,'Haul salvage up from the wrecks at Wreck Rock.']]){const r=iconRow(uiIcon(k==='shovel'?'shovel':'grapple'),n,d);let a;if(S.tools[k])a=el('span','chip go','OWNED');else{a=btn('sm buy',fmt(price),()=>{if(!spend(price,'shop')){toast('Not enough $CATOSHI');sfx('error');return}S.tools[k]=1;sfx('buy');dirty();refreshHud();openShop()});a.prepend(coinCv());a.disabled=S.bal<price}r.append(a);b.append(r)}
  b.append(el('h4','sec','AUTO FISHING'));
  b.append(el('p','odds',`Your cat casts, strikes and fights by itself with a steady but imperfect hand. No bait used. Each cast costs <b>${AUTO_COST} $CATOSHI</b>, lands about two fish in three, and auto-caught fish are worth <b>${Math.round(AUTO_RATE*100)}%</b> of a fish you land yourself.`));
  b.append(btn('big',S.auto?'Turn auto fishing off':'Turn auto fishing on',()=>{toggleAuto();openShop()}))})}
function toggleAuto(){S.auto=!S.auto;if(S.auto&&S.bal<AUTO_COST){S.auto=false;toast('Not enough $CATOSHI for auto fishing')}else toast(S.auto?`Auto fishing on: ${AUTO_COST} $CATOSHI per cast`:'Auto fishing off');refreshHud()}

/* ---------------- choose a cat ---------------- */
function openPick(forced){let sel=S.coat||pickOne(COATS).k;
  showSheet('pick',forced?'Pick your cat':'Your cat',b=>{
    const p=el('div','portrait');const pc=document.createElement('canvas');pc.width=30;pc.height=28;pc.className='pix';pc.style.cssText='width:120px;height:112px';p.append(pc);
    const name=document.createElement('input');name.id='catName';name.maxLength=16;name.autocomplete='off';name.value=S.name||COATI[sel].name;
    const grid=el('div','grid');
    const paint=()=>{const x=pc.getContext('2d');x.clearRect(0,0,30,28);x.drawImage(catSide(sel),0,0);grid.querySelectorAll('button').forEach(bb=>bb.classList.toggle('on',bb.dataset.k===sel))};
    for(const cd of COATS){const bb=document.createElement('button');bb.dataset.k=cd.k;bb.append(faceCv(cd.k),document.createTextNode(cd.n.toUpperCase()));
      bb.disabled=!!S.trips[cd.k];bb.onclick=()=>{const wasDefault=!name.value||COATS.some(c=>c.name===name.value);sel=cd.k;if(wasDefault)name.value=cd.name;paint();sfx('click')};grid.append(bb)}
    b.append(el('p','lead',forced?'Catoshi wants fish. Pick the cat who will bring them to him.':'Switch cats any time. Your other cats are your crew for fishing trips.'),p,grid);
    const lab=el('label','fld','YOUR CAT\'S NAME');lab.append(name);b.append(lab);
    b.append(btn('big',forced?'Fish for Catoshi':'Done',()=>{const nm=name.value.replace(/[<>]/g,'').trim().slice(0,16);S.coat=sel;S.name=nm||COATI[sel].name;delete S.trips[sel];
      PL=Object.assign(mkFisher(S.coat,LAY.playerX,true),{n:PL&&!PL.hide?PL.n:0,kg:PL&&!PL.hide?PL.kg:0});if(MODE==='fish')seatRivals();else spawnNpcs();BOARD.dirty=true;dirty();refreshHud();setMode();closeSheet();
      if(!S.hint){S.hint=1;toast('Catoshi waits on his golden chair in the square')}}));
    paint()},forced)}

/* ---------------- board + big catches ---------------- */
function replayRow(rp,mine){const e=rp.kind==='whale'?null:CATI[rp.fishId];const title=rp.kind==='whale'?'The White Whale':e?`${rp.cm} cm ${e.n}`:'A big catch';
  const r=row(COATI[rp.coat]?rp.coat:'ginger',title,`${String(rp.name||'Cat').slice(0,16)}${rp.pay?'  +'+fmt(rp.pay)+' $CATOSHI':''}`);const col=el('div','col');
  col.append(btn('sm','WATCH',()=>{closeSheet();playReplay(rp,false)}));if(mine&&NET.db)col.append(btn('sm',rp.shared?'SHARED':'SHARE',()=>shareReplay(rp).then(()=>openBoard())));r.append(col);return r}
async function openBoard(tab){tab=tab||BOARD.tab||'day';BOARD.tab=tab;const draw=b=>{
  const tabs=el('div','tabs');for(const[k,l]of[['day','TODAY'],['week','THIS WEEK'],['catches','BIG CATCHES']]){const t=btn('sm'+(tab===k?' on':''),l,()=>openBoard(k));tabs.append(t)}b.append(tabs);
  if(tab==='catches'){const feed=(BOARD.feed||[]).filter(r=>r.kind==='whale'||CATI[r.fishId]);
    if(feed.length)feed.slice(0,12).forEach(r=>b.append(replayRow(r,false)));else b.append(el('p','odds','Land a rare fish or find the White Whale, then tap SHARE to put your replay here for everyone.'));
    if(S.replays.length){b.append(el('h4','sec','YOUR REPLAYS'));S.replays.forEach(r=>b.append(replayRow(r,true)))}return}
  const day=tab==='day',key=day?dayKey():weekKey(),pool=day?potToday()*DAILY_PAY:cupWeek()*WEEKLY_PAY;
  const ms=day?Date.parse(key+'T00:00:00Z')+864e5-Date.now():Date.parse(key+'T00:00:00Z')+7*864e5-Date.now();
  const head=el('div','row pool');head.append(coinCv());const ht=el('div','tx');ht.append(el('b','',day?'Daily Pot':'Weekly Cup'),el('small','',`Pays ${fmt(Math.floor(pool))} $CATOSHI in ${day?'':Math.floor(ms/864e5)+'d '}${Math.floor(ms%864e5/36e5)}h ${Math.floor(ms%36e5/6e4)}m`));head.append(ht,el('span','num',fmt(Math.floor(day?potToday():cupWeek()))));b.append(head);
  if(!licensed())b.append(el('p','odds','<b>You have no licence this week.</b> Your points still show here, but only licensed cats share the pools.'),btn('sm','GET A LICENCE',openLicence));
  if(!NET.db)b.append(el('p','odds','The shared board needs you signed in to claude.ai.'));
  const rows=rankFor(day?'d':'w',key);const prizes=prizeTable(rows,pool);
  if(!rows.length)b.append(el('p','odds','No points on the board yet. Drop a fish in Catoshi\'s basket and you lead.'));
  rows.slice(0,25).forEach((r,i)=>{const pz=prizes.find(p=>p.id===r.id);const x=row(r.coat,`${i+1}. ${r.name}`,pz?`Wins about ${fmt(pz.prize)} $CATOSHI`:r.lic?'':'No licence',`${fmt(r.pts)} pts`);if(r.id===NET.uid)x.classList.add('me');if(pz&&prizes[0]===pz)x.classList.add('gold');b.append(x)});
  b.append(el('p','lead',`Your record: <b>${fmt(S.total)}</b> fish, <b>${S.wins}</b> contest wins from ${S.contests}, <b>${S.whales||0}</b> white whales.`),btn('sm','HOW THE POOLS WORK',openTreasury));
  const ca=el('div','ca');ca.append(coinCv());ca.append(el('code','',`$CATOSHI on Solana<br>${CATOSHI_CA}`));const cp=el('button','sm','COPY');cp.onclick=()=>{try{navigator.clipboard.writeText(CATOSHI_CA).then(()=>{cp.textContent='COPIED'},()=>{cp.textContent='SELECT IT'})}catch(e){cp.textContent='SELECT IT'}};ca.append(cp);b.append(ca)};
  showSheet('board','Catoshi\'s board',draw);
  if(NET.db&&Date.now()-BOARD.at>5000){await flushBoard();await flushLedger();await fetchBoard();await fetchPools();if(SHEET.kind==='board')showSheet('board','Catoshi\'s board',draw)}}

/* ---------------- the White Whale ---------------- */
// swims under the pier, surfaces out in the harbour to spout, dives with its flukes up. Tap it to play Spout Spotter.
let WH={st:'none',next:now()+35+Math.random()*25,t:0};
const WL=()=>LAY.horizon+30;
function whaleStart(){WH={st:'swim',t:0,x:VW+40,y:LAY.surfY+46+Math.random()*Math.max(10,VH-LAY.surfY-130),next:0};if(Math.random()<.6)setTimeout(()=>say('Is that... the White Whale?',3000,0),1200)}
function whaleRect(){if(WH.st==='swim')return{x:WH.x,y:WH.y,w:92,h:40};if(WH.st==='surface'||WH.st==='dive')return{x:WH.x,y:WL()-24,w:92,h:30};if(WH.st==='game'&&WG.up)return{x:WG.x-4,y:WL()-20,w:92,h:24};return null}
function whaleUpdate(dt,t){WH.t+=dt;const L=LAY;
  if(WH.st==='none'){if(t>=WH.next&&MODE==='fish'&&SPOT&&SPOT.zone!=='estuary'&&!CT.on&&!RPLAY&&!RAIN)whaleStart();return}
  if(WH.st==='swim'){WH.x-=22*dt;if(Math.random()<dt*4)PART.push({x:WH.x+10,y:WH.y+6,vx:0,vy:-18,life:1.4,t:0,g:0,col:'rgba(220,240,255,.6)',s:1});if(WH.x<-100){WH.st='surface';WH.t=0;WH.x=L.sx0+20+Math.random()*Math.max(10,L.stageW-120)}}
  else if(WH.st==='surface'){for(const at of[1.6,3.4])if(WH.t-dt<at&&WH.t>=at)spout(WH.x+12,WL()-20);if(WH.t>5.5){WH.st='dive';WH.t=0}}
  else if(WH.st==='dive'){if(WH.t>3.2){WH.st='none';WH.next=t+90+Math.random()*90}}
  else if(WH.st==='game')whaleGameUpdate(dt,t)
  else if(WH.st==='breach'){const prev=WH.t-dt;if(prev<.4&&WH.t>=.4){splash(WH.bx+46,WL(),26,1.6);sfx('splash')}if(prev<2.05&&WH.t>=2.05){splash(WH.bx+46,WL(),50,2.2);ripple(WH.bx+46,WL(),40);CAM.shake=7;CAM.flash=.5;CAM.flashCol='#ffffff';sfx('pow');setTimeout(()=>sfx('splash'),90)}
    if(!RPLAY)camFocus(WH.bx+46,WL()-24,1.5);if(WH.t>3.4){if(RPLAY)return;whaleWin()}}}
function spout(x,y){sfx('burstsoft');for(let i=0;i<22;i++)PART.push({x:x+(Math.random()-.5)*3,y,vx:(Math.random()-.5)*14,vy:-55-Math.random()*40,life:1+Math.random()*.4,t:0,g:70,col:Math.random()<.6?'#ffffff':'#cfe8ff',s:Math.random()<.3?2:1})}
// whale pose for drawing: {img,x,y,ang,clip}
function whalePose(t){const L=LAY,wl=WL();
  if(WH.st==='swim')return{img:whaleArt(Math.floor(t*4)),x:WH.x,y:WH.y,under:1};
  if(WH.st==='surface'){const k=Math.min(1,WH.t/1.2);return{img:whaleArt(Math.floor(t*3)),x:WH.x,y:wl-18+(1-k)*22+Math.sin(t*1.5)*1,clip:wl}}
  if(WH.st==='dive'){if(WH.t<1)return{img:whaleArt(1),x:WH.x+WH.t*8,y:wl-18+WH.t*26,clip:wl};const k=(WH.t-1)/2.2;return{img:flukeArt(k<.5?0:1),x:WH.x+60,y:wl-30+Math.max(0,(k-.45))*60,clip:wl}}
  if(WH.st==='breach'||(RPLAY&&RPLAY.rp.kind==='whale'&&RPLAY.ph==='breach')){const tt=WH.t;const k=clamp((tt-.4)/1.65,0,1);const h=Math.sin(k*Math.PI);
    return{img:whaleArt(Math.floor(tt*6)),x:WH.bx,y:wl-14-h*(wl-L.horizon+34),ang:(.9-k*1.6)*(tt>.4?1:0),clip:wl}}
  return null}
/* Spout Spotter: tap the whale each time it surfaces. Five hits and it breaches for you. */
let WG=null;
function whaleGameStart(){if(CT.on||RPLAY||RAIN)return;if(!['idle','show','wait'].includes(PL.st))return toast('Land your fish first!');if(PL.st==='wait'){PL.st='idle'}hideCard();
  WH.st='game';WH.t=0;WG={round:0,hits:0,strikes:0,up:false,gap:.8,x:0,win:0};sfx('whistle');say('The White Whale! Tap it every time it surfaces.',3500,2);setAct('SPOT IT!','wait');$('ctlBar').classList.add('dim')}
function whaleGameUpdate(dt,t){const L=LAY;if(!WG.up){WG.gap-=dt;if(WG.gap<=.45&&!WG.bub){WG.bub=1;WG.x=L.sx0+10+Math.random()*Math.max(10,L.stageW-60);for(let i=0;i<8;i++)ripple(WG.x+20,WL(),6+i)}
    if(WG.gap<=0){WG.up=true;WG.bub=0;WG.t=0;WG.win=Math.max(.75,1.7-WG.round*.2);spout(WG.x+6,WL()-20)}}
  else{WG.t+=dt;if(WG.t>WG.win){WG.up=false;WG.strikes++;sfx('miss');toast(WG.strikes>=2?'It\'s gone...':'Missed it!');WG.gap=.9;if(WG.strikes>=2)whaleGameEnd(false)}}}
function whaleHit(){if(!WG||!WG.up)return;WG.up=false;WG.hits++;WG.round++;splash(WG.x+20,WL()-6,14,1);sfx('good');popText(`${WG.hits}/5`,WG.x+10,WL()-36,'#fff6e0');WG.gap=.7;if(WG.hits>=5)whaleGameEnd(true)}
function whaleGameEnd(ok){$('ctlBar').classList.remove('dim');if(!ok){WH.st='dive';WH.t=0;WH.x=WG.x-30;payHouse(10);setAct('CAST');say('It escaped. Have ten for trying.',2500,0);WG=null;return}
  WH.st='breach';WH.t=0;WH.bx=WG.x-30;WG=null;sfx('rumble');say('LOOK!',2000,2)}
function whaleWin(){camReset();WH.st='none';WH.next=now()+150+Math.random()*120;const wp=payHouse(WHALE_PRIZE);S.whales=(S.whales||0)+1;
  const rp={kind:'whale',spot:SPOT?SPOT.k:'harbour',coat:S.coat,name:S.name||COATI[S.coat].name,bx:(WH.bx-LAY.sx0)/LAY.stageW,pay:0,at:Date.now()};S.replays.unshift(rp);S.replays=S.replays.slice(0,8);dirty();refreshHud();
  sfx('jackpot');coinBurst(PL.x+14,LAY.deckY-30,30);setAct('CAST');
  const C=$('card');C.innerHTML='';C.append(el('div','winTag','CATOSHI WIN'),cvOf(whaleArt(0),0,0,'width:184px;height:80px'),el('h3','','The White Whale'),el('div','rar','SPOTTED AND BREACHED'),el('div','info',`<b>+${wp} $CATOSHI from Catoshi's house</b>`));
  const bar=el('div','cbar');bar.append(btn('sm','REPLAY',()=>playReplay(rp,false)));if(NET.dl)bar.append(btn('sm','SAVE CLIP',()=>playReplay(rp,true)));bar.append(btn('sm','SHARE',()=>shareReplay(rp).then(ok=>{if(ok)hideCard()})),btn('sm','X',()=>{$('card').hidden=true}));C.append(bar);
  C.classList.add('win');C.hidden=false;C.classList.remove('pop');void C.offsetWidth;C.classList.add('pop');PL.st='show';PL.t=0;PL.big=true;PL.showFor=1e9;say('The White Whale bows to you. Remarkable.',4000,2)}

/* ---------------- Token Rain: tap Catoshi's token three times ---------------- */
let RAIN=null;const TOKTAPS=[];
function tokenTap(){const t=now();TOKTAPS.push(t);while(TOKTAPS.length&&t-TOKTAPS[0]>1.6)TOKTAPS.shift();sfx('clang');sparkle(LAY.tokX+8,LAY.tokY+8,4);
  if(TOKTAPS.length<3)return;TOKTAPS.length=0;
  if(MODE!=='world'){return}
  const wait=S.rainAt+300e3-Date.now();if(wait>0){say(`Patience. My token rests for ${fmtLeft(wait)}.`,2600,0);return}
  hideCard();RAIN={t:0,dur:10,coins:[],got:0,spawn:0};S.rainAt=Date.now();dirty();say('Make it rain. Tap the tokens!',2500,2);sfx('jackpot');setAct('TAP TOKENS!','wait');$('ctlBar').classList.add('dim')}
function rainUpdate(dt){const L=LAY;RAIN.t+=dt;RAIN.spawn-=dt;const floor=MODE==='world'?VH+14:L.surfY;
  if(RAIN.t<RAIN.dur&&RAIN.spawn<=0){RAIN.spawn=.22+Math.random()*.18;RAIN.coins.push({x:8+Math.random()*(VW-28),y:-12,vy:30+Math.random()*30+RAIN.t*2.5,gold:Math.random()<.06,sp:Math.random()*6})}
  for(let i=RAIN.coins.length-1;i>=0;i--){const c=RAIN.coins[i];c.y+=c.vy*dt;if(c.y>floor){if(MODE==='fish')splash(c.x+6,L.surfY,4,.4);RAIN.coins.splice(i,1)}}
  if(RAIN.t>=RAIN.dur&&!RAIN.coins.length){toast(`Token Rain: +${RAIN.got} $CATOSHI`);sfx('coin');RAIN=null;setAct('CAST');$('ctlBar').classList.remove('dim')}}
function rainHit(p){for(let i=RAIN.coins.length-1;i>=0;i--){const c=RAIN.coins[i];const s=c.gold?16:12;if(Math.abs(p.x-(c.x+s/2))<s*.75+3&&Math.abs(p.y-(c.y+s/2))<s*.75+3){const v=payHouse(c.gold?20:2);RAIN.got+=v;sparkle(c.x+s/2,c.y+s/2,c.gold?14:6);popText('+'+v,c.x,c.y-4,c.gold?'#ffd24d':'#ffb15a',.7);sfx(c.gold?'jackpot':'coin');RAIN.coins.splice(i,1);return true}}return false}

/* ---------------- message in a bottle ---------------- */
let BOT=null,botNext=now()+80+Math.random()*60;
const bottleImg=(()=>{let c=null;return()=>{if(c)return c;const N=PN(14,8);N.rect(2,2,8,4,(i,j)=>j<1?'#9fe0b0':j<3?'#5aa878':'#3a7a58',0);N.rect(10,3,2,2,'#5aa878',0);N.rect(12,3,1,2,'#b8854f',1);N.rect(4,3,4,2,'#f4ead0',1);N.outline('#1a3028');c=N.canvas();return c}})();
function bottleUpdate(dt,t){if(!BOT){if(t>botNext&&MODE==='fish'&&!RPLAY&&!RAIN)BOT={x:-16,t:0};return}BOT.t+=dt;BOT.x+=7*dt;if(BOT.x>VW+10){BOT=null;botNext=t+100+Math.random()*100}}
function bottleOpen(){const b=BOT;BOT=null;botNext=now()+120+Math.random()*120;sfx('cardflip');splash(b.x+7,LAY.surfY,6,.5);const r=Math.random();const note=pickOne(BOTTLE_NOTES);
  showSheet('bottle','Message in a bottle',bd=>{bd.append(el('p','note',esc(note)));
    if(r<.45){const v=payHouse(20+Math.floor(Math.random()*41));bd.append(el('div','payout',`+${v}<small>$CATOSHI TUCKED INSIDE</small>`))}
    else if(r<.75){const k=Math.random()<.6?'prawn':'squid',n=k==='prawn'?8:5;S.bait[k]+=n;const rr=iconRow(baitIcon(k),`+${n} ${BAITI[k].n}`,'Wrapped up with the note.');bd.append(rr)}
    else{const tr=pickOne(TREASURE),v=payHouse(40+Math.floor(Math.random()*111));bd.append(el('div','portrait'));bd.lastChild.append(cvOf(catArt(tr.id),0,0,'width:128px;height:128px'));bd.append(el('p','lead',`Inside: <b>${esc(tr.n)}</b>. Catoshi buys it for <b>${v} $CATOSHI</b>.`))}
    dirty();refreshHud();bd.append(btn('big','Nice',closeSheet))})}

/* ---------------- replays: watch, save as a clip, share ---------------- */
let RPLAY=null;
function sanitizeReplay(rp){if(!rp||typeof rp!=='object')return null;const o={kind:rp.kind==='whale'?'whale':'fish',spot:SPOTI[rp.spot]?rp.spot:'harbour',coat:COATI[rp.coat]?rp.coat:'ginger',name:String(rp.name||'Cat').replace(/[<>]/g,'').slice(0,16),pay:Math.max(0,rp.pay|0),at:rp.at|0};
  if(o.kind==='fish'){if(!CATI[rp.fishId])return null;o.fishId=rp.fishId;o.cm=clamp(+rp.cm||0,1,2000);o.kg=clamp(+rp.kg||0,.01,5000);o.s=(Array.isArray(rp.s)?rp.s:[]).slice(0,600).map(a=>Array.isArray(a)?a.slice(0,6).map(v=>clamp(+v||0,-120,120)):[0,30,3,0,0,0])}
  else o.bx=clamp(+rp.bx||.3,0,1);return o}
function playReplay(raw,record){const rp=sanitizeReplay(raw);if(!rp)return toast('That replay is damaged');if(MODE==='world'||(SPOT&&SPOT.k!==rp.spot)){const sp=WLD&&(WLD.spots.find(s=>s.k===rp.spot)||(SPOTI[rp.spot]&&Object.assign({},SPOTI[rp.spot])));if(!sp)return toast('That spot is missing');if(MODE==='fish'&&!['idle','show'].includes(PL.st))return toast('Finish what you are doing first');enterSpot(sp)}if(!['idle','show'].includes(PL.st)||CT.on||RAIN||(WH.st==='game'||WH.st==='breach'))return toast('Finish what you are doing first');
  $('card').hidden=true;closeSheet();PL.st='idle';PL.hide=true;
  const f=mkFisher(rp.coat,LAY.playerX,true);f.bob.y=LAY.surfY;RPLAY={rp,t:0,ph:'pre',f,record,C:null,e:rp.kind==='fish'?CATI[rp.fishId]:null};
  $('ctl').hidden=true;$('rp').hidden=false;$('rpT').textContent=rp.kind==='whale'?`${rp.name} and the White Whale`:`${rp.name}: ${rp.cm} cm ${RPLAY.e.n}`;
  if(record&&!REC.start()){RPLAY.record=false}
  if(rp.kind==='whale'){WH={st:'replay',t:0,bx:LAY.sx0+rp.bx*LAY.stageW}}}
function replayUpdate(dt,t){const R=RPLAY,rp=R.rp,f=R.f,L=LAY;R.t+=dt;f.t+=dt;f.lean*=Math.pow(.02,dt);
  if(rp.kind==='whale'){if(R.ph==='pre'){if(R.t>1){R.ph='breach';WH.st='breach';WH.t=0}}else if(R.ph==='breach'){camFocus(WH.bx+46,WL()-24,1.5);if(WH.t>3.4){R.ph='done';R.t=0;WH={st:'none',next:now()+60,t:0};camReset();coinBurst(VW/2,L.deckY-30,20)}}else if(R.t>1.2)endReplay();return}
  if(R.ph==='pre'){f.bob.y=R.t>.5?L.surfY+2+Math.sin(t*30)*1.5:L.surfY+Math.sin(t*3)*.6;if(R.t>.9){R.ph='fight';R.t=0;sfx('reel')}}
  else if(R.ph==='fight'){f.bob.y=L.surfY+3;camFocus(f.bob.x-30,L.surfY+14,1.3);const i=Math.floor(R.t/.05);const s=rp.s[i];if(!s){R.ph='land';const p=cineParams(f,R.e,rp.cm,rp.kg);R.C={p,t:0,ev:cineEvents(p)};f.fv=null;return}
    f.fv={x:f.x+s[0],y:L.surfY+s[1],flip:s[5],img:catArt(R.e.id),s:fishSize(landClass(R.e,10))};f.bend=s[2];f.lean=s[3];if(s[4]&&R.last!==i)splash(f.fv.x,L.surfY,6,.7);R.last=i}
  else if(R.ph==='land'){if(cineStep(R.C,dt)){R.ph='done';R.t=0;f.cine=null;flyFish(R.C.p.img,R.C.p.deck.x,R.C.p.deck.y);camReset();sfx('catch');catoshiWave=2}}
  else if(R.ph==='done'&&R.t>1.1)endReplay()}
async function endReplay(){const R=RPLAY;RPLAY=null;PL.hide=false;PL.st='idle';$('rp').hidden=true;$('ctl').hidden=false;camReset();setAct('CAST');
  if(R.record&&REC.on){const blob=await REC.stop();if(blob&&NET.dl){const nm=R.rp.kind==='whale'?'white-whale':slug(R.e.n);
    NET.dl.save({filename:`catoshi-catch-${nm}.${REC.ext}`,data:blob}).then(()=>toast('Clip saved')).catch(e=>{toast(e&&e.code==='declined'?'Clip not saved':'Could not save the clip here')})}}
  const C=$('card');C.innerHTML='';C.append(el('div','winTag','REPLAY'),el('h3','',R.rp.kind==='whale'?'The White Whale':esc(R.e.n)));const bar=el('div','cbar');bar.append(btn('sm','AGAIN',()=>playReplay(R.rp,false)));if(NET.dl)bar.append(btn('sm','SAVE CLIP',()=>playReplay(R.rp,true)));bar.append(btn('sm','X',()=>{C.hidden=true}));C.append(bar);C.classList.add('win');C.hidden=false}
/* records the presented canvas, scaled up, while a replay plays */
const REC={on:false,cv:null,x:null,mr:null,chunks:[],ext:'webm',
  resize(){},
  start(){if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast('Clips are not supported in this browser');return false}
    const types=[['video/mp4;codecs=avc1','mp4'],['video/mp4','mp4'],['video/webm;codecs=vp9','webm'],['video/webm','webm']];const t=types.find(([m])=>MediaRecorder.isTypeSupported(m));if(!t){toast('Clips are not supported in this browser');return false}
    [this.cv,this.x]=mk((VW*3)&~1,(VH*3)&~1);this.x.imageSmoothingEnabled=false;this.chunks=[];this.ext=t[1];this.mime=t[0];
    try{this.mr=new MediaRecorder(this.cv.captureStream(30),{mimeType:t[0],videoBitsPerSecond:5e6});this.mr.ondataavailable=e=>{if(e.data&&e.data.size)this.chunks.push(e.data)};this.mr.start(250);this.on=true;return true}catch(e){toast('Could not start recording');return false}},
  frame(){this.x.drawImage(cv,0,0,this.cv.width,this.cv.height)},
  stop(){return new Promise(res=>{if(!this.mr){res(null);return}this.mr.onstop=()=>res(new Blob(this.chunks,{type:this.mime.split(';')[0]}));this.on=false;try{this.mr.stop()}catch(e){res(null)}})}};
