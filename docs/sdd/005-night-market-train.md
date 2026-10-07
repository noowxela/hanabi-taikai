# SDD: Night Market Train (夜市火车站)

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [004-location-framework.md](004-location-framework.md)

## 1. Context / current architecture

The east zone has a station model and a "即将开放" dialog. No puzzle code exists.

## 2. Problem and non-goals

**Problem:** make the station playable: a track-laying puzzle where a little train carries passengers to night-market stalls.

**Non-goals:** level editor, branching switches, multiple trains, timed pressure.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Depth? | 5 hand-made levels, best result saved. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

- **Board:** grid (5×4 up to 7×5) seen from the oblique pixel camera. Tile types: empty grass, blocked (stall, lantern pole, tree), start (station + train, fixed exit side), goal (market gate, fixed entry side), passenger (an original character waiting on the tile; track must pass through it).
- **Building:** tap or click an empty / passenger tile to cycle its piece: none → ─ → │ → └ → ┌ → ┐ → ┘ → none. Each level has a piece budget shown in the HUD.
- **Run:** "发车" animates the train tile by tile. A piece must connect the side the train enters from; otherwise the train stops and the run fails ("脱轨了"). Reaching the goal after visiting every passenger tile clears the level. "重来" clears placed pieces.
- **Scoring:** stars by pieces used (≤ par = 3★, ≤ par + 2 = 2★, otherwise 1★). Save `{ cleared: { [level]: bestStars } }`. Level N+1 unlocks after N is cleared.
- **Levels:** stored as small string maps in `src/scenes/train/levels.ts`; each checked solvable with a solver during development.
- **Controls:** pointer only for tiles; HUD buttons 发车 / 重来 / 关卡 / 返回小镇; Esc leaves.

**Pros:** small rule set, clear win condition, works the same with touch and mouse.

**Cons / risks:** level design takes care; tile picking at an oblique angle needs accurate ground raycasts.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Drag to draw track | Harder on small phones; cycling pieces is unambiguous. |
| Real-time train while building | Adds timing pressure the cozy town does not need. |

## 5. Acceptance criteria and verification

- [x] All 5 levels are solvable (solver check) and clear with stars.
- [x] Wrong track derails the train; 重来 resets.
- [x] Progress survives reload; works on desktop and mobile viewport.

**As built:**

- Rules live in `src/scenes/train/levels.ts`, which has no imports. `npm run solve:train` runs `scripts/solve-train.ts` and checks that every level's minimum piece count equals its hardcoded `par` (levels 1–5: 3, 8, 7, 11, 11).
- Piece budget is `par + 4`. Right-click cycles pieces backwards (desktop).
- Besides 脱轨了, failures include "missing passenger", "entered the gate from the wrong side", and "loop" (the train repeats a tile).
- Save is `hanabi-taikai.train.v1 { stars: number[] }`. The scene opens at the first uncleared level.
- In portrait, the camera turns 90° so the board's long side runs down the screen.

**Verification:**

- In the browser, level 1 was cleared with real pointer clicks (3★, saved).
- Level 2 was derailed on purpose, then reset with 重来.
- Levels 2–5 were cleared using the solver's answers. The last level shows 全部通关.
- Tile taps were tested in a 390×844 touch viewport.
- Saves were reloaded and the scene resumed at the first uncleared level.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | |
| 2026-10-06 | approved | User approved 003–007 |
| 2026-10-06 | implemented | `src/scenes/train/`; verified in browser |
