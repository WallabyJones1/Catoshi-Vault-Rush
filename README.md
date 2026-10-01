# Catoshi Vault Rush — standalone website

Catoshi rides a gold token through varied hills, jumps and cable routes. Seeded routes travel through canyon, forest, quarry and mountain vault scenery, with optional balloon grinds and jumps over red-marked obstacles. The web game includes mobile controls, the opening vault burst, backflips, sound effects and the supplied soundtrack. Practice is free. The daily holder leaderboard checks a pasted Solana address for at least **50,000 CATOSHI**, with no wallet connection or signature.

## Run locally

Use Node.js 24 LTS. The server has no npm dependencies or build step.

```sh
npm test
npm start
```

Open `http://localhost:3000`. For local configuration, copy `.env.example` to `.env` and run `node --env-file=.env server.cjs`. Opening `index.html` directly supports offline practice; wallet checks and live rankings require the server.

## Deploy or update on Railway

Keep `Dockerfile`, `railway.toml`, `package.json`, the JS/CJS files, HTML/CSS, PNGs and soundtrack at the repository root. Upload the changed files together in one GitHub commit when applying an update. **Upload all files from the complete ZIP together, including the homepage sheet, `home.js`, WAV effects, and existing art/music.** The package includes `rewards.cjs`, the Dockerfile and all required runtime files. Keep your database and Railway variables.

