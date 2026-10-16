/* End-to-end server test: two players see each other, a wallet signs in, players can only write their own docs. */
'use strict';
const { spawn } = require('child_process'), crypto = require('crypto'), path = require('path'), fs = require('fs'), os = require('os');
const WebSocket = require('ws');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catoshi-'));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')); cfg.server.dataDir = dataDir; cfg.server.port = PORT;
const cfgPath = path.join(dataDir, 'config.json'); fs.writeFileSync(cfgPath, JSON.stringify(cfg));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { CONFIG: path.relative(path.join(__dirname, '..'), cfgPath) }), stdio: 'inherit' });
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58enc(bytes) { const d = []; let s = ''; for (const b of bytes) { let c = b; for (let j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = c / 58 | 0; } while (c) { d.push(c % 58); c = c / 58 | 0; } } for (const b of bytes) { if (b) break; s += '1'; } for (let i = d.length - 1; i >= 0; i--) s += B58[d[i]]; return s; }
function client() { return new Promise(res => { const ws = new WebSocket(`ws://localhost:${PORT}/ws`); let seq = 0; const wait = new Map(), events = [];
  ws.on('message', d => { const m = JSON.parse(d); if (m.re && wait.has(m.re)) { wait.get(m.re)(m); wait.delete(m.re); } else events.push(m); });
  ws.on('open', () => res({ ws, events, req: m => new Promise(r => { const id = ++seq; wait.set(id, r); ws.send(JSON.stringify(Object.assign({ id }, m))); }) })); }); }
const ok = (c, msg) => { if (!c) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('ok -', msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await sleep(600);
  const cfgRes = await fetch(`http://localhost:${PORT}/config`).then(r => r.json()); ok(cfgRes.prices.licence === 250 && cfgRes.token.symbol === 'CATOSHI', 'public config served');
  const page = await fetch(`http://localhost:${PORT}/`).then(r => r.text()); ok(page.includes("Catoshi's Catch") || page.includes('Catoshi&#39;s Catch') || page.includes('<title>'), 'game page served');
  const A = await client(), B = await client();
  const ha = await A.req({ t: 'hello' }), hb = await B.req({ t: 'hello' }); ok(ha.uid && hb.uid && ha.uid !== hb.uid, 'two sessions');
  A.ws.send(JSON.stringify({ t: 'pos', p: { x: 100, y: 200, coat: 'tux', name: 'Domino' } })); await sleep(300);
  ok(B.events.some(e => e.t === 'pos' && e.uid === ha.uid && e.p.x === 100), 'B sees A move');
  ok((await A.req({ t: 'set', path: 'board/' + ha.uid, data: { fish: 5 } })).ok, 'A writes own board doc');
  ok((await A.req({ t: 'set', path: 'board/' + hb.uid, data: { fish: 999 } })).err, "A cannot write B's board doc");
  ok((await B.req({ t: 'list', coll: 'board' })).docs.some(d => d.id === ha.uid), 'B reads the board');
  await A.req({ t: 'set', path: `data/users/${ha.uid}/save`, data: { v: 2, secret: 1 } });
  ok(!(await B.req({ t: 'get', path: `data/users/${ha.uid}/save` })).data, "B cannot read A's save");
  ok((await A.req({ t: 'list', coll: 'contrib' })).docs.some(d => d.id === 'seed'), 'seed treasury present');
  // a wallet signs in with an ed25519 key, the way Phantom would
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).slice(-32); const wallet = b58enc([...raw]);
  const n = await A.req({ t: 'nonce', wallet }); ok(n.msg && n.msg.includes(wallet), 'sign-in message issued');
  const bad = await A.req({ t: 'auth', wallet, sig: b58enc([...crypto.randomBytes(64)]) }); ok(bad.err, 'bad signature refused');
  await A.req({ t: 'nonce', wallet }).then(async n2 => { const sig = crypto.sign(null, Buffer.from(n2.msg, 'utf8'), privateKey); const a = await A.req({ t: 'auth', wallet, sig: b58enc([...sig]) }); ok(a.uid === 'w_' + wallet, 'wallet signed in'); });
  ok((await A.req({ t: 'get', path: `data/users/w_${wallet}/save` })).data, 'progress carried over to the wallet');
  A.ws.close(); await sleep(300); ok(B.events.some(e => e.t === 'gone'), 'B sees A leave');
  B.ws.close(); srv.kill(); fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(process.exitCode ? 'SOME TESTS FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
