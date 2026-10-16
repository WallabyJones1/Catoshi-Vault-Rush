/* ================= the game server: multiplayer, Phantom sign-in, shared board and pools =================
   When the game is opened from the Catoshi's Catch server (not inside claude.ai), it talks to /ws:
   the same doc/collection calls the claude.ai version makes go to the server instead, other players' cats
   appear in the world, and a Phantom wallet can sign in (a signed message; no tokens move). */
/* Where the multiplayer server is. Served by server.js: no meta tag, same origin. On the website build
   (dist/catoshicatch/index.html) the <meta name="catoshi-server"> tag decides: empty = solo play saved on the device,
   an https address = that server's multiplayer, board and Phantom sign-in. */
const SRV_META=document.querySelector('meta[name="catoshi-server"]'),SRV_URL=SRV_META?(SRV_META.content||'').trim().replace(/\/+$/,''):'';
const SERVER={on:location.protocol.startsWith('http')&&!(window.claude&&window.claude.use)&&(!SRV_META||!!SRV_URL),ws:null,seq:0,wait:new Map(),uid:null,sid:null,wallet:null,config:null,ready:false,lastPos:0};
const OTHERS=new Map(); // uid -> {p, t, say, sayT}
function srvReq(m){return new Promise(res=>{if(!SERVER.ws||SERVER.ws.readyState!==1){res(null);return}const id=++SERVER.seq;SERVER.wait.set(id,res);SERVER.ws.send(JSON.stringify(Object.assign({id},m)));setTimeout(()=>{if(SERVER.wait.has(id)){SERVER.wait.delete(id);res(null)}},8000)})}
const srvDb={
  doc(path){return{id:path.split('/').pop(),path,get:async()=>{const r=await srvReq({t:'get',path});const d=r&&r.data;return{id:path.split('/').pop(),exists:!!d,data:()=>d||undefined}},set:async data=>{const r=await srvReq({t:'set',path,data});if(!r||r.err)throw{code:'invalid_argument',message:r&&r.err||'offline'}}}},
  collection(coll){const q={n:500,limit(n){q.n=n;return q},get:async()=>{const r=await srvReq({t:'list',coll,limit:q.n});const docs=(r&&r.docs||[]).map(d=>({id:d.id,exists:true,data:()=>d.data}));return{docs,size:docs.length,empty:!docs.length}}};return q}};
function serverConnect(){return new Promise(resolve=>{let done=false;const finish=v=>{if(!done){done=true;resolve(v)}};
  const open=()=>{const ws=new WebSocket(SRV_URL?SRV_URL.replace(/^http/,'ws')+'/ws':(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');SERVER.ws=ws;
    ws.onopen=async()=>{let sid=null;try{sid=localStorage.getItem('catoshi.sid')}catch(e){}const r=await srvReq({t:'hello',sid});if(!r){finish(false);return}
      SERVER.sid=r.sid;SERVER.uid=r.uid;SERVER.wallet=r.wallet;SERVER.config=r.config;SERVER.ready=true;try{localStorage.setItem('catoshi.sid',r.sid)}catch(e){}
      applyServerConfig(r.config);for(const o of r.others||[])OTHERS.set(o.uid,{p:o,t:now()});NET.db=srvDb;NET.uid=r.uid;srvHud();finish(true)};
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}if(m.re&&SERVER.wait.has(m.re)){const f=SERVER.wait.get(m.re);SERVER.wait.delete(m.re);f(m);return}
      if(m.t==='pos'){const o=OTHERS.get(m.uid)||{p:m.p,t:0};o.p=m.p;o.t=now();OTHERS.set(m.uid,o);srvHud()}
      else if(m.t==='gone'){OTHERS.delete(m.uid);srvHud()}
      else if(m.t==='emote'){const o=OTHERS.get(m.uid);if(o){o.say=m.text;o.sayT=now()}else if(m.uid===SERVER.uid){SERVER.say=m.text;SERVER.sayT=now()}}};
    ws.onclose=()=>{SERVER.ready=false;OTHERS.clear();srvHud();finish(false);setTimeout(open,3000+Math.random()*2000)}};
  open()})}
