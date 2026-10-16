/* ================= sound: tiny synthesized effects (no audio files) ================= */
const SFX={ctx:null,master:null,noiseBuf:null,siren:null};
const fmtO=n=>(Math.abs(n)<100&&Math.abs(n%1)>.001)?n.toFixed(1):fmt(n);
function audioUnlock(){if(SFX.ctx){if(SFX.ctx.state==='suspended')SFX.ctx.resume();return}try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;SFX.ctx=new C();SFX.master=SFX.ctx.createGain();SFX.master.gain.value=.5;SFX.master.connect(SFX.ctx.destination);
  const n=SFX.ctx.sampleRate*.6|0;SFX.noiseBuf=SFX.ctx.createBuffer(1,n,SFX.ctx.sampleRate);const d=SFX.noiseBuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1}catch(e){SFX.ctx=null}}
window.addEventListener('pointerdown',audioUnlock);window.addEventListener('keydown',audioUnlock);
function tone(f,dur,o={}){const A=SFX.ctx;if(!A)return;const t0=A.currentTime+(o.at||0);const osc=A.createOscillator(),g=A.createGain();osc.type=o.type||'square';osc.frequency.setValueAtTime(f,t0);if(o.to)osc.frequency.exponentialRampToValueAtTime(o.to,t0+dur);
  const v=(o.vol||.08);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(v,t0+.008);g.gain.exponentialRampToValueAtTime(.0005,t0+dur);osc.connect(g);g.connect(SFX.master);osc.start(t0);osc.stop(t0+dur+.02)}
function noise(dur,o={}){const A=SFX.ctx;if(!A||!SFX.noiseBuf)return;const t0=A.currentTime+(o.at||0);const src=A.createBufferSource();src.buffer=SFX.noiseBuf;const f=A.createBiquadFilter();f.type=o.hp?'highpass':'lowpass';f.frequency.setValueAtTime(o.f||1200,t0);if(o.fto)f.frequency.exponentialRampToValueAtTime(o.fto,t0+dur);
  const g=A.createGain();g.gain.setValueAtTime(o.vol||.12,t0);g.gain.exponentialRampToValueAtTime(.0005,t0+dur);src.connect(f);f.connect(g);g.connect(SFX.master);src.start(t0);src.stop(t0+dur+.02)}
