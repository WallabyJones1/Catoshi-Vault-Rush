(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  const ENGINE='flow-web-4';
  let config=null,configPromise=null,entryWallet='',lastResult=null,boardTimer=null,boardMode='practice',boardRound=null,previousFocus=null,vaultTimer=null;
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
      if(!vaultTimer)vaultTimer=setInterval(()=>{if(!document.hidden)refreshVault();},30000);
      return value;
    }).catch(error=>{configPromise=null;throw error;});
    return configPromise;
  }
  function tokenText(value){
    const [whole,fraction]=String(value??'0').split('.');
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction?'.'+fraction:'');
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
  $('wallet').addEventListener('input',()=>restoreHolderName());
  $('wallet').addEventListener('change',()=>restoreHolderName());
  restoreHolderName();
  function name(practice){return (!practice?$('holder-name').value.trim():'')||$('player-name').value.trim()||'Runner';}
  async function prepare(practice){
    try{
      const displayName=name(practice),rewardWallet=entryWallet;
      await getConfig();
      const ticket=await api('runs/start',{name:displayName,mode:practice?'practice':'holder',engine:ENGINE,...(!practice?{wallet:rewardWallet}:{})});
      if(!practice)rememberHolderName(rewardWallet,displayName);
      return ticket;
    }catch(error){
      // Static/offline practice is deliberately independent of the server.
      if(practice){$('practice-note').textContent='Local practice · leaderboard unavailable for this run';return null;}
      throw error;
    }
  }
  async function submit(ticket,ticks,inputs){
    lastResult=null;
    if(!ticket){$('submission-status').textContent='Offline practice · not submitted to the live leaderboard';return null;}
    $('submission-status').textContent='Checking your run and saving your score…';
    try{
      const result=await api('runs/finish',{id:ticket.id,ticks,inputs});lastResult=result;
      $('submission-status').textContent=(result.rank?'Rank #'+result.rank+' · ':'')+'Replay checked · '+(ticket.mode==='holder'?'daily holder board':'practice board');
      return result;
    }catch(error){$('submission-status').textContent='Score not posted: '+error.message;return null;}
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
    try{
      $('board-holder').setAttribute('aria-pressed',String(boardMode==='holder'&&boardRound===null));
      $('board-practice').setAttribute('aria-pressed',String(boardMode==='practice'));
      $('board-previous').setAttribute('aria-pressed',String(boardMode==='holder'&&boardRound!==null));
      const value=await api('leaderboard?mode='+boardMode+(boardRound!==null?'&round='+boardRound:''));
      const body=$('leaderboard-rows');body.textContent='';
      for(const entry of value.entries){
        const row=document.createElement('tr');
        for(const field of [entry.rank,entry.name,entry.score.toLocaleString(),entry.distance+'m']){const cell=document.createElement('td');cell.textContent=field;row.appendChild(cell);}
        body.appendChild(row);
      }
      $('leaderboard-status').textContent=value.entries.length
        ?'Updated '+new Date(value.updatedAt).toLocaleTimeString()+' · best run per player'
        :'No scores yet. Be the first to finish a run.';
      $('leaderboard-explainer').textContent=boardMode==='holder'
        ?(boardRound===null?'Today (UTC)':'Yesterday (UTC)')+' · best score per reward wallet · 50K holdings · top 10 share enabled prizes after team review.'
        :'All-time practice · no token rewards. Names are public; duplicate names are possible.';
    }catch(_){$('leaderboard-status').textContent='Live rankings need the included website server. Offline practice still works.';}
  }
  function openBoard(){
    previousFocus=document.activeElement;$('leaderboard-panel').hidden=false;$('close-leaderboard').focus();board();
    clearInterval(boardTimer);boardTimer=setInterval(board,10000);
  }
  function closeBoard(){ $('leaderboard-panel').hidden=true;clearInterval(boardTimer);boardTimer=null;previousFocus?.focus(); }
  $('leaderboard-button').addEventListener('click',openBoard);
  $('result-leaderboard').addEventListener('click',openBoard);
  $('close-leaderboard').addEventListener('click',closeBoard);
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
  window.RushOnline={prepare,submit,share,getConfig,balance:wallet=>api('balance?'+new URLSearchParams({wallet:wallet.trim()}),null,15000),setWallet:wallet=>{entryWallet=wallet.trim();restoreHolderName(entryWallet);},wallet:()=>entryWallet};
  if(location.protocol!=='file:')getConfig().catch(()=>{});
})();
