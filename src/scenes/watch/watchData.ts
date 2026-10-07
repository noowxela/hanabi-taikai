export type GuardianId = 'firework' | 'taiko' | 'lantern';
export type SpiritId = 'small' | 'oni' | 'big' | 'boss';

export interface GuardianDef {
  id: GuardianId;
  name: string;
  blurb: string;
  cost: number;
  upgradeCost: number;
  range: number;
  /** Seconds between shots / pulses (0 = continuous aura). */
  interval: number;
  damage: number;
  /** Fraction of speed removed while inside the aura. */
  slow: number;
}

export const GUARDIANS: Record<GuardianId, GuardianDef> = {
  firework: {
    id: 'firework',
    name: '烟花筒',
    blurb: '单体射击，射程中等',
    cost: 3,
    upgradeCost: 5,
    range: 3.2,
    interval: 0.8,
    damage: 3,
    slow: 0,
  },
  taiko: {
    id: 'taiko',
    name: '太鼓',
    blurb: '咚！震伤周围所有妖怪',
    cost: 5,
    upgradeCost: 8,
    range: 2.2,
    interval: 1.6,
    damage: 4,
    slow: 0,
  },
  lantern: {
    id: 'lantern',
    name: '驱邪灯笼',
    blurb: '范围内妖怪减速一半，并持续灼伤',
    cost: 4,
    upgradeCost: 6,
    range: 2.6,
    interval: 0,
    damage: 1,
    slow: 0.5,
  },
};

export const UPGRADE_DAMAGE = 1.8;

export interface SpiritDef {
  id: SpiritId;
  hp: number;
  speed: number;
  embers: number;
  /** Campfire HP lost when it reaches the fire. */
  harm: number;
  size: number;
  cloak: number;
  mask: number;
}

export const SPIRITS: Record<SpiritId, SpiritDef> = {
  small: { id: 'small', hp: 3, speed: 1.6, embers: 1, harm: 1, size: 0.55, cloak: 0xb04f8a, mask: 0xf3e6c8 },
  oni: { id: 'oni', hp: 11, speed: 1.0, embers: 2, harm: 1, size: 0.75, cloak: 0xc23a30, mask: 0xffcf5c },
  big: { id: 'big', hp: 55, speed: 0.6, embers: 4, harm: 2, size: 1.05, cloak: 0x24707a, mask: 0xf3e6c8 },
  boss: { id: 'boss', hp: 220, speed: 0.45, embers: 10, harm: 4, size: 1.45, cloak: 0x5c2c6b, mask: 0xffcf5c },
};

/** Each wave is a spawn order; groups are interleaved so waves feel mixed. */
export const WAVES: SpiritId[][] = [
  [...Array<SpiritId>(6).fill('small')],
  interleave(['oni', 5], ['small', 4]),
  interleave(['oni', 8], ['big', 2]),
  interleave(['small', 10], ['oni', 6], ['big', 3]),
  [...interleave(['oni', 8], ['big', 4]), 'boss'],
];

function interleave(...groups: [SpiritId, number][]): SpiritId[] {
  const left = groups.map(([, n]) => n);
  const out: SpiritId[] = [];
  while (left.some((n) => n > 0)) {
    groups.forEach(([id], i) => {
      if (left[i] > 0) {
        out.push(id);
        left[i]--;
      }
    });
  }
  return out;
}

export const START_EMBERS = 8;
export const FIRE_HP = 10;

export function waveBonus(wave: number): number {
  return 2 + wave;
}

export function starsForHp(hp: number): number {
  if (hp >= 8) return 3;
  if (hp >= 4) return 2;
  return 1;
}

/** Path the spirits walk, from the forest edge to the campfire. (x, z) */
export const PATH: [number, number][] = [
  [-10, -3.5],
  [-4.5, -3.5],
  [-4.5, 2.5],
  [0.5, 2.5],
  [0.5, -2],
  [4.5, -2],
  [4.5, 3.6],
];

export const CAMPFIRE: [number, number] = [4.5, 4.3];

export const PADS: [number, number][] = [
  [-7, -5.5],
  [-6.5, -1.5],
  [-2.5, -1],
  [-1.5, 0.5],
  [-2.5, 4.5],
  [2.5, 0.5],
  [2.5, -4],
  [6.5, 0.5],
];
