(function () {
  'use strict';
  const canvas=document.getElementById('home-catoshi'),ctx=canvas?.getContext('2d');
  if(!ctx||typeof VaultRushRenderer==='undefined')return;
  const menu=document.getElementById('gate'),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const image=new Image();let frame=null,last=0;
  function draw(time){
    ctx.clearRect(0,0,320,320);
    const t=reduced?.matches?0:(time/1000)%9;
    let pose=0,y=272+Math.sin(t*2)*3,angle=Math.sin(t*1.5)*.018,scaleY=1;
    // Rest, lean, lift off, tucked backflip, release, then cushioned landing.
    if(t>2.2&&t<3.3)pose=3;
    if(t>=3.3&&t<6.1){
      const air=(t-3.3)/2.8;y=272-Math.sin(air*Math.PI)*44;
      pose=air<.18?4:air<.73?2:5;
      if(air>.15&&air<.78)angle=-Math.PI*2*((air-.15)/.63);
    }else if(t>=6.1&&t<6.55){pose=6;scaleY=.91+((t-6.1)/.45)*.09;}
    else if(t>=6.55&&t<8.0)pose=1;
    const rect=VaultRushRenderer.characters[pose],width=235,height=width*rect[3]/rect[2];
    ctx.fillStyle='rgba(232,161,58,.09)';ctx.beginPath();ctx.ellipse(165,284,92-(272-y)*.18,6,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(164,y-height*.48);ctx.rotate(angle);ctx.scale(1,scaleY);
    ctx.drawImage(image,...rect,-width/2,-height*.52,width,height);ctx.restore();
  }
  function loop(now){
    frame=null;
    if(document.hidden)return;
    if(menu.classList.contains('active')&&now-last>32){draw(now);last=now;}
    if(!reduced?.matches)frame=requestAnimationFrame(loop);
  }
  function start(){if(frame)cancelAnimationFrame(frame);draw(performance.now());if(!document.hidden&&!reduced?.matches)frame=requestAnimationFrame(loop);}
  image.onload=start;image.onerror=()=>{canvas.hidden=true;};image.src='catoshi-clean-actions.png';
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=null;}else if(image.complete)start();});
  reduced?.addEventListener?.('change',()=>{if(image.complete)start();});
})();
