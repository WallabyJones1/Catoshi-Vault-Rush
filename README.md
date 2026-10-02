# Catoshi Vault Rush — standalone website

Catoshi rides a gold token through varied hills, jumps and cable routes. Seeded routes travel through canyon, forest, quarry and mountain vault scenery, with optional balloon grinds and jumps over red-marked obstacles. The web game includes mobile controls, the opening vault burst, backflips, sound effects and the supplied soundtrack. Practice is free. Prize entry is **free for everyone with unlimited plays**. Paste a valid public Solana rewards address; no token holdings, connection or signature is required. The daily top ten reward wallets share the configured pools.

## Run locally

Use Node.js 24 LTS. The server has no npm dependencies or build step.

```sh
npm test
npm start
```

Open `http://localhost:3000`. For local configuration, copy `.env.example` to `.env` and run `node --env-file=.env server.cjs`. Use the server rather than opening `index.html` directly: the single Play flow reserves a checked leaderboard run before starting.

## Deploy or update on Railway

Keep `Dockerfile`, `railway.toml`, `package.json`, the JS/CJS files, HTML/CSS, PNGs and soundtrack at the repository root. Upload the changed files together in one GitHub commit when applying an update. **Upload all files from the complete ZIP together, including `catoshi-home-v2.webp`, its GIF/still fallbacks, `home.js`, WAV effects, and existing art/music.** The package includes `rewards.cjs`, the Dockerfile and all required runtime files. Keep your database and Railway variables.

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

Each UTC day's best **ten distinct reward wallets** share both enabled token pools after team review. One wallet can occupy one prize position. The same percentage split applies independently to each token. If fewer than ten eligible wallets finish, their shares are normalized to distribute the full pools; if nobody finishes, no payment plan is created. Ranking ties use the earlier submission, then run ID.

An unfunded current day can receive its first configured reward budget when rewards are enabled. After either pool is announced, that day's vault, pools, mint and split are fixed. Changes apply to the next UTC day. Turning the master switch off stops announcing enabled prizes and funding future days; it does not erase a saved past prize budget or an existing payment plan. Old `PRIZES_ENABLED` and `JACKPOT_TOKENS_PER_ROUND` settings remain fallback aliases; the new variables take precedence.

**Payments require the team to sign transfers in its own wallet.** A public vault address cannot authorize spending. The app prepares reviewed payment plans and verifies completed transactions; it has no signing key, automatic payment worker or public payout endpoint.

## Player names, wallet entry and live scores

- The single **PLAY** form contains a rewards wallet and optional **LEADERBOARD NAME**. A blank name uses Runner. The choice is remembered for that wallet on the same device after a successful run start. Names use 2–20 characters and are validated by the server.
- Names are public display names; duplicate names are possible. A completed run keeps the name submitted when it started. Older scores retain their original names; the daily board shows the name attached to each wallet's best run. Names are displayed as text.
- There is one free play mode and one daily leaderboard. Practice buttons and the practice board have been removed. A failed start returns to the entry screen with a retryable error; no untracked local run starts silently.
- Prize entry validates a pasted public Solana address only. No token RPC, ownership proof, wallet connection or deposit is required. The address is saved at run start as the immutable reward recipient; finishing cannot redirect it.
- This is a reward address, not proof of ownership. All scores for the same address compete for one prize position.
- Everyone gets **unlimited starts**, including after abandoning or expiring earlier runs and across sessions/restarts. The durable daily counter is progress information only, never a quota. My Daily Progress reads the database without a token RPC or starting a run. History shows the latest ten starts, not a ten-run limit.
- The daily prize board runs from 00:00 to 24:00 UTC and refreshes every ten seconds. Today's and yesterday's boards are available. The best completed score per rewards wallet is ranked. Historical practice records remain in the database for compatibility but are no longer created or shown.
- The server assigns a random seed and recalculates each completed score from press/release inputs. Client-provided score fields are ignored. Maximum active play time is ten minutes.
- Vault balance checks remain cached for 15 seconds; failures are not cached. Provider failover, exact native token amounts and SPL Token/Token-2022 queries are retained for treasury balances and payout verification. An RPC outage can hide the vault balance but cannot block free entry or daily progress.
- Post Score to X opens a prefilled composer for the player to review and post. Copy Score is also available. Public score pages include social metadata.

