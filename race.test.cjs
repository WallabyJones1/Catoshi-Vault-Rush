'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {TRACKS,gapAt,terrainAt,makeItems}=require('./race-tracks.js');
const {RaceRun,COINS_PER_SHOT,SHOT_COOLDOWN,MAX_BOOST_CHARGES,applyPackRules,draftingBehind,catchupFor}=require('./race-engine.js');

test('all 10 tracks are distinct, long enough to come back from, and finishable',()=>{
  assert.equal(TRACKS.length,10);
  assert.equal(new Set(TRACKS.map(t=>t.style)).size,10);
  let sawDifferentWave=false;
  for(const t of TRACKS){
    assert(t.finishX>65000&&t.gaps.length>=1&&t.ramps.length>=6&&t.boosts.length>=12,t.id);
    assert(t.balloons.length>=4&&t.ramps.some(r=>r.kind==='mega')&&t.mud.length>=1,t.id+' needs a sky route, a mega ramp and a bog');
    const r=new RaceRun(t.id),items=makeItems(t),coins=items.filter(i=>i.type==='coin');
    assert(coins.length>=40&&coins.length<=95,`${t.id}: coin count ${coins.length}`);
    for(const item of items)assert(!t.gaps.some(g=>item.x>g.x-160&&item.x<g.end+160),`${t.id}: pickup in gap`);
    for(const b of t.boosts)assert(!t.mud.some(m=>b.x>m.x-60&&b.x<m.end+60),`${t.id}: boost in a bog`);
    let ticks=0;
    while(!r.finished&&ticks<150*60){r.step(1/60);r.drainEvents();ticks++;}
    assert(r.finished,`${t.id} does not reach finish`);
    assert(ticks>45*60,`${t.id} should be a long race`);
    assert(Number.isFinite(terrainAt(t,t.finishX)),t.id);
    assert(r.coinsCollected>=5,`${t.id}: the route must supply shot ammunition`);
    assert(r.respawns<=5,`${t.id}: missed jumps should not be punitive`);
    if(t.wave[0]!==TRACKS[0].wave[0])sawDifferentWave=true;
  }
  assert(sawDifferentWave);
});

