# SDD: Campfire town MVP

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [architecture.md](../architecture.md)

## 1. Context / current architecture

Empty repo; see [architecture.md](../architecture.md) for the baseline this SDD creates.

## 2. Problem and non-goals

**Problem:** first playable slice of a pixel-art Japanese campfire-festival town (营火会小镇): walk around, enjoy the campfire plaza, and play one location.

**Non-goals:**

- Night Market Train (夜市火车站), Campfire Watch (守夜塔), and Pixel Pal Arcade (掌机仔街机厅) gameplay. They appear as buildings that say "coming soon"; each gets its own SDD (002+).
- Audio, accounts, cloud saves, localisation beyond Chinese UI text.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Which idea? | All four, as locations in one Japanese campfire-festival town you can walk around. |
| Characters? | Original only (not the reference screenshot cast). |
| MVP scope? | Free walking + campfire plaza + one playable location; the other three are placeholder buildings. |
| Platforms? | Desktop (WASD / arrows) and mobile (virtual joystick). |
| First playable location? | Koi pond (smallest scope). |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

- **Pixel look:** render to a low-res target sized so the short screen side is about 190 px, upscale by an integer factor with nearest sampling, then snap every pixel to a fixed palette with 4×4 Bayer dithering. Toon materials (3-step gradient) for lit surfaces; lanterns and fire are unlit glow materials.
- **Camera:** orthographic, about 42° pitch, follows the player, snaps to the pixel grid to avoid shimmer. Rotates in 90° steps with Q / E, on-screen buttons, or a two-finger twist.
- **Town:** campfire plaza in the centre (flickering point light + spark particles), a torii on the south path, lantern strings, benches, trees, and an original NPC (Old Tanuki, 狸爷爷). Four locations connected by dirt paths: koi pond (west), train station (east), arcade (north-west), watchtower (north-east).
- **Movement:** camera-relative, circle-vs-circle / circle-vs-box collisions, world bounds.
- **Zones:** `Zone { id, label, position, radius, prompt, onEnter?, onInteract }`. Entering a zone shows a prompt; Space / Enter / the touch action button interacts. Placeholder zones open a short "即将开放" dialog.
- **Koi pond scene:** separate `GameScene`. Tap or click the water to drop food pellets; koi steer to the nearest pellet and eat it. Total pellets eaten unlocks patterns (Kohaku, Tancho, Sanke, Showa, Asagi, Ogon, Kujaku, Ginrin); each unlock adds a fish. A collection panel (图鉴) lists unlocked and locked patterns. Progress is saved to `localStorage` key `hanabi-taikai.koi.v1`. "返回小镇" / Esc returns to the town at the pond entrance.

**Pros:** one complete loop to play, a reusable zone + scene pattern for the next three locations, no assets to license.

**Cons / risks:**

- Mobile GPU cost: limited to one point light per scene; glow uses unlit materials.
- Pixel shimmer when the camera moves: mitigated by snapping the camera to the low-res pixel grid.
- Scope creep: the other three locations are explicitly out of scope.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Train puzzle as first playable | Level design + track editor is larger than the koi loop. |
| Sprite billboards for characters | Breaks the "real 3D under pixel post" look when the camera rotates. |

## 5. Acceptance criteria and verification

- [x] Desktop and mobile-size viewport: the player walks around the town and is blocked by buildings.
- [x] The campfire flickers and emits sparks; the image is crisp pixel art (no blur).
- [x] Each of the four locations shows a prompt; the koi pond can be entered, the other three say "即将开放".
- [x] In the koi pond, feeding works and unlocks patterns; progress survives a page reload.
- [x] Verified with browser screenshots; `npm run check` passes.

**Verification notes (2026-10-06, Cursor browser):**

- Desktop 1371×828: walking north from the plaza edge stops at the campfire collider (z = 1.50). Q rotates the camera a quarter turn.
- Koi entrance shows "锦鲤池 进入 空格"; Space enters, Esc returns to the entrance. Train, arcade, and watchtower show "即将开放" and their dialog.
- Feeding 9 pellets unlocked Tancho (toast + new fish); the collection panel listed 2/8; after reload the count was still 9.
- Mobile 390×844 at 3× with touch emulation: joystick moved the player 3 units, the action button entered the pond, and tapping the water dropped food.
- Two-finger twist was not exercised (CDP touch input is blocked in this browser); it needs a real-device check.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | Written from plan |
| 2026-10-06 | approved | User approved the plan and asked to implement |
| 2026-10-06 | implemented | Verified in browser (desktop + mobile viewport) |
