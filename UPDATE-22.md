# Multiplayer smoothing and downhill update 22

Upload every file in this ZIP into the existing GitHub project root, replacing files with the same name. Keep the other project files and assets. Redeploy the existing Railway service; do not delete either database or volume. There are no new environment variables or dependencies.

This patch builds on the results and leaderboard fix 21. It keeps the homepage, solo gameplay and leaderboard styling intact.

## Changes

- Bot practice simulates all four racers on the device, avoiding server position corrections. It remains unranked and now has no server replay or profile-stat submission.
- All eight live racers remain server-authoritative, with local input prediction and smoothed corrections. Opponents use a jitter-aware presentation clock, interpolation and brief bounded extrapolation. Slow connections drop stale snapshots rather than accumulating them; inputs and results remain reliable.
- Jumping works by touch or keyboard. Taps within 140 ms before landing buffer the next jump. Releasing, cancelled touch gestures and losing focus clear held input.
- The old floating positions box becomes a compact top banner outside the canvas. All eight names appear in race order, four per row on phones. The current player is outlined.
- Phone rendering uses a smaller canvas, cached terrain samples and sky gradients. Standings reuse their DOM nodes. Physics retains the original exact terrain and still runs at 60 steps per second.
- Ten downhill tracks now have steeper grades, larger hills and frequent working ramp launches. Normal and boosted top speeds are higher.
- Green ground boosts belong to each racer, so the leader cannot take someone else's pickup. Each pad grants a short burst plus a stored boost charge, up to three charges.
- Clean landed backflips and well-timed jumps award points and a short speed burst. Poorly aligned flips do not grant that reward.
- Coin projectiles continue rolling and bouncing along the sand.

## Verification

Run `npm install`, `npm test` and `npm run verify` when checking the project locally. Tests include eight independent human socket sessions finishing a live race, jump/release/boost inputs, delayed/missing snapshot smoothing, all ten bot tracks, mobile controller input, cached rendering geometry and the eight-name banner.

After Railway redeploys, `/mp/health` should show `build: "downhill-22"` and `raceEngine: "race-web-9-downhill"`. Multiplayer scripts use matching cache-busting URLs. Reload the page after deployment before testing.

The tests exercise simulation, networking and rendering commands. Physical iPhone frame pacing and a real eight-person internet race still need device testing after deployment.