// Drive a whole track: jump gaps, optionally pop mega ramps and hop bogs.
function drive(trackId,{sky=false,hop=true}={}){
  const r=new RaceRun(trackId);let rel=0,tick=0;
  while(!r.finished&&tick<150*60){
    const p=r.player;if(rel&&tick>=rel){r.release();rel=0;}
    if(!p.held){
      const gap=r.gaps.find(g=>g.x>p.x&&g.x-p.x<230),face=p.grounded?r.ramps.find(q=>p.x>=q.x&&p.x<q.end):null,bog=r.mud.find(m=>m.x-p.x>40&&m.x-p.x<200);
      if(p.grounded&&gap){r.press();rel=tick+8;}
      else if(sky&&face&&face.kind==='mega'&&!p.lipQueued&&(face.end-p.x)/Math.max(300,p.vx)<.16){r.press();rel=tick+4;}
      else if(hop&&p.grounded&&bog){r.press();rel=tick+5;}
    }
    r.step(1/60);r.drainEvents();tick++;
  }
  return r;
}
test('popping every mega ramp reaches every balloon; riding normally stays on the ground route',()=>{
  for(const t of TRACKS){
    const sky=drive(t.id,{sky:true}),low=drive(t.id);
    assert.equal(sky.balloonBounces,t.balloons.length,t.id+': every balloon must be reachable from a popped lip');
    assert.equal(low.balloonBounces,0,t.id+': balloons are only for racers who pop');
    assert(sky.finished&&low.finished);
    // Neither route should be a runaway: a well-ridden ground line stays within a few seconds.
    assert(Math.abs(sky.time-low.time)<4,`${t.id}: sky ${sky.time.toFixed(1)} vs ground ${low.time.toFixed(1)}`);
  }
});
test('every mega ramp is reachable even after the longest boosted flight before it',()=>{
  for(const t of TRACKS){
    for(const m of t.ramps.filter(r=>r.kind==='mega'))for(const q of t.ramps.filter(r=>r.end<m.x)){
      let x=q.end,y=terrainAt(t,x)-1,vx=1450,vy=-(q.launch+q.pop);
      for(let i=0;i<600;i++){vy+=690/60;x+=vx/60;y+=vy/60;if(vy>0&&y>=terrainAt(t,x))break;}
      assert(x<m.x,`${t.id}: a flight from ramp ${q.id} overflies mega ramp ${m.id}`);
    }
  }
});
test('wading through bogs is clearly slower than hopping them',()=>{
  for(const t of TRACKS.slice(0,4)){const hop=drive(t.id),wade=drive(t.id,{hop:false});assert(wade.time>hop.time+2,t.id);}
  const r=new RaceRun(TRACKS[0].id),m=r.mud[0];Object.assign(r.player,{x:m.x+5,y:r.terrain(m.x+5),speed:1150,vx:1150,grounded:true});
  for(let i=0;i<60&&r.player.x<m.end;i++)r.step(1/60);
  assert(r.player.speed<950,'a bog drains speed quickly');assert(r.drainEvents().some(e=>e.type==='mud'));
});
test('a tap too early on a ramp face wastes the launch; a tap at the lip pops higher',()=>{
  const t=TRACKS[0],ramp=t.ramps.find(r=>r.kind==='mega');
  const setup=x=>{const r=new RaceRun(t.id);Object.assign(r.player,{x,y:r.terrain(x),speed:1100,vx:1100,grounded:true});return r;};
  const early=setup(ramp.x+20);early.step(1/60);early.press();const ev=early.drainEvents();
  assert(!early.player.grounded&&early.player.speed<1000,'early jump scrubs speed');assert(ev.some(e=>e.bad&&/EARLY/.test(e.text)));
  const perfect=setup(ramp.end-120),plain=setup(ramp.end-120);perfect.press();
  for(let i=0;i<12;i++){perfect.step(1/60);plain.step(1/60);}
  assert(!perfect.player.grounded&&!plain.player.grounded);
  assert(perfect.player.vy<plain.player.vy-ramp.pop*.8,'perfect pop launches far higher');assert(perfect.player.skyLock);
  assert(perfect.drainEvents().some(e=>/PERFECT POP/.test(e.text||'')));
});
test('nose-down and hard landings cost speed; matching the slope keeps it',()=>{
  // An ordinary stretch of open downhill, away from ramps, gaps and bogs.
  const t=TRACKS[1],x=plainSpot(t);
  const land=(o)=>{const r=new RaceRun(t.id);Object.assign(r.player,{x,y:r.terrain(x)+8,grounded:false,airborne:.8,vx:1000,speed:1000,...o});r.step(1/60);return r;};
  const smooth=land({vy:Math.tan(slopeOf(t,x))*1000,angle:slopeOf(t,x)});
  const nose=land({vy:300,angle:slopeOf(t,x)+1.4});
  const slam=land({vy:2200,angle:slopeOf(t,x)});
  assert(smooth.player.grounded&&smooth.badLandings===0&&smooth.player.speed>950);
  assert(nose.badLandings===1&&nose.player.speed<smooth.player.speed*.65);
  assert(slam.badLandings===1&&slam.player.speed<smooth.player.speed,'a long fall is not free speed');
});
function slopeOf(t,x){return Math.atan((terrainAt(t,x+1)-terrainAt(t,x-1))*.5);}
function plainSpot(t){
  for(let x=2000;x<t.finishX;x+=50){
    const clear=!t.ramps.some(r=>x>r.x-200&&x<r.recovery+200)&&!t.gaps.some(g=>x>g.x-400&&x<g.end+400)&&!t.mud.some(m=>x>m.x-100&&x<m.end+100);
    if(clear&&Math.abs(slopeOf(t,x)-.35)<.04&&Math.abs(slopeOf(t,x+40)-.35)<.05)return x;
  }
  throw Error('no plain stretch');
}
test('slipstream and catch-up help racers behind without passing anyone for free',()=>{
  const ahead=new RaceRun(TRACKS[3].id),behind=new RaceRun(TRACKS[3].id),alone=new RaceRun(TRACKS[3].id);
  for(const r of [ahead,behind,alone])Object.assign(r.player,{x:5000,y:r.terrain(5000),speed:900,vx:900});
  ahead.player.x=5250;ahead.player.y=ahead.terrain(5250);
  assert(draftingBehind(behind.player,ahead.player)&&!draftingBehind(ahead.player,behind.player));
  for(let i=0;i<30;i++){applyPackRules([ahead,behind]);applyPackRules([alone]);ahead.step(1/60);behind.step(1/60);alone.step(1/60);}
  assert(behind.player.speed>alone.player.speed+20,'drafting accelerates');
  assert.equal(catchupFor(10000,9900),0);assert(catchupFor(10000,4000)>.9);
  const leader=new RaceRun(TRACKS[3].id),trailer=new RaceRun(TRACKS[3].id);leader.player.x=20000;applyPackRules([leader,trailer]);
  assert.equal(leader.catchup,0);assert(trailer.catchup>0);
});

