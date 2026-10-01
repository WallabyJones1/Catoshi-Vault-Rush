# Catoshi Vault Rush — standalone website

One ZIP, with all website, server, and deployment files at its root. No Telegram app, Telegram SDK, bot token, npm dependencies, or private wallet key is required. Includes reference-matched orange lightning coins, subtle sound effects, an opening vault burst, higher backflip bonuses, varied seeded hills, and continuously tiled parallax scenery.

## Start here

1. Unzip the package. Keep all files together. The PNG assets are included.
2. To play without a server, open `index.html` in a browser. Practice works, but live rankings and wallet verification need the backend. Some phone file-preview apps do not execute JavaScript; in that case use the hosted website or local server.
3. For the full website, install Node.js 24 LTS and run:

   ```sh
   npm test
   npm start
   ```

4. Open `http://localhost:3000`. No build or dependency installation is needed. To change settings locally, copy `.env.example` to `.env` and use `node --env-file=.env server.cjs`.

## Deploy on Railway

1. Create a GitHub repository and upload the extracted files. Upload `Dockerfile`, `railway.toml`, `package.json`, **all JS/CJS files**, HTML/CSS, and **all five PNGs**. Keep them at the repository root. No folders need to be reconstructed on your phone. Never upload a real `.env` file, database, seed phrase, or private key. Hidden ignore files are also included; preserve them when uploading from a computer.
2. In Railway, deploy from that **confirmed** GitHub repository. Railway detects the root Dockerfile. `railway.toml` supplies the healthcheck and restart policy.
3. Attach a persistent **volume mounted at `/data`** to the game service. Use **one replica** with this SQLite configuration. Do not use a temporary container filesystem for the leaderboard. Enable Railway volume backups before launch.
4. Generate an HTTPS public domain for the service.
5. Set these service variables, then deploy:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `PUBLIC_ORIGIN` | The exact HTTPS website origin, e.g. `https://your-game.up.railway.app` — no trailing slash |
   | `DATABASE_PATH` | `/data/catoshi.sqlite` |
   | `SOLANA_RPC_URL` | A reliable Solana mainnet RPC endpoint; the public endpoint is only a fallback |
   | `VAULT_WALLET` | Optional team vault **public address** |
   | `PRIZES_ENABLED` | `false` initially |
   | `JACKPOT_TOKENS_PER_ROUND` | `100000` — ignored while prizes are disabled |

   Railway supplies `PORT`; the server listens on it at `0.0.0.0`. The Docker image runs as root so the Railway volume is writable. Database setup happens at runtime, after the volume is mounted.

6. Check `/health`, finish a practice run, see it on another browser's live leaderboard, and restart the service to confirm scores survive. Test real wallet login on a phone and desktop before enabling rewards.

Railway deployment has **not** been performed by creating this ZIP. To have it deployed for you, supply the GitHub repository in `owner/name` form and select your Railway account. Two connected accounts were visible: **Wallaby** and **Lachlan Mc**. No account or repository was guessed; no project or paid infrastructure was created.

## Names, ranking, and score sharing

- Players choose a public display name; duplicate names are possible. Practice does not require a wallet.
- Live rankings refresh every 10 seconds. The practice board keeps the best completed run per browser session; the **daily holder board** keeps the best completed run per verified wallet. Daily rounds run from **00:00 to 24:00 UTC**, not each player's local midnight. Today's and yesterday's boards are available.
- The server assigns each run a random seed, records its round, and recalculates the score from the submitted press/release inputs. Browser-reported scores are ignored. Completed runs only; maximum active play time is 10 minutes. Pauses are allowed within ticket expiry and the round submission deadline.
- Ties use the earlier submitted score, then run ID. No fake starter scores are inserted.
- Pasting a wallet only performs a balance check. Holder play requires an Ed25519 signed login challenge proving ownership, plus **50,000 CATOSHI** at run start.
- Phantom's injected provider is supported. On an iPhone, open the hosted site inside Phantom's browser to join the holder board. A general mobile wallet-connection/deep-link SDK is not included. Safari can always play practice.
- **Post Score to X** opens a prefilled composer with the score and its public score URL. The player reviews and posts it themselves. No X API token or automatic posting is involved. Copy Score is a fallback. Share pages include score-specific social metadata.
- Only player names and shortened wallets are shown on the public board. Full payout wallet addresses and input recordings are held in the server database. Names are rendered as text, not HTML. There is no public admin interface.

## Add the Catoshi vault safely

Catoshi mint:

`HrZh7koZFedTSHng4bVmhULwejpmVdSKUYxaf2N5im1b`

1. Use a team-controlled Solana wallet and deposit CATOSHI into it yourself. It also needs SOL for transfers you sign outside this app.
2. Add only its public address to `VAULT_WALLET`. `/api/vault` reports its CATOSHI balance. The website cannot spend the vault's funds.
3. Before offering prizes, approve and publish the rules, budget, eligibility timing, review process, and submission deadlines; obtain appropriate security and jurisdiction-specific legal review.
4. Set a **fixed whole-token budget per daily UTC round** in `JACKPOT_TOKENS_PER_ROUND` (your proposed amount is **100,000 CATOSHI/day**). Only then set `PRIZES_ENABLED=true`. Merely depositing into the vault does **not** automatically distribute its entire balance. The total vault balance is not advertised as a promised jackpot. In this V1, the daily budget goes to the highest valid holder score, following review; splitting it between several winners is not implemented.
5. Each round snapshots the budget and vault when its first run starts. Configuration changes apply to new rounds, not retroactively. A round with no funded budget cannot later be silently converted into a prize round. Holder rankings can still operate while prizes are disabled.

