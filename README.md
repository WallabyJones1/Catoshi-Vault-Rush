# Catoshi Vault Rush — standalone website

Catoshi rides a gold token through seeded hills, ramps, balloon cables and vault scenery. Entry is free for everyone, with unlimited plays. Enter a leaderboard name and optionally paste a public Solana rewards address. No token holdings, wallet connection, signature or deposit is required. Wallet-free players keep private browser progress; a rewards address is needed to receive token prizes.

## Run locally

Use Node.js 24 LTS. There are no npm dependencies or build steps.

```sh
npm test
npm start
```

Open `http://localhost:3000`. Use the server instead of opening `index.html` directly: PLAY reserves a replay-checked leaderboard run before starting. For local configuration, copy `.env.example` to `.env` and run `node --env-file=.env server.cjs`.

## Update the existing Railway service

Extract the changed-files ZIP and upload all its files together to the GitHub repository root, replacing matching filenames. Include the new **`periods.cjs`** module. Keep existing artwork, soundtrack, effects, homepage animation, `Dockerfile`, `railway.toml`, `package.json` and all unchanged runtime files. This patch is not a complete replacement repository.

Keep one replica, your existing persistent volume and database. The Dockerfile uses Node 24 and Railway checks `/health`. These variables remain valid:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_PATH` | `/data/catoshi.sqlite` on the persistent volume |
| `PUBLIC_ORIGIN` | Optional exact HTTPS origin without a trailing slash |
| `SOLANA_RPC_URL` | Optional reliable Solana mainnet RPC for vault balances/payment verification |
| `SOLANA_RPC_FALLBACK_URL` | Optional second mainnet RPC |

Railway supplies `PORT` and normally `RAILWAY_PUBLIC_DOMAIN`. Without `PUBLIC_ORIGIN`, the server uses that public domain. Same-origin writes also accept the current request host and matching Referer when a mobile browser omits Origin. Cross-site requests are rejected. An RPC outage cannot block free entry or progress.

No new Railway setting is needed to enable weekly rankings. Upload all changed code in one commit, let Railway redeploy, then reopen/reload the game. Do not delete the database. Old daily scores, reward budgets and payment records remain archived; the updated engine begins a fresh weekly competition in a separate round-ID range. An unfinished ticket from the old engine requires a new run.

## Weekly leaderboard and prizes

Weeks start **Monday at 00:00 UTC** and end the following Monday at 00:00 UTC. This Week and Last Week boards refresh every ten seconds. One best checked score per rewards address, or per private browser session for wallet-free play, appears on the board. Names are public display names rather than unique accounts; each run keeps its starting name and recipient. A guest run cannot acquire a rewards wallet after it starts.

My Week shows the latest ten starts, the weekly run count and best score. Ten displayed starts are a history window, not a limit. Guest cookies last 30 days and renew without changing identity; clearing browser cookies loses access to that private guest identity.

The **top ten distinct eligible rewards wallets** share the configured weekly pools after team review. Guests can appear on the leaderboard but cannot receive token payments. Ties use earlier submission, then run ID. A run belongs to the week when its ticket starts. The following 11-minute submission window permits a run started before Monday to finish on the prior board; it does not permit new starts in a closed week.

| Variable | Purpose | Default |
| --- | --- | --- |
| `VAULT_WALLET` | Public address of the team's funded vault | Empty |
| `REWARDS_ENABLED` | Enable prize announcements and future budgets | `false` |
| `CATOSHI_PRIZE_POOL` | CATOSHI tokens budgeted per UTC week | `100000` |
| `RUSH_MINT` | Actual Solana mint for RUSH | Empty |
| `RUSH_PRIZE_POOL` | RUSH tokens budgeted per UTC week | `0` |
| `REWARD_SPLIT` | Ten positive percentages totaling 100 | `30,20,12,10,8,6,5,4,3,2` |

Existing prize-pool variables keep their numerical values; they now fund one week, **not seven times that amount**. Optional `CATOSHI_WEEKLY_PRIZE_POOL` and `RUSH_WEEKLY_PRIZE_POOL` take precedence over their existing counterparts. Older `PRIZES_ENABLED` and `JACKPOT_TOKENS_PER_ROUND` aliases remain supported. Catoshi mint: `HrZh7koZFedTSHng4bVmhULwejpmVdSKUYxaf2N5im1b`.

The homepage weekly prize banner displays `$0` until a vault and enabled rewards are configured. Then it shows the saved CATOSHI/RUSH pools in token units. After either pool is announced, that week's vault, pools, mint and split stay fixed. Changes apply to the next week; enabling rewards can fund a previously unfunded current week. Disabling prizes does not erase a saved budget or payment obligation. Fewer than ten eligible finishers share the full pools using normalized occupied-rank weights.

**Payments still require team review and external signing.** A public wallet address cannot authorize spending. The app prepares a payment plan and verifies finalized transactions; it contains no signing key or automatic transfer worker. See [REWARDS_SETUP.md](REWARDS_SETUP.md) for commands.

## Terrain, controls and collision recovery

Tap the play area, thumb button or Space to jump. Hold in the air to backflip, then release before landing. Controls, characters and the muted orange/gold palette remain familiar. Portrait framing keeps Catoshi readable; landscape shows more of the route. Rendering interpolates fixed simulation steps without altering replay calculations. Long presses in the play area cannot select text or open the iPhone copy/paste menu; form fields remain editable.

Each seed shuffles rolling dunes, taller asymmetric peaks, deep bowls, sustained descents, rocky ridgelines and flat stretches. Section lengths and heights vary. Selected peaks get a 25–35% height lift. Smooth joins retain continuous height/slope/curvature; seeded ramps merge into that same surface. Obstacle gates search for readable approaches clear of automatic ramp flights. Rare hearts and challenging cable/collectible routes remain part of the course.

Canyon sections use dusty warm skies, bowls use darker forest silhouettes and mist, ridges use exposed rock layers, and flats use subdued night skies and sparse stars. Seamless mirrored scenery layers crossfade between sections. These variations reuse the approved art with canvas skies, requiring no extra image downloads. The camera anticipates landing height, opens its view sooner on large drops and returns to its normal scale gradually.

Catoshi starts with three lives. Distinct ground-obstacle hits each cost one life and momentum; the third ends the run. Overlapping objects share a recovery window, and one object cannot hit repeatedly. Heavy impacts retain roughly 58% speed with a recovery floor; lighter impacts retain roughly 72%. A short landing/hound recovery window prevents a bump becoming an immediate second failure. Gaps entered during that recovery remain protected until their far edge. Rare green hearts restore one life, capped at three.

High aligned falls recover rather than killing Catoshi solely for falling fast. Badly rotated held flips can cost a life; missed gaps outside protection and sustained low speed still fail. The hound appears at low speed. Harmful ground objects carry red marks, while boost/takeoff strips and heart pickups use green. Vaults and scenery bases embed in the real sand; balloons and cables remain airborne.

The opening lasts 1.25 seconds: brief anticipation, a stronger door burst, then a clear launch. Small text leaves the action visible. Audio starts from Play; the explosion fires at the breach. There is no sound button. Coin chimes remain at **5% of the effects bus**, with cached immediate playback for coins, jumps, flips, landings and impacts. The supplied music retains its level.

The homepage loops the approved ten-pose Catoshi sheet using `home.js` and its canvas, independently of GIF playback, with image fallbacks and reduced-motion handling. Existing animation/art/music files must remain in the repository. No homepage art regeneration is needed for this patch.

## Daily red quest within the weekly competition

Gold RUSH pickups grant seven active seconds of speed and invincibility. At most five red pickups appear per run, progressively farther along the course. Ten red pickups across completed checked runs in one UTC day double that day's best raw-score run. The bonus moves to a later better raw score for that same day and never stacks. The quest resets daily at **00:00 UTC**; earned boosts remain on their scores until the weekly board closes. Weekly best/history reset on Monday. A run belongs to its starting UTC day even if it finishes after midnight.

The server derives scores and pickups from the ticket's seed and recorded inputs. Client-supplied totals are ignored; duplicate submission cannot add tokens. Reviewing an invalid run recalculates its original day's quest, leaving other days intact. A saved payout plan freezes the entire weekly round. Sharing to X opens a composer and adds no points.

## Verification and limits

Run `npm test` for gameplay, seeded terrain/ramps/cables, collision recovery, camera framing, audio scheduling, optional-wallet entry, homepage animation, durable data, weekly boundaries, daily quest isolation and reviewed payout checks. Native canvas renders cover four scenery identities and opening frames. Physical iPhone playback, production RPC connectivity and the live Railway deployment were not tested in this update. No real token transfer was made.

Replay checks reject fabricated totals but do not prove human play; prize runs need operator review. SQLite requires one application instance. Paid wagering remains disabled. Each run has a ten-minute active-play limit.
