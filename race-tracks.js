(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VaultRaceTracks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=t=>t*t*(3-2*t);

  // Dedicated multiplayer downhill courses. Distances are world units; UI shows x/10 metres.
  const defs=[
    ['summit-smash','SUMMIT SMASH',0,36000,.245,[[.13,900,-130],[.29,1200,145],[.52,1450,-180],[.73,1100,150]],[[.20,.014,95,190],[.47,.016,110,215],[.78,.014,90,185]],[[.49,.010],[.82,.012]],[.10,.37,.66,.88]],
    ['pine-needle-pass','PINE NEEDLE PASS',1,38500,.255,[[.16,1100,-160],[.34,900,135],[.56,1500,-155],[.74,1200,175]],[[.18,.013,80,180],[.41,.014,100,205],[.69,.016,105,220]],[[.43,.009],[.71,.010]],[.12,.31,.59,.84]],
    ['canyon-drop','CANYON DROP',2,42000,.275,[[.12,1400,130],[.28,1300,-190],[.48,1700,190],[.68,1550,-160],[.84,1000,110]],[[.23,.016,120,230],[.46,.018,130,250],[.76,.016,105,220]],[[.48,.013],[.79,.014],[.90,.009]],[.09,.35,.62,.86]],
    ['frozen-rush','FROZEN RUSH',3,40000,.265,[[.15,1600,-120],[.31,1400,160],[.55,1200,-145],[.72,1550,140]],[[.20,.015,90,190],[.50,.016,105,215],[.74,.015,95,200]],[[.52,.012],[.77,.011]],[.08,.27,.61,.90]],
    ['temple-tumble','TEMPLE TUMBLE',1,43000,.258,[[.10,1000,110],[.25,1500,-175],[.44,1000,150],[.61,1650,-190],[.82,1300,150]],[[.17,.014,85,185],[.38,.016,110,220],[.59,.016,115,225],[.83,.013,85,185]],[[.40,.010],[.62,.012],[.86,.010]],[.11,.33,.54,.75,.92]],
    ['stormspill-ridge','STORMSPILL RIDGE',3,44500,.285,[[.13,1400,-145],[.32,1100,150],[.50,1550,-170],[.67,1150,140],[.83,1450,-155]],[[.21,.017,120,235],[.48,.016,105,220],[.70,.018,125,240]],[[.50,.010],[.72,.010],[.88,.013]],[.15,.39,.64,.85]],
    ['magma-mile','MAGMA MILE',2,39000,.292,[[.14,1200,145],[.30,1000,-130],[.49,1600,175],[.70,1400,-165]],[[.19,.015,100,210],[.44,.017,120,235],[.68,.016,105,220]],[[.45,.013],[.72,.012]],[.07,.29,.57,.82]],
    ['skybridge-sprint','SKYBRIDGE SPRINT',3,34500,.275,[[.16,900,-105],[.33,900,120],[.50,1000,-125],[.68,900,120],[.84,850,-105]],[[.14,.014,85,185],[.31,.014,90,190],[.48,.014,90,190],[.65,.014,90,190],[.82,.014,90,190]],[[.33,.009],[.50,.009],[.67,.009],[.84,.009]],[.12,.42,.73,.91]],
    ['goldrush-gulch','GOLDRUSH GULCH',2,45500,.268,[[.11,1500,-150],[.27,1200,140],[.46,1700,-180],[.65,1400,165],[.83,1300,-140]],[[.16,.015,95,200],[.40,.017,115,230],[.62,.016,105,220],[.85,.014,90,195]],[[.42,.012],[.65,.011],[.87,.012]],[.09,.24,.52,.76,.93]],
    ['vaultfall-finals','VAULTFALL FINALS',0,47000,.282,[[.10,1600,-150],[.24,1300,150],[.40,1800,-185],[.56,1200,135],[.70,1650,-170],[.84,1200,120]],[[.15,.016,105,215],[.35,.017,120,235],[.54,.015,100,210],[.71,.018,130,245],[.86,.015,100,210]],[[.36,.012],[.57,.010],[.73,.013],[.88,.011]],[.08,.28,.49,.68,.83,.94]]
  ];

  const TRACKS=defs.map((d,index)=>{
    const [id,name,biome,finishX,grade,hills,ramps,gaps,boostFractions]=d;
    const track={id,name,index,biome,finishX,grade,
      hills:hills.map(([f,w,h])=>({x:finishX*f,width:w,height:h})),
      ramps:ramps.map(([f,len,height,launch],i)=>({id:i,x:finishX*f,end:finishX*f+len,recovery:finishX*f+len+260,height,launch})),
      gaps:gaps.map(([f,w],i)=>({id:i,x:finishX*f,end:finishX*f+finishX*w,respawnX:finishX*f+finishX*w+70})),
      boosts:boostFractions.map((f,i)=>({id:i,x:finishX*f,yOffset:i%2===0?48:78})),
      coinClusters:[]
    };
    // Create readable coin arcs throughout the course. Every player has their own coins.
    for(let i=0;i<10;i++){
      const f=.07+i*.086 + ((index*17+i*7)%11)*.0015;
      if(f>.95)break;
      track.coinClusters.push({x:finishX*f,count:5+(i%3),spacing:34,arc:i%2?58:28});
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
    const wave=Math.sin(x/1900*TAU+t.index*.71)*34+Math.sin(x/620*TAU+t.index*1.17)*13;
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
    for(const boost of t.boosts){items.push({id:'b'+boost.id,type:'boost',boostIndex:boost.id,x:boost.x,y:terrainAt(t,boost.x)-boost.yOffset,hit:false,shared:true});}
    return items.sort((a,b)=>a.x-b.x);
  }
  function publicTracks(){return TRACKS.map(t=>({id:t.id,name:t.name,index:t.index,biome:t.biome,finishX:t.finishX,gaps:t.gaps.length,boosts:t.boosts.length}));}
  return {TRACKS,getTrack,terrainAt,slopeAt,gapAt,makeItems,publicTracks,clamp};
});
