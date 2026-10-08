'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {Run,TAU,SPEED_LIMITS,VERSION}=require('./engine.js');
const {createApp,configFromEnv,currentRound}=require('./server.cjs');
const {picture}=require('./share-card.cjs');
test('aligned single, double and triple flips bank points and preserve forward speed on high uphill landings',()=>{
 for(const turns of [1,2,3])for(const angle of [-.7,0,.7]){
  const r=new Run(9);Object.assign(r.player,{x:9000,grounded:false,airborne:4,spin:turns*TAU,angle:angle-turns*TAU,vx:650,vy:1800,held:true});
  r.dog={active:true,distance:100,warning:true};r.land(5000,angle);
  const events=r.drainEvents(),trick=events.find(e=>/BACKFLIP/.test(e.text||''));assert(trick);assert.equal(trick.points,500*turns*(1+turns));
  assert.equal(r.score,trick.points);assert(!events.some(e=>e.type==='stumble'));
  assert.equal(r.lives,3);assert(!r.dead);assert(r.player.speed>=650*.9+Math.min(150,50*turns));assert(r.player.speed<=SPEED_LIMITS.landing);
  assert(r.player.boost>0);assert(r.dog.active,'the reward does not disable the hound');
 }
});
test('real held input can land double and triple flips, while a misaligned flip still costs a life',()=>{
 for(const turns of [2,3]){
  const r=new Run(4);r.items=[];r.gaps=[];r.ramps=[];r.rails=[];r.encounters=[];r.nextFeature=r.nextScenery=Infinity;r.terrain=()=>12000;r.slope=r.derivative=()=>0;
  Object.assign(r.player,{x:5000,y:8000,grounded:false,airborne:0,vx:600,vy:-300,angle:0,coyote:0});r.press();
  let released=false,trick;
  for(let i=0;i<1500&&!r.dead&&!r.player.grounded;i++){
   if(!released&&r.player.spin>=turns*TAU){r.release();released=true;}
   r.step(1/120);for(const e of r.drainEvents())if(/BACKFLIP/.test(e.text||''))trick=e;
  }
  assert(released&&r.player.grounded&&!r.dead);assert.equal(trick?.text,turns+'× BACKFLIP');assert(r.player.speed>500);
 }
 const bad=new Run(1);Object.assign(bad.player,{airborne:4,spin:2*TAU,angle:2,vx:650,vy:1500,held:true});bad.land(5000,0);
 assert.equal(bad.lives,2);assert(!bad.drainEvents().some(e=>/BACKFLIP/.test(e.text||'')));assert.equal(bad.score,0);
});
test('public run and trial links include full picture metadata, real PNGs, correct deep links and no private data',async t=>{
 const config={...configFromEnv({PUBLIC_ORIGIN:'https://game.example'}),database:':memory:'};const app=createApp(config);
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
 const base='http://127.0.0.1:'+app.server.address().port,now=Date.now(),ids=[crypto.randomUUID(),crypto.randomUUID()];
 app.db.prepare('INSERT INTO runs(id,session,seed,name,mode,round,started,expires,engine,score,distance,coins,submitted,inputs) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(ids[0],'PRIVATE',1,'<Cat & Friend>','holder',currentRound(now),now,now+600000,VERSION,42000,3500,100,now,'PRIVATE INPUTS');
 app.db.prepare('INSERT INTO trial_runs(id,session,name,level,engine,started,expires,time_ms,submitted,inputs) VALUES(?,?,?,?,?,?,?,?,?,?)').run(ids[1],'PRIVATE','Speed Cat',2,VERSION,now,now+600000,22345,now,'PRIVATE INPUTS');
 for(const [i,prefix]of ['score','trial-score'].entries()){
  const route='/'+prefix+'/'+ids[i],res=await fetch(base+route),html=await res.text();assert.equal(res.status,200);assert(!html.includes('PRIVATE'));
  assert(html.includes('https://game.example'+route+'.png'));assert(html.includes('twitter:image'));assert(html.includes('summary_large_image'));assert(html.includes('og:image:width'));
  if(i===1)assert(html.includes('data-trial="2"'));else assert(html.includes('&lt;Cat &amp; Friend&gt;'));
  const img=await fetch(base+route+'.png'),bytes=Buffer.from(await img.arrayBuffer());assert.equal(img.headers.get('content-type'),'image/png');assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
  const head=await fetch(base+route+'.png',{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
 }
 // A canonical share host must not break same-origin play on Railway's host.
 const start=await fetch(base+'/api/runs/start',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({engine:VERSION,mode:'holder',name:'Guest'})});assert.equal(start.status,200);
 app.db.prepare('UPDATE trial_runs SET disqualified=? WHERE id=?').run('removed',ids[1]);assert.equal((await fetch(base+'/trial-score/'+ids[1]+'.png')).status,404);
 assert.equal((await fetch(base+'/score/'+crypto.randomUUID())).status,404);
 assert.notDeepEqual(picture({name:'Cat',score:1}),picture({name:'Cat',score:100000}));
});
function shareUI(native=true){
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',value:'Cat'});return elements.get(id);};
 const calls=[],downloads=[],src=fs.readFileSync('online.js','utf8');
 const a=src.indexOf('  const SHARE_ORIGIN='),b=src.indexOf('  async function board()',a);
 const context={document:{getElementById:el},location:{origin:'https://old-production.up.railway.app',protocol:'https:'},URL:Object.assign(class extends URL{},{createObjectURL:()=> 'blob:picture',revokeObjectURL(){}}),URLSearchParams,File,Image:class{},fetch:async route=>{downloads.push(route);return {ok:true,blob:async()=>new Blob(['image'],{type:'image/png'})};},navigator:{clipboard:{writeText:async text=>calls.push({copy:text})},...(native?{canShare:()=>true,share:async data=>calls.push(data)}:{})}};
 vm.runInNewContext('const $=id=>document.getElementById(id);'+src.slice(a,b)+';globalThis.renderShare=share;',context);
 const run={mode:'trial',trial:{id:1,name:'DUNE DASH'},finishTime:11.399,score:0,player:{x:8500}},result={run:{timeMs:11399},url:'https://old-production.up.railway.app/trial-score/00000000-0000-0000-0000-000000000001'};
 return {elements,el,calls,downloads,context,run,result};
}
test('X tweet uses one branded verified score URL and a large-image card, not Railway',async()=>{
 const h=shareUI();h.context.renderShare(h.run,h.result);await new Promise(resolve=>setImmediate(resolve));
 const intent=new URL(h.el('share-x').href);
 assert.equal(intent.origin,'https://x.com');
 assert.equal(intent.searchParams.get('url'),'https://vaultrush.catoshirush.fun/trial-score/00000000-0000-0000-0000-000000000001');
 assert.equal(intent.searchParams.get('text'),'I finished DUNE DASH in 11.399s on Catoshi Vault Rush. Can you beat me?');
 assert(!intent.searchParams.get('text').includes('railway'));
 assert.equal((h.el('share-x').href.match(/trial-score/g)||[]).length,1);
 assert.equal(h.el('share-x').onclick,null);
 assert.equal(h.downloads[0],'/trial-score/00000000-0000-0000-0000-000000000001.png?v=3');
 assert(!h.el('save-score-picture').hidden);assert(!h.el('score-picture').hidden);
 assert(!h.el('share-picture').hidden);
 await h.el('share-picture').onclick();assert.equal(h.calls[0].files[0].type,'image/png');
 assert(h.calls[0].text.includes('https://vaultrush.catoshirush.fun/?trial=1'));
 assert(!h.calls[0].text.includes('railway'));
 await h.el('copy-score').onclick();assert(h.calls[1].copy.includes('vaultrush.catoshirush.fun/trial-score/'));
 const fallback=shareUI(false);fallback.context.renderShare(fallback.run,fallback.result);await new Promise(resolve=>setImmediate(resolve));
 assert(fallback.el('share-picture').hidden);assert(!fallback.el('save-score-picture').hidden);
 assert.equal(new URL(fallback.el('share-x').href).searchParams.get('url'),intent.searchParams.get('url'));
});
test('POST TO X is ready even while PNG is downloading',async()=>{
 const h=shareUI();let done;h.context.fetch=()=>new Promise(resolve=>{done=resolve;});h.context.renderShare(h.run,h.result);
 assert.equal(h.el('share-x').onclick,null);
 assert(h.el('share-picture').hidden);
 assert(h.el('share-x').href.includes('vaultrush.catoshirush.fun'));
 done({ok:true,blob:async()=>new Blob(['image'],{type:'image/png'})});
 await new Promise(resolve=>setImmediate(resolve));
 assert(!h.el('share-picture').hidden);
 await h.el('share-picture').onclick();assert.equal(h.calls.length,1);assert.equal(h.calls[0].files.length,1);
});
