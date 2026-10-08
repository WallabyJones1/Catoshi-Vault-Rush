(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const sound=window.RushSound||{unlock(){},setPlaying(){},effect(){},burst(){}};
  const screens = Array.from(document.querySelectorAll('.screen'));
  const canvas = $('game');
  const shell = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const ui = Object.fromEntries([
    'coins','distance','score','speed','mode-label','warning','trick','countdown',
    'pause-panel','wallet-status','verify-button','final-distance','final-score','final-coins',
    'result-kicker','result-reason','result-copy'
  ].map(id => [id, $(id)]));
  const FIXED_STEP = 1 / 120;
  let run, renderer, artwork;
  let phase = 'menu', resumePhase = 'running', wallet = '';
  let raf = 0, last = 0, accumulator = 0, countdown = 0, resultDelay = 0, trickTime = 0;
  let startId = 0, walletRequest = 0, inputPointer = null, keyHeld = false;
  let ticket=null,ticks=0,recording=[];
  let selectedMode='vault',selectedLevel=1;
  let ghost=null,ghostMessage='',ghostEnabled=true;
  try{ghostEnabled=localStorage.getItem('rush-trial-ghost')!=='off';}catch{}
  const courses=VaultRush.TRIAL_COURSES||[];
  function formatTime(value){
    const hundredths=Math.floor(Math.max(0,value)*100);
    return String(Math.floor(hundredths/6000)).padStart(2,'0')+':'+String(Math.floor(hundredths/100)%60).padStart(2,'0')+'.'+String(hundredths%100).padStart(2,'0');
  }
  function bestKey(level){return 'catoshi-speed-trial:'+VaultRush.VERSION+':'+level+':'+$('wallet').value.trim();}
  function trialBest(level){
    try{const value=Number(localStorage.getItem(bestKey(level)));return Number.isFinite(value)&&value>0?value:null;}catch{return null;}
  }
  function trialMenu(){
    const list=$('trial-levels');list.textContent='';
    for(const course of courses){
      const button=document.createElement('button'),label=document.createElement('strong'),detail=document.createElement('small');
      button.type='button';button.className='trial-level';button.setAttribute('aria-pressed',String(course.id===selectedLevel));
      label.textContent=String(course.id).padStart(2,'0')+' · '+course.name;
      const best=trialBest(course.id);
      detail.textContent=Math.floor(course.distance/10)+'m · '+(best?'BEST '+formatTime(best):'NO TIME YET');
      button.appendChild(label);button.appendChild(detail);
      button.addEventListener('click',()=>{selectedLevel=course.id;trialMenu();});list.appendChild(button);
    }
    const course=courses.find(c=>c.id===selectedLevel);
    if(course)$('trial-target').textContent='PUBLIC BEST TIMES · '+Math.floor(course.distance/10)+'m';
  }
  function ghostSetting(){
    $('ghost-toggle').setAttribute('aria-pressed',String(ghostEnabled));
    $('ghost-toggle').textContent='FASTEST GHOST · '+(ghostEnabled?'ON':'OFF');
    if(renderer)renderer.ghost=ghostEnabled?ghost:null;
  }
  async function loadGhost(operation,level){
    ghostMessage='Loading fastest ghost…';
    try{
      const response=await window.RushOnline.loadTrialGhost(level);
      if(operation!==startId||run?.mode!=='trial'||run.trial.id!==level)return;
      ghost=response.ghost?new VaultRushGhost.Track(response,VaultRush.VERSION,level):null;
      ghostMessage=ghost?'':'Set the first time';
      renderer.ghost=ghostEnabled?ghost:null;
    }catch{
      if(operation!==startId)return;
      ghostMessage='Ghost unavailable';
    }
    updateHud();
  }
  function selectMode(mode){
    if(phase!=='menu')return;
    selectedMode=mode;
    const trial=mode==='trial';
    $('mode-vault').setAttribute('aria-pressed',String(!trial));$('mode-trial').setAttribute('aria-pressed',String(trial));
    $('trial-menu').hidden=!trial;$('holder-entry').classList.toggle('trials-selected',trial);
    ui['verify-button'].textContent=trial?'START SPEED TRIAL':'PLAY';status('');trialMenu();
  }

  function show(id) { screens.forEach(screen => screen.classList.toggle('active',screen.id === id)); }
  function status(message, kind) {
    ui['wallet-status'].textContent = message;
    ui['wallet-status'].className = 'status' + (kind ? ' ' + kind : '');
  }
  function releaseHeld() {
    if(run?.player.held){if(ticket)recording.push([ticks,0]);run.release();}
  }
  function releaseInput() {
    inputPointer = null; keyHeld = false;
    releaseHeld();
  }
  function backToMenu() {
    startId++; walletRequest++;
    window.RushOnline?.cancelSubmission?.();
    cancelAnimationFrame(raf); releaseInput();
    phase = 'menu'; ui['pause-panel'].hidden = true;
    sound.setPlaying(false);
    ui.countdown.textContent = ''; ui['verify-button'].disabled = false;
    show('gate');
  }
  function drawLoading() {
    if (!ctx) return;
    ctx.fillStyle = '#0a0908'; ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  function resizeGame() {
    if(!shell?.clientWidth||!shell?.clientHeight)return;
    const portrait=shell.clientHeight>shell.clientWidth;
    const width=portrait?600:960;
    const height=Math.round(width*shell.clientHeight/shell.clientWidth);
    if(canvas.width===width&&canvas.height===height)return;
    canvas.width=width;canvas.height=height;
    if(renderer&&run){renderer.resize(run);renderer.draw(run);}
  }
  function artworkReady() {
    if (!artwork) {
      artwork = VaultRushRenderer.loadAssets().catch(error => { artwork = null; throw error; });
    }
    return artwork;
  }
  async function begin() {
    if(phase==='loading')return;
    sound.unlock(); sound.setPlaying(false);
    const operation = ++startId;
    window.RushOnline?.cancelSubmission?.();
    $('retry-trial').hidden=true;
    walletRequest++;
    ui['verify-button'].disabled = true;
    cancelAnimationFrame(raf); releaseInput();
    phase = 'loading';
    ui['pause-panel'].hidden = true; ui.warning.hidden = true;
    ui.trick.classList.remove('visible'); ui.trick.textContent = '';
    ui['mode-label'].textContent = 'WEEKLY RUN';
    ui.countdown.textContent = 'LOADING';
    show('game-screen'); resizeGame(); drawLoading();
    try {
      if (!ctx || typeof VaultRush === 'undefined' || typeof VaultRushRenderer === 'undefined') throw new Error('Game unavailable');
      // Load artwork before reserving a scored run ticket.
      const images=await artworkReady();
      if(operation!==startId)return;
      const trial=selectedMode==='trial';
      const onlineTicket=trial?await window.RushOnline.prepareTrial(selectedLevel):await window.RushOnline.prepare();
      if (operation !== startId) return;
      if(!onlineTicket?.id||(trial?onlineTicket.level!==selectedLevel:!Number.isInteger(onlineTicket.seed)))throw new Error('Could not reserve your run. Please retry.');
      setRunTicket(onlineTicket);
      if(trial)try{
        if(onlineTicket.best)localStorage.setItem(bestKey(selectedLevel),String(onlineTicket.best.timeMs/1000));
        else localStorage.removeItem(bestKey(selectedLevel));
      }catch{}
      wallet=onlineTicket?.wallet||'';
      ui['mode-label'].textContent=trial?'TRIAL '+selectedLevel+' / 5':'WEEKLY RUN';
      $('trial-clock').hidden=!trial;$('hud-pickups').hidden=trial;$('lives').hidden=false;ui.score.hidden=trial;
      const best=trialBest(selectedLevel);$('trial-best-time').textContent=trial&&best?'PB '+formatTime(best):'';
      renderer = new VaultRushRenderer.Renderer(ctx,images);
      run = trial?new VaultRush.Trial(selectedLevel):new VaultRush.Run(onlineTicket.seed);
      ghost=null;ghostMessage='';
      if(trial&&ghostEnabled)loadGhost(operation,selectedLevel);
      renderer.reset(run); renderer.breakout(run); renderer.draw(run);
      sound.setPlaying(true);
      phase = 'countdown'; countdown = VaultRushRenderer.INTRO_DURATION || 1.25; accumulator = 0; trickTime = 0;
      ui.countdown.textContent = 'READY';
      updateHud(); last = performance.now();
      canvas.focus({ preventScroll: true });
      raf = requestAnimationFrame(loop);
    } catch (error) {
      if (operation !== startId) return;
      backToMenu();
      status(error.message||'The game could not load. Please check your connection and press Play again.','error');
    }
  }
  function setRunTicket(value){ticket=value;ticks=0;recording=[];}
  function updateHud() {
    if (!run) return;
    ui.coins.textContent = run.coins;
    $('run-red').textContent=run.redTokens+' / 5';
    $('rush-burst').hidden=run.player.rush<=0;
    $('rush-time').textContent=run.player.rush.toFixed(1)+'s';
    $('rush-meter').value=run.player.rush;
    ui.distance.textContent = Math.floor(run.player.x / 10) + 'm';
    ui.score.textContent = String(Math.floor(run.score)).padStart(6,'0');
    const lives=$('lives');
    lives.setAttribute('aria-label',run.lives+' of '+run.maxLives+' lives');
    lives.classList.toggle('last-life',run.lives===1);
    for(let i=1;i<=run.maxLives;i++)$('life-'+i).classList.toggle('empty',i>run.lives);
    ui.speed.textContent = Math.round(run.player.speed * .1);
    if(run.mode==='trial'){
      $('trial-time').textContent=formatTime(run.finishTime??run.time);
      $('trial-distance').value=Math.min(1,run.player.x/run.trial.distance);
      ui.distance.textContent=Math.max(0,Math.ceil((run.trial.distance-run.player.x)/10))+'m TO GO';
      $('ghost-status').hidden=!ghostEnabled;
      $('ghost-name').textContent=ghost?'GHOST · '+ghost.name+' · '+formatTime(ghost.timeMs/1000):ghostMessage;
      const delta=ghost?ghost.delta(run.finishTime??run.time,run.player.x):0;
      $('ghost-gap').textContent=ghost?(Math.abs(delta)<.01?'LEVEL':(delta<0?'−':'+')+Math.abs(delta).toFixed(2)+'s '+(delta<0?'AHEAD':'BEHIND')):'';
      $('ghost-gap').classList.toggle('ahead',Boolean(ghost)&&delta<-.01);
    }
    const cargo=run.items.some(item=>item.type==='cargo'&&item.drop.at!==null&&!item.drop.landed&&item.x>run.player.x-50&&item.x-run.player.x<1000);
    const sand=run.player.grounded&&run.sandAt(run.player.x)>.2;
    ui.warning.hidden=!(run.dog.warning||cargo||sand);
    ui.warning.textContent=run.dog.warning?'HOUND CLOSING · JUMP OR BOOST':cargo?'INCOMING CARGO ↓':'SOFT SAND · JUMP TO KEEP SPEED';
    ui.warning.classList.toggle('sand-warning',!run.dog.warning&&!cargo&&sand);
  }
  function events() {
    for (const event of run.drainEvents()) {
      renderer.handle(event);
      sound.effect(event);
      if (event.type === 'trick') {
        ui.trick.textContent = event.text;
        if (event.points && run.mode!=='trial') {
          const points = document.createElement('small');
          points.textContent = '+' + event.points;
          ui.trick.appendChild(points);
        }
        ui.trick.classList.add('visible'); trickTime = 1.8;
      }
      if(event.type==='rush'||event.type==='redRush'){
        ui.trick.textContent=event.type==='rush'?'RUSH · 7s SPEED + SHIELD':'RED RUSH · '+event.total+' / 5 THIS RUN';
        ui.trick.classList.add('visible');trickTime=1.8;
      }
      if(event.type==='stumble'){
        ui.trick.textContent=event.lifeLost?(event.fatal?'OUT OF LIVES':event.lives+' '+(event.lives===1?'LIFE':'LIVES')+' LEFT'):'BUMP · KEEP MOVING';
        ui.trick.classList.add('visible');trickTime=.8;
      }
      if(event.type==='heart'){
        ui.trick.textContent='+1 LIFE';
        ui.trick.classList.add('visible');trickTime=1.3;
      }
      if(event.type==='escape'){
        ui.trick.textContent='HOUND EVADED · +150';ui.trick.classList.add('visible');trickTime=1.5;
      }
      if(event.type==='finish'){phase='crashed';resultDelay=.65;releaseInput();ui.countdown.textContent='FINISH';}
      if (event.type === 'crash') { phase = 'crashed'; resultDelay = .85; releaseInput(); }
    }
  }
  function finish() {
    phase = 'result'; releaseInput();
    sound.setPlaying(false);
    $('final-score-label').textContent='SCORE';$('final-coins-label').textContent='GOLD';
    $('next-trial').hidden=true;$('result-leaderboard').hidden=false;$('result-trial-leaderboard').hidden=true;$('retry-trial').hidden=true;$('share-actions').hidden=false;
    if(run.mode==='trial'){finishTrial();return;}
    ui['final-distance'].textContent = Math.floor(run.player.x / 10) + 'm';
    ui['final-score'].textContent = Math.floor(run.score).toLocaleString();
    ui['final-coins'].textContent = run.coins;
    $('personal-best').textContent='';
    $('result-quest').textContent='Checking daily quest…';
    $('run-pickups').textContent=run.redTokens+' RED RUSH · '+run.rushPickups+' SPEED BURST'+(run.rushPickups===1?'':'S');
    ui['result-kicker'].textContent = 'WEEKLY RUN';
    ui['result-reason'].textContent = run.reason || 'RUN ENDED';
    ui['result-copy'].textContent = wallet
      ? 'Reward address '+wallet.slice(0,4)+'…'+wallet.slice(-4)+'. Enabled prizes are reviewed and paid by the team.'
      : 'Add a rewards wallet before your next run to enter token prizes.';
    ui['submission-status']=$('submission-status');
    $('share-status').textContent='';
    window.RushOnline.share(run,null);
    const finishedRun=run,finishedTicket=ticket,finishedTicks=ticks,finishedRecording=recording.slice(),finishedStart=startId;
    show('result');
    window.RushOnline.submit(finishedTicket,finishedTicks,finishedRecording).then(result=>{
      if(finishedStart!==startId||phase!=='result')return;
      if(result){ui['final-score'].textContent=result.run.score.toLocaleString();ui['final-distance'].textContent=result.run.distance+'m';ui['final-coins'].textContent=result.run.coins;}
      window.RushOnline.share(finishedRun,result);
    });
  }
  function finishTrial(){
    const course=run.trial,seconds=run.finishTime,complete=run.finished&&Number.isFinite(seconds);
    ui['result-kicker'].textContent='SPEED TRIAL '+course.id+' / 5 · '+course.name;
    ui['result-reason'].textContent=complete?'COURSE COMPLETE':run.reason;
    ui['final-distance'].textContent=Math.floor(run.player.x/10)+'m';
    $('final-score-label').textContent='TIME';ui['final-score'].textContent=complete?formatTime(seconds):'—';
    $('final-coins-label').textContent='BOOSTS';ui['final-coins'].textContent=run.boostsCollected;
    const ghostDifference=ghost?seconds-ghost.timeMs/1000:0;
    $('run-pickups').textContent=complete&&ghost?(Math.abs(ghostDifference)<.005?'MATCHED THE GHOST':
      (ghostDifference<0?'BEAT THE GHOST BY ':'GHOST FINISHED ')+Math.abs(ghostDifference).toFixed(2)+'s'+(ghostDifference<0?'':' AHEAD')):'';
    $('personal-best').textContent='';
    $('result-quest').textContent='';$('submission-status').textContent='';$('share-status').textContent='';
    ui['result-copy'].textContent=complete?'Your fastest checked finish counts on this track’s public leaderboard.':'Jump before the red gap markers. Ride again to finish the course.';
    $('result-leaderboard').hidden=true;$('next-trial').hidden=!complete||course.id===5;
    $('result-trial-leaderboard').hidden=false;
    $('share-actions').hidden=!complete;if($('score-picture'))$('score-picture').hidden=true;
    if(complete)window.RushOnline.share(run,null);
    trialMenu();show('result');
    if(!complete)return;
    const finishedRun=run,finishedTicket=ticket,finishedTicks=ticks,finishedInputs=recording.slice(),finishedStart=startId,key=bestKey(course.id);
    async function postTime(){
      $('retry-trial').hidden=true;$('submission-status').textContent='Checking your finish and saving your time…';
      try{
        const result=await window.RushOnline.submitTrial(finishedTicket,finishedTicks,finishedInputs);
        if(finishedStart!==startId||phase!=='result')return;
        ui['final-score'].textContent=formatTime(result.run.timeMs/1000);
        $('submission-status').textContent='Replay checked · '+(result.rank?'#'+result.rank+' ON THIS TRACK':'TIME SAVED');
        $('personal-best').textContent=result.best?'PERSONAL BEST · '+formatTime(result.best.timeMs/1000)+(result.best.rank?' · #'+result.best.rank:''):'';
        if(result.best)try{localStorage.setItem(key,String(result.best.timeMs/1000));}catch{}
        window.RushOnline.share(finishedRun,result);trialMenu();
      }catch(error){
        if(finishedStart!==startId||phase!=='result')return;
        $('submission-status').textContent='Time not posted: '+error.message;$('retry-trial').hidden=false;
      }
    }
    $('retry-trial').onclick=postTime;postTime();
  }
  function loop(now) {
    const dt = Math.max(0,Math.min(.08,(now - last) / 1000)); last = now;
    if (phase === 'countdown') {
      const before=countdown;
      countdown -= dt;
      const breach=VaultRushRenderer.BREACH_REMAINING || .91;
      if(before>breach&&countdown<=breach)sound.burst();
      ui.countdown.textContent = countdown > breach ? 'READY' : countdown > .38 ? 'BREAK OUT' : '';
      if (countdown <= 0) { phase = 'running'; ui.countdown.textContent = ''; accumulator = 0; }
    } else if (phase === 'running') {
      accumulator += dt;
      while (accumulator >= FIXED_STEP && phase === 'running') {
        run.step(FIXED_STEP); ticks++;
        if(ticks>=(ticket?.maxTicks||72000)&&!run.dead)run.crash('TIME LIMIT');
        events(); accumulator -= FIXED_STEP;
      }
      trickTime -= dt;
      if (trickTime <= 0) ui.trick.classList.remove('visible');
      updateHud();
    } else if (phase === 'crashed') {
      resultDelay -= dt;
      if (resultDelay <= 0) { finish(); return; }
    }
    if (phase !== 'paused') renderer.update(run,dt,phase==='running'?accumulator/FIXED_STEP:1);
    renderer.draw(run);
    if (['running','countdown','paused','crashed'].includes(phase)) raf = requestAnimationFrame(loop);
  }
  function pause() {
    if (phase === 'paused') return;
    if (phase !== 'running' && phase !== 'countdown') return;
    resumePhase = phase; phase = 'paused'; releaseInput(); accumulator = 0;
    sound.setPlaying(false);
    ui['pause-panel'].hidden = false; ui.countdown.textContent = '';
  }
  function resume() {
    if (phase !== 'paused') return;
    phase = resumePhase; ui['pause-panel'].hidden = true;
    sound.unlock(); sound.setPlaying(true);
    last = performance.now(); accumulator = 0;
    canvas.focus({ preventScroll: true });
  }
  function press() {
    if (phase !== 'running') return;
    if(run.player.held)return;
    if(ticket)recording.push([ticks,1]);
    run.press(); events();
  }
  function bindPointer(element) {
    element.addEventListener('pointerdown',event => {
      if (phase !== 'running' || inputPointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault(); inputPointer = event.pointerId;
      try { element.setPointerCapture(event.pointerId); } catch (_) {}
      press();
    });
    const up = event => {
      if (event.pointerId !== inputPointer) return;
      event.preventDefault(); inputPointer = null;
      if (!keyHeld) releaseHeld();
    };
    element.addEventListener('pointerup',up);
    element.addEventListener('pointercancel',up);
    element.addEventListener('lostpointercapture',up);
    element.addEventListener('contextmenu',event => event.preventDefault());
  }

  // Prize entry is free; rewards are bound to the pasted public address.
  $('mode-vault').addEventListener('click',()=>selectMode('vault'));
  $('mode-trial').addEventListener('click',()=>selectMode('trial'));
  $('ghost-toggle').addEventListener('click',()=>{ghostEnabled=!ghostEnabled;try{localStorage.setItem('rush-trial-ghost',ghostEnabled?'on':'off');}catch{}ghostSetting();});
  ghostSetting();
  $('next-trial').addEventListener('click',()=>{selectedLevel=Math.min(5,selectedLevel+1);begin();});
  $('trial-leaderboard-button').addEventListener('click',()=>window.RushOnline.openTrialBoard(selectedLevel));
  $('result-trial-leaderboard').addEventListener('click',()=>window.RushOnline.openTrialBoard(run?.trial?.id||selectedLevel));
  trialMenu();
  const linkedTrial=Number(new URLSearchParams(location.search||'').get('trial')||document.body?.dataset?.trial);
  if(courses.some(course=>course.id===linkedTrial)){selectedLevel=linkedTrial;selectMode('trial');}
  $('again').addEventListener('click',() => begin());
  $('change-wallet').addEventListener('click',backToMenu);
  $('pause-menu').addEventListener('click',backToMenu);
  $('pause').addEventListener('click',pause);
  $('resume').addEventListener('click',resume);
  window.addEventListener('resize',resizeGame);
  if(typeof ResizeObserver!=='undefined'&&shell)new ResizeObserver(resizeGame).observe(shell);
  bindPointer(canvas); bindPointer($('jump-control'));
  window.addEventListener('pointerup',event => {
    if (event.pointerId === inputPointer) { inputPointer = null; if (!keyHeld) releaseHeld(); }
  });
  // Safari can select labels during a long jump/flip press. Block selection
  // only in the play area; name and optional wallet fields keep normal editing.
  const playArea=$('game-screen');
  playArea.addEventListener('selectstart',event=>event.preventDefault());
  playArea.addEventListener('contextmenu',event=>event.preventDefault());
  window.addEventListener('keydown',event => {
    const editing = ['INPUT','TEXTAREA'].includes(event.target?.tagName) || event.target?.isContentEditable;
    if (editing || phase === 'menu' || phase === 'result' || phase === 'loading') return;
    if (['Space','ArrowUp','KeyW'].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat && !keyHeld && phase === 'running') { keyHeld = true; press(); }
    } else if (event.code === 'Escape' || event.code === 'KeyP') {
      if (!event.repeat) { event.preventDefault(); phase === 'paused' ? resume() : pause(); }
    } else if (event.code === 'KeyR' && !event.repeat) begin();
  });
  window.addEventListener('keyup',event => {
    if (['Space','ArrowUp','KeyW'].includes(event.code)) { keyHeld = false; if (inputPointer === null) releaseHeld(); }
  });
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',() => { if (document.hidden) pause(); });
  $('wallet-form').addEventListener('submit',async event => {
    event.preventDefault();
    if(phase!=='menu'||ui['verify-button'].disabled)return;
    const address = $('wallet').value.trim();
    if (address && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) { status('That does not look like a Solana wallet. Leave it blank to play without one.','error'); return; }
    const request = ++walletRequest;
    ui['verify-button'].disabled = true; status('Starting your run…');
    try {
      if (request !== walletRequest || phase !== 'menu') return;
      wallet=address;window.RushOnline.setWallet(address);
      await begin();
    } catch (error) {
      if (request === walletRequest && phase === 'menu') status(error.message||'Could not start this run. Please retry shortly.','error');
    } finally { if (request === walletRequest) ui['verify-button'].disabled = false; }
  });
})();
