'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Run}=require('./engine.js');
const {openDatabase}=require('./server.cjs');
const {dailyQuest,syncHolderScores}=require('./quest.cjs');
const {disqualify}=require('./admin.cjs');
const {DAY_MS,ROUND_MS,currentRound,roundWindow,dayAt,WEEK_ID_OFFSET}=require('./periods.cjs');
const WALLET='11111111111111111111111111111111';
function flat(){
 const run=new Run(1);run.terrain=()=>200;run.derivative=()=>0;run.slope=()=>0;run.items=[];run.ramps=[];run.rails=[];run.gaps=[];run.nextFeature=run.nextScenery=Infinity;
 Object.assign(run.player,{x:0,y:200,speed:400,vx:400,vy:0,angle:0,boost:0,grounded:true});return run;
}
test('gold RUSH grants exactly seven simulation seconds of speed and full gameplay protection',()=>{
 const run=flat();run.items=[{type:'rush',x:3,y:183,hit:false}];run.step(1/120);
 assert.equal(run.rushPickups,1);assert.equal(run.player.rush,7);assert.equal(run.player.speed,950);
 assert(run.drainEvents().some(e=>e.type==='rush'&&e.seconds===7));
 run.items=[{type:'boost',x:run.player.x+4,y:200,hit:false}];run.step(1/120);
 assert(run.player.speed>=950,'ordinary green boost cannot cap an active RUSH burst');
 const obstacle={type:'stack',x:30,y:200,width:50,height:65,heavy:true,hazard:true,hit:false};
 run.items=[obstacle];run.gaps=[{x:100,end:900}];run.dog={active:true,distance:25,warning:true};
 for(let n=0;n<120;n++)run.step(1/120);
 assert(!run.dead);assert(obstacle.hit);assert(run.player.speed>=820);assert(run.player.y<=212);
 Object.assign(run.player,{held:true,airborne:1,angle:Math.PI,vy:1800,vx:950});run.land(200,0);
 assert(!run.dead,'shield protects bad rotation and hard impact');run.release();
 run.gaps=[];run.dog.active=false;
 for(let n=121;n<840;n++)run.step(1/120);
 assert(run.player.rush<1e-9,'time does not extend beyond seven seconds');
 run.step(1/120);assert.equal(run.player.rush,0);
 for(let n=0;n<150;n++)run.step(1/120);assert(run.player.speed<=760,'burst speed eases back to ordinary speed');
 Object.assign(run.player,{airborne:1,held:true,angle:Math.PI,vy:1800,vx:400});run.land(200,0);assert(!run.dead);assert.equal(run.lives,2,'ordinary landing damage resumes after the shield');
 const limited=flat();limited.player.rush=7;limited.crash('TIME LIMIT');assert(limited.dead,'power cannot bypass server run duration');
});

test('weekly periods start on Monday UTC, span seven days and keep historical daily IDs separate',()=>{
 const monday=Date.UTC(2026,8,28),week=currentRound(monday);
 assert(week>=WEEK_ID_OFFSET);assert.equal(currentRound(monday+ROUND_MS-1),week);assert.equal(currentRound(monday-1),week-1);
 assert.equal(currentRound(monday+ROUND_MS),week+1);
 assert.deepEqual(roundWindow(week),{start:monday,end:monday+ROUND_MS,period:'weekly'});
 assert.deepEqual(roundWindow(20500),{start:20500*DAY_MS,end:20501*DAY_MS,period:'daily'});
});

