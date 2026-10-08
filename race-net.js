(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VaultRaceNet=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STEP=1/60,delta=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function apply(run,type){if(type==='jumpDown')run.press();else if(type==='jumpUp')run.release();else if(type==='fire')run.spendShot();else if(type==='boost')run.activateBoost();}
  class Prediction{
    constructor(run){this.run=run;this.tick=0;this.pending=[];this.lastServerTick=-1;this.offset={x:0,y:0,angle:0};}
    record(type,seq){if(Number.isInteger(seq))this.pending.push({type,seq,tick:this.tick});this.pending=this.pending.slice(-120);}
    step(){this.run.step(STEP);this.tick++;}
    reject(seq){this.pending=this.pending.filter(i=>i.seq!==seq);}
    reconcile(snapshot,seat,visual,alpha=1){
      const me=snapshot.players?.find(p=>p.seat===seat);
      if(!me||!Number.isInteger(snapshot.tick)||snapshot.tick<=this.lastServerTick)return false;
      const before=visual||{x:this.run.player.x+this.offset.x,y:this.run.player.y+this.offset.y,angle:this.run.player.angle+this.offset.angle},respawns=this.run.respawns;
      const target=Math.max(snapshot.tick,Math.min(this.tick,snapshot.tick+12));
      this.pending=this.pending.filter(i=>i.seq>(me.inputSeq??-1));this.run.applySnapshot(me);this.run.previousPlayer={...this.run.player};this.run.syncBoostMask(snapshot.boostMask||0);this.run.time=snapshot.tick*STEP;
      this.tick=snapshot.tick;this.lastServerTick=snapshot.tick;
      const commands=this.pending.map(i=>({...i,tick:Math.max(snapshot.tick,i.tick)}));let index=0;
      while(this.tick<=target){
        while(index<commands.length&&commands[index].tick<=this.tick)apply(this.run,commands[index++].type);
        if(this.tick===target)break;this.step();
      }
      // Replaying prediction must not replay sounds, particles or pickup popups.
      this.run.drainEvents();
      const p=this.run.player,old=this.run.previousPlayer||p,t=Math.max(0,Math.min(1,alpha));
      const base={x:old.x+(p.x-old.x)*t,y:old.y+(p.y-old.y)*t,angle:old.angle+delta(p.angle-old.angle)*t};
      const dx=before.x-base.x,dy=before.y-base.y;
      this.offset=respawns===this.run.respawns&&Math.hypot(dx,dy)<220?{x:dx,y:dy,angle:delta(before.angle-base.angle)}:{x:0,y:0,angle:0};
      return true;
    }
    smooth(dt){const decay=Math.exp(-dt*18);for(const key of ['x','y','angle'])this.offset[key]*=decay;return this.offset;}
  }
  class RemoteBuffer{
    constructor(){this.frames=[];this.delay=6;this.cursor=null;this.sampleAt=null;}
    push(snapshot,at){if(!Number.isInteger(snapshot.tick))return;const last=this.frames.at(-1);if(last&&snapshot.tick<=last.snapshot.tick)return;
      if(last){const late=Math.max(0,(at-last.at)*.06-(snapshot.tick-last.snapshot.tick));this.delay=Math.max(6,Math.min(12,this.delay*.94+(6+late*1.5)*.06));}
      this.frames.push({snapshot,at});this.frames=this.frames.slice(-24);}
    sample(at){
      const last=this.frames.at(-1);if(!last)return{players:[],projectiles:[]};
      const desired=last.snapshot.tick+Math.min(18,Math.max(0,(at-last.at)*.06))-this.delay;
      if(this.cursor===null)this.cursor=desired;
      else{const elapsed=Math.max(0,(at-this.sampleAt)*.06),error=desired-this.cursor;
        // Presentation time advances independently of packet arrival. A late
        // snapshot adjusts its pace rather than moving every opponent backwards.
        this.cursor+=Math.min(Math.max(0,error),elapsed*Math.max(.8,Math.min(1.2,1+error*.025)));}
      this.sampleAt=at;const target=this.cursor;
      let a=this.frames[0],b=a;
      for(const f of this.frames){if(f.snapshot.tick<=target)a=f;if(f.snapshot.tick>=target){b=f;break;}b=f;}
      const t=a===b?0:Math.max(0,Math.min(1,(target-a.snapshot.tick)/(b.snapshot.tick-a.snapshot.tick)));
      function blend(list,key){const prev=new Map((a.snapshot[list]||[]).map(p=>[p[key],p]));return(b.snapshot[list]||[]).map(p=>{const q=prev.get(p[key]);if(!q)return p;const out={...p};
        if(q.respawns!==p.respawns)return target<b.snapshot.tick?q:p;
        for(const k of ['x','y'])out[k]=q[k]+(p[k]-q[k])*t;
        if(a===b&&target>b.snapshot.tick&&!p.finished&&!p.forfeited){const seconds=Math.min(.2,(target-b.snapshot.tick)/60);out.x+=Math.max(0,p.vx||0)*seconds;out.y+=(p.vy||0)*seconds+(p.grounded?0:345*seconds*seconds);}
        if(Number.isFinite(p.angle)&&Number.isFinite(q.angle))out.angle=q.angle+delta(p.angle-q.angle)*t;return out;});}
      return{players:blend('players','seat'),projectiles:blend('projectiles','id')};
    }
  }
  return{Prediction,RemoteBuffer};
});
