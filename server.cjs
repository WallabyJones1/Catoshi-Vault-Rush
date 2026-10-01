'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {HttpError,MINT,ENGINE_VERSION,MAX_TICKS,walletAddress,playerName,hash,tokenBalance,escapeHtml}=require('./security.cjs');
const {dailyQuest,syncHolderScores,publicRun,RUN_FIELDS}=require('./quest.cjs');
const {checkReplay}=require('./replay-worker.cjs');
const {rewardSettings,ensureRound,publicRewards,fromRaw}=require('./rewards.cjs');
const ROUND_MS=86400000,GRACE_MS=660000;
const HOLDER_DAILY_RUNS=null; // No daily gameplay quota; kept in config for older clients.
const STATIC_FILES=new Map([
  ['index.html','text/html; charset=utf-8'],['styles.css','text/css'],['engine.js','text/javascript'],
  ['renderer.js','text/javascript'],['game.js','text/javascript'],['online.js','text/javascript'],
  ['sound.js','text/javascript'],['audio-config.js','text/javascript'],['catoshi-coin.png','image/png'],
  ['rush-pickups-v1.png','image/png'],['rush-pickups-v2.png','image/png'],['home.js','text/javascript'],['catoshi-home-loop-v1.png','image/png'],
  ...['silence','burst','coin','jump','flip','metal','wood','stone','crash','land','rush','red'].map(kind=>['sfx-'+kind+'-v1.wav','audio/wav']),
  ['music.mp3','audio/mpeg'],['music.ogg','audio/ogg'],['music.wav','audio/wav'],
  ['canyon-atmosphere.png','image/png'],['canyon-endless-layers.png','image/png'],
  ['terrain-biomes-v1.png','image/png'],['terrain-obstacles-v1.png','image/png'],
  ['catoshi-clean-actions.png','image/png'],['vault-scenery-atlas.png','image/png']
]);
function openDatabase(filename) {
  if(filename!==':memory:')fs.mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});
  const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,wallet TEXT,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,session TEXT NOT NULL,wallet TEXT NOT NULL,message TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rounds(id INTEGER PRIMARY KEY,start INTEGER NOT NULL,end INTEGER NOT NULL,tokens TEXT NOT NULL,vault TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,session TEXT NOT NULL,seed INTEGER NOT NULL,name TEXT NOT NULL,wallet TEXT,mode TEXT NOT NULL,round INTEGER NOT NULL,started INTEGER NOT NULL,expires INTEGER NOT NULL,engine TEXT NOT NULL,ticks INTEGER,score INTEGER,distance INTEGER,coins INTEGER,reason TEXT,submitted INTEGER,inputs TEXT,disqualified TEXT);
    CREATE INDEX IF NOT EXISTS runs_ranking ON runs(mode,round,score DESC);
    CREATE INDEX IF NOT EXISTS runs_session ON runs(session,started);
    CREATE INDEX IF NOT EXISTS runs_wallet_day ON runs(wallet,round,score DESC,submitted ASC,id ASC);
    CREATE TABLE IF NOT EXISTS round_rewards(round INTEGER PRIMARY KEY,rush_mint TEXT NOT NULL,rush_tokens TEXT NOT NULL,splits TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reward_plans(round INTEGER PRIMARY KEY,vault TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS reward_payments(id TEXT PRIMARY KEY,round INTEGER NOT NULL,rank INTEGER NOT NULL,run_id TEXT NOT NULL,wallet TEXT NOT NULL,vault TEXT NOT NULL,mint TEXT NOT NULL,symbol TEXT NOT NULL,raw TEXT NOT NULL,decimals INTEGER NOT NULL,status TEXT NOT NULL,signature TEXT,created INTEGER NOT NULL,paid INTEGER,UNIQUE(round,rank,mint));
    CREATE TABLE IF NOT EXISTS reward_transactions(signature TEXT NOT NULL,round INTEGER NOT NULL,mint TEXT NOT NULL,recorded INTEGER NOT NULL,PRIMARY KEY(signature,mint));
    CREATE TABLE IF NOT EXISTS payouts(round INTEGER PRIMARY KEY,run_id TEXT UNIQUE NOT NULL,wallet TEXT NOT NULL,vault TEXT NOT NULL,raw TEXT NOT NULL,decimals INTEGER NOT NULL,status TEXT NOT NULL,signature TEXT UNIQUE,created INTEGER NOT NULL,paid INTEGER);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS holder_attempts(wallet TEXT NOT NULL,round INTEGER NOT NULL,used INTEGER NOT NULL,PRIMARY KEY(wallet,round));
    INSERT OR IGNORE INTO holder_attempts(wallet,round,used) SELECT wallet,round,COUNT(*) FROM runs WHERE mode='holder' AND wallet IS NOT NULL GROUP BY wallet,round;
  `);
  const columns=new Set(db.prepare('PRAGMA table_info(runs)').all().map(column=>column.name));
  for(const [name,type]of [['raw_score','INTEGER'],['red_tokens','INTEGER NOT NULL DEFAULT 0'],['rush_pickups','INTEGER NOT NULL DEFAULT 0']]){
    if(!columns.has(name))db.exec('ALTER TABLE runs ADD COLUMN '+name+' '+type);
  }
  db.exec('UPDATE runs SET raw_score=score WHERE submitted IS NOT NULL AND raw_score IS NULL;');
  return db;
}
function configFromEnv(env=process.env) {
  const production=env.NODE_ENV==='production';
  const origin=env.PUBLIC_ORIGIN||(env.RAILWAY_PUBLIC_DOMAIN?'https://'+env.RAILWAY_PUBLIC_DOMAIN:'http://localhost:3000');
  const url=new URL(origin);
  if(url.origin!==origin||!['http:','https:'].includes(url.protocol)||(production&&url.protocol!=='https:'))throw new Error('PUBLIC_ORIGIN must be an exact HTTPS origin in production, with no trailing slash.');
  const database=env.DATABASE_PATH||path.join(env.RAILWAY_VOLUME_MOUNT_PATH||'./data','catoshi.sqlite');
  if(production&&!env.RAILWAY_VOLUME_MOUNT_PATH&&!env.DATABASE_PATH)throw new Error('Attach a persistent Railway volume, or set DATABASE_PATH on persistent storage.');
  const rewards=rewardSettings(env);
  const {vault,tokens}=rewards;
  return {production,origin,database,vault,tokens,rewards,rpc:env.SOLANA_RPC_URL||'https://solana-rpc.publicnode.com',rpcFallback:env.SOLANA_RPC_FALLBACK_URL||(env.SOLANA_RPC_URL==='https://api.mainnet-beta.solana.com'?'https://solana-rpc.publicnode.com':'https://api.mainnet-beta.solana.com'),port:Number(env.PORT||3000)};
}
function createApp(config,options={}) {
  const db=options.db||openDatabase(config.database),now=options.now||Date.now;
  const fetchBalance=(address,mint)=>options.assetBalance?options.assetBalance(address,mint):mint===MINT&&options.balance?options.balance(address):tokenBalance(address,[config.rpc,config.rpcFallback].filter(Boolean),undefined,mint);
  const balances=new Map();
  async function balance(address,mint=MINT){
    const key=mint+':'+address;
    const cached=balances.get(key);
    if(cached&&cached.expires>now())return cached.promise;
    if(balances.size>=500){for(const [key,value]of balances)if(value.expires<=now())balances.delete(key);}
    if(balances.size>=500)balances.delete(balances.keys().next().value);
    const entry={expires:now()+15000,promise:null};
    entry.promise=Promise.resolve().then(()=>fetchBalance(address,mint)).catch(error=>{if(balances.get(key)===entry)balances.delete(key);throw error;});
    balances.set(key,entry);return entry.promise;
  }
  const limits=new Map();let vaultCache=null,lastCleanup=0;
  function cleanup(){
    const t=now();if(t-lastCleanup<60000)return;lastCleanup=t;
    db.prepare('DELETE FROM challenges WHERE expires<?').run(t);
    db.prepare('DELETE FROM sessions WHERE expires<?').run(t);
    db.prepare("DELETE FROM runs WHERE submitted IS NULL AND expires<? AND (mode='practice' OR started<?)").run(t-3600000,t-90*86400000);
    // Keep rankings, but trim old practice recordings. Never trim payout evidence.
    db.prepare('UPDATE runs SET inputs=NULL WHERE started<? AND mode=\'practice\' AND inputs IS NOT NULL AND id NOT IN (SELECT run_id FROM payouts)').run(t-90*86400000);
    for(const [key,value]of limits)if(t-value.at>60000)limits.delete(key);
  }
  function rate(req,category,max,identity){
    const key=(identity||req.socket.remoteAddress||'unknown')+':'+category;
    const t=now();let limit=limits.get(key);
    if(!limit||t-limit.at>60000){limit={at:t,count:0};limits.set(key,limit);}
    if(++limit.count>max)throw new HttpError(429,'Too many requests. Please wait a minute.');
    if(limits.size>10000)throw new HttpError(503,'Please retry shortly.');
  }
  function session(req,res){
    const cookie=req.headers.cookie?.match(/(?:^|;\s*)rush_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
    let record=cookie?db.prepare('SELECT * FROM sessions WHERE id=? AND expires>?').get(hash(cookie),now()):null;
    if(!record){
      const token=crypto.randomBytes(32).toString('base64url');
      record={id:hash(token),wallet:null,expires:now()+24*3600000};
      db.prepare('INSERT INTO sessions(id,wallet,expires)VALUES(?,?,?)').run(record.id,null,record.expires);
      res.setHeader('Set-Cookie',`rush_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${config.production?'; Secure':''}`);
    }
    return record;
  }
  function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  async function body(req){
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new HttpError(415,'JSON body required.');
    let size=0,chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>100000)throw new HttpError(413,'Recording is too large.');chunks.push(chunk);}
    let value;try{value=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new HttpError(400,'Invalid JSON body.');}
    if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'JSON object required.');
    return value;
  }
  function holderQuota(wallet,round=Math.floor(now()/ROUND_MS)){
    const used=db.prepare('SELECT used FROM holder_attempts WHERE wallet=? AND round=?').get(wallet,round)?.used||0;
    return {limit:null,used,remaining:null,unlimited:true,resetsAt:(round+1)*ROUND_MS};
  }
  function holderBest(wallet,round=Math.floor(now()/ROUND_MS)){
    const run=db.prepare(`SELECT ${RUN_FIELDS} FROM runs WHERE wallet=? AND mode='holder' AND round=? AND submitted IS NOT NULL AND disqualified IS NULL ORDER BY score DESC,submitted ASC,id ASC LIMIT 1`).get(wallet,round);
    if(!run)return null;
    const rank=ranking('holder',round).findIndex(value=>value.id===run.id)+1;
    return {...publicRun(run),rank:rank||null};
  }
  function holderStatus(wallet,round=Math.floor(now()/ROUND_MS)){
    const history=db.prepare(`SELECT ${RUN_FIELDS},started,expires,disqualified FROM runs WHERE wallet=? AND mode='holder' AND round=? ORDER BY started DESC,rowid DESC LIMIT 10`).all(wallet,round).map(run=>({...publicRun(run),started:run.started,status:run.disqualified?'reviewed out':run.submitted!==null?'completed':run.expires<now()?'expired':'in progress'}));
    return {wallet,round,quota:holderQuota(wallet,round),best:holderBest(wallet,round),quest:dailyQuest(db,wallet,round),history};
  }
  function ownResult(run,req,extra={}){
    const ranks=ranking(run.mode,run.mode==='holder'?run.round:-1),rank=ranks.findIndex(value=>value.id===run.id)+1;
    return {run:publicRun(run),rank:rank||null,url:siteOrigin(req)+'/score/'+run.id,...(run.wallet?{quota:holderQuota(run.wallet),best:holderBest(run.wallet,run.round),quest:dailyQuest(db,run.wallet,run.round),daily:holderStatus(run.wallet)}:{}),...extra};
  }
  function ranking(mode,round){
    return db.prepare(`SELECT ${RUN_FIELDS} FROM (SELECT ${RUN_FIELDS},ROW_NUMBER() OVER(PARTITION BY COALESCE(wallet,session) ORDER BY score DESC,submitted ASC,id ASC) position FROM runs WHERE mode=? AND (?=-1 OR round=?) AND submitted IS NOT NULL AND disqualified IS NULL) WHERE position=1 ORDER BY score DESC,submitted ASC,id ASC LIMIT 50`).all(mode,round,round);
  }
  function siteOrigin(req){
    // Use the request Host, not an arbitrary X-Forwarded-Host supplied by a client.
    const host=req.headers.host;
    if(typeof host!=='string'||host.includes(',')||/[\s/\\@]/.test(host))return config.origin;
    try{return new URL((config.production?'https:':'http:')+'//'+host).origin;}catch{return config.origin;}
  }
  function sameOrigin(req){
    const origin=req.headers.origin;
    if(origin==='null')return false;
    if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')return false;
    if(!origin){
      // Some mobile browsers omit Origin on same-site fetches. A same-origin
      // Referer is sufficient; requests without either proof remain rejected.
      try{const referer=new URL(req.headers.referer).origin;return referer===config.origin||referer===siteOrigin(req);}catch{return false;}
    }
    try{if(new URL(origin).origin!==origin)return false;}catch{return false;}
    return origin===config.origin||origin===siteOrigin(req);
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    if(config.production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try{
      cleanup();const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/health'){json(res,{ok:true});return;}
      if(url.pathname.startsWith('/api/')){
        rate(req,'api',180);
        if(req.method==='POST'&&!sameOrigin(req))throw new HttpError(403,'Same-origin request required.');
        if(req.method==='GET'&&url.pathname==='/api/config'){
          const round=Math.floor(now()/ROUND_MS);
          const snapshot=ensureRound(db,round,config,ROUND_MS);
          const rewards=publicRewards(snapshot,config);
          json(res,{engine:ENGINE_VERSION,mint:MINT,minimumTokens:0,holderDailyRuns:HOLDER_DAILY_RUNS,unlimitedPlays:true,entryMode:'free-wallet',redQuest:{target:10,maxPerRun:5,bestScoreMultiplier:2,reset:'00:00 UTC'},rushBurstSeconds:7,vault:config.vault,prizesEnabled:rewards.enabled,payoutMode:'manual-review',jackpotTokens:rewards.catoshiPool,rewards,round,roundMs:ROUND_MS,roundEnds:(round+1)*ROUND_MS,maxTicks:MAX_TICKS,serverTime:now(),paidModeEnabled:false});return;
        }
        if(req.method==='GET'&&url.pathname==='/api/leaderboard'){
          const mode=url.searchParams.get('mode')==='holder'?'holder':'practice';
          const raw=url.searchParams.get('round');let round=mode==='practice'?-1:Math.floor(now()/ROUND_MS);
          if(raw!==null){if(!/^\d{1,10}$/.test(raw))throw new HttpError(400,'Invalid round.');round=Number(raw);}
          json(res,{mode,round,entries:ranking(mode,round).map((run,index)=>({...publicRun(run),rank:index+1})),updatedAt:now()});return;
        }
        if(req.method==='GET'&&['/api/player-status','/api/holder-status','/api/balance'].includes(url.pathname)){
          const address=walletAddress(url.searchParams.get('wallet'));
          // Validate a public reward address only. Entry/progress never depend
          // on token ownership or on the availability of a Solana RPC.
          json(res,{...holderStatus(address),eligible:true,minimumTokens:0,checkedAt:now()});return;
        }
        if(req.method==='GET'&&url.pathname==='/api/vault'){
          if(!config.vault){json(res,{configured:false,payoutMode:'manual-review'});return;}
          if(!vaultCache||now()-vaultCache.at>30000){
            const mint=config.rewards?.rushMint||'';
            const assets=[{symbol:'CATOSHI',mint:MINT},...(mint?[{symbol:'RUSH',mint}]:[])];
            const results=await Promise.allSettled(assets.map(asset=>balance(config.vault,asset.mint)));
            const values=assets.map((asset,i)=>{
              if(results[i].status!=='fulfilled')return {...asset,available:false,tokens:null};
              const value=results[i].value;
              return {...asset,available:true,tokens:typeof value.raw==='bigint'?fromRaw(value.raw,value.decimals):value.whole};
            });
            vaultCache={at:now(),value:values};
          }
          const catoshi=vaultCache.value.find(asset=>asset.symbol==='CATOSHI');
          json(res,{configured:true,address:config.vault,tokens:catoshi.tokens,mint:MINT,assets:vaultCache.value,updatedAt:vaultCache.at,payoutMode:'manual-review'});return;
        }
        if(req.method!=='POST')throw new HttpError(404,'Not found.');
        const data=await body(req),user=session(req,res);
        if(['/api/entry','/api/balance'].includes(url.pathname)){
          const address=walletAddress(data.wallet);
          json(res,{...holderStatus(address),eligible:true,minimumTokens:0,checkedAt:now()});return;
        }
        if(url.pathname==='/api/runs/start'){
          rate(req,'starts',60,user.id);
          const mode=data.mode==='holder'?'holder':'practice';const name=playerName(data.name);
          if(data.engine!==ENGINE_VERSION)throw new HttpError(409,'Reload the game to get the current engine.');
          // Legacy mode 'holder' stores all daily prize entries so existing
          // scores and reward records remain intact. No holdings are required.
          const rewardWallet=mode==='holder'?walletAddress(data.wallet):null;
          const round=Math.floor(now()/ROUND_MS),id=crypto.randomUUID(),seed=crypto.randomInt(1,0xffffffff);
          ensureRound(db,round,config,ROUND_MS);
          // Record starts for daily progress only, without any play limit.
          // Keep the durable counter and ticket in one transaction.
          db.exec('BEGIN IMMEDIATE');
          try{
            if(rewardWallet){
              db.prepare('INSERT OR IGNORE INTO holder_attempts(wallet,round,used)VALUES(?,?,0)').run(rewardWallet,round);
              db.prepare('UPDATE holder_attempts SET used=used+1 WHERE wallet=? AND round=?').run(rewardWallet,round);
            }
            db.prepare('INSERT INTO runs(id,session,seed,name,wallet,mode,round,started,expires,engine)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,user.id,seed,name,rewardWallet,mode,round,now(),Math.min(now()+1200000,(round+1)*ROUND_MS+GRACE_MS),ENGINE_VERSION);
            db.exec('COMMIT');
          }catch(error){db.exec('ROLLBACK');throw error;}
          json(res,{id,seed,mode,round,wallet:rewardWallet,engine:ENGINE_VERSION,maxTicks:MAX_TICKS,...(rewardWallet?{...holderStatus(rewardWallet,round)}:{})});return;
        }
        if(url.pathname==='/api/runs/finish'){
          rate(req,'finishes',60,user.id);
          const saved=db.prepare('SELECT * FROM runs WHERE id=? AND session=?').get(String(data.id||''),user.id);
          if(!saved)throw new HttpError(404,'Run not found.');
          if(saved.submitted!==null){json(res,ownResult(saved,req,{duplicate:true}));return;}
          if(saved.expires<now())throw new HttpError(410,'This run expired. Start a new run.');
          if(saved.engine!==ENGINE_VERSION)throw new HttpError(409,'The engine changed; please start a new run.');
          if(!Number.isInteger(data.ticks)||data.ticks>Math.floor((now()-saved.started+2000)/1000*120))throw new HttpError(400,'Run elapsed time is invalid.');
          const checked=await checkReplay(saved.seed,data.ticks,data.inputs);
          // Recheck expiry after asynchronous replay, then save its native
          // collectible totals and recalculate the day's best in one commit.
          if(saved.expires<now())throw new HttpError(410,'This run expired. Start a new run.');
          db.exec('BEGIN IMMEDIATE');
          try{
            if(saved.wallet&&(db.prepare('SELECT round FROM reward_plans WHERE round=? UNION SELECT round FROM payouts WHERE round=?').get(saved.round,saved.round)))throw new HttpError(409,'This day is closed for payout review.');
            const changed=db.prepare('UPDATE runs SET ticks=?,score=?,raw_score=?,distance=?,coins=?,red_tokens=?,rush_pickups=?,reason=?,submitted=?,inputs=? WHERE id=? AND submitted IS NULL').run(data.ticks,checked.score,checked.score,checked.distance,checked.coins,checked.redTokens,checked.rushPickups,checked.reason,now(),JSON.stringify(data.inputs),saved.id);
            if(changed.changes!==1)throw new HttpError(409,'Run already submitted.');
            if(saved.wallet)syncHolderScores(db,saved.wallet,saved.round);
            db.exec('COMMIT');
          }catch(error){db.exec('ROLLBACK');throw error;}
          const record=db.prepare('SELECT * FROM runs WHERE id=?').get(saved.id);
          json(res,ownResult(record,req));return;
        }
        throw new HttpError(404,'Not found.');
      }
      if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'Method not allowed.');
      rate(req,'static',600);
      let filename=url.pathname==='/'?'index.html':url.pathname.slice(1),html=null;
      const share=url.pathname.match(/^\/score\/([0-9a-f-]{36})$/);
      if(share){
        const run=db.prepare('SELECT * FROM runs WHERE id=? AND submitted IS NOT NULL AND disqualified IS NULL').get(share[1]);
        if(!run)throw new HttpError(404,'Score not found.');
        const title=escapeHtml(`${run.name} scored ${run.score.toLocaleString()} in Catoshi Vault Rush`);
        html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replace('<head>',`<head><base href="/"><meta property="og:title" content="${title}"><meta property="og:description" content="${run.distance}m · ${run.coins} gold · ${run.mode==='holder'?'prize':'practice'} run"><meta property="og:image" content="${siteOrigin(req)}/canyon-atmosphere.png"><meta name="twitter:card" content="summary_large_image">`).replace('<title>Catoshi · Vault Rush</title>',`<title>${title}</title>`);
        filename='index.html';
      }
      if(!STATIC_FILES.has(filename))throw new HttpError(404,'Not found.');
      if(!html&&!fs.existsSync(path.join(__dirname,filename)))throw new HttpError(404,'Not found.');
      if(STATIC_FILES.get(filename).startsWith('audio/')){
        const file=path.join(__dirname,filename),size=fs.statSync(file).size;
        let start=0,end=size-1,status=200;
        if(req.headers.range){
          const match=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
          if(!match||(!match[1]&&!match[2]))throw new HttpError(416,'Invalid audio range.');
          if(!match[1])start=Math.max(0,size-Number(match[2]));
          else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
          if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end){res.setHeader('Content-Range',`bytes */${size}`);throw new HttpError(416,'Audio range not available.');}
          status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
        }
        res.writeHead(status,{'Content-Type':STATIC_FILES.get(filename),'Accept-Ranges':'bytes','Content-Length':end-start+1,'Cache-Control':'public, max-age=86400'});
        if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
        return;
      }
      const content=html||fs.readFileSync(path.join(__dirname,filename));
      res.writeHead(200,{'Content-Type':STATIC_FILES.get(filename),'Cache-Control':filename.endsWith('.png')?'public, max-age=86400':'no-cache'});
      res.end(req.method==='HEAD'?undefined:content);
    }catch(error){
      if(!res.headersSent)json(res,{error:error.status?error.message:'An internal error occurred.'},error.status||500);
      else res.end();
      if(!error.status)console.error('Request failed:',error.name); // Never log request bodies, signatures, cookies, RPC URLs, or secrets.
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,db,ranking,config};
}
if(require.main===module){
  const config=configFromEnv();const app=createApp(config);
  app.server.listen(config.port,'0.0.0.0',()=>console.log('Catoshi web server listening on port',config.port));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{app.server.close(()=>{app.db.close();process.exit(0);});});
}
module.exports={createApp,openDatabase,configFromEnv,ROUND_MS,GRACE_MS};
