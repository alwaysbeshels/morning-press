import { GAME_KINDS, type GameKind, type Language } from "../../shared/types";
import { generateCodeword } from "./codeword";
import { generateCrossword } from "./crossword";
import { fetchCrosswordEntries, MIN_DICTIONARY_CLUES } from "./dictionary";
import { GAME_STRINGS } from "./labels";
import { generateCryptogram, generateJumble, generateKakuro, generateKenKen, generateWordLadder, generateWordSearch } from "./puzzles";
import { createRng } from "./rng";
import { generateSudoku } from "./sudoku";
import type { Game } from "./types";
import { LEXICON } from "./lexicon";
import { WORDS_EN } from "./words-en";
import { WORDS_FR } from "./words-fr";

export type { CodewordGame, CrosswordEntry, CrosswordGame, Game, SudokuGame } from "./types";
export { GAME_LABELS } from "./labels";
export { GAME_EXTRA_SLOT, renderGame, withGameExtra } from "./render";
export { GAME_STYLES } from "./styles";

export interface GenerateGameOptions {
  seed: string;
  language: Language;
  kinds: readonly GameKind[];
  /** Jeu de l’édition précédente : écarté tant qu’un autre jeu est activé. */
  avoid?: GameKind | null;
}

function selectKind(options: GenerateGameOptions): GameKind | null {
  const enabled = GAME_KINDS.filter((kind) => options.kinds.includes(kind));
  if (enabled.length === 0) return null;
  const kinds = enabled.length > 1 ? enabled.filter((kind) => kind !== options.avoid) : enabled;
  return createRng(`${options.seed}|kind|${kinds.join(",")}`).pick(kinds);
}

/**
 * Choisit et génère le jeu du jour. Déterministe pour une même graine, langue et
 * ensemble de jeux ; null si aucun jeu n’est activé.
 * Les mots croisés utilisent ici les définitions locales (hors ligne, tests, repli).
 */
export function generateGame(options: GenerateGameOptions): Game | null {
  const kind = selectKind(options);
  if (!kind) return null;
  // Graine propre au type de jeu : la grille ne dépend pas des autres jeux activés.
  const rng = createRng(`${options.seed}|${kind}|${options.language}`);
  const clues = options.language === "en" ? WORDS_EN : WORDS_FR;
  switch (kind) {
    case "sudoku":
      return generateSudoku(rng);
    case "crossword":
      return generateCrossword(rng, clues);
    case "codeword":
      return generateCodeword(rng, LEXICON[options.language]);
    case "jumble":
      return generateJumble(rng, options.language);
    case "cryptogram":
      return generateCryptogram(rng, options.language);
    case "wordsearch":
      return generateWordSearch(rng, options.language);
    case "wordladder":
      return generateWordLadder(rng, options.language);
    case "kenken":
      return generateKenKen(rng);
    case "kakuro":
      return generateKakuro(rng);
  }
}

/**
 * Jeu d’une édition publiée. Les mots croisés prennent leurs définitions
 * dans Wiktionary ; si le dictionnaire ne répond pas, on revient aux définitions locales.
 */
export async function generateEditionGame(options: GenerateGameOptions): Promise<Game | null> {
  const kind = selectKind(options);
  if (!kind) return null;
  if (kind === "crossword") {
    try {
      const rng = createRng(`${options.seed}|${kind}|${options.language}`);
      const entries = await fetchCrosswordEntries(options.language, rng);
      if (entries.length >= MIN_DICTIONARY_CLUES) {
        const game = generateCrossword(rng, entries);
        if (game.across.length + game.down.length >= 10) {
          return { ...game, source: GAME_STRINGS[options.language].dictionary };
        }
      }
    } catch {
      // Wiktionary indisponible : le recueil local suffit pour cette édition.
    }
  }
  return generateGame({ ...options, kinds: [kind] });
}
