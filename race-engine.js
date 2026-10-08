(function(root,factory){
  const tracks=(typeof module==='object'&&module.exports)?require('./race-tracks.js'):root.VaultRaceTracks;
  const api=factory(tracks);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VaultRace=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Tracks){
  'use strict';
  const {getTrack,terrainAt,slopeAt,gapAt,makeItems,clamp}=Tracks;
  const TAU=Math.PI*2;
  const angleDelta=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const COINS_PER_SHOT=5;
  const MAX_SPEED=940;
  const BOOST_SPEED=1040;

  class RaceRun{
    constructor(trackId){
      this.track=getTrack(trackId);this.trackId=this.track.id;
      this.ramps=this.track.ramps.map(r=>({...r,y:terrainAt(this.track,r.x),endY:terrainAt(this.track,r.end)}));
      this.gaps=this.track.gaps.map(g=>({...g}));this.rails=[];this.scenery=[];
      this.items=makeItems(this.track);this.events=[];this.time=0;this.score=0;this.coins=0;this.coinsCollected=0;this.boostCharges=0;this.shots=0;this.hits=0;this.respawns=0;
      this.maxLives=3;this.lives=3;this.heartsCollected=0;this.redTokens=0;this.rushPickups=0;
      this.dead=false;this.finished=false;this.reason='';this.previousPlayer=null;this.sharedBoostMask=0;
      this.dog={active:false,distance:9999,warning:false};
      this.player={x:0,y:this.terrain(0),speed:360,vx:360,vy:0,angle:this.slope(0),grounded:true,rail:null,ramp:null,held:false,heldTime:0,airborne:0,turns:0,spin:0,coyote:.12,buffer:0,invulnerable:0,boost:0,rush:0,stagger:0,recovery:0,recoveryGap:null,flipStarted:false,respawnFreeze:0};
    }
    terrain(x){return terrainAt(this.track,x);}
    derivative(x){return (this.terrain(x+1)-this.terrain(x-1))*.5;}
    slope(x){return slopeAt(this.track,x);}
    gapAt(x){return gapAt(this.track,x);}
    biome(){return this.track.biome;}
    biomeTransition(){return {from:this.track.biome,to:this.track.biome,mix:0};}
    terrainRandom(cell,salt){let n=Math.imul(cell|0,374761393)^Math.imul(this.track.index+1,668265263)^salt;n=Math.imul(n^n>>>13,1274126177);return((n^n>>>16)>>>0)/4294967296;}
    railY(){return 0;} railSlope(){return 0;}
    rampLift(r,x){
      if(x<r.x||x>r.recovery)return 0;const len=r.end-r.x;
      if(x<=r.end){const t=(x-r.x)/len;return r.height*t*t*(3-2*t);}const t=(x-r.end)/(r.recovery-r.end);return r.height*(1-(t*t*(3-2*t)));
    }
    rampY(r,x){return terrainAt(this.track,x);}
    rampSlope(r,x){return Math.atan((this.rampY(r,x+1)-this.rampY(r,x-1))*.5);}
    event(type,data={}){this.events.push({type,...data});}
    drainEvents(){const out=this.events;this.events=[];return out;}
    syncBoostMask(mask){
      this.sharedBoostMask=mask|0;
      for(const item of this.items)if(item.type==='boost')item.hit=Boolean(this.sharedBoostMask&(1<<item.boostIndex));
    }
    press(){if(this.dead||this.finished)return;const p=this.player;if(p.held)return;p.held=true;p.heldTime=0;p.buffer=.14;if(p.grounded||p.coyote>0)this.jump();}
    release(){const p=this.player;p.held=false;p.heldTime=0;}
    jump(){const p=this.player;if(this.dead||this.finished||(!p.grounded&&p.coyote<=0))return;p.grounded=false;p.ramp=null;p.coyote=0;p.vy-=245;p.vx=Math.max(p.vx,p.speed);p.airborne=0;this.event('jump',{x:p.x,y:p.y});}
    spendShot(){if(this.coins<COINS_PER_SHOT||this.dead||this.finished)return false;this.coins-=COINS_PER_SHOT;this.shots++;this.event('shot',{x:this.player.x,y:this.player.y});return true;}
    applyHit(){const p=this.player;if(this.dead||this.finished||p.invulnerable>0)return false;const before=p.speed;p.speed=Math.max(260,p.speed*.72);p.vx=Math.min(p.vx,p.speed);p.stagger=.38;p.invulnerable=.70;p.boost=0;this.event('stumble',{x:p.x,y:p.y,heavy:false,material:'metal',kind:'coin-shot',lifeLost:false,lives:this.lives,loss:before-p.speed});return true;}
    claimBoost(){if(this.dead||this.finished||this.boostCharges>=2)return false;this.boostCharges++;this.rushPickups++;this.event('boost-ready',{charges:this.boostCharges});return true;}
    activateBoost(){if(this.dead||this.finished||this.boostCharges<=0)return false;this.boostCharges--;this.applyBoost();return true;}
    applyBoost(){const p=this.player;if(this.dead||this.finished)return;p.speed=Math.max(p.speed,BOOST_SPEED);p.vx=Math.max(p.vx,BOOST_SPEED*.94);p.boost=2.8;this.event('rush',{x:p.x,y:p.y,seconds:2.8});}
    finish(){if(this.finished)return;this.finished=true;this.reason='FINISH';this.release();this.event('finish',{x:this.player.x,y:this.player.y});}
    respawn(gap){
      const p=this.player;this.respawns++;p.x=gap.respawnX;p.y=this.terrain(p.x);p.speed=285;p.vx=285;p.vy=0;p.angle=this.slope(p.x);p.grounded=true;p.ramp=null;p.rail=null;p.spin=0;p.turns=0;p.airborne=0;p.respawnFreeze=.75;p.invulnerable=1.2;p.stagger=.25;this.release();this.event('respawn',{x:p.x,y:p.y,gap:gap.id});
    }
    step(dt){
      if(this.dead||this.finished)return;
      const p=this.player;this.previousPlayer={x:p.x,y:p.y,speed:p.speed,vx:p.vx,vy:p.vy,angle:p.angle,grounded:p.grounded};
      this.time+=dt;p.buffer=Math.max(0,p.buffer-dt);p.coyote=Math.max(0,p.coyote-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.boost=Math.max(0,p.boost-dt);p.stagger=Math.max(0,p.stagger-dt);p.respawnFreeze=Math.max(0,p.respawnFreeze-dt);if(p.held)p.heldTime+=dt;
      const previousX=p.x,previousY=p.y;
      if(p.respawnFreeze>0){p.vx=0;p.vy=0;return;}
      if(p.grounded){
        let angle=this.slope(p.x);
        const accel=700*Math.sin(angle)*.43+38-p.speed*.048+(p.boost>0?145:0);
        const max=p.boost>0?BOOST_SPEED:MAX_SPEED;
        p.speed=clamp(p.speed+accel*dt,p.stagger>0?220:170,max);p.vx=p.speed*Math.cos(angle);p.vy=p.speed*Math.sin(angle);p.x+=p.vx*dt;
        const ramp=this.ramps.find(r=>previousX<=r.x+10&&p.x>=r.x&&p.x<r.end);
        if(ramp){p.ramp=ramp;p.y=this.terrain(p.x);}
        else if(this.gapAt(p.x)){p.grounded=false;p.ramp=null;p.vx=Math.max(p.vx,p.speed);p.vy-=25;p.airborne=0;}
        else {p.y=this.terrain(p.x);}
        p.angle=angle;p.coyote=.12;
      }else{
        p.airborne+=dt;p.vy+=690*dt;p.vx=clamp(p.vx+8*dt,170,p.boost>0?BOOST_SPEED:MAX_SPEED);p.x+=p.vx*dt;p.y+=p.vy*dt;p.speed=p.vx;
        if(p.held&&p.heldTime>.14){if(!p.flipStarted){p.flipStarted=true;this.event('flip-start',{x:p.x,y:p.y});}const rot=5.0*dt;p.angle-=rot;p.spin+=rot;}else{const target=this.slope(p.x+p.vx*.13);p.angle+=angleDelta(target-p.angle)*Math.min(1,8.5*dt);}
        const gap=this.gapAt(p.x);
        if(!gap&&p.vy>-40&&p.y>=this.terrain(p.x)){
          p.y=this.terrain(p.x);p.grounded=true;p.coyote=.12;p.ramp=null;
          const turns=Math.floor(p.spin/TAU+.02);if(turns>0){this.score+=turns*250;this.event('trick',{text:turns>1?turns+'× BACKFLIP':'BACKFLIP',points:turns*250});}
          p.spin=0;p.turns=0;p.airborne=0;p.flipStarted=false;this.event('land',{x:p.x,y:p.y,clean:true});
        }
        // Missing a gap costs time and momentum, but never ends the race.
        const crossed=this.gaps.find(g=>previousX<g.end&&p.x>=g.end&&previousY>this.terrain(Math.max(g.x,previousX))+90);
        if(crossed||p.y>this.terrain(p.x)+420){const active=gap||this.gaps.find(g=>p.x>=g.x-120&&p.x<=g.end+180);if(active){this.respawn(active);return;}}
      }
      for(const item of this.items){
        if(item.hit||item.type!=='coin')continue;if(Math.abs(item.x-p.x)>34)continue;
        if(Math.abs(item.y-(p.y-17))<38){item.hit=true;this.coins++;this.coinsCollected++;this.score+=30;this.event('coin',{x:item.x,y:item.y});}
      }
      this.score+=(p.x-previousX)*.02;
      if(p.x>=this.track.finishX)this.finish();
    }
    snapshot(){const p=this.player;return{x:p.x,y:p.y,speed:p.speed,vx:p.vx,vy:p.vy,angle:p.angle,grounded:p.grounded,held:p.held,heldTime:p.heldTime,airborne:p.airborne,invulnerable:p.invulnerable,boost:p.boost,stagger:p.stagger,respawnFreeze:p.respawnFreeze,coins:this.coins,coinsCollected:this.coinsCollected,boostCharges:this.boostCharges,shots:this.shots,hits:this.hits,respawns:this.respawns,finished:this.finished,score:Math.floor(this.score)};}
    applySnapshot(s){if(!s)return;const p=this.player;this.previousPlayer={...p};for(const k of ['x','y','speed','vx','vy','angle','grounded','held','heldTime','airborne','invulnerable','boost','stagger','respawnFreeze'])if(s[k]!==undefined)p[k]=s[k];for(const k of ['coins','coinsCollected','boostCharges','shots','hits','respawns','finished','score'])if(s[k]!==undefined)this[k]=s[k];}
  }
  return {RaceRun,COINS_PER_SHOT,MAX_SPEED,BOOST_SPEED,VERSION:'race-web-5'};
});
