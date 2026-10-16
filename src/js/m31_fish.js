/* ================= fishing: the pier cats, the player's line, four reel mini games, landing cinematics, auto fishing ================= */
const ACT=$('act');
function setAct(t,cls){ACT.textContent=t;ACT.className=cls||''}
function mkFisher(coat,x,me){return{coat,x,me,st:'idle',t:0,next:0,bob:{x:x+29,y:LAY.deckY-12},fish:null,n:0,kg:0,skill:1,blink:Math.random()*4,tail:Math.random()*3,lean:0,bend:0,fv:null}}
let PL=null,RIV=[];
function fishers(){const me=RPLAY?RPLAY.f:(PL&&!PL.hide?PL:null);return me?[...RIV,me]:RIV}
function homeCrew(){return COATS.filter(c=>c.k!==S.coat&&!S.trips[c.k]).map(c=>c.k)}
function seatRivals(){const home=homeCrew();const keep=RIV.filter(r=>home.includes(r.coat)).map(r=>r.coat);const pool=home.filter(k=>!keep.includes(k));
  const nR=LAY.rivalX.length;while(keep.length<nR&&pool.length)keep.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  RIV=keep.slice(0,nR).map((k,i)=>{const old=RIV.find(r=>r.coat===k);const f=old||mkFisher(k,LAY.rivalX[i],false);f.x=LAY.rivalX[i];f.bob.x=f.x+29;if(!old){f.st='wait';f.next=now()+2+Math.random()*8;f.bob.y=LAY.surfY}return f})}
const now=()=>performance.now()/1000;
const busy=()=>!$('sheet').hidden||!!RPLAY||!!RAIN||(WH&&WH.st==='game')||(WH&&WH.st==='breach');
const fishSize=(cls)=>[16,22,30,42][cls];
const easeOut=k=>1-(1-k)*(1-k);

/* ---------------- Fishing 2.0 (from Gullhaven): one consistent fight for every fish ----------------
   1 HOLD to wind up the cast, let go at the top.   2 WAIT: ignore the nibbles, strike when it really bites.
   3 FIGHT: hold to reel, let go when it runs. Watch the tension (snaps) and the line out (spools).
   4 Big fish come alongside: tap when the net or gaff lines up. Bigger, rarer fish fight harder; better gear helps. */
const BITE_STYLE={torp:'run',tuna:'run',mahi:'run',marlin:'run',sail:'run',flying:'run',shark:'slam',deep:'slam',grouper:'slam',angler:'slam',boar:'slam',hump:'slam',flathead:'soft',ray:'soft',guitar:'soft',eel:'soft',ribbon:'soft',crab:'soft',lobster:'soft',squid:'soft',cuttle:'soft',octo:'soft',seahorse:'soft',dragon:'soft'};
function biteStyle(e){if(e.cat==='legend')return'slam';return BITE_STYLE[String(e.art).split('|')[0]]||(e.r>=2?'run':'nibble')}
function fishPower(e,kg){return Math.log10((kg||.2)+1)*.9+fishR(e)*.22+(e.cat==='legend'?1.6:0)+.25}
const STYLE_TXT={nibble:'Little taps first, then it takes it.',run:'It hits and runs!',slam:'No warning. The float just goes!',soft:'A slow, soft sink. Easy to miss.'};
const fishR=e=>e.cat==='legend'?4:e.r;
const gearNow=()=>({rod:GEAR.rod[S.gear.rod],reel:GEAR.reel[S.gear.reel],line:GEAR.line[S.gear.line]});

/* ---------------- input ---------------- */
let HOLD=false;
function press(src){audioUnlock();if(!S||!S.coat||busy())return;const f=PL,st=f.st;HOLD=true;
  if(st==='idle'||st==='show'){if(st==='show'&&f.big&&src==='canvas')return;hideCard();startAim();return}
  if(f.autoCast)return;
  if(st==='wait'){lose(f.nib>0||f.fake>0?'Too soon! That was only a nibble.':'Too early. Nothing had it yet.',false);return}
  if(st==='bite'){startFight();return}
  if(st==='net'){tryNet();return}}
function release(){HOLD=false;const f=PL;if(f&&f.st==='aim'&&f.t>.05)doCast(false)}