function applyServerConfig(c){if(!c)return;const P=c.prices||{},Y=c.payouts||{};
  if(P.licence)LICENCE_PRICE=P.licence;if(P.autoCast!=null)AUTO_COST=P.autoCast;if(P.autoRate)AUTO_RATE=P.autoRate;
  for(const[k,v]of Object.entries(c.splits||{}))if(v&&typeof v==='object')SPLITS[k]=v;
  if(Y.dailyPay)DAILY_PAY=Y.dailyPay;if(Y.weeklyPay)WEEKLY_PAY=Y.weeklyPay;if(Array.isArray(Y.prizeSplit))PRIZE_SPLIT.splice(0,PRIZE_SPLIT.length,...Y.prizeSplit);if(Y.tripTarget)TRIP_TARGET=Y.tripTarget;
  if(P.startBalance!=null&&!S.coat&&!S.total)S.bal=P.startBalance;refreshHud()}
/* ---------------- your cat's position, a few times a second ---------------- */
function srvTick(){if(!SERVER.ready||!S||!S.coat)return;const t=now();if(t-SERVER.lastPos<.15)return;SERVER.lastPos=t;
  SERVER.ws.send(JSON.stringify({t:'pos',p:{x:Math.round(WP.x),y:Math.round(WP.y),boat:WP.boat,hd:WP.hd,dir:WP.dir,fr:WP.fr,coat:S.coat,name:S.name||COATI[S.coat].name,boatK:S.boat||'',away:MODE!=='world'}}))}
function pushOthers(L,cx,cy,t){for(const[uid,o]of OTHERS){const p=o.p;if(!p||now()-o.t>20)continue;if(p.x-cx<-40||p.x-cx>VW+40||p.y-cy<-40||p.y-cy>VH+40)continue;
  // ease towards the last known spot
  o.x=o.x==null?p.x:o.x+(p.x-o.x)*.2;o.y=o.y==null?p.y:o.y+(p.y-o.y)*.2;const x=o.x,y=o.y;const coat=COATI[p.coat]?p.coat:'ginger';
  L.push([y,()=>{g.globalAlpha=p.away?.45:1;if(p.boat&&BOATI[p.boatK]){const b=boatImg(p.boatK,p.hd);g.drawImage(b,Math.round(x-cx-b.width/2),Math.round(y-cy-b.height/2));g.drawImage(catFace(coat),Math.round(x-cx-6),Math.round(y-cy-13),12,11)}
    else{g.fillStyle='rgba(0,0,0,.22)';g.fillRect(Math.round(x-cx-5),Math.round(y-cy-1),10,2);g.drawImage(catWalk(coat,p.dir,p.fr),Math.round(x-cx-10),Math.round(y-cy-18))}g.globalAlpha=1;
    const nm=(p.away?'(fishing) ':'')+p.name;const w=textW(nm.toUpperCase())+6;g.fillStyle='rgba(16,13,12,.7)';g.fillRect(Math.round(x-cx-w/2),Math.round(y-cy-30),w,8);drawText(g,nm,Math.round(x-cx-w/2+3),Math.round(y-cy-29),'#c9f5e6');
    if(o.say&&now()-o.sayT<3.5){const sw=textW(o.say.toUpperCase())+8;g.fillStyle='#fff6e0';g.fillRect(Math.round(x-cx-sw/2),Math.round(y-cy-42),sw,10);g.fillStyle='#000';g.fillRect(Math.round(x-cx-1),Math.round(y-cy-32),2,2);drawText(g,o.say,Math.round(x-cx-sw/2+4),Math.round(y-cy-40),'#1a0e06')}}])}
  if(SERVER.say&&now()-SERVER.sayT<3.5)L.push([WP.y+1,()=>{const sw=textW(SERVER.say.toUpperCase())+8;g.fillStyle='#fff6e0';g.fillRect(Math.round(WP.x-cx-sw/2),Math.round(WP.y-cy-42),sw,10);drawText(g,SERVER.say,Math.round(WP.x-cx-sw/2+4),Math.round(WP.y-cy-40),'#1a0e06')}])}
