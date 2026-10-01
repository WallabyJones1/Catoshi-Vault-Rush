# Complete game: audio, collision recovery and homepage animation fix

This ZIP contains the complete current standalone web game, including the supplied music, every background/character asset, the ten-pose homepage sheet and all sound effects. It replaces the earlier patch packages. The live Railway deployment was not inspected or changed.

1. Extract `Catoshi_Complete_Game_Fixed.zip` on your computer.
2. Upload **the files inside the ZIP**, replacing matching files in the GitHub folder containing the game's `package.json`, `Dockerfile`, `railway.toml` and `server.cjs`. Do not upload the ZIP itself or add an extra enclosing folder. Include all PNG and WAV files, `music.mp3`, `home.js` and `sound.js` in the same commit.
3. Keep the existing Railway service variables and persistent volume/database. Railway should use the included Dockerfile and start `node server.cjs`. No new variable, dependency or build command is needed. Keep one replica.
4. After redeployment, reopen the game. The homepage should show the blinking/waving Catoshi beside the title, plus a **TEST SOUND** button beneath SOUND ON. Tap TEST SOUND to hear a coin chime, then start practice. If playback is denied, the audio control says ENABLE SOUND so you can tap again.

**Do not delete the repository or the database.** Replace matching files and add the supplied files. Keep unrelated repository files and your existing Railway settings. This release uses `flow-web-8` in the client and replay server. Start a fresh run after updating; pending runs from an older engine cannot be submitted. Existing completed scores, names, daily attempts, quest progress and payout records are retained.

## What this fixes

- Tall obstacles are checked before a landing can end the run. Collisions remove speed and combo, with a short recovery period against the resulting landing/hound failure. A gap entered during that recovery can be crossed safely. Genuine failed jumps/landings after recovery and sustained low speed remain failure conditions.
- Mobile playback uses bundled, gesture-unlocked WAV effects. Web Audio remains available for desktop and fallback. A stalled context resume no longer blocks later taps. Every coin gets a chime; vault, jump, flip, material impacts, final crash and RUSH pickups have separate cues. Pause, mute and backgrounding stop effects.
- The entire ten-pose homepage asset is included. Tall mobile menus start at the top instead of pushing the hero above the scrollable area. The loop waits for a loaded image; it stops during gameplay/backgrounding. Reduced-motion users see a still pose.

The WAV files are required runtime assets, not optional extras. `audio-config.js` still controls music/effect volumes. `build-effects.cjs` regenerates the included clips if needed; Railway does not need to run it.

## Wallets and prizes retained

Holder entry still checks a pasted wallet for 50,000 CATOSHI without connecting or signing, with ten starts per wallet per UTC day. Best completed run appears on the daily board; names are supported and X sharing adds no points. The daily red quest and seven-second shiny RUSH burst remain enabled.

`VAULT_WALLET` is a public rewards wallet address. Set `REWARDS_ENABLED=true`, `CATOSHI_PRIZE_POOL`, the correct `RUSH_MINT` and `RUSH_PRIZE_POOL` to publish the configured top-ten pools. Pasting a vault address does **not** authorize automatic transfers: team-signed payouts remain manual as described in `REWARDS_SETUP.md`.

## Verification and limits

Local checks cover native replay/leaderboard scoring, wallet entry, durable quotas/quest updates, collision recovery, real WAV contents, mobile playback state handling, pause/mute recovery and served media byte ranges. All ten homepage poses are rendered from the actual supplied sheet. This environment cannot physically confirm speaker playback or layout on your iPhone, and no live deployment was opened.
