'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {Run,TAU}=require('./engine.js');
const security=require('./security.cjs');
const {createApp,openDatabase,configFromEnv,ROUND_MS,GRACE_MS}=require('./server.cjs');
const {currentRound,roundWindow}=require('./periods.cjs');
const {makePlan,recordPayment}=require('./admin.cjs');
function encode58(bytes){let n=BigInt('0x'+bytes.toString('hex')),value='';while(n){value='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Number(n%58n)]+value;n/=58n;}for(const b of bytes){if(b!==0)break;value='1'+value;}return value;}
function simulate(seed){const run=new Run(seed);run.press();let ticks=0;while(!run.dead&&ticks<security.MAX_TICKS){run.step(1/120);run.drainEvents();ticks++;}if(!run.dead)run.crash('TIME LIMIT');return {run,ticks,inputs:[[0,1]]};}
function advance(run,count){for(let i=0;i<count&&!run.dead;i++)run.step(1/120);}

test('varied terrain, safe introductions, immediate jumping, backflip bonus and slow-speed dog',()=>{
  const shapes=new Set();
  for(let seed=1;seed<=300;seed++){
    const run=new Run(seed);shapes.add(run.terrain(1800).toFixed(3));advance(run,480);
    assert(!run.dead,'no automatic first-four-second crash');assert(!run.dog.active);
    for(const rail of run.rails)for(let x=rail.x;x<rail.end;x+=16)assert(run.railY(rail,x)<run.terrain(x)-50);
  }
  assert(shapes.size>290,'seeds change the hills as well as item patterns');
  const run=new Run(1234);run.press();assert(!run.player.grounded);advance(run,8);run.release();advance(run,200);assert(!run.dead);
  const flip=new Run(4321);Object.assign(flip.player,{grounded:false,airborne:2,spin:TAU+.15,vx:420,vy:0,angle:flip.slope(0)});
  flip.release();flip.land(flip.terrain(0),flip.slope(0));assert(flip.score>=1000);assert(flip.drainEvents().some(e=>e.text==='BACKFLIP'));
  const chase=new Run(5);chase.terrain=()=>200;chase.derivative=()=>0;chase.slope=()=>0;chase.player.x=3000;chase.player.y=200;chase.player.speed=90;chase.player.boost=0;chase.items=[];chase.nextFeature=chase.nextScenery=Infinity;
  advance(chase,130);assert(chase.dog.active);chase.player.speed=900;advance(chase,650);assert(!chase.dead);assert(!chase.dog.active);
});
test('terrain has large smooth hills, distinct regions and lookup-order-independent seeds',()=>{
  const modes=new Set(),openings=new Set();let biggest=0;
  for(let seed=1;seed<=80;seed++){
    const a=new Run(seed),b=new Run(seed);
    const probe=Array.from({length:200},(_,i)=>3000+i*125);
    const forward=probe.map(x=>a.terrain(x));
    // Camera look-ahead must never change the generated route or collectibles.
    for(const x of probe.slice().reverse())b.terrain(x);
    assert.deepEqual(probe.map(x=>b.terrain(x)),forward);
    a.generate(12000);b.generate(12000);assert.deepEqual(a.items,b.items);
    openings.add(a.items[0].x.toFixed(2));
    let low=Infinity,high=-Infinity;
    for(let x=3000;x<28000;x+=20){
      modes.add(a.region(x));const height=a.terrain(x)-x*a.profile.grade;
      low=Math.min(low,height);high=Math.max(high,height);
      assert(Math.abs(a.derivative(x))<2.5,'steeper hills remain continuous slopes, never vertical cliffs');
      assert(Math.abs(a.derivative(x+.01)-a.derivative(x-.01))<.001,'smooth terrain seams');
    }
    biggest=Math.max(biggest,high-low);
  }
  assert.equal(modes.size,6);assert(openings.size>75);assert(biggest>1200,'tall dunes and deep valleys vary the ride');
});
test('deterministic server replay ignores fabricated score fields and rejects invalid recordings',()=>{
  const input=simulate(111);const checked=security.replay(111,input.ticks,input.inputs);
  assert.equal(checked.score,Math.floor(input.run.score));assert.equal(checked.coins,input.run.coins);
  assert.throws(()=>security.replay(111,1,[]),/completed/);
  assert.throws(()=>security.replay(111,2,[[0,1],[1,1]]),/Repeated/);
  assert.throws(()=>security.replay(111,2,[[2,1]]),/sequence/);
  assert.throws(()=>security.replay(111,security.MAX_TICKS+1,[]),/recording/);
  assert.throws(()=>security.replay(111,input.ticks+1,input.inputs),/continues/);
});
test('endless generation prunes old objects',()=>{
  const run=new Run(111);
  for(let i=0;i<100;i++){
    run.player.x=i*5000;run.generate(2600);run.player.y=run.terrain(run.player.x);run.player.grounded=true;run.player.rail=null;run.player.ramp=null;run.player.speed=400;run.dead=false;run.step(1/120);run.drainEvents();
    assert(run.items.length<170);assert(run.scenery.length<25);assert(Number.isFinite(run.terrain(run.player.x+1200)));
  }
  assert(run.nextFeature>run.player.x+2000);
});
test('production configuration fails closed without HTTPS or durable storage',()=>{
  assert.throws(()=>configFromEnv({NODE_ENV:'production'}),/HTTPS/);
  assert.throws(()=>configFromEnv({NODE_ENV:'production',PUBLIC_ORIGIN:'https://example.com'}),/persistent/);
  assert.throws(()=>configFromEnv({PRIZES_ENABLED:'true'}),/vault/);
  assert.throws(()=>security.playerName('<script>alert(1)</script>'),/character name/);
  assert.equal(security.playerName('  Cat   Runner  '),'Cat Runner');
  assert.equal(ROUND_MS,7*86400000);
});
test('Ed25519 wallet ownership and exact token balance threshold',async()=>{
  const keys=crypto.generateKeyPairSync('ed25519'),wallet=encode58(keys.publicKey.export({type:'spki',format:'der'}).subarray(-32));
  const signature=crypto.sign(null,Buffer.from('login'),keys.privateKey).toString('base64');
  assert(security.verifyMessage(wallet,'login',signature));assert(!security.verifyMessage(wallet,'different',signature));
  assert.throws(()=>security.walletAddress('not-a-wallet'));
  const fetcher=async()=>({ok:true,json:async()=>({result:{value:[40000,10000].map(amount=>({account:{data:{parsed:{info:{owner:wallet,mint:security.MINT,tokenAmount:{amount:String(amount*1e6),decimals:6}}}}}}))}})});
  const balance=await security.tokenBalance(wallet,'https://unused.invalid',fetcher);
  assert.equal(balance.raw,50000000000n);assert.equal(balance.whole,'50000');assert(balance.eligible);
  await assert.rejects(security.tokenBalance(wallet,'https://unused.invalid',async()=>{throw Error('unavailable');}),/unavailable/);
});
test('HTTP pasted-wallet entry, immutable rewards address, checked leaderboard and static isolation',async t=>{
  let clock=Date.UTC(2026,9,1,1);const keys=crypto.generateKeyPairSync('ed25519');
  const wallet=encode58(keys.publicKey.export({type:'spki',format:'der'}).subarray(-32));
  const config={...configFromEnv(),database:':memory:'};
  let balanceCalls=0;const app=createApp(config,{now:()=>clock,balance:async address=>{balanceCalls++;return {raw:100000000000n,decimals:6,whole:address===security.MINT?'49999':'100000',eligible:address!==security.MINT};}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.server.address().port;config.origin=base;let cookie='';
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
  async function request(route,data,origin=base,customCookie=cookie){
    const res=await fetch(base+route,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json',origin}:{}),...(customCookie?{cookie:customCookie}:{})},body:data?JSON.stringify(data):undefined});
    if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
    return {res,value:res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text()};
  }
  assert.equal((await request('/health')).res.status,200);
  const rules=(await request('/api/config')).value;assert.equal(rules.minimumTokens,0);assert(!rules.prizesEnabled);assert(!rules.paidModeEnabled);
  assert.equal((await request('/api/runs/start',{mode:'practice',engine:security.ENGINE_VERSION},'https://evil.invalid')).res.status,403);
  const guest=(await request('/api/runs/start',{mode:'holder',engine:security.ENGINE_VERSION}));assert.equal(guest.res.status,200);assert.equal(guest.value.wallet,null);assert.equal(guest.value.prizeEligible,false);
  assert.equal((await request('/api/runs/start',{mode:'practice',wallet,engine:security.ENGINE_VERSION})).res.status,400);
  const ticket=(await request('/api/runs/start',{name:'Cat Runner',wallet:security.MINT,engine:security.ENGINE_VERSION})).value;assert(ticket.id&&ticket.seed);
  const simulation=simulate(ticket.seed);clock+=simulation.ticks/120*1000+2000;
  const result=await request('/api/runs/finish',{id:ticket.id,ticks:simulation.ticks,inputs:simulation.inputs,score:999999999});
  assert.equal(result.res.status,200);assert.equal(result.value.run.score,Math.floor(simulation.run.score));assert.equal(result.value.rank,1);
  assert((await request('/api/runs/finish',{id:ticket.id})).value.duplicate);
  const board=(await request('/api/leaderboard')).value;assert.equal(board.entries[0].name,'Cat Runner');assert(!Object.hasOwn(board.entries[0],'session'));
  assert.match((await request('/score/'+ticket.id)).value,/og:title/);
  for(const file of ['server.cjs','.env','security.cjs','test.cjs','data/catoshi.sqlite'])assert.equal((await request('/'+file)).res.status,404);
  for(const file of ['engine.js','online.js','sound.js','audio-config.js','catoshi-coin.png','terrain-biomes-v1.png','terrain-obstacles-v1.png','home.js','catoshi-home-loop-v1.png','catoshi-home-v2.webp','catoshi-home-v2.gif','catoshi-home-still-v2.png','rush-pickups-v2.png','catoshi-actions-extra-v1.png','sky-terrain-details-v1.png'])assert.equal((await request('/'+file)).res.status,200);
  const range=await fetch(base+'/music.mp3',{headers:{Range:'bytes=0-31'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-length'),'32');assert.equal((await range.arrayBuffer()).byteLength,32);
  for(const kind of ['silence','burst','coin','jump','flip','metal','wood','stone','crash','land','rush','red']){
    const response=await fetch(base+'/sfx-'+kind+'-v1.wav',{headers:{Range:'bytes=0-43'}});
    assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'audio/wav');
    assert.equal(response.headers.get('accept-ranges'),'bytes');assert.equal((await response.arrayBuffer()).byteLength,44);
  }
  const badRange=await fetch(base+'/music.mp3',{headers:{Range:'bytes=999999999999-'}});assert.equal(badRange.status,416);await badRange.arrayBuffer();
  assert.equal((await request('/api/auth/challenge',{wallet})).res.status,404);
  assert.equal((await request('/api/runs/start',{name:'Low balance',mode:'holder',wallet:security.MINT,engine:security.ENGINE_VERSION})).res.status,200);
  const checkedBalance=(await request('/api/balance',{wallet})).value;assert(checkedBalance.eligible);
  const callsBefore=balanceCalls;
  const holder=(await request('/api/runs/start',{name:'Holder',mode:'holder',wallet,engine:security.ENGINE_VERSION})).value;
  assert.equal(holder.mode,'holder');assert.equal(holder.wallet,wallet);assert.equal(balanceCalls,callsBefore,'entry never checks holdings');
  const holderRun=simulate(holder.seed);clock+=holderRun.ticks/120*1000+2000;
  assert.equal((await request('/api/runs/finish',{id:holder.id,ticks:holderRun.ticks,inputs:holderRun.inputs,wallet:security.MINT})).res.status,200);
  assert.equal(app.db.prepare('SELECT wallet FROM runs WHERE id=?').get(holder.id).wallet,wallet,'finish cannot redirect the reward address');
  const holders=(await request('/api/leaderboard?mode=holder')).value;assert(holders.entries.some(entry=>entry.name==='Holder'));assert(holders.entries.every(entry=>entry.wallet!==wallet),'public wallet is abbreviated');
  assert.equal((await request('/api/runs/finish',{id:holder.id},base,'')).res.status,404);
});
test('SQLite rankings survive reopening durable storage',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'catoshi-test-'));const file=path.join(directory,'game.sqlite');
  const first=openDatabase(file);first.prepare('INSERT INTO rounds VALUES(?,?,?,?,?)').run(1,0,ROUND_MS,'0','');first.close();
  const second=openDatabase(file);assert.equal(second.prepare('SELECT COUNT(*) AS count FROM rounds').get().count,1);second.close();
  fs.rmSync(directory,{recursive:true,force:true});
});
test('manual payout planning reserves funds and recording needs a finalized matching transfer',async()=>{
  const db=openDatabase(':memory:'),vault='11111111111111111111111111111111',winner=security.MINT;
  try{
    const end=ROUND_MS;db.prepare('INSERT INTO rounds VALUES(?,?,?,?,?)').run(1,0,end,'100000',vault);
    db.prepare('INSERT INTO runs(id,session,seed,name,wallet,mode,round,started,expires,engine,score,distance,coins,submitted)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('win','session',1,'Winner',winner,'holder',1,1,end,security.ENGINE_VERSION,1500,200,4,100);
    const config={rpc:'https://unused.invalid'};const now=end+GRACE_MS+1000;
    const balance=async address=>({raw:address===vault?1000000n:50000n,decimals:0,whole:'50000',eligible:true});
    await assert.rejects(makePlan(db,1,config,{now:()=>end,balance}),/submission/);
    const plan=await makePlan(db,1,config,{now:()=>now,balance});assert.equal(plan.raw,'100000');assert.equal(plan.status,'review');
    db.prepare('INSERT INTO rounds VALUES(?,?,?,?,?)').run(2,end,end*2,'100000',vault);
    db.prepare('INSERT INTO runs(id,session,seed,name,wallet,mode,round,started,expires,engine,score,submitted)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('win2','session',2,'Winner',winner,'holder',2,end,end*2,security.ENGINE_VERSION,1000,end+1);
    await assert.rejects(makePlan(db,2,config,{now:()=>end*2+GRACE_MS+1000,balance:async address=>({...await balance(address),raw:100000n})}),/unreserved/);
    const signature=encode58(Buffer.alloc(64,7));
    const entry=(owner,amount)=>({owner,mint:security.MINT,uiTokenAmount:{amount:String(amount),decimals:0}});
    const tx={blockTime:Math.floor(now/1000),meta:{err:null,preTokenBalances:[entry(vault,1000000),entry(winner,50000)],postTokenBalances:[entry(vault,900000),entry(winner,150000)]}};
    await assert.rejects(recordPayment(db,1,signature,config,{transaction:async()=>({...tx,meta:{...tx.meta,err:'failed'}})}),/successful/);
    const paid=await recordPayment(db,1,signature,config,{transaction:async()=>tx,now:()=>now});assert.equal(paid.status,'paid');
    await assert.rejects(recordPayment(db,1,signature,config,{transaction:async()=>tx}),/review/);
  }finally{db.close();}
});

class Element {
  constructor(id){this.id=id;this.hidden=true;this.value='';this.disabled=false;this.textContent='';this.listeners={};this.classList={toggle(){},remove(){},add(){}};}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
  dispatch(type,data={}){return Promise.all((this.listeners[type]||[]).map(fn=>fn({preventDefault(){},target:this,...data})));}
  appendChild(){}focus(){}setPointerCapture(){}setAttribute(name,value){this[name]=value;}
}
test('one Play button, touch/keyboard, pause/resume, failed server start and vault burst UI wiring',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  const document=new Element('document'),window=new Element('window');document.getElementById=id=>{assert(elements[id],id);return elements[id];};
  document.querySelectorAll=()=>['gate','game-screen','result'].map(id=>elements[id]);document.createElement=tag=>new Element(tag);
  elements.game.getContext=()=>({fillRect(){}});let now=0,frame=null,createdRun,bursts=0,sounds=0;
  let startsFail=false,prepares=0;const ticket={id:'ticket',wallet:null,seed:123,maxTicks:72000};
  window.RushOnline={prepare:async()=>{prepares++;if(startsFail)throw Error('offline');return ticket;},submit:async()=>null,share(){},setWallet(){}};
  window.RushSound={unlock(){},setPlaying(){},effect(){sounds++;},burst(){bursts++;}};
  const context={document,window,console,setTimeout,clearTimeout,location:{search:''},URLSearchParams,performance:{now:()=>now},VaultRush:{Run:class extends Run{constructor(seed){super(seed);createdRun=this;}}},VaultRushRenderer:{loadAssets:async()=>({}),Renderer:class{reset(){}draw(){}update(){}handle(){}breakout(){}}},requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>{frame=null;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'game.js'),'utf8'),context);
  assert(!elements['practice-button']&&!elements['board-practice']);
  assert(html.indexOf('id="holder-name"')<html.indexOf('id="wallet"'),'wallet appears under the name');
  assert(!/<input id="wallet"[^>]*\brequired\b/.test(html),'wallet is optional in the native form');
  elements.wallet.value='invalid';await elements['wallet-form'].dispatch('submit');assert.equal(prepares,0);
  elements.wallet.value='';await elements['wallet-form'].dispatch('submit');assert(createdRun,'a blank optional wallet must start the game');
  await elements['wallet-form'].dispatch('submit');assert.equal(prepares,1,'repeat submit cannot start a second run');
  const frames=count=>{for(let i=0;i<count;i++){now+=1000/60;const cb=frame;frame=null;cb?.(now);}};
  frames(20);assert.equal(createdRun.time,0,'no hidden simulation during vault animation');assert.equal(bursts,0);
  frames(100);assert.equal(bursts,1);
  assert.equal(elements.lives['aria-label'],'3 of 3 lives');
  for(const type of ['selectstart','contextmenu']){
    let prevented=false;await elements['game-screen'].dispatch(type,{preventDefault(){prevented=true;}});
    assert(prevented,'long presses in the play area do not select text or open a callout');
    assert(!elements.wallet.listeners[type],'wallet editing is not blocked');
  }
  await elements['jump-control'].dispatch('pointerdown',{pointerId:1,pointerType:'touch'});assert(createdRun.player.held&&!createdRun.player.grounded);assert(sounds>0);
  await elements['jump-control'].dispatch('pointerup',{pointerId:1,pointerType:'touch'});assert(!createdRun.player.held);
  const before=createdRun.time;await elements.pause.dispatch('click');frames(100);assert.equal(createdRun.time,before);
  await elements.resume.dispatch('click');frames(10);assert(createdRun.time>before);
  await window.dispatch('keydown',{code:'Space'});assert(createdRun.player.held);await window.dispatch('keyup',{code:'Space'});assert(!createdRun.player.held);
  await elements['pause-menu'].dispatch('click');startsFail=true;await elements['wallet-form'].dispatch('submit');assert.match(elements['wallet-status'].textContent,/offline/);assert(!elements['verify-button'].disabled,'failed start allows retry');
  let selected;elements.wallet.value=security.MINT;ticket.wallet=security.MINT;window.RushOnline.prepare=async()=>ticket;window.RushOnline.setWallet=address=>{selected=address;};
  await elements['wallet-form'].dispatch('submit');assert.equal(selected,security.MINT);assert.equal(elements['mode-label'].textContent,'WEEKLY RUN');
  await elements['pause-menu'].dispatch('click');
  await elements['wallet-form'].dispatch('submit');assert(frame);
});
test('audio initialization needs no button and ignores the old saved mute preference',()=>{
 const document=new Element('document'),window=new Element('window');document.getElementById=()=>{throw Error('audio must not query a removed button');};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'sound.js'),'utf8'),{document,window,localStorage:{getItem(){throw Error('must not read stale mute');}},Math,Audio:class{play(){return Promise.resolve();}pause(){}},Date});
 assert(window.RushSound);assert.doesNotThrow(()=>{window.RushSound.unlock();window.RushSound.setPlaying(true);window.RushSound.effect({type:'coin'});window.RushSound.setPlaying(false);});
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert(!html.includes('sound-toggle')&&!html.includes('sound-test'));
});

test('RPC failover and exact balances never grant entry on failed or malformed responses',async()=>{
  const wallet=security.MINT,calls=[];
  const response=amount=>({ok:true,json:async()=>({result:{value:[{account:{data:{parsed:{info:{owner:wallet,mint:security.MINT,tokenAmount:{amount:String(amount),decimals:6}}}}}}]}})});
  const fallback=await security.tokenBalance(wallet,['https://first.invalid','https://second.invalid'],async url=>{calls.push(url);return url.includes('first')?{ok:false}:response(50000000000n);});
  assert.deepEqual(calls,['https://first.invalid','https://second.invalid']);assert(fallback.eligible);
  assert(!(await security.tokenBalance(wallet,'https://unused.invalid',async()=>response(49999999999n))).eligible);
  assert(!(await security.tokenBalance(wallet,'https://unused.invalid',async()=>({ok:true,json:async()=>({result:{value:[]}})}))).eligible);
  await assert.rejects(security.tokenBalance(wallet,['https://first.invalid','https://second.invalid'],async()=>{throw Error('blocked');}),/temporarily unavailable/);
  await assert.rejects(security.tokenBalance(wallet,'https://unused.invalid',async()=>({ok:true,json:async()=>({result:{value:[{}]}})})),/Invalid token/);
});

test('one free play mode requires a reserved run and remembers wallet names without connecting',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  assert(!html.includes('CONNECT &amp; SIGN'));assert(html.includes('REWARDS WALLET'));
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  const document=new Element('document'),window=new Element('window');document.getElementById=id=>{assert(elements[id],id);return elements[id];};
  let startsFail=true;const requests=[];
  const storedNames=new Map();
  const fetcher=async(url,options)=>{
    requests.push([url,options.body?JSON.parse(options.body):null]);
    const value=url.endsWith('/config')?{engine:security.ENGINE_VERSION,vault:security.MINT,prizesEnabled:true,rewards:{catoshiPool:'100000',rushPool:'50'}}:url.endsWith('/vault')?{configured:true,tokens:'1234567.89',assets:[{symbol:'CATOSHI',available:true,tokens:'1234567.89'},{symbol:'RUSH',available:true,tokens:'42.5'}]}:url.endsWith('/runs/start')?{id:'test',wallet:security.MINT}:{eligible:true,tokens:'50000'};
    return {ok:!(startsFail&&url.endsWith('/runs/start')),json:async()=>startsFail&&url.endsWith('/runs/start')?{error:'Unavailable'}:value};
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'online.js'),'utf8'),{window,document,fetch:fetcher,localStorage:{getItem:key=>storedNames.get(key),setItem:(key,value)=>storedNames.set(key,value)},AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},location:{protocol:'file:'},URLSearchParams,console});
  window.RushOnline.setWallet(security.MINT);
  await assert.rejects(window.RushOnline.prepare(),/Unavailable/,'failed scored start never becomes an untracked local run');
  assert.equal(elements['prize-pool'].textContent,'100,000 CATOSHI + 50 RUSH');
  assert(!requests.some(([url])=>url.endsWith('/vault')),'the clean homepage does not require a vault balance RPC');
  assert(!elements['quest-rule']&&!elements['vault-status'],'homepage explanations are removed');
  elements['holder-name'].value='Wallaby';
  startsFail=false;window.RushOnline.setWallet(security.MINT);
  const holder=await window.RushOnline.prepare();assert.equal(holder.wallet,security.MINT);
  assert.equal(requests.at(-1)[1].wallet,security.MINT);assert.equal(requests.at(-1)[1].mode,'holder');
  assert.equal(requests.at(-1)[1].name,'Wallaby','the one entry form sends its leaderboard name');
  assert.equal(storedNames.get('rush-holder-name:'+security.MINT),'Wallaby');
  const second=encode58(Buffer.alloc(32,9));storedNames.set('rush-holder-name:'+second,'Second Cat');
  elements.wallet.value=second;await elements.wallet.dispatch('input');assert.equal(elements['holder-name'].value,'Second Cat','changing wallet restores its own saved name');
  elements.wallet.value=security.MINT;await elements.wallet.dispatch('input');assert.equal(elements['holder-name'].value,'Wallaby');
  elements['holder-name'].value='New Name';await elements.wallet.dispatch('change');assert.equal(elements['holder-name'].value,'New Name','autofill must preserve manual edits');
  await window.RushOnline.prepare();assert.equal(requests.at(-1)[1].name,'New Name');
  const checked=await window.RushOnline.progress(' '+security.MINT+' ');assert(checked.eligible);
  const lookup=requests.at(-1);assert.equal(lookup[1],null,'progress is a read-only GET');
  assert.equal(new URLSearchParams(lookup[0].split('?')[1]).get('wallet'),security.MINT);
  assert(!requests.some(([url])=>url.includes('/auth/')),'no connection or signature flow');
  elements.wallet.value='';await window.RushOnline.prepare();assert.equal(requests.at(-1)[1].wallet,null,'clearing the input overrides a remembered wallet');
});

