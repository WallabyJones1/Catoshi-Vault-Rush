(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VaultRaceNet=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STEP=1/60,delta=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function apply(run,type){if(type==='jumpDown')run.press();else if(type==='jumpUp')run.release();else if(type==='fire')run.spendShot();else if(type==='boost')run.activateBoost();}
  class Prediction{
    constructor(run){this.run=run;this.tick=0;this.pending=[];this.lastServerTick=-1;this.offset={x:0,y:0,angle:0};}
    record(type,seq){if(Number.isInteger(seq))this.pending.push({type,seq,tick:this.tick});this.pending=this.pending.slice(-120);}
    step(){this.run.step(STEP);this.tick++;}
    reject(seq){this.pending=this.pending.filter(i=>i.seq!==seq);}
    reconcile(snapshot,seat){
      const me=snapshot.players?.find(p=>p.seat===seat);
      if(!me||!Number.isInteger(snapshot.tick)||snapshot.tick<=this.lastServerTick)return false;
      const before={x:this.run.player.x+this.offset.x,y:this.run.player.y+this.offset.y,angle:this.run.player.angle+this.offset.angle},respawns=this.run.respawns;
      const target=Math.max(snapshot.tick,Math.min(this.tick,snapshot.tick+12));
      this.pending=this.pending.filter(i=>i.seq>(me.inputSeq??-1));this.run.applySnapshot(me);this.run.syncBoostMask(snapshot.boostMask||0);this.run.time=snapshot.tick*STEP;
      this.tick=snapshot.tick;this.lastServerTick=snapshot.tick;
      const commands=this.pending.map(i=>({...i,tick:Math.max(snapshot.tick,i.tick)}));let index=0;
      while(this.tick<=target){
        while(index<commands.length&&commands[index].tick<=this.tick)apply(this.run,commands[index++].type);
        if(this.tick===target)break;this.step();
      }
      // Replaying prediction must not replay sounds, particles or pickup popups.
      this.run.drainEvents();this.run.previousPlayer={...this.run.player};
      const dx=before.x-this.run.player.x,dy=before.y-this.run.player.y;
      this.offset=respawns===this.run.respawns&&Math.hypot(dx,dy)<220?{x:dx,y:dy,angle:delta(before.angle-this.run.player.angle)}:{x:0,y:0,angle:0};
      return true;
    }
    smooth(dt){const decay=Math.exp(-dt*18);for(const key of ['x','y','angle'])this.offset[key]*=decay;return this.offset;}
  }
  class RemoteBuffer{
    constructor(){this.frames=[];}
    push(snapshot,at){if(!Number.isInteger(snapshot.tick))return;const last=this.frames.at(-1);if(last&&snapshot.tick<=last.snapshot.tick)return;this.frames.push({snapshot,at});this.frames=this.frames.slice(-24);}
    sample(at){
      const last=this.frames.at(-1);if(!last)return{players:[],projectiles:[]};
      const target=last.snapshot.tick+Math.min(6,Math.max(0,(at-last.at)/1000*60))-6;
      let a=this.frames[0],b=a;
      for(const f of this.frames){if(f.snapshot.tick<=target)a=f;if(f.snapshot.tick>=target){b=f;break;}b=f;}
      const t=a===b?0:Math.max(0,Math.min(1,(target-a.snapshot.tick)/(b.snapshot.tick-a.snapshot.tick)));
      function blend(list,key){const prev=new Map((a.snapshot[list]||[]).map(p=>[p[key],p]));return(b.snapshot[list]||[]).map(p=>{const q=prev.get(p[key]);if(!q)return p;const out={...p};for(const k of ['x','y'])out[k]=q[k]+(p[k]-q[k])*t;if(Number.isFinite(p.angle)&&Number.isFinite(q.angle))out.angle=q.angle+delta(p.angle-q.angle)*t;return out;});}
      return{players:blend('players','seat'),projectiles:blend('projectiles','id')};
    }
  }
  return{Prediction,RemoteBuffer};
});
