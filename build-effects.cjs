// Regenerate the checked-in, self-hosted effects: node build-effects.cjs.
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'sound.js'),'utf8');
const start=source.indexOf('  function buildSample('),end=source.indexOf('\n  function release(',start);
const context={sampleRate:44100,createBuffer(channels,length){const pcm=new Float32Array(length);return {getChannelData:()=>pcm};}};
const synth=vm.runInNewContext('('+source.slice(start,end).trim()+')',{context,Math});
const durations={silence:.12,burst:.88,coin:.24,jump:.22,flip:.34,metal:.28,wood:.26,stone:.30,crash:.55,land:.13,rush:.55,red:.48};
for(const [kind,duration]of Object.entries(durations)){
 let pcm;
 if(kind==='silence')pcm=new Float32Array(Math.ceil(duration*44100));
 else if(kind==='land')pcm=synth(duration,'wood').getChannelData(0).map(value=>value*.40);
 else if(kind==='rush'||kind==='red'){
  pcm=new Float32Array(Math.ceil(duration*44100));
  for(let i=0;i<pcm.length;i++){
   const t=i/44100;let value=0;
   if(kind==='rush')value=.42*Math.sin(2*Math.PI*(180*t+550*t*t))*Math.exp(-t*4)*Math.min(1,t/.006);
   else for(const [index,hz]of [880,1174,1760].entries()){
    const u=t-index*.075;if(u>=0)value+=.25*Math.sin(2*Math.PI*hz*u)*Math.exp(-u*14)*Math.min(1,u/.004);
   }
   pcm[i]=value*Math.min(1,(duration-t)/.012);
  }
 }else pcm=synth(duration,kind).getChannelData(0);
 const bytes=Buffer.alloc(44+pcm.length*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
 bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(44100,24);bytes.writeUInt32LE(88200,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(pcm.length*2,40);
 for(let i=0;i<pcm.length;i++)bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),44+i*2);
 fs.writeFileSync(path.join(__dirname,'sfx-'+kind+'-v1.wav'),bytes);
}
