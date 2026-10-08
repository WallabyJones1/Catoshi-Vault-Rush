'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Renderer}=require('./multiplayer-renderer.js'),{RaceRun}=require('./race-engine.js'),{TRACKS}=require('./race-tracks.js');
const fs=require('node:fs'),vm=require('node:vm');
test('drawing mesh reuses terrain work while preserving slopes, ground contact and physics',()=>{
  const r=new RaceRun(TRACKS[0].id),renderer=new Renderer({canvas:{width:450,height:750}},{}),original=r.terrain.bind(r);let calls=0;
  r.terrain=x=>{calls++;return original(x);};const view=renderer.renderView(r);
  for(let frame=0;frame<60;frame++)for(let x=frame*10;x<frame*10+1800;x+=8){assert(Math.abs(view.terrain(x)-original(x))<.15);}
  assert(calls<400,'Reuse ground samples rather than rebuilding the terrain every frame');
  assert.equal(r.terrain(1234),original(1234),'Physics still uses its original surface');
  r.player.x=3000;r.player.y=original(3000);renderer.reset(r);renderer.networkOffset={x:20,y:80,angle:1};renderer.update(r,1/60);
  assert.equal(renderer.visualPlayer.y,original(renderer.visualPlayer.x),'Grounded riders stay on the sand during correction');
  assert.equal(renderer.visualPlayer.angle,r.slope(renderer.visualPlayer.x));
});
test('drawing cache is discarded when the course changes',()=>{
  const renderer=new Renderer({canvas:{width:450,height:750}},{}),a=new RaceRun(TRACKS[0].id),b=new RaceRun(TRACKS[1].id);
  const av=renderer.renderView(a),bv=renderer.renderView(b);assert.notEqual(av,bv);assert.equal(bv.terrain(0),b.terrain(0));
});
test('race order banner shows all eight names, reorders in place and sits outside the canvas',()=>{
  const elements=new Map();
  function element(id){if(elements.has(id))return elements.get(id);const e={id,value:'',children:[],hidden:false,textContent:'',style:{},classList:{contains:()=>false},addEventListener(){},append(...nodes){for(const n of nodes)this.appendChild(n);},appendChild(n){n.parent=this;this.children.push(n);},remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}};elements.set(id,e);return e;}
  let next=0;const window={VaultRaceTracks:{TRACKS},VaultRushGame:{startMultiplayer(){}}};
  const context={window,parent:window,document:{getElementById:element,querySelector:()=>null,createElement:()=>element('node'+next++),addEventListener(){}},location:{search:'',origin:'https://example.test'},URLSearchParams,Uint32Array,crypto:require('node:crypto').webcrypto,Date,performance,localStorage:{getItem:()=>null,setItem(){}},fetch:()=>new Promise(()=>{}),AbortController,setTimeout:()=>1,clearTimeout(){},clearInterval(){},setInterval:()=>1};
  vm.runInNewContext(fs.readFileSync('multiplayer.js','utf8'),context);
  const players=Array.from({length:8},(_,seat)=>({seat,x:seat*100,name:'Cat '+seat,color:'#e8a13a',forfeited:false,finishMs:null}));
  window.RushMultiplayer.localSnapshot({players});const nodes=[...element('race-live-list').children];assert.equal(nodes.length,8);
  assert.equal(nodes[0].children[1].textContent,'Cat 7');assert.equal(nodes[0].style.order,0);
  players[0].x=900;window.RushMultiplayer.localSnapshot({players});assert.deepEqual(element('race-live-list').children,nodes,'Updates reuse existing DOM nodes');
  assert.equal(nodes.find(n=>n.children[1].textContent==='Cat 0').style.order,0);
  const html=fs.readFileSync('multiplayer.html','utf8');assert(html.indexOf('id="race-standings"')<html.indexOf('class="game-shell"'),'Standings reserve space above the canvas');
});
