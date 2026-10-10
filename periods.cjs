'use strict';
const DAY_MS=86400000,ROUND_MS=7*DAY_MS;
const WEEK_EPOCH=Date.UTC(1970,0,1,6),WEEK_ID_OFFSET=1000000000;
const dayAt=time=>Math.floor(time/DAY_MS);
// A separate ID range keeps historical daily prizes and payment evidence intact.
const currentRound=time=>WEEK_ID_OFFSET+Math.floor((time-WEEK_EPOCH)/ROUND_MS);
function roundWindow(id){
  const weekly=id>=WEEK_ID_OFFSET;
  const start=weekly?WEEK_EPOCH+(id-WEEK_ID_OFFSET)*ROUND_MS:id*DAY_MS;
  return {start,end:start+(weekly?ROUND_MS:DAY_MS),period:weekly?'weekly':'daily'};
}
module.exports={DAY_MS,ROUND_MS,WEEK_ID_OFFSET,currentRound,roundWindow,dayAt};
