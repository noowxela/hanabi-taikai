# SDD: Connected 6-frame walk

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [architecture.md](../architecture.md), [008-pixel-readability.md](008-pixel-readability.md), [009-sound.md](009-sound.md)

## 1. Context / current architecture

The town player in `src/world/player.ts` is a stack of boxes about 1.3 units tall. At the town camera (16 art pixels per unit) that is about 21 art pixels. Facing snaps to the nearest 90°. Walking holds six poses for 640 ms total (about 107 ms each) and applies them with no blend. The body gets shorter and wider as `squat` rises. A footstep plays when the pose index becomes 0.

The six poses do not form a loop. Pose 5 has the left leg at −0.45 and the right at +0.55. Pose 0 has the left at +0.60 and the right at −0.60. That wrap is about twice the step between the other poses, so each cycle ends in a hitch. The second half is also not the mirror of the first, so only one foot reads as a step.

The camera still snaps to the art-pixel grid (`CameraRig.update`). This SDD does not change that.

## 2. Problem and non-goals

**Problem:** while walking, the character hitches. The pose list jumps at the loop point, so the limbs do not read as a sprite walk.

**Non-goals:**

- No blended or eased in-betweens. Each pose stays on screen until the next one replaces it.
- No change to art-pixel size, palette, pixels per unit, or camera snapping.
- No new facings. The player still turns in 90° steps.
- No walk cycle on koi, spirits, guardians, or the train.
- No change to move speed (`SPEED` 4.5) or the 640 ms cycle length.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Smoother limb swing, or held frames that connect? | Held frames. Left and right feet mirror, each frame leads into the next, and the loop closes. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

Replace `POSES` in `src/world/player.ts` with one 6-frame cycle. The left leg moves in equal steps of 0.40 radians. The right leg is the negation. Arms are −0.75 times the same-side leg. `squat` is shared by each mirrored pair so the body drops on the down frame and stands tall on the passing frame.

| Frame | Pose | legL | legR | squat |
| --- | --- | --- | --- | --- |
| 0 | contact, left foot forward | 0.60 | −0.60 | 0.55 |
| 1 | down | 0.20 | −0.20 | 1.00 |
| 2 | passing | −0.20 | 0.20 | 0.00 |
| 3 | contact, right foot forward | −0.60 | 0.60 | 0.55 |
| 4 | down | −0.20 | 0.20 | 1.00 |
| 5 | passing | 0.20 | −0.20 | 0.00 |

Frames 3–5 mirror 0–2. The step from frame 5 back to frame 0 is the same 0.40 radians as every other step. Timing stays `CYCLE = 0.64`, so each pose is still held for about 107 ms.

The footstep plays when the pose index changes to 0 or to 3 (the two contacts). Standing still still clears the cycle and holds `STAND`, and it stays silent. This replaces the single step per 640 ms from SDD 009 with one step per footfall.

**Pros:** the hitch at the loop goes away because every limb change is the same size. Both feet step. Pixel size, palette, and the held-frame rule stay as they are.

**Cons / risks:**

- Six held poses still pop. A 0.40 radian change is about 23°. At this size that is the sprite frame, and it can still look stepped.
- Two footsteps per 640 ms (about every 320 ms) sit closer together than the single beep in SDD 009.
- The limbs are still boxes, so a frame is a rotation of the same mesh, not a redrawn silhouette.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Ease the limb angles between poses | The choice was held frames. SDD 008 and the pixel primer both treat extra in-betweens as sluggish at this size. |
| Twelve frames in the same 640 ms | Six equal steps close the loop. More frames are the follow-up only if this cycle still hitches. |
| Move the camera in sub-pixel steps | The hitch reported here is the pose wrap. Camera snapping stays. |

## 5. Acceptance criteria and verification

- [x] While walking, seven consecutive samples (one per pose, including the wrap) change `legL` by 0.40 each time.
- [x] Frames 3–5 match frames 0–2 with the legs and arms swapped.
- [x] Standing still holds the stand pose and plays no footstep. Walking for 0.64 s plays two footsteps.
- [x] Town pixels per unit, palette, and camera snap are unchanged.
- [x] `npm run check` passes. In the browser, walk the town character and confirm the stride reads as left foot then right foot. Screenshot the walk on desktop.

Verified on http://localhost:5197 (2026-10-06). `npm run check` passed. Driving `player.update` through one cycle produced `legL` steps of −0.40, −0.40, −0.40, +0.40, +0.40, +0.40, and the next contact returned to 0.60. Frames 3–5 matched 0–2 with legs and arms swapped. Body scale Y was 0.901, 0.820, 1.000 on the contact, down, and passing poses, and 1.000 when standing. Town `pixelsPerUnit` stayed 16. With audio unlocked, one cycle (frames 0–5) played 2 footsteps; standing added none. A desktop screenshot shows the character mid-stride on the south path. No Vite error overlay.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | Held 6-frame cycle with equal steps and a closed loop |
| 2026-10-06 | approved | User said approve |
| 2026-10-06 | implemented | Equal 0.40 rad steps, mirrored stride, two footsteps per cycle |
