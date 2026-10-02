'use strict';
const crypto=require('node:crypto');
const {MINT,walletAddress,tokenBalance,rpc,decode58}=require('./security.cjs');
const {DAY_MS,WEEK_ID_OFFSET,roundWindow}=require('./periods.cjs');
const DEFAULT_SPLIT=[30,20,12,10,8,6,5,4,3,2];
const positive=value=>!/^0(?:\.0+)?$/.test(value);
function amount(value,label){
  const text=String(value).trim();
  if(!/^\d{1,20}(?:\.\d{1,18})?$/.test(text))throw Error(label+' must be a non-negative token amount (up to 18 decimal places).');
  return text.replace(/^0+(?=\d)/,'').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
}
function rewardSettings(env){
  const enabled=(env.REWARDS_ENABLED??env.PRIZES_ENABLED)==='true';
  const vault=(env.VAULT_WALLET||'').trim();if(vault)walletAddress(vault);
  const rushMint=(env.RUSH_MINT||'').trim();if(rushMint){walletAddress(rushMint);if(rushMint===MINT)throw Error('RUSH_MINT must be the RUSH token mint, not the CATOSHI mint.');}
  const catoshiPool=amount(env.CATOSHI_WEEKLY_PRIZE_POOL??env.CATOSHI_PRIZE_POOL??env.JACKPOT_TOKENS_PER_ROUND??'100000','CATOSHI_PRIZE_POOL');
  const rushPool=amount(env.RUSH_WEEKLY_PRIZE_POOL??env.RUSH_PRIZE_POOL??'0','RUSH_PRIZE_POOL');
  const splits=env.REWARD_SPLIT?env.REWARD_SPLIT.split(',').map(Number):DEFAULT_SPLIT.slice();
  if(splits.length!==10||splits.some(n=>!Number.isInteger(n)||n<1)||splits.reduce((a,b)=>a+b,0)!==100)throw Error('REWARD_SPLIT needs ten positive integer percentages totaling 100.');
  if(enabled&&!vault)throw Error('Rewards require a vault public wallet in VAULT_WALLET.');
  if(enabled&&!positive(catoshiPool)&&!positive(rushPool))throw Error('Rewards require a positive prize pool.');
  if(enabled&&positive(rushPool)&&!rushMint)throw Error('Set RUSH_MINT before enabling a RUSH prize pool.');
  return {enabled,vault,rushMint,catoshiPool,rushPool,splits,tokens:enabled?catoshiPool:'0',rushTokens:enabled?rushPool:'0'};
}
function ensureRound(db,id,config,roundMs=DAY_MS){
  const settings=config.rewards||{rushMint:'',rushTokens:'0',splits:DEFAULT_SPLIT};
  const window=id>=WEEK_ID_OFFSET?roundWindow(id):{start:id*roundMs,end:(id+1)*roundMs};
  db.prepare('INSERT OR IGNORE INTO rounds(id,start,end,tokens,vault)VALUES(?,?,?,?,?)').run(id,window.start,window.end,config.tokens,config.vault);
  db.prepare('INSERT OR IGNORE INTO round_rewards(round,rush_mint,rush_tokens,splits)VALUES(?,?,?,?)').run(id,settings.rushMint,settings.rushTokens,JSON.stringify(settings.splits));
  let row=db.prepare('SELECT r.*,rr.rush_mint,rr.rush_tokens,rr.splits FROM rounds r JOIN round_rewards rr ON rr.round=r.id WHERE r.id=?').get(id);
  // Turning rewards on upgrades an unfunded round. Announced funded pools
  // remain fixed for that period, and cannot overwrite an existing payout plan.
  const planned=db.prepare('SELECT round FROM reward_plans WHERE round=? UNION SELECT round FROM payouts WHERE round=?').get(id,id);
  if(!planned&&!positive(row.tokens)&&!positive(row.rush_tokens)&&(positive(config.tokens)||positive(settings.rushTokens))){
    db.exec('BEGIN IMMEDIATE');
    try{
      db.prepare('UPDATE rounds SET tokens=?,vault=? WHERE id=?').run(config.tokens,config.vault,id);
      db.prepare('UPDATE round_rewards SET rush_mint=?,rush_tokens=?,splits=? WHERE round=?').run(settings.rushMint,settings.rushTokens,JSON.stringify(settings.splits),id);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    row=db.prepare('SELECT r.*,rr.rush_mint,rr.rush_tokens,rr.splits FROM rounds r JOIN round_rewards rr ON rr.round=r.id WHERE r.id=?').get(id);
  }
  return row;
}
function publicRewards(row,config){
  const enabled=config.rewards?.enabled??positive(config.tokens);
  return {enabled,vault:row.vault,catoshiPool:row.tokens,rushPool:row.rush_tokens,rushMint:row.rush_mint,split:JSON.parse(row.splits),winners:10,round:row.id,period:roundWindow(row.id).period,roundStarts:row.start,roundEnds:row.end,payoutMode:'manual-review',fewerPlayers:'normalize-active-shares'};
}
function toRaw(tokens,decimals){
  const [whole,fraction='']=tokens.split('.');
  if(fraction.length>decimals)throw Error('Prize pool has more precision than the token supports.');
  return BigInt(whole)*10n**BigInt(decimals)+BigInt((fraction||'0').padEnd(decimals,'0'));
}
function fromRaw(raw,decimals){
  const text=String(raw).padStart(decimals+1,'0');
  return decimals?(text.slice(0,-decimals)+'.'+text.slice(-decimals)).replace(/\.?0+$/,''):text;
}
function planSummary(db,round){
  const plan=db.prepare('SELECT * FROM reward_plans WHERE round=?').get(round);
  if(!plan)return null;
  return {...plan,payoutMode:'manual-review',payments:db.prepare('SELECT * FROM reward_payments WHERE round=? ORDER BY rank,symbol').all(round).map(row=>({...row,tokens:fromRaw(row.raw,row.decimals)}))};
}
async function makeTop10Plan(db,roundId,config,dependencies={}){
  const now=(dependencies.now||Date.now)();
  const row=db.prepare('SELECT r.*,rr.rush_mint,rr.rush_tokens,rr.splits FROM rounds r JOIN round_rewards rr ON rr.round=r.id WHERE r.id=?').get(roundId);
  if(!row)throw Error('No top-10 reward settings were saved for this round.');
  if(now<row.end+660000)throw Error('Wait until the round closes and its 11-minute submission window ends.');
  if(!row.vault||(!positive(row.tokens)&&!positive(row.rush_tokens)))throw Error('This round had no funded prize budget configured.');
  if(db.prepare('SELECT round FROM payouts WHERE round=?').get(roundId))throw Error('A legacy payout plan already exists for this round; do not pay it twice.');
  const prior=planSummary(db,roundId);if(prior)return prior;
  const winners=db.prepare(`SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY wallet ORDER BY score DESC,submitted ASC,id ASC) position FROM runs WHERE mode='holder' AND round=? AND submitted IS NOT NULL AND disqualified IS NULL AND wallet IS NOT NULL) WHERE position=1 ORDER BY score DESC,submitted ASC,id ASC LIMIT 10`).all(roundId);
  if(!winners.length)throw Error('No eligible prize runs in this round.');
  if(winners.some(w=>w.wallet===row.vault))throw Error('A winning address is the vault. Review and disqualify that entry before preparing payments.');
  const getBalance=dependencies.balance||((wallet,mint)=>tokenBalance(wallet,[config.rpc,config.rpcFallback].filter(Boolean),undefined,mint));
  const assets=[...(positive(row.tokens)?[{symbol:'CATOSHI',mint:MINT,tokens:row.tokens}]:[]),...(positive(row.rush_tokens)?[{symbol:'RUSH',mint:row.rush_mint,tokens:row.rush_tokens}]:[])];
  const weights=JSON.parse(row.splits).slice(0,winners.length),total=weights.reduce((a,b)=>a+b,0);
  const payments=[],checks=[];
  function reservationState(mint){
    return JSON.stringify({modern:db.prepare('SELECT id,raw,status,signature FROM reward_payments WHERE vault=? AND mint=? ORDER BY id').all(row.vault,mint),legacy:mint===MINT?db.prepare('SELECT round,raw,status,signature FROM payouts WHERE vault=? ORDER BY round').all(row.vault):[]});
  }
  for(const asset of assets){
    const state=reservationState(asset.mint);
    const treasury=await getBalance(row.vault,asset.mint),budget=toRaw(asset.tokens,treasury.decimals);
    let reserved=db.prepare("SELECT raw FROM reward_payments WHERE vault=? AND mint=? AND status='review'").all(row.vault,asset.mint).reduce((sum,p)=>sum+BigInt(p.raw),0n);
    if(asset.mint===MINT)reserved+=db.prepare("SELECT raw FROM payouts WHERE vault=? AND status='review'").all(row.vault).reduce((sum,p)=>sum+BigInt(p.raw),0n);
    if(treasury.raw<budget+reserved)throw Error('Vault has insufficient unreserved '+asset.symbol+'. No payout plan created.');
    if(budget*BigInt(Math.min(...weights))<BigInt(total))throw Error(asset.symbol+' pool is too small to give each winner at least one native token unit.');
    checks.push({mint:asset.mint,state});
    const amounts=weights.map(weight=>budget*BigInt(weight)/BigInt(total));
    let remainder=budget-amounts.reduce((a,b)=>a+b,0n);
    for(let i=0;remainder>0n;i++,remainder--)amounts[i%amounts.length]++;
    winners.forEach((winner,i)=>{if(amounts[i]>0n)payments.push({id:crypto.randomUUID(),rank:i+1,run_id:winner.id,wallet:winner.wallet,vault:row.vault,mint:asset.mint,symbol:asset.symbol,raw:amounts[i].toString(),decimals:treasury.decimals});});
  }
  db.exec('BEGIN IMMEDIATE');
  try{
    // Re-check reservations after network reads to prevent concurrent plans
    // from reserving the same vault funds twice.
    if(planSummary(db,roundId)){db.exec('ROLLBACK');return planSummary(db,roundId);}
    for(const check of checks)if(reservationState(check.mint)!==check.state)throw Error('Another payout changed the vault reservations. Retry the payout plan.');
    if(winners.some(w=>!db.prepare('SELECT id FROM runs WHERE id=? AND disqualified IS NULL').get(w.id)))throw Error('A winning run changed during review; retry the plan.');
    db.prepare('INSERT INTO reward_plans VALUES(?,?,?)').run(roundId,row.vault,now);
    const insert=db.prepare("INSERT INTO reward_payments(id,round,rank,run_id,wallet,vault,mint,symbol,raw,decimals,status,created)VALUES(?,?,?,?,?,?,?,?,?,?,'review',?)");
    for(const payment of payments)insert.run(payment.id,roundId,payment.rank,payment.run_id,payment.wallet,payment.vault,payment.mint,payment.symbol,payment.raw,payment.decimals,now);
    db.exec('COMMIT');
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
  return planSummary(db,roundId);
}
function ownerBalance(entries,owner,mint){return (entries||[]).filter(entry=>entry.mint===mint&&entry.owner===owner).reduce((sum,entry)=>sum+BigInt(entry.uiTokenAmount.amount),0n);}
async function recordTop10Payment(db,roundId,symbol,signature,config,dependencies={}){
  symbol=String(symbol||'').toUpperCase();
  if(!['CATOSHI','RUSH'].includes(symbol))throw Error('Choose CATOSHI or RUSH.');
  if(decode58(signature).length!==64)throw Error('Invalid Solana transaction signature.');
  const recorded=db.prepare('SELECT round,mint FROM reward_transactions WHERE signature=?').all(signature);
  if(recorded.some(row=>row.round!==roundId)||db.prepare('SELECT signature FROM payouts WHERE signature=?').get(signature))throw Error('This transaction has already been recorded for another payout.');
  const pending=db.prepare("SELECT * FROM reward_payments WHERE round=? AND symbol=? AND status='review' ORDER BY rank").all(roundId,symbol);
  if(!pending.length)throw Error('No pending '+symbol+' payments for this round.');
  if(recorded.some(row=>row.mint===pending[0].mint))throw Error('This transaction has already been recorded for this token.');
  if(pending.some(p=>!db.prepare('SELECT id FROM runs WHERE id=? AND disqualified IS NULL').get(p.run_id)))throw Error('A planned run was disqualified; do not settle this plan.');
  const fetchTransaction=dependencies.transaction||((sig)=>rpc([config.rpc,config.rpcFallback].filter(Boolean),'getTransaction',[sig,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:0}]));
  const tx=await fetchTransaction(signature);
  if(!tx||!tx.meta||tx.meta.err!==null||!Number.isFinite(tx.blockTime)||tx.blockTime*1000<Math.min(...pending.map(p=>p.created))-60000)throw Error('Payment is not a recent finalized successful transaction.');
  const matching=pending.filter(p=>ownerBalance(tx.meta.postTokenBalances,p.wallet,p.mint)-ownerBalance(tx.meta.preTokenBalances,p.wallet,p.mint)>=BigInt(p.raw));
  if(!matching.length)throw Error('No expected '+symbol+' credit was found in this transaction.');
  const required=matching.reduce((sum,p)=>sum+BigInt(p.raw),0n);
  const debit=ownerBalance(tx.meta.preTokenBalances,pending[0].vault,pending[0].mint)-ownerBalance(tx.meta.postTokenBalances,pending[0].vault,pending[0].mint);
  if(debit<required)throw Error('The vault did not fund the expected '+symbol+' transfers.');
  db.exec('BEGIN IMMEDIATE');
  try{
    const current=db.prepare('SELECT round,mint FROM reward_transactions WHERE signature=?').all(signature);
    if(current.some(row=>row.round!==roundId||row.mint===pending[0].mint)||db.prepare('SELECT signature FROM payouts WHERE signature=?').get(signature))throw Error('This transaction has already been recorded for another payout.');
    if(matching.some(p=>db.prepare('SELECT status FROM reward_payments WHERE id=?').get(p.id)?.status!=='review'))throw Error('A payment was already settled. Reload the payout plan.');
    db.prepare('INSERT INTO reward_transactions VALUES(?,?,?,?)').run(signature,roundId,pending[0].mint,(dependencies.now||Date.now)());
    const update=db.prepare("UPDATE reward_payments SET status='paid',signature=?,paid=? WHERE id=? AND status='review'");
    for(const p of matching)update.run(signature,(dependencies.now||Date.now)(),p.id);
    db.exec('COMMIT');
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
  return planSummary(db,roundId);
}
module.exports={DEFAULT_SPLIT,rewardSettings,ensureRound,publicRewards,toRaw,fromRaw,makeTop10Plan,recordTop10Payment,planSummary};