function srvHud(){const on=SERVER.on;$('walletBtn').hidden=!on;$('emoteBtn').hidden=!on||!SERVER.ready;
  $('walletBtn').textContent=SERVER.wallet?SERVER.wallet.slice(0,4)+'...'+SERVER.wallet.slice(-4):'CONNECT WALLET';
  const n=[...OTHERS.values()].filter(o=>now()-o.t<20).length;$('emoteBtn').textContent=SERVER.ready?`${n+1} ONLINE  SAY`:'OFFLINE'}
function openEmotes(){const E=['Hi!','Nice catch!','Follow me!','Fish here!','For Catoshi!','Meow.'];showSheet('emote','Say something',b=>{b.append(el('p','lead','Everyone nearby sees it above your cat.'));const gr=el('div','trips');E.forEach((e,i)=>{const bt=btn('sm',e,()=>{closeSheet();SERVER.ws&&SERVER.ws.send(JSON.stringify({t:'emote',i}))});gr.append(bt)});b.append(gr)})}

/* ---------------- Phantom ---------------- */
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58enc(bytes){const d=[];let s='';for(const b of bytes){let c=b;for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=c/58|0}while(c){d.push(c%58);c=c/58|0}}for(const b of bytes){if(b)break;s+='1'}for(let i=d.length-1;i>=0;i--)s+=B58[d[i]];return s}
function phantom(){const p=window.phantom&&window.phantom.solana||window.solana;return p&&p.isPhantom?p:null}
function phantomDeepLink(){const url=(SERVER.config&&SERVER.config.publicUrl)||location.href;return'https://phantom.app/ul/browse/'+encodeURIComponent(url)+'?ref='+encodeURIComponent(new URL(url).origin)}
async function walletButton(){if(SERVER.wallet)return openWallet();if(!SERVER.ready){toast('Not connected to the server yet');return}const p=phantom();
  if(!p){if(/iphone|ipad|android/i.test(navigator.userAgent)){toast('Opening the game inside the Phantom app...');location.href=phantomDeepLink();return}toast('Install the Phantom browser extension, then try again.');return}
  let w;try{const r=await p.connect();w=r.publicKey.toString()}catch(e){toast('Wallet connection cancelled');return}
  const n=await srvReq({t:'nonce',wallet:w});if(!n||n.err){toast(n&&n.err||'The server did not answer');return}
  let sig;try{const r=await p.signMessage(new TextEncoder().encode(n.msg),'utf8');sig=b58enc(Array.from(r.signature||r))}catch(e){toast('Signing cancelled');return}
  const a=await srvReq({t:'auth',wallet:w,sig});if(!a||a.err){toast(a&&a.err||'Sign-in failed');return}
  SERVER.uid=a.uid;SERVER.wallet=a.wallet;NET.uid=a.uid;srvHud();sfx('stamp');toast('Wallet connected');
  // pick up this wallet's progress if it already has some
  try{const snap=await NET.db.doc('data/users/'+NET.uid+'/save').get();if(snap.exists){const d=snap.data();if(d&&d.v===2&&(d.t||0)>(S.t||0)){S=fixSave(JSON.parse(JSON.stringify(d)));rollDay();onSaveSwapped()}}}catch(e){}
  BOARD.dirty=true;LEDGER.dirty=true;dirty();saveNow();await fetchBoard();await fetchPools();checkPayouts()}
function openWallet(){showSheet('wallet','Wallet',b=>{const c=SERVER.config||{};
  b.append(el('p','lead',`Signed in as <b>${esc(SERVER.wallet)}</b>. Your progress, points and pool prizes follow this wallet to any device.`));
  b.append(el('p','odds',c.mode==='live'?'Live mode.':`Test mode: <b>$${esc((c.token&&c.token.symbol)||'CATOSHI')}</b> here is a play balance. Nothing moves on-chain until launch.`));
  b.append(btn('sm','SIGN OUT',async()=>{const r=await srvReq({t:'signout'});if(r){SERVER.wallet=null;SERVER.uid=r.uid;NET.uid=r.uid;srvHud();closeSheet();toast('Signed out')}}))})}
