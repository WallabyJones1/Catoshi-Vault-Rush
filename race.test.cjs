'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {TRACKS,gapAt,terrainAt,makeItems}=require('./race-tracks.js');
const {RaceRun,COINS_PER_SHOT,SHOT_COOLDOWN,MAX_BOOST_CHARGES}=require('./race-engine.js');

test('all 10 fresh tracks are distinct, finishable and have sparse coins',()=>{
  assert.equal(TRACKS.length,10);
  assert.equal(new Set(TRACKS.map(t=>t.style)).size,10);
  let sawDifferentWave=false;
  for(const t of TRACKS){
    assert(t.finishX>30000&&t.gaps.length>=3&&t.ramps.length>=3&&t.boosts.length>=6,t.id);
    const r=new RaceRun(t.id),items=makeItems(t),coins=items.filter(i=>i.type==='coin');
    assert(coins.length>=18&&coins.length<=26,`${t.id}: sparse coin count`);
    assert(items.filter(i=>i.type==='boost').length>=6,t.id);
    for(const item of items)assert(!t.gaps.some(g=>item.x>g.x-160&&item.x<g.end+160),`${t.id}: pickup in gap`);
    let ticks=0;
    while(!r.finished&&ticks<110*60){r.step(1/60);r.drainEvents();ticks++;}
    assert(r.finished,`${t.id} does not reach finish`);
    assert(ticks>25*60,`${t.id} should be a meaningful race`);
    assert(Number.isFinite(terrainAt(t,t.finishX)),t.id);
    assert(r.coinsCollected>=5,`${t.id}: the downhill route must supply shot ammunition`);
    assert(r.respawns<=5,`${t.id}: missed jumps should not be punitive`);
    if(t.wave[0]!==TRACKS[0].wave[0])sawDifferentWave=true;
  }
  assert(sawDifferentWave);
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
