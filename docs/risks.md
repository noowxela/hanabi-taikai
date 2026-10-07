# Open risks

- The town player only faces north, east, south, or west. Diagonal walking snaps to the nearer axis, so the turn can feel stiff.
- The walk is still six held poses. Each step is the same size, and a 0.40 radian pop can still look stepped at this pixel size.
- A campfire sit faces the nearest 90°, so on a diagonal log the character looks one step off the flames. The box pose can read as a crouch.
- Dirt paths are stair-stepped tiles. Shallow slopes show long horizontal runs instead of a smooth ribbon.
- Browser verification of 008 cleared train level 1 (already starred) and advanced Campfire Watch to wave 2 in `localStorage`.
- Music is a few oscillators. It stays silent until the first click or key, because the browser blocks audio before a gesture.
- A lantern's aura damages every frame. Its hit sound is limited to one ping every 0.45 s, so a lantern does not click on every tick.
- The 64 look aims at a 441 px short side, but the upscale factor cannot drop below 2. A short low-density window then shows a slightly different amount of town than the current look. The town camera still uses 47 pixels per unit.
- The opening zoom eases pixels-per-unit for about 0.7 s, so edges can shimmer until the zoom ends. At the wide shot the player is only a few art pixels tall.
- Every loop has a square tick at peak 0.03. On the arcade loop (128) that tick can feel busy.
