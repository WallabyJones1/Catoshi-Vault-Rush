(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const INVITE_CODE=(new URLSearchParams(location.search).get('invite')||'').toUpperCase();
  const NAME_KEY='rush-multiplayer-name',COLOR_KEY='rush-multiplayer-color';
  let socket=null,profile=null,currentLobby=null,queueActive=false,currentTicket=null,currentSnapshot=null,seq=0,boardTimer=null,boardRound=null,currentBoardRound=null,boardMode='week';

  async function api(endpoint,timeout=9000){
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
    try{const r=await fetch('/mp/api/multiplayer/'+endpoint,{credentials:'same-origin',signal:c.signal});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed.');return v;}
    finally{clearTimeout(timer);}
  }
  function savedName(){try{return localStorage.getItem(NAME_KEY)||'';}catch{return'';}}
  function savedColor(){try{return localStorage.getItem(COLOR_KEY)||'#f4c542';}catch{return'#f4c542';}}
  function remember(name,color){try{localStorage.setItem(NAME_KEY,name);localStorage.setItem(COLOR_KEY,color);}catch{}}
  function status(msg,kind=''){const el=$('multiplayer-status');if(!el)return;el.textContent=msg;el.className='status'+(kind?' '+kind:'');}
  function currentColor(){return document.querySelector('#multiplayer-colors [aria-checked="true"]')?.dataset.color||savedColor();}
  function renderColors(colors){
    const box=$('multiplayer-colors');if(!box)return;box.textContent='';const chosen=(profile?.color||savedColor()).toLowerCase();
    for(const color of colors||[]){
      const b=document.createElement('button');b.type='button';b.className='color-swatch';b.dataset.color=color;b.setAttribute('role','radio');b.setAttribute('aria-label','Racer colour '+color);b.setAttribute('aria-checked',String(color.toLowerCase()===chosen));b.style.setProperty('--racer-color',color);
      b.addEventListener('click',()=>{for(const x of box.children)x.setAttribute('aria-checked','false');b.setAttribute('aria-checked','true');try{localStorage.setItem(COLOR_KEY,color);}catch{}});box.appendChild(b);
    }
    if(!box.querySelector('[aria-checked="true"]')&&box.firstElementChild)box.firstElementChild.setAttribute('aria-checked','true');
  }
  function renderProfile(value){
    profile=value;if(!value)return;const s=value.stats||{},w=s.weekly||{};
    $('multiplayer-stats').hidden=false;
    $('multi-stat-weekly').textContent=(w.weeklyPoints||0).toLocaleString();$('multi-stat-races').textContent=(s.races||0).toLocaleString();$('multi-stat-wins').textContent=(s.wins||0).toLocaleString();$('multi-stat-podiums').textContent=(s.podiums||0).toLocaleString();$('multi-stat-winrate').textContent=(s.winRate||0)+'%';$('multi-stat-best').textContent=(s.bestScore||0).toLocaleString();
    if(value.tracks?.length){const select=$('multi-track-select');if(select&&!select.children.length){for(const t of value.tracks){const option=document.createElement('option');option.value=t.id;option.textContent=t.name;select.appendChild(option);}}}if(value.name&&!$('multiplayer-name').value.trim())$('multiplayer-name').value=value.name;renderColors(value.colors||[]);
  }
  function renderQueue(q){
    queueActive=Boolean(q);$('multiplayer-queue').hidden=!q;$('multiplayer-cancel').hidden=!q;$('multiplayer-quick').disabled=Boolean(q);
    if(!q)return;
    $('multi-queue-count').textContent=q.size+' / '+q.maxPlayers;const wait=Math.max(0,Math.ceil((q.startAfterMs-q.waitMs)/1000));
    $('multi-queue-copy').textContent=q.size>=q.maxPlayers?'Full race found…':q.size>=q.minPlayers?(wait?'Race starts in about '+wait+'s':'Building race…'):'Waiting for another racer…';
    status(socket?.connected?'LIVE · searching for racers…':'Reconnecting…');
  }
  function standings(snapshot){
    if(!snapshot)return;const list=$('race-live-list'),box=$('race-standings');if(!list||!box)return;box.hidden=false;
    const sorted=[...snapshot.players].sort((a,b)=>{if(a.finishMs!=null&&b.finishMs!=null)return a.finishMs-b.finishMs;if(a.finishMs!=null)return-1;if(b.finishMs!=null)return 1;if(a.forfeited!==b.forfeited)return a.forfeited?1:-1;return b.x-a.x||a.seat-b.seat;});
    const you=sorted.find(p=>p.seat===currentTicket?.seat),rank=Math.max(1,sorted.indexOf(you)+1);$('race-place').textContent=rank+' / '+sorted.length;list.textContent='';
    sorted.slice(0,8).forEach((p,i)=>{const li=document.createElement('li');if(p.seat===currentTicket?.seat)li.className='you';const r=document.createElement('span');r.textContent=i+1;const n=document.createElement('span');n.className='race-name';n.textContent=p.name+(p.seat===currentTicket?.seat?' · YOU':'');n.style.color=p.color;const d=document.createElement('span');d.className='race-distance';d.textContent=p.finishMs!=null?(p.finishMs/1000).toFixed(2)+'s':p.forfeited?'DNF':Math.floor(Math.max(0,p.x)/10)+'m';li.append(r,n,d);list.appendChild(li);});
  }
  function hideStandings(){if($('race-standings'))$('race-standings').hidden=true;}

  async function ensureSocket(){
    if(!profile){try{renderProfile(await api('profile'));}catch(e){status(e.message,'error');throw e;}}
    if(socket)return socket;
    if(typeof io!=='function')throw Error('Realtime multiplayer client did not load. Reload this page.');
    socket=io({path:'/mp/socket.io',transports:['websocket'],upgrade:false,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:400,reconnectionDelayMax:4000,timeout:8000});
    socket.on('connect',()=>{status(queueActive?'LIVE · matchmaking connected.':'LIVE MULTIPLAYER READY','good');if(currentTicket)socket.emit('race:resume',{matchId:currentTicket.matchId},reply=>{if(reply?.ok){currentTicket=reply.ticket;handleSnapshot(reply.snapshot);}});});
    socket.on('disconnect',()=>{if(queueActive||currentTicket)status('Connection interrupted · reconnecting…');window.VaultRushGame?.multiplayerConnection?.(false);});
    socket.on('connect_error',e=>status('Realtime connection unavailable: '+(e.message||'retrying'),'error'));
    socket.on('queue:state',renderQueue);
    socket.on('lobby:state',lobbyStatus);
    socket.on('race:ticket',ticket=>{lobbyStatus(null);currentTicket=ticket;seq=0;queueActive=false;renderQueue(null);status('Race found · '+ticket.trackName,'good');window.VaultRushGame?.startMultiplayer?.(ticket);});
    socket.on('race:snapshot',handleSnapshot);
    socket.on('race:event',event=>window.VaultRushGame?.multiplayerEvent?.(event));
    socket.on('race:finished',match=>{currentSnapshot=null;queueActive=false;window.VaultRushGame?.multiplayerFinished?.(match);decorateResult(match);refreshProfileAndBoard();});
    return socket;
  }
  function handleSnapshot(s){if(!s)return;currentSnapshot=s;standings(s);window.VaultRushGame?.multiplayerSnapshot?.(s);}
  function sendInput(type){if(!socket?.connected||!currentTicket)return;socket.timeout(1500).emit('race:input',{matchId:currentTicket.matchId,seq:++seq,type},()=>{});}
  function forfeit(){if(currentTicket&&socket)socket.emit('race:forfeit',{matchId:currentTicket.matchId},()=>{});currentTicket=null;currentSnapshot=null;hideStandings();}

  async function quickRace(){
    const name=$('multiplayer-name').value.trim()||savedName()||'Runner',color=currentColor();remember(name,color);
    try{const s=await ensureSocket();$('multiplayer-quick').disabled=true;status('Joining live matchmaking…');s.timeout(5000).emit('profile:update',{name,color},()=>{});s.timeout(5000).emit('queue:join',{name,color},(err,reply)=>{if(err||!reply?.ok){$('multiplayer-quick').disabled=false;status(reply?.error||'Could not join matchmaking.','error');return;}renderProfile(reply.profile);renderQueue(reply.queue);});}
    catch(e){$('multiplayer-quick').disabled=false;status(e.message,'error');}
  }
  function cancelQueue(){if(socket)socket.emit('queue:leave',{},()=>{});queueActive=false;renderQueue(null);status('Search cancelled.');}

  function lobbyStatus(lobby){currentLobby=lobby||null;const box=$('friend-room');box.hidden=!lobby;if(!lobby)return;
    const link=location.origin+'/?race='+encodeURIComponent(lobby.code);
    $('friend-room-code').textContent=lobby.code;$('friend-room-link').value=link;
    $('friend-players').textContent=lobby.players.map(p=>p.name+(p.host?' (HOST)':'')+(p.you?' · YOU':'')).join(' · ');
    $('friend-room-count').textContent=lobby.playerCount+' / 8 racers';
    $('friend-start').hidden=!lobby.host;$('friend-fill').hidden=!lobby.host;
    $('friend-start').disabled=lobby.playerCount<2;
    status('Friend room '+lobby.code+' · '+lobby.playerCount+' players','good');
  }
  function myEntry(){const name=$('multiplayer-name').value.trim()||savedName()||'Runner',color=currentColor();remember(name,color);return{name,color};}
  async function emitAck(event,data){const s=await ensureSocket();return new Promise((resolve,reject)=>s.timeout(7000).emit(event,data,(e,r)=>e?reject(Error('Connection timed out.')):r?.ok?resolve(r):reject(Error(r?.error||'Operation failed.'))));}
  async function friendAction(action,data={}){try{const result=await emitAck(action,{...myEntry(),...data});if(result.lobby)lobbyStatus(result.lobby);if(action==='lobby:leave')lobbyStatus(null);return result;}catch(e){status(e.message,'error');return null;}}
  async function startBots(){const b=$('multiplayer-bots');b.disabled=true;try{await emitAck('bots:start',{...myEntry(),count:3});status('Bot race starting…','good');}catch(e){status(e.message,'error');}finally{b.disabled=false;}}
  async function copyRoom(){const link=$('friend-room-link').value;try{if(navigator.share)await navigator.share({title:'Join my Catoshi race',text:'Join my Catoshi Vault Rush race!',url:link});else await navigator.clipboard.writeText(link);status('Invite link ready to share.','good');}catch(e){if(e.name!=='AbortError')status('Invite link: '+link);}}
  async function refreshBoard(){
    try{
      const args=new URLSearchParams();if(boardMode==='lifetime')args.set('type','lifetime');else if(boardMode==='track'){args.set('type','track');args.set('trackId',$('multi-track-select').value||'summit-smash');}else if(boardRound!==null)args.set('round',boardRound);
      const board=await api('leaderboard'+(args.size?'?'+args:'')),body=$('multiplayer-board-rows');body.textContent='';
      if(boardMode==='week'&&boardRound===null)currentBoardRound=board.round;
      for(const [id,active] of [['multi-board-current',boardMode==='week'&&boardRound===null],['multi-board-previous',boardMode==='week'&&boardRound!==null],['multi-board-lifetime',boardMode==='lifetime'],['multi-board-tracks',boardMode==='track']])$(id).setAttribute('aria-pressed',String(active));
      $('track-filter-label').hidden=boardMode!=='track';
      $('board-value-label').textContent=boardMode==='track'?'BEST TIME':boardMode==='lifetime'?'ALL PTS':'WEEK PTS';
      for(const e of board.entries){const row=document.createElement('tr');if(e.you)row.className='you';if(e.rank<=3)row.classList.add('podium-row','podium-'+e.rank);
        const rank=document.createElement('td'),badge=document.createElement('span');badge.className='rank-badge';badge.textContent=e.rank;rank.appendChild(badge);
        const racer=document.createElement('td'),name=document.createElement('strong');name.className='rank-name';name.textContent=e.name+(e.you?' · YOU':'');name.style.color=e.color;
        const detail=document.createElement('small');detail.className='rank-detail';detail.textContent=e.races+' races · '+(e.podiums||0)+' podiums'+(boardMode==='week'?' · '+e.countedRaces+'/'+e.countedLimit+' counted':'');racer.append(name,detail);
        const pts=document.createElement('td');pts.textContent=boardMode==='track'?(e.bestMs/1000).toFixed(2)+'s':Number(boardMode==='lifetime'?e.lifetimePoints:e.weeklyPoints).toLocaleString();
        const wins=document.createElement('td');wins.textContent=e.wins;row.append(rank,racer,pts,wins);body.appendChild(row);
      }
      if(!board.entries.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.className='board-empty';cell.textContent='No finishers yet. Be the first on the board!';row.appendChild(cell);body.appendChild(row);}
      const remaining=Math.max(0,(board.roundEnds||0)-board.updatedAt);$('multi-week-time').textContent=boardMode==='track'?'FASTEST VERIFIED FINISHES':boardMode==='lifetime'?'ALL VERIFIED RACES':boardRound!==null?'CLOSED · UTC':'RESETS '+Math.floor(remaining/86400000)+'D '+String(Math.floor(remaining/3600000)%24).padStart(2,'0')+'H · UTC';
      $('multiplayer-board-status').className='status board-live';$('multiplayer-board-status').textContent='LIVE · '+new Date(board.updatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    }catch(e){$('multiplayer-board-status').className='status error';$('multiplayer-board-status').textContent='Could not load race rankings. '+e.message;}
  }
  async function refreshProfileAndBoard(){try{renderProfile(await api('profile'));}catch{}refreshBoard();}

  function decorateResult(match){
    if(!match)return;const you=match.players.find(p=>p.you);if(!you)return;currentTicket=null;const s=match.stats||{},w=s.weekly||{};
    $('result-kicker').textContent=(match.mode==='bots'?'BOT PRACTICE · UNRANKED':'MULTIPLAYER')+' · #'+you.placement+' OF '+match.playerCount;$('result-reason').textContent=you.forfeited?'DNF':match.trackName;$('personal-best').textContent=(you.points?('+'+you.points+' RACE POINTS · '):'')+(w.weeklyPoints||0)+' WEEKLY PTS';$('submission-status').textContent=you.forfeited?'DNF · no race points':'Finish '+(you.finishMs!=null?(you.finishMs/1000).toFixed(2)+'s · ':'')+'place #'+you.placement;$('result-copy').textContent=(s.races||0)+' races · '+(s.wins||0)+' wins · '+(s.podiums||0)+' podiums · '+(s.winRate||0)+'% win rate · '+(s.totalHits||0)+' hits';
    const replay=$('replay-actions');if(match.replayUrl){replay.hidden=false;$('watch-replay').href=match.replayUrl;$('watch-replay').target='_blank';$('watch-replay').rel='noopener';$('share-replay').onclick=()=>shareReplay(match.replayUrl,match.trackName);}else replay.hidden=true;
    const text='I finished #'+you.placement+' of '+match.playerCount+' on '+match.trackName+' in Catoshi Vault Rush Multiplayer!';$('share-x').href='https://twitter.com/intent/tweet?'+new URLSearchParams({text,url:match.replayUrl?location.origin+match.replayUrl:location.origin+'/'});$('copy-score').onclick=async()=>{try{await navigator.clipboard.writeText(text+' '+(match.replayUrl?location.origin+match.replayUrl:location.origin+'/'));$('share-status').textContent='Race result copied.';}catch{$('share-status').textContent=text;}};
  }
  async function shareReplay(path,name){const url=new URL(path,location.origin).href,text='Watch the final 5 seconds of my '+name+' race in Catoshi Vault Rush.';try{if(navigator.share){await navigator.share({title:'Catoshi Vault Rush Replay',text,url});return;}await navigator.clipboard.writeText(url);$('share-status').textContent='Replay link copied.';}catch(e){if(e?.name!=='AbortError')$('share-status').textContent=url;}}
  function leaveRaceView(){hideStandings();currentSnapshot=null;}
  function returnHome(){leaveRaceView();refreshProfileAndBoard();status(socket?.connected?'LIVE MULTIPLAYER READY':'Reconnecting…',socket?.connected?'good':'');}

  async function init(){
    $('multiplayer-name').value=savedName();
    $('multiplayer-bots').addEventListener('click',startBots);
    $('friend-create').addEventListener('click',()=>friendAction('lobby:create'));
    $('friend-join').addEventListener('click',()=>friendAction('lobby:join',{code:$('friend-code').value}));
    $('friend-leave').addEventListener('click',()=>friendAction('lobby:leave'));
    $('friend-start').addEventListener('click',()=>friendAction('lobby:start',{withBots:false}));
    $('friend-fill').addEventListener('click',()=>friendAction('lobby:start',{withBots:true}));
    $('friend-share').addEventListener('click',copyRoom);
    $('close-embed').addEventListener('click',()=>parent.postMessage({type:'catoshi:close-multiplayer'},location.origin));
    $('multiplayer-quick').addEventListener('click',quickRace);$('multiplayer-cancel').addEventListener('click',cancelQueue);$('multi-board-refresh').addEventListener('click',refreshBoard);$('multi-board-current').addEventListener('click',()=>{boardMode='week';boardRound=null;refreshBoard();});$('multi-board-previous').addEventListener('click',()=>{boardMode='week';if(currentBoardRound!==null){boardRound=currentBoardRound-1;refreshBoard();}});$('multi-board-lifetime').addEventListener('click',()=>{boardMode='lifetime';refreshBoard();});$('multi-board-tracks').addEventListener('click',()=>{boardMode='track';refreshBoard();});$('multi-track-select').addEventListener('change',refreshBoard);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('multiplayer-home').classList.contains('active'))refreshBoard();});
    try{renderProfile(await api('profile'));await ensureSocket();if(INVITE_CODE){$('friend-code').value=INVITE_CODE;await friendAction('lobby:join',{code:INVITE_CODE});}}catch(e){status(e.message||'Multiplayer is temporarily unavailable.','error');}
    refreshBoard();clearInterval(boardTimer);boardTimer=setInterval(()=>{if(!document.hidden&&$('multiplayer-home').classList.contains('active'))refreshBoard();},10000);
  }

  window.RushMultiplayer={input:sendInput,forfeit,leaveRaceView,decorateResult,returnHome,setStatus:status,current:()=>({ticket:currentTicket,snapshot:currentSnapshot,profile}),color:()=>profile?.color||savedColor(),name:()=>profile?.name||savedName()};
  init();
})();
