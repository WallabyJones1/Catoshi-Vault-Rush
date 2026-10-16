/* Catoshi's Catch server
   - serves the game (dist/index.html) and its public settings (/config)
   - multiplayer over WebSocket (/ws): every cat in the world sees every other cat, with quick emotes
   - Phantom wallet sign-in: the server sends a message, the wallet signs it, the server checks the ed25519 signature
   - keeps the shared board, the replay feed, the pool ledgers and each player's save, written to dataDir/state.json
   Edit config.json and restart. Nothing touches the chain while mode is "play". */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');

const ROOT = __dirname;
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, process.env.CONFIG || 'config.json'), 'utf8'));
const PORT = +process.env.PORT || CFG.server.port || 8080;
/* hosting overrides (Railway): a mounted volume keeps saves across redeploys; secrets stay out of config.json */
CFG.server.publicUrl = process.env.PUBLIC_URL || CFG.server.publicUrl || '';
CFG.server.adminToken = process.env.ADMIN_TOKEN || CFG.server.adminToken;
if (process.env.NODE_ENV === 'production' && (!CFG.server.adminToken || CFG.server.adminToken.startsWith('change-me'))) CFG.server.adminToken = null; // admin view off until ADMIN_TOKEN is set
const DATA = path.resolve(ROOT, process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || CFG.server.dataDir || './data');
const STATE_FILE = path.join(DATA, 'state.json');
fs.mkdirSync(DATA, { recursive: true });

/* ---------- state: one JSON document store, the same shape the game uses in its claude.ai version ---------- */
let STATE = { docs: {}, sessions: {} };
try { STATE = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
STATE.docs = STATE.docs || {}; STATE.sessions = STATE.sessions || {};
let dirty = false;
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
function weekKey(d = new Date()) { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); }
if (!STATE.docs['contrib/seed']) {
  const s = CFG.seed || {};
  STATE.docs['contrib/seed'] = { note: "Catoshi's starting treasury", d: { [dayKey()]: s.daily || 0 }, w: { [weekKey()]: s.weekly || 0 }, trips: s.trips || 0, house: s.house || 0, tripsPaid: 0, housePaid: 0 };
  dirty = true;
}
function flush() { if (!dirty) return; dirty = false; const tmp = STATE_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(STATE)); fs.renameSync(tmp, STATE_FILE); }
setInterval(flush, 5000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { flush(); } catch (e) {} process.exit(0); }); // a redeploy loses nothing

/* who may read and write what: shared docs are readable by all; each cat writes only its own */
const OWN = [/^board\/([^/]+)$/, /^wins\/([^/]+)$/, /^contrib\/([^/]+)$/, /^data\/users\/([^/]+)\/save$/];
const okPath = p => typeof p === 'string' && p.length < 300 && /^[A-Za-z0-9_\-.~:@+/]+$/.test(p) && !p.includes('..');
function canWrite(uid, p) { for (const re of OWN) { const m = re.exec(p); if (m) return m[1] === uid; } return false; }
function canRead(uid, p) { const m = /^data\/users\/([^/]+)\//.exec(p); return m ? m[1] === uid : true; }

/* ---------- Phantom sign-in: base58 + ed25519, no extra dependencies ---------- */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58dec(s) { const bytes = [0]; for (const ch of s) { let v = B58.indexOf(ch); if (v < 0) throw new Error('b58'); for (let j = 0; j < bytes.length; j++) { v += bytes[j] * 58; bytes[j] = v & 255; v >>= 8; } while (v) { bytes.push(v & 255); v >>= 8; } } for (const ch of s) { if (ch !== '1') break; bytes.push(0); } return Buffer.from(bytes.reverse()); }
const SPKI = Buffer.from('302a300506032b6570032100', 'hex');
function verifySig(walletB58, msg, sigB58) { try { const pub = b58dec(walletB58); if (pub.length !== 32) return false; const key = crypto.createPublicKey({ key: Buffer.concat([SPKI, pub]), format: 'der', type: 'spki' }); return crypto.verify(null, Buffer.from(msg, 'utf8'), key, b58dec(sigB58)); } catch (e) { return false; } }

/* ---------- the public settings the game reads at boot ---------- */
function publicConfig() {
  return { mode: CFG.mode, token: CFG.token, wallets: Object.fromEntries(Object.entries(CFG.wallets || {}).filter(([k]) => !k.startsWith('_'))),
    prices: CFG.prices, splits: Object.fromEntries(Object.entries(CFG.splits || {}).filter(([k]) => !k.startsWith('_'))), payouts: CFG.payouts, publicUrl: CFG.server.publicUrl || '' };
}

/* ---------- HTTP ---------- */
const INDEX = path.join(ROOT, 'dist', 'index.html');
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('User-agent: *\nDisallow: /\n'); }
  if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, online: clients.size, mode: CFG.mode })); }
  if (u.pathname === '/config') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(publicConfig())); }
  if (u.pathname === '/admin/state') {
    if (!CFG.server.adminToken || req.headers['x-admin-token'] !== CFG.server.adminToken) { res.writeHead(403); return res.end('forbidden'); }
    const players = Object.keys(STATE.docs).filter(k => k.startsWith('board/')).length;
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ players, online: clients.size, ledgers: Object.entries(STATE.docs).filter(([k]) => k.startsWith('contrib/')).map(([k, v]) => ({ id: k.slice(8), house: v.house, trips: v.trips })) }, null, 1));
  }
  if (u.pathname === '/' || u.pathname === '/index.html' || u.pathname === '/catoshicatch' || u.pathname === '/catoshicatch/') {
    fs.readFile(INDEX, (e, buf) => { if (e) { res.writeHead(500); return res.end('Build the game first: python3 build.py'); } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-robots-tag': 'noindex, nofollow' }); res.end(buf); });
    return;
  }
  res.writeHead(404); res.end('not found');
});

