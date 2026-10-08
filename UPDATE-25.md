# Flow and Speed Trials update 25

Upload every file in this ZIP into the existing GitHub project root, replacing files with the same name. Keep the other project files and assets. Redeploy the existing Railway service; do not delete either database or volume. There are no new environment variables or dependencies.

This patch builds on polish update 24. It changes the solo engine (Vault Run and Speed Trials). Multiplayer is unchanged.

## When to deploy

Vault Run physics change, and the weekly Vault Run board is not split by engine version. To keep one week's scores comparable (and any weekly prizes fair), deploy between rounds. The current round ends Monday 12 October 2026 at 00:00 UTC (11:00 Sydney).

Speed Trial boards and ghosts are keyed by engine version, so they start fresh automatically with the new courses. Runs started on the old engine get the existing "reload to get the current game version" message.

## Vault Run: fair flow

Measured with simulated riders over 60 seeds, before and after:

| | Before | After |
|---|---|---|
| Average run length | 37 s | 76 s |
| Median distance (good rider) | 2.2–2.5 km | 4.2–4.4 km |
| Runs ended by the hound | 55 of 60 | 36 of 60 |

- **Landings.** Previously any landing over a modest impact silently lost 20%, and slightly harder ones lost 28% plus a stagger. About 45% of landings lost speed, mostly after automatic crest launches the rider never chose. Now speed loss scales with impact (a firm landing loses a few percent), and a full rough-landing stumble needs a genuinely huge impact or a botched flip.
- **Hazards are not hidden in landing zones.** Placement already avoided ramps and gaps; it now also avoids where a crest launch comes down. Ground hazards are no longer hit straight out of an automatic launch.
- **One mistake is a setback, not a death sentence.** After a hazard hit, the hound cannot start a chase for 2.2 seconds, and a first-mistake rider keeps a speed floor while recovering on level ground. Half of all hound deaths used to come within 5 seconds of a single hit.
- **Climbs are shorter.** Giant Dunes and Valleys, where most runs ended, climb 12–18% less, and climb boost pads appear more often (every 760 units instead of 1,050).

Hazards, the hound, lives, cargo, sky routes, pressure stretches and the red-token quest are otherwise unchanged.

## Speed Trials: rebuilt courses 2–5

Dune Dash (course 1) keeps its layout. Canyon Flow, Forest Flight, Ridge Runner and Midnight Summit were built from alternating downhill and long uphill legs. Uphill crawling took 17–83% of a run, courses 4–5 took 75–175 s, and later chasms could not be cleared at any timing.

They now follow a flowing rhythm: a short kicker rise with a launch ramp (usually over a chasm), then at least 5,200 units of downhill before the next rise.

| Course | Length | Time for a strong rider |
|---|---|---|
| 1 Dune Dash | 850 m | ~12 s |
| 2 Canyon Flow | 1,590 m | ~20 s |
| 3 Forest Flight | 2,185 m | ~28 s |
| 4 Ridge Runner | 2,830 m | ~36 s |
| 5 Midnight Summit | 3,465 m | ~43 s |

- Every course was checked with simulated riders at four skill levels: all finish, nobody crawls, and every chasm and obstacle has a wide timing window.
- **Booster kickers:** jumping off a kicker gives at least booster speed, so a rider slowed by an earlier mistake still clears the next chasm and loses time rather than the run. Riding off without a jump gets no booster, and a rider who never presses anything cannot finish any course.
- **Obstacles** start after the opening run-up and stay out of every launch's flight and every aerial-pad hop. Each one is reached on the ground with a clear approach.
- **Landings:** in Speed Trials a hard landing costs speed in proportion to impact but never a stagger-and-crawl; a botched flip still does. Landing part-way up a kicker face still rides and launches it.
- The extra aerial pad on kicker legs was removed. It sat just before the ramp and tempted a hop that skipped the kicker.

## Verification

Run `npm install`, `npm test` and `npm run verify` (Node 24). New tests cover course flow (finishable, no crawling, needs input, increasing length), obstacle placement, booster kickers, proportional landings and the post-hit hound grace. The red-token quest test uses a new recording for the new terrain, validated by the server's own replay checker.

After Railway redeploys, `/api/config` should show `engine: "flow-web-17-flow-trials"`. Reload the page after deployment before testing. Simulations cannot replace real players, so watch how Vault Run distances and Speed Trial times settle in the first week.
