'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {TRACKS,gapAt,terrainAt,makeItems}=require('./race-tracks.js');
const {RaceRun,COINS_PER_SHOT}=require('./race-engine.js');
test('every one of the 10 side-scrolling courses has a reachable finish without needing perfect jumps',()=>{
  assert.equal(TRACKS.length,10);
  for(const t of TRACKS){assert(t.finishX>30000&&t.gaps.length>=2&&t.boosts.length>=3,t.id);let r=new RaceRun(t.id),steps=0;
    while(!r.finished&&steps<110*60){r.step(1/60);r.drainEvents();steps++;}
    assert(r.finished,`${t.id} must finish before race timeout`);assert(r.player.x>=t.finishX);
    assert(steps>20*60,`${t.id} too short`);assert(Number.isFinite(terrainAt(t,t.finishX)));
    const items=makeItems(t);assert(items.filter(i=>i.type==='coin').length>=45,t.id);
  }
});
test('gap failure recovers rather than ending the race',()=>{
 const r=new RaceRun('canyon-drop'),g=r.gaps[0];r.player.x=g.x+10;r.player.y=r.terrain(r.player.x)+500;r.player.grounded=false;r.player.vx=500;r.player.vy=300;r.step(1/60);assert(!r.dead);assert(r.respawns>0);assert(r.player.x>=g.end);
});
test('jump, shoot and manual boost are simple and server-compatible',()=>{
 const r=new RaceRun('summit-smash');assert.equal(r.player.boost,0);assert(!r.activateBoost());
 r.press();assert(!r.player.grounded);r.release();r.coins=COINS_PER_SHOT;assert(r.spendShot());assert.equal(r.coins,0);
 assert(r.claimBoost());assert.equal(r.boostCharges,1);assert(r.activateBoost());assert.equal(r.boostCharges,0);assert(r.player.boost>2.5);assert(!r.activateBoost());
});
test('four complete 8-racer rooms step together with shots and boost activations',()=>{
 const runs=Array.from({length:32},(_,i)=>new RaceRun(TRACKS[i%10].id));
 for(let tick=0;tick<900;tick++)for(let i=0;i<runs.length;i++){const r=runs[i];if(tick===40)r.claimBoost();if(tick===70)r.activateBoost();if(tick%173===i%37)r.press();if(tick%173===20+i%37)r.release();r.step(1/60);r.drainEvents();}
 assert(runs.every(r=>Number.isFinite(r.player.x)&&Number.isFinite(r.player.y)&&r.player.x>0));
});
