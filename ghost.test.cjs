'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Run,VERSION,SPEED_LIMITS}=require('./engine.js');
const {Track}=require('./ghost.js');
const {Renderer}=require('./renderer.js');

function response(){return {engine:VERSION,level:1,ghost:{id:'checked',name:'Fast Cat',ticks:120,timeMs:1000,samples:[[0,0,200,3.1,1],[60,400,100,-3.1,8],[120,800,200,0,1]]}};}
test('ghost interpolation follows verified poses and progress time, wraps rotation and clamps the finish',()=>{
  const source=response(),track=new Track(source,VERSION,1);
  const half=track.poseAt(.25);assert.equal(half.x,200);assert.equal(half.y,150);assert(Math.abs(half.angle-Math.PI)<1e-6);
  assert.equal(track.timeAtX(200),.25);assert.equal(track.delta(.4,200),.4-.25);
  assert.equal(track.timeAtX(-10),0);assert.equal(track.timeAtX(999),1);
  assert.equal(track.poseAt(-10).x,0);assert.equal(track.poseAt(100).x,800);assert(track.poseAt(1).finished);
  const before=track.poseAt(.4);assert.deepEqual(track.poseAt(.4),before,'a paused clock freezes the ghost');
  source.ghost.samples[1][1]=999;assert.equal(track.poseAt(.5).x,400,'a response cannot mutate a loaded race');
});
test('stale, mismatched, truncated and malformed ghosts are rejected before rendering',()=>{
  assert.throws(()=>new Track(response(),'older-engine',1));assert.throws(()=>new Track(response(),VERSION,2));
  for(const change of [r=>r.ghost=null,r=>r.ghost.timeMs=0,r=>r.ghost.samples[1][0]=0,r=>r.ghost.samples[1][1]=-1,
    r=>r.ghost.samples[1][2]=NaN,r=>r.ghost.samples[1][4]=16,r=>r.ghost.samples.pop(),r=>r.ghost.samples[0][0]=1]){
    const r=response();change(r);assert.throws(()=>new Track(r,VERSION,1));
  }
});

function flat(seed=2){
  const run=new Run(seed);run.items=[];run.ramps=[];run.gaps=[];run.rails=[];run.encounters=[];run.scenery=[];
  run.nextFeature=run.nextScenery=Infinity;run.terrain=()=>1000;run.slope=()=>0;run.derivative=()=>0;
  Object.assign(run.player,{x:5000,y:1000,speed:500,vx:500,boost:0,angle:0});return run;
}
test('cargo enters above the mobile view, can hit during flight, and different jump timing can avoid it',()=>{
  let airborneHits=0,avoided=0;
  for(const jump of [0,.2,.4,.6,.8]){
    const run=flat(),crate=run.addCargo(5650,9,true),renderer=new Renderer({canvas:{width:600,height:960}},{});
    renderer.reset(run);run.updateCargo();
    assert((crate.y-renderer.camera.y)*renderer.camera.zoom<0,'starts above the top, never materializes beside Catoshi');
    let jumped=false,hits=0;
    for(let tick=0;tick<360&&!run.dead;tick++){
      if(!jumped&&run.time>=jump){run.press();run.release();jumped=true;}
      run.step(1/120);
      for(const e of run.drainEvents())if(e.type==='stumble'&&e.kind==='cargo'){
        hits++;if(!run.player.grounded&&!crate.drop.landed&&e.y<950)airborneHits++;
      }
    }
    assert(hits<=1,'one package cannot take multiple lives');
    if(!hits)avoided++;
  }
  assert(airborneHits>0&&avoided>0,'real physics includes hits and a successful timing choice');
});
test('hound catches low ground speed but cannot bite a cat far above the ground',()=>{
  const run=flat();Object.assign(run.player,{grounded:false,y:500,vy:0,speed:85,vx:85});
  run.dog={active:true,distance:24.01,warning:true};
  for(let i=0;i<30;i++){run.step(1/120);run.drainEvents();}
  assert(!run.dead);assert.equal(run.dog.distance,24);
  Object.assign(run.player,{grounded:true,y:1000,speed:85,vx:85});run.step(1/120);
  assert(run.dead);assert.equal(run.reason,'THE HOUND CAUGHT UP');
});
test('successive mistakes drain momentum more severely and can stall on an uphill',()=>{
  const run=flat();run.terrain=x=>1000-(x-5000)*.35;run.derivative=()=>-.35;run.slope=()=>Math.atan(-.35);
  Object.assign(run.player,{speed:240,vx:240,angle:run.slope(5000)});
  run.stumble({type:'rock',heavy:true});assert(!run.dead);const first=run.player.speed;
  for(let i=0;i<140&&!run.dead;i++){run.step(1/120);run.drainEvents();}
  assert(!run.dead);run.stumble({type:'crate',heavy:true});assert(run.player.speed<first*.5);assert.equal(run.lives,1);
  let stopped=false;for(let i=0;i<650&&!run.dead;i++){run.step(1/120);run.drainEvents();if(run.player.speed<1)stopped=true;}
  assert(stopped&&run.dead);assert(['LOST MOMENTUM','THE HOUND CAUGHT UP'].includes(run.reason));
});
test('long climbs offer sparse airborne escape boosts without ground hazards sharing the pickup',()=>{
  let count=0;
  for(let seed=1;seed<=20;seed++){
    const run=new Run(seed);run.generate(50000);
    const pickups=run.items.filter(i=>i.climb);count+=pickups.length;
    for(let i=0;i<pickups.length;i++){
      const p=pickups[i];assert(p.aerial&&p.type==='boost');assert(run.terrain(p.x)-p.y>65);
      assert(!run.items.some(other=>other.hazard&&Math.abs(other.x-p.x)<180));
      if(i)assert(p.x-pickups[i-1].x>=1050);
    }
  }
  assert(count>15,'a real option across seeded terrain');
});
test('long descents reach the higher normal and RUSH caps without exceeding them',()=>{
  for(const rush of [false,true]){
    const run=flat();run.terrain=x=>1000+(x-5000)*.7;run.derivative=()=>.7;run.slope=()=>Math.atan(.7);
    Object.assign(run.player,{speed:rush?1120:760,vx:rush?1120:760,angle:run.slope(5000),rush:rush?7:0});
    const cap=rush?SPEED_LIMITS.rush:SPEED_LIMITS.ground;
    for(let i=0;i<720&&!run.dead;i++){run.step(1/120);run.drainEvents();assert(run.player.speed<=cap+.0001);}
    assert.equal(run.player.speed,cap);assert(!run.dead);
  }
});
