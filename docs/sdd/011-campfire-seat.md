# SDD: Sit on the campfire benches

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [architecture.md](../architecture.md), [001-campfire-town-mvp.md](001-campfire-town-mvp.md), [010-walk-cycle.md](010-walk-cycle.md)

## 1. Context / current architecture

The town plaza in `src/world/town.ts` `buildPlaza` has a campfire at the origin and four log benches around it, at 45°, 135°, 225°, and 315°, radius 3.1. Each bench is a cylinder lying on its side (`CylinderGeometry` radius 0.24, length 1.6, center height 0.24). Two circle colliders sit at the ends so the player cannot walk through the log. The fire itself is a circle collider of radius 1.15.

Interaction in town is a prompt plus `onAction`. Location zones and the tanuki use `ZoneSystem`: the nearest zone in range wins, and the action button runs that zone. The player in `src/world/player.ts` either walks the 6-frame cycle or holds the stand pose. Facing snaps to the nearest 90°.

## 2. Problem and non-goals

**Problem:** the benches around the center fire are only obstacles. The player cannot sit on them.

**Non-goals:**

- No new chair mesh. The four existing logs are the seats.
- No rest bonus, heal, time skip, or save.
- No sitting in other scenes, and no seat on the tanuki, the buildings, or the lantern poles.
- No diagonal facing. The pixel grid still gets a 90° yaw.
- No change to pixels per unit, palette, or the walk cycle.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Which seat? | The four log benches already around the campfire. The request is to sit at the center fire, and those logs are the seats. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

Each bench gets a stand point between the fire and the log, at radius about 2.25 along the same angle. That point clears the fire collider (radius 1.15) and the bench-end colliders. A seat check uses that point with a radius of about 0.9. It is not a `Zone`, so it does not steal the tanuki or a building entrance: if a zone is active, the zone keeps the prompt and the action. The seat prompt shows only when no zone is active.

- Near a stand point, the prompt is 坐下. Action plays the existing click, pins the player to that bench's center, and raises the body so the hips rest on top of the log (log top is about 0.48).
- The held sit pose bends both legs forward and leaves the arms down. It does not use the walk cycle.
- Yaw is the nearest 90° of the direction from the bench toward the fire.
- While seated, movement does nothing. The prompt is 起来. Action again moves the player to that bench's stand point, plays the stand pose, and collision resumes.
- While seated, the bench colliders are skipped. The sit point is the middle of the log, which overlaps the end circles; resolving collision there would push the player off the seat.
- Camera rotate (Q / E and the touch buttons) still works.

**Pros:** the seats are already in the plaza. Sit and stand use the same action button as the rest of the town. Standing up lands on a spot the colliders already allow.

**Cons / risks:**

- The benches sit on diagonals, so a 90° facing looks one step off the flames.
- A box sit pose at about 21 art pixels may read as a crouch more than a chair. The hip height is what sells it.
- The southwest bench is near the tanuki. The tanuki zone wins when both are in range, so that side will not offer 坐下 until the player is out of the tanuki radius.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| A new chair model | The plaza already has four seats. A fifth mesh is a different request. |
| Any movement stands you up | A held joystick would leave the seat on the same press that sat down. |
| Face the fire on the exact diagonal | A free yaw resamples the pixel grid. SDD 008 and 010 keep facings on 90°. |
| Register the seats as zones | The nearest zone would fight the tanuki and the four entrances. |

## 5. Acceptance criteria and verification

- [x] Standing at a bench's inner side, with no location prompt up, shows 坐下. Action puts the player on that log, in the sit pose, facing the nearest 90° toward the fire.
- [x] While seated, WASD and the joystick do not move the player. The prompt is 起来. Action returns the player to the stand point in the stand pose.
- [x] All four benches do this. The fire, the logs, and the tanuki still block or talk as they do now when the player is not seated.
- [x] `npm run check` passes. In the browser, sit and stand at the campfire on desktop, and confirm the action button does the same on a 390×844 viewport.

Verified on http://localhost:5198 (2026-10-06). `npm run check` passed. Each of the four stand points showed 圆木凳 / 坐下. Action moved the player onto the log (y = 0.12, both legs at 1.35) with the yaw listed for that bench, and the prompt became 起来. Holding W for 0.35 s moved them 0. Standing returned them to the stand point and 坐下. A point inside the tanuki radius showed 狸爷爷 / 说话. Town pixels per unit stayed 16. Desktop screenshot shows the character on a log facing the fire with 起来. At 390×844 the 互动 button is on screen; clicking it stood them up. No Vite error overlay.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | Sit and stand on the four campfire logs |
| 2026-10-06 | approved | User said approve |
| 2026-10-06 | implemented | Sit and stand on the four campfire logs |
