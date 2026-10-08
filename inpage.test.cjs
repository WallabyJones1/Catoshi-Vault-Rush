'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {openDatabase,createApp}=require('./multiplayer-server.cjs');const {createMultiplayer}=require('./multiplayer.cjs');
test('friend room: create, invite, join, host start, cannot reuse expired code',()=>{
 const db=openDatabase(':memory:'),m=createMultiplayer(db);try{
  const host=m.createLobby('human-a','Catoshi A','#f4c542');assert.match(host.code,/^[A-F0-9]{10}$/);assert.equal(host.host,true);assert.equal(host.playerCount,1);
  assert.throws(()=>m.startLobby('human-a'),/Wait for another/);
  const guest=m.joinLobby('human-b',host.code,'Catoshi B','#ff7043');assert.equal(guest.playerCount,2);assert.equal(guest.host,false);
  assert.equal(m.lobbyState('human-a').playerCount,2);
  const {players,hasBots}=m.startLobby('human-a');assert.equal(players.length,2);assert.equal(hasBots,false);
  assert.equal(m.lobbyState('human-a'),null);assert.throws(()=>m.joinLobby('human-c',host.code,'Cat C','#f4c542'),/expired/);
 }finally{db.close();}
});
test('friend room: host transfer and bot fill, score stays unranked',()=>{
 const db=openDatabase(':memory:'),m=createMultiplayer(db);try{
  const a=m.createLobby('a','Alpha','#f4c542');m.joinLobby('b',a.code,'Beta','#ff7043');m.leaveLobby('a');assert.equal(m.lobbyState('b').host,true);
  const {players,hasBots}=m.startLobby('b',true);assert.equal(players.length,4);assert.equal(hasBots,true);
  const match=m.createMatch(players,'summit-smash',Date.now(),'bots');
  assert.equal(m.publicMatch(match.id,'b').mode,'bots');
  for(const p of players)m.savePlayerResult(match.id,p.session,{finishMs:90000,score:100,coins:1});
  m.finalize(match.id,players.map(p=>({session:p.session,forfeited:false})),[]);
  assert.equal(m.publicMatch(match.id,'b').players.find(p=>p.you).points,0);
  assert.equal(m.leaderboard().entries.length,0);assert.equal(m.lifetimeLeaderboard().entries.length,0);
 }finally{db.close();}
});
test('instant bot race includes exactly one human and no wallet',()=>{
 const db=openDatabase(':memory:'),m=createMultiplayer(db);try{
  const players=m.botPlayers('human','Cat Racer','#f4c542',3);assert.equal(players.length,4);
  assert.equal(players.filter(p=>!p.session.startsWith('bot:')).length,1);
  assert.throws(()=>m.botPlayers('human','Cat Racer','#f4c542',100),/Invalid bot count/);
 }finally{db.close();}
});
test('same-origin multiplayer page can be embedded safely and replay paths use /mp/',async()=>{
 const app=createApp({database:':memory:',realtime:false,publicOrigin:'https://vaultrush.catoshirush.fun'});
 await new Promise(done=>app.server.listen(0,'127.0.0.1',done));try{
  const url='http://127.0.0.1:'+app.server.address().port;
  const response=await fetch(url+'/');const html=await response.text();assert.equal(response.status,200);
  assert.match(html,/<base href="\/mp\/">/);assert.match(html,/RACE BOTS/);assert.match(html,/CREATE FRIEND ROOM/);
  assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN');
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'self'/);
  assert.equal((await fetch(url+'/api/race/entry')).status,404);
 }finally{await app.close();}
});
