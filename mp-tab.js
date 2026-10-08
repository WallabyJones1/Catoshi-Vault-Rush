// Loaded on the existing single-player page; the race scripts never execute
// in the solo document. Closing the tab tears down the isolated iframe.
(()=>{
 'use strict';
 const button=document.getElementById('mode-multiplayer');
 const panel=document.getElementById('multiplayer-embedded');
 const frame=document.getElementById('multiplayer-iframe');
 const close=document.getElementById('multiplayer-close');
 const error=document.getElementById('multiplayer-embed-status');
 if(!button||!panel||!frame||!close)return;
 let open=false;
 function show(code=''){
   const invite=/^[A-F0-9]{10}$/.test(code.toUpperCase())?code.toUpperCase():'';
   // The public browser URL does not change when opening the tab.
   frame.src='/mp/'+(invite?'?invite='+encodeURIComponent(invite):'');
   panel.hidden=false;open=true;button.setAttribute('aria-pressed','true');
   error.textContent='Connecting to multiplayer…';
   close.focus({preventScroll:true});
 }
 function hide(){
   panel.hidden=true;open=false;frame.src='about:blank';
   button.setAttribute('aria-pressed','false');error.textContent='';
   if(new URLSearchParams(location.search).has('race')){
     const url=new URL(location.href);url.searchParams.delete('race');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
   }
   button.focus({preventScroll:true});
 }
 button.addEventListener('click',()=>show());close.addEventListener('click',hide);
 window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
   if(event.data?.type==='catoshi:close-multiplayer')hide();
 });
 frame.addEventListener('load',()=>{if(open)error.textContent='';});
 frame.addEventListener('error',()=>{error.textContent='Multiplayer is temporarily unavailable. Solo play is unaffected.';});
 const code=new URLSearchParams(location.search).get('race');
 if(code&&/^[A-Fa-f0-9]{10}$/.test(code)){
   // Invite links open the same homepage and automatically select multiplayer.
   if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>show(code),{once:true});else show(code);
 }
})();
