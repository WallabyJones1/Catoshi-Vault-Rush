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
    obstacles: 'terrain-obstacles-v1.png'
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
      this.shake = 0;
      this.intro = 0;
      this.ready = false;
    }
    resize(run) {
      this.width = this.ctx.canvas?.width || W;
      this.height = this.ctx.canvas?.height || H;
      if(run)this.reset(run);
    }
    reset(run) {
      this.particles = [];
      this.landPose = 0;
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
      if (event.type === 'land') { this.landPose = .22; this.burst(event.x, event.y, '#8d8880', 8); }
      if (event.type === 'stumble') { this.shake = .25; this.burst(event.x, event.y, '#e03b3b', 6); }
      if (event.type === 'crash') this.shake = .32;
    }
    breakout(run) {
      this.intro = 1.7;
      this.camera.x -= 88;
      this.breached = false;
      this.vaultY = run.terrain(-108) - 42;
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
      const y = run.terrain(-108);
      ctx.save();ctx.translate(-108,y);
      if (charge)ctx.translate(Math.sin(t*70)*t*1.8,0);
      this.prop(0,0,0,155);
      if(this.breached){
        ctx.fillStyle='#0a0908';ctx.beginPath();ctx.ellipse(8,-61,26,39,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#40382e';ctx.lineWidth=3;ctx.stroke();
      }
      // A bright seam charges before the door is blown away.
      if (this.intro > 0) {
        const glow = charge ? t / .62 : Math.max(0,1 - blast * 3);
        ctx.globalAlpha = glow * .7;
        ctx.fillStyle = '#e8a13a';ctx.fillRect(20,-94,3,67);
        ctx.globalAlpha = 1;
      }
      if (!this.breached) {
        this.vaultDoor(14,-53,0);
      } else if (blast < 1.08 && this.intro > 0) {
        ctx.save();ctx.translate(14-blast*190,-53-blast*180+blast*blast*160);
        ctx.rotate(-blast*5);this.vaultDoor(0,0,blast);ctx.restore();
        const radius=blast*240;
        ctx.globalAlpha=Math.max(0,.45-blast*.6);
        ctx.strokeStyle='#e8a13a';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(20,-53,radius,0,Math.PI*2);ctx.stroke();
        // Smoke stays behind the hero and dissipates quickly.
        for(let i=0;i<6;i++){
          ctx.globalAlpha=Math.max(0,.3-blast*.3);
          ctx.fillStyle=i%2?'#8d8880':'#40382e';ctx.beginPath();
          ctx.arc(15+i*7+blast*24,-35-i*8-blast*25,6+blast*(18+i*4),0,Math.PI*2);ctx.fill();
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
    update(run, dt) {
      if (!this.ready) this.reset(run);
      const p = run.player, altitude = Math.max(0, run.terrain(p.x) - p.y);
      const portrait=this.height>this.width;
      const zoom = clamp(.94 - Math.max(0, p.speed - 300) * .0004 - altitude * .00013, portrait?.68:.72, .94);
      const ease = 1 - Math.exp(-dt * 3.8);
      this.camera.zoom += (zoom - this.camera.zoom) * ease;
      const targetY = p.y + altitude * .58 - this.height * (portrait?.60:.64) / this.camera.zoom;
      this.camera.y += (targetY - this.camera.y) * (1 - Math.exp(-dt * 5));
      const launchProgress=clamp((1.08-this.intro)/1.08,0,1);
      const focusX=this.intro>0 ? -88+88*(1-Math.pow(1-launchProgress,2)) : p.x;
      this.camera.x = focusX - this.width * (portrait?.24:.22) / this.camera.zoom;
      this.landPose = Math.max(0, this.landPose - dt);
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
        ctx.lineTo(r.end,run.terrain(r.end));ctx.strokeStyle='rgba(232,161,58,.5)';ctx.lineWidth=2;ctx.stroke();
      }
    }
    rails(run, left, right) {
      const ctx = this.ctx;
      for (const rail of run.rails) {
        if (rail.end < left || rail.x > right) continue;
        // Cargo balloons hold the optional upper route, not a flat ground rail.
        ctx.globalAlpha = .8;
        this.prop(4, rail.x, rail.y + 28, 82);
        this.prop(4, rail.end, rail.endY + 28, 105);
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(rail.x,rail.y);
        for(let x=rail.x+12;x<rail.end;x+=12)ctx.lineTo(x,run.railY(rail,x));
        ctx.lineTo(rail.end,rail.endY);
        ctx.strokeStyle='#88704c';ctx.lineWidth=3;ctx.stroke();
        ctx.strokeStyle='rgba(232,161,58,.42)';ctx.lineWidth=1;ctx.stroke();
      }
    }
    draw(run) {
      const ctx = this.ctx, p = run.player, cam = this.camera;
      const W=this.width,H=this.height,portrait=H>W;
      this.background(run);
      ctx.save();
      if (this.shake) ctx.translate(Math.sin(run.time * 81) * this.shake * 5,Math.cos(run.time * 94) * this.shake * 5);
      ctx.scale(cam.zoom,cam.zoom);ctx.translate(-cam.x,-cam.y);
      const left = cam.x - 120, right = cam.x + W/cam.zoom + 120, bottom = cam.y + H/cam.zoom + 1000;
      if (left < 50 && right > -220) this.vault(run);
      for (const scenery of run.scenery) {
        if (scenery.x < left || scenery.x > right)continue;
        ctx.globalAlpha = .50;
        const biome=run.biome(scenery.x),y=run.terrain(scenery.x)+5;
        if(biome===1)this.sprite(this.images.obstacles,obstacles[6],scenery.x,y,48*scenery.scale,false);
        else if(biome===2)this.sprite(this.images.obstacles,obstacles[7],scenery.x,y,75*scenery.scale,false);
        else this.prop(scenery.type === 'pylon' ? 1 : 7,scenery.x,y,(scenery.type==='pylon'?15:10)*scenery.scale);
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
        else if(item.type==='boost') {
          ctx.save();ctx.translate(item.x,item.y);ctx.rotate(run.slope(item.x));this.prop(5,0,3,52);ctx.restore();
        } else {
          const art={rock:0,barrier:1,log:2,cart:3,spikes:4,stack:5}[item.type];
          ctx.save();ctx.translate(item.x,item.y);
          ctx.rotate(run.slope(item.x));
          if(art!==undefined)this.obstacle(art,0,1,item.width||38,item.height||28);
          else this.prop(3,0,1,34);
          if(item.fatal){
            // A small red crest remains readable on a phone at speed.
            ctx.fillStyle='#e03b3b';ctx.beginPath();
            ctx.moveTo(-4,-item.height-7);ctx.lineTo(4,-item.height-7);ctx.lineTo(0,-item.height-12);ctx.closePath();ctx.fill();
          }
          ctx.restore();
        }
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
      else frame=p.rail?3:p.speed>430?1:0;
      const launch = clamp((1.08-this.intro)/1.08,0,1);
      const progress = 1-Math.pow(1-launch,2);
      const actorX=this.intro>0 ? -88+88*progress : p.x;
      const actorY=this.intro>0 ? run.terrain(actorX)-Math.sin(launch*Math.PI)*42 : p.y;
      if(this.intro>1.08)frame=1;
      else if(this.intro>.4)frame=4;
      else if(this.intro>0)frame=6;
      ctx.save();ctx.translate(actorX,actorY-1);ctx.rotate(this.intro>0?run.slope(actorX)-Math.sin(launch*Math.PI)*.2:p.angle);
      if(p.invulnerable>0 && Math.floor(run.time*12)%2)ctx.globalAlpha=.55;
      this.sprite(this.images.characters,characters[frame],0,0,portrait?60:40,false);
      ctx.restore();ctx.restore();ctx.globalAlpha=1;
      if(this.intro>0 && this.intro<=1.08 && this.intro>.96){
        ctx.fillStyle='rgba(242,239,233,'+((this.intro-.96)/.12*.16)+')';ctx.fillRect(0,0,W,H);
      }
    }
  }
  return { Renderer, loadAssets, assets, characters, props, strips, biomeStrips, obstacles, W, H };
});
