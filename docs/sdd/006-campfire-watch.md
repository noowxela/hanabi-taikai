# SDD: Campfire Watch (守夜塔)

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [004-location-framework.md](004-location-framework.md)

## 1. Context / current architecture

The north-east zone has a watchtower model and a "即将开放" dialog.

## 2. Problem and non-goals

**Problem:** make the watchtower playable: a small tower-defense night where masked spirits (面具妖怪) walk toward a campfire.

**Non-goals:** tower upgrades beyond one level, multiple maps, endless mode.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Depth? | 5 waves, best result saved. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

- **Map:** one clearing with a winding dirt path from the forest edge to a campfire (10 HP). About 8 fixed build spots (stone pads) beside the path.
- **Guardians (original):**

| Guardian | Cost | Effect |
| --- | --- | --- |
| 烟花筒 Firework tube | 3 embers | Single target, medium range, steady damage |
| 太鼓 Taiko drum | 5 embers | Pulse that damages all spirits in a short radius |
| 驱邪灯笼 Ward lantern | 4 embers | Slows spirits in range by 50 %, small damage |

- **Spirits:** 3 kinds of masks (fast/weak, normal, slow/tough). 5 scripted waves; the last includes a big mask.
- **Economy:** start with 8 embers; each defeated spirit drops embers; a wave bonus when cleared.
- **Flow:** tap a pad → build panel (004 panel) → place. "开始第 N 波" starts the next wave. Win after wave 5 with HP left; lose at 0 HP. Result panel shows stars by remaining HP (≥ 8 = 3★, ≥ 4 = 2★, else 1★).
- **Save:** `{ bestStars, bestWave }`.
- **Visuals:** spirits are box-built bodies with glowing mask faces; projectiles are glow cubes; campfire reuses the town fire style with a light that dims as HP drops.

**Pros:** classic, readable loop; reuses town lighting and props.

**Cons / risks:** balance needs tuning by playtesting; many moving objects on mobile (cap ~30 spirits).

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Free placement anywhere | Needs path-blocking rules; pads keep it simple on touch. |
| Real-time player character fighting | Different genre; tower defense was the agreed idea. |

## 5. Acceptance criteria and verification

- [x] All three guardians work; 5 waves run; win and lose both reachable.
- [x] Best result survives reload; desktop and mobile viewport.

**As built:**

- Data lives in `src/scenes/watch/watchData.ts`.
- Spirit stats after tuning:

| Spirit | HP | Speed | Embers dropped |
| --- | --- | --- | --- |
| small | 3 | 1.6 | 1 |
| oni | 11 | 1.0 | 2 |
| big | 55 | 0.6 | 4 |
| boss | 220 | 0.45 | 10 |

- The wave bonus is `2 + wave`.
- Upgrading multiplies damage by 1.8; an upgraded lantern also slows 15 % more.
- A built guardian can be removed for a 50 % refund.
- The game pauses while a panel is open. Speed can be ×1 or ×2.
- Spirits always face the camera so their masks stay readable.
- In portrait, the camera turns 90°.
- Save is `hanabi-taikai.watch.v1 { bestStars, bestWave }`.

**Verification:**

- In the browser, a guardian was built by clicking a real pad and then a card in the build panel.
- Scripted full runs:
  - Greedy building and upgrading wins with 3★.
  - Three un-upgraded firework tubes win with 2★.
  - Building nothing loses in wave 2.
- Checked the result panel, the save after reload, and the mobile layout.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | |
| 2026-10-06 | approved | User approved 003–007 |
| 2026-10-06 | implemented | `src/scenes/watch/`; balance tuned; verified in browser |
