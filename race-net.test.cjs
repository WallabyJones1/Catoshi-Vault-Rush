'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {RaceRun,coinShot,stepCoinShot}=require('./race-engine.js');
const {TRACKS,terrainAt,gapAt}=require('./race-tracks.js');
const {Prediction,RemoteBuffer}=require('./race-net.js');
test('prediction restores complete physics and replays an unacknowledged jump without duplicating effects',()=>{
  const server=new RaceRun(TRACKS[0].id),client=new RaceRun(TRACKS[0].id),net=new Prediction(client);
  for(let i=0;i<120;i++){server.step(1/60);net.step();}
  const snapshot={tick:120,players:[{seat:0,inputSeq:-1,...server.snapshot()}],boostMask:0};
  client.press();net.record('jumpDown',0);for(let i=0;i<8;i++)net.step();
  net.reconcile(snapshot,0);assert.equal(client.player.held,true);assert.equal(client.player.grounded,false);
  assert.equal(net.tick,128);assert.equal(client.drainEvents().length,0);
  server.press();for(let i=0;i<8;i++)server.step(1/60);
  assert.ok(Math.abs(server.player.x-client.player.x)<1e-8);assert.ok(Math.abs(server.player.y-client.player.y)<1e-8);
  client.release();net.record('jumpUp',1);net.step();
  net.reconcile({tick:128,players:[{seat:0,inputSeq:0,...server.snapshot()}]},0);
  assert.equal(client.player.held,false);assert.equal(net.pending.length,1);
  assert.equal(net.reconcile(snapshot,0),false,'Old snapshots must not rewind the race');
});
test('all tracks stay deterministic through delayed snapshots, gap resets and pickup reconciliation',()=>{
  for(const track of TRACKS){
    const server=new RaceRun(track.id),client=new RaceRun(track.id),net=new Prediction(client);const delayed=[];
    for(let tick=1;tick<=6600&&!server.finished;tick++){
      server.step(1/60);net.step();
      if(tick%4===0)delayed.push({due:tick+6+(tick%3),snapshot:{tick,boostMask:0,players:[{seat:0,inputSeq:-1,...server.snapshot()}]}});
      while(delayed[0]?.due<=tick)net.reconcile(delayed.shift().snapshot,0);
      net.smooth(1/60);
      assert.ok(Number.isFinite(client.player.y)&&Number.isFinite(net.offset.x));
      assert.ok(Math.abs(server.player.x-client.player.x)<1e-6,track.id+' prediction drift');
    }
    assert.ok(server.finished,track.id);assert.equal(server.coinsCollected,client.coinsCollected);assert.equal(server.respawns,client.respawns);
  }
});
test('remote interpolation smooths movement and takes the shortest rotation across wraparound',()=>{
  const net=new RemoteBuffer();net.push({tick:100,players:[{seat:1,x:100,y:40,angle:3.1}],projectiles:[]},0);
  net.push({tick:108,players:[{seat:1,x:180,y:80,angle:-3.1}],projectiles:[]},133);
  const p=net.sample(166).players[0];assert.ok(p.x>100&&p.x<180);assert.ok(Math.abs(p.angle)>3);
  net.push({tick:99,players:[]},200);assert.equal(net.frames.length,2);
});
test('coin shots spin and bounce just above every sand surface, even when fired in midair',()=>{
  for(const track of TRACKS){const run=new RaceRun(track.id);run.player.y-=500;
    const q=coinShot(run);assert.equal(q.y,terrainAt(track,q.x)-8);let bounced=false;
    for(let i=0;i<120;i++){if(!stepCoinShot(track,q,1/60))break;const clearance=terrainAt(track,q.x)-q.y;assert.ok(clearance>=8&&clearance<=26);assert.ok(!gapAt(track,q.x));bounced ||=clearance>15;}
    assert.ok(bounced);assert.notEqual(q.angle,0);
  }
});
test('eight opponents move continuously through jitter, lost updates and short stalls',()=>{
  const net=new RemoteBuffer(),packets=[];let previous=null,maxStep=0;
  for(let tick=0;tick<900;tick++){
    if(tick%4===0&&!(tick>300&&tick<310)){const delay=[2,8,3,12,4,6][tick/4%6];packets.push({due:tick+delay,snapshot:{tick,players:Array.from({length:8},(_,seat)=>({seat,x:tick*20+seat*12,y:tick*6,angle:0,vx:1200,vy:360,grounded:true,respawns:0})),projectiles:[]}});}
    for(let i=packets.length-1;i>=0;i--)if(packets[i].due<=tick){net.push(packets[i].snapshot,tick/60*1000);packets.splice(i,1);}
    const sample=net.sample(tick/60*1000);if(!sample.players.length)continue;
    const p=sample.players[0];if(previous!==null){assert(p.x>=previous-1e-6,'Arrival jitter must not rewind opponents');maxStep=Math.max(maxStep,p.x-previous);}previous=p.x;
    assert(sample.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  }
  assert(maxStep<30,'No packet-sized position jumps: '+maxStep);
  assert(previous>17000,'Interpolation must not fall increasingly behind');
});
test('reconciliation preserves the previous physics frame and the displayed jump',()=>{
  const server=new RaceRun(TRACKS[0].id),client=new RaceRun(TRACKS[0].id),net=new Prediction(client);
  for(let i=0;i<30;i++){server.step(1/60);net.step();}client.press();net.record('jumpDown',0);for(let i=0;i<6;i++)net.step();
  const visual={x:client.previousPlayer.x,y:client.previousPlayer.y,angle:client.previousPlayer.angle};
  net.reconcile({tick:30,players:[{seat:0,inputSeq:-1,...server.snapshot()}]},0,visual,0);
  assert.equal(client.player.held,true);assert.equal(client.player.grounded,false);assert(client.previousPlayer.x<client.player.x);
  assert(Math.abs(client.previousPlayer.x+net.offset.x-visual.x)<1e-6);
  assert(Math.abs(client.previousPlayer.y+net.offset.y-visual.y)<1e-6);
});