/* ---------------- casting ---------------- */
let autoT=0;
const tipOf=f=>({x:f.x+29,y:LAY.deckY-24});
function canFish(){if(S.bag.length>=bagCap()){S.auto=false;refreshHud();toast(`Bag full (${bagCap()}). Take your catch to Catoshi's basket.`);sfx('error');return false}return true}
function startAim(){if(!canFish())return;PL.st='aim';PL.t=0;PL.pow=0;setAct('LET GO','hot');mgShow('aim')}
function doCast(auto){const f=PL;let lean=0;
  if(auto){if(!canFish())return;if(!spend(AUTO_COST,'auto')){S.auto=false;refreshHud();toast('Auto fishing needs '+AUTO_COST+' $CATOSHI per cast');return}popText('-'+AUTO_COST,f.x+10,LAY.deckY-36,'#ffb15a');f.pow=.55+Math.random()*.2}
  else{if(!useBait()){f.st='idle';mgHide();setAct('CAST');return}lean=BAITI[S.baitSel].lean}
  const perfect=f.pow>.92;if(perfect)lean+=.6;if(SPOT&&SPOT.school)lean+=1.2;const tp=tipOf(f);const room=Math.max(30,VW-tp.x-14);
  f.castX=tp.x+10+f.pow*Math.min(130,room)*gearNow().rod.cast;f.castFrom={x:tp.x,y:tp.y};
  f.autoCast=!!auto;f.st='cast';f.t=0;f.fish=rollFish(lean);f.q=Math.pow(Math.random(),1.3);f.cm=fishCm(f.fish,f.q);f.kg=kgOf(f.fish,f.cm);
  sfx('cast');if(!auto)popText(perfect?'PERFECT CAST':f.pow>.6?'NICE CAST':'SHORT CAST',f.x-4,LAY.deckY-40,perfect?'#ffd24d':'#c9f5e6',.9);setAct(auto?'AUTO...':'WAIT...','wait');mgHide()}
function useBait(){let k=S.baitSel;if(!(S.bait[k]>0)){const alt=BAITS.find(b=>S.bait[b.k]>0);if(alt){const was=BAITI[k].n.toLowerCase();S.baitSel=k=alt.k;toast(`Out of ${was}. Using ${alt.n.toLowerCase()}.`)}}
  if(!(S.bait[k]>0)){if(S.freeWorms!==S.day){S.freeWorms=S.day;S.bait.worm+=10;S.baitSel=k='worm';toast('Catoshi left you 10 free worms');sfx('coin')}else{toast('Out of bait. Buy more at the Tackle shop.');sfx('error');openShop();return false}}
  S.bait[k]--;dirty();refreshHud();return true}
function lose(msg,snap){const f=PL;f.st='idle';if(snap&&f.fish){FX.push({k:'flee',t:0,d:1.2,img:catArt(f.fish.id),x:f.fv?f.fv.x:f.bob.x,y:f.fv?f.fv.y:LAY.surfY+20,s:fishSize(landClass(f.fish,1))});sfx('knot');CAM.shake=3}
  const hint=f.fish&&f.st!=='wait'&&f.FT?` It felt like ${fishR(f.fish)>=3?'something huge':f.kg>5?'a big one':'a decent fish'}.`:'';
  f.fish=null;f.fv=null;f.bend=0;f.FT=null;mgHide();sfx('miss');toast(msg+hint);setAct('CAST');camReset()}

/* ---------------- the fight ---------------- */
let REC_F=null;
function startFight(){const f=PL;const G=gearNow();f.st='fight';f.t=0;$('card').hidden=true;sfx('reel');
  const F=fishPower(f.fish,f.kg)/G.rod.power;f.FT={F,T:.35,dist:.45+f.pow*.55,dist0:.45+f.pow*.55,sta:1,running:0,nextRun:.8+Math.random()*1.2,over:0,slack:0,clean:true,peak:0};
  if(f.style==='run'||f.style==='slam')f.FT.running=.8+Math.random()*.6;
  REC_F={s:[],acc:0};setAct('REEL','hot');mgShow('fight')}
