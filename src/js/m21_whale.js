/* ================= the White Whale =================
   whaleArt(frame) -> 92x40 side view facing left; frames 0..3 swing the flukes.
   flukeArt(frame) -> 40x30 tail flukes raised for a dive (0 high, 1 lower). */
const WHALE={body:'#f1efe8',scar:'#c9ccd4',eye:'#2a2430',mouth:'#9aa0b0'};
function whalePN(f){const N=PN(92,40);const W=WHALE.body;const R=ramp5(W).map((c,i)=>i>2?mix(c,'#7a8aa8',.25*(i-2)):c);
  const fl=[-7,-3,4,-1][f&3];
  // the flukes, swinging up and down
  N.poly([[76,19],[90,15+fl],[91,18+fl],[84,21],[91,24+fl*.6],[89,27+fl*.6],[76,22]],(x,y)=>rampPick(R,-.1-(y-18)*.05),0);
  // the body: a blunt box of a head tapering to the tail stock
  const top=x=>x<6?14-Math.sqrt(Math.max(0,36-(x-6)*(x-6)))*1.3:x<46?6+((x-6)/40)*-1:x<54?5:5+((x-54)/24)*11;
  const bot=x=>x<6?24+Math.sqrt(Math.max(0,36-(x-6)*(x-6)))*.6:x<30?30+(x-6)*.08:x<56?32-(x-30)*.02:31-((x-56)/22)*9;
  for(let x=1;x<79;x++){const y0=Math.round(top(x)),y1=Math.round(bot(x));for(let y=y0;y<y1;y++){const ny=(y-y0)/Math.max(1,y1-y0);const lit=.75-ny*1.55-(x>60?.1:0);N.px(x,y,rampPick(R,lit),1)}}
  // the hump and knuckles along the back
  for(const[kx,kh]of[[54,3],[61,2],[66,2],[70,1]])for(let i=-2;i<=2;i++)for(let j=0;j<kh-Math.abs(i)*.6;j++)N.px(kx+i,Math.round(top(kx+i))-j-1,R[1],2);
  // wrinkles and old scars
  for(let x=40;x<74;x+=3){const y=Math.round(top(x))+4+((x*7)%5);N.px(x,y,WHALE.scar,3);N.px(x+1,y+1,WHALE.scar,3)}
  for(const[sx,sy,l]of[[14,12,6],[22,16,5],[30,11,7],[48,14,4]])for(let i=0;i<l;i++)N.px(sx+i,sy+Math.round(i*.35),WHALE.scar,3);
  // the long narrow lower jaw and mouth line
  for(let x=4;x<34;x++)N.px(x,Math.round(26+(x-4)*.08),WHALE.mouth,3);
  for(let x=6;x<30;x++)N.px(x,Math.round(27.5+(x-4)*.1),rampPick(R,-.4),3);
  // eye and flipper
  N.px(35,21,WHALE.eye,4);N.px(36,21,WHALE.eye,4);N.px(35,20,'#ffffff',4);
  N.poly([[40,27],[44,27],[51,36],[47,36]],(x,y)=>rampPick(R,-.3-(y-27)*.05),4);
  N.outline('#3a4258');return N}
const whaleCache=[];
function whaleArt(f=0){f&=3;return whaleCache[f]||(whaleCache[f]=whalePN(f).canvas())}
function flukePN(f){const N=PN(40,30);const R=ramp5(WHALE.body).map((c,i)=>i>2?mix(c,'#7a8aa8',.25*(i-2)):c);const lift=f?5:0;
  N.poly([[17,30],[23,30],[22,14+lift],[18,14+lift]],(x,y)=>rampPick(R,.2-(x-17)*.12),0);
  N.poly([[20,15+lift],[3,4+lift],[1,8+lift],[8,12+lift],[19,18+lift]],(x,y)=>rampPick(R,.5-(y-lift)*.06),1);
  N.poly([[20,15+lift],[37,4+lift],[39,8+lift],[32,12+lift],[21,18+lift]],(x,y)=>rampPick(R,-.1-(y-lift)*.06),1);
  N.px(20,16+lift,'#c9ccd4',2);
  N.outline('#3a4258');return N}
const flukeCache=[];
function flukeArt(f=0){return flukeCache[f]||(flukeCache[f]=flukePN(f).canvas())}
