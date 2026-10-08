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
