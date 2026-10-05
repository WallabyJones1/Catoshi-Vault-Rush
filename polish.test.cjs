'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const engine=require('./engine.js');
const {Run,Trial,TRIAL_COURSES,VERSION}=engine;
const {replay,MAX_TICKS}=require('./security.cjs');
const {checkReplay}=require('./replay-worker.cjs');
const {createApp,configFromEnv}=require('./server.cjs');
const WALLET='11111111111111111111111111111111';

function ride(level,active=true){
  const run=new Trial(level),inputs=[];let ticks=0,maxAir=0;
  while(!run.dead&&ticks<MAX_TICKS){
    const p=run.player;
    if(active&&p.grounded){
      const gap=run.gaps.find(g=>g.x>p.x&&g.x-p.x<p.speed*.16);
      const nearGap=run.gaps.some(g=>g.x>p.x&&g.x-p.x<700);
      const boost=active!=='safe'&&!nearGap&&run.items.find(i=>i.aerial&&!i.hit&&i.x>p.x&&i.x-p.x<p.speed*.45);
      const ramp=run.ramps.find(r=>r.end>p.x&&r.end-p.x<p.speed*.12);
      if(gap||boost||ramp){inputs.push([ticks,1],[ticks,0]);run.press();run.release();}
    }
    run.step(1/120);run.drainEvents();ticks++;
    maxAir=Math.max(maxAir,run.terrain(p.x)-p.y);
    assert(!run.dog.active,'no pursuing hound in trials');
    assert.equal(run.lives,3,'only a missed gap ends a trial, no damage obstacles');
  }
  return {run,ticks,inputs,maxAir};
}
const completed=new Map(TRIAL_COURSES.map(c=>{
  const lines=[ride(c.id),ride(c.id,'safe')].filter(r=>r.run.finished).sort((a,b)=>a.run.finishTime-b.run.finishTime);
  return [c.id,lines[0]||ride(c.id)];
}));

test('five fixed courses have reachable gaps, boosts and large jumps; all complete and replay exactly',async()=>{
  assert.equal(TRIAL_COURSES.length,5);
  let previousLength=0,previousTime=0;
  for(const course of TRIAL_COURSES){
    const a=new Trial(course.id),b=new Trial(course.id),recording=completed.get(course.id);
    assert(course.distance>previousLength);previousLength=course.distance;
    assert(!('gold'in course)&&!('silver'in course)&&!('bronze'in course));
    assert(a.gaps.length>0&&a.items.every(item=>item.type==='boost'));
    assert.equal(a.rails.length,0);assert.equal(a.encounters.length,0);
    assert.deepEqual(a.items,b.items);assert.deepEqual(a.ramps,b.ramps);assert.deepEqual(a.gaps,b.gaps);
    assert(recording.run.finished,'finishable course '+course.id);
    assert(recording.run.finishTime>previousTime);previousTime=recording.run.finishTime;
    assert(recording.maxAir>125);assert(recording.inputs.length>0);
    const checked=replay(999,recording.ticks,recording.inputs,course.id);
    assert.equal(checked.timeMs,Math.round(recording.run.finishTime*1000));
    assert.equal(checked.boosts,recording.run.boostsCollected);
    assert.deepEqual(await checkReplay(1,recording.ticks,recording.inputs,course.id),checked,'worker uses course ticket, never random seed');
    const repeated=replay(999,recording.ticks,recording.inputs,course.id);
    assert.deepEqual(repeated,checked,'the chosen route stays deterministic');
    assert.throws(()=>replay(0,recording.ticks+1,recording.inputs,course.id),/continues/);
    assert.throws(()=>replay(0,1,[],course.id),/completed/);
  }
  for(const level of [1,2,3,4,5]){
    const missed=ride(level,false);assert.equal(missed.run.reason,'MISSED THE GAP');
    assert.throws(()=>replay(0,missed.ticks,missed.inputs,level),/finish line/);
  }
  assert.throws(()=>new Trial(0),/1 to 5/);assert.throws(()=>new Trial('1'),/1 to 5/);
  assert.throws(()=>replay(0,1,[],6),/course/);
});

