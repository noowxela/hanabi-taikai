export type LoopId = 'town' | 'pond' | 'train' | 'watch' | 'arcade';

/** C D E G A, one MIDI note per beat. 0 is a rest. 8 bars of 4/4. */
export interface LoopDef {
  bpm: number;
  /** Low root for the pulse. */
  bass: number;
  melody: number[];
}

export const LOOPS: Record<LoopId, LoopDef> = {
  town: {
    bpm: 108,
    bass: 45,
    melody: [
      76, 79, 76, 84, 79, 76, 74, 76, 72, 76, 79, 76, 81, 79, 76, 72, 76, 79, 76, 84, 79, 76, 74, 76, 74, 76, 79, 84,
      81, 79, 76, 84,
    ],
  },
  pond: {
    bpm: 96,
    bass: 50,
    melody: [
      76, 79, 84, 0, 79, 76, 81, 0, 76, 74, 79, 0, 84, 81, 76, 0, 72, 76, 79, 0, 81, 79, 76, 0, 74, 76, 84, 0, 79, 76,
      84, 0,
    ],
  },
  train: {
    bpm: 104,
    bass: 40,
    melody: [
      64, 64, 67, 64, 60, 64, 67, 69, 72, 67, 64, 60, 64, 67, 69, 67, 64, 60, 64, 67, 72, 69, 67, 64, 60, 64, 67, 64,
      60, 57, 60, 64,
    ],
  },
  watch: {
    bpm: 108,
    bass: 45,
    melody: [
      72, 76, 79, 76, 74, 76, 79, 81, 76, 79, 76, 72, 76, 79, 81, 84, 79, 76, 74, 76, 72, 76, 79, 76, 74, 72, 76, 79,
      81, 79, 76, 84,
    ],
  },
  arcade: {
    bpm: 128,
    bass: 52,
    melody: [
      76, 79, 76, 74, 72, 76, 79, 81, 84, 81, 79, 76, 74, 76, 79, 76, 72, 76, 79, 76, 74, 72, 69, 72, 76, 74, 72, 76,
      79, 76, 74, 72,
    ],
  },
};

export const LOOP_BEATS = 32;

export function loopSeconds(bpm: number): number {
  return (LOOP_BEATS * 60) / bpm;
}

for (const def of Object.values(LOOPS)) {
  if (def.melody.length !== LOOP_BEATS) throw new Error(`loop melody must be ${LOOP_BEATS} beats`);
}
