# SDD: Looping music and key sound effects

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-06
- **Related:** [architecture.md](../architecture.md), [001-campfire-town-mvp.md](001-campfire-town-mvp.md)

## 1. Context / current architecture

The game is silent. SDD 001 listed audio as a non-goal. There is no `AudioContext`, no audio files, and no audio dependency. `main.ts` switches scenes with `go(id)` and a short fade. Each scene's `enter()` calls `overlay.setHud`. The town walk is six held poses in `src/world/player.ts`. Feeds, departures, hits, and score changes already have one function each (`KoiPondScene.feedAt`, `TrainScene.depart`, the watch damage path, `Minigame` score updates).

Browsers block audio until the first click or key press.

## 2. Problem and non-goals

**Problem:** the town and its locations have no music and no feedback sounds.

**Non-goals:**

- No audio files, no sample libraries, and no new npm dependency.
- No voice, no recorded instruments, and no music copied from an existing game.
- No sound on every UI tick (toasts, HUD number changes, camera rotate).
- The three arcade minigames do not each get their own song. They share the arcade loop.
- Quick Keys and the hall stay without a new directional light; this SDD does not touch rendering.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| How far should the audio go? | A looping tune per location, plus key effects: walk, click, feed, depart, watch hit, arcade score. |
| Where does the sound come from? | "A, need some loopable music": generate it in the browser, and each tune must loop. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

A small Web Audio synth in `src/audio/`. No samples. Notes are scheduled on `AudioContext.currentTime` so a loop joins itself with no gap and no overlap click.

1. **Unlock.** The context is created on the first `pointerdown` or `keydown`. Until then the game stays silent. A HUD button, present on every scene, shows 声音 / 静音 and writes `hanabi-taikai.audio.v1 { muted }`. Mute ducks the master gain to 0 without destroying the context, so unmuting does not wait for another gesture.
2. **Five loops.** `go(id)` crossfades the music over the existing scene fade.

| Scene | Loop | Feel |
| --- | --- | --- |
| town | town | Slow night-festival pulse |
| pond | pond | Sparser, same scale, slower |
| train | train | Steady even pulse, like a small engine |
| watch | watch | Lower and tighter |
| arcade, slide, keys, catch | arcade | Brighter and faster |

Each loop is 8 bars of 4/4, written as note numbers in a minor pentatonic scale, played by a square or triangle wave with a short envelope. The next copy is scheduled before the current one ends, so it loops for as long as that scene stays current.

3. **Effects**, each one shot, quieter than the music is not — effects sit above the music and do not restart the loop:

| Event | Where |
| --- | --- |
| Footstep | Town player, once per walk cycle when the contact pose starts. Standing still is silent. |
| Click | HUD buttons, the action button, and panel buttons in `overlay.ts`. |
| Feed | `feedAt` when it accepts a pellet. |
| Depart | `TrainScene.depart` when a run actually starts. |
| Watch hit | A spirit loses HP from a taiko pulse or a firework landing. A lantern aura deals damage every frame, so that ping is limited to one sound every 0.45 s. |
| Arcade score | Score goes up in a minigame (fish, key hit, lantern). A miss or a penalty does not use this sound. |

**Pros:** nothing to license or download; loops are gapless because they are scheduled, not restarted from a file; mute survives reload; the scene map already knows which place is current.

**Cons / risks:**

- A few oscillators will sound like a toy keyboard, not a recorded band.
- The first second after load is silent until the player clicks or presses a key.
- Footsteps on every frame would chatter. Tying them to the contact pose keeps one step per cycle (about every 640 ms).
- Scheduling the next loop from a timer that drifts will click. The clock has to be `AudioContext.currentTime`, not `setInterval`.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| mp3 / ogg files | The choice was to generate the music, and the loops have to be seamless. |
| Tone.js or Howler | A handful of oscillators does not need a library. |
| One song for the whole game | Each location was asked for its own loop. |
| A unique song for each minigame | The arcade is one location. Three extra tunes would blur that. |

## 5. Acceptance criteria and verification

- [x] Before any click or key, the page is silent. The first gesture starts the town loop, and it repeats without a gap for at least two cycles.
- [x] Entering the pond, train, watch, and arcade each swaps to that location's loop. Ice Slide, Quick Keys, and Lantern Catch keep the arcade loop. Returning to town restores the town loop.
- [x] 静音 stops music and effects; 声音 brings them back; the choice survives reload.
- [x] A footstep plays once per walk cycle and stops when the player stands. A successful feed, a real departure, a spirit hit, and an arcade score-up each play once. A failed feed and a score penalty do not.
- [x] HUD and panel clicks make the click sound.
- [x] `npm run check` passes. In the browser, listen through one loop change and one of each effect. No new console errors.

Verified on http://localhost:5197 (2026-10-06). `npm run check` passed. Before a gesture: `unlocked` false, `noteCount` 0. The first click on 静音 created the context, scheduled 48 notes, and `nextAt - startedAt` equalled the town duration (26.666… s at 72 bpm). `fillUntil` one duration further returned two start times separated by that same duration. `go` then reported pond/KoiPondScene, train/TrainScene, watch/WatchScene, slide/IceSlide (arcade), keys/QuickKeys (arcade), catch/LanternCatch (arcade), arcade/ArcadeHall, town/TownScene. Location saves were unchanged. Calling step, click, feed, depart, hit, and score raised `effectCount` by 9 (feed, depart, and score are two blips each). Holding W for 0.7 s raised it by 2, one contact per 640 ms cycle. The mute button click raised it by 1, wrote `hanabi-taikai.audio.v1` `{ muted: true }`, and the label became 声音. After reload, before any gesture, the label was still 声音 and `muted` was true. Clicking 声音 restored `{ muted: false }` and the label 静音. A panel 关闭 click raised `effectCount` by 1 and closed the panel. At 390×844 with the touch HUD class, ⟲, ⟳, and 静音 all sat inside the viewport. No Vite error overlay. The browser tools cannot play the audio back, so the tones themselves were not heard.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-06 | draft | Five generated loops plus the six named effects |
| 2026-10-06 | approved | User said approve |
| 2026-10-06 | implemented | Generated loops and the six effects; browser checks above |
