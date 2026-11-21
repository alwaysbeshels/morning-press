import { describe, expect, it } from "vitest";
import type { Language } from "../../shared/types";
import { generateCodeword } from "./codeword";
import { generateCrossword, numberGrid } from "./crossword";
import { LEXICON } from "./lexicon";
import { createRng } from "./rng";
import type { WordEntry } from "./types";
import { WORDS_EN } from "./words-en";
import { WORDS_FR } from "./words-fr";

const BANKS: Record<Language, readonly WordEntry[]> = { fr: WORDS_FR, en: WORDS_EN };
const SEEDS = 200;

interface Run {
  word: string;
  row: number;
  col: number;
}

/** Relit toutes les suites maximales d’au moins deux lettres, horizontales et verticales. */
function readRuns(grid: (string | null)[][]): { across: Run[]; down: Run[] } {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const at = (r: number, c: number): string | null =>
    r >= 0 && r < height && c >= 0 && c < width ? (grid[r]?.[c] ?? null) : null;
  const across: Run[] = [];
  const down: Run[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (at(r, c) === null) continue;
      if (at(r, c - 1) === null && at(r, c + 1) !== null) {
        let word = "";
        for (let k = c; at(r, k) !== null; k++) word += at(r, k);
        across.push({ word, row: r, col: c });
      }
      if (at(r - 1, c) === null && at(r + 1, c) !== null) {
        let word = "";
        for (let k = r; at(k, c) !== null; k++) word += at(k, c);
        down.push({ word, row: r, col: c });
      }
    }
  }
  return { across, down };
}