/* ---------- WebSocket: sessions, sign-in, documents, presence ---------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 400 * 1024 });
const clients = new Map(); // ws -> {sid, uid, wallet, nonce, pos, lastPos, lastEmote}
const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
const broadcast = (m, except) => { const s = JSON.stringify(m); for (const ws of clients.keys()) if (ws !== except && ws.readyState === 1) ws.send(s); };
const EMOTES = ['Hi!', 'Nice catch!', 'Follow me!', 'Fish here!', 'For Catoshi!', 'Meow.'];

wss.on('connection', ws => {
  const c = { sid: null, uid: null, wallet: null, nonce: null, pos: null, lastPos: 0, lastEmote: 0, alive: true };
  clients.set(ws, c);
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const reply = d => send(ws, Object.assign({ re: m.id }, d));
    switch (m.t) {
      case 'hello': {
        let s = m.sid && STATE.sessions[m.sid];
        if (!s) { const sid = crypto.randomBytes(18).toString('base64url'); s = STATE.sessions[sid] = { uid: 'a_' + crypto.randomBytes(8).toString('hex'), wallet: null, t: Date.now() }; m.sid = sid; dirty = true; }
        c.sid = m.sid; c.uid = s.uid; c.wallet = s.wallet;
        reply({ sid: c.sid, uid: c.uid, wallet: c.wallet, config: publicConfig(), others: [...clients.values()].filter(o => o !== c && o.pos).map(o => Object.assign({ uid: o.uid }, o.pos)) });
        return;
      }
      case 'nonce': {
        const w = String(m.wallet || ''); if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)) return reply({ err: 'That is not a Solana wallet address.' });
        c.nonce = { w, msg: `Sign in to Catoshi's Catch\nWallet: ${w}\nNonce: ${crypto.randomBytes(12).toString('hex')}\nThis does not move any tokens.` };
        return reply({ msg: c.nonce.msg });
      }
      case 'auth': {
        if (!c.nonce || c.nonce.w !== m.wallet) return reply({ err: 'Ask for a sign-in message first.' });
        const ok = verifySig(m.wallet, c.nonce.msg, String(m.sig || '')); c.nonce = null;
        if (!ok) return reply({ err: 'The signature did not check out.' });
        const uid = 'w_' + m.wallet; const s = STATE.sessions[c.sid]; const old = c.uid;
        // first sign-in on this wallet carries this device's progress over
        if (!STATE.docs[`data/users/${uid}/save`] && STATE.docs[`data/users/${old}/save`]) STATE.docs[`data/users/${uid}/save`] = STATE.docs[`data/users/${old}/save`];
        s.uid = uid; s.wallet = m.wallet; c.uid = uid; c.wallet = m.wallet; dirty = true;
        broadcast({ t: 'gone', uid: old }, ws);
        return reply({ uid, wallet: m.wallet });
      }
      case 'signout': { const s = STATE.sessions[c.sid]; if (s) { s.uid = 'a_' + crypto.randomBytes(8).toString('hex'); s.wallet = null; c.uid = s.uid; c.wallet = null; dirty = true; } return reply({ uid: c.uid }); }
      case 'get': { if (!c.uid || !okPath(m.path) || !canRead(c.uid, m.path)) return reply({ data: null }); return reply({ data: STATE.docs[m.path] || null }); }
      case 'list': {
        if (!c.uid || !okPath(m.coll)) return reply({ docs: [] });
        const pre = m.coll + '/', n = Math.min(1000, +m.limit || 500), docs = [];
        for (const [k, v] of Object.entries(STATE.docs)) { if (!k.startsWith(pre) || k.slice(pre.length).includes('/')) continue; if (!canRead(c.uid, k)) continue; docs.push({ id: k.slice(pre.length), data: v }); if (docs.length >= n) break; }
        return reply({ docs });
      }
      case 'set': {
        if (!c.uid || !okPath(m.path) || !canWrite(c.uid, m.path)) return reply({ err: 'not allowed' });
        if (!m.data || typeof m.data !== 'object' || JSON.stringify(m.data).length > 256 * 1024) return reply({ err: 'too big' });
        STATE.docs[m.path] = m.data; dirty = true; return reply({ ok: true });
      }
      case 'pos': {
        const now = Date.now(); if (now - c.lastPos < 120 || !c.uid) return; c.lastPos = now;
        const p = m.p || {}; c.pos = { x: +p.x || 0, y: +p.y || 0, boat: !!p.boat, hd: (p.hd | 0) & 15, dir: (p.dir | 0) & 3, fr: (p.fr | 0) % 3, coat: String(p.coat || 'ginger').slice(0, 12), name: String(p.name || 'Cat').replace(/[<>]/g, '').slice(0, 16), boatK: String(p.boatK || '').slice(0, 10), away: !!p.away };
        broadcast({ t: 'pos', uid: c.uid, p: c.pos }, ws); return;
      }
      case 'emote': { const now = Date.now(); if (now - c.lastEmote < 2500 || !c.uid) return; c.lastEmote = now; const i = m.i | 0; if (!EMOTES[i]) return; broadcast({ t: 'emote', uid: c.uid, text: EMOTES[i] }); return; }
    }
  });
  ws.on('close', () => { clients.delete(ws); if (c.uid) broadcast({ t: 'gone', uid: c.uid }); });
});
setInterval(() => { for (const [ws, c] of clients) { if (!c.alive) { ws.terminate(); continue; } c.alive = false; try { ws.ping(); } catch (e) {} } }, 30000);

server.listen(PORT, () => console.log(`Catoshi's Catch on http://localhost:${PORT}  (mode: ${CFG.mode})`));