function fightUpdate(dt,t){const f=PL,X=f.FT,G=gearNow(),F=X.F;const tired=X.sta<.15;const hold=f.autoCast?autoHold(X):HOLD;
  if(X.running>0){X.running-=dt;X.sta-=dt*.05/(.5+F*.4);if(X.running<=0){X.running=0;X.nextRun=(1.4+Math.random()*2.4)/(.5+Math.min(F,2.5)*.45)*(1.6-X.sta*.8);mgMsg(tired?'It is tiring. Reel it in!':'Reel while it rests.')}}
  else if(!tired){X.nextRun-=dt;if(X.nextRun<=0){X.running=(.6+Math.random()*.9)*(.6+Math.min(F,2.5)*.35)*(.5+X.sta*.5);sfx('reel');CAM.shake=1.5;mgMsg('It is running! Let go!');popText('RUN!',f.x+30,LAY.deckY-44,'#ff7a6b',.7)}}
  const pull=F/G.reel.drag/(.55+.45*G.line.str);const run=X.running>0;
  const target=hold?(run?.42+pull*1.25:.3+pull*.3):(run?pull*.35:0);X.T+=(target-X.T)*Math.min(1,dt*(target>X.T?3.2:2.4));if(run)X.T+=Math.sin(t*23)*.012;
  if(hold&&!run)X.dist-=dt*G.reel.speed*.13*(tired?1.6:1)/(.45+Math.min(F,3)*.3);else if(run)X.dist+=dt*(hold?.02*F:.075*F/G.reel.drag);
  if(hold)X.sta-=dt*(run?.04:.025)/(.5+F*.4);else X.sta-=dt*.008;X.sta=Math.max(0,X.sta);
  if(X.T>.85)X.clean=false;
  if(X.T>1){X.over+=dt;if(X.over>.3){sfx('snap');popText('SNAP!','#ff7a6b',f.x+20,LAY.deckY-44,'#ff7a6b');return lose(`The line snapped. ${G.line.str<2?'Heavier line holds bigger fish.':'Let go when it runs.'}`,true)}}else X.over=Math.max(0,X.over-dt);
  if(X.T<.08&&!run){X.slack+=dt;if(X.slack>1.7)return lose('Too much slack. It threw the hook.',true)}else X.slack=Math.max(0,X.slack-dt*2);
  if(X.dist>1.25)return lose('Spooled! It took all your line. A better reel and line would hold it.',true);
  mgFight(X,run,tired);
  // where the fish is: out where you cast, coming in as you reel, deeper when it runs
  const tp=tipOf(f);const k=Math.max(.04,X.dist/X.dist0);const fx=tp.x+6+(f.castX-tp.x-6)*Math.min(1.2,k)+Math.sin(t*(run?9:2))*(run?5:2),fy=LAY.surfY+12+Math.min(1.25,X.dist)*44+(run?8:0)+Math.sin(t*3)*2;
  const prev=f.fv;const flip=prev?(fx>prev.x+.05?1:fx<prev.x-.05?0:prev.flip):1;let spl=0;if((run&&Math.random()<dt*4)||(fy<LAY.surfY+16&&Math.random()<dt*5)){spl=1;splash(fx,LAY.surfY,6,run?1:.6)}
  f.fv={x:fx,y:fy,flip,img:catArt(f.fish.id),s:fishSize(landClass(f.fish,f.kg))};f.bend=2+X.T*11;f.lean=hold?-2:run?1.5:0;f.bob.x=fx;f.bob.y=LAY.surfY+3;
  camFocus((tp.x+fx)/2,LAY.surfY+12,1.25);
  REC_F.acc+=dt;if(REC_F.acc>=.05&&REC_F.s.length<800){REC_F.acc=0;REC_F.s.push([Math.round(fx-f.x),Math.round(fy-LAY.surfY),Math.round(f.bend),Math.round(f.lean),spl,flip])}
  if(X.dist<=.04){if(f.kg<1.5){startLanding(X.clean);return}startNet()}}
// auto fishing: a steady, imperfect hand
function autoHold(X){return X.running>0?X.T<.55:X.T<.8}
/* ---------------- alongside: net or gaff ---------------- */
function startNet(){const f=PL,X=f.FT;f.st='net';f.t=0;X.lp=Math.random();X.ld=1;X.lspd=1.1+Math.min(X.F,2.5)*.35;X.lw=clamp(.3-Math.min(X.F,2.5)*.06,.12,.3);X.lc=.2+Math.random()*.6;X.gaff=f.kg>8;X.miss=X.miss||0;
  sfx('splash');CAM.shake=1;setAct(X.gaff?'GAFF!':'NET!','hot');mgShow('net')}
