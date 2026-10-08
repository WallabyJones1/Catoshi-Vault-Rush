(function(){'use strict';
  // The finish replay is drawn by the same renderer as the race itself, so the
  // track, balloons, bogs and racers look exactly as they did live. Frames are
  // stored 10-20 times a second and interpolated here for smooth playback.
  const $=id=>document.getElementById(id),canvas=$('replay-canvas'),ctx=canvas.getContext('2d');
  const id=location.pathname.split('/').filter(Boolean).pop(),wantSeat=Number(new URLSearchParams(location.search).get('seat'))||null;
  const HOLD=1.4; // seconds the final frame stays up before looping
  let data=null,run=null,renderer=null,hero=null,images=null,clock=0,last=0,raf=0;
  const lerp=(a,b,t)=>a+(b-a)*t,turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;

  function resize(){const w=Math.min(960,Math.max(300,innerWidth-24)),h=Math.round(w*9/16);canvas.style.width=w+'px';canvas.style.height=h+'px';}
  addEventListener('resize',resize);resize();

  function span(){const f=data.frames;return Math.max(1,f[f.length-1].t-f[0].t);}
  // Every racer's state at a replay time, interpolated between stored frames.
  function sample(ms){
    const f=data.frames,target=f[0].t+Math.min(ms,span());let i=0;
    while(i<f.length-2&&f[i+1].t<=target)i++;
    const a=f[i],b=f[Math.min(i+1,f.length-1)],t=b.t>a.t?Math.max(0,Math.min(1,(target-a.t)/(b.t-a.t))):0,dt=Math.max(.001,(b.t-a.t)/1000);
    const players=a.players.map(pa=>{
      const pb=b.players.find(p=>p.seat===pa.seat)||pa,x=lerp(pa.x,pb.x,t),y=lerp(pa.y,pb.y,t);
      const vx=(pb.x-pa.x)/dt,vy=(pb.y-pa.y)/dt,finished=Boolean(t<.5?pa.finished:pb.finished);
      const grounded=pa.g!==undefined?Boolean(t<.5?pa.g:pb.g):Math.abs(run.terrain(x)-y)<6;
      return{seat:pa.seat,name:pa.name,color:pa.color,x,y,angle:turn(pa.angle||0,pb.angle||0,t),vx,vy,speed:pb.s??Math.max(0,vx),grounded,boost:(t<.5?pa.b:pb.b)?1:0,finished,finishMs:finished?(pa.finishMs??0):null};
    });
    const projectiles=(t<.5?a:b).projectiles||[];
    return{players,projectiles};
  }
  function chooseHero(){
    const seats=data.frames[0].players.map(p=>p.seat);
    if(wantSeat&&seats.includes(wantSeat))return wantSeat;
    const winner=(data.results||[]).find(r=>r.placement===1&&seats.includes(r.seat));
    if(winner)return winner.seat;
    const end=data.frames[data.frames.length-1].players;return [...end].sort((a,b)=>b.x-a.x)[0]?.seat??seats[0];
  }
  function place(state){
    const me=state.players.find(p=>p.seat===hero)||state.players[0],p=run.player;
    run.previousPlayer={...p};
    Object.assign(p,{x:me.x,y:me.y,angle:me.angle,vx:me.vx,vy:me.vy,speed:me.speed,grounded:me.grounded,boost:me.boost?1:0,held:false,heldTime:0,stagger:0,invulnerable:0,draft:0});
    run.previousPlayer={...p};
    renderer.setRaceIdentity({name:me.name,color:me.color});
    renderer.setRaceEntities(state.players.filter(p=>p.seat!==hero));
    renderer.setProjectiles(state.projectiles);
    return me;
  }
  function overlay(state,me,ms){
    const W=canvas.width,results=data.results||[];
    ctx.save();ctx.fillStyle='rgba(10,9,8,.72)';ctx.fillRect(14,14,300,58);
    ctx.fillStyle='#f4c542';ctx.font='700 20px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(run.track.name,28,42);
    ctx.fillStyle='#f2efe9';ctx.font='600 12px system-ui,sans-serif';ctx.fillText('FINAL 5 SECONDS · FOLLOWING '+String(me.name).toUpperCase().slice(0,16),28,62);
    // Standings: final placements once the racer has crossed, otherwise live order.
    const placeOf=p=>results.find(x=>x.seat===p.seat)?.placement??99;
    const order=[...state.players].sort((a,b)=>a.finished&&b.finished?placeOf(a)-placeOf(b):a.finished!==b.finished?(a.finished?-1:1):b.x-a.x);
    const rows=order.map((p,i)=>{const r=results.find(x=>x.seat===p.seat);return{p,place:p.finished&&r?.placement?r.placement:i+1};});
    const h=18*rows.length+14;ctx.fillStyle='rgba(10,9,8,.72)';ctx.fillRect(W-196,14,182,h);
    rows.forEach(({p,place},i)=>{const y=34+i*18;ctx.fillStyle=p.seat===hero?'#f4c542':'#f2efe9';ctx.font=(p.seat===hero?'700 ':'600 ')+'12px system-ui,sans-serif';
      ctx.fillText(place+'.',W-184,y);ctx.fillStyle=p.color||'#f4c542';ctx.fillRect(W-164,y-9,8,8);ctx.fillStyle=p.seat===hero?'#f4c542':'#f2efe9';ctx.fillText(String(p.name).slice(0,14),W-150,y);if(p.finished){ctx.fillStyle='#3ddc54';ctx.font='700 10px system-ui,sans-serif';ctx.fillText('FIN',W-40,y);}});
    // Progress bar along the bottom.
    ctx.fillStyle='rgba(242,239,233,.18)';ctx.fillRect(14,canvas.height-12,W-28,4);ctx.fillStyle='#f4c542';ctx.fillRect(14,canvas.height-12,(W-28)*Math.min(1,ms/span()),4);
    ctx.restore();
  }
  function frame(now){
    const dt=Math.min(.05,last?(now-last)/1000:1/60);last=now;clock+=dt;
    if(clock>span()/1000+HOLD){clock=0;place(sample(0));renderer.reset(run);}
    const ms=Math.min(clock*1000,span()),state=sample(ms),me=place(state);
    run.time=ms/1000;renderer.update(run,dt,1);renderer.draw(run);overlay(state,me,ms);
    raf=requestAnimationFrame(frame);
  }
  function play(){cancelAnimationFrame(raf);clock=0;last=0;if(!run)return;place(sample(0));renderer.reset(run);raf=requestAnimationFrame(frame);}
  async function share(){const url=location.href,text='Watch this Catoshi Vault Rush finish replay.';try{if(navigator.share)await navigator.share({title:'Catoshi Vault Rush Replay',text,url});else{await navigator.clipboard.writeText(url);$('replay-status').textContent='Replay link copied.';}}catch(e){if(e.name!=='AbortError')$('replay-status').textContent=url;}}

  Promise.all([
    fetch('/mp/api/replay/'+encodeURIComponent(id),{credentials:'same-origin'}).then(r=>r.json().then(v=>{if(!r.ok)throw Error(v.error||'Replay unavailable.');return v;})),
    window.VaultRushRenderer.loadAssets()
  ]).then(([v,art])=>{
    if(!v.frames?.length)throw Error('This replay has no frames.');
    data=v;images=art;run=new window.VaultRace.RaceRun(v.trackId);run.items=[];
    renderer=new window.VaultRushRenderer.Renderer(ctx,images);hero=chooseHero();
    $('replay-title').textContent=run.track.name+' · FINAL 5 SECONDS';
    $('replay-status').textContent='Share this link — the replay is stored with the race result.';play();
  }).catch(e=>$('replay-status').textContent=e.message||'Replay unavailable.');
  $('replay-play').addEventListener('click',play);$('replay-share').addEventListener('click',share);
  window.VaultReplay={sample:ms=>sample(ms),hero:()=>hero};
})();
