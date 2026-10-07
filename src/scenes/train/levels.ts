// Pure puzzle rules for the Night Market Train. No imports so the dev solver
// (scripts/solve-train.ts) can load this file with `node --experimental-strip-types`.

export type Dir = 0 | 1 | 2 | 3;
export const N: Dir = 0;
export const E: Dir = 1;
export const S: Dir = 2;
export const W: Dir = 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

export function opposite(d: Dir): Dir {
  return ((d + 2) % 4) as Dir;
}

/** Index 0 means "no piece". Every other piece joins two tile sides. */
export const PIECES: readonly (readonly [Dir, Dir] | null)[] = [null, [E, W], [N, S], [N, E], [S, E], [S, W], [N, W]];

/** Piece index joining sides `a` and `b`. */
export function pieceJoining(a: Dir, b: Dir): number {
  return PIECES.findIndex((p) => p !== null && p.includes(a) && p.includes(b));
}

/** Side the train leaves by after entering `piece` from side `enter`, or null if it derails. */
export function exitSide(piece: number, enter: Dir): Dir | null {
  const sides = PIECES[piece];
  if (!sides) return null;
  if (sides[0] === enter) return sides[1];
  if (sides[1] === enter) return sides[0];
  return null;
}

export interface LevelDef {
  name: string;
  /**
   * Top row is the far side of the board.
   * `.` grass · `#` stall · `T` tree · `L` lantern pole · `S` station · `G` market gate
   * `P` passenger · `-` / `|` fixed track.
   */
  rows: string[];
  /** Side of the station the train leaves by. */
  startDir: Dir;
  /** Side of the market gate the train must enter from. */
  goalDir: Dir;
  /** Fewest pieces needed (checked by scripts/solve-train.ts). */
  par: number;
}

export const LEVELS: LevelDef[] = [
  {
    name: '第一班车',
    rows: [
      'T...L',
      'S.P.G',
      '.L..T',
    ],
    startDir: E,
    goalDir: W,
    par: 3,
  },
  {
    name: '绕过摊位',
    rows: [
      'S..P.',
      '##L..',
      '.....',
      'G.T..',
    ],
    startDir: E,
    goalDir: N,
    par: 8,
  },
  {
    name: '两位客人',
    rows: [
      'S.P..T',
      '....P.',
      'L#....',
      'T##..G',
    ],
    startDir: E,
    goalDir: W,
    par: 7,
  },
  {
    name: '旧轨道',
    rows: [
      'T.#...',
      'S.-.P.',
      '..#.#.',
      '.P....',
      'L..#.G',
    ],
    startDir: E,
    goalDir: N,
    par: 11,
  },
  {
    name: '夜市终点站',
    rows: [
      'TP..#.T',
      '..L|..G',
      'S.#.#.L',
      '.T.P.P.',
      'L.....T',
    ],
    startDir: E,
    goalDir: W,
    par: 11,
  },
];

export type Tile = 'grass' | 'blocked' | 'start' | 'goal' | 'passenger' | 'fixed';

export interface Board {
  width: number;
  height: number;
  tiles: Tile[];
  /** Raw map character per tile, for picking props. */
  chars: string[];
  start: number;
  goal: number;
  startDir: Dir;
  goalDir: Dir;
  passengers: number[];
  fixed: Map<number, number>;
}

export function parseLevel(def: LevelDef): Board {
  const height = def.rows.length;
  const width = def.rows[0].length;
  const tiles: Tile[] = [];
  const chars: string[] = [];
  const passengers: number[] = [];
  const fixed = new Map<number, number>();
  let start = -1;
  let goal = -1;
  def.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${def.name}: row ${y} has width ${row.length}`);
    [...row].forEach((c, x) => {
      const i = y * width + x;
      chars.push(c);
      if (c === '.') tiles.push('grass');
      else if (c === 'S') {
        tiles.push('start');
        start = i;
      } else if (c === 'G') {
        tiles.push('goal');
        goal = i;
      } else if (c === 'P') {
        tiles.push('passenger');
        passengers.push(i);
      } else if (c === '-' || c === '|') {
        tiles.push('fixed');
        fixed.set(i, c === '-' ? 1 : 2);
      } else tiles.push('blocked');
    });
  });
  if (start < 0 || goal < 0) throw new Error(`${def.name}: needs S and G`);
  return { width, height, tiles, chars, start, goal, startDir: def.startDir, goalDir: def.goalDir, passengers, fixed };
}

/** Whether the player may place a piece on this tile. */
export function buildable(board: Board, i: number): boolean {
  return board.tiles[i] === 'grass' || board.tiles[i] === 'passenger';
}

export interface Step {
  tile: number;
  enter: Dir;
  exit: Dir;
}

export type Outcome = 'clear' | 'derail' | 'missing' | 'wrongSide' | 'loop';

export interface RunResult {
  /** Track tiles the train passes, in order (excludes station and gate). */
  steps: Step[];
  outcome: Outcome;
  /** Grid cell where the run ended (the gate, or where it derailed; may be off the board). */
  endX: number;
  endY: number;
  /** Direction the train was moving when it reached the end cell. */
  endDir: Dir;
  boarded: number[];
}

export function simulate(board: Board, pieces: readonly number[]): RunResult {
  const { width, height } = board;
  let x = board.start % width;
  let y = Math.floor(board.start / width);
  let dir = board.startDir;
  const steps: Step[] = [];
  const boarded: number[] = [];
  const end = (outcome: Outcome, ex: number, ey: number): RunResult => ({
    steps,
    outcome,
    endX: ex,
    endY: ey,
    endDir: dir,
    boarded,
  });
  const seen = new Set<number>();
  for (;;) {
    const nx = x + DX[dir];
    const ny = y + DY[dir];
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return end('derail', nx, ny);
    const i = ny * width + nx;
    const enter = opposite(dir);
    if (seen.has(i * 4 + enter)) return end('loop', nx, ny);
    seen.add(i * 4 + enter);
    if (i === board.goal) {
      if (enter !== board.goalDir) return end('wrongSide', nx, ny);
      return end(boarded.length === board.passengers.length ? 'clear' : 'missing', nx, ny);
    }
    const piece = board.fixed.get(i) ?? (buildable(board, i) ? pieces[i] : 0);
    const exit = exitSide(piece, enter);
    if (exit === null) return end('derail', nx, ny);
    steps.push({ tile: i, enter, exit });
    if (board.tiles[i] === 'passenger' && !boarded.includes(i)) boarded.push(i);
    x = nx;
    y = ny;
    dir = exit;
  }
}

export function starsFor(used: number, par: number): number {
  if (used <= par) return 3;
  if (used <= par + 2) return 2;
  return 1;
}

export function budgetFor(def: LevelDef): number {
  return def.par + 4;
}
