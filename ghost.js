(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VaultRushGhost=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function lower(samples,value,column){
    let low=0,high=samples.length-1;
    while(low<high){const mid=(low+high)>>1;if(samples[mid][column]<value)low=mid+1;else high=mid;}
    return low;
  }
  class Track{
    constructor(response,engine,level){
      const record=response?.ghost;
      if(response?.engine!==engine||response?.level!==level||!record)throw Error('No matching ghost.');
      if(typeof record.name!=='string'||record.name.length>20||typeof record.id!=='string'||record.id.length>80||
        !Number.isInteger(record.ticks)||record.ticks<1||record.ticks>72000||!Number.isInteger(record.timeMs)||record.timeMs<=0||
        Math.abs(record.timeMs-record.ticks/120*1000)>9||!Array.isArray(record.samples)||record.samples.length<2||record.samples.length>18002)throw Error('Invalid ghost.');
      let lastTick=-1,lastX=-1;
      for(const s of record.samples){
        if(!Array.isArray(s)||s.length!==5||s.some(v=>!Number.isFinite(v))||s[0]<=lastTick||s[0]>record.ticks||
          s[1]<lastX||s[1]<0||s[1]>1000000||Math.abs(s[2])>1000000||Math.abs(s[3])>10000||!Number.isInteger(s[4])||s[4]<0||s[4]>15)throw Error('Invalid ghost path.');
        lastTick=s[0];lastX=s[1];
      }
      if(record.samples[0][0]!==0||record.samples[0][1]!==0||Math.abs(lastTick/120*1000-record.timeMs)>1)throw Error('Incomplete ghost.');
      this.name=record.name;this.id=record.id;this.timeMs=record.timeMs;this.level=level;
      this.samples=record.samples.map(s=>Object.freeze(s.slice()));Object.freeze(this.samples);
    }
    poseAt(seconds){
      const tick=Math.max(0,seconds*120),i=lower(this.samples,tick,0),b=this.samples[i],a=this.samples[Math.max(0,i-1)];
      const mix=b[0]===a[0]?0:Math.max(0,Math.min(1,(tick-a[0])/(b[0]-a[0])));
      const turn=Math.atan2(Math.sin(b[3]-a[3]),Math.cos(b[3]-a[3])),flags=(mix<.5?a:b)[4];
      return {x:a[1]+(b[1]-a[1])*mix,y:a[2]+(b[2]-a[2])*mix,angle:a[3]+turn*mix,
        grounded:!!(flags&1),flipping:!!(flags&2),rail:!!(flags&4),rising:!!(flags&8),finished:seconds>=this.timeMs/1000};
    }
    timeAtX(x){
      if(x>=this.samples[this.samples.length-1][1])return this.timeMs/1000;
      const i=lower(this.samples,Math.max(0,x),1),b=this.samples[i],a=this.samples[Math.max(0,i-1)];
      const mix=b[1]===a[1]?0:Math.max(0,Math.min(1,(x-a[1])/(b[1]-a[1])));
      return (a[0]+(b[0]-a[0])*mix)/120;
    }
    delta(seconds,x){return seconds-this.timeAtX(x);}
  }
  return {Track};
});
