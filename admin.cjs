'use strict';
// Operator-only CLI. There is deliberately no public payout or admin HTTP endpoint.
const {openDatabase,configFromEnv,GRACE_MS}=require('./server.cjs');
const {MINT,decode58,tokenBalance,rpc}=require('./security.cjs');
const {makeTop10Plan,recordTop10Payment}=require('./rewards.cjs');
const {syncHolderScores}=require('./quest.cjs');
async function makePlan(db,roundId,config,dependencies={}) {
  const now=(dependencies.now||Date.now)(),balance=dependencies.balance||((wallet)=>tokenBalance(wallet,[config.rpc,config.rpcFallback].filter(Boolean)));
  const round=db.prepare('SELECT * FROM rounds WHERE id=?').get(roundId);
  if(!round)throw Error('Round not found.');
  if(now<round.end+GRACE_MS)throw Error('Wait until the round closes and its 11-minute submission window ends.');
  if(!round.vault||BigInt(round.tokens)===0n)throw Error('This round had no funded prize budget configured.');
  const prior=db.prepare('SELECT * FROM payouts WHERE round=?').get(roundId);
  if(prior)return prior;
  if(db.prepare('SELECT round FROM reward_plans WHERE round=?').get(roundId))throw Error('A top-10 plan already exists for this round.');
  const winner=db.prepare("SELECT * FROM runs WHERE round=? AND mode='holder' AND submitted IS NOT NULL AND disqualified IS NULL ORDER BY score DESC,submitted ASC,id ASC LIMIT 1").get(roundId);
  if(!winner)throw Error('No eligible prize run in this round.');
  if(winner.wallet===round.vault)throw Error('Winner and vault cannot be the same wallet. Review the round manually.');
  const treasury=await balance(round.vault),raw=BigInt(round.tokens)*10n**BigInt(treasury.decimals);
  const reserved=[...db.prepare("SELECT raw FROM payouts WHERE vault=? AND status='review'").all(round.vault),...db.prepare("SELECT raw FROM reward_payments WHERE vault=? AND mint=? AND status='review'").all(round.vault,MINT)].reduce((sum,plan)=>sum+BigInt(plan.raw),0n);
  if(treasury.raw<raw+reserved)throw Error('Vault has insufficient unreserved CATOSHI. No payout plan created.');
  db.prepare("INSERT INTO payouts(round,run_id,wallet,vault,raw,decimals,status,created)VALUES(?,?,?,?,?,?,'review',?)").run(roundId,winner.id,winner.wallet,round.vault,raw.toString(),treasury.decimals,now);
  return db.prepare('SELECT * FROM payouts WHERE round=?').get(roundId);
}
function ownerBalance(entries,owner) {
  return (entries||[]).filter(entry=>entry.mint===MINT&&entry.owner===owner).reduce((sum,entry)=>sum+BigInt(entry.uiTokenAmount.amount),0n);
}
async function recordPayment(db,roundId,signature,config,dependencies={}) {
  if(decode58(signature).length!==64)throw Error('Invalid Solana transaction signature.');
  const plan=db.prepare('SELECT * FROM payouts WHERE round=?').get(roundId);
  if(!plan||plan.status!=='review')throw Error('Create and review a payout plan before recording a payment.');
  if(db.prepare('SELECT round FROM payouts WHERE signature=? UNION SELECT round FROM reward_transactions WHERE signature=?').get(signature,signature))throw Error('This transaction has already been recorded.');
  const winner=db.prepare('SELECT * FROM runs WHERE id=? AND disqualified IS NULL').get(plan.run_id);
  if(!winner)throw Error('The selected run was disqualified. Do not settle this plan.');
  const fetchTransaction=dependencies.transaction||((sig)=>rpc([config.rpc,config.rpcFallback].filter(Boolean),'getTransaction',[sig,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:0}]));
  const tx=await fetchTransaction(signature);
  if(!tx||!tx.meta||tx.meta.err!==null||!Number.isFinite(tx.blockTime)||tx.blockTime*1000<plan.created-60000)throw Error('Payment is not a recent finalized successful transaction.');
  const debit=ownerBalance(tx.meta.preTokenBalances,plan.vault)-ownerBalance(tx.meta.postTokenBalances,plan.vault);
  const credit=ownerBalance(tx.meta.postTokenBalances,plan.wallet)-ownerBalance(tx.meta.preTokenBalances,plan.wallet);
  if(debit<BigInt(plan.raw)||credit<BigInt(plan.raw))throw Error('Transaction did not transfer the expected CATOSHI from this vault to this winner.');
  db.prepare("UPDATE payouts SET status='paid',signature=?,paid=? WHERE round=? AND status='review'").run(signature,(dependencies.now||Date.now)(),roundId);
  return db.prepare('SELECT * FROM payouts WHERE round=?').get(roundId);
}
function disqualify(db,id,reason){
  if(!reason||reason.length<5||reason.length>300)throw Error('Supply a 5–300 character review reason.');
  const run=db.prepare('SELECT wallet,session,mode,round FROM runs WHERE id=? AND submitted IS NOT NULL').get(id);
  if(!run)throw Error('Completed run not found.');
  if(db.prepare('SELECT round FROM payouts WHERE round=? UNION SELECT round FROM reward_plans WHERE round=?').get(run.round,run.round))throw Error('A payout plan already freezes this day; review that plan before changing eligibility.');
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare('UPDATE runs SET disqualified=? WHERE id=?').run(reason,id);
    if(run.mode==='holder')syncHolderScores(db,run.wallet,run.round,run.session);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
async function main(){
  const [command,id,...rest]=process.argv.slice(2);
  if(!['rounds','payout-plan','record-payment','disqualify'].includes(command)){
    console.log('Usage: node admin.cjs rounds | payout-plan ROUND | record-payment ROUND TOKEN SIGNATURE | disqualify RUN_ID "REASON"');return;
  }
  const config=configFromEnv(),db=openDatabase(config.database);
  try{
    if(command==='rounds'){console.log(JSON.stringify(db.prepare('SELECT r.*,rr.rush_mint,rr.rush_tokens,rr.splits FROM rounds r LEFT JOIN round_rewards rr ON rr.round=r.id ORDER BY r.id DESC LIMIT 24').all(),null,2));return;}
    if(command==='disqualify'){disqualify(db,id,rest.join(' '));console.log('Run disqualified.');return;}
    if(!/^\d+$/.test(id||''))throw Error('Supply an integer round ID.');
    const top10=db.prepare('SELECT round FROM round_rewards WHERE round=?').get(Number(id))&&!db.prepare('SELECT round FROM payouts WHERE round=?').get(Number(id));
    const plan=command==='payout-plan'
      ?await (top10?makeTop10Plan:makePlan)(db,Number(id),config)
      :top10?await recordTop10Payment(db,Number(id),rest[0],rest[1],config):await recordPayment(db,Number(id),rest[0],config);
    console.log(JSON.stringify({mint:MINT,...plan,notice:'This application never signs or sends token transfers. Review the recipients and sign approved payments in your team wallet.'},null,2));
  }finally{db.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={makePlan,recordPayment,disqualify};
