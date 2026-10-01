(function () {
  'use strict';
  const settings=window.RushAudioConfig||{},button=document.getElementById('sound-toggle');
  const volume=value=>Math.max(0,Math.min(1,Number(value)||0));
  let muted=false,context=null,master=null,noiseBuffer=null,samples={},resumePromise=null;
  let music=null,musicPriming=false,playing=false,nextCoin=0,coinSequence=0;
  const active=new Set(),pending=[];
  try{muted=localStorage.getItem('rush-muted')==='1';}catch{}
  function updateButton(){
    button.textContent='SOUND '+(muted?'OFF':'ON');
    button.setAttribute('aria-pressed',String(!muted));
    button.setAttribute('aria-label',muted?'Enable game audio':'Mute game audio');
  }
  function syncMusic(){
    if(!music)return;
    try{
    music.muted=muted;
    if(playing&&!muted&&!document.hidden){
      if(!musicPriming)Promise.resolve(music.play()).catch(()=>{});
    }else if(!musicPriming||muted||document.hidden)music.pause();
    }catch{ /* A denied music request must not affect controls or simulation. */ }
  }
  function buildSample(duration,kind){
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
    let seed=kind==='coin'?1919:7331,low=0,phase=0,peak=0;
    for(let i=0;i<data.length;i++){
      seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
      const white=(seed>>>0)/2147483648-1,t=i/context.sampleRate;
      let sample;
      if(kind==='coin'){
        const attack=Math.min(1,t/.003);
        sample=attack*(.54*Math.sin(Math.PI*2*1180*t)*Math.exp(-t*14)
          +.27*Math.sin(Math.PI*2*1760*t)*Math.exp(-t*18)
          +.15*Math.sin(Math.PI*2*2790*t)*Math.exp(-t*27)
          +.07*white*Math.exp(-t*85));
      }else{
        low=low*.84+white*.16;
        phase+=Math.PI*2*(54+168*Math.exp(-t*6))/context.sampleRate;
        const attack=Math.min(1,t/.002);
        sample=attack*(.48*white*Math.exp(-t*48)+.85*low*Math.exp(-t*5)
          +.45*Math.sin(phase)*Math.exp(-t*6)
          +.16*Math.sin(Math.PI*2*310*t)*Math.exp(-t*9)
          +.09*Math.sin(Math.PI*2*690*t)*Math.exp(-t*13));
        sample=Math.tanh(sample*1.5);
      }
      sample*=Math.min(1,(duration-t)/.012);
      data[i]=sample;peak=Math.max(peak,Math.abs(sample));
    }
    const target=kind==='coin'?.8:.9;
    for(let i=0;i<data.length;i++)data[i]*=target/Math.max(.001,peak);
    return buffer;
  }
  function release(node,parts){
    active.delete(node);
    for(const part of parts)try{part.disconnect();}catch{}
  }
  function stopEffects(){
    pending.length=0;nextCoin=0;coinSequence=0;
    for(const node of [...active]){try{node.stop();}catch{}node.onended?.();}
  }
  function flush(){
    if(muted||!playing||document.hidden||context?.state!=='running')return;
    for(const event of pending.splice(0))try{render(event);}catch{}
  }
  function resumeContext(){
    if(!context||context.state==='closed'||context.state==='running'||resumePromise)return;
    const current=context;
    try{
      resumePromise=Promise.resolve(current.resume()).then(()=>{
        resumePromise=null;if(context===current)flush();
      },()=>{resumePromise=null;});
    }catch{resumePromise=null;}
  }
  function unlock(){
    if(muted)return;
    try{
      // Web Audio defaults to ambient on iPhone. Request audible game playback
      // where supported, and still use the player's tap to unlock the context.
      if(typeof navigator!=='undefined'&&navigator.audioSession)navigator.audioSession.type='playback';
    }catch{}
    try{
      if(!context||context.state==='closed'){
        const Constructor=window.AudioContext||window.webkitAudioContext;
        if(Constructor){
          context=new Constructor({latencyHint:'interactive'});master=context.createGain();
          master.gain.value=volume(settings.effectsVolume??.72);
          if(typeof context.createDynamicsCompressor==='function'){
            const limiter=context.createDynamicsCompressor();
            limiter.threshold.value=-8;limiter.knee.value=8;limiter.ratio.value=6;
            limiter.attack.value=.003;limiter.release.value=.12;
            master.connect(limiter);limiter.connect(context.destination);
          }else master.connect(context.destination);
          samples={coin:buildSample(.24,'coin'),burst:buildSample(.88,'burst')};
          noiseBuffer=context.createBuffer(1,context.sampleRate,context.sampleRate);
          const noise=noiseBuffer.getChannelData(0);
          for(let i=0;i<noise.length;i++)noise[i]=Math.random()*2-1;
          const current=context;
          current.addEventListener?.('statechange',()=>{if(context===current&&current.state==='running')flush();});
          // A tiny silent buffer starts inside the trusted gesture, not after
          // artwork, wallet checks or the countdown's animation frame.
          const prime=current.createBufferSource();prime.buffer=current.createBuffer(1,1,current.sampleRate);
          prime.connect(master);prime.onended=()=>prime.disconnect();prime.start();
        }
      }
      // Safari can be interrupted as well as suspended after leaving the app.
      resumeContext();flush();
    }catch{
      // A partially initialized context must not leave effect() throwing on
      // every coin. A later trusted gesture can retry initialization.
      stopEffects();try{Promise.resolve(context?.close?.()).catch(()=>{});}catch{}
      context=null;master=null;noiseBuffer=null;samples={};resumePromise=null;
    }
    try{
      if(!music&&['music.mp3','music.ogg','music.wav'].includes(settings.musicSrc)&&typeof Audio!=='undefined'){
        music=new Audio(settings.musicSrc);music.loop=true;music.preload='auto';
        music.volume=volume(settings.musicVolume??.16);musicPriming=true;
        // Do not immediately pause and abort this gesture-authorized play.
        Promise.resolve(music.play()).then(()=>{musicPriming=false;syncMusic();},()=>{musicPriming=false;});
      }
      syncMusic();
    }catch{musicPriming=false;}
  }
  function sample(kind,at,rate=1){
    const source=context.createBufferSource();source.buffer=samples[kind];source.playbackRate.value=rate;
    source.connect(master);active.add(source);source.onended=()=>release(source,[source]);source.start(at);
  }
  function envelope(gain,start,duration,level){
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level),start+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  }
  function tone(frequency,end,duration,level,delay=0,type='sine'){
    if(active.size>=24)return;
    const oscillator=context.createOscillator(),gain=context.createGain(),start=context.currentTime+delay;
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+duration);
    envelope(gain,start,duration,level);oscillator.connect(gain);gain.connect(master);active.add(oscillator);
    oscillator.onended=()=>release(oscillator,[oscillator,gain]);oscillator.start(start);oscillator.stop(start+duration+.02);
  }
  function noise(duration,level,cutoff){
    if(active.size>=24)return;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    source.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.value=cutoff;
    envelope(gain,context.currentTime,duration,level);source.connect(filter);filter.connect(gain);gain.connect(master);active.add(source);
    source.onended=()=>release(source,[source,filter,gain]);source.start();source.stop(context.currentTime+duration+.02);
  }
  function render(event){
    if(event.type==='burst')sample('burst',context.currentTime);
    else if(event.type==='coin'){
      // Schedule every pickup, even when several coins arrive in one frame.
      // Small spacing makes the individual chimes audible rather than dropping them.
      const at=Math.max(context.currentTime,nextCoin);nextCoin=at+.04;
      sample('coin',at,1+(coinSequence++%5)*.025);
    }else if(event.type==='jump')tone(180,410,.12,.2,0,'triangle');
    else if(event.type==='land'){noise(.09,.14,850);tone(105,65,.09,.18);}
    else if(event.type==='stumble'){noise(.16,.2,1200);tone(140,55,.15,.24,0,'triangle');}
    else if(event.type==='crash'){noise(.32,.3,950);tone(150,45,.35,.28);}
    else if(event.type==='trick'&&/BACKFLIP/.test(event.text)){
      [420,560,840].forEach((pitch,i)=>tone(pitch,pitch*1.02,.13,.15,i*.065,'triangle'));
    }else if(event.type==='trick'&&event.text==='RUSH BOOST'){tone(170,620,.25,.2,0,'triangle');noise(.15,.12,1600);}
    else if(event.type==='trick'&&event.text==='CABLE GRIND')noise(.12,.1,2200);
  }
  function effect(event){
    if(muted||!playing||document.hidden)return;
    if(context?.state==='running'){try{render(event);}catch{}}
    else{
      if(pending.length<64)pending.push({...event});
      unlock();
    }
  }
  function burst(){effect({type:'burst'});}
  function setPlaying(value){
    playing=Boolean(value);if(!playing)stopEffects();else flush();syncMusic();
  }
  button.addEventListener('click',()=>{
    muted=!muted;
    try{localStorage.setItem('rush-muted',muted?'1':'0');}catch{}
    if(master)master.gain.value=muted?0:volume(settings.effectsVolume??.72);
    if(muted)stopEffects();else unlock();syncMusic();updateButton();
  });
  window.addEventListener('pointerdown',unlock,{passive:true});
  window.addEventListener('touchend',unlock,{passive:true});
  window.addEventListener('keydown',unlock);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopEffects();else if(playing)unlock();syncMusic();});
  updateButton();window.RushSound={unlock,effect,burst,setPlaying};
})();
