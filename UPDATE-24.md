# Polish update 24: replay, coin shots and speed trails

Upload every file in this ZIP into the existing GitHub project root, replacing files with the same name. Keep the other project files and assets. Redeploy the existing Railway service; do not delete either database or volume. There are no new environment variables or dependencies.

This patch builds on sky routes update 23. It changes no menus, modes or rules beyond what is listed here. Solo Vault Run physics are untouched, so existing scores and server score checks stay valid.

## Final replay

- The replay page now draws with the same renderer as the race: real track art, balloons, bogs, finish line, coloured name tags, coin shots and boost trails.
- Frames are recorded 20 times a second (was 10) and interpolated, so playback is smooth. Older replays still play.
- The camera follows your own racer when you open the replay from your results (the link carries `?seat=`). A shared link without a seat follows the winner.
- A standings panel shows placings and FIN as racers cross, plus a progress bar.
- The replay page previously loaded `race-tracks.js?v=race-1`, a cache key that never changed, so browsers could draw old track shapes under new positions. It now uses the current build key.
- Tracks that ended on a jump sent racers over the finish line high in the air. Every track now ends with a ground run-out past its longest final jump (on five tracks the finish line moves about 250–280 m later).

## Coin shots

- Coins now fly at **300 km/h** (was 150), fast enough to close on a boosted leader.
- Each coin locks on to the nearest racer ahead (up to about 340 m) and steers its height toward them, so it can follow a jump. It turns slowly, so a well-timed jump can still dodge.
- In simulated races, shots that used to hit 2–14% of the time beyond 100 m now hit about 60–75%. Cost (5 coins) and the 3.5 second reload are unchanged.
- The shooter now gets feedback: a gold burst on the target and a DIRECT HIT callout. Bot races now report hits both ways.

## Speed trails

- Boosting racers leave a smooth, tapering gold trail along their real path. At top speed it shows as a faint cream trail. This replaces the three fixed lines.
- Near top speed, faint streaks run along the top and bottom edges of the screen; the centre stays clear.
- Multiplayer: the boost shield and trail now actually appear. They checked a solo-only field before, so boosts never showed. Rivals who boost leave a trail in their own colour.
- Solo Vault Run uses the same trail and edge streaks during a rush.

## Verification

Run `npm install`, `npm test` and `npm run verify` (Node 24). New tests cover the replay page with old and new data, following a chosen seat, current script versions, replay standings, guided coin hits on airborne racers, and shot distance.

After Railway redeploys, `/mp/health` should show `build: "polish-24"` and `raceEngine: "race-web-11-polish"`. Reload the page after deployment before testing. Coin-shot strength was tuned with simulated races and should be checked in a real race.
