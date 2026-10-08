(function(root,factory){
  const tracks=(typeof module==='object'&&module.exports)?require('./race-tracks.js'):root.VaultRaceTracks;
  const api=factory(tracks);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VaultRace=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Tracks){
  'use strict';
  const {getTrack,terrainAt,slopeAt,gapAt,mudAt,makeItems,clamp,PHYSICS}=Tracks;
  const TAU=Math.PI*2;
  const angleDelta=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const COINS_PER_SHOT=5;
  const SHOT_COOLDOWN=3.5;
  const MAX_BOOST_CHARGES=3;
  const MAX_SPEED=1180;
  const BOOST_SPEED=1450;
  // Coin shots leave the racer at 300 km/h on the HUD (speed × 0.1): fast enough
  // to close on a boosted leader. A light lock-on steers the coin's height toward
  // the nearest racer ahead (like a guided shell) but turns slowly enough to miss.
  const SHOT_SPEED=3000,SHOT_GRAVITY=900,SHOT_LIFE=1.6,SHOT_RANGE=3400,SHOT_GUIDE=2600;
  const G=PHYSICS.gravity;
  // Ramp lip timing: press within this many seconds before the lip for a perfect pop,
  // or within LATE_POP seconds after leaving it for a weaker late pop.
  const LIP_WINDOW=.22,LATE_POP=.12;
  // Landing quality thresholds: board-to-ground angle, and trajectory-to-ground angle (radians).
  const CLEAN_LANDING=.6,BAD_LANDING=.95,HARD_IMPACT=.8,HARD_NORMAL=1150;
  // Slipstream: tucked in behind another racer. Catch-up: distance behind the leader.
  const DRAFT_ACCEL=150,DRAFT_MAX=70,CATCHUP_MAX=55;

  class RaceRun{
    constructor(trackId){
      this.track=getTrack(trackId);this.trackId=this.track.id;
      this.ramps=this.track.ramps.map(r=>({...r,y:terrainAt(this.track,r.x),endY:terrainAt(this.track,r.end)}));
      this.gaps=this.track.gaps.map(g=>({...g}));this.balloons=this.track.balloons.map(b=>({...b}));this.mud=this.track.mud.map(m=>({...m}));this.rails=[];this.scenery=[];
      this.items=makeItems(this.track);this.events=[];this.time=0;this.score=0;this.coins=0;this.coinsCollected=0;this.boostCharges=0;this.shotCooldown=0;this.shots=0;this.hits=0;this.respawns=0;
      this.maxLives=3;this.lives=3;this.heartsCollected=0;this.redTokens=0;this.rushPickups=0;this.balloonBounces=0;this.badLandings=0;
      this.dead=false;this.finished=false;this.reason='';this.previousPlayer=null;this.sharedBoostMask=0;this.catchup=0;
      this.dog={active:false,distance:9999,warning:false};
      this.player={x:0,y:this.terrain(0),speed:360,vx:360,vy:0,angle:this.slope(0),grounded:true,rail:null,ramp:null,held:false,heldTime:0,airborne:0,turns:0,spin:0,coyote:.12,buffer:0,invulnerable:0,boost:0,rush:0,stagger:0,recovery:0,recoveryGap:null,flipStarted:false,respawnFreeze:0,
        lipQueued:false,lipWindow:0,lipRamp:-1,popped:false,skyLock:false,draft:0,inMud:false};
    }
    terrain(x){return terrainAt(this.track,x);}
    derivative(x){return (this.terrain(x+1)-this.terrain(x-1))*.5;}
    slope(x){return slopeAt(this.track,x);}
    gapAt(x){return gapAt(this.track,x);}
    mudAt(x){return mudAt(this.track,x);}
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
      for(const item of this.items)if(item.type==='boost'&&item.shared)item.hit=Boolean(this.sharedBoostMask&(1<<item.boostIndex));
    }
    // Set by the race host every tick: tucked behind a rival, and how far behind the leader.
    setDraft(on){if(on)this.player.draft=Math.max(this.player.draft,.25);}
    setCatchup(value){this.catchup=clamp(Number(value)||0,0,1);}
    press(){
      if(this.dead||this.finished)return;const p=this.player;if(p.held)return;p.held=true;p.heldTime=0;p.buffer=.14;
      // Just left a ramp lip: a late press still pops, but not as high.
      if(!p.grounded&&p.lipWindow>0&&!p.popped){
        const r=this.ramps[p.lipRamp];
        if(r){p.popped=true;p.lipWindow=0;p.buffer=0;p.vy-=r.pop*.65;p.timingJump=true;p.skyLock=r.kind==='mega';this.event('trick',{text:'LATE POP',points:25});return;}
      }
      if(p.grounded||p.coyote>0)this.jump();
    }
    release(){const p=this.player;p.held=false;p.heldTime=0;}
    jump(){
      const p=this.player;if(this.dead||this.finished||(!p.grounded&&p.coyote<=0))return;
      const face=p.grounded?this.ramps.find(r=>p.x>=r.x&&p.x<r.end):null;
      if(face){
        // On a ramp face: close to the lip queues a pop, too early wastes the launch.
        const toLip=(face.end-p.x)/Math.max(300,p.vx);
        if(toLip<=LIP_WINDOW){p.lipQueued=true;p.buffer=0;return;}
        p.buffer=0;p.grounded=false;p.ramp=null;p.coyote=0;p.timingJump=false;
        p.speed=Math.max(260,p.speed*.88);p.vx=p.speed;p.vy=-265;p.airborne=0;
        this.event('trick',{text:'EARLY JUMP · LAUNCH LOST',points:0,bad:true});this.event('jump',{x:p.x,y:p.y});return;
      }
      const slope=this.slope(p.x);
      const nearGap=this.gaps.some(g=>g.x-p.x>-20&&g.x-p.x<420);
      const nearMud=this.mud.some(m=>m.x-p.x>-60&&m.x-p.x<460);
      const nearLip=this.ramps.some(r=>Math.abs(r.end-p.x)<150);
      p.timingJump=nearGap||nearMud||nearLip||slope<-.12;
      // Hopping off a steep downhill throws away free acceleration.
      if(!p.timingJump&&slope>.22){p.speed=Math.max(260,p.speed*.95);this.event('trick',{text:'SCRUBBED JUMP',points:0,bad:true});}
      p.buffer=0;p.grounded=false;p.ramp=null;p.coyote=0;p.vy=Math.min(p.vy-(p.timingJump?340:265),-210);p.vx=Math.max(Math.min(p.vx,p.speed),p.speed*Math.cos(slope));p.airborne=0;this.event('jump',{x:p.x,y:p.y});
    }
    skillBoost(seconds,kick){const p=this.player;p.boost=Math.max(p.boost,seconds);p.speed=Math.min(BOOST_SPEED,Math.max(p.speed,p.vx)+kick);p.vx=Math.max(p.vx,p.speed);}
    spendShot(){if(this.coins<COINS_PER_SHOT||this.shotCooldown>0||this.dead||this.finished)return false;this.coins-=COINS_PER_SHOT;this.shotCooldown=SHOT_COOLDOWN;this.shots++;this.event('shot',{x:this.player.x,y:this.player.y});return true;}
    applyHit(){const p=this.player;if(this.dead||this.finished||p.invulnerable>0)return false;const before=p.speed;p.speed=Math.max(260,p.speed*.72);p.vx=Math.min(p.vx,p.speed);p.stagger=.38;p.invulnerable=.70;p.boost=0;this.event('stumble',{x:p.x,y:p.y,heavy:false,material:'metal',kind:'coin-shot',lifeLost:false,lives:this.lives,loss:before-p.speed});return true;}
    claimBoost(){if(this.dead||this.finished||this.boostCharges>=MAX_BOOST_CHARGES)return false;this.boostCharges++;this.rushPickups++;this.event('boost-ready',{charges:this.boostCharges});return true;}
    activateBoost(){if(this.dead||this.finished||this.boostCharges<=0)return false;this.boostCharges--;this.applyBoost();return true;}
    applyBoost(){const p=this.player;if(this.dead||this.finished)return;p.speed=Math.max(p.speed,BOOST_SPEED);p.vx=Math.max(p.vx,BOOST_SPEED*.94);p.boost=2.8;this.event('rush',{x:p.x,y:p.y,seconds:2.8});}
    finish(){if(this.finished)return;this.finished=true;this.reason='FINISH';this.release();this.event('finish',{x:this.player.x,y:this.player.y});}
    respawn(gap){
      const p=this.player;this.respawns++;p.timingJump=false;p.x=gap.respawnX;p.y=this.terrain(p.x);p.speed=285;p.vx=285;p.vy=0;p.angle=this.slope(p.x);p.grounded=true;p.ramp=null;p.rail=null;p.spin=0;p.turns=0;p.airborne=0;p.respawnFreeze=.75;p.invulnerable=1.2;p.stagger=.25;
      p.lipQueued=false;p.lipWindow=0;p.popped=false;p.skyLock=false;this.release();this.event('respawn',{x:p.x,y:p.y,gap:gap.id});
    }
    groundMax(){const p=this.player;return (p.boost>0?BOOST_SPEED:MAX_SPEED+this.catchup*CATCHUP_MAX)+(p.draft>0?DRAFT_MAX:0);}
    // Board-to-ground alignment and impact decide how much speed a landing keeps.
    land(surfaceAngle,kind){
      const p=this.player,mismatch=Math.abs(angleDelta(p.angle-surfaceAngle));
      // How steeply the racer meets the ground: 0 = skimming onto a matching slope.
      const impact=Math.max(0,Math.atan2(p.vy,Math.max(1,p.vx))-surfaceAngle);
      // Meeting a matching downslope keeps (and can add a little) speed; a fall
      // never converts into more than a modest gain.
      const along=Math.min(Math.hypot(p.vx,p.vy)*(.55+.45*Math.cos(impact)),Math.abs(p.vx)+180);
      const normal=Math.hypot(p.vx,p.vy)*Math.sin(impact);
      const turns=Math.floor(p.spin/TAU+.02),clean=mismatch<CLEAN_LANDING;
      let speed=Math.max(170,kind==='ground'?along:p.vx),label='',bad=false;
      if(mismatch>BAD_LANDING){speed*=.62;p.stagger=.45;p.boost=0;label='BAD LANDING';bad=true;}
      else if(!clean){speed*=.88;p.stagger=.2;label='WOBBLY LANDING';bad=true;}
      if(kind==='ground'&&(impact>HARD_IMPACT||normal>HARD_NORMAL)){const loss=Math.min(.25,Math.max((impact-HARD_IMPACT)*.7,(normal-HARD_NORMAL)/2500));speed*=1-loss;if(loss>.04){label=label||'HARD LANDING';bad=true;}}
      if(bad){this.badLandings++;this.event('stumble',{x:p.x,y:p.y,heavy:mismatch>BAD_LANDING,material:'stone',kind:'landing',lifeLost:false,lives:this.lives});this.event('trick',{text:label,points:0,bad:true});}
      return {speed,clean,turns};
    }
    nextBalloon(x){for(const b of this.balloons)if(b.x>x-30)return b.x-x<2800?b:null;return null;}
    step(dt){
      if(this.dead||this.finished)return;
      const p=this.player;this.previousPlayer={x:p.x,y:p.y,speed:p.speed,vx:p.vx,vy:p.vy,angle:p.angle,grounded:p.grounded};
      this.time+=dt;this.shotCooldown=Math.max(0,this.shotCooldown-dt);p.buffer=Math.max(0,p.buffer-dt);p.coyote=Math.max(0,p.coyote-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.boost=Math.max(0,p.boost-dt);p.stagger=Math.max(0,p.stagger-dt);p.respawnFreeze=Math.max(0,p.respawnFreeze-dt);p.lipWindow=Math.max(0,p.lipWindow-dt);p.draft=Math.max(0,p.draft-dt);if(p.held)p.heldTime+=dt;
      const previousX=p.x,previousY=p.y;
      if(p.respawnFreeze>0){p.vx=0;p.vy=0;return;}
      if(p.grounded){
        let angle=this.slope(p.x);
        const mud=this.mudAt(p.x);if(mud&&!p.inMud)this.event('mud',{x:p.x,y:p.y});p.inMud=Boolean(mud);
        let accel=760*Math.sin(angle)*.50+52-p.speed*.045+(p.boost>0?190:0)+(p.draft>0&&!mud?DRAFT_ACCEL:0);
        let max=this.groundMax();
        if(mud){accel-=p.speed*.9;max=Math.min(max,p.boost>0?PHYSICS.mudMax+260:PHYSICS.mudMax);}
        // Overspeed (after a boost, a big landing or entering mud) bleeds off smoothly.
        if(p.speed>max)p.speed=max+(p.speed-max)*Math.exp(-dt*(mud?3.0:2.2));
        else p.speed=Math.min(max,p.speed+accel*dt);
        p.speed=Math.max(p.speed,p.stagger>0?220:170);
        p.vx=p.speed*Math.cos(angle);p.vy=p.speed*Math.sin(angle);p.x+=p.vx*dt;
        const takeoff=this.ramps.find(r=>previousX<r.end&&p.x>=r.end);
        const ramp=this.ramps.find(r=>p.x>=r.x&&p.x<r.end);
        if(takeoff){
          p.grounded=false;p.ramp=null;p.coyote=0;p.vx=Math.max(p.vx,p.speed*.94);p.vy=-takeoff.launch;p.airborne=0;p.popped=false;p.skyLock=false;
          if(p.lipQueued){
            p.popped=true;p.vy-=takeoff.pop;p.timingJump=true;p.skyLock=takeoff.kind==='mega';
            this.score+=60;this.skillBoost(.5,55);this.event('trick',{text:takeoff.kind==='mega'?'PERFECT POP · SKY ROUTE':'PERFECT POP',points:60});
          }else{p.lipWindow=LATE_POP;p.lipRamp=this.ramps.indexOf(takeoff);}
          p.lipQueued=false;this.event('jump',{x:p.x,y:p.y});
        }
        else if(ramp){p.ramp=ramp;p.y=this.terrain(p.x);}
        else if(this.gapAt(p.x)){p.grounded=false;p.ramp=null;p.lipQueued=false;p.vx=Math.max(p.vx,p.speed);p.vy-=25;p.airborne=0;}
        else {p.y=this.terrain(p.x);p.lipQueued=false;}
        p.angle=angle;if(p.grounded)p.coyote=.12;
      }else{
        p.airborne+=dt;p.inMud=false;
        // Balloon catch assist: once on a sky route, steer gently toward the next crown.
        if(p.skyLock){
          const b=this.nextBalloon(p.x);
          if(b){
            const disc=p.vy*p.vy+2*G*(b.y-p.y);
            if(disc>0){const t=(-p.vy+Math.sqrt(disc))/G;if(t>.04){const diff=(b.x-p.x)/t-p.vx;if(Math.abs(diff)<p.vx*.45)p.vx+=clamp(diff,-760*dt,760*dt);}}
          }
        }
        p.vy+=G*dt;p.vx=clamp(p.vx+PHYSICS.airAccel*dt,170,BOOST_SPEED);p.x+=p.vx*dt;p.y+=p.vy*dt;p.speed=p.vx;
        if(p.held&&p.heldTime>.14){if(!p.flipStarted){p.flipStarted=true;this.event('flip-start',{x:p.x,y:p.y});}const rot=5.0*dt;p.angle-=rot;p.spin+=rot;}else{const target=p.skyLock?0:this.slope(p.x+p.vx*.13);p.angle+=angleDelta(target-p.angle)*Math.min(1,8.5*dt);}
        // Balloon crowns bounce racers that come down on top of them.
        if(p.vy>0)for(const b of this.balloons){
          if(Math.abs(b.x-p.x)>PHYSICS.balloonRadius)continue;
          if(previousY<=b.y+4&&p.y>=b.y-2){this.bounce(b);break;}
        }
        if(!p.grounded){
          const gap=this.gapAt(p.x);
          if(!gap&&p.vy>-40&&p.y>=this.terrain(p.x)){
            const surface=this.slope(p.x),result=this.land(surface,'ground');
            p.y=this.terrain(p.x);p.grounded=true;p.coyote=.12;p.ramp=null;p.skyLock=false;p.popped=false;p.lipWindow=0;
            p.speed=Math.min(result.speed,BOOST_SPEED);p.vx=p.speed*Math.cos(surface);p.vy=p.speed*Math.sin(surface);
            if(result.turns>0&&result.clean&&p.airborne>.35){this.score+=result.turns*250;this.skillBoost(Math.min(2,.8+result.turns*.4),90+Math.min(3,result.turns)*55);this.event('trick',{text:result.turns>1?result.turns+'× BACKFLIP · BOOST':'BACKFLIP · BOOST',points:result.turns*250});}
            else if(p.timingJump&&result.clean&&p.airborne>.35){this.score+=75;this.skillBoost(.85,100);this.event('trick',{text:'TIMED JUMP · BOOST',points:75});}
            p.timingJump=false;p.angle=surface;
            p.spin=0;p.turns=0;p.airborne=0;p.flipStarted=false;this.event('land',{x:p.x,y:p.y,clean:result.clean});
            if(p.buffer>0)this.jump();
          }
          // Missing a gap costs time and momentum, but never ends the race.
          const crossed=this.gaps.find(g=>previousX<g.end&&p.x>=g.end&&previousY>this.terrain(Math.max(g.x,previousX))+90);
          if(crossed||p.y>this.terrain(p.x)+420){const active=gap||this.gaps.find(g=>p.x>=g.x-120&&p.x<=g.end+180);if(active){this.respawn(active);return;}}
        }
      }
      for(const item of this.items){
        if(item.hit)continue;
        if(item.type==='boost'){
          if(Math.abs(item.x-p.x)<40&&Math.abs(item.y-(p.y-17))<48){
            if(this.claimBoost()){item.hit=true;this.skillBoost(.85,105*(1+this.catchup*.8));this.event('rush',{x:p.x,y:p.y,seconds:.85});}
          }continue;
        }
        if(item.type!=='coin')continue;if(Math.abs(item.x-p.x)>34)continue;
        if(Math.abs(item.y-(p.y-17))<38){item.hit=true;this.coins++;this.coinsCollected++;this.score+=30;this.event('coin',{x:item.x,y:item.y});}
      }
      this.score+=(p.x-previousX)*.02;
      if(p.x>=this.track.finishX)this.finish();
    }
    bounce(b){
      const p=this.player,mismatch=Math.abs(angleDelta(p.angle));
      const turns=Math.floor(p.spin/TAU+.02),storm=b.kind==='storm';
      p.y=b.y;this.balloonBounces++;p.lipWindow=0;
      if(mismatch>BAD_LANDING){
        // Landed on the crown mid-flip: slide off and drop to the ground route.
        p.vy=-200;p.vx=Math.max(400,p.vx*.85);p.skyLock=false;p.stagger=.3;
        this.event('trick',{text:'SLIPPED OFF',points:0,bad:true});this.event('balloon',{x:p.x,y:p.y,kind:b.kind,slipped:true});
      }else{
        p.vy=-(storm?PHYSICS.bounceStorm:PHYSICS.bounceTail);
        p.vx=storm?Math.max(450,p.vx+PHYSICS.kickStorm):Math.min(BOOST_SPEED,p.vx+PHYSICS.kickTail);
        p.skyLock=true;this.score+=storm?10:40;
        if(turns>0&&mismatch<CLEAN_LANDING){this.score+=turns*250;this.skillBoost(Math.min(2,.8+turns*.4),60+Math.min(3,turns)*40);this.event('trick',{text:(turns>1?turns+'× ':'')+'SKY FLIP · BOOST',points:turns*250});}
        this.event('balloon',{x:p.x,y:p.y,kind:b.kind});
      }
      p.speed=p.vx;p.angle=0;p.spin=0;p.turns=0;p.airborne=0;p.flipStarted=false;p.timingJump=false;
    }
    snapshot(){const p=this.player;return{x:p.x,y:p.y,speed:p.speed,vx:p.vx,vy:p.vy,angle:p.angle,grounded:p.grounded,held:p.held,heldTime:p.heldTime,airborne:p.airborne,spin:p.spin,turns:p.turns,coyote:p.coyote,buffer:p.buffer,flipStarted:p.flipStarted,timingJump:Boolean(p.timingJump),invulnerable:p.invulnerable,boost:p.boost,stagger:p.stagger,respawnFreeze:p.respawnFreeze,lipQueued:p.lipQueued,lipWindow:p.lipWindow,lipRamp:p.lipRamp,popped:p.popped,skyLock:p.skyLock,draft:p.draft,inMud:p.inMud,catchup:this.catchup,coins:this.coins,coinsCollected:this.coinsCollected,coinHits:this.items.filter(i=>i.type==='coin'&&i.hit).map(i=>i.id),boostHits:this.items.filter(i=>i.type==='boost'&&i.hit).map(i=>i.id),boostCharges:this.boostCharges,shotCooldown:this.shotCooldown,shots:this.shots,hits:this.hits,respawns:this.respawns,balloonBounces:this.balloonBounces,badLandings:this.badLandings,finished:this.finished,rawScore:this.score,score:Math.floor(this.score)};}
    applySnapshot(s){if(!s)return;const p=this.player;this.previousPlayer={...p};for(const k of ['x','y','speed','vx','vy','angle','grounded','held','heldTime','airborne','spin','turns','coyote','buffer','flipStarted','timingJump','invulnerable','boost','stagger','respawnFreeze','lipQueued','lipWindow','lipRamp','popped','skyLock','draft','inMud'])if(s[k]!==undefined)p[k]=s[k];for(const k of ['coins','coinsCollected','boostCharges','shotCooldown','shots','hits','respawns','balloonBounces','badLandings','finished','score','catchup'])if(s[k]!==undefined)this[k]=s[k];if(Number.isFinite(s.rawScore))this.score=s.rawScore;if(Array.isArray(s.coinHits)){const hit=new Set(s.coinHits);for(const i of this.items)if(i.type==='coin')i.hit=hit.has(i.id);}if(Array.isArray(s.boostHits)){const hit=new Set(s.boostHits);for(const i of this.items)if(i.type==='boost'&&!i.shared)i.hit=hit.has(i.id);}}
  }
  // A coin leaves the front of the racer wherever they are — on the ground,
  // mid-jump or bouncing across balloons — aimed along their travel.
  function coinShot(run,identity={}){
    const p=run.player,grounded=p.grounded;
    const travel=grounded?run.slope(p.x):Math.atan2(p.vy,Math.max(200,p.vx));
    const aim=clamp(travel,-.35,.35);
    const body=grounded?run.slope(p.x):clamp(travel,-.6,.6);
    const x=p.x+30*Math.cos(body)+20*Math.sin(body),y=p.y+30*Math.sin(body)-20*Math.cos(body);
    return{...identity,x,y,previousX:x,previousY:y,vx:SHOT_SPEED,vy:grounded?0:SHOT_SPEED*Math.tan(aim)*.5,mode:'air',angle:0,bounce:0,life:SHOT_LIFE};
  }
  // The nearest unfinished racer ahead within range. racers: [{seat,run}].
  function pickShotTarget(shooter,racers){
    let best=null;
    for(const r of racers){if(!r||r.run===shooter||r.run.finished||r.run.dead)continue;const dx=r.run.player.x-shooter.player.x;if(dx>0&&dx<SHOT_RANGE&&(!best||dx<best.dx))best={seat:r.seat,dx};}
    return best?best.seat:null;
  }
  function stepCoinShot(track,q,dt,target){
    q.previousX=q.x;q.previousY=q.y;q.life-=dt;q.x+=q.vx*dt;q.angle=(q.angle+q.vx/8*dt)%TAU;
    const guide=target&&target.x>q.x-10&&target.x-q.x<SHOT_RANGE;
    if(guide&&q.mode==='roll'&&target.y-22<q.y-60){q.mode='air';q.vy=0;}
    if(q.mode!=='roll'){
      if(guide){
        // Steer toward the height that meets the target's body when we reach them.
        const t=Math.max(.05,(target.x-q.x)/q.vx),want=(target.y-22-q.y)/t-SHOT_GRAVITY*t*.5;
        q.vy+=clamp(want-q.vy,-SHOT_GUIDE*dt,SHOT_GUIDE*dt);
      }
      q.vy=(q.vy||0)+SHOT_GRAVITY*dt;q.y+=q.vy*dt;
      const ground=terrainAt(track,q.x);
      if(!gapAt(track,q.x)&&q.y>=ground-8){q.mode='roll';q.vy=0;q.bounce=0;q.y=ground-8;}
      else if(q.y>ground+300)q.life=0;
    }else if(gapAt(track,q.x)){q.mode='air';q.vy=0;}
    else{q.bounce=(q.bounce+dt*10)%TAU;q.y=terrainAt(track,q.x)-8-Math.abs(Math.sin(q.bounce))*18;}
    return q.life>0;
  }
  // Swept test so a 150 km/h coin cannot tunnel through a racer between ticks.
  function shotHitsRacer(q,p){
    const x0=Number.isFinite(q.previousX)?q.previousX:q.x,y0=Number.isFinite(q.previousY)?q.previousY:q.y;
    for(let i=0;i<=4;i++){const t=i/4,x=x0+(q.x-x0)*t,y=y0+(q.y-y0)*t;if(Math.abs(p.x-x)<32&&Math.abs((p.y-20)-y)<46)return true;}
    return false;
  }
  // Slipstream rule shared by the server and local bot races.
  function draftingBehind(me,other){const dx=other.x-me.x;return dx>60&&dx<460&&Math.abs(other.y-me.y)<170;}
  function catchupFor(leaderX,x){return clamp((leaderX-x-500)/5000,0,1);}
  function applyPackRules(runs){
    const live=runs.filter(r=>r&&!r.finished&&!r.dead);if(!live.length)return;
    const leaderX=Math.max(...live.map(r=>r.player.x));
    for(const r of live){r.setCatchup(catchupFor(leaderX,r.player.x));if(live.some(o=>o!==r&&draftingBehind(r.player,o.player)))r.setDraft(true);}
  }
  return {RaceRun,coinShot,stepCoinShot,pickShotTarget,shotHitsRacer,SHOT_RANGE,applyPackRules,draftingBehind,catchupFor,COINS_PER_SHOT,SHOT_COOLDOWN,SHOT_SPEED,MAX_BOOST_CHARGES,MAX_SPEED,BOOST_SPEED,VERSION:'race-web-11-polish'};
});