test('free prize entry and progress work without any token balance request',async t=>{
  let calls=0;const config={...configFromEnv(),database:':memory:'};
  const app=createApp(config,{balance:async()=>{calls++;throw new security.HttpError(503,'RPC unavailable');}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;config.origin=base;
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
  const accepted=await fetch(base+'/api/runs/start',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({name:'Free Cat',mode:'holder',engine:security.ENGINE_VERSION,wallet:security.MINT})});
  assert.equal(accepted.status,200);assert.equal((await accepted.json()).wallet,security.MINT);
  const progress=await fetch(base+'/api/player-status?wallet='+security.MINT);assert.equal(progress.status,200);assert((await progress.json()).eligible);
  const compat=await fetch(base+'/api/balance?wallet='+security.MINT);assert.equal(compat.status,200);assert.equal((await compat.json()).minimumTokens,0);
  assert.equal(calls,0);
});

test('current request host fixes stale Railway origins while cross-site and forwarded-host tricks fail',async t=>{
  const config={...configFromEnv(),database:':memory:',origin:'https://old-name.up.railway.app'};
  const app=createApp(config,{balance:async()=>({whole:'50000',eligible:true})});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
  const post=async(origin,extra={})=>{const r=await fetch(base+'/api/balance',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{}),...extra},body:JSON.stringify({wallet:security.MINT})});await r.arrayBuffer();return r.status;};
  assert.equal(await post(base),200,'actual browser origin accepted even if PUBLIC_ORIGIN is stale');
  config.production=true;
  assert.equal(await post(base.replace('http:','https:')),200,'Railway HTTPS origin matches the host behind its TLS proxy');
  config.production=false;
  assert.equal(await post('https://evil.invalid'),403);
  assert.equal(await post(null),403);
  assert.equal(await post(null,{referer:base+'/'}),200,'mobile same-origin Referer works when Origin is omitted');
  assert.equal(await post(null,{referer:'https://evil.invalid/'}),403);
  assert.equal(await post('null',{referer:base+'/'}),403);
  assert.equal(await post('https://evil.invalid',{'x-forwarded-host':'evil.invalid'}),403);
  assert.equal(await post(base,{'sec-fetch-site':'cross-site'}),403);
  assert.equal(await post(null,{referer:base+'/','sec-fetch-site':'cross-site'}),403);
  const read=await fetch(base+'/api/balance?'+new URLSearchParams({wallet:' '+security.MINT+' '}));
  assert.equal(read.status,200,'read-only balance check needs no POST Origin header');
  const readBalance=await read.json();assert(readBalance.eligible);assert.equal(readBalance.wallet,security.MINT);
  const ticketRes=await fetch(base+'/api/runs/start',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({name:'Holder',wallet:security.MINT,mode:'holder',engine:security.ENGINE_VERSION})});
  assert.equal(ticketRes.status,200);await ticketRes.json();
  assert.equal(configFromEnv({NODE_ENV:'production',RAILWAY_PUBLIC_DOMAIN:'game.up.railway.app',DATABASE_PATH:'/data/test.sqlite'}).origin,'https://game.up.railway.app');
});

