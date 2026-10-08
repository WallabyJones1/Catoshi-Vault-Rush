'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
test('standalone package imports none of the solo engine, wallet or payment systems',()=>{
 const pkg=require('./package.json');assert.equal(pkg.scripts.start,'node multiplayer-server.cjs');
 for(const name of ['race-fees.cjs','wallet-racing.js','solana-race.cjs','game.js','index.html','rewards.cjs','admin.cjs','online.js'])assert(!fs.existsSync(path.join(root,name)),name);
 const source=fs.readFileSync(path.join(root,'multiplayer-server.cjs'),'utf8');assert(!source.includes("require('./server.cjs')"));assert(!/SOLANA_RPC|RACE_VAULT|CATOSHI_MINT|PUBLIC_KEY|walletAddress/.test(source));
 const html=fs.readFileSync(path.join(root,'multiplayer.html'),'utf8');assert(!/payment|entry fee|wallet connect|token transfer/i.test(html));
});
