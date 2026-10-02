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
    walletRequest++;
    ui['verify-button'].disabled = true;
    cancelAnimationFrame(raf); releaseInput();
    phase = 'loading';
    ui['pause-panel'].hidden = true; ui.warning.hidden = true;
    ui.trick.classList.remove('visible'); ui.trick.textContent = '';
    ui['mode-label'].textContent = 'DAILY RUN';
    ui.countdown.textContent = 'LOADING';
    show('game-screen'); resizeGame(); drawLoading();
    try {
      if (!ctx || typeof VaultRush === 'undefined' || typeof VaultRushRenderer === 'undefined') throw new Error('Game unavailable');
      // Load artwork before reserving a scored run ticket.
      const images=await artworkReady();
      if(operation!==startId)return;
      const onlineTicket=await window.RushOnline.prepare();
      if (operation !== startId) return;
      if(!onlineTicket?.id||!onlineTicket.wallet||!Number.isInteger(onlineTicket.seed))throw new Error('Could not reserve your run. Please retry.');
      setRunTicket(onlineTicket);
      if(onlineTicket?.wallet)wallet=onlineTicket.wallet;
      ui['mode-label'].textContent='DAILY RUN';
      renderer = new VaultRushRenderer.Renderer(ctx,images);
      run = new VaultRush.Run(onlineTicket.seed); renderer.reset(run); renderer.breakout(run); renderer.draw(run);
      sound.setPlaying(true);
      phase = 'countdown'; countdown = 1.7; accumulator = 0; trickTime = 0;
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
    ui.speed.textContent = Math.round(run.player.speed * .1);
    ui.warning.hidden = !(run.dog.active && run.dog.warning);
  }
  function events() {
    for (const event of run.drainEvents()) {
      renderer.handle(event);
      sound.effect(event);
      if (event.type === 'trick') {
        ui.trick.textContent = event.text;
        if (event.points) {
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
        ui.trick.textContent='BUMP · KEEP MOVING';
        ui.trick.classList.add('visible');trickTime=.8;
      }
      if (event.type === 'crash') { phase = 'crashed'; resultDelay = .85; releaseInput(); }
    }
  }
  function finish() {
    phase = 'result'; releaseInput();
    sound.setPlaying(false);
    ui['final-distance'].textContent = Math.floor(run.player.x / 10) + 'm';
    ui['final-score'].textContent = Math.floor(run.score).toLocaleString();
    ui['final-coins'].textContent = run.coins;
    $('personal-best').textContent='';
    $('result-quest').textContent='Checking daily quest…';
    $('run-pickups').textContent=run.redTokens+' RED RUSH · '+run.rushPickups+' SPEED BURST'+(run.rushPickups===1?'':'S');
    ui['result-kicker'].textContent = 'DAILY RUN';
    ui['result-reason'].textContent = run.reason || 'RUN ENDED';
    ui['result-copy'].textContent = 'Reward address '+wallet.slice(0,4)+'…'+wallet.slice(-4)+'. Enabled prizes are reviewed and paid by the team.';
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
  function loop(now) {
    const dt = Math.max(0,Math.min(.08,(now - last) / 1000)); last = now;
    if (phase === 'countdown') {
      const before=countdown;
      countdown -= dt;
      if(before>1.08&&countdown<=1.08)sound.burst();
      ui.countdown.textContent = countdown > 1.08 ? 'READY' : countdown > .5 ? 'BREAK OUT' : 'RUSH';
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
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) { status('That does not look like a Solana wallet.','error'); return; }
    const request = ++walletRequest;
    ui['verify-button'].disabled = true; status('Starting your free prize run…');
    try {
      if (request !== walletRequest || phase !== 'menu') return;
      wallet=address;window.RushOnline.setWallet(address);
      await begin();
    } catch (error) {
      if (request === walletRequest && phase === 'menu') status(error.message||'Could not start this run. Please retry shortly.','error');
    } finally { if (request === walletRequest) ui['verify-button'].disabled = false; }
  });
})();