test('a single atmosphere stays fixed throughout a run, with seed variety and no render-dependent generation',()=>{
  const themes=new Set();
  for(let seed=1;seed<=32;seed++){
    const a=new Run(seed),b=new Run(seed);themes.add(a.theme);
    for(let x=0;x<140000;x+=3100){
      assert.deepEqual(a.biomeTransition(x),{from:a.theme,to:a.theme,mix:0});
      assert.equal(a.biome(x),a.theme);
    }
    a.generate(40000);b.generate(40000);
    assert.deepEqual(a.items,b.items);assert.deepEqual(a.encounters,b.encounters);
    assert(a.items.some(item=>item.type==='cargo'),'cargo appears in a long run');
  }
  assert.equal(themes.size,4);
});

test('parachute warning is intangible, only the descending box hurts, and one crate takes at most one life',()=>{
  const run=new Run(10);run.items=[];run.nextFeature=run.nextScenery=Infinity;
  const item=run.addCargo(800,5),floor=run.terrain(item.x);
  run.player.x=200;run.player.y=run.terrain(200);
  run.updateCargo();assert.equal(item.drop.at,0);assert(run.drainEvents().some(e=>e.type==='cargo-warning'));
  Object.assign(run.player,{x:item.x,y:item.y});
  assert(!run.touchesObstacle(item),'warning is not a collider');
  run.time=item.drop.warning+item.drop.duration*.55;run.updateCargo();
  assert(item.y<floor-100&&item.y>floor-980);
  Object.assign(run.player,{x:item.x,y:item.y-140});assert(!run.touchesObstacle(item),'ropes cannot hurt');
  run.player.y=item.y;assert(run.touchesObstacle(item));
  run.stumble(item);assert.equal(run.lives,2);assert(!run.dead);assert(run.player.recovery>0);
  run.stumble(item);assert.equal(run.lives,2);assert(!run.touchesObstacle(item));
  const event=run.drainEvents().find(e=>e.type==='stumble');assert.equal(event.material,'wood');assert.equal(event.kind,'cargo');
  const landed=run.addCargo(1100,6);landed.drop.at=0;run.time=10;run.updateCargo();
  assert.equal(landed.y,run.terrain(landed.x));assert(landed.drop.landed);
  assert.equal(run.drainEvents().filter(e=>e.type==='cargo-land').length,1);
  run.updateCargo();assert.equal(run.drainEvents().filter(e=>e.type==='cargo-land').length,0);
  Object.assign(run.player,{x:landed.x,y:landed.y,rush:7,invulnerable:7});run.stumble(landed);assert.equal(run.lives,2,'RUSH protects from cargo');
});

test('soft sand creates a recoverable hound chase with a clear escape, not an unavoidable death',()=>{
  for(const active of [false,true]){
    const run=new Run(3);run.items=[];run.ramps=[];run.rails=[];run.gaps=[];run.encounters=[];run.nextFeature=run.nextScenery=Infinity;
    const stretch=run.pressureStretch(9000,4);assert(stretch);
    assert(run.items.some(item=>item.escape&&item.x>stretch.sandEnd));
    Object.assign(run.player,{x:stretch.flatStart,y:run.terrain(stretch.flatStart),speed:430,vx:430,boost:0});
    let warned=false,nearest=Infinity;
    for(let tick=0;tick<8000&&!run.dead&&run.player.x<stretch.end+500;tick++){
      if(run.dog.warning)warned=true;
      if(active&&warned&&run.player.grounded){run.press();run.release();}
      run.step(1/120);run.drainEvents();
      if(run.dog.active)nearest=Math.min(nearest,run.dog.distance);
    }
    assert(warned);
    if(active){assert(!run.dead&&run.player.x>stretch.end);assert(nearest<150&&nearest>24,'tense but escapable');}
    else assert.equal(run.reason,'THE HOUND CAUGHT UP');
  }
});

