'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
test('multiplayer child process stays separate from the solo engine, wallet and payment systems',()=>{
 const pkg=require('./package.json');assert.equal(pkg.scripts['start:multiplayer'],'node multiplayer-server.cjs');
 const source=fs.readFileSync(path.join(root,'multiplayer-server.cjs'),'utf8');assert(!source.includes("require('./server.cjs')"));assert(!/SOLANA_RPC|RACE_VAULT|CATOSHI_MINT|PUBLIC_KEY|walletAddress/.test(source));
 for(const name of ['./engine.js','./game.js','./online.js','./rewards.cjs','./admin.cjs'])assert(!source.includes("require('"+name+"')"),name);
 const html=fs.readFileSync(path.join(root,'multiplayer.html'),'utf8');assert(!/payment|entry fee|wallet connect|token transfer/i.test(html));
});