test('unattended runs lose momentum and usually fail; timed taps avoid early obstacles',()=>{
  let clearable=0,failed=0,bumped=0;const routes=new Set(),hazards=new Set();
  for(let seed=1;seed<=300;seed++){
    const idle=new Run(seed);let idleHits=0;
    for(let tick=0;tick<120*90&&!idle.dead;tick++){idle.step(1/120);idleHits+=idle.drainEvents().filter(event=>event.type==='stumble').length;}
    failed+=idle.dead;bumped+=idleHits>0;assert(idle.time>4,'the introduction stays safe');
    const route=new Run(seed);route.generate(40000);route.sectionAt(40000);routes.add(route.terrainSections.map(s=>s.kind+':'+Math.round(s.length)+':'+s.biome).join(','));
    for(const item of route.items)if(item.hazard)hazards.add(item.type);
    let cleared=false;
    for(const distance of [100,150,200,250,300,350,400,450,500,550,600]){
      const run=new Run(seed),gate=run.items.find(item=>item.hazard);let tapped=false,hit=false;
      for(let tick=0;tick<120*20&&!run.dead;tick++){
        if(!tapped&&gate.x-run.player.x<distance){run.press();run.release();tapped=true;}
        run.step(1/120);
        for(const event of run.drainEvents())if(event.type==='stumble'&&event.kind===gate.type)hit=true;
        if(run.player.x>gate.x+95){cleared=!run.dead&&!hit;break;}
      }
      if(cleared)break;
    }
    clearable+=cleared;
  }
  assert(failed>=225,'at least 75% of sampled idle routes fail within 90 seconds while allowing collision recovery');
  assert(bumped>=294,'idle play should reliably cost momentum');
  assert(clearable>=294,'timed taps should clear early hazards in at least 98% of sampled routes; crest landings also require control');
  assert(routes.size>=290,'seeded terrain shapes, lengths and biome sequences differ across rounds');
  assert.deepEqual([...hazards].sort(),['barrier','cargo','cart','log','rock','spikes','stack']);
});

test('ramps join ground with continuous height, slope and curvature and no step onto the kicker',()=>{
  let rampCount=0;
  for(let seed=1;seed<=80;seed++){
    const run=new Run(seed);run.generate(40000);
    for(const ramp of run.ramps){
      rampCount++;
      for(const x of [ramp.x,ramp.end,ramp.recovery]){
        assert(Math.abs(run.derivative(x+.01)-run.derivative(x-.01))<.001,'continuous slope through each join');
        const curvature=x=>(run.derivative(x+.05)-run.derivative(x-.05))/.1;
        assert(Math.abs(curvature(x+.01)-curvature(x-.01))<.0001,'continuous curvature through each join');
      }
      for(let x=ramp.x;x<ramp.recovery;x+=16)assert(Math.abs(run.rampY(ramp,x)-run.terrain(x))<1e-7,'ramp and drawn ground agree');
    }
  }
  assert(rampCount>300);
  const run=new Run(42);run.generate(40000);const ramp=run.ramps[0];assert(ramp);
  Object.assign(run.player,{x:ramp.x-15,y:run.terrain(ramp.x-15),speed:420,boost:0,grounded:true});
  run.items=[];let entered=false,launched=false;
  for(let tick=0;tick<240&&!run.dead;tick++){
    const oldY=run.player.y;run.step(1/120);
    if(run.player.ramp===ramp)entered=true;
    if(run.player.grounded)assert(Math.abs(run.player.y-oldY)<10,'no vertical snap on the ground');
    if(run.drainEvents().some(event=>event.text==='LAUNCH')){launched=true;break;}
  }
  assert(entered&&launched,'the joined ramp still provides a takeoff');
});

