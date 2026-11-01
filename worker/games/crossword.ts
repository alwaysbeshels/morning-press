import { buildLayout, prepareWords, type LayoutOptions, type PreparedWords } from "./layout";
import type { Rng } from "./rng";
import type { CrosswordEntry, CrosswordGame, WordEntry } from "./types";

export const CROSSWORD_OPTIONS: LayoutOptions = {
  minWords: 10,
  maxWords: 14,
  maxSize: 13,
  attempts: 3,
  scan: 40,
  pool: 8,
  anchorLength: 7,
  goodCrossings: 16,
};

const prepared = new WeakMap<readonly WordEntry[], PreparedWords>();

export function prepareBank(bank: readonly WordEntry[]): PreparedWords {
  let cached = prepared.get(bank);
  if (!cached) {
    cached = prepareWords(bank.map((entry) => entry.word));
    prepared.set(bank, cached);
  }
  return cached;
}

/** Numérotation standard : de haut en bas, de gauche à droite, au début de chaque mot. */
export function numberGrid(solution: (string | null)[][]): (number | null)[][] {
  const height = solution.length;
  const width = height > 0 ? (solution[0] as (string | null)[]).length : 0;
  const filled = (r: number, c: number): boolean =>
    r >= 0 && r < height && c >= 0 && c < width && (solution[r] as (string | null)[])[c] !== null;
  let next = 1;
  return solution.map((row, r) =>
    row.map((_, c) => {
      if (!filled(r, c)) return null;
      const startsAcross = !filled(r, c - 1) && filled(r, c + 1);
      const startsDown = !filled(r - 1, c) && filled(r + 1, c);
      return startsAcross || startsDown ? next++ : null;
    }),
  );
}

export function generateCrossword(rng: Rng, bank: readonly WordEntry[]): CrosswordGame {
  const layout = buildLayout(prepareBank(bank), rng, CROSSWORD_OPTIONS);
  const solution: (string | null)[][] = [];
  for (let r = 0; r < layout.height; r++) solution.push(new Array<string | null>(layout.width).fill(null));
  for (const placed of layout.words) {
    for (let i = 0; i < placed.word.length; i++) {
      const r = placed.across ? placed.row : placed.row + i;
      const c = placed.across ? placed.col + i : placed.col;
      (solution[r] as (string | null)[])[c] = placed.word[i] as string;
    }
  }
  const numbers = numberGrid(solution);
  const across: CrosswordEntry[] = [];
  const down: CrosswordEntry[] = [];
  for (const placed of layout.words) {
    const entry: CrosswordEntry = {
      number: (numbers[placed.row] as (number | null)[])[placed.col] as number,
      clue: (bank[placed.index] as WordEntry).clue,
      answer: placed.word,
      row: placed.row,
      col: placed.col,
    };
    (placed.across ? across : down).push(entry);
  }
  across.sort((a, b) => a.number - b.number);
  down.sort((a, b) => a.number - b.number);
  return { kind: "crossword", width: layout.width, height: layout.height, solution, numbers, across, down };
}
