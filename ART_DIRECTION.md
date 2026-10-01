# Catoshi Vault Rush — Flow art pass

## Reusable style

Small, silhouette-first side-view characters in a large, quiet landscape. Matte flat shading; no fur strands, neon outlines, dense scenery, or decorative UI panels. Catoshi rides a gold lightning token. Her orange remains the most saturated character color. Landscape colors are restrained warm greys and dark browns, with a single distant warm light.

| Role | Color |
| --- | --- |
| Base | `#0a0908` |
| Catoshi / UI / score | `#f26b35` |
| Gold / token | `#e8a13a` |
| Helpful pickups | `#3ddc54` |
| Hazards / red quest coins | `#e03b3b` |
| Text | `#f2efe9` |
| Muted text | `#8d8880` |

## Integrated generated assets

- `catoshi-clean-actions.png`: eight cat-on-token poses and four guard-dog running poses; genuine alpha transparency. Use the measured crop rectangles in `renderer.js`, not an assumed uniform grid. The generated sheet did not contain every coin within a uniform cell.
- `canyon-endless-layers.png`: three independent transparent panorama strips. Distant mountains, sparse canyon ruins, and dark nearby dunes. Independent scroll rates create parallax; alternating mirrored tiles share exactly matching edge elevations and colors.
- `canyon-atmosphere.png`: one warm sunset panorama, used for the menu and stationary sky atmosphere.
- `vault-scenery-atlas.png`: vault entrance, cable support, rock, crate, cargo balloon, green boost, old gold coin, and tiny lantern. Explicit alpha bounds are in the renderer.
- `catoshi-coin.png`: the new reference-matched collectible, generated with the built-in image-generation tool. Transparent orange face, gold rim and cream lightning. It replaces the atlas coin in gameplay and the HUD. Rendered at 12 world units (about 9–11 canvas pixels); no giant collectible.
- `terrain-biomes-v1.png`: three new transparent panoramas for pine forest, basalt quarry and mountain vault terrain. Each uses measured row crops, independent scrolling and mirrored neighbours. A final solid row continues to the bottom of the viewport; filtering is disabled for that one-pixel row so transparent atlas gutters cannot cause bands.
- `terrain-obstacles-v1.png`: basalt rock, red-striped barrier, tagged log, ore cart, red-tipped spikes, stacked crates, pine tree and stone arch. Eight measured crops preserve each complete silhouette. The first six have gameplay roles; the tree and arch are sparse background props.

Catoshi is rendered at 40 world units wide in landscape and 60 in portrait (roughly 30–38 canvas pixels after camera zoom), not as a large foreground mascot. Dog width is 38 world units and the dog is only rendered when the low-speed pursuit is active. Procedural hills are drawn from the actual physics surface rather than from a repeating decorative ground image.

## Final character generation prompt

```text
Use case: identity-preserve
Asset type: clean animation sprite sheet for Catoshi Vault Rush, genuine transparent PNG, landscape 4:3 canvas.
Input image: the supplied existing sprite sheet is an IDENTITY reference only for the orange tabby cat, short black hooded cloak, gold lightning coin used as a sandboard, and stocky dark guard dog with red collar. Keep these mascot identities, but replace the detailed rendering with much simpler flat 2D art and the new 12-cell layout.
Primary request: EXACTLY FOUR equal columns by THREE equal rows, with twelve fully contained isolated frames. No grid drawn, no labels. Every frame faces RIGHT, exact side view. Consistent character scale, hood shape, tail silhouette and coin silhouette; align each frame to a common baseline within its own cell, except intentional airborne/launch poses. Generous transparent margins, no cropping or touching neighbouring cells.
Top row, left to right: 1 steady ride; 2 leaning ride; 3 compressed tuck; 4 extended balance.
Middle row, left to right: 5 jumping launch; 6 airborne; 7 compressed landing; 8 stumble recovery.
In ALL eight cat frames, the gold lightning-embossed crypto coin remains directly beneath the cat's feet as a compact horizontal token sandboard, never missing or detached. Preserve the cute confident tabby face, short black hooded cloak and upright curved orange tail from the reference. Cat must be readable at 40 pixels wide.
Bottom row, left to right: FOUR distinct consecutive running-cycle poses of the same stocky dark guard dog wearing a muted red collar. Every dog faces RIGHT; use the same size and local baseline for all four.
Style/medium: Premium SIMPLE flat cel shading, crisp large shapes, maximum THREE tones per material. Bold silhouette-first illustration, sparse facial features, no fur strands or texture lines, no tiny details or thin linework. No glossy gradients, sparkle, 3D effects, rim light, bevels, or cast shadows.
Palette: #f26b35 orange tabby with one darker and one lighter orange tone; #0a0908 cloak; #e8a13a gold coin with a simple clear lightning symbol; #f2efe9 only sparse small cream facial highlights; dark dog with #8d8880 muted grey highlight; #e03b3b collar. Keep the overall palette flat, restrained and consistent.
Constraints: Genuine fully transparent background and empty padding. EXACT twelve sprites, no extra frames, no environmental art, floor, backgrounds, text, numbers, logos, UI, borders or watermark. All silhouettes complete.
```

