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
  const chase=new Run(5);chase.terrain=()=>200;chase.derivative=()=>0;chase.slope=()=>0;chase.player.y=200;chase.player.speed=90;chase.player.boost=0;chase.items=[];
  advance(chase,130);assert(chase.dog.active);chase.player.speed=500;advance(chase,180);assert(!chase.dead);assert(!chase.dog.active);
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
      assert(Math.abs(a.derivative(x))<1.55,'readable slopes, no random cliffs');
      assert(Math.abs(a.derivative(x+.01)-a.derivative(x-.01))<.001,'smooth terrain seams');
    }
    biggest=Math.max(biggest,high-low);
  }
  assert.equal(modes.size,5);assert(openings.size>75);assert(biggest>800,'occasional genuinely big dunes and valleys');
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
  assert.equal(ROUND_MS,86400000);
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
test('HTTP practice/holder flow, login replay rejection, checked leaderboard, sharing and static isolation',async t=>{
  let clock=Date.UTC(2026,9,1,1);const keys=crypto.generateKeyPairSync('ed25519');
  const wallet=encode58(keys.publicKey.export({type:'spki',format:'der'}).subarray(-32));
  const config={...configFromEnv(),database:':memory:'};
  const app=createApp(config,{now:()=>clock,balance:async()=>({raw:100000000000n,decimals:6,whole:'100000',eligible:true})});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.server.address().port;config.origin=base;let cookie='';
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
  async function request(route,data,origin=base,customCookie=cookie){
    const res=await fetch(base+route,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json',origin}:{}),...(customCookie?{cookie:customCookie}:{})},body:data?JSON.stringify(data):undefined});
    if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
    return {res,value:res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text()};
  }
  assert.equal((await request('/health')).res.status,200);
  const rules=(await request('/api/config')).value;assert.equal(rules.minimumTokens,50000);assert(!rules.prizesEnabled);assert(!rules.paidModeEnabled);
  assert.equal((await request('/api/runs/start',{mode:'practice',engine:security.ENGINE_VERSION},'https://evil.invalid')).res.status,403);
  assert.equal((await request('/api/runs/start',{mode:'holder',engine:security.ENGINE_VERSION})).res.status,401);
  const ticket=(await request('/api/runs/start',{name:'Cat Runner',mode:'practice',engine:security.ENGINE_VERSION})).value;assert(ticket.id&&ticket.seed);
  const simulation=simulate(ticket.seed);clock+=simulation.ticks/120*1000+2000;
  const result=await request('/api/runs/finish',{id:ticket.id,ticks:simulation.ticks,inputs:simulation.inputs,score:999999999});
  assert.equal(result.res.status,200);assert.equal(result.value.run.score,Math.floor(simulation.run.score));assert.equal(result.value.rank,1);
  assert((await request('/api/runs/finish',{id:ticket.id})).value.duplicate);
  const board=(await request('/api/leaderboard?mode=practice')).value;assert.equal(board.entries[0].name,'Cat Runner');assert(!Object.hasOwn(board.entries[0],'session'));
  assert.match((await request('/score/'+ticket.id)).value,/og:title/);
  for(const file of ['server.cjs','.env','security.cjs','test.cjs','data/catoshi.sqlite'])assert.equal((await request('/'+file)).res.status,404);
  for(const file of ['engine.js','online.js','sound.js','audio-config.js','catoshi-coin.png'])assert.equal((await request('/'+file)).res.status,200);
  const range=await fetch(base+'/music.mp3',{headers:{Range:'bytes=0-31'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-length'),'32');assert.equal((await range.arrayBuffer()).byteLength,32);
  const badRange=await fetch(base+'/music.mp3',{headers:{Range:'bytes=999999999999-'}});assert.equal(badRange.status,416);await badRange.arrayBuffer();
  const challenge=(await request('/api/auth/challenge',{wallet})).value;
  const signature=crypto.sign(null,Buffer.from(challenge.message),keys.privateKey).toString('base64');
  assert.equal((await request('/api/auth/verify',{id:challenge.id,signature})).res.status,200);
  assert.equal((await request('/api/auth/verify',{id:challenge.id,signature})).res.status,401);
  const holder=(await request('/api/runs/start',{name:'Holder',mode:'holder',engine:security.ENGINE_VERSION})).value;assert.equal(holder.mode,'holder');
  const holderRun=simulate(holder.seed);clock+=holderRun.ticks/120*1000+2000;
  assert.equal((await request('/api/runs/finish',{id:holder.id,ticks:holderRun.ticks,inputs:holderRun.inputs})).res.status,200);
  const holders=(await request('/api/leaderboard?mode=holder')).value;assert.equal(holders.entries[0].name,'Holder');assert.notEqual(holders.entries[0].wallet,wallet);
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
  appendChild(){}focus(){}setPointerCapture(){}setAttribute(){}
}
test('practice button, touch/keyboard, pause/resume, failed wallet lookup and vault burst UI wiring',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  const document=new Element('document'),window=new Element('window');document.getElementById=id=>{assert(elements[id],id);return elements[id];};
  document.querySelectorAll=()=>['gate','game-screen','result'].map(id=>elements[id]);document.createElement=tag=>new Element(tag);
  elements.game.getContext=()=>({fillRect(){}});let now=0,frame=null,createdRun,bursts=0,sounds=0;
  window.RushOnline={prepare:async()=>null,balance:async()=>{throw Error('offline');},submit:async()=>null,share(){}};
  window.RushSound={unlock(){},setPlaying(){},effect(){sounds++;},burst(){bursts++;}};
  const context={document,window,console,setTimeout,clearTimeout,performance:{now:()=>now},VaultRush:{Run:class extends Run{constructor(seed){super(seed);createdRun=this;}}},VaultRushRenderer:{loadAssets:async()=>({}),Renderer:class{reset(){}draw(){}update(){}handle(){}breakout(){}}},requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>{frame=null;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'game.js'),'utf8'),context);
  await elements['practice-button'].dispatch('click');assert(createdRun);
  const frames=count=>{for(let i=0;i<count;i++){now+=1000/60;const cb=frame;frame=null;cb?.(now);}};
  frames(20);assert.equal(createdRun.time,0,'no hidden simulation during vault animation');assert.equal(bursts,0);
  frames(100);assert.equal(bursts,1);
  await elements['jump-control'].dispatch('pointerdown',{pointerId:1,pointerType:'touch'});assert(createdRun.player.held&&!createdRun.player.grounded);assert(sounds>0);
  await elements['jump-control'].dispatch('pointerup',{pointerId:1,pointerType:'touch'});assert(!createdRun.player.held);
  const before=createdRun.time;await elements.pause.dispatch('click');frames(100);assert.equal(createdRun.time,before);
  await elements.resume.dispatch('click');frames(10);assert(createdRun.time>before);
  await window.dispatch('keydown',{code:'Space'});assert(createdRun.player.held);await window.dispatch('keyup',{code:'Space'});assert(!createdRun.player.held);
  await elements['pause-menu'].dispatch('click');elements.wallet.value=security.MINT;await elements['wallet-form'].dispatch('submit');assert.match(elements['wallet-status'].textContent,/unavailable/);
  await elements['practice-button'].dispatch('click');assert(frame);
});
test('audio preference and lack of AudioContext cannot block play',async()=>{
  const button=new Element('sound-toggle'),document=new Element('document'),window=new Element('window');document.getElementById=()=>button;
  const storage=new Map();vm.runInNewContext(fs.readFileSync(path.join(__dirname,'sound.js'),'utf8'),{document,window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Math,Audio:class{}});
  assert.equal(button.textContent,'SOUND ON');window.RushSound.unlock();window.RushSound.setPlaying(true);window.RushSound.effect({type:'coin'});
  await button.dispatch('click');assert.equal(button.textContent,'SOUND OFF');assert.equal(storage.get('rush-muted'),'1');
  await button.dispatch('click');assert.equal(button.textContent,'SOUND ON');window.RushSound.burst();
});
