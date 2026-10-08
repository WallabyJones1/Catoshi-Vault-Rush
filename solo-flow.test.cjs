'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Run,Trial,TRIAL_COURSES}=require('./engine.js');

// An attentive rider: jumps gaps and obstacles in good time, taps kicker lips.
function ride(level,{active=true}={}){
  const run=new Trial(level);let ticks=0,crawl=0;
  while(!run.dead&&ticks<240*120){
    const p=run.player;
    if(active&&(p.grounded||p.coyote>0)&&!p.held){
      const lead=Math.max(140,p.speed*.24);
      const gap=run.gaps.find(g=>g.x>p.x&&g.x-p.x<lead);
      const obstacle=run.items.find(i=>i.hazard&&!i.hit&&i.x>p.x&&i.x-p.x<lead);
      const lip=run.ramps.find(r=>r.end>p.x&&r.end-p.x<p.speed*.08);
      if(gap||obstacle||lip){run.press();run.release();}
    }
    run.step(1/120);run.drainEvents();ticks++;if(run.player.speed<150)crawl++;
  }
  return{run,crawl:crawl/ticks};
}

test('every Speed Trial flows: finishable with no crawling climbs, longer courses take longer, no input never finishes',()=>{
  let previous=0;
  for(const course of TRIAL_COURSES){
    const {run,crawl}=ride(course.id);
    assert(run.finished,course.name+' finishes');
    assert(crawl<.05,course.name+' never stalls on a long climb ('+(crawl*100).toFixed(0)+'% crawling)');
    assert(run.finishTime>previous&&run.finishTime<60,course.name+' '+run.finishTime.toFixed(1)+'s');previous=run.finishTime;
    assert(!ride(course.id,{active:false}).run.finished,course.name+' needs input');
    // Rises are short kickers, never the long uphill legs that used to stall riders.
    if(course.id>1)for(const [length,drop] of course.legs)assert(drop>-200,course.name+' has no long climb');
  }
});

test('Speed Trial obstacles stay out of every launch flight and pad hop',()=>{
  for(const course of TRIAL_COURSES){
    const run=new Trial(course.id);
    for(const h of run.items.filter(i=>i.hazard)){
      for(const r of run.ramps)assert(!(h.x>r.x-500&&h.x<run.longestFlight(r)+1300),course.name+' obstacle at '+Math.round(h.x)+' sits in a landing zone');
      if(course.id>1)assert(!run.items.some(i=>i.aerial&&h.x-i.x>0&&h.x-i.x<1500),course.name+' obstacle right after a pad hop');
    }
  }
});

test('jumping off a Speed Trial kicker boosts a slowed rider over the chasm; riding off without a jump does not',()=>{
  const course=TRIAL_COURSES[2],make=()=>{const run=new Trial(course.id),r=run.ramps[0],x=r.end-60;Object.assign(run.player,{x,y:run.rampY(r,x),speed:300,vx:300,grounded:true,ramp:r});return run;};
  const jumped=make();jumped.press();assert(jumped.player.speed>=620,'booster on a jump');
  const rolled=make();rolled.step(1/120);assert(rolled.player.speed<400,'no booster without a jump');
});

test('Vault Run landings lose speed in proportion to impact; only huge impacts stumble',()=>{
  const land=vy=>{const run=new Run(77),x=6000;run.generate(9000);const a=run.slope(x);
    Object.assign(run.player,{x,y:run.terrain(x)-1,grounded:false,airborne:.6,vx:800,vy,speed:800,angle:a,held:false});
    const events=[];run.land(run.terrain(x),a);events.push(...run.drainEvents());return{run,events};};
  const soft=land(250),firm=land(900),huge=land(2200);
  assert(!soft.events.some(e=>e.type==='stumble'));
  assert(!firm.events.some(e=>e.type==='stumble'),'an ordinary hard landing is not a stumble');
  assert(huge.events.some(e=>e.type==='stumble'&&e.kind==='landing'),'a huge impact still stumbles');
  assert(firm.run.player.speed<soft.run.player.speed+400,'harder landings keep proportionally less speed');
});

test('one hazard hit gives a short grace before the hound can start a chase',()=>{
  const run=new Run(31);run.generate(9000);const x=6000;Object.assign(run.player,{x,y:run.terrain(x),grounded:true,speed:700,vx:700});
  run.stumble({type:'barrier',x,y:run.terrain(x),width:60,height:35,hazard:true,heavy:true,hit:false});
  assert(run.houndGrace>2);
  for(let i=0;i<240;i++){run.step(1/120);run.drainEvents();}
  assert(!run.dog.active,'no chase during the grace period');assert.equal(run.lives,2);
});
