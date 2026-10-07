import { finiteOr, isRecord, loadJson, saveJson } from '../save';

export interface KoiSpot {
  /** -1..1 across the back. */
  x: number;
  /** -1 (tail) .. 1 (head). */
  z: number;
  size: number;
  color: number;
}

export interface KoiPattern {
  id: string;
  name: string;
  english: string;
  unlockAt: number;
  base: number;
  fin: number;
  spots: KoiSpot[];
}

const WHITE = 0xf3e6c8;
const RED = 0xc23a30;
const ORANGE = 0xe8642c;
const BLACK = 0x0f1430;

export const KOI_PATTERNS: KoiPattern[] = [
  {
    id: 'kohaku',
    name: '红白',
    english: 'Kohaku',
    unlockAt: 0,
    base: WHITE,
    fin: WHITE,
    spots: [
      { x: 0, z: 0.6, size: 0.5, color: RED },
      { x: 0.3, z: 0.05, size: 0.45, color: RED },
      { x: -0.25, z: -0.45, size: 0.4, color: RED },
    ],
  },
  {
    id: 'tancho',
    name: '丹顶',
    english: 'Tancho',
    unlockAt: 6,
    base: WHITE,
    fin: WHITE,
    spots: [{ x: 0, z: 0.7, size: 0.42, color: RED }],
  },
  {
    id: 'sanke',
    name: '大正三色',
    english: 'Sanke',
    unlockAt: 15,
    base: WHITE,
    fin: WHITE,
    spots: [
      { x: 0, z: 0.55, size: 0.5, color: RED },
      { x: -0.3, z: 0, size: 0.4, color: RED },
      { x: 0.35, z: -0.1, size: 0.22, color: BLACK },
      { x: -0.1, z: -0.5, size: 0.24, color: BLACK },
    ],
  },
  {
    id: 'showa',
    name: '昭和三色',
    english: 'Showa',
    unlockAt: 28,
    base: BLACK,
    fin: BLACK,
    spots: [
      { x: 0, z: 0.5, size: 0.5, color: RED },
      { x: 0.3, z: -0.15, size: 0.38, color: WHITE },
      { x: -0.25, z: -0.5, size: 0.36, color: RED },
    ],
  },
  {
    id: 'asagi',
    name: '浅黄',
    english: 'Asagi',
    unlockAt: 45,
    base: 0x5f78ad,
    fin: ORANGE,
    spots: [
      { x: 0.55, z: 0.2, size: 0.3, color: ORANGE },
      { x: -0.55, z: 0.2, size: 0.3, color: ORANGE },
    ],
  },
  {
    id: 'ogon',
    name: '黄金',
    english: 'Ogon',
    unlockAt: 65,
    base: 0xffcf5c,
    fin: 0xffcf5c,
    spots: [],
  },
  {
    id: 'kujaku',
    name: '孔雀',
    english: 'Kujaku',
    unlockAt: 90,
    base: 0x4fa8a4,
    fin: WHITE,
    spots: [
      { x: 0, z: 0.5, size: 0.42, color: ORANGE },
      { x: 0.25, z: -0.2, size: 0.36, color: ORANGE },
    ],
  },
  {
    id: 'ginrin',
    name: '银鳞',
    english: 'Ginrin',
    unlockAt: 120,
    base: 0xaab0c4,
    fin: 0xffffff,
    spots: [
      { x: 0, z: 0.45, size: 0.44, color: RED },
      { x: -0.3, z: -0.3, size: 0.32, color: RED },
    ],
  },
];

const SAVE_KEY = 'koi.v1';

export interface KoiSave {
  eaten: number;
}

export function loadKoiSave(): KoiSave {
  const save = loadJson(SAVE_KEY, null, isRecord);
  return { eaten: Math.max(0, Math.floor(finiteOr(save?.eaten, 0))) };
}

export function saveKoiSave(save: KoiSave): void {
  saveJson(SAVE_KEY, save);
}

export function unlockedPatterns(eaten: number): KoiPattern[] {
  return KOI_PATTERNS.filter((p) => eaten >= p.unlockAt);
}

export function nextPattern(eaten: number): KoiPattern | undefined {
  return KOI_PATTERNS.find((p) => eaten < p.unlockAt);
}
