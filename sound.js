(function () {
  'use strict';
  const settings=window.RushAudioConfig||{},enabled=settings.enabled!==false;
  const volume=value=>Math.max(0,Math.min(1,Number(value)||0));
  const coinLevel=volume(settings.coinVolume??.05);
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const mobile=typeof navigator!=='undefined'&&(navigator.maxTouchPoints>0||/iPhone|iPad|iPod|Android/i.test(navigator.userAgent||''));
  let context=null,master=null,noiseBuffer=null,samples={},resumePromise=null,resumeAttempt=0;
  let music=null,musicPriming=false,playing=false,coinSequence=0;
  let anchor=null,anchorPriming=false,anchorAttempt=0;
  const active=new Set(),pending=[],voices=[];
  const clips={burst:'burst',coin:'coin',jump:'jump','flip-start':'flip',flip:'flip',land:'land',crash:'crash',rush:'rush',redRush:'red',heart:'red','cargo-land':'wood',escape:'land',finish:'land'};
  function mediaClip(event){
    if(event.type==='stumble')return event.fatal?null:['metal','wood','stone'].includes(event.material)?event.material:'stone';
    if(event.type==='trick')return /BACKFLIP/.test(event.text)?'red':event.text==='RUSH BOOST'?'rush':event.text==='CABLE GRIND'?'flip':null;
    return clips[event.type]||null;
  }
  function usesMedia(){return !context||context.state==='closed';}
  function primeAnchor(){
    // Older iPhone browsers route Web Audio through their ambient session.
    // One reusable silent media element keeps the playback route available;
    // actual effects are mixed from in-memory buffers, never streamed here.
    if(!enabled||!mobile||typeof Audio==='undefined')return;
    if(!anchor){anchor=new Audio('sfx-silence-v1.wav');anchor.loop=true;anchor.preload='auto';anchor.volume=.001;}
    if(!anchor.paused&&!anchorPriming)return;
    const attempt=++anchorAttempt;anchorPriming=true;
    try{Promise.resolve(anchor.play()).then(()=>{
      if(attempt!==anchorAttempt)return;anchorPriming=false;if(!playing||document.hidden)anchor.pause();
    },()=>{if(attempt===anchorAttempt)anchorPriming=false;});}catch{anchorPriming=false;}
  }
  function primeMedia(){
    if(typeof Audio==='undefined')return;
    if(!voices.length)for(const kind of ['coin','burst','jump','flip','metal','wood','stone','crash','land','rush','red']){
      const count=kind==='coin'?8:kind==='flip'?2:1;
      for(let i=0;i<count;i++){
        const audio=new Audio('sfx-silence-v1.wav');audio.preload='auto';audio.loop=false;
        voices.push({kind,audio,authorized:false,loaded:false,priming:false,primeAttempt:0,serial:0});
      }
    }
    for(const voice of voices){
      if(voice.authorized)continue;
      const attempt=++voice.primeAttempt;
      if(!voice.priming)voice.audio.src='sfx-silence-v1.wav';voice.priming=true;
      try{Promise.resolve(voice.audio.play()).then(()=>{
        if(attempt!==voice.primeAttempt)return;
        voice.audio.pause();voice.priming=false;voice.authorized=true;
        const ready=()=>{voice.loaded=true;flush();};
        voice.audio.addEventListener?.('canplay',ready,{once:true});
        // Switch once while preparing the run, then retain this clip permanently.
        // Pickups never change src, fetch, decode, or wait for a timer.
        voice.audio.src='sfx-'+voice.kind+'-v1.wav';voice.audio.load?.();
        if(!voice.audio.addEventListener||voice.audio.readyState>=3)ready();
      },()=>{if(attempt===voice.primeAttempt)voice.priming=false;});}catch{voice.priming=false;}
    }
  }
  function playMedia(event){
    const kind=mediaClip(event),bank=voices.filter(voice=>voice.kind===kind&&voice.authorized&&voice.loaded);
    if(!bank.length)return false;
    const voice=bank.find(voice=>voice.audio.paused||voice.audio.ended)||bank.reduce((a,b)=>a.serial<b.serial?a:b);
    const audio=voice.audio,serial=++voice.serial;
    try{
      audio.pause();audio.currentTime=0;audio.volume=volume(settings.effectsVolume??.72)*(event.type==='coin'?coinLevel:event.type==='heart'?.45:event.type==='cargo-land'?.30:1);
      audio.playbackRate=event.type==='coin'?1+(coinSequence++%5)*.025:1;
      Promise.resolve(audio.play()).then(()=>{
        if(voice.serial===serial&&(!playing||document.hidden))audio.pause();
      },()=>{if(voice.serial===serial)voice.authorized=false;});
      return true;
    }catch{return false;}
  }
  function renderOutput(event){
    if(usesMedia())return playMedia(event);
    if(context.state!=='running')return false;
    render(event);return true;
  }
  function syncMusic(){
    if(!music)return;
    try{
      if(playing&&!document.hidden){if(!musicPriming)Promise.resolve(music.play()).catch(()=>{});}
      else if(!musicPriming||document.hidden)music.pause();
    }catch{}
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
  function release(node,parts){active.delete(node);for(const part of parts)try{part.disconnect();}catch{}}
  function stopEffects(){
    pending.length=0;coinSequence=0;
    for(const voice of voices)if(!voice.priming){voice.serial++;try{voice.audio.pause();}catch{}}
    for(const node of [...active]){try{node.stop();}catch{}node.onended?.();}
  }
  function flush(){
    if(!enabled||!playing||document.hidden)return;
    const waiting=pending.splice(0),time=now();
    for(const item of waiting){
      if(time-item.at>80)continue;
      try{if(!renderOutput(item.event))pending.push(item);}catch{}
    }
  }
  function resumeContext(force=false){
    if(!context||context.state==='closed'||context.state==='running'||(resumePromise&&!force))return;
    const current=context,attempt=++resumeAttempt;
    try{resumePromise=Promise.resolve(current.resume()).then(()=>{
      if(attempt===resumeAttempt)resumePromise=null;if(context===current)flush();
    },()=>{if(attempt===resumeAttempt)resumePromise=null;});}catch{resumePromise=null;}
  }
  function unlock(){
    if(!enabled)return;
    try{if(typeof navigator!=='undefined'&&navigator.audioSession)navigator.audioSession.type='playback';}catch{}
    primeAnchor();
    try{
      if(!context||context.state==='closed'){
        const Constructor=window.AudioContext||window.webkitAudioContext;
        if(Constructor){
          context=new Constructor({latencyHint:'interactive'});master=context.createGain();
          master.gain.value=volume(settings.effectsVolume??.72);
          if(typeof context.createDynamicsCompressor==='function'){
            const limiter=context.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=8;
            limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.12;
            master.connect(limiter);limiter.connect(context.destination);
          }else master.connect(context.destination);
          // Generate all PCM once before the countdown; events reuse these
          // buffers on desktop AND mobile, without downloading per pickup.
          samples={coin:buildSample(.24,'coin'),burst:buildSample(.88,'burst'),
            jump:buildSample(.22,'jump'),flip:buildSample(.34,'flip'),metal:buildSample(.28,'metal'),
            wood:buildSample(.26,'wood'),stone:buildSample(.30,'stone'),crash:buildSample(.55,'crash')};
          noiseBuffer=context.createBuffer(1,context.sampleRate,context.sampleRate);
          const noise=noiseBuffer.getChannelData(0);for(let i=0;i<noise.length;i++)noise[i]=Math.random()*2-1;
          const current=context;current.addEventListener?.('statechange',()=>{if(context===current&&current.state==='running')flush();});
          const prime=current.createBufferSource();prime.buffer=current.createBuffer(1,1,current.sampleRate);
          prime.connect(master);prime.onended=()=>prime.disconnect();prime.start();
        }
      }
      resumeContext(true);flush();
    }catch{
      // Preserve fresh cues and preloaded media if Web Audio initialization
      // fails: the fallback should receive them, not erase them.
      for(const node of [...active]){try{node.stop();}catch{}node.onended?.();}
      try{Promise.resolve(context?.close?.()).catch(()=>{});}catch{}
      context=null;master=null;noiseBuffer=null;samples={};resumePromise=null;
    }
    if(usesMedia())try{primeMedia();}catch{}
    try{
      if(!music&&['music.mp3','music.ogg','music.wav'].includes(settings.musicSrc)&&typeof Audio!=='undefined'){
        music=new Audio(settings.musicSrc);music.loop=true;music.preload='auto';music.volume=volume(settings.musicVolume??.16);musicPriming=true;
        Promise.resolve(music.play()).then(()=>{musicPriming=false;syncMusic();},()=>{musicPriming=false;});
      }
      syncMusic();
    }catch{musicPriming=false;}
  }
  function sample(kind,at,rate=1,level=1){
    const source=context.createBufferSource();source.buffer=samples[kind];source.playbackRate.value=rate;
    const gain=context.createGain();gain.gain.value=level;source.connect(gain);gain.connect(master);
    active.add(source);source.onended=()=>release(source,[source,gain]);source.start(at);
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
      // Polyphonic cached buffers: every pickup starts now, with no backlog.
      sample('coin',context.currentTime,1+(coinSequence++%5)*.025,coinLevel);
    }else if(event.type==='jump')sample('jump',context.currentTime,event.automatic?1.12:1);
    else if(event.type==='rush'){
      noise(.3,.12,1800);tone(180,780,.38,.18,0,'triangle');
      [660,880,1320].forEach((pitch,i)=>tone(pitch,pitch,.18,.13,i*.07,'sine'));
    }else if(event.type==='heart'){
      tone(523,659,.15,.10,0,'sine');tone(784,784,.18,.09,.07,'sine');
    }else if(event.type==='redRush'){
      [880,1174,1760].forEach((pitch,i)=>tone(pitch,pitch*1.015,.2,.12,i*.075,'sine'));
    }
    else if(event.type==='flip-start'||event.type==='flip')sample('flip',context.currentTime,event.type==='flip'?1.08:1);
    else if(event.type==='land'){noise(.09,.14,850);tone(105,65,.09,.18);}
    else if(event.type==='stumble')sample(['metal','wood','stone'].includes(event.material)?event.material:'stone',context.currentTime,event.heavy?1:1.16);
    else if(event.type==='crash')sample('crash',context.currentTime);
    else if(event.type==='cargo-land')sample('wood',context.currentTime,.82,.30);
    else if(event.type==='escape'||event.type==='finish'){tone(440,660,.18,.08);tone(880,880,.16,.07,.1);}
    else if(event.type==='trick'&&/BACKFLIP/.test(event.text)){
      [420,560,840].forEach((pitch,i)=>tone(pitch,pitch*1.02,.13,.15,i*.065,'triangle'));
    }else if(event.type==='trick'&&event.text==='RUSH BOOST'){tone(170,620,.25,.2,0,'triangle');noise(.15,.12,1600);}
    else if(event.type==='trick'&&event.text==='CABLE GRIND')noise(.12,.1,2200);
  }
  function effect(event){
    if(!enabled||!playing||document.hidden||!mediaClip(event))return;
    try{if(renderOutput(event))return;}catch{}
    // Only a very brief unlock interruption may retain a cue. Never replay a
    // backlog after a slow load or returning from another app.
    if(pending.length>=24)pending.shift();pending.push({event:{...event},at:now()});
    if(context)resumeContext();
  }
  function burst(){effect({type:'burst'});}
  function setPlaying(value){
    playing=Boolean(value);if(!playing)stopEffects();else{flush();primeAnchor();}syncMusic();
    if(!playing&&!anchorPriming)try{anchor?.pause();}catch{}
  }
  // Audio is enabled by the first normal play/input gesture. There is no
  // button or persisted mute preference that could silently disable it.
  window.addEventListener('click',unlock,{passive:true});
  window.addEventListener('pointerdown',unlock,{passive:true});
  window.addEventListener('touchend',unlock,{passive:true});
  window.addEventListener('keydown',unlock);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){stopEffects();try{anchor?.pause();}catch{}}
    else if(playing)unlock();syncMusic();
  });
  window.RushSound={unlock,effect,burst,setPlaying};
})();