function netUpdate(dt,t){const f=PL,X=f.FT;X.lp+=X.ld*dt*X.lspd;if(X.lp>1){X.lp=1;X.ld=-1}if(X.lp<0){X.lp=0;X.ld=1}mgNet(X);
  const tp=tipOf(f);f.fv={x:tp.x+12+Math.sin(t*14)*3,y:LAY.surfY+6+Math.sin(t*9)*2,flip:0,img:catArt(f.fish.id),s:fishSize(landClass(f.fish,f.kg))};f.bend=8+Math.sin(t*10)*2;if(Math.random()<dt*6)splash(f.fv.x,LAY.surfY,5,.8);
  if(f.autoCast&&f.t>.8){if(Math.random()<.8)startLanding(false);else lose('It shook free at the side.',true);return}
  if(f.t>6)lose('It shook free at the side.',true)}
function tryNet(){const f=PL,X=f.FT;const d=Math.abs(X.lp-X.lc);if(d<X.lw/2){const perfect=d<X.lw/5&&X.clean;popText(perfect?'PERFECT!':'GOT IT!',f.x+20,LAY.deckY-44,'#ffd24d');startLanding(perfect);return}
  X.miss++;sfx('miss');CAM.shake=2;if(X.miss>=3)return lose('Three misses and it was gone.',true);popText('MISSED!',f.x+20,LAY.deckY-44,'#ff7a6b');f.st='fight';X.dist=.28;X.sta=Math.min(1,X.sta+.2);X.running=.7;X.T=.4;mgMsg('It made another run. Bring it back!');setAct('REEL','hot');mgShow('fight')}

/* ---------------- the panel: one look for every fight ---------------- */
const MGP={};
function mgShow(mode){const P=$('mg');P.innerHTML='';P.dataset.mode=mode;const f=PL;
  const head=el('div','mgh');MGP.title=el('b','',mode==='aim'?'CAST':mode==='net'?(f.FT&&f.FT.gaff?'GAFF IT':'NET IT'):esc(f.fish?(f.style?f.style.toUpperCase():'FIGHT'):'FIGHT'));MGP.stat=el('span','stat','');head.append(MGP.title,MGP.stat);P.append(head);
  MGP.msg=el('p','',mode==='aim'?'Hold, and let go at the top of the swing for a long cast.':mode==='net'?'Tap when the hoop lines up with the fish.':'Hold to reel. When it runs, let go!');P.append(MGP.msg);
  if(mode==='aim'){const tr=el('div','tr');MGP.fill=el('div','fill');MGP.top=el('div','pf');MGP.top.style.cssText='left:90%;width:10%';tr.append(MGP.top,MGP.fill);P.append(tr)}
  if(mode==='fight'){const a=el('div','lab','TENSION');const tr=el('div','tr');const red=el('div','red');red.style.left='85%';MGP.ten=el('div','fill');MGP.tnd=el('div','nd');tr.append(MGP.ten,red,MGP.tnd);
    const b=el('div','lab','LINE OUT');const tr2=el('div','tr');const sp=el('div','red');sp.style.left=(1/1.25*100)+'%';MGP.line=el('div','fill line');MGP.fish=el('div','fishmark');tr2.append(MGP.line,sp,MGP.fish);
    const c=el('div','lab','STAMINA');const tr3=el('div','tr thin');MGP.sta=el('div','fill sta');tr3.append(MGP.sta);P.append(a,tr,b,tr2,c,tr3)}
  if(mode==='net'){const tr=el('div','tr');MGP.zone=el('div','z');MGP.hoop=el('div','nd');tr.append(MGP.zone,MGP.hoop);P.append(tr)}
  P.style.bottom=($('ctl').offsetHeight+10)+'px';P.hidden=false}
