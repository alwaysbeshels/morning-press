import type { Rng } from "./rng";
import { SUDOKU_SEEDS } from "./sudoku-seeds";
import type { SudokuGame } from "./types";

/** Ordre des lignes (ou colonnes) : bandes permutées, puis lignes permutées dans chaque bande. */
function lineOrder(rng: Rng): number[] {
  const order: number[] = [];
  for (const band of rng.shuffle([0, 1, 2])) {
    for (const offset of rng.shuffle([0, 1, 2])) order.push(band * 3 + offset);
  }
  return order;
}

/**
 * Applique des transformations qui préservent la validité et l’unicité :
 * renumérotation des chiffres, permutations de lignes/bandes et de colonnes/piles, transposition.
 */
export function transformSudoku(puzzle: string, solution: string, rng: Rng): { puzzle: string; solution: string } {
  const digits = ["0", ...rng.shuffle(["1", "2", "3", "4", "5", "6", "7", "8", "9"])];
  const rows = lineOrder(rng);
  const cols = lineOrder(rng);
  const transpose = rng.next() < 0.5;
  let outPuzzle = "";
  let outSolution = "";
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const sr = rows[r] as number;
      const sc = cols[c] as number;
      const source = transpose ? sc * 9 + sr : sr * 9 + sc;
      outPuzzle += digits[Number(puzzle[source])];
      outSolution += digits[Number(solution[source])];
    }
  }
  return { puzzle: outPuzzle, solution: outSolution };
}

export function generateSudoku(rng: Rng): SudokuGame {
  const seed = rng.pick(SUDOKU_SEEDS);
  const { puzzle, solution } = transformSudoku(seed.puzzle, seed.solution, rng);
  return { kind: "sudoku", puzzle, solution };
}
