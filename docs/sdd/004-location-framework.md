# SDD: Location framework (shared groundwork for 005–007)

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [architecture.md](../architecture.md), [005](005-night-market-train.md), [006](006-campfire-watch.md), [007](007-pixel-pal-arcade.md)

## 1. Context / current architecture

- `src/main.ts` wires exactly two scenes (`town`, `pond`) and calls `overlay.setMode('town' | 'pond')`.
- `Overlay` hard-codes pond buttons (图鉴, 返回小镇) and town touch buttons; the joystick shows only in `town` mode.
- Town zones `train`, `arcade`, `watch` open a "即将开放" dialog.
- Save code lives in `src/scenes/koiPatterns.ts` (single key).

## 2. Problem and non-goals

**Problem:** three new playable locations need the same plumbing: enter/leave from a town zone, a per-scene HUD (title, stats, buttons), touch controls, a result panel, and saved best scores.

**Non-goals:** a generic UI framework, cloud saves.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Depth per location? | One complete small loop each (≈ koi pond size): 5 train levels, 5 watch waves, best score saved. |
| Arcade game count? | 3 thirty-second minigames. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

- **HUD per scene:** replace `setMode` with `overlay.setHud({ title, buttons, controls })`, where `buttons` is `{ label, onClick }[]` and `controls` is `'joystick' | 'none'`. Each scene calls it in `enter()`. `setStats(main, sub)` replaces `setPondStats`.
- **Panels:** generic `overlay.showPanel(title, body: HTMLElement, actions)` used by the koi collection, the watch build menu, and result screens. `busy` covers any open panel.
- **Scene switching:** `main.ts` keeps a `scenes` map; `go(id)` fades and switches; leaving any location returns to its town zone entrance (`town.placeAtZone`).
- **Town:** the three zones call `enter(id)`; their markers turn gold like the koi pond.
- **Saves:** `src/save.ts` with `loadJson(key, fallback)` / `saveJson(key, value)`, keys `hanabi-taikai.<feature>.v1`. Koi moves onto it (same key, no migration needed).
- **Pointer picking:** shared helper that turns a pointer event into a ground-plane hit for puzzle/defense scenes (reuses `pipeline.clientToNdc`).

**Pros:** each location becomes one self-contained `GameScene` module; removes pond-specific code from the overlay.

**Cons / risks:** touches `main.ts`, `overlay.ts`, `town.ts`, and the koi pond together; regression risk for 001 (re-verify the koi loop).

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Keep adding modes to `setMode` | Grows a switch statement per scene; buttons stay hard-coded. |
| React for UI panels | New dependency for a handful of panels. |

## 5. Acceptance criteria and verification

- [x] Koi pond still works end to end (enter, feed, collection, leave, reload).
- [x] Every location enters from its zone and returns to its entrance with Esc / 返回小镇.
- [x] `npm run check` and `npm run build` pass.

**As built:**

- `setHud({ title, hint, buttons, joystick, action, dpad })`. Touch controls are booleans rather than one `controls` enum because Quick Keys needs a 4-way d-pad, and the hall needs both a joystick and a 开始 button.
- `showPanel(title, body, actions, dismissible)`: Space runs the primary action, and Esc closes the panel only if it is dismissible (otherwise Esc goes to the scene's `onBack`).
- `flash(text)` shows a large centred banner for countdowns and hits.
- Scenes receive a `SceneContext { canvas, overlay, move, isBusy, go, pick }` (in `src/scenes/types.ts`) instead of per-scene hook objects. `GameScene.zoneId` tells `go('town')` which entrance to return to.
- `loadJson(key, fallback, validator)` takes a type guard, and each feature clamps its numbers on load.
- Input gained discrete `direction` events (arrow / WASD keydown and the d-pad).

**Verification:** in the browser, a script stood at each of the four town entrances, pressed Space, then Esc, and checked the player returned beside that zone. The koi collection, Esc handling, saves, and reload were all re-checked.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | |
| 2026-10-06 | approved | User approved 003–007 |
| 2026-10-06 | implemented | Overlay rewrite, scene registry, `src/save.ts`; verified in browser |