The Dockerfile runs Node 24 and `railway.toml` configures `/health`. Use one replica and a persistent volume mounted at `/data`. Set:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_PATH` | `/data/catoshi.sqlite` |
| `SOLANA_RPC_URL` | A reliable Solana mainnet RPC URL; defaults to PublicNode |
| `SOLANA_RPC_FALLBACK_URL` | Optional second mainnet RPC; defaults to Solana's public endpoint |
| `PUBLIC_ORIGIN` | Optional exact HTTPS origin without a trailing slash |

Railway supplies `PORT` and normally `RAILWAY_PUBLIC_DOMAIN`. The server listens on `0.0.0.0` and automatically uses that public domain when `PUBLIC_ORIGIN` is absent. Same-origin POST checks also accept the current request host. A mobile browser that omits `Origin` must send a matching `Referer`; requests without either proof and explicit cross-site requests are rejected. Arbitrary forwarded-host headers do not authorize a request. The read-only balance check uses GET and does not depend on POST headers.

Preserve the existing volume and database when updating. New daily-attempt counters and raw-score/collectible columns are added automatically; existing scores and legacy payout records are retained. Do not commit a real `.env`, database, seed phrase or private key. This file package does not change your Railway service or deploy it for you.

## Vault and daily top-10 rewards

See **[REWARDS_SETUP.md](REWARDS_SETUP.md)** for the short setup and payment guide.

| Variable | Purpose | Default |
| --- | --- | --- |
| `VAULT_WALLET` | Team vault's public Solana wallet address | Empty |
| `REWARDS_ENABLED` | Enable daily prize pools with `true`; pause new prizes with `false` | `false` |
| `CATOSHI_PRIZE_POOL` | Catoshi tokens budgeted per UTC day | `100000` |
| `RUSH_MINT` | Actual Solana token mint for $RUSH | Empty |
| `RUSH_PRIZE_POOL` | RUSH tokens budgeted per UTC day | `0` |
| `REWARD_SPLIT` | Ten positive integer percentages totaling 100 | `30,20,12,10,8,6,5,4,3,2` |

Catoshi mint: `HrZh7koZFedTSHng4bVmhULwejpmVdSKUYxaf2N5im1b`.

The homepage displays the vault's actual Catoshi balance, plus its RUSH balance when a mint is configured. It refreshes every 30 seconds while the page is visible. Failed balance reads display unavailable rather than zero. Depositing into the vault does not automatically pledge its entire balance; the daily pools are separate fixed budgets.

Each UTC day's best **ten distinct holder wallets** share both enabled token pools after team review. One wallet can occupy one prize position. The same percentage split applies independently to each token. If fewer than ten eligible wallets finish, their shares are normalized to distribute the full pools; if nobody finishes, no payment plan is created. Ranking ties use the earlier submission, then run ID.

An unfunded current day can receive its first configured reward budget when rewards are enabled. After either pool is announced, that day's vault, pools, mint and split are fixed. Changes apply to the next UTC day. Turning the master switch off stops announcing enabled prizes and funding future days; it does not erase a saved past prize budget or an existing payment plan. Old `PRIZES_ENABLED` and `JACKPOT_TOKENS_PER_ROUND` settings remain fallback aliases; the new variables take precedence.

**Payments require the team to sign transfers in its own wallet.** A public vault address cannot authorize spending. The app prepares reviewed payment plans and verifies completed transactions; it has no signing key, automatic payment worker or public payout endpoint.

## Player names, wallet entry and live scores

- Holder Entry has its own **LEADERBOARD NAME** field alongside the wallet address. Names are optional; a blank holder name uses the player name or Runner. The choice is remembered for that wallet on the same device after a successful run start. Names use 2–20 characters and are validated by the server.
- Names are public display names; duplicate names are possible. A completed run keeps the name submitted when it started. Older scores retain their original names; the daily board shows the name attached to each wallet's best run. Names are displayed as text.
- Practice needs no wallet and has its own board. When an API fails, practice still starts locally; that run is labelled local and cannot later enter the live board.
- Holder entry accepts a pasted public Solana address and checks its Catoshi holdings. The address is saved at run start as the immutable reward recipient. Rewards go to that same address.
- This checks holdings, not wallet ownership. Anyone can enter a public holder address; all scores for that address compete for its one position.
- Holders get **10 starts per wallet per UTC day**. An abandoned or expired run uses an attempt; failed validation, balance checks or asset loading do not. Attempts persist across browser sessions and server restarts. The homepage shows remaining runs, best score, daily quest and completed/in-progress/expired run history. **My Daily Progress** reads the same wallet balance and progress without spending a run.
- The daily holder board runs from 00:00 to 24:00 UTC and refreshes every 10 seconds. Today's and yesterday's boards are available. Practice keeps the best completed run per browser session.
- The server assigns a random seed and recalculates each completed score from press/release inputs. Client-provided score fields are ignored. Maximum active play time is ten minutes.
- Successful balance checks are cached for 15 seconds; failures are not cached. A failed or malformed RPC response never grants holder entry. Use a reliable mainnet RPC if public endpoints become busy.
- Balance validation runs inside provider failover. A malformed response, bad owner, wrong mint or duplicate token account is rejected and a configured alternative is tried. If a provider rejects mint-filtered queries, the checker reads the mint's actual SPL Token or Token-2022 program, queries by wallet/program and totals only the requested mint. Amounts use integer native units, including multiple accounts and fractional balances. Checks use confirmed commitment and never move tokens.
- Post Score to X opens a prefilled composer for the player to review and post. Copy Score is also available. Public score pages include social metadata.

If wallet entry reports unavailable, set `SOLANA_RPC_URL` to a working **Solana mainnet HTTP RPC** supporting `getTokenAccountsByOwner` and `getAccountInfo`. Add an independent provider as `SOLANA_RPC_FALLBACK_URL`. Enter those values as Railway service variables, not browser configuration. Public endpoints can be rate limited or inaccessible from a hosting region; the app does not replace an unavailable balance with a guess. After uploading this update, reload the page so `engine.js`, `online.js` and the server all use `flow-web-8`.

## Review and record payments

Run operator commands against the service's persistent database, with the same environment variables:

```sh
node admin.cjs rounds
node admin.cjs payout-plan ROUND_ID
```

Wait until the UTC day ends plus **11 minutes**, so active runs have time to submit. The plan selects the top ten distinct eligible wallets, rechecks each winner's 50K holdings, and checks both vault balances after reserving funds for unpaid plans. If a winner fails eligibility or either token lacks funds, no new plan is created. Review the affected entry before retrying.

The output contains each rank, reward wallet, run ID, token mint, native-unit amount, readable token amount and payment status. Repeating the command returns the saved plan instead of creating duplicate payments. Inspect the completed recordings and any questionable runs before paying. A rule-based disqualification can be recorded before any payout plan freezes that UTC day. Removing a run also removes its quest tokens and recalculates that wallet’s bonus:

```sh
node admin.cjs disqualify RUN_ID "Documented rule violation"
```

Sign approved transfers from the recorded vault outside the app. Then record the finalized transaction:

```sh
node admin.cjs record-payment ROUND_ID CATOSHI TRANSACTION_SIGNATURE
node admin.cjs record-payment ROUND_ID RUSH TRANSACTION_SIGNATURE
```

A transaction can cover one recipient or a batch. The verifier marks only recipients whose expected token credit and vault debit are present in a recent, finalized successful transaction. A batch containing both tokens can be recorded once per token for the same round. A signature cannot be reused for another round or used twice for the same token. Legacy single-winner plans keep their original `record-payment ROUND_ID SIGNATURE` syntax.

## Controls, art and audio

Tap the play area, thumb button or Space to jump. Hold in the air for a backflip; release before landing. Portrait phones use a taller play area and readable Catoshi/coins. Landscape preserves the wider scenery view. Rotation resizes rendering without changing the physics or seed. The dog appears when speed falls rather than dominating normal play.

The opening four seconds remain gentle. Larger barriers, spikes, stacks, mine carts, rocks and logs reduce momentum when hit; the impact itself never ends a run. Contact is resolved before landing failure checks. Heavy hits give two seconds of landing/hound recovery (smaller hits give 1.2 seconds); gaps entered during recovery stay protected until their far edge. Bad landings, missed gaps outside recovery and sustained low speed can still end it. Later routes mix larger hills, gaps, ramps, boosts and optional cable grinds. Red marks identify hazards and gold coin arcs suggest jumps. Required obstacles prefer approaches clear of automatic ramp flights. Ground ramps match height, slope and curvature at both ends; physics and drawing share that exact surface. Each seed changes hills, item placement and the order/timing of the three additional biomes. Background tiles mirror at shared edges and crossfade between biomes. Existing Catoshi and dog sprites retain their phone and landscape scale.

Web Audio supplies a distinct opening explosion, a metallic chime for **every coin**, jumps, backflips, landings, boosts, stumbles and crashes. The blast fires when the vault door breaches; quick coin pickups are spaced slightly instead of being discarded. Sound is primed within the first player gesture before asynchronous loading. Supported iPhone browsers request the playback audio session, and suspended or interrupted contexts resume on return. SOUND ON/OFF remembers the preference. Music and effects pause with the game and when the page is hidden. Audio support failures cannot block practice.

The supplied `music.mp3` loops at the volume in `audio-config.js`. To replace it, upload your track as `music.mp3` and adjust `musicSrc` and `musicVolume`. `effectsVolume` controls effects separately. Mobile playback uses the included twelve `sfx-*-v1.wav` files and primes eight reusable media voices inside a tap; desktop uses Web Audio with media fallback when unavailable. All WAV files must be uploaded. TEST SOUND plays a coin chime from the home menu; ENABLE SOUND appears if media playback is denied. Later trusted taps retry even if an earlier context resume is still pending. The server supports audio byte ranges for phones. `node build-effects.cjs` regenerates the checked-in clips; no deployment build step is needed. The homepage uses a new ten-pose Catoshi breath/blink/wave loop with aligned token baselines. Tall mobile menus keep the title and hero in the scrollable area. The loop waits for the image to load. Its animation stops during gameplay or when hidden; reduced-motion users see a still pose. Gameplay rendering interpolates fixed simulation steps without changing replay physics. Takeoff, flips, impact recovery and crashes have short visual responses. Metal, timber and stone impacts have separate sounds.

## RUSH pickups and daily red quest

- Large **gold RUSH** coins spin above difficult jump lips and near the far end of balloon cables. Collecting one gives **seven seconds of extra speed and invincibility** against obstacles, gaps, the hound and bad landings. The timer uses active simulation time, pauses with play and never bypasses the ten-minute run limit. Speed eases back afterward. The shield is a warm gold outline and the HUD shows remaining seconds.
- Five red-token routes per run are seeded at increasing distances: roughly **900m, 1,750m, 3,100m, 4,800m and 7,200m**, with route offsets. The final ones require a very long run. Red lightning coins and their glow are distinct from triangular hazard marks. Each run can collect at most five; missing a token does not respawn it.
- Collect **ten red RUSH across completed holder runs in one UTC day** to double that wallet's best raw score. These are cumulative pickups, not ten unique token IDs. The bonus applies to only the best run, moves automatically to a later better raw score and never stacks. Practice collectibles do not advance this quest. The quest is active whether actual token prizes are enabled or off.
- The server replays pickups from the saved seed and inputs. Client-supplied score, red-token and multiplier fields are ignored. An unfinished/expired/invalidated run does not earn quest tokens. Duplicate submissions do not add tokens twice. The leaderboard, best score, result and public score page use the checked adjusted score.
- Holder attempts, quest progress, history and daily rankings reset at **00:00 UTC**. A run belongs to the UTC day when its server ticket was reserved; finishing during that day's 11-minute grace period updates that earlier day's board. Prior results remain available on yesterday's board.
- Posting to X is an optional score composer and **adds no points**. No X credentials are needed. Both RUSH variants use the supplied cream lightning and gold-rim design, with shiny orange-gold and ruby-red faces; configuring `RUSH_MINT` is still required for real RUSH prize payments.

## Verification and limits

The local suite passes **40 tests** covering gameplay, ramps, audible audio samples, mobile controls, RPC validation/failover, pasted-address entry, quotas, durable migrations, run history, server-verified quest totals, duplicate submissions, UTC resets, bonus movement/removal and reviewed top-ten payouts. Audio checks cover every coin, interrupted-context resume, mute/pause/visibility, new jump/flip/impact/crash samples and the two RUSH collection cues.

Sampled no-input routes still fail without making obstacle hits immediately fatal. Timed taps can clear early obstacles, and optional gold/red routes are checked with varied approach speeds. A native input recording collects a red token and a gold burst before a genuine missed-gap failure. These are sampled checks, not proof of every seed or strategy. The new audio checks include actual PCM WAV energy/format, authorized mobile media reuse, every coin, pause/mute and stuck-resume recovery; speaker output on a physical iPhone is not verified here.

Local canvas checks covered portrait/landscape, the four biomes, shield/pickup/impact/vault views and all ten unclipped home poses, including visibility/reduced-motion stopping. Physical iPhone playback, production RPC connectivity and Railway deployment were not tested. The live deployment was not opened or changed, and no real token transfer was made.

Replay checks prevent simple fabricated scores; they do not establish human play. Prize plans still need operator review. SQLite requires one application instance. Paid wagering remains disabled in this package.
