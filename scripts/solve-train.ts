// Dev check: every train level is solvable, and its `par` is the true minimum.
// Run: node --experimental-strip-types scripts/solve-train.ts
import {
  DX,
  DY,
  LEVELS,
  buildable,
  exitSide,
  opposite,
  parseLevel,
  pieceJoining,
  simulate,
  type Board,
  type Dir,
} from '../src/scenes/train/levels.ts';

function solve(board: Board): number[] | null {
  const { width, height } = board;
  let best: number[] | null = null;
  const pieces: number[] = new Array(width * height).fill(0);
  const onPath = new Set<number>();

  const walk = (x: number, y: number, dir: Dir, used: number, seen: number): void => {
    const nx = x + DX[dir];
    const ny = y + DY[dir];
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
    const i = ny * width + nx;
    const enter = opposite(dir);
    if (i === board.goal) {
      if (enter === board.goalDir && seen === board.passengers.length && (!best || used < count(best))) {
        best = [...pieces];
      }
      return;
    }
    if (onPath.has(i)) return;
    if (best && used >= count(best)) return;
    const fixed = board.fixed.get(i);
    if (fixed !== undefined) {
      const exit = exitSide(fixed, enter);
      if (exit === null) return;
      onPath.add(i);
      walk(nx, ny, exit, used, seen);
      onPath.delete(i);
      return;
    }
    if (!buildable(board, i)) return;
    const extra = board.tiles[i] === 'passenger' ? 1 : 0;
    onPath.add(i);
    for (const exit of [0, 1, 2, 3] as Dir[]) {
      if (exit === enter) continue;
      pieces[i] = pieceJoining(enter, exit);
      walk(nx, ny, exit, used + 1, seen + extra);
    }
    pieces[i] = 0;
    onPath.delete(i);
  };

  const count = (p: number[]) => p.filter((v) => v > 0).length;
  walk(board.start % width, Math.floor(board.start / width), board.startDir, 0, 0);
  return best;
}

let ok = true;
for (const [n, def] of LEVELS.entries()) {
  const board = parseLevel(def);
  const solution = solve(board);
  if (!solution) {
    console.log(`L${n + 1} ${def.name}: UNSOLVABLE`);
    ok = false;
    continue;
  }
  const used = solution.filter((v) => v > 0).length;
  const run = simulate(board, solution);
  const glyph = ['·', '─', '│', '└', '┌', '┐', '┘'];
  const picture = def.rows
    .map((row, y) =>
      [...row].map((c, x) => (solution[y * board.width + x] ? glyph[solution[y * board.width + x]] : c)).join(''),
    )
    .join('\n  ');
  const match = used === def.par && run.outcome === 'clear';
  if (!match) ok = false;
  console.log(`L${n + 1} ${def.name}: min ${used}, par ${def.par}, sim ${run.outcome} ${match ? 'OK' : 'MISMATCH'}\n  ${picture}`);
}
process.exit(ok ? 0 : 1);
