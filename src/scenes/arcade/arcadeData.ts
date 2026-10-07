import { finiteOr, isRecord, loadJson, saveJson } from '../../save';

export type ArcadeGame = 'slide' | 'keys' | 'catch';

export interface ArcadeGameInfo {
  id: ArcadeGame;
  name: string;
  blurb: string;
  hint: { desktop: string; touch: string };
  screen: number;
}

export const ARCADE_GAMES: ArcadeGameInfo[] = [
  {
    id: 'slide',
    name: '企鹅滑冰',
    blurb: '左右换道，躲开雪堆，吃到小鱼',
    hint: { desktop: '← → 或 A/D 换道 · Esc 返回', touch: '摇杆左右换道' },
    screen: 0x9adbc8,
  },
  {
    id: 'keys',
    name: '快打键',
    blurb: '看到箭头就按同方向，连击越多分越高',
    hint: { desktop: '↑↓←→ 或 WASD · Esc 返回', touch: '按方向键' },
    screen: 0xffcf5c,
  },
  {
    id: 'catch',
    name: '接灯笼',
    blurb: '接住灯笼，金灯笼 +5，别接哑炮 −3',
    hint: { desktop: '← → 或 A/D 移动篮子 · Esc 返回', touch: '摇杆移动篮子' },
    screen: 0xe8642c,
  },
];

export const ROUND_SECONDS = 30;

const SAVE_KEY = 'arcade.v1';

export type HighScores = Record<ArcadeGame, number>;

export function loadHighScores(): HighScores {
  const raw = loadJson(SAVE_KEY, null, isRecord);
  const high = isRecord(raw?.high) ? raw.high : {};
  const read = (k: ArcadeGame) => Math.max(0, Math.floor(finiteOr(high[k], 0)));
  return { slide: read('slide'), keys: read('keys'), catch: read('catch') };
}

/** Records a score; returns true if it is a new high score. */
export function recordScore(game: ArcadeGame, score: number): boolean {
  const high = loadHighScores();
  if (score <= high[game]) return false;
  high[game] = score;
  saveJson(SAVE_KEY, { high });
  return true;
}
