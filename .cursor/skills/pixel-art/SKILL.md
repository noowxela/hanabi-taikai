---
name: pixel-art
description: >-
  Keeps hanabi-taikai pixel art intentional: one art-pixel size, the existing
  34-colour OKLab palette, integer scale, and forms that read at about 16
  pixels. Use when changing the pixel pipeline, palette, camera
  pixels-per-unit, meshes, canvas sprites, outlines, or when the user mentions
  pixel art, pixel scale, mixels, or jaggies.
---

# Pixel art

Every art pixel is placed on purpose. The engine keeps that placement: nearest sampling, integer scale, pixel-snapped camera. Research lives in [docs/ref/pixel_art_primer_en.md](../../../docs/ref/pixel_art_primer_en.md) (same text in [pixel_art_primer_zh.md](../../../docs/ref/pixel_art_primer_zh.md)). This file is the contract for this repo.

## Before a visual change

1. Read `src/render/pixelPipeline.ts`, `src/render/palette.ts`, and `src/render/cameraRig.ts`.
2. Name the art-pixel size you are designing for: low-res short side, integer `scale`, and that scene's `pixelsPerUnit`.

Done when those three numbers are stated and the change uses them.

## Engine contract

| Fact | Where |
| --- | --- |
| Short side ≈ 150 art pixels. `scale = max(2, round(min(drawW, drawH) / 150))`. Each art pixel is one `scale`×`scale` block of device pixels. | `pixelPipeline.ts` `TARGET_SHORT_SIDE` |
| Colour and depth render to that target. Post pass outlines, then snaps every pixel to the palette in OKLab. | `pixelPipeline.ts` |
| 34 sRGB colours. Darker swatches in a ramp stay more saturated; shift hue along the ramp (about 20° per step is the upper end). | `palette.ts` `PALETTE_HEX` |
| Camera snaps to the art-pixel grid. Pixels per world unit: town 11, watch 14, train and minigames 16, koi pond and arcade hall 18. | `cameraRig.ts`, scene constructors |
| 1 px depth outline. A pixel darker when it is farther than a 4-neighbour by more than 0.5 world units. Lines, sparks, and fireflies set `depthWrite: false` so they stay unoutlined. | `pixelPipeline.ts`, `materials.ts` |
| Flat palette bands. SDD 002 removed Bayer dither; large planes stayed noisy with it. | `docs/sdd/002-pixel-look-polish.md` |

A new colour is a new entry in `PALETTE_HEX`. `paletteSrgb` and `paletteOklab` derive from that list; keep them in sync by editing the list only.

Readable props are about one world unit tall, so 11–18 art pixels. Design silhouettes for that, the way 16 px tile art drops facial detail and keeps the outline. The koi collection is a separate 32×14 canvas in `src/ui/koiSprite.ts`, drawn at an integer multiple on screen.

## Drawing

**One size.** One art pixel is the same size across the frame. A prop that needs to be larger is redrawn at the scene `pixelsPerUnit`, which removes mixels (a pixel whose size disagrees with the rest of the picture).

**Grid.** Vertices and sprite pixels sit on the art-pixel grid. Turns are 90° via `CameraRig`. A free angle resamples the grid; draw another facing, or redraw after a RotSprite pass.

**Lines.** Diagonals use equal segment lengths (`2-2-2-2`). Curves change segment length in one direction (longest at the cardinals, shorter toward 45°). A 1 px stroke connects only at diagonal corners, so the line stays one pixel thick. Pixel-perfect stroke in Aseprite does this while drawing.

**Value first.** The form still reads in grayscale. Set one light direction before shading and keep it for the whole scene. Shade the volume: dark on the side away from the light, highlight on the facing planes. Bands of the same x or y that hug the outline expose the grid; break that alignment. Outlines add contrast. A selout changes outline colour by region (darker where the form is dark) so contrast stays even; it is a position-varying outline, not a second edge pass. This game's engine outline is the depth pass above; painted rims on meshes fight it.

**Sprites on changing backgrounds.** Anti-alias only inside the sprite. An outer edge blended toward one background colour fails on the next background.

**Motion.** At this resolution a walk is 6 frames (3 per leg) or 12 when the sprite is large enough to show the difference. A run is 4–8 frames. Start near 80 ms for an 8-frame cycle and 160 ms for a 4-frame cycle; both total 640 ms, so dropping frames means slowing each frame to keep the rhythm. Squash and stretch keep area: wider means shorter. Anticipate by squashing opposite the action first.

## Review

Before calling a picture change done:

- [ ] Low-res short side, `scale`, and `pixelsPerUnit` are unchanged, or the SDD records why they moved.
- [ ] Every on-screen colour is a `PALETTE_HEX` entry. New swatches extend that list.
- [ ] Player, buildings, and pickup props separate from the ground by value, with the 1 px depth outline.
- [ ] Thin props (fireflies, sparks) are 1 art pixel and do not write depth.
- [ ] Canvas sprites use one integer display scale. The koi sheet stays 32×14.
- [ ] `npm run check` passes. A changed scene has a browser screenshot at the low-res size, desktop and a 390×844 viewport when layout moved.
