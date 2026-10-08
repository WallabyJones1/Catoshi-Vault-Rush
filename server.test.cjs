'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createApp,safeOrigin}=require('./multiplayer-server.cjs');
test('multiplayer runs independently, serves only its own game and never accepts paid API operations',async t=>{
 const app=createApp({database:':memory:',realtime:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base='http://127.0.0.1:'+app.server.address().port;let cookie='';async function get(p){const res=await fetch(base+p,{headers:cookie?{cookie}:{}});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return{res,data:res.headers.get('content-type')?.includes('json')?await res.json():await res.text()};}
 let r=await get('/health');assert(r.res.ok&&r.data.ok);r=await get('/multiplayer');assert(r.res.ok);assert.match(r.data,/id="boost-control"/);assert(!/wallet-racing\.js|race-fees\.cjs|1,000 CATOSHI/.test(r.data));
 r=await get('/api/multiplayer/profile');assert(r.res.ok);assert.equal(r.data.tracks.length,10);assert(cookie.includes('rush_mp_session='));
 for(const mode of ['','?type=lifetime','?type=track&trackId=canyon-drop']){r=await get('/api/multiplayer/leaderboard'+mode);assert(r.res.ok);assert.deepEqual(r.data.entries,[]);}
 r=await get('/api/multiplayer/leaderboard?type=paid');assert.equal(r.res.status,400);
 for(const p of ['/api/race/entry','/api/wallet','/wallet-racing.js','/race-fees.cjs','/index.html','/server.cjs','/game.js']){r=await get(p);assert.equal(r.res.status,404,p);}
 for(const asset of ['/multiplayer.js','/multiplayer-game.js','/race-tracks.js','/race-engine.js','/catoshi-clean-actions.png']){r=await fetch(base+asset);assert.equal(r.status,200,asset);}
});
test('origin validation rejects insecure production domains',()=>{
 assert.equal(safeOrigin({PUBLIC_ORIGIN:'https://race.example.com',NODE_ENV:'production'}),'https://race.example.com');
 assert.throws(()=>safeOrigin({PUBLIC_ORIGIN:'http://race.example.com',NODE_ENV:'production'}),/HTTPS/);
});
