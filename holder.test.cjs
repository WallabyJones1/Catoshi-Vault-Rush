'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const {Run}=require('./engine.js');
const {createApp,openDatabase,configFromEnv,ROUND_MS,GRACE_MS}=require('./server.cjs');
const {ENGINE_VERSION,MINT,MAX_TICKS}=require('./security.cjs');
const WALLET='11111111111111111111111111111111';
function simulate(seed){
  const run=new Run(seed);run.press();let ticks=0;
  while(!run.dead&&ticks<MAX_TICKS){run.step(1/120);run.drainEvents();ticks++;}
  return {ticks,inputs:[[0,1]],score:Math.floor(run.score)};
}
async function harness(t,{durable=false,balance}={}){
  const directory=durable?fs.mkdtempSync(path.join(os.tmpdir(),'catoshi-daily-')):null;
  const config={...configFromEnv({}),database:directory?path.join(directory,'game.sqlite'):':memory:'};
  const h={clock:Date.UTC(2026,9,1,1),cookies:new Map(),config};
  const options={now:()=>h.clock,balance:balance|| (async()=>({raw:50000000000n,decimals:6,whole:'50000',eligible:true}))};
  async function launch(){
    h.app=createApp(config,options);await new Promise(resolve=>h.app.server.listen(0,'127.0.0.1',resolve));
    h.base='http://127.0.0.1:'+h.app.server.address().port;config.origin=h.base;
  }
  await launch();
  h.request=async(route,data,jar='main')=>{
    const cookie=h.cookies.get(jar);
    const response=await fetch(h.base+route,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json',origin:h.base}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.get('set-cookie'))h.cookies.set(jar,response.headers.get('set-cookie').split(';')[0]);
    return {status:response.status,value:await response.json()};
  };
  h.start=(mode='holder',wallet=WALLET,name='Holder',jar='main')=>h.request('/api/runs/start',{engine:ENGINE_VERSION,mode,wallet,name},jar);
  h.finish=async(ticket,jar='main')=>{
    const simulated=simulate(ticket.seed);h.clock+=simulated.ticks/120*1000+2000;
    const result=await h.request('/api/runs/finish',{id:ticket.id,ticks:simulated.ticks,inputs:simulated.inputs,score:999999999},jar);
    assert.equal(result.status,200);assert.equal(result.value.run.score,simulated.score);
    return result.value;
  };
  h.restart=async()=>{await new Promise(resolve=>h.app.server.close(resolve));h.app.db.close();await launch();};
  t.after(async()=>{await new Promise(resolve=>h.app.server.close(resolve));h.app.db.close();if(directory)fs.rmSync(directory,{recursive:true,force:true});});
  return h;
}

test('free wallet entry has no daily or hourly quota, survives restarts and resets only progress at UTC midnight',async t=>{
  let calls=0;const h=await harness(t,{durable:true,balance:async()=>{calls++;throw Error('RPC offline');}});
  const rules=(await h.request('/api/config')).value;assert.equal(rules.holderDailyRuns,null);assert.equal(rules.minimumTokens,0);assert(rules.unlimitedPlays);assert(!('shareBonus' in rules));
  for(let i=0;i<151;i++){
    h.clock+=2000;
    const result=await h.start('holder',WALLET,'Free Cat '+i);
    assert.equal(result.status,200,'start '+(i+1));assert.equal(result.value.quota.used,i+1);assert.equal(result.value.quota.remaining,null);assert(result.value.quota.unlimited);
  }
  const status=(await h.request('/api/player-status?wallet='+WALLET)).value;assert(status.eligible);assert.equal(status.quota.used,151);assert.equal(status.history.length,10,'recent history is a window, not a run cap');
  await h.restart();assert.equal((await h.start()).status,200,'existing counters do not restrict a fresh session');
  assert.equal((await h.request('/api/player-status?wallet='+WALLET)).value.quota.used,152);assert.equal(calls,0,'no token RPC for entry');
  const oldRound=Math.floor(h.clock/ROUND_MS);h.clock=(oldRound+1)*ROUND_MS+1;
  const next=await h.start();assert.equal(next.status,200);assert.equal(next.value.quota.used,1);assert.equal(next.value.quota.remaining,null);
  assert.equal(next.value.quota.resetsAt,(oldRound+2)*ROUND_MS);
});

test('concurrent free starts accept zero holdings and unavailable RPCs; addresses still validate',async t=>{
  let calls=0;const h=await harness(t,{balance:async()=>{calls++;throw Error('RPC unavailable');}});
  assert.equal((await h.start('holder','invalid','Bad address','bad')).status,400);
  assert.equal((await h.start('holder',MINT,'No holdings','low')).status,200);
  await h.request('/api/player-status?wallet='+WALLET);
  const results=await Promise.all(Array.from({length:12},(_,i)=>h.start('holder',WALLET,'Run '+i)));
  assert.equal(results.filter(result=>result.status===200).length,12);
  assert.equal(h.app.db.prepare('SELECT used FROM holder_attempts WHERE wallet=?').get(WALLET).used,12);
  assert.equal(h.app.db.prepare('SELECT COUNT(*) count FROM runs WHERE wallet=?').get(WALLET).count,12);assert.equal(calls,0);
  assert.equal((await h.request('/api/entry',{wallet:'invalid'})).status,400);
});

test('existing SQLite data migrates without losing scores or available attempt counts',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'catoshi-migrate-')),file=path.join(directory,'game.sqlite');
  try{
    const old=new DatabaseSync(file);
    old.exec('CREATE TABLE runs(id TEXT PRIMARY KEY,session TEXT,seed INTEGER,name TEXT,wallet TEXT,mode TEXT,round INTEGER,started INTEGER,expires INTEGER,engine TEXT,ticks INTEGER,score INTEGER,distance INTEGER,coins INTEGER,reason TEXT,submitted INTEGER,inputs TEXT,disqualified TEXT)');
    const insert=old.prepare('INSERT INTO runs(id,session,seed,name,wallet,mode,round,started,expires,engine,score,submitted)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
    for(let i=0;i<3;i++)insert.run('old-'+i,'session',1,'Old Holder',WALLET,'holder',5,100,10000,'flow-web-4',i===0?500:null,i===0?200:null);
    old.close();
    const migrated=openDatabase(file);assert.equal(migrated.prepare('SELECT score FROM runs WHERE id=?').get('old-0').score,500);
    assert.equal(migrated.prepare('SELECT used FROM holder_attempts').get().used,3);migrated.exec('DELETE FROM runs WHERE submitted IS NULL');migrated.close();
    const reopened=openDatabase(file);assert.equal(reopened.prepare('SELECT used FROM holder_attempts').get().used,3);reopened.close();
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('leaderboard publishes one best completed run per holder wallet, preserving that run’s name',async t=>{
  const h=await harness(t,{});const results=[];
  for(const name of ['First Cat','Second Cat','Third Cat']){const start=await h.start('holder',WALLET,name);results.push(await h.finish(start.value));}
  await h.start('holder',WALLET,'Unfinished');
  const ranked=(await h.request('/api/leaderboard?mode=holder')).value.entries;
  const best=results.slice().sort((a,b)=>b.run.score-a.run.score||a.run.submitted-b.run.submitted||a.run.id.localeCompare(b.run.id))[0];
  assert.equal(ranked.length,1);assert.equal(ranked[0].id,best.run.id);assert.equal(ranked[0].name,best.run.name);
  assert(!('shareMultiplier' in ranked[0]));
  assert.equal((await h.request('/api/holder-status?wallet='+WALLET)).value.quota.remaining,null);
});


test('completed native red pickups accumulate once across ten runs, unlock the best score and reset with daily history',async t=>{
 const h=await harness(t,{durable:true});
 const inputs=[[685,1],[685,0],[1629,1],[1629,0],[1890,1],[1890,0],[2754,1],[2754,0],[2901,1],[2901,0],[3119,1],[3119,0],[3448,1],[3448,0],[4017,1],[4017,0]];
 const run=new Run(1);let ticks=0,cursor=0;
 while(!run.dead&&ticks<MAX_TICKS){while(cursor<inputs.length&&inputs[cursor][0]===ticks){inputs[cursor++][1]?run.press():run.release();}run.step(1/120);run.drainEvents();ticks++;}
 assert.equal(run.redTokens,1);assert.equal(run.rushPickups,1);assert(run.dead);const rawScore=Math.floor(run.score),results=[];
 for(let i=0;i<10;i++){
  const start=(await h.start('holder',WALLET,'Quest Cat '+i)).value;
  h.app.db.prepare('UPDATE runs SET seed=1 WHERE id=?').run(start.id);
  h.clock+=ticks/120*1000+2000;
  const request={id:start.id,ticks,inputs,score:99999999,redTokens:5,rushPickups:999,pointsMultiplier:99};
  const response=await h.request('/api/runs/finish',request);assert.equal(response.status,200);const value=response.value;results.push(value);
  assert.equal(value.run.rawScore,rawScore);assert.equal(value.run.redTokens,1);assert.equal(value.run.rushPickups,1);
  assert.equal(value.quest.collected,i+1);assert.equal(value.quest.unlocked,i===9);
  const repeat=(await h.request('/api/runs/finish',request)).value;assert(repeat.duplicate);assert.equal(repeat.quest.collected,i+1,'duplicate finish cannot add tokens');
 }
 const status=(await h.request('/api/holder-status?wallet='+WALLET)).value;
 assert.equal(status.best.id,results[0].run.id);assert.equal(status.best.score,rawScore*2);assert.equal(status.best.pointsMultiplier,2);
 assert.equal(status.history.length,10);assert.equal(status.quota.remaining,null);assert.equal(status.quest.collected,10);
 assert.equal(status.history.filter(r=>r.pointsMultiplier===2).length,1);assert(status.history.every(r=>r.status==='completed'));
 assert(!JSON.stringify(status).includes('inputs'),'history never exposes recordings');
 await h.restart();assert.equal((await h.request('/api/holder-status?wallet='+WALLET)).value.quest.collected,10);
 h.clock=(Math.floor(h.clock/ROUND_MS)+1)*ROUND_MS+1;
 const reset=(await h.request('/api/holder-status?wallet='+WALLET)).value;assert.equal(reset.quest.collected,0);assert.equal(reset.quota.remaining,null);assert.equal(reset.history.length,0);assert.equal(reset.best,null);
});

test('daily progress loads without spending a run and renders history, quest and best-score badges as text',async()=>{
 const elements=new Map();
 class Element{
  constructor(){this.listeners={};this.children=[];this.value='';this.hidden=false;this.textContent='';this.disabled=false;this.classList={toggle(){},remove(){},add(){}};}
  addEventListener(type,fn){this.listeners[type]=fn;}appendChild(child){this.children.push(child);}setAttribute(){}focus(){}
 }
 const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const document={getElementById:get,createElement:()=>new Element(),addEventListener(){},hidden:false};
 const best={id:'best',name:'<Cat>',score:2000,rawScore:1000,pointsMultiplier:2,distance:1000,redTokens:2,rushPickups:1,submitted:10,rank:1};
 const status={wallet:WALLET,round:5,quota:{limit:null,used:4,remaining:null,unlimited:true},quest:{collected:10,target:10,remaining:0,unlocked:true},best,history:[{...best,status:'completed'},{id:'open',score:null,submitted:null,status:'in progress'}]};
 const requests=[],window={};get('wallet').value=WALLET;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'online.js'),'utf8'),{document,window,location:{protocol:'file:'},localStorage:{getItem(){return null;},setItem(){}},fetch:async route=>{requests.push(route);return {ok:true,json:async()=>({...status,eligible:true,tokens:'50000'})};},AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},URLSearchParams,console});
 await get('check-day').listeners.click();
 assert.deepEqual(requests,['/api/player-status?wallet='+WALLET]);assert.equal(window.RushOnline.wallet(),WALLET);
 assert.match(get('holder-runs').textContent,/UNLIMITED PLAYS/);assert.equal(get('again').disabled,false);
 assert.equal(get('quest-count').textContent,'10 / 10 · 2×');assert.equal(get('quest-progress').value,10);assert.equal(get('holder-daily').hidden,false);
 assert.equal(get('daily-history').children.length,2);assert.match(get('holder-best').textContent,/2× QUEST/);
 assert.match(get('daily-history').children[0].children[1].textContent,/<Cat> · 1000m · 2 red/,'names are rendered literally, never as HTML');
 assert.match(get('wallet-status').textContent,/no run used/);assert.equal(get('check-day').disabled,false);
});