## Final endless-layer generation prompt

```text
Use case: stylized-concept
Asset type: transparent panorama-layer atlas for an infinitely scrolling 2D downhill game.
Primary request: ONE landscape atlas, approximately 2048x1152, made of EXACTLY THREE separate very wide HORIZONTAL silhouette strips stacked vertically with generous completely transparent gutters between them. Each strip is approximately 2048x360 logical size, spans from the image's left edge to right edge, and is a self-contained continuous ridge silhouette. All three need transparent sky above their ridge, a solid uninterrupted base fill below the ridge reaching that strip's own bottom, then a transparent gutter before the next strip. Do not blend the strips together. Keep heights and positions clearly separable for cropping.
Top strip: distant subtle warm grey mountain ridges, extremely simple and low contrast.
Middle strip: layered muted brown canyon escarpments with VERY sparse small vault-like industrial ruins.
Bottom strip: dark near-black sculpted dunes and cliffs, with only one or two tiny slender industrial pylons.
Composition: Each strip is intended to horizontally repeat infinitely: its left and right edge ridge must end at the SAME elevation, SAME base color and SAME atmosphere, with broad uncomplicated edge shapes. Continuous edge-to-edge silhouette, no left or right margins. The three rows are independent layers, not one illustrated scene; top-row scenery must not intrude into middle-row space, middle must not intrude into bottom. Broad varying hill shapes across each row and large areas of transparent empty sky above them.
Style/medium: Matte flat 2D painted vector-like shapes, restrained premium minimalist game scenery. Extremely sparse detail, soft-edged broad ridges, no gradients inside individual shapes, no outlines.
Palette: Subdued near-black #0a0908, dark brown, and warm grey #8d8880 only. Distance layers feel low-opacity and muted; foreground layer remains dark. NO orange, red or green.
Constraints: True transparent alpha background and gutters, no painted checkerboard. No sun, moon, stars, light sources, glow, characters, playfloor, coins, words, numbers, labels, UI, logos, frames or watermark. Exactly THREE wide horizontal strips, all filled to their own bases.
```

## Web edition boundaries

The web backend checks a pasted wallet's public holdings and recalculates scores from inputs. Entry does not require a wallet connection or signature and does not prove wallet ownership or human play. The app never signs or sends reward transfers. See `README.md` for limits and `test.cjs` for automated checks. This edition has no Telegram dependency.

## Portrait-phone framing

Portrait phones use a native taller canvas, not a stretched widescreen bitmap. The physics and server replay are unchanged by screen size. Catoshi is 60 world units wide in portrait versus 40 in landscape; the dog is 46 versus 38, and coins are 17 versus 12. This puts Catoshi around 27–37 CSS pixels wide on a typical 390px portrait viewport while keeping her under 10% of its width. Camera framing reserves space ahead and above for jumps. HUD and jump control have separate phone layouts; rotating does not restart the run.

## Final coin generation prompt

Mode: built-in image-generation tool, reference-based generation, true transparent background. Final workspace asset: `catoshi-coin.png`.