test('daily boosts stay independent within a week and reviewing yesterday cannot change today’s quest',()=>{
 const db=openDatabase(':memory:'),start=Date.UTC(2026,8,28),week=currentRound(start),day=dayAt(start);
 const add=(id,score,red,started)=>db.prepare("INSERT INTO runs(id,session,seed,name,wallet,mode,round,started,expires,engine,score,raw_score,red_tokens,submitted)VALUES(?,'private',1,'Cat',?,'holder',?,?,?,'flow-web-11',?,?,?,?)").run(id,WALLET,week,started,started+1200000,score,score,red,started+1000);
 const score=id=>db.prepare('SELECT score FROM runs WHERE id=?').get(id).score;
 try{
  add('monday-best',1000,5,start+1000);add('monday-second',600,5,start+2000);
  assert(syncHolderScores(db,WALLET,week,null,day).unlocked);assert.equal(score('monday-best'),2000);
  add('cross-midnight',500,1,start+DAY_MS-1000);
  db.prepare("UPDATE runs SET submitted=? WHERE id='cross-midnight'").run(start+DAY_MS+10000);
  syncHolderScores(db,WALLET,week,null,day);
  assert.equal(dailyQuest(db,WALLET,week,null,day).collected,11,'start day owns a run that finishes after midnight');
  assert.equal(dailyQuest(db,WALLET,week,null,day+1).collected,0);
  add('tuesday-best',1400,5,start+DAY_MS+1000);add('tuesday-second',800,5,start+DAY_MS+2000);
  syncHolderScores(db,WALLET,week,null,day+1);syncHolderScores(db,WALLET,week,null,day+1);
  assert.equal(score('monday-best'),2000);assert.equal(score('tuesday-best'),2800,'daily multipliers never stack');
  disqualify(db,'monday-second','Invalid recording after replay review');
  assert.equal(score('monday-best'),1000);assert.equal(score('tuesday-best'),2800);
  assert(dailyQuest(db,WALLET,week,null,day+1).unlocked);assert.equal(dailyQuest(db,WALLET,week,null,day+7).collected,0);
 }finally{db.close();}
});
test('each seed creates only five increasingly distant red routes; red pickups cap at five per run',()=>{
 const layouts=new Set();
 for(let seed=1;seed<=40;seed++){
  const r=new Run(seed);r.generate(110000);const reds=r.items.filter(i=>i.type==='redRush');assert.equal(reds.length,5);assert.equal(r.redSites,5);
  for(let i=0;i<5;i++){assert(reds[i].x>=[9000,17500,31000,48000,72000][i]);if(i)assert(reds[i].x-reds[i-1].x>5000);}
  layouts.add(reds.map(i=>[Math.round(i.x),Math.round(i.y)]).join('|'));
  for(const token of r.items.filter(i=>['rush','redRush'].includes(i.type)))assert(token.y<r.terrain(token.x)-45,'rare pickups sit above the normal ground route');
 }
 assert.equal(layouts.size,40);
 const r=flat();r.items=Array.from({length:8},()=>({type:'redRush',x:3,y:183,hit:false}));r.step(1/120);assert.equal(r.redTokens,5);assert.equal(r.drainEvents().filter(e=>e.type==='redRush').length,5);
});
test('daily quest doubles only the best raw score, moves to a later best, and invalidated tokens remove the unlock',()=>{
 const db=openDatabase(':memory:');
 try{
  const insert=db.prepare("INSERT INTO runs(id,session,seed,name,wallet,mode,round,started,expires,engine,score,raw_score,red_tokens,rush_pickups,submitted)VALUES(?,'s',1,'Cat',?,'holder',5,0,100000,'flow-web-7',?,?,?,0,?)");
  const add=(id,score,red,time)=>insert.run(id,WALLET,score,score,red,time);
  add('first',1000,5,1);add('second',800,4,2);syncHolderScores(db,WALLET,5);assert.equal(db.prepare("SELECT score FROM runs WHERE id='first'").get().score,1000);
  add('third',900,1,3);assert(syncHolderScores(db,WALLET,5).unlocked);assert.equal(db.prepare("SELECT score FROM runs WHERE id='first'").get().score,2000);
  add('better',1500,0,4);syncHolderScores(db,WALLET,5);syncHolderScores(db,WALLET,5);
  assert.equal(db.prepare("SELECT score FROM runs WHERE id='first'").get().score,1000);assert.equal(db.prepare("SELECT score FROM runs WHERE id='better'").get().score,3000,'no stacking');
  assert.equal(dailyQuest(db,WALLET,6).collected,0,'next UTC day resets progress');
  disqualify(db,'third','Invalid run removed after review');assert(!dailyQuest(db,WALLET,5).unlocked);assert.equal(db.prepare("SELECT score FROM runs WHERE id='better'").get().score,1500);
  db.prepare("INSERT INTO reward_plans(round,vault,created)VALUES(5,?,10)").run(WALLET);
  assert.throws(()=>disqualify(db,'second','Review after payout lock'),/freezes this round/);
 }finally{db.close();}
});