There are **no private keys in this application, no transaction signing, and no automatic token transfers**. Manual approval is intentional. This is a deployable prototype, not an audited high-value prize system. Paid wagering is not enabled; see `ECONOMY_DESIGN.md` for the separate proposal and unresolved decisions.

## Manually review and settle a round

Run these commands with server/volume access, e.g. in your Railway service shell. They are not public website endpoints.

```sh
node admin.cjs rounds
node admin.cjs payout-plan ROUND_ID
```

Wait until the UTC day closes plus its **11-minute submission grace window**. The plan selects the highest valid holder score, rechecks the winner's 50K holdings, checks the snapshot vault balance minus already-reserved review plans, and stores a `review` record. Review its input recording, player behavior, amount, mint, and recipient before paying. A lack of holdings or funds blocks the plan; it does not automatically pick a different winner or spend anything.

If a run breaches your already-published rules, an operator can record a reason **before a payout plan references it**:

```sh
node admin.cjs disqualify RUN_ID "Documented rule violation"
```

After review, sign the approved CATOSHI transfer in your team wallet, **outside this website**. Then record its transaction signature:

```sh
node admin.cjs record-payment ROUND_ID TRANSACTION_SIGNATURE
```

This checks a recent, finalized, successful Solana transaction for the expected CATOSHI debit from the vault and credit to the chosen winner before marking the record paid. A signature cannot be reused for another round. One payment per recorded plan; batch settlements are not supported. Never retry a payment blindly: inspect your wallet/chain transaction and the payout record first.

## Security boundaries / before a high-value launch

Server replay prevents simple fabricated scores, but **does not prove a human played**. Bots, scripted inputs, alternate wallets, and emulator assistance still require additional defenses and manual review. Do not advertise the game as bot-proof. Human review is not itself a guarantee.

Included: same-origin POST enforcement, HttpOnly/SameSite cookies (Secure in production), single-use login challenges, bounded recording sizes, run expiry, version checks, elapsed-time checks, basic request/run limits, parameterized SQL, static-file allowlisting, and CSP. SQLite is for one application instance; use a managed database before scaling across replicas. IP limits are intentionally conservative and may need reviewed proxy-aware tuning under load. This is not a DDoS protection service.

Score checking runs in bounded worker threads rather than blocking the HTTP loop. Practice identity is a browser session, not a permanent account: clearing cookies creates a new identity. Retain completed recordings for independent review and adopt a documented privacy/retention policy before launch. Starting a seeded run is not protection against an automated player planning its inputs.

## Phone gameplay

On portrait phones, the game fills a taller play area with a larger but still restrained Catoshi, larger readable coins, clear score/distance text, and a 68px-high thumb control. Tap anywhere in the play area or the button to jump; hold in the air for a backflip and release before landing. Landscape keeps the wide scenery-focused view. Rotation resizes the canvas without changing the run seed or physics. The original landscape look is preserved on desktop.

## Sound effects and your soundtrack

Sound is synthesized locally with Web Audio: coin chimes, jumps, landed backflips, boosts, cable catches, landings, stumbles, crashes and the vault burst. Audio unlocks on the first interaction; it never blocks practice if unsupported. **SOUND ON/OFF** remembers the player's preference. Music pauses with the game and when the page is hidden.

Your supplied **kaapz – Cat Arpeggio** is included as `music.mp3` and configured to loop during runs at 16% volume, independently from effects. The server supports byte-range audio playback for mobile browsers. Confirm you have the public-use rights before publishing the soundtrack. The home screen cycles through Catoshi's ride, balance, hop, backflip and landing poses; reduced-motion users see a still pose.

To add your soundtrack:

1. Put a track you own or are licensed to use alongside `index.html`, named **`music.mp3`** (or `music.ogg` / `music.wav`).
2. In `audio-config.js`, set `musicSrc: 'music.mp3'`. Adjust `musicVolume` separately from `effectsVolume` between 0 and 1.
3. Upload the track and configuration, then redeploy. The Docker build includes the optional track automatically. Set `musicSrc: ''` to disable the music. No missing music file is requested while it is blank. Browsers can still block music until another interaction; the mute button can re-unlock it.

## Checks performed for this package

`npm test` covers physics and 300 varied seed introductions, deterministic score replay, malformed recordings, bounded endless generation, wallet signatures, the 50K balance threshold, HTTP entry/submission/leaderboard/share flow, static-file isolation, SQLite reopening, manual payout verification, practice controls, and audio fallback/preferences. Canvas renders are also inspected separately during packaging.

These are not a security audit or confirmation of physical-phone, real-wallet, production RPC, real-token payout, or Railway-container behavior. Run the launch checklist above before enabling rewards. No real money/token transfer is performed by the tests.

Launch checklist:

- Reliable mainnet RPC, persistent volume and backups, HTTPS origin configured.
- Test physical phones, real wallets, browser differences, leaderboard persistence, service restart, and outage behavior.
- Simulate payouts with a separate low-value test vault; have the code and prize rules independently reviewed.
- Add production-grade bot detection, moderation, monitoring, abuse controls, and privacy/retention policy appropriate to the audience.
- No seeds, private keys, wallet secrets, or RPC credentials in GitHub or screenshots.

## Reference documentation

- Railway Dockerfiles: https://docs.railway.com/builds/dockerfiles
- Railway volumes: https://docs.railway.com/volumes
- Node SQLite: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
- Phantom signing: https://docs.phantom.com/solana/signing-a-message
- Solana transaction lookup: https://solana.com/docs/rpc/http/gettransaction

`ART_DIRECTION.md` retains the cleaner asset generation prompts and frame-crop notes. This web edition flattens the asset paths to the ZIP root.
