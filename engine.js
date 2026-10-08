(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VaultRush = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const SPEED_LIMITS=Object.freeze({ground:900,air:930,landing:920,rush:1280,rushFloor:1010,rushStart:1120});
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const angleDelta = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  function random(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  class Run {
    constructor(seed) {
      this.seed = (seed || Date.now()) >>> 0;
      this.random = random(this.seed);
      this.mode='vault';
      this.theme=Math.floor(this.terrainRandom(0,734879)*4);
      // Coordinate-based terrain noise has its own seed: looking farther ahead
      // never consumes item RNG or changes the server's replay.
      this.phase = this.random() * 0.18;
      this.profile = {
        grade: .25 + this.random() * .045,
        longWave: 2200 + this.random() * 550,
        shortWave: 880 + this.random() * 240,
        longHeight: 130 + this.random() * 30,
        shortHeight: 62 + this.random() * 18,
        shortPhase: .14 + this.random() * .24
      };
      this.terrainSections=[];
      this.terrainCursor=1800;
      this.terrainDrop=0;
      this.lastPattern = -1;
      this.items = [];
      this.rails = [];
      this.ramps = [];
      this.gaps = [];
      this.scenery = [];
      this.encounters = [];
      this.patternBag = [];
      this.lastPressure = 0;
      this.lastHazard = 0;
      this.lastCargo = 0;
      this.lastSky = 0;
      this.lastClimbBoost = 0;
      this.events = [];
      this.nextFeature = 560 + this.random() * 280;
      this.nextScenery = -50;
      this.feature = 0;
      this.redSites = 0;
      this.lastRedSite = 0;
      this.lastRushSite = 0;
      this.redTokens = 0;
      this.rushPickups = 0;
      this.boostsCollected = 0;
      this.maxLives = 3;
      this.lives = this.maxLives;
      this.heartsCollected = 0;
      this.heartSites = 0;
      this.nextHeartSite = 8000 + this.terrainRandom(0, 86028121) * 6500;
      this.player = {
        x: 0, y: this.terrain(0), speed: 310, vx: 310, vy: 0,
        angle: this.slope(0), grounded: true, rail: null, ramp: null,
        held: false, heldTime: 0, airborne: 0, turns: 0, spin: 0,
        coyote: 0.12, buffer: 0, invulnerable: 0, boost: 1.8, rush: 0, stagger: 0, recovery: 0, recoveryGap: null, flipStarted: false, takeoffBonus: 0,
        mistakes:0,lastMistake:-100,stall:0
      };
      this.time = 0;
      this.coins = 0;
      this.score = 0;
      this.combo = 1;
      this.dead = false;
      this.reason = '';
      this.previousPlayer = null;
      this.slowTime = 0;
      this.dog = { active: false, distance: 480, warning: false };
      this.generate(2700);
    }

    terrainRandom(cell, salt) {
      let n = Math.imul(cell | 0, 374761393) ^ Math.imul(this.seed, 668265263) ^ salt;
      n = Math.imul(n ^ n >>> 13, 1274126177);
      return ((n ^ n >>> 16) >>> 0) / 4294967296;
    }
    smooth(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    noise(x, width, salt) {
      const cell = Math.floor(x / width), t = this.smooth(x / width - cell);
      const a = this.terrainRandom(cell, salt), b = this.terrainRandom(cell + 1, salt);
      return (a + (b - a) * t) * 2 - 1;
    }
    sectionAt(x) {
      if(x<1800)return null;
      // Shuffled shape groups and variable lengths give each seed a different
      // route. This cache uses coordinate RNG only, never the item generator.
      while(this.terrainCursor<=x){
        const index=this.terrainSections.length,group=Math.floor(index/6);
        const order=[0,1,2,3,4,5].sort((a,b)=>this.terrainRandom(group,433494437+a*7919)-this.terrainRandom(group,433494437+b*7919));
        if(index%6===0&&index&&order[0]===this.terrainSections[index-1].kind)[order[0],order[1]]=[order[1],order[0]];
        // Preserve the swapped group order for its remaining five sections.
        const prior=this.terrainSections[index-index%6];
        const kind=(prior?.order||order)[index%6];
        const length=3400+this.terrainRandom(index,15485863)*2100;
        const height=420+this.terrainRandom(index,32452843)*380;
        const peak=kind===1?.55+this.terrainRandom(index,104729)*.18:kind===2?.30+this.terrainRandom(index,104729)*.18:.45;
        const drop=kind===3?700+this.terrainRandom(index,67867967)*420:0;
        this.terrainSections.push({index,kind,order:index%6===0?order:null,start:this.terrainCursor,end:this.terrainCursor+length,length,height,peak,
          drop,dropBefore:this.terrainDrop,biome:kind===2?1:kind===1||kind===4?2:kind===5?3:0,
          lift:kind===1?1.25+this.terrainRandom(index,982451653)*.10:1});
        this.terrainCursor+=length;this.terrainDrop+=drop;
      }
      let low=0,high=this.terrainSections.length-1;
      while(low<high){const mid=(low+high)>>1;if(x>=this.terrainSections[mid].end)low=mid+1;else high=mid;}
      return this.terrainSections[low];
    }
    region(x) {
      return ['ROLLING DUNES','GIANT DUNE','DEEP VALLEY','RUSH DESCENT','RIDGELINE','SALT FLATS'][this.sectionAt(x)?.kind??0];
    }
    biome() {return this.theme;}
    biomeTransition() {return {from:this.theme,to:this.theme,mix:0};}
    baseTerrain(x) {
      const t = this.profile;
      const opening = Math.cos(x * TAU / t.longWave + .3 + this.phase) * t.longHeight
        + Math.sin(x * TAU / t.shortWave + t.shortPhase) * t.shortHeight;
      // A broad, safe entry slope blends into non-repeating terrain after 120m.
      const blend = this.smooth(clamp((x - 1200) / 1500, 0, 1));
      let varied = this.noise(x, 2100, 173) * 185 + this.noise(x, 760, 947) * 48;
      const section=this.sectionAt(x);
      if(section){
        const u=clamp((x-section.start)/section.length,0,1),envelope=Math.sin(u*Math.PI)**4;
        const bump=u<=section.peak?this.smooth(u/section.peak):1-this.smooth((u-section.peak)/(1-section.peak));
        varied+=section.dropBefore;
        if(section.kind===1)varied-=section.height*section.lift*bump;
        else if(section.kind===2)varied+=section.height*1.10*bump;
        else if(section.kind===3){
          // A sustained descent gains elevation loss without a forced climb
          // at its exit. Both ends retain continuous height, slope and curvature.
          varied+=section.drop*this.smooth(clamp((u-.16)/.68,0,1));
          varied-=170*envelope*Math.sin(u*Math.PI*2);
        }else if(section.kind===4)varied-=section.height*.34*envelope*Math.cos(u*Math.PI*(this.terrainRandom(section.index,511273)<.45?6:4));
        else if(section.kind===0)varied+=(115+this.terrainRandom(section.index,511279)*100)*envelope*Math.sin(u*Math.PI*4);
      }
      let ground = 230 + x * t.grade + opening * (1 - blend) + varied * blend;
      if(section?.kind===5){
        const u=(x-section.start)/section.length,center=(section.start+section.end)*.5;
        const weight=this.smooth(clamp((u-.12)/.22,0,1))*(1-this.smooth(clamp((u-.66)/.22,0,1)))*blend;
        const tilt=.025+this.terrainRandom(section.index,49979687)*.025;
        const flat=230+center*t.grade+section.dropBefore+this.noise(center,2100,173)*110+(x-center)*tilt;
        ground += (flat - ground) * weight;
      }
      return ground;
    }
    rampLift(ramp,x) {
      if(x<ramp.x||x>ramp.recovery)return 0;
      const length=ramp.end-ramp.x;
      if(x<=ramp.end){const t=(x-ramp.x)/length;return ramp.height*t*t*t;}
      // Quintic recovery matches height, slope and curvature at the lip,
      // then blends all three back into the ordinary ground.
      const width=ramp.recovery-ramp.end,u=(x-ramp.end)/width;
      const a=ramp.height,b=3*ramp.height*width/length,c=3*ramp.height*width*width/(length*length);
      return a+b*u+c*u*u+(-10*a-6*b-3*c)*u**3+(15*a+8*b+3*c)*u**4+(-6*a-3*b-c)*u**5;
    }
    courseTerrain(x) {
      let ground=this.baseTerrain(x);
      for(const section of this.encounters||[]){
        if(x<section.x||x>section.end)continue;
        const weight=this.smooth(clamp((x-section.x)/(section.flatStart-section.x),0,1))
          *(1-this.smooth(clamp((x-section.flatEnd)/(section.end-section.flatEnd),0,1)));
        const flat=section.y+(x-section.flatStart)*section.tilt;
        ground+=(flat-ground)*weight;
      }
      return ground;
    }
    terrain(x) {
      let lift=0;
      for(const ramp of this.ramps||[])lift+=this.rampLift(ramp,x);
      return this.courseTerrain(x)-lift;
    }
    sandAt(x) {
      for(const section of this.encounters){
        if(x<section.flatStart||x>section.sandEnd)continue;
        return this.smooth(clamp((x-section.flatStart)/140,0,1))
          *this.smooth(clamp((section.sandEnd-x)/140,0,1));
      }
      return 0;
    }
    derivative(x) { return (this.terrain(x + 1) - this.terrain(x - 1)) * 0.5; }
    slope(x) { return Math.atan(this.derivative(x)); }
    gapAt(x) { return this.gaps.find(g => x > g.x && x < g.end); }
    railY(rail, x) {
      const t = clamp((x - rail.x) / (rail.end - rail.x), 0, 1);
      return rail.y + (rail.endY - rail.y) * t + Math.sin(t * Math.PI) * (rail.sag ?? 35);
    }
    railSlope(rail, x) { return Math.atan((this.railY(rail, x + 2) - this.railY(rail, x - 2)) / 4); }
    rampY(ramp, x) {
      return this.courseTerrain(x)-this.rampLift(ramp,x);
    }
    rampSlope(ramp, x) {
      return Math.atan((this.rampY(ramp,x+1)-this.rampY(ramp,x-1))*.5);
    }
    event(type, data) { this.events.push({ type, ...data }); }
    coinTrail(x, count, arc) {
      for (let i = 0; i < count; i++) {
        const cx = x + i * 34;
        this.items.push({ type: 'coin', x: cx, y: this.terrain(cx) - 26 - Math.sin(i / (count - 1) * Math.PI) * (arc || 0), hit: false });
      }
    }
    makeRamp(x, long) {
      const end = x + (long ? 350 : 255) + this.random() * (long ? 130 : 85);
      const ramp = { x, end, recovery:end + 280 + this.random() * 90,
        height:(long ? 90 : 65) + this.random() * (long ? 35 : 25), y:this.terrain(x),
        launch:(long ? 220 : 155) + this.random() * 55 };
      for (let tune=0; tune<5; tune++) {
        let steep=false;
        for (let cx=x; cx<=ramp.recovery; cx+=12) {
          if (Math.abs((this.rampY(ramp,cx+1)-this.rampY(ramp,cx-1))*.5)>1.7) steep=true;
        }
        if (!steep) break;
        ramp.height*=.75;
      }
      ramp.endY=this.rampY(ramp,end);
      this.ramps.push(ramp);
      return ramp;
    }
    balloonChain(x, index) {
      // Search for a clear sky route instead of raising an intersecting cable
      // beyond jump height. All choices are seed-based, including the gaps.
      for (let attempt=0; attempt<28; attempt++) {
        const start=x+attempt*80, count=2+Math.floor(this.terrainRandom(index,8675309)*2);
        const ramp={x:start,end:start+390+this.terrainRandom(index,952733)*65,
          height:90+this.terrainRandom(index,961748941)*25,launch:290,y:this.terrain(start)};
        ramp.recovery=ramp.end+310;
        // A balloon launch must obey the same slope budget as ordinary ramps.
        // Otherwise its recovery curve can stack with a steep natural descent.
        for(let tune=0;tune<8;tune++){
          let steep=false;
          for(let cx=start;cx<=ramp.recovery;cx+=12)if(Math.abs((this.rampY(ramp,cx+1)-this.rampY(ramp,cx-1))*.5)>2.1)steep=true;
          if(!steep)break;
          ramp.height*=.72;
        }
        ramp.endY=this.rampY(ramp,ramp.end);
        const first=ramp.end+65, span=410+this.terrainRandom(index,104395303)*115;
        const gap=90+this.terrainRandom(index,122949829)*50;
        const end=first+span*count+gap*(count-1);
        const grade=clamp((this.baseTerrain(end)-this.baseTerrain(first))/(end-first)-.08,-.27,.45);
        const entry=ramp.endY-85, rails=[];
        let clear=true;
        for (let part=0; part<count; part++) {
          const rx=first+part*(span+gap), re=rx+span;
          const rail={x:rx,end:re,y:entry+(rx-first)*grade-(part?30:0),
            endY:entry+(re-first)*grade-(part?30:0),sag:22,chain:index,part,high:true};
          for (let cx=rx; cx<=re; cx+=16) {
            if (this.railY(rail,cx)>this.terrain(cx)-this.rampLift(ramp,cx)-65) clear=false;
          }
          rails.push(rail);
        }
        if (!clear || Math.abs(this.rampSlope(ramp,ramp.end))>1.02) continue;
        this.ramps.push(ramp);
        this.rails.push(...rails);
        this.lastSky=start;
        return {x:start,end,ramp,rails};
      }
      return null;
    }
    placeHeart(x, spacing, index) {
      if (x<this.nextHeartSite) return;
      const upper=this.rails.filter(rail=>rail.x>=x&&rail.end<x+spacing);
      const rail=upper.length&&this.terrainRandom(index,141650939)<.4?upper[upper.length-1]:null;
      let cx=rail?rail.x+(rail.end-rail.x)*.6:x+spacing*.7;
      const gap=this.gapAt(cx);
      if (gap) cx=gap.end+90;
      // Hearts never share a rock's hitbox or sit in a dangerous gap.
      for (const item of this.items) if (this.touchesGroundHazard(item)&&Math.abs(item.x-cx)<100) cx=item.x+110;
      const cy=rail?this.railY(rail,cx)-24:this.terrain(cx)-30;
      this.items.push({type:'heart',x:cx,y:cy,hit:false});
      this.nextHeartSite=cx+13500+this.terrainRandom(this.heartSites++,86028121)*8500;
    }
    touchesGroundHazard(item) { return item.hazard||['rock','crate','log'].includes(item.type); }
    climbBoosts(start,end,index){
      // Long climbs get an optional green jump line. Ground coasting misses
      // it, but a player who reads the hill can preserve escape momentum.
      for(let x=Math.max(2500,start+150);x<end-160;x+=280){
        if(x-this.lastClimbBoost<1050||this.derivative(x)>-.12||this.terrain(x-180)-this.terrain(x+450)<140)continue;
        if(this.ramps.some(r=>x>r.x-100&&x<r.recovery+100)||this.gaps.some(g=>x>g.x-400&&x<g.end+250))continue;
        if(this.items.some(i=>(i.hazard||i.type==='boost'||['rock','log'].includes(i.type))&&Math.abs(i.x-x)<260))continue;
        this.items.push({type:'boost',x,y:this.terrain(x)-105,aerial:true,climb:true,hit:false});
        this.lastClimbBoost=x;
      }
    }
    nextPattern(index, x) {
      if(index===0)return 0;
      if(index===1)return this.random()<.55?7:0;
      if(index===2)return 10;
      if(x>5500&&x-this.lastPressure>7600)return 11;
      if(x>7000&&x-this.lastCargo>8000)return 12;
      if(x>6500&&x-this.lastSky>13000)return 5;
      // A shuffled bag replaces the old every-third-feature gate. Distance
      // budgets stop either hazards or free scenery becoming an endless streak.
      if(x-this.lastHazard>2400+this.terrainRandom(index,611953)*850)return 10;
      if(!this.patternBag.length){
        this.patternBag=[0,2,3,4,5,7,8,9,10,10,11,12];
        for(let i=this.patternBag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.patternBag[i],this.patternBag[j]]=[this.patternBag[j],this.patternBag[i]];}
      }
      let pattern=this.patternBag.pop();
      if(pattern===11&&(x<6500||x-this.lastPressure<6500))pattern=2;
      if(pattern===12&&(x<5200||x-this.lastCargo<4200))pattern=10;
      return pattern;
    }
    pressureStretch(x,index) {
      // Reserve a whole encounter BEFORE placing its objects. The entry and
      // escape blend into the same collision surface; no floating ramp wedges.
      const core=1240+this.terrainRandom(index,194923)*400;
      for(let attempt=0;attempt<18;attempt++){
        const start=x+attempt*100,flatStart=start+440,flatEnd=flatStart+core,end=flatEnd+1000;
        const section={x:start,flatStart,flatEnd,end,y:this.baseTerrain(flatStart),tilt:.012,
          sandEnd:flatEnd-210,variant:this.terrainRandom(index,611113)<.5?'boost':'cliff',chased:false,cleared:false};
        const fall=this.baseTerrain(end)-(section.y+core*section.tilt);
        if(fall<220||fall>1080)continue;
        this.encounters.push(section);
        let safe=true;
        for(let cx=start;cx<end;cx+=20)if(Math.abs(this.derivative(cx))>1.8)safe=false;
        if(!safe){this.encounters.pop();continue;}
        // Ground pad is the recovery route; a small aerial pad rewards a hop
        // that preserves speed over the visibly soft sand.
        const airX=flatStart+core*.48;
        this.items.push({type:'boost',x:airX,y:this.terrain(airX)-122,aerial:true,hit:false});
        this.coinTrail(airX-170,11,120);
        const escapeX=flatEnd-105;
        section.escapeX=escapeX;
        this.items.push({type:'boost',x:escapeX,y:this.terrain(escapeX)-3,escape:true,hit:false});
        if(section.variant==='cliff'){
          const ramp=this.makeRamp(flatEnd+30,true);ramp.launch=300;
          section.launchX=ramp.end;
          for(let i=0;i<9;i++){
            const cx=ramp.end+60+i*48,t=(cx-ramp.end)/540;
            this.items.push({type:'coin',x:cx,y:Math.min(ramp.endY-260*t+345*t*t-22,this.terrain(cx)-32),hit:false});
          }
        }else this.coinTrail(flatEnd+100,10,60);
        this.lastPressure=start;
        return section;
      }
      return null;
    }
    addCargo(x,index,aerial=false) {
      const item={type:'cargo',x,y:this.terrain(x)-1100,width:48,height:43,hazard:true,heavy:true,hit:false,
        drop:{at:null,warning:.32,duration:1.05+this.terrainRandom(index,749129)*.2,
          drift:190+this.terrainRandom(index,749131)*100,landed:false,aerial,spawnY:null}};
      this.items.push(item);this.lastCargo=x;
      return item;
    }
    updateCargo() {
      const p=this.player;
      for(const item of this.items){
        if(item.type!=='cargo'||item.hit)continue;
        const drop=item.drop;
        if(drop.at===null){
          if(item.x-p.x>Math.max(1250,p.vx*1.8)||p.x>item.x+100)continue;
          // Lock a trajectory ONCE. Never home in on the rider after warning.
          // Ground drops meet the approach; aerial drops cross earlier overhead.
          const crossing=drop.duration*(drop.aerial?.85:.98);
          const travel=clamp(p.vx,180,SPEED_LIMITS.air)*(drop.warning+crossing);
          drop.startX=p.x+Math.max(350,travel)+drop.drift*crossing;
          drop.landX=drop.startX-drop.drift*drop.duration;
          drop.groundY=this.terrain(drop.landX);
          drop.spawnY=Math.min(p.y-1100,drop.groundY-1000);
          drop.at=this.time;item.x=drop.startX;item.y=drop.spawnY;
          this.event('cargo-warning',{x:item.x});
        }
        if(drop.landed)continue;
        const progress=clamp((this.time-drop.at-drop.warning)/drop.duration,0,1);
        item.x=drop.startX-drop.drift*drop.duration*progress;
        item.y=drop.spawnY+(drop.groundY-drop.spawnY)*progress;
        // Contact the actual hillside, including slopes along the drifting path.
        if(progress===1||item.y>=this.terrain(item.x)){
          item.y=this.terrain(item.x);drop.landed=true;drop.landedAt=this.time;
          this.event('cargo-land',{x:item.x,y:item.y});
        }
      }
    }
    generate(ahead) {
      const limit = this.player.x + ahead;
      while (this.nextFeature < limit) {
        const index = this.feature++;
        let x=index===2?Math.max(this.nextFeature,2600+this.terrainRandom(0,179)*450):this.nextFeature;
        const stage = Math.min(4, Math.floor(x / 5000));
        const biome=this.biome(x);
        let pattern=this.nextPattern(index,x);
        // Five optional quest routes, progressively farther apart. A day's
        // ten-token goal is cumulative across runs, never ten in one run.
        const tiers=[9000,17500,31000,48000,72000];
        const redSite=this.redSites<5&&x>=Math.max(tiers[this.redSites]+this.terrainRandom(this.redSites,62851)*700,this.lastRedSite+5500);
        if(redSite)pattern=this.terrainRandom(this.redSites,68389)<.5?3:5;
        if([4,8,10,12].includes(pattern)){
          // Put required jumps after a readable approach, not at the end of
          // an automatic crest/ramp flight where a phone gives no warning.
          let best=x,bestRisk=Infinity;
          for(let step=0;step<64;step++){
            const candidate=x+step*40;
            let risk=0;
            for(let cx=candidate-600;cx<=candidate+90;cx+=45){
              const slope=Math.abs(this.derivative(cx));
              const curvature=(this.derivative(cx+5)-this.derivative(cx-5))/10;
              risk=Math.max(risk,slope/.65,curvature/.0011);
            }
            if(this.ramps.some(r=>r.end>candidate-1050&&r.x<candidate+100)||this.gaps.some(g=>g.end>candidate-700&&g.x<candidate+100)
              ||this.rails.some(r=>r.end>candidate-850&&r.x<candidate+100))risk+=3;
            if(risk<bestRisk){best=candidate;bestRisk=risk;}
            if(risk<=1)break;
          }
          x=best;
          // Never spend the clear landing corridor on another mandatory hit.
          if(index!==2&&bestRisk>1.7)pattern=0;
        }
        const y=this.terrain(x);
        if(!redSite&&index > 2 && pattern === this.lastPattern && [2,5,9].includes(pattern)) pattern = 0;
        this.lastPattern = pattern;
        let spacing = 440 + this.random() * 410;
        if(pattern===11){
          const stretch=this.pressureStretch(x,index);
          if(stretch){x=stretch.x;spacing=stretch.end-x+600;}
          else {this.coinTrail(x,9,30);this.lastPressure=x;}
        } else if(pattern===12){
          this.addCargo(x,index);this.lastHazard=x;
          this.coinTrail(x-170,9,110);
          spacing=1050+this.random()*280;
        } else if (pattern === 2 || pattern === 3) {
          const ramp=this.makeRamp(x,pattern===3);
          // Above the ordinary automatic launch: tap near the lip to reach it.
          const special=redSite?'redRush':x>5000&&x-this.lastRushSite>6000&&this.terrainRandom(index,73939)<.45?'rush':null;
          if(special){
            const cx=ramp.end+165,angle=this.rampSlope(ramp,ramp.end),speed=470;
            const flight=165/(speed*Math.cos(angle));
            const cy=ramp.endY+(speed*Math.sin(angle)-(350+speed*.18))*flight+345*flight*flight-17;
            this.items.push({type:special,x:cx,y:Math.min(cy,this.terrain(cx)-65),hit:false});
            if(redSite){this.redSites++;this.lastRedSite=cx;}else this.lastRushSite=x;
          }
          for (let i = 0; i < 8; i++) {
            const cx = ramp.end + 45 + i * 38;
            const flight=(cx-ramp.end)/(470*Math.cos(this.rampSlope(ramp,ramp.end)));
            const vy=470*Math.sin(this.rampSlope(ramp,ramp.end))-ramp.launch;
            const cy=ramp.endY+vy*flight+345*flight*flight-17;
            this.items.push({ type:'coin',x:cx,y:Math.min(cy,this.terrain(cx)-26),hit:false });
          }
          spacing = ramp.recovery-x+580+this.random()*270;
          if(!redSite&&x>5800&&x-this.lastCargo>3500&&this.terrainRandom(index,440113)<.5){
            this.addCargo(ramp.end+210+this.terrainRandom(index,440119)*210,index,true);
          }
        } else if (pattern === 5) {
          const chain=this.balloonChain(x,index);
          if (chain) x=chain.x;
          const end = x + 760 + this.random() * 170;
          let route;
          if (chain) route=chain.rails;
          else {
            const rail={x,end,y:y-105,endY:this.terrain(end)-130};
            let clearance=0;
            for (let cx=x;cx<=end;cx+=16) clearance=Math.max(clearance,this.railY(rail,cx)-this.terrain(cx)+55);
            rail.y-=clearance;rail.endY-=clearance;
            this.rails.push(rail);route=[rail];
          }
          const rail=route[route.length-1];
          const special=redSite?'redRush':x>5000&&x-this.lastRushSite>6000&&this.terrainRandom(index,73939)<.55?'rush':null;
          if(special){
            const cx=rail.x+(rail.end-rail.x)*.83;
            this.items.push({type:special,x:cx,y:this.railY(rail,cx)-(redSite?24:88),hit:false});
            if(redSite){this.redSites++;this.lastRedSite=cx;}else this.lastRushSite=x;
          }
          for (const wire of route) for (let i=1;i<=11;i++) {
            const cx=wire.x+i*(wire.end-wire.x)/12;
            this.items.push({type:'coin',x:cx,y:this.railY(wire,cx)-24,hit:false});
          }
          this.coinTrail(x - 100, 5, 135);
          spacing = (chain?chain.end-x:1080)+850+this.random()*250;
          if(!redSite&&x>6500&&x-this.lastCargo>3500&&this.terrainRandom(index,440131)<.38){
            const wire=route[Math.min(1,route.length-1)];
            this.addCargo(wire.x+(wire.end-wire.x)*.58,index,true);
          }
        } else if (pattern === 7) {
          this.items.push({ type: 'boost', x, y: y - 3, hit: false });
          this.coinTrail(x + 70, 8, 15);
        } else if (pattern === 9 && x>4500 && this.derivative(x) > .05) {
          const gap = { x, end:x+240+stage*30+this.terrainRandom(index,16908799)*100 };
          this.gaps.push(gap);
          this.coinTrail(x - 180, 11, 140);
          spacing = 1000 + this.random() * 240;
        } else if(pattern===10){
          const kinds=biome===1?['log','rock','barrier','stack']:biome===2?['cart','stack','barrier','spikes']
            :biome===3?['rock','spikes','barrier','log']:['barrier','spikes','stack','cart'];
          const kind=index===2?'barrier':kinds[Math.floor(this.random()*kinds.length)];
          const size={barrier:[66,38],spikes:[70,31],stack:[48,61],cart:[58,42],log:[65,32],rock:[49,35]}[kind];
          const scale=index===2?1:.82+this.random()*.40;
          this.items.push({type:kind,x,y,width:size[0]*scale,height:size[1]*scale,hazard:true,heavy:true,hit:false});
          this.lastHazard=x;
          this.coinTrail(x-155,7,105+stage*8);
          this.coinTrail(x+175,5,15);
          spacing=680+this.random()*450;
          // Readable rhythm pairs: separate jumps, not overlapping hitboxes.
          const secondX=x+620+this.terrainRandom(index,55079)*230;
          if(stage>0&&this.terrainRandom(index,55073)<Math.min(.65,.3+stage*.08)
            &&Math.abs(this.derivative(secondX))<.45&&Math.abs(this.derivative(secondX-250))<.5){
            this.items.push({type:'barrier',x:secondX,y:this.terrain(secondX),width:58,height:34,hazard:true,heavy:true,hit:false});
            this.coinTrail(secondX-150,7,130);
            this.lastHazard=secondX;spacing=secondX-x+750;
          }
        } else if ((pattern === 4 || pattern === 8) && x > 2400) {
          this.items.push({ type: this.random() < (biome===1?.25:.70) ? 'rock' : 'log', x, y, width:38+this.random()*18,height:23+this.random()*10,hit: false });
          this.lastHazard=x;
          this.coinTrail(x + 150, 7, 30);
        } else this.coinTrail(x, 8 + Math.floor(this.random() * 4), index % 3 === 0 ? 95 : 0);
        this.climbBoosts(x,x+spacing,index);
        this.placeHeart(x,spacing,index);
        this.nextFeature = x+spacing;
      }
      while (this.nextScenery < limit + 700) {
        const x = this.nextScenery;
        // Decoration consumes no gameplay RNG, even when look-ahead changes.
        this.scenery.push({ x, y: this.terrain(x), type: this.terrainRandom(Math.floor(x),394639)<.18?'pylon':'lantern', scale:.7+this.terrainRandom(Math.floor(x),397427)*.6 });
        this.nextScenery += 440 + this.terrainRandom(Math.floor(x),399989) * 650;
      }
    }

    press() {
      if (this.dead) return;
      const p = this.player;
      p.held = true;
      p.heldTime = 0;
      p.buffer = 0.13;
      if (p.grounded || p.coyote > 0) this.jump();
    }
    release() { this.player.held = false; this.player.heldTime = 0; this.player.flipStarted=false; }
    jump() {
      const p = this.player;
      const angle = p.rail ? this.railSlope(p.rail, p.x) : p.ramp ? this.rampSlope(p.ramp, p.x) : this.slope(p.x);
      const lip=this.ramps.find(r=>r.end-p.x>=-35&&r.end-p.x<=clamp(p.speed*.18,55,105));
      const sweet=Boolean(lip&&(p.grounded||p.coyote>0)&&p.recovery<=0&&p.speed>240);
      p.vx = p.speed * Math.cos(angle);
      p.vy = p.speed * Math.sin(angle) - (350 + p.speed * 0.18) - (sweet?80:0);
      p.takeoffBonus=sweet?120:0;
      if(sweet)this.event('trick',{text:'PERFECT TAKEOFF',points:0});
      p.grounded = false;
      p.rail = null;
      p.ramp = null;
      p.airborne = 0;
      p.spin = 0;
      p.turns = 0;
      p.flipStarted = false;
      p.angle = angle;
      p.buffer = 0;
      p.coyote = 0;
      this.event('jump', { x: p.x, y: p.y });
    }
    launch(angle, strength) {
      const p = this.player;
      p.vx = p.speed * Math.cos(angle);
      p.vy = p.speed * Math.sin(angle) - (strength || 0);
      p.grounded = false;
      p.rail = null;
      p.ramp = null;
      p.coyote = 0.13;
      p.airborne = 0;
      p.spin = 0;
      p.turns = 0;
      p.flipStarted = false;
      p.angle = angle;
      p.takeoffBonus=0;
      this.event('jump', { x: p.x, y: p.y, automatic: true });
    }
    land(y, angle, rail) {
      const p = this.player;
      const impact = p.vy * Math.cos(angle) - p.vx * Math.sin(angle);
      const rotation = Math.abs(angleDelta(p.angle - angle));
      const turns=p.airborne>.35?Math.floor(p.spin/TAU+.025):0;
      // Fall energy and board alignment are different things. A completed,
      // aligned flip banks its reward even after a very high jump.
      const cleanFlip=turns>0&&rotation<=.95&&p.recovery<=0&&!p.recoveryGap;
      const approachSpeed=Math.max(0,p.vx);
      const impactLimit=Math.max(760,920-Math.floor(p.x/5000)*25);
      const misaligned=p.rush<=0&&p.invulnerable<=0&&p.recovery<=0&&!p.recoveryGap&&p.airborne>.25&&p.held&&rotation>1.02;
      const badFlip=this.mode!=='trial'&&misaligned;
      p.speed = clamp(p.vx * Math.cos(angle) + p.vy * Math.sin(angle), p.rush>0?SPEED_LIMITS.rushFloor:115, p.rush>0?SPEED_LIMITS.rush:SPEED_LIMITS.landing);
      const rough=misaligned||!cleanFlip&&p.rush<=0&&p.recovery<=0&&!p.recoveryGap&&impact>impactLimit;
      if (badFlip) {
        // A mistimed flip spends one life, just like a rock. An upright
        // automatic landing, however high, does not spend a life.
        this.mistake();p.speed=Math.max(25,p.speed*(p.mistakes>1?.32:.48));p.stagger=.65;p.recovery=1.05;p.invulnerable=.9;
        this.combo=1;this.slowTime=0;
        if(this.dog.active)this.dog.distance=Math.max(90,this.dog.distance);
        this.lives--;
        this.event('stumble',{x:p.x,y,angle,heavy:true,material:'stone',kind:'flip',lifeLost:true,lives:this.lives,fatal:this.lives===0});
        if(this.lives===0){p.y=y;this.crash('OUT OF LIVES');return;}
      } else if(rough){
        // Auto-aligned high falls are recoverable. Fall speed alone must never
        // kill a rider whose board is upright; keep the impact readable.
        p.speed=Math.max(150,p.speed*.72);p.stagger=Math.max(p.stagger,.38);
        p.recovery=Math.max(p.recovery,1.2);this.combo=1;this.slowTime=0;
        if(this.dog.active)this.dog.distance=Math.max(90,this.dog.distance);
        this.event('stumble',{x:p.x,y,angle,heavy:false,material:'stone',kind:'landing'});
      }else if(!cleanFlip&&p.rush<=0&&impact>650)p.speed*=.8;
      p.y = y;
      p.angle = angle;
      p.grounded = true;
      p.coyote = 0.12;
      p.rail = rail || null;
      if (rail) {
        p.speed = Math.max(440, p.speed);
        this.event('trick', { text: 'CABLE GRIND', points: 150 });
        this.score += 150 * this.combo;
      }
      if(p.takeoffBonus&&!rough){
        this.score+=p.takeoffBonus;p.speed=Math.min(p.rush>0?SPEED_LIMITS.rush:SPEED_LIMITS.landing,p.speed+45);
        this.event('trick',{text:'STUCK THE LANDING',points:p.takeoffBonus});
      }
      p.takeoffBonus=0;
      if (p.airborne > 0.35) {
        if (cleanFlip && !rough) {
          this.combo = Math.min(8, this.combo + turns);
          const points = 500 * turns * this.combo;
          this.score += points;
          p.speed = Math.min(p.rush>0?SPEED_LIMITS.rush:SPEED_LIMITS.landing, Math.max(p.speed,approachSpeed*.9,220) + Math.min(150,50 * turns));
          p.boost = Math.min(1.6,1+turns*.2);
          p.stagger=0;
          this.slowTime=Math.max(0,this.slowTime-.6);
          this.event('trick', { text: turns > 1 ? `${turns}× BACKFLIP` : 'BACKFLIP', points });
        } else if (impact < 420) {
          this.score += 100;
          this.event('trick', { text: 'CLEAN LANDING', points: 100 });
        }
        this.event('land', { x: p.x, y: p.y, clean: cleanFlip || impact < 500 });
      }
      p.airborne = 0;
      p.spin = 0;
      p.turns = 0;
      p.flipStarted = false;
      if (p.buffer > 0) this.jump();
    }
    mistake(){
      const p=this.player;
      p.mistakes=this.time-p.lastMistake<7?Math.min(3,p.mistakes+1):1;
      p.lastMistake=this.time;p.stall=0;
    }
    stumble(item) {
      const p = this.player;
      // Consume a collision once, including during recovery. No obstacle can
      // trap the rider inside its hitbox and repeatedly remove momentum.
      if (item.hit || this.dead) return;
      item.hit = true;
      if (p.invulnerable > 0 || p.rush > 0) return;
      const heavy=Boolean(item.heavy||item.hazard),before=p.speed;
      this.mistake();
      p.speed=Math.min(before,clamp(before*(p.mistakes>1?.18:heavy?.32:.48),p.mistakes>1?0:65,heavy?300:420));
      p.vx*=p.speed/Math.max(1,before);
      if(!p.grounded)p.vy*=.8;
      p.boost=0;
      p.invulnerable=.9;
      p.stagger=heavy?.42:.28;
      p.recovery=heavy?1.15:.9;
      p.spin=0;p.turns=0;p.takeoffBonus=0;
      // Preserve the slowdown without allowing the same collision to cause
      // a lethal landing or an immediate catch by an already nearby hound.
      if(!p.grounded)p.vy=clamp(p.vy,-280,350);
      if(this.dog.active)this.dog.distance=Math.max(90,this.dog.distance);
      this.combo = 1;
      this.slowTime = 0;
      this.lives--;
      const material=['barrier','cart','stack','crate'].includes(item.type)?'metal':['log','cargo'].includes(item.type)?'wood':'stone';
      this.event('stumble', { x:p.x,y:p.y,angle:p.angle,heavy,loss:before-p.speed,material,
        obstacle:{...item},obstacleAngle:this.slope(item.x),kind:item.type,lifeLost:true,lives:this.lives,fatal:this.lives===0 });
      if(this.lives===0)this.crash('OUT OF LIVES');
    }
    touchesObstacle(item,previousX=this.player.x) {
      const p=this.player;
      if(item.hit)return false;
      if(item.type==='cargo'){
        if(item.drop.at===null||this.time-item.drop.at<item.drop.warning)return false;
        if(!item.drop.landed){
          // Only the box hurts. Ropes/canopy and warning markers never collide.
          return Math.abs(item.x-p.x)<item.width*.5+10&&p.y>item.y-item.height+3&&p.y-28<item.y-3;
        }
      }
      if(item.hazard){
        const half=(item.width||42)*.5+12+(item.height||0);
        if(Math.max(previousX,p.x)<item.x-half||Math.min(previousX,p.x)>item.x+half)return false;
        const angle=this.slope(item.x),dx=p.x-item.x,dy=p.y-item.y;
        const localX=dx*Math.cos(angle)+dy*Math.sin(angle),localY=dy*Math.cos(angle)-dx*Math.sin(angle);
        return Math.abs(localX)<item.width*.5+12&&localY>-item.height-5&&localY<32;
      }
      return ['rock','crate','log'].includes(item.type)&&Math.abs(item.x-p.x)<=35&&p.y>item.y-(item.height||30)&&p.y<item.y+15;
    }
    crash(reason) {
      if (this.dead) return;
      if(this.player.rush>0&&reason!=='TIME LIMIT')return;
      this.dead = true;
      this.reason = reason;
      this.release();
      const p=this.player;
      this.event('crash', { reason,x:p.x,y:p.y,angle:p.angle,speed:p.speed });
    }

    step(dt) {
      if (this.dead) return;
      const p = this.player;
      this.previousPlayer={x:p.x,y:p.y,speed:p.speed,vx:p.vx,vy:p.vy,angle:p.angle};
      this.time += dt;
      this.updateCargo();
      p.buffer = Math.max(0, p.buffer - dt);
      p.coyote = Math.max(0, p.coyote - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.boost = Math.max(0, p.boost - dt);
      p.rush = Math.max(0, p.rush - dt);
      p.stagger = Math.max(0, p.stagger - dt);
      p.recovery = Math.max(0,p.recovery-dt);
      if(this.time-p.lastMistake>7)p.mistakes=0;
      if(p.recoveryGap&&p.x>=p.recoveryGap.end)p.recoveryGap=null;
      if (p.held) p.heldTime += dt;
      const previousX = p.x, previousY = p.y;
      if (p.grounded) {
        let angle = p.rail ? this.railSlope(p.rail, p.x) : p.ramp ? this.rampSlope(p.ramp, p.x) : this.slope(p.x);
        const sand=p.rail||p.rush>0||p.recovery>0?0:this.sandAt(p.x);
        const acceleration = 620 * Math.sin(angle) * 0.45 + 20 - p.speed * 0.075 + (p.boost > 0 ? 75 : 0) + (p.recovery>0?(this.mode==='trial'?48:10):0)
          -sand*(120+p.speed*.09);
        const maximum=p.rush>0?SPEED_LIMITS.rush:Math.max(SPEED_LIMITS.ground,p.speed-360*dt);
        const minimum=this.mode==='trial'?65:p.x<2400?200:p.mistakes>0?0:angle>=-.08?45:65;
        p.speed = clamp(p.speed + acceleration * dt, p.rush>0?SPEED_LIMITS.rushFloor:minimum, maximum);
        p.vx = p.speed * Math.cos(angle);
        p.vy = p.speed * Math.sin(angle);
        p.x += p.vx * dt;
        if (p.rail) {
          p.y = this.railY(p.rail, p.x);
          this.score += dt * 90 * this.combo;
          if (p.x >= p.rail.end) this.launch(angle, 100);
        } else if (p.ramp) {
          p.y = this.rampY(p.ramp, p.x);
          if (p.x >= p.ramp.end) {
            this.launch(angle, p.ramp.launch||110);
            this.event('trick', { text: 'LAUNCH', points: 0 });
          }
        } else {
          const ramp = this.ramps.find(r => previousX <= r.x + 14 && p.x >= r.x && p.x < r.end && p.y >= r.y - 12);
          if (ramp) { p.ramp = ramp; p.y = this.rampY(ramp, p.x); }
          else if (this.gapAt(p.x)) {
            if(p.recovery>0)p.recoveryGap=this.gapAt(p.x);
            this.launch(angle);
          }
          else {
            const curvature = (this.derivative(p.x + 5) - this.derivative(p.x - 5)) / 10;
            const normalAcceleration = p.speed * p.speed * curvature / Math.pow(1 + this.derivative(p.x) ** 2, 1.5);
            if (this.mode!=='trial'&&normalAcceleration > 670 && p.speed > 510) this.launch(angle);
            else p.y = this.terrain(p.x);
          }
        }
        if (p.grounded) { p.angle = angle; p.coyote = 0.12; }
      } else {
        p.airborne += dt;
        p.vy += 690 * dt;
        p.vx = clamp(p.vx + dt * 7, p.rush>0?1000:85, p.rush>0?SPEED_LIMITS.rush:Math.max(SPEED_LIMITS.air,p.vx-360*dt));
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.speed = p.vx;
        if (p.held && p.heldTime > 0.14) {
          if(!p.flipStarted){p.flipStarted=true;this.event('flip-start',{x:p.x,y:p.y});}
          const rotation = 5.2 * dt;
          p.angle -= rotation;
          p.spin += rotation;
          const turns=Math.floor(p.spin/TAU);
          if(turns>p.turns){p.turns=turns;this.event('flip',{x:p.x,y:p.y,turns});}
        } else {
          const target = this.slope(p.x + p.vx * 0.15);
          p.angle += angleDelta(target - p.angle) * Math.min(1, 8.5 * dt);
        }
        // Resolve contact before deciding whether this landing is terminal.
        // Otherwise touching a tall object and landing in the same tick could
        // bypass stumble() entirely and look like the object killed the run.
        for(const item of this.items)if(this.touchesObstacle(item,previousX))this.stumble(item);
        if(this.dead)return;
        if(this.gapAt(p.x)&&p.recovery>0)p.recoveryGap=this.gapAt(p.x);
        let landed = false;
        if (p.vy > -60) {
          for (const rail of this.rails) {
            if (p.x < rail.x || p.x > rail.end) continue;
            const oldY = this.railY(rail, previousX), newY = this.railY(rail, p.x);
            if (previousY <= oldY + 3 && p.y >= newY) {
              this.land(newY, this.railSlope(rail, p.x), rail);
              landed = true;
              break;
            }
          }
        }
        if (!landed && !this.gapAt(p.x) && p.y >= this.terrain(p.x)) {
          // A rider below the far cliff cannot teleport back onto its surface.
          if (p.rush<=0&&p.recovery<=0&&!p.recoveryGap&&previousY > this.terrain(previousX) + 35 && p.y > this.terrain(p.x) + 35) this.crash('MISSED THE GAP');
          else this.land(this.terrain(p.x), this.slope(p.x));
        }
        // Shielded gap flight skims above the terrain rather than falling below
        // a cliff and being stranded when the seven-second timer expires.
        if((p.rush>0||p.recoveryGap)&&this.gapAt(p.x)&&p.y>this.terrain(p.x)-12){p.y=this.terrain(p.x)-12;p.vy=Math.min(p.vy,0);}
        if (p.y > this.terrain(p.x) + 600) this.crash('MISSED THE GAP');
      }
      for (const item of this.items) {
        if(this.dead)break;
        const half=(item.width||42)*.5+12+(item.hazard?item.height:0);
        if (item.hit || (item.hazard?Math.max(previousX,p.x)<item.x-half||Math.min(previousX,p.x)>item.x+half:Math.abs(item.x-p.x)>35)) continue;
        if (item.type === 'coin' && Math.abs(item.y - (p.y - 17)) < 32) {
          item.hit = true;
          this.coins++;
          this.score += 30 * this.combo;
          this.event('coin', { x: item.x, y: item.y });
        } else if(item.type==='heart'&&Math.abs(item.y-(p.y-17))<32){
          item.hit=true;
          if(this.lives<this.maxLives){
            this.lives++;this.heartsCollected++;
            this.event('heart',{x:item.x,y:item.y,lives:this.lives});
          }
        } else if(['rush','redRush'].includes(item.type)&&Math.abs(item.y-(p.y-17))<(item.type==='rush'?42:32)){
          item.hit=true;
          if(item.type==='rush'){
            this.rushPickups++;p.rush=7;p.invulnerable=7;p.stagger=0;
            p.speed=SPEED_LIMITS.rushStart;p.vx=Math.max(p.vx,1060);p.mistakes=0;p.stall=0;this.slowTime=0;this.dog.active=false;this.dog.warning=false;
            this.event('rush',{x:item.x,y:item.y,seconds:7});
          }else if(this.redTokens<5){this.redTokens++;this.event('redRush',{x:item.x,y:item.y,total:this.redTokens});}
        } else if (item.type === 'boost' && Math.abs(item.y - (p.y-(item.aerial?17:0))) < (item.aerial?34:22)) {
          item.hit = true;
          this.boostsCollected++;
          p.speed = Math.min(p.rush>0?SPEED_LIMITS.rush:SPEED_LIMITS.ground, Math.max(item.escape?360:0,p.speed + 185));
          p.vx += 100;
          p.boost = 2.5;
          p.stall=0;p.mistakes=Math.max(0,p.mistakes-1);
          this.event('trick', { text: 'RUSH BOOST', points: 80 });
          this.score += 80;
        } else if(this.touchesObstacle(item,previousX))this.stumble(item);
      }
      this.score += (p.x - previousX) * 0.055;
      const pressure=this.sandAt(p.x)>.15;
      const threat=clamp((p.x-2400)/22000,0,1);
      const lowSpeed=p.x<2400?160:pressure?360:300+threat*70;
      this.slowTime = p.rush>0?0:p.speed < lowSpeed ? this.slowTime + dt : Math.max(0, this.slowTime - dt * 1.5);
      const wasActive = this.dog.active;
      if (this.mode!=='trial'&&!wasActive && p.rush<=0&&this.slowTime > .7) {
        this.dog.active = true;
        this.dog.distance = 215-threat*35;
        this.event('warning', { text: 'LOW SPEED · THE HOUND IS NEAR' });
      }
      if (this.dog.active) {
        this.dog.distance += (p.recoveryGap?0:clamp((p.speed-(pressure?390:340+threat*70))*.95,-160,120)) * dt;
        if(p.recovery>0||p.recoveryGap)this.dog.distance=Math.max(55,this.dog.distance);
        this.dog.warning = p.recovery<=0&&!p.recoveryGap&&(p.speed < (pressure?390:340+threat*70)||this.dog.distance<175);
        const stretch=this.encounters.find(e=>p.x>e.flatStart&&p.x<e.end);
        if(stretch)stretch.chased=true;
        if (this.dog.distance > 650) {
          this.dog.active = false; this.dog.warning = false; this.slowTime = 0;
          const escape=stretch||this.encounters.find(e=>e.chased&&!e.cleared&&p.x>=e.end&&p.x<e.end+1600);
          if(escape?.chased&&!escape.cleared){escape.cleared=true;this.score+=150;this.event('escape',{x:p.x,y:p.y,points:150});}
        }
        const reachable=p.grounded||!this.gapAt(p.x)&&this.terrain(p.x)-p.y<48;
        if(this.dog.distance<24){if(reachable)this.crash('THE HOUND CAUGHT UP');else this.dog.distance=24;}
      }
      p.stall=this.mode!=='trial'&&p.rush<=0&&p.recovery<=0&&p.grounded&&p.speed<85&&p.mistakes>0?p.stall+dt:Math.max(0,p.stall-dt*2);
      if(p.stall>1.65)this.crash('LOST MOMENTUM');
      this.generate(2600);
      this.items = this.items.filter(i => !i.hit && i.x > p.x - 300);
      this.rails = this.rails.filter(r => r.end > p.x - 600);
      this.ramps = this.ramps.filter(r => r.recovery > p.x - 600);
      this.gaps = this.gaps.filter(g => g.end > p.x - 600);
      this.scenery = this.scenery.filter(s => s.x > p.x - 900);
      this.encounters = this.encounters.filter(e=>e.end>p.x-1600);
    }
    drainEvents() { const events = this.events; this.events = []; return events; }
  }
  // Hand-authored, versioned courses: identical terrain, ramps and boost
  // locations for every player, with no prize or endless-run RNG involved.
  const TRIAL_COURSES = [
    {id:1,name:'DUNE DASH',theme:0,gaps:[[4200,350],[7960,360]],legs:[[900,160],[1000,380],[850,-170],[1200,520],[800,30],[1250,650],[650,-160],[1000,650],[850,40]]},
    {id:2,name:'CANYON FLOW',theme:0,gaps:[[3720,370],[14400,440]],legs:[[800,130],[1500,900],[900,-380],[1100,60],[1700,1150],[900,-240],[1500,470],[1600,860],[900,-360],[1600,1250],[2600,80]]},
    {id:3,name:'FOREST FLIGHT',theme:1,gaps:[[6900,430],[13750,320],[18400,460]],legs:[[800,150],[1400,-350],[2200,1700],[1400,-700],[1800,70],[2500,1800],[1300,-650],[1900,1400],[1700,260],[1200,-520],[1900,1600],[1500,90]]},
    {id:4,name:'RIDGE RUNNER',theme:2,gaps:[[7950,480],[19800,380],[24900,540]],legs:[[1000,180],[2000,-720],[2200,2200],[1700,-900],[2600,180],[2600,2300],[2000,-1000],[2700,2400],[1800,-450],[2400,1850],[1500,-850],[2000,2250],[1700,100]]},
    {id:5,name:'MIDNIGHT SUMMIT',theme:3,gaps:[[8120,530],[18600,580],[33000,610]],legs:[[1100,160],[1900,-900],[2100,2300],[1800,-1100],[3200,120],[2800,3000],[1900,-900],[2700,2000],[2600,60],[2500,-1400],[2800,3300],[2600,800],[1700,-1000],[2600,3000],[2300,100]]}
  ].map(course=>Object.freeze({...course,distance:course.legs.reduce((sum,[length])=>sum+length,0),gaps:Object.freeze(course.gaps.map(gap=>Object.freeze(gap))),legs:Object.freeze(course.legs.map(([length,drop],index)=>Object.freeze([length,index===0?drop:Math.round(drop*(drop>100?1.12:drop<0?1.1:1))])))}));
  Object.freeze(TRIAL_COURSES);
  class Trial extends Run {
    constructor(level=1){
      const course=TRIAL_COURSES.find(c=>c.id===level);
      if(!course)throw new RangeError('Choose a Speed Trial level from 1 to 5.');
      super(120701+level*7919);
      this.mode='trial';this.trial=course;this.theme=course.theme;
      this.random=random(this.seed);
      this.items=[];this.ramps=[];this.rails=[];this.gaps=[];this.encounters=[];this.scenery=[];this.events=[];
      this.nextFeature=this.nextScenery=Infinity;this.finished=false;this.finishTime=null;this.boostsCollected=0;
      Object.assign(this.player,{x:0,y:this.terrain(0),angle:this.slope(0),speed:310,vx:310,boost:1.8});
      let start=0;
      for(const [index,[length,drop]] of course.legs.entries()){
        if(index>0&&drop<0&&level>1){
          const ramp=this.makeRamp(start+length-320,true);ramp.launch=220+level*16;
          const x=ramp.end+150,t=150/480,angle=this.rampSlope(ramp,ramp.end);
          this.items.push({type:'boost',x,y:Math.min(ramp.endY+(480*Math.sin(angle)-440)*t+345*t*t-17,this.terrain(x)-80),aerial:true,hit:false});
        }
        const x=start+length*(index%2?.55:.35),aerial=index>0&&(index%2===1||level>2);
        this.items.push({type:'boost',x,y:this.terrain(x)-(aerial?195+(level-1)*10:3),aerial,hit:false});
        start+=length;
      }
      for(const [x,width]of course.gaps){
        this.gaps.push({x,end:x+width});
        const pad=x-440;
        this.items.push({type:'boost',x:pad,y:this.terrain(pad)-3,hit:false});
      }
      // Fixed, spaced jump gates. Keep clear of boost pads, ramp seams and
      // gap approaches so every obstacle has a readable takeoff and landing.
      const obstacleTypes=['rock','log','crate','barrier','stack'];
      let lastObstacle=-Infinity;
      for(let x=950;x<course.distance-600;x+=120){
        if(x-lastObstacle<Math.max(950,1450-level*70))continue;
        if(Math.abs(this.derivative(x))>.48||this.derivative(x-500)>.65)continue;
        if(this.gaps.some(g=>x>g.x-850&&x<g.end+550))continue;
        if(this.ramps.some(r=>x>r.x-500&&x<r.recovery+500))continue;
        if(this.items.some(i=>Math.abs(i.x-x)<320))continue;
        const type=obstacleTypes[(Math.round(x/120)+level)%Math.min(5,level+1)];
        this.items.push({type,x,y:this.terrain(x),width:48+level*5,height:36+level*4,
          hazard:true,heavy:true,hit:false});
        lastObstacle=x;
      }
      this.items=this.items.filter(item=>!this.gaps.some(gap=>item.x>gap.x&&item.x<gap.end));
      for(let x=650;x<course.distance;x+=800)if(!this.gapAt(x))this.scenery.push({x,type:'lantern',scale:.8});
    }
    baseTerrain(x){
      if(!this.trial)return super.baseTerrain(x);
      let start=0,y=340;
      for(const [length,drop]of this.trial.legs){
        if(x<=start+length)return y+drop*this.smooth(clamp((x-start)/length,0,1));
        start+=length;y+=drop;
      }
      return y+(x-start)*.12;
    }
    generate(ahead){if(!this.trial)super.generate(ahead);}
    step(dt){
      if(this.dead)return;
      super.step(dt);
      if(!this.dead&&this.player.x>=this.trial.distance){
        const before=this.previousPlayer.x,travel=this.player.x-before;
        this.finishTime=this.time-dt+dt*clamp((this.trial.distance-before)/Math.max(.00001,travel),0,1);
        this.player.x=this.trial.distance;this.finished=true;this.dead=true;this.reason='COURSE COMPLETE';this.release();
        this.event('finish',{seconds:this.finishTime,level:this.trial.id});
      }
    }
  }
  return { Run, Trial, TRIAL_COURSES, SPEED_LIMITS, clamp, angleDelta, TAU, VERSION: 'flow-web-16-flip-share' };
});
