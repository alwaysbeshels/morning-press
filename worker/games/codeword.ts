import { prepareBank } from "./crossword";
import { buildLayout, type LayoutOptions } from "./layout";
import type { Rng } from "./rng";
import type { CodewordGame, WordEntry } from "./types";

export const CODEWORD_OPTIONS: LayoutOptions = {
  minWords: 14,
  maxWords: 20,
  maxSize: 13,
  attempts: 3,
  scan: 40,
  pool: 8,
  anchorLength: 7,
  goodCrossings: 22,
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function generateCodeword(rng: Rng, bank: readonly WordEntry[]): CodewordGame {
  const layout = buildLayout(prepareBank(bank), rng, CODEWORD_OPTIONS);
  const letters: (string | null)[][] = [];
  for (let r = 0; r < layout.height; r++) letters.push(new Array<string | null>(layout.width).fill(null));
  for (const placed of layout.words) {
    for (let i = 0; i < placed.word.length; i++) {
      const r = placed.across ? placed.row : placed.row + i;
      const c = placed.across ? placed.col + i : placed.col;
      (letters[r] as (string | null)[])[c] = placed.word[i] as string;
    }
  }

  // Permutation aléatoire : la lettre permuted[i] reçoit le code i + 1.
  const permuted = rng.shuffle(ALPHABET);
  const codeOf: Record<string, number> = {};
  permuted.forEach((letter, i) => {
    codeOf[letter] = i + 1;
  });

  const counts: Record<string, number> = {};
  const grid = letters.map((row) =>
    row.map((letter) => {
      if (letter === null) return null;
      counts[letter] = (counts[letter] ?? 0) + 1;
      return codeOf[letter] as number;
    }),
  );

  const key = new Array<string>(26).fill("");
  for (const letter of Object.keys(counts)) key[(codeOf[letter] as number) - 1] = letter;

  const frequent = Object.keys(counts)
    .sort((a, b) => (counts[b] as number) - (counts[a] as number) || (a < b ? -1 : 1))
    .slice(0, 5);
  const revealed = rng
    .shuffle(frequent)
    .slice(0, 2 + rng.int(2))
    .map((letter) => codeOf[letter] as number)
    .sort((a, b) => a - b);

  return { kind: "codeword", width: layout.width, height: layout.height, grid, key, revealed };
}
