'use strict';
const DAY_MS=86400000,TARGET=10,MAX_PER_RUN=5;
const RUN_FIELDS='id,name,wallet,mode,round,score,raw_score,distance,coins,red_tokens,rush_pickups,submitted';
function dailyQuest(db,wallet,round){
  const collected=db.prepare("SELECT COALESCE(SUM(red_tokens),0) total FROM runs WHERE wallet=? AND round=? AND mode='holder' AND submitted IS NOT NULL AND disqualified IS NULL").get(wallet,round).total;
  return {collected,target:TARGET,remaining:Math.max(0,TARGET-collected),maxPerRun:MAX_PER_RUN,unlocked:collected>=TARGET,resetsAt:(round+1)*DAY_MS};
}
// Called inside the finishing/disqualification transaction. Derive every
// score from its immutable replay score; the multiplier can never stack.
function syncHolderScores(db,wallet,round){
  const quest=dailyQuest(db,wallet,round);
  db.prepare("UPDATE runs SET score=raw_score WHERE wallet=? AND round=? AND mode='holder' AND submitted IS NOT NULL").run(wallet,round);
  const best=db.prepare("SELECT id,raw_score FROM runs WHERE wallet=? AND round=? AND mode='holder' AND submitted IS NOT NULL AND disqualified IS NULL ORDER BY raw_score DESC,submitted ASC,id ASC LIMIT 1").get(wallet,round);
  if(quest.unlocked&&best)db.prepare('UPDATE runs SET score=raw_score*2 WHERE id=?').run(best.id);
  return quest;
}
function publicRun(run){
  return {id:run.id,name:run.name,wallet:run.wallet?run.wallet.slice(0,4)+'…'+run.wallet.slice(-4):null,mode:run.mode,score:run.score,rawScore:run.raw_score??run.score,pointsMultiplier:run.raw_score>0&&run.score===run.raw_score*2?2:1,distance:run.distance,coins:run.coins,redTokens:run.red_tokens||0,rushPickups:run.rush_pickups||0,submitted:run.submitted,round:run.round};
}
module.exports={dailyQuest,syncHolderScores,publicRun,RUN_FIELDS,TARGET,MAX_PER_RUN};
