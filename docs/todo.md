# Deferred

- Town at 16 art pixels per unit shows less of the festival at once. A wider pitch, or a second camera distance, was not tried.
- The arcade hall and Quick Keys still light with a hemisphere and a point light only. They have no directional key light.
- Koi keep a smooth heading. Snapping them to 90° would make the pond swim in squares.
- If the 6-frame walk still reads as a hitch, the follow-up is 12 held frames in the same 640 ms.
- Spirits, guardians, and the train have no walk cycle. Only the town player steps.
- Dirt paths are stair-stepped. Shallow slopes show long horizontal runs; shorter equal steps were not drawn.
- The player has four facings. A diagonal pose was not drawn.
- Campfire Watch is one map, guardians have one upgrade, and play stops after five waves. Another map, a second upgrade, or an endless night were left out.
- Night Market Train stops at five hand-made levels. More levels were left out. A level editor, track switches, and a second train were left out.
- The arcade has three minigames. A fourth game was left out. Scores stay on this browser.
- The 64 look uses the same block models. Smaller parts become visible; no new shapes were added.
- `PixelPipeline` never uses a scale below 2. On a short, low-density window the 64 short-side target of 441 cannot be reached, so that screen shows a slightly different slice of town.
- The fox is a block quadruped. A second pass on the ears, the tail, and the sit crouch was not drawn.
- The fox or human form is not saved. A reload always starts as the fox.
- The three koi on the town pond are simple boxes. They do not use the collection patterns.
- If town, pond, or watch still feel plain, the next pass widens the jumps in those three lines. Another tempo bump was not the plan.