async function harness(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rush-trials-'));
  const config={...configFromEnv({}),database:path.join(dir,'game.sqlite')};
  const h={clock:Date.UTC(2026,9,5),cookies:new Map()};
  async function launch(){
    h.app=createApp(config,{now:()=>h.clock,balance:async()=>{throw Error('Trials must never check holdings.');}});
    await new Promise(resolve=>h.app.server.listen(0,'127.0.0.1',resolve));h.base='http://127.0.0.1:'+h.app.server.address().port;config.origin=h.base;
  }
  await launch();
  h.request=async(route,data,jar='main',origin=h.base)=>{
    const cookie=h.cookies.get(jar),response=await fetch(h.base+route,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json',origin}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});
    const set=response.headers.get('set-cookie');if(set)h.cookies.set(jar,set.split(';')[0]);
    return {status:response.status,value:await response.json()};
  };
  h.start=(level,name='Speed Cat',wallet=null,jar='main')=>h.request('/api/trials/start',{level,name,wallet,engine:VERSION},jar);
  h.finish=async(ticket,jar='main',extra={})=>{
    const recording=completed.get(ticket.level);h.clock+=Math.ceil(recording.ticks/120*1000)+2000;
    return h.request('/api/trials/finish',{id:ticket.id,ticks:recording.ticks,inputs:recording.inputs,...extra},jar);
  };
  h.restart=async()=>{await new Promise(resolve=>h.app.server.close(resolve));h.app.db.close();await launch();};
  t.after(async()=>{await new Promise(resolve=>h.app.server.close(resolve));h.app.db.close();fs.rmSync(dir,{recursive:true,force:true});});
  return h;
}

test('public track boards store checked finishes per player/course, reject forged times and stay separate from weekly rewards',async t=>{
  const h=await harness(t);
  for(const level of [0,6,'1',1.5])assert.equal((await h.start(level)).status,400);
  assert.equal((await h.start(1,'<script>')).status,400);
  assert.equal((await h.start(1,'Speed Cat','invalid')).status,400);
  assert.equal((await h.request('/api/trials/start',{level:1,name:'Cat',engine:'old'})).status,409);
  assert.equal((await h.request('/api/trials/start',{level:1,name:'Cat',engine:VERSION},'main','https://evil.invalid')).status,403);
  const ticket=(await h.start(1)).value,recording=completed.get(1);
  assert.equal(ticket.wallet,null);
  assert.equal((await h.request('/api/trials/finish',{id:ticket.id,ticks:recording.ticks,inputs:recording.inputs})).status,400,'too early for claimed recording');
  assert.equal((await h.finish(ticket,'other')).status,404,'ticket belongs to the browser that started it');
  const finish=await h.finish(ticket,'main',{timeMs:1,boosts:99999,score:99999,level:5,wallet:WALLET});
  assert.equal(finish.status,200);assert.equal(finish.value.run.timeMs,Math.round(recording.run.finishTime*1000));
  assert.equal(finish.value.run.level,1);assert.equal(finish.value.run.wallet,null);assert.equal(finish.value.run.boosts,recording.run.boostsCollected);
  assert.equal(finish.value.rank,1);
  assert((await h.finish(ticket)).value.duplicate);
  const again=(await h.start(1,'Renamed Cat')).value;await h.finish(again);
  const publicBoard=(await h.request('/api/trials/leaderboard?level=1',null,'public')).value;
  assert.equal(publicBoard.entries.length,1);assert.equal(publicBoard.entries[0].name,'Speed Cat','tie keeps first finish and its name');
  assert(!/session|inputs|expires/.test(JSON.stringify(publicBoard)));assert(!JSON.stringify(publicBoard).includes(h.cookies.get('main')));
  assert.equal((await h.request('/api/trials/leaderboard?level=5')).value.entries.length,0);
  const other=(await h.start(1,'Another Cat',null,'other')).value;await h.finish(other,'other');
  assert.equal((await h.request('/api/trials/leaderboard?level=1')).value.entries.length,2,'guests are separate even without a wallet');
  const holder=(await h.start(2,'Wallet Cat',WALLET)).value;await h.finish(holder);
  const second=(await h.start(2,'Wallet Cat II',WALLET,'other')).value;await h.finish(second,'other');
  const walletBoard=(await h.request('/api/trials/leaderboard?level=2')).value;
  assert.equal(walletBoard.entries.length,1);assert.equal(walletBoard.entries[0].wallet,'1111…1111');
  assert.equal((await h.request('/api/leaderboard')).value.entries.length,0);
  assert.equal(h.app.db.prepare('SELECT COUNT(*) n FROM runs').get().n,0);
  assert.equal(h.app.db.prepare('SELECT COUNT(*) n FROM holder_attempts').get().n,0);
  await h.restart();assert.equal((await h.request('/api/trials/leaderboard?level=1')).value.entries.length,2,'times survive a server restart');
  assert.equal((await h.request('/api/trials/leaderboard?level=invalid')).status,400);
  const best=(await h.start(1)).value.best;assert.equal(best.id,ticket.id);
});

test('unfinished, expired, old-engine and mismatched-course recordings never enter a trial board',async t=>{
  const h=await harness(t);
  const ticket=(await h.start(1)).value,fall=ride(1,false);h.clock+=60000;
  let response=await h.request('/api/trials/finish',{id:ticket.id,ticks:fall.ticks,inputs:fall.inputs});
  assert.equal(response.status,400);assert.match(response.value.error,/finish line/);
  const early=await h.request('/api/trials/finish',{id:ticket.id,ticks:1,inputs:[]});assert.equal(early.status,400);
  const mismatch=(await h.start(5)).value;
  const levelOne=completed.get(1);h.clock+=20000;
  response=await h.request('/api/trials/finish',{id:mismatch.id,ticks:levelOne.ticks,inputs:levelOne.inputs,level:1});assert.equal(response.status,400);
  const old=(await h.start(1)).value;h.app.db.prepare('UPDATE trial_runs SET engine=? WHERE id=?').run('old',old.id);
  assert.equal((await h.finish(old)).status,409);
  h.clock+=1200001;assert.equal((await h.finish(ticket)).status,410);
  assert.equal((await h.request('/api/trials/leaderboard?level=1')).value.entries.length,0);
});

test('simultaneous retries save one trial finish and fastest-first ranking retains only the best time',async t=>{
  const h=await harness(t),ticket=(await h.start(2)).value,recording=completed.get(2);h.clock+=60000;
  const payload={id:ticket.id,ticks:recording.ticks,inputs:recording.inputs};
  const results=await Promise.all([h.request('/api/trials/finish',payload),h.request('/api/trials/finish',payload)]);
  assert(results.every(r=>r.status===200));assert.equal(results.filter(r=>r.value.duplicate).length,1);
  const slow=(await h.start(2,'Slow Cat',null,'slow')).value,coast=[ride(2),ride(2,'safe')].sort((a,b)=>b.run.finishTime-a.run.finishTime)[0];h.clock+=60000;
  assert(coast.run.finished);
  assert(coast.run.finishTime>recording.run.finishTime);
  assert.equal((await h.request('/api/trials/finish',{id:slow.id,ticks:coast.ticks,inputs:coast.inputs},'slow')).status,200);
  let board=(await h.request('/api/trials/leaderboard?level=2')).value;
  assert.equal(board.entries[0].id,ticket.id);assert.equal(board.entries[1].id,slow.id);
  const faster=(await h.start(2,'Faster Cat',null,'slow')).value;await h.finish(faster,'slow');
  board=(await h.request('/api/trials/leaderboard?level=2')).value;
  assert.equal(board.entries.length,2);assert.equal(board.entries[1].id,faster.id);
  h.app.db.prepare('UPDATE trial_runs SET disqualified=? WHERE id=?').run('reviewed',faster.id);
  assert.equal((await h.request('/api/trials/leaderboard?level=2')).value.entries[1].id,slow.id);
});

test('public ghost is the fastest current verified finish; no raw inputs, wallet or session escape',async t=>{
  const h=await harness(t);
  assert.equal((await h.request('/api/trials/ghost?level=0')).status,400);
  assert.equal((await h.request('/api/trials/ghost?level=1')).value.ghost,null);
  const ticket=(await h.start(1,'Ghost Cat',WALLET)).value;
  const finish=await h.finish(ticket,'main',{ghost:[[0,999,999,0,0]],trajectory:[],timeMs:1});
  assert.equal(finish.status,200);assert(!('trajectory'in finish.value.run));
  const response=(await h.request('/api/trials/ghost?level=1',null,'public')).value;
  assert.equal(response.engine,VERSION);assert.equal(response.level,1);assert.equal(response.ghost.id,ticket.id);
  assert.equal(response.ghost.name,'Ghost Cat');assert.equal(response.ghost.timeMs,finish.value.run.timeMs);
  assert.deepEqual(response.ghost.samples,replay(0,completed.get(1).ticks,completed.get(1).inputs,1).trajectory);
  assert(!/wallet|session|inputs|expires|seed/.test(JSON.stringify(response)));
  const {Track}=require('./ghost.js');const track=new Track(response,VERSION,1);
  assert.equal(track.poseAt(0).x,0);assert.equal(track.poseAt(9999).x,TRIAL_COURSES[0].distance);
  await h.restart();assert.deepEqual((await h.request('/api/trials/ghost?level=1')).value,response);
  h.app.db.prepare('UPDATE trial_runs SET disqualified=? WHERE id=?').run('reviewed',ticket.id);
  assert.equal((await h.request('/api/trials/ghost?level=1')).value.ghost,null);
  h.app.db.prepare('UPDATE trial_runs SET disqualified=NULL,engine=? WHERE id=?').run('old-engine',ticket.id);
  assert.equal((await h.request('/api/trials/ghost?level=1')).value.ghost,null);
});

// A lightweight DOM keeps these integration tests dependency-free. It exercises
// the actual browser modules, event handlers and recorded inputs together.
class Element{
  constructor(id){this.id=id;this.hidden=true;this.value='';this.disabled=false;this.children=[];this.listeners={};this.dataset={};this.classList={toggle(){},remove(){},add(){}};}
  set textContent(value){this.text=String(value);this.children=[];}get textContent(){return this.text||'';}
  appendChild(value){this.children.push(value);}setAttribute(name,value){this[name]=value;}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
  dispatch(type,extra={}){return Promise.all((this.listeners[type]||[]).map(fn=>fn({target:this,preventDefault(){},...extra})));}
  querySelectorAll(){return this.children;}focus(){}setPointerCapture(){}
}
function dom(){
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  const document=new Element('document'),window=new Element('window');
  document.getElementById=id=>{assert(elements[id],id);return elements[id];};document.createElement=tag=>new Element(tag);
  document.querySelectorAll=()=>['gate','game-screen','result'].map(id=>elements[id]);
  const stored=new Map(),localStorage={getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)};
  return {document,window,elements,localStorage};
}
test('Speed Trial UI starts without a wallet, records jumps, posts a time, retries failures and switches back to Vault Run',async()=>{
  const d=dom(),{document,window,elements}=d;let now=0,frame=null,run,posts=0,starts=0,ghostFail=false;
  elements.game.getContext=()=>({fillRect(){}});
  window.RushOnline={prepareTrial:async level=>{starts++;return {id:'trial',level,wallet:null,maxTicks:MAX_TICKS};},prepare:async()=>({id:'vault',seed:7,wallet:null,maxTicks:MAX_TICKS}),setWallet(){},share(){},submit:async()=>null,
    loadTrialGhost:async level=>{if(ghostFail)throw Error('Ghost service offline');const recording=completed.get(level),checked=replay(0,recording.ticks,recording.inputs,level);return {engine:VERSION,level,ghost:{id:'fastest',name:'Ghost Cat',ticks:recording.ticks,timeMs:checked.timeMs,samples:checked.trajectory}};},
    submitTrial:async(ticket,ticks,inputs)=>{posts++;if(posts===1)throw Error('Temporary outage');const result=replay(0,ticks,inputs,ticket.level);return {run:{...result},rank:1,best:{timeMs:result.timeMs,rank:1}};}};
  const context={...d,console,location:{search:'?trial=1'},URLSearchParams,performance:{now:()=>now},VaultRushGhost:require('./ghost.js'),VaultRush:{...engine,Run:class extends Run{constructor(seed){super(seed);run=this;}},Trial:class extends Trial{constructor(level){super(level);run=this;}}},VaultRushRenderer:{loadAssets:async()=>({}),Renderer:class{reset(){}draw(){}update(){}handle(){}breakout(){}}},requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>{frame=null;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'game.js'),'utf8'),context);
  assert.equal(elements['mode-trial']['aria-pressed'],'true');assert.equal(elements['trial-levels'].children.length,5);
  assert(!elements['holder-name'].disabled&&!elements.wallet.disabled);
  await elements['wallet-form'].dispatch('submit');assert.equal(run.mode,'trial');assert.equal(starts,1);
  assert.match(elements['ghost-name'].textContent,/Ghost Cat/);
  const tick=()=>{now+=1000/120;const callback=frame;frame=null;callback?.(now);};
  for(let i=0;i<180;i++)tick();
  const before=run.time;await elements.pause.dispatch('click');for(let i=0;i<30;i++)tick();assert.equal(run.time,before);await elements.resume.dispatch('click');
  for(let i=0;i<3000&&!run.dead;i++){
    const p=run.player;
    if(p.grounded&&run.gaps.some(g=>g.x>p.x&&g.x-p.x<p.speed*.16)){
      await elements['jump-control'].dispatch('pointerdown',{pointerId:1,pointerType:'touch'});
      await elements['jump-control'].dispatch('pointerup',{pointerId:1,pointerType:'touch'});
    }
    tick();
  }
  assert(run.finished);for(let i=0;i<120;i++)tick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(posts,1);assert(!elements['retry-trial'].hidden);assert.match(elements['submission-status'].textContent,/Temporary outage/);
  await elements['retry-trial'].onclick();assert.equal(posts,2);assert(elements['retry-trial'].hidden);assert.match(elements['submission-status'].textContent,/#1/);
  assert.equal(elements['final-score-label'].textContent,'TIME');assert(elements['result-leaderboard'].hidden);assert(!elements['result-trial-leaderboard'].hidden);
  assert(!/GOLD|SILVER|BRONZE/.test(elements['result-reason'].textContent));
  ghostFail=true;await elements['next-trial'].dispatch('click');await new Promise(resolve=>setImmediate(resolve));assert.equal(run.trial.id,2);assert.equal(elements['ghost-name'].textContent,'Ghost unavailable');
  await elements['pause-menu'].dispatch('click');await elements['mode-vault'].dispatch('click');await elements['wallet-form'].dispatch('submit');assert.equal(run.mode,'vault');assert(!elements.lives.hidden);
});