function mgHide(){$('mg').hidden=true}
function mgMsg(s){if(MGP.msg)MGP.msg.textContent=s}
function mgFight(X,run,tired){if(!MGP.ten)return;MGP.ten.style.width=Math.min(100,X.T*100)+'%';MGP.ten.style.background=X.T>.85?'#e04a3a':X.T>.6?'#f0b040':'#3f8a5a';MGP.tnd.style.left=Math.min(100,X.T*100)+'%';
  MGP.line.style.width=Math.min(100,X.dist/1.25*100)+'%';MGP.fish.style.left=Math.min(100,X.dist/1.25*100)+'%';MGP.sta.style.width=X.sta*100+'%';
  MGP.stat.textContent=X.T>.85?'STRAINING!':X.slack>.6?'SLACK!':run?'RUNNING':tired?'TIRED':'';MGP.stat.style.color=run||X.T>.85?'#ff7a6b':'#8fd8a8';
  setAct(run?'LET GO!':'REEL',run?'wait':'hot')}
function mgNet(X){if(!MGP.zone)return;MGP.zone.style.left=(X.lc-X.lw/2)*100+'%';MGP.zone.style.width=X.lw*100+'%';MGP.hoop.style.left=X.lp*100+'%'}
function mgAim(p){if(MGP.fill)MGP.fill.style.width=p*100+'%'}

/* ---------------- the wait: nibbles, then the real bite ---------------- */
function waitStart(){const f=PL;f.st='wait';f.t=0;f.style=biteStyle(f.fish);let w=2+Math.random()*4;if(f.pow>.92)w*=.7;if(f.fish.cat==='legend')w+=2;if(f.autoCast)w*=.7;f.biteAt=w;
  f.nibbles=f.style==='nibble'?1+Math.floor(Math.random()*3):0;f.nextNib=f.biteAt-f.nibbles*.7-.2;f.nib=0;f.fake=0;f.win=({nibble:.85,run:.62,slam:.5,soft:1.15})[f.style]*(fishR(f.fish)>=3?.85:1);
  sfx('splash');splash(f.bob.x,LAY.surfY,4,.4);f.sh={x:f.bob.x+(Math.random()<.5?-70:70),y:LAY.surfY+30+Math.random()*30}}
function waitUpdate(dt,t){const f=PL;f.nib=Math.max(0,f.nib-dt);f.fake=Math.max(0,f.fake-dt);
  if(!f.autoCast&&Math.random()<dt*.35&&f.t<f.biteAt-1.2){f.nib=.22;f.fake=.22;sfx('tick')}
  if(f.nibbles>0&&f.t>=f.nextNib){f.nibbles--;f.nextNib=f.t+.55+Math.random()*.35;f.nib=.25;f.fake=0;sfx('tick');popText('nibble',f.bob.x-10,LAY.surfY-14,'#c9f5e6',.6)}
  f.bob.y=LAY.surfY+Math.sin(t*3)*.6+(f.nib>0?2:0);f.sh.x+=(f.bob.x-f.sh.x)*Math.min(1,dt*1.2);f.sh.y+=(LAY.surfY+26-f.sh.y)*Math.min(1,dt*1.2);
  if(f.t>=f.biteAt){f.st='bite';f.t=0;sfx('bite');if(f.style==='slam')CAM.shake=3;ripple(f.bob.x,LAY.surfY,8);if(!f.autoCast){setAct('STRIKE!','hot');toast(STYLE_TXT[f.style])}}}
function biteUpdate(dt,t){const f=PL;const st=f.style;
  if(st==='run'){f.bob.x+=30*dt;f.bob.y=LAY.surfY+1+Math.sin(t*25)}else if(st==='slam')f.bob.y=LAY.surfY+5;else if(st==='soft')f.bob.y=LAY.surfY+Math.min(5,f.t*5);else f.bob.y=LAY.surfY+2+Math.sin(t*30)*1.5;
  if(f.autoCast&&f.t>.3){startFight();return}if(f.t>f.win)lose('Too slow. It spat the hook.',false)}

/* ---------------- landing cinematics: the bigger the fish, the bigger the show ----------------
   cineAt(p,t) is pure (the replay uses it too); cineStep fires the one-off events as time passes them. */
function cineParams(f,e,cm,kg){const cls=landClass(e,kg);const L=LAY;const H=cls===3?[.7,1.5,2.3,3.1]:cls===2?[.7,1.5,2.3]:[];
  const p={cls,img:catArt(e.id),s:fishSize(cls),hx:f.x+40,f,H,deck:{x:f.x+22,y:L.deckY-8-fishSize(cls)/4}};
  if(cls>=2){p.bT=H[H.length-1]+.8;p.bD=cls===3?1.5:.8;p.sD=.5;p.top=L.deckY-(cls===3?62:46);p.dur=p.bT+p.bD+p.sD+.6}else p.dur=cls===1?1.8:1;return p}
