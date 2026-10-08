'use strict';
// Run from the repository root after copying this ZIP's contents into the repo.
// Leaves existing solo controllers, scores, game physics and page routes intact.
const fs=require('node:fs');const path=require('node:path');
const root=process.cwd(),src=path.resolve(__dirname,'..');
function requireFile(name){const p=path.join(root,name);if(!fs.existsSync(p))throw Error('Missing '+name+' in the repo. Run this from your Catoshi project root.');return fs.readFileSync(p,'utf8');}
function put(name,data){fs.writeFileSync(path.join(root,name),data);console.log('Updated '+name);}
function one(s,needle,insert,label){if(s.includes(insert))return s;const n=s.split(needle).length-1;if(n!==1)throw Error('Cannot safely patch '+label+' ('+n+' matches). Files unchanged.');return s.replace(needle,insert);}
let html=requireFile('index.html'),server=requireFile('server.cjs'),style=requireFile('styles.css'),pkg=JSON.parse(requireFile('package.json'));
let docker=fs.existsSync(path.join(root,'Dockerfile'))?fs.readFileSync(path.join(root,'Dockerfile'),'utf8'):null;
const mode='id="mode-trial"';if(!html.includes(mode))throw Error('Speed Trial mode tab not found; cannot safely insert multiplayer tab.');
if(!html.includes('id="mode-multiplayer"')){
  const re=/(<button\s+id="mode-trial"[^>]*>[^<]*<\/button>)/;
  if(!re.test(html))throw Error('Expected Speed Trial button structure not found.');
  html=html.replace(re,'$1<button id="mode-multiplayer" type="button" aria-pressed="false">MULTIPLAYER</button>');
}
const panel=`    <!-- Multiplayer lives in a same-origin iframe with its own JS and OS process. -->\n    <section id="multiplayer-embedded" class="multiplayer-embedded" hidden aria-label="Multiplayer racing">\n      <div class="multiplayer-embedded-bar"><strong>CATOSHI · MULTIPLAYER</strong><button id="multiplayer-close" type="button" aria-label="Return to main game">← BACK TO GAME</button></div>\n      <p id="multiplayer-embed-status" role="status" class="multiplayer-embed-status">Connecting to multiplayer…</p>\n      <iframe id="multiplayer-iframe" title="Catoshi multiplayer racing" src="about:blank" allow="fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>\n    </section>\n`;
if(!html.includes('id="multiplayer-embedded"')){
  const needle='    <section id="game-screen"';
  html=one(html,needle,panel+needle,'multiplayer panel');
}
if(!html.includes('mp-tab.js'))html=one(html,'</head>','  <script defer src="mp-tab.js?v=6"></script>\n</head>','tab controller');
const css=`\n/* Integrated multiplayer: third game-mode tab and isolated full-page racing panel. */\n#gate .mode-switch{grid-template-columns:repeat(3,minmax(0,1fr))}\n#gate .mode-switch button{font-size:clamp(9px,2.2vw,12px);padding-inline:4px}\n.multiplayer-embedded{position:fixed;inset:0;z-index:9999;background:#0a0807;color:#f4e6d9;display:flex;flex-direction:column}\n.multiplayer-embedded[hidden]{display:none!important}\n.multiplayer-embedded-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:52px;padding:9px max(12px,env(safe-area-inset-right));border-bottom:1px solid #493022;background:#17100c;font-weight:700;font-size:13px;letter-spacing:.04em}\n.multiplayer-embedded-bar button{min-height:36px;border:1px solid #9e603a;background:transparent;color:#ffad73;border-radius:8px;padding:6px 12px;cursor:pointer}\n#multiplayer-iframe{width:100%;height:100%;min-height:0;flex:1;border:0;background:#0a0908}\n.multiplayer-embed-status{position:absolute;top:53px;right:12px;font-size:11px;pointer-events:none;color:#f8bd91}\n`;
if(!style.includes('/* Integrated multiplayer:'))style+=css;
// Forward exactly the /mp/... requests before the solo router's normal API and static allowlist.
const proxy=`    if(req.url==='/mp'||req.url.startsWith('/mp/')||req.url.startsWith('/mp?')) {\n      try { return require('./mp-bridge.cjs').forward(req,res); }\n      catch(e){ res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"Multiplayer temporarily unavailable."}');return; }\n    }\n`;
if(!server.includes("require('./mp-bridge.cjs').forward")){
  const line='http.createServer(async(req,res)=>{';
  server=one(server,line,line+'\n'+proxy,'server request dispatch');
}
const startup=`  // Optional, crash-isolated realtime child. Solo still starts when multiplayer is offline.\n  try{require('./mp-bridge.cjs').install(app.server);}catch(e){console.error('[multiplayer] disabled:',e.message);}\n`;
if(!server.includes("require('./mp-bridge.cjs').install")){
  const line="  app.server.listen(config.port,'0.0.0.0'";
  server=one(server,line,startup+line,'server start');
}
pkg.dependencies={...pkg.dependencies,'socket.io':'4.8.1'};
pkg.scripts={...pkg.scripts,'test:multiplayer':'node --test mp/race.test.cjs mp/multiplayer.test.cjs mp/server.test.cjs mp/isolation.test.cjs mp/inpage.test.cjs'};
if(docker&&!/RUN\s+npm\s+(?:ci|install)/.test(docker)){
 const needle='COPY . ./';
 if(docker.includes(needle))docker=docker.replace(needle,'COPY package.json ./\nRUN npm install --omit=dev --no-audit --no-fund\n'+needle);
 else throw Error('Dockerfile lacks npm install, and could not be safely patched.');
}
// Validate all transformations before mutating the repository.
for(const [filename,data]of [['index.html',html],['server.cjs',server],['styles.css',style],['package.json',JSON.stringify(pkg,null,2)+'\n']]){
  if(!data)throw Error('Empty output: '+filename);
}
// Install addon files first; if file copying fails the solo app remains untouched.
if(path.resolve(src,'mp')!==path.resolve(root,'mp'))fs.cpSync(path.join(src,'mp'),path.join(root,'mp'),{recursive:true});
for(const file of ['mp-bridge.cjs','mp-tab.js'])fs.copyFileSync(path.join(__dirname,file),path.join(root,file));
// Keep safe local backups and exclude them from git commits.
const backupDir=path.join(root,'.catoshi-mp-backups');fs.mkdirSync(backupDir,{recursive:true});
for(const name of ['index.html','server.cjs','styles.css','package.json',...(docker?['Dockerfile']:[])]){
 const dest=path.join(root,name),backup=path.join(backupDir,name);
 if(!fs.existsSync(backup))fs.copyFileSync(dest,backup);
}
const ignore=path.join(root,'.gitignore');const oldIgnore=fs.existsSync(ignore)?fs.readFileSync(ignore,'utf8'):'';
if(!oldIgnore.includes('.catoshi-mp-backups/'))fs.appendFileSync(ignore,'\n.catoshi-mp-backups/\n');
put('index.html',html);put('server.cjs',server);put('styles.css',style);put('package.json',JSON.stringify(pkg,null,2)+'\n');
if(docker)put('Dockerfile',docker);
console.log('Installed. npm install, npm test, npm start. Deploy on the existing Railway service and existing domain.');
