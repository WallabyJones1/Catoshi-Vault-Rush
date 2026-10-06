'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Run,SPEED_LIMITS}=require('./engine.js');
function flat(speed){
 const r=new Run(2);r.items=[];r.ramps=[];r.gaps=[];r.rails=[];r.encounters=[];r.scenery=[];
 r.nextFeature=r.nextScenery=Infinity;r.terrain=()=>1000;r.slope=r.derivative=()=>0;
 Object.assign(r.player,{x:5000,y:1000,speed,vx:speed,boost:0,angle:0});return r;
}
test('cargo crosses right to left ahead of riders at slow, medium and top speed',()=>{
 for(const speed of [200,500,SPEED_LIMITS.ground]){
  const r=flat(speed),c=r.addCargo(5650,9);r.updateCargo();const d={...c.drop},start=c.x;
  assert(start>r.player.x);r.time=d.warning+d.duration/2;r.updateCargo();assert(c.x<start);
  const mid=c.x;r.player.x-=1000;r.time=d.warning+d.duration;r.updateCargo();
  assert(c.x<mid);assert.equal(c.x,d.landX);assert(c.drop.landed);
  assert(Math.abs(c.x-(5000+speed*(d.warning+d.duration)))<80,'lands on the original approach, not far behind it');
  assert.equal(c.y,1000);assert.equal(c.drop.startX,d.startX,'trajectory cannot retarget after warning');
 }
});
test('a repeat collision drains speed enough to give the hound a real catch; sustained speed escapes',()=>{
 const r=flat(600);r.stumble({type:'rock',x:5000,heavy:true});assert(r.player.speed<=192);
 r.player.invulnerable=0;r.stumble({type:'rock',x:5000,heavy:true});assert(r.player.speed<40);
 for(let i=0;i<600&&!r.dead;i++)r.step(1/120);
 assert(r.dead);assert(r.dog.active||r.player.stall>1.65);
 const escape=flat(900);escape.dog={active:true,distance:100,warning:true};
 for(let i=0;i<650&&!escape.dead;i++)escape.step(1/120);
 assert(!escape.dead);assert(!escape.dog.active);
});