test('public trial board handles empty results, rank/time formatting, safe names and refresh failures',async()=>{
  const d=dom(),{document,window,elements}=d;let fail=false,entries=[],lastRoute='';
  const fetcher=async route=>{lastRoute=route;if(fail)throw Error('Offline');return {ok:true,json:async()=>({engine:VERSION,entries,updatedAt:Date.UTC(2026,9,5)})};};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'online.js'),'utf8'),{...d,VaultRush:engine,location:{protocol:'file:'},fetch:fetcher,AbortController,URLSearchParams,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){}});
  window.RushOnline.openTrialBoard(3);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(lastRoute,'/api/trials/leaderboard?level=3');assert.equal(elements['trial-board-tabs'].children.length,5);
  assert.match(elements['trial-board-rows'].children[0].children[0].textContent,/first/);
  entries=[{rank:1,name:'<script>bad</script>',wallet:null,timeMs:61342}];await elements['trial-board-refresh'].dispatch('click');
  const cells=elements['trial-board-rows'].children[0].children;assert.equal(cells[1].children[0].textContent,'<script>bad</script>');assert.equal(cells[2].textContent,'01:01.342');
  fail=true;await elements['trial-board-refresh'].dispatch('click');assert.match(elements['trial-board-status'].textContent,/Offline/);
  await document.dispatch('keydown',{key:'Escape'});assert(elements['trial-board-panel'].hidden);
});