function sfx(k){if(!SFX.ctx||!S||S.sound===0)return;try{switch(k){
  case'chop':noise(.09,{f:900,vol:.16});tone(150,.1,{to:80,type:'triangle',vol:.12});break;
  case'perfect':tone(880,.07,{vol:.06});tone(1320,.12,{at:.05,vol:.06});break;
  case'good':tone(660,.08,{vol:.05});break;
  case'miss':tone(220,.12,{to:160,type:'sawtooth',vol:.04});break;
  case'knot':tone(95,.16,{type:'square',vol:.09});noise(.08,{f:400,vol:.1});break;
  case'timber':noise(.7,{f:2200,fto:200,vol:.14});tone(300,.6,{to:70,type:'triangle',vol:.06,at:.1});break;
  case'clang':tone(1250,.09,{type:'triangle',vol:.07});tone(1870,.14,{type:'sine',vol:.05,at:.01});noise(.04,{f:5000,hp:1,vol:.05});break;
  case'crumble':noise(.35,{f:1500,fto:150,vol:.15});break;
  case'cast':noise(.25,{f:3000,fto:600,hp:1,vol:.05});break;
  case'splash':noise(.3,{f:1800,fto:300,vol:.12});break;
  case'bite':tone(740,.06,{vol:.06});tone(990,.08,{at:.07,vol:.06});break;
  case'reel':tone(1400,.02,{vol:.02});break;
  case'catch':[523,659,784,1046].forEach((f,i)=>tone(f,.12,{at:i*.07,vol:.05}));break;
  case'coin':tone(988,.06,{vol:.05});tone(1319,.12,{at:.06,vol:.05});break;
  case'buy':tone(659,.06,{vol:.04});tone(880,.1,{at:.06,vol:.04});break;
  case'error':tone(196,.16,{vol:.05});break;
  case'lvl':[523,659,784,1046,1319].forEach((f,i)=>tone(f,.14,{at:i*.08,vol:.05,type:'triangle'}));break;
  case'steal':noise(.18,{f:4000,fto:900,hp:1,vol:.06});break;
  case'caught':for(let i=0;i<3;i++){tone(880,.1,{at:i*.18,vol:.07});tone(660,.08,{at:i*.18+.09,vol:.07})}break;
  case'siren':for(let i=0;i<4;i++){tone(700,.22,{at:i*.5,to:960,vol:.035,type:'sine'});tone(960,.22,{at:i*.5+.25,to:700,vol:.035,type:'sine'})}break;
  case'door':noise(.08,{f:500,vol:.12});tone(120,.06,{type:'triangle',vol:.05});break;
  case'click':tone(1800,.015,{vol:.03});break;
  case'pin':tone(1500,.03,{vol:.04,type:'triangle'});noise(.02,{f:6000,hp:1,vol:.04});break;
  case'snap':noise(.12,{f:3000,vol:.12});tone(180,.1,{vol:.05});break;
  case'stamp':noise(.06,{f:700,vol:.15});tone(90,.08,{type:'triangle',vol:.1});break;
  case'cell':noise(.3,{f:600,vol:.14});tone(70,.3,{type:'square',vol:.05});break;
  case'eat':noise(.05,{f:1400,vol:.06});noise(.05,{f:1400,vol:.06,at:.09});break;
  case'crank':tone(1500,.02,{vol:.04,type:'square'});noise(.03,{f:3000,hp:1,vol:.05});break;
  case'rumble':noise(.5,{f:300,vol:.12});tone(70,.45,{type:'triangle',vol:.06});break;
  case'whoosh':noise(.35,{f:600,fto:4000,hp:1,vol:.06});break;
  case'thud':tone(110,.12,{type:'triangle',vol:.12,to:60});noise(.06,{f:500,vol:.1});break;
  case'crack1':tone(900,.05,{vol:.06});noise(.06,{f:5000,hp:1,vol:.08});break;
  case'crack2':tone(1200,.05,{vol:.07});noise(.07,{f:5000,hp:1,vol:.1});break;
  case'crack3':tone(1600,.06,{vol:.08});noise(.09,{f:5000,hp:1,vol:.12});break;
  case'burstsoft':noise(.2,{f:1500,vol:.08});tone(330,.18,{type:'triangle',vol:.05});break;
  case'fanfare1':noise(.18,{f:2500,vol:.1});[523,659,784].forEach((f,i)=>tone(f,.16,{at:i*.09,vol:.06,type:'triangle'}));break;
  case'fanfare2':noise(.3,{f:3000,vol:.12});[523,659,784,1046,1319].forEach((f,i)=>tone(f,.2,{at:i*.09,vol:.07,type:'square'}));tone(1046,.6,{at:.5,vol:.05,type:'triangle'});break;
  case'jackpot':noise(.4,{f:4000,vol:.14});for(let r=0;r<3;r++)[523,659,784,1046].forEach((f,i)=>tone(f*(1+r*.25),.12,{at:r*.42+i*.08,vol:.07,type:'square'}));tone(1568,.9,{at:1.3,vol:.06,type:'triangle'});break;
  case'cardflip':noise(.12,{f:2500,hp:1,vol:.07});[784,988,1319].forEach((f,i)=>tone(f,.25,{at:.1+i*.1,vol:.06,type:'triangle'}));break;
  case'quack':tone(520,.08,{type:'sawtooth',to:380,vol:.04});tone(500,.09,{at:.12,type:'sawtooth',to:360,vol:.035});break;
  case'purr':for(let i=0;i<6;i++)noise(.06,{f:220,vol:.07,at:i*.07});break;
  case'tick':tone(2200,.015,{vol:.025});break;
  case'horn':tone(196,.55,{type:'sawtooth',vol:.05,to:220});tone(294,.55,{type:'square',vol:.025,at:.05,to:330});tone(392,.7,{type:'sawtooth',vol:.04,at:.45});break;
  case'pow':noise(.08,{f:900,vol:.14});tone(180,.09,{type:'square',vol:.06,to:90});break;
  case'whistle':tone(1900,.14,{type:'sine',vol:.05});tone(1500,.18,{at:.16,type:'sine',vol:.05});break}}catch(e){}}
