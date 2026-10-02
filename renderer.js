(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VaultRushRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const W = 960, H = 540;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const assets = {
    atmosphere: 'canyon-atmosphere.png',
    layers: 'canyon-endless-layers.png',
    characters: 'catoshi-clean-actions.png',
    scenery: 'vault-scenery-atlas.png',
    coin: 'catoshi-coin.png',
    biomes: 'terrain-biomes-v1.png',
    obstacles: 'terrain-obstacles-v1.png',
    rush: 'rush-pickups-v2.png'
  };
  // Explicit crops preserve the complete silhouettes, including every token.
  const characters = [
    [19,104,340,295], [393,125,335,276], [767,169,314,232], [1115,79,311,318],
    [44,436,324,302], [425,438,301,301], [767,515,320,242], [1131,508,290,251],
    [16,805,349,209], [349,803,381,211], [730,801,354,204], [1077,807,360,211]
  ];
  const props = [
    [57,38,375,370], [601,36,148,385], [936,180,353,238], [1381,236,322,185],
    [53,459,371,381], [492,693,393,137], [1010,600,222,219], [1489,558,143,283]
  ];
  // Stop before each transparent gutter. Extend the final solid row below the ridge.
  const strips = [[0,0,1672,292],[0,314,1672,286],[0,628,1672,280]];
  const biomeStrips = [[0,66,2146,172],[0,296,2146,179],[0,496,2146,211]];
  const obstacles = [
    [35,128,408,285], [480,217,410,195], [930,213,429,200], [1405,158,328,259],
    [40,617,414,199], [524,480,331,341], [967,450,253,376], [1275,512,475,311]
  ];
  const palettes = [
    ['#302820','#241e19'], ['#292b24','#1c201b'],
    ['#302d2a','#22201e'], ['#2c2927','#201d1c']
  ];
  function mixColor(a,b,t) {
    const av=parseInt(a.slice(1),16),bv=parseInt(b.slice(1),16);
    return '#'+[16,8,0].map(shift=>Math.round(((av>>shift)&255)*(1-t)+((bv>>shift)&255)*t).toString(16).padStart(2,'0')).join('');
  }

  function loadAssets(ImageType) {
    const Constructor = ImageType || Image;
    return Promise.all(Object.entries(assets).map(([key, src]) => new Promise((resolve, reject) => {
      const img = new Constructor();
      const timer = setTimeout(() => reject(new Error('Artwork loading timed out')), 15000);
      img.onload = () => { clearTimeout(timer); resolve([key, img]); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('Artwork could not load: ' + key)); };
      img.src = src;
    }))).then(entries => Object.fromEntries(entries));
  }

  class Renderer {
    constructor(context, images) {
      this.ctx = context;
      this.images = images;
      this.width = context.canvas?.width || W;
      this.height = context.canvas?.height || H;
      this.camera = { x: 0, y: 0, zoom: 0.93 };
      this.particles = [];
      this.dust = 0;
      this.landPose = 0;
      this.impactPose = 0;
      this.jumpPose = 0;
      this.flipPulse = 0;
      this.crashPose = null;
      this.hitObjects = [];
      this.shake = 0;
      this.intro = 0;
      this.ready = false;
      this.visualPlayer = null;
      this.clock = 0;
    }
    resize(run) {
      this.width = this.ctx.canvas?.width || W;
      this.height = this.ctx.canvas?.height || H;
      if(run)this.reset(run);
    }
    reset(run) {
      this.particles = [];
      this.landPose = 0;
      this.impactPose = this.jumpPose = this.flipPulse = 0;
      this.crashPose = null;
      this.hitObjects = [];
      this.visualPlayer = null;
      this.clock = 0;
      this.shake = 0;
      this.intro = 0;
      const p = run.player;
      const portrait=this.height>this.width;
      this.camera = { x: p.x - this.width * (portrait?.24:.22) / .93, y: p.y - this.height * (portrait?.60:.64) / .93, zoom: .93 };
      this.ready = true;
    }
    burst(x, y, color, amount, strength) {
      for (let i = 0; i < amount; i++) this.particles.push({
        x, y, vx: -25 - Math.random() * (strength || 90), vy: -10 - Math.random() * 75,
        life: .35 + Math.random() * .35, max: .7, color, size: 1 + Math.random() * 1.6
      });
    }
    handle(event) {
      if (event.type === 'coin') this.burst(event.x, event.y, '#e8a13a', 4, 50);
      if(event.type==='rush')this.burst(event.x,event.y,'#e8a13a',20,190);
      if(event.type==='redRush')this.burst(event.x,event.y,'#e03b3b',12,100);
      if(event.type==='heart')this.burst(event.x,event.y,'#3ddc54',12,90);
      if (event.type === 'land') { this.landPose = .22; this.burst(event.x, event.y, '#8d8880', 8); }
      if(event.type==='jump'){
        this.jumpPose=.18;this.burst(event.x,event.y,'#8d8880',5,45);
      }
      if(event.type==='flip-start'||event.type==='flip'){
        this.flipPulse=.24;this.burst(event.x,event.y-15,'#e8a13a',4,35);
      }
      if (event.type === 'stumble') {
        this.shake=event.heavy?.24:.14;this.impactPose=event.heavy?.55:.32;
        this.burst(event.x,event.y-8,'#8d8880',event.heavy?14:8,110);
        this.burst(event.x,event.y-25,'#e8a13a',4,65);
        if(event.lifeLost)this.burst(event.x,event.y-20,'#e03b3b',6,65);
        if(event.obstacle)this.hitObjects.push({...event.obstacle,life:.42,angle:event.obstacleAngle??event.angle});
      }
      if (event.type === 'crash') {
        this.shake=.32;this.crashPose={...event,age:0};
        this.burst(event.x,event.y-8,'#8d8880',22,170);
        this.burst(event.x,event.y-12,'#e8a13a',5,90);
      }
    }
    breakout(run) {
      this.intro = 1.7;
      this.camera.x -= 88;
      this.breached = false;
      const mount=this.groundPlacement(run,-108,155,0,[[-.46,.46]]);
      this.vaultY=mount.y-53-mount.burial*.5;
    }
    breach() {
      this.breached = true;
      this.shake = .32;
      for (let i = 0; i < 42; i++) {
        const direction = -1.35 + Math.random() * 2.3;
        const speed = 90 + Math.random() * 250;
        this.particles.push({ x: -108, y: this.vaultY,
          vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed - 70,
          life: .55 + Math.random() * .55, max: 1.1,
          color: i % 5 === 0 ? '#e8a13a' : i % 2 ? '#8d8880' : '#40382e',
          size: 2 + Math.random() * 5, angle: Math.random() * 6.28, spin: Math.random() * 8 - 4 });
      }
    }
    vault(run) {
      const ctx = this.ctx, t = 1.7 - this.intro;
      const charge = this.intro > 1.08;
      const blast = Math.max(0, t - .62);
      const mount=this.groundPlacement(run,-108,155,0,[[-.46,.46]]);
      const y=mount.y,doorY=-53-mount.burial*.5;
      // The vault embeds into the real hillside across its complete base.
      // Sand drawn afterwards masks the buried stone, without a floating pad.
      ctx.save();ctx.translate(-108,y);
      if (charge)ctx.translate(Math.sin(t*70)*t*1.8,0);
      this.prop(0,0,0,155);
      if(this.breached){
        ctx.fillStyle='#0a0908';ctx.beginPath();ctx.ellipse(8,doorY-8,26,39,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#40382e';ctx.lineWidth=3;ctx.stroke();
      }
      // A bright seam charges before the door is blown away.
      if (this.intro > 0) {
        const glow = charge ? t / .62 : Math.max(0,1 - blast * 3);
        ctx.globalAlpha = glow * .7;
        ctx.fillStyle = '#e8a13a';ctx.fillRect(20,doorY-41,3,67);
        ctx.globalAlpha = 1;
      }
      if (!this.breached) {
        this.vaultDoor(14,doorY,0);
      } else if (blast < 1.08 && this.intro > 0) {
        ctx.save();ctx.translate(14-blast*190,doorY-blast*180+blast*blast*160);
        ctx.rotate(-blast*5);this.vaultDoor(0,0,blast);ctx.restore();
        const radius=blast*240;
        ctx.globalAlpha=Math.max(0,.45-blast*.6);
        ctx.strokeStyle='#e8a13a';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(20,doorY,radius,0,Math.PI*2);ctx.stroke();
        // Smoke stays behind the hero and dissipates quickly.
        for(let i=0;i<6;i++){
          ctx.globalAlpha=Math.max(0,.3-blast*.3);
          ctx.fillStyle=i%2?'#8d8880':'#40382e';ctx.beginPath();
          ctx.arc(15+i*7+blast*24,doorY+18-i*8-blast*25,6+blast*(18+i*4),0,Math.PI*2);ctx.fill();
        }
      }
      ctx.restore();ctx.globalAlpha=1;
    }
    vaultDoor(x,y,t) {
      const ctx=this.ctx;ctx.save();ctx.translate(x,y);
      ctx.fillStyle='#241e19';ctx.strokeStyle='#8d8880';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#e8a13a';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#8d8880';ctx.lineWidth=3;
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(a)*5,Math.sin(a)*5);
        ctx.lineTo(Math.cos(a)*15,Math.sin(a)*15);ctx.stroke();
      }
      ctx.fillStyle='#e8a13a';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    update(run, dt, alpha=1) {
      if (!this.ready) this.reset(run);
      this.clock+=dt;
      const old=run.previousPlayer,current=run.player;
      this.visualPlayer={...current};
      if(old&&!run.dead){
        const t=clamp(alpha,0,1);
        for(const key of ['x','y','speed','vx','vy'])this.visualPlayer[key]=old[key]+(current[key]-old[key])*t;
        this.visualPlayer.angle=old.angle+Math.atan2(Math.sin(current.angle-old.angle),Math.cos(current.angle-old.angle))*t;
      }
      const p = this.visualPlayer, altitude = Math.max(0, run.terrain(p.x) - p.y);
      const portrait=this.height>this.width;
      const zoom = clamp(.94 - Math.max(0, p.speed - 300) * .0004 - altitude * .00013, portrait?.68:.72, .94);
      const ease = 1 - Math.exp(-dt * 3.8);
      this.camera.zoom += (zoom - this.camera.zoom) * ease;
      // Keep the hero inside the frame even on the highest balloon routes.
      const lookDown=Math.min(altitude*.48,this.height*.24/this.camera.zoom);
      const targetY = p.y + lookDown - this.height * (portrait?.60:.64) / this.camera.zoom;
      this.camera.y += (targetY - this.camera.y) * (1 - Math.exp(-dt * 5));
      const launchProgress=clamp((1.08-this.intro)/1.08,0,1);
      const focusX=this.intro>0 ? -88+88*(1-Math.pow(1-launchProgress,2)) : p.x;
      this.camera.x = focusX - this.width * (portrait?.24:.22) / this.camera.zoom;
      this.landPose = Math.max(0, this.landPose - dt);
      this.impactPose=Math.max(0,this.impactPose-dt);
      this.jumpPose=Math.max(0,this.jumpPose-dt);
      this.flipPulse=Math.max(0,this.flipPulse-dt);
      if(this.crashPose)this.crashPose.age+=dt;
      for(const item of this.hitObjects)item.life-=dt;
      this.hitObjects=this.hitObjects.filter(item=>item.life>0);
      this.shake = Math.max(0, this.shake - dt);
      const beforeIntro = this.intro;
      this.intro = Math.max(0, this.intro - dt);
      if(beforeIntro > 1.08 && this.intro <= 1.08 && !this.breached)this.breach();
      if (p.grounded && p.speed > 200 && !run.dead) {
        this.dust += dt;
        if (this.dust > .055) {
          this.dust = 0;
          this.burst(p.x - 12, p.y - 2, p.rail ? '#e8a13a' : '#8d8880', p.rail ? 2 : 1, 30);
        }
      }
      for (const q of this.particles) {
        q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.spin === undefined ? 130 : 380) * dt; q.life -= dt; if(q.spin!==undefined)q.angle+=q.spin*dt;
      }
      this.particles = this.particles.filter(q => q.life > 0).slice(-120);
    }
    sprite(image, rect, x, y, width, centered) {
      const h = width * rect[3] / rect[2];
      this.ctx.drawImage(image, ...rect, x - width / 2, centered ? y - h / 2 : y - h, width, h);
    }
    prop(index, x, y, width, centered) {
      this.sprite(this.images.scenery, props[index], x, y, width, centered);
    }
    obstacle(index,x,y,width,height) {
      const rect=obstacles[index];
      this.ctx.drawImage(this.images.obstacles,...rect,x-width/2,y-height,width,height);
    }
    groundMark(width,height,good=false) {
      const ctx=this.ctx,color=good?'#3ddc54':'#e03b3b',half=Math.min(width*.22,12);
      // Small painted face marks, not a glowing outline that overpowers art.
      ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2.4;ctx.lineCap='round';
      const y=-Math.max(5,height*.38);
      ctx.globalAlpha=.82;
      ctx.beginPath();ctx.moveTo(-half,y+2);ctx.lineTo(-half*.45,y-2);
      ctx.lineTo(half*.1,y+2);ctx.lineTo(half*.65,y-2);ctx.lineTo(half,y+1);ctx.stroke();
      if(good){ctx.beginPath();ctx.moveTo(4,y-6);ctx.lineTo(9,y-3);ctx.lineTo(4,y);ctx.stroke();}
      ctx.restore();
    }
    groundPlacement(run,x,width,angle=0,feet=[[-.45,.45]]) {
      const cosine=Math.cos(angle),sine=Math.sin(angle),surface=run.terrain(x);
      let base=surface;
      for(const [a,b]of feet){
        const left=a*width,right=b*width;
        for(let local=left;local<right;local+=2){
          base=Math.max(base,run.terrain(x+local*cosine)-local*sine);
        }
        base=Math.max(base,run.terrain(x+right*cosine)-right*sine);
      }
      // Every visible base/foot is slightly within the sand, including on
      // curved crests and troughs. This is a rendering mount, not new physics.
      return {x,y:base+2,angle,burial:base+2-surface};
    }
    groundShadow(run,x,width) {
      const ctx=this.ctx,left=x-width*.48,right=x+width*.48;
      ctx.beginPath();ctx.moveTo(left,run.terrain(left)+1);
      for(let px=left+4;px<right;px+=4)ctx.lineTo(px,run.terrain(px)+1);
      ctx.lineTo(right,run.terrain(right)+1);
      for(let px=right;px>left;px-=4)ctx.lineTo(px,run.terrain(px)+3.5);
      ctx.closePath();ctx.fillStyle='rgba(10,9,8,.25)';ctx.fill();
    }
    background(run) {
      const ctx = this.ctx, cam = this.camera;
      const W=this.width,H=this.height,portrait=H>W,yScale=H/540;
      ctx.fillStyle = '#171412'; ctx.fillRect(0,0,W,H);
      // One stationary warm light; the actual landscape layers move independently.
      ctx.globalAlpha = portrait?.38:.50;
      if(portrait){
        const skyHeight=H*1.08,skyWidth=skyHeight*2172/500;
        ctx.drawImage(this.images.atmosphere,0,0,2172,500,(W-skyWidth)*.5,-H*.08,skyWidth,skyHeight);
      }else ctx.drawImage(this.images.atmosphere,0,0,2172,500,0,-90,W,H+90);
      ctx.globalAlpha = 1;
      const altitude = Math.max(0, run.terrain(run.player.x) - run.player.y);
      const drawBiome=(biome,opacity)=>{
        if(opacity<=0)return;
        const configs = biome===0 ? [
          { speed: .045, width: 1370, base: 370, height: 330, alpha: .40 },
          { speed: .115, width: 1620, base: 452, height: 355, alpha: .66 },
          { speed: .24, width: 1810, base: 558, height: 385, alpha: .90 }
        ] : [
          { speed: .065, width: 2110, base: 400, height: 275, alpha: .42 },
          { speed: .18, width: 1750, base: 540, height: 320, alpha: .82 }
        ];
        const image=biome===0?this.images.layers:this.images.biomes;
        configs.forEach((layer,index)=>{
          const strip=biome===0?strips[index]:biomeStrips[biome-1];
          const offset=cam.x*layer.speed,first=Math.floor(offset/layer.width);
          const top=(layer.base-layer.height)*yScale+altitude*(.012+index*.012);
          ctx.globalAlpha=layer.alpha*opacity;
          for(let tile=first;tile<=first+Math.ceil(W/layer.width);tile++){
            const x=tile*layer.width-offset,base=layer.height*yScale;
            ctx.save();ctx.translate(x+(Math.abs(tile%2)===1?layer.width:0),top);
            if(Math.abs(tile%2)===1)ctx.scale(-1,1);
            // Mirrored neighbours share the same edge. The solid final row
            // continues below the viewport without exposing atlas gutters.
            ctx.drawImage(image,...strip,0,0,layer.width+.5,base);
            if(top+base<H){
              // Filtering a one-pixel source row samples the transparent
              // gutter next to it and creates a horizontal band at its base.
              ctx.imageSmoothingEnabled=false;
              ctx.drawImage(image,strip[0],strip[1]+strip[3]-1,strip[2],1,0,base,layer.width+.5,H-top-base);
              ctx.imageSmoothingEnabled=true;
            }
            ctx.restore();
          }
        });
      };
      const transition=run.biomeTransition(run.player.x);
      drawBiome(transition.from,1-transition.mix);
      drawBiome(transition.to,transition.mix);
      ctx.globalAlpha = 1;
    }
    terrain(run, left, right, bottom) {
      const ctx = this.ctx;
      const transition=run.biomeTransition(run.player.x);
      const ground=mixColor(palettes[transition.from][0],palettes[transition.to][0],transition.mix);
      const stratum=mixColor(palettes[transition.from][1],palettes[transition.to][1],transition.mix);
      const drawSection = (start, end) => {
        if (end <= start) return;
        ctx.beginPath(); ctx.moveTo(start, bottom);
        ctx.lineTo(start, run.terrain(start));
        for (let x = start + 8; x < end; x += 8) ctx.lineTo(x, run.terrain(x));
        ctx.lineTo(end, run.terrain(end)); ctx.lineTo(end, bottom); ctx.closePath();
        ctx.fillStyle = ground; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.beginPath(); ctx.moveTo(start - 90, bottom);
        for (let x = start - 90; x <= end + 90; x += 20) ctx.lineTo(x, run.terrain(x + 70) + 83);
        ctx.lineTo(end + 90,bottom); ctx.closePath(); ctx.fillStyle = stratum; ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(start, run.terrain(start));
        for (let x = start + 10; x < end; x += 10) ctx.lineTo(x, run.terrain(x));
        ctx.lineTo(end,run.terrain(end));
        ctx.strokeStyle = 'rgba(232,161,58,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
      };
      let start = left;
      for (const gap of run.gaps) {
        if (gap.end < left || gap.x > right) continue;
        drawSection(start, Math.max(start, gap.x));
        start = Math.max(start, gap.end);
      }
      drawSection(start, right);
      for (const r of run.ramps) {
        if (r.end < left || r.x > right) continue;
        // The ramp is already part of the real ground, including its smooth
        // recovery. Highlight only the takeoff rather than drawing a wedge.
        ctx.beginPath();ctx.moveTo(r.end-90,run.terrain(r.end-90));
        for(let x=r.end-84;x<r.end;x+=6)ctx.lineTo(x,run.terrain(x));
        ctx.lineTo(r.end,run.terrain(r.end));ctx.strokeStyle='rgba(61,220,84,.65)';ctx.lineWidth=2;ctx.stroke();
      }
    }
    rails(run, left, right) {
      const ctx = this.ctx;
      for (const rail of run.rails) {
        if (rail.end < left || rail.x > right) continue;
        // Cargo balloons hold the optional upper route, not a flat ground rail.
        ctx.globalAlpha = .8;
        this.prop(4,rail.x,rail.y+28,rail.high?112:82);
        this.prop(4,rail.end,rail.endY+28,rail.high?128:105);
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(rail.x,rail.y);
        for(let x=rail.x+12;x<rail.end;x+=12)ctx.lineTo(x,run.railY(rail,x));
        ctx.lineTo(rail.end,rail.endY);
        ctx.strokeStyle='#88704c';ctx.lineWidth=3;ctx.stroke();
        ctx.strokeStyle='rgba(232,161,58,.42)';ctx.lineWidth=1;ctx.stroke();
      }
    }
    heart(x,y,size) {
      const ctx=this.ctx;
      ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);
      ctx.fillStyle='#3ddc54';ctx.strokeStyle='#f2efe9';ctx.lineWidth=1.1;
      ctx.beginPath();ctx.moveTo(12,21);
      ctx.bezierCurveTo(9,18,2,13,2,7);
      ctx.bezierCurveTo(2,1,9,0,12,5);
      ctx.bezierCurveTo(15,0,22,1,22,7);
      ctx.bezierCurveTo(22,13,15,18,12,21);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
    }
    draw(run) {
      const ctx = this.ctx, p = this.visualPlayer||run.player, cam = this.camera;
      const W=this.width,H=this.height,portrait=H>W;
      this.background(run);
      ctx.save();
      if (this.shake) ctx.translate(Math.sin(this.clock * 81) * this.shake * 5,Math.cos(this.clock * 94) * this.shake * 5);
      ctx.scale(cam.zoom,cam.zoom);ctx.translate(-cam.x,-cam.y);
      const left = cam.x - 120, right = cam.x + W/cam.zoom + 120, bottom = cam.y + H/cam.zoom + 1000;
      if (left < 50 && right > -220) this.vault(run);
      for (const scenery of run.scenery) {
        if (scenery.x < left || scenery.x > right)continue;
        ctx.globalAlpha = .50;
        const biome=run.biome(scenery.x),index=scenery.type==='pylon'?1:7;
        const width=(biome===1?48:biome===2?75:index===1?15:10)*scenery.scale;
        if(run.gaps.some(gap=>gap.x<scenery.x+width*.5&&gap.end>scenery.x-width*.5))continue;
        // Trees and lights remain upright; wide stone arches follow the hill.
        const feet=biome===1?[[-.26,.26]]:biome===2?[[-.49,-.26],[.22,.48]]:[[-.45,.45]];
        const mount=this.groundPlacement(run,scenery.x,width,biome===2?run.slope(scenery.x):0,feet);
        ctx.save();ctx.translate(mount.x,mount.y);ctx.rotate(mount.angle);
        if(biome===1)this.sprite(this.images.obstacles,obstacles[6],0,0,width,false);
        else if(biome===2)this.sprite(this.images.obstacles,obstacles[7],0,0,width,false);
        else this.prop(index,0,0,width);
        ctx.restore();

      }
      ctx.globalAlpha = 1;
      this.rails(run,left,right);
      this.terrain(run,left,right,bottom);
      for (const item of run.items) {
        if (item.hit || item.x < left || item.x > right)continue;
        if(item.type==='coin'){
          const width=portrait?17:12,spin=.82+.18*Math.cos(run.time*3+item.x*.03);
          ctx.drawImage(this.images.coin,item.x-width*spin/2,item.y-width/2,width*spin,width);
        }
        else if(item.type==='heart'){
          const size=portrait?28:23,pulse=1+Math.sin(this.clock*3+item.x)*.07;
          ctx.save();ctx.globalAlpha=.11;ctx.fillStyle='#3ddc54';
          ctx.beginPath();ctx.arc(item.x,item.y,size*.82*pulse,0,Math.PI*2);ctx.fill();ctx.restore();
          this.heart(item.x-size/2,item.y-size/2,size*pulse);
        }
        else if(item.type==='rush'||item.type==='redRush'){
          const red=item.type==='redRush',width=red?(portrait?30:25):(portrait?54:46),pulse=1+Math.sin(this.clock*3+item.x)*.06;
          const spin=Math.max(.12,Math.abs(Math.cos(this.clock*(red?2.4:3.3)+item.x*.002)));
          ctx.save();ctx.translate(item.x,item.y);ctx.globalAlpha=red?.23:.17;
          const halo=ctx.createRadialGradient(0,0,width*.15,0,0,width*.85);
          halo.addColorStop(0,red?'#e03b3b':'#e8a13a');halo.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,width*.85*pulse,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
          const half=this.images.rush.width/2,height=this.images.rush.height;
          ctx.drawImage(this.images.rush,red?half:0,0,half,height,-width*spin/2,-width/2,width*spin,width);
          ctx.strokeStyle=red?'rgba(224,59,59,.55)':'rgba(232,161,58,.45)';ctx.lineWidth=.8;
          ctx.beginPath();ctx.arc(0,0,width*.55*pulse,-.8,.9);ctx.stroke();ctx.restore();
        }
        else if(item.type==='boost') {
          this.groundShadow(run,item.x,52);
          const mount=this.groundPlacement(run,item.x,52,run.slope(item.x));
          ctx.save();ctx.translate(mount.x,mount.y);ctx.rotate(mount.angle);this.prop(5,0,0,52);this.groundMark(52,16,true);ctx.restore();
        } else {
          const art={rock:0,barrier:1,log:2,cart:3,spikes:4,stack:5}[item.type];
          this.groundShadow(run,item.x,item.width||38);
          const mount=this.groundPlacement(run,item.x,item.width||38,run.slope(item.x));
          ctx.save();ctx.translate(mount.x,mount.y);ctx.rotate(mount.angle);
          if(art!==undefined)this.obstacle(art,0,0,item.width||38,item.height||28);
          else this.prop(3,0,0,34);
          this.groundMark(item.width||38,item.height||28);
          {
            // A small red crest remains readable on a phone at speed.
            ctx.fillStyle='#e03b3b';ctx.beginPath();
            const height=item.height||28;
            ctx.moveTo(-3,-height-4);ctx.lineTo(3,-height-4);ctx.lineTo(0,-height-8);ctx.closePath();ctx.fill();
          }
          ctx.restore();
        }
      }
      for(const item of this.hitObjects){
        const t=1-item.life/.42,art={rock:0,barrier:1,log:2,cart:3,spikes:4,stack:5}[item.type];
        ctx.save();ctx.globalAlpha=(1-t)*.8;ctx.translate(item.x+t*18,item.y-t*9);
        ctx.rotate(item.angle+t*.35);
        if(art!==undefined){this.obstacle(art,0,1,item.width||38,item.height||28);this.groundMark(item.width||38,item.height||28);}
        ctx.restore();
      }
      for(const q of this.particles){
        ctx.globalAlpha = clamp(q.life/q.max,0,.6);ctx.fillStyle=q.color;
        ctx.save();ctx.translate(q.x,q.y);if(q.angle!==undefined)ctx.rotate(q.angle);ctx.fillRect(-q.size/2,-q.size/2,q.size,q.size);ctx.restore();
      }
      ctx.globalAlpha=1;
      if(run.dog.active){
        const dx=p.x-run.dog.distance;
        const frame=8+Math.floor(run.time*11)%4;
        ctx.save();ctx.translate(dx,run.terrain(dx)-1);ctx.rotate(run.slope(dx));
        this.sprite(this.images.characters,characters[frame],0,0,portrait?46:38,false);ctx.restore();
      }
      let frame;
      if(p.stagger>0)frame=7;
      else if(this.landPose>0)frame=6;
      else if(!p.grounded)frame=p.held && p.heldTime>.14 ? 2 : p.vy<0 ? 4 : 5;
      else frame=p.rail?3:p.speed>430?(Math.sin(run.time*7)>.82?0:1):(Math.sin(run.time*4)>.90?1:0);
      const launch = clamp((1.08-this.intro)/1.08,0,1);
      const progress = 1-Math.pow(1-launch,2);
      const actorX=this.intro>0 ? -88+88*progress : p.x;
      const actorY=this.intro>0 ? run.terrain(actorX)-Math.sin(launch*Math.PI)*42 : p.y;
      if(this.intro>1.08)frame=1;
      else if(this.intro>.4)frame=4;
      else if(this.intro>0)frame=6;
      const crash=this.crashPose,age=crash?Math.min(.75,crash.age):0;
      const crashTravel=crash?Math.min(24,crash.speed*.06)*Math.sin(age*Math.PI/.75):0;
      if(p.rush>0){
        // Warm shield and short motion trails, leaving the cat's face readable.
        ctx.save();ctx.strokeStyle='rgba(232,161,58,.65)';ctx.lineWidth=1.3;
        ctx.beginPath();ctx.ellipse(actorX,actorY-20,portrait?39:29,portrait?34:26,p.angle,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='rgba(232,161,58,.25)';
        for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(actorX-28-i*9,actorY-12-i*8);ctx.lineTo(actorX-62-i*14,actorY-12-i*8);ctx.stroke();}ctx.restore();
      }
      ctx.save();ctx.translate(actorX+crashTravel,actorY-1+(crash?.reason==='MISSED THE GAP'?age*age*140:-(crash?Math.sin(age*Math.PI/.75)*16:0)));
      ctx.rotate(crash?crash.angle-Math.min(age/.62,1)*Math.PI*.65:this.intro>0?run.slope(actorX)-Math.sin(launch*Math.PI)*.2:p.angle);
      if(crash)frame=7;
      else if(this.impactPose>0){ctx.rotate(Math.sin(this.impactPose*32)*this.impactPose*.22);ctx.scale(1.06,.94);}
      else if(this.jumpPose>0){ctx.scale(.97,1.05);frame=4;}
      if(this.flipPulse>0){
        ctx.save();ctx.globalAlpha=this.flipPulse/.24*.45;ctx.strokeStyle='#e8a13a';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(0,-18,portrait?32:23,-.4,Math.PI*1.1);ctx.stroke();ctx.restore();
      }
      if(p.rush<=0&&p.invulnerable>0 && Math.floor(run.time*12)%2)ctx.globalAlpha=.8;
      this.sprite(this.images.characters,characters[frame],0,0,portrait?60:40,false);
      ctx.restore();ctx.restore();ctx.globalAlpha=1;
      if(this.intro>0 && this.intro<=1.08 && this.intro>.96){
        ctx.fillStyle='rgba(242,239,233,'+((this.intro-.96)/.12*.16)+')';ctx.fillRect(0,0,W,H);
      }
    }
  }
  return { Renderer, loadAssets, assets, characters, props, strips, biomeStrips, obstacles, W, H };
});
