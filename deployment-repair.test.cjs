'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const vm=require('node:vm');
const {spawn}=require('node:child_process');
const {io}=require('socket.io-client');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
function event(socket,name,accept=()=>true){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(name,receive);reject(Error('Timed out waiting for '+name));},12000);function receive(data){if(!accept(data))return;clearTimeout(timer);socket.off(name,receive);resolve(data);}socket.on(name,receive);});}
function ack(socket,name,data={}){return new Promise((resolve,reject)=>socket.timeout(6000).emit(name,data,(err,reply)=>{if(err)return reject(err);if(!reply?.ok)return reject(Error(reply?.error||name+' failed'));resolve(reply);}));}

test('Railway entrypoint serves both games, proxies two real race clients and preserves solo availability', {timeout:60000},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'catoshi-repair-'));
  const port=await freePort();let internal=await freePort();while(internal===port)internal=await freePort();
  const origin='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,['server.cjs'],{cwd:__dirname,env:{...process.env,NODE_ENV:'test',PORT:String(port),MP_INTERNAL_PORT:String(internal),MP_ENABLED:'true',DATABASE_PATH:path.join(dir,'solo.sqlite'),MP_DATABASE_PATH:path.join(dir,'multiplayer.sqlite'),PUBLIC_ORIGIN:origin},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const clients=[];
  try{
    let ready=false;
    for(let i=0;i<100;i++){
      if(child.exitCode!==null)throw Error('Main server exited: '+logs);
      try{const r=await fetch(origin+'/mp/health');if(r.ok){ready=true;break;}}catch{}
      await pause(100);
    }
    assert.ok(ready,'Both services must start: '+logs);
    const health=await(await fetch(origin+'/health')).json();assert.equal(health.build,'site-repair-19');assert.equal(health.engine,require('./engine.js').VERSION);
    const html=await(await fetch(origin+'/')).text();
    assert.match(html,/multiplayer-embedded"[^>]*hidden/);
    assert.match(html,/catoshi-classic-home\.css\?v=site-repair-19/);
    const mhtml=await(await fetch(origin+'/mp/')).text();assert.match(mhtml,/<base href="\/mp\/">/);
    for(const [page,base]of [[html,origin+'/'],[mhtml,origin+'/mp/']]){
      const assets=[...page.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)].map(m=>m[1]).filter(v=>!v.includes(':')&&v!=='#'&&/\.(js|css|woff2|gif)$/.test(v));
      for(const asset of assets){const r=await fetch(new URL(asset,base));assert.equal(r.status,200,'Asset must be served: '+asset);}
    }
    async function join(){
      const r=await fetch(origin+'/mp/');const cookie=r.headers.get('set-cookie').split(';')[0];
      const socket=io(origin,{path:'/mp/socket.io',transports:['websocket'],reconnection:false,autoConnect:false,extraHeaders:{Cookie:cookie,Origin:origin}});clients.push(socket);
      const connected=event(socket,'connect');socket.connect();await connected;return {socket,cookie};
    }
    const a=await join(),b=await join();
    // Cross-origin WebSocket clients are refused even with a valid player cookie.
    const bad=io(origin,{path:'/mp/socket.io',transports:['websocket'],reconnection:false,autoConnect:false,extraHeaders:{Cookie:a.cookie,Origin:'https://unrelated.example','X-Catoshi-Origin':'https://unrelated.example'}});clients.push(bad);
    const denied=event(bad,'connect_error');bad.connect();await denied;bad.disconnect();
    // One busy session must never throttle a different player, or static art.
    for(let i=0;i<182;i++)await fetch(origin+'/mp/api/multiplayer/profile',{headers:{Cookie:a.cookie}});
    assert.equal((await fetch(origin+'/mp/api/multiplayer/profile',{headers:{Cookie:b.cookie}})).status,200);
    assert.equal((await fetch(origin+'/mp/multiplayer-lobby.css')).status,200);
    const room=await ack(a.socket,'lobby:create',{name:'Alpha Cat',color:'#f4c542'});
    const joined=await ack(b.socket,'lobby:join',{code:room.lobby.code,name:'Beta Cat',color:'#ff7043'});assert.equal(joined.lobby.playerCount,2);
    const at=event(a.socket,'race:ticket'),bt=event(b.socket,'race:ticket');
    await ack(a.socket,'lobby:start',{withBots:false});
    const [ta,tb]=await Promise.all([at,bt]);assert.equal(ta.matchId,tb.matchId);assert.notEqual(ta.seat,tb.seat);assert.equal(ta.playerCount,2);
    const snapshot=await event(b.socket,'race:snapshot',s=>s.status==='running'&&s.tick>8);
    assert.equal(snapshot.players.length,2);assert.ok(snapshot.players.every(p=>Number.isFinite(p.x)&&p.x>0));
    const input=await ack(a.socket,'race:input',{matchId:ta.matchId,seq:1,type:'jumpDown'});assert.ok(input.tick>0);
    await ack(a.socket,'race:input',{matchId:ta.matchId,seq:2,type:'jumpUp'});
    const finished=event(b.socket,'race:finished');await ack(a.socket,'race:forfeit',{matchId:ta.matchId});await ack(b.socket,'race:forfeit',{matchId:tb.matchId});
    const result=await finished;assert.equal(result.players.length,2);assert.ok(result.players.every(p=>p.forfeited));
    const botTicket=event(b.socket,'race:ticket');await ack(b.socket,'bots:start',{name:'Beta Cat',color:'#ff7043',count:3});const bot=await botTicket;assert.equal(bot.playerCount,4);assert.equal(bot.mode,'bots');
    await ack(b.socket,'race:forfeit',{matchId:bot.matchId});
    // A solo scored run still starts while multiplayer is active, without a wallet.
    const config=await(await fetch(origin+'/api/config')).json();
    const solo=await fetch(origin+'/api/runs/start',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Free Cat',engine:config.engine})});assert.equal(solo.status,200);assert.equal((await solo.json()).wallet,null);
    assert.ok(fs.existsSync(path.join(dir,'solo.sqlite'))&&fs.existsSync(path.join(dir,'multiplayer.sqlite')));
  }finally{
    for(const c of clients)c.disconnect();
    if(child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await Promise.race([stopped,pause(5000)]);if(child.exitCode===null){child.kill('SIGKILL');await stopped;}}
    // Only this test's freshly-created temporary directory is removed.
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('multiplayer panel starts hidden, isolates focus and returns to the selected solo tab',()=>{
  class Element{constructor(){this.listeners={};this.attrs={};this.hidden=false;this.inert=false;this.textContent='';}addEventListener(n,fn){this.listeners[n]=fn;}setAttribute(n,v){this.attrs[n]=v;}getAttribute(n){return this.attrs[n];}focus(){this.focused=true;}click(){this.listeners.click?.();}}
  const ids=['mode-vault','mode-trial','mode-multiplayer','multiplayer-embedded','multiplayer-iframe','multiplayer-close','multiplayer-embed-status','gate'];
  const els=Object.fromEntries(ids.map(id=>[id,new Element()]));els['mode-vault'].setAttribute('aria-pressed','true');els['multiplayer-embedded'].hidden=true;els['multiplayer-iframe'].contentWindow={};
  const listeners={};const window={addEventListener:(n,fn)=>listeners[n]=fn};
  const context={window,document:{getElementById:id=>els[id],readyState:'complete'},location:{origin:'https://game.example',href:'https://game.example/',search:''},history:{replaceState(){}},URL,URLSearchParams};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mp-tab.js'),'utf8'),context);
  assert.equal(els['multiplayer-embedded'].hidden,true);
  els['mode-multiplayer'].click();assert.equal(els['multiplayer-embedded'].hidden,false);assert.equal(els.gate.inert,true);assert.equal(els['mode-vault'].getAttribute('aria-pressed'),'false');
  listeners.message({origin:'https://unrelated.example',source:els['multiplayer-iframe'].contentWindow,data:{type:'catoshi:close-multiplayer'}});assert.equal(els['multiplayer-embedded'].hidden,false);
  listeners.message({origin:'https://game.example',source:els['multiplayer-iframe'].contentWindow,data:{type:'catoshi:multiplayer-ready'}});assert.equal(els['multiplayer-embed-status'].textContent,'');
  els['multiplayer-close'].click();assert.equal(els['multiplayer-embedded'].hidden,true);assert.equal(els.gate.inert,false);assert.equal(els['mode-vault'].getAttribute('aria-pressed'),'true');assert.equal(els['multiplayer-iframe'].src,'about:blank');
  els['mode-vault'].setAttribute('aria-pressed','false');els['mode-trial'].setAttribute('aria-pressed','true');els['mode-multiplayer'].click();listeners.keydown({key:'Escape',preventDefault(){}});assert.equal(els['mode-trial'].getAttribute('aria-pressed'),'true');
});

test('isolated multiplayer renderer draws every track in portrait and landscape with the bundled artwork',()=>{
  const {Renderer,assets}=require('./multiplayer-renderer.js');
  const {RaceRun}=require('./race-engine.js');
  const {TRACKS}=require('./race-tracks.js');
  const images=Object.fromEntries(Object.entries(assets).map(([key,file])=>{
    const bytes=fs.readFileSync(path.join(__dirname,file));
    assert.equal(bytes.subarray(1,4).toString(),'PNG',file+' must be valid bundled artwork');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    return[key,{width,height,naturalWidth:width,naturalHeight:height}];
  }));
  for(const [width,height]of [[960,540],[600,1000]])for(const track of TRACKS){
    const gradient={addColorStop(){}};
    const ctx=new Proxy({canvas:{width,height},measureText:text=>({width:String(text).length*7}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get(target,key){if(key in target)return target[key];return(...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),'Non-finite canvas argument: '+String(key));};}});
    const run=new RaceRun(track.id),renderer=new Renderer(ctx,images);
    renderer.setRaceIdentity({name:'You',color:'#f4c542',seat:0});renderer.reset(run);renderer.breakout(run);
    for(let i=0;i<180;i++){
      if(i===80)run.press();if(i===96)run.release();run.step(1/60);
      for(const e of run.drainEvents())renderer.handle(e);
      renderer.setRaceEntities([{...run.snapshot(),x:run.player.x+65,seat:1,name:'Rival',color:'#ff7043'}]);
      renderer.setProjectiles([{id:'shot',seat:1,x:run.player.x+100,y:run.player.y-30,color:'#ff7043'}]);
      renderer.update(run,1/60);renderer.draw(run);
    }
    assert.ok(Number.isFinite(renderer.camera.x)&&Number.isFinite(renderer.camera.y));
  }
});
