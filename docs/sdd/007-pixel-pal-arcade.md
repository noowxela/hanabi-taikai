# SDD: Pixel Pal Arcade (掌机仔街机厅)

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [004-location-framework.md](004-location-framework.md)

## 1. Context / current architecture

The north-west zone has an arcade building and a "即将开放" dialog.

## 2. Problem and non-goals

**Problem:** make the arcade playable: a hall of cabinets, each running a 30-second minigame with a saved high score.

**Non-goals:** online leaderboards, more than three games in this SDD.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| How many minigames? | 3. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

- **Hall scene:** a neon room with three cabinets in a row. Left / right (keys, joystick, or tapping a cabinet) selects; Space / 互动 / tap again starts. Each cabinet shows its high score.
- **Minigames** (each its own `GameScene`, 30 s timer, 3-2-1 countdown, result panel with 再来一次 / 返回):

| Game | Controls | Rules |
| --- | --- | --- |
| 企鹅滑冰 Ice Slide | ← → or joystick | An original penguin slides down a 3-lane ice run; dodge snow piles, grab fish. Hit = lose 3 s. Score = fish. |
| 快打键 Quick Keys | ↑↓←→ or 4 on-screen buttons | An original typewriter shows an arrow; press it before it times out. Combo multiplies points; a miss resets the combo. |
| 接灯笼 Lantern Catch | ← → or joystick | Move a basket; catch falling lanterns (+1, gold +5), avoid dud fireworks (−3). |

- **Save:** `{ high: { slide, keys, catch } }`.
- **Touch:** joystick for the two movement games; the 4-button pad shows only in Quick Keys.

**Pros:** three short, distinct loops; good for repeated visits.

**Cons / risks:** three scenes plus a hall is the largest of the three locations; difficulty curves need playtesting.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Letter-typing game | Needs a keyboard; arrows work with a 4-button pad on phones. |
| Shared generic minigame engine | Three games are different enough; a small shared timer/result helper is enough. |

## 5. Acceptance criteria and verification

- [x] Hall selects and launches all three games; each ends at 30 s with a result panel.
- [x] High scores survive reload; desktop and mobile viewport.

**As built:**

- `src/scenes/arcade/minigame.ts` is the shared base: 3-2-1 countdown, 30 s timer, HUD stats, result panel, and high-score save.
- Hall and Ice Slide react to the edge of the combined movement vector, so a key press and a joystick flick each move one step. Quick Keys uses discrete `direction` events from the keyboard and the d-pad.
- Quick Keys' combo multiplier is ×(1 + ⌊combo / 5⌋), capped at ×5. The time window shrinks from 1.6 s to 0.7 s over the round.
- Save is `hanabi-taikai.arcade.v1 { high: { slide, keys, catch } }`.

**Verification:**

- Hall selection by keyboard; launching a game by tapping a cabinet in a 390×844 touch viewport.
- Ice Slide: lane changes, fish pickups, the −3 s penalty, and the result panel with 新纪录.
- Quick Keys: combo scoring (12 hits = 21 points), a miss resets the combo, d-pad input.
- Lantern Catch: basket movement and scoring.
- High scores read back after reload.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | |
| 2026-10-06 | approved | User approved 003–007 |
| 2026-10-06 | implemented | `src/scenes/arcade/`; verified in browser |
