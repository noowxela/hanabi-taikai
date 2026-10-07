# SDD: Pixel readability pass

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [architecture.md](../architecture.md), [002-pixel-look-polish.md](002-pixel-look-polish.md), `.cursor/skills/pixel-art/SKILL.md`

## 1. Context / current architecture

The pixel contract is already in the engine. `PixelPipeline` renders with a short side of about 150 art pixels and an integer `scale`. `palette.ts` has 34 colours. The post pass draws a 1 px depth outline and snaps every pixel in OKLab. Scenes set `pixelsPerUnit` on `CameraRig`:

| Scene | Art pixels per world unit |
| --- | --- |
| Town | 11, fixed |
| Watch | starts at 14, then fit to the board |
| Train, minigames | 16, then fit to the board |
| Koi pond, arcade hall | 18, then fit to the board |

The town player (`src/world/player.ts`) is about 1.3 units tall, so at 11 px/unit the body is about 14 art pixels. Facing yaws smoothly. The walk is a sine swing on the two legs. Several mesh colours are outside `PALETTE_HEX` and only become legal colours by accident in the post pass (`0xf3c9a0` skin, `0x4a3a34` plaza). The yukata `0x283766` and the grass `0x1f3f2c` are almost the same value, so the body does not separate from the ground.

Static props also leave the pixel grid: dirt paths use `atan2`, the tanuki faces about 62°, campfire logs tilt 0.15 rad, rocks and grass yaw in 45° steps, and the zone markers and flames spin every frame. Square roofs use yaw `π/4` so a flat face points at the default camera.

Puzzle and minigame cameras call `setPixelsPerUnit` so the whole board fits. Gameplay that must turn (the train on a curve, koi swimming, ice-slide hurt lean) is separate from decorative spin.

## 2. Problem and non-goals

**Problem:** the pixel skill asks for one art-pixel size, palette colours chosen on purpose, 90° facings, one light direction, value that still reads in grayscale, and a 6-pose walk. The town is the scene that misses this most, and the same light, palette, and static-yaw rules are loose in the other locations.

**Non-goals:**

- No change to `TARGET_SHORT_SIDE`, the outline, or the decision to use flat bands instead of dither.
- No new palette entries. Every material colour is an existing `PALETTE_HEX` value.
- No change to the fit-to-board `pixelsPerUnit` on the pond, train, watch, hall, or minigames. Those cameras exist so the whole puzzle stays on screen.
- No change to train track yaw, koi heading, or ice-slide hurt lean. Those turns are the action.
- No new gameplay, levels, or UI.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Town square only, or every location? | Every location. |
| Readability only, or also a 6-frame walk? | Both. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

Art-pixel size for this pass: short side ≈ 150, integer `scale` unchanged. Town `pixelsPerUnit` goes from 11 to 16, so the player is about 21 art pixels tall. Other scenes keep the `pixelsPerUnit` they already compute to frame the board.

