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
  assert.match(html,/src="mp-tab\.js\?v=site-repair-19"/);
  assert.match(html,/href="catoshi-classic-home\.css\?v=site-repair-19"/);
  const theme=await fetch(origin+'/catoshi-classic-home.css');assert.equal(theme.status,200);
  const config=await (await fetch(origin+'/api/config')).json();
  assert.equal(config.engine,require('./engine.js').VERSION);assert.equal(config.build,'site-repair-19');
  const ticket=await fetch(origin+'/api/runs/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({engine:config.engine,name:'Guest Cat'})});
  assert.equal(ticket.status,200);assert.equal((await ticket.json()).wallet,null);
  const script=await fetch(origin+'/mp-tab.js');
  assert.equal(script.status,200);
  assert.match(await script.text(),/frame\.src='\/mp\//);
 }finally{
  await new Promise((resolve,reject)=>app.server.close(error=>error?reject(error):resolve()));
  db.close();
 }
});
