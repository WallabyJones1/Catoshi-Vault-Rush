'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {BotRace}=require('./bot-race.js'),{RaceRun,BOOST_SPEED}=require('./race-engine.js'),{TRACKS}=require('./race-tracks.js');
test('all ten local bot races finish with live boosts, jumps and finite opponents',()=>{
  for(const track of TRACKS){const race=new BotRace({trackId:track.id,matchId:'test'});let jumps=0;
    while(!race.finished&&race.tick<150*60){if(race.tick%350===160)race.run.press();if(race.tick%350===240)race.run.release();if(race.run.boostCharges&&race.run.player.boost<=0)race.run.activateBoost();race.step();jumps+=race.run.drainEvents().filter(e=>e.type==='jump').length;
      assert(race.players.every(r=>Number.isFinite(r.run.player.x)&&Number.isFinite(r.run.player.y)));}
    assert(race.finished,track.id);assert(jumps>=5,track.id+' needs repeated jumps even when boosts skip some ramps');
    const result=race.result();assert.equal(result.players.length,4);assert(result.players.every(p=>p.finishMs!==null&&!p.forfeited));assert(result.players.every(p=>p.points===0));
    // Long enough to come back from; even this sloppy scripted rider (long held flips, no bog hops) still finishes.
    assert(race.run.time<125,track.id+' sloppy rider must still finish');
    for(const bot of result.players.filter(p=>p.bot))assert(bot.finishMs>45000&&bot.finishMs<90000,track.id+' bot pace '+bot.finishMs);
  }
});
test('a trailing racer can collect the same ground boost as the leader, once each',()=>{
  const a=new RaceRun(TRACKS[0].id),b=new RaceRun(TRACKS[0].id),item=a.items.find(i=>i.type==='boost');
  function collect(run){run.player.x=item.x-2;run.player.y=run.terrain(run.player.x);run.step(1/60);}
  collect(a);collect(b);assert.equal(a.boostCharges,1);assert.equal(b.boostCharges,1);assert(a.player.boost>0&&b.player.boost>0);
  a.syncBoostMask(-1);assert.equal(a.items.filter(i=>i.type==='boost'&&i.hit).length,1,'Other racers never remove uncollected pads');
  const restored=new RaceRun(a.trackId);restored.applySnapshot(a.snapshot());collect(restored);assert.equal(restored.boostCharges,1,'Snapshot replay must not collect a pad twice');
});
test('clean backflips and timed jumps award momentum; unfinished rotations do not',()=>{
  for(const [turns,timed,clean] of [[2,false,true],[0,true,true],[1,false,false]]){
    const r=new RaceRun(TRACKS[0].id),x=3000;
    Object.assign(r.player,{x,y:r.terrain(x)+1,grounded:false,airborne:1,spin:turns*Math.PI*2,angle:r.slope(x)+(clean?0:2),vx:500,vy:450,speed:500,timingJump:timed,held:!clean,heldTime:1});
    r.step(1/60);const tricks=r.drainEvents().filter(e=>e.type==='trick');
    const rewards=tricks.filter(e=>e.points>0);
    if(clean){assert.equal(rewards.length,1);assert(r.player.boost>0);assert(r.player.speed>500);assert(r.player.speed<=BOOST_SPEED);}
    else{assert.equal(rewards.length,0);assert.equal(r.player.boost,0);assert(tricks.some(e=>e.bad&&/LANDING/.test(e.text)),'a botched landing is called out');assert(r.player.speed<400,'a botched landing costs real speed');assert(r.player.stagger>0);}
  }
});
test('a tap just before touchdown buffers a jump; ramp launches do not allow accidental double jumps',()=>{
  const r=new RaceRun(TRACKS[0].id),p=r.player;
  Object.assign(p,{x:400,y:r.terrain(400)-1,grounded:false,coyote:0,vy:400,vx:360,speed:360,airborne:.5});
  r.press();assert(!p.grounded);r.step(1/60);assert(!p.grounded);assert(p.vy<0);assert.equal(p.buffer,0);assert(r.drainEvents().some(e=>e.type==='jump'));
  // Holding through a lip or tapping well after it never double-jumps; only a
  // fresh tap inside the short late-pop window adds a weaker lift.
  const r2=new RaceRun(TRACKS[0].id),ramp=r2.ramps[0];r2.player.x=ramp.end-1;r2.player.y=r2.terrain(r2.player.x);r2.step(1/60);
  assert(!r2.player.grounded);assert.equal(r2.player.coyote,0);for(let i=0;i<8;i++)r2.step(1/60);const vy=r2.player.vy;r2.press();assert.equal(r2.player.vy,vy);
  const r3=new RaceRun(TRACKS[0].id),ramp3=r3.ramps[0];r3.player.x=ramp3.end-1;r3.player.y=r3.terrain(r3.player.x);r3.step(1/60);
  const before=r3.player.vy;r3.press();assert(r3.player.vy<before&&r3.player.vy>before-ramp3.pop,'late pop is weaker than a perfect pop');r3.release();const after=r3.player.vy;r3.press();assert.equal(r3.player.vy,after,'only one pop per launch');
});
test('mobile bot controller keeps rendering and accepts jumps while the network is disconnected',async()=>{
  let now=0,frame,draws=0,finished=0,networkInputs=0,gameRun;const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{id,clientWidth:390,clientHeight:650,width:0,height:0,hidden:false,textContent:'',style:{},classList:{toggle(){},add(){},remove(){}},listeners:{},addEventListener(n,f){this.listeners[n]=f;},setPointerCapture(){},focus(){},appendChild(){},getContext(){return{fillRect(){}};}});return elements.get(id);};
  const canvas=element('game');canvas.parentElement=element('shell');const window={addEventListener(){}};
  const document={getElementById:element,querySelectorAll:()=>[],addEventListener(){},createElement:()=>element('dynamic')};
  class Renderer{constructor(){}reset(){}breakout(){}resize(){}setRaceIdentity(){}setRaceEntities(){}setProjectiles(){}handle(){}update(r){gameRun=r;}draw(){draws++;}}
  window.RushMultiplayer={input(){networkInputs++;},current:()=>({}),name:()=> 'Cat',color:()=> '#f26b35',setStatus(){},localSnapshot(){},localFinished(match){finished++;window.VaultRushGame.multiplayerFinished(match);}};
  const context={window,document,VaultRace:require('./race-engine.js'),VaultBotRace:require('./bot-race.js'),VaultRaceNet:require('./race-net.js'),VaultRushRenderer:{Renderer,loadAssets:async()=>({})},performance:{now:()=>now},requestAnimationFrame:f=>{frame=f;return 1;},cancelAnimationFrame(){},setTimeout};
  vm.runInNewContext(fs.readFileSync('multiplayer-game.js','utf8'),context);
  window.VaultRushGame.startMultiplayer({local:true,matchId:'local',mode:'bots',trackId:TRACKS[0].id,seat:0,playerCount:4,startDelayMs:100});await new Promise(setImmediate);
  window.VaultRushGame.multiplayerConnection(false);
  for(let i=0;i<130;i++){now+=1000/30;frame(now);}
  element('jump-control').listeners.pointerdown({pointerId:1,pointerType:'touch',preventDefault(){}});assert(gameRun.player.held,'A network disconnect must not disable local jump controls');
  element('jump-control').listeners.pointerup({pointerId:1,preventDefault(){}});
  for(let i=0;i<2000&&!finished;i++){now+=1000/30;frame(now);}
  assert.equal(finished,1);assert(draws>500);assert.equal(networkInputs,0);assert.equal(window.VaultRushGame.mode(),'result');
});
