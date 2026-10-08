(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const sound=window.RushSound||{unlock(){},setPlaying(){},effect(){},burst(){}};
  // Prime audio during the actual tap, not the asynchronous race-ticket callback.
  document.addEventListener('pointerdown',()=>sound.unlock(),{capture:true,passive:true});
  document.addEventListener('keydown',()=>sound.unlock(),{capture:true});
  const screens=Array.from(document.querySelectorAll('.screen'));
  const canvas=$('game'),shell=canvas.parentElement,ctx=canvas.getContext('2d');
  const STEP=1/60;
  let run=null,renderer=null,prediction=null,remotes=null,lastSnapshotAt=0,connected=true,artwork=null,ticket=null,lastRaceMode='public',phase='menu',raf=0,last=0,accumulator=0,countdown=0,trickTime=0,inputPointer=null,keyHeld=false,startId=0;

  function show(id){screens.forEach(screen=>screen.classList.toggle('active',screen.id===id));}
  function setStatus(message,kind=''){window.RushMultiplayer?.setStatus?.(message,kind);}
  function send(type){const seq=window.RushMultiplayer?.input?.(type);prediction?.record(type,seq);}
  function releaseHeld(){if(run?.player.held){send('jumpUp');run.release();}}
  function releaseInput(){inputPointer=null;keyHeld=false;releaseHeld();}
  function stopRace({forfeit=false}={}){if(forfeit&&ticket?.matchId&&phase!=='result')window.RushMultiplayer?.forfeit?.();startId++;cancelAnimationFrame(raf);releaseInput();sound.setPlaying(false);run=null;renderer=null;ticket=null;phase='menu';$('race-standings').hidden=true;window.RushMultiplayer?.leaveRaceView?.();show('multiplayer-home');window.RushMultiplayer?.returnHome?.();}
  function drawLoading(){if(!ctx)return;ctx.fillStyle='#0a0908';ctx.fillRect(0,0,canvas.width,canvas.height);}
  function resizeGame(){if(!shell?.clientWidth||!shell?.clientHeight)return;const portrait=shell.clientHeight>shell.clientWidth,width=portrait?600:960,height=Math.round(width*shell.clientHeight/shell.clientWidth);if(canvas.width===width&&canvas.height===height)return;canvas.width=width;canvas.height=height;if(renderer&&run){renderer.resize(run);renderer.draw(run);}}
  function artworkReady(){if(!artwork)artwork=VaultRushRenderer.loadAssets().catch(error=>{artwork=null;throw error;});return artwork;}

  async function begin(multiplayerTicket){
    if(phase==='loading'||!multiplayerTicket?.matchId)return;
    sound.unlock();sound.setPlaying(false);const operation=++startId,receivedAt=performance.now();cancelAnimationFrame(raf);releaseInput();phase='loading';ticket=multiplayerTicket;lastRaceMode=ticket.mode||'public';$('mode-label').textContent=(ticket.trackName||'MULTIPLAYER')+' · '+ticket.playerCount+' RACERS';$('countdown').textContent='LOADING';$('race-standings').hidden=false;show('game-screen');resizeGame();drawLoading();
    try{
      if(!ctx||typeof VaultRace==='undefined'||typeof VaultRushRenderer==='undefined'||typeof VaultRaceNet==='undefined')throw Error('Multiplayer game unavailable.');
      const images=await artworkReady();if(operation!==startId)return;
      renderer=new VaultRushRenderer.Renderer(ctx,images);run=new VaultRace.RaceRun(ticket.trackId);prediction=new VaultRaceNet.Prediction(run);remotes=new VaultRaceNet.RemoteBuffer();connected=true;lastSnapshotAt=performance.now();renderer.setRaceIdentity?.({name:window.RushMultiplayer?.name?.()||'YOU',color:window.RushMultiplayer?.color?.()||'#f4c542',seat:ticket.seat});renderer.reset(run);renderer.breakout(run);renderer.draw(run);
      const delay=ticket.startDelayMs??ticket.startAt-(ticket.serverTime??Date.now());
      phase='countdown';countdown=Math.max(.05,(delay-(performance.now()-receivedAt))/1000);accumulator=0;trickTime=0;$('countdown').textContent='READY';updateHud();sound.setPlaying(true);last=performance.now();canvas.focus({preventScroll:true});raf=requestAnimationFrame(loop);
      const latest=window.RushMultiplayer?.current?.()?.snapshot;if(latest?.matchId===ticket.matchId)multiplayerSnapshot(latest);
    }catch(error){if(operation!==startId)return;stopRace({forfeit:true});setStatus(error.message||'Could not load the race. Please retry.','error');}
  }

  function updateHud(){if(!run)return;const required=window.VaultRace?.COINS_PER_SHOT||5;const cd=Math.max(0,run.shotCooldown||0);$('coins').textContent=run.coins;$('ammo-count').textContent=cd>.05?cd.toFixed(1)+'s':run.coins>=required?'READY':run.coins+'/'+required;$('fire-control').disabled=phase!=='running'||cd>.05||run.coins<required;$('fire-status').textContent=cd>.05?cd.toFixed(1)+'s RELOAD':run.coins>=required?'READY · '+required+' COINS':run.coins+'/'+required+' COINS';$('rush-burst').hidden=run.player.boost<=0;$('boost-count').textContent=run.boostCharges+' / '+(window.VaultRace?.MAX_BOOST_CHARGES||3);$('boost-control').disabled=phase!=='running'||!run.boostCharges;$('rush-time').textContent=run.player.boost.toFixed(1)+'s';$('rush-meter').value=run.player.boost;$('distance').textContent=Math.floor(run.player.x/10)+'m';$('score').textContent=String(Math.floor(run.score)).padStart(6,'0');$('speed').textContent=Math.round(run.player.speed*.1);}
  function handleLocalEvents(){
    if(!run)return;for(const event of run.drainEvents()){
      renderer.handle(event);sound.effect(event);
      if(event.type==='trick'){ $('trick').textContent=event.text;if(event.points){const pts=document.createElement('small');pts.textContent='+'+event.points;$('trick').appendChild(pts);}$('trick').classList.add('visible');trickTime=1.5; }
      else if(event.type==='shot'){ $('trick').textContent='COIN SHOT · 3.5s RELOAD';$('trick').classList.add('visible');trickTime=.65; }
      else if(event.type==='rush'){ $('trick').textContent='BOOST ACTIVE';$('trick').classList.add('visible');trickTime=1; }
      else if(event.type==='respawn'){ $('trick').textContent='GAP RESET · KEEP RACING';$('trick').classList.add('visible');trickTime=1.2; }
    }
  }
  function loop(now){
    const dt=Math.max(0,Math.min(.08,(now-last)/1000));last=now;
    if(phase==='countdown'){
      countdown-=dt;$('countdown').textContent=countdown>.8?'READY':countdown>.15?'GO!':'';if(countdown<=0){phase='running';$('countdown').textContent='';accumulator=0;}
    }else if(phase==='running'){
      if(connected&&now-lastSnapshotAt<1500){accumulator+=dt;while(accumulator>=STEP&&phase==='running'){prediction.step();handleLocalEvents();accumulator-=STEP;}$('countdown').textContent=run.finished?'FINISH!':'';}else{accumulator=0;$('countdown').textContent='RECONNECTING';}
      trickTime-=dt;if(trickTime<=0)$('trick').classList.remove('visible');updateHud();
    }
    const remote=remotes.sample(now);renderer.setRaceEntities(remote.players.filter(p=>p.seat!==ticket.seat));renderer.setProjectiles(remote.projectiles);renderer.networkOffset=prediction.smooth(dt);
    renderer.update(run,dt,phase==='running'?accumulator/STEP:1);renderer.draw(run);if(['running','countdown'].includes(phase))raf=requestAnimationFrame(loop);
  }
  function press(){if(phase!=='running'||!connected||run?.player.held)return;send('jumpDown');run.press();handleLocalEvents();}
  function fire(){if(phase!=='running'||!connected||!run?.spendShot?.())return;send('fire');handleLocalEvents();updateHud();}
  function boost(){if(phase!=='running'||!connected||!run?.activateBoost?.())return;send('boost');handleLocalEvents();updateHud();}

  function multiplayerSnapshot(snapshot){
    if(!run||!ticket||snapshot.matchId!==ticket.matchId)return;const me=snapshot.players.find(p=>p.seat===ticket.seat);
    if(!me||!prediction.reconcile(snapshot,ticket.seat))return;
    lastSnapshotAt=performance.now();connected=true;remotes.push(snapshot,lastSnapshotAt);
    if(phase==='countdown'&&snapshot.status==='running'){phase='running';accumulator=0;last=performance.now();$('countdown').textContent='';}
    updateHud();
  }
  function multiplayerEvent(event){
    if(!renderer||!run)return;
    if(event.type==='hit'&&event.to===ticket?.seat){renderer.handle({type:'stumble',x:run.player.x,y:run.player.y,heavy:false,material:'metal',kind:'coin-shot',lifeLost:false});sound.effect({type:'metal'});$('trick').textContent='HIT BY COIN SHOT';$('trick').classList.add('visible');trickTime=.9;}
    else if(event.type==='boost'&&event.seat===ticket?.seat){$('trick').textContent='BOOST READY · PRESS B';$('trick').classList.add('visible');trickTime=1;}
    else if(event.type==='finish'&&event.seat===ticket?.seat){$('trick').textContent='FINISH!';$('trick').classList.add('visible');trickTime=1.2;}
  }
  function multiplayerFinished(match){
    if(!match)return;cancelAnimationFrame(raf);releaseInput();phase='result';sound.setPlaying(false);const you=match.players.find(p=>p.you);show('result');$('final-distance').textContent=you?.finishMs!=null?'#'+(you?.placement||'—'):(you?.distance||0)+'m';$('final-score').textContent=(you?.score||0).toLocaleString();$('final-coins').textContent=(you?.coins||0).toLocaleString();$('run-pickups').textContent=(you?.shots||0)+' SHOTS · '+(you?.hits||0)+' HITS · '+(you?.respawns||0)+' GAP RESETS';$('result-title').innerHTML=you?.forfeited?'RACE<br>DNF':'RACE<br>COMPLETE';
  }

  function bindPointer(element){element.addEventListener('pointerdown',event=>{if(phase!=='running'||inputPointer!==null||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();inputPointer=event.pointerId;try{element.setPointerCapture(event.pointerId);}catch{}press();});const up=event=>{if(event.pointerId!==inputPointer)return;event.preventDefault();inputPointer=null;if(!keyHeld)releaseHeld();};element.addEventListener('pointerup',up);element.addEventListener('pointercancel',up);element.addEventListener('lostpointercapture',up);element.addEventListener('contextmenu',event=>event.preventDefault());}

  $('again').addEventListener('click',()=>{stopRace();setTimeout(()=>(lastRaceMode==='bots'?$('multiplayer-bots'):$('multiplayer-quick')).click(),50);});$('back-multiplayer').addEventListener('click',()=>stopRace());$('leave-race').addEventListener('click',()=>stopRace({forfeit:true}));window.addEventListener('resize',resizeGame);if(typeof ResizeObserver!=='undefined'&&shell)new ResizeObserver(resizeGame).observe(shell);bindPointer(canvas);bindPointer($('jump-control'));$('fire-control').addEventListener('pointerdown',e=>{e.preventDefault();fire();});$('boost-control').addEventListener('pointerdown',e=>{e.preventDefault();boost();});window.addEventListener('pointerup',event=>{if(event.pointerId===inputPointer){inputPointer=null;if(!keyHeld)releaseHeld();}});
  const playArea=$('game-screen');playArea.addEventListener('selectstart',event=>event.preventDefault());playArea.addEventListener('contextmenu',event=>event.preventDefault());
  window.addEventListener('keydown',event=>{const editing=['INPUT','TEXTAREA'].includes(event.target?.tagName)||event.target?.isContentEditable;if(editing||!['running','countdown'].includes(phase))return;if(['Space','ArrowUp','KeyW'].includes(event.code)){event.preventDefault();if(!event.repeat&&!keyHeld&&phase==='running'){keyHeld=true;press();}}else if(['KeyF','KeyX','ArrowDown'].includes(event.code)){if(!event.repeat&&phase==='running'){event.preventDefault();fire();}}else if(['KeyB','ShiftLeft','ShiftRight'].includes(event.code)){if(!event.repeat&&phase==='running'){event.preventDefault();boost();}}else if(event.code==='Escape'&&!event.repeat){event.preventDefault();stopRace({forfeit:true});}});
  window.addEventListener('keyup',event=>{if(['Space','ArrowUp','KeyW'].includes(event.code)){keyHeld=false;if(inputPointer===null)releaseHeld();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&phase==='running'){last=performance.now();accumulator=0;}});

  window.VaultRushGame={startMultiplayer:next=>{if(phase!=='menu'&&ticket?.matchId===next?.matchId)return;begin(next);},multiplayerSnapshot,multiplayerEvent,multiplayerFinished,multiplayerInputAck:reply=>{if(!reply.ok)prediction?.reject(reply.seq);},multiplayerConnection:value=>{connected=value;if(!value){releaseInput();if(prediction)prediction.pending=[];}},returnToMenu:()=>stopRace(),mode:()=>phase};
})();
