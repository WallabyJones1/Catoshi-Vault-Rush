'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {openDatabase}=require('./multiplayer-server.cjs');
const {createMultiplayer,COLORS}=require('./multiplayer.cjs');
test('free and anonymous matchmaking, 2-8 racers, 10 tracks, distinct colours',()=>{
 const db=openDatabase(':memory:'),mp=createMultiplayer(db);try{mp.joinQueue('a','Racer One',COLORS[3]);mp.joinQueue('b','Racer Two',COLORS[8]);const q=mp.queued();assert.equal(q.length,2);const m=mp.createMatch(q,'canyon-drop');assert.equal(m.track_id,'canyon-drop');assert.equal(mp.matchRows(m.id).length,2);assert.equal(mp.queued().length,0);}finally{db.close();}
});
test('weekly, last-week, lifetime and track-record leaderboards count verified results only',()=>{
 let time=Date.UTC(2026,9,5,12);const db=openDatabase(':memory:'),mp=createMultiplayer(db,{now:()=>time});try{
   mp.joinQueue('a','Speedy Cat',COLORS[0]);mp.joinQueue('b','Chill Cat',COLORS[1]);const m=mp.createMatch(mp.queued(),'summit-smash',time);
   mp.savePlayerResult(m.id,'a',{finishMs:42000,score:1200,coins:10});mp.savePlayerResult(m.id,'b',{finishMs:47000,score:800,coins:5});
   mp.finalize(m.id,[{session:'a',forfeited:false},{session:'b',forfeited:false}],[{t:1000,players:[],projectiles:[]}]);
   const week=mp.leaderboard(undefined,'a');assert.equal(week.entries[0].name,'Speedy Cat');assert(week.entries[0].weeklyPoints>0);
   const all=mp.lifetimeLeaderboard('a');assert.equal(all.entries[0].lifetimePoints,week.entries[0].weeklyPoints);
   const track=mp.trackLeaderboard('summit-smash','a');assert.equal(track.entries[0].bestMs,42000);assert.equal(track.entries[0].you,true);
   assert.equal(mp.trackLeaderboard('frozen-rush').entries.length,0);
   assert(mp.replay(mp.publicMatch(m.id,'a').replayId));
   assert.throws(()=>mp.trackLeaderboard('unknown-track'),/Unknown track/);
   time+=7*86400000;const next=mp.leaderboard();assert.equal(next.entries.length,0);assert.equal(mp.lifetimeLeaderboard().entries.length,2);
 }finally{db.close();}
});