1. **Town camera.** `new CameraRig(42, 16)`. The camera still follows the player, so the four paths stay reachable; less of the map is on screen at once.
2. **Palette and value.** Player face uses `0xf3e6c8`. Yukata uses `0x5f78ad` (a lighter step on the night-blue ramp) so it separates from grass `0x1f3f2c`. Plaza `0x4a3a34` becomes stone `0x4a4e63`. Any other `toon()` / `glow()` hex that is not in `PALETTE_HEX` moves to the nearest ramp step already in that list. Light tints stay lights; they are not palette entries.
3. **One key light.** Every scene's directional light uses direction `(-8, 20, 6)` (up, from −X and +Z), matching the town moon. Ice Slide keeps a cool colour and that same direction. Fill hemispheres stay as they are.
4. **90° static yaw.** Rocks, grass, the tanuki, campfire logs, and the stone ring snap to multiples of 90°. Logs lose the 0.15 rad tilt and stack on the axes. Dirt paths keep their centerlines for collision and are drawn as axis-aligned steps of equal length (a perfect diagonal). Square roofs keep yaw `π/4`: that turn puts a face toward the default camera, and a corner-on roof is the jaggier silhouette.
5. **Motion without spin.** Zone markers and flames stop spinning on Y. Markers bob in four height steps. Flames squash and stretch in four steps (wider means shorter). The town player faces the nearest 90° and walks in six held poses over 640 ms (about 107 ms each): contact, down, lowest, passing-prep, passing, up. Arms swing with the opposite leg. The body is shorter and wider at contact, taller at the passing pose.
6. **Other scenes, same rules only.** Replace off-palette material colours. Point decorative yaw at 90° (the arcade mascot's −0.5 rad, spinning fish in Ice Slide). Ice Slide fish flip with `scale.x = ±1` on a 160 ms tick instead of spinning. Leave board framing, track-following, and koi heading alone.

**Pros:** the hero reads against the grass; colours are chosen; decorative motion stops shimmering on the pixel grid; the walk matches the skill's low-resolution cycle. Puzzle framing stays.

**Cons / risks:**

- Town zoom (16/11) hides more of the festival at once. Entrances can feel farther until the player walks.
- A 4-direction facing feels stiffer than the smooth turn.
- Stepped paths can look chunkier than the current smooth ribbons.
- A 6-pose block walk can look stiff if the poses are too similar. Verify in the browser, and widen the contact vs passing poses if the cycle does not read.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Raise `pixelsPerUnit` in every scene to 16 | Train, watch, and the minigames size the camera to the board. A fixed 16 crops the puzzle. |
| Snap koi and the train to 90° | Their yaw is how they move. Snapping the fish makes the pond square; snapping the train breaks the curve. |
| Add palette colours for skin and the plaza | The skill's contract is the existing 34. Both already have a neighbour on a ramp. |
| Smooth in-betweens between the six poses | At this resolution, extra in-betweens read as sluggish. |

## 5. Acceptance criteria and verification

- [x] Town uses 16 art pixels per unit. `TARGET_SHORT_SIDE` is still 150. Other scenes still frame the whole board.
- [x] Every `toon()` and `glow()` colour is in `PALETTE_HEX`. The yukata is visibly lighter than the grass in a screenshot.
- [x] Directional lights share direction `(-8, 20, 6)`.
- [x] Town paths, stones, logs, tanuki, and markers use 90° yaw. Roofs may stay at `π/4`. Markers and flames do not spin.
- [x] Standing still, the player holds a pose. Walking cycles six poses in about 640 ms, facing N/E/S/W, and the body squashes when the feet are apart.
- [x] Ice Slide fish flip instead of spinning. Train, watch, pond, and hall still play: a train level clears, a watch wave runs, a koi can be fed, a minigame reaches its result panel.
- [x] `npm run check` passes. Browser screenshots: town (idle and mid-walk), plus one gameplay view each of pond, train, watch, and one arcade game, on desktop. Town also on a 390×844 viewport.

**Verification:** `npm run check` passes. A scan of every `toon()` / `glow()` hex finds only `PALETTE_HEX` values. In the browser at `localhost:5197`: town `pixelsPerUnit` is 16, low-res short side 151, integer scale 11. Idle holds a stand pose; walking steps through all six poses (body scale Y 1 → 0.82) and faces the nearest 90°. Feeding the pond returns true. Train level 1 clears with the three straight pieces (`outcome: clear`). A watch wave runs and the HUD advances to wave 2 with the fire still at 10/10. Ice Slide fish `scale.x` alternates `1` / `-1` every 160 ms, and a round reaches `phase: over`. Directional lights in town, pond, train, watch, catch, and slide are at `(-8, 20, 6)`; slide stays white. On a 390×844 viewport the short side is 147 and the scale is 8. Screenshots: town idle, town walk, pond, train, watch, slide, town mobile.

**As built:** the arcade hall and Quick Keys have no directional light (hemisphere plus a point light only), so they were left that way. Dirt paths are Bresenham stairs of 1.6-unit tiles. The arcade mascot faces −X (`-π/2`) so it still looks toward the cabinets.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | Pixel skill pass; scope is every location, including the 6-pose walk |
| 2026-10-06 | approved | User said yes |
| 2026-10-06 | implemented | Town at 16 px/unit, palette materials, shared key light, 6-pose walk |