/* ================= music: a gentle procedural chiptune that follows the town clock (and gets peppy at the Capsule Machine) ================= */
const MUS={on:false,next:0,step:0,timer:null,gain:null,mel:2};
const PROGS={day:{bpm:92,ch:[[60,64,67],[57,60,64],[53,57,60],[55,59,62]],sc:[72,74,76,79,81,84]},night:{bpm:70,ch:[[57,60,64],[53,57,60],[48,52,55],[52,56,59]],sc:[69,72,74,76,79,81]},arcade:{bpm:128,ch:[[60,64,67],[65,69,72],[67,71,74],[60,64,67]],sc:[72,74,76,79,81,84,86]}};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function mnote(f,dur,type,vol,at){const A=SFX.ctx;const o=A.createOscillator(),g=A.createGain();o.type=type;o.frequency.setValueAtTime(f,at);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(vol,at+.01);g.gain.exponentialRampToValueAtTime(.0005,at+dur);o.connect(g);g.connect(MUS.gain);o.start(at);o.stop(at+dur+.03)}
function mhat(at){const A=SFX.ctx;if(!SFX.noiseBuf)return;const s=A.createBufferSource();s.buffer=SFX.noiseBuf;const f=A.createBiquadFilter();f.type='highpass';f.frequency.value=7000;const g=A.createGain();g.gain.setValueAtTime(.025,at);g.gain.exponentialRampToValueAtTime(.0005,at+.04);s.connect(f);f.connect(g);g.connect(MUS.gain);s.start(at);s.stop(at+.06)}
function startMusic(){if(MUS.on||!SFX.ctx||!S||S.music===0)return;MUS.on=true;MUS.gain=SFX.ctx.createGain();MUS.gain.gain.setValueAtTime(0,SFX.ctx.currentTime);MUS.gain.gain.linearRampToValueAtTime(.5,SFX.ctx.currentTime+4);MUS.gain.connect(SFX.master);MUS.next=SFX.ctx.currentTime+.15;MUS.step=0;MUS.timer=setInterval(musTick,120)}
function stopMusic(){if(!MUS.on)return;MUS.on=false;clearInterval(MUS.timer);try{const g=MUS.gain;g.gain.linearRampToValueAtTime(0,SFX.ctx.currentTime+.4);setTimeout(()=>g.disconnect(),600)}catch(e){}}
function musTick(){const A=SFX.ctx;if(!A||A.state!=='running')return;let mode='day';try{const h=ghour();mode=typeof gachaOpen!=='undefined'&&gachaOpen?'arcade':(h<6||h>=20.5)?'night':'day'}catch(e){}const P=PROGS[mode];const st=60/P.bpm/2;
  if(MUS.next<A.currentTime)MUS.next=A.currentTime+.05;
  while(MUS.next<A.currentTime+.6){const s=MUS.step,beat=s%8,bar=Math.floor(s/8)%4,ch=P.ch[bar],at=MUS.next;
    if(beat===0||beat===4)mnote(mtof(ch[0]-12),st*3.6,'triangle',mode==='night'?.09:.11,at);
    if(mode==='arcade'&&beat%2===1)mnote(mtof(ch[0]-12),st*.8,'triangle',.07,at);
    const pat=[0,1,2,1,0,2,1,2];if(mode!=='night'||beat%2===0)mnote(mtof(ch[pat[beat]]+12),st*.9,'square',mode==='arcade'?.03:.02,at);
    if(mode!=='night'&&beat%2===1)mhat(at);
    if((beat===0||beat===3||beat===6)&&Math.random()<(mode==='night'?.45:.6)){MUS.mel=clamp(MUS.mel+Math.floor(Math.random()*3)-1,0,P.sc.length-1);const n=P.sc[MUS.mel];if(ch.some(c=>(n-c)%12===0)||Math.random()<.5)mnote(mtof(n),st*(beat===6?2.5:1.6),'triangle',mode==='night'?.045:.05,at)}
    MUS.next+=st;MUS.step++}}
document.addEventListener('visibilitychange',()=>{if(!SFX.ctx)return;if(document.hidden)SFX.ctx.suspend().catch(()=>{});else SFX.ctx.resume().catch(()=>{})});
window.addEventListener('pointerdown',()=>{if(SFX.ctx&&S&&S.music!==0&&!MUS.on&&S.tutorial)startMusic()});