function cineAt(p,t){const L=LAY,hx=p.hx,su=L.surfY,f=p.f;const o={show:1,x:hx,y:su,ang:0,bend:0,lean:0,line:1,rays:0};
  if(p.cls===0){const k=Math.min(1,t/.6);if(t<.6){o.x=hx+(p.deck.x-hx)*k;o.y=su+(p.deck.y-su)*k-Math.sin(k*Math.PI)*30;o.ang=k*10;o.bend=3}else{o.x=p.deck.x;o.y=p.deck.y-Math.abs(Math.sin((t-.6)*14))*2*(1-(t-.6)/.4);o.line=0}return o}
  if(p.cls===1){if(t<1){const k=t;o.x=hx+(p.deck.x-hx)*k;o.y=su+(p.deck.y-su)*k-Math.sin(k*Math.PI)*58;o.ang=k*Math.PI*4;o.bend=6*(1-k);o.lean=-3*(1-k)}else{const u=t-1;o.x=p.deck.x;o.y=p.deck.y-Math.abs(Math.sin(u*12))*5*Math.max(0,1-u/.8);o.ang=Math.sin(u*14)*.4*Math.max(0,1-u/.8);o.line=0}return o}
  // heave: the fish fights at the surface, the cat hauls it up in big pulls, then it breaches and swings onto the deck
  const H=p.H,n=H.length,d0=su+22;const dep=i=>d0-(i/n)*24;
  if(t<H[0]){o.x=hx+Math.sin(t*30)*2;o.y=dep(0)+Math.sin(t*20);o.bend=9;o.lean=-1;o.show=1;return o}
  for(let i=0;i<n;i++){if(t<H[i]+.8){const k=(t-H[i])/.8;o.x=hx+Math.sin(t*24)*3*(1-k);o.y=dep(i)+(dep(i+1)-dep(i))*easeOut(k);o.lean=-6*Math.sin(k*Math.PI);o.bend=8+5*Math.sin(k*Math.PI);o.ang=Math.sin(t*16)*.2;return o}}
  if(t<p.bT){o.x=hx+Math.sin(t*26)*2;o.y=dep(n);o.bend=12;o.lean=-2;return o}
  if(t<p.bT+p.bD){const k=Math.min(1,(t-p.bT)/.85);o.x=hx+Math.sin(t*9)*2;o.y=su+(p.top-su)*easeOut(k);o.ang=Math.sin(t*7)*.3;o.bend=13-k*3;o.lean=-5;o.rays=p.cls===3?1:0;return o}
  if(t<p.bT+p.bD+p.sD){const k=(t-p.bT-p.bD)/p.sD;o.x=hx+(p.deck.x-hx)*k;o.y=p.top+(p.deck.y-p.top)*k-Math.sin(k*Math.PI)*10;o.ang=(1-k)*.4;o.bend=8*(1-k);o.lean=-3*(1-k);o.rays=p.cls===3?1-k:0;return o}
  const u=t-p.bT-p.bD-p.sD;o.x=p.deck.x;o.y=p.deck.y-Math.abs(Math.sin(u*11))*4*Math.max(0,1-u/.6);o.ang=Math.sin(u*13)*.3*Math.max(0,1-u/.6);o.line=0;return o}
