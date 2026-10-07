# SDD: Fox player, henshin, run, and opening view

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-07
- **Related:** [architecture.md](../architecture.md), [011-campfire-seat.md](011-campfire-seat.md), [012-pixel-detail.md](012-pixel-detail.md)

## 1. Context / current architecture

The town player in `src/world/player.ts` is one biped: a kid in an indigo yukata with a fox mask, about 1.36 units tall. Walk speed is `4.5`. Facing snaps to 90°. Six held poses cycle over 640 ms. `PLAYER_RADIUS` is 0.35. Sitting pins that same body onto a log.

`TownScene.update` moves the player from `ctx.move()`, resolves collisions inside bounds of about −19.5 to 19.5, then aims `CameraRig` at the player. The town camera is 16 art pixels per unit, or 47 in the 64 look. The short side of the picture then shows about 9.4 world units, so the four paths do not fit at once.

Keyboard input is WASD / arrows, Space, Q / E, and Esc. Shift is unused. 狸爷爷 and the figures in the train, arcade, and watchtower are separate meshes.

## 2. Problem and non-goals

**Problem:** the player should be a fox that can change into the human kid, walk faster while Shift is held, and the first view of a visit should show the whole town until the player clicks or taps.

**Non-goals:**

- 狸爷爷 and every figure outside the town player stay as they are.
- The fox or human form is not saved. A reload starts as a fox.
- Minigames do not gain a run button. Shift does nothing there.
- No new palette colours, and no change to the 64-pixel toggle.
- The wide shot does not play again when returning from a location in the same visit.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Who becomes a fox? | Only the player. Starts as a fox, can change into the human kid. Everyone else stays. |
| When does the wide shot play? | Every time the page loads. Coming back from a location in the same visit stays zoomed in. |

Shift is the run key, so henshin is `F` on a keyboard and a `变` button on the town HUD.

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

**Fox and human.** `Player` keeps the current body as the human form and adds a second group for the fox. Only one group is visible. The fox is a block quadruped on the existing palette: orange `0xe8642c`, cream `0xf3e6c8`, white tail tip `0xffffff`, ink eyes and nose. Shoulder height is about 0.55, with ears and a tail, so it reads as an animal next to the 1.36 human. Both forms share position, 90° facing, and `PLAYER_RADIUS` 0.35. The fox starts visible.

Henshin swaps which group is visible and replays the current pose. `F` or `变` does it. The existing click sound plays. While seated, henshin stands up, then swaps, so a fox is not left in the human sit pose. Both forms can sit afterward: the human keeps the current sit, the fox uses a low crouch and a smaller hip lift. The town hint names `F` and `变`.

**Run.** Shift, or holding a touch-only `跑` button, sets a sprint flag. Walk speed becomes `9` (twice `4.5`) and the pose cycle takes half of 640 ms. Releasing Shift or the button returns to the walk. Sitting and the opening shot ignore sprint. The fox and the human both use it.

**Opening view.** On each new `TownScene` (a page load), the camera looks at the plaza centre and uses enough of a zoom-out that about 42 world units fit on the short side of the current art buffer. That covers the bounds plus a small margin, in both the current look and the 64 look. Movement, zones, and sitting do nothing yet. A pointer down on the canvas, and not on a HUD button, starts a zoom of about 0.7 s onto the player and back to 16 or 47 pixels per unit. That click does not also interact. After the zoom, play is normal for the rest of the visit, including returns from the pond, train, watchtower, and arcade.

**Pros:** one player, two meshes, the same collisions. The opening frame shows where the four places are. Run is a held key, so it cannot stick on.

**Cons / risks:**

- At the wide shot the player is a few art pixels tall, so the fox and the human look similar until the zoom.
- A fox at 16 pixels per unit is about 9 pixels tall. Ears and the tail are the silhouette that separates it from a crouching kid.
- The zoom eases pixels-per-unit. For that 0.7 s the pixel grid is between the two sizes, so edges can shimmer. It stops when the zoom ends.
- A HUD click during the wide shot does not start the zoom, so `64` and `静音` still work.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Turn 狸爷爷 and the other casts into foxes | The request is the player only. |
| Use Shift for henshin | Shift is the run key. |
| Save the form, or play the wide shot only once ever | A reload starts as a fox and shows the town again. Returning from a location stays close. |
| Replay the wide shot every time the town is entered | Coming back from the pond would pull the camera out again. |

## 5. Acceptance criteria and verification

- [x] A fresh load shows the whole town, fox included, and the player does not walk until the picture is clicked or tapped.
- [x] That click zooms onto the fox. Walking, sitting, and entering the koi pond still work. Returning to town stays zoomed in. A reload shows the wide shot again.
- [x] `F` and `变` swap fox and human. The fox is the low four-legged body. The human is the existing kid. Reload starts as the fox.
- [x] Holding Shift, or holding `跑` on touch, about doubles speed for both forms. Releasing it returns to the walk.
- [x] 狸爷爷 is unchanged. `npm run check` passes.
- [x] Verify in the browser: wide shot, zoom, both forms, Shift run, enter the pond and return, then reload.

**Verification notes (2026-10-07, Cursor browser, `http://localhost:5173/`, 64 look already saved):**

- Fresh load: fox, spawn `(0, 0, 13)`, camera 10.98 px/unit (buffer height 461 / 42). The four places fit in one shot. Holding W for 0.5 s left the player at the spawn.
- Canvas pointer down, then 1 s: camera 47 px/unit, player still at the spawn until walking. Walk 0.5 s moved 2.325 units. Shift plus walk 0.5 s moved 4.650 units, exactly twice.
- `F` hid the fox. The `变` button brought the human kid back, and a later `henshin` showed the orange fox with a white tail tip. Reload started as the fox on the wide shot again.
- Entering 锦鲤池 and returning left the town camera at 47 px/unit, with the koi prompt working. 狸爷爷’s mesh was not edited.
- The touch `跑` hold path is in the HUD (`only-touch`) and was not pressed on this desktop viewport.
- `npm run check` passed.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-07 | draft | Player-only fox, henshin on F, Shift run, wide shot each page load |
| 2026-10-07 | approved | User approved |
| 2026-10-07 | implemented | Fox, henshin, Shift run, and the opening wide shot, verified in the browser |
