(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VaultRaceTracks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=t=>t*t*(3-2*t);

  // Shared air physics. The engine reads these so balloon chains placed here
  // are always reachable by the same arcs the racers actually fly.
  const PHYSICS=Object.freeze({
    gravity:690,airAccel:8,
    popKicker:130,popMega:300,          // extra lift for a well-timed jump at a ramp lip
    bounceTail:520,bounceStorm:400,     // balloon bounce strength
    kickTail:150,kickStorm:-260,        // horizontal tailwind / headwind from a balloon
    balloonRadius:92,                   // horizontal catch half-width on the balloon crown
    nominalSpeed:1120,boostSpeed:1450,
    mudMax:760
  });

  // V10 "Sky Routes": every track is built from readable sections. Distances
  // are world units (display x/10 metres). Section kinds:
  //  R rollers  · K kicker ramp onto a downhill landing  · C chasm (ramp + gap)
  //  M mud hop (jump the bog or wade through it) · D steep plunge (slipstream heaven)
  //  P boost alley · B tailwind sky route (balloons over a muddy plateau)
  //  S storm split (mixed balloons above a fast plunge — the ground is often better)
  // Pop a mega ramp at the lip to reach the balloons; ride it normally to stay low.
  const defs=[
    {id:'summit-smash',name:'SUMMIT SMASH',biome:0,grade:.252,wave:[36,14],hill:1,ramp:1,gap:1,
     layout:'RKCMBDPKCSDKR',style:'ALPINE ROLLERS · SKY OR STORM'},
    {id:'pine-needle-pass',name:'PINE NEEDLE PASS',biome:1,grade:.255,wave:[43,17],hill:1.1,ramp:.95,gap:.95,
     layout:'KRMCKBPRDKCSDR',style:'QUICK CRESTS · BOG HOPS · BALLOON CANOPY'},
    {id:'canyon-drop',name:'CANYON DROP',biome:2,grade:.282,wave:[49,18],hill:1.2,ramp:1.1,gap:1.15,
     layout:'RCDKCSDPCBRDKC',style:'DEEP DROPS · STORM SPLIT · FIVE CHASMS'},
    {id:'frozen-rush',name:'FROZEN RUSH',biome:3,grade:.263,wave:[23,10],hill:.85,ramp:1,gap:1,
     layout:'KRDPKBDRKCSDPK',style:'FAST FLOW · ICE PLUNGES · DRAFT LINES'},
    {id:'temple-tumble',name:'TEMPLE TUMBLE',biome:1,grade:.266,wave:[37,16],hill:1.05,ramp:1,gap:1.05,
     layout:'RKCMKBRCKMDSPKR',style:'RHYTHM JUMPS · TEMPLE BOGS · SKY GARDEN'},
    {id:'stormspill-ridge',name:'STORMSPILL RIDGE',biome:3,grade:.289,wave:[58,21],hill:1.15,ramp:1.05,gap:1.1,
     layout:'KCSDRKCMPDKBKC',style:'ROUGH RIDGES · STORM THEN SKY'},
    {id:'magma-mile',name:'MAGMA MILE',biome:2,grade:.297,wave:[48,20],hill:1.2,ramp:1.15,gap:1.2,
     layout:'RDKCMBDPKCSDKC',style:'LAVA WAVES · BIG CLEARS · SCORCHED BOGS'},
    {id:'skybridge-sprint',name:'SKYBRIDGE SPRINT',biome:3,grade:.278,wave:[29,11],hill:.8,ramp:.9,gap:.9,
     layout:'KCBKCPRKCBR',style:'TWIN SKY ROUTES · SHORT BRIDGES'},
    {id:'goldrush-gulch',name:'GOLDRUSH GULCH',biome:2,grade:.273,wave:[42,16],hill:1.15,ramp:1.05,gap:1.05,
     layout:'RKMCDBPKMSDKB',style:'LONG HAUL · GOLD BOGS · LATE SKY ROUTE'},
    {id:'vaultfall-finals',name:'VAULTFALL FINALS',biome:0,grade:.290,wave:[49,17],hill:1.2,ramp:1.1,gap:1.15,
     layout:'KCRBDKCSPDKBC',style:'FINAL GAUNTLET · EVERY ROUTE TYPE'}
  ];

  function lookup(t){return typeof t==='string'?getTrack(t):t;}
  function hillContribution(track,x){
    let y=0;
    for(const hill of track.hills){
      const dx=Math.abs(x-hill.x);if(dx>=hill.width)continue;
      const u=1-dx/hill.width;y+=hill.height*smooth(u);
    }
    return y;
  }
  // Constant-gradient section with softened shoulders (15% each end), so a
  // plunge or plateau has an even slope rather than an S-curve.
  const EDGE=.15;
  function softLinear(u){
    if(u<=0)return 0;if(u>=1)return 1;
    const f=u<EDGE?u*u/(2*EDGE):u>1-EDGE?(1-EDGE)-(1-u)*(1-u)/(2*EDGE):EDGE/2+(u-EDGE);
    return f/(1-EDGE);
  }
  function dropContribution(track,x){
    let y=0;
    for(const d of track.drops){if(x<=d.x)continue;y+=x>=d.x+d.len?d.depth:d.depth*softLinear((x-d.x)/d.len);}
    return y;
  }
  function rampLift(r,x){
    if(x<r.x||x>r.recovery)return 0;
    const len=r.end-r.x;
    if(x<=r.end){const t=(x-r.x)/len;return r.height*t*t*(3-2*t);}
    const t=(x-r.end)/(r.recovery-r.end);return r.height*(1-smooth(t));
  }
  function terrainAt(trackOrId,x){
    const t=lookup(trackOrId);
    const wave=Math.sin(x/3400*TAU+t.index*.71)*t.wave[0]+Math.sin(x/1450*TAU+t.index*1.17)*t.wave[1];
    let y=220+x*t.grade+wave+hillContribution(t,x)+dropContribution(t,x);
    for(const r of t.ramps)if(x>=r.x&&x<=r.recovery)y-=rampLift(r,x);
    return y;
  }
  function slopeAt(trackOrId,x){return Math.atan((terrainAt(trackOrId,x+1)-terrainAt(trackOrId,x-1))*.5);}
  function gapAt(trackOrId,x){const t=lookup(trackOrId);for(const g of t.gaps)if(x>g.x&&x<g.end)return g;return null;}
  function mudAt(trackOrId,x){const t=lookup(trackOrId);for(const m of t.mud)if(x>=m.x&&x<=m.end)return m;return null;}

  // Fly the real arc from a popped mega-ramp lip and drop a balloon wherever
  // the descending racer would meet it. Each bounce then places the next one.
  function placeChain(track,ramp,pattern){
    const P=PHYSICS,dt=1/60,balloons=[];
    let x=ramp.end,y=terrainAt(track,x)-1,vx=P.nominalSpeed,vy=-(ramp.launch+ramp.pop);
    for(const kind of pattern){
      let t=0;
      for(;;){
        vy+=P.gravity*dt;vx+=P.airAccel*dt;x+=vx*dt;y+=vy*dt;t+=dt;
        const clear=terrainAt(track,x)-y;
        if(vy>0&&(clear<=310||t>=2.6))break;
        if(vy>0&&clear<160)break;
      }
      balloons.push({x:Math.round(x),y:Math.round(y),kind});
      if(kind==='storm'){vy=-P.bounceStorm;vx=Math.max(450,vx+P.kickStorm);}
      else{vy=-P.bounceTail;vx=Math.min(P.boostSpeed,vx+P.kickTail);}
    }
    // Where an unassisted rider leaves the chain and meets the ground again.
    for(let i=0;i<600;i++){vy+=P.gravity*dt;x+=vx*dt;y+=vy*dt;if(vy>0&&y>=terrainAt(track,x))break;}
    return {balloons,exitX:x};
  }

  // Where the longest possible flight off a ramp (boosted, popped) comes down.
  function flightEnd(track,ramp){
    const P=PHYSICS,dt=1/60;let x=ramp.end,y=terrainAt(track,x)-1,vx=P.boostSpeed,vy=-(ramp.launch+ramp.pop);
    for(let i=0;i<600;i++){vy+=P.gravity*dt;x+=vx*dt;y+=vy*dt;if(vy>0&&y>=terrainAt(track,x))break;}
    return x;
  }
  function buildTrack(d,index){
    const track={id:d.id,name:d.name,index,biome:d.biome,grade:d.grade+.09,style:d.style,
      wave:[d.wave[0]*1.7,d.wave[1]*.5],hills:[],drops:[],ramps:[],gaps:[],mud:[],balloons:[],boosts:[],coinClusters:[],sections:[],finishX:0};
    const H=d.hill,R=d.ramp,G=d.gap;
    let rampId=0,gapId=0;
    const hill=(x,w,h)=>track.hills.push({x,width:w*1.15,height:h*1.7*H});
    const drop=(x,len,depth)=>track.drops.push({x,len,depth});
    const ramp=(x,len,height,launch,kind='kicker')=>{
      const r={id:rampId++,kind,x,end:x+len,recovery:x+len+(kind==='mega'?980:780),height,launch,pop:kind==='mega'?PHYSICS.popMega:PHYSICS.popKicker};
      track.ramps.push(r);return r;
    };
    const gap=(x,w)=>{const g={id:gapId++,x,end:x+w,respawnX:x+w+90};track.gaps.push(g);return g;};
    const boost=(x,yOffset=22)=>track.boosts.push({id:0,x,yOffset});
    const coins=(x,count=3,arc=12,y=null,spacing=36)=>track.coinClusters.push({x,count,spacing,arc,y});
    const v=(i)=>((index*7+i*13)%5)/4; // deterministic per-track variety 0..1

    let s=1500;
    hill(700,700,-60);boost(1050,22);
    d.layout.split('').forEach((kind,i)=>{
      const start=s,variety=v(i);let L=3000;
      if(kind==='R'){
        // Sections open on a dip so a long flight from the previous ramp lands downhill.
        L=3400;hill(s+700,800,150+30*variety);hill(s+1950,850,-140-40*variety);hill(s+2950,550,110);
        coins(s+1250,3,14);boost(s+2500);
      }else if(kind==='K'){
        L=3000;const r=ramp(s+700,330+40*variety,(150+20*variety)*R,(330+50*variety)*R);
        drop(r.end+150,1300,280*H);coins(r.end+520,3,0,terrainAt(track,r.end)-105);boost(s+2600);
      }else if(kind==='C'){
        L=3400;const r=ramp(s+650,345,170*R,(370+40*variety)*R);
        const g=gap(r.end+170,Math.round((400+110*variety)*G));
        drop(g.end-120,1300,260*H);boost(g.end+700);coins(g.end+1350,3,10);
      }else if(kind==='M'){
        // A bog right after a small lip: hop it cleanly or wade through slowly.
        L=2900;hill(s+450,500,120);hill(s+1000,380,-90);const m={x:s+1250,end:s+1250+460+80*variety};track.mud.push(m);
        coins(m.x+90,4,24,null,70);boost(s+2500);
      }else if(kind==='D'){
        L=3900;boost(s+250,30);drop(s+500,2700,(780+220*variety)*H);coins(s+1900,4,8,null,48);hill(s+3500,500,-80);
      }else if(kind==='P'){
        L=2800;hill(s+900,700,-90);hill(s+1900,700,110);boost(s+700);boost(s+1700,44);coins(s+2350,3,10);
      }else if(kind==='B'||kind==='S'){
        // Sky route: a mega ramp launches onto a near-level plateau. Popping
        // the lip reaches a chain of balloons; riding it normally stays low.
        //  B tailwind canopy over a bog  -> the sky is the fast line
        //  S storm front (headwind balloons, sky coins) over boost pads -> ground is faster, sky pays ammo
        const storm=kind==='S',count=4;
        // Long run-up so a flight from the previous section never skips the ramp face.
        const prior=track.ramps.length?Math.max(...track.ramps.map(q=>flightEnd(track,q))):0;
        const rampX=Math.max(s+1700,Math.ceil((prior+900)/50)*50);
        hill(rampX-1200,500,110);boost(rampX-550,30);
        const r=ramp(rampX,420,190*R,320*R,'mega');
        // Gentle downhill under the canopy: grounded racers can still rebuild speed.
        // Size it from the real chain (tailwinds stretch the spacing) so every
        // balloon floats over the plateau, out of reach of a normal hop.
        const pattern=storm?['tail','storm','tail','storm']:Array(count).fill('tail');
        const plateau={x:r.end+150,len:1900+count*1850,depth:0};track.drops.push(plateau);
        let chain;
        for(let pass=0;pass<6;pass++){
          plateau.depth=-track.grade*plateau.len*.62*(1-EDGE);
          chain=placeChain(track,r,pattern);
          const need=chain.balloons.at(-1).x+1100-plateau.x;
          if(need<=plateau.len)break;plateau.len=Math.ceil(need/100)*100;
        }
        const span=plateau.len;
        chain.balloons.forEach((b,bi)=>{
          track.balloons.push({id:track.balloons.length,section:i,...b});
          // Coins just above each crown reward the sky line; storm skies pay more.
          if(bi<chain.balloons.length-1||storm)coins(b.x+60,storm?3:2,0,b.y-58,44);
        });
        const lastX=chain.balloons.at(-1).x;
        if(storm){boost(r.recovery+600,30);boost(r.recovery+600+Math.round((lastX-r.recovery)/2),44);boost(lastX-200,30);}
        else{
          // A rhythm of short bogs: hop each one cleanly and the ground stays close.
          for(let x=r.recovery+300,n=0;x+600<lastX+200;x+=1650,n++){
            const len=Math.round(520+80*((n+index)%3)/2);track.mud.push({x,end:x+len});
            if(n%2===0)coins(x+len*.25,3,40,null,len*.25);
          }
        }
        L=Math.ceil((Math.max(chain.exitX,r.end+150+span)+700-s)/100)*100;
        drop(r.end+150+span,900,320*H);
      }
      track.sections.push({kind,x:start,end:start+L});
      s+=L;
    });
    // Finish on the ground: a run-out past the longest possible final jump.
    const lastFlight=track.ramps.length?Math.max(...track.ramps.map(q=>flightEnd(track,q))):0;
    track.finishX=Math.max(s+900,Math.ceil((lastFlight+700)/100)*100);
    track.ramps.sort((a,b)=>a.x-b.x).forEach((r,i)=>r.id=i);
    track.boosts=track.boosts.filter(b=>!track.gaps.some(g=>b.x>g.x-220&&b.x<g.end+220)&&!track.mud.some(m=>b.x>m.x-60&&b.x<m.end+60))
      .sort((a,b)=>a.x-b.x).map((b,i)=>({...b,id:i}));
    track.coinClusters=track.coinClusters.filter(c=>!track.gaps.some(g=>c.x+c.spacing*c.count>g.x-170&&c.x<g.end+170));
    return track;
  }

  const TRACKS=defs.map(buildTrack);
  const byId=new Map(TRACKS.map(t=>[t.id,t]));
  function getTrack(id){return byId.get(id)||TRACKS[0];}

  function makeItems(trackOrId){
    const t=lookup(trackOrId);
    const items=[];let coinId=0;
    for(const cluster of t.coinClusters){
      for(let i=0;i<cluster.count;i++){
        const x=cluster.x+i*cluster.spacing;
        const arc=cluster.count>1?Math.sin(i/(cluster.count-1)*Math.PI)*cluster.arc:0;
        const y=Number.isFinite(cluster.y)?cluster.y-arc:terrainAt(t,x)-28-arc;
        items.push({id:'c'+coinId++,type:'coin',x,y,hit:false,sky:Number.isFinite(cluster.y)});
      }
    }
    for(const boost of t.boosts){items.push({id:'b'+boost.id,type:'boost',boostIndex:boost.id,x:boost.x,y:terrainAt(t,boost.x)-22,hit:false,shared:false});}
    return items.sort((a,b)=>a.x-b.x);
  }
  function publicTracks(){return TRACKS.map(t=>({id:t.id,name:t.name,index:t.index,biome:t.biome,finishX:t.finishX,gaps:t.gaps.length,ramps:t.ramps.length,balloons:t.balloons.length,mud:t.mud.length,boosts:t.boosts.length,style:t.style,coins:t.coinClusters.reduce((n,c)=>n+c.count,0)}));}
  return {TRACKS,PHYSICS,getTrack,terrainAt,slopeAt,gapAt,mudAt,makeItems,publicTracks,clamp};
});
