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
  /** Source des définitions, affichée sous les clés. */
  source?: string;
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

export interface JumbleClue {
  /** Anagramme affiché au-dessus des cases. */
  scrambled: string;
  /** Mot à retrouver, une lettre par case. */
  answer: string;
  /** Case encerclée dans le mot retrouvé. Sa lettre entre dans la phrase finale. */
  circled: number;
}

export interface JumbleGame {
  kind: "jumble";
  clues: JumbleClue[];
  /** Phrase finale, mots séparés par des espaces. */
  answer: string;
}

export interface CryptogramGame {
  kind: "cryptogram";
  /** Texte chiffré, ponctuation et espaces conservés. La lettre donnée reste en clair. */
  puzzle: string;
  solution: string;
  /** Lettre déjà donnée, en clair. */
  revealed: string;
  /** `cipher[i]` remplace la lettre A + i. */
  cipher: string;
}

export interface WordSearchGame {
  kind: "wordsearch";
  grid: string[][];
  words: string[];
  /** `null` pour une case de remplissage. */
  mask: (string | null)[][];
}

export interface WordLadderGame {
  kind: "wordladder";
  start: string;
  end: string;
  /** Chaîne complète, départ et arrivée inclus. Une seule échelle, continuée d'une colonne à l'autre. */
  steps: string[];
  /** `across` : les mots sont trop longs pour deux colonnes, l'échelle va de gauche à droite. */
  flow: "columns" | "across";
  columns: 2 | 3;
}

export interface KenKenCage {
  cells: [number, number][];
  op: "" | "+" | "-" | "×" | "÷";
  target: number;
}

export interface KenKenGame {
  kind: "kenken";
  size: number;
  cages: KenKenCage[];
  solution: number[][];
}

export interface KakuroRun {
  dir: "across" | "down";
  sum: number;
  cells: [number, number][];
}

export interface KakuroGame {
  kind: "kakuro";
  width: number;
  height: number;
  /** `null` pour une case noire ou une case-somme. */
  solution: (number | null)[][];
  runs: KakuroRun[];
  /** Quelques chiffres déjà inscrits, seulement s'ils sont nécessaires pour qu'il n'y ait qu'une solution. */
  givens: [number, number, number][];
}

export type Game = SudokuGame | CrosswordGame | CodewordGame | JumbleGame | CryptogramGame | WordSearchGame | WordLadderGame | KenKenGame | KakuroGame;

export interface WordEntry {
  word: string;
  clue: string;
}
