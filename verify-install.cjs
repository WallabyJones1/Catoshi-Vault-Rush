'use strict';
// Read-only deployment check: never creates a database or changes game files.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
assert.ok(Number(process.versions.node.split('.')[0])>=24,'Use Node 24 or newer.');
const security=require('./security.cjs');
assert.equal(security.ENGINE_VERSION,require('./engine.js').VERSION,'Solo engine and server must match.');
assert.ok(security.ENGINE_VERSION,'The engine version is missing.');
for(const name of ['walletAddress','playerName','hash','replay','tokenBalance','escapeHtml'])assert.equal(typeof security[name],'function','Missing solo security function: '+name);
require.resolve('socket.io');
for(const file of fs.readdirSync(root).filter(name=>/\.(?:js|cjs)$/.test(name)))new vm.Script(read(file),{filename:file});
for(const name of ['index.html','multiplayer.html','replay.html']){
  const html=read(name);
  for(const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)){
    const asset=match[1];
    if(asset.startsWith('/')||asset.includes(':')||asset==='#')continue;
    assert.ok(fs.existsSync(path.join(root,asset)),name+' references a missing asset: '+asset);
  }
}
assert.match(read('index.html'),/href="catoshi-classic-home\.css\?v=site-repair-20"/,'The homepage theme must be linked.');
assert.doesNotMatch(read('index.html'),/<script[^>]+src="(?:race-engine|multiplayer-game|multiplayer-renderer)\.js/,'Race code must not execute in the solo page.');
assert.match(read('multiplayer.html'),/src="multiplayer-renderer\.js/,'Multiplayer must use its isolated renderer.');
assert.match(read('multiplayer.html'),/src="race-net\.js/,'Race prediction must load before racing.');
for(const file of ['multiplayer-server.cjs','multiplayer.cjs']){
  assert.match(read(file),/require\('\.\/mp-security\.cjs'\)/);
  assert.doesNotMatch(read(file),/require\('\.\/security\.cjs'\)/,'Multiplayer must not replace or depend on solo security.');
}
assert.match(read('styles.css'),/\.multiplayer-embedded\[hidden\]\{display:none!important\}/,'The multiplayer panel must stay hidden until selected.');
console.log('Verified site-repair-20: solo engine, homepage, assets and isolated multiplayer are ready.');
