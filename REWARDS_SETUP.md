# Vault and rewards setup

## Paste these variables into the Railway game service

| Variable | Set it to |
| --- | --- |
| `VAULT_WALLET` | Your team's public Solana wallet address |
| `REWARDS_ENABLED` | `true` when you want to enable daily prizes; otherwise `false` |
| `CATOSHI_PRIZE_POOL` | `100000`, or your chosen daily Catoshi token amount |
| `RUSH_MINT` | The actual Solana mint address of $RUSH |
| `RUSH_PRIZE_POOL` | Your chosen daily RUSH token amount, e.g. `10000` |

The homepage prize banner stays at `$0` until `VAULT_WALLET` is set and `REWARDS_ENABLED=true`. It then shows the configured daily CATOSHI and optional RUSH pools in token units. The `/api/vault` endpoint still reports treasury balances; the compact homepage does not show a separate vault-balance card. For Catoshi-only prizes, leave the RUSH pool at `0`; no RUSH mint is required then. The app will reject enabling a positive RUSH pool without its mint.

Use a wallet you control and fund it with the announced token budgets. It needs SOL for transfers you sign. Paste the **public wallet address**, never a private key or seed phrase. Redeploy after changing service variables. Keep `NODE_ENV=production`, the persistent `/data` volume, and `DATABASE_PATH=/data/catoshi.sqlite`. `PUBLIC_ORIGIN` can be omitted on Railway; if retained, use the exact current HTTPS origin without a trailing slash.

## Default daily prize distribution

One best score per reward wallet; top ten distinct reward wallets with completed, checked scores. The same split applies to the Catoshi pool and the RUSH pool independently.

| Rank | Share | Catoshi from a 100,000 pool |
| --- | --- | --- |
| 1 | 30% | 30,000 |
| 2 | 20% | 20,000 |
| 3 | 12% | 12,000 |
| 4 | 10% | 10,000 |
| 5 | 8% | 8,000 |
| 6 | 6% | 6,000 |
| 7 | 5% | 5,000 |
| 8 | 4% | 4,000 |
| 9 | 3% | 3,000 |
| 10 | 2% | 2,000 |

To change it, set `REWARD_SPLIT=30,20,12,10,8,6,5,4,3,2` to ten positive integer percentages totaling 100. With fewer than ten eligible finishers, the occupied ranks' weights are normalized so they share the full pools. Native token units are allocated exactly; rounding remainders go from the highest rank downward.

Entry is free for everyone with unlimited runs. No token holdings, wallet connection or signature is required at entry or payout. The pasted public address is the reward recipient; the app validates its format but does not prove ownership.

Days close at 00:00 UTC. After either prize pool is announced, that day's settings are saved and fixed. Later changes apply the next day. Enabling rewards can add the first budget to a current day that previously had no prizes. Setting `REWARDS_ENABLED=false` pauses new prizes without deleting an existing saved budget or payout obligation.

## Send the prizes after the round ends

The public vault address and rewards switch **do not send tokens automatically**. The website displays balances, publishes the daily pools and prepares a payment plan. The team still signs the transfers in its own wallet.

Use a service shell with the same persistent database and environment:

```sh
node admin.cjs rounds
node admin.cjs payout-plan ROUND_ID
```

Prepare the plan after the round ends plus **11 minutes**. Review the top-ten runs, saved recipient addresses and mint/amount pairs. The plan selects reviewed scores without checking any winner's holdings and verifies vault funding for both tokens, accounts for other unpaid plans, and reserves exact token amounts. Re-running it returns the same plan.

After signing approved transfers from the recorded vault, record their finalized signatures:

```sh
node admin.cjs record-payment ROUND_ID CATOSHI TRANSACTION_SIGNATURE
node admin.cjs record-payment ROUND_ID RUSH TRANSACTION_SIGNATURE
```

Individual and batch payments are supported. If one batch sends both tokens, record its signature once for CATOSHI and once for RUSH in that same round. The verifier marks only matching transfers paid; other recipients stay pending. Inspect the saved status and transaction before sending again.

There is no scheduled payout worker or private signing key in this package. No Railway settings or real wallets were changed while preparing this update.

## Daily scores and red RUSH quest

Every wallet can play unlimited free runs. No Catoshi holdings are required; paste the public Solana address that should receive prizes. Only its best completed score occupies a leaderboard/prize position. Only completed, replay-checked runs earn red quest progress. Ten red pickups across that day double its best raw-score run, with a maximum of five pickups in any run. A later better raw score inherits the multiplier; lower runs stay unmultiplied. X sharing adds no points. Rankings and payout plans use the adjusted best score, with one position per wallet.

Review runs and make any documented disqualifications before planning payouts. Disqualification recalculates the affected wallet's quest and scores. A saved payout plan freezes the whole UTC day against later score changes. No new reward variables are needed for these gameplay pickups. They do not send tokens; real CATOSHI/RUSH prizes still use the vault settings and externally signed team payments above.
