'use strict';
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {HttpError,replay}=require('./security.cjs');
let active=0;
if(!isMainThread){
  try{parentPort.postMessage({result:replay(workerData.seed,workerData.ticks,workerData.inputs)});}
  catch(error){parentPort.postMessage({error:error.message,status:error.status||400});}
}
function checkReplay(seed,ticks,inputs){
  if(active>=2)return Promise.reject(new HttpError(503,'Score checking is busy. Please retry shortly.'));
  active++;
  return new Promise((resolve,reject)=>{
    let finished=false;
    const worker=new Worker(__filename,{workerData:{seed,ticks,inputs},resourceLimits:{maxOldGenerationSizeMb:64}});
    const done=(error,value)=>{if(finished)return;finished=true;active--;clearTimeout(timer);worker.terminate();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>done(new HttpError(503,'Score checking timed out. Please retry.')),8000);
    worker.once('message',message=>done(message.error?new HttpError(message.status,message.error):null,message.result));
    worker.once('error',()=>done(new HttpError(503,'Score checking failed. Please retry.')));
    worker.once('exit',()=>{if(!finished)done(new HttpError(503,'Score checker stopped. Please retry.'));});
  });
}
module.exports={checkReplay};
