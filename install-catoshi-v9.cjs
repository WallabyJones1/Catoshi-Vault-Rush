'use strict';
/* Catoshi V9: non-destructive, check-first installation from the REPOSITORY ROOT.
 * No file mutation without --apply. No swapping game.js, existing CSS, or solo database.
 * The full archive must be extracted with directories intact. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.cwd();
const kit = __dirname;
const check = process.argv.includes('--check');
const apply = process.argv.includes('--apply');
if (check === apply) { console.error('Use exactly one: node install-catoshi-v9.cjs --check | --apply'); process.exit(2); }
const exists = name => fs.existsSync(path.join(root,name));
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const issues = [];
const notice = [];
const changes = new Map();
function fail(msg){issues.push(msg);}
function verifyFiles(){
  for(const name of ['index.html','server.cjs','styles.css','package.json'])if(!exists(name))fail(`Repository root missing ${name}`);
  for(const name of ['catoshi-classic-home.css','mp-tab.js','mp-bridge.cjs',
    'mp/multiplayer-server.cjs','mp/multiplayer.html','mp/multiplayer.js',
    'mp/multiplayer-game.js','mp/race-tracks.js','mp/race-engine.js','mp/styles.css',
    'mp/race.test.cjs','mp/multiplayer.test.cjs','mp/server.test.cjs',
    'mp/isolation.test.cjs','mp/inpage.test.cjs']){
    if(!fs.existsSync(path.join(kit,name))) fail(`Archive incomplete: ${name}. Extract the ZIP preserving folders before running the installer.`);
  }
}
verifyFiles();
let html='',server='',pkg=null;
if(!issues.length){
  html=read('index.html');server=read('server.cjs');
  try{pkg=JSON.parse(read('package.json'));}catch(e){fail('Cannot parse package.json: '+e.message);}
}
function replaceOne(input,regex,replacement,reason){
  const m=[...input.matchAll(regex)];
  if(m.length!==1){fail(`Refusing to alter ${reason}; expected one unique anchor, found ${m.length}.`);return input;}
  return input.replace(regex,replacement);
}
const panel=`\n    <!-- Catoshi V9 multiplayer embed: iframe isolated from the solo page. -->\n    <section id="multiplayer-embedded" class="multiplayer-embedded" hidden aria-label="Multiplayer racing">\n      <div class="multiplayer-embedded-bar"><strong>CATOSHI · MULTIPLAYER</strong><button id="multiplayer-close" type="button">← BACK TO GAME</button></div>\n      <p id="multiplayer-embed-status" role="status" class="multiplayer-embed-status">Connecting to multiplayer…</p>\n      <iframe id="multiplayer-iframe" title="Catoshi multiplayer racing" src="about:blank" allow="fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>\n    </section>\n`;
if(pkg){
  if(!html.includes('id="mode-trial"'))fail('Speed Trials button not found; HTML structure needs manual review.');
  if(!html.includes('id="mode-multiplayer"'))html=replaceOne(html,/(<button\b(?=[^>]*\bid="mode-trial")[^>]*>[\s\S]*?<\/button>)/g,'$1<button id="mode-multiplayer" type="button" aria-pressed="false">MULTIPLAYER</button>','index.html Speed Trials button');
  if(!html.includes('id="multiplayer-embedded"'))html=replaceOne(html,/(?=<section\s+id="game-screen")/g,panel,'index.html game screen');
  if(!html.includes('catoshi-classic-home.css'))html=replaceOne(html,/<\/head>/g,'  <link rel="stylesheet" href="catoshi-classic-home.css?v=classic-v9">\n</head>','index.html head for restored look');
  if(!html.includes('mp-tab.js'))html=replaceOne(html,/<\/head>/g,'  <script defer src="mp-tab.js?v=multiplayer-v9"></script>\n</head>','index.html head for tab script');
  if(!server.includes("require('./mp-bridge.cjs').forward")){
    const route=`\n    // V9 multiplayer routes are forwarded to a child process, without touching solo routes.\n    if(req.url==='/mp'||req.url.startsWith('/mp/')||req.url.startsWith('/mp?')){\n      try{return require('./mp-bridge.cjs').forward(req,res);}\n      catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"Multiplayer temporarily unavailable."}');return;}\n    }\n`;
    server=replaceOne(server,/http\.createServer\(async\s*\(req,res\)\s*=>\s*\{/g,matched=>matched+route,'server.cjs HTTP request handler');
  }
  for(const [asset,mime] of [['catoshi-classic-home.css','text/css'],['mp-tab.js','text/javascript']]){
    const exact=`['${asset}','${mime}']`;
    if(!server.includes(exact))server=replaceOne(server,/\['styles\.css','text\/css'\]/g,matched=>matched+','+exact,'server.cjs static allowlist');
  }
  if(!server.includes("require('./mp-bridge.cjs').install")){
    const init=`  // Child failure cannot stop the solo HTTP server.\n  try{require('./mp-bridge.cjs').install(app.server);}catch(e){console.error('[multiplayer] unavailable:',e.message);}\n`;
    server=replaceOne(server,/^\s*app\.server\.listen\(config\.port,'0\.0\.0\.0'/gm,matched=>'\n'+init+matched,'server.cjs server start');
  }
  if(!pkg.scripts || typeof pkg.scripts!=='object')fail('package.json scripts object missing');
  else {
    const mpScript='node --test mp/race.test.cjs mp/multiplayer.test.cjs mp/server.test.cjs mp/isolation.test.cjs mp/inpage.test.cjs';
    if(pkg.scripts['test:multiplayer'] && pkg.scripts['test:multiplayer']!==mpScript)fail('Existing test:multiplayer script is different; refusing to overwrite it.');
    else pkg.scripts['test:multiplayer']=mpScript;
  }
  if(pkg.dependencies && typeof pkg.dependencies!=='object')fail('package.json dependencies invalid');
  else {pkg.dependencies ||= {};pkg.dependencies['socket.io'] ||= '4.8.1';}
  changes.set('index.html',html);
  changes.set('server.cjs',server);
  changes.set('package.json',JSON.stringify(pkg,null,2)+'\n');
}
const movedTests=[];
for(const name of ['isolation.test.cjs','inpage.test.cjs','server.test.cjs','race.test.cjs','multiplayer.test.cjs']){
  if(!exists(name))continue;
  const rootTest=fs.readFileSync(path.join(root,name));
  const mpTest=fs.readFileSync(path.join(kit,'mp',name));
  if(rootTest.equals(mpTest)){
    movedTests.push(name);
    notice.push(`Root ${name} is a misplaced DUPLICATE of mp/${name}; will archive root duplicate on --apply.`);
  }else if(name==='isolation.test.cjs'){
    fail('Found unrelated root isolation.test.cjs; cannot fix its failure automatically. Review it before proceeding.');
  }else {
    notice.push(`Existing root ${name} differs from multiplayer copy, leaving it untouched.`);
  }
}
const knownOldAssets={
  'mp-bridge.cjs':'f219a9caaa8ddf26559b792230cd78d2280f90d0606b2a5f4c795f928ba086b1',
  'catoshi-classic-home.css':'723ee1179992c82718934d063cc4295e3abd26af116c29c2ff59869e7e33d8e8'
};
const upgradeAssets=new Set();
for(const name of ['mp-tab.js','mp-bridge.cjs','catoshi-classic-home.css']){
  if(exists(name)){
    const present=fs.readFileSync(path.join(root,name)),latest=fs.readFileSync(path.join(kit,name));
    if(!present.equals(latest)){
      const sum=crypto.createHash('sha256').update(present).digest('hex');
      if(knownOldAssets[name]===sum){upgradeAssets.add(name);notice.push(`Recognized old V8 ${name}; will back up and upgrade it.`);}
      else fail(`${name} already exists and differs from known V8/V9. Refusing to overwrite.`);
    }
  }
}

if(pkg && !issues.length){
  for(const [name,value] of changes) notice.push(`${name}: ${exists(name)&&read(name)===value?'unchanged':'would update'}`);
  notice.push('styles.css: WILL NOT TOUCH');
  notice.push('game.js: WILL NOT TOUCH');
  const docker=exists('Dockerfile')?read('Dockerfile'):'';
  notice.push('Dockerfile: WILL NOT TOUCH'+(docker&&!/RUN\s+npm\s+(?:ci|install)/.test(docker)?' — WARNING: Dockerfile does not install npm dependencies; Railway runtime needs socket.io!':' — dependency install present or Railway uses source builder.'));
  notice.push('main solo SQLite/database: WILL NOT TOUCH');
}
if(issues.length){for(const m of issues)console.error('BLOCKED:',m); console.error('NO FILES MODIFIED.');process.exit(1);}
for(const m of notice)console.log('CHECK:',m);
if(!apply){console.log('PASS: No changes made. To proceed: node install-catoshi-v9.cjs --apply');process.exit(0);}
const backups=path.join(root,'.catoshi-mp-backups');fs.mkdirSync(backups,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const current=path.join(backups,'v9-'+stamp);fs.mkdirSync(current,{recursive:true});
const overwritten=[];
try{
  // Back up existing primary files before any changes.
  for(const name of changes.keys())fs.copyFileSync(path.join(root,name),path.join(current,name));
  for(const name of ['mp-tab.js','mp-bridge.cjs','catoshi-classic-home.css']){
    if(exists(name))fs.copyFileSync(path.join(root,name),path.join(current,name));
  }
  for(const name of movedTests)fs.copyFileSync(path.join(root,name),path.join(current,'misplaced-'+name));
  // Stage writes in the same directory, then rename to avoid half-written files.
  const copyIfMissing=(source,target)=>{
    fs.mkdirSync(path.dirname(target),{recursive:true});
    if(!fs.existsSync(target)){fs.copyFileSync(source,target);overwritten.push({target,wasNew:true});}
  };
  const walk=(base,rel='')=>{
    for(const entry of fs.readdirSync(path.join(base,rel),{withFileTypes:true})){
      const child=path.join(rel,entry.name),src=path.join(base,child),dst=path.join(root,'mp',child);
      if(entry.isDirectory())walk(base,child);else copyIfMissing(src,dst);
    }
  };
  walk(path.join(kit,'mp'));
  for(const name of ['mp-tab.js','mp-bridge.cjs','catoshi-classic-home.css']){
    const target=path.join(root,name);
    if(upgradeAssets.has(name)){
      fs.copyFileSync(path.join(kit,name),target);
      overwritten.push({target,wasNew:false,original:path.join(current,name)});
    }else copyIfMissing(path.join(kit,name),target);
  }
  for(const [name,data] of changes){
    const target=path.join(root,name),temp=target+'.catoshi-v9.tmp';
    fs.writeFileSync(temp,data);fs.renameSync(temp,target);
    overwritten.push({target,wasNew:false,original:path.join(current,name)});
  }
  for(const name of movedTests){fs.unlinkSync(path.join(root,name));console.log(`Archived misplaced root ${name}; copy remains in mp/.`);}
  const ignore=path.join(root,'.gitignore');const oldIgnore=fs.existsSync(ignore)?fs.readFileSync(ignore,'utf8'):'';
  if(!oldIgnore.includes('.catoshi-mp-backups/'))fs.appendFileSync(ignore,'\n.catoshi-mp-backups/\n');
  console.log('SUCCESS: Installed with backups at '+path.relative(root,current));
  console.log('Next: npm install && npm test && npm run test:multiplayer');
  console.log('Review `git diff` before committing. DO NOT deploy if tests fail.');
}catch(e){
  for(const x of [...overwritten].reverse()){
    try{if(x.wasNew)fs.rmSync(x.target,{force:true});else fs.copyFileSync(x.original,x.target);}catch{}
  }
  console.error('Installation failed; restored modified root files from backup where possible:',e.message);process.exit(1);
}
