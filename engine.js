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
      this.biomeSpan=4700+this.terrainRandom(0,982451653)*1100;
      const routes=[1,2,3].sort((a,b)=>this.terrainRandom(a,433494437)-this.terrainRandom(b,433494437));
      this.biomes=[0,...routes];
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
      this.player = {
        x: 0, y: this.terrain(0), speed: 310, vx: 310, vy: 0,
        angle: this.slope(0), grounded: true, rail: null, ramp: null,
        held: false, heldTime: 0, airborne: 0, turns: 0, spin: 0,
        coyote: 0.12, buffer: 0, invulnerable: 0, boost: 1.8, stagger: 0
      };
      this.time = 0;
      this.coins = 0;
      this.score = 0;
      this.combo = 1;
      this.dead = false;
      this.reason = '';
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
    region(x) {
      const cell = Math.floor((x - 1800) / 4200);
      const mode = Math.floor(this.terrainRandom(cell, 7919) * 5);
      return ['ROLLING DUNES', 'GIANT DUNE', 'DEEP VALLEY', 'RUSH DESCENT', 'RIDGELINE'][mode];
    }
    biome(x) { return this.biomes[Math.floor(Math.max(0,x)/this.biomeSpan)%this.biomes.length]; }
    biomeTransition(x) {
      const section=Math.floor(Math.max(0,x)/this.biomeSpan),t=Math.max(0,x)/this.biomeSpan-section;
      return {from:this.biomes[section%4],to:this.biomes[(section+1)%4],mix:this.smooth(clamp((t-.83)/.17,0,1))};
    }
    baseTerrain(x) {
      const t = this.profile;
      const opening = Math.cos(x * TAU / t.longWave + .3 + this.phase) * t.longHeight
        + Math.sin(x * TAU / t.shortWave + t.shortPhase) * t.shortHeight;
      // A broad, safe entry slope blends into non-repeating terrain after 120m.
      const blend = this.smooth(clamp((x - 1200) / 1500, 0, 1));
      let varied = this.noise(x, 1800, 173) * 165 + this.noise(x, 650, 947) * 38;
      const cell = Math.floor((x - 1800) / 4200);
      for (let i = cell - 1; i <= cell + 1; i++) {
        const mode = Math.floor(this.terrainRandom(i, 7919) * 5);
        const center = 1800 + i * 4200 + 1300 + this.terrainRandom(i, 104729) * 1500;
        const radius = 1400 + this.terrainRandom(i, 15485863) * 450;
        const u = (x - center) / radius;
        if (Math.abs(u) >= 1) continue;
        // Compact C2 bumps: no seams, cliffs or sudden changes in slope.
        const envelope = Math.pow(1 - u * u, 3);
        const height = 260 + this.terrainRandom(i, 32452843) * 290;
        if (mode === 1) varied -= height * envelope;
        else if (mode === 2) varied += height * envelope;
        else if (mode === 3) varied += height * u * envelope;
        else if (mode === 4) varied -= 200 * envelope * Math.cos(u * Math.PI * 2);
        else varied += 105 * envelope * Math.sin(u * Math.PI * 3);
      }
      return 230 + x * t.grade + opening * (1 - blend) + varied * blend;
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
      return rail.y + (rail.endY - rail.y) * t + Math.sin(t * Math.PI) * 35;
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
    generate(ahead) {
      const limit = this.player.x + ahead;
      while (this.nextFeature < limit) {
        const index = this.feature++;
        let x=index===2?Math.max(this.nextFeature,2600+this.terrainRandom(0,179)*450):this.nextFeature;
        const stage = Math.min(4, Math.floor(x / 5000));
        const choices = this.derivative(x) < -.12 ? [0,0,7,7,2,5] : [0,0,2,2,5,7,4,8,9];
        let pattern = index === 0 ? 0 : index === 1 ? (this.random() < .55 ? 7 : 0) : choices[Math.floor(this.random() * choices.length)];
        // Active-play gates appear after the gentle introduction. They are
        // spaced apart from automatic ramps and have clear run-up/landing space.
        if(index===2||(index>2&&index%3===2))pattern=10;
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
        if(index > 2 && pattern === this.lastPattern && [2,5,9].includes(pattern)) pattern = 0;
        this.lastPattern = pattern;
        let spacing = 440 + this.random() * 410;
        if (pattern === 2) {
          const end=x+230+this.random()*65;
          const ramp={x,end,recovery:end+220+this.random()*45,height:48+this.random()*20,y};
          for(let tune=0;tune<4;tune++){
            let steep=false;
            for(let cx=x;cx<=ramp.recovery;cx+=12)if(Math.abs((this.rampY(ramp,cx+1)-this.rampY(ramp,cx-1))*.5)>1.35)steep=true;
            if(!steep)break;ramp.height*=.7;
          }
          ramp.endY=this.rampY(ramp,ramp.end);
          this.ramps.push(ramp);
          for (let i = 0; i < 8; i++) {
            const cx = ramp.end + 45 + i * 38;
            this.items.push({ type: 'coin', x: cx, y: ramp.endY - 40 - Math.sin(i / 7 * Math.PI) * 120, hit: false });
          }
          spacing = ramp.recovery-x+270+this.random()*170;
        } else if (pattern === 5) {
          const end = x + 760 + this.random() * 170;
          const rail = { x, end, y: y - 105, endY: this.terrain(end) - 130 };
          let clearance = 0;
          for (let cx = x; cx <= end; cx += 16) clearance = Math.max(clearance, this.railY(rail,cx) - this.terrain(cx) + 55);
          rail.y -= clearance; rail.endY -= clearance;
          this.rails.push(rail);
          for (let i = 1; i <= 17; i++) {
            const cx = x + i * (rail.end - x) / 19;
            this.items.push({ type: 'coin', x: cx, y: this.railY(rail, cx) - 24, hit: false });
          }
          this.coinTrail(x - 100, 5, 135);
          spacing = 1080 + this.random() * 260;
        } else if (pattern === 7) {
          this.items.push({ type: 'boost', x, y: y - 3, hit: false });
          this.coinTrail(x + 70, 8, 15);
        } else if (pattern === 9 && x>4500 && this.derivative(x) > .05) {
          const gap = { x, end: x + 240 + stage * 24 };
          this.gaps.push(gap);
          this.coinTrail(x - 180, 11, 140);
          spacing = 700 + this.random() * 190;
        } else if(pattern===10){
          const kind=index===2?'barrier':['barrier','spikes','stack','cart'][Math.floor(this.random()*4)];
          const size={barrier:[66,38],spikes:[70,31],stack:[48,61],cart:[58,42]}[kind];
          this.items.push({type:kind,x,y,width:size[0],height:size[1],fatal:true,hit:false});
          this.coinTrail(x-155,7,105+stage*8);
          this.coinTrail(x+175,5,15);
          spacing=740+this.random()*260;
        } else if ((pattern === 4 || pattern === 8) && x > 2400) {
          this.items.push({ type: this.random() < 0.55 ? 'rock' : 'log', x, y, width:45,height:27,hit: false });
          if (stage > 1 && this.random() < 0.45) this.items.push({ type: 'rock', x: x + 145, y: this.terrain(x + 145), hit: false });
          this.coinTrail(x + 150, 7, 30);
        } else this.coinTrail(x, 8 + Math.floor(this.random() * 4), index % 3 === 0 ? 95 : 0);
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
    release() { this.player.held = false; this.player.heldTime = 0; }
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
      p.angle = angle;
    }
    land(y, angle, rail) {
      const p = this.player;
      const impact = p.vy * Math.cos(angle) - p.vx * Math.sin(angle);
      const rotation = Math.abs(angleDelta(p.angle - angle));
      const impactLimit=Math.max(760,920-Math.floor(p.x/5000)*25);
      if (p.airborne > 0.25 && ((p.held && rotation > 1.02) || impact > impactLimit)) {
        this.crash(p.held && rotation > 1.02 ? 'CRASH LANDING' : 'HARD LANDING');
        return;
      }
      p.speed = clamp(p.vx * Math.cos(angle) + p.vy * Math.sin(angle), 115, 780);
      if (impact > 650) p.speed *= 0.8;
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
        if (turns > 0) {
          this.combo = Math.min(8, this.combo + turns);
          const points = 500 * turns * this.combo;
          this.score += points;
          p.speed = Math.min(780, p.speed + 50 * turns);
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
      if (p.buffer > 0) this.jump();
    }
    stumble(item) {
      const p = this.player;
      if (p.invulnerable > 0) return;
      item.hit = true;
      p.speed = 105;
      p.vx = Math.min(p.vx, 105);
      p.invulnerable = 1.3;
      p.stagger = 0.65;
      this.combo = 1;
      this.slowTime += 0.7;
      this.event('stumble', { x: p.x, y: p.y });
    }
    crash(reason) {
      if (this.dead) return;
      this.dead = true;
      this.reason = reason;
      this.release();
      this.event('crash', { reason });
    }

    step(dt) {
      if (this.dead) return;
      const p = this.player;
      this.time += dt;
      p.buffer = Math.max(0, p.buffer - dt);
      p.coyote = Math.max(0, p.coyote - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.boost = Math.max(0, p.boost - dt);
      p.stagger = Math.max(0, p.stagger - dt);
      if (p.held) p.heldTime += dt;
      const previousX = p.x, previousY = p.y;
      if (p.grounded) {
        let angle = p.rail ? this.railSlope(p.rail, p.x) : p.ramp ? this.rampSlope(p.ramp, p.x) : this.slope(p.x);
        const acceleration = 620 * Math.sin(angle) * 0.45 + 24 - p.speed * 0.06 + (p.boost > 0 ? 75 : 0);
        p.speed = clamp(p.speed + acceleration * dt, p.stagger > 0 || angle >= -.08 ? 75 : 175, 760);
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
            this.launch(angle, 110);
            this.event('trick', { text: 'LAUNCH', points: 0 });
          }
        } else {
          const ramp = this.ramps.find(r => previousX <= r.x + 14 && p.x >= r.x && p.x < r.end && p.y >= r.y - 12);
          if (ramp) { p.ramp = ramp; p.y = this.rampY(ramp, p.x); }
          else if (this.gapAt(p.x)) this.launch(angle);
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
        p.vx = clamp(p.vx + dt * 7, 85, 790);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.speed = p.vx;
        if (p.held && p.heldTime > 0.14) {
          const rotation = 5.2 * dt;
          p.angle -= rotation;
          p.spin += rotation;
        } else {
          const target = this.slope(p.x + p.vx * 0.15);
          p.angle += angleDelta(target - p.angle) * Math.min(1, 8.5 * dt);
        }
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
          if (previousY > this.terrain(previousX) + 35 && p.y > this.terrain(p.x) + 35) this.crash('MISSED THE GAP');
          else this.land(this.terrain(p.x), this.slope(p.x));
        }
        if (p.y > this.terrain(p.x) + 600) this.crash('MISSED THE GAP');
      }
      for (const item of this.items) {
        const half=(item.width||42)*.5+12+(item.fatal?item.height:0);
        if (item.hit || (item.fatal?Math.max(previousX,p.x)<item.x-half||Math.min(previousX,p.x)>item.x+half:Math.abs(item.x-p.x)>35)) continue;
        if (item.type === 'coin' && Math.abs(item.y - (p.y - 17)) < 32) {
          item.hit = true;
          this.coins++;
          this.score += 30 * this.combo;
          this.event('coin', { x: item.x, y: item.y });
        } else if (item.type === 'boost' && Math.abs(item.y - p.y) < 22) {
          item.hit = true;
          p.speed = Math.min(760, p.speed + 160);
          p.vx += 100;
          p.boost = 2.5;
          this.event('trick', { text: 'RUSH BOOST', points: 80 });
          this.score += 80;
        } else if(item.fatal){
          const angle=this.slope(item.x),dx=p.x-item.x,dy=p.y-item.y;
          const localX=dx*Math.cos(angle)+dy*Math.sin(angle),localY=dy*Math.cos(angle)-dx*Math.sin(angle);
          if(Math.abs(localX)<item.width*.5+12&&localY>-item.height-5&&localY<32){
            item.hit=true;this.crash(item.type==='spikes'?'HIT THE SPIKES':'HIT THE '+item.type.toUpperCase());
          }
        } else if (['rock','crate','log'].includes(item.type) && p.y > item.y - (item.height||30) && p.y < item.y + 15) this.stumble(item);
      }
      this.score += (p.x - previousX) * 0.055;
      this.slowTime = p.speed < 155 ? this.slowTime + dt : Math.max(0, this.slowTime - dt * 1.5);
      const wasActive = this.dog.active;
      if (!wasActive && this.slowTime > 1.0) {
        this.dog.active = true;
        this.dog.distance = 330;
        this.event('warning', { text: 'LOW SPEED · THE HOUND IS NEAR' });
      }
      if (this.dog.active) {
        this.dog.distance += (p.speed > 215 ? 150 : -72) * dt;
        this.dog.warning = p.speed < 175;
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
  return { Run, clamp, angleDelta, TAU, VERSION: 'flow-web-4' };
});
