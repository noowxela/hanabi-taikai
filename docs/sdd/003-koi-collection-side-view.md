# SDD: Koi collection side view

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [001-campfire-town-mvp.md](001-campfire-town-mvp.md)

## 1. Context / current architecture

`Overlay.showCollection` (`src/ui/overlay.ts`) renders each pattern as an oval CSS swatch: a radial gradient of the first spot colour over the base colour. `KoiPondScene.collectionEntries()` supplies `baseColor` / `spotColor` strings.

## 2. Problem and non-goals

**Problem:** the collection (锦鲤图鉴) should show each koi as a side-view illustration, not a colour blob.

**Non-goals:** changing the in-pond 3D koi (still seen from above), new patterns.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Side view or top view? | Side view (user request). |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

- New `src/ui/koiSprite.ts`: draws a side-view koi into a 32×14 `<canvas>` from a hand-made pixel mask (body, head, eye, dorsal fin, pectoral fin, forked tail). Shown at 4× with `image-rendering: pixelated`.
- Pattern mapping: `spot.z` (tail −1 … head 1) sets the horizontal position, `spot.x` sets how far the patch reaches down the flank from the back, `spot.size` sets the radius. Patches are clipped to the body mask. Fins use `pattern.fin`. Darker belly row and a 1 px ink outline; all colours come from the game palette.
- Locked patterns: same silhouette filled with dark navy and a "？".
- `CollectionEntry` passes the `KoiPattern` itself instead of two colour strings.

**Pros:** consistent pixel look, zero new assets, each pattern visibly different.

**Cons / risks:** side view shows back patterns less faithfully than top view; hand-tuned mask.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Render the 3D koi offscreen | Top-down model looks wrong from the side; extra renderer setup. |
| Image files per pattern | Needs art for 8 patterns; harder to keep in sync with data. |

## 5. Acceptance criteria and verification

- [x] Each unlocked card shows a distinct side-view koi; locked cards show a dark silhouette.
- [x] Crisp pixels on desktop and mobile; browser screenshot.

**Verification:** browser screenshots with 4/8 and 8/8 unlocked. The collection is now a generic 004 panel (`KoiPondScene.showCollection`), and locked cards show "？？？" plus the unlock count under the silhouette instead of a "？" drawn on it. Cards render at 3.5× (112×49 px).

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | |
| 2026-10-06 | approved | User approved 003–007 |
| 2026-10-06 | implemented | `src/ui/koiSprite.ts`; verified in browser |