Free entry needs the game API and a valid public wallet address, not a Solana RPC. Configure `SOLANA_RPC_URL` and optional `SOLANA_RPC_FALLBACK_URL` with mainnet providers for vault balances and payout verification. Client/replay physics remain `flow-web-9`.

## Review and record payments

Run operator commands against the service's persistent database, with the same environment variables:

```sh
node admin.cjs rounds
node admin.cjs payout-plan ROUND_ID
```

Wait until the UTC day ends plus **11 minutes**, so active runs have time to submit. The plan selects the top ten distinct wallets with completed, checked, non-disqualified scores. It never checks recipients' token holdings. It verifies the vault balances after reserving funds for unpaid plans; insufficient treasury funding creates no new plan. Review the affected entries and funding before retrying.

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

The opening four seconds remain gentle. Larger barriers, spikes, stacks, mine carts, rocks and logs reduce momentum when hit; the impact itself never ends a run. Contact is resolved before landing failure checks. Heavy hits give two seconds of landing/hound recovery (smaller hits give 1.2 seconds); gaps entered during recovery stay protected until their far edge. Holding a badly rotated flip through touchdown, missed gaps outside recovery and sustained low speed can still end it. High fall speed alone does not kill an auto-aligned rider: rough landings remove momentum, reset combo and give 1.2 seconds of recovery with a dust/impact cue. Rough touchdowns do not bank flip bonuses. Later routes mix larger hills, gaps, ramps, boosts and optional cable grinds. Every harmful ground object, including ordinary rocks/crates without a hazard flag, has a small red face mark and warning crest. Boost pads and takeoff strips use green; gold coin arcs suggest jumps. Required obstacles prefer approaches clear of automatic ramp flights. Ground ramps match height, slope and curvature at both ends; physics and drawing share that exact surface. Each seed changes hills, item placement and the order/timing of the three additional biomes. Background tiles mirror at shared edges and crossfade between biomes. Existing Catoshi and dog sprites retain their phone and landscape scale.

The vault mounts into the sand across its whole stone base. Stone arches follow the hill angle; trees and lights remain upright with their roots/feet embedded. Props whose bases overlap a gap are omitted. Ground obstacles and boost pads fit the curve under their footprint, with subtle contact shadows. Balloons and their grind cables remain airborne. These changes affect rendering only: collision rules, terrain, input recordings and replay version are unchanged.

Audio starts with the first normal Play or gameplay gesture. There is no sound button or saved mute preference. Mobile and desktop both reuse cached Web Audio buffers: each coin chime, jump, flip, material impact and crash starts at the event time, without the old 40 ms coin queue or loading another file per pickup. The coin-specific gain is now 0.45 of the effects bus on both Web Audio and WAV fallback, down from 0.8 in the previous package (about 44% quieter). The music and other effects keep their levels. The opening explosion fires when the vault door breaches. Power-up melodies retain their short internal note sequences. Audio initialization cannot block play.

The audio context requests interactive latency and the playback audio session where supported. A reusable silent media element primes the mobile playback route. Browsers without working Web Audio use preloaded WAV voices dedicated to each effect. A brief interruption may retain a cue for up to 80 ms; older events are discarded rather than replayed as a delayed backlog. Normal input retries interrupted audio. Music and effects pause with the game and when the page is hidden.

The supplied `music.mp3` loops quietly. To replace it, upload your track as `music.mp3` and adjust `musicSrc`/`musicVolume` in `audio-config.js`. `effectsVolume` controls effects separately and `coinVolume` adjusts just the coin chime (default `0.45`); `enabled: false` disables audio through configuration. Keep the twelve `sfx-*-v1.wav` files for fallback playback. The server supports audio byte ranges. `node build-effects.cjs` regenerates the checked-in clips; no deployment build step is needed.