test('large obstacles slow the rider, consume collisions once and allow clean jumps',()=>{
  const setup=()=>{
    const run=new Run(5);run.terrain=()=>200;run.derivative=()=>0;run.slope=()=>0;run.ramps=[];run.gaps=[];run.rails=[];
    Object.assign(run.player,{x:0,y:200,speed:400,vx:400,boost:0,angle:0,grounded:true});
    run.nextFeature=run.nextScenery=Infinity;
    run.items=[{type:'spikes',x:180,y:200,width:70,height:31,hazard:true,heavy:true,hit:false}];return run;
  };
  for(const kind of ['barrier','cart','stack','spikes']){
    const idle=setup();idle.items[0].type=kind;idle.combo=5;let impact;
    for(let tick=0;tick<120&&!impact;tick++){idle.step(1/120);impact=idle.drainEvents().find(event=>event.type==='stumble');}
    assert(impact&&impact.heavy);assert(!idle.dead);assert.equal(idle.combo,1);
    assert(idle.player.speed>=115&&idle.player.speed<220);assert(impact.loss>180,'big objects remove about half the momentum without immediately ending the run');
    advance(idle,90);assert(!idle.dead,'an obstacle impact does not end the run');
    assert(!idle.drainEvents().some(event=>event.type==='stumble'),'do not hit the same object twice');
  }
  const protectedRun=setup();protectedRun.player.invulnerable=3;advance(protectedRun,80);
  assert(!protectedRun.dead);assert(protectedRun.player.speed>350);assert.equal(protectedRun.items.length,0,'recovery consumes the nearby object without repeated penalties');
  const jumped=setup();jumped.press();jumped.release();advance(jumped,90);assert(!jumped.dead);assert(jumped.player.x>250);
  assert(!jumped.drainEvents().some(event=>event.type==='stumble'));
});

test('three distinct obstacle hits end a run; overlapping objects and RUSH cannot drain extra lives',()=>{
  const run=new Run(7);run.terrain=()=>200;run.derivative=()=>0;run.slope=()=>0;
  run.items=[];run.ramps=[];run.gaps=[];run.rails=[];run.nextFeature=run.nextScenery=Infinity;
  Object.assign(run.player,{x:0,y:200,speed:400,vx:400,angle:0,boost:0,grounded:true});
  const hit=()=>{const item={type:'rock',x:run.player.x,y:200};run.stumble(item);return item;};
  assert.equal(run.lives,3);const first=hit();assert.equal(run.lives,2);assert(!run.dead);
  run.stumble(first);hit();assert.equal(run.lives,2,'the same rock and overlapping hitboxes share recovery');
  advance(run,151);hit();assert.equal(run.lives,1);assert(!run.dead);
  advance(run,151);hit();assert.equal(run.lives,0);assert(run.dead);assert.equal(run.reason,'OUT OF LIVES');
  assert.equal(run.drainEvents().filter(e=>e.lifeLost).length,3);hit();assert.equal(run.lives,0);
  const shield=new Run(9);shield.player.rush=7;shield.player.invulnerable=0;
  shield.stumble({type:'rock',x:0,y:shield.player.y});assert.equal(shield.lives,3,'RUSH protects lives even at a timer boundary');
});

test('rare green hearts restore exactly one life, cap at three and never sit on ground hazards or gaps',()=>{
  const run=new Run(7);run.terrain=()=>200;run.derivative=()=>0;run.slope=()=>0;
  run.ramps=[];run.gaps=[];run.rails=[];run.nextFeature=run.nextScenery=Infinity;
  Object.assign(run.player,{x:0,y:200,speed:400,vx:400,angle:0,boost:0,grounded:true});
  run.lives=1;
  for(const expected of [2,3,3]){
    run.items=[{type:'heart',x:run.player.x+3,y:183}];run.step(1/120);
    assert.equal(run.lives,expected);assert.equal(run.items.length,0,'a collected heart cannot be reused');
  }
  assert.equal(run.heartsCollected,2);assert.equal(run.drainEvents().filter(e=>e.type==='heart').length,2);
  const positions=new Set();
  for(let seed=1;seed<=40;seed++){
    const route=new Run(seed);route.generate(110000);const hearts=route.items.filter(i=>i.type==='heart');
    assert(hearts.length>=4&&hearts.length<=8,'hearts are rare, including in long runs');
    assert(hearts[0].x>8000,'no life farming in the safe introduction');
    for(let i=0;i<hearts.length;i++){
      assert(!route.gapAt(hearts[i].x));
      assert(!route.items.some(v=>route.touchesGroundHazard(v)&&Math.abs(v.x-hearts[i].x)<80));
      if(i)assert(hearts[i].x-hearts[i-1].x>13000,'health pickups stay far apart');
    }
    positions.add(hearts.map(v=>Math.round(v.x)).join(','));
  }
  assert.equal(positions.size,40,'each seed changes the recovery opportunities');
});

test('long flats vary the hill rhythm and high balloon chains have reachable launches and clear cables',()=>{
  let flats=0,steepUphill=false,steepDownhill=false,chains=0;
  for(let seed=1;seed<=24;seed++){
    const route=new Run(seed);route.generate(40000);let flatLength=0;
    for(let x=3000;x<40000;x+=20){
      const slope=route.derivative(x);steepUphill||=slope<-.85;steepDownhill||=slope>1.1;
      if(Math.abs(slope)<.065){flatLength+=20;if(flatLength===600)flats++;}else flatLength=0;
    }
    const first=route.rails.find(rail=>rail.high);assert(first,'each sampled long route includes balloon chains');
    const wires=route.rails.filter(rail=>rail.chain===first.chain),ramp=route.ramps.find(r=>r.end===first.x-65);
    assert(wires.length>=2&&ramp);chains++;
    for(const wire of wires)for(let x=wire.x;x<wire.end;x+=16)assert(route.railY(wire,x)<route.terrain(x)-50);
    let reachable=false;
    for(const offset of [Infinity,250,180,110,50,0]){
      const run=new Run(seed);run.generate(40000);run.items=[];run.gaps=[];run.nextFeature=run.nextScenery=Infinity;
      Object.assign(run.player,{x:ramp.x-120,y:run.terrain(ramp.x-120),speed:470,vx:470,boost:0,grounded:true});
      let tapped=false;
      for(let tick=0;tick<2400&&!run.dead&&run.player.x<wires[wires.length-1].end+100;tick++){
        if(offset!==Infinity&&!tapped&&run.player.x>=ramp.end-offset){run.press();run.release();tapped=true;}
        run.step(1/120);run.drainEvents();
        if(run.player.rail?.chain===first.chain){reachable=true;break;}
      }
      if(reachable)break;
    }
    assert(reachable,'a timed launch can reach seed '+seed+' sky route');
  }
  assert(chains===24&&flats>=20&&steepUphill&&steepDownhill);
});

