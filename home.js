(function () {
  'use strict';
  const canvas=document.getElementById('home-catoshi'),ctx=canvas?.getContext('2d');
  if(!ctx)return;
  const menu=document.getElementById('gate'),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  // Measured alpha bounds, not assumed cells. Align all ten token baselines.
  const poses=[[33,75,351,289],[429,72,351,292],[830,78,339,286],[1210,71,354,293],[1604,70,348,294],
    [35,417,350,307],[426,425,354,297],[825,430,344,290],[1215,428,349,294],[1601,430,351,291]];
  const holds=[1400,420,160,440,450,620,400,500,160,650],period=holds.reduce((sum,value)=>sum+value,0);
  const image=new Image();let frame=null,last=0,elapsed=0,painted=-1,fallback=false,ready=false;
  const observed=typeof MutationObserver==='function';
  function draw(time){
    ctx.clearRect(0,0,320,320);
    const t=reduced?.matches?0:time%period;
    let pose=0,cursor=0;
    for(let i=0;i<holds.length;i++){cursor+=holds[i];if(t<cursor){pose=i;break;}}
    if(!ready)return;
    const rect=fallback?(typeof VaultRushRenderer!=='undefined'?VaultRushRenderer.characters[0]:[19,104,340,295]):poses[pose];
    const width=235,height=width*rect[3]/rect[2],bob=reduced?.matches?0:Math.sin(t/period*Math.PI*2)*1.5;
    ctx.fillStyle='rgba(232,161,58,.08)';ctx.beginPath();ctx.ellipse(164,284,88,5,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(164,272+bob);
    ctx.drawImage(image,...rect,-width/2,-height,width,height);ctx.restore();
  }
  function loop(now){
    frame=null;
    if(document.hidden)return;
    const active=menu.classList.contains('active');
    if(!active&&observed)return;
    if(active){
      elapsed+=Math.max(0,Math.min(100,now-last));
      if(now-painted>=32){draw(elapsed);painted=now;}
    }
    last=now;
    if(!reduced?.matches)frame=requestAnimationFrame(loop);
  }
  function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;}
  function start(){
    stop();last=performance.now();painted=-1;draw(elapsed);
    if(!document.hidden&&menu.classList.contains('active')&&!reduced?.matches)frame=requestAnimationFrame(loop);
  }
  image.onload=()=>{ready=true;canvas.hidden=false;start();};
  image.onerror=()=>{if(!fallback){fallback=true;image.src='catoshi-clean-actions.png';}else canvas.hidden=true;};
  image.src='catoshi-home-loop-v1.png?v=home-8';
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(ready)start();});
  reduced?.addEventListener?.('change',()=>{if(ready)start();});
  if(observed)new MutationObserver(()=>{if(menu.classList.contains('active')&&ready)start();else stop();}).observe(menu,{attributes:true,attributeFilter:['class']});
})();