```text
Use case: stylized-concept
Asset type: one collectible coin sprite for Catoshi Vault Rush, genuine transparent PNG.
Input image 1: design reference only. Keep its orange coin face, gold metal outer rim, and the same broad cream lightning silhouette.
Primary request: create ONE isolated, perfectly circular, front-facing Catoshi coin. Simplify the photographic reference into polished matte 2D game art. Strong readable cream lightning bolt centered on the orange face, thick gold outer rim with just a restrained top-left highlight and lower-right darker gold edge. Bold broad shapes, clean crisp edges, three tones per material maximum. At tiny 12–16 pixel gameplay size the lightning should still read, not become fussy texture.
Composition: square canvas, centered coin occupies about 90% of the canvas, complete silhouette with even transparent padding. No tilt, perspective, floor or cast shadow outside the coin.
Color palette: #f26b35 orange face with one warmer lighter orange area, #e8a13a gold rim, #f2efe9 cream lightning. Muted warm palette, not neon.
Constraints: preserve the reference's recognisable lightning mark and orange/gold/cream identity. Actual transparent background. One coin only, no text, no watermark, no extra sparkles, no background, no white rectangle, no noisy metallic ridges or photoreal grain.
```

## Terrain and obstacle pass

The new bitmap atlases were generated with the built-in image-generation tool with true transparency, using the existing scenery as a style reference. The Catoshi/dog character sheet remains the hero art. The ground is procedural canvas geometry rather than a bitmap: its ramps have continuous height, slope and curvature through the lip and recovery. A short gold contour marks takeoff; no separate triangle is drawn above the surface. Hazard artwork is sized and rotated to match its physics collider. Tiny red crests improve phone readability.

Each run starts in the canyon and seeds the order of forest, quarry and mountain vault terrain. Transitions span the final 17% of each region. Forest ground is subdued dark grey olive, quarry ground is charcoal stone and mountain vault ground is dark warm grey; saturated green remains reserved for helpful pickups. All regions share the existing single warm sky light. Trees and arches stay dimmer than Catoshi and never function as hidden collisions.

Use these recreation prompts when expanding the set. Crops must be measured again if regenerated; generated layouts are not guaranteed to align to an exact grid.

### Panorama recreation prompt

```text
Asset type: transparent panorama atlas for Catoshi Vault Rush, a minimal flat 2D downhill game. Use the existing canyon art only as a style reference.
Create exactly three separate wide horizontal strips, stacked with generous transparent gutters. Each strip spans the full canvas width with transparent sky above its silhouette and an uninterrupted solid base beneath it. Broad uncomplicated left and right edges suitable for mirrored repeating tiles.
Top: misty pine forest with broad layered hills, sparse dark fir silhouettes.
Middle: basalt quarry with angular stone columns, one tiny mine entrance and a distant gantry.
Bottom: mountain ridges and a sparse distant industrial vault settlement, small chimneys and terraces.
Matte flat cel shading, large clean shapes, restrained charcoal, taupe and warm grey. Match #0a0908 dark base and #8d8880 muted highlights. No bright orange, red or green, no neon, photoreal texture or decorative outlines. Catoshi must remain the brightest character over this art.
True transparent alpha background and gutters. No characters, sun, coins, floor, text, labels, grid, UI, logos or watermarks. Three independent layers, not one blended scene.
```

### Obstacle recreation prompt

```text
Asset type: isolated side-view obstacle and scenery atlas for Catoshi Vault Rush. Use the existing vault scenery as the style reference. True transparent PNG, generous transparent margins, complete silhouettes, two rows of four objects.
Top row: chunky basalt boulder; low steel-and-stone barrier with muted red warning stripes; horizontal timber log with a small red tag; rusty ore minecart.
Bottom row: three short stone spikes with red tips; two stacked dark metal crates with red warning stripes; sparse dark pine tree; squat stone arch.
Clean matte 2D cel shading, strong silhouette, at most three tones per material. Near-black #0a0908, restrained charcoal, warm brown and grey #8d8880. Hazards use #e03b3b red, sparingly. No orange hero colors or green pickup colors. Objects must read at 30–60 world units rather than require tiny texture detail. Side view, consistent ground baseline, no cast shadows beyond each object.
No ground, environment, UI, text, labels, borders, grid, logos, checkerboard or watermark. Eight separated objects, none cropped or touching.
```

