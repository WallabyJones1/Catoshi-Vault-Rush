'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function shareUI(native=true){
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',value:'Cat'});return elements.get(id);};
 const calls=[],downloads=[],src=fs.readFileSync('online.js','utf8');
 const a=src.indexOf('  const SHARE_ORIGIN='),b=src.indexOf('  async function board()',a);
 const context={document:{getElementById:el},location:{origin:'https://old-production.up.railway.app',protocol:'https:'},URL:Object.assign(class extends URL{},{createObjectURL:()=> 'blob:picture',revokeObjectURL(){}}),URLSearchParams,File,Image:class{},fetch:async route=>{downloads.push(route);return {ok:true,blob:async()=>new Blob(['image'],{type:'image/png'})};},navigator:{clipboard:{writeText:async text=>calls.push({copy:text})},...(native?{canShare:()=>true,share:async data=>calls.push(data)}:{})}};
 vm.runInNewContext('const $=id=>document.getElementById(id);'+src.slice(a,b)+';globalThis.renderShare=share;',context);
 const run={mode:'trial',trial:{id:1,name:'DUNE DASH'},finishTime:11.399,score:0,player:{x:8500}},result={run:{timeMs:11399},url:'https://old-production.up.railway.app/trial-score/00000000-0000-0000-0000-000000000001'};
 return {elements,el,calls,downloads,context,run,result};
}
test('X tweet uses one branded verified score URL and a large-image card, not Railway',async()=>{
 const h=shareUI();h.context.renderShare(h.run,h.result);await new Promise(resolve=>setImmediate(resolve));
 const intent=new URL(h.el('share-x').href);
 assert.equal(intent.origin,'https://x.com');
 assert.equal(intent.searchParams.get('url'),'https://vaultrush.catoshirush.fun/trial-score/00000000-0000-0000-0000-000000000001');
 assert.equal(intent.searchParams.get('text'),'I finished DUNE DASH in 11.399s on Catoshi Vault Rush. Can you beat me?');
 assert(!intent.searchParams.get('text').includes('railway'));
 assert.equal((h.el('share-x').href.match(/trial-score/g)||[]).length,1);
 assert.equal(h.el('share-x').onclick,null);
 assert.equal(h.downloads[0],'/trial-score/00000000-0000-0000-0000-000000000001.png?v=3');
 assert(!h.el('save-score-picture').hidden);assert(!h.el('score-picture').hidden);
 assert(!h.el('share-picture').hidden);
 await h.el('share-picture').onclick();assert.equal(h.calls[0].files[0].type,'image/png');
 assert(h.calls[0].text.includes('https://vaultrush.catoshirush.fun/?trial=1'));
 assert(!h.calls[0].text.includes('railway'));
 await h.el('copy-score').onclick();assert(h.calls[1].copy.includes('vaultrush.catoshirush.fun/trial-score/'));
 const fallback=shareUI(false);fallback.context.renderShare(fallback.run,fallback.result);await new Promise(resolve=>setImmediate(resolve));
 assert(fallback.el('share-picture').hidden);assert(!fallback.el('save-score-picture').hidden);
 assert.equal(new URL(fallback.el('share-x').href).searchParams.get('url'),intent.searchParams.get('url'));
});
test('POST TO X is ready even while PNG is downloading',async()=>{
 const h=shareUI();let done;h.context.fetch=()=>new Promise(resolve=>{done=resolve;});h.context.renderShare(h.run,h.result);
 assert.equal(h.el('share-x').onclick,null);
 assert(h.el('share-picture').hidden);
 assert(h.el('share-x').href.includes('vaultrush.catoshirush.fun'));
 done({ok:true,blob:async()=>new Blob(['image'],{type:'image/png'})});
 await new Promise(resolve=>setImmediate(resolve));
 assert(!h.el('share-picture').hidden);
 await h.el('share-picture').onclick();assert.equal(h.calls.length,1);assert.equal(h.calls[0].files.length,1);
});
