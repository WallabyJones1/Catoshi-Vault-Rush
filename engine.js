(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VaultRush = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
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
      this.events = [];
      this.nextFeature = 560 + this.random() * 280;
      this.nextScenery = -50;
      this.feature = 0;
      this.redSites = 0;
      this.lastRedSite = 0;
      this.lastRushSite = 0;
      this.redTokens = 0;
      this.rushPickups = 0;
      this.maxLives = 3;
      this.lives = this.maxLives;
      this.heartsCollected = 0;
      this.heartSites = 0;
      this.nextHeartSite = 8000 + this.terrainRandom(0, 86028121) * 6500;
      this.player = {
        x: 0, y: this.terrain(0), speed: 310, vx: 310, vy: 0,
        angle: this.slope(0), grounded: true, rail: null, ramp: null,
        held: false, heldTime: 0, airborne: 0, turns: 0, spin: 0,
        coyote: 0.12, buffer: 0, invulnerable: 0, boost: 1.8, rush: 0, stagger: 0, recovery: 0, recoveryGap: null, flipStarted: false
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
        const peak=kind===1?.60+this.terrainRandom(index,104729)*.09:kind===2?.32+this.terrainRandom(index,104729)*.11:.45;
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
    biome(x) {return this.sectionAt(x)?.biome??0;}
    biomeTransition(x) {
      const section=this.sectionAt(x);
      if(!section)return {from:0,to:0,mix:0};
      const t=(x-section.start)/section.length;
      return {from:section.biome,to:this.sectionAt(section.end+1).biome,mix:this.smooth(clamp((t-.84)/.16,0,1))};
    }
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
        }else if(section.kind===4)varied-=section.height*.34*envelope*Math.cos(u*Math.PI*4);
        else if(section.kind===0)varied+=155*envelope*Math.sin(u*Math.PI*4);
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
    terrain(x) {
      let lift=0;
      for(const ramp of this.ramps||[])lift+=this.rampLift(ramp,x);
      return this.baseTerrain(x)-lift;
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
      return this.baseTerrain(x)-this.rampLift(ramp,x);
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
    generate(ahead) {
      const limit = this.player.x + ahead;
      while (this.nextFeature < limit) {
        const index = this.feature++;
        let x=index===2?Math.max(this.nextFeature,2600+this.terrainRandom(0,179)*450):this.nextFeature;
        const stage = Math.min(4, Math.floor(x / 5000));
        const biome=this.biome(x),uphill=this.derivative(x)<-.12;
        // Each environment has a different rhythm without consuming terrain RNG.
        const choices=uphill?[0,7,7,2,3,5,5]:biome===1?[0,2,3,5,5,7,4,4,8,9]
          :biome===2?[0,2,3,5,5,7,8,8,9]:biome===3?[0,2,3,5,5,7,4,8,9,9]:[0,2,2,3,3,5,5,7,4,8,9];
        let pattern = index === 0 ? 0 : index === 1 ? (this.random() < .55 ? 7 : 0) : choices[Math.floor(this.random() * choices.length)];
        // Active-play gates appear after the gentle introduction. They are
        // spaced apart from automatic ramps and have clear run-up/landing space.
        if(index===2||(index>2&&index%3===2))pattern=10;
        // Five optional quest routes, progressively farther apart. A day's
        // ten-token goal is cumulative across runs, never ten in one run.
        const tiers=[9000,17500,31000,48000,72000];
        const redSite=this.redSites<5&&x>=Math.max(tiers[this.redSites]+this.terrainRandom(this.redSites,62851)*700,this.lastRedSite+5500);
        if(redSite)pattern=this.terrainRandom(this.redSites,68389)<.5?3:5;
        if(pattern===10){
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
            if(this.ramps.some(r=>r.end>candidate-650&&r.x<candidate+80)||this.gaps.some(g=>g.end>candidate-500&&g.x<candidate+80))risk+=3;
            if(risk<bestRisk){best=candidate;bestRisk=risk;}
            if(risk<=1)break;
          }
          x=best;
        }
        const y=this.terrain(x);
        if(!redSite&&index > 2 && pattern === this.lastPattern && [2,5,9].includes(pattern)) pattern = 0;
        this.lastPattern = pattern;
        let spacing = 440 + this.random() * 410;
        if (pattern === 2 || pattern === 3) {
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
          spacing = ramp.recovery-x+270+this.random()*170;
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
          spacing = (chain?chain.end-x:1080)+300+this.random()*200;
        } else if (pattern === 7) {
          this.items.push({ type: 'boost', x, y: y - 3, hit: false });
          this.coinTrail(x + 70, 8, 15);
        } else if (pattern === 9 && x>4500 && this.derivative(x) > .05) {
          const gap = { x, end:x+240+stage*30+this.terrainRandom(index,16908799)*100 };
          this.gaps.push(gap);
          this.coinTrail(x - 180, 11, 140);
          spacing = 700 + this.random() * 190;
        } else if(pattern===10){
          const kinds=biome===1?['log','rock','barrier','stack']:biome===2?['cart','stack','barrier','spikes']
            :biome===3?['rock','spikes','barrier','log']:['barrier','spikes','stack','cart'];
          const kind=index===2?'barrier':kinds[Math.floor(this.random()*kinds.length)];
          const size={barrier:[66,38],spikes:[70,31],stack:[48,61],cart:[58,42],log:[65,32],rock:[49,35]}[kind];
          const scale=index===2?1:.82+this.random()*.40;
          this.items.push({type:kind,x,y,width:size[0]*scale,height:size[1]*scale,hazard:true,heavy:true,hit:false});
          this.coinTrail(x-155,7,105+stage*8);
          this.coinTrail(x+175,5,15);
          spacing=740+this.random()*260;
        } else if ((pattern === 4 || pattern === 8) && x > 2400) {
          this.items.push({ type: this.random() < (biome===1?.25:.70) ? 'rock' : 'log', x, y, width:38+this.random()*18,height:23+this.random()*10,hit: false });
          if (stage > 1 && this.random() < 0.45) this.items.push({ type: 'rock', x: x + 145, y: this.terrain(x + 145), hit: false });
          this.coinTrail(x + 150, 7, 30);
        } else this.coinTrail(x, 8 + Math.floor(this.random() * 4), index % 3 === 0 ? 95 : 0);
        this.placeHeart(x,spacing,index);
        this.nextFeature = x+spacing;
      }
      while (this.nextScenery < limit + 700) {
        const x = this.nextScenery;
        this.scenery.push({ x, y: this.terrain(x), type: this.random() < 0.18 ? 'pylon' : 'lantern', scale: 0.7 + this.random() * 0.6 });
        this.nextScenery += 390 + this.random() * 550;
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
      p.vx = p.speed * Math.cos(angle);
      p.vy = p.speed * Math.sin(angle) - (350 + p.speed * 0.18);
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
      this.event('jump', { x: p.x, y: p.y, automatic: true });
    }
    land(y, angle, rail) {
      const p = this.player;
      const impact = p.vy * Math.cos(angle) - p.vx * Math.sin(angle);
      const rotation = Math.abs(angleDelta(p.angle - angle));
      const impactLimit=Math.max(760,920-Math.floor(p.x/5000)*25);
      const badFlip=p.rush<=0&&p.invulnerable<=0&&p.recovery<=0&&!p.recoveryGap&&p.airborne>.25&&p.held&&rotation>1.02;
      p.speed = clamp(p.vx * Math.cos(angle) + p.vy * Math.sin(angle), p.rush>0?850:115, p.rush>0?1080:780);
      const rough=badFlip||p.rush<=0&&p.recovery<=0&&!p.recoveryGap&&impact>impactLimit;
      if (badFlip) {
        // A mistimed flip spends one life, just like a rock. An upright
        // automatic landing, however high, does not spend a life.
        p.speed=Math.max(115,p.speed*.55);p.stagger=.65;p.recovery=2;p.invulnerable=1.25;
        this.combo=1;this.slowTime=0;
        if(this.dog.active)this.dog.distance=Math.max(180,this.dog.distance);
        this.lives--;
        this.event('stumble',{x:p.x,y,angle,heavy:true,material:'stone',kind:'flip',lifeLost:true,lives:this.lives,fatal:this.lives===0});
        if(this.lives===0){p.y=y;this.crash('OUT OF LIVES');return;}
      } else if(rough){
        // Auto-aligned high falls are recoverable. Fall speed alone must never
        // kill a rider whose board is upright; keep the impact readable.
        p.speed=Math.max(150,p.speed*.72);p.stagger=Math.max(p.stagger,.38);
        p.recovery=Math.max(p.recovery,1.2);this.combo=1;this.slowTime=0;
        if(this.dog.active)this.dog.distance=Math.max(180,this.dog.distance);
        this.event('stumble',{x:p.x,y,angle,heavy:false,material:'stone',kind:'landing'});
      }else if(p.rush<=0&&impact>650)p.speed*=.8;
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
      if (p.airborne > 0.35) {
        const turns = Math.floor(p.spin / TAU + 0.025);
        if (turns > 0 && !rough) {
          this.combo = Math.min(8, this.combo + turns);
          const points = 500 * turns * this.combo;
          this.score += points;
          p.speed = Math.min(p.rush>0?1080:780, p.speed + 50 * turns);
          p.boost = 1.6;
          this.event('trick', { text: turns > 1 ? `${turns}× BACKFLIP` : 'BACKFLIP', points });
        } else if (impact < 420) {
          this.score += 100;
          this.event('trick', { text: 'CLEAN LANDING', points: 100 });
        }
        this.event('land', { x: p.x, y: p.y, clean: impact < 500 });
      }
      p.airborne = 0;
      p.spin = 0;
      p.turns = 0;
      p.flipStarted = false;
      if (p.buffer > 0) this.jump();
    }
    stumble(item) {
      const p = this.player;
      // Consume a collision once, including during recovery. No obstacle can
      // trap the rider inside its hitbox and repeatedly remove momentum.
      if (item.hit || this.dead) return;
      item.hit = true;
      if (p.invulnerable > 0 || p.rush > 0) return;
      const heavy=Boolean(item.heavy||item.hazard),before=p.speed;
      p.speed=Math.min(before,clamp(before*(heavy?.58:.72),200,heavy?520:600));
      p.vx*=p.speed/Math.max(1,before);
      if(!p.grounded)p.vy*=.8;
      p.boost=0;
      p.invulnerable=1.25;
      p.stagger=heavy?.42:.28;
      p.recovery=heavy?1.5:1.1;
      p.spin=0;p.turns=0;
      // Preserve the slowdown without allowing the same collision to cause
      // a lethal landing or an immediate catch by an already nearby hound.
      if(!p.grounded)p.vy=clamp(p.vy,-280,350);
      if(this.dog.active)this.dog.distance=Math.max(180,this.dog.distance);
      this.combo = 1;
      this.slowTime = 0;
      this.lives--;
      const material=['barrier','cart','stack','crate'].includes(item.type)?'metal':item.type==='log'?'wood':'stone';
      this.event('stumble', { x:p.x,y:p.y,angle:p.angle,heavy,loss:before-p.speed,material,
        obstacle:{...item},obstacleAngle:this.slope(item.x),kind:item.type,lifeLost:true,lives:this.lives,fatal:this.lives===0 });
      if(this.lives===0)this.crash('OUT OF LIVES');
    }
    touchesObstacle(item,previousX=this.player.x) {
      const p=this.player;
      if(item.hit)return false;
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
      p.buffer = Math.max(0, p.buffer - dt);
      p.coyote = Math.max(0, p.coyote - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.boost = Math.max(0, p.boost - dt);
      p.rush = Math.max(0, p.rush - dt);
      p.stagger = Math.max(0, p.stagger - dt);
      p.recovery = Math.max(0,p.recovery-dt);
      if(p.recoveryGap&&p.x>=p.recoveryGap.end)p.recoveryGap=null;
      if (p.held) p.heldTime += dt;
      const previousX = p.x, previousY = p.y;
      if (p.grounded) {
        let angle = p.rail ? this.railSlope(p.rail, p.x) : p.ramp ? this.rampSlope(p.ramp, p.x) : this.slope(p.x);
        const acceleration = 620 * Math.sin(angle) * 0.45 + 24 - p.speed * 0.06 + (p.boost > 0 ? 75 : 0) + (p.recovery>0?105:0);
        const maximum=p.rush>0?1080:Math.max(760,p.speed-360*dt);
        p.speed = clamp(p.speed + acceleration * dt, p.rush>0?850:p.stagger>0?160:angle>=-.08?75:200, maximum);
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
            if (normalAcceleration > 670 && p.speed > 510) this.launch(angle);
            else p.y = this.terrain(p.x);
          }
        }
        if (p.grounded) { p.angle = angle; p.coyote = 0.12; }
      } else {
        p.airborne += dt;
        p.vy += 690 * dt;
        p.vx = clamp(p.vx + dt * 7, p.rush>0?820:85, p.rush>0?1080:Math.max(790,p.vx-360*dt));
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
            p.speed=950;p.vx=Math.max(p.vx,900);this.slowTime=0;this.dog.active=false;this.dog.warning=false;
            this.event('rush',{x:item.x,y:item.y,seconds:7});
          }else if(this.redTokens<5){this.redTokens++;this.event('redRush',{x:item.x,y:item.y,total:this.redTokens});}
        } else if (item.type === 'boost' && Math.abs(item.y - p.y) < 22) {
          item.hit = true;
          p.speed = Math.min(p.rush>0?1080:760, p.speed + 160);
          p.vx += 100;
          p.boost = 2.5;
          this.event('trick', { text: 'RUSH BOOST', points: 80 });
          this.score += 80;
        } else if(this.touchesObstacle(item,previousX))this.stumble(item);
      }
      this.score += (p.x - previousX) * 0.055;
      this.slowTime = p.rush>0||p.recovery>0?0:p.speed < 160 ? this.slowTime + dt : Math.max(0, this.slowTime - dt * 1.5);
      const wasActive = this.dog.active;
      if (!wasActive && p.rush<=0&&this.slowTime > 1.0) {
        this.dog.active = true;
        this.dog.distance = 330;
        this.event('warning', { text: 'LOW SPEED · THE HOUND IS NEAR' });
      }
      if (this.dog.active) {
        this.dog.distance += (p.recovery>0||p.recoveryGap?150:p.speed > 215 ? 150 : -72) * dt;
        this.dog.warning = p.recovery<=0&&!p.recoveryGap&&p.speed < 175;
        if (this.dog.distance > 520) { this.dog.active = false; this.dog.warning = false; this.slowTime = 0; }
        if (this.dog.distance < 24) this.crash('THE HOUND CAUGHT UP');
      }
      this.generate(2600);
      this.items = this.items.filter(i => !i.hit && i.x > p.x - 300);
      this.rails = this.rails.filter(r => r.end > p.x - 600);
      this.ramps = this.ramps.filter(r => r.recovery > p.x - 600);
      this.gaps = this.gaps.filter(g => g.end > p.x - 600);
      this.scenery = this.scenery.filter(s => s.x > p.x - 900);
    }
    drainEvents() { const events = this.events; this.events = []; return events; }
  }
  return { Run, clamp, angleDelta, TAU, VERSION: 'flow-web-11' };
});
