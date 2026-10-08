'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configFromEnv,createApp,openDatabase}=require('./server.cjs');

test('main site exposes the multiplayer mode and its same-origin client script',async()=>{
 const db=openDatabase(':memory:'),app=createApp(configFromEnv({DATABASE_PATH:':memory:'}),{db});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+app.server.address().port;
  const home=await fetch(origin+'/');const html=await home.text();
  assert.equal(home.status,200);
  assert.match(html,/id="mode-multiplayer"/);
  assert.match(html,/id="multiplayer-embedded"/);
  assert.match(html,/src="mp-tab\.js\?v=1"/);
  const script=await fetch(origin+'/mp-tab.js');
  assert.equal(script.status,200);
  assert.match(await script.text(),/frame\.src='\/mp\//);
 }finally{
  await new Promise((resolve,reject)=>app.server.close(error=>error?reject(error):resolve()));
  db.close();
 }
});
