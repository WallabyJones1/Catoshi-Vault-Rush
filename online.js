(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  const ENGINE='flow-web-8';
  let config=null,configPromise=null,entryWallet='',lastResult=null,boardTimer=null,boardMode='holder',boardRound=null,previousFocus=null,vaultTimer=null,boardGeneration=0;
  let submissionGeneration=0,lastMode='practice';
  async function api(endpoint,data,timeout=12000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{const response=await fetch('/api/'+endpoint,{
      method:data?'POST':'GET',credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},
      body:data?JSON.stringify(data):undefined,signal:controller.signal
    });
    let value;try{value=await response.json();}catch{throw Error('The leaderboard server is not available here.');}
    if(!response.ok)throw Error(value.error||'Request failed.');return value;
    }catch(error){if(error.name==='AbortError')throw Error('The request timed out. Please retry shortly.');throw error;}
    finally{clearTimeout(timer);}
  }
  async function getConfig(){
    if(config)return config;
    if(!configPromise)configPromise=api('config',null,2500).then(value=>{
      if(value.engine!==ENGINE||(typeof VaultRush!=='undefined'&&VaultRush.VERSION!==ENGINE))throw Error('Please reload to get the current game version.');
      config=value;
      $('practice-note').textContent='Practice board · no token rewards';
      const rewards=value.rewards;
      $('vault-status').textContent=value.vault
        ?'Vault '+value.vault.slice(0,4)+'…'+value.vault.slice(-4)+' · '+(value.prizesEnabled?'rewards enabled · team payout review':'rewards off')
        :'Team vault not configured · rewards off';
      const pool=rewards?tokenText(rewards.catoshiPool)+' CATOSHI'+(Number(rewards.rushPool)>0?' + '+tokenText(rewards.rushPool)+' RUSH':''):value.jackpotTokens+' CATOSHI';
      $('prize-pool').textContent=value.prizesEnabled?pool:'REWARDS OFF';
      $('reward-rule').textContent=value.prizesEnabled
        ?'Daily top 10 holder wallets · '+(rewards?.split||[30,20,12,10,8,6,5,4,3,2]).join(' / ')+'% · team reviews payouts'
        :'Free holder play · daily prizes can be enabled by the team';
      refreshVault();
      if(!vaultTimer)vaultTimer=setInterval(()=>{if(!document.hidden){refreshVault();refreshQuota();}},30000);
      return value;
    }).catch(error=>{configPromise=null;throw error;});
    return configPromise;
  }
  function tokenText(value){
    const [whole,fraction]=String(value??'0').split('.');
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction?'.'+fraction:'');
  }
  function updateQuota(quota){
    if(!quota)return;
    $('holder-runs').textContent=quota.remaining+' OF '+quota.limit+' RUNS LEFT · BEST SCORE COUNTS';
    $('again').disabled=lastMode==='holder'&&quota.remaining===0;
    $('again').textContent=$('again').disabled?'DAILY RUNS USED':'RIDE AGAIN';
  }
  function updateBest(best){
    $('holder-best').textContent=best?'BEST TODAY · '+best.score.toLocaleString()+' POINTS'+(best.pointsMultiplier===2?' · 2× QUEST':'')+(best.rank?' · #'+best.rank:''):'';
  }
  function updateDaily(value){
    if(!value?.quest)return;
    const quest=value.quest;
    $('holder-daily').hidden=false;$('holder-daily').classList.toggle('unlocked',quest.unlocked);
    $('quest-count').textContent=quest.collected+' / '+quest.target+(quest.unlocked?' · 2×':'');
    $('quest-progress').value=Math.min(quest.target,quest.collected);
    $('quest-rule').textContent=quest.unlocked?'2× unlocked for your best run today. A better raw score inherits the bonus. Resets at 00:00 UTC.'
      :'Collect '+quest.remaining+' more red RUSH today to double your best run. Up to 5 per run on distant routes. Only completed, checked runs count. Resets at 00:00 UTC.';
    const history=$('daily-history');history.textContent='';
    for(const [index,run]of (value.history||[]).entries()){
      const li=document.createElement('li'),line=document.createElement('div'),label=document.createElement('span'),score=document.createElement('strong'),detail=document.createElement('small');
      line.className='history-line';label.textContent='RUN '+((value.history||[]).length-index)+' · '+run.status.toUpperCase();
      score.textContent=run.submitted!==null?run.score.toLocaleString()+(run.pointsMultiplier===2?' · 2×':''):'—';
      detail.className='history-detail';detail.textContent=run.submitted!==null?run.name+' · '+run.distance+'m · '+run.redTokens+' red · '+run.rushPickups+' burst'+(run.rushPickups===1?'':'s'):'Each start counts toward the daily 10-run limit.';
      line.appendChild(label);line.appendChild(score);li.appendChild(line);li.appendChild(detail);history.appendChild(li);
    }
    $('history-empty').hidden=Boolean(value.history?.length);
  }
  function updateStatus(value){updateQuota(value.quota);updateBest(value.best);updateDaily(value);}
  async function refreshQuota(){
    if(!entryWallet)return;
    const address=entryWallet;
    try{const value=await api('holder-status?'+new URLSearchParams({wallet:address}));if(address===entryWallet){updateStatus(value);}}catch{}
  }
  async function refreshVault(){
    try{
      const value=await api('vault',null,12000);
      if(!value.configured){$('vault-balance').textContent='—';$('rush-balance').textContent='';return;}
      const cat=value.assets?.find(asset=>asset.symbol==='CATOSHI');
      $('vault-balance').textContent=cat?.available||value.tokens!==null&&value.tokens!==undefined?tokenText(cat?.tokens??value.tokens):'UNAVAILABLE';
      const rush=value.assets?.find(asset=>asset.symbol==='RUSH');
      $('rush-balance').textContent=rush?'RUSH in vault: '+(rush.available?tokenText(rush.tokens):'unavailable'):'';
    }catch{ $('vault-balance').textContent='UNAVAILABLE';$('rush-balance').textContent='Vault balance could not refresh'; }
  }
  let suggestedHolderName='';
  function restoreHolderName(address=$('wallet').value.trim()){
    const field=$('holder-name');
    // Keep a name the player is editing; only replace an automatic suggestion.
    if(field.value.trim()&&field.value!==suggestedHolderName)return;
    let saved='';
    try{saved=localStorage.getItem('rush-holder-name:'+address)||'';}catch{}
    field.value=saved.slice(0,20);suggestedHolderName=field.value;
  }
  function rememberHolderName(address,value){
    try{localStorage.setItem('rush-holder-name:'+address,value);}catch{}
    $('holder-name').value=value;suggestedHolderName=value;
  }
  $('wallet').addEventListener('input',()=>{restoreHolderName();if($('wallet').value.trim()!==entryWallet){$('holder-runs').textContent='10 RUNS A DAY · BEST SCORE COUNTS';updateBest(null);$('holder-daily').hidden=true;}});
  $('wallet').addEventListener('change',()=>restoreHolderName());
  restoreHolderName();
  function name(practice){return (!practice?$('holder-name').value.trim():'')||$('player-name').value.trim()||'Runner';}
  async function prepare(practice){
    submissionGeneration++;lastResult=null;lastMode=practice?'practice':'holder';
    $('again').disabled=false;$('again').textContent='RIDE AGAIN';
    try{
      const displayName=name(practice),rewardWallet=entryWallet;
      await getConfig();
      const ticket=await api('runs/start',{name:displayName,mode:practice?'practice':'holder',engine:ENGINE,...(!practice?{wallet:rewardWallet}:{})});
      if(!practice){rememberHolderName(rewardWallet,displayName);updateStatus(ticket);}
      return ticket;
    }catch(error){
      // Static/offline practice is deliberately independent of the server.
      if(practice){$('practice-note').textContent='Local practice · leaderboard unavailable for this run';return null;}
      throw error;
    }
  }
  async function submit(ticket,ticks,inputs){
    lastResult=null;
    const generation=++submissionGeneration;
    if(!ticket){$('submission-status').textContent='Offline practice · not submitted to the live leaderboard';return null;}
    $('submission-status').textContent='Checking your run and saving your score…';
    try{
      const result=await api('runs/finish',{id:ticket.id,ticks,inputs});
      if(generation!==submissionGeneration)return null;
      lastResult=result;updateStatus(result.daily||result);
      $('submission-status').textContent=(result.rank?'Rank #'+result.rank+' · ':'')+'Replay checked · '+(ticket.mode==='holder'?'daily holder board':'practice board');
      const dayLabel=result.daily&&result.daily.round!==result.run.round?'PREVIOUS UTC DAY':'TODAY';
      $('personal-best').textContent=ticket.mode==='holder'&&result.best
        ?(result.best.id===result.run.id?'BEST RUN ':'YOUR BEST ')+dayLabel+' · '+result.best.score.toLocaleString()+' POINTS'+(result.best.rank?' · #'+result.best.rank:'')
        :'';
      if(ticket.mode==='holder'&&result.quest){
        $('result-quest').textContent=result.quest.unlocked?'RED RUSH QUEST COMPLETE · 2× on your best run for this UTC day.'
          :result.quest.collected+' / 10 RED RUSH TODAY · '+result.quest.remaining+' more to double your best run.';
        if(result.best?.pointsMultiplier===2)$('personal-best').textContent+=' · 2× QUEST';
      }
      return result;
    }catch(error){if(generation===submissionGeneration){$('submission-status').textContent='Score not posted: '+error.message;if(ticket.mode==='holder')$('result-quest').textContent='This run has not been added to your daily quest.';}return null;}
  }
  function share(run,practice,result){
    const checked=result?.run;
    const score=checked?.score??Math.floor(run.score),distance=checked?.distance??Math.floor(run.player.x/10);
    const kind=checked?checked.mode+' run':'local practice';
    const text=`I escaped ${distance}m with ${score.toLocaleString()} points in Catoshi Vault Rush! (${kind}) Can you beat it? #Catoshi`;
    const url=result?.url||(location.protocol==='https:'||location.protocol==='http:'?location.origin+'/':'');
    $('share-x').href='https://twitter.com/intent/tweet?'+new URLSearchParams({text,...(url?{url}:{})});
    $('share-x').hidden=false;
    $('copy-score').onclick=async()=>{
      const message=text+(url?' '+url:'');
      try{await navigator.clipboard.writeText(message);$('share-status').textContent='Score and link copied.';}
      catch{$('share-status').textContent=message;}
    };
  }
  async function board(){
    const generation=++boardGeneration,mode=boardMode,round=boardRound;
    try{
      $('board-holder').setAttribute('aria-pressed',String(boardMode==='holder'&&boardRound===null));
      $('board-practice').setAttribute('aria-pressed',String(boardMode==='practice'));
      $('board-previous').setAttribute('aria-pressed',String(boardMode==='holder'&&boardRound!==null));
      const value=await api('leaderboard?mode='+mode+(round!==null?'&round='+round:''));
      if(generation!==boardGeneration)return;
      const body=$('leaderboard-rows');body.textContent='';
      for(const entry of value.entries){
        const row=document.createElement('tr');
        if(mode==='holder'&&entry.rank<=10)row.className='prize-position';
        for(const [index,field]of [entry.rank,entry.name,entry.score.toLocaleString(),entry.distance+'m'].entries()){
          const cell=document.createElement('td');cell.textContent=field;
          if(index===2&&entry.pointsMultiplier===2){const badge=document.createElement('small');badge.className='bonus-badge';badge.textContent='2×';cell.appendChild(badge);}
          if(index===1&&entry.wallet){const address=document.createElement('small');address.className='rank-wallet';address.textContent=entry.wallet;cell.appendChild(address);}
          row.appendChild(cell);
        }
        body.appendChild(row);
      }
      $('leaderboard-status').textContent=value.entries.length
        ?'Updated '+new Date(value.updatedAt).toLocaleTimeString()+' · best run per player'
        :'No scores yet. Be the first to finish a run.';
      $('leaderboard-explainer').textContent=boardMode==='holder'
        ?(boardRound===null?'Today (UTC)':'Yesterday (UTC)')+' · 10 runs per wallet · best score counts · collect 10 red RUSH for 2× · top 10 share enabled prizes after team review.'
        :'All-time practice · no token rewards. Names are public; duplicate names are possible.';
      const remaining=Math.max(0,(value.round+1)*86400000-value.updatedAt);
      $('board-round-time').textContent=mode!=='holder'?'BEST COMPLETED PRACTICE RUNS':round!==null?'PREVIOUS UTC DAY · CLOSED'
        :'RESETS IN '+Math.floor(remaining/3600000)+'H '+String(Math.floor(remaining/60000)%60).padStart(2,'0')+'M · UTC';
    }catch(error){if(generation===boardGeneration)$('leaderboard-status').textContent='Could not refresh rankings. '+error.message+' Use Refresh to retry; practice is still available.';}
  }
  function openBoard(){
    previousFocus=document.activeElement;$('leaderboard-panel').hidden=false;$('close-leaderboard').focus();board();
    clearInterval(boardTimer);boardTimer=setInterval(board,10000);
  }
  function closeBoard(){boardGeneration++;$('leaderboard-panel').hidden=true;clearInterval(boardTimer);boardTimer=null;previousFocus?.focus(); }
  $('leaderboard-button').addEventListener('click',openBoard);
  $('result-leaderboard').addEventListener('click',openBoard);
  $('close-leaderboard').addEventListener('click',closeBoard);
  $('board-refresh').addEventListener('click',board);
  $('board-holder').addEventListener('click',()=>{boardMode='holder';boardRound=null;board();});
  $('board-practice').addEventListener('click',()=>{boardMode='practice';boardRound=null;board();});
  $('board-previous').addEventListener('click',async()=>{
    try{const current=await api('config');boardMode='holder';boardRound=current.round-1;board();}
    catch(_){$('leaderboard-status').textContent='Could not load the previous round.';}
  });
  document.addEventListener('keydown',event=>{
    if($('leaderboard-panel').hidden)return;
    if(event.key==='Escape'){event.preventDefault();closeBoard();}
    if(event.key==='Tab'){
      const buttons=Array.from($('leaderboard-panel').querySelectorAll('button'));
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){clearInterval(boardTimer);boardTimer=null;}
    else if(!$('leaderboard-panel').hidden){board();boardTimer=setInterval(board,10000);}
  });
  $('check-day').addEventListener('click',async()=>{
    const address=$('wallet').value.trim(),button=$('check-day');
    button.disabled=true;$('wallet-status').textContent='Checking your daily progress…';
    try{
      const value=await api('balance?'+new URLSearchParams({wallet:address}),null,15000);
      if($('wallet').value.trim()!==address)return;
      if(!value.eligible)throw Error('At least 50,000 CATOSHI required. Practice is available.');
      entryWallet=address;restoreHolderName(address);updateStatus(value);
      $('wallet-status').textContent='Daily progress loaded · no run used.';$('wallet-status').className='status success';
    }catch(error){$('wallet-status').textContent=error.message;$('wallet-status').className='status error';}
    finally{button.disabled=false;}
  });
  window.RushOnline={prepare,submit,share,getConfig,balance:async wallet=>{const value=await api('balance?'+new URLSearchParams({wallet:wallet.trim()}),null,15000);updateStatus(value);return value;},setWallet:wallet=>{entryWallet=wallet.trim();restoreHolderName(entryWallet);},wallet:()=>entryWallet};
  if(location.protocol!=='file:')getConfig().catch(()=>{});
})();
