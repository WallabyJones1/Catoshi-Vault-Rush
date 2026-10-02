'use strict';
const {DAY_MS,WEEK_ID_OFFSET,dayAt}=require('./periods.cjs');
const TARGET=10,MAX_PER_RUN=5;
const RUN_FIELDS='id,name,wallet,mode,round,started,score,raw_score,distance,coins,red_tokens,rush_pickups,submitted';
function playerFilter(wallet,session){
  if(wallet)return {where:'wallet=?',value:wallet};
  if(typeof session!=='string'||!session)throw Error('A browser session is required for wallet-free progress.');
  return {where:'wallet IS NULL AND session=?',value:session};
}
function questScope(round,day=dayAt(Date.now())){
  // Legacy daily rounds retain their original boost and archive semantics.
  return round>=WEEK_ID_OFFSET?{where:' AND started>=? AND started<?',args:[day*DAY_MS,(day+1)*DAY_MS],day}: {where:'',args:[],day:round};
}
function dailyQuest(db,wallet,round,session,day){
  const owner=playerFilter(wallet,session),scope=questScope(round,day);
  const collected=db.prepare(`SELECT COALESCE(SUM(red_tokens),0) total FROM runs WHERE ${owner.where} AND round=?${scope.where} AND mode='holder' AND submitted IS NOT NULL AND disqualified IS NULL`).get(owner.value,round,...scope.args).total;
  return {day:scope.day,collected,target:TARGET,remaining:Math.max(0,TARGET-collected),maxPerRun:MAX_PER_RUN,unlocked:collected>=TARGET,resetsAt:(scope.day+1)*DAY_MS};
}
// Called inside the finishing/disqualification transaction. Derive every
// score from its immutable replay score; the multiplier can never stack.
function syncHolderScores(db,wallet,round,session,day){
  const owner=playerFilter(wallet,session),scope=questScope(round,day),quest=dailyQuest(db,wallet,round,session,day);
  db.prepare(`UPDATE runs SET score=raw_score WHERE ${owner.where} AND round=?${scope.where} AND mode='holder' AND submitted IS NOT NULL`).run(owner.value,round,...scope.args);
  const best=db.prepare(`SELECT id,raw_score FROM runs WHERE ${owner.where} AND round=?${scope.where} AND mode='holder' AND submitted IS NOT NULL AND disqualified IS NULL ORDER BY raw_score DESC,submitted ASC,id ASC LIMIT 1`).get(owner.value,round,...scope.args);
  if(quest.unlocked&&best)db.prepare('UPDATE runs SET score=raw_score*2 WHERE id=?').run(best.id);
  return quest;
}
function publicRun(run){
  return {id:run.id,name:run.name,wallet:run.wallet?run.wallet.slice(0,4)+'…'+run.wallet.slice(-4):null,mode:run.mode,score:run.score,rawScore:run.raw_score??run.score,pointsMultiplier:run.raw_score>0&&run.score===run.raw_score*2?2:1,distance:run.distance,coins:run.coins,redTokens:run.red_tokens||0,rushPickups:run.rush_pickups||0,submitted:run.submitted,started:run.started,questDay:Number.isFinite(run.started)?dayAt(run.started):undefined,round:run.round};
}
module.exports={dailyQuest,syncHolderScores,publicRun,playerFilter,RUN_FIELDS,TARGET,MAX_PER_RUN};
