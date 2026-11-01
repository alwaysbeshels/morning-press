import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { generateSudoku, transformSudoku } from "./sudoku";
import { SUDOKU_SEEDS } from "./sudoku-seeds";

const PEERS: number[][] = [];
for (let i = 0; i < 81; i++) {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const peers = new Set<number>();
  for (let k = 0; k < 9; k++) {
    peers.add(r * 9 + k);
    peers.add(k * 9 + c);
  }
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) peers.add((br + dr) * 9 + bc + dc);
  peers.delete(i);
  PEERS.push([...peers]);
}

function candidates(grid: number[], i: number): number {
  let mask = 0x3fe;
  for (const p of PEERS[i] as number[]) mask &= ~(1 << (grid[p] as number));
  return mask & 0x3fe;
}

/** Compte les solutions (jusqu’à `limit`) par retour arrière avec heuristique MRV. */
function countSolutions(grid: number[], limit = 2): number {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const mask = candidates(grid, i);
    let count = 0;
    for (let m = mask; m; m &= m - 1) count++;
    if (count === 0) return 0;
    if (count < bestCount) {
      bestCount = count;
      best = i;
      bestMask = mask;
    }
  }
  if (best < 0) return 1;
  let total = 0;
  for (let d = 1; d <= 9 && total < limit; d++) {
    if (!(bestMask & (1 << d))) continue;
    grid[best] = d;
    total += countSolutions(grid, limit - total);
    grid[best] = 0;
  }
  return total;
}

function isValidSolution(solution: string): boolean {
  if (!/^[1-9]{81}$/.test(solution)) return false;
  const grid = [...solution].map(Number);
  return grid.every((digit, i) => (PEERS[i] as number[]).every((p) => grid[p] !== digit));
}

function expectGoodPuzzle(puzzle: string, solution: string): void {
  expect(puzzle).toMatch(/^[0-9]{81}$/);
  expect(isValidSolution(solution)).toBe(true);
  const givens = [...puzzle].filter((d) => d !== "0").length;
  expect(givens).toBeGreaterThanOrEqual(26);
  expect(givens).toBeLessThanOrEqual(32);
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== "0") expect(puzzle[i]).toBe(solution[i]);
  }
  expect(countSolutions([...puzzle].map(Number))).toBe(1);
}

describe("sudoku", () => {
  it("embarque au moins 24 grilles de départ", () => {
    expect(SUDOKU_SEEDS.length).toBeGreaterThanOrEqual(24);
  });

  it.each(SUDOKU_SEEDS.map((seed, i) => [i, seed] as const))(
    "grille de départ %i : cohérente, valide et à solution unique",
    (_, seed) => {
      expectGoodPuzzle(seed.puzzle, seed.solution);
    },
  );

  it("les transformations préservent validité, cohérence et unicité", () => {
    const rng = createRng("transformations");
    for (const seed of SUDOKU_SEEDS) {
      for (let k = 0; k < 3; k++) {
        const out = transformSudoku(seed.puzzle, seed.solution, rng);
        expectGoodPuzzle(out.puzzle, out.solution);
      }
    }
  });

  it("produit des grilles variées", () => {
    const puzzles = new Set<string>();
    for (let i = 0; i < 40; i++) puzzles.add(generateSudoku(createRng(`variété-${i}`)).puzzle);
    expect(puzzles.size).toBe(40);
  });
});
