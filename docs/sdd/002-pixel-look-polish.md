# SDD: Pixel look polish

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [architecture.md](../architecture.md), [001-campfire-town-mvp.md](001-campfire-town-mvp.md)

## 1. Context / current architecture

`src/render/pixelPipeline.ts` renders each scene to a low-res target (short side ≈ 190 px), adds 4×4 Bayer dither to every pixel, then snaps it to the nearest palette colour using luma-weighted RGB distance. No outlines. The town scatters 320 grass tufts and 40 rocks at random angles.

## 2. Problem and non-goals

**Problem:** the image reads as noisy. Smooth light falloff on large flat surfaces dithers into checkerboards; RGB matching picks wrong hues (grey stone → bright blue, red → pink); objects have no outline against the dark ground; 1–2 px props and random angles add jaggies.

**Non-goals:** per-material hand-picked colour ramps, new art, gameplay changes.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Apply the proposed fixes (no dither, outlines, OKLab, fewer props, bigger pixels)? | Yes ("do it"). |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

- Remove Bayer dither; palette quantisation alone gives clean bands.
- Match colours in OKLab (perceptual) instead of weighted RGB. Palette OKLab values are precomputed on the CPU.
- 1 px outer outline from the depth buffer: a pixel that is farther than a 4-neighbour by more than a world-space threshold is darkened. Lines, sparks, and fireflies stop writing depth so they do not get outlined.
- Bigger pixels: short side ≈ 150 px; town camera 11 px per unit (keeps the same field of view).
- Fewer, chunkier props: ~90 larger grass tufts, rocks and tufts rotated in 45° steps, fewer sparks.

**Pros:** cleaner shapes, stable hues, objects readable at a glance; all changes are local to the pipeline and town props.

**Cons / risks:** depth outlines skip edges between touching objects at similar depth (no normal pass); fewer pixels per object means less detail on the player and koi.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Normal-buffer outlines | Needs a second render pass per frame; depth edges cover the main problem. |
| Per-material 3-colour ramps | Bigger change to every material; revisit if OKLab is not enough. |
| Keep dither at a low strength | Still visible on large planes; adds nothing the bands do not. |

## 5. Acceptance criteria and verification

- [x] Grass and plaza render as flat colour bands without checkerboards.
- [x] Plaza stone no longer turns bright blue; koi red spots read as red.
- [x] Buildings, trees, player, and koi have a dark 1 px outline.
- [x] `npm run check` and `npm run build` pass; before/after screenshots compared in the browser.

**Verification notes (2026-10-06):**

- Found and fixed a placement bug while testing: instanced grass and rocks were lifted by `scale.y / 2`, which is only right for 1-unit-tall geometry, so grass floated about 0.5 units above the ground and outlined as hollow rings. Geometry is now translated so its base sits at y = 0.
- Grass tufts became flat grass patches (90) so they add texture without triggering outlines.
- Fireflies dropped to 1 px; at the bigger pixel size 2 px read as blocks.
- Side effect: under the blue moonlight, OKLab matching renders maple foliage as warm brown/orange instead of red. Accepted for now; per-material ramps (rejected above) would be the fix if red maples matter.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | approved | User approved the proposal ("do it") |
| 2026-10-06 | implemented | Verified in browser (town + koi pond) |