function cineEvents(p){const L=LAY,hx=p.hx,su=L.surfY,ev=[];
  if(p.cls===0){ev.push([0,()=>{splash(hx,su,8,.7);sfx('splash')}],[.6,()=>{sfx('good');sparkle(p.deck.x,p.deck.y,5)}])}
  else if(p.cls===1){ev.push([0,()=>{splash(hx,su,16,1);ripple(hx,su,14);sfx('splash')}],[1,()=>{sfx('thud');CAM.shake=2;splash(p.deck.x,p.deck.y+4,6,.5)}])}
  else{ev.push([0,()=>{sfx('rumble');CAM.shake=2;ripple(hx,su,18)}],[.25,()=>ripple(hx,su,22)],[.5,()=>ripple(hx,su,26)]);
    p.H.forEach((h,i)=>ev.push([h,()=>{sfx('reel');popText(i===p.H.length-1?'HEAVE!!':'HEAVE!',p.f.x+4,L.deckY-40,'#ffb15a',.8);splash(hx,su,10+i*4,1);CAM.shake=3+i}]));
    ev.push([p.bT,()=>{splash(hx,su,p.cls===3?46:30,p.cls===3?2:1.6);ripple(hx,su,30);CAM.shake=6;CAM.flash=p.cls===3?.9:.4;CAM.flashCol=p.cls===3?'#ffd27a':'#ffffff';sfx('pow');setTimeout(()=>sfx('splash'),80);if(p.cls===3){popText('LEGENDARY!',p.hx-24,p.top-14,'#ffd24d',1.6);sfx('jackpot')}}]);
    ev.push([p.bT+p.bD+p.sD,()=>{sfx('thud');CAM.shake=6;splash(p.deck.x,p.deck.y+6,14,.9);if(p.cls===3){coinBurst(p.deck.x,LAY.deckY-30,22)}}])}
  return ev}
let CINE=null;
function cineCam(p,t){const L=LAY;if(p.cls===0){camFocus(p.hx-20,L.surfY-16,1.2);return}if(p.cls===1){camFocus(p.hx-20,L.surfY-24,1.25);return}
  if(t<p.bT+p.bD)camFocus(p.hx-14,Math.min(L.surfY-8,(p.top+L.surfY)/2+10),p.cls===3?1.8:1.6);else camFocus(p.f.x+20,L.deckY-20,1.2)}
function cineStep(C,dt){const prev=C.t;C.t+=dt;for(const[at,fn]of C.ev)if(prev<=at&&C.t>at)fn();const o=cineAt(C.p,C.t);const f=C.p.f;f.bend=o.bend;f.lean=o.lean;f.cine=o;
  if(C.p.cls>=2&&C.t>C.p.bT&&C.t<C.p.bT+C.p.bD&&Math.random()<dt*40){PART.push({x:o.x+(Math.random()-.5)*C.p.s*.6,y:o.y+C.p.s*.3,vx:0,vy:10,life:.6,t:0,g:200,col:'#bfe6ff',s:1})}
  cineCam(C.p,C.t);return C.t>=C.p.dur}
function startLanding(perfect){const f=PL,e=f.fish;const cm=f.cm,kg=f.kg;mgHide();
  f.st='land';f.fv=null;const p=cineParams(f,e,cm,kg);CINE={p,t:0,ev:cineEvents(p),e,cm,kg,perfect,auto:!!f.autoCast,mg:f.style||'auto'};setAct('...','wait')}
function finishLanding(){const C=CINE,f=PL,e=C.e;CINE=null;f.cine=null;f.bend=0;f.lean=0;camReset();
  const rate=C.auto?AUTO_RATE:1;const pay=Math.max(1,Math.round(PRICE[fishR(e)]*(C.perfect?1.5:1)*rate)),pts=Math.max(1,Math.round(POINTS[fishR(e)]*(C.perfect?1.5:1)*rate));
  S.bag.push({id:e.id,cm:C.cm,kg:C.kg,pay,pts,r:fishR(e)});S.total++;S.seen[e.id]=Math.max(S.seen[e.id]||0,C.cm);
  if(CT.on){f.n++;f.kg+=C.kg;renderRace()}
  sfx(e.r>=3||e.cat==='legend'?'jackpot':'catch');setTimeout(()=>sfx('coin'),250);flyFish(C.p.img,C.p.deck.x,C.p.deck.y);
  let rp=null;if(fishR(e)>=2){rp={kind:'fish',spot:SPOT?SPOT.k:'harbour',coat:S.coat,name:S.name||COATI[S.coat].name,fishId:e.id,cm:C.cm,kg:C.kg,pay:pts,mg:C.mg,s:REC_F?REC_F.s:[],at:Date.now()};S.replays.unshift(rp);S.replays=S.replays.slice(0,8)}
  dirty();refreshHud();showCard(e,C.cm,C.kg,pay,C.perfect,rp,pts);if(S.bag.length>=bagCap())setTimeout(()=>toast('Bag full! Take your fish to Catoshi in town'),900);
  if(e.cat==='legend')say(pickOne(LINES.legend),4500,2);else if(e.r>=2)say(pickOne(LINES.rare),2800,2);else if(Math.random()<.3)say(pickOne(LINES.catch),2200,2);
  f.st='show';f.t=0;f.big=!!rp&&!CT.on;f.showFor=f.big?1e9:CT.on?1.2:1.8;setAct('CAST')}