test('high-jump cameras keep Catoshi in frame and play-area CSS suppresses iPhone selection',()=>{
  const {Renderer}=require('./renderer.js');
  for(const [width,height] of [[960,540],[600,960]])for(const altitude of [300,900,1800]){
    const run=new Run(1);run.items=[];run.nextFeature=run.nextScenery=Infinity;
    Object.assign(run.player,{x:500,y:run.terrain(500)-altitude,speed:600,grounded:false});
    const renderer=new Renderer({canvas:{width,height}},{});renderer.reset(run);
    for(let frame=0;frame<240;frame++)renderer.update(run,1/60);
    const screenY=(run.player.y-renderer.camera.y)*renderer.camera.zoom;
    assert(screenY>height*.25&&screenY<height*.68,'hero stays visible at '+altitude+' altitude');
  }
  const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8');
  assert.match(css,/#game-screen,#game-screen \*\{[^}]*-webkit-user-select:none;user-select:none;[^}]*-webkit-touch-callout:none;[^}]*-webkit-tap-highlight-color:transparent/);
});

test('mobile camera reveals the descending landing on a recorded high balloon route while keeping the hero clear',()=>{
  const {Renderer}=require('./renderer.js');
  const inputs=[[746,1],[746,0],[1000,1],[1000,0],[1436,1],[1436,0],[1669,1],[1669,0],[1972,1],[1972,0]];
  const run=new Run(7),width=600,height=960,renderer=new Renderer({canvas:{width,height}},{});renderer.reset(run);
  let cursor=0,samples=0,lowestLanding=0;
  for(let tick=0;tick<120*65&&!run.dead;tick++){
    while(cursor<inputs.length&&inputs[cursor][0]===tick){inputs[cursor++][1]?run.press():run.release();}
    run.step(1/120);run.drainEvents();renderer.update(run,1/120);
    const heroY=(run.player.y-renderer.camera.y)*renderer.camera.zoom;
    assert(heroY>height*.20&&heroY<height*.76,'Catoshi stays away from the HUD and bottom controls');
    if(run.player.grounded||run.player.vy<=0||run.terrain(run.player.x)-run.player.y<150)continue;
    const landing=renderer.landingPoint(run,run.player),x=(landing.x-renderer.camera.x)*renderer.camera.zoom;
    if(x<0||x>width-20)continue;
    samples++;lowestLanding=Math.max(lowestLanding,(landing.y-renderer.camera.y)*renderer.camera.zoom);
  }
  assert(samples>100,'the recording actually exercises a large descending jump');
  assert(lowestLanding<height,'the approaching landing fits inside the mobile play area');
});

test('midair flip sounds emit once per turn and mistimed flips spend one life without banking bonuses',()=>{
  const run=new Run(5);run.items=[];run.nextFeature=run.nextScenery=Infinity;run.gaps=[];run.rails=[];run.ramps=[];
  run.terrain=()=>5000;run.derivative=()=>0;run.slope=()=>0;
  Object.assign(run.player,{grounded:false,x:0,y:0,vx:400,vy:-20,speed:400,coyote:0});
  run.press();run.drainEvents();const events=[];
  for(let tick=0;tick<190;tick++){run.step(1/120);events.push(...run.drainEvents());}
  assert.equal(events.filter(event=>event.type==='flip-start').length,1);
  assert.equal(events.filter(event=>event.type==='flip').length,1);
  assert(!events.some(event=>event.type==='land'||event.type==='trick'),'airborne sounds do not award landing points');
  Object.assign(run.player,{held:true,angle:Math.PI});run.land(5000,0);assert(!run.dead);assert.equal(run.lives,2);
  const impact=run.drainEvents();assert(impact.some(e=>e.lifeLost&&e.kind==='flip'));
  assert(!impact.some(e=>/BACKFLIP/.test(e.text||'')),'a bad flip cannot bank points');
  for(let i=0;i<2;i++){
    Object.assign(run.player,{held:true,angle:Math.PI,airborne:1,invulnerable:0,recovery:0});run.land(5000,0);
  }
  assert(run.dead);assert.equal(run.reason,'OUT OF LIVES');assert.equal(run.lives,0);
  const crash=run.drainEvents().find(event=>event.type==='crash');assert(Number.isFinite(crash.x)&&Number.isFinite(crash.y));
});


test('high auto-aligned falls survive touchdown, show one impact and do not grant rough flip bonuses',()=>{
 for(const slope of [-.5,0,.5])for(const height of [600,1800,3500]){
  const run=new Run(11);run.nextFeature=run.nextScenery=Infinity;run.items=[];run.gaps=[];run.rails=[];run.ramps=[];
  run.terrain=x=>height+x*slope;run.derivative=()=>slope;run.slope=()=>Math.atan(slope);
  Object.assign(run.player,{x:0,y:0,vx:420,vy:0,speed:420,angle:Math.atan(slope),grounded:false,held:false,coyote:0});
  const events=[];for(let i=0;i<1800&&!run.player.grounded&&!run.dead;i++){run.step(1/120);events.push(...run.drainEvents());}
  assert(!run.dead,'upright '+height+' fall onto slope '+slope);assert(run.player.grounded);
  assert(!events.some(e=>e.type==='crash'));
  const impacts=events.filter(e=>e.type==='stumble'&&e.kind==='landing');assert(impacts.length<=1,'no repeat impact');
  if(height>=1800){assert.equal(impacts.length,1);assert(run.player.recovery>1);assert(run.player.speed>=150);}
 }
 const rough=new Run(1);Object.assign(rough.player,{airborne:2,spin:TAU,angle:0,vx:400,vy:1500,held:false});
 rough.land(200,0);assert(!rough.dead);assert(!rough.drainEvents().some(e=>/BACKFLIP/.test(e.text||'')),'rough landing does not bank a flip reward');
});

function recoveryRun(){
 const run=new Run(5);run.terrain=()=>200;run.derivative=()=>0;run.slope=()=>0;
 run.ramps=[];run.gaps=[];run.rails=[];run.items=[];run.nextFeature=run.nextScenery=Infinity;
 Object.assign(run.player,{x:100,y:188,speed:500,vx:500,vy:1400,angle:2.2,grounded:false,airborne:1.4,boost:0,coyote:0});return run;
}
test('landing on a tall obstacle cannot bypass the nonfatal collision response or feed a nearby hound',()=>{
 for(const kind of ['barrier','cart','stack','spikes','rock','log','crate']){
  const run=recoveryRun();run.items=[{type:kind,x:104,y:200,width:74,height:70,heavy:true,hazard:true}];
  run.dog={active:true,distance:24.1,warning:true};run.step(1/120);
  assert(!run.dead,kind+' collision and landing must survive');advance(run,1);assert(run.player.grounded);
  assert(run.player.recovery>1);assert(run.dog.distance>=55);assert(!run.dog.warning);
  assert.equal(run.drainEvents().filter(event=>event.type==='stumble').length,1);
  advance(run,100);assert(!run.dead,'brief recovery prevents an instant second punishment');
  run.press();run.release();advance(run,100);assert(!run.dead,'a prompt jump gives time to escape');assert(run.player.recovery===0);
 }
 const unprotected=recoveryRun();advance(unprotected,2);assert(!unprotected.dead,'an unheld high landing also recovers');assert(unprotected.player.grounded);assert(unprotected.player.recovery>1);
});
test('a gap entered during bump recovery stays recoverable even when the timer ends in midflight',()=>{
 const run=recoveryRun();Object.assign(run.player,{grounded:true,x:0,y:200,speed:400,vx:400,vy:0,angle:0,airborne:0});
 run.gaps=[{x:10,end:500}];run.stumble({type:'cart',x:0,y:200,hazard:true,heavy:true});
 let entered=false,expiredInGap=false;
 for(let n=0;n<120*9&&!run.dead;n++){run.step(1/120);entered||=Boolean(run.player.recoveryGap);expiredInGap||=Boolean(run.player.recoveryGap)&&run.player.recovery===0;run.drainEvents();}
 assert(entered&&expiredInGap);assert(!run.dead);assert(run.player.x>500);assert.equal(run.player.recoveryGap,null);
 const miss=recoveryRun();Object.assign(miss.player,{x:0,y:200,vx:100,vy:0,speed:100});miss.gaps=[{x:-10,end:500}];advance(miss,300);assert(miss.dead,'unprotected missed gaps still fail');
});

function audioHarness({broken=false,mobile=false,disabled=false}={}){
  const document=new Element('document'),window=new Element('window');let time=0;
  document.getElementById=()=>{throw Error('audio must not need UI');};document.hidden=false;
  const parameter=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({connect(target){this.output=target;},disconnect(){this.disconnected=true;},gain:parameter()});
  const contexts=[];
  class Context{
    constructor(options){this.options=options;this.state='suspended';this.sampleRate=48000;this.currentTime=10;this.destination=node();this.buffers=[];this.sources=[];this.listeners=[];this.resumes=0;contexts.push(this);}
    createGain(){return node();}
    createDynamicsCompressor(){return {...node(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter()};}
    createBuffer(channels,length){if(broken)throw Error('buffer unavailable');const data=new Float32Array(length),buffer={length,getChannelData:()=>data};this.buffers.push(buffer);return buffer;}
    createBufferSource(){const source={...node(),playbackRate:parameter(),start(at=0){this.at=at;this.started=true;},stop(){this.stopped=true;}};this.sources.push(source);return source;}
    createOscillator(){return {...this.createBufferSource(),frequency:parameter()};}
    createBiquadFilter(){return {...node(),frequency:parameter()};}
    addEventListener(type,callback){if(type==='statechange')this.listeners.push(callback);}
    resume(){this.resumes++;return new Promise(resolve=>{this.resolveResume=resolve;});}
    wake(){this.state='running';for(const callback of this.listeners)callback();this.resolveResume?.();}
    close(){this.closed=true;this.state='closed';return Promise.resolve();}
  }
  let music,finishMusic;const tracks=[];class Track{
    constructor(src){this.src=src;this.plays=0;this.pauses=0;this.paused=true;this.readyState=0;this.loads=0;this.listeners={};this.history=[];tracks.push(this);if(src==='music.mp3')music=this;}
    play(){this.plays++;this.paused=false;this.history.push(this.src);if(this.plays===1)return new Promise(resolve=>{this.finishPlay=resolve;if(this.src==='music.mp3')finishMusic=resolve;});return Promise.resolve();}
    pause(){this.pauses++;this.paused=true;}
    load(){this.loads++;this.readyState=3;this.listeners.canplay?.();}
    addEventListener(type,callback){this.listeners[type]=callback;}
  }
  window.AudioContext=Context;window.RushAudioConfig={enabled:!disabled,musicSrc:'music.mp3',musicVolume:.16,effectsVolume:.72};
  const navigator={audioSession:{type:'ambient'},maxTouchPoints:mobile?5:0};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'sound.js'),'utf8'),{window,document,navigator,Audio:Track,localStorage:{getItem(){},setItem(){}},Math,Set,Promise,setTimeout,clearTimeout,Date,performance:{now:()=>time}});
  return {document,window,contexts,navigator,tracks,setNow:value=>{time=value;},get music(){return music;},finishMusic:()=>finishMusic?.()};
}

test('audible blast and every coin start immediately, resume and stop with play states',async()=>{
  const h=audioHarness(),sound=h.window.RushSound;
  await h.window.dispatch('pointerdown');const ctx=h.contexts[0];
  assert.equal(h.navigator.audioSession.type,'playback');assert.equal(ctx.resumes,1);
  assert.equal(h.music.pauses,0,'do not abort the first gesture-authorized music play');
  const [coin,blast]=ctx.buffers;
  for(const [buffer,peakLimit]of [[coin,.801],[blast,.901]]){
    const values=buffer.getChannelData(0);let energy=0,peak=0;
    for(const value of values){assert(Number.isFinite(value));energy+=value*value;peak=Math.max(peak,Math.abs(value));}
    assert(Math.sqrt(energy/values.length)>.04,'effects contain audible PCM');assert(peak<=peakLimit);
    assert(Math.abs(values.at(-1))<.005,'tails fade instead of clicking');
  }
  sound.setPlaying(true);sound.burst();for(let i=0;i<3;i++)sound.effect({type:'coin'});
  assert.equal(ctx.sources.filter(source=>source.buffer===coin).length,0,'wait for audio resume');
  ctx.wake();await Promise.resolve();
  assert.equal(ctx.sources.filter(source=>source.buffer===blast).length,1);
  const chimes=ctx.sources.filter(source=>source.buffer===coin);assert.equal(chimes.length,3,'rapid pickups are not dropped');
  assert(chimes.every(source=>source.at===ctx.currentTime),'no per-coin delay or cumulative scheduling backlog');
  assert(chimes.every(source=>source.output.gain.value===.05),'coin mix stays at 5% without delaying playback');
  assert.equal(ctx.sources.find(source=>source.buffer===blast).output.gain.value,1,'other sounds keep their level');
  h.finishMusic();await Promise.resolve();assert.equal(h.music.pauses,0);
  ctx.state='interrupted';sound.effect({type:'coin'});assert.equal(ctx.resumes,2);ctx.wake();await Promise.resolve();
  assert.equal(ctx.sources.filter(source=>source.buffer===coin).length,4,'interrupted Safari context resumes');
  ctx.state='interrupted';sound.effect({type:'coin'});sound.setPlaying(false);ctx.wake();await Promise.resolve();
  assert.equal(ctx.sources.filter(source=>source.buffer===coin).length,4,'paused runs discard queued effects');
  assert(chimes.every(source=>source.stopped));
  sound.setPlaying(true);sound.effect({type:'coin'});
  assert.equal(ctx.sources.filter(source=>source.buffer===coin).length,5,'resume starts immediately');
  h.document.hidden=true;await h.document.dispatch('visibilitychange');sound.effect({type:'coin'});
  assert.equal(ctx.sources.filter(source=>source.buffer===coin).length,5);assert(h.music.pauses>0);

});

test('a partially supported AudioContext cannot throw into the game loop',()=>{
  const h=audioHarness({broken:true}),sound=h.window.RushSound;
  assert.doesNotThrow(()=>{sound.unlock();sound.setPlaying(true);sound.burst();sound.effect({type:'coin'});sound.setPlaying(false);});
  assert(h.contexts.every(context=>context.closed));
});

