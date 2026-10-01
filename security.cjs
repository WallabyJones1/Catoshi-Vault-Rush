'use strict';
const crypto = require('node:crypto');
const { Run } = require('./engine.js');
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MINT = 'HrZh7koZFedTSHng4bVmhULwejpmVdSKUYxaf2N5im1b';
const ENGINE_VERSION = 'flow-web-4';
const MAX_TICKS = 120 * 600;
const MAX_INPUTS = 3000;
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
function decode58(value) {
  if (typeof value !== 'string' || value.length > 100 || !value.length) throw new HttpError(400,'Invalid base58 value.');
  let n=0n;
  for(const char of value){const digit=ALPHABET.indexOf(char);if(digit<0)throw new HttpError(400,'Invalid base58 value.');n=n*58n+BigInt(digit);}
  let hex=n.toString(16);if(hex.length%2)hex='0'+hex;
  const data=n===0n?Buffer.alloc(0):Buffer.from(hex,'hex');
  let zeroes=0;while(value[zeroes]==='1')zeroes++;
  return Buffer.concat([Buffer.alloc(zeroes),data]);
}
function walletAddress(value) {
  if(typeof value!=='string')throw new HttpError(400,'Enter a valid Solana wallet address.');
  const address=value.trim();
  try{if(decode58(address).length!==32)throw Error();}catch{throw new HttpError(400,'Enter a valid Solana wallet address.');}
  return address;
}
function playerName(value) {
  const name=String(value||'Runner').normalize('NFKC').trim().replace(/\s+/g,' ');
  if(!/^[\p{L}\p{N} ._-]{2,20}$/u.test(name))throw new HttpError(400,'Use a 2–20 character name: letters, numbers, spaces, dot, dash or underscore.');
  return name;
}
function verifyMessage(address,message,signature) {
  walletAddress(address);
  if(typeof signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(signature))return false;
  const bytes=Buffer.from(signature,'base64');if(bytes.length!==64)return false;
  const key=crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),decode58(address)]),format:'der',type:'spki'});
  return crypto.verify(null,Buffer.from(message,'utf8'),key,bytes);
}
function hash(token){return crypto.createHash('sha256').update(token).digest('hex');}
function replay(seed,ticks,inputs) {
  if(!Number.isInteger(ticks)||ticks<1||ticks>MAX_TICKS||!Array.isArray(inputs)||inputs.length>MAX_INPUTS)throw new HttpError(400,'Invalid run recording.');
  let previous=-1,held=false;
  for(const input of inputs){
    if(!Array.isArray(input)||input.length!==2||!Number.isInteger(input[0])||input[0]<previous||input[0]<0||input[0]>=ticks||![0,1].includes(input[1]))throw new HttpError(400,'Invalid input sequence.');
    if(Boolean(input[1])===held)throw new HttpError(400,'Repeated input state.');
    held=Boolean(input[1]);previous=input[0];
  }
  const run=new Run(seed);let cursor=0;
  for(let tick=0;tick<ticks;tick++){
    if(run.dead)throw new HttpError(400,'Recording continues after the run ended.');
    while(cursor<inputs.length&&inputs[cursor][0]===tick){inputs[cursor++][1]?run.press():run.release();}
    run.step(1/120);run.drainEvents();
  }
  if(ticks===MAX_TICKS&&!run.dead)run.crash('TIME LIMIT');
  if(!run.dead)throw new HttpError(400,'Only completed runs can enter the leaderboard.');
  return {score:Math.floor(run.score),distance:Math.floor(run.player.x/10),coins:run.coins,reason:run.reason};
}
const TOKEN_PROGRAMS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
function rpcEndpoints(url){return [...new Set((Array.isArray(url)?url:[url]).filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()))];}
async function rpcOne(endpoint,method,params,fetcher,deadline) {
  const remaining=deadline-Date.now();if(remaining<=0)throw Error('RPC timeout');
  const response=await fetcher(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(Math.min(3500,remaining))});
  if(!response.ok)throw Error('RPC HTTP failure');
  const data=await response.json();
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid RPC response');
  if(data.error){const error=Error('RPC rejected query');error.remote=true;throw error;}
  if(!Object.hasOwn(data,'result'))throw Error('Invalid RPC response');
  return data.result;
}
function balanceUnavailable(){return new HttpError(503,'Token balance check is temporarily unavailable. Please retry shortly; practice is available without a wallet.');}
async function rpc(url,method,params,fetcher=fetch) {
  const endpoints=rpcEndpoints(url),deadline=Date.now()+Math.max(3500,endpoints.length*3500);
  for(const endpoint of endpoints)try{return await rpcOne(endpoint,method,params,fetcher,deadline);}catch{}
  throw balanceUnavailable();
}
function parseBalance(result,address,mint,programScan=false,program=null,mintDecimals=null) {
  if(!Array.isArray(result?.value))throw new HttpError(503,'Invalid token balance response.');
  let raw=0n,decimals=mintDecimals;const seen=new Set();
  for(const entry of result.value){
    const info=entry.account?.data?.parsed?.info;
    if(programScan&&info?.mint!==mint){if(!info||info.owner!==address)throw new HttpError(503,'Invalid token balance response.');continue;}
    const amount=info?.tokenAmount;
    if(!amount||info.mint!==mint||info.owner!==address||typeof amount.amount!=='string'||!/^\d{1,20}$/.test(amount.amount)||!Number.isInteger(amount.decimals)||amount.decimals<0||amount.decimals>18||BigInt(amount.amount)>18446744073709551615n)throw new HttpError(503,'Invalid token balance response.');
    if(entry.account.owner&&(!TOKEN_PROGRAMS.has(entry.account.owner)||(program&&entry.account.owner!==program)))throw new HttpError(503,'Invalid token balance response.');
    if(entry.pubkey){if(seen.has(entry.pubkey))throw new HttpError(503,'Invalid token balance response.');seen.add(entry.pubkey);}
    if(decimals!==null&&decimals!==amount.decimals)throw new HttpError(503,'Inconsistent token balance.');
    decimals=amount.decimals;raw+=BigInt(amount.amount);
  }
  const unit=10n**BigInt(decimals||0);
  return {raw,decimals:decimals||0,whole:(raw/unit).toString(),eligible:raw>=50000n*unit};
}
async function tokenBalance(address,url,fetcher=fetch,mint=MINT) {
  address=walletAddress(address);mint=walletAddress(mint);
  const deadline=Date.now()+10500,settings={encoding:'jsonParsed',commitment:'confirmed'};
  let invalid=null;
  for(const endpoint of rpcEndpoints(url)){
    try{
      let result;
      try{result=await rpcOne(endpoint,'getTokenAccountsByOwner',[address,{mint},settings],fetcher,deadline);}
      catch(error){
        if(!error.remote)throw error;
        // Some providers disable the mint index. Read the mint's real token
        // program, query by owner/program and filter the requested mint locally.
        const account=await rpcOne(endpoint,'getAccountInfo',[mint,settings],fetcher,deadline);
        const program=account?.value?.owner,info=account?.value?.data?.parsed;
        if(!TOKEN_PROGRAMS.has(program)||info?.type!=='mint'||!Number.isInteger(info.info?.decimals)||info.info.decimals<0||info.info.decimals>18)throw Error('Invalid mint response');
        result=await rpcOne(endpoint,'getTokenAccountsByOwner',[address,{programId:program},settings],fetcher,deadline);
        return parseBalance(result,address,mint,true,program,info.info.decimals);
      }
      // Validation belongs inside failover: a malformed first provider must
      // not prevent a healthy second provider from checking real holdings.
      return parseBalance(result,address,mint);
    }catch(error){if(error instanceof HttpError)invalid=error;}
  }
  if(invalid)throw invalid;
  throw balanceUnavailable();
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
module.exports={HttpError,MINT,ENGINE_VERSION,MAX_TICKS,MAX_INPUTS,decode58,walletAddress,playerName,verifyMessage,hash,replay,rpc,tokenBalance,escapeHtml};
