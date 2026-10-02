(function () {
  'use strict';
  const hero=document.getElementById('home-catoshi');
  if(!hero)return;
  const files=['catoshi-home-v2.gif','catoshi-home-v2.webp','catoshi-home-still-v2.png'];
  const revision='guest-home-3';
  function fallbackImage(){
    const source=(hero.getAttribute('src')||'').split('?')[0];
    const index=files.indexOf(source);
    if(index>=0&&index<files.length-1)hero.src=files[index+1]+'?v='+revision;
  }
  hero.addEventListener('error',fallbackImage);
  if(hero.complete&&hero.naturalWidth===0)fallbackImage();

  // Render the ten approved poses ourselves: the loop also works on iPhones
  // which display GIF/WebP media as a still image. GIF remains the no-JS fallback.
  const canvas=document.getElementById('home-catoshi-animation');
  const wrapper=document.getElementById('home-mascot');
  const gate=document.getElementById('gate');
  let ctx;
  try{ctx=canvas?.getContext('2d');}catch{}
  if(!ctx||!wrapper||typeof Image==='undefined'||typeof requestAnimationFrame!=='function')return;
  const poses=[[33,75,351,289],[429,72,351,292],[830,78,339,286],[1210,71,354,293],[1604,70,348,294],
    [35,417,350,307],[426,425,354,297],[825,430,344,290],[1215,428,349,294],[1601,430,351,291]];
  const holds=[460,360,160,380,350,550,320,360,160,520],total=holds.reduce((a,b)=>a+b,0);
  const sheet=new Image();
  let ready=false,raf=0,epoch=null,lastDraw=-Infinity;
  const visible=()=>!document.hidden&&(!gate||gate.classList.contains('active'));
  function draw(elapsed){
    let time=elapsed%total,index=0;
    while(time>=holds[index]&&index<holds.length-1){time-=holds[index];index++;}
    const [x,y,w,h]=poses[index],height=250*h/w;
    const baseline=280+Math.sin(elapsed/total*Math.PI*2)*3;
    ctx.clearRect(0,0,320,320);
    ctx.fillStyle='rgba(232,161,58,.08)';ctx.beginPath();ctx.ellipse(164,289,90,5,0,0,Math.PI*2);ctx.fill();
    ctx.drawImage(sheet,x,y,w,h,39,baseline-height,250,height);
  }
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  function tick(now){
    raf=0;
    if(!ready||!visible())return;
    if(epoch===null)epoch=now;
    if(now-lastDraw>=65){
      try{draw(Math.max(0,now-epoch));lastDraw=now;}
      catch{ready=false;canvas.hidden=true;wrapper.classList.remove('animated');return;}
    }
    raf=requestAnimationFrame(tick);
  }
  function start(){if(ready&&visible()&&!raf)raf=requestAnimationFrame(tick);}
  function sync(){visible()?start():stop();}
  sheet.onload=()=>{
    if(sheet.naturalWidth<1952||sheet.naturalHeight<724)return;
    try{
      draw(0);ready=true;canvas.hidden=false;wrapper.classList.add('animated');start();
    }catch{canvas.hidden=true;wrapper.classList.remove('animated');}
  };
  sheet.onerror=()=>{ready=false;stop();canvas.hidden=true;wrapper.classList.remove('animated');};
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pageshow',sync);
  window.addEventListener('pagehide',stop);
  if(gate&&typeof MutationObserver==='function')new MutationObserver(sync).observe(gate,{attributes:true,attributeFilter:['class']});
  sheet.src='catoshi-home-loop-v1.png?v='+revision;
})();
