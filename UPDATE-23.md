# Sky routes and racing tracks update 23

Upload every file in this ZIP into the existing GitHub project root, replacing files with the same name. Keep the other project files and assets. Redeploy the existing Railway service; do not delete either database or volume. There are no new environment variables or dependencies.

This patch builds on the multiplayer smoothing and downhill update 22. Solo Vault Run, the homepage and leaderboards are unchanged.

## Tracks

- All ten tracks are rebuilt from readable sections and are roughly twice as long: races now take about 55–75 seconds (Goldrush Gulch and Vaultfall Finals are the longer marathons). The race time limit is 150 seconds.
- Section types: rollers, kicker ramps onto downhill landings, chasms, mud bogs, steep plunges, boost alleys, tailwind sky routes and storm splits. Every section opens on a dip, so a long flight from the previous ramp lands downhill instead of into a hill face.
- **Mega ramps** (gold lip with a POP marker) launch a sky route. Tap at the lip for a perfect pop and you reach a chain of balloons; ride it normally and you stay on the ground route.
- **Tailwind balloons** (gold `>>>`) bounce you forward and add speed. The ground below is a gentle downhill broken by short bogs: hop each bog cleanly and you stay within about a second of the sky line; wade through them and you lose several seconds.
- **Storm balloons** (red `<<<`) bounce you but cost speed. Storm skies pay extra coins (ammunition) while the ground route below has boost pads, so the ground is usually faster and the sky pays for shots.
- Balloon positions are calculated from the real jump physics, so every balloon is reachable from a popped lip, and every mega ramp is placed beyond the longest boosted flight from the ramps before it.
- A light catch assist steers you toward the next balloon crown once you are on a sky route. Landing on a crown mid-flip slides you off onto the ground route. A clean flip onto a crown is a SKY FLIP with a boost.

## Coming from behind

- **Slipstream:** tuck in behind another racer (on the ground, outside bogs) for extra acceleration and a slightly higher top speed. Wind lines and a SLIPSTREAM label show it.
- **Catch-up:** racers well behind the leader get stronger boost-pad bursts and a small top-speed allowance. The leader never gets either.
- Longer tracks, route choices and the faster coin shot give trailing racers more chances to pass.

## Coin shots

- Coins now leave at **150 km/h** (as shown on the speed readout), faster than a boosted racer, so a shot can catch the leader.
- Shots fire from the front of your racer wherever you are: on the ground, mid-jump or bouncing across balloons. They fly along your travel direction, fall, then roll and bounce along the sand as before. They drop into gaps.
- Hits use a swept test so a fast coin cannot pass through a racer between server ticks. Cost (5 coins) and the 3.5 second reload are unchanged.

## Timing still matters

- **Early jump:** jumping low on a ramp face throws away the launch (EARLY JUMP · LAUNCH LOST).
- **Late pop:** a fresh tap just after leaving a lip still pops, but lower than a perfect pop. Holding through a lip never double-jumps.
- **Scrubbed jump:** hopping off a steep downhill for no reason costs a little speed.
- **Landings:** a wobbly landing costs about 12%, a nose-down or mid-flip landing about 38% with a stagger, and a steep slam onto shallow ground is a HARD LANDING. Meeting a matching downslope keeps your speed. A long fall can never be converted into a large speed gain.
- Bad events show in the trick banner in a warm red.

## Verification

Run `npm install`, `npm test` and `npm run verify` (Node 24). New tests cover every balloon being reachable from a popped lip and unreachable without one, sky and ground routes staying within four seconds when ridden well, mega ramps never being overflown, bogs, early/late/perfect pops, botched and hard landings, slipstream and catch-up, 150 km/h shots from the air and the swept hit test.

After Railway redeploys, `/mp/health` should show `build: "skyroutes-23"` and `raceEngine: "race-web-10-skyroutes"`. Multiplayer scripts use matching cache-busting URLs. Reload the page after deployment before testing.

Balance (bog drag, balloon kicks, slipstream and catch-up strength, landing penalties) has been tuned with simulated bot races. It still needs a real eight-person race to confirm it feels right.