test('jump, flip, material bumps and final crashes play distinct audible samples',async()=>{
  const h=audioHarness(),sound=h.window.RushSound;sound.unlock();const ctx=h.contexts[0];ctx.wake();await Promise.resolve();sound.setPlaying(true);
  const [,,jump,flip,metal,wood,stone,crash]=ctx.buffers;
  for(const buffer of [jump,flip,metal,wood,stone,crash]){
    const values=buffer.getChannelData(0);let energy=0;
    for(const value of values){assert(Number.isFinite(value));assert(Math.abs(value)<=.901);energy+=value*value;}
    assert(Math.sqrt(energy/values.length)>.03);assert(Math.abs(values.at(-1))<.005);
  }
  for(const event of [{type:'jump'},{type:'flip-start'},{type:'flip',turns:1},
    {type:'stumble',material:'metal',heavy:true},{type:'stumble',material:'wood'},
    {type:'stumble',material:'stone'},{type:'crash'}])sound.effect(event);
  assert.equal(ctx.sources.filter(source=>source.buffer===jump).length,1);
  assert.equal(ctx.sources.filter(source=>source.buffer===flip).length,2);
  for(const buffer of [metal,wood,stone,crash])assert.equal(ctx.sources.filter(source=>source.buffer===buffer).length,1);
  const before=ctx.sources.length;sound.effect({type:'rush'});sound.effect({type:'redRush'});
  assert.equal(ctx.sources.length-before,8,'distinct rising power-up and red collection sounds are scheduled');
});

test('balance response validation retries healthy RPCs and program queries handle both Solana token programs',async()=>{
  const address=encode58(Buffer.alloc(32,9)),otherMint=encode58(Buffer.alloc(32,8));
  const entry=(mint,amount,key,program)=>({pubkey:key,account:{owner:program,data:{parsed:{info:{owner:address,mint,tokenAmount:{amount,decimals:6}}}}}});
  const okay=result=>({ok:true,json:async()=>({result})});
  const calls=[];
  const value=await security.tokenBalance(' '+address+' ',['https://bad.invalid','https://good.invalid'],async endpoint=>{
    calls.push(endpoint);return okay({value:endpoint.includes('bad')?[{}]:[entry(security.MINT,'50000123456','one')]});
  });
  assert.deepEqual(calls,['https://bad.invalid','https://good.invalid']);assert.equal(value.raw,50000123456n);assert(value.eligible);
  for(const program of ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']){
    const methods=[];
    const balance=await security.tokenBalance(address,'https://indexed.invalid',async(_endpoint,options)=>{
      const request=JSON.parse(options.body);methods.push(request.method);
      if(request.method==='getAccountInfo')return okay({value:{owner:program,data:{parsed:{type:'mint',info:{decimals:6}}}}});
      if(request.params[1].mint)return {ok:true,json:async()=>({error:{code:-32010,message:'mint index unavailable'}})};
      assert.equal(request.params[1].programId,program);
      return okay({value:[entry(otherMint,'999999999999','other',program),entry(security.MINT,'40000000000','first',program),entry(security.MINT,'10000000000','second',program)]});
    });
    assert.equal(balance.raw,50000000000n);assert(balance.eligible);
    assert.deepEqual(methods,['getTokenAccountsByOwner','getAccountInfo','getTokenAccountsByOwner']);
  }
  await assert.rejects(security.tokenBalance(address,'https://duplicate.invalid',async()=>okay({value:[entry(security.MINT,'30000000000','duplicate'),entry(security.MINT,'30000000000','duplicate')]})),/Invalid token/);
  await assert.rejects(security.tokenBalance(address,'https://wrong.invalid',async()=>okay({value:[entry(security.MINT,'50000000000','one','11111111111111111111111111111111')]})),/Invalid token/);
});

