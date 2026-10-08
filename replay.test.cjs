'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Race=require('./race-engine.js'),Tracks=require('./race-tracks.js');

// Run the real replay page script against stubbed DOM/canvas/renderer.
async function loadReplay(data,search=''){
  const calls={entities:[],identity:null,draws:0};let raf=null;
  const ctx2d=new Proxy({},{get:(t,k)=>k==='canvas'?{width:960,height:540}:(t[k]??(()=>({addColorStop(){}})))});
  const canvas={width:960,height:540,style:{},getContext:()=>ctx2d};
  const els={'replay-canvas':canvas};const el=id=>els[id]||(els[id]={textContent:'',style:{},addEventListener(){}});
  class Renderer{reset(){}setRaceIdentity(i){calls.identity=i;}setRaceEntities(e){calls.entities=e;}setProjectiles(){}update(){}draw(){calls.draws++;}}
  const window={VaultRushRenderer:{Renderer,loadAssets:async()=>({})},VaultRace:Race,VaultRaceTracks:Tracks};
  vm.runInNewContext(fs.readFileSync(__dirname+'/replay.js','utf8'),{window,document:{getElementById:el},location:{pathname:'/mp/replay/abc12345',search,href:'x'},innerWidth:1000,addEventListener(){},
    fetch:async()=>({ok:true,json:async()=>data}),requestAnimationFrame:f=>{raf=f;return 1;},cancelAnimationFrame(){},navigator:{},URLSearchParams,Promise,Math,Number,String,Boolean,Object,Error,console});
  await new Promise(r=>setTimeout(r,20));
  return{window,calls,status:()=>el('replay-status').textContent,tick:t=>raf&&raf(t)};
}
function frames(hz,extra){
  const out=[];for(let i=0;i<=5*hz;i++){const t=60000+i*1000/hz;out.push({t,players:[1,2,3].map(seat=>{const x=70000+seat*300+i*(1200/hz);const p={seat,name:'R'+seat,color:'#f26b35',x,y:Tracks.terrainAt('frozen-rush',x),angle:.3,finished:seat===3&&i>2*hz};if(extra)Object.assign(p,{g:1,b:seat===2?1:0,s:1200,finishMs:p.finished?62000:null});return p;}),projectiles:[]});}
  return out;
}
test('replay page draws old 10 Hz and new 20 Hz replays with the race renderer and smooth interpolation',async()=>{
  for(const [hz,extra] of [[10,false],[20,true]]){
    const r=await loadReplay({id:'abc12345',trackId:'frozen-rush',frames:frames(hz,extra),results:extra?[{seat:3,placement:1},{seat:1,placement:2},{seat:2,placement:3}]:undefined});
    assert.match(r.status(),/Share this link/);
    r.tick(16);r.tick(32);assert(r.calls.draws>=2);
    // Between two stored frames the racer sits part-way, not snapped to either frame.
    const mid=r.window.VaultReplay.sample(1000/hz/2).players.find(p=>p.seat===1);
    const a=frames(hz,extra)[0].players[0].x,b=frames(hz,extra)[1].players[0].x;assert(mid.x>a&&mid.x<b);
    assert.equal(r.window.VaultReplay.hero(),extra?3:3,'follows the winner, or the leader for old replays');
  }
});
test('replay link with ?seat follows that racer',async()=>{
  const r=await loadReplay({id:'abc12345',trackId:'frozen-rush',frames:frames(20,true),results:[{seat:3,placement:1}]},'?seat=2');
  assert.equal(r.window.VaultReplay.hero(),2);r.tick(16);assert.equal(r.calls.identity.name,'R2');assert(r.calls.entities.every(e=>e.seat!==2));
});
test('replay page loads current scripts, never a stale track file',()=>{
  const html=fs.readFileSync(__dirname+'/replay.html','utf8'),mp=fs.readFileSync(__dirname+'/multiplayer.html','utf8');
  const version=(mp.match(/race-tracks\.js\?v=([\w-]+)/)||[])[1];assert(version);
  for(const f of ['race-tracks.js','race-engine.js','multiplayer-renderer.js','replay.js'])assert(html.includes(f+'?v='+version),f);
});
