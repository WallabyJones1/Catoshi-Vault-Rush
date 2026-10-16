# Catoshi's Catch

A pixel fishing town where cats fish for Catoshi. Built on the Gullhaven art and world engine.

- Walk a small fishing town. Sail a big sea with five islands.
- Fish with Fishing 2.0, the original game's fight.
- Bring your catch to Catoshi's basket for points.
- Points win shares of the Daily Pot and the Weekly Cup.

## Run it

```bash
python3 build.py      # concatenates src/js/m*.js into src/template.html -> dist/index.html (server) and dist/catoshi.html (claude.ai artifact)
npm install
npm start             # http://localhost:8080  (PORT=... to change)
npm test              # server end-to-end: two players, presence, private saves, wallet sign-in
```

The same game runs in two places:

| Where | Storage and multiplayer | Wallet |
|---|---|---|
| claude.ai artifact (`dist/catoshi.html`) | The artifact's shared database | None |
| This server (`dist/index.html`) | The server (`data/state.json`), with live multiplayer over `/ws` | Phantom sign-in |

## Testing with Phantom

1. Deploy the server somewhere with https and set `server.publicUrl` in `config.json`.
2. On a phone, open that URL. Tap **CONNECT WALLET**. The game opens itself inside Phantom's in-app browser.
3. In Phantom, tap **CONNECT WALLET** again. Approve the connection and sign the message.
   - The message says "This does not move any tokens". It only proves you own the wallet.
4. On desktop, the Phantom extension works directly.

Signed-in progress follows the wallet to any device.

## Putting it on catoshirush.fun/catoshicatch (for Anton)

`python3 build.py` also writes **`dist/catoshicatch/index.html`**, the website copy. It is one self-contained file with fonts, art and code inlined and no other assets.

1. Copy `dist/catoshicatch/index.html` into the site so it serves at `/catoshicatch` (for example `public/catoshicatch/index.html`). Don't link it from anywhere.
2. It carries `<meta name="robots" content="noindex,nofollow">`, so search engines skip it. It is unlisted, not locked: anyone who has the URL can play.
3. **Solo for now.** The `catoshi-server` meta tag is empty, so the game plays on the device: saves stay in the browser, and there's no multiplayer, shared board or wallet button.
4. **To switch on multiplayer later**, host `server.js` anywhere that runs Node and keeps a WebSocket open (Railway, Render, Fly, a VPS). Vercel/Netlify static hosting can't run it. Then:
   - set `server.publicUrl` to `https://catoshirush.fun/catoshicatch` and change `adminToken` in `config.json`
   - rebuild the website copy pointed at it: `CATOSHI_SERVER=https://your-game-server.example python3 build.py`
   - redeploy `dist/catoshicatch/index.html`. The page then talks to that server's `/ws` across origins.

## config.json: everything you will edit before launch

| Section | What it holds |
|---|---|
| `mode` | `play` (now): $CATOSHI is a play balance kept by the server. `live` is reserved for launch. |
| `server` | Port, public https URL (for the Phantom deep link), data folder and admin token. |
| `token` | Symbol, mint, decimals and RPC. The $CATOSHI mint is already filled in. |
| `wallets` | Public addresses for the Daily Pot, Weekly Cup, Trip Fund, house and payout wallets. Never put a private key here. |
| `prices` | Starting balance, licence price, auto-fishing cost per cast, auto-catch value rate. |
| `splits` | Where each kind of spending goes (daily / weekly / trips / house). Each row should add up to 1. |
| `payouts` | Share of each pot paid out, the top-10 prize split and the Trip Fund target. |
| `seed` | Catoshi's starting treasury, added once on a fresh data folder. |

The game reads `prices`, `splits` and `payouts` from the server at boot, so changing them needs only a restart.

Admin view: `GET /admin/state` with header `x-admin-token: <adminToken>`.

## Before real tokens

Playing for real $CATOSHI needs more server work:

- The server must own every balance and the pool ledgers.
- Pools must sit in your pool wallets.
- Deposits must be read from finalized transactions.
- Prizes must be paid from the payout wallet, with an admin approval step, the way Gullhaven's live mode did.

In play mode each client still works out its own ledger and claims. That's fine for testing, but it isn't safe for money.

Paid entry plus prize pools and a jackpot is regulated gambling in Australia and many other places. Get legal advice before switching `mode` to `live`.

## Source map

| Module | What it holds |
|---|---|
| `m00`-`m05` | Gullhaven: utilities, sound, fonts, all the pixel art, fish and finds catalogue, boats and gear, the tile and coast painters |
| `m20_cats` | The ten cats, walking sprites, Catoshi (big and small), his golden chair and basket, the Rush token |
| `m21_whale` | The White Whale |
| `m30_core` | Rules, save, the side-on fishing scene layout, particles, UI helpers |
| `m31_fish` | Fishing 2.0: cast, nibbles and bite styles, the tension fight, net and gaff, landing cinematics |
| `m32_extras` | Contests, crew trips, the tackle shop, board, the White Whale game, Token Rain, bottles, replays |
| `m33_main` | Drawing, the frame loop, input |
| `m34_world` | The town and the sea: islands, sailing, the thumb stick, digging, beachcombing, salvage, the map |
| `m35_economy` | Pools, the house edge, licences, daily and weekly payouts |
| `m36_server` | Server mode: multiplayer presence, emotes, Phantom sign-in |