test('vault API exposes both real balances, reports outages honestly, and snapshots the current prize day',async t=>{
  const {ensureRound}=require('./rewards.cjs');
  const vault=encode58(Buffer.alloc(32,44)),rush=encode58(Buffer.alloc(32,45));
  const config={...configFromEnv({VAULT_WALLET:vault,RUSH_MINT:rush}),database:':memory:'};
  let time=ROUND_MS+1,rushUnavailable=false;
  const clock=()=>time;
  const app=createApp(config,{now:clock,assetBalance:async(address,mint)=>{assert.equal(address,vault);if(rushUnavailable&&mint===rush)throw new security.HttpError(503,'RPC unavailable');return {raw:mint===security.MINT?1234567000000n:42500000n,decimals:6,whole:mint===security.MINT?'1234567':'42',eligible:false};}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
  const value=await (await fetch(base+'/api/vault')).json();assert.equal(value.assets.length,2);assert.equal(value.tokens,'1234567');assert.equal(value.assets[1].tokens,'42.5');
  time+=31000;rushUnavailable=true;
  const outage=await (await fetch(base+'/api/vault')).json();assert.equal(outage.assets[0].available,true);assert.equal(outage.assets[1].available,false);assert.equal(outage.assets[1].tokens,null,'RPC failure is not a fabricated zero');
  assert.equal((await (await fetch(base+'/api/config')).json()).rewards.enabled,false);
  const active=configFromEnv({VAULT_WALLET:vault,RUSH_MINT:rush,REWARDS_ENABLED:'true',CATOSHI_PRIZE_POOL:'100000',RUSH_PRIZE_POOL:'10.5'});
  const first=ensureRound(app.db,1,active,ROUND_MS);assert.equal(first.tokens,'100000');assert.equal(first.rush_tokens,'10.5');
  active.tokens='900000';active.rewards.rushTokens='99';
  const same=ensureRound(app.db,1,active,ROUND_MS);assert.equal(same.tokens,'100000','published prize is fixed for that day');assert.equal(same.rush_tokens,'10.5');
  assert.equal(ensureRound(app.db,2,active,ROUND_MS).tokens,'900000','new budget applies next day');
  assert.throws(()=>configFromEnv({VAULT_WALLET:vault,REWARDS_ENABLED:'true',RUSH_PRIZE_POOL:'1'}),/RUSH_MINT/);
});

test('top ten unique wallets share both pools exactly; finalized transfers settle each token and cannot be reused',async()=>{
  const rewards=require('./rewards.cjs');
  const vault=encode58(Buffer.alloc(32,44)),rush=encode58(Buffer.alloc(32,45));
  const config=configFromEnv({VAULT_WALLET:vault,RUSH_MINT:rush,REWARDS_ENABLED:'true',CATOSHI_PRIZE_POOL:'100000',RUSH_PRIZE_POOL:'10.5'});
  const db=openDatabase(':memory:');const now=ROUND_MS*2+GRACE_MS+1000;
  const wallet=i=>encode58(Buffer.alloc(32,i));
  const insert=(id,i,score,round=1)=>db.prepare('INSERT INTO runs(id,session,seed,name,wallet,mode,round,started,expires,engine,score,distance,coins,submitted)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'session'+id,1,'Player '+i,wallet(i),'holder',round,1,ROUND_MS*2,security.ENGINE_VERSION,score,100,1,100+i);
  const balance=async(address,mint)=>{assert.equal(address,vault,'free winners require no holdings lookup');return {raw:address===vault?(mint===security.MINT?1000000000000n:1000000000n):50000000000n,decimals:6,whole:'0',eligible:false};};
  try{
    rewards.ensureRound(db,1,config,ROUND_MS);
    for(let i=1;i<=12;i++)insert('run'+i,i,2000-i);
    insert('duplicate',1,3000);
    const plan=await rewards.makeTop10Plan(db,1,config,{now:()=>now,balance});assert.equal(plan.payments.length,20);
    assert.equal(new Set(plan.payments.map(p=>p.wallet)).size,10);assert.equal(plan.payments[0].run_id,'duplicate');
    const cat=plan.payments.filter(p=>p.symbol==='CATOSHI'),rushPayments=plan.payments.filter(p=>p.symbol==='RUSH');
    assert.equal(cat.reduce((s,p)=>s+BigInt(p.raw),0n),100000000000n);assert.equal(rushPayments.reduce((s,p)=>s+BigInt(p.raw),0n),10500000n);
    assert.equal(cat[0].raw,'30000000000');assert.equal(cat[9].raw,'2000000000');
    db.prepare('INSERT INTO rounds VALUES(?,?,?,?,?)').run(3,ROUND_MS*3,ROUND_MS*4,'100000',vault);insert('legacy',13,700,3);
    await assert.rejects(makePlan(db,3,config,{now:()=>ROUND_MS*4+GRACE_MS+1000,balance:async address=>({...await balance(address,security.MINT),raw:100000000000n})}),/unreserved/,'legacy planning cannot spend a new top-10 reservation');
    assert.deepEqual((await rewards.makeTop10Plan(db,1,config,{now:()=>now,balance})).payments,plan.payments,'plan is idempotent');
    rewards.ensureRound(db,2,config,ROUND_MS);insert('next',12,500,2);
    await assert.rejects(rewards.makeTop10Plan(db,2,config,{now:()=>ROUND_MS*3+GRACE_MS+1000,balance:async(a,m)=>({...await balance(a,m),raw:m===security.MINT?100000000000n:10500000n})}),/unreserved/);
    assert.equal(db.prepare('SELECT COUNT(*) count FROM reward_plans WHERE round=2').get().count,0);
    const entry=(owner,mint,raw)=>({owner,mint,uiTokenAmount:{amount:String(raw),decimals:6}});
    const pre=[entry(vault,security.MINT,1000000000000n),entry(vault,rush,1000000000n),...plan.payments.map(p=>entry(p.wallet,p.mint,p.symbol==='CATOSHI'?50000000000n:0n))];
    const post=[entry(vault,security.MINT,900000000000n),entry(vault,rush,989500000n),...plan.payments.map(p=>entry(p.wallet,p.mint,(p.symbol==='CATOSHI'?50000000000n:0n)+BigInt(p.raw)))];
    const tx={blockTime:Math.floor(now/1000),meta:{err:null,preTokenBalances:pre,postTokenBalances:post}};
    const signature=encode58(Buffer.alloc(64,10));
    await assert.rejects(rewards.recordTop10Payment(db,1,'CATOSHI',signature,config,{transaction:async()=>({...tx,meta:{...tx.meta,err:'failed'}})}),/successful/);
    const paid=await rewards.recordTop10Payment(db,1,'CATOSHI',signature,config,{transaction:async()=>tx,now:()=>now});assert.equal(paid.payments.filter(p=>p.status==='paid').length,10);
    const both=await rewards.recordTop10Payment(db,1,'RUSH',signature,config,{transaction:async()=>tx,now:()=>now});assert(both.payments.every(p=>p.status==='paid'),'one batch may settle both tokens');
    await assert.rejects(rewards.recordTop10Payment(db,1,'CATOSHI',signature,config,{transaction:async()=>tx}),/pending/);
    const fewer=await rewards.makeTop10Plan(db,2,config,{now:()=>ROUND_MS*3+GRACE_MS+1000,balance});assert.equal(fewer.payments.length,2);assert.equal(fewer.payments[0].rank,1);
    assert.equal(fewer.payments.find(p=>p.symbol==='CATOSHI').raw,'100000000000','sole winner receives full configured pool');
    await assert.rejects(rewards.recordTop10Payment(db,2,'CATOSHI',signature,config,{transaction:async()=>tx}),/already/);
  }finally{db.close();}
});


test('mobile uses cached Web Audio for every cue, with no file loads, timers or future scheduling',async()=>{
 const h=audioHarness({mobile:true}),sound=h.window.RushSound;sound.unlock();const ctx=h.contexts[0];ctx.wake();await Promise.resolve();sound.setPlaying(true);
 assert.equal(ctx.options.latencyHint,'interactive');assert.equal(h.navigator.audioSession.type,'playback');
 const buffers=ctx.buffers.length,tracks=h.tracks.length;const sourceCount=ctx.sources.length;
 for(let i=0;i<25;i++)sound.effect({type:'coin'});
 for(const event of [{type:'burst'},{type:'jump'},{type:'flip-start'},{type:'flip'},{type:'stumble',material:'metal'}, {type:'land'},{type:'rush'},{type:'redRush'},{type:'crash'}])sound.effect(event);
 const chimes=ctx.sources.slice(sourceCount).filter(source=>source.buffer===ctx.buffers[0]);
 assert.equal(chimes.length,25);assert(chimes.every(source=>source.at===ctx.currentTime),'25 simultaneous pickups do not leave a one-second backlog');
 for(const source of ctx.sources.slice(sourceCount).filter(source=>source.buffer&&ctx.buffers.slice(0,8).includes(source.buffer)))assert.equal(source.at,ctx.currentTime,'every sample starts at the event time');
 assert.equal(ctx.buffers.length,buffers,'no PCM regeneration while playing');assert.equal(h.tracks.length,tracks,'no new audio element or file load on an event');
 assert(h.tracks.every(track=>['sfx-silence-v1.wav','music.mp3'].includes(track.src)),'mobile effects never stream WAV files when Web Audio works');
 sound.setPlaying(false);assert(chimes.every(source=>source.stopped));
});
test('fallback clips preload once and replay immediately without changing sources',async()=>{
 const h=audioHarness({broken:true}),sound=h.window.RushSound;sound.unlock();
 const voices=h.tracks.filter(track=>track.src==='sfx-silence-v1.wav');assert.equal(voices.length,19);
 for(const voice of voices)voice.finishPlay();await Promise.resolve();await Promise.resolve();sound.setPlaying(true);
 const initial=voices.map(voice=>({src:voice.src,loads:voice.loads}));
 for(let i=0;i<8;i++)sound.effect({type:'coin'});
 for(const kind of ['burst','jump','flip','crash','rush','redRush'])sound.effect({type:kind});
 assert.equal(voices.filter(voice=>voice.src==='sfx-coin-v1.wav').reduce((sum,voice)=>sum+voice.history.filter(src=>src==='sfx-coin-v1.wav').length,0),8,'fallback coin calls happen synchronously');
 assert.deepEqual(voices.map(voice=>({src:voice.src,loads:voice.loads})),initial,'events do not reload or switch media files');
 assert(voices.filter(v=>v.src==='sfx-coin-v1.wav').every(v=>v.volume===.72*.05),'fallback coins use the same 5% mix');
 assert.equal(voices.find(v=>v.src==='sfx-burst-v1.wav').volume,.72,'fallback blast stays unchanged');
 sound.setPlaying(false);assert(voices.every(voice=>voice.paused));
});
test('audio can still be disabled through config without any visible toggle',()=>{
 const h=audioHarness({disabled:true}),sound=h.window.RushSound;sound.unlock();sound.setPlaying(true);sound.burst();sound.effect({type:'coin'});assert.equal(h.contexts.length,0);assert.equal(h.tracks.length,0);
});
test('interruption recovery discards stale cues instead of playing delayed coin and crash backlogs',async()=>{
 const h=audioHarness({mobile:true}),sound=h.window.RushSound;sound.unlock();sound.setPlaying(true);const ctx=h.contexts[0];
 sound.burst();for(let i=0;i<12;i++)sound.effect({type:'coin'});h.setNow(200);ctx.wake();await Promise.resolve();
 assert.equal(ctx.sources.filter(source=>ctx.buffers.slice(0,8).includes(source.buffer)).length,0,'no stale sounds after late resume');
 sound.effect({type:'coin'});assert.equal(ctx.sources.filter(source=>source.buffer===ctx.buffers[0]).length,1,'fresh cues start immediately');
 ctx.state='interrupted';h.setNow(210);sound.effect({type:'jump'});h.setNow(240);ctx.wake();await Promise.resolve();assert.equal(ctx.sources.filter(source=>source.buffer===ctx.buffers[2]).length,1,'a brief interruption retains the fresh jump cue');
});
test('a pending resume promise cannot prevent a later trusted tap from retrying audio',async()=>{
 const h=audioHarness(),sound=h.window.RushSound;sound.unlock();const ctx=h.contexts[0];assert.equal(ctx.resumes,1);
 await h.window.dispatch('touchend');assert.equal(ctx.resumes,2,'retry even if the earlier resume never settled');
 sound.setPlaying(true);sound.burst();ctx.wake();await Promise.resolve();assert(ctx.sources.some(source=>source.buffer===ctx.buffers[1]));
});
test('all bundled effects are valid, audible PCM WAVs with faded tails; priming media is silent',()=>{
 for(const kind of ['silence','burst','coin','jump','flip','metal','wood','stone','crash','land','rush','red']){
  const bytes=fs.readFileSync(path.join(__dirname,'sfx-'+kind+'-v1.wav'));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
  assert.equal(bytes.readUInt32LE(24),44100);assert.equal(bytes.readUInt16LE(34),16);assert.equal(bytes.readUInt32LE(40),bytes.length-44);
  let sum=0,peak=0;for(let i=44;i<bytes.length;i+=2){const v=bytes.readInt16LE(i)/32768;sum+=v*v;peak=Math.max(peak,Math.abs(v));}
  if(kind==='silence')assert.equal(peak,0);else{assert(Math.sqrt(sum/((bytes.length-44)/2))>.02,kind+' is audible');assert(peak<.91);assert(Math.abs(bytes.readInt16LE(bytes.length-2))<164);}
 }
});


test('a stalled fallback priming request can be retried and its late resolution cannot stop a newer effect',async()=>{
 const h=audioHarness({broken:true,mobile:true}),sound=h.window.RushSound;sound.unlock();
 const voices=h.tracks.filter(track=>track.src==='sfx-silence-v1.wav'&&!track.loop);
 sound.setPlaying(true);sound.burst();await h.window.dispatch('touchend');await Promise.resolve();
 assert(voices.every(voice=>voice.plays>=2),'retry media while an earlier play promise is pending');
 assert(voices.some(voice=>voice.history.includes('sfx-burst-v1.wav')));
 const counts=voices.map(voice=>voice.pauses);for(const voice of voices)voice.finishPlay();await Promise.resolve();
 assert.deepEqual(voices.map(voice=>voice.pauses),counts,'late priming results do not pause a playing effect');sound.setPlaying(false);
});

test('homepage ten-pose loop runs independently of GIF playback and resumes after playing or backgrounding',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 assert.match(html,/<img id="home-catoshi" src="catoshi-home-v2.gif\?v=/);
 assert.match(html,/<canvas id="home-catoshi-animation"[^>]*hidden/);
 const bytes=fs.readFileSync(path.join(__dirname,'catoshi-home-v2.webp'));
 let frames=0,loops;
 for(let offset=12;offset<bytes.length;){
  const kind=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4);
  if(kind==='ANIM')loops=bytes.readUInt16LE(offset+12);
  if(kind==='ANMF')frames++;
  offset+=8+length+(length%2);
 }
 assert.equal(frames,10);assert.equal(loops,0);
 const setup=(canvasWorks=true)=>{
  const hero=new Element('home-catoshi');hero.src='catoshi-home-v2.gif?v=guest-home-3';hero.getAttribute=()=>hero.src;
  const canvas=new Element('home-catoshi-animation'),wrapper=new Element('home-mascot'),gate=new Element('gate');
  const drawn=[],classes=new Set(),queue=new Map();let active=true,sheet,observer,id=0,now=0;
  wrapper.classList={add:name=>classes.add(name),remove:name=>classes.delete(name)};
  gate.classList={contains:()=>active};
  canvas.getContext=()=>canvasWorks?{clearRect(){},beginPath(){},ellipse(){},fill(){},drawImage(...args){drawn.push(args.slice(1));}}:null;
  const document=new Element('document');document.hidden=false;
  document.getElementById=id=>({'home-catoshi':hero,'home-catoshi-animation':canvas,'home-mascot':wrapper,gate})[id]||null;
  const window=new Element('window');window.matchMedia=()=>({matches:true});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'home.js'),'utf8'),{
   document,window,Image:class{constructor(){sheet=this;this.naturalWidth=1983;this.naturalHeight=793;}},
   MutationObserver:class{constructor(fn){observer=fn;}observe(){}},
   requestAnimationFrame:fn=>{queue.set(++id,fn);return id;},cancelAnimationFrame:id=>queue.delete(id)
  });
  const advance=n=>{for(let i=0;i<n;i++){now+=80;const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn(now));}};
  return {hero,canvas,classes,drawn,document,window,queue,load:()=>sheet.onload(),advance,gate:value=>{active=value;observer();},fail:()=>sheet.onerror()};
 };
 const h=setup();h.load();h.advance(100);
 assert(h.classes.has('animated'));assert(!h.canvas.hidden);
 assert.equal(new Set(h.drawn.map(crop=>crop.slice(0,4).join(','))).size,10,'all ten poses draw even when native media is frozen or reduced motion is enabled');
 assert(h.drawn.length>80,'the loop continues into another cycle');
 const before=h.drawn.length;h.gate(false);h.advance(20);assert.equal(h.drawn.length,before,'homepage work pauses during gameplay');
 h.gate(true);h.advance(10);assert(h.drawn.length>before,'returning home restarts the loop');
 h.document.hidden=true;await h.document.dispatch('visibilitychange');assert.equal(h.queue.size,0);
 h.document.hidden=false;await h.document.dispatch('visibilitychange');h.advance(10);assert(h.queue.size>0);
 await h.window.dispatch('pagehide');assert.equal(h.queue.size,0);await h.window.dispatch('pageshow');assert.equal(h.queue.size,1);
 h.fail();assert(h.canvas.hidden);assert(!h.classes.has('animated'),'a failed atlas keeps the native image visible');
 const fallback=setup(false);await fallback.hero.dispatch('error');assert.match(fallback.hero.src,/catoshi-home-v2.webp/);
 await fallback.hero.dispatch('error');assert.match(fallback.hero.src,/catoshi-home-still-v2.png/);
});

