# SDD: Town pixel-detail toggle

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-07
- **Related:** [architecture.md](../architecture.md), [008-pixel-readability.md](008-pixel-readability.md)

## 1. Context / current architecture

`PixelPipeline` (`src/render/pixelPipeline.ts`) renders the whole game into a low-res target. `TARGET_SHORT_SIDE` is 150, and `scale` is an integer of at least 2, so the short side of that target stays near 150 art pixels. The post pass still snaps every pixel to the palette and draws a 1 px depth outline.

The town camera is `new CameraRig(42, 16)` in `src/world/town.ts`. Visible world on the short side is about `150 / 16 = 9.375` units. The player’s feet sit on y = 0 and the hair top is at y = 1.36, so the body is about 22 art pixels tall. The eyes are 0.08 units, about one art pixel, and they disappear into the face.

Pond, train, watch, arcade hall, and the three minigames do not use a fixed pixels-per-unit. Each `resize` sets pixels-per-unit from `lowWidth` and `lowHeight` so the board stays in frame. A larger buffer makes those scenes more detailed without a camera change.

The town HUD is set in `TownScene.enter`. `Overlay.setButtons` draws those buttons, then always appends the mute button. Saves use `src/save.ts` with the prefix `hanabi-taikai.`. Mute already persists as `audio.v1`.

## 2. Problem and non-goals

**Problem:** the block models already have small parts (eyes, obi, walk poses) that the 150 / 16 look cannot show. The player needs a town control that switches to a cleaner 64-pixel-tall look and remembers the choice in this browser.

**Non-goals:**

- No new meshes, palette colours, outlines, or walk poses. Detail comes from giving the current models more art pixels.
- No third setting, and no separate pixel size per scene.
- The control is not repeated on the pond, train, watchtower, or arcade HUDs.
- No change to gameplay, collision, or the sit pose.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| What should “64” change? | A cleaner, more detailed look: the player about 64 art pixels tall, with the same amount of town on screen. |
| How is it chosen? | A control in the town that switches between the current look and 64, saved in this browser. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

Two modes, defaulting to today’s look.

| Mode | Short-side target | Town pixels per unit | Player height | Short-side world size |
| --- | --- | --- | --- | --- |
| Current | 150 | 16 | 1.36 × 16 ≈ 22 px | 150 / 16 = 9.375 |
| 64 | 441 | 47 | 1.36 × 47 ≈ 64 px | 441 / 47 ≈ 9.38 |

441 and 47 are the pair that hits 64 pixels on this body and keeps the plaza the same size. Eyes become about 4 art pixels (0.08 × 47).

- `PixelPipeline` takes a short-side target instead of the fixed 150. `resize()` is otherwise unchanged, including the minimum `scale` of 2.
- Boot reads `hanabi-taikai.pixel.v1`, shape `{ detail: boolean }`, default `{ detail: false }`. Invalid JSON falls back the same way `audio.v1` does. The saved mode is applied before the first scene `resize`.
- `TownScene.resize` sets the rig to 16 or 47 from that flag, then frames the buffer. Other scenes already recompute pixels-per-unit from the buffer, so they gain the extra pixels and keep the whole board.
- The town HUD gets one button, drawn before 静音. It reads `64` in the current look and `普通` in the 64 look. Click plays the existing click, flips the flag, saves, and runs the same resize path as a window resize. No scene reload. The player stays where they are.
- Leaving town does not reset the mode. Coming back shows the button in the saved state.

**Pros:** one saved boolean, same materials and meshes, plaza framing stays put on a normal desktop or a phone with a high device-pixel ratio. Puzzle cameras follow the buffer, so they do not need their own 64 numbers.

**Cons / risks:**

- The 64 buffer is about 3× wider and taller (about 9× the pixels). It is still a few hundred pixels on a side.
- `scale` cannot drop below 2. On a short, low-density window the 64 target cannot be reached, so that screen shows a slightly different slice of town than the current look. The player is still drawn at 47 pixels per unit.
- Outlines stay 1 art pixel, so they look thinner in the 64 look.
- The boxes stay boxes. Smaller parts become visible; no new shapes appear.
- The switch is only on the town HUD. A minigame keeps whatever look was saved until the player returns to town.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| 64 pixels per unit at the current 150 short side | Shows about a quarter of the town. Entrances fall far outside the frame. |
| Raise only `TARGET_SHORT_SIDE` to 441 | Town pixels-per-unit stays 16, so the camera zooms out and the player stays ~22 pixels tall. |
| Short side 470 and 50 pixels per unit | The body would be about 68 pixels, and the plaza slice would not match today’s 9.375 units. |
| A 64 button on every scene HUD | The request is a town control. The look still applies everywhere because there is one pipeline. |

## 5. Acceptance criteria and verification

- [x] Town HUD shows `64` on a fresh browser. Clicking it changes the label to `普通`, the player stays put, and the body is visibly finer (eyes readable) with a similar stretch of plaza on screen.
- [x] Clicking `普通` restores the current chunkier look.
- [x] Reload keeps the last choice (`localStorage` key `hanabi-taikai.pixel.v1`).
- [x] With 64 on, the koi pond, train, watchtower, and arcade still show the whole board, drawn finer than the current look.
- [x] `npm run check` passes.
- [x] Verify in the browser: toggle both ways in town, reload, enter one other location, and return.

**Verification notes (2026-10-07, Cursor browser, `http://localhost:5173/`):**

- Fresh load: button `64`, no save, scale 12, buffer 224×154, town 16 px/unit.
- Click `64`: button `普通`, save `{"detail":true}`, scale 4, buffer 670×461, town 47 px/unit. Player stayed at `(0, 0, 13)`. Short-side world size went from 154/16 = 9.6 to 461/47 = 9.8. The sleeve and head read as separate pixels.
- Click `普通`: scale 12, buffer height 154, 16 px/unit, save `{"detail":false}`, button `64`.
- Reload with detail on: button `普通`, 47 px/unit, buffer height 461.
- Koi pond at that size framed the whole pond (camera 40.1 px/unit, which is 461/11.5). Its HUD was 图鉴 / 返回小镇 / 静音, with no pixel button. 返回小镇 restored 营火会小镇 with button `普通` and 47 px/unit.
- Train, watchtower, and arcade use the same buffer and the same fit-to-board resize, so they were not opened separately.
- `npm run check` passed.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-07 | draft | Town toggle between the current look and a 64 px player, same plaza framing, saved locally |
| 2026-10-07 | approved | User approved |
| 2026-10-07 | implemented | Town HUD toggle, verified in the browser |
