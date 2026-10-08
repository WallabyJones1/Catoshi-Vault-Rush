'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {io}=require('socket.io-client');
const {createApp}=require('./multiplayer-server.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const ack=(s,event,data={})=>new Promise((resolve,reject)=>s.timeout(3000).emit(event,data,(e,r)=>e?reject(e):r?.ok?resolve(r):reject(Error(r?.error))));
const connected=s=>new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);s.connect();});
test('polling matchmaking survives a long solo search and reconnect, then runs a synchronized human race', {timeout:20000},async()=>{
  let clock=Date.now();const app=createApp({database:':memory:',now:()=>clock});const clients=[];
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+app.server.address().port;
  async function join(cookie){if(!cookie){const r=await fetch(origin+'/');cookie=r.headers.get('set-cookie').split(';')[0];}const s=io(origin,{transports:['polling'],upgrade:false,reconnection:false,autoConnect:false,extraHeaders:{Cookie:cookie,Origin:origin}});clients.push(s);await connected(s);return{s,cookie};}
  async function advance(ms){clock+=ms;await pause(35);}
  try{
    const a=await join();const initial=await ack(a.s,'queue:join',{name:'Long Search'});assert.ok(initial.queue);
    for(let i=0;i<45;i++)await advance(1000);
    assert.equal(app.multiplayer.queued(10).length,1,'Searching alone must not time out after 30 seconds');
    const joinedAt=app.multiplayer.queued(10)[0].joined;
    a.s.disconnect();await advance(5000);const reconnect=await join(a.cookie);
    const resumed=await ack(reconnect.s,'queue:join',{name:'Long Search'});assert.equal(resumed.queue.joinedAt,joinedAt);
    const b=await join();let ta,tb,last;
    reconnect.s.on('race:ticket',t=>ta=t);b.s.on('race:ticket',t=>tb=t);b.s.on('race:snapshot',s=>last=s);
    await ack(b.s,'queue:join',{name:'Second Human'});await advance(1000);
    assert.ok(ta&&tb);assert.equal(ta.matchId,tb.matchId);
    const match=app.realtime.active.get(ta.matchId);clock=match.startAt;await pause(35);
    await advance(1000);assert.equal(match.tick,60,'Elapsed time must drive exactly 60 simulation steps per second');
    await ack(reconnect.s,'race:input',{matchId:ta.matchId,seq:0,type:'jumpDown'});
    await advance(200);await ack(reconnect.s,'race:input',{matchId:ta.matchId,seq:1,type:'jumpUp'});
    for(let i=0;i<100&&!match.finalized;i++)await advance(1000);
    assert.ok(match.finalized);assert.equal(match.status,'finished');assert.ok(last.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    const session=[...match.players.keys()][0];
    const result=app.multiplayer.publicMatch(match.id,session);assert.ok(result.players.every(p=>p.finishMs!==null&&!p.forfeited),'Both human racers must finish');
    let botTicket;b.s.on('race:ticket',t=>botTicket=t);
    await ack(b.s,'bots:start',{name:'Bot Challenger',count:3});await pause(40);
    const bots=app.realtime.active.get(botTicket.matchId);assert.equal(bots.players.size,4);
    clock=bots.startAt;await pause(35);for(let i=0;i<110&&!bots.finalized;i++)await advance(1000);
    assert.ok(bots.finalized);assert.ok([...bots.players.values()].every(p=>p.finishMs!==null&&!p.forfeited),'The bot race must remain playable to the finish');
  }finally{clients.forEach(s=>s.disconnect());await app.close();}
});
