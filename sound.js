(function () {
  'use strict';
  const settings=window.RushAudioConfig||{},button=document.getElementById('sound-toggle'),testButton=document.getElementById('sound-test');
  const volume=value=>Math.max(0,Math.min(1,Number(value)||0));
  let muted=false,context=null,master=null,noiseBuffer=null,samples={},resumePromise=null;
  let music=null,musicPriming=false,playing=false,nextCoin=0,coinSequence=0,previewAudio=null;
  const active=new Set(),pending=[];
  const mobileMedia=typeof navigator!=='undefined'&&(navigator.maxTouchPoints>0||/iPhone|iPad|iPod|Android/i.test(navigator.userAgent||''));
  const voices=[],mediaTimers=new Set();let voiceCursor=0,mediaInitialized=false,mediaBlocked=false;
  const clips={burst:'burst',coin:'coin',jump:'jump','flip-start':'flip',flip:'flip',land:'land',crash:'crash',rush:'rush',redRush:'red'};
  function usesMedia(){return mobileMedia||!context||context.state==='closed';}
  function primeMedia(){
    if(typeof Audio==='undefined')return;
    if(!mediaInitialized){
      mediaInitialized=true;
      for(let i=0;i<8;i++){
        const audio=new Audio('sfx-silence-v1.wav');audio.preload='auto';audio.loop=false;
        voices.push({audio,ready:false,priming:false,failed:false,serial:0,primeSerial:0});
      }
    }
    for(const voice of voices){
      if(voice.ready)continue;
      const attempt=++voice.primeSerial;
      if(!voice.priming)voice.audio.src='sfx-silence-v1.wav';
      voice.priming=true;
      try{
        // Play real silent media inside the tap. Keep each element authorized
        // when replacing its source with a clip during the game.
        Promise.resolve(voice.audio.play()).then(()=>{
          if(attempt!==voice.primeSerial)return;
          voice.audio.pause();voice.priming=false;voice.ready=true;voice.failed=false;
          mediaBlocked=false;updateButton();flush();
        },()=>{if(attempt!==voice.primeSerial)return;voice.priming=false;voice.failed=true;mediaBlocked=true;updateButton();});
      }catch{voice.priming=false;voice.failed=true;mediaBlocked=true;updateButton();}
    }
  }
  function mediaClip(event){
    if(event.type==='stumble')return ['metal','wood','stone'].includes(event.material)?event.material:'stone';
    if(event.type==='trick')return /BACKFLIP/.test(event.text)?'red':event.text==='RUSH BOOST'?'rush':event.text==='CABLE GRIND'?'flip':null;
    return clips[event.type]||null;
  }
  function playMedia(event,preview=false){
    const kind=mediaClip(event);if(!kind)return;
    const available=voices.filter(voice=>voice.ready);if(!available.length)return;
    const voice=available[voiceCursor++%available.length],audio=voice.audio,serial=++voice.serial;
    try{
      audio.pause();audio.src='sfx-'+kind+'-v1.wav';audio.volume=volume(settings.effectsVolume??.72);audio.muted=false;
      audio.playbackRate=event.type==='coin'?1+(coinSequence++%5)*.025:1;
      Promise.resolve(audio.play()).then(()=>{
        if(voice.serial!==serial)return;
        mediaBlocked=false;updateButton();
        if(muted||document.hidden||(!playing&&!preview))audio.pause();
      },()=>{
        if(voice.serial!==serial)return;
        mediaBlocked=true;voice.ready=false;voice.failed=true;updateButton();
        // Desktop contexts can still play if a media element is denied.
        if(context?.state==='running'&&!muted&&(playing||preview))try{render(event);}catch{}
      });
    }catch{mediaBlocked=true;updateButton();}
  }
  function renderOutput(event){
    if(usesMedia()){
      if(event.type==='coin'&&typeof setTimeout==='function'){
        const now=Date.now()/1000,at=Math.max(now,nextCoin);nextCoin=at+.04;
        const timer=setTimeout(()=>{mediaTimers.delete(timer);if(playing&&!muted&&!document.hidden)playMedia(event);},Math.max(0,(at-now)*1000));
        mediaTimers.add(timer);
      }else playMedia(event);
    }else render(event);
  }
  try{muted=localStorage.getItem('rush-muted')==='1';}catch{}
  function updateButton(){
    button.textContent=mediaBlocked&&!muted?'ENABLE SOUND':'SOUND '+(muted?'OFF':'ON');
    button.setAttribute('aria-pressed',String(!muted));
    button.setAttribute('aria-label',muted||mediaBlocked?'Enable game audio':'Mute game audio');
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
      }else if(kind==='jump'||kind==='flip'){
        low=low*.58+white*.42;
        const u=t/duration,envelope=Math.sin(Math.PI*u)**2;
        phase+=Math.PI*2*(kind==='jump'?160+540*u:230-135*u)/context.sampleRate;
        sample=kind==='jump'?.5*Math.sin(phase)*Math.exp(-t*15)+.42*low*envelope
          :.86*low*envelope+.13*Math.sin(phase)*envelope;
        sample*=Math.min(1,t/.004);
      }else if(kind==='metal'||kind==='wood'||kind==='stone'||kind==='crash'){
        low=low*.80+white*.20;
        const thump=Math.sin(Math.PI*2*(kind==='wood'?115:kind==='metal'?170:75)*t)*Math.exp(-t*18);
        const ring=kind==='metal'?.3*Math.sin(Math.PI*2*780*t)*Math.exp(-t*15)
          :kind==='wood'?.18*Math.sin(Math.PI*2*335*t)*Math.exp(-t*27):0;
        sample=Math.tanh((.50*white*Math.exp(-t*(kind==='crash'?20:45))
          +.65*low*Math.exp(-t*(kind==='crash'?8:22))+.55*thump+ring)*1.4)*Math.min(1,t/.002);
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
    const target=kind==='coin'?.8:kind==='flip'?.58:kind==='jump'?.65:.9;
    for(let i=0;i<data.length;i++)data[i]*=target/Math.max(.001,peak);
    return buffer;
  }
  function release(node,parts){
    active.delete(node);
    for(const part of parts)try{part.disconnect();}catch{}
  }
  function stopEffects(){
    pending.length=0;nextCoin=0;coinSequence=0;
    try{previewAudio?.pause();}catch{}
    for(const timer of mediaTimers)if(typeof clearTimeout==='function')clearTimeout(timer);mediaTimers.clear();
    for(const voice of voices)if(!voice.priming){voice.serial++;try{voice.audio.pause();}catch{}}
    for(const node of [...active]){try{node.stop();}catch{}node.onended?.();}
  }
  function flush(){
    if(muted||!playing||document.hidden)return;
    if(usesMedia()?!voices.some(voice=>voice.ready):context?.state!=='running')return;
    for(const event of pending.splice(0))try{renderOutput(event);}catch{}
  }
  function resumeContext(force=false){
    if(!context||context.state==='closed'||context.state==='running'||(resumePromise&&!force))return;
    const current=context;
    try{
      resumePromise=Promise.resolve(current.resume()).then(()=>{
        resumePromise=null;if(context===current)flush();
      },()=>{resumePromise=null;});
    }catch{resumePromise=null;}
  }
  function unlock(){
    if(muted)return;
    if(mobileMedia)try{primeMedia();}catch{}
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
          samples={coin:buildSample(.24,'coin'),burst:buildSample(.88,'burst'),
            jump:buildSample(.22,'jump'),flip:buildSample(.34,'flip'),metal:buildSample(.28,'metal'),
            wood:buildSample(.26,'wood'),stone:buildSample(.30,'stone'),crash:buildSample(.55,'crash')};
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
      resumeContext(true);flush();
    }catch{
      // A partially initialized context must not leave effect() throwing on
      // every coin. A later trusted gesture can retry initialization.
      stopEffects();try{Promise.resolve(context?.close?.()).catch(()=>{});}catch{}
      context=null;master=null;noiseBuffer=null;samples={};resumePromise=null;
    }
    if(!mobileMedia&&usesMedia())try{primeMedia();}catch{}
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
    }else if(event.type==='jump')sample('jump',context.currentTime,event.automatic?1.12:1);
    else if(event.type==='rush'){
      noise(.3,.12,1800);tone(180,780,.38,.18,0,'triangle');
      [660,880,1320].forEach((pitch,i)=>tone(pitch,pitch,.18,.13,i*.07,'sine'));
    }else if(event.type==='redRush'){
      [880,1174,1760].forEach((pitch,i)=>tone(pitch,pitch*1.015,.2,.12,i*.075,'sine'));
    }
    else if(event.type==='flip-start'||event.type==='flip')sample('flip',context.currentTime,event.type==='flip'?1.08:1);
    else if(event.type==='land'){noise(.09,.14,850);tone(105,65,.09,.18);}
    else if(event.type==='stumble')sample(['metal','wood','stone'].includes(event.material)?event.material:'stone',context.currentTime,event.heavy?1:1.16);
    else if(event.type==='crash')sample('crash',context.currentTime);
    else if(event.type==='trick'&&/BACKFLIP/.test(event.text)){
      [420,560,840].forEach((pitch,i)=>tone(pitch,pitch*1.02,.13,.15,i*.065,'triangle'));
    }else if(event.type==='trick'&&event.text==='RUSH BOOST'){tone(170,620,.25,.2,0,'triangle');noise(.15,.12,1600);}
    else if(event.type==='trick'&&event.text==='CABLE GRIND')noise(.12,.1,2200);
  }
  function effect(event){
    if(muted||!playing||document.hidden)return;
    if(usesMedia()?voices.some(voice=>voice.ready):context?.state==='running'){try{renderOutput(event);}catch{}}
    else{
      if(pending.length<64)pending.push({...event});
      if(!context&&!mediaInitialized)unlock();
      else if(context&&context.state!=='running')resumeContext();
    }
  }
  function burst(){effect({type:'burst'});}
  function setPlaying(value){
    playing=Boolean(value);if(!playing)stopEffects();else flush();syncMusic();
  }
  button.addEventListener('click',()=>{
    muted=mediaBlocked?false:!muted;
    try{localStorage.setItem('rush-muted',muted?'1':'0');}catch{}
    if(master)master.gain.value=muted?0:volume(settings.effectsVolume??.72);
    if(muted)stopEffects();else unlock();syncMusic();updateButton();
  });
  // click and touchend both run in the trusted gesture, before asynchronous
  // artwork, token checks, or the vault countdown.
  window.addEventListener('click',unlock,{passive:true});
  window.addEventListener('pointerdown',unlock,{passive:true});
  window.addEventListener('touchend',unlock,{passive:true});
  window.addEventListener('keydown',unlock);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopEffects();else if(playing)unlock();syncMusic();});
  if(testButton&&testButton!==button)testButton.addEventListener('click',()=>{
    muted=false;try{localStorage.setItem('rush-muted','0');}catch{}
    if(master)master.gain.value=volume(settings.effectsVolume??.72);
    unlock();updateButton();
    if(usesMedia()){
      // If the pool is still unlocking, a directly tapped media element can
      // play immediately. This also makes silent-device diagnosis concrete.
      try{previewAudio?.pause();}catch{}
      previewAudio=new Audio('sfx-coin-v1.wav');previewAudio.volume=volume(settings.effectsVolume??.72);
      Promise.resolve(previewAudio.play()).then(()=>{mediaBlocked=false;updateButton();},()=>{mediaBlocked=true;updateButton();});
    }else{
      const current=context;
      Promise.resolve(current.resume()).then(()=>{if(current.state==='running'&&!muted)render({type:'coin'});});
    }
  });
  updateButton();window.RushSound={unlock,effect,burst,setPlaying};
})();