## Launch polish and RUSH quest assets

`catoshi-home-loop-v1.png` is a new 1983×793 RGBA sheet: ten cute idle/breath/blink/wave frames, five columns by two rows, based on `catoshi-clean-actions.png`. `home.js` uses measured alpha crops, a shared 272px token baseline and short holds with a longer rest frame. The 320px canvas displays a 235px-wide hero. The loop runs at at most 30fps, stops during gameplay/hidden pages, supports reduced motion and falls back to the original ride pose if loading fails. The supplied sheet was created with the built-in image-generation tool and copied into the project without changing its pixels.

Homepage recreation prompt:

```text
Create a transparent ten-frame sprite sheet, five columns by two rows, of the existing orange Catoshi cat in her short black hood, riding the same gold lightning token. Use catoshi-clean-actions.png as an identity reference. Keep the recognizable cute confident face, body proportions, cloak, tail and full token in every cell. Small gentle breathing and balance shifts, a blink, a cute paw wave, tail swish and return to the initial rest pose. Consistent right-facing side view, consistent scale, complete isolated silhouettes with transparent margins, no dog. Clean simple cel-shaded large shapes, warm orange #f26b35, black #0a0908, gold #e8a13a and restrained cream #f2efe9. Genuine transparent background, no scenery, labels, grid, extra objects, watermark or background shadows. Ten clean successive poses that work as a quiet repeating homepage loop.
```

`rush-pickups-v2.png` is a 1774×887 RGBA atlas, two square cells side by side. Left is gold RUSH, right is red RUSH, both with the supplied raised cream lightning symbol. The left face is shiny orange-gold, the right face is ruby red, and both have polished gold rims. The built-in image-generation tool used `upload/IMG_0561(1).jpeg` as the exact design reference and the previous atlas only as a layout reference. Its source pixels and alpha are preserved. The renderer adds cosine-width spinning, a small radial halo and gold glints. Gold is 46 world units wide in landscape / 54 portrait; red is 25 / 30. Catoshi remains 40 / 60, and only occasional special pickups are large. The gold shield never hides her face. A round red lightning-coin silhouette distinguishes red quest pickups from triangular danger signs.

Final RUSH asset prompt (built-in image-generation mode):

```text
Use case: precise-object-edit. Asset type: transparent two-coin gameplay sprite atlas for Catoshi Vault Rush. Image 1 is the user's EXACT coin design reference: thick gold metallic outer rim, orange face, large raised cream lightning bolt with its distinctive rounded zigzag silhouette. Image 2 is only the layout target: two circular coins in two square cells side by side. Replace BOTH letter R symbols from image 2 entirely with the EXACT lightning-bolt symbol from image 1. Neither coin may contain a letter or text. Produce two identical-shape front-facing coins of identical size, same centre and baseline within each of their two equal square cells, fully contained with about 8% transparent padding and a clear gutter. LEFT is the special SHINY coin: preserve the original reference's orange face and cream lightning, polished rich gold rim, warm golden upper-left specular highlight and refined bright metallic glints, a premium shiny orange-gold version. RIGHT is the RED quest coin: same gold rim, same raised cream lightning silhouette and proportions, rich ruby-red #e03b3b face instead of orange, subdued highlights. Both clearly resemble image 1, adapted to clean polished illustrated 2D game sprites that remain readable at 25–54px. Moderate dimensional bevels, not fuzzy photographic texture. No cast shadow or halo outside the discs: the game adds glow. Actual transparent background outside each complete coin; no white background or painted checkerboard. Canvas aspect exactly 2:1, two square cells. No other objects, letters, text, numbers, watermark or UI. Keep the same lightning orientation as reference, with long top-right tip, broad central zigzag, rounded lower-left tip.
```

Landscapes, existing hero/dog art and Catoshi lightning coins remain in use. Ramp joins use the same surface as physics; movement interpolation, impact dust and brief flip arcs are code-generated rendering, not new bitmap sheets. The first five red quest tiers are deliberately spread far apart. See README.md for native simulation and daily leaderboard behavior.