test('compact lobby keeps unfunded prizes at $0 and leaderboard renders safe names, ranks and empty/error states',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 class Node extends Element{
  constructor(id){super(id);this.children=[];}
  set textContent(value){this.text=value;this.children=[];}get textContent(){return this.text;}
  appendChild(child){this.children.push(child);}setAttribute(key,value){this[key]=value;}
 }
 const setup=(vault,prizesEnabled)=>{
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Node(m[1])]));
  const document=new Node('document'),window=new Node('window');
  document.getElementById=id=>{assert(elements[id],id);return elements[id];};document.createElement=tag=>new Node(tag);
  let entries=[{rank:1,name:'<Cat>',wallet:'Abcd…Wxyz',score:2345,distance:900,pointsMultiplier:2}],failed=false;
  const config={engine:security.ENGINE_VERSION,vault,prizesEnabled,round:Math.floor(Date.now()/86400000),rewards:{catoshiPool:'100000',rushPool:'0'}};
  const fetcher=async url=>({ok:!failed,json:async()=>failed?{error:'Offline'}:url.endsWith('config')?config:{entries,round:config.round,updatedAt:Date.now()}});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'online.js'),'utf8'),{window,document,fetch:fetcher,location:{protocol:'file:'},localStorage:{getItem(){},setItem(){}},AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},URLSearchParams});
  return {elements,client:window.RushOnline,setEntries:value=>{entries=value;},fail:()=>{failed=true;}};
 };
 for(const [vault,enabled]of [['',true],[security.MINT,false]]){
  const h=setup(vault,enabled);await h.client.getConfig();assert.equal(h.elements['prize-pool'].textContent,'$0');
 }
 const h=setup(security.MINT,true);await h.client.getConfig();assert.equal(h.elements['prize-pool'].textContent,'100,000 CATOSHI');
 await h.elements['leaderboard-button'].dispatch('click');await new Promise(setImmediate);
 const row=h.elements['leaderboard-rows'].children[0];assert.equal(row.children.length,4);
 assert.equal(row.children[0].children[0].textContent,1);assert.equal(row.children[1].children[0].textContent,'<Cat>');
 assert.equal(row.children[2].textContent,'2,345');assert.equal(row.children[2].children[0].textContent,'2×');
 assert.equal(h.elements['board-holder']['aria-pressed'],'true');assert.match(h.elements['leaderboard-status'].className,/board-live/);
 h.setEntries([]);await h.elements['board-refresh'].dispatch('click');assert.match(h.elements['leaderboard-rows'].children[0].children[0].textContent,/No runs yet/);
 h.fail();await h.elements['board-refresh'].dispatch('click');assert.equal(h.elements['leaderboard-status'].className,'status error');
});

test('wallet-free scored runs keep private browser progress and never accept a payout address at finish',async t=>{
 let clock=Date.UTC(2026,9,2,1),rpcCalls=0;const config={...configFromEnv(),database:':memory:'};
 const app=createApp(config,{now:()=>clock,balance:async()=>{rpcCalls++;throw Error('RPC unavailable');}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;config.origin=base;
 t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
 const cookies=new Map();
 async function request(route,data,jar='first'){
  const res=await fetch(base+route,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json',origin:base}:{}),...(cookies.has(jar)?{cookie:cookies.get(jar)}:{})},body:data?JSON.stringify(data):undefined});
  if(res.headers.get('set-cookie'))cookies.set(jar,res.headers.get('set-cookie').split(';')[0]);return {status:res.status,value:await res.json()};
 }
 const initial=(await request('/api/player-status')).value;assert.equal(initial.quota.used,0);assert.equal(initial.wallet,null);assert.equal(initial.prizeEligible,false);
 const rules=(await request('/api/config')).value;assert(rules.walletOptional);
 for(const route of ['/api/entry','/api/balance'])for(const wallet of [undefined,null,'','   ']){
  const result=await request(route,{...(wallet===undefined?{}:{wallet})});assert.equal(result.status,200);assert.equal(result.value.wallet,null);assert(result.value.eligible);assert.equal(result.value.quota.used,0);
 }
 assert.equal((await request('/api/runs/start',{name:'Cat',wallet:'bad',engine:security.ENGINE_VERSION})).status,400);
 let firstResult;
 for(const [index,jar]of ['first','first','second'].entries()){
  const started=await request('/api/runs/start',{name:'Guest Cat '+index,...(index===1?{wallet:'   '}:{}) ,engine:security.ENGINE_VERSION},jar);
  assert.equal(started.status,200);const ticket=started.value;assert.equal(ticket.wallet,null);assert.equal(ticket.prizeEligible,false);
  const simulated=simulate(ticket.seed);clock+=simulated.ticks/120*1000+2000;
  const ended=await request('/api/runs/finish',{id:ticket.id,ticks:simulated.ticks,inputs:simulated.inputs,wallet:security.MINT},jar);
  assert.equal(ended.status,200);assert.equal(ended.value.run.wallet,null);assert.equal(ended.value.prizeEligible,false);assert(ended.value.best);
  assert.equal(app.db.prepare('SELECT wallet FROM runs WHERE id=?').get(ticket.id).wallet,null,'finish cannot turn a guest run into a prize entry');
  if(index===0){firstResult=ended.value;assert.equal((await request('/api/runs/finish',{id:ticket.id},'second')).status,404);}
 }
 const first=(await request('/api/player-status',undefined,'first')).value,second=(await request('/api/player-status?wallet=',undefined,'second')).value;
 assert.equal(first.quota.used,2);assert.equal(second.quota.used,1);assert.equal(first.history.length,2);assert.equal(second.history.length,1);
 assert(first.history.every(run=>run.name!=='Guest Cat 2'));assert(second.history.every(run=>run.name==='Guest Cat 2'));
 const board=(await request('/api/leaderboard')).value;assert.equal(board.entries.length,2,'only the best guest run per browser is shown');
 assert(board.entries.every(run=>run.wallet===null&&!Object.hasOwn(run,'session')));assert.equal(rpcCalls,0);
 assert.equal((await request('/api/runs/finish',{id:firstResult.run.id})).value.duplicate,true);
 clock=roundWindow(currentRound(clock)).end+1;const reset=(await request('/api/player-status')).value;
 assert.equal(reset.quota.used,0);assert.equal(reset.quest.collected,0);assert.equal(reset.best,null);
});

test('guest daily quest is isolated, reviewable and excluded from token payout plans',async()=>{
 const db=openDatabase(':memory:');const {dailyQuest,syncHolderScores}=require('./quest.cjs');
 const {disqualify}=require('./admin.cjs'),{ensureRound,makeTop10Plan}=require('./rewards.cjs');
 const config=configFromEnv({VAULT_WALLET:'11111111111111111111111111111111',REWARDS_ENABLED:'true',CATOSHI_PRIZE_POOL:'100000'});
 try{
  ensureRound(db,5,config,ROUND_MS);
  const insert=db.prepare("INSERT INTO runs(id,session,seed,name,wallet,mode,round,started,expires,engine,score,raw_score,red_tokens,submitted)VALUES(?,?,1,'Cat',?,'holder',5,0,100000,?,?,?, ?,1)");
  insert.run('guest-best','one',null,security.ENGINE_VERSION,3000,3000,5);
  insert.run('guest-next','one',null,security.ENGINE_VERSION,2000,2000,5);
  insert.run('other','two',null,security.ENGINE_VERSION,500,500,5);
  insert.run('wallet','three',security.MINT,security.ENGINE_VERSION,1000,1000,0);
  assert(syncHolderScores(db,null,5,'one').unlocked);assert.equal(dailyQuest(db,null,5,'two').collected,5);
  assert.equal(dailyQuest(db,security.MINT,5).collected,0);assert.equal(db.prepare("SELECT score FROM runs WHERE id='guest-best'").get().score,6000);
  assert.throws(()=>dailyQuest(db,null,5),/browser session/,'a missing identity must never merge all guests');
  disqualify(db,'guest-next','Invalidated collected tokens');assert.equal(db.prepare("SELECT score FROM runs WHERE id='guest-best'").get().score,3000);
  const plan=await makeTop10Plan(db,5,config,{now:()=>6*ROUND_MS+GRACE_MS+1,balance:async()=>({raw:1000000n,decimals:0})});
  const payments=db.prepare('SELECT wallet,run_id FROM reward_payments').all();assert.equal(payments.length,1);assert.equal(payments[0].wallet,security.MINT);assert.equal(payments[0].run_id,'wallet');assert(plan);
 }finally{db.close();}
});

test('supplemental artwork failure preserves playable core assets',async()=>{
  const {loadAssets,assets}=require('./renderer.js');
  class Image {
    set src(value){queueMicrotask(()=>value===assets.extras||value===assets.details?this.onerror():this.onload());}
  }
  const images=await loadAssets(Image);
  assert(images.characters&&images.layers&&images.scenery);
  assert.equal(images.extras,null);assert.equal(images.details,null);
  class BrokenCore extends Image {
    set src(value){queueMicrotask(()=>value===assets.characters?this.onerror():this.onload());}
  }
  await assert.rejects(loadAssets(BrokenCore),/Artwork could not load: characters/);
});

test('background and decoration rendering leave checked gameplay unchanged',()=>{
  const {Renderer,assets}=require('./renderer.js');
  const gradient={addColorStop(){}};
  const context=new Proxy({canvas:{width:600,height:960},createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get(target,key){return key in target?target[key]:()=>{};}});
  const images=Object.fromEntries(Object.keys(assets).map(key=>[key,{width:2000,height:1200}]));
  const a=new Run(77),b=new Run(77),renderer=new Renderer(context,images);
  for(let tick=0;tick<1200&&!a.dead;tick++){
    if(tick===340){a.press();b.press();}if(tick===355){a.release();b.release();}
    a.step(1/120);b.step(1/120);
    if(tick%4===0){renderer.update(a,1/30);renderer.draw(a);}
    assert.deepEqual(a.drainEvents(),b.drainEvents());
  }
  assert.deepEqual(a.player,b.player);assert.deepEqual(a.items,b.items);
  assert.equal(a.score,b.score);assert.equal(a.reason,b.reason);
});