/* ---------------- the catch card ---------------- */
function showCard(e,cm,kg,pay,perfect,rp,pts){const C=$('card');C.innerHTML='';const a=catArt(e.id);
  C.append(cvOf(a),el('h3','',esc(e.n)),el('div','rar',(perfect?'PERFECT  ':'')+(e.cat==='legend'?'LEGENDARY':CRAR[e.r].toUpperCase())));C.querySelector('.rar').style.color=`var(--r${fishR(e)})`;
  C.append(el('div','info',`<span>${cm} cm</span><span>${kg} kg</span><b>+${pts} points</b>`),el('div','rar',`IN YOUR BAG  ${S.bag.length}/${bagCap()}`));
  if(rp){C.classList.add('win');C.prepend(el('div','winTag','CATOSHI WIN'));const bar=el('div','cbar');bar.append(btn('sm','REPLAY',()=>playReplay(rp,false)));if(NET.dl)bar.append(btn('sm','SAVE CLIP',()=>playReplay(rp,true)));bar.append(btn('sm',rp.shared?'SHARED':'SHARE',()=>shareReplay(rp).then(ok=>{if(ok)hideCard()})));bar.append(btn('sm','X',()=>hideCard()));C.append(bar)}
  else C.classList.remove('win');
  C.hidden=false;C.classList.remove('pop');void C.offsetWidth;C.classList.add('pop')}
function hideCard(keep){$('card').hidden=true;if(PL&&PL.st==='show'){PL.st='idle';PL.big=false}}

/* ---------------- the player's update ---------------- */
function plUpdate(dt,t){const f=PL,L=LAY;if(!f||f.hide)return;f.t+=dt;f.lean*=Math.pow(.02,dt);
  switch(f.st){
    case'idle':f.bob.x=f.x+29;f.bob.y=L.deckY-12;f.bend=0;f.fv=null;if(S.auto&&!busy()){autoT+=dt;if(autoT>.7){autoT=0;doCast(true)}}else autoT=0;break;
    case'aim':f.pow=.5-.5*Math.cos(f.t*3.1);mgAim(f.pow);f.bend=-f.pow*4;f.bob.x=f.x+29;f.bob.y=L.deckY-12-f.pow*6;break;
    case'cast':{const k=Math.min(1,f.t/.5);const a=f.castFrom;f.bob.x=a.x+(f.castX-a.x)*k;f.bob.y=a.y+(L.surfY-a.y)*k-Math.sin(k*Math.PI)*(14+f.pow*20);if(k>=1)waitStart();break}
    case'wait':waitUpdate(dt,t);break;
    case'bite':biteUpdate(dt,t);break;
    case'fight':fightUpdate(dt,t);break;
    case'net':netUpdate(dt,t);break;
    case'land':if(cineStep(CINE,dt))finishLanding();break;
    case'show':f.bob.x=f.x+29;f.bob.y=L.deckY-12;if(f.t>f.showFor)hideCard();break}}
/* rivals fish on their own; in a contest they count */
function rivUpdate(dt,t){const L=LAY;for(const r of RIV){r.t+=dt;
  if(r.st==='wait'){r.bob.y=L.surfY+Math.sin(t*3+r.x)*.6;if(t>=r.next){r.st='bite';r.t=0}}
  else if(r.st==='bite'){r.bob.y=L.surfY+2+Math.sin(t*30)*1.5;if(r.t>.6){r.st='pull';r.t=0;r.fish=rollFish();splash(r.bob.x,L.surfY,5,.6)}}
  else if(r.st==='pull'){r.bob.y=L.surfY-r.t*40;if(r.t>.4){r.st='wait';r.bob.y=L.surfY;
    if(CT.on){r.n++;r.kg+=kgOf(r.fish,fishCm(r.fish,Math.random()));renderRace();popText('+1',r.x+12,L.deckY-34,'#ffb15a');flyFish(catArt(r.fish.id),r.bob.x,L.deckY-30)}
    r.next=t+(CT.on?(8+Math.random()*7)/r.skill:9+Math.random()*14)}}}}
