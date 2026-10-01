(function () {
  'use strict';
  const $ = id => document.getElementById(id);
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
  let phase = 'menu', resumePhase = 'running', practice = true, wallet = '';
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
    window.RushSound.setPlaying(false);
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
  async function begin(isPractice = practice) {
    window.RushSound.unlock(); window.RushSound.setPlaying(false);
    const operation = ++startId;
    walletRequest++;
    ui['verify-button'].disabled = false;
    cancelAnimationFrame(raf); releaseInput();
    phase = 'loading'; practice = isPractice;
    ui['pause-panel'].hidden = true; ui.warning.hidden = true;
    ui.trick.classList.remove('visible'); ui.trick.textContent = '';
    ui['mode-label'].textContent = practice ? 'PRACTICE' : 'VERIFIED HOLDER RUN';
    ui.countdown.textContent = 'LOADING';
    show('game-screen'); resizeGame(); drawLoading();
    try {
      if (!ctx || typeof VaultRush === 'undefined' || typeof VaultRushRenderer === 'undefined') throw new Error('Game unavailable');
      const [images,onlineTicket] = await Promise.all([artworkReady(),window.RushOnline.prepare(isPractice)]);
      if (operation !== startId) return;
      setRunTicket(onlineTicket);
      renderer = new VaultRushRenderer.Renderer(ctx,images);
      run = new VaultRush.Run(onlineTicket?.seed||Date.now()); renderer.reset(run); renderer.breakout(run); renderer.draw(run);
      window.RushSound.setPlaying(true);
      phase = 'countdown'; countdown = 1.7; accumulator = 0; trickTime = 0;
      ui.countdown.textContent = 'READY';
      updateHud(); last = performance.now();
      canvas.focus({ preventScroll: true });
      raf = requestAnimationFrame(loop);
    } catch (error) {
      if (operation !== startId) return;
      backToMenu();
      status(error.message||'The game could not load. Please check your connection and try Play Practice again.','error');
    }
  }
  function setRunTicket(value){ticket=value;ticks=0;recording=[];}
  function updateHud() {
    if (!run) return;
    ui.coins.textContent = run.coins;
    ui.distance.textContent = Math.floor(run.player.x / 10) + 'm';
    ui.score.textContent = String(Math.floor(run.score)).padStart(6,'0');
    ui.speed.textContent = Math.round(run.player.speed * .1);
    ui.warning.hidden = !(run.dog.active && run.dog.warning);
  }
  function events() {
    for (const event of run.drainEvents()) {
      renderer.handle(event);
      window.RushSound.effect(event);
      if (event.type === 'trick') {
        ui.trick.textContent = event.text;
        if (event.points) {
          const points = document.createElement('small');
          points.textContent = '+' + event.points;
          ui.trick.appendChild(points);
        }
        ui.trick.classList.add('visible'); trickTime = 1.8;
      }
      if (event.type === 'crash') { phase = 'crashed'; resultDelay = .65; releaseInput(); }
    }
  }
  function finish() {
    phase = 'result'; releaseInput();
    window.RushSound.setPlaying(false);
    ui['final-distance'].textContent = Math.floor(run.player.x / 10) + 'm';
    ui['final-score'].textContent = Math.floor(run.score).toLocaleString();
    ui['final-coins'].textContent = run.coins;
    ui['result-kicker'].textContent = practice ? 'PRACTICE RUN' : 'DAILY HOLDER RUN';
    ui['result-reason'].textContent = run.reason || 'RUN ENDED';
    ui['result-copy'].textContent = practice
      ? 'Practice runs do not earn token rewards.'
      : 'Signed wallet '+wallet.slice(0,4)+'…'+wallet.slice(-4)+'. Any prize requires manual review and payment by the team.';
    ui['submission-status']=$('submission-status');
    $('share-status').textContent='';
    window.RushOnline.share(run,practice,null);
    const finishedRun=run,finishedTicket=ticket,finishedTicks=ticks,finishedRecording=recording.slice(),finishedStart=startId;
    show('result');
    window.RushOnline.submit(finishedTicket,finishedTicks,finishedRecording).then(result=>{
      if(finishedStart!==startId||phase!=='result')return;
      if(result){ui['final-score'].textContent=result.run.score.toLocaleString();ui['final-distance'].textContent=result.run.distance+'m';ui['final-coins'].textContent=result.run.coins;}
      window.RushOnline.share(finishedRun,practice,result);
    });
  }
  function loop(now) {
    const dt = Math.max(0,Math.min(.08,(now - last) / 1000)); last = now;
    if (phase === 'countdown') {
      const before=countdown;
      countdown -= dt;
      if(before>1.08&&countdown<=1.08)window.RushSound.burst();
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
    if (phase !== 'paused') renderer.update(run,dt);
    renderer.draw(run);
    if (['running','countdown','paused','crashed'].includes(phase)) raf = requestAnimationFrame(loop);
  }
  function pause() {
    if (phase === 'paused') return;
    if (phase !== 'running' && phase !== 'countdown') return;
    resumePhase = phase; phase = 'paused'; releaseInput(); accumulator = 0;
    window.RushSound.setPlaying(false);
    ui['pause-panel'].hidden = false; ui.countdown.textContent = '';
  }
  function resume() {
    if (phase !== 'paused') return;
    phase = resumePhase; ui['pause-panel'].hidden = true;
    window.RushSound.unlock(); window.RushSound.setPlaying(true);
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

  // Practice and holder login are independent; pasted addresses cannot prove ownership.
  $('practice-button').addEventListener('click',() => begin(true));
  $('again').addEventListener('click',() => begin(practice));
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
    } else if (event.code === 'KeyR' && !event.repeat) begin(practice);
  });
  window.addEventListener('keyup',event => {
    if (['Space','ArrowUp','KeyW'].includes(event.code)) { keyHeld = false; if (inputPointer === null) releaseHeld(); }
  });
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',() => { if (document.hidden) pause(); });
  $('wallet-form').addEventListener('submit',async event => {
    event.preventDefault();
    const address = $('wallet').value.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) { status('That does not look like a Solana wallet.','error'); return; }
    const request = ++walletRequest;
    ui['verify-button'].disabled = true; status('Checking CATOSHI balance…');
    try {
      const balance = await window.RushOnline.balance(address);
      if (request !== walletRequest || phase !== 'menu') return;
      if (!balance.eligible) {
        status(Number(balance.tokens).toLocaleString() + ' CATOSHI found — 50,000 required. Practice is always available.','error');
        return;
      }
      status('50K balance confirmed. Connect and sign above to prove this wallet is yours and join the holder board.','success');
    } catch (_) {
      if (request === walletRequest && phase === 'menu') status('Live balance verification is unavailable. Play Practice works without a wallet.','error');
    } finally { if (request === walletRequest) ui['verify-button'].disabled = false; }
  });
  document.addEventListener('rush-holder-ready',event=>{
    if(phase!=='menu')return;wallet=event.detail.wallet;begin(false);
  });
})();
