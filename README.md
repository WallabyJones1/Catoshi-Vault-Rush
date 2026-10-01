# Catoshi Vault Rush 

- Players choose a public display name; duplicate names are possible. Practice does not require a wallet.
- Live rankings refresh every 10 seconds. The practice board keeps the best completed run per browser session; the **daily holder board** keeps the best completed run per pasted reward wallet. Daily rounds run from **00:00 to 24:00 UTC**, not each player's local midnight. Today's and yesterday's boards are available.
- The server assigns each run a random seed, records its round, and recalculates the score from the submitted press/release inputs. Browser-reported scores are ignored. Completed runs only; maximum active play time is 10 minutes. Pauses are allowed within ticket expiry and the round submission deadline.
- Ties use the earlier submitted score, then run ID. No fake starter scores are inserted.
- Holder entry accepts a pasted Solana address and checks **50,000 CATOSHI** at run start. No wallet connection, login signature or transaction approval is required. That address is saved immutably as the reward recipient; finish requests cannot replace it.
- Anyone can enter a public holder address. This verifies holdings, not ownership. Scores sharing that address compete as one wallet on the daily board. Rewards may only go to the recorded address. Public addresses can be impersonated under different display names.
- Balance checks try PublicNode and the Solana public endpoint, with bounded timeouts. Successful checks are cached for 15 seconds and failures are not cached. Set SOLANA_RPC_URL to a dedicated mainnet RPC for production; optionally set SOLANA_RPC_FALLBACK_URL. No client-supplied RPC URLs are accepted.
- If the leaderboard API fails, practice starts locally and is labelled LOCAL PRACTICE; its score cannot be submitted later. Holder entry always fails closed when a balance cannot be checked.
- **Post Score to X** opens a prefilled composer with the score and its public score URL. The player reviews and posts it themselves. No X API token or automatic posting is involved. Copy Score is a fallback. Share pages include score-specific social metadata.
- Only player names and shortened wallets are shown on the public board. Full payout wallet addresses and input recordings are held in the server database. Names are rendered as text, not HTML. There is no public admin interface.
