(function(root,factory){
  const Race=typeof module==='object'&&module.exports?require('./race-engine.js'):root.VaultRace;
  const api=factory(Race);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.VaultBotRace=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Race){
  'use strict';
  class BotRace{
    constructor(ticket){
      this.ticket=ticket;this.tick=0;this.boostMask=0;this.projectiles=[];this.events=[];this.finished=false;this.firstFinish=null;this.shotId=0;
      this.players=Array.from({length:4},(_,seat)=>({seat,name:seat?'BOT '+seat:ticket.name||'YOU',color:seat?['','#e8a13a','#ab47bc','#3ddc54'][seat]:ticket.color||'#f26b35',bot:seat>0,run:new Race.RaceRun(ticket.trackId),finishMs:null,forfeited:false}));
      this.run=this.players[0].run;
    }
    fire(seat=0){const racer=this.players[seat];this.projectiles.push(Race.coinShot(racer.run,{id:'local-'+this.shotId++,seat,color:racer.color}));}
    drive(racer){
      const run=racer.run,p=run.player;
      const gap=run.gaps.find(g=>g.x>p.x&&g.x-p.x<210+racer.seat*30);
      if(p.grounded&&gap&&!p.held){run.press();racer.releaseAt=this.tick+8;}
      if(racer.releaseAt&&this.tick>=racer.releaseAt){run.release();racer.releaseAt=0;}
      if(!p.grounded&&p.airborne>.15&&p.vy<0&&this.tick%180===racer.seat*7){run.press();racer.releaseAt=this.tick+30+racer.seat*6;}
      if(run.boostCharges&&p.boost<=0&&p.grounded&&this.tick%90===racer.seat*9)run.activateBoost();
      if(run.coins>=Race.COINS_PER_SHOT&&this.tick%420===racer.seat*17&&this.run.player.x>p.x&&this.run.player.x-p.x<600&&run.spendShot())this.fire(racer.seat);
    }
    step(){
      if(this.finished)return;const dt=1/60;
      for(const r of this.players){if(r.finishMs!==null)continue;if(r.bot)this.drive(r);r.run.step(dt);if(r.bot)r.run.drainEvents();if(r.run.finished){r.finishMs=Math.round((this.tick+1)/60*1000);this.firstFinish??=this.tick;}}
      const racers=this.players.filter(r=>r.finishMs===null).sort((a,b)=>b.run.player.x-a.run.player.x||a.seat-b.seat);
      for(const q of this.projectiles){q.previousX=q.x;q.previousY=q.y;if(!Race.stepCoinShot(this.run.track,q,dt))continue;for(const r of racers){const p=r.run.player;if(r.seat!==q.seat&&Math.abs(p.x-q.x)<32&&Math.abs(p.y-20-q.y)<46&&r.run.applyHit()){q.life=0;this.players[q.seat].run.hits++;break;}}}
      this.projectiles=this.projectiles.filter(q=>q.life>0);this.tick++;
      if(this.players.every(r=>r.finishMs!==null)||this.tick>=110*60||(this.run.finished&&this.tick-this.firstFinish>8*60)){this.finished=true;for(const r of this.players)if(r.finishMs===null)r.forfeited=true;}
    }
    snapshot(){return{matchId:this.ticket.matchId,tick:this.tick,status:this.finished?'finished':'running',players:this.players.map(r=>({seat:r.seat,name:r.name,color:r.color,bot:r.bot,finishMs:r.finishMs,forfeited:r.forfeited,...r.run.snapshot()}))};}
    visualPlayers(alpha){return this.players.slice(1).map(r=>{const p=r.run.player,old=r.run.previousPlayer;const out={seat:r.seat,name:r.name,color:r.color,finishMs:r.finishMs,forfeited:r.forfeited,...p};if(old){for(const k of ['x','y'])out[k]=old[k]+(p[k]-old[k])*alpha;out.angle=old.angle+Math.atan2(Math.sin(p.angle-old.angle),Math.cos(p.angle-old.angle))*alpha;}return out;});}
    result(){const ordered=[...this.players].sort((a,b)=>(a.finishMs??Infinity)-(b.finishMs??Infinity)||b.run.player.x-a.run.player.x);return{id:this.ticket.matchId,mode:'bots',trackName:this.run.track.name,playerCount:4,players:ordered.map((r,i)=>({you:r.seat===0,seat:r.seat,name:r.name,color:r.color,bot:r.bot,placement:i+1,finishMs:r.finishMs,forfeited:r.forfeited,score:Math.floor(r.run.score),distance:Math.floor(r.run.player.x/10),coins:r.run.coinsCollected,shots:r.run.shots,hits:r.run.hits,respawns:r.run.respawns,points:0}))};}
  }
  return{BotRace};
});
