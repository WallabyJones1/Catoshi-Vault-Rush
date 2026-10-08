(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VaultRaceTracks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=t=>t*t*(3-2*t);

  // V9: ten distinct downhill routes. Distances are world units (display x/10 metres).
  // Hills alternate between crest/valley; ramps sit ahead of gap sequences to reward
  // well-timed jumps without requiring pixel-perfect timing. Missed gaps always respawn.
  // Every racer has their own ground boosts; each racer can carry max 3.
  // Config: id, name, biome, finishX, grade, hills, ramps, gaps, boost locations,
  // coin caches, large/small wave amplitude and track character.
  const defs=[
    {id:'summit-smash',name:'SUMMIT SMASH',biome:0,finishX:36500,grade:.252,
     hills:[[.12,1250,-170],[.25,850,135],[.43,1100,-205],[.65,950,175],[.82,1000,-135]],
     ramps:[[.20,115,90,190],[.455,125,115,215],[.70,110,105,200]],gaps:[[.23,.009],[.49,.010],[.75,.009]],
     boosts:[.085,.27,.38,.57,.69,.88],coins:[.065,.17,.32,.44,.60,.81,.92],wave:[36,14],style:'ALPINE ROLLERS · THREE LEAPS'},
    {id:'pine-needle-pass',name:'PINE NEEDLE PASS',biome:1,finishX:38500,grade:.255,
     hills:[[.10,1000,100],[.20,980,-125],[.33,820,175],[.44,1050,-120],[.60,820,145],[.77,1000,-160]],
     ramps:[[.165,90,82,185],[.39,105,98,195],[.70,105,98,210],[.84,100,90,195]],gaps:[[.195,.009],[.425,.011],[.735,.010]],
     boosts:[.08,.27,.35,.55,.67,.87],coins:[.07,.145,.30,.46,.58,.76,.94],wave:[43,17],style:'QUICK CRESTS · WOODLAND GAPS'},
    {id:'canyon-drop',name:'CANYON DROP',biome:2,finishX:42000,grade:.282,
     hills:[[.13,1450,-180],[.27,960,190],[.40,1280,-180],[.53,1100,200],[.69,1400,-170],[.84,1200,180]],
     ramps:[[.21,135,145,235],[.445,125,130,240],[.68,135,140,245],[.855,125,118,220]],gaps:[[.245,.013],[.475,.013],[.715,.014],[.88,.010]],
     boosts:[.085,.19,.34,.56,.64,.79,.92],coins:[.07,.16,.34,.55,.62,.79,.94],wave:[49,18],style:'DEEP DROPS · FOUR RECOVERABLE CHASMS'},
    {id:'frozen-rush',name:'FROZEN RUSH',biome:3,finishX:39900,grade:.263,
     hills:[[.14,1300,-100],[.31,1050,150],[.49,940,-120],[.64,980,128],[.81,1300,-145]],
     ramps:[[.19,140,93,195],[.43,120,100,210],[.67,130,105,210],[.87,115,94,195]],gaps:[[.215,.010],[.455,.011],[.70,.012]],
     boosts:[.075,.28,.40,.54,.65,.78,.91],coins:[.06,.14,.29,.39,.56,.80,.93],wave:[23,10],style:'FAST FLOW · ICE-SLICK CRESTS'},
    {id:'temple-tumble',name:'TEMPLE TUMBLE',biome:1,finishX:43000,grade:.266,
     hills:[[.13,1080,155],[.24,1200,-150],[.38,950,160],[.51,1250,-195],[.65,1080,120],[.80,1100,-135]],
     ramps:[[.155,95,84,180],[.365,120,120,215],[.575,110,130,235],[.79,110,90,210]],gaps:[[.185,.009],[.395,.012],[.602,.011],[.82,.010]],
     boosts:[.07,.275,.34,.48,.69,.77,.91],coins:[.075,.245,.32,.47,.65,.76,.93],wave:[37,16],style:'RHYTHM JUMPS · FOUR TEMPLE GAPS'},
    {id:'stormspill-ridge',name:'STORMSPILL RIDGE',biome:3,finishX:44500,grade:.289,
     hills:[[.10,1270,-160],[.24,920,145],[.36,1150,-180],[.51,1050,170],[.63,1280,-190],[.82,1420,160]],
     ramps:[[.225,128,115,225],[.46,120,125,225],[.69,140,138,235],[.855,112,105,205]],gaps:[[.255,.014],[.49,.012],[.72,.013]],
     boosts:[.075,.18,.33,.54,.64,.80,.92],coins:[.07,.145,.32,.405,.59,.805,.94],wave:[58,21],style:'ROUGH RIDGES · WINDY CHAIN JUMPS'},
    {id:'magma-mile',name:'MAGMA MILE',biome:2,finishX:39000,grade:.297,
     hills:[[.12,990,175],[.26,1000,-205],[.40,1300,205],[.57,1450,-175],[.73,1150,180],[.87,970,-145]],
     ramps:[[.175,120,115,210],[.405,140,140,250],[.66,145,130,240]],gaps:[[.205,.010],[.445,.014],[.695,.015]],
     boosts:[.095,.29,.395,.55,.645,.80,.92],coins:[.065,.155,.29,.37,.58,.795,.93],wave:[48,20],style:'LAVA WAVES · THREE BIG CLEARS'},
    {id:'skybridge-sprint',name:'SKYBRIDGE SPRINT',biome:3,finishX:34600,grade:.278,
     hills:[[.11,850,-95],[.24,760,110],[.36,820,-95],[.50,850,130],[.63,850,-125],[.76,790,100]],
     ramps:[[.155,95,95,195],[.335,85,93,180],[.51,88,92,185],[.695,100,100,210],[.86,95,90,195]],
     gaps:[[.18,.010],[.365,.010],[.54,.011],[.725,.011],[.89,.009]],
     boosts:[.075,.255,.325,.48,.665,.825,.94],coins:[.065,.25,.32,.45,.65,.80,.945],wave:[29,11],style:'FIVE SHORT BRIDGES · FAST TIMING'},
    {id:'goldrush-gulch',name:'GOLDRUSH GULCH',biome:2,finishX:45500,grade:.273,
     hills:[[.11,1400,-180],[.25,1120,165],[.39,1370,-195],[.55,1290,190],[.69,1480,-155],[.85,1120,145]],
     ramps:[[.17,110,95,210],[.37,125,110,225],[.57,128,122,220],[.76,120,104,205]],gaps:[[.20,.011],[.405,.013],[.605,.011],[.79,.010]],
     boosts:[.075,.29,.35,.51,.67,.74,.92],coins:[.065,.15,.285,.34,.525,.70,.915],wave:[42,16],style:'LONG HAUL · FOUR CHALLENGES'},
    {id:'vaultfall-finals',name:'VAULTFALL FINALS',biome:0,finishX:47000,grade:.290,
     hills:[[.10,1430,-195],[.23,1250,170],[.38,1450,-210],[.51,1180,180],[.66,1450,-190],[.82,1070,165]],
     ramps:[[.13,105,105,215],[.31,128,125,235],[.485,120,130,240],[.665,125,128,230],[.835,130,120,220]],
     gaps:[[.157,.011],[.34,.012],[.515,.014],[.695,.013],[.865,.012]],
     boosts:[.065,.20,.29,.435,.625,.805,.94],coins:[.075,.21,.285,.445,.605,.78,.93],wave:[49,17],style:'FINAL GAUNTLET · FIVE VAULT GAPS'}
  ];

  const TRACKS=defs.map((d,index)=>{
    const {id,name,biome,finishX,grade,hills,ramps,gaps,boosts,coins,wave,style}=d;
    const track={id,name,index,biome,finishX,grade:grade+.09,style,wave:[wave[0]*1.7,wave[1]*.5],
      hills:hills.map(([f,w,h])=>({x:finishX*f,width:w*1.15,height:h*1.7})),
      ramps:ramps.map(([f,len,height,launch],i)=>({id:i,x:finishX*f,end:finishX*f+len*3,recovery:finishX*f+len*3+780,height:height*1.35,launch:launch*1.7})),
      gaps:gaps.map(([f,w],i)=>({id:i,x:finishX*f,end:finishX*(f+w),respawnX:finishX*(f+w)+90})),
      boosts:boosts.map((f,i)=>({id:i,x:finishX*f,yOffset:[44,54,66,44,56,70,46][i]})),
      coinClusters:[]
    };
    // Scarce but collectible: 7 small caches, 3 or 4 coins each (24 total).
    // Ground-friendly low arcs let players earn a few carefully timed shots.
    for(let i=0;i<coins.length;i++)track.coinClusters.push({x:finishX*coins[i],count:i%3===1?4:3,spacing:36,arc:12+(i%2)*9});
    // Frequent early launch lips between the main gap sequences; every one
    // flows back into a broad downhill landing rather than a freestanding ramp.
    for(const [i,f] of [.035,.095,.285,.54,.91].entries()){
      const x=finishX*f;
      if(track.ramps.some(r=>Math.abs(r.x-x)<1100)||track.gaps.some(g=>x>g.x-650&&x<g.end+650))continue;
      track.ramps.push({id:track.ramps.length,x,end:x+360,recovery:x+1260,height:115+(index%3)*20,launch:280+(i%3)*45});
    }
    track.ramps.sort((a,b)=>a.x-b.x);
    // Each racer owns their pickups: first place cannot remove anyone else's
    // catch-up route. Add regular ground pads with space around the chasms.
    for(let x=850;x<finishX-650;x+=1500+(index%3)*110){
      if(track.gaps.some(g=>x>g.x-220&&x<g.end+220)||track.boosts.some(b=>Math.abs(b.x-x)<350))continue;
      track.boosts.push({id:track.boosts.length,x,yOffset:22});
    }
    return track;
  });
  const byId=new Map(TRACKS.map(t=>[t.id,t]));

  function getTrack(id){return byId.get(id)||TRACKS[0];}
  function hillContribution(track,x){
    let y=0;
    for(const hill of track.hills){
      const dx=Math.abs(x-hill.x);if(dx>=hill.width)continue;
      const u=1-dx/hill.width;y+=hill.height*smooth(u);
    }
    return y;
  }
  function rampLift(r,x){
    if(x<r.x||x>r.recovery)return 0;
    const len=r.end-r.x;
    if(x<=r.end){const t=(x-r.x)/len;return r.height*t*t*(3-2*t);}
    const t=(x-r.end)/(r.recovery-r.end);return r.height*(1-smooth(t));
  }
  function terrainAt(trackOrId,x){
    const t=typeof trackOrId==='string'?getTrack(trackOrId):trackOrId;
    const wave=Math.sin(x/3400*TAU+t.index*.71)*t.wave[0]+Math.sin(x/1450*TAU+t.index*1.17)*t.wave[1];
    let y=220+x*t.grade+wave+hillContribution(t,x);
    for(const r of t.ramps)y-=rampLift(r,x);
    return y;
  }
  function slopeAt(trackOrId,x){return Math.atan((terrainAt(trackOrId,x+1)-terrainAt(trackOrId,x-1))*.5);}
  function gapAt(trackOrId,x){const t=typeof trackOrId==='string'?getTrack(trackOrId):trackOrId;return t.gaps.find(g=>x>g.x&&x<g.end)||null;}
  function makeItems(trackOrId){
    const t=typeof trackOrId==='string'?getTrack(trackOrId):trackOrId;
    const items=[];let coinId=0;
    for(const cluster of t.coinClusters){
      for(let i=0;i<cluster.count;i++){
        const x=cluster.x+i*cluster.spacing;
        const arc=cluster.count>1?Math.sin(i/(cluster.count-1)*Math.PI)*cluster.arc:0;
        items.push({id:'c'+coinId++,type:'coin',x,y:terrainAt(t,x)-28-arc,hit:false});
      }
    }
    for(const boost of t.boosts){items.push({id:'b'+boost.id,type:'boost',boostIndex:boost.id,x:boost.x,y:terrainAt(t,boost.x)-22,hit:false,shared:false});}
    return items.sort((a,b)=>a.x-b.x);
  }
  function publicTracks(){return TRACKS.map(t=>({id:t.id,name:t.name,index:t.index,biome:t.biome,finishX:t.finishX,gaps:t.gaps.length,boosts:t.boosts.length,style:t.style,coins:t.coinClusters.reduce((n,c)=>n+c.count,0)}));}
  return {TRACKS,getTrack,terrainAt,slopeAt,gapAt,makeItems,publicTracks,clamp};
});
