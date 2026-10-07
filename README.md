# 营火会小镇

A pixel-art 3D browser game. Walk a Japanese campfire-festival town, sit on the logs around the fire, and visit four locations. Geometry is built in code. The picture is a low-resolution render, scaled up with nearest-neighbor sampling and snapped to a fixed palette.

The page title is 营火会小镇. Saves live in `localStorage` under keys prefixed `hanabi-taikai.`.

Play it at https://noowxela.github.io/hanabi-taikai/. A push to `main` builds the site and publishes that page.

## Run

Requires Node.js 20.19+ (or 22.12+).

```bash
npm install
npm run dev
```

Vite prints a local URL and a network URL (`--host`), so a phone on the same network can open the game too.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run check` | Typecheck (`tsc --noEmit`) |
| `npm run build` | Typecheck and write `dist/` |
| `npm run preview` | Serve the production build |
| `npm run solve:train` | Check that every Night Market Train level is solvable at its par |

## Play

Walk up to a building or the tanuki until a prompt appears, then interact.

| | Desktop | Touch |
| --- | --- | --- |
| Move | WASD or arrows | Joystick, or the d-pad in minigames that use it |
| Run | Hold Shift | Hold 跑 |
| Change form | F or 变 | 变 |
| Interact / confirm | Space or Enter | 互动 |
| Leave / close | Esc | 返回 |
| Rotate camera | Q / E | ⟲ / ⟳, or a two-finger twist |
| Sound | 静音 / 声音 | same |
| Pixel detail | `64` / `普通` on the town HUD | same |

`64` draws the player at about 64 art pixels and keeps the same stretch of town on screen. `普通` returns to the chunkier look. The choice is saved in this browser and stays on when you leave town. The button itself is only on the town HUD.

**Town.** Each page load opens on the festival inside the trees. Click or tap the picture to zoom in on the player. The player starts as a fox. `变` turns them into the kid in the yukata, and back, with a short puff of smoke. Three koi circle the pond on the west path. Campfire plaza, lanterns, a torii, and 狸爷爷, who points you at the four places. Stand by a log bench (圆木凳) and sit; the prompt is 坐下, then 起来. A location entrance takes priority over a seat.

| Place | What you do |
| --- | --- |
| 锦鲤池 (west) | Drop food in the pond. Eaten pellets unlock koi patterns and add fish. The 图鉴 lists them. |
| 夜市火车站 (east) | Lay track so the train picks up every passenger and reaches the market. Five levels, scored in stars. |
| 守夜塔 (north-east) | Place guardians and hold the campfire through five waves of masked spirits. |
| 掌机仔街机厅 (north-west) | Three 30-second cabinets: 企鹅滑冰, 快打键, 接灯笼. High scores stay on this browser. |

Progress for koi, train, watch, arcade, and mute is saved in this browser only.

## Stack

Vite, TypeScript, and [three.js](https://threejs.org/). No backend, accounts, or asset files. Music and effects are generated with the Web Audio API.

```text
src/main.ts          boot, scene map, go(id)
src/render/          low-res target, palette, camera, materials
src/input/           keyboard, joystick, two-finger twist
src/world/           town, player, collisions, zones
src/scenes/          koi pond, train, watchtower, arcade
src/audio/           loops and effects
src/ui/              HUD, dialogs, panels, prompts
src/save.ts          localStorage helpers
```

Design notes are in [`docs/architecture.md`](docs/architecture.md) and [`docs/sdd/INDEX.md`](docs/sdd/INDEX.md).