function expectConnected(grid: (string | null)[][]): void {
  const cells: [number, number][] = [];
  grid.forEach((row, r) => row.forEach((letter, c) => letter !== null && cells.push([r, c])));
  expect(cells.length).toBeGreaterThan(0);
  const seen = new Set<string>();
  const stack = [cells[0] as [number, number]];
  while (stack.length > 0) {
    const [r, c] = stack.pop() as [number, number];
    const key = `${r},${c}`;
    if (seen.has(key) || (grid[r]?.[c] ?? null) === null) continue;
    seen.add(key);
    stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  expect(seen.size).toBe(cells.length);
}

/** Vérifications communes : taille, mots de la banque, adjacence, connexité. */
function expectValidLayout(grid: (string | null)[][], width: number, height: number, allowed: ReadonlySet<string>): Run[] {
  expect(width).toBeLessThanOrEqual(13);
  expect(height).toBeLessThanOrEqual(13);
  expect(grid.length).toBe(height);
  for (const row of grid) expect(row.length).toBe(width);
  // La grille est rognée : chaque bord touche au moins une lettre.
  expect(grid[0]?.some((x) => x !== null)).toBe(true);
  expect(grid[height - 1]?.some((x) => x !== null)).toBe(true);
  expect(grid.some((row) => row[0] !== null)).toBe(true);
  expect(grid.some((row) => row[width - 1] !== null)).toBe(true);

  const { across, down } = readRuns(grid);
  const runs = [...across, ...down];
  for (const run of runs) expect(allowed.has(run.word), run.word).toBe(true);
  expect(new Set(runs.map((run) => run.word)).size).toBe(runs.length);

  // Chaque lettre appartient à au moins un mot (aucune lettre isolée).
  const covered = new Set<string>();
  for (const run of across) for (let i = 0; i < run.word.length; i++) covered.add(`${run.row},${run.col + i}`);
  for (const run of down) for (let i = 0; i < run.word.length; i++) covered.add(`${run.row + i},${run.col}`);
  grid.forEach((row, r) =>
    row.forEach((letter, c) => {
      if (letter !== null) expect(covered.has(`${r},${c}`)).toBe(true);
    }),
  );
  expectConnected(grid);
  return runs;
}

describe.each(["fr", "en"] as Language[])("mots croisés (%s)", (language) => {
  const bank = BANKS[language];
  const clues = new Map(bank.map((entry) => [entry.word, entry.clue]));
  const allowed = new Set(bank.map((entry) => entry.word));

  it(`produit ${SEEDS} grilles valides`, () => {
    for (let i = 0; i < SEEDS; i++) {
      const game = generateCrossword(createRng(`croisés-${language}-${i}`), bank);
      const runs = expectValidLayout(game.solution, game.width, game.height, allowed);
      const entries = [...game.across, ...game.down];
      expect(entries.length).toBeGreaterThanOrEqual(10);
      expect(entries.length).toBeLessThanOrEqual(14);

      // Chaque suite relue correspond exactement à un mot placé, et réciproquement.
      const { across, down } = readRuns(game.solution);
      const asKey = (e: { answer?: string; word?: string; row: number; col: number }) =>
        `${e.answer ?? e.word}@${e.row},${e.col}`;
      expect(across.map(asKey).sort()).toEqual(game.across.map(asKey).sort());
      expect(down.map(asKey).sort()).toEqual(game.down.map(asKey).sort());
      expect(runs.length).toBe(entries.length);

      // Lettres cohérentes aux croisements.
      for (const e of game.across) {
        for (let k = 0; k < e.answer.length; k++) expect(game.solution[e.row]?.[e.col + k]).toBe(e.answer[k]);
      }
      for (const e of game.down) {
        for (let k = 0; k < e.answer.length; k++) expect(game.solution[e.row + k]?.[e.col]).toBe(e.answer[k]);
      }

      // Définitions issues de la banque.
      for (const e of entries) expect(e.clue).toBe(clues.get(e.answer));

      // Numérotation standard.
      expect(game.numbers).toEqual(numberGrid(game.solution));
      let expected = 1;
      game.numbers.forEach((row, r) =>
        row.forEach((n, c) => {
          if (n === null) return;
          expect(n).toBe(expected++);
          const startsWord = entries.some((e) => e.row === r && e.col === c);
          expect(startsWord).toBe(true);
        }),
      );
      for (const e of entries) expect(game.numbers[e.row]?.[e.col]).toBe(e.number);
      const sorted = (list: { number: number }[]) => list.every((e, k) => k === 0 || (list[k - 1]?.number ?? 0) < e.number);
      expect(sorted(game.across)).toBe(true);
      expect(sorted(game.down)).toBe(true);
    }
  });
});

describe.each(["fr", "en"] as Language[])("mots codés (%s)", (language) => {
  const lexicon = LEXICON[language];
  const allowed = new Set(lexicon);

  it(`produit ${SEEDS} grilles valides`, () => {
    for (let i = 0; i < SEEDS; i++) {
      const game = generateCodeword(createRng(`codés-${language}-${i}`), lexicon);
      expect(game.key).toHaveLength(26);

      const usedCodes = new Set<number>();
      for (const row of game.grid) {
        for (const code of row) {
          if (code === null) continue;
          expect(Number.isInteger(code)).toBe(true);
          expect(code).toBeGreaterThanOrEqual(1);
          expect(code).toBeLessThanOrEqual(26);
          usedCodes.add(code);
        }
      }

      // Correspondance injective : une lettre par code utilisé, lettres toutes distinctes.
      const letters = game.key.filter((letter) => letter !== "");
      expect(new Set(letters).size).toBe(letters.length);
      game.key.forEach((letter, k) => {
        if (usedCodes.has(k + 1)) expect(letter).toMatch(/^[A-Z]$/);
        else expect(letter).toBe("");
      });

      const decoded = game.grid.map((row) => row.map((code) => (code === null ? null : (game.key[code - 1] as string))));
      const runs = expectValidLayout(decoded, game.width, game.height, allowed);
      expect(runs.length).toBeGreaterThanOrEqual(14);
      expect(runs.length).toBeLessThanOrEqual(20);

      expect(game.revealed.length).toBeGreaterThanOrEqual(2);
      expect(game.revealed.length).toBeLessThanOrEqual(3);
      expect(new Set(game.revealed).size).toBe(game.revealed.length);
      for (const code of game.revealed) expect(usedCodes.has(code)).toBe(true);
    }
  });
});