test('falling into a gap respawns without ending the multiplayer race',()=>{
  const r=new RaceRun('canyon-drop'),g=r.gaps[0];r.player.x=g.x+10;r.player.y=r.terrain(r.player.x)+500;r.player.grounded=false;r.player.vx=500;r.player.vy=300;r.step(1/60);
  assert(!r.dead);assert(r.respawns>0);assert(r.player.x>=g.end);
});

test('racer can collect at most three speed charges and spend them one by one',()=>{
  const r=new RaceRun('summit-smash');assert.equal(MAX_BOOST_CHARGES,3);
  assert(!r.activateBoost());
  for(let i=0;i<3;i++)assert(r.claimBoost());
  assert.equal(r.boostCharges,3);assert(!r.claimBoost());
  for(let i=2;i>=0;i--){assert(r.activateBoost());assert.equal(r.boostCharges,i);}
  assert(!r.activateBoost());
  assert(r.claimBoost());assert.equal(r.boostCharges,1);
  assert(r.player.boost>0);
});

test('shots consume 5 hard-earned coins and enforce a real 3.5 second cooldown',()=>{
  const r=new RaceRun('summit-smash');assert.equal(COINS_PER_SHOT,5);assert.equal(SHOT_COOLDOWN,3.5);
  r.coins=15;assert(r.spendShot());assert.equal(r.coins,10);assert.equal(r.shots,1);
  assert.equal(r.shotCooldown,3.5);assert(!r.spendShot());assert.equal(r.coins,10);
  for(let i=0;i<180;i++)r.step(1/60);
  assert(r.shotCooldown>0.45&&r.shotCooldown<0.55);assert(!r.spendShot());
  for(let i=0;i<31;i++)r.step(1/60);
  assert.equal(r.shotCooldown,0);assert(r.spendShot());assert.equal(r.coins,5);assert.equal(r.shots,2);
  for(let i=0;i<211;i++)r.step(1/60);
  assert(r.spendShot());assert.equal(r.coins,15-3*COINS_PER_SHOT+r.coinsCollected);assert(!r.spendShot());
});

test('authoritative snapshots preserve shot reload and boost inventory',()=>{
  const r=new RaceRun('vaultfall-finals');r.claimBoost();r.claimBoost();r.coins=10;r.spendShot();
  const s=r.snapshot();assert.equal(s.boostCharges,2);assert.equal(s.shotCooldown,3.5);
  const replica=new RaceRun('vaultfall-finals');replica.applySnapshot(s);
  assert.equal(replica.boostCharges,2);assert.equal(replica.shotCooldown,3.5);assert(!replica.spendShot());
});

test('32 simultaneous race engines stay finite during shots, jumps and boosts',()=>{
  const runs=Array.from({length:32},(_,i)=>new RaceRun(TRACKS[i%10].id));
  for(let tick=0;tick<1200;tick++)for(let i=0;i<runs.length;i++){
    const r=runs[i];if(tick===40){r.claimBoost();r.claimBoost();r.claimBoost();}if(tick===70||tick===240||tick===490)r.activateBoost();
    if(tick%220===i%37)r.press();if(tick%220===20+i%37)r.release();
    if(tick%360===i%43){r.coins+=5;r.spendShot();}r.step(1/60);r.drainEvents();
  }
  assert(runs.every(r=>Number.isFinite(r.player.x)&&Number.isFinite(r.player.y)&&r.player.x>0&&r.boostCharges<=3));
});
