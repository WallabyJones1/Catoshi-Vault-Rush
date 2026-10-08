'use strict';
// Keep Catoshi's solo runtime in the parent process. Multiplayer runs in its own
// OS process and is served under /mp on the very same origin (no second domain).
const http=require('node:http');
const net=require('node:net');
const path=require('node:path');
const {fork}=require('node:child_process');
let child=null,closing=false,attempts=0,restartTimer=null;
const port=Number(process.env.MP_INTERNAL_PORT||3001);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid MP_INTERNAL_PORT');
function isMpRoute(url){return url==='/mp'||url.startsWith('/mp/')||url.startsWith('/mp?');}
function strip(url){return url.slice(3)||'/';}
function offline(res,req){
 if(res.headersSent)return res.end();
 if((req.headers.accept||'').includes('text/html')){
   res.writeHead(503,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Multiplayer unavailable</title><body style="background:#110c09;color:#f9eee7;font:16px system-ui;text-align:center;padding:15vh 20px"><h1>Multiplayer is reconnecting</h1><p>The main Vault Run and Speed Trials are still available.</p><button onclick="parent.postMessage({type:'catoshi:close-multiplayer'},location.origin)" style="padding:14px;background:#f2a15a;border:0;border-radius:8px">BACK TO GAME</button></body></html>`);
   return;
 }
 res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
 res.end(JSON.stringify({error:'Multiplayer temporarily unavailable. The main game is still playable.'}));
}
function forward(req,res){
  if(!isMpRoute(req.url))return false;
  if(closing)return offline(res,req),true;
  const headers={...req.headers,host:'127.0.0.1:'+port};
  const upstream=http.request({host:'127.0.0.1',port,path:strip(req.url),method:req.method,headers,timeout:7500},r=>{
    if(res.headersSent)return r.resume();
    res.writeHead(r.statusCode||502,{...r.headers,'x-catoshi-service':'multiplayer'});
    r.pipe(res);
  });
  upstream.on('timeout',()=>upstream.destroy(new Error('Multiplayer request timed out.')));
  upstream.on('error',()=>offline(res,req));
  req.on('aborted',()=>upstream.destroy());
  req.pipe(upstream);
  return true;
}
function proxyUpgrade(req,socket,head){
  if(!isMpRoute(req.url))return socket.destroy();
  socket.setTimeout(12000,()=>socket.destroy());
  const upstream=net.connect({host:'127.0.0.1',port});
  upstream.once('connect',()=>{
    let request=`${req.method} ${strip(req.url)} HTTP/1.1\r\n`;
    for(const [k,v] of Object.entries(req.headers)){
      if(k.toLowerCase()==='host')request+='Host: 127.0.0.1:'+port+'\r\n';
      else if(Array.isArray(v))for(const item of v)request+=k+': '+item+'\r\n';
      else if(v!==undefined)request+=k+': '+v+'\r\n';
    }
    upstream.write(request+'\r\n');
    if(head?.length)upstream.write(head);
    socket.setTimeout(0);
    upstream.pipe(socket);socket.pipe(upstream);
  });
  upstream.once('error',()=>socket.destroy());socket.once('error',()=>upstream.destroy());
  socket.once('close',()=>upstream.destroy());upstream.once('close',()=>socket.destroy());
}
function launch(){
  if(closing||process.env.MP_ENABLED==='false')return;
  try{
    const env={...process.env,PORT:String(port),MP_HOST:'127.0.0.1',MP_DATABASE_PATH:process.env.MP_DATABASE_PATH||path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH||path.dirname(process.env.DATABASE_PATH||'./data/catoshi.sqlite'),'catoshi-multiplayer.sqlite')};
    child=fork(path.join(__dirname,'mp','multiplayer-server.cjs'),[],{env,stdio:['ignore','inherit','inherit','ipc']});
    const running=child;
    child.on('exit',(code,signal)=>{
      if(child===running)child=null;
      if(closing)return;
      attempts++;
      const wait=Math.min(30000,500*Math.pow(2,Math.min(attempts,6)));
      console.error('[multiplayer] service stopped; restart in',wait,'ms',code,signal);
      restartTimer=setTimeout(launch,wait);restartTimer.unref?.();
    });
    child.on('error',e=>console.error('[multiplayer] spawn error:',e.message));
  }catch(e){console.error('[multiplayer] cannot start:',e.message);attempts++;restartTimer=setTimeout(launch,Math.min(30000,attempts*2000));restartTimer.unref?.();}
}
function install(server){
  server.on('upgrade',proxyUpgrade);
  server.on('close',stop);
  launch();
}
function stop(){closing=true;clearTimeout(restartTimer);if(child){child.kill('SIGTERM');child=null;}}
module.exports={install,stop,forward,isMpRoute,strip};
