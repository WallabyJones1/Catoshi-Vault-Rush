'use strict';
const crypto=require('node:crypto');
const {RaceRun,coinShot,stepCoinShot,COINS_PER_SHOT}=require('./race-engine.js');
const {TRACKS,getTrack}=require('./race-tracks.js');

const TICK_RATE=60,SNAPSHOT_RATE=15,DT=1/TICK_RATE,DISCONNECT_GRACE_MS=20000,REPLAY_HZ=10,MAX_PROJECTILES=64;

function attachRealtime({server,multiplayer,sessionFromRequest,now=Date.now,allowRequest}){
  // Delayed require keeps the normal test suite usable before npm install.
  const {Server}=require('socket.io');
  const io=new Server(server,{
    transports:['polling','websocket'],serveClient:true,maxHttpBufferSize:64*1024,perMessageDeflate:false,
    path:'/socket.io',pingInterval:10000,pingTimeout:12000,
    allowRequest,
    connectionStateRecovery:{maxDisconnectionDuration:120000,skipMiddlewares:false}
  });
  const active=new Map();
  let matchCounter=0,lastMatchmake=0;

  io.use((socket,next)=>{
    try{const record=sessionFromRequest(socket.request);if(!record)return next(new Error('Open multiplayer once to start a player session.'));socket.data.session=record.id;next();}catch(e){next(e);}
  });

  function makePlayer(row){return{session:row.session,seat:row.seat,name:row.name,color:row.color,run:new RaceRun(getTrack(row.track_id||'summit-smash').id),inputs:parseInputs(row.inputs),inputCursor:0,lastSeq:row.last_seq??parseInputs(row.inputs).length-1,lastInputAt:0,inputCount:0,connected:row.session.startsWith('bot:')||Boolean(row.connected),isBot:row.session.startsWith('bot:'),disconnectedAt:null,finishMs:row.finish_ms??null,forfeited:Boolean(row.forfeited)};}
  function parseInputs(text){try{const value=JSON.parse(text||'[]');return Array.isArray(value)?value:[];}catch{return[];}}
  function createLive(dbMatch,rows){const track=getTrack(dbMatch.track_id),m={id:dbMatch.id,track,startAt:dbMatch.start_at,deadline:dbMatch.finish_deadline,tick:0,status:'countdown',mode:dbMatch.race_type||'public',boostMask:0,players:new Map(),projectiles:[],replay:[],lastPersist:0,lastReplayTick:-1,finalized:false};for(const row of rows){row.track_id=track.id;m.players.set(row.session,makePlayer(row));}active.set(m.id,m);return m;}
  function ticket(m,p){return{matchId:m.id,trackId:m.track.id,trackName:m.track.name,mode:m.mode||'public',finishX:m.track.finishX,startAt:m.startAt,serverTime:now(),nextInputSeq:p.lastSeq+1,seat:p.seat,playerCount:m.players.size,coinsPerShot:COINS_PER_SHOT,tickRate:TICK_RATE,snapshotRate:SNAPSHOT_RATE};}
  function playerState(p){const s=p.run.snapshot();return{seat:p.seat,name:p.name,color:p.color,connected:p.connected,bot:p.isBot,inputSeq:p.lastSeq,finishMs:p.finishMs,forfeited:p.forfeited,...s};}
  function snapshot(m){return{matchId:m.id,trackId:m.track.id,trackName:m.track.name,tick:m.tick,status:m.status,serverTime:now(),startAt:m.startAt,finishX:m.track.finishX,boostMask:m.boostMask,players:[...m.players.values()].sort((a,b)=>a.seat-b.seat).map(playerState),projectiles:m.projectiles.map(q=>({id:q.id,seat:q.seat,x:q.x,y:q.y,angle:q.angle,color:q.color}))};}
  function emitSnapshot(m){io.to('match:'+m.id).emit('race:snapshot',snapshot(m));}
  function roomBroadcast(code){for(const p of multiplayer.lobbyMembers(code)){io.to('session:'+p.session).emit('lobby:state',multiplayer.lobbyState(p.session));}}
  function queueBroadcast(){for(const row of multiplayer.queued(100)){const room='session:'+row.session;if(io.sockets.adapter.rooms.get(room)?.size)multiplayer.touchQueue(row.session);const q=multiplayer.queueState(row.session);if(q)io.to(room).emit('queue:state',q);}}
  function chooseTrack(){return TRACKS[(currentWeekIndex()+matchCounter++)%TRACKS.length];}
  function currentWeekIndex(){return Math.floor(now()/(7*86400000));}

  function tryMatchmake(){
    const q=multiplayer.queued(100).filter(row=>io.sockets.adapter.rooms.get('session:'+row.session)?.size);if(q.length<multiplayer.constants.MIN_PLAYERS){queueBroadcast();return;}
    let cursor=0;
    while(q.length-cursor>=multiplayer.constants.MIN_PLAYERS){
      const group=q.slice(cursor,cursor+multiplayer.constants.MAX_PLAYERS),oldest=group[0];
      if(group.length<multiplayer.constants.MAX_PLAYERS&&now()-oldest.joined<multiplayer.constants.QUEUE_WAIT_MS)break;
      const dbMatch=multiplayer.createMatch(group,chooseTrack().id,now()+multiplayer.constants.START_DELAY_MS),rows=multiplayer.matchRows(dbMatch.id),m=createLive(dbMatch,rows);
      for(const p of m.players.values()){io.to('session:'+p.session).socketsJoin('match:'+m.id);io.to('session:'+p.session).emit('race:ticket',ticket(m,p));}
      emitSnapshot(m);cursor+=group.length;
    }
    queueBroadcast();
  }

  function launch(players,mode='public'){if(active.size>=32)throw Error('Racing servers are busy. Please try again shortly.');const dbMatch=multiplayer.createMatch(players,chooseTrack().id,now()+multiplayer.constants.START_DELAY_MS,mode),m=createLive(dbMatch,multiplayer.matchRows(dbMatch.id));for(const p of m.players.values()){if(p.isBot)continue;io.to('session:'+p.session).socketsJoin('match:'+m.id);io.to('session:'+p.session).emit('race:ticket',ticket(m,p));}emitSnapshot(m);return m;}
  function appendInput(p,m,code){p.inputs.push([m.tick,code]);if(p.inputs.length>5000)p.inputs.shift();}
  function applyInput(p,m,code,restoring=false){
    if(p.forfeited||p.finishMs!==null)return;
    if(code===1)p.run.press();else if(code===0)p.run.release();else if(code===3){if(p.run.activateBoost()&&!restoring)io.to('match:'+m.id).emit('race:event',{type:'boost-used',seat:p.seat});}else if(code===2){
      if(m.projectiles.length<MAX_PROJECTILES&&p.run.spendShot()){const r=p.run.player;m.projectiles.push(coinShot(p.run,{id:crypto.randomBytes(4).toString('hex'),owner:p.session,seat:p.seat,color:p.color}));if(!restoring)io.to('match:'+m.id).emit('race:event',{type:'shot',seat:p.seat,x:r.x,y:r.y});}
    }
  }
  function applyRecordedInputs(m){for(const p of m.players.values()){while(p.inputCursor<p.inputs.length&&p.inputs[p.inputCursor][0]<=m.tick){const [tick,code]=p.inputs[p.inputCursor++];if(tick===m.tick)applyInput(p,m,code,true);}}}
  function sharedInteractions(m){
    // Contested boosts: first racer physically touching an available pickup gets it for the whole match.
    const racers=[...m.players.values()].filter(p=>!p.forfeited&&p.finishMs===null).sort((a,b)=>b.run.player.x-a.run.player.x||a.seat-b.seat);
    for(const boost of m.track.boosts){const bit=1<<boost.id;if(m.boostMask&bit)continue;const by=m.track.boosts[boost.id];for(const p of racers){const r=p.run.player,byY=p.run.terrain(by.x)-by.yOffset;if(Math.abs(r.x-by.x)<30&&Math.abs((r.y-18)-byY)<55){if(!p.run.claimBoost())continue;m.boostMask|=bit;for(const x of m.players.values())x.run.syncBoostMask(m.boostMask);io.to('match:'+m.id).emit('race:event',{type:'boost',seat:p.seat,boostId:boost.id});break;}}}
    for(const q of m.projectiles){if(!stepCoinShot(m.track,q,DT))continue;for(const p of racers){if(p.session===q.owner||p.run.player.invulnerable>0)continue;const r=p.run.player;if(Math.abs(r.x-q.x)<32&&Math.abs((r.y-20)-q.y)<46){if(p.run.applyHit()){q.life=0;const owner=m.players.get(q.owner);if(owner)owner.run.hits++;io.to('match:'+m.id).emit('race:event',{type:'hit',from:q.seat,to:p.seat,x:r.x,y:r.y});}break;}}}
    m.projectiles=m.projectiles.filter(q=>q.life>0&&q.x<m.track.finishX+800);
  }
  function recordReplay(m){if(m.tick-m.lastReplayTick<Math.floor(TICK_RATE/REPLAY_HZ))return;m.lastReplayTick=m.tick;const s=snapshot(m);m.replay.push({t:Math.round(m.tick/TICK_RATE*1000),boostMask:m.boostMask,players:s.players.map(p=>({seat:p.seat,name:p.name,color:p.color,x:Math.round(p.x),y:Math.round(p.y),angle:Number(p.angle.toFixed(3)),finished:p.finished})),projectiles:s.projectiles.map(q=>({seat:q.seat,color:q.color,x:Math.round(q.x),y:Math.round(q.y)}))});while(m.replay.length>REPLAY_HZ*5)m.replay.shift();}
  function persist(m){multiplayer.persistRace(m.id,m.tick,m.status,[...m.players.values()]);}
  function finishPlayer(m,p){if(p.finishMs!==null)return;p.finishMs=Math.round(m.tick/TICK_RATE*1000);const s=p.run.snapshot();multiplayer.savePlayerResult(m.id,p.session,{finishMs:p.finishMs,score:s.score,distance:Math.floor(s.x/10),coins:s.coinsCollected,shots:s.shots,hits:s.hits,respawns:s.respawns,forfeited:false});io.to('match:'+m.id).emit('race:event',{type:'finish',seat:p.seat,finishMs:p.finishMs});}
  function forfeitPlayer(m,p,reason='DNF'){if(p.forfeited||p.finishMs!==null)return;p.forfeited=true;p.run.release();const s=p.run.snapshot();multiplayer.savePlayerResult(m.id,p.session,{finishMs:null,score:s.score,distance:Math.floor(s.x/10),coins:s.coinsCollected,shots:s.shots,hits:s.hits,respawns:s.respawns,forfeited:true});io.to('match:'+m.id).emit('race:event',{type:'dnf',seat:p.seat,reason});}
  function maybeFinalize(m){
    if(m.finalized)return true;const t=now();if(t>=m.deadline)for(const p of m.players.values())if(p.finishMs===null&&!p.forfeited)forfeitPlayer(m,p,'TIME LIMIT');
    const done=[...m.players.values()].every(p=>p.finishMs!==null||p.forfeited);if(!done)return false;
    const ordered=[...m.players.values()].sort((a,b)=>{
      if(a.finishMs!==null&&b.finishMs!==null)return a.finishMs-b.finishMs||a.seat-b.seat;
      if(a.finishMs!==null)return-1;if(b.finishMs!==null)return 1;return b.run.player.x-a.run.player.x||a.seat-b.seat;
    });
    for(const p of ordered){const s=p.run.snapshot();multiplayer.savePlayerResult(m.id,p.session,{finishMs:p.finishMs,score:s.score,distance:Math.floor(s.x/10),coins:s.coinsCollected,shots:s.shots,hits:s.hits,respawns:s.respawns,forfeited:p.forfeited});}
    multiplayer.finalize(m.id,ordered.map(p=>({session:p.session,forfeited:p.forfeited})),m.replay);m.finalized=true;m.status='finished';
    for(const p of m.players.values())io.to('session:'+p.session).emit('race:finished',multiplayer.publicMatch(m.id,p.session));
    setTimeout(()=>active.delete(m.id),30000).unref?.();return true;
  }
  function botDrive(m,p){
    const r=p.run.player,x=r.x;
    // Look ahead to gaps and obstacles; different seats give bots varied play styles.
    const upcoming=m.track.gaps.find(g=>g.x>=x&&g.x-x<240);
    if(upcoming&&r.grounded&&!r.held){p.run.press();p.botRelease=m.tick+12+(p.seat%7);}
    if(p.botRelease&&m.tick>=p.botRelease){p.run.release();p.botRelease=0;}
    if(p.run.boostCharges&&!r.boost&&m.tick%120===p.seat%120)p.run.activateBoost();
    // Bot shots are deliberately rare; AI should not make free play frustrating.
    if(p.run.coins>=COINS_PER_SHOT&&m.tick%480===p.seat*13%480&&m.projectiles.length<MAX_PROJECTILES){
      const target=[...m.players.values()].find(other=>!other.isBot&&other.finishMs===null&&other.run.player.x>x&&other.run.player.x-x<1000);
      if(target&&p.run.spendShot())m.projectiles.push(coinShot(p.run,{id:crypto.randomBytes(4).toString('hex'),owner:p.session,seat:p.seat,color:p.color}));
    }
  }
  function stepTick(m){
    const t=now();
    for(const p of m.players.values()){
      if(p.forfeited||p.finishMs!==null)continue;
      if(!p.isBot&&!p.connected&&p.disconnectedAt&&t-p.disconnectedAt>DISCONNECT_GRACE_MS){forfeitPlayer(m,p,'DISCONNECTED');continue;}
      if(p.isBot)botDrive(m,p);p.run.step(DT);p.run.drainEvents();if(p.run.finished)finishPlayer(m,p);
    }
    sharedInteractions(m);recordReplay(m);m.tick++;
    maybeFinalize(m);
  }
  function stepMatch(m){
    const t=now();if(m.finalized)return;
    if(t<m.startAt){m.status='countdown';return;}
    m.status='running';
    const target=Math.floor((t-m.startAt)/1000*TICK_RATE);
    // Timers are not clocks: step exactly 60 times per elapsed second, and catch
    // up after a delayed callback instead of changing race speed with server load.
    for(let count=0;m.tick<target&&count<120&&!m.finalized;count++)stepTick(m);
    if(m.tick-(m.lastSnapshotTick??-1)>=TICK_RATE/SNAPSHOT_RATE){m.lastSnapshotTick=m.tick;emitSnapshot(m);}
    if(t-m.lastPersist>2000&&!m.finalized){m.lastPersist=t;persist(m);}
  }

  function restore(){
    multiplayer.abandonExpired();
    for(const dbMatch of multiplayer.recoverableMatches()){
      const rows=multiplayer.matchRows(dbMatch.id),m=createLive(dbMatch,rows);m.startAt=dbMatch.start_at;m.deadline=dbMatch.finish_deadline;
      // Rebuild deterministically from persisted input events to the last persisted server tick.
      const elapsedTick=now()>m.startAt?Math.floor((now()-m.startAt)/1000*TICK_RATE):0;const target=Math.max(0,Math.min(Math.max(dbMatch.server_tick||0,elapsedTick),multiplayer.constants.RACE_SECONDS*TICK_RATE));
      for(let i=0;i<target;i++){applyRecordedInputs(m);for(const p of m.players.values())if(!p.forfeited&&p.finishMs===null){if(p.isBot)botDrive(m,p);p.run.step(DT);p.run.drainEvents();if(p.run.finished)finishPlayer(m,p);}sharedInteractions(m);m.tick++;}
      m.status=now()>=m.startAt?'running':'countdown';
    }
  }

  const actions=new Map();
  function actionLimit(session,tag){const key=session+':'+tag,t=now(),old=actions.get(key)||{t,n:0};if(t-old.t>60000){old.t=t;old.n=0;}if(++old.n>12)throw Error('Too many matchmaking requests. Wait a minute.');actions.set(key,old);if(actions.size>5000)for(const [k,v] of actions)if(t-v.t>60000)actions.delete(k);}
  io.on('connection',socket=>{
    const session=socket.data.session;socket.join('session:'+session);multiplayer.touchQueue(session);
    socket.emit('lobby:state',multiplayer.lobbyState(session));const activeDb=multiplayer.getActiveMatch(session);
    if(activeDb){let m=active.get(activeDb.id);if(!m)m=createLive(activeDb,multiplayer.matchRows(activeDb.id));const p=m.players.get(session);if(p){p.connected=true;p.disconnectedAt=null;multiplayer.setConnected(m.id,session,true);socket.join('match:'+m.id);socket.emit('race:ticket',ticket(m,p));socket.emit('race:snapshot',snapshot(m));}}
    socket.on('profile:update',(data={},ack)=>{try{const p=multiplayer.touchPlayer(session,data.name,data.color);ack?.({ok:true,...p,profile:multiplayer.profile(session)});}catch(e){ack?.({ok:false,error:e.message});}});
    socket.on('bots:start',(data={},ack)=>{try{actionLimit(session,'bots');const players=multiplayer.botPlayers(session,data.name,data.color,Math.min(7,Math.max(1,Number(data.count)||3)));const m=launch(players,'bots');ack?.({ok:true,matchId:m.id});}catch(e){ack?.({ok:false,error:e.message});}});
    socket.on('lobby:create',(data={},ack)=>{try{actionLimit(session,'lobby');const state=multiplayer.createLobby(session,data.name,data.color);socket.join('lobby:'+state.code);roomBroadcast(state.code);ack?.({ok:true,lobby:state});}catch(e){ack?.({ok:false,error:e.message});}});
    socket.on('lobby:join',(data={},ack)=>{try{actionLimit(session,'lobby');const state=multiplayer.joinLobby(session,data.code,data.name,data.color);socket.join('lobby:'+state.code);roomBroadcast(state.code);ack?.({ok:true,lobby:state});}catch(e){ack?.({ok:false,error:e.message});}});
    socket.on('lobby:leave',(_,ack)=>{const code=multiplayer.leaveLobby(session);ack?.({ok:true});socket.emit('lobby:state',null);if(code)roomBroadcast(code);});
    socket.on('lobby:start',(data={},ack)=>{try{actionLimit(session,'lobby');const {players,hasBots}=multiplayer.startLobby(session,Boolean(data.withBots));const m=launch(players,hasBots?'bots':'friends');for(const p of players){if(!p.session.startsWith('bot:'))io.to('session:'+p.session).emit('lobby:state',null);}ack?.({ok:true,matchId:m.id});}catch(e){ack?.({ok:false,error:e.message});}});
    socket.on('queue:join',(data={},ack)=>{try{const state=multiplayer.joinQueue(session,data.name,data.color);if(state.active){const m=active.get(state.matchId);const p=m?.players.get(session);if(m&&p){socket.join('match:'+m.id);socket.emit('race:ticket',ticket(m,p));}}else tryMatchmake();ack?.({ok:true,queue:multiplayer.queueState(session),profile:multiplayer.profile(session)});}catch(e){ack?.({ok:false,error:e.message});}});
    socket.on('queue:leave',(_,ack)=>{multiplayer.leaveQueue(session);ack?.({ok:true});queueBroadcast();});
    socket.on('race:resume',(data={},ack)=>{const m=active.get(String(data.matchId||'')),p=m?.players.get(session);if(!m||!p)return ack?.({ok:false,error:'Race not found.'});p.connected=true;p.disconnectedAt=null;socket.join('match:'+m.id);multiplayer.setConnected(m.id,session,true);ack?.({ok:true,ticket:ticket(m,p),snapshot:snapshot(m)});});
    socket.on('race:input',(data={},ack)=>{const m=active.get(String(data.matchId||'')),p=m?.players.get(session);if(!m||!p||m.finalized)return ack?.({ok:false,error:'Race not active.'});const t=now();if(t<m.startAt-150)return ack?.({ok:false,error:'Race has not started.'});if(t>m.deadline)return ack?.({ok:false,error:'Race is closed.'});if(t-p.lastInputAt>1000){p.lastInputAt=t;p.inputCount=0;}if(++p.inputCount>45)return ack?.({ok:false,error:'Too many inputs.'});const seq=Number(data.seq);if(!Number.isInteger(seq)||seq<0)return ack?.({ok:false,error:'Bad sequence.'});if(seq<=p.lastSeq)return ack?.({ok:true,duplicate:true,tick:m.tick});p.lastSeq=seq;const code=data.type==='jumpDown'?1:data.type==='jumpUp'?0:data.type==='fire'?2:data.type==='boost'?3:null;if(code===null)return ack?.({ok:false,error:'Bad input.'});appendInput(p,m,code);applyInput(p,m,code,false);p.inputCursor=p.inputs.length;ack?.({ok:true,tick:m.tick});});
    socket.on('race:forfeit',(data={},ack)=>{const m=active.get(String(data.matchId||'')),p=m?.players.get(session);if(!m||!p)return ack?.({ok:false,error:'Race not found.'});forfeitPlayer(m,p,'LEFT RACE');maybeFinalize(m);ack?.({ok:true});});
    socket.on('disconnect',()=>{if(io.sockets.adapter.rooms.get('session:'+session)?.size)return;for(const m of active.values()){const p=m.players.get(session);if(p){p.connected=false;p.disconnectedAt=now();p.run.release();multiplayer.setConnected(m.id,session,false);}}queueBroadcast();});
  });

  restore();
  const timer=setInterval(()=>{const t=now();if(t-lastMatchmake>500){lastMatchmake=t;tryMatchmake();}for(const m of active.values())stepMatch(m);},1000/TICK_RATE);timer.unref?.();
  return{io,active,close:()=>{clearInterval(timer);for(const m of active.values())if(!m.finalized)persist(m);io.close();},snapshot};
}
module.exports={attachRealtime,TICK_RATE,SNAPSHOT_RATE,DISCONNECT_GRACE_MS,REPLAY_HZ};
