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
    coin: 'catoshi-coin.png'
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
      this.intro = .7;
      const x = -108, y = run.terrain(x) - 40;
      for(let i=0;i<32;i++)this.particles.push({
        x:x+Math.random()*20,y:y+Math.random()*50,vx:70+Math.random()*220,vy:-20-Math.random()*170,
        life:.45+Math.random()*.5,max:1,color:i%4===0?'#f26b35':i%2?'#e8a13a':'#8d8880',size:1.5+Math.random()*2.4
      });
      this.shake=.2;
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
      this.camera.x = p.x - this.width * (portrait?.24:.22) / this.camera.zoom;
      this.landPose = Math.max(0, this.landPose - dt);
      this.shake = Math.max(0, this.shake - dt);
      this.intro = Math.max(0, this.intro - dt);
      if (p.grounded && p.speed > 200 && !run.dead) {
        this.dust += dt;
        if (this.dust > .055) {
          this.dust = 0;
          this.burst(p.x - 12, p.y - 2, p.rail ? '#e8a13a' : '#8d8880', p.rail ? 2 : 1, 30);
        }
      }
      for (const q of this.particles) {
        q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 130 * dt; q.life -= dt;
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
    background(run) {
      const ctx = this.ctx, cam = this.camera;
      const W=this.width,H=this.height,portrait=H>W,yScale=H/540;
      ctx.fillStyle = '#171412'; ctx.fillRect(0,0,W,H);
      // One stationary warm light; the actual landscape layers move independently.
      ctx.globalAlpha = portrait?.38:.50;
      if(portrait){
        const skyHeight=H*.66,skyWidth=skyHeight*2172/500;
        ctx.drawImage(this.images.atmosphere,0,0,2172,500,(W-skyWidth)*.5,-H*.08,skyWidth,skyHeight);
      }else ctx.drawImage(this.images.atmosphere, 0, 0, 2172, 500, 0, -90, W, 410);
      ctx.globalAlpha = 1;
      const configs = [
        { speed: .045, width: 1370, base: 370, height: 330, alpha: .40 },
        { speed: .115, width: 1620, base: 452, height: 355, alpha: .66 },
        { speed: .24, width: 1810, base: 558, height: 385, alpha: .90 }
      ];
      const altitude = Math.max(0, run.terrain(run.player.x) - run.player.y);
      configs.forEach((layer, index) => {
        const offset = cam.x * layer.speed;
        const first = Math.floor(offset / layer.width);
        const top = (layer.base - layer.height)*yScale + altitude * (.012 + index * .012);
        ctx.globalAlpha = layer.alpha;
        for (let tile = first; tile <= first + 2; tile++) {
          const x = tile * layer.width - offset;
          ctx.save();
          ctx.translate(x + (Math.abs(tile % 2) === 1 ? layer.width : 0), top);
          if (Math.abs(tile % 2) === 1) ctx.scale(-1, 1);
          ctx.drawImage(this.images.layers, ...strips[index], 0, 0, layer.width + .5, layer.height*yScale);
          const strip=strips[index],base=layer.height*yScale;
          if(top+base<H)ctx.drawImage(this.images.layers,strip[0],strip[1]+strip[3]-1,strip[2],1,0,base-.5,layer.width+.5,H-top-base+1);
          ctx.restore();
        }
      });
      ctx.globalAlpha = 1;
    }
    terrain(run, left, right, bottom) {
      const ctx = this.ctx;
      const drawSection = (start, end) => {
        if (end <= start) return;
        ctx.beginPath(); ctx.moveTo(start, bottom);
        ctx.lineTo(start, run.terrain(start));
        for (let x = start + 12; x < end; x += 12) ctx.lineTo(x, run.terrain(x));
        ctx.lineTo(end, run.terrain(end)); ctx.lineTo(end, bottom); ctx.closePath();
        ctx.fillStyle = '#302820'; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.beginPath(); ctx.moveTo(start - 90, bottom);
        for (let x = start - 90; x <= end + 90; x += 20) ctx.lineTo(x, run.terrain(x + 70) + 83);
        ctx.lineTo(end + 90,bottom); ctx.closePath(); ctx.fillStyle = '#241e19'; ctx.fill();
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
        ctx.beginPath();ctx.moveTo(r.x,run.terrain(r.x));
        for (let x=r.x;x<r.end;x+=6)ctx.lineTo(x,run.rampY(r,x));
        ctx.lineTo(r.end,r.endY);ctx.lineTo(r.end,run.terrain(r.end));ctx.closePath();
        ctx.fillStyle='#393029';ctx.fill();
        ctx.beginPath();ctx.moveTo(r.x,r.y);
        for(let x=r.x+6;x<=r.end;x+=6)ctx.lineTo(x,run.rampY(r,x));
        ctx.lineTo(r.end,r.endY);ctx.strokeStyle='rgba(232,161,58,.6)';ctx.lineWidth=2;ctx.stroke();
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
      if (left < 50 && right > -150) {
        ctx.globalAlpha = .82;
        ctx.save();ctx.translate(-110,run.terrain(-110));
        if(this.intro>0)ctx.rotate(Math.sin((.7-this.intro)*23)*this.intro*.04);
        this.prop(0,0,0,125);ctx.restore();ctx.globalAlpha=1;
      }
      for (const scenery of run.scenery) {
        if (scenery.x < left || scenery.x > right)continue;
        ctx.globalAlpha = .65;
        this.prop(scenery.type === 'pylon' ? 1 : 7, scenery.x,scenery.y+3,(scenery.type==='pylon'?15:10)*scenery.scale);
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
          ctx.save();ctx.translate(item.x,item.y);ctx.rotate(run.slope(item.x));this.prop(item.type==='rock'?2:3,0,1,item.type==='rock'?32:34);ctx.restore();
        }
      }
      for(const q of this.particles){
        ctx.globalAlpha = clamp(q.life/q.max,0,.6);ctx.fillStyle=q.color;
        ctx.fillRect(q.x,q.y,q.size,q.size);
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
      const actorX=p.x-110*Math.pow(this.intro/.7,2);
      const actorY=this.intro>0&&p.grounded?run.terrain(actorX):p.y;
      ctx.save();ctx.translate(actorX,actorY-1);ctx.rotate(p.angle);
      if(p.invulnerable>0 && Math.floor(run.time*12)%2)ctx.globalAlpha=.55;
      this.sprite(this.images.characters,characters[frame],0,0,portrait?60:40,false);
      ctx.restore();ctx.restore();ctx.globalAlpha=1;
    }
  }
  return { Renderer, loadAssets, assets, characters, props, strips, W, H };
});