The homepage uses a transparent, native animated image assembled from the approved ten-pose Catoshi sheet. It repeats indefinitely every 3.62 seconds with breath/blink/wave poses and aligned token baselines. It appears and loops without canvas, animation timers or `home.js`; the script only supplies GIF/still fallbacks and respects reduced-motion preferences. The complete package includes all three media files. `python3 tools/build_home_animation.py` regenerates them with Pillow; Railway serves the prebuilt assets and needs no Python dependency. Cache versions have been bumped. Tall menus start at the top when they overflow, keeping the title and hero scrollable. Gameplay rendering still interpolates fixed simulation steps without changing replay physics.


## RUSH pickups and daily red quest

- Large **gold RUSH** coins spin above difficult jump lips and near the far end of balloon cables. Collecting one gives **seven seconds of extra speed and invincibility** against obstacles, gaps, the hound and bad landings. The timer uses active simulation time, pauses with play and never bypasses the ten-minute run limit. Speed eases back afterward. The shield is a warm gold outline and the HUD shows remaining seconds.
- Five red-token routes per run are seeded at increasing distances: roughly **900m, 1,750m, 3,100m, 4,800m and 7,200m**, with route offsets. The final ones require a very long run. Red lightning coins and their glow are distinct from triangular hazard marks. Each run can collect at most five; missing a token does not respawn it.
- Collect **ten red RUSH across completed prize runs in one UTC day** to double that wallet's best raw score. These are cumulative pickups, not ten unique token IDs. The bonus applies to only the best run, moves automatically to a later better raw score and never stacks. Practice collectibles do not advance this quest. The quest is active whether actual token prizes are enabled or off.
- The server replays pickups from the saved seed and inputs. Client-supplied score, red-token and multiplier fields are ignored. An unfinished/expired/invalidated run does not earn quest tokens. Duplicate submissions do not add tokens twice. The leaderboard, best score, result and public score page use the checked adjusted score.
- Daily progress, quest totals and rankings reset at **00:00 UTC**. A run belongs to the UTC day when its server ticket was reserved; finishing during that day's 11-minute grace period updates that earlier day's board. Prior results remain available on yesterday's board.
- Posting to X is an optional score composer and **adds no points**. No X credentials are needed. Both RUSH variants use the supplied cream lightning and gold-rim design, with shiny orange-gold and ruby-red faces; configuring `RUSH_MINT` is still required for real RUSH prize payments.

## Verification and limits

The local suite passes **45 tests** covering gameplay, ramps, audible audio samples, mobile controls, RPC validation/failover, pasted-address entry without RPCs, unlimited starts, durable migrations, run history, server-verified quest totals, duplicate submissions, UTC resets, bonus movement/removal and reviewed top-ten payouts. Landing checks cover high released-input falls onto uphill, flat and downhill ground, one rough impact, recoverable obstacles, held bad flips, and replay consistency. Audio checks cover immediate overlapping coin dispatch, cached mobile playback, preloaded fallback voices, interrupted-context recovery without stale backlogs, pause/visibility, configuration disablement, and distinct gameplay cues.

Sampled no-input routes still fail without making obstacle hits immediately fatal. Timed taps can clear early obstacles, and optional gold/red routes are checked with varied approach speeds. A native input recording collects a red token and a gold burst before a genuine missed-gap failure. These are sampled checks, not proof of every seed or strategy. Audio checks validate PCM WAV energy/format and scheduling, but actual device/speaker latency on a physical iPhone has not been measured here.

Local canvas checks covered portrait/landscape, the four biomes, shield/pickup/impact/vault views and all ten unclipped home poses, including ten-frame native-loop packaging and reduced-motion/fallback switching. Separate downhill/uphill and curved-ground renders checked vault, arch and tree attachment without changing gameplay state. Physical iPhone playback, production RPC connectivity and Railway deployment were not tested. The live deployment was not opened or changed, and no real token transfer was made.

Replay checks prevent simple fabricated scores; they do not establish human play. Prize plans still need operator review. SQLite requires one application instance. Paid wagering remains disabled in this package.


This release checks the one-button start flow, failure/retry, input/pause/resume, all served homepage media, native-loop frame counts and fallback/reduced-motion handling. The local browser download was unavailable, so this release was checked with Node DOM/audio harnesses and native image decoding, not a real browser or physical phone. No live deployment was inspected or modified.
