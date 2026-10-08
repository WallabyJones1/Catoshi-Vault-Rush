'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {HttpError,MINT,ENGINE_VERSION,MAX_TICKS,walletAddress,playerName,hash,tokenBalance,escapeHtml}=require('./security.cjs');
const {dailyQuest,syncHolderScores,publicRun,playerFilter,RUN_FIELDS}=require('./quest.cjs');
const {checkReplay}=require('./replay-worker.cjs');
const {TRIAL_COURSES}=require('./engine.js');
const {picture}=require('./share-card.cjs');
const {rewardSettings,ensureRound,publicRewards,fromRaw}=require('./rewards.cjs');
const {ROUND_MS,currentRound,roundWindow,dayAt}=require('./periods.cjs');
const GRACE_MS=660000,SESSION_MS=30*86400000;
const HOLDER_DAILY_RUNS=null; // No daily gameplay quota; kept in config for older clients.
const rewardAddress=value=>value===undefined||value===null||(typeof value==='string'&&!value.trim())?null:walletAddress(value);
const STATIC_FILES=new Map([
  ['index.html','text/html; charset=utf-8'],['styles.css','text/css'],['engine.js','text/javascript'],
  ...['chakra-petch-600','chakra-petch-700','work-sans-400','work-sans-500','work-sans-600'].map(font=>[font+'.woff2','font/woff2']),
  ['renderer.js','text/javascript'],['game.js','text/javascript'],['online.js','text/javascript'],['ghost.js','text/javascript'],
  ['sound.js','text/javascript'],['audio-config.js','text/javascript'],['catoshi-coin.png','image/png'],
  ['rush-pickups-v1.png','image/png'],['rush-pickups-v2.png','image/png'],['home.js','text/javascript'],['catoshi-home-loop-v1.png','image/png'],
  ['catoshi-home-v2.webp','image/webp'],['catoshi-home-v2.gif','image/gif'],['catoshi-home-still-v2.png','image/png'],
  ...['silence','burst','coin','jump','flip','metal','wood','stone','crash','land','rush','red'].map(kind=>['sfx-'+kind+'-v1.wav','audio/wav']),
  ['music.mp3','audio/mpeg'],['music.ogg','audio/ogg'],['music.wav','audio/wav'],
  ['canyon-atmosphere.png','image/png'],['canyon-endless-layers.png','image/png'],
  ['terrain-biomes-v1.png','image/png'],['terrain-obstacles-v1.png','image/png'],
  ['catoshi-actions-extra-v1.png','image/png'],['sky-terrain-details-v1.png','image/png'],
  ['cargo-parachute-v1.png','image/png'],['share-art-v1.png','image/png'],
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
    CREATE TABLE IF NOT EXISTS trial_runs(id TEXT PRIMARY KEY,session TEXT NOT NULL,name TEXT NOT NULL,wallet TEXT,level INTEGER NOT NULL,engine TEXT NOT NULL,started INTEGER NOT NULL,expires INTEGER NOT NULL,ticks INTEGER,time_ms INTEGER,boosts INTEGER,submitted INTEGER,inputs TEXT,disqualified TEXT);
    CREATE INDEX IF NOT EXISTS trial_ranking ON trial_runs(level,engine,time_ms,submitted);
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
  if(!db.prepare('PRAGMA table_info(trial_runs)').all().some(column=>column.name==='ghost'))db.exec('ALTER TABLE trial_runs ADD COLUMN ghost TEXT');
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
  return {production,origin,shareOrigin:env.PUBLIC_ORIGIN||null,database,vault,tokens,rewards,rpc:env.SOLANA_RPC_URL||'https://solana-rpc.publicnode.com',rpcFallback:env.SOLANA_RPC_FALLBACK_URL||(env.SOLANA_RPC_URL==='https://api.mainnet-beta.solana.com'?'https://solana-rpc.publicnode.com':'https://api.mainnet-beta.solana.com'),port:Number(env.PORT||3000)};
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
    db.prepare('DELETE FROM trial_runs WHERE submitted IS NULL AND expires<?').run(t-3600000);
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
    let token=cookie;
    if(!record){
      token=crypto.randomBytes(32).toString('base64url');
      record={id:hash(token),wallet:null,expires:now()+SESSION_MS};
      db.prepare('INSERT INTO sessions(id,wallet,expires)VALUES(?,?,?)').run(record.id,null,record.expires);
    }else if(record.expires<now()+SESSION_MS-86400000){
      // Renew the same private guest identity, including old 24-hour cookies.
      record.expires=now()+SESSION_MS;
      db.prepare('UPDATE sessions SET expires=? WHERE id=?').run(record.expires,record.id);
    }else return record;
    res.setHeader('Set-Cookie',`rush_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS/1000}${config.production?'; Secure':''}`);
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
  function holderQuota(wallet,round=currentRound(now()),guestSession){
    const owner=playerFilter(wallet,guestSession);
    const used=wallet?db.prepare('SELECT used FROM holder_attempts WHERE wallet=? AND round=?').get(wallet,round)?.used||0
      :db.prepare(`SELECT COUNT(*) used FROM runs WHERE ${owner.where} AND round=? AND mode='holder'`).get(owner.value,round).used;
    return {limit:null,used,remaining:null,unlimited:true,resetsAt:roundWindow(round).end};
  }
  function holderBest(wallet,round=currentRound(now()),guestSession){
    const owner=playerFilter(wallet,guestSession);
    const run=db.prepare(`SELECT ${RUN_FIELDS} FROM runs WHERE ${owner.where} AND mode='holder' AND round=? AND submitted IS NOT NULL AND disqualified IS NULL ORDER BY score DESC,submitted ASC,id ASC LIMIT 1`).get(owner.value,round);
    if(!run)return null;
    const rank=ranking('holder',round).findIndex(value=>value.id===run.id)+1;
    return {...publicRun(run),rank:rank||null};
  }
  function holderStatus(wallet,round=currentRound(now()),guestSession){
    const owner=playerFilter(wallet,guestSession);
    const history=db.prepare(`SELECT ${RUN_FIELDS},expires,disqualified FROM runs WHERE ${owner.where} AND mode='holder' AND round=? ORDER BY started DESC,rowid DESC LIMIT 10`).all(owner.value,round).map(run=>({...publicRun(run),status:run.disqualified?'reviewed out':run.submitted!==null?'completed':run.expires<now()?'expired':'in progress'}));
    const window=roundWindow(round);
    return {wallet,prizeEligible:Boolean(wallet),round,period:window.period,roundStarts:window.start,roundEnds:window.end,quota:holderQuota(wallet,round,guestSession),best:holderBest(wallet,round,guestSession),quest:dailyQuest(db,wallet,round,guestSession,dayAt(now())),history};
  }
  function ownResult(run,req,extra={}){
    const ranks=ranking(run.mode,run.mode==='holder'?run.round:-1),rank=ranks.findIndex(value=>value.id===run.id)+1;
    const progress=run.mode==='holder'?holderStatus(run.wallet,undefined,run.session):null;
    return {run:publicRun(run),rank:rank||null,url:shareOrigin(req)+'/score/'+run.id,serverTime:now(),...(progress?{prizeEligible:Boolean(run.wallet),quota:progress.quota,best:holderBest(run.wallet,run.round,run.session),quest:dailyQuest(db,run.wallet,run.round,run.session,dayAt(run.started)),progress,daily:progress}:{}),...extra};
  }
  function ranking(mode,round){
    return db.prepare(`SELECT ${RUN_FIELDS} FROM (SELECT ${RUN_FIELDS},ROW_NUMBER() OVER(PARTITION BY COALESCE(wallet,session) ORDER BY score DESC,submitted ASC,id ASC) position FROM runs WHERE mode=? AND (?=-1 OR round=?) AND submitted IS NOT NULL AND disqualified IS NULL) WHERE position=1 ORDER BY score DESC,submitted ASC,id ASC LIMIT 50`).all(mode,round,round);
  }
  function trialCourse(level){
    const course=TRIAL_COURSES.find(value=>value.id===level);
    if(!course)throw new HttpError(400,'Choose a Speed Trial course from 1 to 5.');
    return {id:course.id,name:course.name,distance:course.distance/10};
  }
  function trialRanking(level){
    return db.prepare(`SELECT id,name,wallet,level,time_ms,boosts,submitted FROM
      (SELECT id,name,wallet,level,time_ms,boosts,submitted,
        ROW_NUMBER() OVER(PARTITION BY COALESCE(wallet,session) ORDER BY time_ms,submitted,id) position
       FROM trial_runs WHERE level=? AND engine=? AND submitted IS NOT NULL AND disqualified IS NULL)
      WHERE position=1 ORDER BY time_ms,submitted,id LIMIT 50`).all(level,ENGINE_VERSION);
  }
  function publicTrial(record){
    return {id:record.id,name:record.name,wallet:record.wallet?record.wallet.slice(0,4)+'…'+record.wallet.slice(-4):null,
      level:record.level,timeMs:record.time_ms,boosts:record.boosts,submitted:record.submitted};
  }
  function trialBest(wallet,guestSession,level){
    const owner=playerFilter(wallet,guestSession);
    const best=db.prepare(`SELECT * FROM trial_runs WHERE ${owner.where} AND level=? AND engine=? AND submitted IS NOT NULL AND disqualified IS NULL ORDER BY time_ms,submitted,id LIMIT 1`).get(owner.value,level,ENGINE_VERSION);
    if(!best)return null;
    const rank=trialRanking(level).findIndex(row=>row.id===best.id)+1;
    return {...publicTrial(best),rank:rank||null};
  }
  function trialResult(record,req,extra={}){
    const best=trialBest(record.wallet,record.session,record.level);
    return {run:publicTrial(record),best,rank:best?.id===record.id?best.rank:null,
      course:trialCourse(record.level),engine:ENGINE_VERSION,url:shareOrigin(req)+'/trial-score/'+record.id,serverTime:now(),...extra};
  }
  function siteOrigin(req){
    // Use the request Host, not an arbitrary X-Forwarded-Host supplied by a client.
    const host=req.headers.host;
    if(typeof host!=='string'||host.includes(',')||/[\s/\\@]/.test(host))return config.origin;
    try{return new URL((config.production?'https:':'http:')+'//'+host).origin;}catch{return config.origin;}
  }
  function shareOrigin(req){return config.shareOrigin||siteOrigin(req);}
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
          const round=currentRound(now()),window=roundWindow(round);
          const snapshot=ensureRound(db,round,config);
          const rewards=publicRewards(snapshot,config);
          json(res,{engine:ENGINE_VERSION,mint:MINT,minimumTokens:0,holderDailyRuns:HOLDER_DAILY_RUNS,unlimitedPlays:true,entryMode:'free-optional-wallet',walletOptional:true,redQuest:{target:10,maxPerRun:5,bestScoreMultiplier:2,reset:'00:00 UTC'},rushBurstSeconds:7,vault:config.vault,prizesEnabled:rewards.enabled,payoutMode:'manual-review',jackpotTokens:rewards.catoshiPool,rewards,round,previousRound:round-1,period:'weekly',roundMs:ROUND_MS,roundStarts:window.start,roundEnds:window.end,reset:'Monday 00:00 UTC',maxTicks:MAX_TICKS,serverTime:now(),paidModeEnabled:false});return;
        }
        if(req.method==='GET'&&url.pathname==='/api/trials/leaderboard'){
          const level=Number(url.searchParams.get('level')),course=trialCourse(level);
          json(res,{course,engine:ENGINE_VERSION,entries:trialRanking(level).map((run,index)=>({...publicTrial(run),rank:index+1})),updatedAt:now()});return;
        }
        if(req.method==='GET'&&url.pathname==='/api/trials/ghost'){
          const level=Number(url.searchParams.get('level'));trialCourse(level);
          const fastest=db.prepare('SELECT id,name,time_ms,ticks,ghost FROM trial_runs WHERE level=? AND engine=? AND submitted IS NOT NULL AND disqualified IS NULL ORDER BY time_ms,submitted,id LIMIT 1').get(level,ENGINE_VERSION);
          json(res,{engine:ENGINE_VERSION,level,ghost:fastest?.ghost?{id:fastest.id,name:fastest.name,timeMs:fastest.time_ms,ticks:fastest.ticks,samples:JSON.parse(fastest.ghost)}:null});return;
        }
        if(req.method==='GET'&&url.pathname==='/api/leaderboard'){
          const mode='holder';
          const raw=url.searchParams.get('round');let round=currentRound(now());
          if(raw!==null){if(!/^\d{1,10}$/.test(raw))throw new HttpError(400,'Invalid round.');round=Number(raw);}
          const window=roundWindow(round);
          json(res,{mode,round,period:window.period,roundStarts:window.start,roundEnds:window.end,entries:ranking(mode,round).map((run,index)=>({...publicRun(run),rank:index+1})),updatedAt:now()});return;
        }
        if(req.method==='GET'&&['/api/player-status','/api/holder-status','/api/balance'].includes(url.pathname)){
          const raw=url.searchParams.get('wallet');
          const address=rewardAddress(raw),guestSession=address?null:session(req,res).id;
          // Validate a public reward address only. Entry/progress never depend
          // on token ownership or on the availability of a Solana RPC.
          json(res,{...holderStatus(address,undefined,guestSession),eligible:true,minimumTokens:0,checkedAt:now()});return;
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
        if(url.pathname==='/api/trials/start'){
          rate(req,'starts',60,user.id);
          const course=trialCourse(data.level),name=playerName(data.name),wallet=rewardAddress(data.wallet);
          if(data.engine!==ENGINE_VERSION)throw new HttpError(409,'Reload the game to get the current engine.');
          const id=crypto.randomUUID(),started=now();
          db.prepare('INSERT INTO trial_runs(id,session,name,wallet,level,engine,started,expires)VALUES(?,?,?,?,?,?,?,?)').run(id,user.id,name,wallet,course.id,ENGINE_VERSION,started,started+1200000);
          json(res,{id,level:course.id,engine:ENGINE_VERSION,maxTicks:MAX_TICKS,wallet,best:trialBest(wallet,user.id,course.id)});return;
        }
        if(url.pathname==='/api/trials/finish'){
          rate(req,'finishes',60,user.id);
          const saved=db.prepare('SELECT * FROM trial_runs WHERE id=? AND session=?').get(String(data.id||''),user.id);
          if(!saved)throw new HttpError(404,'Speed Trial not found.');
          if(saved.submitted!==null){json(res,trialResult(saved,req,{duplicate:true}));return;}
          if(saved.expires<now())throw new HttpError(410,'This Speed Trial expired. Start a new run.');
          if(saved.engine!==ENGINE_VERSION)throw new HttpError(409,'The course changed; please start a new run.');
          if(!Number.isInteger(data.ticks)||data.ticks>Math.floor((now()-saved.started+2000)/1000*120))throw new HttpError(400,'Run elapsed time is invalid.');
          // Level and identity come from the ticket. Ignore claimed times,
          // boosts, wallet and level in a finish request; replay is authoritative.
          const checked=await checkReplay(0,data.ticks,data.inputs,saved.level);
          if(saved.expires<now())throw new HttpError(410,'This Speed Trial expired. Start a new run.');
          const changed=db.prepare('UPDATE trial_runs SET ticks=?,time_ms=?,boosts=?,submitted=?,inputs=?,ghost=? WHERE id=? AND submitted IS NULL').run(data.ticks,checked.timeMs,checked.boosts,now(),JSON.stringify(data.inputs),JSON.stringify(checked.trajectory),saved.id);
          const record=db.prepare('SELECT * FROM trial_runs WHERE id=?').get(saved.id);
          json(res,trialResult(record,req,{duplicate:changed.changes!==1}));return;
        }
        if(['/api/entry','/api/balance'].includes(url.pathname)){
          const address=rewardAddress(data.wallet);
          json(res,{...holderStatus(address,undefined,user.id),eligible:true,minimumTokens:0,checkedAt:now()});return;
        }
        if(url.pathname==='/api/runs/start'){
          rate(req,'starts',60,user.id);
          if(data.mode&&data.mode!=='holder')throw new HttpError(400,'There is one free play mode. Please reload the game.');
          const mode='holder',name=playerName(data.name);
          if(data.engine!==ENGINE_VERSION)throw new HttpError(409,'Reload the game to get the current engine.');
          // Legacy mode 'holder' stores all free prize entries so existing
          // scores and reward records remain intact. Wallets and holdings are optional.
          const rewardWallet=rewardAddress(data.wallet);
          const round=currentRound(now()),id=crypto.randomUUID(),seed=crypto.randomInt(1,0xffffffff);
          ensureRound(db,round,config);
          // Record starts for weekly progress only, without any play limit.
          // Keep the durable counter and ticket in one transaction.
          db.exec('BEGIN IMMEDIATE');
          try{
            if(rewardWallet){
              db.prepare('INSERT OR IGNORE INTO holder_attempts(wallet,round,used)VALUES(?,?,0)').run(rewardWallet,round);
              db.prepare('UPDATE holder_attempts SET used=used+1 WHERE wallet=? AND round=?').run(rewardWallet,round);
            }
            db.prepare('INSERT INTO runs(id,session,seed,name,wallet,mode,round,started,expires,engine)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,user.id,seed,name,rewardWallet,mode,round,now(),Math.min(now()+1200000,roundWindow(round).end+GRACE_MS),ENGINE_VERSION);
            db.exec('COMMIT');
          }catch(error){db.exec('ROLLBACK');throw error;}
          json(res,{id,seed,mode,round,wallet:rewardWallet,engine:ENGINE_VERSION,maxTicks:MAX_TICKS,...holderStatus(rewardWallet,round,user.id)});return;
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
          // collectible totals and recalculate that start-day's boost in one commit.
          if(saved.expires<now())throw new HttpError(410,'This run expired. Start a new run.');
          db.exec('BEGIN IMMEDIATE');
          try{
            if(db.prepare('SELECT round FROM reward_plans WHERE round=? UNION SELECT round FROM payouts WHERE round=?').get(saved.round,saved.round))throw new HttpError(409,'This round is closed for payout review.');
            const changed=db.prepare('UPDATE runs SET ticks=?,score=?,raw_score=?,distance=?,coins=?,red_tokens=?,rush_pickups=?,reason=?,submitted=?,inputs=? WHERE id=? AND submitted IS NULL').run(data.ticks,checked.score,checked.score,checked.distance,checked.coins,checked.redTokens,checked.rushPickups,checked.reason,now(),JSON.stringify(data.inputs),saved.id);
            if(changed.changes!==1)throw new HttpError(409,'Run already submitted.');
            if(saved.mode==='holder')syncHolderScores(db,saved.wallet,saved.round,saved.session,dayAt(saved.started));
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
      const share=url.pathname.match(/^\/(score|trial-score)\/([0-9a-f-]{36})(\.png)?$/);
      if(share){
        const trial=share[1]==='trial-score',table=trial?'trial_runs':'runs';
        const record=db.prepare(`SELECT * FROM ${table} WHERE id=? AND submitted IS NOT NULL AND disqualified IS NULL`).get(share[2]);
        if(!record)throw new HttpError(404,'Score not found.');
        const course=trial?trialCourse(record.level):null;
        if(share[3]){
          const content=picture({...record,courseName:course?.name},trial);
          res.writeHead(200,{'Content-Type':'image/png','Content-Length':content.length,'Cache-Control':'public, max-age=300'});
          res.end(req.method==='HEAD'?undefined:content);return;
        }
        const origin=shareOrigin(req),link=origin+'/'+share[1]+'/'+record.id,image=link+'.png';
        const title=escapeHtml(trial?`${record.name} · ${(record.time_ms/1000).toFixed(3)}s · ${course.name}`:`${record.name} · ${record.score.toLocaleString()} points · Catoshi Vault Rush`);
        const description=escapeHtml(trial?'Chase this line in Catoshi Vault Rush.':`${record.distance}m in Catoshi Vault Rush. Can you beat it?`);
        const meta=`<head><base href="/"><link rel="canonical" href="${escapeHtml(link)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Catoshi Vault Rush"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${escapeHtml(link)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${title}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${escapeHtml(image)}"><meta name="twitter:image:alt" content="${title}">`;
        html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replace('<head>',meta).replace('<title>Catoshi · Vault Rush</title>',`<title>${title}</title>`);
        // Deep links retain the trial selection when loaded as a playable page.
        if(trial)html=html.replace('<body>',`<body data-trial="${record.level}">`);
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
module.exports={createApp,openDatabase,configFromEnv,ROUND_MS,GRACE_MS,currentRound,roundWindow};
