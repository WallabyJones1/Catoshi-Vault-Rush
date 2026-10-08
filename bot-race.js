(function(root,factory){
  const Race=typeof module==='object'&&module.exports?require('./race-engine.js'):root.VaultRace;
  const api=factory(Race);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.VaultBotRace=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Race){
  'use strict';
  const RACE_LIMIT=150;
  class BotRace{
    constructor(ticket){
      this.ticket=ticket;this.tick=0;this.boostMask=0;this.projectiles=[];this.events=[];this.finished=false;this.firstFinish=null;this.shotId=0;
      this.players=Array.from({length:4},(_,seat)=>({seat,name:seat?'BOT '+seat:ticket.name||'YOU',color:seat?['','#e8a13a','#ab47bc','#3ddc54'][seat]:ticket.color||'#f26b35',bot:seat>0,run:new Race.RaceRun(ticket.trackId),finishMs:null,forfeited:false}));
      this.run=this.players[0].run;
    }
    fire(seat=0){const racer=this.players[seat];const targetSeat=Race.pickShotTarget(racer.run,this.players.filter(r=>r.finishMs===null));this.projectiles.push(Race.coinShot(racer.run,{id:'local-'+this.shotId++,seat,color:racer.color,targetSeat}));}
    drive(racer){
      const run=racer.run,p=run.player,seat=racer.seat,tick=this.tick;
      const press=(hold)=>{run.press();racer.releaseAt=tick+hold;};
      if(racer.releaseAt&&tick>=racer.releaseAt){run.release();racer.releaseAt=0;}
      if(p.held)return;
      const gap=run.gaps.find(g=>g.x>p.x&&g.x-p.x<210+seat*30);
      if(p.grounded&&gap){press(8);return;}
      // Each bot has a route personality: some chase balloons, some stay low.
      const face=p.grounded?run.ramps.find(r=>p.x>=r.x&&p.x<r.end):null;
      if(face&&!p.lipQueued&&(face.end-p.x)/Math.max(300,p.vx)<.16){
        const wantsSky=face.kind==='mega'?(seat+face.id)%3!==0:(seat*3+face.id)%4===0;
        if(wantsSky){press(5);return;}
      }
      const mud=run.mud.find(m=>m.x-p.x>40&&m.x-p.x<200);
      if(p.grounded&&mud&&mud.end-mud.x<700&&(seat+tick)%2===0){press(6);return;}
      if(!p.grounded&&!p.skyLock&&p.airborne>.15&&p.vy<0&&tick%180===seat*7){press(30+seat*6);return;}
      if(run.boostCharges&&p.boost<=0&&p.grounded&&!p.inMud&&tick%90===seat*9)run.activateBoost();
      if(run.coins>=Race.COINS_PER_SHOT&&tick%420===seat*17&&this.run.player.x>p.x&&this.run.player.x-p.x<900&&run.spendShot())this.fire(seat);
    }
    step(){
      if(this.finished)return;const dt=1/60;
      Race.applyPackRules(this.players.filter(r=>r.finishMs===null).map(r=>r.run));
      for(const r of this.players){if(r.finishMs!==null)continue;if(r.bot)this.drive(r);r.run.step(dt);if(r.bot)r.run.drainEvents();if(r.run.finished){r.finishMs=Math.round((this.tick+1)/60*1000);this.firstFinish??=this.tick;}}
      const racers=this.players.filter(r=>r.finishMs===null).sort((a,b)=>b.run.player.x-a.run.player.x||a.seat-b.seat);
      for(const q of this.projectiles){const target=this.players.find(r=>r.seat===q.targetSeat&&r.finishMs===null);if(!Race.stepCoinShot(this.run.track,q,dt,target?.run.player))continue;for(const r of racers){if(r.seat!==q.seat&&Race.shotHitsRacer(q,r.run.player)&&r.run.applyHit()){q.life=0;this.players[q.seat].run.hits++;this.events.push({type:'hit',from:q.seat,to:r.seat,x:r.run.player.x,y:r.run.player.y});break;}}}
      this.projectiles=this.projectiles.filter(q=>q.life>0);this.tick++;
      if(this.players.every(r=>r.finishMs!==null)||this.tick>=RACE_LIMIT*60||(this.run.finished&&this.tick-this.firstFinish>8*60)){this.finished=true;for(const r of this.players)if(r.finishMs===null)r.forfeited=true;}
    }
    drainEvents(){const out=this.events;this.events=[];return out;}
    snapshot(){return{matchId:this.ticket.matchId,tick:this.tick,status:this.finished?'finished':'running',players:this.players.map(r=>({seat:r.seat,name:r.name,color:r.color,bot:r.bot,finishMs:r.finishMs,forfeited:r.forfeited,...r.run.snapshot()}))};}
    visualPlayers(alpha){return this.players.slice(1).map(r=>{const p=r.run.player,old=r.run.previousPlayer;const out={seat:r.seat,name:r.name,color:r.color,finishMs:r.finishMs,forfeited:r.forfeited,...p};if(old){for(const k of ['x','y'])out[k]=old[k]+(p[k]-old[k])*alpha;out.angle=old.angle+Math.atan2(Math.sin(p.angle-old.angle),Math.cos(p.angle-old.angle))*alpha;}return out;});}
    result(){const ordered=[...this.players].sort((a,b)=>(a.finishMs??Infinity)-(b.finishMs??Infinity)||b.run.player.x-a.run.player.x);return{id:this.ticket.matchId,mode:'bots',trackName:this.run.track.name,playerCount:4,players:ordered.map((r,i)=>({you:r.seat===0,seat:r.seat,name:r.name,color:r.color,bot:r.bot,placement:i+1,finishMs:r.finishMs,forfeited:r.forfeited,score:Math.floor(r.run.score),distance:Math.floor(r.run.player.x/10),coins:r.run.coinsCollected,shots:r.run.shots,hits:r.run.hits,respawns:r.run.respawns,points:0}))};}
  }
  return{BotRace};
});
