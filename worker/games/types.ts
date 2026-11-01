export interface SudokuGame {
  kind: "sudoku";
  /** 81 chiffres, ligne par ligne ; « 0 » = case vide. */
  puzzle: string;
  /** 81 chiffres, ligne par ligne. */
  solution: string;
}

export interface CrosswordEntry {
  number: number;
  clue: string;
  answer: string;
  row: number;
  col: number;
}

export interface CrosswordGame {
  kind: "crossword";
  width: number;
  height: number;
  /** Lettres A–Z, ou null pour les cases inutilisées. */
  solution: (string | null)[][];
  numbers: (number | null)[][];
  across: CrosswordEntry[];
  down: CrosswordEntry[];
}

export interface CodewordGame {
  kind: "codeword";
  width: number;
  height: number;
  /** Code 1..26 par case, ou null pour les cases inutilisées. */
  grid: (number | null)[][];
  /** key[code - 1] = lettre ; chaîne vide si le code n’apparaît pas dans la grille. */
  key: string[];
  /** Codes dont la lettre est donnée au lecteur. */
  revealed: number[];
}

export type Game = SudokuGame | CrosswordGame | CodewordGame;

export interface WordEntry {
  word: string;
  clue: string;
}
