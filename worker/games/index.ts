import { GAME_KINDS, type GameKind, type Language } from "../../shared/types";
import { generateCodeword } from "./codeword";
import { generateCrossword } from "./crossword";
import { createRng } from "./rng";
import { generateSudoku } from "./sudoku";
import type { Game } from "./types";
import { WORDS_EN } from "./words-en";
import { WORDS_FR } from "./words-fr";

export type { CodewordGame, CrosswordEntry, CrosswordGame, Game, SudokuGame } from "./types";
export { GAME_LABELS } from "./labels";
export { renderGame } from "./render";
export { GAME_STYLES } from "./styles";

export interface GenerateGameOptions {
  seed: string;
  language: Language;
  kinds: readonly GameKind[];
}

/**
 * Choisit et génère le jeu du jour. Déterministe pour une même graine, langue et
 * ensemble de jeux ; null si aucun jeu n’est activé.
 */
export function generateGame(options: GenerateGameOptions): Game | null {
  const kinds = GAME_KINDS.filter((kind) => options.kinds.includes(kind));
  if (kinds.length === 0) return null;
  const kind = createRng(`${options.seed}|kind|${kinds.join(",")}`).pick(kinds);
  // Graine propre au type de jeu : la grille ne dépend pas des autres jeux activés.
  const rng = createRng(`${options.seed}|${kind}|${options.language}`);
  const bank = options.language === "en" ? WORDS_EN : WORDS_FR;
  switch (kind) {
    case "sudoku":
      return generateSudoku(rng);
    case "crossword":
      return generateCrossword(rng, bank);
    case "codeword":
      return generateCodeword(rng, bank);
  }
}
