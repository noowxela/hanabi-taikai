# SDD: Jungle opening, henshin smoke, swimming koi

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-07
- **Related:** [013-fox-henshin.md](013-fox-henshin.md), [architecture.md](../architecture.md)

## 1. Context / current architecture

The opening shot in `TownScene` uses `OVERVIEW_SPAN` 42 on the **short** side of the art buffer (`src/world/town.ts`). A wide window therefore shows past the tree ring. That ring is built in `buildTrees` at about x/z ±21.5, around a ground that is 60 units across. The empty field outside the trees is in frame.

Henshin (`F` or `变`) swaps the fox and human groups in `Player.henshin` on the same frame and plays the click. There is no puff.

The town pond in `buildKoiPond` is a flat water disc at (−15, 3). Two glow boxes lie on it and never move. The pond scene (`src/scenes/koiPond.ts`) already swims its koi, but they cruise at depth −0.22, under a water disc of opacity 0.3, so the bodies stay buried.

## 2. Problem and non-goals

**Problem:** the first view of a visit should stop at the jungle around the town. Changing form should throw a ninja smoke bomb. The fish pool should show fish swimming.

**Non-goals:**

- No change to feeding, the collection, or how many patterns exist.
- The smoke does not move the player, change speed, or block input after it starts.
- No new palette colours and no image files.
- Returning from a location in the same visit still stays zoomed in. Only the opening framing changes.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| What is the jungle edge? | The pine and maple ring in `buildTrees`, about ±21.5. “Juggle” is that ring. |
| Which pool shows swimming fish? | The town pond you see on the map, and the pond scene, where the fish are already moving but sit too deep to read. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

**Opening frame.** Size the wide shot from the **long** side of the art buffer, not the short side. About 46 world units across that long side reaches the tree ring (about ±23) and stops. The empty field outside the jungle leaves the picture. The short side shows the middle of that same square, so a wide monitor crops a little of the north and south trees instead of showing bare grass to the left and right. The zoom onto the player is otherwise unchanged.

**Smoke bomb.** `F` and `变` still call henshin and the click. At the same moment, about 14 ink and grey cubes (`0x07081a`, `0x4a4e63`, `0x777d94`) spawn at the player’s body, burst outward for about 0.45 s, then disappear. They do not write depth, same as the campfire sparks. The form swaps on the first frame of the puff, so the new body is inside the cloud. A second henshin during the puff replaces the cloud. It does not queue.

**Swimming fish.** Remove the two still glow boxes on the town pond. Put three small koi on that water, built from the same orange, cream, and white as the player fox’s palette neighbours (`0xe8642c`, `0xf3e6c8`, `0xffffff`). Each one circles inside the stone rim, stays on the surface, and wags a tail. In the pond scene, the cruise depth moves from −0.22 to about −0.08, so the back and tail show through the water while they swim. Chasing a pellet can still come up to −0.06.

**Pros:** the opening picture is the festival inside the trees. The transform reads as a change, not a pop. Fish move in both views of the pool.

**Cons / risks:**

- On a very tall window the long side is vertical, so the crop is left and right instead of north and south. The tree ring still bounds the long side.
- Fourteen smoke cubes are cheap. They can hide the player for under half a second.
- The town koi are simple boxes. They will not match the eight collection patterns.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Keep fitting 42 units to the short side | A wide window keeps showing the field outside the trees. |
| Swap the form halfway through the smoke | The player would be the old shape inside the cloud, then pop. The swap belongs on the first frame. |
| Only animate the town pond | The pond scene’s fish already move, but they cruise too deep to see. |

## 5. Acceptance criteria and verification

- [x] A fresh load shows the plaza, the four places, and the tree ring, and does not show a wide band of empty field outside the trees.
- [x] Click or tap still zooms to the player. Coming back from the koi pond stays zoomed in.
- [x] `F` and `变` throw a short dark smoke burst and the form has already changed when the smoke is there.
- [x] On the town map, fish move around the pond. Inside 锦鲤池, fish swim near the surface and the back is visible through the water.
- [x] `npm run check` passes.
- [x] Verify in the browser: opening frame, smoke on `F`, town pond, then enter the pond scene.

**Verification notes (2026-10-07, Cursor browser, `http://localhost:5173/`, 64 look already saved):**

- Opening camera was 15.13 px/unit on a 696×461 buffer, which is `max(696, 461) / 46`. The plaza, four buildings, and tree ring filled the shot.
- Three town-pond koi moved 0.73, 1.32, and 2.07 units in one second.
- `F` spawned 14 smoke cubes and swapped to the human. After another 0.6 s the cubes were gone. A later `F`, once zoomed in, put the fox back inside a spreading grey cloud.
- 锦鲤池 fish sat at y = −0.08 and their backs and spots were visible through the water.
- `npm run check` passed.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-07 | draft | Jungle framing, henshin smoke, swimming koi in both pond views |
| 2026-10-07 | approved | User approved |
| 2026-10-07 | implemented | Jungle frame, smoke, and visible koi, verified in the browser |
