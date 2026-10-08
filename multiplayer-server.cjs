'use strict';
// Separate multiplayer-only service: NO solo game, Solana RPC, wallet, prizes or payments.
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {HttpError}=require('./mp-security.cjs');
const {currentRound}=require('./periods.cjs');
const {createMultiplayer}=require('./multiplayer.cjs');
const {getTrack}=require('./race-tracks.js');
const BASE=__dirname;
const COOKIE='rush_mp_session';
const SESSION_MS=30*86400000;
const MIME={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.html':'text/html; charset=utf-8','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const STATIC=new Set(['multiplayer.html','replay.html','multiplayer.js','multiplayer-game.js','renderer.js','multiplayer-renderer.js','sound.js','audio-config.js','race-tracks.js','race-engine.js','race-net.js','replay.js','styles.css','multiplayer-lobby.css',
  ...['chakra-petch-600','chakra-petch-700','work-sans-400','work-sans-500','work-sans-600'].map(font=>font+'.woff2'),
  'catoshi-clean-actions.png','catoshi-actions-extra-v1.png','catoshi-coin.png','canyon-atmosphere.png','canyon-endless-layers.png','vault-scenery-atlas.png','terrain-biomes-v1.png','terrain-obstacles-v1.png','rush-pickups-v2.png','sky-terrain-details-v1.png',
  ...['silence','burst','coin','jump','flip','metal','wood','stone','crash','land','rush','red'].map(s=>'sfx-'+s+'-v1.wav'), 'music.mp3','music.ogg','music.wav']);
const SAFE_HEADERS={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"};
function openDatabase(file){
  if(file!==':memory:')fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
  const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;');
  db.exec('CREATE TABLE IF NOT EXISTS mp_sessions(id TEXT PRIMARY KEY,expires INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS mp_sessions_expire ON mp_sessions(expires);');
  return db;
}
function safeOrigin(env=process.env){
  const value=env.PUBLIC_ORIGIN||null;if(!value)return null;
  const parsed=new URL(value);if(parsed.origin!==value||!['http:','https:'].includes(parsed.protocol)||env.NODE_ENV==='production'&&parsed.protocol!=='https:')throw new Error('PUBLIC_ORIGIN must be an exact HTTPS origin without trailing slash in production.');
  return value;
}
function createApp({database=process.env.MP_DATABASE_PATH||process.env.DATABASE_PATH||path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH||'./data','catoshi-multiplayer.sqlite'),now=Date.now,realtime=true,publicOrigin=safeOrigin()}={}){
  const db=openDatabase(database),mp=createMultiplayer(db,{now,engineVersion:'multiplayer-v5'});
  let live=null,server=null;
  const limits=new Map();
  function token(req){const raw=req.headers.cookie||'';return raw.match(/(?:^|;\s*)rush_mp_session=([a-f0-9]{48})(?:;|$)/)?.[1]||null;}
  function sessionFromRequest(req){const val=token(req);if(!val)return null;return db.prepare('SELECT id FROM mp_sessions WHERE id=? AND expires>?').get(crypto.createHash('sha256').update(val).digest('hex'),now())||null;}
  function ensureSession(req,res){const found=sessionFromRequest(req);if(found)return found;
    const val=crypto.randomBytes(24).toString('hex'),id=crypto.createHash('sha256').update(val).digest('hex');
    db.prepare('INSERT INTO mp_sessions(id,expires)VALUES(?,?)').run(id,now()+SESSION_MS);
    res.setHeader('Set-Cookie',COOKIE+'='+val+'; Path=/mp/; HttpOnly; SameSite=Lax; Max-Age='+SESSION_MS/1000+(process.env.NODE_ENV==='production'?'; Secure':''));
    return {id};
  }
  function send(res,status,body,type='application/json; charset=utf-8',extra={}){res.writeHead(status,{...SAFE_HEADERS,'Content-Type':type,'Cache-Control':type.startsWith('text/html')?'no-cache':'no-store',...extra});res.end(type.startsWith('application/json')?JSON.stringify(body):body);}
  function fail(res,error){const status=Number.isInteger(error?.status)?error.status:500; if(status>=500)console.error('[multiplayer]',error);send(res,status>=400&&status<=599?status:500,{error:status>=500?'Multiplayer service unavailable. Please try again.':error.message});}
  function throttle(req,session){const key=session||req.socket.remoteAddress||'unknown',t=now(),value=limits.get(key)||{at:t,count:0};if(t-value.at>60000){value.at=t;value.count=0;}limits.set(key,value);if(++value.count>180)throw new HttpError(429,'Please wait a moment and retry.');if(limits.size>2000)for(const [k,v]of limits)if(t-v.at>60000)limits.delete(k);}
  function htmlReplay(id){const text=fs.readFileSync(path.join(BASE,'replay.html'),'utf8');const title=getTrack(mp.replay(id).trackId).name+' · Catoshi Multiplayer Replay';const origin=publicOrigin||'';
    return text.replace('<head>',`<head><base href="/mp/"><meta property="og:title" content="${title}"><meta property="og:description" content="Watch the final 5 seconds of a free Catoshi multiplayer race."><meta name="twitter:card" content="summary_large_image"><meta property="og:image" content="${origin}/mp/canyon-atmosphere.png">`);
  }
  async function handler(req,res){
    try{
      if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'Method not allowed.');
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/health'){db.prepare('SELECT 1').get();send(res,200,{ok:true,service:'catoshi-multiplayer',version:'5.0.0',realtime:!!live});return;}
      if(url.pathname.startsWith('/api/')){
        const s=ensureSession(req,res);
        throttle(req,s.id);
        if(url.pathname==='/api/multiplayer/profile')return send(res,200,mp.profile(s.id));
        if(url.pathname==='/api/multiplayer/state'){const active=mp.getActiveMatch(s.id);return send(res,200,{queue:mp.queueState(s.id),match:active?mp.publicMatch(active.id,s.id):null,profile:mp.profile(s.id)});}
        if(url.pathname==='/api/multiplayer/leaderboard'){
          const type=url.searchParams.get('type')||'weekly';if(type==='lifetime')return send(res,200,mp.lifetimeLeaderboard(s.id));
          if(type==='track')return send(res,200,mp.trackLeaderboard(url.searchParams.get('trackId')||'summit-smash',s.id));
          if(type!=='weekly')throw new HttpError(400,'Unknown leaderboard.');
          const raw=url.searchParams.get('round'),round=raw===null?currentRound(now()):/^\d{1,10}$/.test(raw)?Number(raw):NaN;
          if(!Number.isInteger(round)||round<0)throw new HttpError(400,'Invalid leaderboard round.');
          return send(res,200,mp.leaderboard(round,s.id));
        }
        if(url.pathname.startsWith('/api/replay/')){const id=url.pathname.split('/').pop();if(!/^[A-Za-z0-9_-]{8,24}$/.test(id))throw new HttpError(404,'Replay not found.');const r=mp.replay(id);if(!r)throw new HttpError(404,'Replay not found.');return send(res,200,r);}
        throw new HttpError(404,'Not found.');
      }
      if(url.pathname==='/'||url.pathname==='/multiplayer'||url.pathname==='/multiplayer/'){
        ensureSession(req,res);return send(res,200,fs.readFileSync(path.join(BASE,'multiplayer.html'),'utf8').replace('<head>','<head><base href="/mp/">'),'text/html; charset=utf-8');
      }
      const replay=url.pathname.match(/^\/replay\/([A-Za-z0-9_-]{8,24})$/);
      if(replay){if(!mp.replay(replay[1]))throw new HttpError(404,'Replay not found.');return send(res,200,htmlReplay(replay[1]),'text/html; charset=utf-8');}
      const asset=url.pathname.slice(1);
      if(!STATIC.has(asset))throw new HttpError(404,'Not found.');
      const file=path.join(BASE,asset==='renderer.js'?'multiplayer-renderer.js':asset);if(!fs.existsSync(file))throw new HttpError(404,'Asset unavailable.');
      return send(res,200,fs.readFileSync(file),MIME[path.extname(file)]||'application/octet-stream',{'Cache-Control':'public, max-age=3600'});
    }catch(err){fail(res,err);}
  }
  server=http.createServer(handler);server.requestTimeout=15000;server.headersTimeout=16000;
  if(realtime){live=require('./realtime.cjs').attachRealtime({server,multiplayer:mp,sessionFromRequest,now,allowRequest(req,callback){
    const origin=req.headers.origin;
    // The loopback bridge overwrites this header; external clients cannot choose it.
    const forwarded=req.socket.remoteAddress==='127.0.0.1'?req.headers['x-catoshi-origin']:null;
    const local=(process.env.NODE_ENV==='production'?'https://':'http://')+req.headers.host;
    callback(null,!origin||origin===publicOrigin||origin===forwarded||origin===local);
  }});}
  return {server,db,multiplayer:mp,realtime:live,sessionFromRequest,async close(){live?.close();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));db.close();}};
}
if(require.main===module){
  const app=createApp();const port=Number(process.env.PORT||3000);
  app.server.listen(port,process.env.MP_HOST||'127.0.0.1',()=>console.log('Free Catoshi multiplayer listening on '+port));
  const shutdown=()=>{app.realtime?.close();app.server.close(()=>{app.db.close();process.exit(0);});setTimeout(()=>process.exit(1),5000).unref();};
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}
module.exports={createApp,openDatabase,safeOrigin};
