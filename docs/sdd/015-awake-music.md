# SDD: Wake the slow music

- **Repo:** `01_project/o000o_active/hanabi-taikai`
- **Status:** `implemented`
- **Date:** 2026-10-07
- **Related:** [009-sound.md](009-sound.md), [architecture.md](../architecture.md)

## 1. Context / current architecture

Music is five generated loops in `src/audio/loops.ts`, played by `schedule` in `src/audio/audio.ts`. Each loop is 32 beats of minor pentatonic. The melody is a triangle wave held for 85% of the beat. A quiet square bass hits beats 1 and 3 of each bar. There are no drums.

| Loop | BPM | Where |
| --- | --- | --- |
| town | 72 | Town |
| pond | 60, many rests | 锦鲤池 |
| watch | 80 | 守夜塔 |
| train | 104 | 夜市火车站 |
| arcade | 128 | 掌机仔街机厅 and its three games |

Footsteps, clicks, and the other effects are separate short blips. Mute still lives in `hanabi-taikai.audio.v1`.

## 2. Problem and non-goals

**Problem:** the town, pond, and watch tunes feel sleepy. The tempo is slow, the notes ring into each other, and the lines themselves sit low and fall at the end of each phrase.

**Non-goals:**

- No audio files, and no new scale. The new lines stay on C D E G A.
- Train (104) and arcade (128) keep their tempos. They already move.
- Effects (step, click, feed, depart, hit, score) stay as they are.
- Mute, the crossfade, and the unlock-on-first-gesture behaviour stay.

## 3. Questions asked and answers

| Question | Answer |
| --- | --- |
| Which music? | The three slow loops: town, pond, and watch. Not the effects, and not the train or arcade tempos. |
| Rhythm only? | No. The tunes are sleepy too. Those three melodies are rewritten. |

## 4. Proposed approach, pros / cons, rejected alternatives

**Approach:**

Raise only the slow tempos, and shorten every melody note so it does not smear. Add a quiet tick on each beat so the pulse is obvious.

| Loop | BPM now | BPM |
| --- | --- | --- |
| town | 72 | 108 |
| pond | 60 | 96 |
| watch | 80 | 108 |

- Melody length goes from `beat * 0.85` to `beat * 0.45`, still a triangle. Town, pond, and watch get new 32-beat lines on the same C D E G A set. They live around MIDI 72–84 (C5–C6), jump up, and end the phrase on a high note instead of sinking toward MIDI 60. Pond keeps one rest per bar so it can breathe, and those rests replace the long empty stretches it has now. Watch’s bass root moves from `33` to `45` so the drone is not sub-bass. Train and arcade keep their current note lists.
- A very short square blip, MIDI 90-something, peak about `0.03`, on every beat of every loop, including train and arcade. It is a metronome tick, not a new drum kit. One code path in `schedule`, so the faster town does not need its own player.
- Town and pond bass stay on beats 1 and 3.

**Pros:** pace and contour both wake up. The arrays are still 32 beats, so they loop the same way.

**Cons / risks:**

- 108 is a walk, not a chase. A brighter line at that tempo can still feel plain if the jumps are too even.
- The tick is on the arcade loop too. At 128 it is a light hat, and it can feel busy if the peak is higher than about 0.03.
- A song already playing does not change until the scene crossfades or the page reloads, because the current copy was scheduled from the old loop.

**Rejected alternatives:**

| Alternative | Why not |
| --- | --- |
| Keep the old notes and only raise the tempo | The lines sit low and fall. Faster does not fix that. |
| Speed up train and arcade by the same ratio | 104 and 128 are already awake. Arcade at ~190 would be frantic. |
| Change the triangle to a bright square lead | Louder and harsher than a festival walk needs. The new contour and the tick carry it. |

## 5. Acceptance criteria and verification

- [x] Town plays at 108, pond at 96, watch at 108. Train stays 104. Arcade stays 128.
- [x] Town, pond, and watch use the higher, upward lines. Melody notes are shorter than the beat. A quiet tick sounds on each beat.
- [x] Click, step, feed, and mute still behave as before.
- [x] `npm run check` passes.
- [ ] Verify by ear in the browser: town, then the koi pond, and confirm the arcade did not jump in speed.

`npm run check` passed. Importing `LOOPS` confirmed town 108 / bass 45, pond 96 / bass 50 with 8 rests (one per bar), watch 108 / bass 45, train 104, arcade 128. Town, pond, and watch notes are only C D E G A in MIDI 72–84. On http://localhost:5173/ the first click started a running `AudioContext` on the town loop and scheduled 80 notes, which is one copy: 32 melody notes, 32 ticks, and 16 bass hits. `go('pond')` then `go('arcade')` set the wanted loop to pond, then arcade. Effects and mute were not re-tested; `schedule` is the only change in `audio.ts`, and the effect methods were not edited. This browser session cannot hear the speakers, so the ear check is still open.

## 6. Status history

| Date | Status | Note |
| --- | --- | --- |
| 2026-10-07 | draft | Lift town, pond, and watch off lullaby tempos; shorter notes and a beat tick |
| 2026-10-07 | draft | Tunes are sleepy too: rewrite those three lines so they sit higher and rise |
| 2026-10-07 | approved | Rhythm and the three slow tunes both change |
| 2026-10-07 | implemented | Tempos, lines, shorter notes, and the beat tick. Ear check still open |
